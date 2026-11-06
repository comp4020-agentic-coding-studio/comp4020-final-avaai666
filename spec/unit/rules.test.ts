import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulateSeason } from "../../src/lib/lake-sim.ts";
import type { Rule } from "../../src/lib/rules.ts";

// What the rules do (DESIGN.md v2.1, "What the simulations show"): four
// families, k planning fine nets, each rule kept by everyone from year 2, 12
// secrets. The same loop as sim/rules.mjs, printed the same way, must give
// sim/rules_output.txt line for line. Pure: no server.
//
// Timeout raised from 180 s to 360 s on 7 November 2026. The full unit suite
// failed here with "Test timed out in 180000ms" (204 s); the file alone then
// passed in 123 s. The test is pure (fixed seeds, no server, no clock) and
// compares against a golden file, so a wrong result would fail the same way
// on every run: the failure was the time budget, not behaviour. It runs 96
// full seasons (2 k x 4 rules x 12 secrets), so 180 s left about 1.5x
// headroom over an idle run, which went as soon as 31 files ran in parallel
// on 8 cores. No assertion was altered and sim/rules_output.txt is untouched.

const S = 12;
const RULES: Rule[] = ["none", "ban", "spring", "nursery"];

describe("the rules", { timeout: 360_000 }, () => {
  it("reproduces sim/rules_output.txt exactly", () => {
    const lines: string[] = [];
    for (const k of [2, 4]) {
      for (const rule of RULES) {
        let d = 0,
          tot = 0,
          endA = 0,
          next = 0;
        for (let s = 0; s < S; s++) {
          const r = simulateSeason([0, 1, 2, 3].map((i) => i < k), `rules-${s}`, { ruleFrom2: rule });
          if (r.died !== null) d++;
          tot += r.kept.reduce((a, b) => a + b, 0);
          endA += r.endAdults;
          next += r.nextYearAdults;
        }
        lines.push(
          `${k} fine, rule from year 2: ${rule.padEnd(8)} lake died ${d}/${S}  table kept ${(tot / S).toFixed(0)}  grown fish at the end ${(endA / S).toFixed(0)}  next year ${(next / S).toFixed(0)}`,
        );
      }
    }
    console.log(lines.join("\n"));
    const saved = readFileSync(new URL("../../sim/rules_output.txt", import.meta.url), "utf8").trimEnd().split("\n");
    expect(lines).toEqual(saved);
  }, 360_000);
});
