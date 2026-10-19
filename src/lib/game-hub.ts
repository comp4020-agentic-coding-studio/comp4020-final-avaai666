// The /play rooms at run time (DESIGN.md "The platform"). One simulation per
// running match, stepped by a timer at 20 ticks a second from the match's
// start time. People's inputs that arrive between ticks are validated by the
// mode, queued, and applied at the next tick; each bot's come from its own
// stream for that tick; all of them are written with that tick, so a replay
// never runs a bot. Every second tick each stream gets a frame built by
// frameFor() for its own seat, with only the events that seat may see.
//
// A restart ends a running match as "interrupted" and its room goes back to
// the lobby (DESIGN.md v2.4 c).
import { randomBytes } from "node:crypto";
import type { ServerResponse } from "node:http";
import { LAKE_DEAD, PLAY_COUNTDOWN_MS, PLAY_FRAME_EVERY, PLAY_HEARTBEAT_MS, PLAY_MAX_CATCHUP, PLAY_MAX_RUNNING, PLAY_TICK_MS } from "./game-constants.ts";
import { type AnyMode, type Character, eventsFor, type GameEvent, lakeAfterMatch, lakeAtStart, type Results, type Seat, tickOnce } from "./game-platform.ts";
import type { GameJoin, GameStore, MatchRow, Summary } from "./game-store.ts";

// Bots take characters nobody in the room has, in this order.
const BOT_CHARACTERS: Character[] = ["wang", "jin", "lu", "lian", "shitou", "mei"];
const BOT_LABEL: Record<Character, string> = { mei: "Mei", wang: "Old Wang", jin: "Jin", lu: "Lu", lian: "Lian", shitou: "Shitou" };

interface Stream { res: ServerResponse; seat: number | null }
interface Match {
  id: number; mode: AnyMode; sim: unknown; seed: string; seats: Seat[]; startedAt: number; tick: number;
  queue: { seat: number; i: unknown; kind: string }[]; pending: GameEvent[]; humanSeat: Map<number, number>;
  counts: Record<string, number>[]; lakeBefore: number; rematchBy: string | null;
}
interface Room { id: number; code: string; state: "lobby" | "play" | "end"; match: Match | null; streams: Set<Stream>; last: MatchRow | null; note: string | null }

export interface RoomView {
  code: string; mode: string; state: Room["state"]; me: number | null; mySeat: number | null;
  players: { seat: number; name: string; character: Character }[]; seats: Seat[] | null; startedAt: number | null;
  lake: { fish: number; died: boolean }; results: Summary | null; note: string | null; ready: string[];
  history: HistoryLine[]; // the room's finished matches, for "What happened here"
}
// one finished match, for the room's "What happened here" (no seed, no token)
export interface HistoryLine { endedAt: number; mode: string; winner: { kind: "seat"; name: string; character: string; bot: boolean } | { kind: "fishers" | "poacher" | "none" }; lakeBefore: number; lakeAfter: number }
export interface GameHub {
  createRoom(mode: string): { code: string }; // throws for a mode it does not know
  view(code: string, me: number | null): RoomView | null;
  join(code: string, name: string, character: string): GameJoin;
  setMode(code: string, seat: number, mode: string): { ok: true } | { ok: false; reason: string };
  start(code: string, seat: number, opts: { bots: boolean }): { ok: true } | { ok: false; reason: string };
  input(code: string, seat: number, raw: unknown): { ok: true } | { ok: false; reason: string };
  stop(code: string, seat: number): { ok: true } | { ok: false; reason: string }; // the room's first player ends a match: interrupted, no results
  open(code: string, res: ServerResponse, seat: number | null): boolean;
  summaries(code: string): unknown[] | null;
  history(code: string): HistoryLine[] | null; // finished matches, newest first
  readyModes(): string[];
  knows(mode: string): boolean;
  tick(): void;
  running(): number;
  close(): void;
}

export function createGameHub(store: GameStore, modes: Record<string, AnyMode>, now: () => number, onError: (e: unknown) => void, ready: string[]): GameHub {
  const rooms = new Map<string, Room>();
  let lastBeat = now();

  for (const m of store.runningMatches()) store.endMatch(m.id, now(), "interrupted", null, null);

  function load(code: string): Room | null {
    const cached = rooms.get(code);
    if (cached) return cached;
    const r = store.roomByCode(code);
    if (!r) return null;
    const room: Room = { id: r.id, code, state: "lobby", match: null, streams: new Set(), last: null, note: null };
    const lm = store.lastMatch(r.id);
    if (lm?.status === "done" && lm.summary) { room.state = "end"; room.last = lm; }
    if (lm?.status === "interrupted") room.note = "interrupted"; // a code: the page words it (src/lib/i18n.ts g_note_*)
    rooms.set(code, room);
    return room;
  }

  const send = (s: Stream, event: string, data: unknown): void => { if (!s.res.destroyed) s.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  // which seat in the match (or the last one) a player had: people sit first, by name
  const seatOf = (room: Room, me: number | null): number | null => {
    if (me === null) return null;
    if (room.match) return room.match.humanSeat.get(me) ?? null;
    const name = store.players(room.id).find((p) => p.seat === me)?.name;
    return room.last?.seats.find((s) => !s.bot && s.name === name)?.seat ?? null;
  };
  const viewOf = (room: Room, me: number | null): RoomView => {
    const r = store.roomByCode(room.code)!;
    return {
      code: room.code, mode: r.mode, state: room.state, me, mySeat: seatOf(room, me), players: store.players(room.id),
      seats: room.match?.seats ?? room.last?.seats ?? null, startedAt: room.match?.startedAt ?? null,
      lake: { fish: r.lakeFish, died: r.lakeFish < LAKE_DEAD }, results: room.state === "end" ? (room.last?.summary ?? null) : null,
      note: room.note, ready, history: historyOf(r.id),
    };
  };
  const historyOf = (roomId: number): HistoryLine[] =>
    store.matches(roomId).filter((m) => m.status === "done" && m.summary && m.endedAt !== null).reverse().map((m) => {
      const s = m.summary!, w = (s.extra as { winner?: string } | undefined)?.winner;
      const first = s.seats.filter((x) => x.place === 1);
      const winner: HistoryLine["winner"] = w === "fishers" || w === "poacher" ? { kind: w }
        : first.length === 1 ? { kind: "seat", name: first[0].name, character: first[0].character, bot: first[0].bot } : { kind: "none" };
      return { endedAt: m.endedAt!, mode: m.mode, winner, lakeBefore: s.lakeBefore, lakeAfter: s.lakeAfter };
    });
  const broadcastRoom = (room: Room): void => { for (const s of room.streams) send(s, "room", viewOf(room, s.seat)); };
  const frameFor = (m: Match, s: Stream): unknown => { const seat = s.seat === null ? -1 : (m.humanSeat.get(s.seat) ?? -1); return m.mode.frameFor(m.sim, seat); };
  const seatFor = (m: Match, s: Stream): number => (s.seat === null ? -1 : (m.humanSeat.get(s.seat) ?? -1));

  function finish(room: Room): void {
    const m = room.match!;
    const res: Results = m.mode.results(m.sim);
    const left = Math.max(0, Math.round(res.lakeLeft));
    const summary: Summary = {
      mode: m.mode.id, model: m.mode.model, durationS: Math.round(m.tick * PLAY_TICK_MS / 100) / 10, lakeBefore: m.lakeBefore, lakeAfter: left,
      rematchBy: m.rematchBy, highlights: res.highlights.map((h) => ({ ...h, text: h.text.replaceAll("{name}", m.seats.find((x) => x.seat === h.seat)?.name ?? "someone") })),
      seats: m.seats.map((st) => {
        const r = res.seats.find((x) => x.seat === st.seat)!;
        const { seat: _a, score: _b, place: _c, firstScoreS: _d, ...detail } = r;
        return { seat: st.seat, name: st.name, bot: st.bot !== null, character: st.character, inputs: m.counts[st.seat], firstScoreS: r.firstScoreS, score: r.score, place: r.place, detail };
      }),
    };
    const { seats: _s, lakeLeft: _l, highlights: _h, ...extra } = res;
    if (Object.keys(extra).length) summary.extra = extra;
    store.endMatch(m.id, now(), "done", summary, lakeAfterMatch(m.mode.breeds, left));
    room.last = store.match(m.id);
    room.state = "end"; room.match = null;
    broadcastRoom(room);
  }

  return {
    createRoom(mode) {
      if (!modes[mode]) throw new Error(`no mode ${mode}`);
      return { code: store.createRoom(mode).code };
    },
    view(code, me) {
      const room = load(code);
      return room ? viewOf(room, me) : null;
    },
    join(code, name, character) {
      const room = load(code);
      if (!room) return { ok: false, reason: "no_room" };
      const mode = modes[store.roomByCode(code)!.mode];
      const r = store.join(room.id, name, character, mode.seats.max);
      if (r.ok) broadcastRoom(room);
      return r;
    },
    setMode(code, seat, mode) {
      const room = load(code);
      if (!room) return { ok: false, reason: "no_room" };
      if (!modes[mode]) return { ok: false, reason: "bad_mode" };
      if (room.state === "play") return { ok: false, reason: "playing" };
      if (!store.players(room.id).some((p) => p.seat === seat)) return { ok: false, reason: "not_in_room" };
      store.setMode(room.id, mode);
      broadcastRoom(room);
      return { ok: true };
    },
    start(code, seat, { bots }) {
      const room = load(code);
      if (!room) return { ok: false, reason: "no_room" };
      if (room.state === "play") return { ok: false, reason: "playing" };
      const r = store.roomByCode(code)!;
      if (!ready.includes(r.mode)) return { ok: false, reason: "coming_soon" };
      const mode = modes[r.mode];
      if ([...rooms.values()].filter((x) => x.state === "play").length >= PLAY_MAX_RUNNING) return { ok: false, reason: "busy" };
      const humans = store.players(room.id);
      const me = humans.find((p) => p.seat === seat);
      if (!me) return { ok: false, reason: "not_in_room" };
      if (humans.length > mode.seats.max) return { ok: false, reason: "too_many" };
      const seats: Seat[] = humans.map((p, i) => ({ seat: i, name: p.name, bot: null, character: p.character }));
      const want = Math.max(bots ? mode.seats.botFill : 0, mode.seats.min);
      if (!bots && seats.length < mode.seats.min) return { ok: false, reason: "need_players" };
      const free = BOT_CHARACTERS.filter((c) => !humans.some((p) => p.character === c));
      for (let k = 0; seats.length < want; k++) {
        const c = free[k % free.length];
        seats.push({ seat: seats.length, name: `${BOT_LABEL[c]} (bot)`, bot: `bot${k}`, character: c });
      }
      const lake = lakeAtStart(r.lakeFish);
      const seed = randomBytes(32).toString("hex"); // the match's 256-bit secret
      const startedAt = now() + PLAY_COUNTDOWN_MS;
      const rematchBy = room.last ? me.name : null;
      const id = store.startMatch(room.id, mode.id, mode.model, seed, seats, lake.fish, startedAt, rematchBy);
      const sim = mode.make(seed, seats, lake);
      room.match = {
        id, mode, sim, seed, seats, startedAt, tick: 0, queue: [], pending: [], humanSeat: new Map(humans.map((p, i) => [p.seat, i])),
        counts: seats.map(() => ({})), lakeBefore: lake.fish, rematchBy,
      };
      room.state = "play"; room.note = lake.fresh ? "fresh" : null;
      broadcastRoom(room);
      for (const s of room.streams) send(s, "go", { startedAt, serverNow: now(), frame: frameFor(room.match, s) });
      return { ok: true };
    },
    input(code, playerSeat, raw) {
      const room = load(code);
      if (!room?.match || room.state !== "play") return { ok: false, reason: "not_playing" };
      const m = room.match;
      const seat = m.humanSeat.get(playerSeat);
      if (seat === undefined) return { ok: false, reason: "not_in_match" };
      const i = m.mode.input(m.sim, seat, raw);
      if (i === null) return { ok: false, reason: "bad_input" };
      const kind = String((i as { k?: unknown }).k ?? "input");
      // one input of a kind per seat per tick: the latest wins
      m.queue = m.queue.filter((q) => !(q.seat === seat && q.kind === kind));
      m.queue.push({ seat, i, kind });
      return { ok: true };
    },
    stop(code, seat) {
      const room = load(code);
      if (!room) return { ok: false, reason: "no_room" };
      if (!room.match || room.state !== "play") return { ok: false, reason: "not_playing" };
      if (store.players(room.id)[0]?.seat !== seat) return { ok: false, reason: "not_first" };
      store.endMatch(room.match.id, now(), "interrupted", null, null);
      room.match = null; room.state = "lobby"; room.last = null;
      room.note = "stopped";
      broadcastRoom(room);
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
      if (room.match) send(s, "go", { startedAt: room.match.startedAt, serverNow: now(), frame: frameFor(room.match, s) });
      res.on("close", () => room.streams.delete(s));
      return true;
    },
    summaries(code) {
      const r = store.roomByCode(code);
      if (!r) return null;
      return store.matches(r.id).map((m) => ({
        mode: m.mode, model: m.model, status: m.status, startedAt: m.startedAt, endedAt: m.endedAt,
        seed: m.status === "running" ? null : m.seed, summary: m.summary,
      }));
    },
    history(code) {
      const r = store.roomByCode(code);
      return r ? historyOf(r.id) : null;
    },
    tick() {
      const t = now();
      for (const room of rooms.values()) {
        const m = room.match;
        if (!m || room.state !== "play") continue;
        try {
          const target = Math.floor((t - m.startedAt) / PLAY_TICK_MS);
          let n = 0;
          while (m.tick < target && !m.mode.over(m.sim) && n < PLAY_MAX_CATCHUP) {
            const people = m.queue.map(({ seat, i }) => ({ seat, i })); m.queue = [];
            const { events, applied } = tickOnce(m.mode, m.sim, m.seed, m.seats, m.tick, people);
            for (const { seat, i } of applied) { const k = String((i as { k?: unknown }).k ?? "input"); m.counts[seat][k] = (m.counts[seat][k] ?? 0) + 1; }
            store.logInputs(m.id, m.tick, applied);
            m.pending.push(...events);
            m.tick++; n++;
            if (m.tick % PLAY_FRAME_EVERY === 0 || m.mode.over(m.sim)) {
              for (const s of room.streams) send(s, "frame", { tick: m.tick, f: frameFor(m, s), ev: eventsFor(m.pending, seatFor(m, s)) });
              m.pending = [];
            }
          }
          if (m.mode.over(m.sim)) finish(room);
        } catch (e) { onError(e); }
      }
      if (t - lastBeat > PLAY_HEARTBEAT_MS) { lastBeat = t; for (const room of rooms.values()) for (const s of room.streams) if (!s.res.destroyed) s.res.write(": keep-alive\n\n"); }
      for (const [code, room] of rooms) if (room.state !== "play" && room.streams.size === 0) rooms.delete(code);
    },
    readyModes: () => [...ready],
    knows: (mode) => mode in modes,
    running: () => [...rooms.values()].filter((r) => r.state === "play").length,
    close() {
      for (const room of rooms.values()) {
        if (room.match) store.endMatch(room.match.id, now(), "interrupted", null, null);
        for (const s of room.streams) s.res.end();
      }
      rooms.clear();
    },
  };
}
