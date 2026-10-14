// Who's Poaching, "poach 1.0" (DESIGN.md "Who's Poaching"). Fishers, one
// poacher (two at 7 seats), a warden at 6. Three days of fishing for the
// village quota, each ending with the fry lost in each bay, and a meeting of
// set phrases and a vote after the first two. Roles are secret: frameFor
// sends a seat only its own role, and inspection results only to the
// inspector, until a role is revealed by exile or by the end.
//
// Pure and deterministic: the lake and the roles draw only from the match's
// "lake" and "roles" streams.
import { BAYS, POACH as Q } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";

export type Role = "fisher" | "poacher" | "warden";
export type Bay = (typeof BAYS)[number];
type Phrase = { p: "was"; bay: Bay } | { p: "inspected"; target: number; fry: number } | { p: "suspect"; target: number } | { p: "vouch"; target: number } | { p: "skip" };
export type PoachInput =
  | { k: "steer"; x: number; y: number }
  | { k: "cast" } | { k: "fine" } | { k: "dump" } | { k: "buoy" }
  | { k: "inspect"; target: number } | { k: "plant"; target: number } | { k: "patrol"; target: number }
  | ({ k: "say" } & Phrase)
  | { k: "vote"; target: number | null };

interface Fish { x: number; y: number; h: number; adult: boolean }
interface Boat {
  seat: number; x: number; y: number; h: number; tx: number; ty: number; vx: number; vy: number;
  fish: number; fry: number; castCd: number; fineCd: number;
  inspect: { target: number; t: number } | null; plant: { target: number; t: number } | null;
  patrolled: boolean; caught: number; fineCasts: number; inspections: number; firstScoreAt: number | null;
  mind: { spot: [number, number] | null; spotT: number; said: boolean; voted: boolean };
}
export interface PoachSim {
  tick: number; t: number; phaseT: number; day: number; phase: "day" | "dusk" | "meeting" | "end";
  rng: () => number; n: number; roles: Role[]; out: boolean[]; boats: Boat[]; fish: Fish[];
  fryStart: number; fryDead: number; health: number; quota: number; exiledInnocents: number;
  bayLoss: Record<Bay, number>; buoys: { seat: number; day: number; x: number; y: number; passed: number[] }[];
  said: { seat: number; text: string; day: number }[]; votes: (number | null | undefined)[];
  history: { day: number; exiled: number | null; role: Role | null }[]; winner: "fishers" | "poacher" | null;
}

export function bayOf(x: number, y: number): Bay {
  const a = Math.atan2((y - Q.H / 2) / Q.RY, (x - Q.W / 2) / Q.RX);
  if (a > -Math.PI / 4 && a <= Math.PI / 4) return "East Bay";
  if (a > Math.PI / 4 && a <= (3 * Math.PI) / 4) return "South Bay";
  if (a > -(3 * Math.PI) / 4 && a <= -Math.PI / 4) return "North Bay";
  return "West Bay";
}
const ell = (x: number, y: number): number => Math.hypot((x - Q.W / 2) / Q.RX, (y - Q.H / 2) / Q.RY);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const alive = (s: PoachSim, seat: number): boolean => seat >= 0 && seat < s.n && !s.out[seat];
const isPoacher = (s: PoachSim, seat: number): boolean => s.roles[seat] === "poacher";

function make(seed: string, seats: Seat[], lake: { fish: number }): PoachSim {
  const n = seats.length, rng = streamOf(seed, "lake"), rr = streamOf(seed, "roles");
  const roles: Role[] = seats.map(() => "fisher");
  const order = seats.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const poachers = n >= Q.POACHERS_AT ? 2 : 1;
  for (let k = 0; k < poachers; k++) roles[order[k]] = "poacher";
  if (n >= Q.WARDEN_AT) roles[order[poachers]] = "warden";
  // the room's lake sets how many fish there are; fry are the lake's future
  const scale = Math.max(0.3, lake.fish / 220);
  const fish: Fish[] = [];
  const place = (adult: boolean): Fish => { let x, y; do { x = Q.W / 2 + (rng() * 2 - 1) * Q.RX; y = Q.H / 2 + (rng() * 2 - 1) * Q.RY; } while (ell(x, y) > 0.86); return { x, y, h: rng() * 6.28, adult }; };
  for (let i = 0; i < Math.round(Q.FISH * scale); i++) fish.push(place(true));
  for (let i = 0; i < Math.round(Q.FRY * scale); i++) fish.push(place(false));
  const boats: Boat[] = seats.map((_, seat) => {
    const a = (seat / n) * Math.PI * 2, x = Q.W / 2 + Math.cos(a) * Q.RX * 0.7, y = Q.H / 2 + Math.sin(a) * Q.RY * 0.7;
    return { seat, x, y, h: a + Math.PI, tx: x, ty: y, vx: 0, vy: 0, fish: 0, fry: 0, castCd: 0, fineCd: 0, inspect: null, plant: null, patrolled: false, caught: 0, fineCasts: 0, inspections: 0, firstScoreAt: null, mind: { spot: null, spotT: 0, said: false, voted: false } };
  });
  const fryStart = fish.filter((f) => !f.adult).length;
  return {
    tick: 0, t: 0, phaseT: 0, day: 1, phase: "day", rng, n, roles, out: seats.map(() => false), boats, fish,
    fryStart, fryDead: 0, health: 100, quota: 0, exiledInnocents: 0,
    bayLoss: { "North Bay": 0, "East Bay": 0, "South Bay": 0, "West Bay": 0 }, buoys: [], said: [], votes: seats.map(() => undefined), history: [], winner: null,
  };
}

const seatOk = (s: PoachSim, t: unknown): t is number => Number.isInteger(t) && (t as number) >= 0 && (t as number) < s.n;
function input(s: PoachSim, seat: number, raw: unknown): PoachInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || s.out[seat] || s.phase === "end") return null;
  const day = s.phase === "day", meet = s.phase === "meeting";
  switch (o.k) {
    case "steer": { const x = Number(o.x), y = Number(o.y); return day && Number.isFinite(x) && Number.isFinite(y) ? { k: "steer", x: Math.round(Math.max(0, Math.min(Q.W, x))), y: Math.round(Math.max(0, Math.min(Q.H, y))) } : null; }
    case "cast": case "buoy": return day ? { k: o.k } : null;
    case "fine": case "dump": return day && isPoacher(s, seat) ? { k: o.k } : null;
    case "inspect": return day && seatOk(s, o.target) && o.target !== seat ? { k: "inspect", target: o.target } : null;
    case "plant": return day && isPoacher(s, seat) && seatOk(s, o.target) && o.target !== seat ? { k: "plant", target: o.target } : null;
    case "patrol": return day && s.roles[seat] === "warden" && seatOk(s, o.target) && o.target !== seat ? { k: "patrol", target: o.target } : null;
    case "vote": return meet && ((o.target === null && s.day < Q.DAYS) || (seatOk(s, o.target) && alive(s, o.target))) ? { k: "vote", target: o.target as number | null } : null;
    case "say": {
      if (!meet) return null;
      if (o.p === "was" && (BAYS as readonly string[]).includes(o.bay as string)) return { k: "say", p: "was", bay: o.bay as Bay };
      if (o.p === "inspected" && seatOk(s, o.target) && Number.isInteger(o.fry) && (o.fry as number) >= 0 && (o.fry as number) <= 20) return { k: "say", p: "inspected", target: o.target, fry: o.fry as number };
      if ((o.p === "suspect" || o.p === "vouch") && seatOk(s, o.target)) return { k: "say", p: o.p, target: o.target };
      if (o.p === "skip") return { k: "say", p: "skip" };
      return null;
    }
  }
  return null;
}

function killFry(s: PoachSim, f: Fish): void { s.fryDead++; s.bayLoss[bayOf(f.x, f.y)]++; s.health = Math.round(Math.max(0, s.health - 100 / Math.max(1, s.fryStart)) * 10) / 10; }

function apply(s: PoachSim, seat: number, i: PoachInput, ev: GameEvent[]): void {
  const b = s.boats[seat];
  if (s.out[seat]) return;
  if (i.k === "steer") { b.tx = i.x; b.ty = i.y; }
  if (i.k === "cast" && b.castCd <= 0) {
    b.castCd = Q.CAST_CD;
    const x = b.x + Math.cos(b.h) * Q.NET_AHEAD, y = b.y + Math.sin(b.h) * Q.NET_AHEAD;
    let n = 0;
    s.fish = s.fish.filter((f) => { if (f.adult && Math.hypot(f.x - x, f.y - y) < Q.NET_R) { n++; return false; } return true; });
    b.fish += n; b.caught += n; s.quota += n; if (n) b.firstScoreAt ??= s.t;
    ev.push({ k: "catch", seat, n, x, y });
  }
  if (i.k === "fine" && b.fineCd <= 0) {
    b.fineCd = Q.FINE_CD; b.fineCasts++;
    const x = b.x + Math.cos(b.h) * Q.NET_AHEAD, y = b.y + Math.sin(b.h) * Q.NET_AHEAD;
    let n = 0, fry = 0;
    s.fish = s.fish.filter((f) => {
      if (Math.hypot(f.x - x, f.y - y) >= Q.FINE_R) return true;
      if (f.adult) n++; else { fry++; killFry(s, f); }
      return false;
    });
    b.fish += n; b.fry += fry; b.caught += n; s.quota += n; if (n) b.firstScoreAt ??= s.t;
    // the catch looks like any other to everyone else; only the poacher hears about the fry
    ev.push({ k: "catch", seat, n, x, y });
    if (fry) ev.push({ k: "fry", seat, fry, to: [seat] });
  }
  if (i.k === "dump" && b.fry > 0) { ev.push({ k: "dumped", seat, fry: b.fry, to: [seat] }); b.fry = 0; }
  if (i.k === "buoy" && !s.buoys.some((u) => u.seat === seat && u.day === s.day)) {
    s.buoys.push({ seat, day: s.day, x: Math.round(b.x), y: Math.round(b.y), passed: [] });
    ev.push({ k: "buoy", seat, x: Math.round(b.x), y: Math.round(b.y) });
  }
  if (i.k === "inspect") { if (b.inspect?.target !== i.target) b.inspect = { target: i.target, t: 0 }; b.inspect.t += Q.DT; }
  if (i.k === "plant") { if (b.plant?.target !== i.target) b.plant = { target: i.target, t: 0 }; b.plant.t += Q.DT; }
  if (i.k === "patrol" && !b.patrolled && alive(s, i.target)) {
    b.patrolled = true; b.inspections++;
    ev.push({ k: "inspected", by: seat, target: i.target, fish: s.boats[i.target].fish, fry: s.boats[i.target].fry, patrol: true, to: [seat] });
  }
  if (i.k === "say") {
    const name = (t: number) => `{seat${t}}`;
    const text = i.p === "was" ? `I was in ${i.bay}.` : i.p === "inspected" ? `I inspected ${name(i.target)}: ${i.fry ? `${i.fry} fry` : "clean"}.` : i.p === "suspect" ? `I suspect ${name(i.target)}.` : i.p === "vouch" ? `I vouch for ${name(i.target)}.` : "Skip.";
    s.said.push({ seat, text, day: s.day });
    ev.push({ k: "said", seat, text });
  }
  if (i.k === "vote" && s.votes[seat] === undefined) { s.votes[seat] = i.target; ev.push({ k: "voted", seat }); }
}

// held actions: an inspection or a plant counts only while the boat stays close and keeps at it
function heldActions(s: PoachSim, held: Set<number>, ev: GameEvent[]): void {
  for (const b of s.boats) {
    if (b.inspect) {
      const t = s.boats[b.inspect.target];
      if (!held.has(b.seat * 100 + 1) || !alive(s, t.seat) || dist(b, t) > Q.INSPECT_R) b.inspect = null;
      else if (b.inspect.t >= Q.INSPECT_S - 1e-9) {
        b.inspections++;
        ev.push({ k: "inspected", by: b.seat, target: t.seat, fish: t.fish, fry: t.fry, to: [b.seat] });
        ev.push({ k: "looked", to: [t.seat] });
        b.inspect = null;
      }
    }
    if (b.plant) {
      const t = s.boats[b.plant.target];
      if (!held.has(b.seat * 100 + 2) || !alive(s, t.seat) || dist(b, t) > Q.PLANT_R || b.fry === 0) b.plant = null;
      else if (b.plant.t >= Q.PLANT_S - 1e-9) {
        t.fry += b.fry; b.fry = 0; b.plant = null;
        const see = s.boats.filter((o) => o.seat !== b.seat && alive(s, o.seat) && dist(o, b) <= Q.SPLASH_R).map((o) => o.seat);
        if (see.length) ev.push({ k: "splash", x: Math.round(b.x), y: Math.round(b.y), near: b.seat, to: see });
      }
    }
  }
}

function moveDay(s: PoachSim): void {
  for (const b of s.boats) {
    if (s.out[b.seat]) continue;
    if (b.castCd > 0) b.castCd -= Q.DT;
    if (b.fineCd > 0) b.fineCd -= Q.DT;
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
    const want = d > 4 ? Math.min(1, d / 40) : 0, k = Math.min(1, Q.ACCEL * Q.DT);
    b.vx += ((d > 4 ? dx / d : 0) * Q.SPEED * want - b.vx) * k; b.vy += ((d > 4 ? dy / d : 0) * Q.SPEED * want - b.vy) * k;
    b.x += b.vx * Q.DT; b.y += b.vy * Q.DT;
    const e = ell(b.x, b.y); if (e > 0.95) { b.x = Q.W / 2 + (b.x - Q.W / 2) * 0.95 / e; b.y = Q.H / 2 + (b.y - Q.H / 2) * 0.95 / e; }
    if (Math.hypot(b.vx, b.vy) > 8) b.h = Math.atan2(b.vy, b.vx);
    for (const u of s.buoys) if (u.day === s.day && u.seat !== b.seat && !u.passed.includes(b.seat) && Math.hypot(b.x - u.x, b.y - u.y) < Q.BUOY_R) u.passed.push(b.seat);
  }
  for (const f of s.fish) {
    f.h += (s.rng() - 0.5) * 0.6;
    if (ell(f.x, f.y) > 0.85) f.h = Math.atan2(Q.H / 2 - f.y, Q.W / 2 - f.x) + (s.rng() - 0.5);
    const v = f.adult ? Q.V_FISH : Q.V_FRY;
    f.x += Math.cos(f.h) * v * Q.DT; f.y += Math.sin(f.h) * v * Q.DT;
  }
}

function settleVote(s: PoachSim, ev: GameEvent[]): void {
  const tally = new Map<number, number>(); let skips = 0;
  s.votes.forEach((v, seat) => { if (s.out[seat]) return; if (v === null || v === undefined) skips++; else tally.set(v, (tally.get(v) ?? 0) + 1); });
  const top = Math.max(0, ...tally.values());
  const leaders = [...tally].filter(([, n]) => n === top).map(([t]) => t);
  const last = s.day >= Q.DAYS;
  // the last meeting has no Skip: if anyone voted, the most votes go, and a tie is drawn by the server
  if (top === 0 || (!last && (leaders.length > 1 || skips >= top))) {
    s.history.push({ day: s.day, exiled: null, role: null });
    s.health = Math.round(Math.max(0, s.health - Q.NO_EXILE_COST) * 10) / 10;
    ev.push({ k: "noexile", tally: Object.fromEntries(tally), skips, cost: Q.NO_EXILE_COST, health: s.health, reason: "unwatched" }); // the page says: the poacher worked the night unwatched
    return;
  }
  const x = leaders.length > 1 ? leaders[Math.floor(s.rng() * leaders.length)] : leaders[0];
  s.out[x] = true;
  if (!isPoacher(s, x)) s.exiledInnocents++;
  s.history.push({ day: s.day, exiled: x, role: s.roles[x] });
  ev.push({ k: "exiled", seat: x, role: s.roles[x], tally: Object.fromEntries(tally), skips });
}

function checkWin(s: PoachSim, ev: GameEvent[], endOfDay3: boolean): void {
  if (s.winner) return;
  const poachersLeft = s.roles.some((r, i) => r === "poacher" && !s.out[i]);
  if (s.health < Q.HEALTH_LINE) s.winner = "poacher";
  else if (s.exiledInnocents >= 2) s.winner = "poacher";
  else if (!poachersLeft) s.winner = "fishers";
  else if (endOfDay3) s.winner = "poacher";
  if (s.winner) { s.phase = "end"; ev.push({ k: "end", winner: s.winner, roles: s.roles }); }
}

function step(s: PoachSim, inputs: { seat: number; i: PoachInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === "end") return ev;
  const held = new Set<number>();
  for (const { seat, i } of inputs) {
    if (i.k === "inspect") held.add(seat * 100 + 1);
    if (i.k === "plant") held.add(seat * 100 + 2);
    apply(s, seat, i, ev);
  }
  s.tick++; s.t = Math.round(s.tick * Q.DT * 1000) / 1000; s.phaseT += Q.DT;
  if (s.phase === "day") {
    heldActions(s, held, ev);
    moveDay(s);
    checkWin(s, ev, false);
    if (s.phase === "day" && s.phaseT >= Q.DAY_S - 1e-9) {
      ev.push({ k: "dusk", day: s.day, bays: { ...s.bayLoss }, health: s.health, quota: s.quota });
      s.bayLoss = { "North Bay": 0, "East Bay": 0, "South Bay": 0, "West Bay": 0 };
      for (const b of s.boats) { b.inspect = null; b.plant = null; }
      s.phase = "dusk"; s.phaseT = 0; // every day ends in a meeting; day 3's is the last, and has no Skip
    }
  } else if (s.phase === "dusk") {
    if (s.phaseT >= Q.DUSK_S - 1e-9) { s.phase = "meeting"; s.phaseT = 0; s.votes = s.boats.map(() => undefined); for (const b of s.boats) { b.mind.said = false; b.mind.voted = false; } ev.push({ k: "meeting", day: s.day }); }
  } else if (s.phase === "meeting") {
    const everyone = s.boats.every((b) => s.out[b.seat] || s.votes[b.seat] !== undefined);
    if (s.phaseT >= Q.MEETING_S - 1e-9 || (everyone && s.phaseT > 3)) {
      settleVote(s, ev);
      checkWin(s, ev, s.day >= Q.DAYS);
      if (!s.winner) { s.day++; s.phase = "day"; s.phaseT = 0; for (const b of s.boats) { b.patrolled = false; b.fish = 0; } ev.push({ k: "dawn", day: s.day }); }
    }
  }
  return ev;
}

// ---- a bot (practice only): fishes, inspects now and then, votes on what it has seen ----
function bot(s: PoachSim, seat: number, r: () => number): PoachInput[] {
  const b = s.boats[seat];
  if (s.out[seat] || s.phase === "end") return [];
  if (s.phase === "meeting") {
    if (!b.mind.said && s.phaseT > 4 + seat && r() < 0.05) { b.mind.said = true; return [{ k: "say", p: "was", bay: bayOf(b.x, b.y) }]; }
    if (!b.mind.voted && s.phaseT > 15 + seat * 2 && r() < 0.05) {
      b.mind.voted = true;
      const suspects = s.boats.filter((o) => o.seat !== seat && !s.out[o.seat] && !(isPoacher(s, seat) && isPoacher(s, o.seat)));
      const pick = isPoacher(s, seat) ? suspects[Math.floor(r() * suspects.length)] : r() < 0.5 ? suspects[Math.floor(r() * suspects.length)] : null;
      return [{ k: "vote", target: pick ? pick.seat : null }];
    }
    return [];
  }
  if (s.phase !== "day" || r() > 0.25) return [];
  if (!b.mind.spot || s.t > b.mind.spotT) { const f = s.fish[Math.floor(r() * s.fish.length)]; b.mind.spot = f ? [f.x, f.y] : [Q.W / 2, Q.H / 2]; b.mind.spotT = s.t + 4; }
  const out: PoachInput[] = [{ k: "steer", x: Math.round(b.mind.spot[0]), y: Math.round(b.mind.spot[1]) }];
  if (isPoacher(s, seat)) { out.push({ k: r() < 0.4 ? "fine" : "cast" }); if (b.fry > 4 && r() < 0.3) out.push({ k: "dump" }); }
  else out.push({ k: "cast" });
  return out;
}

// ---- what one seat may see ----
function frameFor(s: PoachSim, seat: number) {
  const me = seat >= 0 && seat < s.n ? s.boats[seat] : null;
  const role = me ? s.roles[seat] : null;
  // a role is shown only to its owner, to a fellow poacher, or after exile;
  // at the end, the "end" event and the results reveal every role
  const roles = s.roles.map((r, i) => (s.out[i] || i === seat || (role === "poacher" && r === "poacher") ? r : null));
  return {
    t: s.t, phase: s.phase, day: s.day, days: Q.DAYS,
    left: Math.max(0, (s.phase === "day" ? Q.DAY_S : s.phase === "meeting" ? Q.MEETING_S : Q.DUSK_S) - s.phaseT),
    health: s.health, line: Q.HEALTH_LINE, quota: s.quota, quotaGoal: Q.QUOTA,
    role, partners: role === "poacher" ? s.roles.flatMap((r, i) => (r === "poacher" && i !== seat ? [i] : [])) : [],
    known: roles.map((r, i) => (r !== null && i !== seat ? { seat: i, role: r } : null)).filter(Boolean),
    out: s.out,
    // my basket is mine to see; others' baskets only by inspecting
    mine: me ? { fish: me.fish, fry: me.fry, buoyUsed: s.buoys.some((u) => u.seat === seat && u.day === s.day), patrolled: me.patrolled, inspecting: me.inspect ? { target: me.inspect.target, t: Math.round(me.inspect.t * 10) / 10 } : null, planting: me.plant ? Math.round(me.plant.t * 10) / 10 : null } : null,
    b: s.boats.map((b) => [b.seat, Math.round(b.x), Math.round(b.y), Math.round(b.h * 100), s.out[b.seat] ? 1 : 0]),
    f: s.phase === "day" ? s.fish.map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.h * 100), f.adult ? 1 : 0]) : [],
    buoys: s.buoys.filter((u) => u.day === s.day).map((u) => ({ seat: u.seat, x: u.x, y: u.y, passed: s.phase === "day" ? [] : u.passed })),
    said: s.said.filter((x) => x.day === s.day),
    voted: s.phase === "meeting" ? s.votes.map((v) => v !== undefined) : [], canSkip: s.day < Q.DAYS,
    history: s.history,
  };
}

function results(s: PoachSim): Results {
  const fishersWin = s.winner === "fishers";
  const seats = s.boats.map((b) => {
    const won = isPoacher(s, b.seat) ? !fishersWin : fishersWin;
    return { seat: b.seat, score: won ? 1 : 0, place: won ? 1 : 2, firstScoreS: b.firstScoreAt, role: s.roles[b.seat], caught: b.caught, quota: b.caught };
  });
  const p = s.boats.filter((b) => isPoacher(s, b.seat));
  const sharp = [...s.boats].sort((a, b) => b.inspections - a.inspections)[0];
  const exiled = s.history.filter((h) => h.exiled !== null);
  const highlights: Highlight[] = [
    { title: "The poacher", text: `{name} poached with ${p.reduce((n, b) => n + b.fineCasts, 0)} fine-net casts`, seat: p[0].seat },
    { title: "Sharpest eyes", text: sharp.inspections ? `{name} looked in ${sharp.inspections} baskets` : "nobody inspected a basket", seat: sharp.seat },
    { title: "Closest call", text: exiled.length ? `day ${exiled[0].day}: the village exiled a ${exiled[0].role}` : `the lake ended at ${Math.round(s.health)}% (the line is ${Q.HEALTH_LINE}%)`, seat: exiled[0]?.exiled ?? p[0].seat },
  ];
  const adults = s.fish.filter((f) => f.adult).length, fry = s.fish.length - adults;
  return { seats, lakeLeft: Math.round((adults + fry * 0.5) * 220 / (Q.FISH + Q.FRY * 0.5)), highlights, winner: s.winner, roles: s.roles, health: s.health };
}

export const poach: Mode<PoachSim, PoachInput> = {
  id: "poach", model: "poach 1.0", seats: Q.SEATS,
  make, input, step, frameFor, over: (s) => s.phase === "end", results, bot,
};
