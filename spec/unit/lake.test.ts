import { describe, expect, it } from "vitest";
import { COARSE, FINE, FINE_COST, FISH_MS, MEET_MS, QUOTA, YEARS } from "../../src/lib/game-constants.ts";
import {
  type BotState,
  botBuys,
  botObeys,
  botVote,
  catchSize,
  type LakeParams,
  lakeParams,
  phaseAt,
  type Rule,
  seededRng,
  stockAt,
  isBreach,
  tally,
} from "../../src/lib/lake.ts";

// The game model (DESIGN.md v1.0). Pure functions: these tests need no server.

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// An independent reference: the growth equation written out here, integrated
// with RK4 at a 10 ms step.
function reference(s0: number, elapsedMs: number, { K, A, r }: LakeParams): number {
  const f = (s: number): number => r * s * (s / A - 1) * (1 - s / K);
  const dt = 10 / MINUTE; // minutes
  let s = s0;
  for (let i = 0; i < elapsedMs / 10; i++) {
    const k1 = f(s);
    const k2 = f(s + (dt * k1) / 2);
    const k3 = f(s + (dt * k2) / 2);
    const k4 = f(s + dt * k3);
    s += (dt * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
  }
  return s;
}

describe("lakeParams", () => {
  it("is K = 300, A = 30, r = 0.45 for four families", () => {
    expect(lakeParams(4)).toEqual({ K: 300, A: 30, r: 0.45 });
  });

  it("is K = 150 for two families", () => {
    expect(lakeParams(2).K).toBe(150);
  });
});

describe("stockAt", () => {
  const p = lakeParams(4);

  describe("is within 0.1% of a 10 ms reference RK4", () => {
    for (const s0 of [45, 150, 290]) {
      for (const t of [10 * SECOND, MINUTE, 10 * MINUTE]) {
        it(`s0 = ${s0}, t = ${t / SECOND} s`, () => {
          const want = reference(s0, t, p);
          expect(Math.abs(stockAt(s0, t, p) - want)).toBeLessThanOrEqual(0.001 * want);
        });
      }
    }
  });

  it("a dead lake stays dead", () => {
    for (const s0 of [0, 0.5, 0.999]) {
      for (const t of [SECOND, MINUTE, 10 * MINUTE]) {
        expect(stockAt(s0, t, p)).toBeLessThan(1);
      }
    }
  });

  it("stays within [0, K]", () => {
    for (const s0 of [0, 1, 10, 29, 31, 150, 299, 300]) {
      for (const t of [SECOND, MINUTE, 10 * MINUTE]) {
        const s = stockAt(s0, t, p);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(p.K);
      }
    }
  });
});

describe("catchSize", () => {
  const { K } = lakeParams(4);
  const DRAWS = 20_000;

  function mean(capacity: number, stock: number): number {
    const rng = seededRng(1);
    let sum = 0;
    for (let i = 0; i < DRAWS; i++) sum += catchSize(capacity, stock, K, rng);
    return sum / DRAWS;
  }

  for (const capacity of [COARSE, FINE]) {
    it(`mean is within 2% of ${capacity} at stock K`, () => {
      expect(Math.abs(mean(capacity, K) - capacity)).toBeLessThanOrEqual(0.02 * capacity);
    });

    it(`mean is within 2% of ${capacity}/3 at stock K/3`, () => {
      const want = capacity / 3;
      expect(Math.abs(mean(capacity, K / 3) - want)).toBeLessThanOrEqual(0.02 * want);
    });
  }

  it("is a whole number, never negative, never more than floor(stock)", () => {
    const rng = seededRng(2);
    for (const stock of [1, 1.5, 2, 2.9, 5, 7.5, 30, 150, 300]) {
      for (let i = 0; i < 1000; i++) {
        const got = catchSize(FINE, stock, K, rng);
        expect(Number.isInteger(got)).toBe(true);
        expect(got).toBeGreaterThanOrEqual(0);
        expect(got).toBeLessThanOrEqual(Math.floor(stock));
      }
    }
  });

  it("is 0 when stock < 1", () => {
    const rng = seededRng(3);
    for (const stock of [0, 0.2, 0.999]) {
      for (let i = 0; i < 100; i++) expect(catchSize(FINE, stock, K, rng)).toBe(0);
    }
  });
});

describe("seededRng", () => {
  it("gives the same sequence for the same seed, in [0, 1)", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(b()).toBe(x);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("phaseAt", () => {
  const T0 = 1_700_000_000_000;

  it.each([
    [0, { year: 1, phase: "fish", msLeft: FISH_MS }],
    [45_000, { year: 1, phase: "meet", msLeft: MEET_MS }],
    [60_000, { year: 2, phase: "fish", msLeft: FISH_MS }],
    [359_999, { year: 6, phase: "meet", msLeft: 1 }],
  ] as const)("t = %d", (t, want) => {
    expect(phaseAt(T0, T0 + t)).toEqual(want);
  });

  it("is over at t = 360,000", () => {
    expect(phaseAt(T0, T0 + 360_000).phase).toBe("over");
    expect(phaseAt(T0, T0 + 360_000 + MINUTE).phase).toBe("over");
  });

  it("has six years", () => {
    expect(YEARS).toBe(6);
  });
});

describe("tally (4 families)", () => {
  it.each([
    [["ban", "ban", "quota", "none"], "ban"],
    [["ban", "quota", "none", "none"], "none"],
    [["quota", "quota", "ban", "ban"], "none"],
    [["ban", "ban", "ban", "none"], "ban"],
  ] as [Rule[], Rule][])("%j -> %s", (votes, want) => {
    expect(tally(votes, 4)).toBe(want);
  });

  it("counts a missing vote as none", () => {
    // ban 2, quota 1, one family silent: ban leads with half of four
    expect(tally(["ban", "ban", "quota"], 4)).toBe("ban");
    // ban 1, quota 1, two silent: none leads with half
    expect(tally(["ban", "quota"], 4)).toBe("none");
    // quota 2 and two silent (none 2): a tie
    expect(tally(["quota", "quota"], 4)).toBe("none");
    expect(tally([], 4)).toBe("none");
  });
});

describe("isBreach", () => {
  it("quota: breached when the catch takes the year past QUOTA", () => {
    expect(QUOTA).toBe(25);
    expect(isBreach("quota", "coarse", 24, 2)).toBe(true);
    expect(isBreach("quota", "coarse", 22, 3)).toBe(false);
  });

  it("ban: breached by a fine net that lands a fish", () => {
    expect(isBreach("ban", "fine", 0, 1)).toBe(true);
    expect(isBreach("ban", "fine", 0, 0)).toBe(false);
    expect(isBreach("ban", "coarse", 0, 3)).toBe(false);
  });

  it("no rule: never breached", () => {
    expect(isBreach("none", "fine", 100, 8)).toBe(false);
    expect(isBreach("none", "coarse", 100, 3)).toBe(false);
  });
});

describe("bots", () => {
  const base: BotState = {
    fish: 0,
    hasFine: false,
    othersFine: 0,
    rule: "none",
    stock: 300,
    K: 300,
    lastHumanVotes: [],
  };

  it("Jin (greedy) buys at 20 fish unless the rule is ban", () => {
    expect(FINE_COST).toBe(20);
    expect(botBuys("greedy", { ...base, fish: 19 })).toBe(false);
    expect(botBuys("greedy", { ...base, fish: 20 })).toBe(true);
    expect(botBuys("greedy", { ...base, fish: 20, rule: "quota" })).toBe(true);
    expect(botBuys("greedy", { ...base, fish: 20, rule: "ban" })).toBe(false);
    expect(botBuys("greedy", { ...base, fish: 40, hasFine: true })).toBe(false);
  });

  it("Mei (follower) buys only when two others have fine nets, unless banned", () => {
    expect(botBuys("follower", { ...base, fish: 100, othersFine: 0 })).toBe(false);
    expect(botBuys("follower", { ...base, fish: 100, othersFine: 1 })).toBe(false);
    expect(botBuys("follower", { ...base, fish: 100, othersFine: 2 })).toBe(true);
    expect(botBuys("follower", { ...base, fish: 100, othersFine: 3 })).toBe(true);
    expect(botBuys("follower", { ...base, fish: 100, othersFine: 2, rule: "ban" })).toBe(false);
  });

  it("Old Wang (careful) never buys", () => {
    for (const othersFine of [0, 1, 2, 3]) {
      for (const rule of ["none", "quota", "ban"] as Rule[]) {
        expect(botBuys("careful", { ...base, fish: 1000, othersFine, rule })).toBe(false);
      }
    }
  });

  it("Old Wang votes ban when anyone has a fine net, else quota below 60%", () => {
    expect(botVote("careful", { ...base, othersFine: 1 })).toBe("ban");
    expect(botVote("careful", { ...base, othersFine: 1, stock: 100 })).toBe("ban");
    expect(botVote("careful", { ...base, stock: 179 })).toBe("quota");
    expect(botVote("careful", { ...base, stock: 300 })).toBe("none");
  });

  it("Jin votes for no rule", () => {
    expect(botVote("greedy", { ...base, othersFine: 3, stock: 10 })).toBe("none");
  });

  it("Mei votes as the human families did at the last meeting", () => {
    expect(botVote("follower", { ...base, lastHumanVotes: [] })).toBe("none");
    expect(botVote("follower", { ...base, lastHumanVotes: ["ban", "ban"] })).toBe("ban");
    expect(botVote("follower", { ...base, lastHumanVotes: ["quota"] })).toBe("quota");
  });

  it("Old Wang and Mei obey every rule; Jin ignores quotas", () => {
    for (const rule of ["none", "quota", "ban"] as Rule[]) {
      expect(botObeys("careful", rule)).toBe(true);
      expect(botObeys("follower", rule)).toBe(true);
    }
    expect(botObeys("greedy", "quota")).toBe(false);
  });
});
