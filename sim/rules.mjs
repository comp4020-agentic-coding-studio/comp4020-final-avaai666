// What the three village rules do (DESIGN.md v2.0, "What the rules do").
// Four families, k of them with fine nets; from year 2 everyone keeps the
// rule. 12 seeded seasons each. Output saved as rules_output.txt.
import { season } from "./payoff.mjs";
for (const k of [2, 4]) for (const rule of ["none", "ban", "spring", "nursery"]) {
  let d = 0, tot = 0, endA = 0; const S = 12;
  for (let s = 0; s < S; s++) {
    const r = season([0, 1, 2, 3].map((i) => i < k), 2000 + s, {}, 0.85, rule);
    if (r.died !== null) d++;
    tot += r.caught.reduce((a, b) => a + b, 0);
    endA += r.endAdults;
  }
  console.log(`${k} fine, rule from year 2: ${rule.padEnd(8)} deaths ${d}/${S}  table catch ${(tot / S).toFixed(0)}  end adults ${(endA / S).toFixed(0)}`);
}
