// One simulated season of "Next Year, No Fish" (model v2.2), for the
// dilemma and the rules (DESIGN.md "Why it is a dilemma", "What the rules do").
// Every family throws on its own 3.5 s clock at the densest spot its net can
// hold, and takes 85% of its chances. A family that plans a fine net buys it
// the moment it keeps 20 fish, as in the game; until then it throws coarse.
// The golden carp swims each year, as in the game. The season ends when the
// lake dies. Families keep the rule from year 2, which includes not buying a
// fine net under a ban. Returns fish kept.
import { DEFAULTS, makeLake, step, cast, bestSpot, phase, adults, fry, dead, nextYear, streamRng, inShallows } from "./lakesim.mjs";

export function season(plansFine, secret, { take = 0.85, ruleFrom2 = "none", over = {} } = {}) {
  const P = { ...DEFAULTS, ...over };
  const n = plansFine.length;
  const L = makeLake(P, n, secret);
  const aim = streamRng(secret, "aim");
  const landed = new Array(n).fill(0), spent = new Array(n).fill(0), hasFine = new Array(n).fill(false);
  const next = plansFine.map(() => aim() * P.CAST_S);
  let died = null, fryTaken = 0;
  for (;;) {
    const ph = phase(P, L.t);
    if (ph.phase === "over" || died !== null) break; // the season ends when the lake dies, as in the game
    if (ph.phase === "fish") {
      const rule = ph.year >= 2 ? ruleFrom2 : "none";
      const order = plansFine.map((_, i) => i).sort(() => aim() - 0.5);
      for (const i of order) {
        if (plansFine[i] && !hasFine[i] && landed[i] - spent[i] >= P.FINE_COST && rule !== "ban") { hasFine[i] = true; spent[i] += P.FINE_COST; }
        if (L.t + 1e-9 < next[i]) continue;
        next[i] += P.CAST_S;
        if (aim() >= take) continue;
        if (rule === "spring" && ph.spring) continue;
        const fine = hasFine[i] && rule !== "ban";
        const s = bestSpot(L, fine, aim, 14, rule === "nursery" ? P.SHALLOW * 0.95 : 9);
        let x = s.x + (aim() - 0.5) * 2 * P.AIM_NOISE, y = s.y + (aim() - 0.5) * 2 * P.AIM_NOISE;
        // a family keeping the shallows rule never lands past the line
        if (rule === "nursery" && inShallows(P, x, y)) { x = s.x; y = s.y; }
        cast(L, i, x, y, fine);
      }
    } else {
      plansFine.forEach((_, i) => { if (next[i] < L.t) next[i] = L.t + P.CAST_S * aim(); });
    }
    const out = step(L);
    for (const h of out.hauls) {
      landed[h.net.fam] += h.got + (h.koi ? P.KOI_BONUS : 0); fryTaken += h.gotFry;
    }
    if (died === null && dead(L)) died = ph.year;
  }
  const endAdults = adults(L);
  const kept = landed.map((l, i) => l - spent[i]);
  return { kept, landed, died, endAdults, fryTaken, nextYearAdults: died === null ? nextYear(L) : 0 };
}
