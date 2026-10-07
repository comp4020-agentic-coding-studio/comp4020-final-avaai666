// Houses, the fine net and promises (DESIGN.md v2.1, "Basket, house and fine
// net" and "Promises"). Pure functions. The bots' answers are scripts, not
// models of people.
import { FINE_COST, HOUSE_PARTS, JIN_KEEPS, MEI_PROMISE_LIMIT } from "./game-constants.ts";
import type { BotKind } from "./rules.ts";

type PhaseName = "fish" | "meet" | "over";

// In winter the basket buys the house's next parts in order, while it can pay
// for the next one. `part` is the index of the last part built (0: the hut).
// What is left stays in the basket. A house never loses a part.
export function buildWinter(basket: number, part: number): { part: number; built: string[]; left: number } {
  const built: string[] = [];
  let left = basket;
  let p = part;
  while (p + 1 < HOUSE_PARTS.length && left >= HOUSE_PARTS[p + 1].cost) {
    p++;
    left -= HOUSE_PARTS[p].cost;
    built.push(HOUSE_PARTS[p].name);
  }
  return { part: p, built, left };
}

// A fine net costs FINE_COST from the basket, once per season, only while
// fishing.
export function canBuyFine(basket: number, owns: boolean, ph: { phase: PhaseName }): boolean {
  return ph.phase === "fish" && !owns && basket >= FINE_COST;
}

// "Coarse nets only, until winter?", asked by `from`, accepted by `to`, in
// fishing of `year`.
export type Pledge = { from: number; to: number; year: number };

// A promise holds from its acceptance until that year's winter.
export function pledgeOpen(p: Pledge, ph: { year: number; phase: PhaseName }): boolean {
  return ph.phase === "fish" && ph.year === p.year;
}

// A family that throws a fine net while a promise holds breaks it.
export function breaksPromise(p: Pledge | null, ph: { year: number; phase: PhaseName }, fine: boolean): boolean {
  return p !== null && pledgeOpen(p, ph) && fine;
}

// Old Wang always accepts; Mei unless two others already own fine nets; Jin
// only while he has no fine net.
export function botAnswersPromise(kind: BotKind, v: { hasFine: boolean; othersFine: number }): boolean {
  if (kind === "careful") return true;
  if (kind === "follower") return v.othersFine < MEI_PROMISE_LIMIT;
  return !v.hasFine;
}

// Old Wang and Mei keep every promise. Jin breaks his half the times he
// could: r is his botRandom for that throw.
export function botKeepsPromise(kind: BotKind, r: number): boolean {
  return kind !== "greedy" || r >= JIN_KEEPS;
}
