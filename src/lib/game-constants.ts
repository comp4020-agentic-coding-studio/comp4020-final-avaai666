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
  HOLD: 12, SPEED: 15, LOAD_SLOW: 0.35, ACCEL: 6, // a full hold is 35% slower
  NET_R: 3.5, NET_AHEAD: 4, SINK: 0.5, CAST_CD: 1.0, NET_MAX: 6, SCATTER_R: 2.2, // at most 6 fish a cast; a closing net scares fish within this many net radii
  DASH_S: 0.4, DASH_MULT: 2.4, DASH_CD: 4,
  RAM_R: 3.4, RAM_DROP: 3, STUN: 0.6, SHIELD: 3,
  DOCK_R: 4, SAFE_R: 11, UNLOAD_EVERY: 0.12, // no ram within 11 of a dock
  LOOSE_S: 8, PICK_R: 2.6,
  KOI_VALUE: 5, KOI_FOR: 10, KOI_STOP: 12, // no golden carp in the last 12 s of a season
  // SIGHT/MATE/SEP are tuned for the same average neighbour count as rush
  // 1.0's (about 9, measured directly): schools cluster, so density near a
  // school centre is much higher than the lake-wide average, and the same
  // lake-width ratio rush 1.0 used (scaled naively to this much smaller
  // lake) gave ~64 neighbours per fish, making moveFish's O(fish x
  // neighbours) cost per tick far too slow for a full match.
  SIGHT: 0.5, MATE: 0.16, SEP: 0.08, V_ADULT: 4.2, V_FRY: 2.6, BREED_CHANCE: 0.02, COOL: 6, MATURE_S: 20, SHALLOW: 0.72,
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
export const RUSH_MODEL = "rush 2.0";

// ---- Who's Poaching, "poach 1.0" (DESIGN.md "Who's Poaching") ----
// Distances are in sim units (the lake is 1000 x 700; the 3D lake is a
// tenth, so "6 units" in DESIGN.md is 60 here).
export const POACH = {
  W: 1000, H: 700, RX: 460, RY: 315, DT: 0.05,
  DAYS: 3, DAY_S: 75, MEETING_S: 90, DUSK_S: 4, // dusk: the day's announcement before the meeting
  SPEED: 120, ACCEL: 5,
  NET_R: 36, NET_AHEAD: 36, CAST_CD: 1.2, SINK: 0.5,
  FINE_R: 48, FINE_CD: 1.5, // the fine net: wider, faster, takes fry
  FISH: 160, FRY: 120, // grown fish and fry at dawn of day 1 (fry are the lake's health)
  QUOTA: 60, // village quota of grown fish over three days
  HEALTH_LINE: 40, // percent of the starting fry; below it the poacher wins
  INSPECT_R: 60, INSPECT_S: 3, // stay within 60 for 3 s to see a basket
  PLANT_R: 50, PLANT_S: 2, SPLASH_R: 100, // plant: 2 s alongside; boats within 100 see a splash
  BUOY_R: 70, // a buoy logs every boat that passes within this
  POACHERS_AT: 7, WARDEN_AT: 6, // two poachers at 7 seats, a warden at 6
  NO_EXILE_COST: 5, // a meeting that exiles nobody costs the lake this much health
  V_FISH: 30, V_FRY: 18,
  SEATS: { min: 4, max: 8, botFill: 5 },
} as const;
export const BAYS = ["North Bay", "East Bay", "South Bay", "West Bay"] as const;

// ---- Fishing Party, "party 1.0" (DESIGN.md "Fishing Party") ----
export const PARTY = {
  W: 1000, H: 700, RX: 460, RY: 315, DT: 0.05,
  INTRO_S: 3, ROUND_S: 35, STANDINGS_S: 4, PICK_S: 4, SHOP_S: 8, // the last-placed player's variant pick is its own screen
  GAMES: ["shoal", "koi", "tug", "night"] as const, // rounds 1 to 4, in a seeded order; Last Net is round 5
  // Shoal Scramble
  SHOAL_EVERY_S: 2, SHOAL_UP_S: 1.5, SHOAL_MAX: 6, TAP_R: 55, BIG_NET: 1.5,
  // Koi Chase
  SPEED: 160, FAST: 1.15, GATE_R: 40, GATES: 6, KOI_R: 30, KOI_COINS: 5, KOI_SPEED: 120,
  // Tug of Line
  NEEDLE_HZ: 0.7, GREEN: 0.36, GREEN_SOLO: 0.24, REEL_GAP_S: 0.25, PULL: 1, SLIP: 0.6, ROPE_WIN: 10, TUG_COINS: 6,
  // Lantern Night
  LANTERN_R: 140, DROP_R: 120, DROP_S: 10, NIGHT_NET_R: 40, NIGHT_CD: 0.9, MUDDY: 0.55, BAIT_PULL: 14,
  BAIT_R: 2, BAIT_S: 10, // bait pulls fish within this many lantern radii, for the first 10 s of the round
  // Last Net
  NETS: [3, 6, 10] as const, SCHOOL_SHARE: 0.25, LAST_MULT: 2,
  SHOP: {
    bigNet: { cost: 3, name: "Big Net", text: "bigger catch next round" },
    fastBoat: { cost: 3, name: "Fast Boat", text: "faster next round" },
    bait: { cost: 3, name: "Bait", text: "schools swim to you first next round" },
    muddy: { cost: 4, name: "Muddy Water", text: "the leader sees less next round (only if you are behind)" },
  } as Record<string, { cost: number; name: string; text: string }>,
  VARIANTS: {
    shoal: ["One school at a time", "Two small schools at once"],
    koi: ["Wide gates", "Narrow gates, more pay"],
    tug: ["In pairs", "Each alone against the fish (narrower green)"],
    night: ["One lantern drop each", "Three lantern drops each, smaller"],
    last: ["One pick", "One pick"],
  } as Record<string, [string, string]>,
  SEATS: { min: 2, max: 4, botFill: 4 },
} as const;

// ---- Lake Holdings, "holdings 1.0" (DESIGN.md "Lake Holdings") ----
export const HOLD = {
  W: 1000, H: 700, RX: 460, RY: 315, DT: 0.05,
  HEX: 37, IN_LAKE: 0.84, // hex size in sim units (prototype v7's 3.7); tiles whose centre is inside this share of the lake
  TIDE_S: 15, TIDES: 12, // a tide every 15 s, twelve in three minutes
  HAND: 3, START_TILES: 3, SCHOOLS: 8,
  NET_TAKE: 2, // a net takes 2 from each school on or next to it
  DRY_FISH: 3, // a school smaller than this dies out, and its tile runs dry (grey) until a pond beside it brings it back
  POND_BREED: 3, CORMORANT: 2, CORMORANT_RANGE: 2, LANTERN_RANGE: 3, LANTERN_TIDES: 2,
  THIN_AFTER: 2, // a tile netted this many tides running is marked thinned: schools passing lose a fish
  DECK: ["net", "net", "net", "pond", "pond", "fence", "fence", "cormorant", "lantern", "claim", "claim", "claim"] as const,
  SEATS: { min: 2, max: 4, botFill: 4 },
} as const;
