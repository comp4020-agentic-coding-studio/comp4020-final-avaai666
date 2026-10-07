// The dilemma, compared fairly (model v2.1). For each seed, each family in
// turn is the "focal" family; k of the other three plan fine nets. The same
// seed is played twice: once with the focal family keeping a coarse net, once
// with it planning a fine net. Same lake, same family, same seat: the only
// difference is its own net. Run: node sim/payoff.mjs 24
import { season } from "./season.mjs";

export function paired(seeds) {
  const cache = new Map();
  const play = (s, fineSet) => {
    const key = `${s}|${[...fineSet].sort().join(",")}`;
    if (!cache.has(key)) cache.set(key, season([0, 1, 2, 3].map((i) => fineSet.has(i)), `season-${s}`));
    return cache.get(key);
  };
  const rows = [0, 1, 2, 3].map((k) => ({ k, stay: 0, swap: 0, wins: 0, n: 0 }));
  for (let s = 0; s < seeds; s++) for (let i = 0; i < 4; i++) {
    const others = [0, 1, 2, 3].filter((j) => j !== i);
    for (let k = 0; k <= 3; k++) {
      const F = new Set(others.slice(0, k));
      const a = play(s, F).kept[i], b = play(s, new Set([...F, i])).kept[i];
      const row = rows[k]; row.stay += a; row.swap += b; row.n++; if (b > a) row.wins++;
    }
  }
  let allC = 0, allF = 0, deadC = 0, deadF = 0, nextC = 0, nextF = 0;
  for (let s = 0; s < seeds; s++) {
    const c = play(s, new Set()), f = play(s, new Set([0, 1, 2, 3]));
    allC += c.kept.reduce((x, y) => x + y, 0) / 4; allF += f.kept.reduce((x, y) => x + y, 0) / 4;
    if (c.died !== null) deadC++; if (f.died !== null) deadF++;
    nextC += c.nextYearAdults; nextF += f.nextYearAdults;
  }
  return { rows: rows.map((r) => ({ ...r, stay: r.stay / r.n, swap: r.swap / r.n })), allC: allC / seeds, allF: allF / seeds, deadC, deadF, nextC: nextC / seeds, nextF: nextF / seeds, seeds };
}

if (process.argv[1]?.endsWith("payoff.mjs")) {
  const seeds = Number(process.argv[2] || 24);
  const r = paired(seeds);
  console.log(`paired comparison, ${seeds} seeds x 4 seats (fish kept, after paying for a fine net)`);
  for (const row of r.rows) console.log(`others with fine nets ${row.k}: keep coarse ${row.stay.toFixed(1)}  switch ${row.swap.toFixed(1)}  switching paid in ${row.wins}/${row.n}`);
  console.log(`all coarse: ${r.allC.toFixed(1)} each, lake died ${r.deadC}/${seeds}, grown fish next year ${r.nextC.toFixed(1)}`);
  console.log(`all fine:   ${r.allF.toFixed(1)} each, lake died ${r.deadF}/${seeds}, grown fish next year ${r.nextF.toFixed(1)}`);
}
