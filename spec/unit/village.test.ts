import { describe, expect, it } from "vitest";
import { FINE_COST, HOUSE_PARTS } from "../../src/lib/game-constants.ts";
import {
  botAnswersPromise,
  botKeepsPromise,
  breaksPromise,
  buildWinter,
  canBuyFine,
  type Pledge,
  pledgeOpen,
} from "../../src/lib/village.ts";

// Houses, the fine net and promises (DESIGN.md v2.1, "Basket, house and fine
// net" and "Promises"). Bots follow scripts; these tests check the scripts.
// Pure: no server.

const HUT = 0;
const RED_GATE = HOUSE_PARTS.findIndex((p) => p.name === "red gate");
const PAGODA = HOUSE_PARTS.length - 1;

describe("buildWinter", () => {
  it("the parts and their prices are DESIGN v2.1's", () => {
    expect(HOUSE_PARTS.map((p) => [p.name, p.cost])).toEqual([
      ["hut", 0],
      ["tiled roof", 25],
      ["red gate", 35],
      ["lanterns", 50],
      ["upper floor", 60],
      ["pagoda", 70],
    ]);
  });

  it.each([
    [0, HUT, []],
    [24, HUT, []],
    [25, 1, ["tiled roof"]],
    [60, RED_GATE, ["tiled roof", "red gate"]],
    [61, RED_GATE, ["tiled roof", "red gate"]],
    [400, PAGODA, ["tiled roof", "red gate", "lanterns", "upper floor", "pagoda"]],
  ])("from a hut, %d fish", (basket, part, built) => {
    const spent = (built as string[]).reduce((n, name) => n + (HOUSE_PARTS.find((p) => p.name === name)?.cost ?? NaN), 0);
    expect(buildWinter(basket, HUT)).toEqual({ part, built, left: basket - spent });
  });

  it.each([
    [0, RED_GATE, [], 0],
    [24, RED_GATE, [], 24],
    [25, RED_GATE, [], 25],
    [60, RED_GATE + 1, ["lanterns"], 10],
    [61, RED_GATE + 1, ["lanterns"], 11],
    [400, PAGODA, ["lanterns", "upper floor", "pagoda"], 220],
  ])("from a red gate, %d fish", (basket, part, built, left) => {
    expect(buildWinter(basket, RED_GATE)).toEqual({ part, built, left });
  });

  it("a pagoda takes nothing more", () => {
    expect(buildWinter(500, PAGODA)).toEqual({ part: PAGODA, built: [], left: 500 });
  });

  it("a house never loses a part", () => {
    for (let part = 0; part <= PAGODA; part++) {
      for (let basket = 0; basket <= 300; basket += 7) {
        const r = buildWinter(basket, part);
        expect(r.part).toBeGreaterThanOrEqual(part);
        expect(r.left).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("canBuyFine", () => {
  const fishing = { phase: "fish" } as const;

  it("19 no, 20 yes", () => {
    expect(canBuyFine(FINE_COST - 1, false, fishing)).toBe(false);
    expect(canBuyFine(FINE_COST, false, fishing)).toBe(true);
  });

  it("already owned: no", () => {
    expect(canBuyFine(100, true, fishing)).toBe(false);
  });

  it("in winter: no", () => {
    expect(canBuyFine(100, false, { phase: "meet" })).toBe(false);
    expect(canBuyFine(100, false, { phase: "over" })).toBe(false);
  });
});

describe("promises", () => {
  const pledge: Pledge = { from: 0, to: 1, year: 2 };
  const fishing = { year: 2, phase: "fish" } as const;

  it("a fine net while promised breaks the promise", () => {
    expect(breaksPromise(pledge, fishing, true)).toBe(true);
  });

  it("a coarse net does not", () => {
    expect(breaksPromise(pledge, fishing, false)).toBe(false);
  });

  it("no promise, nothing to break", () => {
    expect(breaksPromise(null, fishing, true)).toBe(false);
  });

  it("after winter the promise is over", () => {
    expect(pledgeOpen(pledge, fishing)).toBe(true);
    expect(pledgeOpen(pledge, { year: 2, phase: "meet" })).toBe(false);
    expect(pledgeOpen(pledge, { year: 3, phase: "fish" })).toBe(false);
    expect(breaksPromise(pledge, { year: 3, phase: "fish" }, true)).toBe(false);
  });
});

describe("bots answer a promise", () => {
  const none = { hasFine: false, othersFine: 0 };
  const ownsFine = { hasFine: true, othersFine: 0 };
  const twoOthers = { hasFine: false, othersFine: 2 };

  it("Old Wang always accepts, and keeps it", () => {
    for (const v of [none, ownsFine, twoOthers]) expect(botAnswersPromise("careful", v)).toBe(true);
    expect(botKeepsPromise("careful", 0)).toBe(true);
  });

  it("Mei accepts unless two others own fine nets, and keeps it", () => {
    expect(botAnswersPromise("follower", none)).toBe(true);
    expect(botAnswersPromise("follower", ownsFine)).toBe(true);
    expect(botAnswersPromise("follower", { hasFine: false, othersFine: 1 })).toBe(true);
    expect(botAnswersPromise("follower", twoOthers)).toBe(false);
    expect(botKeepsPromise("follower", 0)).toBe(true);
  });

  it("Jin accepts only without a fine net, and breaks it when his draw is below 0.5", () => {
    expect(botAnswersPromise("greedy", none)).toBe(true);
    expect(botAnswersPromise("greedy", twoOthers)).toBe(true);
    expect(botAnswersPromise("greedy", ownsFine)).toBe(false);
    expect(botKeepsPromise("greedy", 0.49)).toBe(false);
    expect(botKeepsPromise("greedy", 0.5)).toBe(true);
  });
});
