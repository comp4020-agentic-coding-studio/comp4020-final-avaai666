import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { type Paired, paired } from "../../src/lib/lake-sim.ts";

// The dilemma, compared fairly (DESIGN.md v2.1, "What the simulations show").
// Each family is compared with itself: the same secret and the same seat, once
// keeping a coarse net and once buying a fine net as soon as its basket can
// pay. paired() is the twin of paired() in sim/payoff.mjs, so its numbers must
// be the ones sim/payoff_output_8.txt holds. These are results for the
// strategies, parameters and seeds in sim/, not claims about people. Pure: no
// server.

const SEEDS = 8;

type Saved = {
  rows: { stay: number; swap: number; wins: number; n: number }[];
  allC: number;
  deadC: number;
  nextC: number;
  allF: number;
  deadF: number;
  nextF: number;
};

function load(): Saved {
  const text = readFileSync(new URL("../../sim/payoff_output_8.txt", import.meta.url), "utf8");
  const rows = [...text.matchAll(/^others with fine nets (\d): keep coarse ([\d.]+)  switch ([\d.]+)  switching paid in (\d+)\/(\d+)$/gm)].map(
    (m) => ({ stay: Number(m[2]), swap: Number(m[3]), wins: Number(m[4]), n: Number(m[5]) }),
  );
  const all = (which: string) => {
    const m = new RegExp(`^all ${which}:\\s+([\\d.]+) each, lake died (\\d+)/\\d+, grown fish next year ([\\d.]+)$`, "m").exec(text);
    if (!m) throw new Error(`no "all ${which}" line`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const [allC, deadC, nextC] = all("coarse");
  const [allF, deadF, nextF] = all("fine");
  return { rows, allC, deadC, nextC, allF, deadF, nextF };
}

describe("the dilemma, paired", { timeout: 180_000 }, () => {
  const saved = load();
  let r: Paired;

  beforeAll(() => {
    r = paired(SEEDS);
    console.log(
      `paired comparison, ${SEEDS} seeds x 4 seats (fish kept, after paying for a fine net)\n` +
        r.rows
          .map((row) => `  others with fine nets ${row.k}: keep coarse ${row.stay.toFixed(1)}  switch ${row.swap.toFixed(1)}  switching paid in ${row.wins}/${row.n}`)
          .join("\n") +
        `\n  all coarse: ${r.allC.toFixed(1)} each, lake died ${r.deadC}/${SEEDS}, grown fish next year ${r.nextC.toFixed(1)}` +
        `\n  all fine:   ${r.allF.toFixed(1)} each, lake died ${r.deadF}/${SEEDS}, grown fish next year ${r.nextF.toFixed(1)}`,
    );
  }, 180_000);

  it("reproduces sim/payoff_output_8.txt", () => {
    expect(saved.rows).toHaveLength(4);
    r.rows.forEach((row, k) => {
      expect(Math.abs(row.stay - saved.rows[k].stay)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(row.swap - saved.rows[k].swap)).toBeLessThanOrEqual(0.05);
      expect(row.wins).toBe(saved.rows[k].wins);
      expect(row.n).toBe(saved.rows[k].n);
    });
    expect(Math.abs(r.allC - saved.allC)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r.allF - saved.allF)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r.nextC - saved.nextC)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r.nextF - saved.nextF)).toBeLessThanOrEqual(0.05);
    expect(r.deadC).toBe(saved.deadC);
    expect(r.deadF).toBe(saved.deadF);
  });

  // Not tested: switching when three others have fine nets. It does not pay,
  // and DESIGN.md v2.1 says so.
  for (const k of [0, 1, 2]) {
    it(`with ${k} other fine nets, switching pays on average`, () => {
      expect(r.rows[k].swap).toBeGreaterThan(r.rows[k].stay);
    });
  }

  it("all fine keeps less than 55% of all coarse", () => {
    expect(r.allF).toBeLessThan(0.55 * r.allC);
  });

  it("the lake dies in 0 of 8 seasons all coarse and 8 of 8 all fine", () => {
    expect(r.deadC).toBe(0);
    expect(r.deadF).toBe(SEEDS);
  });
});
