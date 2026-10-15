import { describe, expect, it } from "vitest";
import { botStream, replay, type Seat } from "../../src/lib/game-platform.ts";
import { dockOf, inReeds, rush, type RushInput, type RushSim } from "../../src/lib/modes/rush.ts";
import { RUSH } from "../../src/lib/game-constants.ts";

// Boat Rush, "rush 1.0" (DESIGN.md "Boat Rush"): boat-sim 0.1's rules through
// the Mode interface, plus upgrades, the charge cast, scattering schools, the
// reed shallows, the leader's crown and Lantern Rush. The server decides all
// of these; the browser only sends steer, cast (with how long it was held),
// dash and buy.

const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const make = (seed = "rush-test", n = 2, fish = 220): RushSim => rush.make(seed, people(n), { fish });
const step = (s: RushSim, inputs: { seat: number; i: RushInput }[] = []) => rush.step(s, inputs);
const until = (s: RushSim, t: number) => { while (s.t < t - 1e-9) step(s); };
const put = (s: RushSim, seat: number, x: number, y: number) => { const b = s.boats[seat]; b.x = b.tx = x; b.y = b.ty = y; b.vx = b.vy = 0; };
const dock = (s: RushSim, seat: number) => { const d = dockOf(seat, s.players); put(s, seat, d.x, d.y); step(s); };
const clearFish = (s: RushSim) => { s.fish = []; };
const addFish = (s: RushSim, x: number, y: number, n: number, spread = 6) => { for (let i = 0; i < n; i++) s.fish.push({ id: s.nextId++, x: x + ((i * 7) % 5 - 2) * spread / 2, y: y + ((i * 3) % 5 - 2) * spread / 2, h: 0, adult: true, born: -99, cool: 99, scare: 0, sx: 0, sy: 0 }); };

describe("inputs are validated by the server", () => {
  it("only steer, cast, dash and buy are accepted, steers are clamped and rounded, and a charge is between 0 and 1", () => {
    const s = make();
    expect(rush.input(s, 0, { k: "steer", x: 5000.4, y: -3 })).toEqual({ k: "steer", x: 1000, y: 0 });
    expect(rush.input(s, 0, { k: "cast", charge: 7 })).toEqual({ k: "cast", charge: 1 });
    expect(rush.input(s, 0, { k: "cast" })).toEqual({ k: "cast", charge: 0 });
    expect(rush.input(s, 0, { k: "buy", up: "bigHold" })).toEqual({ k: "buy", up: "bigHold" });
    expect(rush.input(s, 0, { k: "buy", up: "laser" })).toBeNull();
    expect(rush.input(s, 0, { k: "teleport", x: 1, y: 1 })).toBeNull();
    expect(rush.input(s, 0, { k: "steer", x: "a", y: 1 })).toBeNull();
  });
});

describe("upgrades at your dock", () => {
  it("cost banked fish, need you docked, at most two a match, each once", () => {
    const s = make();
    s.boats[0].banked = 40;
    put(s, 0, 500, 350); step(s);
    step(s, [{ seat: 0, i: { k: "buy", up: "bigHold" } }]);
    expect(s.boats[0].ups).toEqual([]); // not docked
    dock(s, 0);
    const ev = step(s, [{ seat: 0, i: { k: "buy", up: "bigHold" } }]);
    expect(ev).toContainEqual(expect.objectContaining({ k: "buy", seat: 0, up: "bigHold" }));
    expect(s.boats[0].banked).toBe(40 - RUSH.UPGRADES.bigHold.cost);
    step(s, [{ seat: 0, i: { k: "buy", up: "bigHold" } }]);
    expect(s.boats[0].ups).toEqual(["bigHold"]); // once
    step(s, [{ seat: 0, i: { k: "buy", up: "fastHull" } }]);
    step(s, [{ seat: 0, i: { k: "buy", up: "wideNet" } }]);
    expect(s.boats[0].ups).toEqual(["bigHold", "fastHull"]); // two at most
  });

  it("cannot be bought with fish you have not banked", () => {
    const s = make();
    dock(s, 0);
    s.boats[0].banked = RUSH.UPGRADES.bigHold.cost - 1;
    step(s, [{ seat: 0, i: { k: "buy", up: "bigHold" } }]);
    expect(s.boats[0].ups).toEqual([]);
  });

  it("Big Hold carries five more", () => {
    const s = make();
    clearFish(s); s.boats[0].ups = ["bigHold"];
    s.boats[0].hold = Array(RUSH.HOLD).fill(1);
    put(s, 0, 500, 350);
    addFish(s, 500 + Math.cos(s.boats[0].h) * RUSH.NET_AHEAD, 350 + Math.sin(s.boats[0].h) * RUSH.NET_AHEAD, 8, 2);
    step(s, [{ seat: 0, i: { k: "cast", charge: 0 } }]);
    until(s, s.t + 1);
    expect(s.boats[0].hold.length).toBe(RUSH.HOLD + 5);
  });

  it("Fast Hull sails faster, and Wide Net takes from further out", () => {
    const a = make("fast"), b = make("fast");
    b.boats[0].ups = ["fastHull"];
    for (const s of [a, b]) { put(s, 0, 300, 350); s.boats[0].tx = 700; }
    for (let i = 0; i < 40; i++) { step(a); step(b); }
    expect(b.boats[0].x - 300).toBeGreaterThan((a.boats[0].x - 300) * 1.1);
    expect(RUSH.NET_R * RUSH.UPGRADES.wideNet.net!).toBeGreaterThan(RUSH.NET_R);
  });
});

describe("rams", () => {
  const rammed = (setup: (s: RushSim) => void) => {
    const s = make("ram", 2);
    clearFish(s);
    setup(s);
    put(s, 1, 500, 350); put(s, 0, 500 - 20, 350);
    step(s); // the crown is settled at the end of a step
    s.boats[1].hold = Array(8).fill(1);
    put(s, 1, 500, 350); put(s, 0, 500 - 20, 350);
    s.boats[0].tx = 600; s.boats[0].ty = 350;
    const ev = step(s, [{ seat: 0, i: { k: "dash" } }]);
    const all = [...ev]; for (let i = 0; i < 4; i++) all.push(...step(s));
    return { s, ram: all.find((e) => e.k === "ram") as { n: number } | undefined };
  };
  it("a ram spills at most three, and shields the boat it hit", () => {
    const { s, ram } = rammed(() => {});
    expect(ram?.n).toBe(RUSH.RAM_DROP);
    expect(s.boats[1].shield).toBeGreaterThan(0);
  });
  it("Iron Bow spills one more when you ram, and one fewer when you are rammed", () => {
    expect(rammed((s) => { s.boats[0].ups = ["ironBow"]; }).ram?.n).toBe(RUSH.RAM_DROP + 1);
    expect(rammed((s) => { s.boats[1].ups = ["ironBow"]; }).ram?.n).toBe(RUSH.RAM_DROP - 1);
  });
  it("ramming the crowned leader spills one more", () => {
    const { s, ram } = rammed((s) => { s.boats[1].banked = 10; });
    expect(s.crown).toBe(1);
    expect(ram?.n).toBe(RUSH.RAM_DROP + 1);
  });
  it("no crown while the lead is shared", () => {
    const s = make();
    s.boats[0].banked = 5; s.boats[1].banked = 5; step(s);
    expect(s.crown).toBeNull();
    s.boats[1].banked = 6; step(s);
    expect(s.crown).toBe(1);
  });
  it("no ram lands near a dock", () => {
    const s = make("dockram", 2);
    clearFish(s);
    s.boats[1].hold = Array(8).fill(1);
    const d = dockOf(1, 2);
    put(s, 1, d.x, d.y + 40); put(s, 0, d.x - 20, d.y + 40); s.boats[0].tx = d.x + 100;
    const all = [...step(s, [{ seat: 0, i: { k: "dash" } }])]; for (let i = 0; i < 4; i++) all.push(...step(s));
    expect(all.some((e) => e.k === "ram")).toBe(false);
  });
});

describe("the charge cast and the schools", () => {
  it("a full charge widens the net to 1.6 times, and it sinks 0.3 s slower", () => {
    const s = make();
    put(s, 0, 500, 350);
    const ev = step(s, [{ seat: 0, i: { k: "cast", charge: 1 } }]);
    const cast = ev.find((e) => e.k === "cast") as unknown as { r: number };
    expect(cast.r).toBeCloseTo(RUSH.NET_R * 1.6);
    expect(s.nets[0].closeAt - s.t).toBeCloseTo(RUSH.SINK + 0.3 - RUSH.DT, 5);
  });

  it("a wider net catches fish a plain net misses", () => {
    const catchWith = (charge: number) => {
      const s = make("charge"); clearFish(s); put(s, 0, 500, 350);
      step(s, [{ seat: 0, i: { k: "cast", charge } }]);
      const net = s.nets[0];
      // just before the net closes, four grown fish sit at 1.3 plain radii from its centre
      while (net.closeAt > s.t + 1e-9) step(s);
      clearFish(s); addFish(s, net.x + RUSH.NET_R * 1.3, net.y, 4, 1);
      step(s); // the net closes in this step
      return s.boats[0].hold.length;
    };
    expect(catchWith(0)).toBe(0);
    expect(catchWith(1)).toBeGreaterThan(0);
  });

  it("a school scatters after a net hits it", () => {
    const s = make("scatter"); clearFish(s); put(s, 0, 500, 350);
    const bx = 500 + Math.cos(s.boats[0].h) * RUSH.NET_AHEAD, by = 350 + Math.sin(s.boats[0].h) * RUSH.NET_AHEAD;
    addFish(s, bx + RUSH.NET_R * 1.5, by, 6, 2);
    step(s, [{ seat: 0, i: { k: "cast", charge: 0 } }]);
    for (const f of s.fish) f.scare = 0;
    until(s, s.t + RUSH.SINK + 0.1);
    expect(s.fish.filter((f) => f.scare > 0).length).toBeGreaterThan(0);
  });
});

describe("the reed shallows", () => {
  it("boats there sail at half speed", () => {
    const a = make("reed"), b = make("reed");
    const r = RUSH.REEDS[0];
    put(a, 0, 500, 350); a.boats[0].tx = 600;
    put(b, 0, r.x, r.y); b.boats[0].tx = r.x + 100;
    expect(inReeds(r.x, r.y)).toBe(true);
    for (let i = 0; i < 6; i++) { step(a); step(b); }
    expect(b.boats[0].x - r.x).toBeLessThan((a.boats[0].x - 500) * 0.6);
  });
  it("hold more fish than open water at the start", () => {
    const s = make("reedfish", 4);
    const inR = s.fish.filter((f) => inReeds(f.x, f.y)).length;
    const area = RUSH.REEDS.reduce((n, r) => n + Math.PI * r.r * r.r, 0), lake = Math.PI * RUSH.RX * RUSH.RY;
    expect(inR / s.fish.length).toBeGreaterThan((area / lake) * 1.5);
  });
});

describe("Lantern Rush and the horn", { timeout: 30000 }, () => {
  it("fish banked in the last 30 seconds count double", () => {
    const s = make();
    until(s, RUSH.SECONDS - RUSH.LANTERN_S - 1);
    const before = s.boats[0].banked;
    s.boats[0].hold = [1, 1];
    dock(s, 0); until(s, s.t + 0.5);
    expect(s.boats[0].banked - before).toBe(2);
    until(s, RUSH.SECONDS - RUSH.LANTERN_S + 1);
    s.boats[0].hold = [1, 1];
    const d = dockOf(0, 2); put(s, 0, d.x + 200, d.y - 100); step(s); step(s);
    const mid = s.boats[0].banked;
    dock(s, 0); until(s, s.t + 0.5);
    expect(s.boats[0].banked - mid).toBe(4);
  });
  it("a match lasts two and a half minutes, and fish aboard at the horn count for nothing", () => {
    const s = make();
    s.boats[0].hold = [1, 1, 1];
    put(s, 0, 500, 350);
    while (!rush.over(s)) step(s);
    expect(s.t).toBeCloseTo(150);
    const r = rush.results(s);
    expect(r.seats[0].score).toBe(0);
    expect(r.highlights.length).toBe(3);
  });
});

describe("the lake and the record", { timeout: 30000 }, () => {
  it("a match starts with the room's lake, and the results say what is left", () => {
    const s = make("lake", 2, 90);
    expect(s.fish.length).toBe(90);
    s.fish.splice(0, 30);
    while (!rush.over(s)) step(s);
    expect(rush.results(s).lakeLeft).toBe(s.fish.length + s.loose.filter((l) => l.value === 1).length);
  });
  it("replaying the inputs, bots included, gives the same results", () => {
    const seats: Seat[] = [{ seat: 0, name: "P0", bot: null, character: "mei" }, { seat: 1, name: "Jin (bot)", bot: "bot0", character: "jin" }, { seat: 2, name: "Lu (bot)", bot: "bot1", character: "lu" }];
    const s = rush.make("bots", seats, { fish: 220 });
    const log = new Map<number, { seat: number; i: unknown }[]>();
    for (let tick = 0; !rush.over(s); tick++) {
      const applied: { seat: number; i: RushInput }[] = tick % 30 === 0 ? [{ seat: 0, i: { k: "cast", charge: 0.5 } }] : [];
      for (const st of seats) if (st.bot) for (const i of rush.bot(s, st.seat, botStream("bots", st.bot, tick, st.seat))) applied.push({ seat: st.seat, i });
      if (applied.length) log.set(tick, applied);
      rush.step(s, applied);
    }
    const again = replay(rush, "bots", seats, { fish: 220 }, log);
    expect(rush.results(again)).toEqual(rush.results(s));
    expect(rush.results(s).seats.slice(1).some((x) => x.score > 0)).toBe(true); // the bots fish
  });
  it("every boat sees the same frame: Boat Rush has no secrets", () => {
    const s = make();
    expect(JSON.stringify(rush.frameFor(s, 0))).toBe(JSON.stringify(rush.frameFor(s, 1)));
  });
});

describe("v3.1 prices: the first upgrade costs 3, the second 7", () => {
  it("whichever upgrade is first costs 3 banked fish, and the second costs 7", () => {
    for (const [a, b] of [["fastHull", "bigHold"], ["ironBow", "wideNet"]] as const) {
      const s = make();
      dock(s, 0);
      s.boats[0].banked = 10;
      step(s, [{ seat: 0, i: { k: "buy", up: a } }]);
      expect(s.boats[0].banked).toBe(10 - RUSH.FIRST_UP_COST);
      step(s, [{ seat: 0, i: { k: "buy", up: b } }]);
      expect(s.boats[0].banked).toBe(10 - RUSH.FIRST_UP_COST - RUSH.SECOND_UP_COST);
      expect(s.boats[0].ups).toEqual([a, b]);
    }
    expect(RUSH.FIRST_UP_COST).toBe(3);
    expect(RUSH.SECOND_UP_COST).toBe(7);
  });
  it("a second upgrade needs 7 banked", () => {
    const s = make();
    dock(s, 0);
    s.boats[0].banked = 3 + 6;
    step(s, [{ seat: 0, i: { k: "buy", up: "wideNet" } }]);
    step(s, [{ seat: 0, i: { k: "buy", up: "fastHull" } }]);
    expect(s.boats[0].ups).toEqual(["wideNet"]);
    expect(s.boats[0].banked).toBe(6);
  });
  it("the frame tells a boat what its next upgrade costs", () => {
    const s = make();
    const b = (rush.frameFor(s, 0) as { b: unknown[][] }).b[0];
    expect(b[13]).toBe(RUSH.FIRST_UP_COST);
  });
});
