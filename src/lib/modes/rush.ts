// Boat Rush, "rush 2.0" (DESIGN.md "Boat Rush 开船抢鱼 (2.0)"). Four 45 s
// seasons (spring, summer, autumn, winter), each ending in a gong, a 4.5 s
// rest where the lake breeds (lake-world.ts's breed()), then a 14 s market
// of three cards with secret picks revealed together when it closes. Runs
// directly in lake-world.ts's coordinate space (the 92 x 64 lobed lake): no
// separate sim scale, unlike rush 1.0's boat-sim-derived ellipse.
//
// Pure and deterministic: the lake draws only from the match's "lake"
// stream; a bot's decisions come from the stream the platform gives it for
// that tick, and its only memory is the simulation itself. breeds: true —
// this mode's own year already includes breeding, so results().lakeLeft
// is next spring directly; the hub only caps it at K (game-platform.ts's
// lakeAfterMatch), never running it through nextSpring() again.
import { RUSH as Q, RUSH_MODEL } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";
import { blockedAt, breed as breedLake, DEEP, dockPos, forecast, iceBlocks, ISLAND, K, nr, tierOf, ZONES } from "../lake-world.ts";

export type Season = 0 | 1 | 2 | 3; // spring, summer, autumn, winter
export type CardKind = "plain" | "greedy" | "keeper";
export type CardId = keyof typeof Q.CARDS;
const CARD_IDS = Object.keys(Q.CARDS) as CardId[];
const byKind = (k: CardKind): CardId[] => CARD_IDS.filter((id) => Q.CARDS[id].kind === k);

export type RushInput =
  | { k: "steer"; x: number; y: number }
  | { k: "cast"; charge: number }
  | { k: "dash" }
  | { k: "pick"; id: CardId | null }
  | { k: "reroll" };

interface Fish { id: number; x: number; y: number; h: number; adult: boolean; scare: number; sx: number; sy: number; big: boolean; school: number; ox: number; oy: number; ph: number }
// 16 schools (DESIGN.md's season twists, practice step 2 "net the school
// ahead of your bow", prompt-17 step 4's "spring and summer school pulls"):
// 12 adult schools drift to that season's places (river, reeds, lotus, the
// deep water, or open water), 4 nursery schools stay in the reed bed. Each
// fish keeps a small offset (ox, oy) from its school's centre, so a cast
// into a school's centre reliably nets several fish at once — the actual
// mechanic DESIGN's wording and the prototype (docs/prototypes/v10/fish.js)
// assume, which this port's from-scratch flocking model never had.
interface School { x: number; y: number; tx: number; ty: number; vx: number; vy: number; t: number; nursery: boolean }
interface Net { id: number; seat: number; x: number; y: number; r: number; closeAt: number }
interface Loose { id: number; x: number; y: number; vx: number; vy: number; value: number; t: number }
interface Koi { x: number; y: number; h: number; until: number }
interface Stats { caught: number; home: number; trips: number; bestTrip: number; lost: number; rams: number; rammed: number; scooped: number; koi: number; youngKilled: number; youngSpared: number }
interface Boat {
  seat: number; x: number; y: number; h: number; vx: number; vy: number; tx: number; ty: number;
  hold: number[]; castCd: number; dashT: number; dashCd: number; stun: number; shield: number; unloadT: number;
  docked: boolean; tripValue: number; banked: number; cards: CardId[]; combo: number; lastCatch: number;
  stats: Stats; firstScoreAt: number | null;
}
interface Market { offer: CardId[]; botPicks: (CardId | null)[]; picked: (CardId | null | undefined)[]; closesAt: number; closed: boolean; perSeatOffer?: Record<number, CardId[]> }
// One entry per season, from the moment it starts (spring: make(); summer
// on: startSeason()) to its gong. caught/young is every fish a net or trawl
// removed that season (young is the subset that were young, always
// counting fish, never a card-doubled value) — the only way s.fish changes
// mid-season, now that in-season breeding/maturing and an un-scooped
// loose fish's respawn are both gone (rush 1.0 leftovers against DESIGN
// and the prototype, neither of which breeds, matures or respawns a fish
// outside the rest). So the population at the gong is exactly startA +
// startY - caught (nextSpring()'s guard test checks this holds on real
// seeds). Spring, summer and autumn then breed once more at the gong
// (DESIGN.md "the rest... the lake breathes"), with that season's Fish
// Ladder bonus and Reed Bed extra (bonus/reedsExtra, recorded there since
// the cards held can differ by season); winter's gong goes straight to
// the ceremony, so bred stays false on its entry and nextSpring()
// forecasts once instead, with no bonus (forecast()'s own plain meaning).
export interface SeasonHistory { startA: number; startY: number; caught: number; young: number; gongA: number; gongY: number; bred: boolean; bonus: number; reedsExtra: number }
export interface RushSim {
  tick: number; t: number; season: Season; phase: "play" | "rest" | "market" | "end"; phaseT: number;
  players: number; bots: boolean[]; botKinds: string[]; rng: () => number;
  boats: Boat[]; fish: Fish[]; nets: Net[]; loose: Loose[]; koi: Koi | null; koiSpawned: number;
  schools: School[];
  nextId: number; cap: number; market: Market | null; history: SeasonHistory[];
}

const has = (b: Boat, id: CardId): boolean => b.cards.includes(id);
const holdMax = (b: Boat): number => Q.HOLD + (has(b, "bigHold") ? Q.CARDS.bigHold.hold! : 0);
const netR = (b: Boat, charge: number): number => Q.NET_R * (has(b, "wideNet") ? Q.CARDS.wideNet.net! : 1) * (1 + 0.3 * charge);
const castCdOf = (b: Boat): number => Q.CAST_CD * (has(b, "quickHands") ? Q.CARDS.quickHands.castCd! : 1);
const koiValue = (b: Boat): number => (has(b, "goldHook") ? Q.CARDS.goldHook.koiValue! : Q.KOI_VALUE);
const takesYoung = (b: Boat): boolean => (has(b, "fineMesh") || has(b, "trawl")) && !has(b, "release");
const speedMult = (b: Boat): number => Q.SPEED * (has(b, "fastHull") ? Q.CARDS.fastHull.speed! : 1);
// the boat's actual sailing speed right now (prototype's speedOf()): a full
// hold is LOAD_SLOW slower. Used by a bot to judge how long the trip home
// will really take, not a flat distance-ignoring constant.
const speedOf = (b: Boat): number => speedMult(b) * (1 - Q.LOAD_SLOW * (b.hold.length / holdMax(b)));
const holdValue = (b: Boat): number => b.hold.reduce((n, v) => n + v, 0);

const NURSERY_FIRST = 12; // schools 0-11 are adult schools, 12-15 nursery
// a target for school `i`: nursery schools stay in the reed bed; adult
// schools drift to this season's places, the same weighted choice as the
// prototype's schoolTarget() (docs/prototypes/v10/fish.js), all through
// s.rng so a replay stays exact. Winter never targets the open-water bands
// beyond nr 0.78 of the shore, which keeps schools off the ice band (nr >
// ICE_K = 0.86) without a direct iceBlocks() check, same as the prototype.
function nearZone(s: RushSim, zone: { x: number; y: number; r: number }, spread: number): [number, number] {
  for (let k = 0; k < 40; k++) {
    const a = s.rng() * Math.PI * 2, d = Math.sqrt(s.rng()) * zone.r * spread;
    const x = zone.x + Math.cos(a) * d, y = zone.y + Math.sin(a) * d;
    if (nr(x, y) < 0.93 && Math.hypot(x - ISLAND.x, y - ISLAND.y) > 10) return [x, y];
  }
  return randomWater(s, 0.82);
}
function randomWater(s: RushSim, maxK: number): [number, number] {
  for (let k = 0; k < 60; k++) {
    const x = (s.rng() * 2 - 1) * 92, y = (s.rng() * 2 - 1) * 64;
    if (nr(x, y) < maxK && Math.hypot(x - ISLAND.x, y - ISLAND.y) > 11) return [x, y];
  }
  return [0, 20];
}
// season -> [[placeId|null, weight], ...], a weighted pick (null: open water)
const SEASON_PULL: [("river" | "reeds" | "lotus" | "deep" | null), number][][] = [
  [["river", 0.35], ["reeds", 0.15], [null, 0.5]],
  [["lotus", 0.35], ["deep", 0.25], [null, 0.4]],
  [[null, 0.75], ["deep", 0.25]],
  [["deep", 0.7], [null, 0.3]],
];
function schoolTarget(s: RushSim, school: School): [number, number] {
  if (school.nursery) return nearZone(s, ZONES.reeds, 0.8);
  let r = s.rng();
  for (const [id, w] of SEASON_PULL[s.season]) {
    r -= w;
    if (r > 0) continue;
    if (id === null) return randomWater(s, s.season === 3 ? 0.78 : 0.84);
    if (id === "deep") { const a = s.rng() * Math.PI * 2, d = 12 + s.rng() * 9; return [DEEP.x + Math.cos(a) * d, DEEP.y + Math.sin(a) * d]; }
    return nearZone(s, ZONES[id], 0.9);
  }
  return randomWater(s, 0.84);
}
function placeSchools(s: RushSim): void {
  s.schools = Array.from({ length: 16 }, (_, i): School => ({ x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, t: 0, nursery: i >= NURSERY_FIRST }));
  for (const school of s.schools) {
    const [x, y] = schoolTarget(s, school);
    school.x = x; school.y = y;
    const [tx, ty] = schoolTarget(s, school);
    school.tx = tx; school.ty = ty;
    school.t = 3 + s.rng() * 6;
  }
}
// a new fish joins a school (an adult one, or a nursery one if it's young),
// with a small fixed offset from its centre so the school stays a cluster
function newFish(s: RushSim, x: number | null, y: number | null, adult: boolean, school?: number): Fish {
  const sc = school ?? (adult ? Math.floor(s.rng() * NURSERY_FIRST) : NURSERY_FIRST + Math.floor(s.rng() * (16 - NURSERY_FIRST)));
  const ox = (s.rng() * 2 - 1) * 4, oy = (s.rng() * 2 - 1) * 4;
  let fx = x, fy = y;
  if (fx === null || fy === null) { fx = s.schools[sc].x + ox; fy = s.schools[sc].y + oy; }
  return { id: s.nextId++, x: fx, y: fy, h: s.rng() * Math.PI * 2, adult, scare: 0, sx: 0, sy: 0, big: adult && s.rng() < Q.BIG_SHARE, school: sc, ox, oy, ph: s.rng() * Math.PI * 2 };
}
function seedFish(s: RushSim, adults: number, young: number): void {
  placeSchools(s);
  for (let i = 0; i < adults; i++) s.fish.push(newFish(s, null, null, true));
  for (let i = 0; i < young; i++) s.fish.push(newFish(s, null, null, false));
}
const counts = (s: RushSim): [number, number] => { let a = 0, y = 0; for (const f of s.fish) f.adult ? a++ : y++; return [a, y]; };

// opts.botKinds: a test/script-only override of each seat's bot kind
// (default steady/keeper/greedy by seat % 3, below). Not part of the
// Mode<S, I> interface, so no page or API route can reach it: game-hub.ts
// calls mode.make(seed, seats, lake) with exactly three arguments.
// scripts/balance.ts uses it to run a table of one kind (all-greedy, etc.)
// for a target that seat % 3 alone cannot measure.
function make(seed: string, seats: Seat[], lake: { fish: number; adults?: number; young?: number }, opts?: { botKinds?: string[] }): RushSim {
  const players = seats.length;
  const s: RushSim = {
    tick: 0, t: 0, season: 0, phase: "play", phaseT: 0, players, bots: seats.map((x) => x.bot !== null),
    botKinds: seats.map((_, i) => opts?.botKinds?.[i] ?? DEFAULT_BOT_KINDS[i % 3]),
    rng: streamOf(seed, "lake"),
    boats: [], fish: [], nets: [], loose: [], koi: null, koiSpawned: 0, schools: [],
    nextId: 1, cap: Math.round(K * 1.3), market: null, history: [],
  };
  const a0 = lake.adults ?? Math.round(lake.fish * 0.8), y0 = lake.young ?? Math.round(lake.fish * 0.2);
  seedFish(s, a0, y0);
  s.history.push({ startA: a0, startY: y0, caught: 0, young: 0, gongA: 0, gongY: 0, bred: false, bonus: 0, reedsExtra: 0 });
  seats.forEach((_, seat) => {
    const d = dockPos(seat, players), x = d.x - Math.cos(d.inward) * 2, y = d.y - Math.sin(d.inward) * 2;
    s.boats.push({
      seat, x, y, h: d.inward + Math.PI, vx: 0, vy: 0, tx: x, ty: y, hold: [], castCd: 0, dashT: 0, dashCd: 0, stun: 0, shield: 0, unloadT: 0,
      docked: true, tripValue: 0, banked: 0, cards: [], combo: 0, lastCatch: -9, firstScoreAt: null,
      stats: { caught: 0, home: 0, trips: 0, bestTrip: 0, lost: 0, rams: 0, rammed: 0, scooped: 0, koi: 0, youngKilled: 0, youngSpared: 0 },
    });
  });
  return s;
}

function input(_s: RushSim, _seat: number, raw: unknown): RushInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  if (o.k === "steer") {
    const x = Number(o.x), y = Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    // one decimal place: a whole-unit round loses too much on a 92 x 64 lake
    return { k: "steer", x: Math.round(Math.max(-92, Math.min(92, x)) * 10) / 10, y: Math.round(Math.max(-64, Math.min(64, y)) * 10) / 10 };
  }
  if (o.k === "cast") { const c = Number(o.charge ?? 0); return { k: "cast", charge: Number.isFinite(c) ? Math.round(Math.max(0, Math.min(1, c)) * 100) / 100 : 0 }; }
  if (o.k === "dash") return { k: "dash" };
  if (o.k === "pick") { if (o.id === null) return { k: "pick", id: null }; return CARD_IDS.includes(o.id as CardId) ? { k: "pick", id: o.id as CardId } : null; }
  if (o.k === "reroll") return { k: "reroll" };
  return null;
}

function apply(s: RushSim, seat: number, inp: RushInput, ev: GameEvent[]): void {
  if (s.phase === "market") { applyMarket(s, seat, inp, ev); return; }
  if (s.phase !== "play") return;
  const b = s.boats[seat];
  if (!b) return;
  if (inp.k === "steer") { b.tx = inp.x; b.ty = inp.y; }
  if (inp.k === "cast" && b.castCd <= 0 && b.stun <= 0) {
    b.castCd = castCdOf(b);
    if (b.hold.length >= holdMax(b)) { ev.push({ k: "catch", seat, n: 0, fry: 0, koi: false, full: 1, x: b.x, y: b.y }); return; }
    const r = netR(b, inp.charge), x = b.x + Math.cos(b.h) * Q.NET_AHEAD, y = b.y + Math.sin(b.h) * Q.NET_AHEAD;
    s.nets.push({ id: s.nextId++, seat, x, y, r, closeAt: s.t + Q.SINK });
    for (const f of s.fish) { const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy); if (d < r * 1.6 && d > r * 0.7) { f.scare = 0.5; f.sx = dx / d; f.sy = dy / d; } }
    ev.push({ k: "cast", seat, x, y, r, charge: inp.charge });
  }
  if (inp.k === "dash" && b.dashCd <= 0 && b.stun <= 0) {
    b.dashT = Q.DASH_S; b.dashCd = Q.DASH_CD;
    if (Math.hypot(b.tx - b.x, b.ty - b.y) < 2) { b.tx = b.x + Math.cos(b.h) * 20; b.ty = b.y + Math.sin(b.h) * 20; }
    ev.push({ k: "dash", seat });
  }
}

// ---- the market: three cards, secret picks, reveal together when closed ----
function applyMarket(s: RushSim, seat: number, inp: RushInput, ev: GameEvent[]): void {
  const m = s.market; if (!m || m.closed) return;
  const b = s.boats[seat]; if (!b) return;
  if (inp.k === "reroll") {
    if (b.banked < Q.REROLL || m.picked[seat] !== undefined) return;
    b.banked -= Q.REROLL; b.stats.home -= Q.REROLL;
    // every seat starts from the same table offer (m.offer); a reroll only replaces
    // the rerolling seat's own, tracked separately so nobody else's board changes
    const newOffer = offerFor(s);
    ev.push({ k: "offer", seat, offer: newOffer, to: [seat] });
    m.perSeatOffer ??= {};
    m.perSeatOffer[seat] = newOffer;
    return;
  }
  if (inp.k === "pick") {
    if (m.picked[seat] !== undefined) return;
    const offer = m.perSeatOffer?.[seat] ?? m.offer;
    if (inp.id !== null && !offer.includes(inp.id)) return;
    m.picked[seat] = inp.id;
    ev.push({ k: "picked", seat, to: [seat] }); // tells only the picker their pick was accepted; the card id is not repeated here
    maybeCloseMarket(s, ev);
  }
}
function offerFor(s: RushSim): CardId[] {
  const out = new Set<CardId>([pick(s, byKind("greedy")), pick(s, byKind("keeper"))]);
  while (out.size < 3) out.add(pick(s, byKind("plain")));
  return shuffle(s, [...out]);
}
function pick<T>(s: RushSim, arr: T[]): T { return arr[Math.floor(s.rng() * arr.length)]; }
function shuffle<T>(s: RushSim, arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(s.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function botCardWeight(kind: string, bot: string): number {
  const table: Record<string, Record<string, number>> = { greedy: { greedy: 5, keeper: 0.2, plain: 1.5 }, keeper: { greedy: 0.3, keeper: 4, plain: 1.5 }, steady: { greedy: 1, keeper: 1.2, plain: 3 } };
  return table[bot]?.[kind] ?? 1;
}
function botPick(s: RushSim, offer: CardId[], botKind: string): CardId {
  const w = (id: CardId) => botCardWeight(Q.CARDS[id].kind, botKind) * (1 + s.rng());
  return offer.slice().sort((a, b) => w(b) - w(a))[0];
}
function maybeCloseMarket(s: RushSim, ev: GameEvent[]): void {
  const m = s.market; if (!m || m.closed) return;
  if (m.picked.every((p) => p !== undefined)) closeMarket(s, ev);
}
function closeMarket(s: RushSim, ev: GameEvent[]): void {
  const m = s.market; if (!m) return;
  m.closed = true;
  for (const b of s.boats) {
    const chosen = m.picked[b.seat] ?? null;
    if (chosen) b.cards.push(chosen);
  }
  ev.push({ k: "picks", picks: s.boats.map((b) => m.picked[b.seat] ?? null) });
}

function step(s: RushSim, inputs: { seat: number; i: RushInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === "end") return ev;
  for (const { seat, i } of inputs) apply(s, seat, i, ev);
  if (s.phase === "play") {
    moveBoats(s, ev);
    updateSchools(s);
    moveFish(s);
    closeNets(s, ev);
    rams(s, ev);
    floatLoose(s, ev);
    koiTick(s, ev);
  }
  s.tick++;
  s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  s.phaseT += Q.DT;
  advancePhase(s, ev);
  return ev;
}

function advancePhase(s: RushSim, ev: GameEvent[]): void {
  if (s.phase === "play" && s.phaseT >= Q.SEASON_S - 1e-9) { endSeason(s, ev); return; }
  if (s.phase === "rest" && s.phaseT >= Q.REST_S - 1e-9) {
    startMarket(s, ev);
    return;
  }
  if (s.phase === "market") {
    const m = s.market!;
    if (!m.closed && s.t >= m.closesAt - 1e-9) {
      for (const seat of s.boats.map((b) => b.seat)) if (m.picked[seat] === undefined) m.picked[seat] = null;
      closeMarket(s, ev);
    }
    if (m.closed && s.phaseT >= Q.MARKET_S + Q.REVEAL_S - 1e-9) startSeason(s, ev); // the reveal pause, matching the prototype's picked-screen pause
  }
}

// three rests that breed (spring, summer, autumn), then winter's gong goes
// straight to the ceremony (DESIGN.md "8. After winter, the ceremony" — no
// fourth rest, no market): isLastSeason() is true exactly when s.season is
// already winter, since startSeason() only advances it on the way INTO a
// season, never past the last one.
function isLastSeason(s: RushSim): boolean { return s.season >= Q.SEASONS - 1; }
function endSeason(s: RushSim, ev: GameEvent[]): void {
  let spoiled = 0;
  for (const b of s.boats) { spoiled += holdValue(b); b.stats.lost += holdValue(b); if (b.tripValue > 0) { b.stats.trips++; b.stats.bestTrip = Math.max(b.stats.bestTrip, b.tripValue); b.tripValue = 0; } b.hold = []; }
  s.nets = []; s.loose = []; s.koi = null;
  ev.push({ k: "gong", spoiled });
  const [gongA, gongY] = counts(s);
  const hist = s.history[s.history.length - 1];
  hist.gongA = gongA; hist.gongY = gongY;
  if (isLastSeason(s)) { s.phase = "end"; ev.push({ k: "end" }); return; }
  s.phase = "rest"; s.phaseT = 0;
  // breed: Fish Ladder sums across everyone who has it; Reed Bed too
  const ladders = s.boats.reduce((n, b) => n + (has(b, "ladder") ? 1 : 0), 0);
  const reedOwners = s.boats.filter((b) => has(b, "reeds"));
  const bonus = Q.LADDER_BONUS * ladders, reedsExtra = reedOwners.length * Q.REEDS_YOUNG;
  const r = breedLake(gongA, gongY, bonus);
  const born = r.born + reedsExtra;
  hist.bred = true; hist.bonus = bonus; hist.reedsExtra = reedsExtra;
  for (const f of s.fish) f.adult = true;
  for (let i = 0; i < born; i++) {
    const owner = reedOwners.length && i < reedsExtra ? reedOwners[i % reedOwners.length] : null;
    if (owner) { const d = dockPos(owner.seat, s.players); s.fish.push(newFish(s, d.x + (s.rng() - 0.5) * 4, d.y + (s.rng() - 0.5) * 4, false)); }
    else s.fish.push(newFish(s, null, null, false));
  }
  if (ladders) for (const b of s.boats) if (has(b, "ladder")) { const gift = Math.floor(born / Q.LADDER_PER); b.banked += gift; b.stats.home += gift; }
  ev.push({ k: "rest", grew: gongY, born });
}
function startMarket(s: RushSim, ev: GameEvent[]): void {
  s.phase = "market"; s.phaseT = 0;
  const offer = offerFor(s);
  const botPicks: (CardId | null)[] = s.boats.map((b, i) => (s.bots[i] ? botPick(s, offerFor(s), s.botKinds[i]) : null));
  s.market = { offer, botPicks, picked: s.boats.map((_, i) => (s.bots[i] ? botPicks[i] : undefined)), closesAt: s.t + Q.MARKET_S, closed: false };
  ev.push({ k: "market", offer, players: s.players });
}
// the default bot kinds by seat, steady/keeper/greedy (seat % 3); a real
// room always gets this (make()'s opts.botKinds is script/test-only)
export const DEFAULT_BOT_KINDS = ["steady", "keeper", "greedy"];
export function botKindOf(i: number): string { return DEFAULT_BOT_KINDS[i % 3]; }
function startSeason(s: RushSim, ev: GameEvent[]): void {
  s.season = (s.season + 1) as Season; s.phase = "play"; s.phaseT = 0; s.market = null;
  for (const b of s.boats) { const d = dockPos(b.seat, s.players); b.x = d.x; b.y = d.y; b.h = d.inward + Math.PI; b.docked = true; b.combo = 0; }
  placeSchools(s); // fresh targets for the new season's places (prototype's rNextSeason())
  const [a, y] = counts(s);
  s.history.push({ startA: a, startY: y, caught: 0, young: 0, gongA: 0, gongY: 0, bred: false, bonus: 0, reedsExtra: 0 });
  ev.push({ k: "season", season: s.season });
}

function moveBoats(s: RushSim, ev: GameEvent[]): void {
  const dt = Q.DT, rushOn = s.phaseT >= Q.SEASON_S - Q.RUSH_S;
  for (const b of s.boats) {
    if (b.castCd > 0) b.castCd -= dt;
    if (b.dashCd > 0) b.dashCd -= dt;
    if (b.dashT > 0) b.dashT -= dt;
    if (b.shield > 0) b.shield -= dt;
    if (b.stun > 0) { b.stun -= dt; b.vx *= 0.85; b.vy *= 0.85; }
    else {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      const load = b.hold.length / holdMax(b);
      const inReeds = Math.hypot(b.x - ZONES.reeds.x, b.y - ZONES.reeds.y) < ZONES.reeds.r;
      const v = speedMult(b) * (1 - Q.LOAD_SLOW * load) * (b.dashT > 0 ? Q.DASH_MULT : 1) * (inReeds ? 0.62 : 1);
      const want = b.dashT > 0 ? 1 : d > 0.4 ? Math.min(1, d / 4) : 0;
      const dirx = d > 0.4 ? dx / d : Math.cos(b.h), diry = d > 0.4 ? dy / d : Math.sin(b.h);
      const k = Math.min(1, Q.ACCEL * dt * (b.dashT > 0 ? 3 : 1));
      b.vx += (dirx * v * want - b.vx) * k; b.vy += (diry * v * want - b.vy) * k;
      if (inReeds) { const sp = Math.hypot(b.vx, b.vy); if (sp > v) { b.vx *= v / sp; b.vy *= v / sp; } }
    }
    let nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    if (nr(nx, ny) > 0.965) { const a = Math.atan2(ny, nx), shoreR = Math.hypot(nx, ny) / nr(nx, ny); nx = Math.cos(a) * shoreR * 0.965; ny = Math.sin(a) * shoreR * 0.965; b.vx *= 0.5; b.vy *= 0.5; }
    if (blockedAt(nx, ny, s.season)) { nx = b.x; ny = b.y; b.vx *= 0.3; b.vy *= 0.3; }
    b.x = nx; b.y = ny;
    if (Math.hypot(b.vx, b.vy) > 0.8) b.h = Math.atan2(b.vy, b.vx);
    if (b.dashT > 0) for (const f of s.fish) { const fx = f.x - b.x, fy = f.y - b.y, fd = Math.hypot(fx, fy); if (fd < 4 && fd > 0) { f.scare = 0.4; f.sx = fx / fd; f.sy = fy / fd; } }
    if (has(b, "trawl") && Math.hypot(b.vx, b.vy) > 0.2 && b.hold.length < holdMax(b)) trawlPickup(s, b, ev);
    const d = dockPos(b.seat, s.players);
    const wasDocked = b.docked;
    b.docked = Math.hypot(b.x - d.x, b.y - d.y) < Q.DOCK_R;
    if (b.docked && !wasDocked) { b.unloadT = Q.UNLOAD_EVERY; b.tripValue = 0; }
    if (!b.docked && wasDocked && b.tripValue > 0) { b.stats.trips++; b.stats.bestTrip = Math.max(b.stats.bestTrip, b.tripValue); b.tripValue = 0; }
    if (b.docked && b.hold.length) {
      b.unloadT -= dt;
      let v = 0;
      while (b.unloadT <= 0 && b.hold.length) { b.unloadT += Q.UNLOAD_EVERY; v += b.hold.pop()!; }
      if (v) {
        b.banked += v; b.stats.home += v; b.tripValue += v;
        b.firstScoreAt ??= s.t;
        ev.push({ k: "bank", seat: b.seat, v, banked: b.banked });
      }
    }
    void rushOn;
  }
}
function trawlPickup(s: RushSim, b: Boat, ev: GameEvent[]): void {
  for (let i = s.fish.length - 1; i >= 0; i--) {
    const f = s.fish[i];
    if (Math.hypot(f.x - b.x, f.y - b.y) > 0.26) continue;
    s.fish.splice(i, 1);
    const val = s.season === 2 ? Q.BIG_MULT : f.big ? Q.BIG_MULT : 1;
    b.hold.push(val); b.stats.caught += val;
    const young = !f.adult;
    if (young) b.stats.youngKilled++;
    const hist = s.history[s.history.length - 1];
    hist.caught++; if (young) hist.young++; // one fish left the lake, whatever its card-doubled value
    ev.push({ k: "catch", seat: b.seat, n: 1, fry: f.adult ? 0 : 1, koi: false, full: 0, x: b.x, y: b.y });
    break;
  }
}

// a school drifts toward its target, retargeting when it arrives or its
// patience runs out (the prototype's updateFish(), schools loop)
function updateSchools(s: RushSim): void {
  const dt = Q.DT;
  for (const school of s.schools) {
    if (Math.hypot(school.tx - school.x, school.ty - school.y) < 3 || school.t <= 0) {
      const [tx, ty] = schoolTarget(s, school);
      school.tx = tx; school.ty = ty; school.t = 6 + s.rng() * 8;
    }
    school.t -= dt;
    const d = Math.hypot(school.tx - school.x, school.ty - school.y) || 1, sp = school.nursery ? 1.6 : 2.6;
    school.vx += ((school.tx - school.x) / d * sp - school.vx) * dt;
    school.vy += ((school.ty - school.y) / d * sp - school.vy) * dt;
    school.x += school.vx * dt; school.y += school.vy * dt;
    if (Math.hypot(school.x - ISLAND.x, school.y - ISLAND.y) < ISLAND.r + 3) {
      const a = Math.atan2(school.y - ISLAND.y, school.x - ISLAND.x);
      school.x = ISLAND.x + Math.cos(a) * (ISLAND.r + 3); school.y = ISLAND.y + Math.sin(a) * (ISLAND.r + 3);
    }
  }
}
// a grid cell key that never collides: lake coordinates are bounded (+/- 92,
// +/- 64), so an offset well past that bound keeps every (gx, gy) pair
// unique (rush 1.0's `gx*1000+gy` relied on coordinates always being
// positive; this lake's are not, so that scheme silently collided two
// distant cells into one bucket and made every fish check every other).
const GRID_OFFSET = 1000;
// each fish follows its school's centre plus a small rotating offset (the
// prototype's updateFish() fish loop), so a school stays a tight, catchable
// cluster; separation inside a school keeps individual fish from stacking
// exactly on top of each other, and scare/reeds/ice still apply on top.
// DESIGN.md and the prototype breed only at the rest (breedLake(), in
// endSeason()), and young fish grow up only there too (for (const f of
// s.fish) f.adult = true). This used to also pair adults mid-season
// (MATE, BREED_CHANCE, COOL) and mature young after MATURE_S — a rush 1.0
// leftover the port never dropped, which the prototype's own first-gong
// young count (exactly the starting 50, no more) rules out. No in-season
// population change now except a catch leaving the lake.
function moveFish(s: RushSim): void {
  const cs = Q.SEP * 3, grid = new Map<number, number[]>();
  const cellKey = (gx: number, gy: number): number => (gx + GRID_OFFSET) * 100000 + (gy + GRID_OFFSET);
  s.fish.forEach((f, i) => { const k = cellKey((f.x / cs) | 0, (f.y / cs) | 0); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i); });
  const N = s.fish.length;
  for (let i = 0; i < N; i++) {
    const f = s.fish[i];
    const school = s.schools[f.school];
    const a = s.t * 0.35 + f.ph;
    let tx = school.x + f.ox * Math.cos(a) - f.oy * Math.sin(a) * 0.6;
    let ty = school.y + f.ox * Math.sin(a) * 0.6 + f.oy * Math.cos(a);
    let sepx = 0, sepy = 0;
    const gx = (f.x / cs) | 0, gy = (f.y / cs) | 0;
    for (let a2 = gx - 1; a2 <= gx + 1; a2++) for (let c = gy - 1; c <= gy + 1; c++) {
      const cell = grid.get(cellKey(a2, c)); if (!cell) continue;
      for (const j of cell) {
        if (j === i) continue;
        const o = s.fish[j], dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
        if (d2 > Q.SEP * Q.SEP || o.adult !== f.adult) continue;
        sepx -= dx; sepy -= dy;
      }
    }
    let dx = tx - f.x, dy = ty - f.y;
    if (!f.adult && nr(f.x, f.y) < Q.SHALLOW) { dx += (f.x / 92) * 10; dy += (f.y / 64) * 10; }
    const inReeds = Math.hypot(f.x - ZONES.reeds.x, f.y - ZONES.reeds.y) < ZONES.reeds.r;
    if (f.scare > 0) { dx += f.sx * 6; dy += f.sy * 6; f.scare -= Q.DT; }
    const followSpeed = Math.min(1, Q.DT * 1.6);
    let nx = f.x + (dx + sepx * 0.5) * followSpeed, ny = f.y + (dy + sepy * 0.5) * followSpeed;
    if (f.scare > 0) { const v = (f.adult ? Q.V_ADULT : Q.V_FRY) * 2.2 * (inReeds ? 0.6 : 1); nx = f.x + f.sx * v * Q.DT; ny = f.y + f.sy * v * Q.DT; }
    if (blockedAt(nx, ny, s.season)) { nx = f.x; ny = f.y; }
    if (Math.abs(nx - f.x) + Math.abs(ny - f.y) > 0.02) { const nh = Math.atan2(ny - f.y, nx - f.x); f.h += Math.atan2(Math.sin(nh - f.h), Math.cos(nh - f.h)) * Math.min(1, Q.DT * 5); }
    f.x = nx; f.y = ny;
  }
}

function closeNets(s: RushSim, ev: GameEvent[]): void {
  const still: Net[] = [];
  const val = s.season === 2 ? Q.BIG_MULT : 1; // autumn: every fish counts double
  for (const net of s.nets) {
    if (net.closeAt > s.t + 1e-9) { still.push(net); continue; }
    const b = s.boats[net.seat];
    let room = Math.min(holdMax(b) - b.hold.length, Q.NET_MAX + (has(b, "wideNet") ? 2 : 0) + (has(b, "fineMesh") ? 2 : 0)), n = 0, fry = 0, full = 0, koi = false, youngKilled = 0, youngSpared = 0;
    if (s.koi && room > 0 && Math.hypot(s.koi.x - net.x, s.koi.y - net.y) < net.r + 1) { b.hold.push(koiValue(b)); room--; koi = true; b.stats.koi++; s.koi = null; }
    s.fish = s.fish.filter((f) => {
      const dx = f.x - net.x, dy = f.y - net.y, d = Math.hypot(dx, dy);
      if (d > net.r) return true;
      if (!f.adult) {
        if (takesYoung(b)) { if (room > 0) { room--; n++; youngKilled++; b.hold.push(val * (has(b, "fineMesh") ? 1 : 1)); return false; } full++; return true; }
        youngSpared++; f.scare = 0.6; f.sx = dx / (d || 1); f.sy = dy / (d || 1); return true;
      }
      if (room <= 0) { full++; return true; }
      room--; n++; b.hold.push(val * (f.big ? Q.BIG_MULT : 1)); return false;
    });
    // a closing net scares about half the fish nearby (prototype's rCloseNet), whether or not it caught anything
    for (const f of s.fish) {
      const dx = f.x - net.x, dy = f.y - net.y, d = Math.hypot(dx, dy);
      if (d < net.r * Q.SCATTER_R && d > 0 && s.rng() < 0.5) { f.scare = 0.5; f.sx = dx / d; f.sy = dy / d; }
    }
    b.stats.caught += n; b.stats.youngKilled += youngKilled; b.stats.youngSpared += youngSpared;
    if (n >= 3 && s.t - b.lastCatch < Q.CHAIN_S) b.combo++; else if (n >= 3) b.combo = 1; else b.combo = 0;
    if (n >= 3) b.lastCatch = s.t;
    if (b.combo >= 2 && holdMax(b) - b.hold.length > 0) b.hold.push(Q.CHAIN_BONUS);
    const hist = s.history[s.history.length - 1];
    if (hist) { hist.caught += n; hist.young += youngKilled; }
    ev.push({ k: "catch", seat: b.seat, n, fry, koi, full, x: net.x, y: net.y, combo: b.combo >= 2 ? b.combo : 0 });
  }
  s.nets = still;
}

function rams(s: RushSim, ev: GameEvent[]): void {
  for (const a of s.boats) {
    if (a.dashT <= 0) continue;
    for (const v of s.boats) {
      if (v === a || v.shield > 0 || Math.hypot(a.x - v.x, a.y - v.y) > Q.RAM_R) continue;
      if (nearAnyDock(s, v.x, v.y, Q.SAFE_R) || nearAnyDock(s, a.x, a.y, Q.SAFE_R)) continue;
      const max = Q.RAM_DROP + (has(a, "ironBow") ? Q.CARDS.ironBow.dealt! : 0) - (has(v, "ironBow") ? Q.CARDS.ironBow.taken! : 0);
      const drop: number[] = [];
      while (drop.length < max && v.hold.length) drop.push(v.hold.pop()!);
      for (const value of drop) { const t = s.rng() * Math.PI * 2, sp = 4 + s.rng() * 5; s.loose.push({ id: s.nextId++, x: v.x, y: v.y, vx: Math.cos(t) * sp, vy: Math.sin(t) * sp, value, t: s.t }); }
      const lost = drop.reduce((n, x) => n + x, 0);
      v.stats.lost += lost; v.stats.rammed++; a.stats.rams++;
      v.stun = Q.STUN; v.shield = Q.SHIELD;
      const ang = Math.atan2(v.y - a.y, v.x - a.x);
      v.vx = Math.cos(ang) * 16; v.vy = Math.sin(ang) * 16;
      a.dashT = 0; a.vx *= 0.3; a.vy *= 0.3;
      ev.push({ k: "ram", a: a.seat, v: v.seat, n: drop.length });
      break;
    }
  }
}
const nearAnyDock = (s: RushSim, x: number, y: number, r: number): boolean => s.boats.some((b) => { const d = dockPos(b.seat, s.players); return Math.hypot(x - d.x, y - d.y) < r; });

// an un-scooped value-1 fish respawns live after LOOSE_S: population change
// nobody caught, so the caller records it in the season's history too
// an un-scooped loose fish (spilled by a ram) is simply lost after LOOSE_S,
// same as the prototype's R.loose (rSpill/rushUpdate): nothing adds it back
// to the lake. It already left the lake the moment it was rammed out of a
// hold, so this isn't a second catch — results() counts it under "lost",
// never "caught".
function floatLoose(s: RushSim, ev: GameEvent[]): void {
  const keep: Loose[] = [];
  for (const l of s.loose) {
    l.vx *= 0.92; l.vy *= 0.92; l.x += l.vx * Q.DT; l.y += l.vy * Q.DT;
    if (s.t - l.t > Q.LOOSE_S) continue;
    let taken = false;
    if (s.t - l.t > 0.3) for (const b of s.boats) {
      if (b.stun > 0 || b.hold.length >= holdMax(b) || Math.hypot(b.x - l.x, b.y - l.y) > Q.PICK_R) continue;
      b.hold.push(l.value); b.stats.scooped += l.value; taken = true;
      ev.push({ k: "pick", seat: b.seat, v: l.value, x: l.x, y: l.y });
      break;
    }
    if (!taken) keep.push(l);
  }
  s.loose = keep;
}

function koiTick(s: RushSim, ev: GameEvent[]): void {
  const koiAllowed = s.season === 1; // summer: two golden carp
  if (!s.koi && koiAllowed && s.koiSpawned < 2 && s.phaseT < Q.SEASON_S - Q.KOI_STOP && s.rng() < 0.003) {
    const a = s.rng() * Math.PI * 2;
    s.koi = { x: Math.cos(a) * 15, y: -15 + Math.sin(a) * 14, h: s.rng() * Math.PI * 2, until: s.t + Q.KOI_FOR };
    s.koiSpawned++;
    ev.push({ k: "koi", x: s.koi.x, y: s.koi.y });
  }
  const k = s.koi; if (!k) return;
  if (s.t >= k.until) { s.koi = null; return; }
  let fx = 0, fy = 0;
  for (const b of s.boats) {
    const pull = has(b, "goldHook") ? 1.6 : 0;
    const dx = k.x - b.x, dy = k.y - b.y, d = Math.hypot(dx, dy); if (pull && d < 14 && d > 0) { fx += (dx / d) * pull; fy += (dy / d) * pull; }
  }
  k.h = Math.atan2(Math.sin(k.h) + fy, Math.cos(k.h) + fx) + (s.rng() - 0.5) * 0.4;
  if (nr(k.x, k.y) > 0.7) k.h = Math.atan2(-k.y, -k.x);
  k.x += Math.cos(k.h) * 4.5 * Q.DT; k.y += Math.sin(k.h) * 4.5 * Q.DT;
}

// ---- a bot: only what a person could see, a person's slower hands ----
// Its kind (steady, keeper, greedy) matches the market's weighting.
function bot(s: RushSim, seat: number, r: () => number): RushInput[] {
  const kind = s.botKinds[seat];
  if (s.phase === "market") {
    const m = s.market; if (!m || m.picked[seat] !== undefined) return [];
    const offer = m.perSeatOffer?.[seat] ?? m.offer;
    return r() < 0.4 ? [] : [{ k: "pick", id: botPick(s, offer, kind) }];
  }
  if (s.phase !== "play" || r() > 0.2) return [];
  const b = s.boats[seat];
  const out: RushInput[] = [];
  const d = dockPos(seat, s.players), left = Q.SEASON_S - s.phaseT, n = b.hold.length, max = holdMax(b);
  const homeAt = kind === "greedy" ? 0.95 : kind === "keeper" ? 0.6 : 0.75;
  // rThink: not "time left" alone, but time left against the trip home,
  // at this boat's actual (load-slowed) speed
  const tripHome = Math.hypot(d.x - b.x, d.y - b.y) / Math.max(4, speedOf(b));
  const goHome = n >= max * homeAt || left < tripHome + (kind === "greedy" ? 2.5 : 4.5);
  if (goHome) { out.push({ k: "steer", x: Math.round(d.x), y: Math.round(d.y) }); return out; }
  if (s.koi && n < max && Math.hypot(s.koi.x - b.x, s.koi.y - b.y) < 26) {
    out.push({ k: "steer", x: Math.round(s.koi.x), y: Math.round(s.koi.y) });
    if (Math.hypot(s.koi.x - b.x, s.koi.y - b.y) < 10 && b.dashCd <= 0) out.push({ k: "dash" });
    return out;
  }
  if (kind === "greedy" && b.dashCd <= 0) {
    const prey = s.boats.filter((o) => o !== b && o.hold.length >= 5 && o.shield <= 0 && Math.hypot(o.x - b.x, o.y - b.y) < 14 && !nearAnyDock(s, o.x, o.y, Q.SAFE_R))[0];
    if (prey) {
      out.push({ k: "steer", x: Math.round(prey.x), y: Math.round(prey.y) });
      if (Math.hypot(prey.x - b.x, prey.y - b.y) < 8) out.push({ k: "dash" });
      return out;
    }
  }
  // the fullest, nearest school (prototype's rThink): count fish per
  // school, weight by distance, skip a school sitting in winter ice
  const cnt = new Array(s.schools.length).fill(0);
  for (const f of s.fish) if (f.adult || takesYoung(b)) cnt[f.school]++;
  let best: { x: number; y: number } | null = null, bestScore = -1;
  s.schools.forEach((school, i) => {
    if (iceBlocks(school.x, school.y, s.season)) return;
    const score = cnt[i] / (8 + Math.hypot(school.x - b.x, school.y - b.y));
    if (score > bestScore) { bestScore = score; best = { x: school.x, y: school.y }; }
  });
  if (best) {
    const { x: sx, y: sy } = best as { x: number; y: number };
    const dx = sx - b.x, dy = sy - b.y, dd = Math.hypot(dx, dy) || 1;
    const off = dd > Q.NET_AHEAD + 1 ? Q.NET_AHEAD : 0;
    let tx = sx - (dx / dd) * off, ty = sy - (dy / dd) * off;
    if (dd < Q.NET_AHEAD + 1.5) { tx = sx + (dx / dd) * 4; ty = sy + (dy / dd) * 4; }
    out.push({ k: "steer", x: Math.round(tx), y: Math.round(ty) });
  }
  const ax = b.x + Math.cos(b.h) * Q.NET_AHEAD, ay = b.y + Math.sin(b.h) * Q.NET_AHEAD;
  if (b.castCd <= 0) {
    let c = 0; for (const f of s.fish) if ((f.adult || takesYoung(b)) && (f.x - ax) ** 2 + (f.y - ay) ** 2 < Q.NET_R * Q.NET_R) c++;
    if (c >= (kind === "keeper" ? 3 : 2)) out.push({ k: "cast", charge: c >= 5 ? 1 : 0 });
  }
  return out;
}

// ---- what a browser is sent: per-seat now (market picks are secret until the market closes) ----
const FLAG = { DASH: 1, STUN: 2, SHIELD: 4, DOCKED: 8, KOI: 16 } as const;
// positions travel as integers at 10x scale (0.1-unit precision in this
// small lake, x/10 to get world units back) so the wire format stays plain
// numbers, not floats
function frameFor(s: RushSim, seat: number) {
  const m = s.market;
  return {
    t: s.t, season: s.season, phase: s.phase, phaseT: Math.round(s.phaseT * 10) / 10,
    left: s.phase === "play" ? Math.max(0, Q.SEASON_S - s.phaseT) : s.phase === "rest" ? Math.max(0, Q.REST_S - s.phaseT) : Math.max(0, Q.MARKET_S - s.phaseT),
    fishN: s.fish.length, players: s.players,
    market: m ? {
      offer: seat >= 0 ? (m.perSeatOffer?.[seat] ?? m.offer) : m.offer,
      closed: m.closed,
      // a pick shows for its own seat always; for others, only once the market has closed
      picks: s.boats.map((b) => (m.closed || b.seat === seat ? (m.picked[b.seat] ?? null) : m.picked[b.seat] === undefined ? undefined : "hidden")),
    } : null,
    b: s.boats.map((b) => [b.seat, Math.round(b.x * 10), Math.round(b.y * 10), Math.round(b.h * 100), b.hold.length, holdMax(b),
      (b.dashT > 0 ? FLAG.DASH : 0) | (b.stun > 0 ? FLAG.STUN : 0) | (b.shield > 0 ? FLAG.SHIELD : 0) | (b.docked ? FLAG.DOCKED : 0) | (b.hold.includes(koiValue(b)) ? FLAG.KOI : 0),
      b.banked, Math.max(0, Math.ceil(b.castCd * 10)), Math.max(0, Math.ceil(b.dashCd * 10)), b.cards, Math.round(b.tx * 10), Math.round(b.ty * 10)]),
    f: s.fish.map((f) => [Math.round(f.x * 10), Math.round(f.y * 10), Math.round(f.h * 100), f.adult ? 1 : 0]),
    n: s.nets.map((n) => [n.seat, Math.round(n.x * 10), Math.round(n.y * 10), Math.round(n.r * 10), Math.round((n.closeAt - s.t) * 1000)]),
    l: s.loose.map((l) => [l.id, Math.round(l.x * 10), Math.round(l.y * 10), l.value]),
    k: s.koi ? [Math.round(s.koi.x * 10), Math.round(s.koi.y * 10), Math.round(s.koi.h * 100)] : null,
  };
}

// ---- next spring, from the match's own history: one function, used both
// for the real result (scale 1) and the counterfactual (scale 0.8, every
// catch replaced by a lighter one). Each entry already recorded the real
// population at its gong (gongA/gongY, straight from s.fish); scale 1 only
// has to put caught fish back to reproduce that population exactly — the
// guard test below checks this against results() on real seeds. Scale 0.8
// adds back the 20% of each catch a lighter hand would have left, split
// adult/young the way it was actually caught, then breeds (if this season
// did) exactly as endSeason() did, with that season's own bonus and Reed
// Bed extra. Winter's entry never breeds (bred stays false): the final
// nextSpring() call there is forecast(), once, same as a real year's end.
// Exported for rush.test.ts's hand-computed example; nothing else calls it
// from outside this module.
export function nextSpring(history: SeasonHistory[], scale: number): number {
  let a = 0, y = 0;
  for (const h of history) {
    a = h.gongA + (1 - scale) * (h.caught - h.young);
    y = h.gongY + (1 - scale) * h.young;
    if (h.bred) {
      const r = breedLake(Math.round(a), Math.round(y), h.bonus);
      a = r.adults; y = r.born + h.reedsExtra;
    }
  }
  return forecast(a, y);
}

function titlesFor(s: RushSim): { key: string; vars: Record<string, string | number>; seat: number }[] {
  const by = (f: (b: Boat) => number) => [...s.boats].sort((p, q) => f(q) - f(p))[0];
  const out: { key: string; vars: Record<string, string | number>; seat: number }[] = [];
  const king = by((b) => b.stats.home); out.push({ key: "king", vars: { n: king.stats.home }, seat: king.seat });
  const keep = by((b) => b.stats.youngSpared); if (keep.stats.youngSpared) out.push({ key: "keeper", vars: { n: keep.stats.youngSpared }, seat: keep.seat });
  const mesh = by((b) => b.stats.youngKilled); if (mesh.stats.youngKilled) out.push({ key: "mesh", vars: { n: mesh.stats.youngKilled }, seat: mesh.seat });
  const ram = by((b) => b.stats.rams); if (ram.stats.rams) out.push({ key: "ram", vars: { n: ram.stats.rams }, seat: ram.seat });
  const koi = by((b) => b.stats.koi); if (koi.stats.koi) out.push({ key: "koi", vars: {}, seat: koi.seat });
  return out.slice(0, 4);
}

function results(s: RushSim): Results {
  const order = s.boats.map((b) => b.banked);
  const seats = s.boats.map((b) => ({
    seat: b.seat, score: b.banked, place: 1 + order.filter((v) => v > b.banked).length, firstScoreS: b.firstScoreAt,
    trips: b.stats.trips, bestTrip: b.stats.bestTrip, lost: b.stats.lost, scooped: b.stats.scooped, rams: b.stats.rams, cards: b.cards,
    youngKilled: b.stats.youngKilled, youngSpared: b.stats.youngSpared,
  }));
  const best = [...s.boats].sort((a, b) => b.stats.bestTrip - a.stats.bestTrip)[0];
  const loss = [...s.boats].sort((a, b) => b.stats.lost - a.stats.lost)[0];
  const rammer = [...s.boats].sort((a, b) => b.stats.rams - a.stats.rams)[0];
  const highlights: Highlight[] = [
    { title: "Best trip", text: best.stats.bestTrip ? `{name}: ${best.stats.bestTrip} fish home at once` : "nobody got a trip home", seat: best.seat, tkey: "hl_rush_best_t", key: best.stats.bestTrip ? "hl_rush_best" : "hl_rush_best_none", vars: { n: best.stats.bestTrip } },
    { title: "Biggest loss", text: loss.stats.lost ? `{name}: lost ${loss.stats.lost} (rams and the gong)` : "nobody lost a fish", seat: loss.seat, tkey: "hl_rush_loss_t", key: loss.stats.lost ? "hl_rush_loss" : "hl_rush_loss_none", vars: { n: loss.stats.lost } },
    { title: "Rams", text: rammer.stats.rams ? `{name}: ${rammer.stats.rams} rams` : "nobody rammed", seat: rammer.seat, tkey: "hl_rush_rams_t", key: rammer.stats.rams ? "hl_rush_rams" : "hl_rush_rams_none", vars: { n: rammer.stats.rams } },
  ];
  const next = nextSpring(s.history, 1);
  const alt = nextSpring(s.history, 0.8);
  const fairShare = Math.max(1, Math.round((s.boats.reduce((n, b) => n + b.banked, 0)) / s.boats.length));
  return {
    seats, lakeLeft: Math.min(K, next), highlights,
    titles: titlesFor(s), counterfactual: { alt, tierId: tierOf(alt).id }, fairShare,
    ledger: s.boats.map((b) => ({ seat: b.seat, home: b.stats.home, young: b.stats.youngKilled, spared: b.stats.youngSpared })),
  };
}

export const rush: Mode<RushSim, RushInput> = {
  id: "rush", model: RUSH_MODEL, seats: Q.SEATS, breeds: true,
  make, input, step, frameFor, over: (s) => s.phase === "end", results, bot,
};
// make(), with its script/test-only 4th argument: Mode<S, I>'s make() takes
// exactly three, so rush.make loses that overload. scripts/balance.ts and
// rush.test.ts import this instead of rush.make when they need it.
export const makeWithOpts = make;
