// The boat game's simulation ("boat-sim 0.1", experimental; docs/boats/RULES.md).
// Pure and deterministic: a match is its seed plus the inputs applied at each
// tick, so the same seed and the same inputs give the same match, fish for
// fish (spec/unit/boat-sim.test.ts replays one). The server owns it; a
// browser only sends inputs (steer, cast, dash) and draws the frames. Nothing
// here reads the clock or Math.random.
//
// The question every trip asks: fish a little more, or go home now? Fish in
// your hold are not yours: only fish unloaded at your dock count, a dash into
// your boat spills some of them, and the horn takes whatever is still aboard.
import { BOAT, BOAT_MODEL } from "./game-constants.ts";
import { sfc32 } from "./lake-sim.ts";
import { createHash } from "node:crypto";

export const Q = BOAT;
export { BOAT_MODEL };

export type InputKind = "steer" | "cast" | "dash";
export interface Input { seat: number; kind: InputKind; x?: number; y?: number }

export interface Fish { id: number; x: number; y: number; h: number; adult: boolean; born: number; cool: number; scare: number; sx: number; sy: number }
export interface Net { id: number; seat: number; x: number; y: number; closeAt: number }
export interface Loose { id: number; x: number; y: number; vx: number; vy: number; value: number; t: number }
export interface Koi { x: number; y: number; h: number; until: number }
export interface Stats { caught: number; banked: number; trips: number; bestTrip: number; lost: number; rams: number; rammed: number; scooped: number; koi: number; fullCasts: number; casts: number }
export interface Boat {
  seat: number; bot: BotKind | null;
  x: number; y: number; h: number; vx: number; vy: number; tx: number; ty: number;
  hold: number[]; // each entry is a fish's value (1, or KOI_VALUE for the golden carp)
  castCd: number; dashT: number; dashCd: number; stun: number; shield: number; unloadT: number;
  docked: boolean; tripValue: number; banked: number; stats: Stats;
}
export type BotKind = "steady" | "pirate" | "scavenger";
export type SimEvent =
  | { k: "cast"; seat: number; x: number; y: number }
  | { k: "catch"; seat: number; n: number; fry: number; koi: boolean; full: number; x: number; y: number }
  | { k: "bank"; seat: number; v: number; banked: number; tier: number }
  | { k: "ram"; a: number; v: number; n: number; koi: boolean; x: number; y: number }
  | { k: "pick"; seat: number; v: number; x: number; y: number }
  | { k: "koi"; x: number; y: number }
  | { k: "end" };

export interface Sim {
  seed: string; tick: number; t: number; players: number;
  rng: () => number; botRng: () => number;
  boats: Boat[]; fish: Fish[]; nets: Net[]; loose: Loose[]; koi: Koi | null;
  nextKoi: number; nextId: number; start: number; cap: number; over: boolean;
}

function rngFor(seed: string, name: string): () => number {
  const h = createHash("sha256").update(`${seed}|${name}`).digest();
  const r = sfc32(h.readUInt32BE(0), h.readUInt32BE(4), h.readUInt32BE(8), h.readUInt32BE(12));
  for (let i = 0; i < 12; i++) r();
  return r;
}

export const ell = (x: number, y: number): number => Math.hypot((x - Q.W / 2) / Q.RX, (y - Q.H / 2) / Q.RY);

// Docks stand evenly round the shore; seat 0 at the bottom.
export function dockOf(seat: number, players: number): { x: number; y: number; a: number } {
  const a = Math.PI / 2 + (seat * 2 * Math.PI) / Math.max(players, 2);
  return { x: Q.W / 2 + Q.RX * 0.9 * Math.cos(a), y: Q.H / 2 + Q.RY * 0.9 * Math.sin(a), a };
}
const nearAnyDock = (s: Sim, x: number, y: number, r: number): boolean =>
  s.boats.some((b) => { const d = dockOf(b.seat, s.players); return Math.hypot(x - d.x, y - d.y) < r; });

const tierOf = (banked: number): number => { let t = 0; for (let i = 0; i < Q.TIERS.length; i++) if (banked >= Q.TIERS[i]) t = i; return t; };
export const holdValue = (b: Boat): number => b.hold.reduce((n, v) => n + v, 0);

function newFish(s: Sim, x: number | null, y: number | null, adult: boolean): Fish {
  let fx = x, fy = y;
  if (fx === null || fy === null) {
    do { fx = Q.W / 2 + (s.rng() * 2 - 1) * Q.RX; fy = Q.H / 2 + (s.rng() * 2 - 1) * Q.RY; } while (ell(fx, fy) > 0.88);
  }
  return { id: s.nextId++, x: fx, y: fy, h: s.rng() * Math.PI * 2, adult, born: s.t, cool: adult ? 0 : Q.COOL, scare: 0, sx: 0, sy: 0 };
}

export function makeSim(seed: string, seats: (BotKind | null)[]): Sim {
  const players = seats.length;
  const s: Sim = {
    seed, tick: 0, t: 0, players, rng: rngFor(seed, "lake"), botRng: rngFor(seed, "bots"),
    boats: [], fish: [], nets: [], loose: [], koi: null, nextKoi: Q.KOI_FIRST, nextId: 1,
    start: Q.FISH_BASE + Q.FISH_PER_BOAT * players, cap: 0, over: false,
  };
  s.cap = Math.round(s.start * Q.CAP_MULT);
  for (let i = 0; i < s.start; i++) s.fish.push(newFish(s, null, null, true));
  seats.forEach((bot, seat) => {
    const d = dockOf(seat, players), x = d.x - Math.cos(d.a) * 20, y = d.y - Math.sin(d.a) * 20;
    s.boats.push({
      seat, bot, x, y, h: d.a + Math.PI, vx: 0, vy: 0, tx: x, ty: y, hold: [], castCd: 0, dashT: 0, dashCd: 0, stun: 0, shield: 0, unloadT: 0,
      docked: true, tripValue: 0, banked: 0, stats: { caught: 0, banked: 0, trips: 0, bestTrip: 0, lost: 0, rams: 0, rammed: 0, scooped: 0, koi: 0, fullCasts: 0, casts: 0 },
    });
  });
  return s;
}

// ---- inputs ----
function apply(s: Sim, inp: Input, ev: SimEvent[]): void {
  const b = s.boats[inp.seat];
  if (!b || s.over) return;
  if (inp.kind === "steer" && Number.isFinite(inp.x) && Number.isFinite(inp.y)) {
    b.tx = Math.max(0, Math.min(Q.W, inp.x!)); b.ty = Math.max(0, Math.min(Q.H, inp.y!));
  }
  if (inp.kind === "cast" && b.castCd <= 0 && b.stun <= 0) {
    b.castCd = Q.CAST_CD; b.stats.casts++;
    if (b.hold.length >= Q.HOLD) { b.stats.fullCasts++; ev.push({ k: "catch", seat: b.seat, n: 0, fry: 0, koi: false, full: 1, x: b.x, y: b.y }); return; }
    const x = b.x + Math.cos(b.h) * Q.NET_AHEAD, y = b.y + Math.sin(b.h) * Q.NET_AHEAD;
    s.nets.push({ id: s.nextId++, seat: b.seat, x, y, closeAt: s.t + Q.SINK });
    for (const f of s.fish) { const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy); if (d < Q.NET_R * 1.6 && d > Q.NET_R * 0.7) { f.scare = 0.5; f.sx = dx / d; f.sy = dy / d; } }
    ev.push({ k: "cast", seat: b.seat, x, y });
  }
  if (inp.kind === "dash" && b.dashCd <= 0 && b.stun <= 0) {
    b.dashT = Q.DASH_S; b.dashCd = Q.DASH_CD;
    if (Math.hypot(b.tx - b.x, b.ty - b.y) < 20) { b.tx = b.x + Math.cos(b.h) * 200; b.ty = b.y + Math.sin(b.h) * 200; }
  }
}

// ---- one tick ----
export function step(s: Sim, inputs: Input[]): SimEvent[] {
  const ev: SimEvent[] = [];
  if (s.over) return ev;
  for (const inp of inputs) apply(s, inp, ev);
  for (const b of s.boats) if (b.bot) for (const inp of botInputs(s, b)) apply(s, inp, ev);
  moveBoats(s, ev);
  moveFish(s);
  closeNets(s, ev);
  rams(s, ev);
  floatLoose(s, ev);
  koiTick(s, ev);
  s.tick++;
  s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  if (s.t >= Q.SECONDS) {
    s.over = true;
    for (const b of s.boats) { b.stats.lost += holdValue(b); if (b.tripValue > 0) { b.stats.trips++; b.stats.bestTrip = Math.max(b.stats.bestTrip, b.tripValue); b.tripValue = 0; } }
    ev.push({ k: "end" });
  }
  return ev;
}

function moveBoats(s: Sim, ev: SimEvent[]): void {
  const dt = Q.DT;
  for (const b of s.boats) {
    if (b.castCd > 0) b.castCd -= dt;
    if (b.dashCd > 0) b.dashCd -= dt;
    if (b.dashT > 0) b.dashT -= dt;
    if (b.shield > 0) b.shield -= dt;
    if (b.stun > 0) { b.stun -= dt; b.vx *= 0.85; b.vy *= 0.85; }
    else {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      const load = b.hold.length / Q.HOLD, v = Q.SPEED * (1 - Q.LOAD_SLOW * load) * (b.dashT > 0 ? Q.DASH_MULT : 1);
      const want = b.dashT > 0 ? 1 : d > 4 ? Math.min(1, d / 40) : 0;
      const dirx = d > 4 ? dx / d : Math.cos(b.h), diry = d > 4 ? dy / d : Math.sin(b.h);
      const k = Math.min(1, Q.ACCEL * dt * (b.dashT > 0 ? 3 : 1));
      b.vx += (dirx * v * want - b.vx) * k; b.vy += (diry * v * want - b.vy) * k;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const e = ell(b.x, b.y);
    if (e > 0.965) { const ex = (b.x - Q.W / 2) / Q.RX, ey = (b.y - Q.H / 2) / Q.RY; b.x = Q.W / 2 + (ex / e) * 0.965 * Q.RX; b.y = Q.H / 2 + (ey / e) * 0.965 * Q.RY; b.vx *= 0.5; b.vy *= 0.5; }
    if (Math.hypot(b.vx, b.vy) > 8) b.h = Math.atan2(b.vy, b.vx);
    if (b.dashT > 0) for (const f of s.fish) { const fx = f.x - b.x, fy = f.y - b.y, fd = Math.hypot(fx, fy); if (fd < 40 && fd > 0) { f.scare = 0.4; f.sx = fx / fd; f.sy = fy / fd; } }
    // home: unload one fish at a time
    const d = dockOf(b.seat, s.players);
    const wasDocked = b.docked;
    b.docked = Math.hypot(b.x - d.x, b.y - d.y) < Q.DOCK_R;
    if (b.docked && !wasDocked) { b.unloadT = Q.UNLOAD_EVERY; b.tripValue = 0; }
    if (!b.docked && wasDocked && b.tripValue > 0) { b.stats.trips++; b.stats.bestTrip = Math.max(b.stats.bestTrip, b.tripValue); b.tripValue = 0; } // a trip ends when you leave a dock you unloaded at
    if (b.docked && b.hold.length) {
      b.unloadT -= dt;
      let v = 0;
      while (b.unloadT <= 0 && b.hold.length) { b.unloadT += Q.UNLOAD_EVERY; v += b.hold.pop()!; }
      if (v) {
        const before = tierOf(b.banked);
        b.banked += v; b.stats.banked += v; b.tripValue += v;
        ev.push({ k: "bank", seat: b.seat, v, banked: b.banked, tier: tierOf(b.banked) > before ? tierOf(b.banked) : -1 });
      }
    }
  }
}

function moveFish(s: Sim): void {
  const dt = Q.DT, cs = Q.SIGHT, grid = new Map<number, number[]>();
  s.fish.forEach((f, i) => { const k = ((f.x / cs) | 0) * 1000 + ((f.y / cs) | 0); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i); });
  const N = s.fish.length, room = Math.max(0, 1 - N / s.cap), born: Fish[] = [];
  for (let i = 0; i < N; i++) {
    const f = s.fish[i];
    let cx = 0, cy = 0, ax = 0, ay = 0, n = 0, sepx = 0, sepy = 0, mate = -1;
    const gx = (f.x / cs) | 0, gy = (f.y / cs) | 0;
    for (let a = gx - 1; a <= gx + 1; a++) for (let c = gy - 1; c <= gy + 1; c++) {
      const cell = grid.get(a * 1000 + c); if (!cell) continue;
      for (const j of cell) {
        if (j === i) continue;
        const o = s.fish[j], dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
        if (d2 > cs * cs || (o.adult !== f.adult)) continue;
        cx += o.x; cy += o.y; ax += Math.cos(o.h); ay += Math.sin(o.h); n++;
        if (d2 < Q.SEP * Q.SEP) { sepx -= dx; sepy -= dy; }
        if (mate < 0 && f.adult && o.adult && d2 < Q.MATE * Q.MATE && o.cool <= 0) mate = j;
      }
    }
    let tx = Math.cos(f.h), ty = Math.sin(f.h);
    if (n) { tx += 0.012 * (cx / n - f.x) + 0.35 * (ax / n) + 0.05 * sepx; ty += 0.012 * (cy / n - f.y) + 0.35 * (ay / n) + 0.05 * sepy; }
    if (!f.adult) { // fry keep to the shallows, where nets pass less
      const ex = (f.x - Q.W / 2) / Q.RX, ey = (f.y - Q.H / 2) / Q.RY, e = Math.hypot(ex, ey) || 1;
      if (e < Q.SHALLOW) { tx += (ex / e) * 0.6; ty += (ey / e) * 0.6; }
      if (s.t - f.born >= Q.MATURE_S) f.adult = true;
    }
    if (ell(f.x, f.y) > 0.92) { tx += (Q.W / 2 - f.x) * 0.01; ty += (Q.H / 2 - f.y) * 0.01; }
    if (f.scare > 0) { tx += f.sx * 3; ty += f.sy * 3; f.scare -= dt; }
    const h = Math.atan2(ty, tx) + (s.rng() - 0.5) * 0.5;
    f.h = h;
    const v = (f.adult ? Q.V_ADULT : Q.V_FRY) * (f.scare > 0 ? 2.2 : 1);
    f.x += Math.cos(h) * v * dt; f.y += Math.sin(h) * v * dt;
    if (f.cool > 0) f.cool -= dt;
    // two grown fish that meet may spawn two fry, less often as the lake fills
    if (mate >= 0 && f.cool <= 0 && s.rng() < Q.BREED * dt * room) {
      const o = s.fish[mate];
      f.cool = o.cool = Q.COOL;
      for (let k = 0; k < 2; k++) born.push(newFish(s, (f.x + o.x) / 2 + (s.rng() - 0.5) * 10, (f.y + o.y) / 2 + (s.rng() - 0.5) * 10, false));
    }
  }
  for (const b of born) s.fish.push(b);
}

function closeNets(s: Sim, ev: SimEvent[]): void {
  const still: Net[] = [];
  for (const net of s.nets) {
    if (net.closeAt > s.t + 1e-9) { still.push(net); continue; }
    const b = s.boats[net.seat];
    let room = Q.HOLD - b.hold.length, n = 0, fry = 0, full = 0, koi = false;
    if (s.koi && room > 0 && Math.hypot(s.koi.x - net.x, s.koi.y - net.y) < Q.NET_R + 8) { b.hold.push(Q.KOI_VALUE); room--; koi = true; b.stats.koi++; s.koi = null; }
    s.fish = s.fish.filter((f) => {
      const dx = f.x - net.x, dy = f.y - net.y;
      if (dx * dx + dy * dy > Q.NET_R * Q.NET_R) return true;
      if (!f.adult) { fry++; return true; } // fry slip through the mesh
      if (room <= 0) { full++; return true; }
      room--; n++; b.hold.push(1); return false;
    });
    b.stats.caught += n + (koi ? Q.KOI_VALUE : 0);
    ev.push({ k: "catch", seat: b.seat, n, fry, koi, full, x: net.x, y: net.y });
  }
  s.nets = still;
}

function rams(s: Sim, ev: SimEvent[]): void {
  for (const a of s.boats) {
    if (a.dashT <= 0) continue;
    for (const v of s.boats) {
      if (v === a || v.shield > 0 || Math.hypot(a.x - v.x, a.y - v.y) > Q.RAM_R) continue;
      if (nearAnyDock(s, v.x, v.y, Q.SAFE_R) || nearAnyDock(s, a.x, a.y, Q.SAFE_R)) continue; // no ram by a dock: nobody can guard a port
      const k = v.hold.indexOf(Q.KOI_VALUE);
      const drop: number[] = [];
      if (k >= 0) drop.push(...v.hold.splice(k, 1));
      while (drop.length < Q.RAM_DROP && v.hold.length) drop.push(v.hold.pop()!);
      for (const value of drop) {
        const t = s.rng() * Math.PI * 2, sp = 40 + s.rng() * 50;
        s.loose.push({ id: s.nextId++, x: v.x, y: v.y, vx: Math.cos(t) * sp, vy: Math.sin(t) * sp, value, t: s.t });
      }
      const lost = drop.reduce((n, x) => n + x, 0);
      v.stats.lost += lost; v.stats.rammed++; a.stats.rams++;
      v.stun = Q.STUN; v.shield = Q.SHIELD;
      const ang = Math.atan2(v.y - a.y, v.x - a.x);
      v.vx = Math.cos(ang) * 160; v.vy = Math.sin(ang) * 160;
      a.dashT = 0; a.vx *= 0.3; a.vy *= 0.3;
      ev.push({ k: "ram", a: a.seat, v: v.seat, n: drop.length, koi: k >= 0, x: v.x, y: v.y });
      break;
    }
  }
}

function floatLoose(s: Sim, ev: SimEvent[]): void {
  const keep: Loose[] = [];
  for (const l of s.loose) {
    l.vx *= 0.92; l.vy *= 0.92; l.x += l.vx * Q.DT; l.y += l.vy * Q.DT;
    if (s.t - l.t > Q.LOOSE_S) { if (l.value === 1) s.fish.push(newFish(s, l.x, l.y, true)); continue; } // back into the lake
    let taken = false;
    if (s.t - l.t > 0.3) for (const b of s.boats) {
      if (b.stun > 0 || b.hold.length >= Q.HOLD || Math.hypot(b.x - l.x, b.y - l.y) > Q.PICK_R) continue;
      b.hold.push(l.value); b.stats.scooped += l.value; taken = true;
      ev.push({ k: "pick", seat: b.seat, v: l.value, x: l.x, y: l.y });
      break;
    }
    if (!taken) keep.push(l);
  }
  s.loose = keep;
}

function koiTick(s: Sim, ev: SimEvent[]): void {
  if (!s.koi && s.t >= s.nextKoi && s.t < Q.SECONDS - 12) {
    const a = s.rng() * Math.PI * 2;
    s.koi = { x: Q.W / 2 + Math.cos(a) * 150, y: Q.H / 2 + Math.sin(a) * 90, h: s.rng() * Math.PI * 2, until: s.t + Q.KOI_FOR };
    s.nextKoi = s.t + Q.KOI_EVERY;
    ev.push({ k: "koi", x: s.koi.x, y: s.koi.y });
  }
  const k = s.koi; if (!k) return;
  if (s.t >= k.until) { s.koi = null; return; }
  let fx = 0, fy = 0;
  for (const b of s.boats) { const dx = k.x - b.x, dy = k.y - b.y, d = Math.hypot(dx, dy); if (d < 140 && d > 0) { fx += (dx / d / d) * 140; fy += (dy / d / d) * 140; } }
  k.h = Math.atan2(Math.sin(k.h) + fy, Math.cos(k.h) + fx) + (s.rng() - 0.5) * 0.4;
  if (ell(k.x, k.y) > 0.82) k.h = Math.atan2(Q.H / 2 - k.y, Q.W / 2 - k.x);
  k.x += Math.cos(k.h) * Q.KOI_SPEED * Q.DT; k.y += Math.sin(k.h) * Q.KOI_SPEED * Q.DT;
}

// ---- bots: only what a person could see; slower hands ----
//   steady: fishes and goes home at 70% full
//   pirate: fishes, and dashes at loaded boats now and then
//   scavenger: fishes, scoops spills, goes for the golden carp
interface BotMind { mode: string; spot: { x: number; y: number } | null; spotT: number; think: number; calm: number }
const minds = new WeakMap<Boat, BotMind>();
function botInputs(s: Sim, b: Boat): Input[] {
  let m = minds.get(b);
  if (!m) { m = { mode: "fish", spot: null, spotT: 0, think: 0, calm: 5 + s.botRng() * 5 }; minds.set(b, m); }
  const out: Input[] = [];
  const r = s.botRng;
  m.think -= Q.DT;
  if (m.think > 0) return out;
  m.think = 0.25 + r() * 0.25; // a person's reaction, roughly
  const d = dockOf(b.seat, s.players), left = Q.SECONDS - s.t, n = b.hold.length;
  const homeAt = b.bot === "steady" ? 0.7 : 0.9;
  if (n >= Q.HOLD * homeAt || (left < 15 && n > 0) || (left < 6)) m.mode = "home";
  else if (b.docked && n === 0 && m.mode === "home") m.mode = "fish";
  if (m.mode === "home") { out.push({ seat: b.seat, kind: "steer", x: d.x, y: d.y }); return out; }
  if (s.koi && b.bot === "scavenger" && n < Q.HOLD) {
    out.push({ seat: b.seat, kind: "steer", x: s.koi.x + Math.cos(s.koi.h) * 30, y: s.koi.y + Math.sin(s.koi.h) * 30 });
    if (Math.hypot(s.koi.x - b.x, s.koi.y - b.y) < 70 && b.castCd <= 0) out.push({ seat: b.seat, kind: "cast" });
    return out;
  }
  if (b.bot === "pirate" && b.dashCd <= 0 && s.t > m.calm) {
    const prey = s.boats.filter((o) => o !== b && o.shield <= 0 && !o.docked && holdValue(o) >= 6 && Math.hypot(o.x - b.x, o.y - b.y) < 220).sort((p, q) => holdValue(q) - holdValue(p))[0];
    if (prey) {
      out.push({ seat: b.seat, kind: "steer", x: prey.x + prey.vx * 0.3, y: prey.y + prey.vy * 0.3 });
      if (Math.hypot(prey.x - b.x, prey.y - b.y) < 90) { out.push({ seat: b.seat, kind: "dash" }); m.calm = s.t + 10 + r() * 8; }
      return out;
    }
  }
  if (s.loose.length && n < Q.HOLD) {
    const near = s.loose.filter((l) => Math.hypot(l.x - b.x, l.y - b.y) < (b.bot === "scavenger" ? 300 : 120)).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
    if (near) { out.push({ seat: b.seat, kind: "steer", x: near.x, y: near.y }); return out; }
  }
  if (!m.spot || s.t > m.spotT || Math.hypot(m.spot.x - b.x, m.spot.y - b.y) < 25) {
    // the densest grown school it can see, roughly
    let best = null as { x: number; y: number; n: number } | null;
    const adults = s.fish.filter((f) => f.adult);
    for (let k = 0; k < 8 && adults.length; k++) {
      const f = adults[Math.floor(r() * adults.length)];
      let c = 0; for (const o of adults) if ((o.x - f.x) ** 2 + (o.y - f.y) ** 2 < 40 * 40) c++;
      if (!best || c > best.n) best = { x: f.x, y: f.y, n: c };
    }
    m.spot = best ? { x: best.x + (r() - 0.5) * 50, y: best.y + (r() - 0.5) * 50 } : { x: Q.W / 2, y: Q.H / 2 };
    m.spotT = s.t + 2.5;
  }
  out.push({ seat: b.seat, kind: "steer", x: m.spot.x, y: m.spot.y });
  const ax = b.x + Math.cos(b.h) * Q.NET_AHEAD, ay = b.y + Math.sin(b.h) * Q.NET_AHEAD;
  if (b.castCd <= 0 && r() < 0.6) {
    let c = 0; for (const f of s.fish) if (f.adult && (f.x - ax) ** 2 + (f.y - ay) ** 2 < Q.NET_R * Q.NET_R) c++;
    if (c >= 2) out.push({ seat: b.seat, kind: "cast" });
  }
  return out;
}

// ---- what a browser is sent ----
export interface Frame {
  t: number; left: number; fishN: number; adultsN: number;
  b: [number, number, number, number, number, number, number, number, number, number, number, number][]; // seat, x, y, h*100, holdN, holdValue, flags, banked, tx, ty, castCd*10, dashCd*10
  f: [number, number, number, number, number][]; // id, x, y, h*100, adult
  n: [number, number, number, number, number][]; // id, seat, x, y, ms to close
  l: [number, number, number, number][]; // id, x, y, value
  k: [number, number, number] | null;
}
export const FLAG = { DASH: 1, STUN: 2, SHIELD: 4, DOCKED: 8, KOI: 16 } as const;
export function frameOf(s: Sim): Frame {
  return {
    t: s.t, left: Math.max(0, Q.SECONDS - s.t), fishN: s.fish.length, adultsN: s.fish.filter((f) => f.adult).length,
    b: s.boats.map((b) => [b.seat, Math.round(b.x), Math.round(b.y), Math.round(b.h * 100), b.hold.length, holdValue(b),
      (b.dashT > 0 ? FLAG.DASH : 0) | (b.stun > 0 ? FLAG.STUN : 0) | (b.shield > 0 ? FLAG.SHIELD : 0) | (b.docked ? FLAG.DOCKED : 0) | (b.hold.includes(Q.KOI_VALUE) ? FLAG.KOI : 0),
      b.banked, Math.round(b.tx), Math.round(b.ty), Math.max(0, Math.ceil(b.castCd * 10)), Math.max(0, Math.ceil(b.dashCd * 10))]),
    f: s.fish.map((f) => [f.id, Math.round(f.x), Math.round(f.y), Math.round(f.h * 100), f.adult ? 1 : 0]),
    n: s.nets.map((n) => [n.id, n.seat, Math.round(n.x), Math.round(n.y), Math.round((n.closeAt - s.t) * 1000)]),
    l: s.loose.map((l) => [l.id, Math.round(l.x), Math.round(l.y), l.value]),
    k: s.koi ? [Math.round(s.koi.x), Math.round(s.koi.y), Math.round(s.koi.h * 100)] : null,
  };
}

export interface Result { seat: number; banked: number; place: number; stats: Stats }
export function resultsOf(s: Sim): Result[] {
  const order = s.boats.slice().sort((a, b) => b.banked - a.banked);
  return s.boats.map((b) => ({ seat: b.seat, banked: b.banked, place: order.findIndex((o) => o.banked === b.banked) + 1, stats: { ...b.stats } }));
}

// Replays a match from its seed and inputs (tick -> inputs in arrival order).
export function replay(seed: string, seats: (BotKind | null)[], inputs: Map<number, Input[]>): Sim {
  const s = makeSim(seed, seats);
  while (!s.over) step(s, inputs.get(s.tick) ?? []);
  return s;
}
