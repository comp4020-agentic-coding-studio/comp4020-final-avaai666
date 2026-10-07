import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { simulateSeason } from "../../src/lib/lake-sim.ts";
import type { Rule } from "../../src/lib/rules.ts";

// What the rules do (DESIGN.md v2.0, "What the rules do"): four families, k
// with fine nets, each rule kept by everyone from year 2, 12 seeded seasons.
// Must reproduce sim/rules_output.txt. Pure: no server.

const SEEDS = 12;
const RULES: Rule[] = ["none", "ban", "spring", "nursery"];

type Result = { deaths: number; catch: number; endA: number };

// "2 fine, rule from year 2: none     deaths 12/12  table catch 392  end adults 0"
const saved = new Map<string, Result>(
  readFileSync(new URL("../../sim/rules_output.txt", import.meta.url), "utf8")
    .split("\n")
    .flatMap((line) => {
      const m = /^(\d) fine, rule from year 2: (\w+)\s+deaths (\d+)\/\d+  table catch (\d+)  end adults (\d+)$/.exec(line);
      return m ? [[`${m[1]} ${m[2]}`, { deaths: Number(m[3]), catch: Number(m[4]), endA: Number(m[5]) }] as const] : [];
    }),
);

describe("the rules", { timeout: 180_000 }, () => {
  const got = new Map<string, Result>();

  beforeAll(() => {
    for (const k of [2, 4]) {
      for (const rule of RULES) {
        let deaths = 0;
        let tot = 0;
        let endA = 0;
        for (let s = 0; s < SEEDS; s++) {
          const r = simulateSeason([0, 1, 2, 3].map((i) => i < k), 2000 + s, { take: 0.85, ruleFrom2: rule });
          if (r.died !== null) deaths++;
          tot += r.caught.reduce((a, b) => a + b, 0);
          endA += r.endAdults;
        }
        got.set(`${k} ${rule}`, { deaths, catch: tot / SEEDS, endA: endA / SEEDS });
      }
    }
  }, 180_000);

  for (const k of [2, 4]) {
    for (const rule of RULES) {
      it(`${k} fine nets, ${rule} from year 2, reproduces sim/rules_output.txt`, () => {
        const want = saved.get(`${k} ${rule}`);
        const have = got.get(`${k} ${rule}`);
        expect(want).toBeDefined();
        expect(have?.deaths).toBe(want?.deaths);
        expect(Math.abs((have?.catch ?? NaN) - (want?.catch ?? NaN))).toBeLessThanOrEqual(0.5);
        expect(Math.abs((have?.endA ?? NaN) - (want?.endA ?? NaN))).toBeLessThanOrEqual(0.5);
      });
    }
  }

  it("with 2 fine nets: no rule loses the lake in at least 10 of 12; each rule in at most 1", () => {
    expect(got.get("2 none")?.deaths).toBeGreaterThanOrEqual(10);
    for (const rule of ["ban", "spring", "nursery"]) expect(got.get(`2 ${rule}`)?.deaths).toBeLessThanOrEqual(1);
  });
});
