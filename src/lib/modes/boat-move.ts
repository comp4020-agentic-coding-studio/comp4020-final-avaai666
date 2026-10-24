// How a boat sails on the v5 lake, shared by Boat Rush, Who's Poaching and
// Fishing Party (DESIGN.md rule change 10). It is the prototype's steerBoat()
// (ui.js), the tx/ty branch, with two changes Ava asked for when the lake
// became one screen ("my own boat does not do what I tell it", 24 Oct):
//
// - a target past the shore or on the island is first moved to the nearest
//   open water, so a boat steered at the shore goes to the shore and stops
//   there instead of grinding against it;
// - a boat that meets the shore or the island slides along it, keeping most
//   of its speed. The prototype cut its speed by 30% on every tick it
//   touched the shore (about 1/7 of its speed at the shore, in a probe on
//   seed probe-1), which is what made it feel stuck.
//
// Pure: no clock, no randomness.
import { ISLAND, nr, REED_SLOW, ZONES } from "../lake-world.ts";

export const TURN = 3.2; // radians a second (the prototype's)
export const SHORE_K = 0.965; // a boat's centre stays within this share of the way to the shore
export const TARGET_K = 0.93; // a steer target is kept within this share
export const ISLAND_CLEAR = 2.2; // a boat's centre stays this far off the island's edge (its half-width)
export const SLIDE = 0.95; // speed kept on a tick that touches the shore or the island

export interface Sailing { x: number; y: number; h: number; speed: number; tx: number; ty: number }

// the point a boat actually heads for: the target, or the nearest open water to it
export function inWater(x: number, y: number): [number, number] {
  const k = nr(x, y);
  if (k > TARGET_K) { x *= TARGET_K / k; y *= TARGET_K / k; }
  const di = Math.hypot(x - ISLAND.x, y - ISLAND.y), clear = ISLAND.r + ISLAND_CLEAR + 1;
  if (di < clear) { const a = di > 1e-6 ? Math.atan2(y - ISLAND.y, x - ISLAND.x) : Math.PI / 2; x = ISLAND.x + Math.cos(a) * clear; y = ISLAND.y + Math.sin(a) * clear; }
  return [x, y];
}

// turn towards the target and set the speed; returns nothing, moves nothing
export function steer(b: Sailing, maxSpeed: number, dt: number): void {
  const [gx, gy] = inWater(b.tx, b.ty);
  const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy);
  let throttle = 0;
  if (d > 0.9) {
    const want = Math.atan2(dy, dx), diff = Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h));
    b.h += Math.sign(diff) * Math.min(Math.abs(diff), dt * TURN);
    throttle = Math.min(1, d / 4) * Math.max(0.25, Math.cos(Math.min(1.4, Math.abs(diff))));
  }
  const inReeds = Math.hypot(b.x - ZONES.reeds.x, b.y - ZONES.reeds.y) < ZONES.reeds.r && nr(b.x, b.y) > 0.6;
  b.speed += (maxSpeed * throttle * (inReeds ? REED_SLOW : 1) - b.speed) * Math.min(1, dt * 2.6);
}

// where a boat that wants to be at (nx, ny) ends up: on the water, sliding along
// the shore or round the island if it met them; slows it a little if it did
export function keepOnWater(b: { speed: number }, nx: number, ny: number): [number, number] {
  const k = nr(nx, ny);
  if (k > SHORE_K) { nx *= SHORE_K / k; ny *= SHORE_K / k; b.speed *= SLIDE; }
  const di = Math.hypot(nx - ISLAND.x, ny - ISLAND.y), clear = ISLAND.r + ISLAND_CLEAR;
  if (di < clear) { const a = Math.atan2(ny - ISLAND.y, nx - ISLAND.x); nx = ISLAND.x + Math.cos(a) * clear; ny = ISLAND.y + Math.sin(a) * clear; b.speed *= SLIDE; }
  return [nx, ny];
}

// one tick of plain sailing (party and poach; rush adds its ram knockback and winter ice round it)
export function sail(b: Sailing, maxSpeed: number, dt: number): void {
  steer(b, maxSpeed, dt);
  [b.x, b.y] = keepOnWater(b, b.x + Math.cos(b.h) * b.speed * dt, b.y + Math.sin(b.h) * b.speed * dt);
}
