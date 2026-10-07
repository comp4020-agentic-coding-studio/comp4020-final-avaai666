// The village meeting, breaches and the bots (DESIGN.md v2.1). Pure functions
// of what each can see; a bot's randomness comes from botRandom, never from
// the lake's own stream. Bots follow scripts, not models of people.
import {
  FINE_COST,
  JIN_ANGER,
  MEI_BREACHES,
  WANG_FRY_ALARM,
  WANG_LOW,
} from "./game-constants.ts";
import { inShallows, streamRng } from "./lake-sim.ts";

// no rule; ban fine nets; no fishing in spring; keep out of the shallows
export type Rule = "none" | "ban" | "spring" | "nursery";
const RULES: Rule[] = ["none", "ban", "spring", "nursery"];

export type BotKind = "careful" | "greedy" | "follower";

// A family that did not vote counts as "none". An option wins with more votes
// than each other option and at least half of all families' votes.
export function tally(votes: Rule[], families: number): Rule {
  const count = (r: Rule): number =>
    votes.filter((v) => v === r).length + (r === "none" ? Math.max(0, families - votes.length) : 0);
  for (const r of RULES) {
    const n = count(r);
    if (2 * n >= families && RULES.every((o) => o === r || n > count(o))) return r;
  }
  return "none";
}

// Does a throw break the rule? A fine net under a ban; any throw in spring
// under a spring closure; a net landing in the shallows under "keep out of
// the shallows".
export function breachOf(
  rule: Rule,
  phase: { phase: "fish" | "meet" | "over"; spring?: boolean },
  x: number,
  y: number,
  fine: boolean,
): boolean {
  if (rule === "ban") return fine;
  if (rule === "spring") return phase.phase === "fish" && phase.spring === true;
  if (rule === "nursery") return inShallows(x, y);
  return false;
}

// ---- bots ----

export type BuyView = { basket: number; hasFine: boolean; othersFine: number };

// Old Wang never buys. Jin buys as soon as his basket holds 20; Mei once two
// other families have a fine net (and her basket can pay).
export function botBuys(kind: BotKind, v: BuyView): boolean {
  if (kind === "careful" || v.hasFine || v.basket < FINE_COST) return false;
  return kind === "greedy" || v.othersFine >= 2;
}

export type VoteView = {
  anyFine: boolean; // does any family own a fine net
  maxFryTaken: number; // the most fry any one family has taken this season
  adults: number; // grown fish now
  startAdults: number; // grown fish at the start
  humanVotes: Rule[]; // the human families' votes so far in this meeting
  humans: number; // how many human families there are
};

export function botVote(kind: BotKind, v: VoteView): Rule {
  if (kind === "greedy") return "none";
  if (kind === "follower") return tally(v.humanVotes, v.humans); // a silent human counts as none
  if (v.anyFine) return "ban";
  if (v.maxFryTaken > WANG_FRY_ALARM) return "nursery";
  if (v.adults < WANG_LOW * v.startAdults) return "spring";
  return "none";
}

export type BreakView = {
  rule: Rule; // the rule in force
  year: number;
  angerOnMe: { from: number; year: number }[]; // "stop that" (怒) seals stamped on this bot
  breachesByOthers: { family: number; year: number }[];
};

// Old Wang keeps every rule. Jin breaks every rule until two different
// families have stamped "stop that" (怒) on him that year. Mei keeps every
// rule until others have broken it twice that year, then breaks it too, until
// anyone stamps "stop that" on her that year.
export function botBreaks(kind: BotKind, v: BreakView): boolean {
  if (v.rule === "none" || kind === "careful") return false;
  const anger = v.angerOnMe.filter((a) => a.year === v.year);
  if (kind === "greedy") return new Set(anger.map((a) => a.from)).size < JIN_ANGER;
  const breaches = v.breachesByOthers.filter((b) => b.year === v.year).length;
  return breaches >= MEI_BREACHES && anger.length === 0;
}

// Does the bot throw its fine net? Only if it owns one, and not under a ban
// it keeps.
export function botNet(hasFine: boolean, rule: Rule, breaks: boolean): boolean {
  return hasFine && (rule !== "ban" || breaks);
}

// A number in [0, 1) that depends only on its arguments: the first draw of
// the stream SHA-256(secret | bot | step | family | k), separate from the
// lake's. k numbers the draws a bot makes in one step.
export function botRandom(secret: string, step: number, familyIndex: number, k: number): number {
  return streamRng(secret, `bot|${step}|${familyIndex}|${k}`)();
}
