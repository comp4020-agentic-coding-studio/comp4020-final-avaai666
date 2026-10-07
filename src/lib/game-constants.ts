// Game constants (DESIGN.md v1.0, from sim/game_sim.py and sim/payoff.py).
// They live only here and in constants.ts.
export const FISH_PER_FAMILY = 75; // K per family
export const ALLEE_FRACTION = 0.1; // A = K × this
export const R_GAME_PER_MIN = 0.45;
export const YEARS = 6;
export const FISH_MS = 45_000; // fishing each year
export const MEET_MS = 15_000; // village meeting each year
export const THROW_MS = 2_500; // a family's cast interval
export const COARSE = 3; // net capacity: expected catch at stock K
export const FINE = 8;
export const FINE_COST = 20; // fish
export const QUOTA = 25; // fish per family per year
export const MIN_FAMILIES = 2;
export const MAX_FAMILIES = 6;
export const FILL_TO = 4; // bots fill a lake to this many families
export const BOT_TAKE = 0.85; // share of cast chances a bot takes
