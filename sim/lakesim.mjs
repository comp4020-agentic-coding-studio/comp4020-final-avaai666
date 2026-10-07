// Agent-based lake for "Next Year, No Fish", model v2.1. Pure, seeded,
// deterministic. Fish swim, meet, spawn in spring; fry grow into adults over
// winter; coarse nets let fry slip through, fine nets take everything in the
// ring. v2.1: random streams are sfc32 seeded from SHA-256 of a long secret
// (128 bits of state, not 32), fish carry ids, step() returns what happened,
// dead() and nextYear() are defined here once.
import { createHash } from "node:crypto";
export const MODEL_VERSION = "lake-sim 2.1";
export const DEFAULTS = {
  W: 1000, H: 700, RX: 460, RY: 315,      // lake ellipse in world units
  DT: 0.1,                                 // tick, seconds
  YEARS: 5, FISH_S: 40, SPRING_S: 14, MEET_S: 14,
  CAP_PER_FAMILY: 55,                      // crowding scale (adults+fry) per family
  START_FRAC: 0.75,                        // starting adults, as a share of CAP
  SIGHT: 95, MATE: 30, SEP: 14,
  V_ADULT: 42, V_FRY: 26,
  BREED: 0.25,                              // per adult-with-mate per second, before crowding
  CLUTCH: 2, COOL_S: 6,
  MAX_AGE: 4, WINTER_DEATH: 0.12,
  CAST_S: 3.5,                             // a family's net cycle
  SINK_S: 0.6,
  R_COARSE: 36, R_FINE: 42,
  FINE_COST: 20,
  AIM_NOISE: 25,
  SHALLOW: 0.72,
};

// sfc32 (Chris Doty-Humphrey's small fast counter generator), 128-bit state
export function sfc32(a, b, c, d) {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

// One named random stream of a season: the lake's own ("lake"), the bots'
// aim in the simulations ("aim"), the golden carp ("koi").
export function streamRng(secret, name) {
  const h = createHash("sha256").update(`${secret}|${name}`).digest();
  const r = sfc32(h.readUInt32BE(0), h.readUInt32BE(4), h.readUInt32BE(8), h.readUInt32BE(12));
  for (let i = 0; i < 12; i++) r(); // warm up
  return r;
}

export const secretHash = (secret) => createHash("sha256").update(secret).digest("hex");

export function inLake(P, x, y, m = 1) {
  const dx = (x - P.W / 2) / (P.RX * m), dy = (y - P.H / 2) / (P.RY * m);
  return dx * dx + dy * dy < 1;
}

export function makeLake(P, families, secret, opts = {}) {
  const rng = streamRng(secret, "lake");
  const cap = P.CAP_PER_FAMILY * families;
  const L = { P, rng, cap, fish: [], t: 0, nextId: 0, nets: [], hist: [], start: 0 };
  const n0 = opts.startCount ?? Math.round(cap * P.START_FRAC);
  for (let i = 0; i < n0; i++) L.fish.push(spawn(L, null, null, 1 + Math.floor(rng() * 3)));
  L.start = n0;
  return L;
}

function spawn(L, x, y, age) {
  const P = L.P, rng = L.rng;
  if (x === null) {
    do { x = P.W / 2 + (rng() * 2 - 1) * P.RX; y = P.H / 2 + (rng() * 2 - 1) * P.RY; } while (!inLake(P, x, y, 0.9));
  }
  return { id: L.nextId++, x, y, h: rng() * Math.PI * 2, age, cool: 0, scare: 0, sx: 0, sy: 0 };
}

// Fewer than two fish cannot spawn: the lake is dead and never comes back.
export const dead = (L) => L.fish.length < 2;

export const adults = (L) => L.fish.filter((f) => f.age >= 1).length;
export const fry = (L) => L.fish.filter((f) => f.age === 0).length;

// phase within a year
export function phase(P, t) {
  const yearLen = P.FISH_S + P.MEET_S;
  const y = Math.floor(t / yearLen) + 1;
  const into = t - (y - 1) * yearLen;
  if (y > P.YEARS || (y === P.YEARS && into >= P.FISH_S)) return { year: P.YEARS, phase: "over", into };
  return { year: y, phase: into < P.FISH_S ? "fish" : "meet", into, spring: into < P.SPRING_S };
}

function grid(L) {
  const cs = L.P.SIGHT, g = new Map();
  L.fish.forEach((f, i) => {
    const k = ((f.x / cs) | 0) * 1000 + ((f.y / cs) | 0);
    let c = g.get(k); if (!c) g.set(k, (c = [])); c.push(i);
  });
  return (x, y, fn) => {
    const cx = (x / cs) | 0, cy = (y / cs) | 0;
    for (let a = cx - 1; a <= cx + 1; a++) for (let b = cy - 1; b <= cy + 1; b++) {
      const c = g.get(a * 1000 + b); if (c) for (const j of c) fn(j);
    }
  };
}

// one step: movement, spring breeding, nets closing, winter. Returns what
// happened: hauls (in the order the nets were thrown), spawns, winter.
export function step(L) {
  const out = { hauls: [], spawns: [], winter: false };
  const P = L.P, rng = L.rng, dt = P.DT;
  const ph = phase(P, L.t);
  const near = grid(L);
  const N = L.fish.length;
  const crowd = Math.max(0, 1 - N / L.cap);
  const born = [];
  for (let i = 0; i < N; i++) {
    const f = L.fish[i];
    let cx = 0, cy = 0, ax = 0, ay = 0, n = 0, sepx = 0, sepy = 0, mate = -1;
    near(f.x, f.y, (j) => {
      if (j === i) return;
      const o = L.fish[j], dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
      if (d2 > P.SIGHT * P.SIGHT) return;
      if (o.age === 0 && f.age >= 1) return; // adults school with adults
      cx += o.x; cy += o.y; ax += Math.cos(o.h); ay += Math.sin(o.h); n++;
      if (d2 < P.SEP * P.SEP) { sepx -= dx; sepy -= dy; }
      if (mate < 0 && f.age >= 1 && o.age >= 1 && d2 < P.MATE * P.MATE && o.cool <= 0) mate = j;
    });
    let tx = Math.cos(f.h), ty = Math.sin(f.h);
    if (n) {
      tx += 0.012 * (cx / n - f.x) + 0.35 * (ax / n) + 0.05 * sepx;
      ty += 0.012 * (cy / n - f.y) + 0.35 * (ay / n) + 0.05 * sepy;
    }
    if (f.age === 0) {
      // fry keep to the shallows: a band near the shore, spread out, no schooling
      tx = Math.cos(f.h) + 0.08 * sepx; ty = Math.sin(f.h) + 0.08 * sepy;
      const ex = (f.x - P.W / 2) / P.RX, ey = (f.y - P.H / 2) / P.RY, e = Math.hypot(ex, ey);
      if (e < P.SHALLOW) { tx += ex / e * 0.6; ty += ey / e * 0.6; }
    }
    if (!inLake(P, f.x, f.y, 0.92)) { tx += (P.W / 2 - f.x) * 0.01; ty += (P.H / 2 - f.y) * 0.01; }
    if (f.scare > 0) { tx += f.sx * 3; ty += f.sy * 3; f.scare -= dt; }
    let h = Math.atan2(ty, tx) + (rng() - 0.5) * 0.5;
    f.h = h;
    const v = (f.age >= 1 ? P.V_ADULT : P.V_FRY) * (f.scare > 0 ? 2.2 : 1);
    f.x += Math.cos(h) * v * dt; f.y += Math.sin(h) * v * dt;
    if (f.cool > 0) f.cool -= dt;
    // spring: two adults that meet may spawn
    if (ph.phase === "fish" && ph.spring && mate >= 0 && f.cool <= 0) {
      if (rng() < P.BREED * dt * crowd) {
        const o = L.fish[mate];
        f.cool = o.cool = P.COOL_S;
        for (let c = 0; c < P.CLUTCH; c++) born.push(spawn(L, (f.x + o.x) / 2 + (rng() - 0.5) * 10, (f.y + o.y) / 2 + (rng() - 0.5) * 10, 0));
        out.spawns.push({ x: (f.x + o.x) / 2, y: (f.y + o.y) / 2 });
      }
    }
  }
  for (const b of born) L.fish.push(b);
  // nets that close this tick
  const still = [];
  for (const net of L.nets) {
    if (net.closeAt > L.t + 1e-9) { still.push(net); continue; }
    const r = net.fine ? P.R_FINE : P.R_COARSE;
    let got = 0, gotFry = 0, slipped = 0;
    L.fish = L.fish.filter((f) => {
      const dx = f.x - net.x, dy = f.y - net.y;
      if (dx * dx + dy * dy > r * r) return true;
      if (f.age === 0 && !net.fine) { slipped++; return true; } // fry slip through a coarse mesh
      got++; if (f.age === 0) gotFry++;
      return false;
    });
    out.hauls.push({ net, got, gotFry, slipped });
  }
  L.nets = still;
  const before = phase(P, L.t);
  L.t = Math.round((L.t + dt) * 1000) / 1000;
  const after = phase(P, L.t);
  // winter: at the end of each year's fishing, fry grow up, the old die
  if (before.phase === "fish" && after.phase !== "fish") { winter(L); out.winter = true; }
  return out;
}

function winter(L) {
  const P = L.P;
  L.fish = L.fish.filter((f) => {
    f.age += 1;
    if (f.age > P.MAX_AGE) return false;
    return f.age === 1 || L.rng() >= P.WINTER_DEATH;
  });
  L.hist.push({ year: phase(P, L.t - 0.001).year, adults: adults(L) });
}

// a net lands now; it closes SINK_S later. Fish nearby scatter.
export function cast(L, fam, x, y, fine) {
  const P = L.P;
  const net = { fam, x, y, fine, closeAt: Math.round((L.t + P.SINK_S) * 1000) / 1000 };
  L.nets.push(net);
  const r = (fine ? P.R_FINE : P.R_COARSE) * 1.6;
  for (const f of L.fish) {
    const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
    if (d < r && d > (fine ? P.R_FINE : P.R_COARSE) * 0.7) { f.scare = 0.5; f.sx = dx / d; f.sy = dy / d; }
  }
  return net;
}

// Left alone after the season, how many grown fish would greet next year?
// Steps the same lake on through one more spring and summer with no nets,
// to the next winter. Changes the lake.
export function nextYear(L) {
  L.P = { ...L.P, YEARS: L.P.YEARS + 1 };
  for (;;) { if (step(L).winter || dead(L)) break; }
  return adults(L);
}

// a bot-like aim: try fish positions, pick the spot with the most catchable fish
export function bestSpot(L, fine, rng, tries = 14, maxE = 9) {
  const P = L.P, r = fine ? P.R_FINE : P.R_COARSE;
  let best = null, bestN = -1;
  const pool = L.fish.filter((f) => fine || f.age >= 1);
  if (!pool.length) return { x: P.W / 2, y: P.H / 2, n: 0 };
  for (let k = 0; k < tries; k++) {
    const f = pool[Math.floor(rng() * pool.length)];
    // lead the fish a little
    const x = f.x + Math.cos(f.h) * 15, y = f.y + Math.sin(f.h) * 15;
    if (Math.hypot((x - P.W / 2) / P.RX, (y - P.H / 2) / P.RY) > maxE) continue;
    let n = 0;
    for (const o of pool) { const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < r * r) n++; }
    if (n > bestN) { bestN = n; best = { x, y, n }; }
  }
  return best || { x: P.W / 2, y: P.H / 2, n: 0 };
}
