import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  COARSE,
  FINE,
  FINE_COST,
  FISH_MS,
  MEET_MS,
  QUOTA,
  SEASON_MS,
  YEARS,
} from "../../src/lib/game-constants.ts";
import {
  type BotState,
  botBuys,
  botCasts,
  botNet,
  botObeys,
  botVote,
  capacity,
  castingRate,
  castLabel,
  catchSize,
  coarseCounterfactual,
  draw,
  fishingMsBefore,
  type LakeParams,
  lakeParams,
  type Net,
  phaseAt,
  type Rule,
  seededRng,
  seedHash,
  simulateSeason,
  stockAt,
  isBreach,
  tally,
  type VerifyRow,
  verifySeason,
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
    [300_000, { year: 6, phase: "fish", msLeft: FISH_MS }],
    [344_999, { year: 6, phase: "fish", msLeft: 1 }],
  ] as const)("t = %d", (t, want) => {
    expect(phaseAt(T0, T0 + t)).toEqual(want);
  });

  it("is over at t = 345,000", () => {
    expect(phaseAt(T0, T0 + 345_000).phase).toBe("over");
    expect(phaseAt(T0, T0 + 345_000 + MINUTE).phase).toBe("over");
  });

  it("has six years", () => {
    expect(YEARS).toBe(6);
  });

  it("the season is 345,000 ms", () => {
    expect(SEASON_MS).toBe(345_000);
  });

  it("gives year 6 no meeting", () => {
    for (let t = 0; t < SEASON_MS; t += 1000) {
      const { year, phase } = phaseAt(T0, T0 + t);
      if (year === 6) expect(phase).toBe("fish");
    }
  });
});

describe("fishingMsBefore", () => {
  const T0 = 1_700_000_000_000;

  it.each([
    [0, 0],
    [44_999, 44_999],
    [50_000, 45_000], // in year 1's meeting
    [61_000, 46_000], // 1 s into year 2
    [400_000, 6 * FISH_MS], // after the season: capped
  ])("t = %d -> %d", (t, want) => {
    expect(fishingMsBefore(T0, T0 + t)).toBe(want);
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
    humanVotes: [],
    humans: 1,
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

  it("Mei votes as the humans have so far in this meeting", () => {
    expect(botVote("follower", { ...base, humanVotes: [], humans: 1 })).toBe("none");
    expect(botVote("follower", { ...base, humanVotes: ["ban"], humans: 1 })).toBe("ban");
    // the silent human counts as no rule
    expect(botVote("follower", { ...base, humanVotes: ["ban"], humans: 2 })).toBe("none");
    expect(botVote("follower", { ...base, humanVotes: ["ban", "ban"], humans: 3 })).toBe("ban");
    expect(botVote("follower", { ...base, humanVotes: ["quota", "ban"], humans: 2 })).toBe("none");
  });

  it("Old Wang and Mei obey every rule; Jin ignores quotas", () => {
    for (const rule of ["none", "quota", "ban"] as Rule[]) {
      expect(botObeys("careful", rule)).toBe(true);
      expect(botObeys("follower", rule)).toBe(true);
    }
    expect(botObeys("greedy", "quota")).toBe(false);
  });

  it("Jin obeys a ban and no rule; he ignores only quotas", () => {
    expect(botObeys("greedy", "ban")).toBe(true);
    expect(botObeys("greedy", "none")).toBe(true);
    expect(botObeys("greedy", "quota")).toBe(false);
  });
});

describe("botNet", () => {
  it("Jin with a fine net casts fine under none and quota, coarse under ban", () => {
    expect(botNet("greedy", "none", true)).toBe("fine");
    expect(botNet("greedy", "quota", true)).toBe("fine");
    expect(botNet("greedy", "ban", true)).toBe("coarse");
  });

  it("nobody without a fine net ever casts fine", () => {
    for (const kind of ["careful", "greedy", "follower"] as const) {
      for (const rule of ["none", "quota", "ban"] as Rule[]) {
        expect(botNet(kind, rule, false)).toBe("coarse");
      }
    }
  });
});

describe("botCasts", () => {
  it("Old Wang under a quota casts at 22 landed (22 + 3 = 25), not at 23", () => {
    expect(botCasts("careful", "quota", "coarse", 22)).toBe(true);
    expect(botCasts("careful", "quota", "coarse", 23)).toBe(false);
  });

  it("Jin at 100 landed under a quota still casts", () => {
    expect(botCasts("greedy", "quota", "fine", 100)).toBe(true);
  });

  it("nobody stops under none or ban", () => {
    for (const kind of ["careful", "greedy", "follower"] as const) {
      for (const rule of ["none", "ban"] as Rule[]) {
        for (const net of ["coarse", "fine"] as Net[]) {
          expect(botCasts(kind, rule, net, 1000)).toBe(true);
        }
      }
    }
  });

  it("works because a catch never exceeds the net's capacity", () => {
    const { K } = lakeParams(4);
    const rng = seededRng(7);
    for (let i = 0; i < 10_000; i++) {
      const net: Net = i % 2 ? "fine" : "coarse";
      expect(catchSize(capacity(net), rng() * K, K, rng)).toBeLessThanOrEqual(capacity(net));
    }
  });
});

describe("honest draws", () => {
  const SEED = "9f1c2b3a4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8";

  it("same seed and label give the same number, in [0, 1)", () => {
    const x = draw(SEED, castLabel(3, 7));
    expect(draw(SEED, castLabel(3, 7))).toBe(x);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });

  it("changing the family or the cast number changes it", () => {
    const x = draw(SEED, castLabel(3, 7));
    expect(draw(SEED, castLabel(4, 7))).not.toBe(x);
    expect(draw(SEED, castLabel(3, 8))).not.toBe(x);
  });

  it("the label is cast:<family>:<n>", () => {
    expect(castLabel(12, 1)).toBe("cast:12:1");
  });

  it("the mean of 10,000 draws is within 0.01 of 0.5", () => {
    let sum = 0;
    for (let n = 1; n <= 10_000; n++) sum += draw(SEED, castLabel(1, n));
    expect(Math.abs(sum / 10_000 - 0.5)).toBeLessThanOrEqual(0.01);
  });

  it("seedHash is the SHA-256 of the seed's bytes", () => {
    expect(seedHash(SEED)).toBe(createHash("sha256").update(Buffer.from(SEED, "hex")).digest("hex"));
  });
});

describe("verifySeason", () => {
  const SEED = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
  const K = 300;
  const p = lakeParams(4);
  const T0 = 1_700_000_000_000;

  type Event = { at: number; kind: string; family?: number; net?: Net };

  // Writes the rows a store would, with the model: the stock before each row
  // from stockAt, and each cast's catch from its own draw.
  function build(events: Event[]): VerifyRow[] {
    const rows: VerifyRow[] = [
      { at: T0 - 5000, kind: "open", stockAfter: null },
      { at: T0 - 4000, kind: "join", family: 1, stockAfter: null },
      { at: T0, kind: "start", stockAfter: K },
    ];
    const n = new Map<number, number>();
    for (const e of events) {
      const prev = rows[rows.length - 1];
      const before = stockAt(prev.stockAfter as number, e.at - prev.at, p);
      if (e.kind !== "cast") {
        rows.push({ ...e, stockAfter: before });
        continue;
      }
      const family = e.family as number;
      const k = (n.get(family) ?? 0) + 1;
      n.set(family, k);
      const got = catchSize(capacity(e.net as Net), before, K, () => draw(SEED, castLabel(family, k)));
      rows.push({ ...e, got, stockAfter: before - got });
    }
    return rows;
  }

  // About 30 casts from four families over two years, a buy, a vote, a rule
  // and an end.
  function events(): Event[] {
    const out: Event[] = [];
    for (const yearStart of [0, 60_000]) {
      for (let k = 0; k < 4; k++) {
        for (let family = 1; family <= 4; family++) {
          const at = T0 + yearStart + k * 10_000 + family * 2000;
          const net: Net = family === 1 && (yearStart > 0 || k >= 2) ? "fine" : "coarse";
          out.push({ at, kind: "cast", family, net });
        }
      }
    }
    out.push({ at: T0 + 15_000, kind: "buy", family: 1 });
    out.push({ at: T0 + 50_000, kind: "vote", family: 2 });
    out.push({ at: T0 + 60_000, kind: "rule" });
    out.push({ at: T0 + 120_000, kind: "end" });
    return out.sort((a, b) => a.at - b.at);
  }

  const good = build(events());
  const opts = { seed: SEED, seedHash: seedHash(SEED), K };
  const castIndex = (from: number): number => good.findIndex((r, i) => i >= from && r.kind === "cast");

  it("a season built with the model verifies", () => {
    const casts = good.filter((r) => r.kind === "cast").length;
    expect(casts).toBeGreaterThanOrEqual(30);
    expect(verifySeason(good, opts)).toEqual({ ok: true, casts });
  });

  it("fails at a catch changed by +1", () => {
    const i = castIndex(10);
    const rows = good.map((r, j) => (j === i ? { ...r, got: (r.got as number) + 1 } : r));
    expect(verifySeason(rows, opts)).toMatchObject({ ok: false, index: i });
  });

  it("fails at a cast moved 1 s later", () => {
    // family 2's third cast in year 2, with the lake below K
    const i = good.findIndex((r) => r.kind === "cast" && r.at === T0 + 60_000 + 20_000 + 4000);
    expect(good[i + 1].at - good[i].at).toBeGreaterThan(1000);
    const rows = good.map((r, j) => (j === i ? { ...r, at: r.at + 1000 } : r));
    expect(verifySeason(rows, opts)).toMatchObject({ ok: false, index: i });
  });

  it("fails at a row whose stockAfter is changed by 0.5", () => {
    const i = good.findIndex((r) => r.kind === "vote");
    const rows = good.map((r, j) => (j === i ? { ...r, stockAfter: (r.stockAfter as number) + 0.5 } : r));
    expect(verifySeason(rows, opts)).toMatchObject({ ok: false, index: i });
  });

  it("fails with a different seed and the original hash", () => {
    const other = "ff" + SEED.slice(2);
    expect(verifySeason(good, { ...opts, seed: other })).toMatchObject({
      ok: false,
      why: "seed does not match",
    });
  });

  it("two casts at the same moment by different families verify in either order", () => {
    const at = T0 + 75_000;
    const base = events().filter((e) => e.at !== at);
    const a: Event = { at, kind: "cast", family: 2, net: "coarse" };
    const b: Event = { at, kind: "cast", family: 3, net: "coarse" };
    const insert = (first: Event, second: Event): Event[] =>
      [...base, first, second].sort((x, y) => x.at - y.at);
    expect(verifySeason(build(insert(a, b)), opts).ok).toBe(true);
    expect(verifySeason(build(insert(b, a)), opts).ok).toBe(true);
  });
});

describe("castingRate", () => {
  it.each([
    [72, 1],
    [36, 0.5],
    [100, 1],
  ])("4 families, 45 s of fishing, %d casts -> %d", (casts, want) => {
    expect(castingRate(casts, 4, 45_000)).toBe(want);
  });

  it("is 0 with no fishing time", () => {
    expect(castingRate(10, 4, 0)).toBe(0);
  });
});

describe("coarseCounterfactual", () => {
  it("4 families at 0.85: survives 18 of 20 seeds, total within 10% of the dilemma test's all-coarse", () => {
    // the dilemma test's all-coarse payoff: 40 seeds, four coarse nets
    let all = 0;
    for (let seed = 0; seed < 40; seed++) {
      all += simulateSeason(["coarse", "coarse", "coarse", "coarse"], seed).caught.reduce((a, b) => a + b, 0);
    }
    const want = all / 40;
    const { total, survived } = coarseCounterfactual(4, 0.85);
    expect(survived).toBeGreaterThanOrEqual(18);
    expect(Math.abs(total - want)).toBeLessThanOrEqual(0.1 * want);
  });
});
