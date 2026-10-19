// The lake every /play mode shares (DESIGN.md v5.0, "The world (shared)"):
// its outline, the island, the named places, the docks, K, breeding, the
// tiers and what a room stores for next spring. One module, so that no mode
// and no page keeps its own copy of these numbers; the page gets them in its
// boot JSON (see worldForPage). Pure: no clock, no randomness.
//
// Compass: x is east, y is south (towards the village). An angle a puts a
// point at (cos a, sin a): 0 east, 90 south, 180 west, 270 north. The server
// calls the south axis y everywhere; the prototype called it z.

export const LAKE_X = 92;
export const LAKE_Y = 64;
export const K = 340; // what a full lake holds; every game's year is judged against it
export const A0 = 230; // a new room starts with this many adults...
export const Y0 = 50; // ...and this many young fish
export const ALLEE = 36; // below this many adults, fish rarely find each other
export const BREED_R = 1.55;
export const ISLAND = { x: 10, y: -15, r: 7.5 } as const;
export const ICE_K = 0.86; // winter ice beyond this share of the way to the shore...
export const ICE_DOCK_OPEN = 14; // ...except within this many units of a dock
export const DOCK_ANGLES = [66, 114, 42, 138, 90, 18] as const; // up to six docks on the south shore
export const FLOOR_FISH = 18; // a house gains a floor for every 18 fish brought home...
export const MAX_FLOORS = 6; // ...up to six

const deg = (d: number): number => (d * Math.PI) / 180;

// the radius of the shore at angle a (radians): a lobed oval
export const shapeR = (a: number): number => 1 + 0.09 * Math.sin(2 * a + 0.6) + 0.06 * Math.sin(3 * a + 2.1) + 0.035 * Math.sin(5 * a + 0.3);
const angOf = (x: number, y: number): number => Math.atan2(y / LAKE_Y, x / LAKE_X);
// 0 in the middle of the lake, 1 on the shore
export const nr = (x: number, y: number): number => Math.hypot(x / LAKE_X, y / LAKE_Y) / shapeR(angOf(x, y));
// the point at angle aDeg (degrees) and k of the way to the shore
export function shape(aDeg: number, k: number): [number, number] {
  const a = deg(aDeg), r = shapeR(Math.atan2(Math.sin(a), Math.cos(a))) * k;
  return [Math.cos(a) * LAKE_X * r, Math.sin(a) * LAKE_Y * r];
}

// ---- the named places ----
export type PlaceId = "reeds" | "lotus" | "river" | "island" | "north" | "east" | "south" | "west";
interface Zone { a: number; k: number; r: number; x: number; y: number }
const zone = (a: number, k: number, r: number): Zone => { const [x, y] = shape(a, k); return { a, k, r, x, y }; };
export const ZONES = {
  reeds: zone(195, 0.78, 19), // 芦苇荡: the nursery, where young fish live; boats move at 0.62 speed there
  lotus: zone(237, 0.7, 16), // 荷花塘
  river: zone(318, 0.86, 15), // 河口: with a stone bridge
} as const;
export const DEEP = { x: ISLAND.x, y: ISLAND.y, r: 22 } as const; // 深潭, the deep water round the island
export const REED_SLOW = 0.62;
export const BAYS: { id: "north" | "east" | "south" | "west"; x: number; y: number }[] = [
  { id: "north", x: -14, y: -44 }, { id: "east", x: 58, y: -4 }, { id: "south", x: 4, y: 34 }, { id: "west", x: -60, y: 6 },
];

// the named place a point is in (what meeting phrases and task labels use)
export function placeOf(x: number, y: number): PlaceId {
  for (const id of ["reeds", "lotus", "river"] as const) { const z = ZONES[id]; if (Math.hypot(x - z.x, y - z.y) < z.r) return id; }
  if (Math.hypot(x - ISLAND.x, y - ISLAND.y) < 20) return "island";
  let best: PlaceId = "south", bd = Infinity;
  for (const b of BAYS) { const d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = b.id; } }
  return best;
}

// ---- the village ----
export interface DockPos { x: number; y: number; inward: number }
// seat -> the dock it uses when `players` people are in the match. The six
// angles are used in order, so a two-player match uses 66 and 114 degrees.
export function dockPos(seat: number, _players: number): DockPos {
  const [x, y] = shape(DOCK_ANGLES[seat % DOCK_ANGLES.length], 1.0);
  return { x, y, inward: Math.atan2(-y, -x) };
}

// ---- seasons and ice ----
// season: 0 spring, 1 summer, 2 autumn, 3 winter
export function iceBlocks(x: number, y: number, season: number): boolean {
  if (season !== 3 || nr(x, y) <= ICE_K) return false;
  for (let i = 0; i < DOCK_ANGLES.length; i++) { const d = dockPos(i, 6); if (Math.hypot(d.x - x, d.y - y) < ICE_DOCK_OPEN) return false; }
  return true;
}
// a boat cannot go here: on the island, or on winter ice
export const blockedAt = (x: number, y: number, season: number): boolean => Math.hypot(x - ISLAND.x, y - ISLAND.y) < ISLAND.r || iceBlocks(x, y, season);

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
export function outline(k = 1, n = 180): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.cos(a) * LAKE_X * shapeR(a) * k, Math.sin(a) * LAKE_Y * shapeR(a) * k]); }
  return pts;
}

// what the page needs, sent in its boot JSON; the client keeps no copy
export function worldForPage() {
  return {
    lake: { x: LAKE_X, y: LAKE_Y }, island: ISLAND, k: K, a0: A0, y0: Y0, allee: ALLEE, breedR: BREED_R, iceK: ICE_K, iceDockOpen: ICE_DOCK_OPEN, reedSlow: REED_SLOW,
    dockAngles: DOCK_ANGLES, floorFish: FLOOR_FISH, maxFloors: MAX_FLOORS, tiers: TIERS,
    zones: { reeds: ZONES.reeds, lotus: ZONES.lotus, river: ZONES.river, deep: DEEP }, bays: BAYS,
    outline: outline(1, 180), outlineBank: outline(1.075, 180),
  };
}
