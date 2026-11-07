import { describe, expect, it } from "vitest";
import { fillScoreTier } from "../../src/lib/score-tier.ts";
import type { Summary } from "../../src/lib/game-store.ts";
import { hold } from "../../src/lib/modes/hold.ts";
import { party } from "../../src/lib/modes/party.ts";
import { poach } from "../../src/lib/modes/poach.ts";
import { rush, rushFinal } from "../../src/lib/modes/rush.ts";
import { tierOf } from "../../src/lib/lake-world.ts";
import type { Seat } from "../../src/lib/game-platform.ts";

// DESIGN.md "The podium's tier and final score" (v5.16). The server sends the
// tier and each seat's final number; no page computes either. Summaries stored
// before v5.16 have neither, and the server fills them in when it serves them.
//
// The four old-record tests below pin the fill-in to what each mode's page
// computed before v5.16, written out here as the page wrote it (boot data's
// TIERS, K 340, `n >= min * k`), so a later change to the formula fails them.
// They are the whole risk of the fill-in: a silent change to the verdict on a
// result already recorded on the live site.
const OLD_TIERS = [[0.6, "rich", 1.2], [0.35, "fair", 1], [0.15, "lean", 0.8], [0, "none", 0.5]] as const;
const oldPageTierOf = (n: number): { id: string; mult: number } => { for (const [min, id, mult] of OLD_TIERS) if (n >= min * 340) return { id, mult }; return { id: "none", mult: 0.5 }; };

const seat = (s: number, score: number, detail: Record<string, unknown> = {}) => ({ seat: s, name: `P${s}`, bot: false, character: "mei" as const, inputs: {}, firstScoreS: null, score, place: 1, detail });
const old = (mode: string, lakeAfter: number, seats: ReturnType<typeof seat>[], extra?: Record<string, unknown>): Summary =>
  ({ mode, model: `${mode} old`, durationS: 1, lakeBefore: 280, lakeAfter, rematchBy: null, seats, highlights: [], ...(extra ? { extra } : {}) });
// lakes on and either side of every tier line, and a dead lake
const LAKES = [0, 50, 51, 52, 118, 119, 120, 203, 204, 205, 340];

describe("a summary stored before v5.16 gets the tier and final the page used to compute", () => {
  it("Boat Rush: tier from lakeAfter; final is the stored score times the tier, rounded (rush.js before v5.16)", () => {
    for (const lakeAfter of LAKES) {
      const f = fillScoreTier(old("rush", lakeAfter, [seat(0, 17), seat(1, 5), seat(2, 0)], { fairShare: 7 }));
      const was = oldPageTierOf(lakeAfter);
      expect(f.extra!.scoreTier, `lake ${lakeAfter}`).toEqual(was);
      expect(f.seats.map((x) => x.final), `lake ${lakeAfter}`).toEqual([17, 5, 0].map((n) => Math.round(n * was.mult)));
      expect(f.seats.map((x) => x.score)).toEqual([17, 5, 0]); // the ranking basis is untouched
    }
  });

  it("Lake Holdings: tier from extra.next, or none for a dead lake; final is the stored score (hold.js before v5.16)", () => {
    for (const next of LAKES) for (const dead of [false, true]) {
      const f = fillScoreTier(old("hold", 31, [seat(0, 48, { base: 40 }), seat(1, 24, { base: 20 })], { next, tier: "x", dead }));
      expect(f.extra!.scoreTier, `next ${next} dead ${dead}`).toEqual(dead ? { id: "none", mult: 0.5 } : oldPageTierOf(next));
      expect(f.seats.map((x) => x.final)).toEqual([48, 24]);
    }
  });

  it("Fishing Party: tier from extra.next; final is the stored score (party.js before v5.16)", () => {
    for (const next of LAKES) {
      const f = fillScoreTier(old("party", 300, [seat(0, 31, { base: 26 }), seat(1, 12, { base: 10 })], { next }));
      expect(f.extra!.scoreTier, `next ${next}`).toEqual(oldPageTierOf(next));
      expect(f.seats.map((x) => x.final)).toEqual([31, 12]);
    }
  });

  it("Who's Poaching: tier from extra.next; final is the stored score (poach.js before v5.16)", () => {
    for (const next of LAKES) {
      const f = fillScoreTier(old("poach", 300, [seat(0, 32, { base: 10, won: true }), seat(1, 6, { base: 6, won: false })], { next, winner: "fishers" }));
      expect(f.extra!.scoreTier, `next ${next}`).toEqual(oldPageTierOf(next));
      expect(f.seats.map((x) => x.final)).toEqual([32, 6]);
    }
  });

  it("a summary that already has its tier and finals is served as stored, and the fill-in writes nothing back into its argument", () => {
    const stored = old("rush", 300, [seat(0, 17)]);
    const before = JSON.stringify(stored);
    fillScoreTier(stored);
    expect(JSON.stringify(stored)).toBe(before);
    const now = { ...stored, extra: { scoreTier: { id: "lean", mult: 0.8 } }, seats: [{ ...stored.seats[0], final: 99 }] };
    expect(fillScoreTier(now)).toEqual(now);
  });
});

const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));

describe("each mode's results() says the tier and every seat's final number", () => {
  it("Boat Rush: final = rushFinal(score, tier); score and place stay the unmultiplied base", () => {
    const s = rush.make("st-rush", people(2), { fish: 280, adults: 224, young: 56 });
    s.boats[0].banked = 17; s.boats[1].banked = 4;
    const r = rush.results(s), tier = tierOf(r.lakeLeft);
    expect(r.scoreTier).toEqual(tier);
    for (const x of r.seats) expect(x.final).toBe(rushFinal(x.score, tier.mult));
    expect(r.seats.find((x) => x.seat === 0)!.score).toBe(17);
    expect(rushFinal(17, 0.8)).toBe(14); expect(rushFinal(17, 0.5)).toBe(9); expect(rushFinal(17, 1.2)).toBe(20);
  });
  it("Lake Holdings, Fishing Party, Who's Poaching: final is the score, which already carries the tier", () => {
    const h = hold.make("st-hold", people(2), { fish: 280, adults: 224, young: 56, boats: 2 });
    const p = party.make("st-party", people(2), { fish: 280, adults: 224, young: 56 }); p.coins = [10, 4]; p.phase = "end";
    const q = poach.make("st-poach", people(4), { fish: 280, adults: 224, young: 56 }); q.phase = "end"; q.winner = "fishers";
    for (const r of [hold.results(h), party.results(p), poach.results(q)]) {
      expect(r.scoreTier).toEqual(r.dead ? { id: "none", mult: 0.5 } : tierOf(r.next as number));
      expect((r.scoreTier as { id: string }).id).toBe(r.tier); // the same tier the mode already named
      for (const x of r.seats) expect(x.final).toBe(x.score);
    }
  });
});
