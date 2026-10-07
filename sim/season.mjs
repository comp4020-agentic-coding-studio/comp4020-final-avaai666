// One simulated season of "Next Year, No Fish" (model v2.1), for the
// dilemma and the rules (DESIGN.md "Why it is a dilemma", "What the rules do").
// Every family throws on its own 3.5 s clock at the densest spot its net can
// hold, and takes 85% of its chances. A family that plans a fine net buys it
// the moment it keeps 20 fish, as in the game; until then it throws coarse.
// The golden carp swims each year, as in the game. Returns fish kept.
import { DEFAULTS, makeLake, step, cast, bestSpot, phase, adults, fry, dead, nextYear, streamRng } from "./lakesim.mjs";

export const KOI = { AT_S: 17, FOR_S: 12, SPEED: 70, BONUS: 8, REACH: 6 };

export function season(plansFine, secret, { take = 0.85, ruleFrom2 = "none", over = {} } = {}) {
  const P = { ...DEFAULTS, ...over };
  const n = plansFine.length;
  const L = makeLake(P, n, secret);
  const aim = streamRng(secret, "aim"), koiRng = streamRng(secret, "koi");
  const landed = new Array(n).fill(0), spent = new Array(n).fill(0), hasFine = new Array(n).fill(false);
  const next = plansFine.map(() => aim() * P.CAST_S);
  let died = null, koi = null, koiYear = 0, fryTaken = 0;
  for (;;) {
    const ph = phase(P, L.t);
    if (ph.phase === "over") break;
    if (ph.phase === "fish") {
      // the golden carp
      if (koiYear !== ph.year && ph.into >= KOI.AT_S) {
        koiYear = ph.year;
        const a = koiRng() * Math.PI * 2;
        koi = { x: P.W / 2 + Math.cos(a) * 200, y: P.H / 2 + Math.sin(a) * 120, h: a + Math.PI, until: L.t + KOI.FOR_S };
      }
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
        cast(L, i, s.x + (aim() - 0.5) * 2 * P.AIM_NOISE, s.y + (aim() - 0.5) * 2 * P.AIM_NOISE, fine);
      }
    } else {
      plansFine.forEach((_, i) => { if (next[i] < L.t) next[i] = L.t + P.CAST_S * aim(); });
      koi = null;
    }
    const out = step(L);
    for (const h of out.hauls) {
      landed[h.net.fam] += h.got; fryTaken += h.gotFry;
      const r = (h.net.fine ? P.R_FINE : P.R_COARSE) + KOI.REACH;
      if (koi && Math.hypot(koi.x - h.net.x, koi.y - h.net.y) < r) { landed[h.net.fam] += KOI.BONUS; koi = null; }
    }
    if (koi) {
      koi.h += (koiRng() - 0.5) * 0.5;
      const e = Math.hypot((koi.x - P.W / 2) / P.RX, (koi.y - P.H / 2) / P.RY);
      if (e > 0.85) koi.h = Math.atan2(P.H / 2 - koi.y, P.W / 2 - koi.x);
      koi.x += Math.cos(koi.h) * KOI.SPEED * P.DT; koi.y += Math.sin(koi.h) * KOI.SPEED * P.DT;
      if (L.t >= koi.until) koi = null;
    }
    if (died === null && dead(L)) died = ph.year;
  }
  const endAdults = adults(L);
  const kept = landed.map((l, i) => l - spent[i]);
  return { kept, landed, died, endAdults, fryTaken, nextYearAdults: died === null ? nextYear(L) : 0 };
}
