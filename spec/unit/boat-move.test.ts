import { describe, expect, it } from "vitest";
import { botStream, type Seat } from "../../src/lib/game-platform.ts";
import { POACH, RUSH } from "../../src/lib/game-constants.ts";
import { blockedAt, BAYS, ISLAND, nr, WORLD_SCALE, ZONES } from "../../src/lib/lake-world.ts";
import { inWater, keepOnWater, sail, SHORE_K, steer, TARGET_K } from "../../src/lib/modes/boat-move.ts";
import { party } from "../../src/lib/modes/party.ts";
import { poach, TASKS } from "../../src/lib/modes/poach.ts";
import { makeWithOpts, rush } from "../../src/lib/modes/rush.ts";

// Rule change 10 (Ava, 24 Oct): the lake is one screen (0.5 of the prototype's), and "my own boat does
// not do what I tell it". Two causes were measured (a probe on rush's own sim, seed probe-1): a boat
// steered at the shore lost 30% of its speed on every tick it touched it (1.65 of 15 at the shore,
// 3.2 along it), and on the 0.7 lake every place the modes named in the prototype's units was left
// where it was, some of it past the new shore. These tests hold both.

const boat = (x: number, y: number, h: number, tx: number, ty: number) => ({ x, y, h, speed: 0, tx, ty });

describe("sailing (boat-move.ts)", () => {
  it("a target past the shore or on the island is moved to open water", () => {
    const [x, y] = inWater(500, 20);
    expect(nr(x, y)).toBeLessThanOrEqual(TARGET_K + 1e-9);
    const [ix, iy] = inWater(ISLAND.x, ISLAND.y + 0.5);
    expect(Math.hypot(ix - ISLAND.x, iy - ISLAND.y)).toBeGreaterThan(ISLAND.r);
    expect(inWater(1, 2)).toEqual([1, 2]); // open water is left alone
  });

  it("steered at the shore, a boat reaches it and slides along it at more than half its speed", () => {
    // near the east shore, heading north, the stick held north-east (the client's target: 12 ahead)
    const b = boat(40, 0, -Math.PI / 2, 0, 0);
    let along = 0, atShore = 0, speedAtShore = 0;
    for (let t = 0; t < 4; t += RUSH.DT) {
      b.tx = b.x + 12 * Math.SQRT1_2; b.ty = b.y - 12 * Math.SQRT1_2;
      const y0 = b.y; sail(b, RUSH.SPEED, RUSH.DT); along += y0 - b.y;
      if (nr(b.x, b.y) > SHORE_K - 0.01) { atShore++; speedAtShore += b.speed; }
      expect(nr(b.x, b.y)).toBeLessThanOrEqual(SHORE_K + 1e-9);
    }
    expect(along).toBeGreaterThan(15); // it got somewhere: north along the shore
    if (atShore) expect(speedAtShore / atShore).toBeGreaterThan(RUSH.SPEED * 0.5);
  });

  it("a boat driven into the shore keeps most of its speed (the prototype kept about a quarter)", () => {
    // full throttle, its heading 30 degrees into the east shore, every tick (as a ram's knockback or a stale
    // target would): the speed settles where the throttle's pull and the shore's drag balance
    const b = { x: 40, y: 0, h: -Math.PI / 3, speed: RUSH.SPEED };
    for (let t = 0; t < 3; t += RUSH.DT) {
      b.speed += (RUSH.SPEED - b.speed) * Math.min(1, RUSH.DT * 2.6);
      [b.x, b.y] = keepOnWater(b, b.x + Math.cos(b.h) * b.speed * RUSH.DT + 2, b.y + Math.sin(b.h) * b.speed * RUSH.DT);
    }
    expect(b.speed).toBeGreaterThan(RUSH.SPEED * 0.5);
  });

  it("a boat that meets the island goes round it, not through it", () => {
    const b = boat(ISLAND.x, ISLAND.y + 12, -Math.PI / 2, ISLAND.x, ISLAND.y - 12);
    for (let t = 0; t < 4; t += RUSH.DT) { sail(b, RUSH.SPEED, RUSH.DT); expect(Math.hypot(b.x - ISLAND.x, b.y - ISLAND.y)).toBeGreaterThan(ISLAND.r); }
  });

  it("keepOnWater never leaves a boat past the shore", () => {
    for (let a = 0; a < 360; a += 15) {
      const r = (a * Math.PI) / 180, s = { speed: 10 };
      const [x, y] = keepOnWater(s, Math.cos(r) * 200, Math.sin(r) * 200);
      expect(nr(x, y)).toBeLessThanOrEqual(SHORE_K + 1e-9);
    }
  });

  it("steer() only turns and sets the speed; it moves nothing", () => {
    const b = boat(0, 10, 0, 20, 10); steer(b, RUSH.SPEED, RUSH.DT);
    expect([b.x, b.y]).toEqual([0, 10]); expect(b.speed).toBeGreaterThan(0);
  });
});

describe("every place a mode names is on the lake's open water, at the lake's scale", () => {
  const onWater = (x: number, y: number, k = 0.93) => nr(x, y) < k && !blockedAt(x, y, 0);
  it("Who's Poaching's task spots", () => {
    for (const t of TASKS) expect(onWater(t.x, t.y), `${t.id} (${t.x.toFixed(1)}, ${t.y.toFixed(1)})`).toBe(true);
  });
  it("the bays, the named places and Fishing Party's gates", () => {
    for (const b of BAYS) expect(onWater(b.x, b.y), b.id).toBe(true);
    for (const [id, z] of Object.entries(ZONES)) expect(nr(z.x, z.y), id).toBeLessThan(1);
    const seats: Seat[] = [0, 1].map((i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
    const s = party.make("gates", seats, { fish: 280 });
    for (const [x, y] of s.path) expect(onWater(x, y)).toBe(true);
  });
  it("the senses scale with the lake: the lantern's circle is the prototype's 24 at 0.5", () => {
    expect(WORLD_SCALE).toBe(0.5);
    expect(POACH.VIEW).toBe(12);
  });
});

// bots play whole matches; a boat that keeps hitting the shore is a boat steered at places past it
function shoreShare(play: () => { x: number; y: number }[][]): number {
  const ticks = play(); let n = 0, at = 0;
  for (const boats of ticks) for (const b of boats) { n++; if (nr(b.x, b.y) > SHORE_K - 0.005) at++; }
  return at / n;
}
const bots = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));

describe("bots' boats spend little time against the shore", () => {
  it("Boat Rush", () => {
    const share = shoreShare(() => {
      const seats = bots(4), secret = "shore-rush", s = makeWithOpts(secret, seats, { fish: 220 }, {}), out: { x: number; y: number }[][] = [];
      for (let tick = 0; !rush.over(s) && tick < 20000; tick++) {
        const ap = []; for (const st of seats) for (const raw of rush.bot(s, st.seat, botStream(secret, st.bot!, tick, st.seat))) { const ok = rush.input(s, st.seat, raw); if (ok) ap.push({ seat: st.seat, i: ok }); }
        rush.step(s, ap); if (s.phase === "play") out.push(s.boats.map((b) => ({ x: b.x, y: b.y })));
      }
      return out;
    });
    expect(share).toBeLessThan(0.15);
  }, 60000);
  it("Who's Poaching", () => {
    const share = shoreShare(() => {
      const seats = bots(6), secret = "shore-poach", s = poach.make(secret, seats, { fish: 280, adults: 224, young: 56 }), out: { x: number; y: number }[][] = [];
      for (let tick = 0; !poach.over(s) && tick < 60000; tick++) {
        const ap = []; for (const st of seats) for (const raw of poach.bot(s, st.seat, botStream(secret, st.bot!, tick, st.seat))) { const ok = poach.input(s, st.seat, raw); if (ok) ap.push({ seat: st.seat, i: ok }); }
        poach.step(s, ap); if (s.phase === "day") out.push(s.boats.filter((b) => !s.out[b.seat]).map((b) => ({ x: b.x, y: b.y })));
      }
      return out;
    });
    expect(share).toBeLessThan(0.15);
  }, 60000);
});
