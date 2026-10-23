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
import { health, poach, type PoachInput } from "../src/lib/modes/poach.ts";
import { tierOf, type TierId } from "../src/lib/lake-world.ts";
import { DEFAULT_BOT_KINDS, makeWithOpts as rushMakeWithOpts, rush, type RushInput } from "../src/lib/modes/rush.ts";

type Strat = { name: string; shape: (s: any, seat: number, ins: any[], r: () => number) => any[] };

// ---- Boat Rush 2.0: no bot logic lives in this script. Every seat plays the
// server's own bot (src/lib/modes/rush.ts's bot()), one of three kinds
// (steady, keeper, greedy). A real room always draws seat % 3
// (DEFAULT_BOT_KINDS, rush.ts) — makeWithOpts's botKinds override is reached
// only from here, to run whole tables of one kind, which prompt-17 step 5's
// targets (a) and (b) need: seat % 3 alone never gives an all-greedy table.
type RushTable = "all-greedy" | "all-keeper" | "all-steady" | "random mix";
const RUSH_TABLES: RushTable[] = ["all-greedy", "all-keeper", "all-steady", "random mix"];
// a seeded shuffle of kinds for "random mix", so every match's mix is
// reproducible from its seed alone (no Math.random, CLAUDE.md "The ledger")
function mixKinds(seed: number, n: number): string[] {
  let x = (seed * 2654435761) >>> 0;
  const r = () => { x = (x ^ (x << 13)) >>> 0; x = (x ^ (x >>> 17)) >>> 0; x = (x ^ (x << 5)) >>> 0; return x / 4294967296; };
  return Array.from({ length: n }, () => DEFAULT_BOT_KINDS[Math.floor(r() * DEFAULT_BOT_KINDS.length)]);
}
function kindsFor(table: RushTable, seed: number, n: number): string[] {
  if (table === "all-greedy") return Array(n).fill("greedy");
  if (table === "all-keeper") return Array(n).fill("keeper");
  if (table === "all-steady") return Array(n).fill("steady");
  return mixKinds(seed, n);
}

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

// ---- Who's Poaching 2.0: six bots (poach.ts's own bot(): tasks, inspecting,
// buoys, reports, the poacher's fine net, the meeting's lines and votes). Two
// tables: the bots as written, and the same bots except that fishers skip
// every vote they may skip (the last meeting has no skip). ----
type Table = "bots as written" | "fishers always skip";
const TABLES: Table[] = ["bots as written", "fishers always skip"];
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

// plays mode.bot() unmodified against a harness-chosen table of bot kinds
// (makeWithOpts's script-only override); reports per-seat (not per-match),
// since a table is not always an even split of kinds
function playRush(table: RushTable, seed: number, n: number): { seats: { kind: string; place: number }[]; tier: TierId; altTier: TierId } {
  const seats = seatsOf(n), secret = `balance-rush-${table}-${seed}`;
  const botKinds = kindsFor(table, seed, n);
  const s = rushMakeWithOpts(secret, seats, { fish: 220 }, { botKinds });
  for (let tick = 0; !rush.over(s) && tick < 20000; tick++) {
    const applied: { seat: number; i: RushInput }[] = [];
    for (const st of seats) {
      const r = botStream(secret, st.bot!, tick, st.seat);
      for (const raw of rush.bot(s, st.seat, r)) { const ok = rush.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok }); }
    }
    rush.step(s, applied);
  }
  const res = rush.results(s);
  const counterfactual = res.counterfactual as { alt: number; tierId: TierId };
  return { seats: res.seats.map((x) => ({ kind: botKinds[x.seat], place: x.place })), tier: tierOf(res.lakeLeft).id, altTier: counterfactual.tierId };
}

function playPoach(table: Table, seed: number): { fishers: boolean; health: number; day: number; caughtDay: number | null } {
  const n = 6, seats = seatsOf(n), secret = `balance-poach-${table}-${seed}`;
  const s = poach.make(secret, seats, { fish: 280, adults: 224, young: 56 });
  for (let tick = 0; !poach.over(s) && tick < 60000; tick++) {
    const applied: { seat: number; i: PoachInput }[] = [];
    for (const st of seats) {
      for (let raw of poach.bot(s, st.seat, botStream(secret, st.bot!, tick, st.seat))) {
        if (table === "fishers always skip" && raw.k === "vote" && s.roles[st.seat] === "fisher" && !s.meeting?.final) raw = { k: "vote", target: null };
        const ok = poach.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok });
      }
    }
    poach.step(s, applied);
  }
  const caught = s.exiled.find((x) => x.role === "poacher");
  return { fishers: s.winner === "fishers", health: health(s), day: s.day, caughtDay: caught ? caught.day : null };
}

// ---- workers ----
type Job = { mode: string; seed: number; table?: Table; rushTable?: RushTable };
if (!isMainThread) {
  const out: unknown[] = [];
  for (const j of workerData as Job[]) {
    if (j.mode === "rush") out.push(playRush(j.rushTable!, j.seed, 4));
    if (j.mode === "party") out.push(playRotating(party, PARTY_STRATS, j.seed, 4));
    if (j.mode === "hold") out.push(playRotating(hold, HOLD_STRATS, j.seed, 4));
    if (j.mode === "poach") out.push({ table: j.table, ...playPoach(j.table!, j.seed) });
  }
  parentPort!.postMessage(out);
} else {
  const only = process.argv[2], N = Number(process.argv[3] ?? 300);
  const modes = only ? [only] : ["rush", "party", "hold", "poach"];
  const jobs: Job[] = [];
  for (const m of modes) for (let seed = 1; seed <= N; seed++) {
    if (m === "poach") for (const table of TABLES) jobs.push({ mode: m, seed, table });
    else if (m === "rush") for (const rushTable of RUSH_TABLES) jobs.push({ mode: m, seed, rushTable });
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
      const lines = TABLES.map((t) => {
        const rs = rows.filter((x) => x.job.table === t); const w = rs.filter((x) => x.r.fishers).length, [lo, hi] = wilson(w, rs.length);
        const day = (d: number) => rs.filter((x) => x.r.caughtDay === d).length;
        const meanH = rs.reduce((n, x) => n + x.r.health, 0) / rs.length;
        return `| ${t} | ${rs.length} | ${w} | ${pct(w / rs.length)} | ${pct(lo)}–${pct(hi)} | ${day(1)} / ${day(2)} / ${day(3)} | ${meanH.toFixed(1)}% |`;
      });
      sections[m] = `## Who's Poaching 2.0 (6 bots, 1 poacher; poach.ts's own bots)\n\n| Table | Matches | Fishers won | Rate | 95% interval | Poacher voted out on day 1 / 2 / 3 | Mean lake health at the end |\n|---|---|---|---|---|---|---|\n${lines.join("\n")}\n`;
      continue;
    }
    if (m === "rush") {
      const byTable = (t: RushTable) => rows.filter((x) => x.job.rushTable === t) as { job: Job; r: { seats: { kind: string; place: number }[]; tier: TierId; altTier: TierId } }[];
      const TIERS_ORDER: TierId[] = ["rich", "fair", "lean", "none"];
      const tierRow = (rs: ReturnType<typeof byTable>): string[] => {
        const n = rs.length;
        return TIERS_ORDER.map((t) => pct(rs.filter((x) => x.r.tier === t).length / n));
      };

      // (a) all-greedy tables end Lean or No fish in most matches
      const greedy = byTable("all-greedy");
      const greedyLeanOrNone = greedy.filter((x) => x.r.tier === "lean" || x.r.tier === "none").length;
      const [aLo, aHi] = wilson(greedyLeanOrNone, greedy.length);

      // (b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most
      const greedyAltFairPlus = greedy.filter((x) => x.r.altTier === "fair" || x.r.altTier === "rich").length;
      const [bLo, bHi] = wilson(greedyAltFairPlus, greedy.length);

      // (c) no bot kind wins more than 41% of the random-mix matches
      const mix = byTable("random mix");
      const mixBySeat = mix.flatMap((x) => x.r.seats);
      const kinds = ["steady", "keeper", "greedy"];
      const cLines = kinds.map((kind) => {
        const played = mixBySeat.filter((x) => x.kind === kind);
        const won = played.filter((x) => x.place === 1).length, [lo, hi] = wilson(won, played.length);
        return { name: kind, n: played.length, won, rate: played.length ? won / played.length : 0, line: `| ${kind} | ${played.length} | ${won} | ${played.length ? pct(won / played.length) : "n/a"} | ${played.length ? `${pct(lo)}–${pct(hi)}` : "n/a"} |` };
      });
      const cOver = cLines.filter((l) => l.rate > 0.41).map((l) => l.name);

      const tierLines = RUSH_TABLES.map((t) => `| ${t} | ${tierRow(byTable(t)).join(" | ")} |`);

      sections[m] = `## Boat Rush (prompt-17 step 5; 4 bots per match, src/lib/modes/rush.ts's own bot(), on ${greedy.length} matches per table type)\n\n` +
        `**(a) all-greedy tables end Lean or No fish in most matches:** ${greedyLeanOrNone} / ${greedy.length} (${pct(greedyLeanOrNone / greedy.length)}, 95% interval ${pct(aLo)}–${pct(aHi)}).\n\n` +
        `**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** ${greedyAltFairPlus} / ${greedy.length} (${pct(greedyAltFairPlus / greedy.length)}, 95% interval ${pct(bLo)}–${pct(bHi)}).\n\n` +
        `**(c) no bot kind wins more than 41% of the random-mix matches:**\n\n| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |\n|---|---|---|---|---|\n${cLines.map((l) => l.line).join("\n")}\n\n${cOver.length ? `Over the 41% target: ${cOver.join(", ")}.` : "No kind over the 41% target."}\n\n` +
        `**Tier distribution, by table type:**\n\n| Table | rich | fair | lean | none |\n|---|---|---|---|---|\n${tierLines.join("\n")}\n`;
      continue;
    }
    const strats = (m === "party" ? PARTY_STRATS : HOLD_STRATS).map((x) => x.name);
    const lines = strats.map((name) => {
      const played = rows.filter((x) => x.r.sat.includes(name));
      const won = played.filter((x) => x.r.winners.includes(name)).length, [lo, hi] = wilson(won, played.length);
      return { name, n: played.length, won, rate: won / played.length, line: `| ${name} | ${played.length} | ${won} | ${pct(won / played.length)} | ${pct(lo)}–${pct(hi)} |` };
    });
    const over = lines.filter((l) => l.rate > 0.4).map((l) => l.name);
    sections[m] = `## ${m === "party" ? "Fishing Party" : "Lake Holdings"} (4 bots per match; ${strats.length} strategies drawn by a seeded shuffle each match)\n\n| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |\n|---|---|---|---|---|\n${lines.map((l) => l.line).join("\n")}\n\n${over.length ? `Over the 40% target: ${over.join(", ")}.` : "No strategy over the 40% target."}\n`;
  }
  // the 2026-10-15 file is rush 1.0's history; rush 2.0's report is a new
  // file and never touches it. party/hold/poach keep writing there.
  const file = "docs/checks/balance-2026-10-15.md";
  const old = existsSync(file) ? readFileSync(file, "utf8") : "";
  const head = `# Balance, 2026-10-15 (bots only)\n\nWritten by \`node scripts/balance.ts\`. Every match here is bots against bots, with the strategies in scripts/balance.ts, on the seeds \`balance-<mode>-1\` to \`-${N}\`. These are claims about these bots, strategies and seeds, not about how people play. A fair share in a four-seat match is 25%; the target is that no strategy wins more than 40%. 95% intervals are Wilson intervals.\n\n`;
  const TITLES: Record<string, string> = { rush: "## Boat Rush", party: "## Fishing Party", hold: "## Lake Holdings", poach: "## Who's Poaching" };
  const oldParts = old.split(/^(?=## )/m).filter((x) => x.startsWith("## "));
  const part = (m: string) => sections[m] ?? oldParts.find((x) => x.startsWith(TITLES[m])) ?? "";
  const notes = oldParts.filter((x) => x.startsWith("## Before") || x.startsWith("## Changes")).map((x) => x.trimEnd() + "\n");
  // poach 2.0 writes its own file below; the 2026-10-15 file keeps poach 1.0's table as history
  writeFileSync(file, head + ["rush", "party", "hold", "poach"].map((m) => (m === "rush" || m === "poach" ? oldParts.find((x) => x.startsWith(TITLES[m])) ?? "" : part(m))).filter(Boolean).map((x) => x.trimEnd() + "\n").join("\n") + (notes.length ? "\n" + notes.join("\n") : ""));
  if (sections.rush) {
    const rfile = "docs/checks/balance-rush2-2026-10-23.md";
    const rhead = `# Balance, Boat Rush 2.0, 2026-10-23 (bots only)\n\nWritten by \`node scripts/balance.ts rush\`. Every match here is bots against bots, 4 seats, src/lib/modes/rush.ts's own bot() in one of three kinds (steady, keeper, greedy). A real room always draws seat % 3; this harness also runs whole tables of one kind (all-greedy, all-keeper, all-steady) and a seeded random mix, on the seeds \`balance-rush-<table>-1\` to \`-${N}\`, through makeWithOpts's script-only override (src/lib/modes/rush.ts), to measure prompt-17 step 5's three targets, which seat % 3 alone cannot (there is never an all-greedy table that way). These are claims about these bots and seeds, not about how people play. 95% intervals are Wilson intervals.\n\n`;
    writeFileSync(rfile, rhead + sections.rush.trimEnd() + "\n");
  }
  if (sections.poach) {
    const pfile = "docs/checks/balance-poach2-2026-10-23.md";
    const phead = `# Balance, Who's Poaching 2.0, 2026-10-23 (bots only)\n\nWritten by \`node scripts/balance.ts poach\`. Every match here is six bots (src/lib/modes/poach.ts's own bot()) on a fresh room's lake, on the seeds \`balance-poach-<table>-1\` to \`-${N}\`. These are claims about these bots and seeds, not about how people play: the bots read evidence more carefully, and lie less well, than a table of people. 95% intervals are Wilson intervals.\n\n`;
    writeFileSync(pfile, phead + sections.poach.trimEnd() + "\n");
  }
  for (const m of modes) console.log(sections[m]);
  console.log(`(${jobs.length} matches in ${Math.round((performance.now() - t0) / 1000)} s on ${W} workers)`);
}
