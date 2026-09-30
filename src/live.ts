// The live hub (DESIGN.md, Live events): per pond, the open streams, the nets
// they belong to and when a net's last stream closed. Rows go out as `row`
// events with the row id, snapshots as `snapshot` events with none.
import type { ServerResponse } from "node:http";
import { available, growthPerMin } from "./lib/pond.ts";
import type { Clock, LedgerRow, PondState, Store } from "./lib/store.ts";

const PRESENT_GRACE_MS = 15_000;
const HEARTBEAT_TICKS = 15; // a comment line every 15 s keeps proxies from closing the stream
const MAX_REPLAY = 500;

interface Stream {
  res: ServerResponse;
  netId: number | null;
}

interface LivePond {
  streams: Set<Stream>;
  // the last ledger row sent to this pond's streams
  sentUpTo: number;
  // net id → when its last stream closed
  leftAt: Map<number, number>;
}

export interface Hub {
  // Opens a stream. Replays rows after lastEventId (if given), then sends a
  // snapshot. Throws NoPondError if there is no such pond.
  open(pondId: number, res: ServerResponse, netId: number | null, lastEventId: number | null): void;
  // After a join or a catch: sends the new rows, then a snapshot.
  afterWrite(pondId: number): void;
  // Once a second: a snapshot to every pond with viewers, and a dead pond's
  // collapse row, whoever wrote it.
  tick(): void;
  close(): void;
}

// The only shapes that leave the server on a stream: no idempotency key, no
// net id, no token.
function rowEvent(row: LedgerRow, names: Map<number, string>): string {
  const data = {
    id: row.id,
    kind: row.kind,
    at: row.at,
    name: row.netId === null ? null : (names.get(row.netId) ?? null),
    available: available(row.stockAfter),
  };
  return `event: row\nid: ${row.id}\ndata: ${JSON.stringify(data)}\n\n`;
}

function snapshotEvent(state: PondState, at: number, viewers: number, present: (netId: number) => boolean): string {
  const data = {
    at,
    available: state.available,
    regrowthPerMin: state.dead ? 0 : Math.round(growthPerMin(state.stock)) || 0,
    dead: state.dead,
    diedAt: state.diedAt,
    viewers,
    nets: state.nets.map((n) => ({ name: n.name, catches: n.catches, present: present(n.netId) })),
  };
  return `event: snapshot\ndata: ${JSON.stringify(data)}\n\n`;
}

const namesOf = (state: PondState): Map<number, string> => new Map(state.nets.map((n) => [n.netId, n.name]));

export function createHub(store: Store, now: Clock, onError: (err: unknown) => void): Hub {
  const ponds = new Map<number, LivePond>();
  let ticks = 0;

  const write = (s: Stream, chunk: string): void => {
    if (!s.res.destroyed) s.res.write(chunk);
  };

  const presence = (p: LivePond, t: number) => (netId: number): boolean => {
    for (const s of p.streams) if (s.netId === netId) return true;
    const left = p.leftAt.get(netId);
    return left !== undefined && t - left < PRESENT_GRACE_MS;
  };

  // Sends every row after sentUpTo to the pond's streams.
  function flush(pondId: number, p: LivePond, state: PondState): void {
    const names = namesOf(state);
    for (;;) {
      const rows = store.ledgerAfter(pondId, p.sentUpTo, MAX_REPLAY);
      for (const row of rows) {
        const chunk = rowEvent(row, names);
        for (const s of p.streams) write(s, chunk);
        p.sentUpTo = row.id;
      }
      if (rows.length < MAX_REPLAY) return;
    }
  }

  function snapshot(p: LivePond, state: PondState, to: Iterable<Stream>): void {
    const t = now();
    const chunk = snapshotEvent(state, t, p.streams.size, presence(p, t));
    for (const s of to) write(s, chunk);
  }

  return {
    open(pondId, res, netId, lastEventId) {
      const state = store.evaluate(pondId);
      let p = ponds.get(pondId);
      if (p) {
        flush(pondId, p, state);
      } else {
        p = { streams: new Set(), sentUpTo: store.recentRows(pondId, 1)[0].id, leftAt: new Map() };
        ponds.set(pondId, p);
      }

      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      const stream: Stream = { res, netId };
      write(stream, "retry: 1000\n\n");

      if (lastEventId !== null && lastEventId < p.sentUpTo) {
        const rows = store.ledgerAfter(pondId, lastEventId, MAX_REPLAY + 1).filter((r) => r.id <= p.sentUpTo);
        if (rows.length > MAX_REPLAY) {
          write(stream, "event: reload\ndata: {}\n\n");
        } else {
          const names = namesOf(state);
          for (const row of rows) write(stream, rowEvent(row, names));
        }
      }

      p.streams.add(stream);
      if (netId !== null) p.leftAt.delete(netId);
      snapshot(p, state, [stream]);

      const live = p;
      res.on("close", () => {
        live.streams.delete(stream);
        if (netId !== null && ![...live.streams].some((s) => s.netId === netId)) live.leftAt.set(netId, now());
      });
    },

    afterWrite(pondId) {
      const p = ponds.get(pondId);
      if (!p) return;
      const state = store.evaluate(pondId);
      flush(pondId, p, state);
      snapshot(p, state, p.streams);
    },

    tick() {
      ticks++;
      const t = now();
      for (const [pondId, p] of ponds) {
        try {
          for (const [netId, left] of p.leftAt) if (t - left >= PRESENT_GRACE_MS) p.leftAt.delete(netId);
          if (p.streams.size === 0) {
            if (p.leftAt.size === 0) ponds.delete(pondId);
            continue;
          }
          const state = store.evaluate(pondId);
          if (state.dead) flush(pondId, p, state);
          snapshot(p, state, p.streams);
          if (ticks % HEARTBEAT_TICKS === 0) for (const s of p.streams) write(s, ": keep-alive\n\n");
        } catch (err) {
          onError(err);
        }
      }
    },

    close() {
      for (const p of ponds.values()) for (const s of p.streams) s.res.end();
      ponds.clear();
    },
  };
}
