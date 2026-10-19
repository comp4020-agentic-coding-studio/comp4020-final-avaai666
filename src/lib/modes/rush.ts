// Boat Rush, "rush 1.0" (DESIGN.md "Boat Rush"). boat-sim 0.1's rules (sail,
// cast at the bow, a hold of 10, slower when full, unload at your own dock,
// dash and ram with at most 3 spilled, shields, no ram near a dock, spilled
// fish, the golden carp), copied rather than imported so that /b's model is
// never touched, plus: upgrades at your dock, the charge cast, schools that
// scatter, the reed shallows, the leader's crown and Lantern Rush.
//
// Pure and deterministic: the lake draws only from the match's "lake"
// stream; a bot's decisions come from the stream the platform gives it for
// that tick, and its only memory is the simulation itself.
import { RUSH as Q } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";

export type Upgrade = "bigHold" | "fastHull" | "wideNet" | "ironBow";
const UPGRADES = Object.keys(Q.UPGRADES) as Upgrade[];
export type RushInput =
  | { k: "steer"; x: number; y: number }
  | { k: "cast"; charge: number }
  | { k: "dash" }
  | { k: "buy"; up: Upgrade };

interface Fish { id: number; x: number; y: number; h: number; adult: boolean; born: number; cool: number; scare: number; sx: number; sy: number }
interface Net { id: number; seat: number; x: number; y: number; r: number; closeAt: number }
interface Loose { id: number; x: number; y: number; vx: number; vy: number; value: number; t: number }
interface Koi { x: number; y: number; h: number; until: number }
interface Stats { caught: number; banked: number; trips: number; bestTrip: number; lost: number; rams: number; rammed: number; scooped: number; koi: number; casts: number; fullCasts: number; spent: number; closest: number }
interface Boat {
  seat: number; x: number; y: number; h: number; vx: number; vy: number; tx: number; ty: number;
  hold: number[]; castCd: number; dashT: number; dashCd: number; stun: number; shield: number; unloadT: number;
  docked: boolean; tripValue: number; banked: number; ups: Upgrade[]; stats: Stats; firstScoreAt: number | null;
  mind: { mode: "fish" | "home"; spot: [number, number] | null; spotT: number; calm: number };
}
export interface RushSim {
  tick: number; t: number; players: number; bots: boolean[]; rng: () => number;
  boats: Boat[]; fish: Fish[]; nets: Net[]; loose: Loose[]; koi: Koi | null;
  nextKoi: number; nextId: number; cap: number; startFish: number; crown: number | null; lantern: boolean;
}

export const ell = (x: number, y: number): number => Math.hypot((x - Q.W / 2) / Q.RX, (y - Q.H / 2) / Q.RY);
export const inReeds = (x: number, y: number): boolean => Q.REEDS.some((r) => Math.hypot(x - r.x, y - r.y) < r.r);
export function dockOf(seat: number, players: number): { x: number; y: number; a: number } {
  const a = Math.PI / 2 + (seat * 2 * Math.PI) / Math.max(players, 2);
  return { x: Q.W / 2 + Q.RX * 0.9 * Math.cos(a), y: Q.H / 2 + Q.RY * 0.9 * Math.sin(a), a };
}
const nearAnyDock = (s: RushSim, x: number, y: number, r: number): boolean =>
  s.boats.some((b) => { const d = dockOf(b.seat, s.players); return Math.hypot(x - d.x, y - d.y) < r; });
const tierOf = (banked: number): number => { let t = 0; for (let i = 0; i < Q.TIERS.length; i++) if (banked >= Q.TIERS[i]) t = i; return t; };
const holdValue = (b: Boat): number => b.hold.reduce((n, v) => n + v, 0);
const nextCost = (b: Boat): number => (b.ups.length === 0 ? Q.FIRST_UP_COST : Q.SECOND_UP_COST);
const has = (b: Boat, u: Upgrade): boolean => b.ups.includes(u);
const holdMax = (b: Boat): number => Q.HOLD + (has(b, "bigHold") ? Q.UPGRADES.bigHold.hold! : 0);
const netR = (b: Boat, charge: number): number => Q.NET_R * (has(b, "wideNet") ? Q.UPGRADES.wideNet.net! : 1) * (1 + Q.MAX_CHARGE * charge);

function newFish(s: RushSim, x: number | null, y: number | null, adult: boolean): Fish {
  let fx = x, fy = y;
  if (fx === null || fy === null) {
    do { fx = Q.W / 2 + (s.rng() * 2 - 1) * Q.RX; fy = Q.H / 2 + (s.rng() * 2 - 1) * Q.RY; } while (ell(fx, fy) > 0.88);
  }
  return { id: s.nextId++, x: fx, y: fy, h: s.rng() * Math.PI * 2, adult, born: s.t, cool: adult ? 0 : Q.COOL, scare: 0, sx: 0, sy: 0 };
}
function reedFish(s: RushSim): Fish {
  const r = Q.REEDS[Math.floor(s.rng() * Q.REEDS.length)];
  const a = s.rng() * Math.PI * 2, d = Math.sqrt(s.rng()) * r.r * 0.9;
  return newFish(s, r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, true);
}

function make(seed: string, seats: Seat[], lake: { fish: number }): RushSim {
  const players = seats.length;
  const s: RushSim = {
    tick: 0, t: 0, players, bots: seats.map((x) => x.bot !== null), rng: streamOf(seed, "lake"),
    boats: [], fish: [], nets: [], loose: [], koi: null, nextKoi: Q.KOI_FIRST, nextId: 1,
    cap: Math.round(220 * Q.CAP_MULT), startFish: lake.fish, crown: null, lantern: false,
  };
  const inReedsN = Math.round(lake.fish * Q.REED_SHARE);
  for (let i = 0; i < lake.fish; i++) s.fish.push(i < inReedsN ? reedFish(s) : newFish(s, null, null, true));
  seats.forEach((_, seat) => {
    const d = dockOf(seat, players), x = d.x - Math.cos(d.a) * 20, y = d.y - Math.sin(d.a) * 20;
    s.boats.push({
      seat, x, y, h: d.a + Math.PI, vx: 0, vy: 0, tx: x, ty: y, hold: [], castCd: 0, dashT: 0, dashCd: 0, stun: 0, shield: 0, unloadT: 0,
      docked: true, tripValue: 0, banked: 0, ups: [], firstScoreAt: null,
      stats: { caught: 0, banked: 0, trips: 0, bestTrip: 0, lost: 0, rams: 0, rammed: 0, scooped: 0, koi: 0, casts: 0, fullCasts: 0, spent: 0, closest: 99 },
      mind: { mode: "fish", spot: null, spotT: 0, calm: 6 + seat * 2 },
    });
  });
  return s;
}

function input(_s: RushSim, _seat: number, raw: unknown): RushInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  if (o.k === "steer") {
    const x = Number(o.x), y = Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { k: "steer", x: Math.round(Math.max(0, Math.min(Q.W, x))), y: Math.round(Math.max(0, Math.min(Q.H, y))) };
  }
  if (o.k === "cast") { const c = Number(o.charge ?? 0); return { k: "cast", charge: Number.isFinite(c) ? Math.round(Math.max(0, Math.min(1, c)) * 100) / 100 : 0 }; }
  if (o.k === "dash") return { k: "dash" };
  if (o.k === "buy" && UPGRADES.includes(o.up as Upgrade)) return { k: "buy", up: o.up as Upgrade };
  return null;
}

function apply(s: RushSim, seat: number, inp: RushInput, ev: GameEvent[]): void {
  const b = s.boats[seat];
  if (!b) return;
  if (inp.k === "steer") { b.tx = inp.x; b.ty = inp.y; }
  if (inp.k === "cast" && b.castCd <= 0 && b.stun <= 0) {
    b.castCd = Q.CAST_CD; b.stats.casts++;
    if (b.hold.length >= holdMax(b)) { b.stats.fullCasts++; ev.push({ k: "catch", seat, n: 0, fry: 0, koi: false, full: 1, x: b.x, y: b.y }); return; }
    const r = netR(b, inp.charge), x = b.x + Math.cos(b.h) * Q.NET_AHEAD, y = b.y + Math.sin(b.h) * Q.NET_AHEAD;
    s.nets.push({ id: s.nextId++, seat, x, y, r, closeAt: s.t + Q.SINK + Q.CHARGE_SINK * inp.charge });
    for (const f of s.fish) { const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy); if (d < r * 1.6 && d > r * 0.7) { f.scare = 0.5; f.sx = dx / d; f.sy = dy / d; } }
    ev.push({ k: "cast", seat, x, y, r, charge: inp.charge });
  }
  if (inp.k === "dash" && b.dashCd <= 0 && b.stun <= 0) {
    b.dashT = Q.DASH_S; b.dashCd = Q.DASH_CD;
    if (Math.hypot(b.tx - b.x, b.ty - b.y) < 20) { b.tx = b.x + Math.cos(b.h) * 200; b.ty = b.y + Math.sin(b.h) * 200; }
    ev.push({ k: "dash", seat });
  }
  if (inp.k === "buy") {
    const cost = nextCost(b);
    if (!b.docked || has(b, inp.up) || b.ups.length >= Q.MAX_UPGRADES || b.banked < cost) return;
    b.banked -= cost; b.stats.spent += cost; b.ups.push(inp.up);
    ev.push({ k: "buy", seat, up: inp.up, cost, banked: b.banked });
  }
}

function step(s: RushSim, inputs: { seat: number; i: RushInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.t >= Q.SECONDS) return ev;
  for (const { seat, i } of inputs) apply(s, seat, i, ev);
  moveBoats(s, ev);
  moveFish(s);
  closeNets(s, ev);
  rams(s, ev);
  floatLoose(s, ev);
  koiTick(s, ev);
  s.tick++;
  s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  // the crown: the one boat with the most banked, if nobody shares the lead
  const top = Math.max(...s.boats.map((b) => b.banked));
  const leaders = s.boats.filter((b) => b.banked === top);
  const crown = top > 0 && leaders.length === 1 ? leaders[0].seat : null;
  if (crown !== s.crown) { s.crown = crown; ev.push({ k: "crown", seat: crown }); }
  if (!s.lantern && s.t >= Q.SECONDS - Q.LANTERN_S) { s.lantern = true; ev.push({ k: "lantern" }); }
  if (s.t >= Q.SECONDS) {
    for (const b of s.boats) { b.stats.lost += holdValue(b); if (b.tripValue > 0) { b.stats.trips++; b.stats.bestTrip = Math.max(b.stats.bestTrip, b.tripValue); b.tripValue = 0; } }
    ev.push({ k: "end" });
  }
  return ev;
}

function moveBoats(s: RushSim, ev: GameEvent[]): void {
  const dt = Q.DT;
  for (const b of s.boats) {
    if (b.castCd > 0) b.castCd -= dt;
    if (b.dashCd > 0) b.dashCd -= dt;
    if (b.dashT > 0) b.dashT -= dt;
    if (b.shield > 0) b.shield -= dt;
    if (b.stun > 0) { b.stun -= dt; b.vx *= 0.85; b.vy *= 0.85; }
    else {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      const load = b.hold.length / holdMax(b);
      const v = Q.SPEED * (1 - Q.LOAD_SLOW * load) * (b.dashT > 0 ? Q.DASH_MULT : 1) * (has(b, "fastHull") ? Q.UPGRADES.fastHull.speed! : 1) * (inReeds(b.x, b.y) ? Q.REED_SLOW : 1);
      const want = b.dashT > 0 ? 1 : d > 4 ? Math.min(1, d / 40) : 0;
      const dirx = d > 4 ? dx / d : Math.cos(b.h), diry = d > 4 ? dy / d : Math.sin(b.h);
      const k = Math.min(1, Q.ACCEL * dt * (b.dashT > 0 ? 3 : 1));
      b.vx += (dirx * v * want - b.vx) * k; b.vy += (diry * v * want - b.vy) * k;
      if (inReeds(b.x, b.y)) { const sp = Math.hypot(b.vx, b.vy), cap = v; if (sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; } }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const e = ell(b.x, b.y);
    if (e > 0.965) { const ex = (b.x - Q.W / 2) / Q.RX, ey = (b.y - Q.H / 2) / Q.RY; b.x = Q.W / 2 + (ex / e) * 0.965 * Q.RX; b.y = Q.H / 2 + (ey / e) * 0.965 * Q.RY; b.vx *= 0.5; b.vy *= 0.5; }
    if (Math.hypot(b.vx, b.vy) > 8) b.h = Math.atan2(b.vy, b.vx);
    if (b.dashT > 0) for (const f of s.fish) { const fx = f.x - b.x, fy = f.y - b.y, fd = Math.hypot(fx, fy); if (fd < 40 && fd > 0) { f.scare = 0.4; f.sx = fx / fd; f.sy = fy / fd; } }
    const d = dockOf(b.seat, s.players);
    const wasDocked = b.docked;
    b.docked = Math.hypot(b.x - d.x, b.y - d.y) < Q.DOCK_R;
    if (b.docked && !wasDocked) { b.unloadT = Q.UNLOAD_EVERY; b.tripValue = 0; }
    if (!b.docked && wasDocked && b.tripValue > 0) { b.stats.trips++; b.stats.bestTrip = Math.max(b.stats.bestTrip, b.tripValue); b.tripValue = 0; }
    if (b.docked && b.hold.length) {
      b.unloadT -= dt;
      let v = 0;
      while (b.unloadT <= 0 && b.hold.length) { b.unloadT += Q.UNLOAD_EVERY; v += b.hold.pop()!; }
      if (v) {
        const mult = s.t >= Q.SECONDS - Q.LANTERN_S ? Q.LANTERN_MULT : 1;
        const before = tierOf(b.banked);
        b.banked += v * mult; b.stats.banked += v * mult; b.tripValue += v * mult;
        b.firstScoreAt ??= s.t;
        ev.push({ k: "bank", seat: b.seat, v: v * mult, x2: mult > 1, banked: b.banked, tier: tierOf(b.banked) > before ? tierOf(b.banked) : -1 });
      }
    }
  }
}

function moveFish(s: RushSim): void {
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
        if (d2 > cs * cs || o.adult !== f.adult) continue;
        cx += o.x; cy += o.y; ax += Math.cos(o.h); ay += Math.sin(o.h); n++;
        if (d2 < Q.SEP * Q.SEP) { sepx -= dx; sepy -= dy; }
        if (mate < 0 && f.adult && o.adult && d2 < Q.MATE * Q.MATE && o.cool <= 0) mate = j;
      }
    }
    let tx = Math.cos(f.h), ty = Math.sin(f.h);
    if (n) { tx += 0.012 * (cx / n - f.x) + 0.35 * (ax / n) + 0.05 * sepx; ty += 0.012 * (cy / n - f.y) + 0.35 * (ay / n) + 0.05 * sepy; }
    if (!f.adult) {
      const ex = (f.x - Q.W / 2) / Q.RX, ey = (f.y - Q.H / 2) / Q.RY, e = Math.hypot(ex, ey) || 1;
      if (e < Q.SHALLOW) { tx += (ex / e) * 0.6; ty += (ey / e) * 0.6; }
      if (s.t - f.born >= Q.MATURE_S) f.adult = true;
    }
    // fish in the reeds linger there
    for (const r of Q.REEDS) { const d = Math.hypot(f.x - r.x, f.y - r.y); if (d < r.r * 1.3 && d > r.r * 0.6) { tx += (r.x - f.x) / d * 0.5; ty += (r.y - f.y) / d * 0.5; } }
    if (ell(f.x, f.y) > 0.92) { tx += (Q.W / 2 - f.x) * 0.01; ty += (Q.H / 2 - f.y) * 0.01; }
    if (f.scare > 0) { tx += f.sx * 3; ty += f.sy * 3; f.scare -= dt; }
    const h = Math.atan2(ty, tx) + (s.rng() - 0.5) * 0.5;
    f.h = h;
    const v = (f.adult ? Q.V_ADULT : Q.V_FRY) * (f.scare > 0 ? 2.2 : 1) * (inReeds(f.x, f.y) ? 0.6 : 1);
    f.x += Math.cos(h) * v * dt; f.y += Math.sin(h) * v * dt;
    if (f.cool > 0) f.cool -= dt;
    if (mate >= 0 && f.cool <= 0 && s.rng() < Q.BREED * dt * room) {
      const o = s.fish[mate];
      f.cool = o.cool = Q.COOL;
      for (let k = 0; k < 2; k++) born.push(newFish(s, (f.x + o.x) / 2 + (s.rng() - 0.5) * 10, (f.y + o.y) / 2 + (s.rng() - 0.5) * 10, false));
    }
  }
  for (const b of born) s.fish.push(b);
}

function closeNets(s: RushSim, ev: GameEvent[]): void {
  const still: Net[] = [];
  for (const net of s.nets) {
    if (net.closeAt > s.t + 1e-9) { still.push(net); continue; }
    const b = s.boats[net.seat];
    let room = holdMax(b) - b.hold.length, n = 0, fry = 0, full = 0, koi = false;
    if (s.koi && room > 0 && Math.hypot(s.koi.x - net.x, s.koi.y - net.y) < net.r + 8) { b.hold.push(Q.KOI_VALUE); room--; koi = true; b.stats.koi++; s.koi = null; }
    s.fish = s.fish.filter((f) => {
      const dx = f.x - net.x, dy = f.y - net.y, d = Math.hypot(dx, dy);
      if (d > net.r) {
        // the school scatters: fish near the net bolt away from it
        if (d < net.r * Q.SCATTER_R && d > 0) { f.scare = 0.8; f.sx = dx / d; f.sy = dy / d; }
        return true;
      }
      if (!f.adult) { fry++; return true; }
      if (room <= 0) { full++; return true; }
      room--; n++; b.hold.push(1); return false;
    });
    b.stats.caught += n + (koi ? Q.KOI_VALUE : 0);
    ev.push({ k: "catch", seat: b.seat, n, fry, koi, full, x: net.x, y: net.y });
  }
  s.nets = still;
}

function rams(s: RushSim, ev: GameEvent[]): void {
  for (const a of s.boats) {
    if (a.dashT <= 0) continue;
    for (const v of s.boats) {
      if (v === a || v.shield > 0 || Math.hypot(a.x - v.x, a.y - v.y) > Q.RAM_R) continue;
      if (nearAnyDock(s, v.x, v.y, Q.SAFE_R) || nearAnyDock(s, a.x, a.y, Q.SAFE_R)) continue; // no ram by a dock: nobody can guard a port
      const crowned = s.crown === v.seat;
      const max = Q.RAM_DROP + (has(a, "ironBow") ? Q.UPGRADES.ironBow.dealt! : 0) - (has(v, "ironBow") ? Q.UPGRADES.ironBow.taken! : 0) + (crowned ? Q.CROWN_DROP : 0);
      const k = v.hold.indexOf(Q.KOI_VALUE);
      const drop: number[] = [];
      if (k >= 0 && max > 0) drop.push(...v.hold.splice(k, 1));
      while (drop.length < max && v.hold.length) drop.push(v.hold.pop()!);
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
      ev.push({ k: "ram", a: a.seat, v: v.seat, n: drop.length, koi: k >= 0, crown: crowned, x: v.x, y: v.y });
      break;
    }
  }
  // closest call: how near a loaded boat came to a dash it escaped
  for (const v of s.boats) if (v.hold.length >= 5) for (const a of s.boats) if (a !== v && a.dashT > 0) v.stats.closest = Math.min(v.stats.closest, Math.round(Math.hypot(a.x - v.x, a.y - v.y)));
}

function floatLoose(s: RushSim, ev: GameEvent[]): void {
  const keep: Loose[] = [];
  for (const l of s.loose) {
    l.vx *= 0.92; l.vy *= 0.92; l.x += l.vx * Q.DT; l.y += l.vy * Q.DT;
    if (s.t - l.t > Q.LOOSE_S) { if (l.value === 1) s.fish.push(newFish(s, l.x, l.y, true)); continue; }
    let taken = false;
    if (s.t - l.t > 0.3) for (const b of s.boats) {
      if (b.stun > 0 || b.hold.length >= holdMax(b) || Math.hypot(b.x - l.x, b.y - l.y) > Q.PICK_R) continue;
      b.hold.push(l.value); b.stats.scooped += l.value; taken = true;
      ev.push({ k: "pick", seat: b.seat, v: l.value, x: l.x, y: l.y });
      break;
    }
    if (!taken) keep.push(l);
  }
  s.loose = keep;
}

function koiTick(s: RushSim, ev: GameEvent[]): void {
  if (!s.koi && s.t >= s.nextKoi && s.t < Q.SECONDS - Q.KOI_STOP) {
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

// ---- a bot: only what a person could see, a person's slower hands ----
// It thinks about four times a second (the platform calls it every tick; it
// acts on a share of them). Its memory lives in its boat, so a replay of the
// stored inputs does not need it.
function bot(s: RushSim, seat: number, r: () => number): RushInput[] {
  const b = s.boats[seat], m = b.mind;
  if (s.t >= Q.SECONDS || r() > 0.2) return [];
  const out: RushInput[] = [];
  const d = dockOf(seat, s.players), left = Q.SECONDS - s.t, n = b.hold.length, max = holdMax(b);
  const homeAt = seat % 2 ? 0.7 : 0.9;
  if (n >= max * homeAt || (left < 15 && n > 0) || (s.lantern && n >= 4)) m.mode = "home";
  else if (b.docked && n === 0) m.mode = "fish";
  if (b.docked && b.ups.length < Q.MAX_UPGRADES) {
    const want = (["bigHold", "fastHull", "ironBow", "wideNet"] as Upgrade[]).find((u) => !has(b, u) && b.banked >= nextCost(b) + 4);
    if (want) out.push({ k: "buy", up: want });
  }
  if (m.mode === "home") { out.push({ k: "steer", x: Math.round(d.x), y: Math.round(d.y) }); return out; }
  if (s.koi && n < max && Math.hypot(s.koi.x - b.x, s.koi.y - b.y) < 260) {
    out.push({ k: "steer", x: Math.round(s.koi.x + Math.cos(s.koi.h) * 30), y: Math.round(s.koi.y + Math.sin(s.koi.h) * 30) });
    if (Math.hypot(s.koi.x - b.x, s.koi.y - b.y) < 70 && b.castCd <= 0) out.push({ k: "cast", charge: 0.5 });
    return out;
  }
  if (b.dashCd <= 0 && s.t > m.calm) {
    const prey = s.boats.filter((o) => o !== b && o.shield <= 0 && !o.docked && o.hold.length >= 5 && Math.hypot(o.x - b.x, o.y - b.y) < 200)
      .sort((p, q) => (q.seat === s.crown ? 1 : 0) - (p.seat === s.crown ? 1 : 0) || q.hold.length - p.hold.length)[0];
    if (prey) {
      out.push({ k: "steer", x: Math.round(prey.x + prey.vx * 0.3), y: Math.round(prey.y + prey.vy * 0.3) });
      if (Math.hypot(prey.x - b.x, prey.y - b.y) < 90) { out.push({ k: "dash" }); m.calm = s.t + 12 + r() * 8; }
      return out;
    }
  }
  const near = s.loose.filter((l) => Math.hypot(l.x - b.x, l.y - b.y) < 160)[0];
  if (near && n < max) { out.push({ k: "steer", x: Math.round(near.x), y: Math.round(near.y) }); return out; }
  if (!m.spot || s.t > m.spotT || Math.hypot(m.spot[0] - b.x, m.spot[1] - b.y) < 25) {
    let best: { x: number; y: number; c: number } | null = null;
    const adults = s.fish.filter((f) => f.adult);
    for (let k = 0; k < 8 && adults.length; k++) {
      const f = adults[Math.floor(r() * adults.length)];
      let c = 0; for (const o of adults) if ((o.x - f.x) ** 2 + (o.y - f.y) ** 2 < 40 * 40) c++;
      if (!best || c > best.c) best = { x: f.x, y: f.y, c };
    }
    m.spot = best ? [best.x + (r() - 0.5) * 40, best.y + (r() - 0.5) * 40] : [Q.W / 2, Q.H / 2];
    m.spotT = s.t + 3;
  }
  out.push({ k: "steer", x: Math.round(m.spot[0]), y: Math.round(m.spot[1]) });
  const ax = b.x + Math.cos(b.h) * Q.NET_AHEAD, ay = b.y + Math.sin(b.h) * Q.NET_AHEAD;
  if (b.castCd <= 0) {
    let c = 0; for (const f of s.fish) if (f.adult && (f.x - ax) ** 2 + (f.y - ay) ** 2 < Q.NET_R * Q.NET_R) c++;
    if (c >= 2) out.push({ k: "cast", charge: c >= 5 ? 1 : 0 });
  }
  return out;
}

// ---- what a browser is sent (the same for every seat: no secrets) ----
const FLAG = { DASH: 1, STUN: 2, SHIELD: 4, DOCKED: 8, KOI: 16, REEDS: 32 } as const;
function frameFor(s: RushSim, _seat: number) {
  return {
    t: s.t, left: Math.max(0, Q.SECONDS - s.t), fishN: s.fish.length, crown: s.crown, lantern: s.lantern, players: s.players,
    // seat, x, y, h*100, holdN, holdMax, flags, banked, castCd*10, dashCd*10, ups, tx, ty, next upgrade's price (null when done)
    b: s.boats.map((b) => [b.seat, Math.round(b.x), Math.round(b.y), Math.round(b.h * 100), b.hold.length, holdMax(b),
      (b.dashT > 0 ? FLAG.DASH : 0) | (b.stun > 0 ? FLAG.STUN : 0) | (b.shield > 0 ? FLAG.SHIELD : 0) | (b.docked ? FLAG.DOCKED : 0) | (b.hold.includes(Q.KOI_VALUE) ? FLAG.KOI : 0) | (inReeds(b.x, b.y) ? FLAG.REEDS : 0),
      b.banked, Math.max(0, Math.ceil(b.castCd * 10)), Math.max(0, Math.ceil(b.dashCd * 10)), b.ups, Math.round(b.tx), Math.round(b.ty), b.ups.length >= Q.MAX_UPGRADES ? null : nextCost(b)]),
    f: s.fish.map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.h * 100), f.adult ? 1 : 0]),
    n: s.nets.map((n) => [n.seat, Math.round(n.x), Math.round(n.y), Math.round(n.r), Math.round((n.closeAt - s.t) * 1000)]),
    l: s.loose.map((l) => [l.id, Math.round(l.x), Math.round(l.y), l.value]),
    k: s.koi ? [Math.round(s.koi.x), Math.round(s.koi.y), Math.round(s.koi.h * 100)] : null,
  };
}

function results(s: RushSim): Results {
  const order = s.boats.map((b) => b.banked);
  const seats = s.boats.map((b) => ({
    seat: b.seat, score: b.banked, place: 1 + order.filter((v) => v > b.banked).length, firstScoreS: b.firstScoreAt,
    trips: b.stats.trips, bestTrip: b.stats.bestTrip, lost: b.stats.lost, scooped: b.stats.scooped, rams: b.stats.rams, ups: b.ups,
  }));
  const best = [...s.boats].sort((a, b) => b.stats.bestTrip - a.stats.bestTrip)[0];
  const loss = [...s.boats].sort((a, b) => b.stats.lost - a.stats.lost)[0];
  const close = [...s.boats].sort((a, b) => a.stats.closest - b.stats.closest)[0];
  const highlights: Highlight[] = [
    { title: "Best trip", text: best.stats.bestTrip ? `{name}: ${best.stats.bestTrip} fish home at once` : "nobody got a trip home", seat: best.seat, tkey: "hl_rush_best_t", key: best.stats.bestTrip ? "hl_rush_best" : "hl_rush_best_none", vars: { n: best.stats.bestTrip } },
    { title: "Biggest loss", text: loss.stats.lost ? `{name}: lost ${loss.stats.lost} (rams and the horn)` : "nobody lost a fish", seat: loss.seat, tkey: "hl_rush_loss_t", key: loss.stats.lost ? "hl_rush_loss" : "hl_rush_loss_none", vars: { n: loss.stats.lost } },
    { title: "Closest call", text: close.stats.closest < 99 ? `{name}: a dash came within ${close.stats.closest} with a loaded hold` : "nobody was chased", seat: close.seat, tkey: "hl_rush_close_t", key: close.stats.closest < 99 ? "hl_rush_close" : "hl_rush_close_none", vars: { n: close.stats.closest } },
  ];
  return { seats, lakeLeft: s.fish.length + s.loose.filter((l) => l.value === 1).length, highlights };
}

export const rush: Mode<RushSim, RushInput> = {
  id: "rush", model: "rush 1.0", seats: Q.SEATS, breeds: false,
  make, input, step, frameFor, over: (s) => s.t >= Q.SECONDS, results, bot,
};
