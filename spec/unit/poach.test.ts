import { describe, expect, it } from "vitest";
import { eventsFor, type Seat } from "../../src/lib/game-platform.ts";
import { POACH } from "../../src/lib/game-constants.ts";
import { bayOf, poach, type PoachInput, type PoachSim } from "../../src/lib/modes/poach.ts";

// Who's Poaching, "poach 1.0" (DESIGN.md "Who's Poaching"). Roles are secret:
// each seat is sent only its own until a role is revealed. Inspection results
// go only to the inspector. The server decides every role, catch, splash,
// vote and win.

const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const make = (n = 4, seed = "poach-test"): PoachSim => poach.make(seed, people(n), { fish: 220 });
const step = (s: PoachSim, inputs: { seat: number; i: PoachInput }[] = []) => poach.step(s, inputs);
const until = (s: PoachSim, pred: () => boolean, max = 20000) => { const ev = []; for (let i = 0; i < max && !pred(); i++) ev.push(...step(s)); return ev; };
const poacherOf = (s: PoachSim) => s.roles.indexOf("poacher");
const fisherOf = (s: PoachSim, not: number[] = []) => s.roles.findIndex((r, i) => r === "fisher" && !not.includes(i));
const put = (s: PoachSim, seat: number, x: number, y: number) => { const b = s.boats[seat]; b.x = b.tx = x; b.y = b.ty = y; };
const allText = (s: PoachSim, seat: number, ev: unknown[]) => JSON.stringify(poach.frameFor(s, seat)) + JSON.stringify(eventsFor(ev as never, seat));

describe("roles", () => {
  it("one poacher at 4 to 6, two at 7 or more, and a warden at 6 or more", () => {
    const count = (n: number) => { const s = make(n); return { p: s.roles.filter((r) => r === "poacher").length, w: s.roles.filter((r) => r === "warden").length }; };
    expect(count(4)).toEqual({ p: 1, w: 0 });
    expect(count(5)).toEqual({ p: 1, w: 0 });
    expect(count(6)).toEqual({ p: 1, w: 1 });
    expect(count(7)).toEqual({ p: 2, w: 1 });
    expect(count(8)).toEqual({ p: 2, w: 1 });
  });

  it("no frame or event sent to a fisher contains another seat's role before it is revealed", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const s = make(6, seed);
      const p = poacherOf(s), f = fisherOf(s);
      const w = s.roles.indexOf("warden");
      const seen: string[] = [];
      for (let i = 0; i < 600; i++) {
        const inputs: { seat: number; i: PoachInput }[] = [];
        if (i % 10 === 0) inputs.push({ seat: p, i: { k: "fine" } });
        if (i === 50) inputs.push({ seat: w, i: { k: "patrol", target: p } });
        const ev = step(s, inputs);
        seen.push(allText(s, f, ev));
      }
      const text = seen.join("");
      expect(text).not.toContain("poacher");
      expect(text).not.toContain("warden");
      expect(text).toContain('"role":"fisher"');
    }
  });

  it("a fisher's frames never show another seat's role, even in the frame of the last tick; the end event reveals them", { timeout: 60000 }, () => {
    const s = make(4, "lastframe");
    const f = fisherOf(s);
    let raw = "";
    while (!poach.over(s)) {
      const ev = step(s, s.phase === "meeting" ? [0, 1, 2, 3].map((v) => ({ seat: v, i: { k: "vote", target: null } as PoachInput })) : []);
      raw += JSON.stringify(poach.frameFor(s, f)) + JSON.stringify(eventsFor(ev, f));
    }
    expect(raw.indexOf("poacher")).toBeGreaterThan(raw.indexOf('"k":"end"'));
    expect(raw).toContain('"k":"end"');
  });

  it("the poacher is told its own role, and who else poaches when there are two", () => {
    const s = make(7);
    const [p1, p2] = s.roles.flatMap((r, i) => (r === "poacher" ? [i] : []));
    const f = poach.frameFor(s, p1) as { role: string; partners: number[] };
    expect(f.role).toBe("poacher");
    expect(f.partners).toEqual([p2]);
    expect((poach.frameFor(s, fisherOf(s)) as { partners?: unknown }).partners).toEqual([]);
  });

  it("only a poacher may use the fine net, dump or plant", () => {
    const s = make(4);
    const f = fisherOf(s);
    for (const raw of [{ k: "fine" }, { k: "dump" }, { k: "plant", target: 0 }]) expect(poach.input(s, f, raw)).toBeNull();
    expect(poach.input(s, poacherOf(s), { k: "fine" })).toEqual({ k: "fine" });
  });
});

describe("the day", () => {
  it("lasts 75 seconds, and ends with the fry lost in each bay", () => {
    const s = make();
    const ev = until(s, () => s.phase !== "day");
    expect(s.t).toBeCloseTo(POACH.DAY_S, 1);
    const ann = ev.find((e) => e.k === "dusk") as { bays: Record<string, number> } | undefined;
    expect(Object.keys(ann!.bays).sort()).toEqual(["East Bay", "North Bay", "South Bay", "West Bay"]);
  });

  it("the fine net takes fry, which lowers the lake's health", () => {
    const s = make();
    const p = poacherOf(s);
    const h0 = s.health;
    for (let i = 0; i < 400; i++) step(s, i % 25 === 0 ? [{ seat: p, i: { k: "fine" } }] : []);
    expect(s.boats[p].fry).toBeGreaterThan(0);
    expect(s.health).toBeLessThan(h0);
  });

  it("dumping fry destroys the evidence, but the fry still die", () => {
    const s = make();
    const p = poacherOf(s);
    s.boats[p].fry = 6; const dead = s.fryDead;
    step(s, [{ seat: p, i: { k: "dump" } }]);
    expect(s.boats[p].fry).toBe(0);
    expect(s.fryDead).toBe(dead); // they were already counted dead when netted
  });

  it("inspecting takes 3 s within 60, only the inspector sees the basket, and the target is told someone looked", () => {
    const s = make(4);
    const p = poacherOf(s), f = fisherOf(s), other = fisherOf(s, [f]);
    s.boats[p].fry = 4;
    put(s, f, 500, 350); put(s, p, 540, 350); put(s, other, 900, 300);
    const ev = [];
    for (let i = 0; i < POACH.INSPECT_S / POACH.DT + 2; i++) ev.push(...step(s, [{ seat: f, i: { k: "inspect", target: p } }]));
    const res = ev.find((e) => e.k === "inspected");
    expect(res).toMatchObject({ k: "inspected", by: f, target: p, fry: 4, to: [f] });
    const told = ev.find((e) => e.k === "looked");
    expect(told).toMatchObject({ to: [p] });
    expect(JSON.stringify(told)).not.toContain(`"by"`);
    expect(JSON.stringify(eventsFor(ev, other))).not.toContain("inspected");
  });

  it("inspecting from too far, or moving away, gets nothing", () => {
    const s = make(4);
    const p = poacherOf(s), f = fisherOf(s);
    put(s, f, 500, 350); put(s, p, 600, 350);
    const ev = [];
    for (let i = 0; i < 80; i++) ev.push(...step(s, [{ seat: f, i: { k: "inspect", target: p } }]));
    expect(ev.some((e) => e.k === "inspected")).toBe(false);
  });

  it("planting fry takes 2 s alongside, and any boat within 100 sees a splash", () => {
    const s = make(5);
    const p = poacherOf(s), f = fisherOf(s), near = fisherOf(s, [f]), far = fisherOf(s, [f, near]);
    s.boats[p].fry = 3;
    put(s, f, 500, 350); put(s, p, 530, 350); put(s, near, 560, 400); put(s, far, 900, 200);
    const ev = [];
    for (let i = 0; i < POACH.PLANT_S / POACH.DT + 2; i++) ev.push(...step(s, [{ seat: p, i: { k: "plant", target: f } }]));
    expect(s.boats[f].fry).toBe(3);
    expect(s.boats[p].fry).toBe(0);
    const splash = ev.find((e) => e.k === "splash") as { to: number[] };
    expect(splash.to).toContain(near);
    expect(splash.to).toContain(f);
    expect(splash.to).not.toContain(far);
  });

  it("a buoy logs who passes it, one buoy a day, and the log is shown at the meeting", () => {
    const s = make(4);
    const f = fisherOf(s), p = poacherOf(s);
    put(s, f, 300, 300);
    step(s, [{ seat: f, i: { k: "buoy" } }]);
    step(s, [{ seat: f, i: { k: "buoy" } }]);
    expect(s.buoys.filter((b) => b.seat === f).length).toBe(1);
    put(s, p, 310, 310); step(s);
    until(s, () => s.phase === "meeting");
    const fr = poach.frameFor(s, fisherOf(s, [f])) as { buoys: { seat: number; passed: number[] }[] };
    expect(fr.buoys.find((b) => b.seat === f)!.passed).toContain(p);
  });

  it("the warden inspects once a day without coming close, and only the warden sees it", () => {
    const s = make(6);
    const w = s.roles.indexOf("warden"), p = poacherOf(s);
    s.boats[p].fry = 2;
    put(s, w, 100, 350); put(s, p, 900, 350);
    const e1 = step(s, [{ seat: w, i: { k: "patrol", target: p } }]);
    expect(e1.find((e) => e.k === "inspected")).toMatchObject({ by: w, target: p, fry: 2, to: [w] });
    const e2 = step(s, [{ seat: w, i: { k: "patrol", target: p } }]);
    expect(e2.some((e) => e.k === "inspected")).toBe(false);
  });
});

describe("the meeting", () => {
  const toMeeting = (n = 5, seed = "meet") => { const s = make(n, seed); until(s, () => s.phase === "meeting"); return s; };

  it("accepts only set phrases, with a bay, a seat and a count from fixed lists", () => {
    const s = toMeeting();
    expect(poach.input(s, 0, { k: "say", p: "was", bay: "East Bay" })).toEqual({ k: "say", p: "was", bay: "East Bay" });
    expect(poach.input(s, 0, { k: "say", p: "inspected", target: 1, fry: 4 })).toEqual({ k: "say", p: "inspected", target: 1, fry: 4 });
    expect(poach.input(s, 0, { k: "say", p: "inspected", target: 1, fry: 0 })).toEqual({ k: "say", p: "inspected", target: 1, fry: 0 });
    expect(poach.input(s, 0, { k: "say", p: "suspect", target: 2 })).toEqual({ k: "say", p: "suspect", target: 2 });
    expect(poach.input(s, 0, { k: "say", p: "vouch", target: 3 })).toEqual({ k: "say", p: "vouch", target: 3 });
    expect(poach.input(s, 0, { k: "say", p: "skip" })).toEqual({ k: "say", p: "skip" });
    expect(poach.input(s, 0, { k: "say", p: "hello", text: "free text" })).toBeNull();
    expect(poach.input(s, 0, { k: "say", p: "was", bay: "Moon Bay" })).toBeNull();
    expect(poach.input(s, 0, { k: "say", p: "suspect", target: 99 })).toBeNull();
  });

  it("the most votes exile one player, whose role is then revealed to everyone", () => {
    const s = toMeeting(5, "exile");
    const p = poacherOf(s);
    const voters = [0, 1, 2, 3, 4].filter((x) => x !== p);
    const ev = [];
    ev.push(...step(s, voters.map((v) => ({ seat: v, i: { k: "vote", target: p } as PoachInput }))));
    ev.push(...until(s, () => s.phase !== "meeting"));
    const ex = ev.find((e) => e.k === "exiled");
    expect(ex).toMatchObject({ seat: p, role: "poacher" });
    expect(ex!.to).toBeUndefined();
    expect(s.out[p]).toBe(true);
  });

  it("a tie or a majority of skips exiles nobody", () => {
    const s = toMeeting(4, "tie");
    step(s, [{ seat: 0, i: { k: "vote", target: 1 } }, { seat: 1, i: { k: "vote", target: 0 } }, { seat: 2, i: { k: "vote", target: null } }, { seat: 3, i: { k: "vote", target: null } }]);
    const ev = until(s, () => s.phase !== "meeting");
    expect(ev.find((e) => e.k === "exiled")).toBeUndefined();
    expect(ev.find((e) => e.k === "noexile")).toBeDefined();
    expect(s.out.every((o) => !o)).toBe(true);
  });

  it("an exiled player cannot vote, speak or fish", () => {
    const s = make(5);
    s.out[1] = true;
    expect(poach.input(s, 1, { k: "steer", x: 1, y: 1 })).toBeNull();
    until(s, () => s.phase === "meeting");
    expect(poach.input(s, 1, { k: "vote", target: 0 })).toBeNull();
  });
});

describe("who wins", () => {
  it("fishers win when every poacher is exiled while the lake stays above 40%", () => {
    const s = make(5, "fw");
    until(s, () => s.phase === "meeting");
    const p = poacherOf(s);
    step(s, [0, 1, 2, 3, 4].filter((v) => v !== p).map((v) => ({ seat: v, i: { k: "vote", target: p } as PoachInput })));
    until(s, () => poach.over(s));
    expect(s.winner).toBe("fishers");
    const r = poach.results(s);
    expect(r.seats.find((x) => x.seat === p)!.score).toBe(0);
    expect(r.seats.find((x) => x.seat !== p)!.score).toBe(1);
  });

  it("the poacher wins if lake health falls below 40%", () => {
    const s = make(5, "pw");
    s.health = 39; step(s);
    expect(poach.over(s)).toBe(true);
    expect(s.winner).toBe("poacher");
  });

  it("the poacher wins by surviving day 3", () => {
    const s = make(4, "survive");
    until(s, () => poach.over(s), 100000);
    expect(s.day).toBe(POACH.DAYS);
    expect(s.winner).toBe("poacher");
  });

  it("the poacher wins if two innocents are exiled", () => {
    const s = make(6, "innocent");
    const p = poacherOf(s);
    const [i1, i2] = s.roles.flatMap((r, i) => (r !== "poacher" ? [i] : [])).slice(0, 2);
    s.out[i1] = true; s.exiledInnocents = 1;
    until(s, () => s.phase === "meeting");
    step(s, [0, 1, 2, 3, 4, 5].filter((v) => !s.out[v]).map((v) => ({ seat: v, i: { k: "vote", target: v === i2 ? p : i2 } as PoachInput })));
    until(s, () => poach.over(s));
    expect(s.winner).toBe("poacher");
  });

  it("results reveal every role, and say what the lake has left", () => {
    const s = make(4, "end");
    until(s, () => poach.over(s), 100000);
    const r = poach.results(s);
    expect((r.roles as string[]).length).toBe(4);
    expect(r.lakeLeft).toBeGreaterThan(0);
    expect(r.highlights.length).toBe(3);
  });
});

describe("bots, for practice only", () => {
  it("a room of bots plays to the end, and a bot's role is still secret from other seats", () => {
    const seats: Seat[] = [{ seat: 0, name: "P0", bot: null, character: "mei" }, ...[1, 2, 3].map((i) => ({ seat: i, name: `B${i} (bot)`, bot: `bot${i}`, character: "jin" as const }))];
    const s = poach.make("botgame", seats, { fish: 220 });
    let r = 1;
    const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    for (let tick = 0; !poach.over(s) && tick < 100000; tick++) {
      const applied: { seat: number; i: PoachInput }[] = [];
      for (const st of seats) if (st.bot) for (const i of poach.bot(s, st.seat, rng)) applied.push({ seat: st.seat, i });
      poach.step(s, applied);
    }
    expect(poach.over(s)).toBe(true);
    expect(JSON.stringify(poach.frameFor(s, 0))).toContain('"role"');
  });
});

it("bays are the four quarters of the lake", () => {
  expect(bayOf(900, 350)).toBe("East Bay");
  expect(bayOf(100, 350)).toBe("West Bay");
  expect(bayOf(500, 60)).toBe("North Bay");
  expect(bayOf(500, 650)).toBe("South Bay");
});

describe("v3.1: the last meeting, the cost of no exile, and the quota", () => {
  const toMeeting = (s: PoachSim, day: number) => until(s, () => s.phase === "meeting" && s.day === day, 100000);

  it("day 3 ends with a last meeting that has no Skip: a skip is refused there", () => {
    const s = make(5, "v31-noskip");
    toMeeting(s, 1);
    expect(poach.input(s, 0, { k: "vote", target: null })).toEqual({ k: "vote", target: null });
    step(s, [0, 1, 2, 3, 4].map((v) => ({ seat: v, i: { k: "vote", target: null } as PoachInput })));
    toMeeting(s, 2);
    step(s, [0, 1, 2, 3, 4].map((v) => ({ seat: v, i: { k: "vote", target: null } as PoachInput })));
    toMeeting(s, 3);
    expect(poach.input(s, 0, { k: "vote", target: null })).toBeNull();
    expect((poach.frameFor(s, 0) as { canSkip: boolean }).canSkip).toBe(false);
  });

  it("skip, skip, then the forced vote ends with an exile", { timeout: 60000 }, () => {
    const s = make(5, "v31-forced");
    for (const day of [1, 2]) { toMeeting(s, day); step(s, [0, 1, 2, 3, 4].map((v) => ({ seat: v, i: { k: "vote", target: null } as PoachInput }))); }
    toMeeting(s, 3);
    const alive = [0, 1, 2, 3, 4].filter((v) => !s.out[v]);
    // a split vote: two for one seat, the rest each for someone different; the most votes go
    const target = alive[0];
    const ev = step(s, alive.map((v, k) => ({ seat: v, i: { k: "vote", target: k < 2 ? (v === target ? alive[1] : target) : alive[(k + 1) % alive.length] } as PoachInput })));
    ev.push(...until(s, () => poach.over(s)));
    expect(ev.find((e) => e.k === "exiled")).toBeDefined();
    expect(ev.find((e) => e.k === "noexile")).toBeUndefined();
  });

  it("a tie in the last meeting still exiles one of the tied, drawn by the server", { timeout: 60000 }, () => {
    const s = make(4, "v31-tie");
    for (const day of [1, 2]) { toMeeting(s, day); step(s, [0, 1, 2, 3].map((v) => ({ seat: v, i: { k: "vote", target: null } as PoachInput }))); }
    toMeeting(s, 3);
    const ev = step(s, [{ seat: 0, i: { k: "vote", target: 1 } }, { seat: 1, i: { k: "vote", target: 0 } }, { seat: 2, i: { k: "vote", target: 1 } }, { seat: 3, i: { k: "vote", target: 0 } }]);
    ev.push(...until(s, () => poach.over(s)));
    const ex = ev.find((e) => e.k === "exiled") as { seat: number } | undefined;
    expect([0, 1]).toContain(ex?.seat);
  });

  it("a meeting that exiles nobody costs the lake 5 points of health, and the announcement says so", () => {
    const s = make(5, "v31-cost");
    toMeeting(s, 1);
    const h = s.health;
    const ev = step(s, [0, 1, 2, 3, 4].map((v) => ({ seat: v, i: { k: "vote", target: null } as PoachInput })));
    ev.push(...until(s, () => s.phase === "day"));
    expect(s.health).toBeCloseTo(h - POACH.NO_EXILE_COST, 5);
    const no = ev.find((e) => e.k === "noexile") as unknown as { cost: number; reason: string };
    expect(no.cost).toBe(POACH.NO_EXILE_COST);
    expect(no.reason).toBe("unwatched"); // poach.js words it: "the poacher worked the night unwatched"
  });

  it("results show each fisher's contribution to the quota", { timeout: 60000 }, () => {
    const s = make(4, "v31-quota");
    for (let i = 0; i < 300; i++) step(s, i % 10 === 0 ? [0, 1, 2, 3].map((v) => ({ seat: v, i: { k: "cast" } as PoachInput })) : []);
    until(s, () => poach.over(s), 100000);
    const r = poach.results(s);
    const quota = r.seats.map((x) => x.quota as number);
    expect(quota.reduce((a, b) => a + b, 0)).toBe(s.quota);
    expect(r.seats.every((x) => typeof x.quota === "number")).toBe(true);
  });
});
