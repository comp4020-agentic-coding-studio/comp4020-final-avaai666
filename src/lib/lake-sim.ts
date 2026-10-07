// The lake as agents (DESIGN.md v2.0): a typed port of sim/lakesim.mjs, which
// it must match step for step. Every arithmetic operation is in the same
// order as there, so the numbers are identical, not close. Differences, none
// of which draws a random number or changes a fish: the lake's random state
// is a plain number on the lake (so a lake is plain data); fish carry an id;
// step() returns what happened instead of keeping an event list; nets carry
// the order they were thrown in.
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
  FISH_S,
  FRY_SEPARATE,
  FRY_TO_SHORE,
  H,
  LEAD,
  MATE,
  MAX_AGE,
  MEET_S,
  NURSERY_AIM,
  R_COARSE,
  R_FINE,
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

export type Lake = {
  rand: number; // the lake's own mulberry32 state
  cap: number;
  fish: Fish[];
  t: number; // seconds since the start, rounded to the ms as in the reference
  nextId: number;
  nextNet: number;
  nets: Net[];
  hist: { year: number; adults: number }[];
};

export type Haul = {
  seq: number; // the throw it closes
  fam: number;
  x: number;
  y: number;
  fine: boolean;
  got: number; // fish taken, fry included
  gotFry: number;
  slipped: number; // fry inside a coarse ring that slipped through
};

export type StepResult = { hauls: Haul[]; spawns: { x: number; y: number }[]; winter: boolean };

// ---- randomness ----

// mulberry32, as rngFrom in the reference
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same generator with its state on the lake.
function rng(L: Lake): number {
  L.rand = (L.rand + 0x6d2b79f5) >>> 0;
  let t = L.rand;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

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
// the line is in the shallows.
export function inShallows(x: number, y: number): boolean {
  return ellipseRadius(x, y) >= SHALLOW;
}

export function makeLake(families: number, seed: number, { startCount }: { startCount?: number } = {}): Lake {
  const cap = CAP_PER_FAMILY * families;
  const L: Lake = { rand: seed >>> 0, cap, fish: [], t: 0, nextId: 0, nextNet: 0, nets: [], hist: [] };
  const n0 = startCount ?? Math.round(cap * START_FRAC);
  for (let i = 0; i < n0; i++) {
    const age = 1 + Math.floor(rng(L) * START_AGES); // drawn before the fish's place, as in the reference
    L.fish.push(spawn(L, null, null, age));
  }
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

export const adults = (L: Lake): number => L.fish.filter((f) => f.age >= 1).length;
export const fry = (L: Lake): number => L.fish.filter((f) => f.age === 0).length;

// ---- the schedule ----

export type LakePhase = { year: number; phase: "fish" | "meet" | "over"; into: number; spring?: boolean };

// The phase at t seconds, as phase() in the reference.
export function phase(t: number): LakePhase {
  const yearLen = FISH_S + MEET_S;
  const y = Math.floor(t / yearLen) + 1;
  const into = t - (y - 1) * yearLen;
  if (y > YEARS || (y === YEARS && into >= FISH_S)) return { year: YEARS, phase: "over", into };
  return { year: y, phase: into < FISH_S ? "fish" : "meet", into, spring: into < SPRING_S };
}

// Whole steps of 0.1 s since the start.
export function stepAt(startedAt: number, now: number): number {
  return Math.floor(Math.max(0, now - startedAt) / STEP_MS);
}

export type Phase = { step: number; year: number; phase: "fish" | "meet" | "over"; spring: boolean; msLeft: number };

// The season's step, year and phase from the start time and the clock, in
// whole ms. Years 1 to 4 are fishing then a meeting; year 5 is fishing only,
// then the season is over.
export function phaseAt(startedAt: number, now: number): Phase {
  const ms = Math.max(0, now - startedAt);
  const step = stepAt(startedAt, now);
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
  const ph = phase(L.t);
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
      if (e < SHALLOW) {
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
  const before = phase(L.t);
  L.t = Math.round((L.t + dt) * 1000) / 1000;
  const after = phase(L.t);
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
    hauls.push({ seq: net.seq, fam: net.fam, x: net.x, y: net.y, fine: net.fine, got, gotFry, slipped });
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
  L.hist.push({ year: phase(L.t - 0.001).year, adults: adults(L) });
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
    if (Math.hypot((x - W / 2) / RX, (y - H / 2) / RY) > maxE) continue;
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
  caught: number[];
  died: number | null; // the year the lake fell below two fish
  hist: { year: number; adults: number }[];
  endAdults: number;
  endFry: number;
};

// The twin of season() in sim/payoff.mjs, with the same random streams in the
// same order: every family throws every CAST_S at the densest spot its net
// can hold, taking a chance with probability `take`, keeping `ruleFrom2` from
// year 2. fine[i]: does family i own a fine net.
export function simulateSeason(
  fine: boolean[],
  seed: number,
  { take = 0.85, ruleFrom2 = "none" }: { take?: number; ruleFrom2?: Rule } = {},
): SeasonResult {
  const L = makeLake(fine.length, seed);
  const aim = rngFrom(seed ^ 0x9e3779b9);
  const caught = fine.map(() => 0);
  const next = fine.map(() => aim() * CAST_S);
  let died: number | null = null;
  for (;;) {
    const ph = phase(L.t);
    if (ph.phase === "over") break;
    if (ph.phase === "fish") {
      const order = fine.map((_, i) => i).sort(() => aim() - 0.5);
      order.forEach((i) => {
        const owns = fine[i];
        if (L.t + 1e-9 >= next[i]) {
          next[i] += CAST_S;
          if (aim() >= take) return;
          const rule = ph.year >= 2 ? ruleFrom2 : "none";
          if (rule === "spring" && ph.spring) return;
          const useFine = owns && rule !== "ban";
          const s = bestSpot(L, useFine, aim, AIM_TRIES, rule === "nursery" ? SHALLOW * NURSERY_AIM : AIM_ANYWHERE);
          const x = s.x + (aim() - 0.5) * 2 * AIM_NOISE,
            y = s.y + (aim() - 0.5) * 2 * AIM_NOISE;
          castNet(L, i, x, y, useFine);
        }
      });
    } else {
      // meeting: throws wait; keep each family's clock
      fine.forEach((_, i) => {
        if (next[i] < L.t) next[i] = L.t + CAST_S * aim();
      });
    }
    for (const h of step(L).hauls) caught[h.fam] += h.got;
    if (died === null && L.fish.length < 2) died = ph.year;
  }
  return { caught, died, hist: L.hist, endAdults: adults(L), endFry: fry(L) };
}
