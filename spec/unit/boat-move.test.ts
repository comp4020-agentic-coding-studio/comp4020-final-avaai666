import { describe, expect, it } from "vitest";
import { botStream, type Seat } from "../../src/lib/game-platform.ts";
import { POACH, RUSH } from "../../src/lib/game-constants.ts";
import { blockedAt, BAYS, ISLAND, nr, WORLD_SCALE, ZONES } from "../../src/lib/lake-world.ts";
import { inWater, keepOnWater, sail, SHORE_K, steer } from "../../src/lib/modes/boat-move.ts";
import { party } from "../../src/lib/modes/party.ts";
import { poach, TASKS } from "../../src/lib/modes/poach.ts";
import { makeWithOpts, rush } from "../../src/lib/modes/rush.ts";

// Rule change 10 (Ava, 24 Oct): the lake is one screen (0.5 of the prototype's), and "my own boat does
// not do what I tell it". Two causes were measured (a probe on rush's own sim, seed probe-1): a boat
// steered at the shore lost 30% of its speed on every tick it touched it (1.65 of 15 at the shore,
// 3.2 along it), and on the 0.7 lake every place the modes named in the prototype's units was left
// where it was, some of it past the new shore. These tests hold both.
// Rule change 11 (Ava, 24 Oct: "the boat spins on the spot"): the first fix moved a target past the shore
// in towards the middle of the lake, which put it beside or behind a boat at the shore, so a boat held
// towards the shore turned round and round (230 degrees in 6 s held north, rush's sim). A target is now
// left where it is and the shore is a wall the boat slides along.

const boat = (x: number, y: number, h: number, tx: number, ty: number) => ({ x, y, h, speed: 0, tx, ty });

describe("sailing (boat-move.ts)", () => {
  it("a target on the island is moved off it; any other target, past the shore too, is left where it is", () => {
    expect(inWater(500, 20)).toEqual([500, 20]);
    const [ix, iy] = inWater(ISLAND.x, ISLAND.y + 0.5);
    expect(Math.hypot(ix - ISLAND.x, iy - ISLAND.y)).toBeGreaterThan(ISLAND.r);
    expect(inWater(1, 2)).toEqual([1, 2]);
  });

  it("steered along and into the south shore, a boat slides west along it at more than half its speed", () => {
    // by the south shore, the stick held west and a little south, into the shore (the client's target: 12 ahead)
    const b = boat(0, 28, Math.PI, 0, 0);
    let along = 0, atShore = 0, speedAtShore = 0;
    for (let t = 0; t < 4; t += RUSH.DT) {
      b.tx = b.x - 12 * 0.94; b.ty = b.y + 12 * 0.34;
      const x0 = b.x; sail(b, RUSH.SPEED, RUSH.DT); along += x0 - b.x;
      if (nr(b.x, b.y) > SHORE_K - 0.01) { atShore++; speedAtShore += b.speed; }
      expect(nr(b.x, b.y)).toBeLessThanOrEqual(SHORE_K + 1e-9);
    }
    expect(along).toBeGreaterThan(25); // it got somewhere: west along the shore
    expect(atShore).toBeGreaterThan(0);
    expect(speedAtShore / atShore).toBeGreaterThan(RUSH.SPEED * 0.5);
  });

  it("held towards the shore, a boat stops there facing it; it does not turn round (rule change 11)", () => {
    // seat 0 on the four-boat lake, the stick held north for 6 s, as the page sends it (every 0.15 s, 12 ahead)
    const seats: Seat[] = [0, 1].map((i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
    const s = makeWithOpts("hold-north", seats, { fish: 220 }, {});
    const b = s.boats[0]; let next = 0, worst = 0;
    for (let t = 0; t < 6; t += RUSH.DT) {
      const ins = [];
      if (t >= next) { next += 0.15; const i = rush.input(s, 0, { k: "steer", x: Math.round(b.x * 10) / 10, y: Math.round((b.y - 12) * 10) / 10 }); if (i) ins.push({ seat: 0, i }); }
      rush.step(s, ins);
      if (t > 2) worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(b.h + Math.PI / 2), Math.cos(b.h + Math.PI / 2))));
    }
    expect(nr(b.x, b.y)).toBeGreaterThan(0.9); // it crossed to the north shore
    expect((worst * 180) / Math.PI).toBeLessThan(30); // and kept facing north
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
