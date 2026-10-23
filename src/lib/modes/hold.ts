// Lake Holdings, "holdings 2.0" (DESIGN.md "Lake Holdings 抢地盘经营 (2.0)").
// Turn-based, everyone choosing at the same time: four seasons of three
// moves on a hex board laid over the v5 lake, then each season's harvest,
// shown step by step. A move: you hold three cards (always the Flag, plus two
// drawn by weight), pick one and a legal tile within 20 s, or the bot's
// choice is played for you. Then everyone's placements are revealed one by
// one (two flags on one tile: fewer tiles wins). The harvest: ponds breed,
// lanterns pull, nets haul (and every other tile you hold gives 2), the
// cormorants steal, the lake breeds, fish swim away from the nets, empty
// water runs dry. Score = fish harvested + 1 per tile, x the tier of next
// spring, which is the board after one more pond-and-breed step (dry water
// stays dry). breeds: true — results().lakeLeft already is next spring.
//
// Pure and deterministic: the board, the hands and every draw come from the
// match's "lake" stream; a bot's decisions from the stream the platform gives
// it for that tick. Secret: a seat's hand and its pick, until the reveal.
import { HOLD as Q, HOLD_MODEL } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";
import { DEEP, dockPos, ISLAND, K, nr, tierOf, WORLD_SCALE, ZONES } from "../lake-world.ts";

export type Card = "claim" | "net" | "pond" | "fence" | "corm" | "lantern";
export const CARDS: Card[] = ["claim", "net", "pond", "fence", "corm", "lantern"];
const DRAWN: Exclude<Card, "claim">[] = ["net", "pond", "fence", "corm", "lantern"];
type Zone = "reeds" | "lotus" | "deep" | "open";
export type HoldInput = { k: "place"; card: Card; tile: number } | { k: "pass" };

export interface Tile { ix: number; q: number; r: number; x: number; y: number; zone: Zone; w: number; cap: number; fish: number; owner: number; build: Exclude<Card, "claim"> | null; dry: boolean; paid: number }
interface Player { seat: number; fish: number; hand: Card[]; pick: { card: Card; tile: number } | null | undefined; kind: string; stolen: number; best: number }
export interface HoldSim {
  tick: number; t: number; phase: "pick" | "reveal" | "harvest" | "end"; phaseT: number; season: number; action: number;
  n: number; rng: () => number; bots: boolean[];
  tiles: Tile[]; byKey: Map<string, number>; players: Player[]; start: number;
  reveal: { seat: number; card: Card; tile: number; lost?: boolean }[]; harvestStep: number; log: { season: number; before: number; after: number }[];
}

const SQ3 = Math.sqrt(3);
const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const hexAt = (q: number, r: number): [number, number] => [Q.HS * SQ3 * (q + r / 2), Q.HS * 1.5 * r + 4 * WORLD_SCALE];
export function nbrs(s: HoldSim, tl: Tile): Tile[] { return DIRS.map(([dq, dr]) => s.byKey.get(`${tl.q + dq},${tl.r + dr}`)).filter((i): i is number => i !== undefined).map((i) => s.tiles[i]); }
const hexDist = (a: Tile, b: Tile): number => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
const within2 = (s: HoldSim, tl: Tile): Tile[] => s.tiles.filter((o) => o !== tl && hexDist(o, tl) <= 2);
export const lakeFish = (s: HoldSim): number => s.tiles.reduce((n, tl) => n + tl.fish, 0);
const tilesOf = (s: HoldSim, seat: number): number => s.tiles.filter((tl) => tl.owner === seat).length;
const inZone = (z: { x: number; y: number; r: number }, x: number, y: number): boolean => Math.hypot(x - z.x, y - z.y) < z.r;
export const BOT_KINDS = ["steady", "keeper", "greedy"];

function make(seed: string, seats: Seat[], lake: { fish: number; adults?: number; young?: number }): HoldSim {
  const n = seats.length;
  const s: HoldSim = {
    tick: 0, t: 0, phase: "pick", phaseT: 0, season: 1, action: 1, n, rng: streamOf(seed, "lake"), bots: seats.map((x) => x.bot !== null),
    tiles: [], byKey: new Map(), players: [], start: 0, reveal: [], harvestStep: 0, log: [],
  };
  // the board: every hex whose centre is within 0.8 of the way to the shore, none on the island
  for (let q = -5; q <= 5; q++) for (let r = -4; r <= 4; r++) {
    const [x, y] = hexAt(q, r);
    if (nr(x, y) > Q.IN_LAKE || Math.hypot(x - ISLAND.x, y - ISLAND.y) < ISLAND.r + 2) continue;
    const zone: Zone = inZone(ZONES.reeds, x, y) ? "reeds" : inZone(ZONES.lotus, x, y) ? "lotus" : Math.hypot(x - ISLAND.x, y - ISLAND.y) < DEEP.r ? "deep" : "open";
    s.byKey.set(`${q},${r}`, s.tiles.length);
    s.tiles.push({ ix: s.tiles.length, q, r, x, y, zone, w: zone === "deep" ? 1.35 : zone === "reeds" ? 1.15 : 1, cap: 0, fish: 0, owner: -1, build: null, dry: false, paid: 0 });
  }
  // the lake's fish, spread over the water by where fish like to be
  const total = lake.adults !== undefined && lake.young !== undefined ? lake.adults + lake.young : lake.fish;
  const wsum = s.tiles.reduce((n2, tl) => n2 + tl.w, 0);
  for (const tl of s.tiles) { tl.cap = Math.max(4, Math.round((K * tl.w) / wsum)); tl.fish = Math.min(tl.cap, Math.round((total * tl.w) / wsum)); }
  s.start = lakeFish(s);
  s.players = seats.map((st, i) => ({ seat: st.seat, fish: 0, hand: [], pick: undefined, kind: BOT_KINDS[i % 3], stolen: 0, best: 0 }));
  // two tiles to start, the closest to each player's dock
  for (const p of s.players) {
    const d = dockPos(p.seat, n);
    const near = s.tiles.filter((tl) => tl.owner < 0).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
    const a = near[0]; a.owner = p.seat;
    const b = nbrs(s, a).filter((x) => x.owner < 0).sort((u, v) => Math.hypot(u.x - d.x, u.y - d.y) - Math.hypot(v.x - d.x, v.y - d.y))[0] ?? near[1];
    b.owner = p.seat;
  }
  deal(s);
  return s;
}

// the Flag, plus two drawn by weight (different if the draw allows)
function drawOne(s: HoldSim): Exclude<Card, "claim"> {
  const total = DRAWN.reduce((n, c) => n + Q.WEIGHTS[c], 0);
  let r = s.rng() * total;
  for (const c of DRAWN) { r -= Q.WEIGHTS[c]; if (r <= 0) return c; }
  return "net";
}
function deal(s: HoldSim): void {
  for (const p of s.players) {
    const a = drawOne(s); let b = drawOne(s);
    for (let k = 0; k < 6 && b === a; k++) b = drawOne(s);
    p.hand = ["claim", a, b]; p.pick = undefined;
  }
}

export function legal(s: HoldSim, seat: number, card: Card): Tile[] {
  if (card === "claim") return s.tiles.filter((tl) => tl.owner < 0 && nbrs(s, tl).some((x) => x.owner === seat));
  return s.tiles.filter((tl) => tl.owner === seat && !tl.build);
}
export const isProtected = (s: HoldSim, tl: Tile): boolean => tl.build === "fence" || (tl.owner >= 0 && nbrs(s, tl).some((x) => x.build === "fence" && x.owner === tl.owner));
export function cormTarget(s: HoldSim, tl: Tile, seat: number): Tile | null {
  return within2(s, tl).filter((o) => o.build === "net" && o.owner >= 0 && o.owner !== seat && !isProtected(s, o)).sort((a, b) => b.fish - a.fish || a.ix - b.ix)[0] ?? null;
}

function input(s: HoldSim, seat: number, raw: unknown): HoldInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || s.phase !== "pick") return null;
  const p = s.players[seat]; if (!p || p.pick !== undefined) return null;
  if (o.k === "pass") return legalAny(s, seat) ? null : { k: "pass" };
  if (o.k !== "place" || !CARDS.includes(o.card as Card) || !Number.isInteger(o.tile)) return null;
  const card = o.card as Card, tile = o.tile as number;
  if (!p.hand.includes(card) || !legal(s, seat, card).some((tl) => tl.ix === tile)) return null;
  return { k: "place", card, tile };
}
const legalAny = (s: HoldSim, seat: number): boolean => s.players[seat].hand.some((c) => legal(s, seat, c).length > 0);

function step(s: HoldSim, inputs: { seat: number; i: HoldInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === "end") return ev;
  if (s.phase === "pick") {
    for (const { seat, i } of inputs) {
      const p = s.players[seat]; if (!p || p.pick !== undefined) continue;
      p.pick = i.k === "place" ? { card: i.card, tile: i.tile } : null;
      ev.push({ k: "picked", seat });
    }
  }
  s.tick++;
  s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  s.phaseT = Math.round((s.phaseT + Q.DT) * 1000) / 1000;
  if (s.phase === "pick") {
    // time up: the bot's choice is played for anyone who has not chosen
    if (s.phaseT >= Q.PICK_S - 1e-9) for (const p of s.players) if (p.pick === undefined) { const c = choose(s, p, s.rng); p.pick = c ? { card: c.card, tile: c.tile.ix } : null; ev.push({ k: "picked", seat: p.seat, auto: true }); }
    if (s.players.every((p) => p.pick !== undefined)) startReveal(s, ev);
  } else if (s.phase === "reveal") {
    if (s.phaseT >= Q.REVEAL_GAP * s.reveal.length + Q.REVEAL_END - 1e-9) {
      if (s.action < Q.ACTIONS) { s.action++; s.phase = "pick"; s.phaseT = 0; deal(s); ev.push({ k: "move", season: s.season, action: s.action }); }
      else { s.phase = "harvest"; s.phaseT = 0; s.harvestStep = 0; s.log.push({ season: s.season, before: lakeFish(s), after: 0 }); }
    }
  } else if (s.phase === "harvest") {
    const due = Math.floor(s.phaseT / Q.HARVEST_STEP_S);
    while (s.harvestStep < Math.min(due, HARVEST.length)) { HARVEST[s.harvestStep](s, ev); s.harvestStep++; }
    if (s.harvestStep >= HARVEST.length && s.phaseT >= Q.HARVEST_STEP_S * (HARVEST.length + 1) - 1e-9) {
      s.log[s.log.length - 1].after = lakeFish(s);
      if (s.season >= Q.SEASONS) { s.phase = "end"; ev.push({ k: "end" }); }
      else { s.season++; s.action = 1; s.phase = "pick"; s.phaseT = 0; deal(s); ev.push({ k: "season", season: s.season }); }
    }
  }
  return ev;
}

function startReveal(s: HoldSim, ev: GameEvent[]): void {
  // two flags on one tile: the player with fewer tiles gets it (a tie: the lake's stream decides)
  const flags = new Map<number, Player[]>();
  for (const p of s.players) if (p.pick && p.pick.card === "claim") { const l = flags.get(p.pick.tile) ?? []; l.push(p); flags.set(p.pick.tile, l); }
  const lost = new Set<number>();
  for (const list of flags.values()) if (list.length > 1) {
    const order = list.map((p) => [p, tilesOf(s, p.seat), s.rng()] as const).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    for (const [p] of order.slice(1)) lost.add(p.seat);
  }
  s.reveal = [];
  for (const p of s.players) {
    if (!p.pick) continue;
    const tl = s.tiles[p.pick.tile];
    const gone = lost.has(p.seat);
    if (!gone) { if (p.pick.card === "claim") tl.owner = p.seat; else tl.build = p.pick.card; }
    s.reveal.push({ seat: p.seat, card: p.pick.card, tile: p.pick.tile, ...(gone ? { lost: true } : {}) });
  }
  s.phase = "reveal"; s.phaseT = 0;
  ev.push({ k: "reveal", list: s.reveal });
}

// ---- the harvest, one step at a time ----
const HARVEST: ((s: HoldSim, ev: GameEvent[]) => void)[] = [
  // 1. ponds breed: +2 here, +1 on every tile around (anyone's), and dry neighbours come back
  (s, ev) => {
    for (const tl of s.tiles) if (tl.build === "pond") {
      tl.fish = Math.min(tl.cap, tl.fish + Q.POND_SELF); tl.dry = false;
      for (const x of nbrs(s, tl)) { x.fish = Math.min(x.cap, x.fish + Q.POND_NEAR); x.dry = false; }
    }
    ev.push({ k: "harvest", step: "pond" });
  },
  // 2. lanterns pull 1 from each unprotected tile around
  (s, ev) => {
    for (const tl of s.tiles) if (tl.build === "lantern") for (const x of nbrs(s, tl)) if (x.fish > 0 && !isProtected(s, x) && tl.fish < tl.cap) { x.fish--; tl.fish++; }
    ev.push({ k: "harvest", step: "lantern" });
  },
  // 3. nets haul up to 7; every other tile you hold that is not dry gives 2
  (s, ev) => {
    const paid: Record<number, number> = {};
    for (const tl of s.tiles) {
      tl.paid = 0;
      if (tl.owner < 0 || (tl.build !== "net" && (tl.build || tl.dry))) continue;
      const k = Math.min(tl.build === "net" ? Q.NET_TAKE : Q.BASE, tl.fish);
      tl.fish -= k; tl.paid = k; s.players[tl.owner].fish += k; paid[tl.owner] = (paid[tl.owner] ?? 0) + k;
    }
    for (const p of s.players) p.best = Math.max(p.best, paid[p.seat] ?? 0);
    ev.push({ k: "harvest", step: "net", paid: s.tiles.filter((tl) => tl.paid > 0).map((tl) => [tl.ix, tl.paid]) });
  },
  // 4. cormorants steal 2 from the richest unprotected neighbour net within 2 tiles
  (s, ev) => {
    const thefts: [number, number, number][] = [];
    for (const tl of s.tiles) if (tl.build === "corm" && tl.owner >= 0) {
      const v = cormTarget(s, tl, tl.owner);
      if (v && v.paid > 0) { const k = Math.min(Q.CORM, v.paid); s.players[v.owner].fish -= k; s.players[v.owner].stolen += k; s.players[tl.owner].fish += k; thefts.push([tl.ix, v.ix, k]); }
    }
    ev.push({ k: "harvest", step: "corm", thefts });
  },
  // 5. the lake breeds on each tile that is not dry
  (s, ev) => {
    for (const tl of s.tiles) {
      if (tl.dry) continue;
      const g = tl.zone === "reeds" ? Q.GROW_REEDS : Q.GROW;
      const born = tl.fish < 2 ? 0 : Math.round(tl.fish * g * (1 - tl.fish / tl.cap));
      if (born > 0) tl.fish = Math.min(tl.cap, tl.fish + born);
    }
    ev.push({ k: "harvest", step: "grow" });
  },
  // 6. fish swim one tile away from each unprotected net; 7. empty water runs dry
  (s, ev) => {
    for (const tl of s.tiles) if (tl.build === "net" && tl.fish > 0 && !isProtected(s, tl)) {
      const free = nbrs(s, tl).filter((x) => x.build !== "net" && !x.dry && x.fish < x.cap);
      if (free.length) { const x = free[Math.floor(s.rng() * free.length)]; tl.fish--; x.fish++; }
    }
    const dried: number[] = [];
    for (const tl of s.tiles) if (!tl.dry && tl.fish <= 0) { tl.dry = true; tl.fish = 0; dried.push(tl.ix); }
    ev.push({ k: "harvest", step: "swim", dried });
  },
];

// next spring on this board: ponds and breeding for one more season; dry water stays dry
export function holdForecast(s: HoldSim): number {
  let sum = 0;
  for (const tl of s.tiles) {
    if (tl.dry && !nbrs(s, tl).some((x) => x.build === "pond")) continue;
    let f = tl.fish + (tl.build === "pond" ? Q.POND_SELF : 0) + nbrs(s, tl).filter((x) => x.build === "pond").length * Q.POND_NEAR;
    f = Math.min(tl.cap, f);
    const g = tl.zone === "reeds" ? Q.GROW_REEDS : Q.GROW;
    f += f < 2 ? 0 : Math.round(f * g * (1 - f / tl.cap));
    sum += Math.min(tl.cap, f);
  }
  return Math.min(K, sum);
}

// ---- bots: value every card on every legal tile (the prototype's botChoose) ----
function choose(s: HoldSim, p: Player, r: () => number): { card: Card; tile: Tile } | null {
  let best: { card: Card; tile: Tile; v: number } | null = null;
  const greedy = p.kind === "greedy", keeper = p.kind === "keeper";
  for (const card of p.hand) for (const tl of legal(s, p.seat, card)) {
    const ns = nbrs(s, tl);
    let v = 0;
    if (card === "claim") v = tl.fish * 0.5 + ns.filter((x) => x.owner < 0).length * 0.6 + (tl.zone === "deep" ? 1.5 : 0) + 1.5;
    if (card === "net") v = Math.min(Q.NET_TAKE, tl.fish) * (greedy ? 1.9 : keeper ? 0.9 : 1.4) * (Q.SEASONS - s.season + 1) * 0.55 + (ns.some((x) => x.build === "pond") ? 1.5 : 0);
    if (card === "pond") v = (2 + ns.filter((x) => x.owner === p.seat).length * 1.6 + (s.season <= 2 ? 1.5 : 0)) * (keeper ? 1.7 : greedy ? 0.7 : 1.1) + ns.filter((x) => x.dry).length * 1.5;
    if (card === "fence") v = ns.filter((x) => x.owner === p.seat && x.build).length * 1.4 + (tl.build ? 0 : 0.5) + (keeper ? 1 : 0);
    if (card === "lantern") v = ns.filter((x) => x.owner >= 0 && x.owner !== p.seat && x.fish > 0 && !isProtected(s, x)).length * (greedy ? 1.6 : 1) + ns.filter((x) => x.owner < 0 && x.fish > 0).length * 0.5;
    if (card === "corm") v = cormTarget(s, tl, p.seat) ? (greedy ? 5 : 3.2) : 0.2;
    v += r() * 1.2;
    if (!best || v > best.v) best = { card, tile: tl, v };
  }
  return best;
}
function bot(s: HoldSim, seat: number, r: () => number): HoldInput[] {
  const p = s.players[seat];
  if (s.phase !== "pick" || !p || p.pick !== undefined) return [];
  if (s.phaseT < 1.5 + (seat % 4) * 0.7 || r() > 0.3) return []; // a moment's thought
  const c = choose(s, p, r);
  return [c ? { k: "place", card: c.card, tile: c.tile.ix } : { k: "pass" }];
}

// ---- frames: the board is everyone's; a hand and a pick are their owner's ----
function frameFor(s: HoldSim, seat: number) {
  const me = seat >= 0 ? s.players[seat] : undefined;
  const next = holdForecast(s);
  return {
    phase: s.phase, season: s.season, seasons: Q.SEASONS, action: s.action, actions: Q.ACTIONS,
    left: s.phase === "pick" ? Math.max(0, Math.ceil(Q.PICK_S - s.phaseT)) : 0,
    // tiles: [ix, q, r, x*10, y*10, zone, cap, fish, owner, build, dry, paid]
    t: s.tiles.map((tl) => [tl.ix, tl.q, tl.r, Math.round(tl.x * 10), Math.round(tl.y * 10), tl.zone, tl.cap, tl.fish, tl.owner, tl.build ?? "", tl.dry ? 1 : 0, tl.paid]),
    p: s.players.map((x) => ({ seat: x.seat, fish: x.fish, tiles: tilesOf(s, x.seat), picked: x.pick !== undefined })),
    lake: lakeFish(s), next, tier: tierOf(next).id, start: s.start,
    reveal: s.phase === "reveal" ? s.reveal : null,
    harvestStep: s.phase === "harvest" ? s.harvestStep : null,
    me: me ? { hand: me.hand, pick: me.pick ?? null } : null,
  };
}

function results(s: HoldSim): Results {
  const next = holdForecast(s), tier = tierOf(next);
  const rows = s.players.map((p) => { const tiles = tilesOf(s, p.seat), base = p.fish + tiles * Q.TILE_PTS; return { p, tiles, base, score: Math.round(base * tier.mult) }; });
  const order = rows.map((x) => x.score);
  const top = [...s.players].sort((a, b) => b.best - a.best)[0];
  const robbed = [...s.players].sort((a, b) => b.stolen - a.stolen)[0];
  const dry = s.tiles.filter((tl) => tl.dry).length;
  const highlights: Highlight[] = [
    { title: "Best harvest", text: top.best ? `{name}: ${top.best} fish in one harvest` : "no net caught anything", seat: top.seat, tkey: "h2_hl_best_t", key: top.best ? "h2_hl_best" : "h2_hl_best_none", vars: { n: top.best } },
    { title: "Cormorants", text: robbed.stolen ? `{name}: lost ${robbed.stolen} to cormorants` : "no cormorant struck", seat: robbed.seat, tkey: "h2_hl_corm_t", key: robbed.stolen ? "h2_hl_corm" : "h2_hl_corm_none", vars: { n: robbed.stolen } },
    { title: "Dry water", text: `${dry} tiles ran dry`, tkey: "h2_hl_dry_t", key: "h2_hl_dry", vars: { n: dry } },
  ];
  return {
    seats: rows.map((x) => ({ seat: x.p.seat, score: x.score, place: 1 + order.filter((v) => v > x.score).length, firstScoreS: null, base: x.base, fish: x.p.fish, tiles: x.tiles })),
    lakeLeft: next, highlights,
    left: { a: lakeFish(s), y: 0 }, next, tier: tier.id,
    ledger: s.players.map((p) => ({ seat: p.seat, home: p.fish, young: 0, spared: 0 })),
    log: s.log, dry,
  };
}

export const hold: Mode<HoldSim, HoldInput> = {
  id: "hold", model: HOLD_MODEL, seats: Q.SEATS, breeds: true,
  make, input, step, frameFor, over: (s) => s.phase === "end", results, bot,
};
// for a test or script: what the bot would play for this seat now
export const chooseFor = (s: HoldSim, seat: number, r: () => number) => choose(s, s.players[seat], r);
