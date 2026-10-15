#!/usr/bin/env node
// The balance harness (session 14): plays bot-only matches of each /play mode
// through its own make and step, on 300 seeds each, and writes
// docs/checks/balance-2026-10-15.md. No server. Every number it writes is a
// claim about these bots, strategies and seeds, never about people.
//
// A strategy shapes the mode's own bot: it keeps the bot's sailing and
// fishing and decides the choice the strategy is about (which upgrade, which
// shop item, which card, how the table votes). Each match draws its four
// strategies and their seats by a seeded shuffle, so no strategy always
// meets the same rivals or sits in the same seat.
//
//   node scripts/balance.ts            all four modes, 300 seeds each
//   node scripts/balance.ts rush 60    one mode, fewer seeds (a quick look)
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { botStream, type Seat } from "../src/lib/game-platform.ts";
import { hold, type HoldInput, type HoldSim } from "../src/lib/modes/hold.ts";
import { party, type PartyInput, type PartySim } from "../src/lib/modes/party.ts";
import { poach, type PoachInput, type PoachSim } from "../src/lib/modes/poach.ts";
import { rush, type RushInput, type RushSim } from "../src/lib/modes/rush.ts";

type Strat = { name: string; shape: (s: any, seat: number, ins: any[], r: () => number) => any[] };

// ---- Boat Rush: one upgrade path each, no upgrades, or ram-heavy ----
const firstUp = (first: string) => (s: RushSim, seat: number, ins: RushInput[]) => {
  const b = s.boats[seat], order = [first, ...["bigHold", "fastHull", "wideNet", "ironBow"].filter((u) => u !== first)];
  const out: RushInput[] = ins.filter((i) => i.k !== "buy");
  if (b.docked && b.ups.length < 2) { const u = order.find((x) => !b.ups.includes(x as never)); if (u) out.push({ k: "buy", up: u as never }); }
  return out;
};
const RUSH_STRATS: Strat[] = [
  { name: "Big Hold first", shape: firstUp("bigHold") },
  { name: "Fast Hull first", shape: firstUp("fastHull") },
  { name: "Wide Net first", shape: firstUp("wideNet") },
  { name: "Iron Bow first", shape: firstUp("ironBow") },
  { name: "no upgrades", shape: (_s, _seat, ins) => ins.filter((i: RushInput) => i.k !== "buy") },
  { name: "ram-heavy", shape: (s: RushSim, seat, ins: RushInput[]) => {
    const b = s.boats[seat];
    const prey = s.boats.filter((o) => o !== b && o.hold.length >= 3 && o.shield <= 0).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
    if (!prey || b.hold.length >= 6) return ins.filter((i) => i.k !== "buy");
    const out: RushInput[] = [{ k: "steer", x: Math.round(prey.x), y: Math.round(prey.y) }];
    if (Math.hypot(prey.x - b.x, prey.y - b.y) < 90 && b.dashCd <= 0) out.push({ k: "dash" });
    return out;
  } },
];

// ---- Fishing Party: one shop item every time, or never buy ----
const always = (item: string) => (s: PartySim, seat: number, ins: PartyInput[]) => {
  const out: PartyInput[] = ins.filter((i) => i.k !== "buy");
  if (s.phase === "shop" && !s.perks[seat].includes(item as never)) out.push({ k: "buy", item: item as never });
  return out;
};
const PARTY_STRATS: Strat[] = [
  { name: "Big Net always", shape: always("bigNet") },
  { name: "Fast Boat always", shape: always("fastBoat") },
  { name: "Bait always", shape: always("bait") },
  { name: "Muddy Water always", shape: always("muddy") },
  { name: "never buy", shape: (_s, _seat, ins) => ins.filter((i: PartyInput) => i.k !== "buy") },
];

// ---- Lake Holdings: what each card in hand is used for ----
const holdPlay = (pref: (s: HoldSim, seat: number, card: string) => number | null) => (s: HoldSim, seat: number, ins: HoldInput[], r: () => number) => {
  if (r() > 0.04 || !s.hands[seat].length) return [];
  for (const card of s.hands[seat]) { const t = pref(s, seat, card); if (t !== null) return [{ k: "play", card, tile: t, ...(card === "fence" ? { dir: Math.floor(r() * 6) } : {}) } as HoldInput]; }
  return ins;
};
const nbrs = (s: HoldSim, id: number): number[] => { const t = s.tiles[id]; return [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([a, b]) => s.at.get(`${t.q + a},${t.r + b}`)).filter((x): x is number => x !== undefined); };
const freeOwn = (s: HoldSim, seat: number) => s.tiles.filter((t) => t.owner === seat && !t.building).sort((a, b) => b.pays - a.pays);
const claimEdge = (s: HoldSim, seat: number) => s.tiles.filter((t) => t.owner === -1 && nbrs(s, t.id).some((n) => s.tiles[n].owner === seat)).sort((a, b) => b.pays - a.pays)[0]?.id ?? null;
const leaderOf = (s: HoldSim, seat: number) => { let best = -1, bs = -1; for (let p = 0; p < s.n; p++) { if (p === seat) continue; const sc = s.harvest[p] + s.tiles.filter((t) => t.owner === p).length; if (sc > bs) { bs = sc; best = p; } } return best; };
const HOLD_STRATS: Strat[] = [
  { name: "all nets", shape: holdPlay((s, seat, c) => (c === "claim" ? claimEdge(s, seat) : c === "net" ? freeOwn(s, seat)[0]?.id ?? null : null)) },
  { name: "nets + ponds", shape: holdPlay((s, seat, c) => (c === "claim" ? claimEdge(s, seat) : c === "net" ? freeOwn(s, seat)[0]?.id ?? null : c === "pond" ? freeOwn(s, seat).at(-1)?.id ?? null : null)) },
  { name: "fences against the leader", shape: holdPlay((s, seat, c) => {
    if (c === "claim") return claimEdge(s, seat);
    if (c === "net") return freeOwn(s, seat)[0]?.id ?? null;
    if (c !== "fence") return null;
    const lead = leaderOf(s, seat); const theirNet = s.tiles.find((t) => t.owner === lead && t.building === "net");
    if (!theirNet) return freeOwn(s, seat)[0]?.id ?? null;
    return freeOwn(s, seat).sort((a, b) => Math.hypot(a.x - theirNet.x, a.y - theirNet.y) - Math.hypot(b.x - theirNet.x, b.y - theirNet.y))[0]?.id ?? null;
  }) },
  { name: "cormorant raider", shape: holdPlay((s, seat, c) => {
    if (c === "claim") { const enemyNet = s.tiles.find((t) => t.building === "net" && t.by !== seat); if (enemyNet) { const near = s.tiles.filter((t) => t.owner === -1 && nbrs(s, t.id).some((n) => s.tiles[n].owner === seat)).sort((a, b) => Math.hypot(a.x - enemyNet.x, a.y - enemyNet.y) - Math.hypot(b.x - enemyNet.x, b.y - enemyNet.y))[0]; if (near) return near.id; } return claimEdge(s, seat); }
    if (c === "cormorant" || c === "net") return freeOwn(s, seat)[0]?.id ?? null;
    return null;
  }) },
  { name: "lantern puller", shape: holdPlay((s, seat, c) => (c === "claim" ? claimEdge(s, seat) : c === "lantern" || c === "net" ? freeOwn(s, seat)[0]?.id ?? null : null)) },
];

// ---- Who's Poaching: how the table votes (everyone at the table) ----
type Table = "always skip" | "accused most" | "buoy evidence";
const TABLES: Table[] = ["always skip", "accused most", "buoy evidence"];
function poachVote(s: PoachSim, seat: number, table: Table, r: () => number): PoachInput | null {
  if (s.phase !== "meeting" || s.out[seat] || s.votes[seat] !== undefined || s.phaseT < 6 + seat) return null;
  const alive = s.boats.filter((b) => !s.out[b.seat] && b.seat !== seat).map((b) => b.seat);
  if (table === "always skip") return s.day < 3 ? { k: "vote", target: null } : null; // no Skip at the last meeting: they abstain
  if (s.roles[seat] === "poacher") return { k: "vote", target: alive.filter((x) => s.roles[x] !== "poacher")[Math.floor(r() * alive.length)] ?? null };
  if (table === "accused most") {
    const n = new Map<number, number>();
    for (const x of s.said.filter((y) => y.day === s.day)) { const m = x.text.match(/^I suspect \{seat(\d+)\}/); if (m) n.set(+m[1], (n.get(+m[1]) ?? 0) + 1); }
    const top = [...n].filter(([t]) => alive.includes(t)).sort((a, b) => b[1] - a[1])[0];
    return { k: "vote", target: top ? top[0] : null };
  }
  // buoy evidence: whoever passed today's buoys most often (the poacher roams to fish)
  const seen = new Map<number, number>();
  for (const u of s.buoys.filter((b) => b.day === s.day)) for (const p of u.passed) seen.set(p, (seen.get(p) ?? 0) + 1);
  const top = [...seen].filter(([t]) => alive.includes(t)).sort((a, b) => b[1] - a[1])[0];
  return { k: "vote", target: top ? top[0] : null };
}
function poachSay(s: PoachSim, seat: number, r: () => number): PoachInput | null {
  // each fisher accuses someone it saw near fry losses: here, at random among the living (a weak signal)
  if (s.phase !== "meeting" || s.out[seat] || s.phaseT < 2 || s.said.some((x) => x.day === s.day && x.seat === seat) || r() > 0.2) return null;
  const alive = s.boats.filter((b) => !s.out[b.seat] && b.seat !== seat).map((b) => b.seat);
  const t = alive[Math.floor(r() * alive.length)];
  return t === undefined ? null : { k: "say", p: "suspect", target: t };
}

// ---- running matches ----
const seatsOf = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i} (bot)`, bot: `bot${i}`, character: "mei" }));

// which strategies sit in a match, and where: a seeded shuffle, so every
// strategy meets every other equally often and sits in every seat
export function lineup(nStrats: number, seed: number, n: number): number[] {
  const order = Array.from({ length: nStrats }, (_, i) => i);
  let x = (seed * 2654435761) >>> 0;
  const r = () => { x = (x ^ (x << 13)) >>> 0; x = (x ^ (x >>> 17)) >>> 0; x = (x ^ (x << 5)) >>> 0; return x / 4294967296; };
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order.slice(0, n);
}
function playRotating(mode: any, strats: Strat[], seed: number, n: number): { winners: string[]; sat: string[] } {
  const seatStrat = lineup(strats.length, seed, n).map((i) => strats[i]);
  const seats = seatsOf(n), secret = `balance-${mode.id}-${seed}`;
  const s = mode.make(secret, seats, { fish: 220 });
  for (let tick = 0; !mode.over(s) && tick < 20000; tick++) {
    const applied: any[] = [];
    for (const st of seats) {
      const r = botStream(secret, st.bot!, tick, st.seat);
      const ins = seatStrat[st.seat].shape(s, st.seat, mode.bot(s, st.seat, r), r);
      for (const i of ins) if (mode.input(s, st.seat, i)) applied.push({ seat: st.seat, i: mode.input(s, st.seat, i) });
    }
    mode.step(s, applied);
  }
  const res = mode.results(s);
  return { winners: res.seats.filter((x: any) => x.place === 1).map((x: any) => seatStrat[x.seat].name), sat: seatStrat.map((x) => x.name) };
}

function playPoach(table: Table, seed: number): boolean {
  const n = 5, seats = seatsOf(n), secret = `balance-poach-${table}-${seed}`;
  const s = poach.make(secret, seats, { fish: 220 });
  for (let tick = 0; !poach.over(s) && tick < 40000; tick++) {
    const applied: { seat: number; i: PoachInput }[] = [];
    for (const st of seats) {
      const r = botStream(secret, st.bot!, tick, st.seat);
      const own = poach.bot(s, st.seat, r).filter((i) => i.k !== "vote" && i.k !== "say");
      // fishers drop a buoy early each day where they are, so the evidence exists
      if (s.phase === "day" && s.phaseT > 5 && s.phaseT < 6 && s.roles[st.seat] !== "poacher") own.push({ k: "buoy" });
      const v = poachVote(s, st.seat, table, r), w = poachSay(s, st.seat, r);
      for (const i of [...own, ...(w ? [w] : []), ...(v ? [v] : [])]) { const ok = poach.input(s, st.seat, i); if (ok) applied.push({ seat: st.seat, i: ok }); }
    }
    poach.step(s, applied);
  }
  return s.winner === "fishers";
}

// ---- workers ----
type Job = { mode: string; seed: number; table?: Table };
if (!isMainThread) {
  const out: unknown[] = [];
  for (const j of workerData as Job[]) {
    if (j.mode === "rush") out.push(playRotating(rush, RUSH_STRATS, j.seed, 4));
    if (j.mode === "party") out.push(playRotating(party, PARTY_STRATS, j.seed, 4));
    if (j.mode === "hold") out.push(playRotating(hold, HOLD_STRATS, j.seed, 4));
    if (j.mode === "poach") out.push({ table: j.table, fishers: playPoach(j.table!, j.seed) });
  }
  parentPort!.postMessage(out);
} else {
  const only = process.argv[2], N = Number(process.argv[3] ?? 300);
  const modes = only ? [only] : ["rush", "party", "hold", "poach"];
  const jobs: Job[] = [];
  for (const m of modes) for (let seed = 1; seed <= N; seed++) {
    if (m === "poach") for (const table of TABLES) jobs.push({ mode: m, seed, table });
    else jobs.push({ mode: m, seed });
  }
  const W = Math.max(1, availableParallelism() - 1), chunks: Job[][] = Array.from({ length: W }, () => []);
  jobs.forEach((j, i) => chunks[i % W].push(j));
  const t0 = performance.now();
  const perChunk = await Promise.all(chunks.map((c) => new Promise<unknown[]>((res, rej) => { const w = new Worker(new URL(import.meta.url), { workerData: c }); w.on("message", res); w.on("error", rej); })));
  // each worker answers in its own job order
  const flat = chunks.flatMap((c, ci) => c.map((job, j) => ({ job, r: perChunk[ci][j] })));
  const wilson = (x: number, n: number): [number, number] => { const z = 1.96, p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const sections: Record<string, string> = {};
  for (const m of modes) {
    const rows = flat.filter((x: any) => x.job.mode === m) as { job: Job; r: any }[];
    if (m === "poach") {
      const lines = TABLES.map((t) => { const rs = rows.filter((x) => x.job.table === t); const w = rs.filter((x) => x.r.fishers).length, [lo, hi] = wilson(w, rs.length); return `| ${t} | ${rs.length} | ${w} | ${pct(w / rs.length)} | ${pct(lo)}–${pct(hi)} |`; });
      sections[m] = `## Who's Poaching (5 bots, 1 poacher; fishers' win rate by how the table votes)\n\n| Table behaviour | Matches | Fishers won | Rate | 95% interval |\n|---|---|---|---|---|\n${lines.join("\n")}\n`;
      continue;
    }
    const strats = (m === "rush" ? RUSH_STRATS : m === "party" ? PARTY_STRATS : HOLD_STRATS).map((x) => x.name);
    const lines = strats.map((name) => {
      const played = rows.filter((x) => x.r.sat.includes(name));
      const won = played.filter((x) => x.r.winners.includes(name)).length, [lo, hi] = wilson(won, played.length);
      return { name, n: played.length, won, rate: won / played.length, line: `| ${name} | ${played.length} | ${won} | ${pct(won / played.length)} | ${pct(lo)}–${pct(hi)} |` };
    });
    const over = lines.filter((l) => l.rate > 0.4).map((l) => l.name);
    sections[m] = `## ${m === "rush" ? "Boat Rush" : m === "party" ? "Fishing Party" : "Lake Holdings"} (4 bots per match; ${strats.length} strategies drawn by a seeded shuffle each match)\n\n| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |\n|---|---|---|---|---|\n${lines.map((l) => l.line).join("\n")}\n\n${over.length ? `Over the 40% target: ${over.join(", ")}.` : "No strategy over the 40% target."}\n`;
  }
  const file = "docs/checks/balance-2026-10-15.md";
  const old = existsSync(file) ? readFileSync(file, "utf8") : "";
  const head = `# Balance, 2026-10-15 (bots only)\n\nWritten by \`node scripts/balance.ts\`. Every match here is bots against bots, with the strategies in scripts/balance.ts, on the seeds \`balance-<mode>-1\` to \`-${N}\`. These are claims about these bots, strategies and seeds, not about how people play. A fair share in a four-seat match is 25%; the target is that no strategy wins more than 40%. 95% intervals are Wilson intervals.\n\n`;
  // the file is: the head, then one section per mode in a fixed order (kept from the old
  // file for modes not run now), then "Changes" (the notes on which numbers moved, kept)
  const TITLES: Record<string, string> = { rush: "## Boat Rush", party: "## Fishing Party", hold: "## Lake Holdings", poach: "## Who's Poaching" };
  const oldParts = old.split(/^(?=## )/m).filter((x) => x.startsWith("## "));
  const part = (m: string) => sections[m] ?? oldParts.find((x) => x.startsWith(TITLES[m])) ?? "";
  const notes = oldParts.filter((x) => x.startsWith("## Before") || x.startsWith("## Changes")).map((x) => x.trimEnd() + "\n");
  writeFileSync(file, head + ["rush", "party", "hold", "poach"].map(part).filter(Boolean).map((x) => x.trimEnd() + "\n").join("\n") + (notes.length ? "\n" + notes.join("\n") : ""));
  for (const m of modes) console.log(sections[m]);
  console.log(`(${jobs.length} matches in ${Math.round((performance.now() - t0) / 1000)} s on ${W} workers)`);
}
