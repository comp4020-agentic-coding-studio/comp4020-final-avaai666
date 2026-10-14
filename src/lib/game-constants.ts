// Game constants (DESIGN.md v2.1). The lake's numbers are sim/lakesim.mjs
// DEFAULTS, unchanged; the steering weights are the literals in its step();
// the golden carp's are KOI in sim/season.mjs.
// They live only here and in constants.ts.
import type { BotKind as BoatBotKind } from "./boat-sim.ts";
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
export const THROW_COOLDOWN_STEPS = 35; // CAST_S / DT: a family may throw this often
export const RIVAL_REACH = 84; // an empty net blames a rival's haul within this many units, in the 6 steps before

// ---- the boat game (docs/boats/RULES.md) ----
export const BOAT_MODEL = "boat-sim 0.1";
// the numbers (start points for playtests, not findings)
export const BOAT = {
  W: 1000, H: 700, RX: 460, RY: 315, // the lake: an ellipse in world units
  DT: 0.05, // a tick, seconds (20 a second)
  SECONDS: 120, // a Quick Catch match
  HOLD: 10, // fish a hold carries
  SPEED: 150, LOAD_SLOW: 0.35, ACCEL: 6, // units/s; a full hold is 35% slower
  NET_R: 38, NET_AHEAD: 40, SINK: 0.6, CAST_CD: 0.9, // the net lands ahead of the bow
  DASH_S: 0.4, DASH_MULT: 2.6, DASH_CD: 4,
  RAM_R: 34, RAM_DROP: 3, STUN: 0.6, SHIELD: 3, // a ram spills at most 3 fish
  DOCK_R: 60, SAFE_R: 95, UNLOAD_EVERY: 0.12, // no ram lands this close to any dock
  LOOSE_S: 8, PICK_R: 26, // spilled fish float, then swim off as fish again
  KOI_FIRST: 20, KOI_EVERY: 30, KOI_FOR: 10, KOI_VALUE: 5, KOI_SPEED: 95,
  FISH_PER_BOAT: 50, FISH_BASE: 20, CAP_MULT: 1.3, // start = 50 per boat + 20
  SIGHT: 95, MATE: 30, SEP: 14, V_ADULT: 42, V_FRY: 26, BREED: 0.02, COOL: 6, MATURE_S: 20, SHALLOW: 0.72,
  TIERS: [0, 10, 25, 45, 70, 100], // banked fish for each house part
} as const;
// rooms and the run-time loop (boat-hub.ts, boat-routes.ts)
export const BOAT_MAX_PLAYERS = 4;
export const BOAT_BOT_NAMES: Record<BoatBotKind, string> = { steady: "Old Wang", pirate: "Jin", scavenger: "Mei" };
export const BOAT_BOT_ORDER: readonly BoatBotKind[] = ["pirate", "steady", "scavenger"]; // which bots fill empty boats, in order
export const BOAT_FRAME_EVERY = 2; // ticks: 10 frames a second
export const BOAT_MAX_CATCHUP = 40; // ticks per timer call
export const BOAT_MAX_RUNNING = 8; // matches running at once, across all rooms
export const BOAT_HEARTBEAT_MS = 15000;
export const BOAT_INPUT_RATE = 25; // POSTs per second per player; a client sends at most ~12
