// The game model (DESIGN.md v1.1): the lake, the nets, the season's clock,
// the village meeting, the bots, honest draws and the season check. Pure
// functions; randomness only through an Rng or a draw passed in, so a seeded
// season replays exactly.
import { createHash, createHmac } from "node:crypto";
import { STEP_MS } from "./constants.ts";
import {
  ALLEE_FRACTION,
  BOT_TAKE,
  COARSE,
  COUNTERFACTUAL_SEEDS,
  FINE,
  FINE_COST,
  FISH_MS,
  FISH_PER_FAMILY,
  MEET_MS,
  QUOTA,
  R_GAME_PER_MIN,
  SEASON_MS,
  THROW_MS,
  YEARS,
} from "./game-constants.ts";

const MS_PER_MIN = 60_000;
const YEAR_MS = FISH_MS + MEET_MS;

// ---- the lake ----

export type LakeParams = { K: number; A: number; r: number };

// Set once when the season starts, from the number of families (bots included).
export function lakeParams(families: number): LakeParams {
  const K = FISH_PER_FAMILY * families;
  return { K, A: K * ALLEE_FRACTION, r: R_GAME_PER_MIN };
}

// dS/dt = r·S·(S/A − 1)·(1 − S/K), in fish per minute
export function growthPerMin(s: number, { K, A, r }: LakeParams): number {
  return r * s * (s / A - 1) * (1 - s / K);
}

function rk4(s: number, dtMin: number, p: LakeParams): number {
  const k1 = growthPerMin(s, p);
  const k2 = growthPerMin(s + (dtMin * k1) / 2, p);
  const k3 = growthPerMin(s + (dtMin * k2) / 2, p);
  const k4 = growthPerMin(s + dtMin * k3, p);
  return s + (dtMin * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
}

// Stock after elapsedMs, from stock s0, as pond.ts: fixed-step RK4 with
// STEP_MS, the last partial step using the remainder, clamped to [0, K].
// Stepping stops once the lake is dead or has converged on K.
export function stockAt(s0: number, elapsedMs: number, p: LakeParams): number {
  if (!(s0 > 0)) return 0;
  const clamp = (s: number): number => Math.min(p.K, Math.max(0, s));
  let s = clamp(s0);
  for (let left = elapsedMs; left > 0 && !isDead(s) && Math.abs(s - p.K) >= 1e-9; left -= STEP_MS) {
    s = clamp(rk4(s, Math.min(STEP_MS, left) / MS_PER_MIN, p));
  }
  return s;
}

// ms from s0 until stock first falls below 1 with nobody fishing, to STEP_MS
// precision, on the same step grid as stockAt; null if it never does.
export function collapseAfterMs(s0: number, p: LakeParams): number | null {
  if (isDead(s0)) return 0;
  if (s0 >= p.A) return null;
  let s = s0;
  let ms = 0;
  while (!isDead(s)) {
    s = Math.max(0, rk4(s, STEP_MS / MS_PER_MIN, p));
    ms += STEP_MS;
  }
  return ms;
}

// Below one fish the lake is dead, and never comes back.
export function isDead(stock: number): boolean {
  return stock < 1;
}

// ---- randomness ----

export type Rng = () => number; // [0, 1)

// mulberry32
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The draw for a label: the first 4 bytes of HMAC-SHA256(seed, label),
// big-endian, over 2^32. It depends on the seed and the label only, never on
// the order requests arrive in.
export function draw(seed: string, label: string): number {
  return createHmac("sha256", Buffer.from(seed, "hex")).update(label, "utf8").digest().readUInt32BE(0) / 2 ** 32;
}

// A family's n-th cast of the season, n from 1.
export const castLabel = (familyId: number, n: number): string => `cast:${familyId}:${n}`;

// Published at the start; the seed itself only at the end.
export function seedHash(seed: string): string {
  return createHash("sha256").update(Buffer.from(seed, "hex")).digest("hex");
}

// ---- casting ----

export type Net = "coarse" | "fine";

export const capacity = (net: Net): number => (net === "fine" ? FINE : COARSE);

// Expected catch capacity × S / K, rounded with one draw: floor, plus one
// with probability equal to the fraction. Never more than the whole fish
// left. A dead lake gives 0 and draws nothing.
export function catchSize(cap: number, stock: number, K: number, rng: Rng): number {
  if (isDead(stock)) return 0;
  const expected = (cap * stock) / K;
  const whole = Math.floor(expected);
  const got = whole + (rng() < expected - whole ? 1 : 0);
  return Math.min(got, Math.floor(stock));
}

// ---- the season's clock ----

export type Phase = { year: number; phase: "fish" | "meet" | "over"; msLeft: number };

// Year (1..YEARS) and phase from the season's start time and now. Years 1
// to 5 are fishing then a meeting; year 6 is fishing only, then the season is
// over. The schedule lives nowhere else.
export function phaseAt(startedAt: number, now: number): Phase {
  const t = Math.max(0, now - startedAt);
  if (t >= SEASON_MS) return { year: YEARS, phase: "over", msLeft: 0 };
  const year = Math.floor(t / YEAR_MS) + 1;
  const into = t % YEAR_MS;
  return into < FISH_MS
    ? { year, phase: "fish", msLeft: FISH_MS - into }
    : { year, phase: "meet", msLeft: YEAR_MS - into };
}

// Fishing time played so far: meetings excluded, capped at the season.
export function fishingMsBefore(startedAt: number, now: number): number {
  const t = Math.min(SEASON_MS, Math.max(0, now - startedAt));
  return Math.floor(t / YEAR_MS) * FISH_MS + Math.min(t % YEAR_MS, FISH_MS);
}

// ---- the village meeting ----

export type Rule = "none" | "quota" | "ban";
const RULES: Rule[] = ["none", "quota", "ban"];

// A family that did not vote counts as "none". An option wins with more votes
// than each other option and at least half of all families' votes.
export function tally(votes: Rule[], families: number): Rule {
  const count = (r: Rule): number =>
    votes.filter((v) => v === r).length + (r === "none" ? Math.max(0, families - votes.length) : 0);
  for (const r of RULES) {
    const n = count(r);
    if (2 * n >= families && RULES.every((o) => o === r || n > count(o))) return r;
  }
  return "none";
}

// A catch breaks a quota when it takes the family's year past QUOTA, and a
// ban when a fine net lands any fish. Breaches land; they are only marked.
export function isBreach(rule: Rule, net: Net, yearCatchBefore: number, got: number): boolean {
  if (got <= 0) return false;
  if (rule === "quota") return yearCatchBefore + got > QUOTA;
  if (rule === "ban") return net === "fine";
  return false;
}

// ---- bots ----

export type BotKind = "careful" | "greedy" | "follower";

// What a bot can see when it decides.
export type BotState = {
  fish: number; // its own fish, unspent
  hasFine: boolean;
  othersFine: number; // other families holding a fine net
  rule: Rule; // the rule in force this year
  stock: number;
  K: number;
  humanVotes: Rule[]; // the human families' latest votes so far in this meeting
  humans: number; // how many human families there are
};

// Old Wang never buys. Jin buys once he can pay; Mei once two other families
// have fine nets. Neither buys in a year the rule is a ban.
export function botBuys(kind: BotKind, s: BotState): boolean {
  if (kind === "careful" || s.hasFine || s.fish < FINE_COST || s.rule === "ban") return false;
  return kind === "greedy" || s.othersFine >= 2;
}

export function botVote(kind: BotKind, s: BotState): Rule {
  if (kind === "greedy") return "none";
  if (kind === "follower") return tally(s.humanVotes, s.humans); // a silent human counts as none
  if (s.othersFine > 0) return "ban";
  return s.stock < 0.6 * s.K ? "quota" : "none";
}

// Jin ignores quotas. Everyone else obeys every rule.
export function botObeys(kind: BotKind, rule: Rule): boolean {
  return !(kind === "greedy" && rule === "quota");
}

// A bot that owns a fine net casts it, unless fine nets are banned and it
// obeys bans: then it casts its coarse net.
export function botNet(kind: BotKind, rule: Rule, hasFine: boolean): Net {
  return hasFine && !(rule === "ban" && botObeys(kind, rule)) ? "fine" : "coarse";
}

// A bot that obeys a quota stops for the year when one more cast could take
// it past QUOTA. A catch never exceeds the net's capacity, so it never
// breaches.
export function botCasts(kind: BotKind, rule: Rule, net: Net, yearLanded: number): boolean {
  return !(rule === "quota" && botObeys(kind, rule) && yearLanded + capacity(net) > QUOTA);
}

// ---- a whole season, for the dilemma and the debrief ----

// Every family keeps its net all season and casts on the THROW_MS clock (a
// random first offset, the clock paused during meetings), taking each chance
// with probability `take`. The lake grows between casts and during meetings;
// year 6 has no meeting, so the season stops when its fishing ends. Mirrors
// sim/game_sim.py with no quota.
export function simulateSeason(
  nets: Net[],
  seed: number,
  take: number = BOT_TAKE,
): { caught: number[]; diedInYear: number | null; stockByYear: number[] } {
  const p = lakeParams(nets.length);
  const rng = seededRng(seed);
  const caught = nets.map(() => 0);
  const stockByYear: number[] = [];
  // ms of fishing time until each family's next cast
  const next = nets.map(() => rng() * THROW_MS);
  let s = p.K;

  for (let year = 1; year <= YEARS; year++) {
    let t = 0; // ms into this year's fishing
    for (;;) {
      const wait = Math.min(...next);
      if (t + wait > FISH_MS) break;
      s = stockAt(s, wait, p);
      t += wait;
      for (let i = 0; i < nets.length; i++) next[i] -= wait;
      for (let i = 0; i < nets.length; i++) {
        if (next[i] > 0) continue;
        next[i] = THROW_MS;
        if (rng() >= take) continue;
        const got = catchSize(capacity(nets[i]), s, p.K, rng);
        s -= got;
        caught[i] += got;
      }
      if (isDead(s)) return { caught, diedInYear: year, stockByYear: [...stockByYear, 0] };
    }
    for (let i = 0; i < nets.length; i++) next[i] -= FISH_MS - t;
    s = stockAt(s, (year < YEARS ? YEAR_MS : FISH_MS) - t, p);
    if (isDead(s)) return { caught, diedInYear: year, stockByYear: [...stockByYear, 0] };
    stockByYear.push(Math.round(s));
  }
  return { caught, diedInYear: null, stockByYear };
}

// The table's real casting rate: casts made over cast chances (one per family
// every THROW_MS of fishing played), at most 1.
export function castingRate(casts: number, families: number, fishingMs: number): number {
  if (fishingMs <= 0) return 0;
  return Math.min(1, (casts * THROW_MS) / (families * fishingMs));
}

// The debrief's other season: the same families, every net coarse, at the
// table's casting rate, over seeds 0 .. COUNTERFACTUAL_SEEDS − 1.
export function coarseCounterfactual(families: number, take: number): { total: number; survived: number } {
  const nets: Net[] = Array.from({ length: families }, () => "coarse");
  let total = 0;
  let survived = 0;
  for (let seed = 0; seed < COUNTERFACTUAL_SEEDS; seed++) {
    const run = simulateSeason(nets, seed, take);
    total += run.caught.reduce((a, b) => a + b, 0);
    if (run.diedInYear === null) survived++;
  }
  return { total: total / COUNTERFACTUAL_SEEDS, survived };
}

// ---- the season check ----

// A ledger row as the check sees it. stockAfter is null only before the start.
export type VerifyRow = {
  at: number;
  kind: string;
  family?: number;
  net?: Net;
  got?: number;
  stockAfter: number | null;
};

export type Verdict = { ok: true; casts: number } | { ok: false; index: number; why: string };

const TOLERANCE = 1e-9;

// Recomputes a finished season from its ledger and the revealed seed. The seed
// must match the hash published at the start (index −1 if not: no row is at
// fault). From the start row (stockAfter = K) on, the stock before each row is
// stockAt from the row before; a cast must land exactly its own draw's catch,
// and every row's stockAfter must follow.
export function verifySeason(rows: VerifyRow[], { seed, seedHash: hash, K }: { seed: string; seedHash: string; K: number }): Verdict {
  if (seedHash(seed) !== hash) return { ok: false, index: -1, why: "seed does not match" };
  const p = lakeParams(K / FISH_PER_FAMILY);
  const n = new Map<number, number>();
  let casts = 0;
  let prev: VerifyRow | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (prev === null) {
      if (row.stockAfter === null) continue;
      if (Math.abs(row.stockAfter - K) > TOLERANCE) return { ok: false, index: i, why: "start is not at K" };
      prev = row;
      continue;
    }
    if (row.stockAfter === null) return { ok: false, index: i, why: "no stock after the start" };
    if (row.at < prev.at) return { ok: false, index: i, why: "out of time order" };
    const before = stockAt(prev.stockAfter as number, row.at - prev.at, p);
    let want = before;
    if (row.kind === "cast") {
      if (row.family === undefined || row.net === undefined || row.got === undefined) {
        return { ok: false, index: i, why: "cast without family, net or catch" };
      }
      const k = (n.get(row.family) ?? 0) + 1;
      n.set(row.family, k);
      casts++;
      const label = castLabel(row.family, k);
      const got = catchSize(capacity(row.net), before, K, () => draw(seed, label));
      if (got !== row.got) return { ok: false, index: i, why: "catch does not match" };
      want = before - got;
    }
    if (Math.abs(row.stockAfter - want) > TOLERANCE) return { ok: false, index: i, why: "stock does not match" };
    prev = row;
  }
  return { ok: true, casts };
}
