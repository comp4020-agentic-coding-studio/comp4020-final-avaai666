import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { FINE_COST } from "../../src/lib/game-constants.ts";
import { simulateSeason } from "../../src/lib/lake-sim.ts";

// The claim the game rests on (DESIGN.md v2.0, "Why it is a dilemma"): four
// families who aim at the densest school and take 85% of their chances, over
// 24 seeded seasons. simulateSeason is the twin of season() in sim/payoff.mjs,
// so the table must be the one sim/payoff_output.txt holds. Pure: no server.

const SEEDS = 24;
const FAMILIES = 4;

type Row = { pay: number[]; deaths: number; endA: number };

// "k fine: pay  133  132  133  125  deaths 0  endAdults 88"
const saved: Row[] = readFileSync(new URL("../../sim/payoff_output.txt", import.meta.url), "utf8")
  .split("\n")
  .flatMap((line) => {
    const m = /^(\d) fine: pay (.+?)  deaths (\d+)  endAdults (\d+)$/.exec(line);
    return m ? [{ pay: m[2].trim().split(/\s+/).map(Number), deaths: Number(m[3]), endA: Number(m[4]) }] : [];
  });

describe("the dilemma", { timeout: 180_000 }, () => {
  const table: Row[] = [];

  beforeAll(() => {
    for (let k = 0; k <= FAMILIES; k++) {
      const nets = Array.from({ length: FAMILIES }, (_, i) => i < k);
      const tot = nets.map(() => 0);
      let deaths = 0;
      let endA = 0;
      for (let s = 0; s < SEEDS; s++) {
        const r = simulateSeason(nets, 1000 + s);
        r.caught.forEach((c, i) => (tot[i] += c));
        if (r.died !== null) deaths++;
        endA += r.endAdults;
      }
      table.push({ pay: tot.map((t, i) => t / SEEDS - (nets[i] ? FINE_COST : 0)), deaths, endA: endA / SEEDS });
    }
    console.log(
      `fish kept per family (4 families, ${SEEDS} seeds)\n` +
        table
          .map((r, k) => `  ${k} fine: ${r.pay.map((x) => x.toFixed(0).padStart(4)).join(" ")}  deaths ${r.deaths}  endAdults ${r.endA.toFixed(0)}`)
          .join("\n"),
    );
  }, 180_000);

  it("the table equals sim/payoff_output.txt", () => {
    expect(saved).toHaveLength(FAMILIES + 1);
    table.forEach((row, k) => {
      row.pay.forEach((p, i) => expect(Math.abs(p - saved[k].pay[i])).toBeLessThanOrEqual(0.5));
      expect(row.deaths).toBe(saved[k].deaths);
      expect(Math.abs(row.endA - saved[k].endA)).toBeLessThanOrEqual(0.5);
    });
  });

  for (const k of [0, 1, 2, 3]) {
    it(`with ${k} other fine nets, switching to fine pays`, () => {
      const stay = table[k].pay[3]; // the last family, still coarse
      const swap = table[k + 1].pay[k]; // the same family, now fine
      expect(swap).toBeGreaterThan(stay);
    });
  }

  it("all fine: each family keeps less than 55% of all coarse", () => {
    for (let i = 0; i < FAMILIES; i++) expect(table[4].pay[i]).toBeLessThan(0.55 * table[0].pay[i]);
  });

  it("all coarse: the lake dies in 0 of 24; all fine: in 24 of 24", () => {
    expect(table[0].deaths).toBe(0);
    expect(table[4].deaths).toBe(SEEDS);
  });
});
