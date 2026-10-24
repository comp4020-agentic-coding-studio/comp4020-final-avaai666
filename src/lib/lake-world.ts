// The lake every /play mode shares (DESIGN.md v5.0, "The world (shared)"):
// its outline, the island, the named places, the docks, K, breeding, the
// tiers and what a room stores for next spring. One module, so that no mode
// and no page keeps its own copy of these numbers; the page gets them in its
// boot JSON (see worldForPage). Pure: no clock, no randomness.
//
// Compass: x is east, y is south (towards the village). An angle a puts a
// point at (cos a, sin a): 0 east, 90 south, 180 west, 270 north. The server
// calls the south axis y everywhere; the prototype called it z.

// Rule change 8 (Ava, 24 Oct): the prototype's lake (92 by 64) was too big for
// 28-45 s rounds. Rule change 10 put it on one screen at 0.5 for four boats,
// and rule change 11 (Ava, 24 Oct: "decide the lake's size by how many
// people play") gives each match a lake for its boats: the same water for
// each boat, so its area grows with the number of boats and its size with the
// square root (lakeScale). Every place on it scales with it; speeds, nets and
// the fish count do not. A mode's make() gets the number of boats from the
// room (lake.boats); without it (a test, a script) it is the four-boat lake,
// whose numbers are this module's own exports below.
export const K = 340; // what a full lake holds; every game's year is judged against it
export const A0 = 230; // a new room starts with this many adults...
export const Y0 = 50; // ...and this many young fish
export const ALLEE = 36; // below this many adults, fish rarely find each other
export const BREED_R = 1.55;
export const ICE_K = 0.86; // winter ice beyond this share of the way to the shore...
export const FLOOR_FISH = 18; // a house gains a floor for every 18 fish brought home...
export const MAX_FLOORS = 6; // ...up to six
export const REED_SLOW = 0.62;
export const BASE_BOATS = 4; // the lake a match gets when nobody says how many boats it has
export const lakeScale = (boats: number): number => Math.round(0.5 * Math.sqrt(Math.max(2, Math.min(8, boats)) / BASE_BOATS) * 1000) / 1000;

const deg = (d: number): number => (d * Math.PI) / 180;
// the radius of the shore at angle a (radians), as a share of the lake's half-width and half-height: a lobed oval
export const shapeR = (a: number): number => 1 + 0.09 * Math.sin(2 * a + 0.6) + 0.06 * Math.sin(3 * a + 2.1) + 0.035 * Math.sin(5 * a + 0.3);

export type PlaceId = "reeds" | "lotus" | "river" | "island" | "north" | "east" | "south" | "west";
export interface Zone { a: number; k: number; r: number; x: number; y: number }
export interface DockPos { x: number; y: number; inward: number; a: number }
type Bay = { id: "north" | "east" | "south" | "west"; x: number; y: number };
// the places, at the prototype's angles and shares of the way to the shore (radius in prototype units)
const ZONE_AT = { reeds: [195, 0.78, 19], lotus: [237, 0.7, 16], river: [318, 0.86, 15] } as const;

// Where the homes are (rule change 11, Ava: "spread everyone round the lake"): n docks at equal angles
// from due south, each moved by the least it takes (in 3-degree steps) to keep clear of the reeds, the
// lotus pond and the river mouth. The same angles for every size of lake, as the lake keeps its shape.
export function dockAngles(n: number): number[] {
  n = Math.max(1, Math.min(8, Math.round(n)));
  const L = makeGeometry(1), clearOf = (a: number) => { const [x, y] = L.shape(a, 1); return Object.values(L.zones).every((z) => Math.hypot(x - z.x, y - z.y) > z.r + 6); };
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const want = 90 + (i * 360) / n;
    let got = want;
    for (let d = 0; d <= 60; d += 3) { if (clearOf(want + d) && out.every((o) => Math.abs(((want + d - o + 540) % 360) - 180) > 20)) { got = want + d; break; } if (clearOf(want - d) && out.every((o) => Math.abs(((want - d - o + 540) % 360) - 180) > 20)) { got = want - d; break; } }
    out.push(((got % 360) + 360) % 360);
  }
  return out;
}

// the lake's shape and places at scale S (the prototype's 92 x 64 lake times S)
function makeGeometry(S: number) {
  const X = 92 * S, Y = 64 * S;
  const angOf = (x: number, y: number): number => Math.atan2(y / Y, x / X);
  const nr = (x: number, y: number): number => Math.hypot(x / X, y / Y) / shapeR(angOf(x, y));
  const shape = (aDeg: number, k: number): [number, number] => { const a = deg(aDeg), r = shapeR(Math.atan2(Math.sin(a), Math.cos(a))) * k; return [Math.cos(a) * X * r, Math.sin(a) * Y * r]; };
  const zone = ([a, k, r]: readonly [number, number, number]): Zone => { const [x, y] = shape(a, k); return { a, k, r: r * S, x, y }; };
  const zones = { reeds: zone(ZONE_AT.reeds), lotus: zone(ZONE_AT.lotus), river: zone(ZONE_AT.river) };
  return { X, Y, nr, shape, zones };
}

export interface Lake {
  boats: number; scale: number; k: number; // k: this lake's size against the four-boat lake (1 for four boats)
  x: number; y: number; island: { x: number; y: number; r: number }; deep: { x: number; y: number; r: number };
  zones: { reeds: Zone; lotus: Zone; river: Zone }; bays: Bay[]; iceDockOpen: number; docks: DockPos[];
  nr(x: number, y: number): number; shape(aDeg: number, k: number): [number, number];
  placeOf(x: number, y: number): PlaceId; dockPos(seat: number): DockPos;
  iceBlocks(x: number, y: number, season: number): boolean; blockedAt(x: number, y: number, season: number): boolean;
  outline(k?: number, n?: number): [number, number][];
  // what a frame carries so the page can draw this lake: its scale and its docks
  meta(): { s: number; k: number; docks: [number, number, number][] };
}
const lakes = new Map<number, Lake>();
export function makeLake(boats: number = BASE_BOATS): Lake {
  const n = Math.max(2, Math.min(8, Math.round(boats)));
  const hit = lakes.get(n); if (hit) return hit;
  const S = lakeScale(n), g = makeGeometry(S);
  const island = { x: 10 * S, y: -15 * S, r: 7.5 * S };
  const bays: Bay[] = ([{ id: "north", x: -14, y: -44 }, { id: "east", x: 58, y: -4 }, { id: "south", x: 4, y: 34 }, { id: "west", x: -60, y: 6 }] as Bay[]).map((b) => ({ ...b, x: b.x * S, y: b.y * S }));
  const docks = dockAngles(n).map((a): DockPos => { const [x, y] = g.shape(a, 1.0); return { x, y, inward: Math.atan2(-y, -x), a }; });
  const iceDockOpen = 14 * S;
  const iceBlocks = (x: number, y: number, season: number): boolean => season === 3 && g.nr(x, y) > ICE_K && !docks.some((d) => Math.hypot(d.x - x, d.y - y) < iceDockOpen);
  const L: Lake = {
    boats: n, scale: S, k: S / lakeScale(BASE_BOATS), x: g.X, y: g.Y, island, deep: { x: island.x, y: island.y, r: 22 * S }, zones: g.zones, bays, iceDockOpen, docks,
    nr: g.nr, shape: g.shape,
    placeOf(x, y) {
      for (const id of ["reeds", "lotus", "river"] as const) { const z = g.zones[id]; if (Math.hypot(x - z.x, y - z.y) < z.r) return id; }
      if (Math.hypot(x - island.x, y - island.y) < 20 * S) return "island";
      let best: PlaceId = "south", bd = Infinity;
      for (const b of bays) { const d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = b.id; } }
      return best;
    },
    dockPos: (seat) => docks[((seat % docks.length) + docks.length) % docks.length],
    iceBlocks,
    blockedAt: (x, y, season) => Math.hypot(x - island.x, y - island.y) < island.r || iceBlocks(x, y, season),
    outline(k = 1, m = 180) { const pts: [number, number][] = []; for (let i = 0; i < m; i++) { const a = (i / m) * Math.PI * 2; pts.push([Math.cos(a) * g.X * shapeR(a) * k, Math.sin(a) * g.Y * shapeR(a) * k]); } return pts; },
    meta: () => ({ s: S, k: S / lakeScale(BASE_BOATS), docks: docks.map((d) => [Math.round(d.x * 100) / 100, Math.round(d.y * 100) / 100, Math.round(d.a * 10) / 10] as [number, number, number]) }),
  };
  lakes.set(n, L);
  return L;
}

// the four-boat lake, as plain exports (what a test or a script without a room uses)
const L4 = makeLake(BASE_BOATS);
export const WORLD_SCALE = L4.scale;
export const LAKE_X = L4.x;
export const LAKE_Y = L4.y;
export const ISLAND = L4.island;
export const ICE_DOCK_OPEN = L4.iceDockOpen;
export const DOCK_ANGLES = L4.docks.map((d) => d.a);
export const nr = L4.nr;
export const shape = L4.shape;
export const ZONES = L4.zones;
export const DEEP = L4.deep;
export const BAYS = L4.bays;
export const placeOf = (x: number, y: number): PlaceId => L4.placeOf(x, y);
// seat -> its dock on the four-boat lake (a match's own lake: lake.dockPos(seat))
export const dockPos = (seat: number, _players?: number): DockPos => L4.dockPos(seat);
export const iceBlocks = (x: number, y: number, season: number): boolean => L4.iceBlocks(x, y, season);
export const blockedAt = (x: number, y: number, season: number): boolean => L4.blockedAt(x, y, season);

// ---- breeding and the tiers ----
// The young grow up, and the adults breed: logistic, with too few to find each
// other below ALLEE. `bonus` is Fish Ladder's 0.15 each.
export function breed(adults: number, young: number, bonus = 0): { adults: number; born: number } {
  const a = adults + young;
  const born = adults < ALLEE ? Math.round(adults * 0.1) : Math.round(BREED_R * adults * Math.max(0, 1 - a / K) * (1 + bonus));
  return { adults: a, born };
}
// next spring: adults + young + 0.6 of those born (plus reed-bed fish)
export function forecast(adults: number, young: number, bonus = 0, extra = 0): number {
  const r = breed(adults, young, bonus);
  return r.adults + Math.round((r.born + extra) * 0.6);
}
export const TIERS = [[0.6, "rich", 1.2], [0.35, "fair", 1], [0.15, "lean", 0.8], [0, "none", 0.5]] as const;
export type TierId = (typeof TIERS)[number][1];
// A tier is judged on whole fish against min x K, not on a ratio: 119 / 340 is
// 0.35 only to within a float, and 0.35 x 340 is 118.99999999999999.
export function tierOf(next: number): { id: TierId; mult: number } {
  for (const [min, id, mult] of TIERS) if (next >= Math.round(min * K * 1e6) / 1e6 - 1e-9) return { id, mult };
  return { id: "none", mult: 0.5 };
}
// what a room stores for next spring
export function adultsYoungFromNext(next: number): { adults: number; young: number } {
  return { adults: Math.min(K, Math.round(next * 0.8)), young: Math.round(next * 0.2) };
}
// every mode writes next spring this way: split what it left 0.8/0.2 into
// adults and young, breed once, cap at K. There is no separate regrowth
// between matches (a match that already breeds in its own year, as Boat
// Rush's seasons do, must not pass its result through this twice).
export function nextSpring(left: number): number {
  return Math.min(K, forecast(Math.round(left * 0.8), Math.round(left * 0.2)));
}
// the other way: what a stored lake is worth as a count
export const lakeTotal = (adults: number, young: number): number => adults + young;

// the shore, sampled at n points right round the lake, at k of the way out
// (k=1 the shore itself); the client draws from these points, not shapeR()
export const outline = (k = 1, n = 180): [number, number][] => L4.outline(k, n);

// what the page needs, sent in its boot JSON; the client keeps no copy. It is the four-boat lake; each
// frame says which lake its match has (lake.meta()), and the page scales its scene to that one.
export function worldForPage() {
  return {
    lake: { x: LAKE_X, y: LAKE_Y }, scale: WORLD_SCALE, island: ISLAND, k: K, a0: A0, y0: Y0, allee: ALLEE, breedR: BREED_R, iceK: ICE_K, iceDockOpen: ICE_DOCK_OPEN, reedSlow: REED_SLOW,
    dockAngles: DOCK_ANGLES, floorFish: FLOOR_FISH, maxFloors: MAX_FLOORS, tiers: TIERS,
    zones: { reeds: ZONES.reeds, lotus: ZONES.lotus, river: ZONES.river, deep: DEEP }, bays: BAYS,
    outline: outline(1, 180), outlineBank: outline(1.075, 180),
  };
}
