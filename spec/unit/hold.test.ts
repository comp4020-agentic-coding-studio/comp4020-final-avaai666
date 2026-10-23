import { describe, expect, it } from "vitest";
import { botStream, replay, type Seat } from "../../src/lib/game-platform.ts";
import { chooseFor, cormTarget, hold, holdForecast, type HoldInput, type HoldSim, lakeFish, legal, nbrs } from "../../src/lib/modes/hold.ts";
import { HOLD as Q } from "../../src/lib/game-constants.ts";
import { ISLAND, K, nr, tierOf } from "../../src/lib/lake-world.ts";

// Lake Holdings 2.0 (DESIGN.md "Lake Holdings 抢地盘经营 (2.0)"), pure logic.
const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const botsOf = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));
const LAKE = { fish: 280, adults: 224, young: 56 };
const make = (seed = "hold-test", n = 2): HoldSim => hold.make(seed, people(n), LAKE);
const step = (s: HoldSim, inputs: { seat: number; i: HoldInput }[] = []) => hold.step(s, inputs);
const until = (s: HoldSim, pred: () => boolean, max = 20000) => { for (let k = 0; k < max && !pred(); k++) step(s); };
const place = (s: HoldSim, seat: number, card: string, tile: number) => hold.input(s, seat, { k: "place", card, tile });
const firstLegal = (s: HoldSim, seat: number, card: string) => legal(s, seat, card as never)[0];

describe("the board", () => {
  it("hexes of 8.4 over the lake: every centre within 0.8 of the way to the shore, none on the island; caps by water type", () => {
    const s = make();
    expect(s.tiles.length).toBeGreaterThan(40);
    for (const tl of s.tiles) {
      expect(nr(tl.x, tl.y)).toBeLessThanOrEqual(Q.IN_LAKE);
      expect(Math.hypot(tl.x - ISLAND.x, tl.y - ISLAND.y)).toBeGreaterThanOrEqual(ISLAND.r + 2);
      expect(tl.cap).toBeGreaterThanOrEqual(4);
      expect(tl.fish).toBeLessThanOrEqual(tl.cap);
    }
    const deep = s.tiles.find((tl) => tl.zone === "deep")!, open = s.tiles.find((tl) => tl.zone === "open")!;
    expect(deep.cap).toBeGreaterThanOrEqual(open.cap);
    expect(Math.abs(lakeFish(s) - 280)).toBeLessThan(s.tiles.length); // the room's fish, spread by weight (rounding aside)
  });
  it("each player starts with two tiles, next to each other, near their dock", () => {
    const s = make("start", 4);
    for (let seat = 0; seat < 4; seat++) {
      const mine = s.tiles.filter((tl) => tl.owner === seat);
      expect(mine.length).toBe(2);
      expect(nbrs(s, mine[0]).includes(mine[1])).toBe(true);
    }
  });
});

describe("a move", () => {
  it("a hand is always the Flag plus two drawn cards; only the owner sees it", () => {
    const s = make("hand", 3);
    for (const p of s.players) { expect(p.hand[0]).toBe("claim"); expect(p.hand.length).toBe(3); }
    const f0 = hold.frameFor(s, 0) as { me: { hand: string[] } };
    expect(f0.me.hand).toEqual(s.players[0].hand);
    expect(JSON.stringify(hold.frameFor(s, 1))).not.toContain(JSON.stringify(s.players[0].hand));
  });
  it("a Flag goes only on an empty tile next to yours; a building only on your own empty tile", () => {
    const s = make("legal", 2);
    const own = s.tiles.find((tl) => tl.owner === 0)!, other = s.tiles.find((tl) => tl.owner === 1)!;
    const empty = s.tiles.find((tl) => tl.owner < 0 && !nbrs(s, tl).some((x) => x.owner === 0))!;
    expect(place(s, 0, "claim", empty.ix)).toBeNull();
    expect(place(s, 0, "claim", firstLegal(s, 0, "claim").ix)).not.toBeNull();
    s.players[0].hand = ["claim", "net", "pond"];
    expect(place(s, 0, "net", other.ix)).toBeNull();
    expect(place(s, 0, "net", own.ix)).not.toBeNull();
    expect(place(s, 0, "fence", own.ix)).toBeNull(); // not in the hand
  });
  it("picks are secret until everyone has chosen, then revealed together; two flags on one tile go to the player with fewer tiles", () => {
    const s = make("reveal", 2);
    // give seat 1 an extra tile, then both claim the same tile next to both
    const shared = s.tiles.find((tl) => tl.owner < 0 && legal(s, 0, "claim").includes(tl))!;
    const extra = s.tiles.find((tl) => tl.owner < 0 && tl !== shared)!; extra.owner = 1;
    const nb = nbrs(s, shared).find((x) => x.owner < 0)!; nb.owner = 1;
    step(s, [{ seat: 0, i: place(s, 0, "claim", shared.ix)! }]);
    expect(JSON.stringify(hold.frameFor(s, 1))).not.toContain(`"tile":${shared.ix}`);
    expect((hold.frameFor(s, 1) as { p: { picked: boolean }[] }).p[0].picked).toBe(true);
    step(s, [{ seat: 1, i: place(s, 1, "claim", shared.ix)! }]);
    expect(s.phase).toBe("reveal");
    expect(shared.owner).toBe(0);
    expect(s.reveal.find((r) => r.seat === 1)!.lost).toBe(true);
  });
  it("after 20 s without a choice, the bot's choice is played for you", () => {
    const s = make("timeout", 2);
    until(s, () => s.phase !== "pick");
    expect(s.t).toBeCloseTo(Q.PICK_S, 1);
    expect(s.players.every((p) => p.pick !== undefined)).toBe(true);
  });
});

describe("the harvest", () => {
  // play the season's three moves with everyone passing, so only the harvest changes the board
  const toHarvest = (s: HoldSim) => { for (let a = 0; a < Q.ACTIONS; a++) { until(s, () => s.phase === "pick"); for (const p of s.players) p.pick = null; step(s); until(s, () => s.phase !== "reveal"); } };
  it("nets take up to 7, every other tile you hold that is not dry gives 2, a pond adds 2 here and 1 around", () => {
    const s = make("harvest", 2);
    const [a, b] = s.tiles.filter((tl) => tl.owner === 0);
    a.build = "net"; a.fish = 9; b.fish = 5;
    const far = s.tiles.find((tl) => tl.owner < 0 && !nbrs(s, tl).includes(a) && !nbrs(s, tl).includes(b) && nbrs(s, tl).every((x) => x.owner < 0))!;
    far.build = "pond"; const ring = nbrs(s, far).map((x) => [x, x.fish] as const), before = far.fish;
    toHarvest(s);
    until(s, () => s.harvestStep >= 3);
    expect(s.players[0].fish).toBe(7 + 2);
    expect(far.fish).toBeGreaterThanOrEqual(Math.min(far.cap, before + Q.POND_SELF) - 0); // before breeding moves it again
    for (const [x, f] of ring) if (x.owner < 0 && x.build === null) expect(x.fish).toBeGreaterThanOrEqual(Math.min(x.cap, f + Q.POND_NEAR) - (x.fish === 0 ? 1 : 0));
  });
  it("empty water runs dry and stays dry unless a pond is next to it", () => {
    const s = make("dry", 2);
    const tl = s.tiles.find((x) => x.owner < 0 && nbrs(s, x).every((n) => n.build === null))!;
    tl.fish = 0;
    toHarvest(s); until(s, () => s.phase !== "harvest");
    expect(tl.dry).toBe(true);
    const f = holdForecast(s);
    const n = nbrs(s, tl)[0]; n.build = "pond";
    expect(holdForecast(s)).toBeGreaterThanOrEqual(f); // a pond beside it brings it back in the forecast
  });
  it("a cormorant steals 2 from the richest unprotected neighbour net within 2 tiles; a fence protects it", () => {
    const s = make("corm", 2);
    const net = s.tiles.find((tl) => tl.owner === 1)!; net.build = "net"; net.fish = 8;
    const perch = s.tiles.find((tl) => tl.owner < 0 && Math.abs(tl.q - net.q) + Math.abs(tl.r - net.r) + Math.abs(tl.q + tl.r - net.q - net.r) <= 4)!;
    perch.owner = 0; perch.build = "corm";
    expect(cormTarget(s, perch, 0)).toBe(net);
    const fence = nbrs(s, net).find((x) => x !== perch)!; fence.owner = 1; fence.build = "fence";
    expect(cormTarget(s, perch, 0)).toBeNull();
  });
  it("four seasons of three moves, then the end; next spring is the forecast, at most K, and sets the tier", () => {
    const s = make("year", 2);
    until(s, () => hold.over(s), 60000);
    expect(s.season).toBe(Q.SEASONS);
    const r = hold.results(s);
    expect(r.lakeLeft).toBe(holdForecast(s));
    expect(r.lakeLeft).toBeLessThanOrEqual(K);
    expect(hold.breeds).toBe(true);
    const p0 = s.players[0], tiles = s.tiles.filter((tl) => tl.owner === 0).length;
    expect(r.seats.find((x) => x.seat === 0)!.score).toBe(Math.round((p0.fish + tiles * Q.TILE_PTS) * tierOf(r.lakeLeft).mult));
  });
});

describe("bots and replay", () => {
  it("a bot only ever plays a legal card on a legal tile", () => {
    const s = make("botlegal", 4);
    for (let seat = 0; seat < 4; seat++) { const c = chooseFor(s, seat, () => 0.5); if (c) expect(legal(s, seat, c.card).includes(c.tile)).toBe(true); }
  });
  it("bots play whole matches, and a replay of the stored inputs is exact", () => {
    for (const seed of ["hb-a", "hb-b"]) {
      const seats = botsOf(4), s = hold.make(seed, seats, LAKE);
      const inputs = new Map<number, { seat: number; i: unknown }[]>();
      for (let tick = 0; !hold.over(s) && tick < 40000; tick++) {
        const applied: { seat: number; i: HoldInput }[] = [];
        for (const st of seats) for (const raw of hold.bot(s, st.seat, botStream(seed, st.bot!, tick, st.seat))) { const ok = hold.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok }); }
        if (applied.length) inputs.set(tick, applied);
        hold.step(s, applied);
      }
      expect(hold.over(s)).toBe(true);
      expect(hold.results(replay(hold, seed, seats, LAKE, inputs))).toEqual(hold.results(s));
    }
  }, 120000);
});
