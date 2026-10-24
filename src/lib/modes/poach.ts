// Who's Poaching, "poach 2.0" (DESIGN.md "Who's Poaching 谁在偷鱼 (2.0)").
// Four to eight boats on the v5 lake: one poacher (two at seven or more),
// the rest fishers. A role card, then three days of 70 s, each ending in a
// meeting at dusk (or earlier, on a report). By day everyone sails inside
// a lantern's circle: the server sends a seat only the boats, fish and dead
// young fish within VIEW of its own boat (or of its own buoy), never the rest
// (CLAUDE.md "a seat's frame holds no boat, fish or evidence outside its
// lantern's view"). Fishers do tasks at named places (each worth fish for
// the village), inspect boats, drop a buoy and report dead fish; the
// poacher's tasks are a cover, and its fine net takes young fish and leaves
// a patch of them floating, seen by every boat within VIEW. At the meeting
// each seat speaks only in lines built from what it actually knows (the
// poacher gets plausible lies), and everyone still in votes.
//
// Pure and deterministic: the lake draws only from the match's "lake"
// stream (lake-life.ts's schools and fish), the roles from "roles"; a bot's
// decisions come from the stream the platform gives it for that tick. step()
// never reads a bot's mind, so a replay that does not run the bots is exact.
import { POACH as Q, POACH_MODEL } from "../game-constants.ts";
import { type GameEvent, type Highlight, type Mode, type Results, type Seat, streamOf } from "../game-platform.ts";
import { BAYS, dockPos, ISLAND, LAKE_X, LAKE_Y, nextSpring, nr, type PlaceId, placeOf, tierOf, ZONES } from "../lake-world.ts";
import { counts, type Fish, moveFish, newFish, NURSERY_FIRST, type School, seedFish, updateSchools } from "./lake-life.ts";

export type Role = "fisher" | "poacher";
type Phase = "role" | "day" | "meeting" | "tally" | "exile" | "end";

// A line said at the meeting, as a code each page words in its own language.
export type Line =
  | { k: "was"; place: PlaceId }
  | { k: "insp"; i: number; res: "clean" | "fry" }
  | { k: "sawnet"; i: number }
  | { k: "saw"; i: number; place: PlaceId }
  | { k: "buoy"; place: PlaceId; ids: number[] }
  | { k: "sus"; i: number }
  | { k: "vouch"; i: number }
  | { k: "skip" };

export type PoachInput =
  | { k: "steer"; x: number; y: number }
  | { k: "net" } | { k: "inspect" } | { k: "buoy" } | { k: "report" } | { k: "fine" } | { k: "dump" }
  | { k: "say"; line: Line }
  | { k: "vote"; target: number | null }
  | { k: "ready" };

// the task spots (the prototype's TASKS): a verb and a named place
export const TASKS: { id: string; verb: string; place: PlaceId; x: number; y: number }[] = [
  { id: "t1", verb: "net", place: "north", x: -16, y: -42 },
  { id: "t2", verb: "count", place: "reeds", x: ZONES.reeds.x * 0.9, y: ZONES.reeds.y * 0.9 },
  { id: "t3", verb: "lotus", place: "lotus", x: ZONES.lotus.x * 0.9, y: ZONES.lotus.y * 0.9 },
  { id: "t4", verb: "trap", place: "east", x: 60, y: -2 },
  { id: "t5", verb: "sluice", place: "river", x: ZONES.river.x * 0.9, y: ZONES.river.y * 0.9 },
  { id: "t6", verb: "incense", place: "island", x: ISLAND.x - 2, y: ISLAND.y + 12 },
  { id: "t7", verb: "mend", place: "south", x: 2, y: 30 },
  { id: "t8", verb: "trap", place: "west", x: -62, y: 8 },
  { id: "t9", verb: "net", place: "east", x: 40, y: -30 },
];

interface Task { id: string; verb: string; place: PlaceId; x: number; y: number; p: number; done: boolean }
interface Boat {
  seat: number; x: number; y: number; h: number; speed: number; tx: number; ty: number;
  netCd: number; fineCd: number; fry: number; caught: number; taskFish: number; youngKilled: number; fineCasts: number;
  tasks: Task[]; buoy: boolean; insp: { target: number; t: number } | null;
  known: Record<number, { res: "clean" | "fry"; n: number; day: number }>; // what this seat learned by inspecting
  witnessed: Record<number, number>; // seat -> fine nets this seat saw it cast
  saw: { i: number; x: number; y: number; t: number }[]; // sightings today, every SIGHT_S
  path: [number, number][]; // where this boat was today, every SIGHT_S
  mind: { hunt: [number, number] | null; wander: [number, number] | null; inspected: Record<number, boolean>; lines: Line[] | null; sayAt: number; voteAt: number; meet: number };
}
interface Patch { id: number; x: number; y: number; t: number; day: number; by: number; seenBy: number[]; reported: boolean; dump: boolean }
interface Buoy { owner: number; x: number; y: number; place: PlaceId; day: number; log: { i: number; t: number }[]; last: Record<number, number> }
interface Said { seat: number; line: Line; at: number }
export interface PoachSim {
  tick: number; t: number; phase: Phase; phaseT: number; day: number; season: number;
  n: number; rng: () => number; roles: Role[]; out: boolean[]; bots: boolean[]; ready: boolean[];
  boats: Boat[]; fish: Fish[]; schools: School[]; nextId: number;
  start: number; roomFish: number; patches: Patch[]; buoys: Buoy[];
  meeting: { n: number; reason: "dusk" | "report"; by: number | null; patch: number | null; says: Said[]; votes: (number | null | undefined)[]; final: boolean } | null;
  tally: { votes: (number | null | undefined)[]; out: number | null } | null;
  exiled: { seat: number; role: Role; day: number }[];
  nightLoss: number[]; // the % the lake lost each night
  poacherPath: [number, number][]; poacherNets: [number, number][];
  winner: "fishers" | "poacher" | null; endReason: "caught" | "lake" | "survived" | null;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
const isIn = (s: PoachSim, seat: number): boolean => seat >= 0 && seat < s.n && !s.out[seat];
export const health = (s: PoachSim): number => Math.round(((s.fish.length) / Math.max(1, s.start)) * 1000) / 10;
const alive = (s: PoachSim): Boat[] => s.boats.filter((b) => !s.out[b.seat]);
const watchersOf = (s: PoachSim, b: Boat): Boat[] => alive(s).filter((o) => o !== b && dist(o, b) < Q.VIEW);
const dayClock = (s: PoachSim): number => Math.round(s.phaseT * 10) / 10; // seconds into the day

function shuffle<T>(rng: () => number, arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function make(seed: string, seats: Seat[], lake: { fish: number; adults?: number; young?: number }): PoachSim {
  const n = seats.length, rr = streamOf(seed, "roles");
  const roles: Role[] = seats.map(() => "fisher");
  const order = shuffle(rr, seats.map((_, i) => i));
  for (let k = 0; k < (n >= Q.POACHERS_AT ? 2 : 1); k++) roles[order[k]] = "poacher";
  const s: PoachSim = {
    tick: 0, t: 0, phase: "role", phaseT: 0, day: 0, season: 0,
    n, rng: streamOf(seed, "lake"), roles, out: seats.map(() => false), bots: seats.map((x) => x.bot !== null), ready: seats.map((x) => x.bot !== null),
    boats: [], fish: [], schools: [], nextId: 1, start: 0, roomFish: lake.fish, patches: [], buoys: [],
    meeting: null, tally: null, exiled: [], nightLoss: [], poacherPath: [], poacherNets: [], winner: null, endReason: null,
  };
  const a0 = lake.adults ?? Math.round(lake.fish * 0.8), y0 = lake.young ?? Math.round(lake.fish * 0.2);
  seedFish(s, a0, y0);
  // the reeds are full of young fish: that is what the fine net is for (DESIGN "Lake health")
  for (let i = 0; i < Q.EXTRA_YOUNG; i++) s.fish.push(newFish(s, null, null, false, NURSERY_FIRST + (i % 4)));
  s.start = s.fish.length;
  for (const seat of seats) {
    const d = dockPos(seat.seat, n), x = d.x - Math.cos(d.inward) * 2, y = d.y - Math.sin(d.inward) * 2;
    s.boats.push({
      seat: seat.seat, x, y, h: d.inward + Math.PI, speed: 0, tx: x, ty: y, netCd: 0, fineCd: 0, fry: 0, caught: 0, taskFish: 0, youngKilled: 0, fineCasts: 0,
      tasks: [], buoy: false, insp: null, known: {}, witnessed: {}, saw: [], path: [],
      mind: { hunt: null, wander: null, inspected: {}, lines: null, sayAt: 0, voteAt: 0, meet: 0 },
    });
  }
  return s;
}

// ---- inputs: validated against the phase, the role and what the seat knows ----
const PLACES: PlaceId[] = ["reeds", "lotus", "river", "island", "north", "east", "south", "west"];
const seatOk = (s: PoachSim, v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < s.n;
function lineOf(s: PoachSim, raw: unknown): Line | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  switch (o.k) {
    case "was": return PLACES.includes(o.place as PlaceId) ? { k: "was", place: o.place as PlaceId } : null;
    case "insp": return seatOk(s, o.i) && (o.res === "clean" || o.res === "fry") ? { k: "insp", i: o.i, res: o.res } : null;
    case "sawnet": return seatOk(s, o.i) ? { k: "sawnet", i: o.i } : null;
    case "saw": return seatOk(s, o.i) && PLACES.includes(o.place as PlaceId) ? { k: "saw", i: o.i, place: o.place as PlaceId } : null;
    case "buoy": return PLACES.includes(o.place as PlaceId) && Array.isArray(o.ids) && o.ids.length <= 4 && o.ids.every((i) => seatOk(s, i)) ? { k: "buoy", place: o.place as PlaceId, ids: o.ids as number[] } : null;
    case "sus": case "vouch": return seatOk(s, o.i) ? { k: o.k, i: o.i } : null;
    case "skip": return { k: "skip" };
  }
  return null;
}
const sameLine = (a: Line, b: Line): boolean => JSON.stringify(a) === JSON.stringify(b);
function input(s: PoachSim, seat: number, raw: unknown): PoachInput | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !isIn(s, seat)) return null;
  const day = s.phase === "day", meet = s.phase === "meeting", poacher = s.roles[seat] === "poacher";
  switch (o.k) {
    case "ready": return s.phase === "role" && !s.ready[seat] ? { k: "ready" } : null; // "I understand" on the role card
    case "steer": {
      const x = Number(o.x), y = Number(o.y);
      if (!day || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { k: "steer", x: Math.round(Math.max(-LAKE_X, Math.min(LAKE_X, x)) * 10) / 10, y: Math.round(Math.max(-LAKE_Y, Math.min(LAKE_Y, y)) * 10) / 10 };
    }
    case "net": case "inspect": case "buoy": case "report": return day ? { k: o.k } : null;
    case "fine": case "dump": return day && poacher ? { k: o.k } : null;
    case "say": {
      if (!meet) return null;
      const line = lineOf(s, o.line); if (!line) return null;
      // suspect, vouch and skip are open to all; anything else must be one of
      // this seat's own lines (what it knows, or for a poacher, its lies)
      if (line.k === "sus" || line.k === "vouch") return isIn(s, line.i) && line.i !== seat ? { k: "say", line } : null;
      if (line.k === "skip") return { k: "say", line };
      return linesFor(s, seat).some((l) => sameLine(l, line)) ? { k: "say", line } : null;
    }
    case "vote": {
      if (!meet || !s.meeting) return null;
      if (o.target === null) return s.meeting.final ? null : { k: "vote", target: null };
      return seatOk(s, o.target) && isIn(s, o.target) && o.target !== seat ? { k: "vote", target: o.target } : null;
    }
  }
  return null;
}

// ---- the day ----
function nearestOther(s: PoachSim, b: Boat, r: number): Boat | null {
  let best: Boat | null = null, bd = r;
  for (const o of alive(s)) { if (o === b) continue; const d = dist(o, b); if (d < bd) { bd = d; best = o; } }
  return best;
}
function unreportedNear(s: PoachSim, b: Boat): Patch | null {
  return s.patches.find((p) => p.day === s.day && !p.reported && dist(p, b) < Q.REPORT_R) ?? null;
}
function apply(s: PoachSim, seat: number, i: PoachInput, ev: GameEvent[]): void {
  const b = s.boats[seat];
  if (!b || s.out[seat]) return;
  if (i.k === "ready") { if (s.phase === "role") { s.ready[seat] = true; ev.push({ k: "ready", seat }); } return; }
  if (s.phase === "meeting") { applyMeeting(s, seat, i, ev); return; }
  if (s.phase !== "day") return;
  if (i.k === "steer") { b.tx = i.x; b.ty = i.y; return; }
  if (i.k === "net" && b.netCd <= 0) {
    b.netCd = Q.NET_CD;
    const x = b.x + Math.cos(b.h) * Q.NET_AHEAD, y = b.y + Math.sin(b.h) * Q.NET_AHEAD;
    let got = 0;
    s.fish = s.fish.filter((f) => { if (got < Q.NET_MAX && f.adult && Math.hypot(f.x - x, f.y - y) < Q.NET_R) { got++; return false; } return true; });
    b.caught += got;
    ev.push({ k: "net", seat, x: r1(x), y: r1(y), n: got, to: viewersOf(s, x, y, seat) });
    return;
  }
  if (i.k === "fine" && b.fineCd <= 0 && s.roles[seat] === "poacher") {
    b.fineCd = Q.FINE_CD; b.fineCasts++;
    const x = b.x + Math.cos(b.h) * Q.NET_AHEAD, y = b.y + Math.sin(b.h) * Q.NET_AHEAD;
    let n = 0, young = 0;
    s.fish = s.fish.filter((f) => {
      if (n >= Q.FINE_MAX || Math.hypot(f.x - x, f.y - y) >= Q.FINE_R + (f.adult ? 0 : 1.5)) return true;
      n++; if (!f.adult) young++; return false;
    });
    // a fine net in the reeds or the lotus always finds young fish: the nursery
    if (Math.hypot(x - ZONES.reeds.x, y - ZONES.reeds.y) < ZONES.reeds.r || Math.hypot(x - ZONES.lotus.x, y - ZONES.lotus.y) < ZONES.lotus.r) {
      let extra = Math.min(Q.FINE_MAX - n, Q.NURSERY_EXTRA);
      const order = s.fish.map((f, k) => [k, f.adult ? 1e9 : Math.hypot(f.x - x, f.y - y)] as const).filter((e) => e[1] < 1e9).sort((p, q) => p[1] - q[1]);
      const gone = new Set<number>();
      for (const [k] of order) { if (extra <= 0) break; gone.add(k); extra--; n++; young++; }
      s.fish = s.fish.filter((_, k) => !gone.has(k));
    }
    b.fry += young; b.youngKilled += young; b.caught += n - young;
    const witnesses = watchersOf(s, b).map((w) => w.seat);
    const p: Patch = { id: s.nextId++, x: r1(x), y: r1(y), t: dayClock(s), day: s.day, by: seat, seenBy: [...witnesses], reported: false, dump: false };
    s.patches.push(p); s.poacherNets.push([p.x, p.y]);
    for (const w of witnesses) s.boats[w].witnessed[seat] = (s.boats[w].witnessed[seat] ?? 0) + 1;
    ev.push({ k: "fine", seat, x: p.x, y: p.y, n, young, to: [seat] });
    for (const w of witnesses) ev.push({ k: "sawnet", seat, x: p.x, y: p.y, to: [w] });
    return;
  }
  if (i.k === "dump" && s.roles[seat] === "poacher" && b.fry > 0) {
    const witnesses = watchersOf(s, b).map((w) => w.seat);
    s.patches.push({ id: s.nextId++, x: r1(b.x), y: r1(b.y), t: dayClock(s), day: s.day, by: seat, seenBy: [...witnesses], reported: false, dump: true });
    b.fry = 0;
    ev.push({ k: "dumped", seat, to: [seat] });
    return;
  }
  if (i.k === "inspect" && !b.insp) {
    const tg = nearestOther(s, b, Q.INSPECT_R);
    if (!tg) return;
    b.insp = { target: tg.seat, t: 0 };
    ev.push({ k: "insp_go", seat, target: tg.seat, to: [seat] });
    return;
  }
  if (i.k === "buoy" && !b.buoy) {
    b.buoy = true;
    s.buoys.push({ owner: seat, x: r1(b.x), y: r1(b.y), place: placeOf(b.x, b.y), day: s.day, log: [], last: {} });
    ev.push({ k: "buoy", seat, to: [seat] });
    return;
  }
  if (i.k === "report") {
    const p = unreportedNear(s, b);
    if (!p) return;
    p.reported = true;
    startMeeting(s, ev, "report", seat, p.id);
  }
}
const r1 = (v: number): number => Math.round(v * 10) / 10;
// the seats that can see a point right now (their boat or their buoy within VIEW), plus `also`
function viewersOf(s: PoachSim, x: number, y: number, also: number): number[] {
  const out = new Set<number>([also]);
  for (const o of alive(s)) if (Math.hypot(o.x - x, o.y - y) < Q.VIEW) out.add(o.seat);
  for (const bu of s.buoys) if (bu.day === s.day && Math.hypot(bu.x - x, bu.y - y) < Q.BUOY_VIEW) out.add(bu.owner);
  for (let k = 0; k < s.n; k++) if (s.out[k]) out.add(k); // the exiled watch everything
  return [...out];
}

function moveBoats(s: PoachSim): void {
  const dt = Q.DT;
  for (const b of alive(s)) {
    if (b.netCd > 0) b.netCd -= dt;
    if (b.fineCd > 0) b.fineCd -= dt;
    // the prototype's steerBoat() (ui.js), as rush.ts uses it
    const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
    let throttle = 0;
    if (d > 0.9) {
      const want = Math.atan2(dy, dx), diff = Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h));
      b.h += Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.2);
      throttle = Math.min(1, d / 4) * Math.max(0.25, Math.cos(Math.min(1.4, Math.abs(diff))));
    }
    const inReeds = Math.hypot(b.x - ZONES.reeds.x, b.y - ZONES.reeds.y) < ZONES.reeds.r && nr(b.x, b.y) > 0.6;
    b.speed += (Q.SPEED * throttle * (inReeds ? 0.62 : 1) - b.speed) * Math.min(1, dt * 2.6);
    let nx = b.x + Math.cos(b.h) * b.speed * dt, ny = b.y + Math.sin(b.h) * b.speed * dt;
    if (nr(nx, ny) > 0.965) { const k = 0.965 / nr(nx, ny); nx *= k; ny *= k; b.speed *= 0.7; }
    const di = Math.hypot(nx - ISLAND.x, ny - ISLAND.y);
    if (di < ISLAND.r + 2.2) { const a = Math.atan2(ny - ISLAND.y, nx - ISLAND.x); nx = ISLAND.x + Math.cos(a) * (ISLAND.r + 2.2); ny = ISLAND.y + Math.sin(a) * (ISLAND.r + 2.2); b.speed *= 0.8; }
    b.x = nx; b.y = ny;
  }
}

function dayTick(s: PoachSim, ev: GameEvent[]): void {
  moveBoats(s); updateSchools(s); moveFish(s);
  const dt = Q.DT;
  for (const b of alive(s)) {
    // tasks: stay inside the ring for TASK_S
    for (const tk of b.tasks) {
      if (tk.done) continue;
      if (Math.hypot(tk.x - b.x, tk.y - b.y) < Q.TASK_R) {
        tk.p += dt;
        if (tk.p >= Q.TASK_S - 1e-9) {
          tk.done = true;
          if (s.roles[b.seat] === "fisher") b.taskFish += Q.TASK_FISH;
          ev.push({ k: "task", seat: b.seat, id: tk.id, all: b.tasks.every((x) => x.done), to: [b.seat] });
        }
      }
    }
    // inspecting: stay close for INSPECT_S
    if (b.insp) {
      const tg = s.boats[b.insp.target];
      if (s.out[tg.seat] || dist(tg, b) > Q.INSPECT_R + 2) { ev.push({ k: "insp_lost", seat: b.seat, to: [b.seat] }); b.insp = null; }
      else {
        b.insp.t += dt;
        if (b.insp.t >= Q.INSPECT_S - 1e-9) {
          const res = tg.fry > 0 ? "fry" : "clean";
          b.known[tg.seat] = { res, n: tg.fry, day: s.day }; b.insp = null;
          ev.push({ k: "insp", seat: b.seat, target: tg.seat, res, n: tg.fry, to: [b.seat] });
          ev.push({ k: "inspected", seat: tg.seat, to: [tg.seat] });
        }
      }
    }
  }
  // what each boat sees, every SIGHT_S: sightings, buoy logs, dead fish seen, everyone's path
  const el = dayClock(s);
  if (Math.round(s.phaseT / Q.DT) % Math.round(Q.SIGHT_S / Q.DT) === 0) {
    for (const b of alive(s)) {
      b.path.push([r1(b.x), r1(b.y)]);
      for (const o of alive(s)) if (o !== b && dist(o, b) < Q.VIEW) b.saw.push({ i: o.seat, x: r1(o.x), y: r1(o.y), t: el });
      if (s.roles[b.seat] === "poacher") s.poacherPath.push([r1(b.x), r1(b.y)]);
    }
    for (const bu of s.buoys) {
      if (bu.day !== s.day) continue;
      for (const o of alive(s)) if (Math.hypot(o.x - bu.x, o.y - bu.y) < Q.BUOY_R && (bu.last[o.seat] ?? -99) < el - 8) { bu.last[o.seat] = el; bu.log.push({ i: o.seat, t: el }); }
    }
    for (const p of s.patches) if (p.day === s.day) for (const b of alive(s)) if (!p.seenBy.includes(b.seat) && dist(p, b) < Q.VIEW) p.seenBy.push(b.seat);
  }
  if (health(s) < Q.LINE) { endMatch(s, ev, "poacher", "lake"); return; }
  if (s.phaseT >= Q.DAY_S - 1e-9) startMeeting(s, ev, "dusk", null, null);
}

function startDay(s: PoachSim, ev: GameEvent[]): void {
  s.day++; s.phase = "day"; s.phaseT = 0; s.meeting = null; s.tally = null;
  const spots = shuffle(s.rng, TASKS);
  for (const b of s.boats) {
    const d = dockPos(b.seat, s.n);
    b.x = d.x - Math.cos(d.inward) * 2; b.y = d.y - Math.sin(d.inward) * 2; b.h = d.inward + Math.PI; b.tx = b.x; b.ty = b.y; b.speed = 0;
    b.fry = 0; b.buoy = false; b.insp = null; b.saw = []; b.path = []; b.netCd = 0;
    b.fineCd = Q.FINE_FIRST + s.rng() * Q.FINE_FIRST;
    b.tasks = shuffle(s.rng, spots).slice(0, Q.TASKS_A_DAY).map((t) => ({ ...t, p: 0, done: false }));
  }
  ev.push({ k: "day", day: s.day });
}

// ---- the meeting ----
function startMeeting(s: PoachSim, ev: GameEvent[], reason: "dusk" | "report", by: number | null, patch: number | null): void {
  s.phase = "meeting"; s.phaseT = 0;
  for (const b of s.boats) b.insp = null;
  s.meeting = { n: (s.meeting?.n ?? 0) + 1, reason, by, patch, says: [], votes: s.boats.map(() => undefined), final: s.day >= Q.DAYS };
  ev.push({ k: "meeting", day: s.day, reason, by, place: patch !== null ? placeOf(s.patches.find((p) => p.id === patch)!.x, s.patches.find((p) => p.id === patch)!.y) : null });
}
function applyMeeting(s: PoachSim, seat: number, i: PoachInput, ev: GameEvent[]): void {
  const m = s.meeting!;
  if (i.k === "say") {
    if (m.says.some((x) => x.seat === seat && sameLine(x.line, i.line))) return; // each line once
    if (m.says.filter((x) => x.seat === seat).length >= Q.SAYS_MAX) return;
    m.says.push({ seat, line: i.line, at: Math.round(s.phaseT * 10) / 10 });
    ev.push({ k: "say", seat, line: i.line });
  }
  if (i.k === "vote") {
    if (m.votes[seat] !== undefined) return;
    m.votes[seat] = i.target;
    ev.push({ k: "voted", seat });
    if (alive(s).every((b) => m.votes[b.seat] !== undefined)) tally(s, ev);
  }
}
// the place a boat spent most of today
function mostPlace(b: Boat): PlaceId {
  const c: Partial<Record<PlaceId, number>> = {};
  for (const [x, y] of b.path) { const p = placeOf(x, y); c[p] = (c[p] ?? 0) + 1; }
  return (Object.entries(c).sort((p, q) => (q[1] as number) - (p[1] as number))[0]?.[0] as PlaceId) ?? "south";
}
// a boat this seat saw close to a patch of dead fish, around the time it appeared
function nearPatches(s: PoachSim, b: Boat): { i: number; place: PlaceId }[] {
  const out: { i: number; place: PlaceId }[] = [];
  for (const p of s.patches) if (p.day === s.day) for (const w of b.saw) if (w.i !== b.seat && Math.abs(w.t - p.t) < 8 && Math.hypot(w.x - p.x, w.y - p.y) < 14) out.push({ i: w.i, place: placeOf(p.x, p.y) });
  return out;
}
// the lines this seat may say: what it knows, or, for the poacher, plausible lies
export function linesFor(s: PoachSim, seat: number): Line[] {
  const b = s.boats[seat]; if (!b || s.out[seat]) return [];
  const out: Line[] = [];
  const others = alive(s).filter((o) => o.seat !== seat);
  if (s.roles[seat] === "fisher") {
    out.push({ k: "was", place: mostPlace(b) });
    for (const [i, k] of Object.entries(b.known)) if (k.day === s.day) out.push({ k: "insp", i: +i, res: k.res });
    for (const i of Object.keys(b.witnessed)) out.push({ k: "sawnet", i: +i });
    for (const n of nearPatches(s, b).slice(0, 2)) out.push({ k: "saw", i: n.i, place: n.place });
    const bu = s.buoys.find((x) => x.owner === seat && x.day === s.day);
    const ids = bu ? [...new Set(bu.log.filter((l) => l.i !== seat).map((l) => l.i))].slice(0, 3) : [];
    if (bu && ids.length) out.push({ k: "buoy", place: bu.place, ids });
  } else {
    // the poacher: somewhere away from today's dead fish, and someone who was near them
    const evPlaces = new Set(s.patches.filter((p) => p.day === s.day).map((p) => placeOf(p.x, p.y)));
    for (const place of BAYS.map((x) => x.id).filter((id) => !evPlaces.has(id)).slice(0, 2)) out.push({ k: "was", place });
    // a scapegoat: someone seen near the dead fish, else someone fixed by the day (not a fresh draw per frame)
    const near = nearPatches(s, b).find((x) => s.roles[x.i] !== "poacher");
    const today = s.patches.find((p) => p.day === s.day);
    const fallback = others.filter((o) => s.roles[o.seat] !== "poacher")[(s.day * 7 + seat) % Math.max(1, others.filter((o) => s.roles[o.seat] !== "poacher").length)];
    if (near) out.push({ k: "saw", i: near.i, place: near.place });
    else if (today && fallback) out.push({ k: "saw", i: fallback.seat, place: placeOf(today.x, today.y) });
    if (fallback) out.push({ k: "insp", i: fallback.seat, res: "clean" });
  }
  const seen = new Set<string>();
  return out.filter((l) => { const k = JSON.stringify(l); if (seen.has(k)) return false; seen.add(k); return true; });
}
function tally(s: PoachSim, ev: GameEvent[]): void {
  const m = s.meeting!;
  const c = new Map<number, number>();
  for (const v of m.votes) if (v !== null && v !== undefined) c.set(v, (c.get(v) ?? 0) + 1);
  const ranked = [...c.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0]);
  let out: number | null = null;
  if (ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) out = ranked[0][0];
  else if (ranked.length && m.final) { const top = ranked.filter((r) => r[1] === ranked[0][1]); out = top[Math.floor(s.rng() * top.length)][0]; }
  else if (!ranked.length && m.final) { const left = alive(s); out = left[Math.floor(s.rng() * left.length)].seat; }
  s.tally = { votes: [...m.votes], out };
  s.phase = "tally"; s.phaseT = 0;
  ev.push({ k: "tally", votes: m.votes.map((v) => (v === undefined ? null : v)), out });
}
function exile(s: PoachSim, ev: GameEvent[]): void {
  const out = s.tally!.out;
  s.phase = "exile"; s.phaseT = 0;
  if (out === null) {
    // no exile: in the night the poacher works unwatched (DESIGN: the lake loses 5%)
    const lost = killYoung(s, Math.round(s.start * Q.NO_EXILE / 100));
    ev.push({ k: "exile", seat: null, lost });
    return;
  }
  s.out[out] = true;
  s.exiled.push({ seat: out, role: s.roles[out], day: s.day });
  ev.push({ k: "exile", seat: out, role: s.roles[out] });
}
function killYoung(s: PoachSim, n: number): number {
  let gone = 0;
  for (let k = 0; k < n && s.fish.length; k++) {
    let j = s.fish.findIndex((f) => !f.adult); if (j < 0) j = 0;
    s.fish.splice(j, 1); gone++;
  }
  return gone;
}
function afterExile(s: PoachSim, ev: GameEvent[]): void {
  const poachers = s.boats.filter((b) => s.roles[b.seat] === "poacher");
  if (poachers.every((b) => s.out[b.seat])) { endMatch(s, ev, "fishers", "caught"); return; }
  if (health(s) < Q.LINE) { endMatch(s, ev, "poacher", "lake"); return; }
  if (s.day >= Q.DAYS) { endMatch(s, ev, "poacher", "survived"); return; }
  // at night the poacher goes out again; the lake recovers a little (DESIGN: 6% less 2%)
  const night = killYoung(s, Math.round(s.start * Q.NIGHT / 100));
  s.nightLoss.push(Q.NIGHT);
  for (const b of poachers) if (!s.out[b.seat]) b.youngKilled += Math.round(night / poachers.filter((p) => !s.out[p.seat]).length);
  ev.push({ k: "night", lost: night, pct: Q.NIGHT });
  if (health(s) < Q.LINE) { endMatch(s, ev, "poacher", "lake"); return; }
  startDay(s, ev);
}
function endMatch(s: PoachSim, ev: GameEvent[], winner: "fishers" | "poacher", why: "caught" | "lake" | "survived"): void {
  s.phase = "end"; s.winner = winner; s.endReason = why; s.phaseT = 0;
  ev.push({ k: "end", winner, why });
}

function step(s: PoachSim, inputs: { seat: number; i: PoachInput }[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === "end") return ev;
  for (const { seat, i } of inputs) apply(s, seat, i, ev);
  if (s.phase === "day") dayTick(s, ev);
  s.tick++;
  s.t = Math.round(s.tick * Q.DT * 1000) / 1000;
  s.phaseT = Math.round((s.phaseT + Q.DT) * 1000) / 1000;
  // the role card: until everyone has said they understand (at least ROLE_MIN_S), or ROLE_MAX_S at most
  if (s.phase === "role" && ((s.ready.every(Boolean) && s.phaseT >= Q.ROLE_MIN_S - 1e-9) || s.phaseT >= Q.ROLE_MAX_S - 1e-9)) startDay(s, ev);
  else if (s.phase === "meeting" && s.phaseT >= Q.MEET_S - 1e-9) tally(s, ev);
  else if (s.phase === "tally" && s.phaseT >= Q.TALLY_S - 1e-9) exile(s, ev);
  else if (s.phase === "exile" && s.phaseT >= Q.EXILE_S - 1e-9) afterExile(s, ev);
  return ev;
}

// ---- what one seat may see ----
const p10 = (v: number): number => Math.round(v * 10);
export function canSee(s: PoachSim, seat: number, x: number, y: number): boolean {
  if (seat < 0 || s.out[seat] || s.phase === "end") return true; // a watcher, the exiled and the end see everything
  const me = s.boats[seat];
  if (Math.hypot(me.x - x, me.y - y) < Q.VIEW) return true;
  return s.buoys.some((bu) => bu.owner === seat && bu.day === s.day && Math.hypot(bu.x - x, bu.y - y) < Q.BUOY_VIEW);
}
function frameFor(s: PoachSim, seat: number) {
  const ghost = seat < 0 || s.out[seat] === true;
  const me = seat >= 0 ? s.boats[seat] : null;
  const role = seat >= 0 ? s.roles[seat] : null;
  const partners = role === "poacher" ? s.boats.filter((b) => b.seat !== seat && s.roles[b.seat] === "poacher").map((b) => b.seat) : [];
  const showAll = ghost || s.phase === "end";
  const day = s.phase === "day";
  const boatsSeen = s.boats.filter((b) => !s.out[b.seat] && (b.seat === seat || showAll || !day || canSee(s, seat, b.x, b.y)));
  const f: Record<string, unknown> = {
    phase: s.phase, day: s.day, days: Q.DAYS, left: Math.max(0, Math.ceil(phaseLength(s) - s.phaseT)),
    health: health(s), line: Q.LINE, role, partners, ready: s.ready, out: s.out.map((o, i) => (o ? i : -1)).filter((i) => i >= 0),
    // boats: [seat, x*10, y*10, h*100, inspecting]
    b: boatsSeen.map((b) => [b.seat, p10(b.x), p10(b.y), Math.round(b.h * 100), b.insp ? 1 : 0]),
  };
  if (day || showAll) {
    f.f = s.fish.filter((x) => showAll || canSee(s, seat, x.x, x.y)).map((x) => [p10(x.x), p10(x.y), Math.round(x.h * 100), x.adult ? 1 : 0]);
    f.ev = s.patches.filter((p) => p.day === s.day && (showAll || canSee(s, seat, p.x, p.y))).map((p) => [p.id, p10(p.x), p10(p.y), p.reported ? 1 : 0]);
  }
  if (me && !ghost && s.phase !== "end") {
    f.me = {
      netCd: Math.max(0, Math.round(me.netCd * 10) / 10), fineCd: role === "poacher" ? Math.max(0, Math.round(me.fineCd * 10) / 10) : 0, fineMax: Q.FINE_CD,
      fry: role === "poacher" ? me.fry : 0, caught: me.caught, taskFish: me.taskFish,
      tasks: me.tasks.map((t) => [t.id, t.verb, t.place, p10(t.x), p10(t.y), Math.min(100, Math.round((t.p / Q.TASK_S) * 100)), t.done ? 1 : 0]),
      buoy: me.buoy, buoyAt: (() => { const bu = s.buoys.find((x) => x.owner === seat && x.day === s.day); return bu ? [p10(bu.x), p10(bu.y)] : null; })(),
      insp: me.insp ? [me.insp.target, Math.round((me.insp.t / Q.INSPECT_S) * 100)] : null,
      canInspect: day && !me.insp && nearestOther(s, me, Q.INSPECT_R) !== null,
      canReport: day && unreportedNear(s, me) !== null,
      seen: day ? watchersOf(s, me).length : 0,
    };
  }
  if (s.meeting && (s.phase === "meeting" || s.phase === "tally" || s.phase === "exile")) f.m = meetingFor(s, seat);
  if (s.tally && (s.phase === "tally" || s.phase === "exile")) f.tally = { votes: s.tally.votes.map((v) => (v === undefined ? null : v)), out: s.tally.out, role: s.phase === "exile" && s.tally.out !== null ? s.roles[s.tally.out] : null };
  if (s.phase === "end") f.end = { winner: s.winner, why: s.endReason, roles: s.roles, path: thin(s.poacherPath, 240), nets: s.poacherNets };
  return f;
}
function phaseLength(s: PoachSim): number {
  return { role: Q.ROLE_MAX_S, day: Q.DAY_S, meeting: Q.MEET_S, tally: Q.TALLY_S, exile: Q.EXILE_S, end: 0 }[s.phase];
}
function thin<T>(arr: T[], max: number): T[] { if (arr.length <= max) return arr; const k = arr.length / max; return Array.from({ length: max }, (_, i) => arr[Math.floor(i * k)]); }
// the meeting, as this seat knows it: the map (its own path, its sightings,
// the dead fish it saw or that were reported, every buoy and its log), the
// table (everyone's lines, who has voted) and its own lines to say
function meetingFor(s: PoachSim, seat: number) {
  const m = s.meeting!;
  const me = seat >= 0 ? s.boats[seat] : null, ghost = seat < 0 || s.out[seat];
  const last: Record<number, { i: number; x: number; y: number; t: number }> = {};
  for (const w of me?.saw ?? []) last[w.i] = w;
  const reported = m.patch !== null ? s.patches.find((p) => p.id === m.patch) : null;
  return {
    n: m.n, reason: m.reason, by: m.by, place: reported ? placeOf(reported.x, reported.y) : null, final: m.final,
    says: m.says.map((x) => ({ seat: x.seat, line: x.line })),
    voted: m.votes.map((v, i) => (v !== undefined ? i : -1)).filter((i) => i >= 0),
    myVote: seat >= 0 ? m.votes[seat] ?? undefined : undefined,
    path: me && !ghost ? thin(me.path, 160).map(([x, y]) => [p10(x), p10(y)]) : [],
    seen: Object.values(last).map((w) => [w.i, p10(w.x), p10(w.y), Math.round(w.t)]),
    patches: s.patches.filter((p) => p.day === s.day && (ghost || p.reported || (seat >= 0 && p.seenBy.includes(seat)) || p.by === seat)).map((p) => [p10(p.x), p10(p.y), Math.round(p.t), p.reported ? 1 : 0]),
    buoys: s.buoys.filter((bu) => bu.day === s.day).map((bu) => ({ owner: bu.owner, x: p10(bu.x), y: p10(bu.y), place: bu.place, log: bu.log.filter((l) => l.i !== bu.owner).map((l) => [l.i, Math.round(l.t)]) })),
    known: me && !ghost ? Object.fromEntries(Object.entries(me.known).map(([i, k]) => [i, k.res])) : {},
    witnessed: me && !ghost ? Object.keys(me.witnessed).map(Number) : [],
    lines: me && !ghost && s.phase === "meeting" ? linesFor(s, seat) : [],
  };
}

// ---- the end ----
function results(s: PoachSim): Results {
  const winner = s.winner ?? "poacher";
  const [a, y] = counts(s);
  // the lake keeps what this match left, as a share of what the room brought
  // (the 40 extra young in the reeds were this match's own)
  const left = Math.round((health(s) / 100) * s.roomFish);
  const next = nextSpring(left), tier = tierOf(next);
  const seats = s.boats.map((b) => {
    const base = b.caught + b.taskFish, won = (winner === "fishers") === (s.roles[b.seat] === "fisher");
    return { seat: b.seat, base, score: Math.round(base * tier.mult) + (won ? Q.WIN_BONUS : 0), won };
  });
  const order = seats.map((x) => x.score);
  const poachers = s.boats.filter((b) => s.roles[b.seat] === "poacher");
  const pr = poachers[0];
  const sharp = [...s.boats].filter((b) => s.roles[b.seat] === "fisher").sort((p, q) => Object.keys(q.known).length - Object.keys(p.known).length)[0];
  const highlights: Highlight[] = [
    { title: "The poacher", text: `{name} cast ${pr?.fineCasts ?? 0} fine nets`, seat: pr?.seat, tkey: "p2_hl_poacher_t", key: "p2_hl_poacher", vars: { n: pr?.fineCasts ?? 0 } },
    { title: "Sharpest eyes", text: sharp && Object.keys(sharp.known).length ? `{name} inspected ${Object.keys(sharp.known).length} boats` : "nobody inspected a boat", seat: sharp?.seat, tkey: "p2_hl_eyes_t", key: sharp && Object.keys(sharp.known).length ? "p2_hl_eyes" : "p2_hl_eyes_none", vars: { n: sharp ? Object.keys(sharp.known).length : 0 } },
    { title: "The lake", text: `ended at ${Math.round(health(s))}% (the line is ${Q.LINE}%)`, tkey: "p2_hl_lake_t", key: "p2_hl_lake", vars: { h: Math.round(health(s)), line: Q.LINE } },
  ];
  return {
    seats: seats.map((x) => ({ seat: x.seat, score: x.score, place: 1 + order.filter((v) => v > x.score).length, firstScoreS: null, base: x.base, won: x.won })),
    lakeLeft: left, highlights,
    winner, why: s.endReason, roles: s.roles, health: health(s), tier: tier.id, next,
    left: { a, y },
    ledger: s.boats.map((b) => ({ seat: b.seat, home: b.caught + b.taskFish, young: b.youngKilled, spared: 0 })),
    exiled: s.exiled,
    replay: { path: thin(s.poacherPath, 240), nets: s.poacherNets },
  };
}

// ---- bots (the prototype's pThink, and its meeting talk and votes) ----
function bot(s: PoachSim, seat: number, r: () => number): PoachInput[] {
  const b = s.boats[seat];
  if (!b || s.out[seat]) return [];
  if (s.phase === "meeting") return botMeeting(s, b, r);
  if (s.phase !== "day" || r() > 0.2) return [];
  const out: PoachInput[] = [];
  const steer = (x: number, y: number) => { if (Math.hypot(x - b.tx, y - b.ty) > 1) out.push({ k: "steer", x: r1(x), y: r1(y) }); };
  const el = s.phaseT, fisher = s.roles[seat] === "fisher";
  // fishers: go to dead fish they can see, and report them
  const p = s.patches.find((x) => x.day === s.day && !x.reported && dist(x, b) < Q.VIEW);
  if (p && fisher) { if (dist(p, b) < Q.REPORT_R - 1) { if (r() < 0.5) return [{ k: "report" }]; } else { steer(p.x, p.y); return out; } }
  if (b.insp) { const tg = s.boats[b.insp.target]; steer(tg.x, tg.y); return out; }
  if (!fisher) {
    const eyes = watchersOf(s, b).length;
    if (b.fry > 0 && alive(s).some((o) => o !== b && dist(o, b) < 13) && r() < 0.4) return [{ k: "dump" }];
    if (b.fineCd <= 0 && el > 6 && (eyes === 0 || (eyes === 1 && r() < 0.06))) {
      const nx = b.x + Math.cos(b.h) * Q.NET_AHEAD, ny = b.y + Math.sin(b.h) * Q.NET_AHEAD;
      const nearYoung = s.fish.some((f) => !f.adult && Math.hypot(f.x - nx, f.y - ny) < 7);
      if (nearYoung || r() < 0.25) { b.mind.hunt = null; return [{ k: "fine" }]; }
    }
    if (b.fineCd <= 3 && !b.mind.hunt) {
      // go where the young fish are and nobody else is
      const spots: [number, number][] = [[ZONES.reeds.x * 0.75, ZONES.reeds.y * 0.75], [ZONES.reeds.x * 0.65, ZONES.reeds.y * 0.85], [ZONES.lotus.x * 0.75, ZONES.lotus.y * 0.75], waterPoint(r, 0.75)];
      b.mind.hunt = spots.map((sp) => [sp, alive(s).filter((o) => o !== b && Math.hypot(o.x - sp[0], o.y - sp[1]) < 32).length + r() * 0.5] as const).sort((p2, q) => p2[1] - q[1])[0][0];
    }
    if (b.mind.hunt) { steer(b.mind.hunt[0], b.mind.hunt[1]); if (Math.hypot(b.mind.hunt[0] - b.x, b.mind.hunt[1] - b.y) < 4 || b.fineCd > 5) b.mind.hunt = null; return out; }
  } else {
    if (!b.buoy && el > 6 && r() < 0.03) return [{ k: "buoy" }];
    const tg = alive(s).find((o) => o !== b && !b.mind.inspected[o.seat] && dist(o, b) < Q.INSPECT_R);
    if (tg && r() < 0.25) { b.mind.inspected[tg.seat] = true; return [{ k: "inspect" }]; }
    if (r() < 0.02) out.push({ k: "net" });
  }
  const tk = b.tasks.find((x) => !x.done);
  if (tk) steer(tk.x + ((seat % 3) - 1) * 1.5, tk.y + (seat % 2) * 1.5);
  else {
    if (!b.mind.wander || Math.hypot(b.mind.wander[0] - b.x, b.mind.wander[1] - b.y) < 4) b.mind.wander = waterPoint(r, 0.8);
    if (b.mind.wander) steer(b.mind.wander[0], b.mind.wander[1]);
  }
  return out;
}
// a point on open water from the bot's own stream (never the lake's)
function waterPoint(r: () => number, maxK: number): [number, number] {
  for (let k = 0; k < 40; k++) { const x = (r() * 2 - 1) * 88, y = (r() * 2 - 1) * 60; if (nr(x, y) < maxK && Math.hypot(x - ISLAND.x, y - ISLAND.y) > 11) return [x, y]; }
  return [0, 20];
}
// how much a bot suspects another boat (the prototype's susOf)
function suspicion(s: PoachSim, b: Boat, o: Boat, r: () => number): number {
  if (o === b) return -99;
  let sc = r() * 0.8;
  sc += (b.witnessed[o.seat] ?? 0) * 10;
  const k = b.known[o.seat]; if (k) sc += k.res === "fry" ? 9 : -5;
  sc += nearPatches(s, b).filter((x) => x.i === o.seat).length * 2.6;
  for (const bu of s.buoys) if (bu.day === s.day) for (const p of s.patches) if (p.day === s.day) for (const l of bu.log) if (l.i === o.seat && Math.abs(l.t - p.t) < 9 && Math.hypot(bu.x - p.x, bu.y - p.y) < 20) sc += 1.6;
  for (const sy of s.meeting?.says ?? []) {
    if (sy.seat === b.seat) continue;
    const w = sy.seat === o.seat ? 0 : 1, l = sy.line;
    if (l.k === "sus" && l.i === o.seat) sc += 1.2 * w;
    if (l.k === "sawnet" && l.i === o.seat) sc += 4 * w;
    if (l.k === "insp" && l.i === o.seat) sc += (l.res === "fry" ? 3.5 : -1.5) * w;
    if (l.k === "vouch" && l.i === o.seat) sc -= 1 * w;
    if (l.k === "saw" && l.i === o.seat) sc += 1.2 * w;
    if ((l.k === "sus" || l.k === "sawnet") && l.i === b.seat && sy.seat === o.seat) sc += 2.5;
  }
  if (s.roles[b.seat] === "poacher") sc = s.roles[o.seat] === "poacher" ? -99 : sc * 0.3 + r() * 2;
  return sc;
}
function botMeeting(s: PoachSim, b: Boat, r: () => number): PoachInput[] {
  const m = s.meeting!;
  if (b.mind.meet !== m.n) {
    // plan this meeting: up to two lines, then a vote at 15-25 s
    b.mind.meet = m.n;
    const mine = linesFor(s, b.seat);
    const fisher = s.roles[b.seat] === "fisher";
    const pickL: Line[] = [];
    if (fisher) {
      const pri = (l: Line) => ({ sawnet: 0, insp: 1, saw: 2, buoy: 3, was: 4 } as Record<string, number>)[l.k] ?? 9;
      pickL.push(...[...mine].sort((p, q) => pri(p) - pri(q)).slice(0, 2));
    } else {
      pickL.push(mine[0]);
      const blame = mine.find((l) => l.k === "saw" || l.k === "insp");
      if (blame && r() < 0.7) pickL.push(blame);
    }
    b.mind.lines = pickL.filter(Boolean);
    b.mind.sayAt = 2 + b.seat * 1.6 + r() * 1.5;
    b.mind.voteAt = 15 + r() * 10;
  }
  if (m.votes[b.seat] !== undefined) return [];
  if (b.mind.lines && b.mind.lines.length && s.phaseT >= b.mind.sayAt) {
    const line = b.mind.lines.shift()!;
    b.mind.sayAt = s.phaseT + 4 + r() * 1.5;
    return [{ k: "say", line }];
  }
  if (s.phaseT >= b.mind.voteAt) {
    const ranked = alive(s).filter((o) => o !== b).map((o) => [o, suspicion(s, b, o, r)] as const).sort((p, q) => q[1] - p[1]);
    const [top, sc] = ranked[0];
    const out: PoachInput[] = [];
    if (sc > 1.2 && m.says.filter((x) => x.seat === b.seat).length < 3 && (s.roles[b.seat] === "fisher" ? sc > 4 : true) && r() < 0.5) out.push({ k: "say", line: { k: "sus", i: top.seat } });
    out.push({ k: "vote", target: m.final || sc > (s.roles[b.seat] === "poacher" ? 1.5 : 3) ? top.seat : null });
    return out;
  }
  return [];
}

export const poach: Mode<PoachSim, PoachInput> = {
  id: "poach", model: POACH_MODEL, seats: Q.SEATS, breeds: false,
  make, input, step, frameFor, over: (s) => s.phase === "end", results, bot,
};
