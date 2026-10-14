import { describe, expect, it } from "vitest";
import type { Seat } from "../../src/lib/game-platform.ts";
import { HOLD } from "../../src/lib/game-constants.ts";
import { hold, neighbours, type HoldInput, type HoldSim } from "../../src/lib/modes/hold.ts";

// Lake Holdings, "holdings 1.0" (DESIGN.md "Lake Holdings"): a hex lake, a
// seeded current, schools drifting along it, a tide every 15 s for 3
// minutes, and six cards (Net, Pond, Fence, Cormorant, Lantern, Claim). The
// server decides every tile, every catch and every score.

const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const make = (n = 2, seed = "hold-test", fish = 220): HoldSim => hold.make(seed, people(n), { fish });
const step = (s: HoldSim, inputs: { seat: number; i: HoldInput }[] = []) => hold.step(s, inputs);
const toTide = (s: HoldSim) => { const t = s.tides; const ev = []; while (s.tides === t && !hold.over(s)) ev.push(...step(s)); return ev; };
const mine = (s: HoldSim, seat: number) => s.tiles.filter((t) => t.owner === seat);
const give = (s: HoldSim, seat: number, cards: string[]) => { s.hands[seat] = cards as never; };
const emptyNextTo = (s: HoldSim, seat: number) => s.tiles.find((t) => t.owner === -1 && neighbours(s, t.id).some((n) => s.tiles[n].owner === seat))!;

describe("the board and the clock", () => {
  it("a hex lake; each player starts with 3 shore tiles and 3 cards", () => {
    const s = make(4);
    expect(s.tiles.length).toBeGreaterThan(60);
    for (let p = 0; p < 4; p++) { expect(mine(s, p).length).toBe(3); expect(s.hands[p].length).toBe(3); }
  });
  it("a tide every 15 s, twelve in three minutes", () => {
    const s = make();
    let tides = 0;
    while (!hold.over(s)) { for (const e of step(s)) if (e.k === "tide") tides++; }
    expect(tides).toBe(HOLD.TIDES);
    expect(s.t).toBeCloseTo(HOLD.TIDES * HOLD.TIDE_S, 1);
  }, 20000);
  it("the current comes from the seed, and schools drift along it", () => {
    expect(make(2, "a").tiles.map((t) => t.dir).join()).not.toBe(make(2, "b").tiles.map((t) => t.dir).join());
    const s = make();
    const before = s.schools.map((sc) => sc.tile);
    toTide(s);
    const moved = s.schools.filter((sc, i) => before[i] !== undefined && sc.tile !== before[i]);
    expect(moved.length).toBeGreaterThan(0);
  });
});

describe("cards", () => {
  it("Claim takes empty water next to yours, and only next to yours", () => {
    const s = make();
    give(s, 0, ["claim", "claim", "net"]);
    const t = emptyNextTo(s, 0);
    const far = s.tiles.find((x) => x.owner === -1 && !neighbours(s, x.id).some((n) => s.tiles[n].owner === 0))!;
    step(s, [{ seat: 0, i: { k: "play", card: "claim", tile: far.id } }]);
    expect(far.owner).toBe(-1);
    step(s, [{ seat: 0, i: { k: "play", card: "claim", tile: t.id } }]);
    expect(t.owner).toBe(0);
    expect(s.hands[0]).toEqual(["claim", "net"]);
  });
  it("taking an enemy tile costs two cards", () => {
    const s = make();
    const enemy = mine(s, 1)[0];
    // make one of seat 0's tiles border it
    const n = neighbours(s, enemy.id).find((x) => s.tiles[x].owner === -1)!;
    s.tiles[n].owner = 0;
    give(s, 0, ["claim"]);
    step(s, [{ seat: 0, i: { k: "play", card: "claim", tile: enemy.id } }]);
    expect(enemy.owner).toBe(1); // one card is not enough
    give(s, 0, ["claim", "pond"]);
    step(s, [{ seat: 0, i: { k: "play", card: "claim", tile: enemy.id } }]);
    expect(enemy.owner).toBe(0);
    expect(s.hands[0]).toEqual([]);
  });
  it("buildings go only on your own water, and only from your hand", () => {
    const s = make();
    give(s, 0, ["net"]);
    step(s, [{ seat: 0, i: { k: "play", card: "net", tile: mine(s, 1)[0].id } }]);
    expect(s.tiles.some((t) => t.building)).toBe(false);
    step(s, [{ seat: 0, i: { k: "play", card: "pond", tile: mine(s, 0)[0].id } }]);
    expect(mine(s, 0)[0].building).toBeNull();
    step(s, [{ seat: 0, i: { k: "play", card: "net", tile: mine(s, 0)[0].id } }]);
    expect(mine(s, 0)[0].building).toBe("net");
  });
  it("hands draw back to 3 after each tide", () => {
    const s = make();
    give(s, 0, ["net"]);
    step(s, [{ seat: 0, i: { k: "play", card: "net", tile: mine(s, 0)[0].id } }]);
    expect(s.hands[0].length).toBe(0);
    toTide(s);
    expect(s.hands[0].length).toBe(3);
  });
  it("the server rejects a card that is not one of the six, and a tile that does not exist", () => {
    const s = make();
    expect(hold.input(s, 0, { k: "play", card: "dragon", tile: 0 })).toBeNull();
    expect(hold.input(s, 0, { k: "play", card: "net", tile: 99999 })).toBeNull();
    expect(hold.input(s, 0, { k: "play", card: "fence", tile: 0, dir: 2 })).toEqual({ k: "play", card: "fence", tile: 0, dir: 2 });
  });
});

describe("the tide pays out", () => {
  const withSchoolOn = (s: HoldSim, tile: number, n: number) => { s.schools = [{ id: 999, tile, fish: n }]; };
  it("a net takes from the schools passing it, and the harvest scores", () => {
    const s = make();
    const t = mine(s, 0)[0];
    t.building = "net"; t.by = 0;
    withSchoolOn(s, t.id, 10);
    s.tiles.forEach((x) => { x.dir = -1; }); // still water: the school stays put
    const ev = toTide(s);
    expect(s.harvest[0]).toBe(HOLD.NET_TAKE);
    expect(s.schools[0].fish).toBe(10 - HOLD.NET_TAKE);
    expect(ev.some((e) => e.k === "net" && e.seat === 0)).toBe(true);
  });
  it("a pond breeds fish into the tiles next to it", () => {
    const s = make();
    const t = mine(s, 0)[0];
    t.building = "pond"; t.by = 0;
    s.schools = []; s.tiles.forEach((x) => { x.dir = -1; });
    toTide(s);
    const near = new Set(neighbours(s, t.id));
    expect(s.schools.some((sc) => near.has(sc.tile) && sc.fish > 0)).toBe(true);
  });
  it("a fence turns the current on its tile", () => {
    const s = make();
    const t = mine(s, 0)[0];
    give(s, 0, ["fence"]);
    step(s, [{ seat: 0, i: { k: "play", card: "fence", tile: t.id, dir: 3 } }]);
    expect(t.dir).toBe(3);
  });
  it("a cormorant steals 2 from an enemy net within 2 tiles, once per tide", () => {
    const s = make();
    const a = mine(s, 0)[0];
    const near = neighbours(s, a.id).find((x) => s.tiles[x].owner === -1)!;
    s.tiles[near].owner = 1; s.tiles[near].building = "net"; s.tiles[near].by = 1;
    a.building = "cormorant"; a.by = 0;
    withSchoolOn(s, near, 10); s.tiles.forEach((x) => { x.dir = -1; });
    s.harvest = [0, 0];
    toTide(s);
    expect(s.harvest[0]).toBe(HOLD.CORMORANT);
    expect(s.harvest[1]).toBe(HOLD.NET_TAKE - HOLD.CORMORANT);
  });
  it("a lantern pulls schools within 3 tiles for two tides", () => {
    const s = make();
    const t = mine(s, 0)[0];
    give(s, 0, ["lantern"]);
    step(s, [{ seat: 0, i: { k: "play", card: "lantern", tile: t.id } }]);
    const start = neighbours(s, neighbours(s, t.id)[0]).find((x) => x !== t.id)!;
    withSchoolOn(s, start, 6);
    const d0 = s.dist(start, t.id);
    toTide(s);
    expect(s.dist(s.schools[0].tile, t.id)).toBeLessThan(d0);
    toTide(s); toTide(s);
    expect(t.building).toBeNull(); // gone after two tides
  });
  it("over-netted lanes thin, and the board shows it", () => {
    const s = make(2, "thin");
    const lane = s.tiles.filter((t) => t.owner === -1).slice(0, 4);
    for (const t of lane) { t.owner = 0; t.building = "net"; t.by = 0; }
    s.tiles.forEach((x) => { x.dir = -1; }); // still water: the school sits in the lane
    s.schools = [{ id: 999, tile: lane[0].id, fish: 60 }];
    for (let i = 0; i < 3; i++) toTide(s);
    expect(Math.max(...s.tiles.map((t) => t.netted))).toBeGreaterThan(0);
    const f = hold.frameFor(s, 1) as { tiles: number[][] };
    expect(f.tiles.some((row) => row[6] > 0)).toBe(true); // the thinned mark is sent
  });
  it("each tile shows what it would have paid last tide", () => {
    const s = make();
    toTide(s);
    const f = hold.frameFor(s, 0) as { tiles: number[][] };
    expect(f.tiles[0].length).toBeGreaterThanOrEqual(8);
    expect(f.tiles.some((row) => row[7] > 0)).toBe(true);
  });
});

describe("score and the lake", () => {
  it("score is tiles held plus fish harvested; a tie goes to more harvest", () => {
    const s = make();
    s.harvest = [5, 5];
    for (const t of mine(s, 1)) t.owner = -1;
    const near = s.tiles.filter((t) => t.owner === -1).slice(0, 4);
    for (const t of near) t.owner = 1;
    // seat 0: 3 tiles + 5; seat 1: 4 tiles + 4 harvest -> tie at 8; harvest breaks it
    s.harvest = [5, 4];
    s.t = HOLD.TIDES * HOLD.TIDE_S;
    const r = hold.results(s);
    expect(r.seats[0].score).toBe(8);
    expect(r.seats[1].score).toBe(8);
    expect(r.seats[0].place).toBe(1);
    expect(r.seats[1].place).toBe(2);
    expect(r.highlights.length).toBe(3);
  });
  it("a match starts with the room's lake, and the results say what is left", () => {
    const s = make(2, "lake", 100);
    expect(s.schools.reduce((n, sc) => n + sc.fish, 0)).toBe(100);
    while (!hold.over(s)) step(s);
    expect(hold.results(s).lakeLeft).toBe(s.schools.reduce((n, sc) => n + sc.fish, 0));
  }, 20000);
  it("bots play their cards", () => {
    const seats: Seat[] = [{ seat: 0, name: "P0", bot: null, character: "mei" }, { seat: 1, name: "B (bot)", bot: "bot0", character: "jin" }, { seat: 2, name: "C (bot)", bot: "bot1", character: "lu" }];
    const s = hold.make("bots", seats, { fish: 220 });
    let r = 3; const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    while (!hold.over(s)) { const ins: { seat: number; i: HoldInput }[] = []; for (const st of seats) if (st.bot) for (const i of hold.bot(s, st.seat, rng)) ins.push({ seat: st.seat, i }); step(s, ins); }
    expect(s.tiles.filter((t) => t.owner === 1 || t.owner === 2).length).toBeGreaterThan(6);
    expect(s.harvest[1] + s.harvest[2]).toBeGreaterThan(0);
  }, 20000);
});
