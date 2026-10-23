import { describe, expect, it } from "vitest";
import { botStream, eventsFor, type GameEvent, replay, type Seat } from "../../src/lib/game-platform.ts";
import { canSee, health, linesFor, poach, type PoachInput, type PoachSim } from "../../src/lib/modes/poach.ts";
import { POACH as Q } from "../../src/lib/game-constants.ts";
import { nextSpring, tierOf } from "../../src/lib/lake-world.ts";

// Who's Poaching 2.0 (DESIGN.md "Who's Poaching 谁在偷鱼 (2.0)"), pure logic.
const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const botsOf = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));
const LAKE = { fish: 280, adults: 224, young: 56 };
const make = (seed = "poach-test", n = 4): PoachSim => poach.make(seed, people(n), LAKE);
const step = (s: PoachSim, inputs: { seat: number; i: PoachInput }[] = []): GameEvent[] => poach.step(s, inputs);
const until = (s: PoachSim, pred: () => boolean, max = 20000): GameEvent[] => { const all: GameEvent[] = []; for (let k = 0; k < max && !pred(); k++) all.push(...step(s)); return all; };
const toDay = (s: PoachSim) => until(s, () => s.phase === "day");
const put = (s: PoachSim, seat: number, x: number, y: number, h = 0) => { const b = s.boats[seat]; b.x = b.tx = x; b.y = b.ty = y; b.h = h; b.speed = 0; };
const poacherOf = (s: PoachSim) => s.roles.indexOf("poacher");
const fisherOf = (s: PoachSim, not: number[] = []) => s.roles.findIndex((r, i) => r === "fisher" && !not.includes(i));
const say = (s: PoachSim, seat: number, line: unknown) => poach.input(s, seat, { k: "say", line });

describe("roles", () => {
  it("one poacher at four to six seats, two at seven or eight, dealt from the match's own stream", () => {
    for (const n of [4, 5, 6, 7, 8]) {
      const s = make(`roles-${n}`, n);
      expect(s.roles.filter((r) => r === "poacher").length).toBe(n >= 7 ? 2 : 1);
      expect(make(`roles-${n}`, n).roles).toEqual(s.roles);
    }
  });
  it("a seat's frame names only its own role; a second poacher also sees its partner", () => {
    const s = make("partners", 8);
    const [p1, p2] = s.roles.map((r, i) => (r === "poacher" ? i : -1)).filter((i) => i >= 0);
    const f = fisherOf(s);
    const ff = poach.frameFor(s, f) as Record<string, unknown>;
    expect(ff.role).toBe("fisher"); expect(ff.partners).toEqual([]);
    expect(JSON.stringify(ff)).not.toContain("poacher");
    expect((poach.frameFor(s, p1) as { partners: number[] }).partners).toEqual([p2]);
  });
});

describe("the day's flow", () => {
  it("a role card, three days of 70 s each ending in a meeting at dusk, a tally and an exile", () => {
    const s = make("flow", 4);
    expect(s.phase).toBe("role");
    toDay(s);
    expect(s.day).toBe(1);
    expect(s.t).toBeCloseTo(Q.ROLE_S, 1);
    const ev = until(s, () => s.phase === "meeting");
    expect(ev.some((e) => e.k === "meeting" && e.reason === "dusk")).toBe(true);
    expect(s.t).toBeCloseTo(Q.ROLE_S + Q.DAY_S, 1);
    // everyone votes for the same fisher: tally at once, then the exile
    const target = fisherOf(s);
    for (let i = 0; i < 4; i++) if (i !== target) step(s, [{ seat: i, i: poach.input(s, i, { k: "vote", target })! }]);
    step(s, [{ seat: target, i: poach.input(s, target, { k: "vote", target: (target + 1) % 4 })! }]);
    expect(s.phase).toBe("tally");
    until(s, () => s.phase === "exile");
    expect(s.out[target]).toBe(true);
    until(s, () => s.phase !== "exile");
    expect(s.phase).toBe("day"); expect(s.day).toBe(2);
  });
  it("tasks: 2.5 s inside a ring earns a fisher 2 fish for the village; the poacher's are a cover", () => {
    const s = make("tasks", 4); toDay(s);
    for (const seat of [poacherOf(s), fisherOf(s)]) {
      const tk = s.boats[seat].tasks[0];
      for (let k = 0; k < Math.ceil(Q.TASK_S / Q.DT) + 2; k++) { put(s, seat, tk.x, tk.y); step(s); }
      expect(tk.done).toBe(true);
      expect(s.boats[seat].taskFish).toBe(s.roles[seat] === "fisher" ? Q.TASK_FISH : 0);
    }
  });
});

describe("the lantern's circle (CLAUDE.md: no boat, fish or evidence outside it)", () => {
  it("a seat's day frame holds only boats, fish and dead fish within VIEW of its boat or its own buoy", () => {
    const s = make("fog", 6); toDay(s);
    put(s, 0, -60, 10); put(s, 1, -50, 10); put(s, 2, 50, -10); put(s, 3, 60, 20); put(s, 4, 0, 30); put(s, 5, -10, -40);
    step(s);
    const f = poach.frameFor(s, 0) as { b: number[][]; f: number[][] };
    expect(f.b.map((x) => x[0]).sort()).toEqual([0, 1]);
    for (const [x, y] of f.f) expect(Math.hypot(x / 10 - s.boats[0].x, y / 10 - s.boats[0].y)).toBeLessThan(Q.VIEW + 0.2);
    expect(f.f.length).toBeLessThan(s.fish.length);
    // its buoy lights a second circle
    step(s, [{ seat: 0, i: { k: "buoy" } }]);
    put(s, 0, 40, 30); put(s, 1, -58, 12); step(s);
    expect((poach.frameFor(s, 0) as { b: number[][] }).b.map((x) => x[0])).toContain(1);
    expect(canSee(s, 0, -60, 10)).toBe(true); expect(canSee(s, 0, -10, -40)).toBe(false);
  });
  it("an exiled player, and a watcher, see everything", () => {
    const s = make("ghost", 4); toDay(s); s.out[1] = true;
    expect((poach.frameFor(s, 1) as { f: unknown[] }).f.length).toBe(s.fish.length);
    expect((poach.frameFor(s, -1) as { f: unknown[] }).f.length).toBe(s.fish.length);
  });
});

describe("nets, the fine net and the evidence", () => {
  it("only the poacher has a fine net and a dump; a fisher's net takes adults only, at most 3", () => {
    const s = make("nets", 4); toDay(s);
    const p = poacherOf(s), f = fisherOf(s);
    expect(poach.input(s, f, { k: "fine" })).toBeNull();
    expect(poach.input(s, f, { k: "dump" })).toBeNull();
    expect(poach.input(s, p, { k: "fine" })).toEqual({ k: "fine" });
    const before = s.fish.length;
    put(s, f, -20, 0); for (let k = 0; k < 8; k++) s.fish.push({ ...s.fish[0], id: 9000 + k, x: -16 + (k % 3) * 0.3, y: (k % 2) * 0.3, adult: k % 2 === 0, scare: 0, school: 0 });
    s.schools[0].x = s.schools[0].tx = -16; s.schools[0].y = s.schools[0].ty = 0; s.schools[0].t = 999;
    step(s, [{ seat: f, i: { k: "net" } }]);
    expect(s.boats[f].caught).toBeLessThanOrEqual(Q.NET_MAX);
    expect(s.boats[f].caught).toBeGreaterThan(0);
    expect(s.fish.length).toBe(before + 8 - s.boats[f].caught);
  });
  it("a fine net leaves dead young fish; every boat within VIEW witnesses it, and only they hear of it", () => {
    const s = make("witness", 5); toDay(s);
    const p = poacherOf(s), [w, far] = [fisherOf(s), fisherOf(s, [fisherOf(s)])];
    s.boats[p].fineCd = 0;
    put(s, p, -50, -5); put(s, w, -40, -5); put(s, far, 60, 10);
    const ev = step(s, [{ seat: p, i: { k: "fine" } }]);
    expect(s.patches.length).toBe(1);
    expect(s.boats[w].witnessed[p]).toBe(1);
    expect(s.boats[far].witnessed[p]).toBeUndefined();
    expect(eventsFor(ev, w).some((e) => e.k === "sawnet")).toBe(true);
    expect(eventsFor(ev, far).some((e) => e.k === "sawnet" || e.k === "fine")).toBe(false);
    expect(s.boats[p].fineCd).toBeCloseTo(Q.FINE_CD - Q.DT, 3);
  });
  it("inspecting: 1.5 s alongside tells only the inspector clean or N young fish, and tells the target someone looked", () => {
    const s = make("inspect", 4); toDay(s);
    const p = poacherOf(s), f = fisherOf(s);
    s.boats[p].fry = 5;
    put(s, f, 0, 30); put(s, p, 4, 30);
    step(s, [{ seat: f, i: { k: "inspect" } }]);
    const all: GameEvent[] = [];
    for (let k = 0; k < Math.ceil(Q.INSPECT_S / Q.DT) + 1; k++) { put(s, f, 0, 30); put(s, p, 4, 30); all.push(...step(s)); }
    expect(s.boats[f].known[p]).toMatchObject({ res: "fry", n: 5 });
    expect(eventsFor(all, f).find((e) => e.k === "insp")).toMatchObject({ res: "fry" });
    expect(eventsFor(all, p).some((e) => e.k === "insp")).toBe(false);
    expect(eventsFor(all, p).some((e) => e.k === "inspected")).toBe(true);
  });
  it("a report near dead young fish nobody reported calls the meeting at once", () => {
    const s = make("report", 4); toDay(s);
    const p = poacherOf(s), f = fisherOf(s);
    s.boats[p].fineCd = 0; put(s, p, -50, -5); step(s, [{ seat: p, i: { k: "fine" } }]);
    const patch = s.patches[0];
    put(s, f, patch.x + 3, patch.y);
    const ev = step(s, [{ seat: f, i: { k: "report" } }]);
    expect(s.phase).toBe("meeting");
    expect(ev.find((e) => e.k === "meeting")).toMatchObject({ reason: "report", by: f });
  });
});

describe("the meeting", () => {
  it("a fisher may only say what it knows; suspect, vouch and skip are open to all; the poacher's lines are lies", () => {
    const s = make("say", 4); toDay(s);
    until(s, () => s.phase === "meeting");
    const p = poacherOf(s), f = fisherOf(s);
    expect(say(s, f, { k: "sawnet", i: p })).toBeNull(); // it never saw a fine net
    expect(say(s, f, { k: "sus", i: p })).not.toBeNull();
    expect(say(s, f, { k: "vouch", i: f })).toBeNull(); // not about yourself
    for (const line of linesFor(s, f)) expect(say(s, f, line)).not.toBeNull();
    for (const line of linesFor(s, p)) expect(say(s, p, line)).not.toBeNull();
    expect(linesFor(s, p).some((l) => l.k === "was")).toBe(true);
  });
  it("the last meeting has no skip; a tie exiles nobody before it; no exile costs the lake 5%", () => {
    const s = make("tie", 4); toDay(s); until(s, () => s.phase === "meeting");
    const [a, b] = [0, 1];
    for (const i of [0, 1, 2, 3]) step(s, [{ seat: i, i: poach.input(s, i, { k: "vote", target: i < 2 ? (a === i ? b : a) : i === 2 ? a : b })! }]);
    expect(s.phase).toBe("tally"); expect(s.tally!.out).toBeNull();
    const before = s.fish.length;
    until(s, () => s.phase === "exile");
    expect(before - s.fish.length).toBe(Math.round(s.start * Q.NO_EXILE / 100));
    until(s, () => s.day === 3 && s.phase === "meeting", 40000);
    expect(s.meeting!.final).toBe(true);
    expect(poach.input(s, fisherOf(s), { k: "vote", target: null })).toBeNull();
  });
  it("exiling every poacher wins it for the fishers; surviving day 3 wins it for the poacher", () => {
    const s = make("win-f", 4); toDay(s); until(s, () => s.phase === "meeting");
    const p = poacherOf(s);
    for (let i = 0; i < 4; i++) step(s, [{ seat: i, i: poach.input(s, i, { k: "vote", target: i === p ? (p + 1) % 4 : p })! }]);
    until(s, () => poach.over(s));
    expect(s.winner).toBe("fishers"); expect(s.endReason).toBe("caught");

    const t = make("win-p", 4); toDay(t);
    for (let d = 0; d < 3; d++) {
      until(t, () => t.phase === "meeting", 40000);
      if (poach.over(t)) break;
      const pp = poacherOf(t), innocent = t.roles.findIndex((r, i) => r === "fisher" && !t.out[i]);
      for (let i = 0; i < 4; i++) if (!t.out[i]) step(t, [{ seat: i, i: poach.input(t, i, { k: "vote", target: t.meeting!.final ? (i === innocent ? pp === 0 ? 1 : 0 : innocent) : null }) ?? { k: "vote", target: innocent } }]);
      until(t, () => t.phase === "day" || poach.over(t), 40000);
    }
    expect(t.winner).toBe("poacher");
  });
  it("the poacher wins at once if the lake falls below the 40% line", () => {
    const s = make("line", 4); toDay(s);
    s.fish = s.fish.slice(0, Math.floor(s.start * 0.39));
    const ev = step(s);
    expect(s.phase).toBe("end"); expect(ev.find((e) => e.k === "end")).toMatchObject({ winner: "poacher", why: "lake" });
  });
});

describe("results and the lake", () => {
  it("score = (fish netted + task fish) x the tier, +20 for the winning side; the lake keeps its health's share of what the room brought", () => {
    const s = make("score", 4); toDay(s);
    const p = poacherOf(s), f = fisherOf(s);
    s.boats[f].caught = 6; s.boats[f].taskFish = 4; s.boats[p].caught = 3;
    s.phase = "end"; s.winner = "fishers"; s.endReason = "caught";
    const r = poach.results(s);
    const left = Math.round((health(s) / 100) * 280), tier = tierOf(nextSpring(left));
    expect(r.lakeLeft).toBe(left);
    expect(r.seats.find((x) => x.seat === f)!.score).toBe(Math.round(10 * tier.mult) + Q.WIN_BONUS);
    expect(r.seats.find((x) => x.seat === p)!.score).toBe(Math.round(3 * tier.mult));
  });
  it("bots play whole matches to an end, and a replay of the stored inputs is exact", () => {
    for (const seed of ["bots-a", "bots-b", "bots-c"]) {
      const seats = botsOf(6), s = poach.make(seed, seats, LAKE);
      const inputs = new Map<number, { seat: number; i: unknown }[]>();
      for (let tick = 0; !poach.over(s) && tick < 30000; tick++) {
        const applied: { seat: number; i: PoachInput }[] = [];
        for (const st of seats) for (const raw of poach.bot(s, st.seat, botStream(seed, st.bot!, tick, st.seat))) { const ok = poach.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok }); }
        if (applied.length) inputs.set(tick, applied);
        poach.step(s, applied);
      }
      expect(poach.over(s)).toBe(true);
      const again = replay(poach, seed, seats, LAKE, inputs);
      expect(poach.results(again)).toEqual(poach.results(s));
    }
  }, 120000);
});
