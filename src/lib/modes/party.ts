// Fishing Party, "party 2.0" (DESIGN.md "Fishing Party 钓鱼派对 (2.0)"):
// five rounds of 28 s on the v5 lake, always in the same order (Shoal
// Scramble, Koi Chase, Tug of Line, Lantern Night, the Last Net). Every
// round goes intro card (where you may try it first: the round runs, but
// nothing scores or leaves the lake) -> 3-2-1 -> play -> standings, and
// after rounds 1-3 a 9 s shop (Big Net, Fast Boat, Bait: 3 coins, one round).
// Rounds 1, 2 and 4 take fish from the lake; the Last Net's school is what is
// left, divided by 7, and everyone picks 3, 6 or 10 in secret: if the total
// fits, double each pick; if not, the net tears and everyone gets 1.
// Score = coins x the tier of next spring.
//
// Pure and deterministic: the lake and every round's randomness draw from
// the match's "lake" stream; a bot's decisions from the stream the platform
// gives it for that tick. Secrets: Lantern Night sends a seat only the fish
// its own lantern, or a dropped one, lights; Last Net's picks stay hidden
// until everyone has picked.
import { PARTY as Q, PARTY_MODEL } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";
import { dockPos, ISLAND, LAKE_X, LAKE_Y, nextSpring, nr, shape, tierOf, WORLD_SCALE as S, ZONES } from "../lake-world.ts";
import { sail } from "./boat-move.ts";
import { counts, type Fish, moveFish, type School, seedFish, updateSchools } from "./lake-life.ts";

export type Game = "scramble" | "koi" | "tug" | "night" | "last";
export const GAMES: Game[] = ["scramble", "koi", "tug", "night", "last"];
export type Item = "net" | "fast" | "bait";
const ITEMS: Item[] = ["net", "fast", "bait"];
type Phase = "intro" | "count" | "play" | "standings" | "shop" | "pick" | "reveal" | "end";
export type PartyInput =
  | { k: "ready" }
  | { k: "tap"; x: number; y: number }
  | { k: "steer"; x: number; y: number }
  | { k: "reel" } | { k: "net" } | { k: "lantern" }
  | { k: "buy"; item: Item } | { k: "done" }
  | { k: "pick"; n: 3 | 6 | 10 };

interface Boat { seat: number; x: number; y: number; h: number; speed: number; tx: number; ty: number; gate: number; reel: number; stun: number; castCd: number; lanT: number; finished: boolean }
interface Spot { id: number; x: number; y: number; t: number; open: boolean; until: number; taken: number }
export interface PartySim {
  tick: number; t: number; phase: Phase; phaseT: number; round: number; game: Game;
  n: number; rng: () => number; bots: boolean[]; kinds: string[];
  coins: number[]; roundCoins: number[]; ready: boolean[]; done: boolean[];
  buys: Item[][]; next: Item[][]; // bought in a shop / in use this round
  boats: Boat[]; fish: Fish[]; schools: Schools; nextId: number; season: number;
  start: number; tookFish: number[];
  spots: Spot[]; spotT: number;
  path: [number, number][]; koi: { k: number; x: number; y: number };
  tug: { needle: number; dir: number; zone: number; zw: number; zv: number; places: number };
  lanterns: { seat: number; x: number; y: number; until: number }[];
  last: { cap: number; fished: boolean; picks: (number | null)[]; fit: boolean | null; revealAt: number } | null;
  best: { seat: number; coins: number; game: Game } | null;
}
type Schools = School[];
export const BOT_KINDS = ["steady", "keeper", "greedy"];
const scoring = (s: PartySim): boolean => s.phase === "play";
const practice = (s: PartySim): boolean => s.phase === "intro"; // "try it first": the round runs, nothing counts

function make(seed: string, seats: Seat[], lake: { fish: number; adults?: number; young?: number }): PartySim {
  const n = seats.length;
  const s: PartySim = {
    tick: 0, t: 0, phase: "intro", phaseT: 0, round: 1, game: "scramble",
    n, rng: streamOf(seed, "lake"), bots: seats.map((x) => x.bot !== null), kinds: seats.map((_, i) => BOT_KINDS[i % 3]),
    coins: seats.map(() => 0), roundCoins: seats.map(() => 0), ready: seats.map(() => false), done: seats.map(() => false),
    buys: seats.map(() => []), next: seats.map(() => []),
    boats: [], fish: [], schools: [], nextId: 1, season: 1, start: 0, tookFish: seats.map(() => 0),
    spots: [], spotT: 0.8, path: [], koi: { k: 1, x: 0, y: 0 },
    tug: { needle: 0, dir: 1, zone: 0.45, zw: 0.2, zv: 0.18, places: 0 }, lanterns: [], last: null, best: null,
  };
  const a0 = lake.adults ?? Math.round(lake.fish * 0.8), y0 = lake.young ?? Math.round(lake.fish * 0.2);
  seedFish(s, a0, y0);
  s.start = s.fish.length;
  for (const st of seats) { const d = dockPos(st.seat, n); s.boats.push({ seat: st.seat, x: d.x, y: d.y, h: d.inward + Math.PI, speed: 0, tx: d.x, ty: d.y, gate: 0, reel: 0, stun: 0, castCd: 0, lanT: 0, finished: false }); }
  setupRound(s);
  return s;
}

// a round's own setup: boats back at their docks, the round's props
function setupRound(s: PartySim): void {
  s.game = GAMES[s.round - 1];
  for (const b of s.boats) { const d = dockPos(b.seat, s.n); b.x = b.tx = d.x - Math.cos(d.inward) * 2; b.y = b.ty = d.y - Math.sin(d.inward) * 2; b.h = d.inward + Math.PI; b.speed = 0; b.gate = 0; b.reel = 0; b.stun = 0; b.castCd = 0; b.lanT = 0; b.finished = false; }
  s.spots = []; s.spotT = 0.8; s.lanterns = []; s.tug = { needle: 0, dir: 1, zone: 0.45, zw: 0.2, zv: 0.18, places: 0 };
  if (s.game === "koi") {
    s.path = Array.from({ length: Q.GATES }, (_, k) => shape(70 + k * 45, k % 2 ? 0.62 : 0.78)) as [number, number][];
    s.koi = { k: 1, x: s.path[0][0], y: s.path[0][1] };
  }
  s.roundCoins = s.roundCoins.map(() => 0); s.ready = s.ready.map(() => false); s.done = s.done.map(() => false);
}
// what the round takes from the lake: the nearest adults to (x, y) if given
function takeFish(s: PartySim, n: number, x?: number, y?: number): number {
  let k = 0;
  for (let i = 0; i < n && s.fish.length; i++) {
    let j = -1, bd = Infinity;
    s.fish.forEach((f, ii) => { const d = x === undefined || y === undefined ? 0 : Math.hypot(f.x - x, f.y - y); if (f.adult && d < bd) { bd = d; j = ii; } });
    if (j < 0) j = 0;
    s.fish.splice(j, 1); k++;
  }
  return k;
}
function give(s: PartySim, seat: number, n: number, ev: GameEvent[], x?: number, y?: number): void {
  s.coins[seat] += n; s.roundCoins[seat] += n;
  if (!s.best || s.roundCoins[seat] > s.best.coins) s.best = { seat, coins: s.roundCoins[seat], game: s.game };
  ev.push({ k: "coins", seat, n, ...(x !== undefined ? { x: r1(x), y: r1(y!) } : {}) });
}
const r1 = (v: number): number => Math.round(v * 10) / 10;
const has = (s: PartySim, seat: number, item: Item): boolean => s.next[seat].includes(item);

// ---- inputs ----
function input(s: PartySim, seat: number, raw: unknown): PartyInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || seat < 0 || seat >= s.n) return null;
  const live = s.phase === "intro" || s.phase === "play";
  const num = (v: unknown, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) ? Math.round(Math.max(lo, Math.min(hi, x)) * 10) / 10 : null; };
  switch (o.k) {
    case "ready": return s.phase === "intro" && !s.ready[seat] ? { k: "ready" } : null;
    case "tap": { const x = num(o.x, -LAKE_X, LAKE_X), y = num(o.y, -LAKE_Y, LAKE_Y); return live && s.game === "scramble" && x !== null && y !== null ? { k: "tap", x, y } : null; }
    case "steer": { const x = num(o.x, -LAKE_X, LAKE_X), y = num(o.y, -LAKE_Y, LAKE_Y); return live && (s.game === "koi" || s.game === "night") && x !== null && y !== null ? { k: "steer", x, y } : null; }
    case "reel": return live && s.game === "tug" ? { k: "reel" } : null;
    case "net": case "lantern": return live && s.game === "night" ? { k: o.k } : null;
    case "buy": return s.phase === "shop" && ITEMS.includes(o.item as Item) && !s.buys[seat].includes(o.item as Item) && s.coins[seat] >= Q.COST ? { k: "buy", item: o.item as Item } : null;
    case "done": return s.phase === "shop" && !s.done[seat] ? { k: "done" } : null;
    case "pick": return s.phase === "pick" && s.last && s.last.picks[seat] === null && (o.n === 3 || o.n === 6 || o.n === 10) ? { k: "pick", n: o.n } : null;
  }
  return null;
}

function apply(s: PartySim, seat: number, i: PartyInput, ev: GameEvent[]): void {
  const b = s.boats[seat];
  if (i.k === "ready") { s.ready[seat] = true; ev.push({ k: "ready", seat }); return; }
  if (i.k === "buy") { s.buys[seat].push(i.item); s.coins[seat] -= Q.COST; ev.push({ k: "bought", seat, item: i.item, to: [seat] }); return; }
  if (i.k === "done") { s.done[seat] = true; return; }
  if (i.k === "pick") { s.last!.picks[seat] = i.n; ev.push({ k: "picked", seat }); return; }
  if (i.k === "steer") { b.tx = i.x; b.ty = i.y; return; }
  if (i.k === "tap") {
    const r = has(s, seat, "net") ? Q.TAP_R_BIG : Q.TAP_R;
    const spot = s.spots.filter((p) => p.open && p.taken < 0).sort((p, q) => Math.hypot(p.x - i.x, p.y - i.y) - Math.hypot(q.x - i.x, q.y - i.y))[0];
    if (spot && Math.hypot(spot.x - i.x, spot.y - i.y) < r) claimSpot(s, spot, seat, ev);
    else ev.push({ k: "miss", seat, x: i.x, y: i.y, to: [seat] });
    return;
  }
  if (i.k === "reel") {
    if (b.stun > 0 || b.reel >= 100) return;
    const T = s.tug, inZ = Math.abs(T.needle - T.zone) < T.zw / 2 + (has(s, seat, "net") ? 0.04 : 0);
    b.reel = Math.max(0, b.reel + (inZ ? Q.REEL_UP : -Q.REEL_DOWN)); if (!inZ) b.stun = Q.REEL_STUN;
    ev.push({ k: "reel", seat, ok: inZ ? 1 : 0, to: [seat] });
    if (b.reel >= 100) {
      if (scoring(s)) { const pay = Q.TUG_PAY[Math.min(T.places, Q.TUG_PAY.length - 1)]; T.places++; b.finished = true; give(s, seat, pay, ev); ev.push({ k: "landed", seat, place: T.places, pay }); }
      else b.reel = 0; // practice: land it again
    }
    return;
  }
  if (i.k === "net") {
    if (b.castCd > 0) return;
    b.castCd = Q.NIGHT_CD;
    const nx = b.x + Math.cos(b.h) * 4, ny = b.y + Math.sin(b.h) * 4, r = has(s, seat, "net") ? Q.NIGHT_NET_BIG : Q.NIGHT_NET_R;
    let got = 0;
    if (scoring(s)) s.fish = s.fish.filter((f) => { if (got < Q.NIGHT_MAX && f.adult && Math.hypot(f.x - nx, f.y - ny) < r) { got++; return false; } return true; });
    else for (const f of s.fish) if (got < Q.NIGHT_MAX && f.adult && Math.hypot(f.x - nx, f.y - ny) < r) got++;
    if (scoring(s) && got) { s.tookFish[seat] += got; give(s, seat, got, ev, nx, ny); }
    ev.push({ k: "netted", seat, x: r1(nx), y: r1(ny), r, n: got, practice: practice(s) ? 1 : 0 });
    return;
  }
  if (i.k === "lantern") {
    if (b.lanT > 0) return;
    b.lanT = Q.LANTERN_CD;
    s.lanterns.push({ seat, x: r1(b.x), y: r1(b.y), until: s.t + Q.LANTERN_S });
    ev.push({ k: "lantern", seat, x: r1(b.x), y: r1(b.y) });
  }
}
function claimSpot(s: PartySim, spot: Spot, seat: number, ev: GameEvent[]): void {
  spot.taken = seat;
  if (scoring(s)) { const k = takeFish(s, Q.SCRAMBLE_FISH, spot.x, spot.y); s.tookFish[seat] += k; give(s, seat, Q.SCRAMBLE_COINS, ev, spot.x, spot.y); }
  ev.push({ k: "claimed", seat, id: spot.id, x: r1(spot.x), y: r1(spot.y), practice: practice(s) ? 1 : 0 });
}

// ---- the rounds, tick by tick ----
function moveBoats(s: PartySim): void {
  const dt = Q.DT;
  for (const b of s.boats) {
    b.castCd = Math.max(0, b.castCd - dt); b.lanT = Math.max(0, b.lanT - dt); b.stun = Math.max(0, b.stun - dt);
    if (s.game !== "koi" && s.game !== "night") continue;
    sail(b, Q.SPEED * (has(s, b.seat, "fast") ? Q.FAST : 1), dt);
  }
}
function roundTick(s: PartySim, ev: GameEvent[]): void {
  moveBoats(s);
  // bait: for its first 8 s, the schools near a bait boat swim to it
  if (scoring(s) && s.phaseT < Q.BAIT_S) for (const b of s.boats) if (has(s, b.seat, "bait")) for (const sc of s.schools) if (Math.hypot(sc.x - b.x, sc.y - b.y) < Q.BAIT_R) { sc.tx = b.x; sc.ty = b.y; sc.t = 1; }
  if (s.game === "night" || s.game === "koi") { updateSchools(s); moveFish(s); }
  if (s.game === "scramble") {
    s.spotT -= Q.DT;
    if (s.spotT <= 0) {
      s.spotT = 0.9 + s.rng() * 0.6;
      const x = (-60 + s.rng() * 100) * S, y = (-32 + s.rng() * 62) * S; // the prototype's box, at the lake's scale
      if (nr(x, y) < 0.85 && Math.hypot(x - ISLAND.x, y - ISLAND.y) > ISLAND.r + 4.5) { s.spots.push({ id: s.nextId++, x, y, t: 0, open: false, until: 0, taken: -1 }); }
    }
    for (const p of s.spots) { p.t += Q.DT; if (!p.open && p.t >= Q.WARN_S) { p.open = true; p.until = p.t + Q.JUMP_S; ev.push({ k: "jump", id: p.id, x: r1(p.x), y: r1(p.y) }); } }
    s.spots = s.spots.filter((p) => (!p.open || p.t < p.until) && !(p.taken >= 0 && p.t > p.until));
  }
  if (s.game === "koi") {
    const k = s.koi, tgt = s.path[k.k % s.path.length], a = Math.atan2(tgt[1] - k.y, tgt[0] - k.x);
    k.x += Math.cos(a) * Q.DT * Q.KOI_SPEED; k.y += Math.sin(a) * Q.DT * Q.KOI_SPEED;
    if (Math.hypot(tgt[0] - k.x, tgt[1] - k.y) < 2) k.k++;
    for (const b of s.boats) {
      const gt = s.path[b.gate % s.path.length];
      if (Math.hypot(gt[0] - b.x, gt[1] - b.y) < Q.GATE_R) {
        b.gate++;
        if (scoring(s)) { const got = takeFish(s, 1); s.tookFish[b.seat] += got; give(s, b.seat, Q.GATE_COINS, ev, gt[0], gt[1]); }
        ev.push({ k: "gate", seat: b.seat, n: b.gate, practice: practice(s) ? 1 : 0 });
      }
      if (scoring(s) && Math.hypot(k.x - b.x, k.y - b.y) < Q.KOI_R) {
        const got = takeFish(s, Q.KOI_FISH); s.tookFish[b.seat] += got; give(s, b.seat, Q.KOI_COINS, ev, k.x, k.y);
        ev.push({ k: "koi", seat: b.seat });
        k.k += 2; const p = s.path[(k.k - 1) % s.path.length]; k.x = p[0]; k.y = p[1];
      }
    }
  }
  if (s.game === "tug") {
    const T = s.tug;
    T.needle += T.dir * Q.DT * Q.NEEDLE_SPEED; if (T.needle > 1) { T.needle = 1; T.dir = -1; } if (T.needle < 0) { T.needle = 0; T.dir = 1; }
    T.zone += T.zv * Q.DT; if (T.zone > 0.8 - T.zw / 2 || T.zone < 0.2 + T.zw / 2) T.zv *= -1;
  }
  if (s.game === "night") s.lanterns = s.lanterns.filter((l) => l.until > s.t);
}

function step(s: PartySim, inputs: { seat: number; i: PartyInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === "end") return ev;
  for (const { seat, i } of inputs) apply(s, seat, i, ev);
  if (s.phase === "intro" || s.phase === "play") roundTick(s, ev);
  s.tick++;
  s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  s.phaseT = Math.round((s.phaseT + Q.DT) * 1000) / 1000;
  advance(s, ev);
  return ev;
}
function enter(s: PartySim, phase: Phase, ev: GameEvent[], extra: Record<string, unknown> = {}): void { s.phase = phase; s.phaseT = 0; ev.push({ k: "phase", phase, round: s.round, game: s.game, ...extra }); }
function advance(s: PartySim, ev: GameEvent[]): void {
  switch (s.phase) {
    case "intro":
      if (s.ready.every(Boolean) || s.phaseT >= Q.INTRO_S - 1e-9) { setupRound(s); enter(s, "count", ev); }
      break;
    case "count":
      if (s.phaseT >= Q.COUNT_S - 1e-9) { for (let i = 0; i < s.n; i++) s.next[i] = s.buys[i], s.buys[i] = []; enter(s, "play", ev); }
      break;
    case "play":
      if (s.phaseT >= Q.ROUND_S - 1e-9) { s.spots = []; s.lanterns = []; enter(s, "standings", ev, { lake: s.fish.length }); }
      break;
    case "standings":
      if (s.phaseT >= Q.STANDINGS_S - 1e-9) {
        s.next = s.next.map(() => []);
        if (s.round <= 3) { s.done = s.done.map((_, i) => s.coins[i] < Q.COST && !s.bots[i] ? true : false); enter(s, "shop", ev); }
        else nextRound(s, ev);
      }
      break;
    case "shop":
      if (s.done.every(Boolean) || s.phaseT >= Q.SHOP_S - 1e-9) nextRound(s, ev);
      break;
    case "pick": {
      const L = s.last!;
      if (s.phaseT >= Q.PICK_S - 1e-9) for (let i = 0; i < s.n; i++) if (L.picks[i] === null) L.picks[i] = 6; // a default for anyone who did not pick
      if (L.picks.every((p) => p !== null)) {
        const sum = L.picks.reduce((n: number, p) => n + (p ?? 0), 0);
        L.fit = sum <= L.cap;
        for (let i = 0; i < s.n; i++) give(s, i, L.fit ? (L.picks[i] ?? 0) * Q.LAST_MULT : 1, ev);
        const gone = takeFish(s, L.fit ? sum : L.cap);
        L.picks.forEach((p, i) => { if (L.fit) s.tookFish[i] += Math.round((gone * (p ?? 0)) / Math.max(1, sum)); });
        enter(s, "reveal", ev, { picks: L.picks, fit: L.fit, cap: L.cap, sum });
      }
      break;
    }
    case "reveal":
      if (s.phaseT >= Q.REVEAL_EACH * s.n + Q.REVEAL_END - 1e-9) { s.phase = "end"; ev.push({ k: "end" }); }
      break;
  }
}
function nextRound(s: PartySim, ev: GameEvent[]): void {
  s.round++;
  setupRound(s);
  if (s.game === "last") {
    const cap = Math.max(6, Math.round(s.fish.length / Q.LAST_DIV));
    s.last = { cap, fished: s.fish.length < s.start * 0.85, picks: s.boats.map(() => null), fit: null, revealAt: 0 };
    enter(s, "pick", ev, { cap, fished: s.last.fished });
  } else enter(s, "intro", ev);
}

// ---- what one seat may see ----
const p10 = (v: number): number => Math.round(v * 10);
export function seesFish(s: PartySim, seat: number, x: number, y: number): boolean {
  if (s.game !== "night" || seat < 0) return true;
  const b = s.boats[seat], r = (has(s, seat, "net") ? Q.NIGHT_VIEW_BIG : Q.NIGHT_VIEW);
  return Math.hypot(b.x - x, b.y - y) < r || s.lanterns.some((l) => Math.hypot(l.x - x, l.y - y) < Q.LANTERN_LIGHT);
}
function frameFor(s: PartySim, seat: number) {
  const game = s.game, live = s.phase === "intro" || s.phase === "count" || s.phase === "play";
  const len: Record<Phase, number> = { intro: Q.INTRO_S, count: Q.COUNT_S, play: Q.ROUND_S, standings: Q.STANDINGS_S, shop: Q.SHOP_S, pick: Q.PICK_S, reveal: 0, end: 0 };
  const f: Record<string, unknown> = {
    phase: s.phase, round: s.round, rounds: GAMES.length, game, left: Math.max(0, Math.ceil(len[s.phase] - s.phaseT)),
    coins: s.coins, roundCoins: s.roundCoins, ready: s.ready, done: s.done, lake: s.fish.length, start: s.start,
  };
  if (live && (game === "koi" || game === "night")) {
    const me = seat >= 0 ? s.boats[seat] : null;
    f.b = s.boats.filter((b) => game !== "night" || !me || b === me || Math.hypot(b.x - me.x, b.y - me.y) < Q.NIGHT_BOATS || s.lanterns.some((l) => Math.hypot(b.x - l.x, b.y - l.y) < Q.LANTERN_LIGHT)).map((b) => [b.seat, p10(b.x), p10(b.y), Math.round(b.h * 100), b.gate]);
    f.f = s.fish.filter((x) => seesFish(s, seat, x.x, x.y)).map((x) => [p10(x.x), p10(x.y), Math.round(x.h * 100), x.adult ? 1 : 0]);
  }
  if (live && game === "koi") { f.path = s.path.map(([x, y]) => [p10(x), p10(y)]); f.koi = [p10(s.koi.x), p10(s.koi.y)]; }
  if (live && game === "scramble") f.spots = s.spots.map((p) => [p.id, p10(p.x), p10(p.y), p.taken >= 0 ? 2 : p.open ? 1 : 0, p.taken]);
  if (live && game === "tug") f.tug = { needle: Math.round(s.tug.needle * 1000) / 1000, zone: Math.round(s.tug.zone * 1000) / 1000, zw: s.tug.zw, reels: s.boats.map((b) => Math.round(b.reel)) };
  if (live && game === "night") { f.lanterns = s.lanterns.map((l) => [l.seat, p10(l.x), p10(l.y)]); f.light = Q.LANTERN_LIGHT; if (seat >= 0) f.view = (has(s, seat, "net") ? Q.NIGHT_VIEW_BIG : Q.NIGHT_VIEW); }
  if (s.last) f.last = { cap: s.last.cap, fished: s.last.fished, picked: s.last.picks.map((p) => p !== null), picks: s.phase === "reveal" || s.phase === "end" ? s.last.picks : null, fit: s.last.fit, mine: seat >= 0 ? s.last.picks[seat] : null };
  if (seat >= 0) { const b = s.boats[seat]; f.me = { castCd: Math.round(b.castCd * 10) / 10, lanT: Math.round(b.lanT * 10) / 10, stun: b.stun > 0 ? 1 : 0, gate: b.gate, buys: s.buys[seat], next: s.next[seat] }; }
  return f;
}

// ---- results ----
function results(s: PartySim): Results {
  const left = s.fish.length, next = nextSpring(left), tier = tierOf(next);
  const scores = s.coins.map((c) => Math.round(c * tier.mult));
  const [a, y] = counts(s);
  const best = s.best;
  const greedy = s.tookFish.indexOf(Math.max(...s.tookFish));
  const highlights: Highlight[] = [
    { title: "Best round", text: best ? `{name}: ${best.coins} coins in ${best.game}` : "nobody scored", seat: best?.seat, tkey: "y2_hl_best_t", key: best ? "y2_hl_best" : "y2_hl_best_none", vars: { n: best?.coins ?? 0, game: best ? `@y2_g_${best.game}` : "" } },
    { title: "Took most from the lake", text: `{name}: ${s.tookFish[greedy]} fish`, seat: greedy, tkey: "y2_hl_took_t", key: "y2_hl_took", vars: { n: s.tookFish[greedy] } },
    { title: "The last net", text: s.last?.fit ? "held" : "tore", tkey: "y2_hl_last_t", key: s.last?.fit ? "y2_hl_last_fit" : "y2_hl_last_tear", vars: { cap: s.last?.cap ?? 0 } },
  ];
  return {
    seats: s.coins.map((c, i) => ({ seat: i, score: scores[i], place: 1 + scores.filter((v) => v > scores[i]).length, firstScoreS: null, base: c })),
    lakeLeft: left, highlights,
    left: { a, y }, next, tier: tier.id,
    ledger: s.coins.map((c, i) => ({ seat: i, home: c, young: 0, spared: 0, took: s.tookFish[i] })),
    last: s.last ? { cap: s.last.cap, picks: s.last.picks, fit: s.last.fit } : null,
  };
}

// ---- bots (the prototype's yThink, its scramble reactions, its shop and last-net picks) ----
function bot(s: PartySim, seat: number, r: () => number): PartyInput[] {
  const kind = s.kinds[seat], b = s.boats[seat];
  if (s.phase === "intro") return !s.ready[seat] && s.phaseT > 2.5 + (seat % 4) * 1.1 ? [{ k: "ready" }] : [];
  if (s.phase === "shop") {
    if (s.done[seat]) return [];
    if (s.phaseT < 1 + seat * 0.4) return [];
    const out: PartyInput[] = [];
    if (s.coins[seat] >= Q.COST && r() < (kind === "greedy" ? 0.7 : 0.35)) out.push({ k: "buy", item: ITEMS[Math.floor(r() * 3)] });
    out.push({ k: "done" });
    return out;
  }
  if (s.phase === "pick") {
    if (s.last!.picks[seat] !== null || s.phaseT < 1 + seat * 0.8) return [];
    const cap = s.last!.cap;
    const n = kind === "greedy" ? (r() < 0.75 ? 10 : 6) : kind === "keeper" ? (r() < 0.7 ? 3 : 6) : cap > 24 ? 6 : r() < 0.5 ? 3 : 6;
    return [{ k: "pick", n: n as 3 | 6 | 10 }];
  }
  if (s.phase !== "play") return [];
  if (s.game === "scramble") {
    // react to an open splash after a beat; greedy is quicker, keeper slower
    for (const p of s.spots) {
      if (!p.open || p.taken >= 0) continue;
      const since = p.t - 0.8, wait = 0.32 + (kind === "greedy" ? 0.2 : kind === "keeper" ? 0.6 : 0.45);
      if (since >= wait && r() < 0.1) return [{ k: "tap", x: r1(p.x + (r() - 0.5) * 2), y: r1(p.y + (r() - 0.5) * 2) }];
    }
    return [];
  }
  if (s.game === "tug") {
    if (b.reel >= 100 || b.stun > 0 || r() > Q.DT * (kind === "greedy" ? 5 : 3.5)) return [];
    const T = s.tug, inZ = Math.abs(T.needle - T.zone) < T.zw / 2;
    return inZ || r() < 0.12 ? [{ k: "reel" }] : [];
  }
  if (r() > 0.2) return [];
  if (s.game === "koi") {
    const gt = s.path[b.gate % s.path.length], k = s.koi;
    const chase = Math.hypot(k.x - b.x, k.y - b.y) < 18 * S && kind !== "keeper";
    return [{ k: "steer", x: r1(chase ? k.x : gt[0]), y: r1(chase ? k.y : gt[1]) }];
  }
  if (s.game === "night") {
    const out: PartyInput[] = [];
    let best: Fish | null = null, bd = Infinity;
    for (const f of s.fish) { if (!f.adult || !seesFish(s, seat, f.x, f.y)) continue; const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd) { bd = d; best = f; } }
    if (best) { out.push({ k: "steer", x: r1(best.x - Math.cos(b.h) * 3), y: r1(best.y - Math.sin(b.h) * 3) }); if (bd < 6 && b.castCd <= 0) out.push({ k: "net" }); }
    else { const a = r() * Math.PI * 2, d = 20 + r() * 25; out.push({ k: "steer", x: r1(Math.cos(a) * d), y: r1(Math.sin(a) * d * 0.6) }); }
    if (kind === "keeper" && b.lanT <= 0 && r() < 0.06) out.push({ k: "lantern" });
    return out;
  }
  return [];
}

export const party: Mode<PartySim, PartyInput> = {
  id: "party", model: PARTY_MODEL, seats: Q.SEATS, breeds: false,
  make, input, step, frameFor, over: (s) => s.phase === "end", results, bot,
};
