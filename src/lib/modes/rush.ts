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
import { blockedAt, breed as breedLake, dockPos, forecast, K, nr, tierOf, ZONES } from "../lake-world.ts";

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

interface Fish { id: number; x: number; y: number; h: number; adult: boolean; born: number; cool: number; scare: number; sx: number; sy: number; big: boolean }
interface Net { id: number; seat: number; x: number; y: number; r: number; closeAt: number }
interface Loose { id: number; x: number; y: number; vx: number; vy: number; value: number; t: number }
interface Koi { x: number; y: number; h: number; until: number }
interface Stats { caught: number; home: number; trips: number; bestTrip: number; lost: number; rams: number; rammed: number; scooped: number; koi: number; youngKilled: number; youngSpared: number }
interface Boat {
  seat: number; x: number; y: number; h: number; vx: number; vy: number; tx: number; ty: number;
  hold: number[]; castCd: number; dashT: number; dashCd: number; stun: number; shield: number; unloadT: number;
  docked: boolean; tripValue: number; banked: number; cards: CardId[]; combo: number; lastCatch: number;
  stats: Stats; firstScoreAt: number | null;
  mind: { spot: [number, number] | null; spotT: number; calm: number };
}
interface Market { offer: CardId[]; botPicks: (CardId | null)[]; picked: (CardId | null | undefined)[]; closesAt: number; closed: boolean; perSeatOffer?: Record<number, CardId[]> }
interface SeasonHistory { startA: number; startY: number; endA: number; endY: number; caught: number; young: number }
export interface RushSim {
  tick: number; t: number; season: Season; phase: "play" | "rest" | "market" | "end"; phaseT: number;
  players: number; bots: boolean[]; rng: () => number;
  boats: Boat[]; fish: Fish[]; nets: Net[]; loose: Loose[]; koi: Koi | null; koiSpawned: number;
  nextId: number; cap: number; market: Market | null; history: SeasonHistory[];
}

const has = (b: Boat, id: CardId): boolean => b.cards.includes(id);
const holdMax = (b: Boat): number => Q.HOLD + (has(b, "bigHold") ? Q.CARDS.bigHold.hold! : 0);
const netR = (b: Boat, charge: number): number => Q.NET_R * (has(b, "wideNet") ? Q.CARDS.wideNet.net! : 1) * (1 + 0.3 * charge);
const castCdOf = (b: Boat): number => Q.CAST_CD * (has(b, "quickHands") ? Q.CARDS.quickHands.castCd! : 1);
const koiValue = (b: Boat): number => (has(b, "goldHook") ? Q.CARDS.goldHook.koiValue! : Q.KOI_VALUE);
const takesYoung = (b: Boat): boolean => (has(b, "fineMesh") || has(b, "trawl")) && !has(b, "release");
const speedMult = (b: Boat): number => Q.SPEED * (has(b, "fastHull") ? Q.CARDS.fastHull.speed! : 1);
const holdValue = (b: Boat): number => b.hold.reduce((n, v) => n + v, 0);

function newFish(s: RushSim, x: number | null, y: number | null, adult: boolean): Fish {
  let fx = x, fy = y;
  if (fx === null || fy === null) {
    do { fx = (s.rng() * 2 - 1) * 92; fy = (s.rng() * 2 - 1) * 64; } while (nr(fx, fy) > 0.88 || blockedAt(fx, fy, s.season));
  }
  return { id: s.nextId++, x: fx, y: fy, h: s.rng() * Math.PI * 2, adult, born: s.t, cool: adult ? 0 : Q.COOL, scare: 0, sx: 0, sy: 0, big: adult && s.rng() < Q.BIG_SHARE };
}
function seedFish(s: RushSim, adults: number, young: number): void {
  const reedsN = Math.round(adults * 0.22);
  for (let i = 0; i < adults; i++) {
    if (i < reedsN) { const a = s.rng() * Math.PI * 2, d = Math.sqrt(s.rng()) * ZONES.reeds.r * 0.9; s.fish.push(newFish(s, ZONES.reeds.x + Math.cos(a) * d, ZONES.reeds.y + Math.sin(a) * d, true)); }
    else s.fish.push(newFish(s, null, null, true));
  }
  for (let i = 0; i < young; i++) { const a = s.rng() * Math.PI * 2, d = Math.sqrt(s.rng()) * ZONES.reeds.r * 0.9; s.fish.push(newFish(s, ZONES.reeds.x + Math.cos(a) * d, ZONES.reeds.y + Math.sin(a) * d, false)); }
}
const counts = (s: RushSim): [number, number] => { let a = 0, y = 0; for (const f of s.fish) f.adult ? a++ : y++; return [a, y]; };

function make(seed: string, seats: Seat[], lake: { fish: number; adults?: number; young?: number }): RushSim {
  const players = seats.length;
  const s: RushSim = {
    tick: 0, t: 0, season: 0, phase: "play", phaseT: 0, players, bots: seats.map((x) => x.bot !== null), rng: streamOf(seed, "lake"),
    boats: [], fish: [], nets: [], loose: [], koi: null, koiSpawned: 0, nextId: 1,
    cap: Math.round(K * 1.3), market: null, history: [],
  };
  seedFish(s, lake.adults ?? Math.round(lake.fish * 0.8), lake.young ?? Math.round(lake.fish * 0.2));
  seats.forEach((_, seat) => {
    const d = dockPos(seat, players), x = d.x - Math.cos(d.inward) * 2, y = d.y - Math.sin(d.inward) * 2;
    s.boats.push({
      seat, x, y, h: d.inward + Math.PI, vx: 0, vy: 0, tx: x, ty: y, hold: [], castCd: 0, dashT: 0, dashCd: 0, stun: 0, shield: 0, unloadT: 0,
      docked: true, tripValue: 0, banked: 0, cards: [], combo: 0, lastCatch: -9, firstScoreAt: null,
      stats: { caught: 0, home: 0, trips: 0, bestTrip: 0, lost: 0, rams: 0, rammed: 0, scooped: 0, koi: 0, youngKilled: 0, youngSpared: 0 },
      mind: { spot: null, spotT: 0, calm: 6 + seat * 2 },
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
    return { k: "steer", x: Math.round(Math.max(-92, Math.min(92, x))), y: Math.round(Math.max(-64, Math.min(64, y))) };
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
    if (isLastSeason(s)) { s.phase = "end"; ev.push({ k: "end" }); return; }
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

function endSeason(s: RushSim, ev: GameEvent[]): void {
  s.phase = "rest"; s.phaseT = 0;
  let spoiled = 0;
  for (const b of s.boats) { spoiled += holdValue(b); b.stats.lost += holdValue(b); if (b.tripValue > 0) { b.stats.trips++; b.stats.bestTrip = Math.max(b.stats.bestTrip, b.tripValue); b.tripValue = 0; } b.hold = []; }
  s.nets = []; s.loose = []; s.koi = null;
  ev.push({ k: "gong", spoiled });
  // breed: Fish Ladder sums across everyone who has it; Reed Bed too
  const ladders = s.boats.reduce((n, b) => n + (has(b, "ladder") ? 1 : 0), 0);
  const reedOwners = s.boats.filter((b) => has(b, "reeds"));
  const [a, y] = counts(s);
  const r = breedLake(a, y, Q.LADDER_BONUS * ladders);
  const extra = reedOwners.length * Q.REEDS_YOUNG;
  const born = r.born + extra;
  s.history.push({ startA: a, startY: y, endA: a, endY: y, caught: 0, young: 0 });
  const hist = s.history[s.history.length - 1];
  for (const f of s.fish) f.adult = true;
  for (let i = 0; i < born; i++) {
    const owner = reedOwners.length && i < extra ? reedOwners[i % reedOwners.length] : null;
    if (owner) { const d = dockPos(owner.seat, s.players); s.fish.push(newFish(s, d.x + (s.rng() - 0.5) * 4, d.y + (s.rng() - 0.5) * 4, false)); }
    else s.fish.push(newFish(s, null, null, false));
  }
  if (ladders) for (const b of s.boats) if (has(b, "ladder")) { const gift = Math.floor(born / Q.LADDER_PER); b.banked += gift; b.stats.home += gift; }
  const [a2, y2] = counts(s);
  hist.endA = a2; hist.endY = y2;
  ev.push({ k: "rest", grew: y, born });
}
// after winter's rest, the match ends: no market, straight to the ceremony
function isLastSeason(s: RushSim): boolean { return s.season >= Q.SEASONS - 1; }
function startMarket(s: RushSim, ev: GameEvent[]): void {
  s.phase = "market"; s.phaseT = 0;
  const offer = offerFor(s);
  const botPicks: (CardId | null)[] = s.boats.map((b, i) => (s.bots[i] ? botPick(s, offerFor(s), botKindOf(i)) : null));
  s.market = { offer, botPicks, picked: s.boats.map((_, i) => (s.bots[i] ? botPicks[i] : undefined)), closesAt: s.t + Q.MARKET_S, closed: false };
  ev.push({ k: "market", offer, players: s.players });
}
// bots are drawn steady/keeper/greedy by seat; scripts/balance.ts imports this
// directly rather than guessing a seat's kind from the outside
export function botKindOf(i: number): string { return ["steady", "keeper", "greedy"][i % 3]; }
function startSeason(s: RushSim, ev: GameEvent[]): void {
  s.season = (s.season + 1) as Season; s.phase = "play"; s.phaseT = 0; s.market = null;
  for (const b of s.boats) { const d = dockPos(b.seat, s.players); b.x = d.x; b.y = d.y; b.h = d.inward + Math.PI; b.docked = true; b.combo = 0; }
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
    if (!f.adult) b.stats.youngKilled++;
    ev.push({ k: "catch", seat: b.seat, n: 1, fry: f.adult ? 0 : 1, koi: false, full: 0, x: b.x, y: b.y });
    break;
  }
}

// a grid cell key that never collides: lake coordinates are bounded (+/- 92,
// +/- 64), so an offset well past that bound keeps every (gx, gy) pair
// unique (rush 1.0's `gx*1000+gy` relied on coordinates always being
// positive; this lake's are not, so that scheme silently collided two
// distant cells into one bucket and made every fish check every other).
const GRID_OFFSET = 1000;
function moveFish(s: RushSim): void {
  const dt = Q.DT, cs = Q.SIGHT, grid = new Map<number, number[]>();
  const cellKey = (gx: number, gy: number): number => (gx + GRID_OFFSET) * 100000 + (gy + GRID_OFFSET);
  s.fish.forEach((f, i) => { const k = cellKey((f.x / cs) | 0, (f.y / cs) | 0); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i); });
  const N = s.fish.length, room = Math.max(0, 1 - N / s.cap), born: Fish[] = [];
  const pull = seasonPull(s.season);
  for (let i = 0; i < N; i++) {
    const f = s.fish[i];
    let cx = 0, cy = 0, ax = 0, ay = 0, n = 0, sepx = 0, sepy = 0, mate = -1;
    const gx = (f.x / cs) | 0, gy = (f.y / cs) | 0;
    for (let a = gx - 1; a <= gx + 1; a++) for (let c = gy - 1; c <= gy + 1; c++) {
      const cell = grid.get(cellKey(a, c)); if (!cell) continue;
      for (const j of cell) {
        if (j === i) continue;
        const o = s.fish[j], dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
        if (d2 > cs * cs || o.adult !== f.adult) continue;
        cx += o.x; cy += o.y; ax += Math.cos(o.h); ay += Math.sin(o.h); n++;
        if (d2 < Q.SEP * Q.SEP) { sepx -= dx; sepy -= dy; }
        if (mate < 0 && f.adult && o.adult && d2 < Q.MATE * Q.MATE && o.cool <= 0) mate = j;
      }
    }
    let tx = Math.cos(f.h), ty = Math.sin(f.h);
    if (n) { tx += 0.12 * (cx / n - f.x) + 0.35 * (ax / n) + 0.5 * sepx; ty += 0.12 * (cy / n - f.y) + 0.35 * (ay / n) + 0.5 * sepy; }
    if (pull && f.adult) { tx += (pull.x - f.x) * 0.004; ty += (pull.y - f.y) * 0.004; }
    if (!f.adult) {
      if (nr(f.x, f.y) < Q.SHALLOW) { tx += (f.x / 92) * 0.6; ty += (f.y / 64) * 0.6; }
      if (s.t - f.born >= Q.MATURE_S) f.adult = true;
    }
    if (Math.hypot(f.x - ZONES.reeds.x, f.y - ZONES.reeds.y) < ZONES.reeds.r * 1.3 && Math.hypot(f.x - ZONES.reeds.x, f.y - ZONES.reeds.y) > ZONES.reeds.r * 0.6) {
      const dxr = ZONES.reeds.x - f.x, dyr = ZONES.reeds.y - f.y, dr = Math.hypot(dxr, dyr) || 1; tx += (dxr / dr) * 0.5; ty += (dyr / dr) * 0.5;
    }
    if (nr(f.x, f.y) > 0.92) { tx += -f.x * 0.01; ty += -f.y * 0.01; }
    if (f.scare > 0) { tx += f.sx * 3; ty += f.sy * 3; f.scare -= dt; }
    const h = Math.atan2(ty, tx) + (s.rng() - 0.5) * 0.5;
    f.h = h;
    const v = (f.adult ? Q.V_ADULT : Q.V_FRY) * (f.scare > 0 ? 2.2 : 1) * (Math.hypot(f.x - ZONES.reeds.x, f.y - ZONES.reeds.y) < ZONES.reeds.r ? 0.6 : 1);
    let nx = f.x + Math.cos(h) * v * dt, ny = f.y + Math.sin(h) * v * dt;
    if (blockedAt(nx, ny, s.season)) { nx = f.x; ny = f.y; }
    f.x = nx; f.y = ny;
    if (f.cool > 0) f.cool -= dt;
    if (mate >= 0 && f.cool <= 0 && s.rng() < Q.BREED_CHANCE * dt * room) {
      const o = s.fish[mate];
      f.cool = o.cool = Q.COOL;
      for (let k = 0; k < 2; k++) born.push(newFish(s, (f.x + o.x) / 2 + (s.rng() - 0.5) * 1, (f.y + o.y) / 2 + (s.rng() - 0.5) * 1, false));
    }
  }
  for (const b of born) s.fish.push(b);
}
// spring: river mouth + reeds; summer: lotus + deep water; autumn: open water; winter: deep water
function seasonPull(season: Season): { x: number; y: number } | null {
  if (season === 0) return ZONES.river;
  if (season === 1) return ZONES.lotus;
  if (season === 3) return { x: 10, y: -15 }; // the island's deep water
  return null;
}

function closeNets(s: RushSim, ev: GameEvent[]): void {
  const still: Net[] = [];
  const val = s.season === 2 ? Q.BIG_MULT : 1; // autumn: every fish counts double
  for (const net of s.nets) {
    if (net.closeAt > s.t + 1e-9) { still.push(net); continue; }
    const b = s.boats[net.seat];
    let room = Math.min(holdMax(b) - b.hold.length, Q.NET_MAX), n = 0, fry = 0, full = 0, koi = false, youngKilled = 0, youngSpared = 0;
    if (s.koi && room > 0 && Math.hypot(s.koi.x - net.x, s.koi.y - net.y) < net.r + 1) { b.hold.push(koiValue(b)); room--; koi = true; b.stats.koi++; s.koi = null; }
    s.fish = s.fish.filter((f) => {
      const dx = f.x - net.x, dy = f.y - net.y, d = Math.hypot(dx, dy);
      if (d > net.r) { if (d < net.r * Q.SCATTER_R && d > 0) { f.scare = 0.8; f.sx = dx / d; f.sy = dy / d; } return true; }
      if (!f.adult) {
        if (takesYoung(b)) { if (room > 0) { room--; n++; youngKilled++; b.hold.push(val * (has(b, "fineMesh") ? 1 : 1)); return false; } full++; return true; }
        youngSpared++; f.scare = 0.6; f.sx = dx / (d || 1); f.sy = dy / (d || 1); return true;
      }
      if (room <= 0) { full++; return true; }
      room--; n++; b.hold.push(val * (f.big ? Q.BIG_MULT : 1)); return false;
    });
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

function floatLoose(s: RushSim, ev: GameEvent[]): void {
  const keep: Loose[] = [];
  for (const l of s.loose) {
    l.vx *= 0.92; l.vy *= 0.92; l.x += l.vx * Q.DT; l.y += l.vy * Q.DT;
    if (s.t - l.t > Q.LOOSE_S) { if (l.value === 1) s.fish.push(newFish(s, l.x, l.y, true)); continue; }
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
// Three kinds by seat (steady, keeper, greedy), matching the market's weighting.
function bot(s: RushSim, seat: number, r: () => number): RushInput[] {
  const kind = botKindOf(seat);
  if (s.phase === "market") {
    const m = s.market; if (!m || m.picked[seat] !== undefined) return [];
    const offer = m.perSeatOffer?.[seat] ?? m.offer;
    return r() < 0.4 ? [] : [{ k: "pick", id: botPick(s, offer, kind) }];
  }
  if (s.phase !== "play" || r() > 0.2) return [];
  const b = s.boats[seat], m = b.mind;
  const out: RushInput[] = [];
  const d = dockPos(seat, s.players), left = Q.SEASON_S - s.phaseT, n = b.hold.length, max = holdMax(b);
  const homeAt = kind === "greedy" ? 0.95 : kind === "keeper" ? 0.6 : 0.75;
  const goHome = n >= max * homeAt || (left < (kind === "greedy" ? 2.5 : 4.5) && n > 0);
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
  if (!m.spot || s.t > m.spotT || Math.hypot(m.spot[0] - b.x, m.spot[1] - b.y) < 2.5) {
    let best: { x: number; y: number; c: number } | null = null;
    const adults = s.fish.filter((f) => f.adult || takesYoung(b));
    for (let k = 0; k < 8 && adults.length; k++) {
      const f = adults[Math.floor(r() * adults.length)];
      let c = 0; for (const o of adults) if ((o.x - f.x) ** 2 + (o.y - f.y) ** 2 < 4 * 4) c++;
      if (!best || c > best.c) best = { x: f.x, y: f.y, c };
    }
    m.spot = best ? [best.x, best.y] : [0, 0];
    m.spotT = s.t + 3;
  }
  out.push({ k: "steer", x: Math.round(m.spot[0]), y: Math.round(m.spot[1]) });
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

// ---- the counterfactual: the year replayed with every catch x 0.8 ----
function counterfactualNext(s: RushSim): number {
  let a = s.history[0]?.startA ?? 0, y = s.history[0]?.startY ?? 0;
  for (const h of s.history) {
    const tookA = (h.caught - h.young) * 0.8, tookY = h.young * 0.8;
    const natural = Math.max(0, h.startA - h.endA - (h.caught - h.young));
    a = Math.max(0, a - tookA - natural);
    y = Math.max(0, y - tookY);
    const r = breedLake(Math.round(a), Math.round(y));
    a = r.adults; y = r.born;
  }
  return Math.round(a + y * 0.6);
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
  const [a, y] = counts(s);
  const next = forecast(a, y); // the final rest already bred; results reports that as next spring directly
  const alt = counterfactualNext(s);
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
