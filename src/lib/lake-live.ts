// The lake hub (DESIGN.md v2.2, "Real time", "Frames and events"): one
// runner per live lake, driven by a 100 ms timer. Every row goes out as a
// `row` event the moment it is written; every other step (0.2 s) a `frame`
// event carries the fish. A page that reconnects gets the rows after its
// last event id, then a fresh snapshot; frames are never replayed.
import type { ServerResponse } from "node:http";
import { type PublicRow, type Runner } from "./lake-runner.ts";

const HEARTBEAT_TICKS = 150; // a comment line every 15 s at a 100 ms tick
const MAX_REPLAY = 2000;
const MAX_LIVE_LAKES = 12;

interface Stream {
  res: ServerResponse;
  seat: number | null;
}

interface LiveLake {
  runner: Runner;
  streams: Set<Stream>;
  sentUpTo: number;
}

export interface LakeHub {
  // Registers a runner that just started (or was rebuilt at boot) as live.
  // Throws "full" if MAX_LIVE_LAKES are already live.
  register(runner: Runner): void;
  isLive(lakeId: number): boolean;
  // Looks up the runner for an action route. Null if the lake is not live.
  runnerFor(lakeId: number): Runner | null;
  // Opens a stream for a lake that is live (the caller checks liveness first).
  open(lakeId: number, res: ServerResponse, seat: number | null, lastEventId: number | null): void;
  // After a human action writes rows directly (outside the timer): flushes them.
  afterWrite(lakeId: number): void;
  // Every 100 ms: advances every runner, flushes new rows, sends frames due.
  tick(): void;
  close(): void;
}

function publicRowEvent(row: PublicRow): string {
  return `event: row\nid: ${row.id}\ndata: ${JSON.stringify(row)}\n\n`;
}

function frameEvent(frame: unknown): string {
  return `event: frame\ndata: ${JSON.stringify(frame)}\n\n`;
}

function snapshotEvent(snapshot: unknown): string {
  return `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
}

export function createLakeHub(onError: (err: unknown) => void): LakeHub {
  const lakes = new Map<number, LiveLake>();
  let ticks = 0;

  const write = (s: Stream, chunk: string): void => {
    if (!s.res.destroyed) s.res.write(chunk);
  };

  // Every public row after sentUpTo, to the lake's streams.
  function flush(live: LiveLake): void {
    for (;;) {
      const rows = live.runner.rowsAfter(live.sentUpTo, MAX_REPLAY);
      for (const row of rows) {
        const chunk = publicRowEvent(row);
        for (const s of live.streams) write(s, chunk);
        live.sentUpTo = row.id;
      }
      if (rows.length < MAX_REPLAY) return;
    }
  }

  return {
    register(runner) {
      if (lakes.size >= MAX_LIVE_LAKES && !lakes.has(runner.lakeId)) throw new Error("full");
      lakes.set(runner.lakeId, { runner, streams: new Set(), sentUpTo: 0 });
    },

    isLive(lakeId) {
      return lakes.has(lakeId);
    },

    runnerFor(lakeId) {
      return lakes.get(lakeId)?.runner ?? null;
    },

    open(lakeId, res, seat, lastEventId) {
      const live = lakes.get(lakeId);
      if (!live) throw new Error("not live");
      flush(live);

      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      const stream: Stream = { res, seat };
      write(stream, "retry: 1000\n\n");

      if (lastEventId !== null && lastEventId < live.sentUpTo) {
        const rows = live.runner.rowsAfter(lastEventId, MAX_REPLAY + 1).filter((r) => r.id <= live.sentUpTo);
        if (rows.length > MAX_REPLAY) write(stream, "event: reload\ndata: {}\n\n");
        else for (const row of rows) write(stream, publicRowEvent(row));
      }

      live.streams.add(stream);
      write(stream, snapshotEvent(live.runner.snapshot()));

      res.on("close", () => live.streams.delete(stream));
    },

    afterWrite(lakeId) {
      const live = lakes.get(lakeId);
      if (!live) return;
      flush(live);
    },

    tick() {
      ticks++;
      const now = Date.now();
      for (const [lakeId, live] of lakes) {
        try {
          const frameDue = live.runner.advance(now);
          flush(live);
          if (frameDue) {
            const chunk = frameEvent(live.runner.frame());
            for (const s of live.streams) write(s, chunk);
          }
          if (live.runner.isOver() && live.streams.size === 0) lakes.delete(lakeId);
          else if (ticks % HEARTBEAT_TICKS === 0) for (const s of live.streams) write(s, ": keep-alive\n\n");
        } catch (err) {
          onError(err);
        }
      }
    },

    close() {
      for (const live of lakes.values()) for (const s of live.streams) s.res.end();
      lakes.clear();
    },
  };
}

export { MAX_LIVE_LAKES };
