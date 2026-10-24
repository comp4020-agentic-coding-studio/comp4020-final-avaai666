// The fish of the v5 lake (DESIGN.md "The world (shared)"), shared by the
// modes rebuilt on it: 16 schools (12 adult, 4 nursery in the reed bed) that
// drift to each season's places, and fish that keep a small offset from
// their school's centre. Moved here unchanged from rush.ts (rush 2.0) so
// Who's Poaching 2.0 uses the very same lake; every draw still comes from
// the caller's own s.rng, in the same order, so a rush replay is unchanged.
import { LIFE as L } from "../game-constants.ts";
import { ICE_K, type Lake } from "../lake-world.ts";

// sp: one bit per seat whose net already let this young fish go, so a
// young fish is "spared" once per boat however many casts land on it
export interface Fish { id: number; x: number; y: number; h: number; adult: boolean; scare: number; sx: number; sy: number; big: boolean; school: number; ox: number; oy: number; ph: number; sp?: number }
// 16 schools (DESIGN.md's season twists, practice step 2 "net the school
// ahead of your bow", prompt-17 step 4's "spring and summer school pulls"):
// 12 adult schools drift to that season's places (river, reeds, lotus, the
// deep water, or open water), 4 nursery schools stay in the reed bed. Each
// fish keeps a small offset (ox, oy) from its school's centre, so a cast
// into a school's centre reliably nets several fish at once — the actual
// mechanic DESIGN's wording and the prototype (docs/prototypes/v10/fish.js)
// assume, which this port's from-scratch flocking model never had.
export interface School { x: number; y: number; tx: number; ty: number; vx: number; vy: number; t: number; nursery: boolean }

// what a mode's state needs for its lake: its own random stream, its clock
// (fish sway on it), the season (places and ice), and its fish and schools
export interface Life { rng: () => number; t: number; season: number; schools: School[]; fish: Fish[]; nextId: number; lake: Lake }

export const NURSERY_FIRST = 12; // schools 0-11 are adult schools, 12-15 nursery
// a target for school `i`: nursery schools stay in the reed bed; adult
// schools drift to this season's places, the same weighted choice as the
// prototype's schoolTarget() (docs/prototypes/v10/fish.js), all through
// s.rng so a replay stays exact. Winter never targets the open-water bands
// beyond nr 0.78 of the shore, which keeps schools off the ice band (nr >
// ICE_K = 0.86) without a direct iceBlocks() check, same as the prototype.
export function nearZone(s: Life, zone: { x: number; y: number; r: number }, spread: number): [number, number] {
  for (let k = 0; k < 40; k++) {
    const a = s.rng() * Math.PI * 2, d = Math.sqrt(s.rng()) * zone.r * spread;
    const x = zone.x + Math.cos(a) * d, y = zone.y + Math.sin(a) * d;
    if (s.lake.nr(x, y) < 0.93 && Math.hypot(x - s.lake.island.x, y - s.lake.island.y) > s.lake.island.r + 2.5 && !s.lake.iceBlocks(x, y, s.season)) return [x, y];
  }
  return randomWater(s, 0.82);
}
export function randomWater(s: Life, maxK: number): [number, number] {
  for (let k = 0; k < 60; k++) {
    const x = (s.rng() * 2 - 1) * s.lake.x, y = (s.rng() * 2 - 1) * s.lake.y;
    if (s.lake.nr(x, y) < maxK && Math.hypot(x - s.lake.island.x, y - s.lake.island.y) > s.lake.island.r + 3.5) return [x, y];
  }
  return [0, 20 * s.lake.scale];
}
// season -> [[placeId|null, weight], ...], a weighted pick (null: open water)
const SEASON_PULL: [("river" | "reeds" | "lotus" | "deep" | null), number][][] = [
  [["river", 0.35], ["reeds", 0.15], [null, 0.5]],
  [["lotus", 0.35], ["deep", 0.25], [null, 0.4]],
  [[null, 0.75], ["deep", 0.25]],
  [["deep", 0.7], [null, 0.3]],
];
export function schoolTarget(s: Life, school: School): [number, number] {
  if (school.nursery) return nearZone(s, s.lake.zones.reeds, 0.8);
  let r = s.rng();
  for (const [id, w] of SEASON_PULL[s.season]) {
    r -= w;
    if (r > 0) continue;
    if (id === null) return randomWater(s, s.season === 3 ? 0.78 : 0.84);
    if (id === "deep") { const a = s.rng() * Math.PI * 2, d = s.lake.island.r + 6.5 + s.rng() * Math.max(2, s.lake.deep.r - s.lake.island.r - 6.5); return [s.lake.deep.x + Math.cos(a) * d, s.lake.deep.y + Math.sin(a) * d]; }
    return nearZone(s, s.lake.zones[id], 0.9);
  }
  return randomWater(s, 0.84);
}
// `carry`: bring each school's fish along to its new place. A new season moves every school to that
// season's places (DESIGN.md's twists: "spring: schools gather at the river mouth and the reeds"), and
// the lake stands still in between (the gong, the rest and the market), so a fish left where the old
// season ended would be up to 54 units from its school when play resumes and would then close that gap
// at 8% a tick: 4.8 units in the first tick, twenty times a fish's top speed, with the whole lake
// streaking across the water for the first seconds of every season (Ava, 25 Oct: "the fish flicker").
// Carried, they are already at the season's places when it opens, which is what the twists promise.
export function placeSchools(s: Life, carry = false): void {
  const was = carry ? s.schools.map((sc) => ({ x: sc.x, y: sc.y })) : null;
  s.schools = Array.from({ length: 16 }, (_, i): School => ({ x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, t: 0, nursery: i >= NURSERY_FIRST }));
  for (const school of s.schools) {
    const [x, y] = schoolTarget(s, school);
    school.x = x; school.y = y;
    const [tx, ty] = schoolTarget(s, school);
    school.tx = tx; school.ty = ty;
    school.t = 3 + s.rng() * 6;
  }
  if (!was) return;
  for (const f of s.fish) {
    const from = was[f.school], to = s.schools[f.school];
    if (!from || !to) continue;
    const x = f.x + (to.x - from.x), y = f.y + (to.y - from.y);
    const ok = !s.lake.blockedAt(x, y, s.season) && s.lake.nr(x, y) < 0.95;
    f.x = ok ? x : to.x + f.ox; f.y = ok ? y : to.y + f.oy;
  }
}
// a new fish joins a school (an adult one, or a nursery one if it's young),
// with a small fixed offset from its centre so the school stays a cluster
export function newFish(s: Life, x: number | null, y: number | null, adult: boolean, school?: number): Fish {
  const sc = school ?? (adult ? Math.floor(s.rng() * NURSERY_FIRST) : NURSERY_FIRST + Math.floor(s.rng() * (16 - NURSERY_FIRST)));
  const ox = (s.rng() * 2 - 1) * 4, oy = (s.rng() * 2 - 1) * 4;
  let fx = x, fy = y;
  if (fx === null || fy === null) { fx = s.schools[sc].x + ox; fy = s.schools[sc].y + oy; }
  return { id: s.nextId++, x: fx, y: fy, h: s.rng() * Math.PI * 2, adult, scare: 0, sx: 0, sy: 0, big: adult && s.rng() < L.BIG_SHARE, school: sc, ox, oy, ph: s.rng() * Math.PI * 2 };
}
export function seedFish(s: Life, adults: number, young: number): void {
  placeSchools(s);
  for (let i = 0; i < adults; i++) s.fish.push(newFish(s, null, null, true));
  for (let i = 0; i < young; i++) s.fish.push(newFish(s, null, null, false));
}
export const counts = (s: Life): [number, number] => { let a = 0, y = 0; for (const f of s.fish) f.adult ? a++ : y++; return [a, y]; };


// a school drifts toward its target, retargeting when it arrives or its
// patience runs out (the prototype's updateFish(), schools loop)
export function updateSchools(s: Life): void {
  const dt = L.DT;
  for (const school of s.schools) {
    if (Math.hypot(school.tx - school.x, school.ty - school.y) < 3 || school.t <= 0) {
      const [tx, ty] = schoolTarget(s, school);
      school.tx = tx; school.ty = ty; school.t = 6 + s.rng() * 8;
    }
    school.t -= dt;
    const d = Math.hypot(school.tx - school.x, school.ty - school.y) || 1, sp = school.nursery ? 1.6 : 2.6;
    school.vx += ((school.tx - school.x) / d * sp - school.vx) * dt;
    school.vy += ((school.ty - school.y) / d * sp - school.vy) * dt;
    school.x += school.vx * dt; school.y += school.vy * dt;
    // a school keeps far enough off the island that none of its fish (each within ~5.7 of the centre) is pushed onto it
    const clear = s.lake.island.r + 6;
    if (Math.hypot(school.x - s.lake.island.x, school.y - s.lake.island.y) < clear) {
      const a = Math.atan2(school.y - s.lake.island.y, school.x - s.lake.island.x);
      school.x = s.lake.island.x + Math.cos(a) * clear; school.y = s.lake.island.y + Math.sin(a) * clear;
    }
    // in winter a school never sits in the ice: one that was out there when it froze slides back to its edge
    if (s.lake.iceBlocks(school.x, school.y, s.season)) { const k = (ICE_K * 0.99) / s.lake.nr(school.x, school.y); school.x *= k; school.y *= k; }
  }
}
// a grid cell key that never collides: lake coordinates are bounded (+/- LAKE_X,
// +/- LAKE_Y), so an offset well past that bound keeps every (gx, gy) pair
// unique (rush 1.0's `gx*1000+gy` relied on coordinates always being
// positive; this lake's are not, so that scheme silently collided two
// distant cells into one bucket and made every fish check every other).
const GRID_OFFSET = 1000;
// each fish follows its school's centre plus a small rotating offset (the
// prototype's updateFish() fish loop), so a school stays a tight, catchable
// cluster; separation inside a school keeps individual fish from stacking
// exactly on top of each other, and scare/reeds/ice still apply on top.
// DESIGN.md and the prototype breed only at the rest (breedLake(), in
// endSeason()), and young fish grow up only there too (for (const f of
// s.fish) f.adult = true). This used to also pair adults mid-season
// (MATE, BREED_CHANCE, COOL) and mature young after MATURE_S — a rush 1.0
// leftover the port never dropped, which the prototype's own first-gong
// young count (exactly the starting 50, no more) rules out. No in-season
// population change now except a catch leaving the lake.
export function moveFish(s: Life): void {
  const cs = L.SEP * 3, grid = new Map<number, number[]>();
  const cellKey = (gx: number, gy: number): number => (gx + GRID_OFFSET) * 100000 + (gy + GRID_OFFSET);
  s.fish.forEach((f, i) => { const k = cellKey((f.x / cs) | 0, (f.y / cs) | 0); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i); });
  const N = s.fish.length;
  for (let i = 0; i < N; i++) {
    const f = s.fish[i];
    const school = s.schools[f.school];
    const a = s.t * 0.35 + f.ph;
    let tx = school.x + f.ox * Math.cos(a) - f.oy * Math.sin(a) * 0.6;
    let ty = school.y + f.ox * Math.sin(a) * 0.6 + f.oy * Math.cos(a);
    let sepx = 0, sepy = 0;
    const gx = (f.x / cs) | 0, gy = (f.y / cs) | 0;
    for (let a2 = gx - 1; a2 <= gx + 1; a2++) for (let c = gy - 1; c <= gy + 1; c++) {
      const cell = grid.get(cellKey(a2, c)); if (!cell) continue;
      for (const j of cell) {
        if (j === i) continue;
        const o = s.fish[j], dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
        if (d2 > L.SEP * L.SEP || o.adult !== f.adult) continue;
        sepx -= dx; sepy -= dy;
      }
    }
    let dx = tx - f.x, dy = ty - f.y;
    if (!f.adult && s.lake.nr(f.x, f.y) < L.SHALLOW) { dx += (f.x / s.lake.x) * 10; dy += (f.y / s.lake.y) * 10; }
    const inReeds = Math.hypot(f.x - s.lake.zones.reeds.x, f.y - s.lake.zones.reeds.y) < s.lake.zones.reeds.r;
    if (f.scare > 0) { dx += f.sx * 6; dy += f.sy * 6; f.scare -= L.DT; }
    const followSpeed = Math.min(1, L.DT * 1.6);
    let nx = f.x + (dx + sepx * 0.5) * followSpeed, ny = f.y + (dy + sepy * 0.5) * followSpeed;
    if (f.scare > 0) { const v = (f.adult ? L.V_ADULT : L.V_FRY) * 2.2 * (inReeds ? 0.6 : 1); nx = f.x + f.sx * v * L.DT; ny = f.y + f.sy * v * L.DT; }
    // a fish never moves faster than it swims. The follow above closes 8% of the gap to its school every
    // tick, which is gentle for the 1-2 units a fish usually trails by, but a fish a net has scared 20 units
    // away came back at 40 units a second, ten times its own speed, and the page showed it flicking across
    // the water (Ava, 25 Oct: "the fish flicker"). The flee branch already moves at exactly this speed.
    const vmax = (f.adult ? L.V_ADULT : L.V_FRY) * (f.scare > 0 ? 2.2 : 1) * L.DT;
    const mx = nx - f.x, my = ny - f.y, m = Math.hypot(mx, my);
    if (m > vmax) { nx = f.x + (mx / m) * vmax; ny = f.y + (my / m) * vmax; }
    if (s.lake.blockedAt(nx, ny, s.season)) { nx = f.x; ny = f.y; }
    if (Math.abs(nx - f.x) + Math.abs(ny - f.y) > 0.02) { const nh = Math.atan2(ny - f.y, nx - f.x); f.h += Math.atan2(Math.sin(nh - f.h), Math.cos(nh - f.h)) * Math.min(1, L.DT * 5); }
    f.x = nx; f.y = ny;
  }
}

