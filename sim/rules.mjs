// What the three village rules do (model v2.1). Four families, k of them
// planning fine nets; from year 2 everyone keeps the rule. Run: node sim/rules.mjs 12
import { season } from "./season.mjs";

const S = Number(process.argv[2] || 12);
for (const k of [2, 4]) for (const rule of ["none", "ban", "spring", "nursery"]) {
  let d = 0, tot = 0, endA = 0, next = 0;
  for (let s = 0; s < S; s++) {
    const r = season([0, 1, 2, 3].map((i) => i < k), `rules-${s}`, { ruleFrom2: rule });
    if (r.died !== null) d++;
    tot += r.kept.reduce((a, b) => a + b, 0);
    endA += r.endAdults; next += r.nextYearAdults;
  }
  console.log(`${k} fine, rule from year 2: ${rule.padEnd(8)} lake died ${d}/${S}  table kept ${(tot / S).toFixed(0)}  grown fish at the end ${(endA / S).toFixed(0)}  next year ${(next / S).toFixed(0)}`);
}
