// Game constants (DESIGN.md v1.1, from sim/game_sim.py and sim/payoff.py).
// They live only here and in constants.ts.
import type { BotKind } from "./lake.ts";

export const FISH_PER_FAMILY = 75; // K per family
export const ALLEE_FRACTION = 0.1; // A = K × this
export const R_GAME_PER_MIN = 0.45;
export const YEARS = 6;
export const FISH_MS = 45_000; // fishing each year
export const MEET_MS = 15_000; // village meeting after years 1 to 5
export const THROW_MS = 2_500; // a family's cast interval
export const COARSE = 3; // net capacity: expected catch at stock K
export const FINE = 8;
export const FINE_COST = 20; // fish
export const QUOTA = 25; // fish per family per year
export const MAX_FAMILIES = 6;
export const FILL_TO = 4; // bots fill a lake to this many families
export const BOT_TAKE = 0.85; // share of cast chances a bot takes
// Years 1 to 5 end with a meeting; the season ends when year 6's fishing does.
export const SEASON_MS = (YEARS - 1) * (FISH_MS + MEET_MS) + FISH_MS; // 345 000
export const BOT_INTERVAL_MS = THROW_MS / BOT_TAKE; // ≈ 2941: the same average rate
export const BOT_FILL_ORDER: readonly BotKind[] = ["greedy", "follower", "careful"];
export const BOT_NAMES: Record<BotKind, string> = { greedy: "Jin", follower: "Mei", careful: "Old Wang" };
export const BOT_VOTE_AT_MS: Record<BotKind, number> = { careful: 3_000, greedy: 6_000, follower: 12_000 }; // ms into a meeting
export const COUNTERFACTUAL_SEEDS = 20; // seeds for the debrief's all-coarse season
