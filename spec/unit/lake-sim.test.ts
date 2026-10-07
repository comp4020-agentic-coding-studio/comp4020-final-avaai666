import { describe, expect, it } from "vitest";
import * as ref from "../../sim/lakesim.mjs";
import { CLUTCH, FISH_S, MEET_S, R_COARSE, R_FINE, SEASON_MS, SINK_S } from "../../src/lib/game-constants.ts";
import {
  bestSpot,
  castNet,
  closeNets,
  type Fish,
  type Haul,
  makeLake,
  phase,
  phaseAt,
  rngFrom,
  stepAt,
  step,
} from "../../src/lib/lake-sim.ts";

// The lake as agents (DESIGN.md v2.0, "The lake" and "Nets"). Pure: no server.

const fishAt = (id: number, x: number, y: number, age: number): Fish => ({
  id,
  x,
  y,
  h: 0,
  age,
  cool: 0,
  scare: 0,
  sx: 0,
  sy: 0,
});

describe("matches the reference", () => {
  it("same seed, same throws, 700 steps: identical fish and hauls", () => {
    const SEED = 4242;
    const L0 = ref.makeLake({ ...ref.DEFAULTS }, 4, SEED);
    const L1 = makeLake(4, SEED);
    const aim0 = ref.rngFrom(7);
    const aim1 = rngFrom(7);
    const hauls: Haul[] = [];
    let winters = 0;
    for (let k = 0; k < 700; k++) {
      if (phase(L1.t).phase === "fish") {
        if (k % 9 === 3) {
          // aimed throws: every third one fine
          const fam = k % 4;
          const fine = k % 27 === 3;
          const a = ref.bestSpot(L0, fine, aim0);
          const b = bestSpot(L1, fine, aim1);
          ref.cast(L0, fam, a.x, a.y, fine);
          castNet(L1, fam, b.x, b.y, fine);
        }
        if (k % 50 === 20) {
          // fixed throws, one in the shallows
          ref.cast(L0, 3, 500, 350, false);
          castNet(L1, 3, 500, 350, false);
          ref.cast(L0, 2, 880, 350, true);
          castNet(L1, 2, 880, 350, true);
        }
      }
      ref.step(L0);
      const out = step(L1);
      hauls.push(...out.hauls);
      if (out.winter) winters++;
    }
    expect(winters).toBe(1);
    expect(L1.t).toBe(L0.t);
    expect(L1.fish.map(({ x, y, age, h }) => ({ x, y, age, h }))).toEqual(
      L0.fish.map(({ x, y, age, h }) => ({ x, y, age, h })),
    );
    const refHauls = L0.events.filter((e) => e.kind === "haul");
    expect(hauls.map(({ fam, got, gotFry, x, y, fine }) => ({ fam, got, gotFry, x, y, fine }))).toEqual(
      refHauls.map((e) => ({ fam: e.fam, got: e.got, gotFry: e.gotFry, x: e.x, y: e.y, fine: e.fine })),
    );
    // the script did catch fish, so the comparison is not of empty nets
    expect(hauls.reduce((n, h) => n + h.got, 0)).toBeGreaterThan(20);
    expect(hauls.reduce((n, h) => n + h.gotFry, 0)).toBeGreaterThan(0);
  });
});

describe("nets", () => {
  // A lake with no fish of its own, a net thrown, then the fish placed and the
  // clock moved to the moment the net closes.
  function lakeWith(nets: { fam: number; x: number; y: number; fine: boolean }[], fish: Fish[]) {
    const L = makeLake(1, 1, { startCount: 0 });
    for (const n of nets) castNet(L, n.fam, n.x, n.y, n.fine);
    L.fish = fish;
    L.t = SINK_S;
    return L;
  }

  it("a coarse net never takes fry", () => {
    const L = lakeWith(
      [{ fam: 0, x: 500, y: 350, fine: false }],
      [fishAt(1, 500, 350, 0), fishAt(2, 510, 350, 0), fishAt(3, 505, 355, 2)],
    );
    const [haul] = closeNets(L);
    expect(haul).toMatchObject({ got: 1, gotFry: 0, slipped: 2 });
    expect(L.fish.map((f) => f.id)).toEqual([1, 2]);
  });

  it("a fine net takes every fish inside its ring", () => {
    const L = lakeWith(
      [{ fam: 0, x: 500, y: 350, fine: true }],
      [fishAt(1, 500, 350, 0), fishAt(2, 500 + R_FINE - 0.01, 350, 1), fishAt(3, 500, 350 - R_FINE, 3)],
    );
    const [haul] = closeNets(L);
    expect(haul).toMatchObject({ got: 3, gotFry: 1, slipped: 0 });
    expect(L.fish).toEqual([]);
  });

  it("a fish just outside the ring stays", () => {
    const L = lakeWith(
      [
        { fam: 0, x: 300, y: 350, fine: false },
        { fam: 1, x: 700, y: 350, fine: true },
      ],
      [fishAt(1, 300 + R_COARSE + 0.01, 350, 2), fishAt(2, 700, 350 + R_FINE + 0.01, 0)],
    );
    const hauls = closeNets(L);
    expect(hauls.map((h) => h.got)).toEqual([0, 0]);
    expect(L.fish.map((f) => f.id)).toEqual([1, 2]);
  });

  it("two nets closing in the same step: the one thrown first takes the fish they share", () => {
    const L = lakeWith(
      [
        { fam: 2, x: 500, y: 350, fine: false },
        { fam: 0, x: 530, y: 350, fine: false },
      ],
      [fishAt(1, 515, 350, 2)],
    );
    const hauls = closeNets(L);
    expect(hauls.map((h) => [h.fam, h.got])).toEqual([
      [2, 1],
      [0, 0],
    ]);
  });
});

describe("spawning", () => {
  it("the Allee effect: fewer fry per grown fish in the first spring with 12 than with 60", () => {
    const perGrown = (n: number): number => {
      let born = 0;
      for (let seed = 0; seed < 10; seed++) {
        const L = makeLake(4, seed, { startCount: n });
        while (phase(L.t).spring) born += step(L).spawns.length * CLUTCH;
      }
      return born / (10 * n);
    };
    const few = perGrown(12);
    const many = perGrown(60);
    console.log(`fry per grown fish in the first spring: 12 grown ${few.toFixed(3)}, 60 grown ${many.toFixed(3)}`);
    expect(few).toBeLessThan(many);
  });
});

describe("determinism", () => {
  const after = (seed: number) => {
    const L = makeLake(4, seed);
    for (let k = 0; k < 300; k++) step(L);
    return L.fish;
  };

  it("the same seed gives the same lake after 300 steps", () => {
    expect(after(11)).toEqual(after(11));
  });

  it("a different seed does not", () => {
    expect(after(12)).not.toEqual(after(11));
  });

  it("fish ids are unique", () => {
    const ids = after(11).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("phaseAt", () => {
  const T0 = 1_700_000_000_000;

  it.each([
    [0, { step: 0, year: 1, phase: "fish", spring: true, msLeft: 40_000 }],
    [13_900, { step: 139, year: 1, phase: "fish", spring: true, msLeft: 26_100 }],
    [14_000, { step: 140, year: 1, phase: "fish", spring: false, msLeft: 26_000 }],
    [39_900, { step: 399, year: 1, phase: "fish", spring: false, msLeft: 100 }],
    [40_000, { step: 400, year: 1, phase: "meet", spring: false, msLeft: 14_000 }],
    [54_000, { step: 540, year: 2, phase: "fish", spring: true, msLeft: 40_000 }],
    [256_000, { step: 2560, year: 5, phase: "over", spring: false, msLeft: 0 }],
    [300_000, { step: 3000, year: 5, phase: "over", spring: false, msLeft: 0 }],
  ] as const)("t = %d ms", (t, want) => {
    expect(phaseAt(T0, T0 + t)).toEqual(want);
  });

  it("the season is 256 s", () => {
    expect(SEASON_MS).toBe(256_000);
    expect(SEASON_MS).toBe((4 * (FISH_S + MEET_S) + FISH_S) * 1000);
  });

  it("no t in the season gives year 5 a meeting", () => {
    for (let t = 0; t < SEASON_MS; t += 100) {
      const p = phaseAt(T0, T0 + t);
      expect(p.phase).not.toBe("over");
      if (p.year === 5) expect(p.phase).toBe("fish");
    }
  });

  it("agrees with the lake's own phase at every step", () => {
    for (let s = 0; s * 100 < SEASON_MS + 1000; s++) {
      const a = phaseAt(T0, T0 + s * 100);
      const b = phase(s / 10);
      expect([a.year, a.phase]).toEqual([b.year, b.phase]);
    }
  });

  it("stepAt counts whole steps of 0.1 s", () => {
    expect(stepAt(T0, T0)).toBe(0);
    expect(stepAt(T0, T0 + 99)).toBe(0);
    expect(stepAt(T0, T0 + 100)).toBe(1);
    expect(stepAt(T0, T0 + 12_345)).toBe(123);
  });
});
