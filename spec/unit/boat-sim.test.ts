import { describe, expect, it } from "vitest";
import { dockOf, holdValue, type Input, makeSim, Q, replay, resultsOf, step } from "../../src/lib/boat-sim.ts";

// The boat game's rules (docs/boats/RULES.md), checked on the simulation the
// server runs. The browser decides none of these.

const run = (seed: string, seats: Parameters<typeof makeSim>[1], script: (s: ReturnType<typeof makeSim>) => Input[] = () => []) => {
  const s = makeSim(seed, seats);
  const log = new Map<number, Input[]>();
  while (!s.over) {
    const inputs = script(s);
    if (inputs.length) log.set(s.tick, inputs);
    step(s, inputs);
  }
  return { s, log };
};

// A person-like script for seat 0: chase the nearest grown fish, cast when
// fish are at the bow, go home at 7.
const person = (s: ReturnType<typeof makeSim>): Input[] => {
  const b = s.boats[0];
  if (s.tick % 4) return [];
  if (b.hold.length >= 7) { const d = dockOf(0, s.players); return [{ seat: 0, kind: "steer", x: Math.round(d.x), y: Math.round(d.y) }]; }
  const f = s.fish.filter((x) => x.adult).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
  const out: Input[] = f ? [{ seat: 0, kind: "steer", x: Math.round(f.x), y: Math.round(f.y) }] : [];
  if (f && Math.hypot(f.x - b.x, f.y - b.y) < 60) out.push({ seat: 0, kind: "cast" });
  if (s.tick % 200 === 0) out.push({ seat: 0, kind: "dash" });
  return out;
};

describe("a match is its seed and its inputs", () => {
  it("replaying the recorded inputs gives the same match, fish for fish", () => {
    const { s, log } = run("replay-1", [null, "pirate", "steady", "scavenger"], person);
    const again = replay("replay-1", [null, "pirate", "steady", "scavenger"], log);
    expect(resultsOf(again)).toEqual(resultsOf(s));
    expect(again.fish.map((f) => [f.id, f.x, f.y])).toEqual(s.fish.map((f) => [f.id, f.x, f.y]));
  });

  it("a different seed gives a different lake", () => {
    expect(makeSim("a", [null, null]).fish[0].x).not.toBe(makeSim("b", [null, null]).fish[0].x);
  });
});

describe("the hold, home and the horn", () => {
  it("a hold never carries more than its limit, and only fish unloaded at home count", () => {
    const { s } = run("hold-1", [null, "steady"], (sim) => {
      const out = person(sim);
      for (const b of sim.boats) expect(b.hold.length).toBeLessThanOrEqual(Q.HOLD);
      return out;
    });
    for (const r of resultsOf(s)) {
      // everything caught or scooped was either banked or lost (to a ram or the horn)
      expect(r.stats.caught + r.stats.scooped).toBe(r.banked + r.stats.lost);
    }
  });

  it("fish still aboard at the horn count for nothing", () => {
    const s = makeSim("horn-1", [null, null]);
    // fill seat 0's hold in the middle of the lake and keep it there
    while (s.t < Q.SECONDS - 1) step(s, s.tick === 0 ? [{ seat: 0, kind: "steer", x: 500, y: 350 }] : []);
    s.boats[0].hold.push(1, 1, 1);
    while (!s.over) step(s, []);
    const r = resultsOf(s).find((x) => x.seat === 0)!;
    expect(r.banked).toBe(0);
    expect(r.stats.lost).toBe(3);
  });
});

describe("dashing and ramming stay small", () => {
  function collide(where: { x: number; y: number }) {
    const s = makeSim("ram-1", [null, null]);
    const [a, v] = s.boats;
    Object.assign(a, { x: where.x - 30, y: where.y, tx: where.x + 100, ty: where.y, h: 0 });
    Object.assign(v, { x: where.x, y: where.y, tx: where.x, ty: where.y });
    v.hold.push(1, 1, 1, 1, 1, Q.KOI_VALUE);
    step(s, [{ seat: 0, kind: "dash" }]);
    for (let i = 0; i < 4; i++) step(s, []);
    return { s, a, v };
  }
  it("a ram spills at most three fish, the golden carp first, and shields the boat it hit", () => {
    const { s, v } = collide({ x: 500, y: 350 });
    expect(v.hold.length).toBe(6 - Q.RAM_DROP);
    expect(v.hold).not.toContain(Q.KOI_VALUE);
    expect(s.loose.length).toBe(Q.RAM_DROP);
    expect(v.shield).toBeGreaterThan(0);
    // a second dash right away does nothing: the shield
    const before = v.hold.length;
    s.boats[0].dashCd = 0;
    Object.assign(s.boats[0], { x: v.x - 30, y: v.y, tx: v.x + 100, ty: v.y, h: 0 });
    step(s, [{ seat: 0, kind: "dash" }]);
    for (let i = 0; i < 4; i++) step(s, []);
    expect(v.hold.length).toBe(before);
  });
  it("no ram lands near a dock, so nobody can guard a port", () => {
    const d = dockOf(0, 2); // the rammer's own dock: the other boat is passing, not unloading
    const { s, v } = collide({ x: d.x, y: d.y });
    expect(v.stats.rammed).toBe(0);
    expect(s.loose.length).toBe(0);
    expect(holdValue(v)).toBe(5 + Q.KOI_VALUE);
  });
});

describe("the lake is shared and nothing refills it", () => {
  it("the lake never holds more fish than its capacity, and heavy fishing leaves fewer", () => {
    const quiet = run("lake-1", [null, null]).s; // nobody fishes
    const busy = run("lake-1", ["steady", "pirate", "scavenger", "steady"]).s;
    expect(quiet.fish.length).toBeLessThanOrEqual(quiet.cap);
    expect(busy.fish.filter((f) => f.adult).length / busy.start).toBeLessThan(quiet.fish.filter((f) => f.adult).length / quiet.start);
  });
  it("a net takes only grown fish: fry slip through", () => {
    const s = makeSim("fry-1", [null, null]);
    const b = s.boats[0];
    s.fish = [];
    for (let i = 0; i < 5; i++) s.fish.push({ id: 900 + i, x: b.x + Math.cos(b.h) * Q.NET_AHEAD, y: b.y + Math.sin(b.h) * Q.NET_AHEAD, h: 0, adult: i < 2, born: 0, cool: 9, scare: 0, sx: 0, sy: 0 });
    step(s, [{ seat: 0, kind: "cast" }]);
    for (let i = 0; i < Q.SINK / Q.DT + 2; i++) step(s, []);
    // the fish swim while the net sinks, so not every grown fish stays inside;
    // but no fry is ever taken, and what was taken was grown
    expect(b.stats.caught).toBeGreaterThanOrEqual(1);
    expect(b.stats.caught).toBeLessThanOrEqual(2);
    expect(s.fish.filter((f) => !f.adult).length).toBe(3);
    expect(b.stats.caught).toBe(b.hold.length + b.banked); // the boat starts in its dock, so it may already have unloaded
  });
});

describe("inputs are only wishes", () => {
  it("a steer outside the lake is clamped, and a cast while drying does nothing", () => {
    const s = makeSim("in-1", [null, null]);
    step(s, [{ seat: 0, kind: "steer", x: -5000, y: 99999 }]);
    expect(s.boats[0].tx).toBe(0);
    expect(s.boats[0].ty).toBe(Q.H);
    step(s, [{ seat: 0, kind: "cast" }]);
    const nets = s.nets.length;
    step(s, [{ seat: 0, kind: "cast" }]);
    expect(s.nets.length).toBe(nets);
  });
});
