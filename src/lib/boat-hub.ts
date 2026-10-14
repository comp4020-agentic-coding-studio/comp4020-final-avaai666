// The boat game's rooms at run time (experimental; docs/boats/RULES.md).
// One simulation per running match, stepped by a timer at 20 ticks a second
// from the match's start time (catching up without skipping a tick). Inputs
// that arrive between ticks are applied at the next tick, in arrival order,
// and written to the store with that tick first, so the stored inputs are
// exactly what the simulation saw. Every second tick a frame goes to each
// stream, with the events of those ticks. The browser decides nothing.
//
// A restart ends a running match as "interrupted" and returns its room to the
// lobby (players keep their seats): a two-minute race is not resumed.
import { randomBytes } from "node:crypto";
import type { ServerResponse } from "node:http";
import { BOAT_MODEL, type BotKind, frameOf, type Input, makeSim, Q, resultsOf, type Result, type Sim, type SimEvent, step } from "./boat-sim.ts";
import { BOAT_MAX_PLAYERS, BOT_NAMES, type BoatStore, type SeatInfo } from "./boat-store.ts";
import { BOAT_BOT_ORDER as BOT_ORDER, BOAT_FRAME_EVERY as FRAME_EVERY, BOAT_HEARTBEAT_MS as HEARTBEAT_MS, BOAT_MAX_CATCHUP as MAX_CATCHUP, BOAT_MAX_RUNNING } from "./game-constants.ts";

// which boat each person had: people take the first boats, in seat order
const humanSeatsOf = (seats: SeatInfo[], players: { seat: number; name: string }[]): Map<number, number> =>
  new Map(players.flatMap((p) => { const i = seats.findIndex((s) => s.bot === null && s.name === p.name); return i >= 0 ? [[p.seat, i] as [number, number]] : []; }));
export const MAX_RUNNING = BOAT_MAX_RUNNING;

interface Stream { res: ServerResponse; seat: number | null }
interface Match { id: number; sim: Sim; startedAt: number; seats: SeatInfo[]; queue: Input[]; pending: SimEvent[]; humanSeat: Map<number, number> }
interface Room { id: number; code: string; state: "lobby" | "play" | "end"; match: Match | null; streams: Set<Stream>; last: { seats: SeatInfo[]; results: Result[]; matchId: number; humanSeat: Map<number, number> } | null; note: string | null }

export interface RoomView {
  code: string; state: Room["state"]; me: number | null; myBoat: number | null; players: { seat: number; name: string }[];
  seats: SeatInfo[] | null; results: Result[] | null; note: string | null; rules: typeof RULES_SUMMARY;
}
export const RULES_SUMMARY = { seconds: Q.SECONDS, hold: Q.HOLD, ramDrop: Q.RAM_DROP, koi: Q.KOI_VALUE } as const;

export interface BoatHub {
  view(code: string, me: number | null): RoomView | null;
  join(code: string, name: string): ReturnType<BoatStore["join"]>;
  start(code: string, seat: number, opts: { bots: boolean }): { ok: true } | { ok: false; reason: string };
  input(code: string, seat: number, inp: { kind: string; x?: unknown; y?: unknown }): { ok: true } | { ok: false; reason: string };
  open(code: string, res: ServerResponse, seat: number | null): boolean;
  tick(): void;
  running(): number;
  close(): void;
}

export function createBoatHub(store: BoatStore, now: () => number, onError: (e: unknown) => void): BoatHub {
  const rooms = new Map<string, Room>();
  let lastBeat = now();

  // A restart: whatever was running is over.
  for (const m of store.runningMatches()) store.endMatch(m.id, now(), "interrupted", null);

  function load(code: string): Room | null {
    const cached = rooms.get(code);
    if (cached) return cached;
    const r = store.roomByCode(code);
    if (!r) return null;
    const room: Room = { id: r.id, code, state: "lobby", match: null, streams: new Set(), last: null, note: null };
    const lm = store.lastMatch(r.id);
    if (lm?.status === "done" && lm.results) { room.state = "end"; room.last = { seats: lm.seats, results: lm.results, matchId: lm.id, humanSeat: humanSeatsOf(lm.seats, store.players(r.id)) }; }
    if (lm?.status === "interrupted") room.note = "The last match was interrupted by a server restart. Start again when you're ready.";
    rooms.set(code, room);
    return room;
  }

  const send = (s: Stream, event: string, data: unknown): void => { if (!s.res.destroyed) s.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const viewOf = (room: Room, me: number | null): RoomView => ({
    code: room.code, state: room.state, me, myBoat: me === null ? null : ((room.match?.humanSeat ?? room.last?.humanSeat)?.get(me) ?? null), players: store.players(room.id),
    seats: room.match?.seats ?? room.last?.seats ?? null, results: room.state === "end" ? (room.last?.results ?? null) : null, note: room.note, rules: RULES_SUMMARY,
  });
  const broadcastRoom = (room: Room): void => { for (const s of room.streams) send(s, "room", viewOf(room, s.seat)); };

  function finish(room: Room): void {
    const m = room.match!;
    const results = resultsOf(m.sim);
    store.endMatch(m.id, now(), "done", results);
    room.last = { seats: m.seats, results, matchId: m.id, humanSeat: m.humanSeat };
    room.state = "end"; room.match = null;
    broadcastRoom(room);
  }

  return {
    view(code, me) {
      const room = load(code);
      return room ? viewOf(room, me) : null;
    },
    join(code, name) {
      const room = load(code);
      if (!room) return { ok: false, reason: "no_room" };
      const r = store.join(room.id, name);
      if (r.ok) broadcastRoom(room);
      return r;
    },
    start(code, seat, { bots }) {
      const room = load(code);
      if (!room) return { ok: false, reason: "no_room" };
      if (room.state === "play") return { ok: false, reason: "playing" };
      if ([...rooms.values()].filter((r) => r.state === "play").length >= MAX_RUNNING) return { ok: false, reason: "busy" };
      const humans = store.players(room.id);
      if (!humans.some((p) => p.seat === seat)) return { ok: false, reason: "not_in_room" };
      // seats: people first (by seat), then bots; at least two boats on the lake
      const seats: SeatInfo[] = humans.map((p, i) => ({ seat: i, name: p.name, bot: null }));
      const humanSeat = new Map(humans.map((p, i) => [p.seat, i]));
      const want = bots ? BOAT_MAX_PLAYERS : Math.max(2, seats.length);
      for (let k = 0; seats.length < want; k++) { const kind = BOT_ORDER[k]; seats.push({ seat: seats.length, name: BOT_NAMES[kind], bot: kind }); }
      const seed = randomBytes(32).toString("hex"); // the match's 256-bit secret
      const startedAt = now() + 3000; // a three-second countdown everyone sees
      const id = store.startMatch(room.id, BOAT_MODEL, "quick", seed, seats, startedAt);
      const sim = makeSim(seed, seats.map((s) => s.bot));
      room.match = { id, sim, startedAt, seats: seats.map((s) => ({ ...s })), queue: [], pending: [], humanSeat };
      room.state = "play"; room.note = null;
      broadcastRoom(room);
      for (const s of room.streams) send(s, "go", { startedAt, serverNow: now(), frame: frameOf(sim) });
      return { ok: true };
    },
    input(code, playerSeat, inp) {
      const room = load(code);
      if (!room?.match || room.state !== "play") return { ok: false, reason: "not_playing" };
      const m = room.match;
      const seat = m.humanSeat.get(playerSeat);
      if (seat === undefined) return { ok: false, reason: "not_in_match" };
      if (inp.kind === "steer") {
        const x = Number(inp.x), y = Number(inp.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: "bad_input" };
        // one steer per seat per tick: the latest wins
        m.queue = m.queue.filter((q) => !(q.seat === seat && q.kind === "steer"));
        m.queue.push({ seat, kind: "steer", x: Math.round(Math.max(0, Math.min(Q.W, x))), y: Math.round(Math.max(0, Math.min(Q.H, y))) });
      } else if (inp.kind === "cast" || inp.kind === "dash") {
        if (!m.queue.some((q) => q.seat === seat && q.kind === inp.kind)) m.queue.push({ seat, kind: inp.kind });
      } else return { ok: false, reason: "bad_input" };
      return { ok: true };
    },
    open(code, res, seat) {
      const room = load(code);
      if (!room) return false;
      res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
      res.write("retry: 1000\n\n");
      const s: Stream = { res, seat };
      room.streams.add(s);
      send(s, "room", viewOf(room, seat));
      if (room.match) send(s, "go", { startedAt: room.match.startedAt, serverNow: now(), frame: frameOf(room.match.sim) });
      res.on("close", () => room.streams.delete(s));
      return true;
    },
    tick() {
      const t = now();
      for (const room of rooms.values()) {
        const m = room.match;
        if (!m || room.state !== "play") continue;
        try {
          const target = Math.floor((t - m.startedAt) / (Q.DT * 1000));
          let n = 0;
          while (m.sim.tick < target && !m.sim.over && n < MAX_CATCHUP) {
            const inputs = m.queue; m.queue = [];
            store.logInputs(m.id, m.sim.tick, inputs);
            m.pending.push(...step(m.sim, inputs));
            n++;
            if (m.sim.tick % FRAME_EVERY === 0 || m.sim.over) {
              const frame = { ...frameOf(m.sim), ev: m.pending };
              m.pending = [];
              for (const s of room.streams) send(s, "frame", frame);
            }
          }
          if (m.sim.over) finish(room);
        } catch (e) { onError(e); }
      }
      if (t - lastBeat > HEARTBEAT_MS) { lastBeat = t; for (const room of rooms.values()) for (const s of room.streams) if (!s.res.destroyed) s.res.write(": keep-alive\n\n"); }
      // forget idle rooms nobody is watching
      for (const [code, room] of rooms) if (room.state !== "play" && room.streams.size === 0) rooms.delete(code);
    },
    running: () => [...rooms.values()].filter((r) => r.state === "play").length,
    close() {
      for (const room of rooms.values()) {
        if (room.match) store.endMatch(room.match.id, now(), "interrupted", null);
        for (const s of room.streams) s.res.end();
      }
      rooms.clear();
    },
  };
}
