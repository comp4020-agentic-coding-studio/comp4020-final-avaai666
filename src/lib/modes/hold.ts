// Lake Holdings, "holdings 3.0" (DESIGN.md "Lake Holdings 湖上大富翁 (3.0)"; Ava, 24 Oct: "make it like
// Monopoly"). A board of 24 squares round the lake, just in from the shore: each player's home (at their
// own dock), the Lake Spirit's squares between the homes, and fishing grounds in groups between those.
// Turn by turn: roll one die, sail that many squares, and the square acts:
// - a ground nobody owns: buy it, or not;
// - your own ground: haul it (take its fish, a coin each), or build a net (haul more) or a pond (it
//   breeds, and visitors pay more), or leave it;
// - someone else's ground: pay its toll to its owner (double if they hold the whole group);
// - the Lake Spirit: a card; your own home (landing or passing): 3 coins.
// After every round each net hauls its ground for its owner, each pond pays its owner, then each ground
// breeds; a hauled-out ground stays empty unless a pond is on it. If the lake falls below 15% of K it has
// died and the match ends. After 8 rounds: coins, plus 2 for each ground and each building, plus 1 for
// each fish still on your grounds, times the tier of next spring.
//
// Pure and deterministic: the die from the match's "dice" stream, the Spirit's deck from "cards"; a bot's
// choices from the stream the platform gives it for that tick. Nothing is secret.
import { HOLD as Q, HOLD_MODEL } from "../game-constants.ts";
import { type GameEvent, type Highlight, type LakeMemory, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";
import { K, type Lake, makeLake, nextSpring, tierOf } from "../lake-world.ts";

export type SqType = "home" | "spirit" | "ground";
export type Build = "net" | "pond";
export type Card = (typeof Q.CARDS)[number];
export type HoldInput = { k: "roll" } | { k: "buy" } | { k: "pass" } | { k: "haul" } | { k: "build"; kind: Build; sq?: number };
export interface Square { ix: number; type: SqType; a: number; x: number; y: number; home: number; group: number; price: number; owner: number; build: Build | null; stock: number; cap: number }
interface Player { seat: number; pos: number; coins: number; kind: string; hauled: number; tolls: number; bestHaul: number }
export interface Landing { seat: number; sq: number; what: string; n: number; to?: number; card?: Card }
export interface HoldSim {
  lake: Lake;
  tick: number; t: number; phase: "roll" | "move" | "act" | "show" | "end"; phaseT: number; round: number; turn: number;
  n: number; dice: () => number; cards: () => number; bots: boolean[];
  squares: Square[]; groups: number; players: Player[]; deck: Card[];
  roll: number | null; path: number[]; moveS: number; act: ("buy" | "haul" | "net" | "pond" | "pass")[]; last: Landing | null;
  start: number; log: { round: number; before: number; after: number }[]; ended: "rounds" | "dead" | null;
  builtThisTurn: boolean;
}
export const BOT_KINDS = ["steady", "keeper", "greedy"];

export const lakeFish = (s: HoldSim): number => s.squares.reduce((n, q) => n + (q.type === "ground" ? q.stock : 0), 0);
const groundsOf = (s: HoldSim, seat: number): Square[] => s.squares.filter((q) => q.type === "ground" && q.owner === seat);
const holdsGroup = (s: HoldSim, seat: number, g: number): boolean => s.squares.filter((q) => q.type === "ground" && q.group === g).every((q) => q.owner === seat);
export const tollOf = (s: HoldSim, q: Square): number => Q.TOLL[q.build ?? "none"] * (q.owner >= 0 && holdsGroup(s, q.owner, q.group) ? 2 : 1);
export const haulOf = (q: Square): number => Math.min(q.stock, Q.HAUL[q.build ?? "none"]);
export const nextOf = (s: HoldSim): number => (s.ended === "dead" ? Math.min(K, lakeFish(s)) : nextSpring(lakeFish(s)));

// ---- the board: homes at the players' docks, the Spirit between them, grounds in groups of at most 3 ----
export function boardFor(lake: Lake, n: number): Omit<Square, "stock" | "cap">[] {
  const N = Q.SQUARES, homes: number[] = [];
  for (let i = 0; i < n; i++) {
    let ix = (((Math.round((lake.dockPos(i).a - 90) / (360 / N)) % N) + N) % N);
    while (homes.includes(ix)) ix = (ix + 1) % N;
    homes.push(ix);
  }
  const sorted = [...homes].sort((a, b) => a - b), spirits: number[] = [];
  sorted.forEach((h, i) => { const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + N, gap = next - h; if (gap >= 3) spirits.push((h + Math.floor(gap / 2)) % N); });
  const out: Omit<Square, "stock" | "cap">[] = [];
  let group = -1, run = 0;
  for (let ix = 0; ix < N; ix++) {
    const a = 90 + (ix * 360) / N, [x, y] = lake.shape(a, Q.RING_K);
    const home = homes.indexOf(ix), type: SqType = home >= 0 ? "home" : spirits.includes(ix) ? "spirit" : "ground";
    if (type !== "ground") { run = 0; out.push({ ix, type, a, x, y, home, group: -1, price: 0, owner: -1, build: null }); continue; }
    if (run === 0 || run >= 3) { group++; run = 0; }
    run++;
    out.push({ ix, type, a, x, y, home: -1, group, price: 0, owner: -1, build: null });
  }
  const groups = group + 1;
  for (const q of out) if (q.type === "ground") q.price = Q.PRICE_BASE + Math.floor((q.group * 6) / groups);
  return out;
}

function make(seed: string, seats: Seat[], lake: LakeMemory): HoldSim {
  const n = seats.length, L = makeLake(lake.boats);
  const board = boardFor(L, n);
  const grounds = board.filter((q) => q.type === "ground");
  const s: HoldSim = {
    lake: L, tick: 0, t: 0, phase: "roll", phaseT: 0, round: 1, turn: 0,
    n, dice: streamOf(seed, "dice"), cards: streamOf(seed, "cards"), bots: seats.map((x) => x.bot !== null),
    squares: board.map((q) => ({ ...q, stock: 0, cap: q.type === "ground" ? Q.CAP : 0 })), groups: Math.max(...grounds.map((q) => q.group)) + 1,
    players: seats.map((st, i) => ({ seat: st.seat, pos: board.findIndex((q) => q.home === i), coins: Q.START_COINS, kind: BOT_KINDS[i % 3], hauled: 0, tolls: 0, bestHaul: 0 })),
    deck: [], roll: null, path: [], moveS: 0, act: [], last: null, start: 0, log: [], ended: null, builtThisTurn: false,
  };
  // the room's fish, spread evenly over the grounds (the first ones get the remainder)
  const total = Math.min(grounds.length * Q.CAP, lake.adults !== undefined && lake.young !== undefined ? lake.adults + lake.young : lake.fish);
  const gs = s.squares.filter((q) => q.type === "ground");
  gs.forEach((q, i) => { q.stock = Math.floor(total / gs.length) + (i < total % gs.length ? 1 : 0); });
  s.start = lakeFish(s);
  return s;
}

function shuffleDeck(s: HoldSim): void {
  const d = [...Q.CARDS];
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(s.cards() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  s.deck = d;
}

function input(s: HoldSim, seat: number, raw: unknown): HoldInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || seat !== s.turn || s.phase === "end") return null;
  if (o.k === "roll") return s.phase === "roll" ? { k: "roll" } : null;
  // before you roll you may build on any ground of yours that has nothing yet (one a turn), as in Monopoly
  if (s.phase === "roll") {
    if (o.k !== "build" || (o.kind !== "net" && o.kind !== "pond") || !Number.isInteger(o.sq)) return null;
    const q = s.squares[o.sq as number], p = s.players[seat];
    return q && q.type === "ground" && q.owner === seat && !q.build && p.coins >= Q.BUILD_COST && !s.builtThisTurn ? { k: "build", kind: o.kind, sq: q.ix } : null;
  }
  if (s.phase !== "act") return null;
  if (o.k === "buy" && s.act.includes("buy")) return { k: "buy" };
  if (o.k === "haul" && s.act.includes("haul")) return { k: "haul" };
  if (o.k === "build" && (o.kind === "net" || o.kind === "pond") && s.act.includes(o.kind)) return { k: "build", kind: o.kind };
  if (o.k === "pass") return { k: "pass" };
  return null;
}

// what the player whose turn it is may do on the square they landed on (nothing to choose: [])
function choices(s: HoldSim): HoldSim["act"] {
  const p = s.players[s.turn], q = s.squares[p.pos];
  if (q.type !== "ground") return [];
  if (q.owner < 0) return p.coins >= q.price ? ["buy", "pass"] : [];
  if (q.owner !== p.seat) return [];
  const out: HoldSim["act"] = [];
  if (q.stock > 0) out.push("haul");
  if (!q.build && p.coins >= Q.BUILD_COST) out.push("net", "pond");
  return out.length ? [...out, "pass"] : [];
}

function setPhase(s: HoldSim, phase: HoldSim["phase"]): void { s.phase = phase; s.phaseT = 0; }

// sail `steps` squares: your own home pays as you pass it or land on it
function sail(s: HoldSim, steps: number, ev: GameEvent[]): void {
  const p = s.players[s.turn], N = Q.SQUARES;
  s.path = [];
  for (let k = 1; k <= steps; k++) {
    p.pos = (p.pos + 1) % N; s.path.push(p.pos);
    if (s.squares[p.pos].home === p.seat) { p.coins += Q.HOME_PAY; ev.push({ k: "home", seat: p.seat, n: Q.HOME_PAY, sq: p.pos }); }
  }
  s.moveS = Math.max(Q.MOVE_MIN_S, steps * Q.STEP_S);
  setPhase(s, "move");
}

// the square the player whose turn it is has landed on acts
function land(s: HoldSim, ev: GameEvent[]): void {
  const p = s.players[s.turn], q = s.squares[p.pos];
  s.last = { seat: p.seat, sq: q.ix, what: q.type, n: 0 };
  if (q.type === "ground" && q.owner >= 0 && q.owner !== p.seat) {
    const toll = Math.min(p.coins, tollOf(s, q)), owner = s.players[q.owner];
    p.coins -= toll; owner.coins += toll; owner.tolls += toll;
    s.last = { seat: p.seat, sq: q.ix, what: "toll", n: toll, to: owner.seat };
    ev.push({ k: "toll", seat: p.seat, owner: owner.seat, n: toll, sq: q.ix }); // (not "to": an event's "to" lists who may see it)
  } else if (q.type === "spirit") {
    if (!s.deck.length) shuffleDeck(s);
    const card = s.deck.shift()!;
    s.last = { seat: p.seat, sq: q.ix, what: "card", n: 0, card };
    ev.push({ k: "card", seat: p.seat, card, sq: q.ix });
    if (spirit(s, card, ev)) return; // the tailwind sails on
  }
  s.act = choices(s);
  setPhase(s, s.act.length ? "act" : "show");
}

// the Lake Spirit's cards; true if the card moved the boat on (it lands again after that sail)
function spirit(s: HoldSim, card: Card, ev: GameEvent[]): boolean {
  const p = s.players[s.turn], grounds = s.squares.filter((q) => q.type === "ground");
  if (card === "bloom") for (const q of grounds) if (q.stock > 0) q.stock = Math.min(q.cap, q.stock + 2);
  if (card === "market") p.coins += 4;
  if (card === "lucky") p.coins += 3;
  if (card === "inspector") { const fine = Math.min(p.coins, 2 * groundsOf(s, p.seat).filter((q) => q.build === "net").length); p.coins -= fine; if (s.last) s.last.n = fine; }
  if (card === "festival") for (const o of s.players) if (o !== p && o.coins > 0) { o.coins--; p.coins++; }
  if (card === "thieves") { const q = groundsOf(s, p.seat).sort((a, b) => b.stock - a.stock || a.ix - b.ix)[0]; if (q) { const lost = Math.min(4, q.stock); q.stock -= lost; if (s.last) s.last.n = lost; } }
  if (card === "fry") for (const q of groundsOf(s, p.seat)) q.stock = Math.min(q.cap, q.stock + 3);
  if (card === "tailwind") { sail(s, 3, ev); return true; }
  return false;
}

function apply(s: HoldSim, seat: number, i: HoldInput, ev: GameEvent[]): void {
  if (seat !== s.turn) return;
  const p = s.players[seat];
  if (i.k === "build" && s.phase === "roll" && i.sq !== undefined) {
    const q = s.squares[i.sq];
    if (q.owner === seat && !q.build && p.coins >= Q.BUILD_COST && !s.builtThisTurn) { p.coins -= Q.BUILD_COST; q.build = i.kind; s.builtThisTurn = true; ev.push({ k: "build", seat, sq: q.ix, kind: i.kind }); }
    return;
  }
  if (i.k === "roll" && s.phase === "roll") {
    s.roll = 1 + Math.floor(s.dice() * 6);
    ev.push({ k: "roll", seat, n: s.roll });
    sail(s, s.roll, ev);
    return;
  }
  if (s.phase !== "act") return;
  const q = s.squares[p.pos];
  if (i.k === "buy" && s.act.includes("buy")) { p.coins -= q.price; q.owner = seat; ev.push({ k: "buy", seat, sq: q.ix, n: q.price }); s.last = { seat, sq: q.ix, what: "buy", n: q.price }; }
  if (i.k === "haul" && s.act.includes("haul")) {
    const n = haulOf(q); q.stock -= n; p.coins += n; p.hauled += n; p.bestHaul = Math.max(p.bestHaul, n);
    ev.push({ k: "haul", seat, sq: q.ix, n }); s.last = { seat, sq: q.ix, what: "haul", n };
  }
  if (i.k === "build" && s.act.includes(i.kind)) { p.coins -= Q.BUILD_COST; q.build = i.kind; ev.push({ k: "build", seat, sq: q.ix, kind: i.kind }); s.last = { seat, sq: q.ix, what: i.kind, n: Q.BUILD_COST }; }
  s.act = []; setPhase(s, "show");
}

// after every player's turn of a round: nets haul, ponds pay, the grounds breed, a pond adds its fish, and the lake may have died
function endRound(s: HoldSim, ev: GameEvent[]): void {
  const before = lakeFish(s);
  // every net hauls its ground for its owner (a coin a fish): the income that empties the lake
  const nets: [number, number, number][] = [];
  for (const q of s.squares) if (q.type === "ground" && q.build === "net" && q.owner >= 0 && q.stock > 0) {
    const n = Math.min(q.stock, Q.NET_ROUND), p = s.players[q.owner]; q.stock -= n; p.coins += n; p.hauled += n; nets.push([q.ix, q.owner, n]);
  }
  if (nets.length) ev.push({ k: "nets", list: nets });
  // every pond pays its owner (visitors come to see the fish), and takes none
  const ponds: [number, number, number][] = [];
  for (const q of s.squares) if (q.type === "ground" && q.build === "pond" && q.owner >= 0) { s.players[q.owner].coins += Q.POND_PAY; ponds.push([q.ix, q.owner, Q.POND_PAY]); }
  if (ponds.length) ev.push({ k: "ponds", list: ponds });
  for (const q of s.squares) {
    if (q.type !== "ground") continue;
    if (q.stock > 0) q.stock = Math.min(q.cap, q.stock + Math.round(Q.BREED * q.stock * (1 - q.stock / q.cap)));
    if (q.build === "pond") q.stock = Math.min(q.cap, q.stock + Q.POND_BREED);
  }
  const after = lakeFish(s);
  s.log.push({ round: s.round, before, after });
  ev.push({ k: "breed", round: s.round, before, after });
  if (after < Q.DEAD * K) { s.ended = "dead"; ev.push({ k: "dead", round: s.round, lake: after }); setPhase(s, "end"); ev.push({ k: "end" }); return; }
  if (s.round >= Q.ROUNDS) { s.ended = "rounds"; setPhase(s, "end"); ev.push({ k: "end" }); return; }
  s.round++;
  ev.push({ k: "round", round: s.round });
}

function nextTurn(s: HoldSim, ev: GameEvent[]): void {
  s.turn = (s.turn + 1) % s.n; s.roll = null; s.path = []; s.act = []; s.builtThisTurn = false;
  if (s.turn === 0) { endRound(s, ev); if (s.phase === "end") return; }
  setPhase(s, "roll");
  ev.push({ k: "turn", seat: s.turn });
}

function step(s: HoldSim, inputs: { seat: number; i: HoldInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === "end") return ev;
  for (const { seat, i } of inputs) apply(s, seat, i, ev);
  s.tick++;
  s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  s.phaseT = Math.round((s.phaseT + Q.DT) * 1000) / 1000;
  // the clock: a roll nobody makes is made for them; a choice nobody makes is a pass
  if (s.phase === "roll" && s.phaseT >= Q.ROLL_S - 1e-9) apply(s, s.turn, { k: "roll" }, ev);
  else if (s.phase === "move" && s.phaseT >= s.moveS - 1e-9) land(s, ev);
  else if (s.phase === "act" && s.phaseT >= Q.ACT_S - 1e-9) apply(s, s.turn, { k: "pass" }, ev);
  else if (s.phase === "show" && s.phaseT >= Q.SHOW_S - 1e-9) nextTurn(s, ev);
  return ev;
}

// ---- bots: roll after a moment; buy while they can afford it and keep a little; on their own ground a
// greedy bot builds a net and hauls, a keeper builds a pond and hauls only a full ground ----
function bot(s: HoldSim, seat: number, r: () => number): HoldInput[] {
  if (seat !== s.turn) return [];
  const p = s.players[seat];
  if (s.phase === "roll") {
    if (s.phaseT < 0.7 + (seat % 3) * 0.2 || r() > 0.5) return [];
    const mine = s.squares.filter((q) => q.type === "ground" && q.owner === seat && !q.build).sort((a, b) => b.stock - a.stock || a.ix - b.ix);
    const kind: Build | null = p.kind === "greedy" ? "net" : p.kind === "keeper" ? "pond" : (s.round % 2 ? "net" : "pond");
    const keep = p.kind === "greedy" ? 0 : 1;
    if (!s.builtThisTurn && mine.length && kind && p.coins >= Q.BUILD_COST + keep) return [{ k: "build", kind, sq: mine[0].ix }, { k: "roll" }];
    return [{ k: "roll" }];
  }
  if (s.phase !== "act" || s.phaseT < 0.6 || r() > 0.5) return [];
  const q = s.squares[p.pos], greedy = p.kind === "greedy", keeper = p.kind === "keeper";
  if (s.act.includes("buy")) return [p.coins - q.price >= (greedy ? 0 : 1) ? { k: "buy" } : { k: "pass" }];
  if (greedy) return [s.act.includes("net") && p.coins >= Q.BUILD_COST + 2 ? { k: "build", kind: "net" } : s.act.includes("haul") ? { k: "haul" } : { k: "pass" }];
  if (keeper) return [s.act.includes("pond") ? { k: "build", kind: "pond" } : s.act.includes("haul") && q.stock >= q.cap * 0.6 ? { k: "haul" } : { k: "pass" }];
  return [s.act.includes("net") && p.coins >= Q.BUILD_COST + 4 ? { k: "build", kind: "net" } : s.act.includes("haul") && q.stock >= q.cap * 0.4 ? { k: "haul" } : { k: "pass" }];
}

// ---- frames: everything is public ----
function frameFor(s: HoldSim, _seat: number) {
  const next = nextOf(s);
  const left = s.phase === "roll" ? Q.ROLL_S - s.phaseT : s.phase === "act" ? Q.ACT_S - s.phaseT : 0;
  return {
    lk: s.lake.meta(), // which lake this match has, for the page to draw (rule change 11)
    phase: s.phase, round: s.round, rounds: Q.ROUNDS, turn: s.turn, left: Math.max(0, Math.ceil(left)),
    roll: s.roll, path: s.path, moveS: s.moveS, pt: s.phaseT, act: s.phase === "act" ? s.act : [], built: s.builtThisTurn,
    cost: Q.BUILD_COST, haulN: haulOf(s.squares[s.players[s.turn].pos]), // what the pads say a build costs and a haul takes
    // squares: [ix, type, x*10, y*10, home, group, price, owner, build, stock, cap, toll]
    sq: s.squares.map((q) => [q.ix, q.type, Math.round(q.x * 10), Math.round(q.y * 10), q.home, q.group, q.price, q.owner, q.build ?? "", q.stock, q.cap, q.type === "ground" ? tollOf(s, q) : 0]),
    p: s.players.map((x) => ({ seat: x.seat, pos: x.pos, coins: x.coins, grounds: groundsOf(s, x.seat).length, builds: groundsOf(s, x.seat).filter((q) => q.build).length })),
    last: s.last, lake: lakeFish(s), next, tier: tierOf(next).id, start: s.start, ended: s.ended,
  };
}

function results(s: HoldSim): Results {
  const next = nextOf(s), tier = s.ended === "dead" ? { id: "none" as const, mult: 0.5 } : tierOf(next);
  const rows = s.players.map((p) => { const g = groundsOf(s, p.seat), base = p.coins + g.length * Q.GROUND_PTS + g.filter((q) => q.build).length * Q.BUILD_PTS + Math.floor(g.reduce((n, q) => n + q.stock, 0) * Q.FISH_PTS); return { p, grounds: g.length, base, score: Math.round(base * tier.mult) }; });
  const order = rows.map((x) => x.score);
  const top = [...s.players].sort((a, b) => b.bestHaul - a.bestHaul || a.seat - b.seat)[0];
  const rich = [...s.players].sort((a, b) => b.tolls - a.tolls || a.seat - b.seat)[0];
  const highlights: Highlight[] = [
    { title: "Biggest haul", text: top.bestHaul ? `{name}: ${top.bestHaul} fish in one haul` : "nobody hauled", seat: top.seat, tkey: "h3_hl_haul_t", key: top.bestHaul ? "h3_hl_haul" : "h3_hl_haul_none", vars: { n: top.bestHaul } },
    { title: "Tolls", text: rich.tolls ? `{name}: ${rich.tolls} coins in tolls` : "nobody paid a toll", seat: rich.seat, tkey: "h3_hl_toll_t", key: rich.tolls ? "h3_hl_toll" : "h3_hl_toll_none", vars: { n: rich.tolls } },
    { title: "The lake", text: s.ended === "dead" ? `the lake died in round ${s.round}` : `${lakeFish(s)} fish left of ${s.start}`, tkey: "h3_hl_lake_t", key: s.ended === "dead" ? "h3_hl_lake_dead" : "h3_hl_lake", vars: { n: lakeFish(s), start: s.start, round: s.round } },
  ];
  return {
    seats: rows.map((x) => ({ seat: x.p.seat, score: x.score, place: 1 + order.filter((v) => v > x.score).length, firstScoreS: null, base: x.base, coins: x.p.coins, grounds: x.grounds })),
    lakeLeft: lakeFish(s), highlights,
    left: { a: lakeFish(s), y: 0 }, next, tier: tier.id, dead: s.ended === "dead",
    ledger: s.players.map((p) => ({ seat: p.seat, home: p.hauled, young: 0, spared: 0 })),
    log: s.log,
  };
}

export const hold: Mode<HoldSim, HoldInput> = {
  id: "hold", model: HOLD_MODEL, seats: Q.SEATS, breeds: false,
  make, input, step, frameFor, over: (s) => s.phase === "end", results, bot,
};
