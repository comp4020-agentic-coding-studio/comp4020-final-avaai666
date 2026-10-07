import { describe, expect, it } from "vitest";
import { FINE_COST, H, RX, RY, SHALLOW, W } from "../../src/lib/game-constants.ts";
import {
  type BreakView,
  botBreaks,
  botBuys,
  botNet,
  botRandom,
  botVote,
  breachOf,
  type Rule,
  tally,
  type VoteView,
} from "../../src/lib/rules.ts";
import { streamRng } from "../../src/lib/lake-sim.ts";

// The village meeting, breaches and the bots (DESIGN.md v2.1, "The village
// meeting" and "Bots"). Bots follow scripts; these tests check the scripts.
// Pure: no server.

const FISHING = { phase: "fish", spring: false } as const;
const SPRING = { phase: "fish", spring: true } as const;
const MIDDLE = { x: W / 2, y: H / 2 };

describe("tally (4 families)", () => {
  it.each([
    [["ban", "ban", "spring", "nursery"], "ban"], // 2 of 4, ahead of each other option
    [["spring", "spring", "nursery", "nursery"], "none"], // a tie
    [["nursery", "nursery", "nursery", "none"], "nursery"],
    [["ban", "spring", "nursery", "none"], "none"], // nothing reaches half
    [["ban", "ban", "spring", "spring"], "none"], // a tie at half
  ] as [Rule[], Rule][])("%j -> %s", (votes, want) => {
    expect(tally(votes, 4)).toBe(want);
  });

  it("a silent family counts as no rule", () => {
    expect(tally(["spring", "spring", "ban"], 4)).toBe("spring"); // 2 of 4, the silent one is none
    expect(tally(["spring", "ban"], 4)).toBe("none"); // none has 2 from the silent families
    expect(tally(["nursery", "nursery"], 4)).toBe("none"); // 2 against 2 silent: a tie
    expect(tally([], 4)).toBe("none");
  });
});

describe("breachOf", () => {
  it("no rule: never a breach", () => {
    expect(breachOf("none", SPRING, 900, 350, true)).toBe(false);
  });

  it("ban: a fine net, and only a fine net", () => {
    expect(breachOf("ban", FISHING, MIDDLE.x, MIDDLE.y, true)).toBe(true);
    expect(breachOf("ban", FISHING, MIDDLE.x, MIDDLE.y, false)).toBe(false);
  });

  it("spring closure: any throw in spring, none after it", () => {
    expect(breachOf("spring", SPRING, MIDDLE.x, MIDDLE.y, false)).toBe(true);
    expect(breachOf("spring", FISHING, MIDDLE.x, MIDDLE.y, true)).toBe(false);
  });

  it("protected shallows: a net landing in the shallows, including exactly on the line", () => {
    const onLine = W / 2 + SHALLOW * RX; // on the long axis
    expect(breachOf("nursery", FISHING, onLine, H / 2, false)).toBe(true);
    expect(breachOf("nursery", FISHING, W / 2 + 0.99 * SHALLOW * RX, H / 2, false)).toBe(false);
    expect(breachOf("nursery", FISHING, W / 2, H / 2 + 0.9 * RY, true)).toBe(true);
    expect(breachOf("nursery", FISHING, MIDDLE.x, MIDDLE.y, true)).toBe(false);
  });
});

describe("bots buy", () => {
  it("Jin buys as soon as his basket holds 20", () => {
    expect(botBuys("greedy", { basket: FINE_COST - 1, hasFine: false, othersFine: 0 })).toBe(false);
    expect(botBuys("greedy", { basket: FINE_COST, hasFine: false, othersFine: 0 })).toBe(true);
    expect(botBuys("greedy", { basket: 100, hasFine: true, othersFine: 0 })).toBe(false);
  });

  it("Mei buys once two other families have one", () => {
    expect(botBuys("follower", { basket: 100, hasFine: false, othersFine: 1 })).toBe(false);
    expect(botBuys("follower", { basket: 100, hasFine: false, othersFine: 2 })).toBe(true);
  });

  it("Old Wang never buys", () => {
    expect(botBuys("careful", { basket: 1000, hasFine: false, othersFine: 3 })).toBe(false);
  });
});

describe("bots break rules", () => {
  const view = (over: Partial<BreakView>): BreakView => ({
    rule: "ban",
    year: 3,
    angerOnMe: [],
    breachesByOthers: [],
    ...over,
  });

  it("Jin keeps a rule only after two different families stamp 怒 in the same year", () => {
    expect(botBreaks("greedy", view({}))).toBe(true);
    expect(botBreaks("greedy", view({ angerOnMe: [{ from: 1, year: 3 }] }))).toBe(true);
    expect(botBreaks("greedy", view({ angerOnMe: [{ from: 1, year: 3 }, { from: 2, year: 3 }] }))).toBe(false);
  });

  it("one family stamping twice is not enough", () => {
    expect(botBreaks("greedy", view({ angerOnMe: [{ from: 1, year: 3 }, { from: 1, year: 3 }] }))).toBe(true);
  });

  it("it resets the next year", () => {
    const anger = [{ from: 1, year: 3 }, { from: 2, year: 3 }];
    expect(botBreaks("greedy", view({ angerOnMe: anger }))).toBe(false);
    expect(botBreaks("greedy", view({ angerOnMe: anger, year: 4 }))).toBe(true);
  });

  it("Mei breaks a rule after two breaches by others that year, and stops after one 怒", () => {
    expect(botBreaks("follower", view({ breachesByOthers: [{ family: 1, year: 3 }] }))).toBe(false);
    expect(botBreaks("follower", view({ breachesByOthers: [{ family: 1, year: 2 }, { family: 1, year: 3 }] }))).toBe(false);
    const two = [{ family: 1, year: 3 }, { family: 2, year: 3 }];
    expect(botBreaks("follower", view({ breachesByOthers: two }))).toBe(true);
    expect(botBreaks("follower", view({ breachesByOthers: two, angerOnMe: [{ from: 4, year: 3 }] }))).toBe(false);
  });

  it("Old Wang keeps every rule; nobody breaks no rule", () => {
    const loud = view({ breachesByOthers: [{ family: 1, year: 3 }, { family: 2, year: 3 }, { family: 1, year: 3 }] });
    for (const rule of ["ban", "spring", "nursery"] as Rule[]) expect(botBreaks("careful", { ...loud, rule })).toBe(false);
    for (const kind of ["careful", "greedy", "follower"] as const) {
      expect(botBreaks(kind, { ...loud, rule: "none" })).toBe(false);
    }
  });

  it("botNet: a fine net only when the bot owns one and a ban is not kept", () => {
    expect(botNet(true, "none", false)).toBe(true);
    expect(botNet(true, "ban", false)).toBe(false);
    expect(botNet(true, "ban", true)).toBe(true);
    expect(botNet(false, "ban", true)).toBe(false);
  });
});

describe("bots vote", () => {
  const view = (over: Partial<VoteView>): VoteView => ({
    anyFine: false,
    maxFryTaken: 0,
    adults: 100,
    startAdults: 100,
    humanVotes: [],
    humans: 1,
    ...over,
  });

  it("Old Wang votes 禁 once anyone has a fine net", () => {
    expect(botVote("careful", view({ anyFine: true, maxFryTaken: 50, adults: 10 }))).toBe("ban");
  });

  it("otherwise 护 once anyone has taken more than 6 fry", () => {
    expect(botVote("careful", view({ maxFryTaken: 7, adults: 10 }))).toBe("nursery");
    expect(botVote("careful", view({ maxFryTaken: 6 }))).toBe("none");
  });

  it("otherwise 休 when grown fish are below 60% of the start", () => {
    expect(botVote("careful", view({ adults: 59 }))).toBe("spring");
    expect(botVote("careful", view({ adults: 60 }))).toBe("none");
  });

  it("otherwise no rule", () => {
    expect(botVote("careful", view({}))).toBe("none");
  });

  it("Jin votes no rule; Mei votes as the humans have so far", () => {
    expect(botVote("greedy", view({ anyFine: true, adults: 1 }))).toBe("none");
    expect(botVote("follower", view({ humanVotes: ["spring"], humans: 1 }))).toBe("spring");
    expect(botVote("follower", view({ humanVotes: ["spring"], humans: 2 }))).toBe("none");
  });
});

describe("botRandom", () => {
  it("is the same for the same arguments, and in [0, 1)", () => {
    for (let step = 0; step < 200; step++) {
      for (let fam = 0; fam < 4; fam++) {
        const x = botRandom("s", step, fam, 0);
        expect(botRandom("s", step, fam, 0)).toBe(x);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(1);
      }
    }
  });

  it("changes with each argument", () => {
    const x = botRandom("s", 10, 1, 0);
    expect(botRandom("t", 10, 1, 0)).not.toBe(x);
    expect(botRandom("s", 11, 1, 0)).not.toBe(x);
    expect(botRandom("s", 10, 2, 0)).not.toBe(x);
    expect(botRandom("s", 10, 1, 1)).not.toBe(x);
  });

  it("is the first draw of the stream SHA-256(secret | bot | step | family | k)", () => {
    expect(botRandom("s", 10, 1, 2)).toBe(streamRng("s", "bot|10|1|2")());
  });
});
