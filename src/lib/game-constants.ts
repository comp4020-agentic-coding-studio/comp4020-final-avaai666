// Game constants (DESIGN.md v2.1). The lake's numbers are sim/lakesim.mjs
// DEFAULTS, unchanged; the steering weights are the literals in its step();
// the golden carp's are KOI in sim/season.mjs.
// They live only here and in constants.ts.
import type { BotKind as BoatBotKind } from "./boat-sim.ts";
import type { BotKind } from "./rules.ts";
import { WORLD_SCALE as WS } from "./lake-world.ts";

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

// ---- the /play platform (DESIGN.md "One lake, four games") ----
export const PLAY_TICK_MS = 50; // 20 ticks a second
export const PLAY_FRAME_EVERY = 2; // ticks: 10 frames a second
export const PLAY_MAX_CATCHUP = 40; // ticks per timer call
export const PLAY_MAX_RUNNING = 12; // matches running at once, across all rooms
export const PLAY_MAX_SEATS = 8;
export const PLAY_HEARTBEAT_MS = 15000;
export const PLAY_INPUT_RATE = 30; // POSTs per second per player
export const PLAY_COUNTDOWN_MS = 3000; // 3-2-1, everyone sees it
export const LAKE_DEAD = 40; // below this, the lake has died
export const PLAY_CHARACTERS = ["mei", "wang", "jin", "lu", "lian", "shitou"] as const;

// ---- Boat Rush, "rush 2.0" (DESIGN.md "Boat Rush 开船抢鱼 (2.0)") ----
// Runs directly in lake-world.ts's coordinate space (x east, y south, the
// 92 x 64 lobed lake): unlike rush 1.0 (boat-sim's 1000 x 700 ellipse,
// BOAT above), there is no separate sim scale to convert. Distances and
// speeds are the prototype's RU numbers (docs/prototypes/v10/rush.js),
// which are already in this scale. Start points for playtests, not findings
// (scripts/balance.ts tunes them).
export const RUSH = {
  DT: 0.05, // a tick, seconds (20 a second)
  SEASONS: 4, SEASON_S: 45, RUSH_S: 10, MARKET_S: 14, REST_S: 4.5, REVEAL_S: 2.6, // the market's reveal pause once it closes
  // rule change 8 (the lake at 0.7): speed 15 -> 11, net 4.5 -> 3.15 ahead 4 -> 2.8, which keeps the 300-match
  // balance targets (docs/checks/balance-rush2-lake07-2026-10-24.md); a faster boat fished every lake out
  HOLD: 12, SPEED: 11, LOAD_SLOW: 0.35, ACCEL: 6, // a full hold is 35% slower
  NET_R: 3.15, NET_AHEAD: 2.8, SINK: 0.38, CAST_CD: 0.7, NET_MAX: 6, SCATTER_R: 2.2, // the net closes 0.38 s after a cast (prototype's rCloseNet); at most 6 fish a cast; a closing net scares fish within this many net radii; net 4.5 and cooldown 0.7 since rule change 7 (balance-rush2-2026-10-23.md); net 3.15, ahead 2.8 since rule change 8
  DASH_S: 0.4, DASH_MULT: 2.4, DASH_CD: 4,
  RAM_R: 3.4, RAM_DROP: 3, STUN: 0.6, SHIELD: 3,
  DOCK_R: 6.5, SAFE_R: 11, UNLOAD_EVERY: 0.1, // unloading starts within 6.5 of the dock (prototype's UNLOAD_R), one fish every 0.1 s; no ram within 11 of a dock
  LOOSE_S: 8, PICK_R: 2.6,
  KOI_VALUE: 5, KOI_FOR: 10, KOI_STOP: 12, // no golden carp in the last 12 s of a season
  // SEP keeps fish from stacking exactly on top of each other inside a
  // school; fish breed and mature only at the rest (DESIGN.md, the
  // prototype), never mid-season, so no mating/cooldown/maturing constant
  // lives here any more.
  SEP: 0.08, V_ADULT: 4.2, V_FRY: 2.6, SHALLOW: 0.72,
  BIG_SHARE: 0.08, BIG_MULT: 2, // 8% of adults are worth 2
  CHAIN_S: 2.6, CHAIN_BONUS: 1, // a chain of 3+ fish within 2.6 s adds 1
  REROLL: 2, // banked fish
  REEDS_YOUNG: 10, // Reed Bed: this many extra young fish hatch at the owner's dock, each breed
  LADDER_BONUS: 0.15, // Fish Ladder: the whole lake breeds this much better
  LADDER_PER: 8, // ...and the owner gets 1 fish for every this many born
  RELEASE_SHARE: 0.5, // Let Them Go: each spared young fish scores this share of a fish, if next year is Fair+
  CARDS: {
    bigHold: { kind: "plain", hold: 4, name: "Big Hold", text: "+4 fish in your boat." },
    fastHull: { kind: "plain", speed: 1.15, name: "Fast Hull", text: "Sail 15% faster." },
    wideNet: { kind: "plain", net: 1.18, name: "Wide Net", text: "Your net is 18% wider." },
    quickHands: { kind: "plain", castCd: 0.7, name: "Quick Hands", text: "Cast again 30% sooner." },
    ironBow: { kind: "plain", dealt: 1, taken: 1, name: "Iron Bow", text: "Your rams knock out 1 more fish; rams on you, 1 fewer." },
    goldHook: { kind: "plain", koiValue: 8, koiPull: true, name: "Golden Hook", text: "Golden carp are worth 8, and swim toward you." },
    fineMesh: { kind: "greedy", youngShare: 0.4, name: "Fine Mesh", text: "Your net keeps the young fish too: about +40% catch. They were next year's fish." },
    trawl: { kind: "greedy", trawl: true, name: "Trawl", text: "While you sail, you scoop up every fish you pass over, young ones included." },
    ladder: { kind: "keeper", name: "Fish Ladder", text: "The whole lake breeds 15% better. You get 1 fish for every 8 born." },
    release: { kind: "keeper", name: "Let Them Go", text: "Young fish in your net go free; each one you spare scores ½ a fish if next year is Fair or better." },
    reeds: { kind: "keeper", name: "Reed Bed", text: "Plant reeds by your dock: 10 more young fish hatch there each time the lake breeds." },
  } as Record<string, { kind: "plain" | "greedy" | "keeper"; name: string; text: string; hold?: number; speed?: number; net?: number; castCd?: number; dealt?: number; taken?: number; koiValue?: number; koiPull?: boolean; youngShare?: number; trawl?: boolean }>,
  SEATS: { min: 2, max: 4, botFill: 4 },
} as const;
export const RUSH_MODEL = "rush 2.1"; // 2.1: the lake at 0.7 (rule change 8)
// the v5 lake's fish (src/lib/modes/lake-life.ts), shared by every mode on it:
// the same numbers rush 2.0 was tuned and measured with
export const LIFE = { DT: RUSH.DT, SEP: RUSH.SEP, V_ADULT: RUSH.V_ADULT, V_FRY: RUSH.V_FRY, SHALLOW: RUSH.SHALLOW, BIG_SHARE: RUSH.BIG_SHARE } as const;

// ---- Who's Poaching, "poach 2.0" (DESIGN.md "Who's Poaching 谁在偷鱼 (2.0)") ----
// In lake-world.ts's units (the 92 x 64 lake), like rush 2.0. The numbers
// are the prototype's PO (docs/prototypes/v10/poach.js).
export const POACH_MODEL = "poach 2.1"; // 2.1: the lake at 0.7 (rule change 8)
export const POACH = {
  DT: 0.05,
  DAYS: 3, ROLE_MIN_S: 3, ROLE_MAX_S: 45, DAY_S: 70, MEET_S: 55, TALLY_S: 4, EXILE_S: 6, // the role card, a day, a meeting at most, the tally, the exile
  VIEW: 24, // your lantern's circle: the server sends nothing beyond it by day
  BUOY_R: 15, BUOY_VIEW: 10.5, // a buoy logs boats within 15, and lights a circle of 10.5 for its owner
  INSPECT_R: 8, INSPECT_S: 1.5, REPORT_R: 11,
  NET_CD: 2, NET_MAX: 3, NET_R: 3.4, NET_AHEAD: 4, // everyone's net: adults only, at most 3
  FINE_CD: 13, FINE_R: 5.2, FINE_MAX: 22, FINE_FIRST: 8, NURSERY_EXTRA: 14, // the poacher's fine net; its first is ready 8-16 s into a day; in the reeds or lotus it finds up to 14 more young
  TASK_R: 5.5, TASK_S: 2.5, TASKS_A_DAY: 3, TASK_FISH: 2,
  SIGHT_S: 0.5, // how often a boat's sightings, path and buoy logs are written
  LINE: 40, NO_EXILE: 5, NIGHT: 4, // % of the start: the line, the cost of no exile, a night with the poacher free (6% less 2% recovery)
  EXTRA_YOUNG: 40, // young fish added in the reeds at the start of a match (DESIGN "Lake health")
  SPEED: 12.5, POACHERS_AT: 7, WIN_BONUS: 20, SAYS_MAX: 4,
  SEATS: { min: 4, max: 8, botFill: 6 },
} as const;
export const BAYS = ["North Bay", "East Bay", "South Bay", "West Bay"] as const;

// ---- Fishing Party, "party 2.0" (DESIGN.md "Fishing Party 钓鱼派对 (2.0)") ----
// In lake-world.ts's units; the prototype's YP and its rounds (docs/prototypes/v10/party.js).
export const PARTY_MODEL = "party 2.1"; // 2.1: the lake at 0.7 (rule change 8)
export const PARTY = {
  DT: 0.05,
  INTRO_S: 20, COUNT_S: 3, ROUND_S: 28, STANDINGS_S: 4, SHOP_S: 9, PICK_S: 20, REVEAL_EACH: 1.1, REVEAL_END: 3.6,
  // rule change 8: every distance in the party is the prototype's times the lake's WORLD_SCALE (WS), so the
  // rounds play as tuned on a lake 0.7 the size
  COST: 3, SPEED: 14 * WS, FAST: 1.25, BAIT_S: 8, BAIT_R: 30 * WS,
  // Shoal Scramble: a gold ring warns, then fish jump; the first tap within 8 (11 with Big Net) takes the school
  WARN_S: 0.8, JUMP_S: 1.5, TAP_R: 8 * WS, TAP_R_BIG: 11 * WS, SCRAMBLE_COINS: 2, SCRAMBLE_FISH: 2,
  // Koi Chase: eight lantern gates in order; the golden carp
  GATES: 8, GATE_R: 7 * WS, GATE_COINS: 1, KOI_SPEED: 9 * WS, KOI_R: 4 * WS, KOI_COINS: 5, KOI_FISH: 2,
  // Tug of Line: a needle and a drifting green zone; finish places pay 6, 4, 2, 1
  NEEDLE_SPEED: 0.7, REEL_UP: 9, REEL_DOWN: 6, REEL_STUN: 0.35, TUG_PAY: [6, 4, 2, 1],
  // Lantern Night: you see fish within 16 of your boat (18 with Big Net) and within 14 of a dropped lantern
  NIGHT_VIEW: 16 * WS, NIGHT_VIEW_BIG: 18 * WS, NIGHT_BOATS: 20 * WS, LANTERN_LIGHT: 14 * WS, LANTERN_S: 10, LANTERN_CD: 8, NIGHT_CD: 1.6, NIGHT_MAX: 2, NIGHT_NET_R: 3.6 * WS, NIGHT_NET_BIG: 5 * WS,
  // the Last Net: the school is the lake / 7; a net that holds pays double
  LAST_DIV: 7, LAST_MULT: 2,
  SEATS: { min: 2, max: 4, botFill: 4 },
} as const;

// ---- Lake Holdings, "holdings 2.0" (DESIGN.md "Lake Holdings 抢地盘经营 (2.0)") ----
// In lake-world.ts's units; the prototype's HO (docs/prototypes/v10/hold.js).
export const HOLD_MODEL = "holdings 2.0";
export const HOLD = {
  DT: 0.05,
  SEASONS: 4, ACTIONS: 3, PICK_S: 20, // four seasons of three moves; 20 s to choose
  REVEAL_GAP: 0.45, REVEAL_END: 0.8, HARVEST_STEP_S: 1.3, // the reveal, one placement at a time; the harvest, one step at a time
  HS: 8.4 * WS, IN_LAKE: 0.8, // hex size (the prototype's 8.4, times lake-world's WORLD_SCALE, so the board keeps its tiles); tiles whose centre is within this share of the way to the shore
  WEIGHTS: { net: 3, pond: 2, fence: 1.2, corm: 1, lantern: 1.2 },
  NET_TAKE: 7, BASE: 2, POND_SELF: 2, POND_NEAR: 1, CORM: 2, GROW: 0.2, GROW_REEDS: 0.4, TILE_PTS: 1,
  SEATS: { min: 2, max: 4, botFill: 4 },
} as const;
