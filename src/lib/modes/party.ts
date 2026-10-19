// Fishing Party, "party 1.0" (DESIGN.md "Fishing Party"): five rounds of
// 35 s, each a different game with its own controls, an 8 s shop between
// them, the last-placed player's pick of the next round's variant, and one
// lake that carries over. Rounds 1, 2 and 4 draw from the lake; Last Net's
// school is a share of what is left, and it pays double.
//
// Pure and deterministic: everything random draws from the match's "lake"
// stream. Lantern Night is the one round with a secret: frameFor sends each
// seat only the fish its lantern (or a dropped lantern) lights. Last Net's
// picks are secret until the round ends.
import { PARTY as Q } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";

export type Game = "shoal" | "koi" | "tug" | "night" | "last";
type Item = "bigNet" | "fastBoat" | "bait" | "muddy";
export type PartyInput =
  | { k: "tap"; x: number; y: number }
  | { k: "steer"; x: number; y: number }
  | { k: "reel" } | { k: "cast" } | { k: "drop" }
  | { k: "buy"; item: Item }
  | { k: "variant"; v: 0 | 1 }
  | { k: "pick"; size: 3 | 6 | 10 };

interface Boat { x: number; y: number; h: number; tx: number; ty: number; vx: number; vy: number; cd: number }
interface Fish { x: number; y: number; h: number }
export interface PartySim {
  tick: number; t: number; phaseT: number; n: number; rng: () => number;
  phase: "intro" | "round" | "standings" | "pick" | "shop" | "end"; round: number; order: Game[]; game: Game; variant: 0 | 1;
  coins: number[]; roundCoins: number[][]; lake: number; lakeStart: number; school: number;
  perks: Item[][]; muddy: number[]; view: number[]; picker: number; // perks: bought in a shop, used in the next round, then gone
  boats: Boat[]; fish: Fish[]; shoals: { x: number; y: number; n: number; at: number; until: number }[]; nextShoal: number;
  gates: { x: number; y: number }[]; nextGate: number[]; koi: { x: number; y: number; h: number };
  ropes: { seats: number[]; pos: number }[]; needle: number; reelAt: number[];
  drops: { seat: number; x: number; y: number; until: number }[]; dropsLeft: number[];
  baitUntil: number[]; picks: (number | null)[]; firstScoreAt: (number | null)[]; best: { seat: number; coins: number; game: Game } | null;
}

const ell = (x: number, y: number): number => Math.hypot((x - Q.W / 2) / Q.RX, (y - Q.H / 2) / Q.RY);
const NAMES: Record<Game, string> = { shoal: "Shoal Scramble", koi: "Koi Chase", tug: "Tug of Line", night: "Lantern Night", last: "Last Net" };
const leaderOf = (s: PartySim): number => s.coins.indexOf(Math.max(...s.coins));

function make(seed: string, seats: Seat[], lake: { fish: number }): PartySim {
  const rng = streamOf(seed, "lake"), n = seats.length;
  const order: Game[] = [...Q.GAMES];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  order.push("last");
  return {
    tick: 0, t: 0, phaseT: 0, n, rng, phase: "intro", round: 0, order, game: order[0], variant: 0,
    coins: seats.map(() => 0), roundCoins: [], lake: lake.fish, lakeStart: lake.fish, school: 0,
    perks: seats.map(() => []), muddy: [], view: seats.map(() => Q.LANTERN_R), picker: n - 1,
    boats: seats.map((_, i) => { const a = (i / n) * Math.PI * 2 + Math.PI / 2, x = Q.W / 2 + Math.cos(a) * Q.RX * 0.75, y = Q.H / 2 + Math.sin(a) * Q.RY * 0.75; return { x, y, h: a + Math.PI, tx: x, ty: y, vx: 0, vy: 0, cd: 0 }; }),
    fish: [], shoals: [], nextShoal: 0, gates: [], nextGate: seats.map(() => 0), koi: { x: Q.W / 2, y: Q.H / 2, h: 0 },
    ropes: [], needle: 0, reelAt: seats.map(() => -99), drops: [], dropsLeft: seats.map(() => 1), baitUntil: seats.map(() => -1), picks: seats.map(() => null),
    firstScoreAt: seats.map(() => null), best: null,
  };
}

const num = (v: unknown): number | null => { const x = Number(v); return Number.isFinite(x) ? x : null; };
function input(s: PartySim, _seat: number, raw: unknown): PartyInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const xy = (): { x: number; y: number } | null => { const x = num(o.x), y = num(o.y); return x === null || y === null ? null : { x: Math.round(Math.max(0, Math.min(Q.W, x))), y: Math.round(Math.max(0, Math.min(Q.H, y))) }; };
  switch (o.k) {
    case "tap": case "steer": { const p = xy(); return p ? { k: o.k, ...p } : null; }
    case "reel": case "cast": case "drop": return { k: o.k };
    case "buy": return o.item === "bigNet" || o.item === "fastBoat" || o.item === "bait" || o.item === "muddy" ? { k: "buy", item: o.item } : null;
    case "variant": return o.v === 0 || o.v === 1 ? { k: "variant", v: o.v } : null;
    case "pick": return o.size === 3 || o.size === 6 || o.size === 10 ? { k: "pick", size: o.size } : null;
  }
  return null;
}

function earn(s: PartySim, seat: number, c: number, ev: GameEvent[], why: string): void {
  if (c <= 0) return;
  s.coins[seat] += c; s.roundCoins[s.round][seat] += c; s.firstScoreAt[seat] ??= s.t;
  ev.push({ k: "coins", seat, c, why });
}
const take = (s: PartySim, n: number): number => { const got = Math.max(0, Math.min(n, s.lake)); s.lake -= got; return got; };

function startRound(s: PartySim, ev: GameEvent[]): void {
  s.game = s.order[s.round]; s.phase = "round"; s.phaseT = 0; s.roundCoins[s.round] = s.coins.map(() => 0);
  s.baitUntil = s.perks.map((p) => (p.includes("bait") ? s.t + Q.BAIT_S : -1));
  s.view = s.coins.map((_, i) => Q.LANTERN_R * (s.muddy.includes(i) ? Q.MUDDY : 1) * (s.variant && s.game === "night" ? 0.8 : 1));
  const g = s.game;
  if (g === "shoal") { s.shoals = []; s.nextShoal = 1; }
  if (g === "koi") {
    const narrow = s.variant === 1;
    s.gates = Array.from({ length: Q.GATES }, (_, i) => { const a = (i / Q.GATES) * Math.PI * 2; return { x: Q.W / 2 + Math.cos(a) * Q.RX * 0.6, y: Q.H / 2 + Math.sin(a) * Q.RY * 0.6 }; });
    s.nextGate = s.coins.map((_, i) => i % Q.GATES);
    s.koi = { x: Q.W / 2, y: Q.H / 2, h: s.rng() * 6.28 };
    if (narrow) s.gates = s.gates.map((p) => ({ x: p.x, y: p.y }));
  }
  if (g === "tug") {
    const seats = s.coins.map((_, i) => i);
    s.ropes = s.variant === 1 || s.n < 2 ? seats.map((i) => ({ seats: [i], pos: 0 })) : [];
    if (!s.ropes.length) { for (let i = 0; i + 1 < s.n; i += 2) s.ropes.push({ seats: [i, i + 1], pos: 0 }); if (s.n % 2) s.ropes.push({ seats: [s.n - 1], pos: 0 }); }
    s.reelAt = s.coins.map(() => -99);
  }
  if (g === "night") {
    s.fish = [];
    const n = Math.min(s.lake, 60);
    for (let i = 0; i < n; i++) { let x, y; do { x = Q.W / 2 + (s.rng() * 2 - 1) * Q.RX; y = Q.H / 2 + (s.rng() * 2 - 1) * Q.RY; } while (ell(x, y) > 0.85); s.fish.push({ x, y, h: s.rng() * 6.28 }); }
    s.drops = []; s.dropsLeft = s.coins.map(() => (s.variant === 1 ? 3 : 1));
  }
  if (g === "last") { s.school = Math.max(1, Math.round(s.lake * Q.SCHOOL_SHARE)); s.picks = s.coins.map(() => null); }
  ev.push({ k: "round", n: s.round + 1, game: g, name: NAMES[g], variant: Q.VARIANTS[g][s.variant], vi: s.variant, school: g === "last" ? s.school : undefined });
}

function endRound(s: PartySim, ev: GameEvent[]): void {
  const g = s.game;
  if (g === "tug") for (const r of s.ropes) {
    const winner = r.seats.length === 2 ? (r.pos > 0 ? r.seats[0] : r.pos < 0 ? r.seats[1] : null) : r.pos > 0 ? r.seats[0] : null;
    if (winner !== null) { const got = take(s, Q.TUG_COINS); earn(s, winner, got, ev, "landed the big fish"); ev.push({ k: "landed", seat: winner, n: got }); }
    else ev.push({ k: "lost", seats: r.seats });
  }
  if (g === "last") {
    const sum = s.picks.reduce<number>((n, p) => n + (p ?? 0), 0), broke = sum > s.school;
    s.picks.forEach((p, seat) => { const got = broke ? Math.min(1, s.lake) : take(s, p ?? 0); if (broke) take(s, 1); earn(s, seat, got * Q.LAST_MULT, ev, broke ? "the school broke" : "Last Net"); });
    ev.push({ k: "lastNet", picks: s.picks, sum, school: s.school, broke });
  }
  if (g === "night") s.lake -= 0; // night catches already came out of the lake
  const rc = s.roundCoins[s.round], top = Math.max(...rc), who = rc.indexOf(top);
  if (top > 0 && (!s.best || top > s.best.coins)) s.best = { seat: who, coins: top, game: g };
  s.muddy = []; s.perks = s.coins.map(() => []);
  s.round++;
  if (s.round >= 5) { s.phase = "end"; ev.push({ k: "end", coins: s.coins }); return; }
  s.phase = "standings"; s.phaseT = 0; s.variant = 0;
  // the last-placed player picks the next round's variant (ties: the later seat)
  let low = 0; for (let i = 0; i < s.n; i++) if (s.coins[i] <= s.coins[low]) low = i;
  s.picker = low;
  ev.push({ k: "standings", coins: s.coins, lake: s.lake, next: NAMES[s.order[s.round]], picker: low });
  if (s.order[s.round] === "last") ev.push({ k: "lastWarning", lake: s.lake, school: Math.max(1, Math.round(s.lake * Q.SCHOOL_SHARE)), started: s.lakeStart });
}

function apply(s: PartySim, seat: number, i: PartyInput, ev: GameEvent[]): void {
  const b = s.boats[seat];
  if (s.phase === "pick" || s.phase === "shop") {
    if (i.k === "variant" && seat === s.picker) { s.variant = i.v; ev.push({ k: "variant", seat, v: i.v, text: Q.VARIANTS[s.order[s.round]][i.v] }); }
    if (s.phase === "pick") return;
    if (i.k === "buy") {
      const it = Q.SHOP[i.item];
      if (s.coins[seat] < it.cost || s.perks[seat].includes(i.item)) return;
      if (i.item === "muddy" && s.coins[seat] >= Math.max(...s.coins)) return; // only players behind the leader
      s.coins[seat] -= it.cost; s.perks[seat].push(i.item);
      if (i.item === "muddy") { const l = leaderOf(s); if (!s.muddy.includes(l)) s.muddy.push(l); }
      ev.push({ k: "bought", seat, item: i.item });
    }
    return;
  }
  if (s.phase !== "round") return;
  const g = s.game, has = (p: Item) => s.perks[seat]?.includes(p);
  if (g === "shoal" && i.k === "tap") {
    const r = Q.TAP_R * (has("bigNet") ? Q.BIG_NET : 1);
    const k = s.shoals.findIndex((sh) => Math.hypot(sh.x - i.x, sh.y - i.y) <= r);
    if (k < 0) { ev.push({ k: "miss", seat, x: i.x, y: i.y, to: [seat] }); return; }
    const sh = s.shoals.splice(k, 1)[0], got = take(s, sh.n);
    earn(s, seat, got, ev, "Shoal Scramble");
    ev.push({ k: "shoal", seat, n: got, x: sh.x, y: sh.y });
  }
  if ((g === "koi" || g === "night") && i.k === "steer") { b.tx = i.x; b.ty = i.y; }
  if (g === "tug" && i.k === "reel") {
    if (s.t - s.reelAt[seat] < Q.REEL_GAP_S - 1e-9) return; // mashing is rate-limited here, on the server
    s.reelAt[seat] = s.t;
    const rope = s.ropes.find((r) => r.seats.includes(seat)); if (!rope) return;
    const green = (rope.seats.length === 1 ? Q.GREEN_SOLO : Q.GREEN) / 2, inGreen = Math.abs(s.needle) <= green;
    const dir = rope.seats[0] === seat ? 1 : -1;
    rope.pos += inGreen ? dir * Q.PULL : -dir * Q.SLIP;
    ev.push({ k: "reel", seat, ok: inGreen });
    if (Math.abs(rope.pos) >= Q.ROPE_WIN) { rope.pos = Math.sign(rope.pos) * Q.ROPE_WIN; }
  }
  if (g === "night" && i.k === "cast" && b.cd <= 0) {
    b.cd = Q.NIGHT_CD;
    const r = Q.NIGHT_NET_R * (has("bigNet") ? Q.BIG_NET : 1), x = b.x + Math.cos(b.h) * 36, y = b.y + Math.sin(b.h) * 36;
    let n = 0; s.fish = s.fish.filter((f) => { if (Math.hypot(f.x - x, f.y - y) < r) { n++; return false; } return true; });
    const got = take(s, n); earn(s, seat, got, ev, "Lantern Night");
    ev.push({ k: "netted", seat, n: got, x, y });
  }
  if (g === "night" && i.k === "drop" && s.dropsLeft[seat] > 0) {
    s.dropsLeft[seat]--;
    const d = { seat, x: Math.round(b.x), y: Math.round(b.y), until: s.t + Q.DROP_S };
    s.drops.push(d); ev.push({ k: "drop", ...d });
  }
  if (g === "last" && i.k === "pick" && s.picks[seat] === null) { s.picks[seat] = i.size; ev.push({ k: "picked", seat }); }
}

function sail(s: PartySim, seat: number): void {
  const b = s.boats[seat], has = (p: Item) => s.perks[seat]?.includes(p);
  if (b.cd > 0) b.cd -= Q.DT;
  const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), v = Q.SPEED * (has("fastBoat") ? Q.FAST : 1);
  const want = d > 4 ? Math.min(1, d / 40) : 0, k = Math.min(1, 6 * Q.DT);
  b.vx += ((d > 4 ? dx / d : 0) * v * want - b.vx) * k; b.vy += ((d > 4 ? dy / d : 0) * v * want - b.vy) * k;
  b.x += b.vx * Q.DT; b.y += b.vy * Q.DT;
  const e = ell(b.x, b.y); if (e > 0.95) { b.x = Q.W / 2 + (b.x - Q.W / 2) * 0.95 / e; b.y = Q.H / 2 + (b.y - Q.H / 2) * 0.95 / e; }
  if (Math.hypot(b.vx, b.vy) > 8) b.h = Math.atan2(b.vy, b.vx);
}

function play(s: PartySim, ev: GameEvent[]): void {
  const g = s.game;
  if (g === "shoal") {
    s.shoals = s.shoals.filter((sh) => sh.until > s.t + 1e-9 || (ev.push({ k: "sank", x: sh.x, y: sh.y }), false));
    if (s.phaseT >= s.nextShoal && s.lake > 0) {
      s.nextShoal += Q.SHOAL_EVERY_S;
      const two = s.variant === 1;
      for (let k = 0; k < (two ? 2 : 1); k++) {
        let x, y; do { x = Q.W / 2 + (s.rng() * 2 - 1) * Q.RX; y = Q.H / 2 + (s.rng() * 2 - 1) * Q.RY; } while (ell(x, y) > 0.8);
        // bait: a school surfaces nearer the buyer
        const baiter = s.baitUntil.findIndex((u) => u > s.t + 1e-9);
        if (baiter >= 0 && s.rng() < 0.5) { x = (x + s.boats[baiter].x) / 2; y = (y + s.boats[baiter].y) / 2; }
        const n = Math.max(1, Math.min(two ? 3 : Q.SHOAL_MAX, Math.round(s.lake / 30)));
        s.shoals.push({ x: Math.round(x), y: Math.round(y), n, at: s.t, until: s.t + Q.SHOAL_UP_S });
        ev.push({ k: "surface", x: Math.round(x), y: Math.round(y), n });
      }
    }
  }
  if (g === "koi") {
    for (let i = 0; i < s.n; i++) {
      sail(s, i);
      const b = s.boats[i], gate = s.gates[s.nextGate[i]], r = s.variant === 1 ? Q.GATE_R * 0.6 : Q.GATE_R;
      if (Math.hypot(b.x - gate.x, b.y - gate.y) < r) { earn(s, i, s.variant === 1 ? 2 : 1, ev, "gate"); ev.push({ k: "gate", seat: i, x: gate.x, y: gate.y }); s.nextGate[i] = (s.nextGate[i] + 1) % Q.GATES; }
      if (Math.hypot(b.x - s.koi.x, b.y - s.koi.y) < Q.KOI_R) {
        take(s, 1); earn(s, i, Q.KOI_COINS, ev, "the golden carp");
        ev.push({ k: "koiCaught", seat: i, x: Math.round(s.koi.x), y: Math.round(s.koi.y) });
        const a = s.rng() * 6.28; s.koi = { x: Q.W / 2 + Math.cos(a) * 200, y: Q.H / 2 + Math.sin(a) * 130, h: s.rng() * 6.28 };
      }
    }
    let fx = 0, fy = 0; for (const b of s.boats) { const dx = s.koi.x - b.x, dy = s.koi.y - b.y, d = Math.hypot(dx, dy); if (d < 160 && d > 0) { fx += dx / d / d * 160; fy += dy / d / d * 160; } }
    s.koi.h = Math.atan2(Math.sin(s.koi.h) + fy, Math.cos(s.koi.h) + fx) + (s.rng() - 0.5) * 0.4;
    if (ell(s.koi.x, s.koi.y) > 0.8) s.koi.h = Math.atan2(Q.H / 2 - s.koi.y, Q.W / 2 - s.koi.x);
    s.koi.x += Math.cos(s.koi.h) * Q.KOI_SPEED * Q.DT; s.koi.y += Math.sin(s.koi.h) * Q.KOI_SPEED * Q.DT;
  }
  if (g === "tug") s.needle = Math.sin(s.phaseT * Math.PI * 2 * Q.NEEDLE_HZ);
  if (g === "night") {
    for (let i = 0; i < s.n; i++) sail(s, i);
    const baiter = s.baitUntil.findIndex((u) => u > s.t + 1e-9);
    for (const f of s.fish) {
      f.h += (s.rng() - 0.5) * 0.5;
      const b = baiter >= 0 ? s.boats[baiter] : null;
      if (b && Math.hypot(b.x - f.x, b.y - f.y) <= Q.BAIT_R * Q.LANTERN_R) f.h = Math.atan2(b.y - f.y, b.x - f.x) + (s.rng() - 0.5) * 0.3;
      if (ell(f.x, f.y) > 0.85) f.h = Math.atan2(Q.H / 2 - f.y, Q.W / 2 - f.x);
      f.x += Math.cos(f.h) * 26 * Q.DT; f.y += Math.sin(f.h) * 26 * Q.DT;
    }
    s.drops = s.drops.filter((d) => d.until > s.t + 1e-9);
  }
}

function step(s: PartySim, inputs: { seat: number; i: PartyInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === "end") return ev;
  for (const { seat, i } of inputs) apply(s, seat, i, ev);
  s.tick++; s.t = Math.round(s.tick * Q.DT * 1000) / 1000; s.phaseT = Math.round((s.phaseT + Q.DT) * 1000) / 1000;
  if (s.phase === "intro" && s.phaseT >= Q.INTRO_S - 1e-9) startRound(s, ev);
  else if (s.phase === "round") { play(s, ev); if (s.phaseT >= Q.ROUND_S - 1e-9 || (s.game === "last" && s.picks.every((p) => p !== null) && s.phaseT > 2)) endRound(s, ev); }
  else if (s.phase === "standings" && s.phaseT >= Q.STANDINGS_S - 1e-9) { s.phase = "pick"; s.phaseT = 0; ev.push({ k: "pick", picker: s.picker, next: NAMES[s.order[s.round]], nextGame: s.order[s.round] }); ev.push({ k: "choose", variants: Q.VARIANTS[s.order[s.round]], to: [s.picker] }); }
  else if (s.phase === "pick" && s.phaseT >= Q.PICK_S - 1e-9) { s.phase = "shop"; s.phaseT = 0; ev.push({ k: "shop", picker: s.picker, next: NAMES[s.order[s.round]], variant: Q.VARIANTS[s.order[s.round]][s.variant], nextGame: s.order[s.round], vi: s.variant }); }
  else if (s.phase === "shop" && s.phaseT >= Q.SHOP_S - 1e-9) startRound(s, ev);
  return ev;
}

// ---- a bot ----
function bot(s: PartySim, seat: number, r: () => number): PartyInput[] {
  if (s.phase === "pick") return seat === s.picker && r() < 0.05 ? [{ k: "variant", v: r() < 0.5 ? 0 : 1 }] : [];
  if (s.phase === "shop") {
    if (r() > 0.05) return [];
    const behind = s.coins[seat] < Math.max(...s.coins);
    const items: Item[] = behind ? ["muddy", "bigNet", "fastBoat"] : ["bigNet", "fastBoat", "bait"];
    const it = items[Math.floor(r() * items.length)];
    return s.coins[seat] >= Q.SHOP[it].cost + 2 ? [{ k: "buy", item: it }] : [];
  }
  if (s.phase !== "round") return [];
  const b = s.boats[seat];
  switch (s.game) {
    case "shoal": { const sh = s.shoals[0]; return sh && s.t - sh.at > 0.35 + r() * 0.6 && r() < 0.15 ? [{ k: "tap", x: sh.x + Math.round((r() - 0.5) * 50), y: sh.y + Math.round((r() - 0.5) * 50) }] : []; }
    case "koi": { if (r() > 0.2) return []; const g = s.gates[s.nextGate[seat]], koi = Math.hypot(s.koi.x - b.x, s.koi.y - b.y) < 200; return [{ k: "steer", x: Math.round(koi ? s.koi.x : g.x), y: Math.round(koi ? s.koi.y : g.y) }]; }
    case "tug": return Math.abs(s.needle) < Q.GREEN / 2 + (r() - 0.5) * 0.3 && r() < 0.4 ? [{ k: "reel" }] : [];
    case "night": {
      if (r() > 0.2) return [];
      const near = s.fish.filter((f) => Math.hypot(f.x - b.x, f.y - b.y) < s.view[seat])[0];
      const out: PartyInput[] = [{ k: "steer", x: Math.round(near ? near.x : Q.W / 2 + (r() - 0.5) * 600), y: Math.round(near ? near.y : Q.H / 2 + (r() - 0.5) * 400) }];
      if (near && Math.hypot(near.x - b.x, near.y - b.y) < 60) out.push({ k: "cast" });
      if (!near && s.dropsLeft[seat] && r() < 0.05) out.push({ k: "drop" });
      return out;
    }
    case "last": return s.picks[seat] === null && s.phaseT > 3 + r() * 6 && r() < 0.1 ? [{ k: "pick", size: s.coins[seat] >= Math.max(...s.coins) ? 3 : r() < 0.5 ? 10 : 6 }] : [];
  }
  return [];
}

// ---- what one seat may see ----
function frameFor(s: PartySim, seat: number) {
  const me = seat >= 0 && seat < s.n ? seat : -1;
  const view = me >= 0 ? s.view[me] : 0;
  const lit = (f: Fish): boolean => (me >= 0 && Math.hypot(f.x - s.boats[me].x, f.y - s.boats[me].y) <= view) || s.drops.some((d) => Math.hypot(f.x - d.x, f.y - d.y) <= Q.DROP_R);
  const g = s.phase === "round" ? s.game : null;
  return {
    t: s.t, phase: s.phase, round: s.round + 1, game: s.order[Math.min(s.round, 4)], name: NAMES[s.order[Math.min(s.round, 4)]],
    variant: Q.VARIANTS[s.order[Math.min(s.round, 4)]][s.variant], vi: s.variant,
    // the choice goes only to the last-placed player; everyone else is told who is choosing
    variants: s.phase !== "pick" || me === s.picker ? Q.VARIANTS[s.order[Math.min(s.round, 4)]] : [], picking: s.phase === "pick" && me === s.picker,
    left: Math.max(0, (s.phase === "round" ? Q.ROUND_S : s.phase === "shop" ? Q.SHOP_S : s.phase === "standings" ? Q.STANDINGS_S : s.phase === "pick" ? Q.PICK_S : Q.INTRO_S) - s.phaseT),
    coins: s.coins, lake: s.lake, lakeStart: s.lakeStart, picker: s.picker, perks: me >= 0 ? s.perks[me] : [],
    behind: me >= 0 ? s.coins[me] < Math.max(...s.coins) : false,
    b: g === "koi" || g === "night" ? s.boats.map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.h * 100)]) : [],
    shoals: g === "shoal" ? s.shoals.map((sh) => [sh.x, sh.y, sh.n, Math.round((sh.until - s.t) * 1000)]) : [],
    gates: g === "koi" ? s.gates.map((p) => [Math.round(p.x), Math.round(p.y)]) : [], next: g === "koi" && me >= 0 ? s.nextGate[me] : null,
    koi: g === "koi" ? [Math.round(s.koi.x), Math.round(s.koi.y), Math.round(s.koi.h * 100)] : null,
    ropes: g === "tug" ? s.ropes.map((r) => ({ seats: r.seats, pos: r.pos })) : [], needle: g === "tug" ? Math.round(s.needle * 100) / 100 : 0,
    green: g === "tug" ? (s.ropes.find((r) => r.seats.includes(me))?.seats.length === 1 ? Q.GREEN_SOLO : Q.GREEN) : 0,
    // Lantern Night: only what this seat's lantern or a dropped lantern lights
    f: g === "night" ? s.fish.filter(lit).map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.h * 100)]) : [],
    view: g === "night" ? Math.round(view) : 0, drops: g === "night" ? s.drops.map((d) => [d.x, d.y, Math.round((d.until - s.t) * 10) / 10]) : [],
    dropsLeft: me >= 0 ? s.dropsLeft[me] : 0,
    school: g === "last" ? s.school : 0, myPick: g === "last" && me >= 0 ? s.picks[me] : null, picked: g === "last" ? s.picks.map((p) => p !== null) : [],
  };
}

function results(s: PartySim): Results {
  const seats = s.coins.map((c, seat) => ({ seat, score: c, place: 1 + s.coins.filter((x) => x > c).length, firstScoreS: s.firstScoreAt[seat], rounds: s.roundCoins.map((r) => r[seat]) }));
  const worst = s.coins.indexOf(Math.min(...s.coins));
  const close = [...seats].sort((a, b) => a.place - b.place || b.score - a.score);
  const gap = close.length > 1 ? close[0].score - close[1].score : 0;
  const highlights: Highlight[] = [
    { title: "Best round", text: s.best ? `{name}: ${s.best.coins} coins in ${NAMES[s.best.game]}` : "nobody scored", seat: s.best?.seat ?? 0, tkey: "hl_party_best_t", key: s.best ? "hl_party_best" : "hl_party_best_none", vars: s.best ? { n: s.best.coins, round: `@y_round_${s.best.game}` } : {} },
    { title: "Biggest loss", text: `{name} finished on ${s.coins[worst]} coins`, seat: worst, tkey: "hl_party_loss_t", key: "hl_party_loss", vars: { n: s.coins[worst] } },
    { title: "Closest call", text: close.length > 1 ? `{name} won by ${gap} coin${gap === 1 ? "" : "s"}` : "a match of one", seat: close[0].seat, tkey: "hl_party_close_t", key: close.length > 1 ? (gap === 1 ? "hl_party_close1" : "hl_party_close") : "hl_party_close_none", vars: { n: gap } },
  ];
  return { seats, lakeLeft: s.lake, highlights };
}

export const party: Mode<PartySim, PartyInput> = {
  id: "party", model: "party 1.0", seats: Q.SEATS, breeds: false,
  make, input, step, frameFor, over: (s) => s.phase === "end", results, bot,
};
