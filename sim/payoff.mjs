// The dilemma (DESIGN.md v2.0, "Why it is a dilemma"). season() plays one
// seeded season: every family throws every CAST_S at the densest spot its net
// can hold, taking 85% of its chances. payoffTable() averages fish kept per
// family for 0..4 fine nets. Run: node sim/payoff.mjs '{}' 24
import { DEFAULTS, makeLake, step, cast, bestSpot, phase, adults, fry, rngFrom } from "./lakesim.mjs";

// one season; nets: array of booleans (fine?), every family casts every CAST_S
// (each with its own offset), taking a chance with probability take
export function season(nets, seed, over = {}, take = 0.85, ruleFrom2 = 'none') {
  const P = { ...DEFAULTS, ...over };
  const L = makeLake(P, nets.length, seed);
  const aim = rngFrom(seed ^ 0x9e3779b9);
  const caught = nets.map(() => 0);
  const next = nets.map(() => aim() * P.CAST_S);
  let died = null;
  const yearly = [];
  for (;;) {
    const ph = phase(P, L.t);
    if (ph.phase === "over") break;
    if (ph.phase === "fish") {
      const order = nets.map((_, i) => i).sort(() => aim() - 0.5);
      order.forEach((i) => { const fine = nets[i];
        if (L.t + 1e-9 >= next[i]) {
          next[i] += P.CAST_S;
          if (aim() >= take) return;
          const rule = ph.year >= 2 ? ruleFrom2 : 'none';
          if (rule === 'spring' && ph.spring) return;
          const useFine = fine && rule !== 'ban';
          const s = bestSpot(L, useFine, aim, 14, rule === 'nursery' ? P.SHALLOW * 0.95 : 9);
          const x = s.x + (aim() - 0.5) * 2 * P.AIM_NOISE, y = s.y + (aim() - 0.5) * 2 * P.AIM_NOISE;
          cast(L, i, x, y, useFine, (net) => (caught[i] += net.got));
        }
      });
    } else {
      // meeting: casts wait; keep each family's clock
      nets.forEach((_, i) => { if (next[i] < L.t) next[i] = L.t + P.CAST_S * aim(); });
    }
    step(L);
    if (died === null && L.fish.length < 2) died = ph.year;
  }
  return { caught, died, hist: L.hist, endAdults: adults(L), endFry: fry(L), events: L.events };
}

export function payoffTable(over = {}, seeds = 12, fams = 4) {
  const P = { ...DEFAULTS, ...over };
  const rows = [];
  for (let k = 0; k <= fams; k++) {
    const nets = Array.from({ length: fams }, (_, i) => i < k);
    const tot = nets.map(() => 0); let deaths = 0, endA = 0;
    for (let s = 0; s < seeds; s++) {
      const r = season(nets, 1000 + s, over);
      r.caught.forEach((c, i) => (tot[i] += c));
      if (r.died !== null) deaths++;
      endA += r.endAdults;
    }
    rows.push({ k, pay: tot.map((t, i) => t / seeds - (nets[i] ? P.FINE_COST : 0)), deaths, endA: endA / seeds });
  }
  return rows;
}

if (process.argv[1]?.endsWith("payoff.mjs")) {
  const over = JSON.parse(process.argv[2] || "{}");
  const t0 = Date.now();
  const rows = payoffTable(over, Number(process.argv[3] || 12));
  for (const r of rows) console.log(`${r.k} fine: pay ${r.pay.map((x) => x.toFixed(0).padStart(4)).join(" ")}  deaths ${r.deaths}  endAdults ${r.endA.toFixed(0)}`);
  const dil = [0, 1, 2, 3].map((k) => [rows[k].pay[3], rows[k + 1].pay[k]]);
  console.log("switch:", dil.map(([s, w]) => `${s.toFixed(0)}->${w.toFixed(0)}`).join("  "), " all-coarse", rows[0].pay[0].toFixed(0), " all-fine", rows[4].pay[0].toFixed(0));
  console.log("ms", Date.now() - t0);
}
