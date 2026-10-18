// Lake Holdings, "holdings 1.0" (DESIGN.md "Lake Holdings"). A hex lake (the
// v7 layout) with a seeded current; schools drift along it, one tile a tide.
// Every 15 s a tide pays out: nets take from schools on or next to them,
// ponds breed fish into the tiles beside them, a cormorant steals from an
// enemy net, lanterns pull schools in, and over-netted tiles thin the
// schools that pass. Three cards in hand, back to three after each tide.
// Score: tiles held plus fish harvested; a tie goes to more harvest.
//
// Pure and deterministic: the board, the current, the schools and the decks
// draw only from the match's "lake" stream. Nothing here is secret except a
// player's hand, which frameFor sends only to its owner.
import { HOLD as Q } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";

export type Card = "net" | "pond" | "fence" | "cormorant" | "lantern" | "claim";
type Building = Exclude<Card, "claim">;
const CARDS: Card[] = ["net", "pond", "fence", "cormorant", "lantern", "claim"];
export type HoldInput = { k: "play"; card: Card; tile: number; dir?: number };

interface Tile { id: number; q: number; r: number; x: number; y: number; owner: number; building: Building | null; by: number; dir: number; until: number; netted: number; paid: number; pays: number; dry: boolean }
export interface HoldSim {
  tick: number; t: number; n: number; rng: () => number; tides: number;
  tiles: Tile[]; at: Map<string, number>; schools: { id: number; tile: number; fish: number }[]; nextId: number;
  hands: Card[][]; decks: Card[][]; harvest: number[]; played: number[]; cormorants: number[]; stolen: number[]; bestTide: { seat: number; n: number } | null;
  firstScoreAt: (number | null)[]; dist: (a: number, b: number) => number;
}

const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const ell = (x: number, y: number): number => Math.hypot((x - Q.W / 2) / Q.RX, (y - Q.H / 2) / Q.RY);
export function neighbours(s: HoldSim, id: number): number[] {
  const t = s.tiles[id];
  return DIRS.map(([dq, dr]) => s.at.get(`${t.q + dq},${t.r + dr}`)).filter((x): x is number => x !== undefined);
}
const hexDist = (a: Tile, b: Tile): number => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;

function shuffled(rng: () => number): Card[] {
  const d = [...Q.DECK] as Card[];
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function draw(s: HoldSim, seat: number): void {
  while (s.hands[seat].length < Q.HAND) {
    if (!s.decks[seat].length) s.decks[seat] = shuffled(s.rng);
    s.hands[seat].push(s.decks[seat].pop()!);
  }
}

function make(seed: string, seats: Seat[], lake: { fish: number }): HoldSim {
  const rng = streamOf(seed, "lake"), n = seats.length;
  const tiles: Tile[] = [], at = new Map<string, number>();
  for (let q = -16; q <= 16; q++) for (let r = -12; r <= 12; r++) {
    const x = Q.W / 2 + Q.HEX * Math.sqrt(3) * (q + r / 2), y = Q.H / 2 + Q.HEX * 1.5 * r;
    if (ell(x, y) < Q.IN_LAKE) { at.set(`${q},${r}`, tiles.length); tiles.push({ id: tiles.length, q, r, x, y, owner: -1, building: null, by: -1, dir: 0, until: 0, netted: 0, paid: 0, pays: 0, dry: false }); }
  }
  // the current: a seeded swirl, each tile pointing to one neighbour
  const spin = rng() < 0.5 ? 1 : -1, wob = rng() * 6.28;
  for (const t of tiles) {
    const a = Math.atan2(t.y - Q.H / 2, (t.x - Q.W / 2) * 0.7) + spin * Math.PI / 2 + Math.sin(t.q * 0.5 + wob) * 0.6 + (rng() - 0.5) * 0.5;
    const hx = Math.cos(a), hy = Math.sin(a);
    let best = 0, bd = -9;
    DIRS.forEach(([dq, dr], i) => { const dx = Math.sqrt(3) * (dq + dr / 2), dy = 1.5 * dr, l = Math.hypot(dx, dy), d = (dx * hx + dy * hy) / l; if (d > bd) { bd = d; best = i; } });
    t.dir = best;
  }
  const s: HoldSim = {
    tick: 0, t: 0, n, rng, tides: 0, tiles, at, schools: [], nextId: 1,
    hands: seats.map(() => []), decks: seats.map(() => []), harvest: seats.map(() => 0), played: seats.map(() => 0), cormorants: seats.map(() => 0), stolen: seats.map(() => 0), bestTide: null,
    firstScoreAt: seats.map(() => null), dist: (a, b) => hexDist(tiles[a], tiles[b]),
  };
  // three shore tiles each, round the lake
  seats.forEach((_, seat) => {
    const a = (seat / n) * Math.PI * 2 + Math.PI / 2, px = Q.W / 2 + Math.cos(a) * Q.RX * 0.78, py = Q.H / 2 + Math.sin(a) * Q.RY * 0.78;
    const near = tiles.filter((t) => t.owner === -1).sort((p, q) => Math.hypot(p.x - px, p.y - py) - Math.hypot(q.x - px, q.y - py));
    const first = near[0]; first.owner = seat;
    const more = neighbours(s, first.id).filter((x) => tiles[x].owner === -1).sort((p, q) => Math.hypot(tiles[p].x - px, tiles[p].y - py) - Math.hypot(tiles[q].x - px, tiles[q].y - py)).slice(0, Q.START_TILES - 1);
    for (const m of more) tiles[m].owner = seat;
    s.decks[seat] = shuffled(rng); draw(s, seat);
  });
  // the room's lake in schools on open water
  const open = tiles.filter((t) => t.owner === -1 && ell(t.x, t.y) < 0.7);
  let left = lake.fish;
  for (let i = 0; i < Q.SCHOOLS && left > 0; i++) {
    const fish = i === Q.SCHOOLS - 1 ? left : Math.min(left, Math.round(lake.fish / Q.SCHOOLS));
    s.schools.push({ id: s.nextId++, tile: open[Math.floor(rng() * open.length)].id, fish }); left -= fish;
  }
  return s;
}

function input(s: HoldSim, _seat: number, raw: unknown): HoldInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || o.k !== "play" || !CARDS.includes(o.card as Card) || !Number.isInteger(o.tile) || (o.tile as number) < 0 || (o.tile as number) >= s.tiles.length) return null;
  const out: HoldInput = { k: "play", card: o.card as Card, tile: o.tile as number };
  if (o.card === "fence") out.dir = Number.isInteger(o.dir) && (o.dir as number) >= 0 && (o.dir as number) < 6 ? (o.dir as number) : 0;
  return out;
}

function play(s: HoldSim, seat: number, i: HoldInput, ev: GameEvent[]): void {
  const hand = s.hands[seat], t = s.tiles[i.tile];
  const k = hand.indexOf(i.card);
  if (k < 0) return;
  if (i.card === "claim") {
    if (t.owner === seat || !neighbours(s, t.id).some((n) => s.tiles[n].owner === seat)) return;
    if (t.owner >= 0) {
      if (hand.length < 2) return; // taking an enemy tile costs two cards
      hand.splice(k, 1); hand.splice(0, 1);
      ev.push({ k: "taken", seat, from: t.owner, tile: t.id });
      t.building = null; t.by = -1;
    } else { hand.splice(k, 1); ev.push({ k: "claimed", seat, tile: t.id }); }
    t.owner = seat; s.played[seat]++;
    return;
  }
  if (t.owner !== seat) return;
  hand.splice(k, 1); s.played[seat]++;
  t.building = i.card; t.by = seat; t.until = i.card === "lantern" ? s.tides + Q.LANTERN_TIDES : 0;
  if (i.card === "fence") t.dir = i.dir ?? 0;
  ev.push({ k: "built", seat, tile: t.id, building: i.card, dir: t.dir });
}

function tide(s: HoldSim, ev: GameEvent[]): void {
  s.tides++;
  for (const t of s.tiles) t.paid = 0;
  // 1. schools drift: towards a lantern within range, else along the current
  const lanterns = s.tiles.filter((t) => t.building === "lantern");
  for (const sc of s.schools) {
    const t = s.tiles[sc.tile];
    const lan = lanterns.filter((l) => hexDist(l, t) <= Q.LANTERN_RANGE && hexDist(l, t) > 0).sort((a, b) => hexDist(a, t) - hexDist(b, t))[0];
    let next: number | undefined;
    if (lan) next = neighbours(s, t.id).sort((a, b) => hexDist(s.tiles[a], lan) - hexDist(s.tiles[b], lan))[0];
    else if (t.dir >= 0) next = s.at.get(`${t.q + DIRS[t.dir][0]},${t.r + DIRS[t.dir][1]}`);
    if (next !== undefined) sc.tile = next;
    // a dry tile has nothing to feed a school: it loses a fish each tide it spends there
    if (s.tiles[sc.tile].dry && sc.fish > 0) sc.fish--;
    // a thinned tile costs a passing school a fish
    if (s.tiles[sc.tile].netted >= Q.THIN_AFTER && sc.fish > 0) { sc.fish--; ev.push({ k: "thin", tile: sc.tile }); }
  }
  // what every tile would have paid a net this tide (shown before you place)
  for (const t of s.tiles) { const near = new Set([t.id, ...neighbours(s, t.id)]); t.pays = s.schools.filter((sc) => near.has(sc.tile)).reduce((n, sc) => n + Math.min(Q.NET_TAKE, sc.fish), 0); }
  // (what a net here would have taken this tide; built nets also keep what they paid)
  // 2. nets take from each school on or next to them
  const thisTide: number[] = s.harvest.map(() => 0), byNet = new Map<number, number>();
  for (const t of s.tiles) {
    if (t.building !== "net") { t.netted = 0; continue; }
    const near = new Set([t.id, ...neighbours(s, t.id)]);
    let got = 0;
    for (const sc of s.schools) if (near.has(sc.tile)) { const n = Math.min(Q.NET_TAKE, sc.fish); sc.fish -= n; got += n; }
    t.paid = got; t.netted = got ? t.netted + 1 : 0;
    if (got) { s.harvest[t.by] += got; thisTide[t.by] += got; byNet.set(t.id, got); s.firstScoreAt[t.by] ??= s.t; }
    ev.push(got ? { k: "net", seat: t.by, tile: t.id, n: got } : { k: "dry", seat: t.by, tile: t.id });
  }
  // 3. ponds breed fish into the tiles beside them (neighbours benefit too)
  for (const t of s.tiles) if (t.building === "pond") {
    const nb = neighbours(s, t.id);
    for (const n of nb) if (s.tiles[n].dry) { s.tiles[n].dry = false; ev.push({ k: "revived", seat: t.by, tile: n }); }
    const into = s.schools.find((sc) => nb.includes(sc.tile));
    if (into) into.fish += Q.POND_BREED; else s.schools.push({ id: s.nextId++, tile: nb[Math.floor(s.rng() * nb.length)] ?? t.id, fish: Q.POND_BREED });
    ev.push({ k: "bred", seat: t.by, tile: t.id, n: Q.POND_BREED });
  }
  // 4. a cormorant steals 2 from an enemy net within 2 tiles, once per tide
  for (const t of s.tiles) if (t.building === "cormorant") {
    const prey = [...byNet].filter(([id, n]) => s.tiles[id].by !== t.by && n > 0 && hexDist(s.tiles[id], t) <= Q.CORMORANT_RANGE).sort((a, b) => b[1] - a[1])[0];
    if (!prey) continue;
    const victim = s.tiles[prey[0]].by, n = Math.min(Q.CORMORANT, prey[1], s.harvest[victim]);
    s.harvest[victim] -= n; s.harvest[t.by] += n; thisTide[t.by] += n; thisTide[victim] -= n; byNet.set(prey[0], prey[1] - n);
    s.cormorants[t.by] += n; s.stolen[victim] += n;
    ev.push({ k: "cormorant", seat: t.by, from: victim, tile: prey[0], n });
  }
  // 5. lanterns burn out; empty schools are gone; hands refill
  for (const t of s.tiles) if (t.building === "lantern" && s.tides >= t.until) { t.building = null; t.by = -1; ev.push({ k: "lanternOut", tile: t.id }); }
  for (const sc of s.schools) if (sc.fish < Q.DRY_FISH) {
    const t = s.tiles[sc.tile];
    if (!t.dry) { t.dry = true; ev.push({ k: "dry-lane", tile: t.id }); }
    sc.fish = 0;
  }
  s.schools = s.schools.filter((sc) => sc.fish > 0);
  thisTide.forEach((n, seat) => { if (n > 0 && (!s.bestTide || n > s.bestTide.n)) s.bestTide = { seat, n }; });
  for (let p = 0; p < s.n; p++) draw(s, p);
  ev.push({ k: "tide", n: s.tides, harvest: s.harvest, fish: s.schools.reduce((n, sc) => n + sc.fish, 0) });
}

function step(s: HoldSim, inputs: { seat: number; i: HoldInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.tides >= Q.TIDES) return ev;
  for (const { seat, i } of inputs) play(s, seat, i, ev);
  s.tick++; s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  if (s.t >= (s.tides + 1) * Q.TIDE_S - 1e-9) tide(s, ev);
  if (s.tides >= Q.TIDES) ev.push({ k: "end" });
  return ev;
}

// ---- a bot: claims towards fish, nets where the schools pass ----
function bot(s: HoldSim, seat: number, r: () => number): HoldInput[] {
  if (r() > 0.03 || !s.hands[seat].length) return [];
  const hand = s.hands[seat], own = s.tiles.filter((t) => t.owner === seat);
  const card = hand[Math.floor(r() * hand.length)];
  if (card === "claim") {
    const edge = s.tiles.filter((t) => t.owner === -1 && neighbours(s, t.id).some((n) => s.tiles[n].owner === seat)).sort((a, b) => b.pays - a.pays);
    return edge[0] ? [{ k: "play", card, tile: edge[0].id }] : [];
  }
  const free = own.filter((t) => !t.building).sort((a, b) => b.pays - a.pays);
  if (!free.length) return [];
  const t = card === "pond" ? free[free.length - 1] : free[0];
  return [{ k: "play", card, tile: t.id, ...(card === "fence" ? { dir: Math.floor(r() * 6) } : {}) }];
}

// ---- what one seat may see: the board, everyone's score, its own hand ----
function frameFor(s: HoldSim, seat: number) {
  return {
    t: s.t, tide: s.tides, tides: Q.TIDES, next: Math.max(0, (s.tides + 1) * Q.TIDE_S - s.t), left: Math.max(0, Q.TIDES * Q.TIDE_S - s.t),
    // id, x, y, owner, building index (-1 none), dir, thinned, paid-or-would-pay, lantern tides left, dry
    tiles: s.tiles.map((t) => [t.id, Math.round(t.x), Math.round(t.y), t.owner, t.building ? CARDS.indexOf(t.building) : -1, t.dir, t.netted >= Q.THIN_AFTER ? 1 : 0, t.building === "net" ? t.paid : t.pays, t.building === "lantern" ? t.until - s.tides : 0, t.dry ? 1 : 0]),
    schools: s.schools.map((sc) => [sc.id, sc.tile, sc.fish]),
    harvest: s.harvest, held: s.harvest.map((_, p) => s.tiles.filter((t) => t.owner === p).length),
    hand: seat >= 0 && seat < s.n ? s.hands[seat] : [], hands: s.hands.map((h) => h.length),
    fish: s.schools.reduce((n, sc) => n + sc.fish, 0),
  };
}

function results(s: HoldSim): Results {
  const held = s.harvest.map((_, p) => s.tiles.filter((t) => t.owner === p).length);
  const score = s.harvest.map((h, p) => held[p] + h);
  // ranked by score, then harvest, then fewer cards played
  const rank = s.harvest.map((_, p) => p).sort((a, b) => score[b] - score[a] || s.harvest[b] - s.harvest[a] || s.played[a] - s.played[b]);
  const seats = s.harvest.map((h, p) => ({ seat: p, score: score[p], place: rank.indexOf(p) + 1, firstScoreS: s.firstScoreAt[p], tiles: held[p], harvest: h }));
  const robbed = s.stolen.indexOf(Math.max(...s.stolen));
  const highlights: Highlight[] = [
    { title: "Best tide", text: s.bestTide ? `{name}: ${s.bestTide.n} fish in one tide` : "no net caught anything", seat: s.bestTide?.seat ?? 0, tkey: "hl_hold_best_t", key: s.bestTide ? "hl_hold_best" : "hl_hold_best_none", vars: { n: s.bestTide?.n ?? 0 } },
    { title: "Biggest loss", text: s.stolen[robbed] ? `{name}: cormorants took ${s.stolen[robbed]}` : "no cormorant struck", seat: robbed, tkey: "hl_hold_loss_t", key: s.stolen[robbed] ? "hl_hold_loss" : "hl_hold_loss_none", vars: { n: s.stolen[robbed] } },
    { title: "Closest call", text: rank.length > 1 ? `{name} led by ${score[rank[0]] - score[rank[1]]}${score[rank[0]] === score[rank[1]] ? " (tie broken by harvest)" : ""}` : "a match of one", seat: rank[0], tkey: "hl_hold_close_t", key: rank.length > 1 ? (score[rank[0]] === score[rank[1]] ? "hl_hold_close_tie" : "hl_hold_close") : "hl_hold_close_none", vars: { n: rank.length > 1 ? score[rank[0]] - score[rank[1]] : 0 } },
  ];
  return { seats, lakeLeft: s.schools.reduce((n, sc) => n + sc.fish, 0), highlights };
}

export const hold: Mode<HoldSim, HoldInput> = {
  id: "hold", model: "holdings 1.0", seats: Q.SEATS,
  make, input, step, frameFor, over: (s) => s.tides >= Q.TIDES, results, bot,
};
