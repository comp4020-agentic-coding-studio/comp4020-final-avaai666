// How a boat sails on the v5 lake, shared by Boat Rush, Who's Poaching and
// Fishing Party (DESIGN.md rule change 10). It is the prototype's steerBoat()
// (ui.js), the tx/ty branch, with one change: the shore is a wall a boat
// slides along (Ava, 24 Oct: "my own boat does not do what I tell it", then
// "it spins on the spot").
//
// - The prototype cut a boat's speed by 30% on every tick it touched the
//   shore (1.65 of 15 at the shore, in a probe on rush's sim), so it stuck.
// - Moving a target past the shore onto the water, which this file did first,
//   put the target beside or behind a boat near the shore; with the stick held
//   towards the shore the boat turned round and round (230 degrees in 6 s
//   held north, in the same probe).
// - So the target is left where it is (only one on the island is moved off
//   it), the boat heads for it, and where it meets the shore the part of its
//   move that goes out through the shore is taken away: pushed straight at
//   the shore it stays; pushed along it, it slides, at full speed.
//
// Pure: no clock, no randomness.
import { type Lake, makeLake, REED_SLOW } from "../lake-world.ts";

const L4 = makeLake(); // the four-boat lake, for a caller that does not say which

export const TURN = 3.2; // radians a second (the prototype's)
export const SHORE_K = 0.965; // a boat's centre stays within this share of the way to the shore
export const ISLAND_CLEAR = 2.2; // a boat's centre stays this far off the island's edge (its half-width)
export const SLIDE = 1; // speed kept on a tick that touches the shore or the island (the prototype: 0.7)

export interface Sailing { x: number; y: number; h: number; speed: number; tx: number; ty: number }

// the point a boat actually heads for: the target, or, if it is on the island, the nearest water round it
export function inWater(x: number, y: number, lake: Lake = L4): [number, number] {
  const I = lake.island, di = Math.hypot(x - I.x, y - I.y), clear = I.r + ISLAND_CLEAR + 1;
  if (di < clear) { const a = di > 1e-6 ? Math.atan2(y - I.y, x - I.x) : Math.PI / 2; x = I.x + Math.cos(a) * clear; y = I.y + Math.sin(a) * clear; }
  return [x, y];
}

// turn towards the target and set the speed; returns nothing, moves nothing
export function steer(b: Sailing, maxSpeed: number, dt: number, lake: Lake = L4): void {
  const [gx, gy] = inWater(b.tx, b.ty, lake);
  const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy);
  let throttle = 0;
  if (d > 0.9) {
    const want = Math.atan2(dy, dx), diff = Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h));
    b.h += Math.sign(diff) * Math.min(Math.abs(diff), dt * TURN);
    throttle = Math.min(1, d / 4) * Math.max(0.25, Math.cos(Math.min(1.4, Math.abs(diff))));
  }
  const R = lake.zones.reeds, inReeds = Math.hypot(b.x - R.x, b.y - R.y) < R.r && lake.nr(b.x, b.y) > 0.6;
  b.speed += (maxSpeed * throttle * (inReeds ? REED_SLOW : 1) - b.speed) * Math.min(1, dt * 2.6);
}

// the shore's outward direction at (x, y): the way nr() grows fastest
function outward(lake: Lake, x: number, y: number): [number, number] {
  const e = 0.05, nr = lake.nr, gx = nr(x + e, y) - nr(x - e, y), gy = nr(x, y + e) - nr(x, y - e), l = Math.hypot(gx, gy) || 1;
  return [gx / l, gy / l];
}
// where a boat at (x, y) that wants to be at (nx, ny) ends up: on the water. At the shore the part of the
// move that goes out through it is taken away, so the boat slides along it; round the island likewise.
export function keepOnWater(b: { speed: number; x?: number; y?: number }, nx: number, ny: number, lake: Lake = L4): [number, number] {
  const x0 = b.x ?? nx, y0 = b.y ?? ny, nr = lake.nr, I = lake.island;
  if (nr(nx, ny) > SHORE_K) {
    const [ox, oy] = outward(lake, nx, ny), out = (nx - x0) * ox + (ny - y0) * oy;
    if (out > 0) { nx -= out * ox; ny -= out * oy; }
    // back onto the water along the shore's own normal (pulling straight in towards the middle would also
    // undo some of the slide, and a boat pushed along a curved shore all but stopped)
    for (let it = 0; it < 3; it++) { const k = nr(nx, ny); if (k <= SHORE_K) break; const [px, py] = outward(lake, nx, ny), back = ((k - SHORE_K) * Math.hypot(nx, ny)) / k + 1e-3; nx -= px * back; ny -= py * back; }
    { const k = nr(nx, ny); if (k > SHORE_K) { nx *= SHORE_K / k; ny *= SHORE_K / k; } }
    b.speed *= SLIDE;
  }
  const di = Math.hypot(nx - I.x, ny - I.y), clear = I.r + ISLAND_CLEAR;
  if (di < clear) { const a = Math.atan2(ny - I.y, nx - I.x); nx = I.x + Math.cos(a) * clear; ny = I.y + Math.sin(a) * clear; b.speed *= SLIDE; }
  return [nx, ny];
}

// one tick of plain sailing (party and poach; rush adds its ram knockback and winter ice round it)
export function sail(b: Sailing, maxSpeed: number, dt: number, lake: Lake = L4): void {
  steer(b, maxSpeed, dt, lake);
  [b.x, b.y] = keepOnWater(b, b.x + Math.cos(b.h) * b.speed * dt, b.y + Math.sin(b.h) * b.speed * dt, lake);
}
