// The /play platform (DESIGN.md "One lake, four games"): the one interface
// every mode implements, and the pieces they share. A mode is pure and
// deterministic: a match is its seed, its seats, the lake it started with and
// the inputs applied at each tick, so replay() gives the same match. Nothing
// here reads the clock or Math.random.
import { createHash } from "node:crypto";
import { LAKE_DEAD, LAKE_FULL, LAKE_REGROW, type PLAY_CHARACTERS } from "./game-constants.ts";
import { sfc32 } from "./lake-sim.ts";

export type Character = (typeof PLAY_CHARACTERS)[number];
export interface Seat { seat: number; name: string; bot: string | null; character: Character }
export interface LakeMemory { fish: number }

// An event goes to every seat unless `to` lists the seats that may see it.
export interface GameEvent { k: string; to?: number[]; [key: string]: unknown }

export interface SeatResult { seat: number; score: number; place: number; firstScoreS: number | null; [key: string]: unknown }
export interface Highlight { title: string; text: string; seat?: number }
export interface Results { seats: SeatResult[]; lakeLeft: number; highlights: Highlight[]; [key: string]: unknown }

export interface Mode<S, I> {
  id: string;
  model: string; // e.g. "rush 1.0"; a stored match is only replayed by its model
  seats: { min: number; max: number; botFill: number }; // botFill: how many boats "bots fill empty seats" makes
  make(seed: string, seats: Seat[], lake: LakeMemory): S;
  input(s: S, seat: number, raw: unknown): I | null; // validate, or drop
  step(s: S, inputs: { seat: number; i: I }[]): GameEvent[];
  frameFor(s: S, seat: number): unknown; // only what this seat may see; seat -1 is a watcher
  over(s: S): boolean;
  results(s: S): Results; // includes the lake left
  bot(s: S, seat: number, rng: () => number): I[];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMode = Mode<any, any>;

// A named stream of a match: SHA-256 of "secret|name" seeds sfc32.
export function streamOf(secret: string, name: string): () => number {
  const h = createHash("sha256").update(`${secret}|${name}`).digest();
  const r = sfc32(h.readUInt32BE(0), h.readUInt32BE(4), h.readUInt32BE(8), h.readUInt32BE(12));
  for (let i = 0; i < 12; i++) r();
  return r;
}
// A bot's decisions in one tick come from their own stream (DESIGN.md "The platform").
export const botStream = (secret: string, bot: string, tick: number, seat: number): (() => number) => streamOf(secret, `${bot}|${tick}|${seat}`);

// The events one seat may see, with the audience removed.
export function eventsFor(events: GameEvent[], seat: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (const e of events) {
    if (e.to && !e.to.includes(seat)) continue;
    if (e.to) { const { to: _to, ...rest } = e; out.push(rest as GameEvent); } else out.push(e);
  }
  return out;
}

// One tick of the platform: the queued inputs (people), then each bot's.
export function tickOnce<S, I>(mode: Mode<S, I>, s: S, seed: string, seats: Seat[], tick: number, people: { seat: number; i: I }[]): { events: GameEvent[]; applied: { seat: number; i: I }[] } {
  const applied = [...people];
  for (const st of seats) if (st.bot) for (const i of mode.bot(s, st.seat, botStream(seed, st.bot, tick, st.seat))) applied.push({ seat: st.seat, i });
  return { events: mode.step(s, applied), applied };
}

// Replays a match from its record. Stored inputs include the bots' (they
// are written as applied), so a replay does not run the bots again.
export function replay<S, I>(mode: Mode<S, I>, seed: string, seats: Seat[], lake: LakeMemory, inputs: Map<number, { seat: number; i: unknown }[]>): S {
  const s = mode.make(seed, seats, lake);
  for (let tick = 0; !mode.over(s); tick++) mode.step(s, (inputs.get(tick) ?? []) as { seat: number; i: I }[]);
  return s;
}

// ---- the lake remembers ----
// Between matches the lake regrows LAKE_REGROW of the gap to full; a dead
// lake (below LAKE_DEAD) does not regrow, and the next match starts a new one.
export function lakeBetween(left: number): number {
  if (left < LAKE_DEAD) return left;
  return Math.min(LAKE_FULL, left + Math.round((LAKE_FULL - left) * LAKE_REGROW));
}
export function lakeAtStart(roomFish: number): { fish: number; fresh: boolean } {
  return roomFish < LAKE_DEAD ? { fish: LAKE_FULL, fresh: true } : { fish: roomFish, fresh: false };
}
