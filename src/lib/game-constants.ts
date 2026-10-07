// Game constants (DESIGN.md v2.1). The lake's numbers are sim/lakesim.mjs
// DEFAULTS, unchanged; the steering weights are the literals in its step();
// the golden carp's are KOI in sim/season.mjs.
// They live only here and in constants.ts.
import type { BotKind } from "./rules.ts";

// ---- the lake (sim/lakesim.mjs DEFAULTS) ----
export const W = 1000; // lake ellipse in world units
export const H = 700;
export const RX = 460;
export const RY = 315;
export const DT = 0.1; // a step, seconds
export const YEARS = 5;
export const FISH_S = 40; // fishing each year
export const SPRING_S = 14; // the first part of fishing
export const MEET_S = 14; // winter meeting after years 1 to 4
export const CAP_PER_FAMILY = 55; // crowding scale (grown fish and fry) per family
export const START_FRAC = 0.75; // grown fish at the start, as a share of capacity
export const SIGHT = 95;
export const MATE = 30;
export const SEP = 14;
export const V_ADULT = 42;
export const V_FRY = 26;
export const BREED = 0.25; // per grown fish with a mate, per second, before crowding
export const CLUTCH = 2;
export const COOL_S = 6;
export const MAX_AGE = 4;
export const WINTER_DEATH = 0.12;
export const CAST_S = 3.5; // a family's net cycle
export const SINK_S = 0.6;
export const R_COARSE = 36;
export const R_FINE = 42;
export const FINE_COST = 20;
export const AIM_NOISE = 25;
export const SHALLOW = 0.72; // the shallows are outside this share of the radius

// ---- steering and scattering (the literals in sim/lakesim.mjs step and cast) ----
export const START_AGES = 3; // starting fish are 1 + floor(rng · 3)
export const SPAWN_M = 0.9; // fish are placed inside this share of the lake
export const COHESION = 0.012;
export const ALIGN = 0.35;
export const SEPARATE = 0.05;
export const FRY_SEPARATE = 0.08;
export const FRY_TO_SHORE = 0.6;
export const SHORE_M = 0.92; // outside this share, fish turn back
export const SHORE_PULL = 0.01;
export const SCARE_PUSH = 3;
export const TURN_NOISE = 0.5;
export const SCARE_SPEED = 2.2;
export const CLUTCH_SPREAD = 10;
export const SCARE_S = 0.5;
export const SCARE_OUTER = 1.6; // × the net's radius
export const SCARE_INNER = 0.7;
export const LEAD = 15; // an aimer leads a fish by this much
export const AIM_TRIES = 14;
export const AIM_ANYWHERE = 9; // bestSpot's default limit: no limit
export const NURSERY_AIM = 0.95; // × SHALLOW: how far out a family keeping "keep out of the shallows" aims

// ---- the schedule ----
export const STEP_MS = 100; // DT in ms
export const SEASON_MS = ((YEARS - 1) * (FISH_S + MEET_S) + FISH_S) * 1000; // 256 000

// ---- families, houses, the golden carp ----
export const MAX_FAMILIES = 8;
export const FILL_TO = 4; // bots fill a lake to this many families
// A house's parts, in order, each bought from the basket in winter.
export const HOUSE_PARTS = [
  { name: "hut", cost: 0 },
  { name: "tiled roof", cost: 25 },
  { name: "red gate", cost: 35 },
  { name: "lanterns", cost: 50 },
  { name: "upper floor", cost: 60 },
  { name: "pagoda", cost: 70 },
] as const;

// The golden carp (sim/season.mjs KOI and its path).
export const KOI_AT_S = 17; // into each year's fishing
export const KOI_FOR_S = 12;
export const KOI_SPEED = 70;
export const KOI_BONUS = 8; // extra fish for the net that takes it
export const KOI_REACH = 6; // added to the net's radius
export const KOI_START_RX = 200; // it starts on this ellipse around the centre
export const KOI_START_RY = 120;
export const KOI_TURN = 0.5;
export const KOI_TURN_BACK = 0.85; // beyond this share of the radius it heads for the centre

// ---- randomness ----
export const SECRET_BYTES = 32; // 256 bits
export const RNG_WARMUP = 12; // draws discarded from each new stream

// ---- bots ----
export const BOT_FILL_ORDER: readonly BotKind[] = ["greedy", "follower", "careful"];
export const BOT_NAMES: Record<BotKind, string> = { greedy: "Jin", follower: "Mei", careful: "Old Wang" };
export const BOT_VOTE_AT_S: Record<BotKind, number> = { careful: 3, greedy: 6, follower: 10 }; // into a meeting
export const BOT_TAKE = 0.85; // share of throwing chances a bot takes
export const WANG_FRY_ALARM = 6; // Old Wang votes "keep out of the shallows" once any one family has taken more fry than this
export const WANG_LOW = 0.6; // and "no spring fishing" when grown fish are below this share of the start
export const JIN_ANGER = 2; // different families stamping "stop that" before Jin keeps a rule
export const MEI_BREACHES = 2; // breaches by others before Mei breaks a rule
export const MEI_PROMISE_LIMIT = 2; // Mei refuses a promise once this many others own fine nets
export const JIN_KEEPS = 0.5; // Jin keeps a promise when his draw is at least this
export const WANG_ASKS_AT_S = 18; // into fishing, once a year
