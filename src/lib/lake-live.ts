// The lake hub (DESIGN.md v2.2, "Real time", "Frames and events"): one
// runner per live lake, driven by a 100 ms timer. Every row goes out as a
// `row` event the moment it is written; every other step (0.2 s) a `frame`
// event carries the fish. A page that reconnects gets the rows after its
// last event id, then a fresh snapshot; frames are never replayed.
//
// Before the start, a lake has no runner, but its lobby is live too: a
// stream opened on /l/CODE/events gets each join as a public `row` event as
// it is written, and `reload` (then closes) when the season starts.
import type { ServerResponse } from "node:http";
import { publicRow, type PublicRow, type Runner } from "./lake-runner.ts";
import type { FamilyRow, LakeLedgerRow } from "./lake-store.ts";

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

// Thrown by register() when MAX_LIVE_LAKES are already live (crash fix in
// frozen code: a route catches this and answers a clear, non-500 message
// instead of letting it become an unhandled 500).
export class LakeFull extends Error {
  readonly lakeFull = true as const;
  constructor() {
    super("full");
  }
}

export interface LakeHub {
  // Registers a runner that just started (or was rebuilt at boot) as live.
  // Throws LakeFull if MAX_LIVE_LAKES are already live.
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

  // ---- the lobby, before a lake has started ----
  openLobby(lakeId: number, res: ServerResponse): void;
  // A join row was just written: sends it to the lake's lobby streams.
  lobbyJoined(lakeId: number, row: LakeLedgerRow, families: FamilyRow[]): void;
  // The season just started: `reload` to every lobby stream, then closes them.
  lobbyStarted(lakeId: number): void;
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
  const lobbies = new Map<number, Set<ServerResponse>>();
  let ticks = 0;

  const write = (s: Stream, chunk: string): void => {
    if (!s.res.destroyed) s.res.write(chunk);
  };

  const writeRes = (res: ServerResponse, chunk: string): void => {
    if (!res.destroyed) res.write(chunk);
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
      if (lakes.size >= MAX_LIVE_LAKES && !lakes.has(runner.lakeId)) throw new LakeFull();
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
      if (ticks % HEARTBEAT_TICKS === 0) {
        for (const streams of lobbies.values()) for (const res of streams) writeRes(res, ": keep-alive\n\n");
      }
    },

    close() {
      for (const live of lakes.values()) for (const s of live.streams) s.res.end();
      lakes.clear();
      for (const streams of lobbies.values()) for (const res of streams) res.end();
      lobbies.clear();
    },

    openLobby(lakeId, res) {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      writeRes(res, "retry: 1000\n\n");
      let streams = lobbies.get(lakeId);
      if (!streams) {
        streams = new Set();
        lobbies.set(lakeId, streams);
      }
      streams.add(res);
      res.on("close", () => streams!.delete(res));
    },

    lobbyJoined(lakeId, row, families) {
      const streams = lobbies.get(lakeId);
      if (!streams || streams.size === 0) return;
      const seatOf = new Map(families.map((f) => [f.familyId, f.seat]));
      const chunk = publicRowEvent(publicRow(row, seatOf));
      for (const res of streams) writeRes(res, chunk);
    },

    lobbyStarted(lakeId) {
      const streams = lobbies.get(lakeId);
      if (!streams) return;
      for (const res of streams) {
        writeRes(res, "event: reload\ndata: {}\n\n");
        res.end();
      }
      lobbies.delete(lakeId);
    },
  };
}

export { MAX_LIVE_LAKES };
