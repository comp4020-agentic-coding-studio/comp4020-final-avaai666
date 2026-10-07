import { describe, expect, it } from "vitest";
import { FINE_COST } from "../../src/lib/game-constants.ts";
import { type Net, simulateSeason } from "../../src/lib/lake.ts";

// The claim the whole game rests on (DESIGN.md v1.0, "Why it is a dilemma"):
// buying a fine net always pays for the family that buys it, and the table
// is far worse off when everyone does. Seasons are simulated as in
// sim/payoff.py, averaged over seeded runs. Pure: no server.

const SEEDS = 40;
const seeds = [...Array(SEEDS).keys()];

const nets = (fine: number, families = 4): Net[] =>
  Array.from({ length: families }, (_, i) => (i < fine ? "fine" : "coarse"));

// Average payoff per family over SEEDS seasons: fish caught, minus the net's
// cost for a fine net.
function payoff(ns: Net[]): number[] {
  const total = ns.map(() => 0);
  for (const seed of seeds) {
    simulateSeason(ns, seed).caught.forEach((c, i) => (total[i] += c));
  }
  return total.map((t, i) => t / SEEDS - (ns[i] === "fine" ? FINE_COST : 0));
}

function deaths(ns: Net[]): number {
  return seeds.filter((seed) => simulateSeason(ns, seed).diedInYear !== null).length;
}

const table = [0, 1, 2, 3, 4].map((k) => payoff(nets(k)));
console.log(
  "payoff per family after paying for a fine net (4 families, 40 seeds)\n" +
    table.map((row, k) => `  ${k} fine: ${row.map((x) => x.toFixed(0).padStart(4)).join(" ")}`).join("\n"),
);

describe("four families", () => {
  for (const k of [0, 1, 2, 3]) {
    it(`with ${k} other fine nets, switching to fine pays`, () => {
      const stay = table[k][3]; // the last family, still coarse
      const swap = table[k + 1][k]; // the same family, now with a fine net
      expect(swap).toBeGreaterThan(stay);
    });
  }

  it("all fine: each family gets less than half of all coarse", () => {
    for (let i = 0; i < 4; i++) expect(table[4][i]).toBeLessThan(table[0][i] / 2);
  });

  it("all coarse: the lake survives six years in at least 36 of 40 seeds", () => {
    expect(SEEDS - deaths(nets(0))).toBeGreaterThanOrEqual(36);
  });

  for (const k of [3, 4]) {
    it(`${k} fine nets: the lake dies within six years in at least 30 of 40 seeds`, () => {
      expect(deaths(nets(k))).toBeGreaterThanOrEqual(30);
    });
  }
});

describe("two families", () => {
  it("two fine nets kill the lake in at least 30 of 40 seeds", () => {
    expect(deaths(nets(2, 2))).toBeGreaterThanOrEqual(30);
  });

  it("two coarse nets never do", () => {
    expect(deaths(nets(0, 2))).toBe(0);
  });
});
