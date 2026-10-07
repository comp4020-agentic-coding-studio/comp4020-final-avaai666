// The lake as agents (DESIGN.md v2.1): a typed port of sim/lakesim.mjs
// (model "lake-sim 2.1"), which it must match step for step, and of
// sim/season.mjs and sim/payoff.mjs for the simulations. Every arithmetic
// operation is in the same order as there, so the numbers are identical, not
// close. Differences, none of which draws a random number or changes a fish:
// the lake's sfc32 state is a plain object on the lake (so a lake is plain
// data); nets carry the order they were thrown in; the year count is on the
// lake instead of in a copied parameter object.
import { createHash } from "node:crypto";
import {
  AIM_ANYWHERE,
  AIM_NOISE,
  AIM_TRIES,
  ALIGN,
  CAP_PER_FAMILY,
  CAST_S,
  CLUTCH,
  CLUTCH_SPREAD,
  COHESION,
  COOL_S,
  DT,
  BREED,
  FINE_COST,
  FISH_S,
  FRY_SEPARATE,
  FRY_TO_SHORE,
  H,
  KOI_AT_S,
  KOI_BONUS,
  KOI_FOR_S,
  KOI_REACH,
  KOI_SPEED,
  KOI_START_RX,
  KOI_START_RY,
  KOI_TURN,
  KOI_TURN_BACK,
  LEAD,
  MATE,
  MAX_AGE,
  MEET_S,
  NURSERY_AIM,
  R_COARSE,
  R_FINE,
  RNG_WARMUP,
  RX,
  RY,
  SCARE_INNER,
  SCARE_OUTER,
  SCARE_PUSH,
  SCARE_S,
  SCARE_SPEED,
  SEASON_MS,
  SEP,
  SEPARATE,
  SHALLOW,
  SHORE_M,
  SHORE_PULL,
  SIGHT,
  SINK_S,
  SPAWN_M,
  SPRING_S,
  START_AGES,
  START_FRAC,
  STEP_MS,
  TURN_NOISE,
  V_ADULT,
  V_FRY,
  W,
  WINTER_DEATH,
  YEARS,
} from "./game-constants.ts";
import type { Rule } from "./rules.ts";
import { canBuyFine } from "./village.ts";

export const MODEL_VERSION = "lake-sim 2.1";

export type Fish = {
  id: number;
  x: number;
  y: number;
  h: number; // heading, radians
  age: number; // 0 for fry
  cool: number; // seconds of rest after spawning
  scare: number;
  sx: number;
  sy: number;
};

export type Net = { seq: number; fam: number; x: number; y: number; fine: boolean; closeAt: number };

export type Sfc = { a: number; b: number; c: number; d: number };

export type Lake = {
  rand: Sfc; // the "lake" stream
  years: number; // YEARS, or one more once nextYear() has run
  cap: number;
  fish: Fish[];
  t: number; // seconds since the start, rounded to the ms as in the reference
  nextId: number;
  nextNet: number;
  nets: Net[];
  hist: { year: number; adults: number }[];
  start: number; // grown fish at the start
};

export type Haul = {
  net: Net; // the throw it closes
  got: number; // fish taken, fry included
  gotFry: number;
  slipped: number; // fry inside a coarse ring that slipped through
};

export type StepResult = { hauls: Haul[]; spawns: { x: number; y: number }[]; winter: boolean };

// ---- randomness ----

// sfc32 (Chris Doty-Humphrey's small fast counter generator), 128-bit state,
// with the state in an object: the same operations as sfc32 in the reference.
function sfcNext(s: Sfc): number {
  s.a |= 0;
  s.b |= 0;
  s.c |= 0;
  s.d |= 0;
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  return (t >>> 0) / 4294967296;
}

export function sfc32(a: number, b: number, c: number, d: number): () => number {
  const s: Sfc = { a, b, c, d };
  return () => sfcNext(s);
}

// A named stream of a season: SHA-256 of "secret|name" seeds sfc32, then
// RNG_WARMUP draws are discarded.
function streamState(secret: string, name: string): Sfc {
  const h = createHash("sha256").update(`${secret}|${name}`).digest();
  const s: Sfc = { a: h.readUInt32BE(0), b: h.readUInt32BE(4), c: h.readUInt32BE(8), d: h.readUInt32BE(12) };
  for (let i = 0; i < RNG_WARMUP; i++) sfcNext(s); // warm up
  return s;
}

// "lake" for the fish, "koi" for the golden carp, "aim" for the simulated
// families; bots use botRandom (rules.ts).
export function streamRng(secret: string, name: string): () => number {
  const s = streamState(secret, name);
  return () => sfcNext(s);
}

// Published at the start of a season; the secret itself only at its end.
export const secretHash = (secret: string): string => createHash("sha256").update(secret).digest("hex");

const rng = (L: Lake): number => sfcNext(L.rand);

// ---- the lake ----

export function inLake(x: number, y: number, m = 1): boolean {
  const dx = (x - W / 2) / (RX * m),
    dy = (y - H / 2) / (RY * m);
  return dx * dx + dy * dy < 1;
}

// How far out a point is, as a share of the lake's radius in its direction.
export function ellipseRadius(x: number, y: number): number {
  return Math.hypot((x - W / 2) / RX, (y - H / 2) / RY);
}

// The shallows: the band outside SHALLOW of the radius. A point exactly on
// the line is in the shallows. Every shallows check uses this.
export function inShallows(x: number, y: number): boolean {
  return ellipseRadius(x, y) >= SHALLOW;
}

export function makeLake(families: number, secret: string, { startCount }: { startCount?: number } = {}): Lake {
  const cap = CAP_PER_FAMILY * families;
  const L: Lake = {
    rand: streamState(secret, "lake"),
    years: YEARS,
    cap,
    fish: [],
    t: 0,
    nextId: 0,
    nextNet: 0,
    nets: [],
    hist: [],
    start: 0,
  };
  const n0 = startCount ?? Math.round(cap * START_FRAC);
  for (let i = 0; i < n0; i++) {
    const age = 1 + Math.floor(rng(L) * START_AGES); // drawn before the fish's place, as in the reference
    L.fish.push(spawn(L, null, null, age));
  }
  L.start = n0;
  return L;
}

function spawn(L: Lake, x: number | null, y: number | null, age: number): Fish {
  if (x === null || y === null) {
    do {
      x = W / 2 + (rng(L) * 2 - 1) * RX;
      y = H / 2 + (rng(L) * 2 - 1) * RY;
    } while (!inLake(x, y, SPAWN_M));
  }
  return { id: L.nextId++, x, y, h: rng(L) * Math.PI * 2, age, cool: 0, scare: 0, sx: 0, sy: 0 };
}

// Fewer than two fish cannot spawn: the lake is dead and never comes back.
// The only definition of death.
export const dead = (L: Lake): boolean => L.fish.length < 2;

export const adults = (L: Lake): number => L.fish.filter((f) => f.age >= 1).length;
export const fry = (L: Lake): number => L.fish.filter((f) => f.age === 0).length;

// ---- the schedule ----

export type LakePhase = { year: number; phase: "fish" | "meet" | "over"; into: number; spring?: boolean };

// The phase at t seconds, as phase() in the reference. `years` is one more
// only while nextYear() runs a lake on.
export function phase(t: number, years: number = YEARS): LakePhase {
  const yearLen = FISH_S + MEET_S;
  const y = Math.floor(t / yearLen) + 1;
  const into = t - (y - 1) * yearLen;
  if (y > years || (y === years && into >= FISH_S)) return { year: years, phase: "over", into };
  return { year: y, phase: into < FISH_S ? "fish" : "meet", into, spring: into < SPRING_S };
}

// Whole steps of 0.1 s since the start.
export function stepAt(startedAt: number, now: number): number {
  return Math.floor(Math.max(0, now - startedAt) / STEP_MS);
}

export type Phase = { step: number; year: number; phase: "fish" | "meet" | "over"; spring: boolean; msLeft: number };

// The season's step, year and phase, from the step (DESIGN v2.1: the step
// comes from the start time and the clock, the rest from the step). Years 1
// to 4 are fishing then a meeting; year 5 is fishing only, then the season is
// over.
export function phaseAt(startedAt: number, now: number): Phase {
  const step = stepAt(startedAt, now);
  const ms = step * STEP_MS;
  const yearMs = (FISH_S + MEET_S) * 1000;
  if (ms >= SEASON_MS) return { step, year: YEARS, phase: "over", spring: false, msLeft: 0 };
  const year = Math.floor(ms / yearMs) + 1;
  const into = ms - (year - 1) * yearMs;
  if (into < FISH_S * 1000) return { step, year, phase: "fish", spring: into < SPRING_S * 1000, msLeft: FISH_S * 1000 - into };
  return { step, year, phase: "meet", spring: false, msLeft: yearMs - into };
}

// ---- a step ----

function grid(L: Lake): (x: number, y: number, fn: (j: number) => void) => void {
  const cs = SIGHT,
    g = new Map<number, number[]>();
  L.fish.forEach((f, i) => {
    const k = ((f.x / cs) | 0) * 1000 + ((f.y / cs) | 0);
    let c = g.get(k);
    if (!c) g.set(k, (c = []));
    c.push(i);
  });
  return (x, y, fn) => {
    const cx = (x / cs) | 0,
      cy = (y / cs) | 0;
    for (let a = cx - 1; a <= cx + 1; a++)
      for (let b = cy - 1; b <= cy + 1; b++) {
        const c = g.get(a * 1000 + b);
        if (c) for (const j of c) fn(j);
      }
  };
}

// One step of 0.1 s: movement, spring spawning, nets closing, winter. The
// only function that moves, breeds, ages or catches fish.
export function step(L: Lake): StepResult {
  const dt = DT;
  const ph = phase(L.t, L.years);
  const near = grid(L);
  const N = L.fish.length;
  const crowd = Math.max(0, 1 - N / L.cap);
  const born: Fish[] = [];
  const spawns: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const f = L.fish[i];
    let cx = 0,
      cy = 0,
      ax = 0,
      ay = 0,
      n = 0,
      sepx = 0,
      sepy = 0,
      mate = -1;
    near(f.x, f.y, (j) => {
      if (j === i) return;
      const o = L.fish[j],
        dx = o.x - f.x,
        dy = o.y - f.y,
        d2 = dx * dx + dy * dy;
      if (d2 > SIGHT * SIGHT) return;
      if (o.age === 0 && f.age >= 1) return; // grown fish school with grown fish
      cx += o.x;
      cy += o.y;
      ax += Math.cos(o.h);
      ay += Math.sin(o.h);
      n++;
      if (d2 < SEP * SEP) {
        sepx -= dx;
        sepy -= dy;
      }
      if (mate < 0 && f.age >= 1 && o.age >= 1 && d2 < MATE * MATE && o.cool <= 0) mate = j;
    });
    let tx = Math.cos(f.h),
      ty = Math.sin(f.h);
    if (n) {
      tx += COHESION * (cx / n - f.x) + ALIGN * (ax / n) + SEPARATE * sepx;
      ty += COHESION * (cy / n - f.y) + ALIGN * (ay / n) + SEPARATE * sepy;
    }
    if (f.age === 0) {
      // fry keep to the shallows: spread out, no schooling
      tx = Math.cos(f.h) + FRY_SEPARATE * sepx;
      ty = Math.sin(f.h) + FRY_SEPARATE * sepy;
      const ex = (f.x - W / 2) / RX,
        ey = (f.y - H / 2) / RY,
        e = Math.hypot(ex, ey);
      if (!inShallows(f.x, f.y)) {
        tx += (ex / e) * FRY_TO_SHORE;
        ty += (ey / e) * FRY_TO_SHORE;
      }
    }
    if (!inLake(f.x, f.y, SHORE_M)) {
      tx += (W / 2 - f.x) * SHORE_PULL;
      ty += (H / 2 - f.y) * SHORE_PULL;
    }
    if (f.scare > 0) {
      tx += f.sx * SCARE_PUSH;
      ty += f.sy * SCARE_PUSH;
      f.scare -= dt;
    }
    const h = Math.atan2(ty, tx) + (rng(L) - 0.5) * TURN_NOISE;
    f.h = h;
    const v = (f.age >= 1 ? V_ADULT : V_FRY) * (f.scare > 0 ? SCARE_SPEED : 1);
    f.x += Math.cos(h) * v * dt;
    f.y += Math.sin(h) * v * dt;
    if (f.cool > 0) f.cool -= dt;
    // spring: two grown fish that meet may spawn
    if (ph.phase === "fish" && ph.spring && mate >= 0 && f.cool <= 0) {
      if (rng(L) < BREED * dt * crowd) {
        const o = L.fish[mate];
        f.cool = o.cool = COOL_S;
        for (let c = 0; c < CLUTCH; c++) {
          const x = (f.x + o.x) / 2 + (rng(L) - 0.5) * CLUTCH_SPREAD;
          const y = (f.y + o.y) / 2 + (rng(L) - 0.5) * CLUTCH_SPREAD;
          born.push(spawn(L, x, y, 0));
        }
        spawns.push({ x: (f.x + o.x) / 2, y: (f.y + o.y) / 2 });
      }
    }
  }
  for (const b of born) L.fish.push(b);
  const hauls = closeNets(L);
  const before = phase(L.t, L.years);
  L.t = Math.round((L.t + dt) * 1000) / 1000;
  const after = phase(L.t, L.years);
  // winter: at the end of each year's fishing, fry grow up, the old die
  const isWinter = before.phase === "fish" && after.phase !== "fish";
  if (isWinter) winter(L);
  return { hauls, spawns, winter: isWinter };
}

// The nets due to close at this step take the fish inside their rings, in
// the order they were thrown. Part of step(); exported for tests.
export function closeNets(L: Lake): Haul[] {
  const hauls: Haul[] = [];
  const still: Net[] = [];
  for (const net of L.nets) {
    if (net.closeAt > L.t + 1e-9) {
      still.push(net);
      continue;
    }
    const r = net.fine ? R_FINE : R_COARSE;
    let got = 0,
      gotFry = 0,
      slipped = 0;
    L.fish = L.fish.filter((f) => {
      const dx = f.x - net.x,
        dy = f.y - net.y;
      if (dx * dx + dy * dy > r * r) return true;
      if (f.age === 0 && !net.fine) {
        slipped++; // fry slip through a coarse mesh
        return true;
      }
      got++;
      if (f.age === 0) gotFry++;
      return false;
    });
    hauls.push({ net, got, gotFry, slipped });
  }
  L.nets = still;
  return hauls;
}

function winter(L: Lake): void {
  L.fish = L.fish.filter((f) => {
    f.age += 1;
    if (f.age > MAX_AGE) return false;
    return f.age === 1 || rng(L) >= WINTER_DEATH;
  });
  L.hist.push({ year: phase(L.t - 0.001, L.years).year, adults: adults(L) });
}

// Left alone after the season, how many grown fish would greet next year?
// Steps the same lake on through one more spring and summer with no nets, to
// the next winter. Changes the lake.
export function nextYear(L: Lake): number {
  L.years = L.years + 1;
  for (;;) {
    if (step(L).winter || dead(L)) break;
  }
  return adults(L);
}

// ---- nets ----

// A net lands now and closes SINK_S later. Fish nearby scatter.
export function castNet(L: Lake, fam: number, x: number, y: number, fine: boolean): Net {
  const net: Net = { seq: L.nextNet++, fam, x, y, fine, closeAt: Math.round((L.t + SINK_S) * 1000) / 1000 };
  L.nets.push(net);
  const r = (fine ? R_FINE : R_COARSE) * SCARE_OUTER;
  for (const f of L.fish) {
    const dx = f.x - x,
      dy = f.y - y,
      d = Math.hypot(dx, dy);
    if (d < r && d > (fine ? R_FINE : R_COARSE) * SCARE_INNER) {
      f.scare = SCARE_S;
      f.sx = dx / d;
      f.sy = dy / d;
    }
  }
  return net;
}

// An aimer's choice: try fish positions, pick the spot with the most fish
// the net can hold. maxE limits how far out it aims (AIM_ANYWHERE: no limit).
export function bestSpot(
  L: Lake,
  fine: boolean,
  rand: () => number,
  tries = AIM_TRIES,
  maxE = AIM_ANYWHERE,
): { x: number; y: number; n: number } {
  const r = fine ? R_FINE : R_COARSE;
  let best: { x: number; y: number; n: number } | null = null,
    bestN = -1;
  const pool = L.fish.filter((f) => fine || f.age >= 1);
  if (!pool.length) return { x: W / 2, y: H / 2, n: 0 };
  for (let k = 0; k < tries; k++) {
    const f = pool[Math.floor(rand() * pool.length)];
    // lead the fish a little
    const x = f.x + Math.cos(f.h) * LEAD,
      y = f.y + Math.sin(f.h) * LEAD;
    if (ellipseRadius(x, y) > maxE) continue;
    let n = 0;
    for (const o of pool) {
      const dx = o.x - x,
        dy = o.y - y;
      if (dx * dx + dy * dy < r * r) n++;
    }
    if (n > bestN) {
      bestN = n;
      best = { x, y, n };
    }
  }
  return best || { x: W / 2, y: H / 2, n: 0 };
}

// ---- a whole season, for the dilemma and the rules ----

export type SeasonResult = {
  kept: number[]; // fish landed, golden carp included, minus a fine net's cost
  landed: number[];
  died: number | null; // the year the lake died
  endAdults: number;
  fryTaken: number;
  nextYearAdults: number; // grown fish next year if left alone; 0 if it died
};

type Koi = { x: number; y: number; h: number; until: number };

// The twin of season() in sim/season.mjs, with the same random streams in the
// same order. Every family throws on its own CAST_S clock at the densest spot
// its net can hold, taking a chance with probability `take`. A family that
// plans a fine net buys it the moment its basket can pay (not under a ban);
// until then it throws coarse. Everyone keeps `ruleFrom2` from year 2. The
// golden carp swims each year.
export function simulateSeason(
  plansFine: boolean[],
  secret: string,
  { take = 0.85, ruleFrom2 = "none" }: { take?: number; ruleFrom2?: Rule } = {},
): SeasonResult {
  const n = plansFine.length;
  const L = makeLake(n, secret);
  const aim = streamRng(secret, "aim"),
    koiRng = streamRng(secret, "koi");
  const landed: number[] = new Array(n).fill(0),
    spent: number[] = new Array(n).fill(0),
    hasFine: boolean[] = new Array(n).fill(false);
  const next = plansFine.map(() => aim() * CAST_S);
  let died: number | null = null,
    koi: Koi | null = null,
    koiYear = 0,
    fryTaken = 0;
  for (;;) {
    const ph = phase(L.t);
    if (ph.phase === "over") break;
    if (ph.phase === "fish") {
      // the golden carp
      if (koiYear !== ph.year && ph.into >= KOI_AT_S) {
        koiYear = ph.year;
        const a = koiRng() * Math.PI * 2;
        koi = { x: W / 2 + Math.cos(a) * KOI_START_RX, y: H / 2 + Math.sin(a) * KOI_START_RY, h: a + Math.PI, until: L.t + KOI_FOR_S };
      }
      const rule = ph.year >= 2 ? ruleFrom2 : "none";
      const order = plansFine.map((_, i) => i).sort(() => aim() - 0.5);
      for (const i of order) {
        if (plansFine[i] && canBuyFine(landed[i] - spent[i], hasFine[i], ph) && rule !== "ban") {
          hasFine[i] = true;
          spent[i] += FINE_COST;
        }
        if (L.t + 1e-9 < next[i]) continue;
        next[i] += CAST_S;
        if (aim() >= take) continue;
        if (rule === "spring" && ph.spring) continue;
        const fine = hasFine[i] && rule !== "ban";
        const s = bestSpot(L, fine, aim, AIM_TRIES, rule === "nursery" ? SHALLOW * NURSERY_AIM : AIM_ANYWHERE);
        castNet(L, i, s.x + (aim() - 0.5) * 2 * AIM_NOISE, s.y + (aim() - 0.5) * 2 * AIM_NOISE, fine);
      }
    } else {
      plansFine.forEach((_, i) => {
        if (next[i] < L.t) next[i] = L.t + CAST_S * aim();
      });
      koi = null;
    }
    const out = step(L);
    for (const h of out.hauls) {
      landed[h.net.fam] += h.got;
      fryTaken += h.gotFry;
      const r = (h.net.fine ? R_FINE : R_COARSE) + KOI_REACH;
      if (koi && Math.hypot(koi.x - h.net.x, koi.y - h.net.y) < r) {
        landed[h.net.fam] += KOI_BONUS;
        koi = null;
      }
    }
    if (koi) {
      koi.h += (koiRng() - 0.5) * KOI_TURN;
      const e = ellipseRadius(koi.x, koi.y);
      if (e > KOI_TURN_BACK) koi.h = Math.atan2(H / 2 - koi.y, W / 2 - koi.x);
      koi.x += Math.cos(koi.h) * KOI_SPEED * DT;
      koi.y += Math.sin(koi.h) * KOI_SPEED * DT;
      if (L.t >= koi.until) koi = null;
    }
    if (died === null && dead(L)) died = ph.year;
  }
  const endAdults = adults(L);
  const kept = landed.map((l, i) => l - spent[i]);
  return { kept, landed, died, endAdults, fryTaken, nextYearAdults: died === null ? nextYear(L) : 0 };
}

export type Paired = {
  rows: { k: number; stay: number; swap: number; wins: number; n: number }[];
  allC: number;
  allF: number;
  deadC: number;
  deadF: number;
  nextC: number;
  nextF: number;
  seeds: number;
};

// The twin of paired() in sim/payoff.mjs. For each seed, each family in turn
// is the focal family; k of the other three plan fine nets. The same secret is
// played twice: the focal family keeping a coarse net, and planning a fine
// one. Same lake, same family, same seat: only its own net differs.
export function paired(seeds: number): Paired {
  const cache = new Map<string, SeasonResult>();
  const play = (s: number, fineSet: Set<number>): SeasonResult => {
    const key = `${s}|${[...fineSet].sort().join(",")}`;
    let r = cache.get(key);
    if (!r) cache.set(key, (r = simulateSeason([0, 1, 2, 3].map((i) => fineSet.has(i)), `season-${s}`)));
    return r;
  };
  const rows = [0, 1, 2, 3].map((k) => ({ k, stay: 0, swap: 0, wins: 0, n: 0 }));
  for (let s = 0; s < seeds; s++)
    for (let i = 0; i < 4; i++) {
      const others = [0, 1, 2, 3].filter((j) => j !== i);
      for (let k = 0; k <= 3; k++) {
        const F = new Set(others.slice(0, k));
        const a = play(s, F).kept[i],
          b = play(s, new Set([...F, i])).kept[i];
        const row = rows[k];
        row.stay += a;
        row.swap += b;
        row.n++;
        if (b > a) row.wins++;
      }
    }
  let allC = 0,
    allF = 0,
    deadC = 0,
    deadF = 0,
    nextC = 0,
    nextF = 0;
  for (let s = 0; s < seeds; s++) {
    const c = play(s, new Set()),
      f = play(s, new Set([0, 1, 2, 3]));
    allC += c.kept.reduce((x, y) => x + y, 0) / 4;
    allF += f.kept.reduce((x, y) => x + y, 0) / 4;
    if (c.died !== null) deadC++;
    if (f.died !== null) deadF++;
    nextC += c.nextYearAdults;
    nextF += f.nextYearAdults;
  }
  return {
    rows: rows.map((r) => ({ ...r, stay: r.stay / r.n, swap: r.swap / r.n })),
    allC: allC / seeds,
    allF: allF / seeds,
    deadC,
    deadF,
    nextC: nextC / seeds,
    nextF: nextF / seeds,
    seeds,
  };
}
