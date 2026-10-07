import { describe, expect, it } from "vitest";
import * as ref from "../../sim/lakesim.mjs";
import { CLUTCH, FISH_S, MEET_S, R_COARSE, R_FINE, SEASON_MS, SINK_S } from "../../src/lib/game-constants.ts";
import {
  adults,
  bestSpot,
  castNet,
  closeNets,
  dead,
  type Fish,
  makeLake,
  MODEL_VERSION,
  nextYear,
  phase,
  phaseAt,
  secretHash,
  stepAt,
  step,
  streamRng,
} from "../../src/lib/lake-sim.ts";

// The lake as agents (DESIGN.md v2.1, "The lake", "Randomness" and "Nets").
// Pure: no server.

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
  it("same secret, same throws, 700 steps: identical fish and hauls", () => {
    const SECRET = "reference-check";
    const L0 = ref.makeLake({ ...ref.DEFAULTS }, 4, SECRET);
    const L1 = makeLake(4, SECRET);
    const aim0 = ref.streamRng(SECRET, "aim");
    const aim1 = streamRng(SECRET, "aim");
    const refHauls: ref.RefStep["hauls"] = [];
    const hauls: ReturnType<typeof step>["hauls"] = [];
    let winters = 0;
    let refSpawns = 0;
    let spawns = 0;
    for (let k = 0; k < 700; k++) {
      if (phase(L1.t).phase === "fish") {
        if (k % 9 === 3) {
          // aimed throws: one in three fine
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
      const o0 = ref.step(L0);
      const o1 = step(L1);
      refHauls.push(...o0.hauls);
      hauls.push(...o1.hauls);
      refSpawns += o0.spawns.length;
      spawns += o1.spawns.length;
      expect(o1.winter).toBe(o0.winter);
      if (o1.winter) winters++;
    }
    expect(winters).toBe(1);
    expect(L1.t).toBe(L0.t);
    expect(spawns).toBe(refSpawns);
    expect(L1.start).toBe(L0.start);
    expect(L1.fish.map(({ id, x, y, age, h }) => ({ id, x, y, age, h }))).toEqual(
      L0.fish.map(({ id, x, y, age, h }) => ({ id, x, y, age, h })),
    );
    const view = (h: { net: { fam: number; x: number; y: number; fine: boolean }; got: number; gotFry: number; slipped: number }) => ({
      fam: h.net.fam,
      x: h.net.x,
      y: h.net.y,
      fine: h.net.fine,
      got: h.got,
      gotFry: h.gotFry,
      slipped: h.slipped,
    });
    expect(hauls.map(view)).toEqual(refHauls.map(view));
    // the script did catch fish and fry, and fry slipped, so the comparison is not of empty nets
    expect(hauls.reduce((n, h) => n + h.got, 0)).toBeGreaterThan(20);
    expect(hauls.reduce((n, h) => n + h.gotFry, 0)).toBeGreaterThan(0);
    expect(hauls.reduce((n, h) => n + h.slipped, 0)).toBeGreaterThan(0);
  });

  it("the model version is the reference's", () => {
    expect(MODEL_VERSION).toBe("lake-sim 2.1");
    expect(MODEL_VERSION).toBe(ref.MODEL_VERSION);
  });
});

describe("random streams", () => {
  const take = (r: () => number, n = 50): number[] => Array.from({ length: n }, () => r());

  it("the same secret gives the same streams, equal to the reference's", () => {
    expect(take(streamRng("s1", "lake"))).toEqual(take(streamRng("s1", "lake")));
    expect(take(streamRng("s1", "koi"))).toEqual(take(ref.streamRng("s1", "koi")));
  });

  it('"lake" and "koi" differ', () => {
    expect(take(streamRng("s1", "lake"))).not.toEqual(take(streamRng("s1", "koi")));
  });

  it("two secrets that differ in one character give different fish", () => {
    const a = makeLake(4, "secret-a").fish.map(({ x, y }) => [x, y]);
    const b = makeLake(4, "secret-b").fish.map(({ x, y }) => [x, y]);
    expect(a).not.toEqual(b);
  });

  it("secretHash is SHA-256 of the secret, as the reference", () => {
    expect(secretHash("s1")).toBe(ref.secretHash("s1"));
    expect(secretHash("s1")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("death", () => {
  it("dead() is true at 1 fish and false at 2", () => {
    const L = makeLake(1, "d", { startCount: 0 });
    L.fish = [fishAt(1, 500, 350, 2)];
    expect(dead(L)).toBe(true);
    L.fish.push(fishAt(2, 520, 350, 2));
    expect(dead(L)).toBe(false);
  });
});

describe("winter", () => {
  it("every fry alive before a winter is alive after it, now grown", () => {
    const L = makeLake(4, "winter");
    let fry: number[] = [];
    for (;;) {
      fry = L.fish.filter((f) => f.age === 0).map((f) => f.id);
      if (step(L).winter) break;
    }
    expect(fry.length).toBeGreaterThan(10);
    const after = new Map(L.fish.map((f) => [f.id, f]));
    for (const id of fry) expect(after.get(id)?.age).toBe(1);
  });
});

describe("nextYear", { timeout: 180_000 }, () => {
  it("an unfished lake holds more grown fish next year than at the season's end", () => {
    const L = makeLake(4, "next");
    while (phase(L.t).phase !== "over") step(L);
    const now = adults(L);
    expect(nextYear(L)).toBeGreaterThan(now);
  });

  it("is 0 for a dead lake", () => {
    const empty = makeLake(4, "next", { startCount: 0 });
    expect(nextYear(empty)).toBe(0);
    const oneFry = makeLake(4, "next", { startCount: 0 });
    oneFry.fish = [fishAt(1, 500, 350, 0)];
    expect(nextYear(oneFry)).toBe(0);
  });
});

describe("nets", () => {
  // A lake with no fish of its own, a net thrown, then the fish placed and the
  // clock moved to the moment the net closes.
  function lakeWith(nets: { fam: number; x: number; y: number; fine: boolean }[], fish: Fish[]) {
    const L = makeLake(1, "nets", { startCount: 0 });
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
    expect(hauls.map((h) => [h.net.fam, h.got])).toEqual([
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
        const L = makeLake(4, `allee-${seed}`, { startCount: n });
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
  const after = (secret: string) => {
    const L = makeLake(4, secret);
    for (let k = 0; k < 300; k++) step(L);
    return L.fish;
  };

  it("the same secret gives the same lake after 300 steps", () => {
    expect(after("same")).toEqual(after("same"));
  });

  it("a different secret does not", () => {
    expect(after("other")).not.toEqual(after("same"));
  });

  it("fish ids are unique", () => {
    const ids = after("same").map((f) => f.id);
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

  it("comes from the step: 13,950 ms is still step 139", () => {
    expect(phaseAt(T0, T0 + 13_950)).toEqual(phaseAt(T0, T0 + 13_900));
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
