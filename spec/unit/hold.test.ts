import { describe, expect, it } from "vitest";
import { botStream, replay, type Seat } from "../../src/lib/game-platform.ts";
import { HOLD as Q } from "../../src/lib/game-constants.ts";
import { boardFor, haulOf, hold, type HoldInput, type HoldSim, lakeFish, tollOf } from "../../src/lib/modes/hold.ts";
import { K, makeLake, nextSpring, tierOf } from "../../src/lib/lake-world.ts";

// Lake Holdings 3.0 (DESIGN.md "Lake Holdings 湖上大富翁 (3.0)"; Ava, 24 Oct: "like Monopoly"). These
// replace holdings 2.0's tests: that design (the hex board and the cards) is gone, kept word for word in
// docs/design-history/holdings-v2.0.md.

const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const make = (seed = "h3", n = 4, fish = 280): HoldSim => hold.make(seed, people(n), { fish, adults: Math.round(fish * 0.8), young: Math.round(fish * 0.2), boats: n });
const step = (s: HoldSim, inputs: { seat: number; i: HoldInput }[] = []) => hold.step(s, inputs);
const until = (s: HoldSim, done: () => boolean, max = 5000) => { for (let k = 0; k < max && !done(); k++) step(s); };
const act = (s: HoldSim, seat: number, raw: unknown) => { const i = hold.input(s, seat, raw); if (i) step(s, [{ seat, i }]); return i; };
// put the player whose turn it is on square `sq`, as if they had sailed there, and let it act
function landOn(s: HoldSim, sq: number): void {
  s.players[s.turn].pos = sq; s.phase = "move"; s.phaseT = 0; s.moveS = 0; s.path = [sq];
  step(s);
}

describe("the board", () => {
  it("24 squares round the lake: a home at each player's dock, the Lake Spirit between, grounds in groups of at most 3", () => {
    for (const n of [2, 3, 4]) {
      const L = makeLake(n), b = boardFor(L, n);
      expect(b.length).toBe(Q.SQUARES);
      const homes = b.filter((q) => q.type === "home");
      expect(homes.map((q) => q.home).sort()).toEqual(Array.from({ length: n }, (_, i) => i));
      for (const h of homes) expect(Math.abs((((h.a - L.dockPos(h.home).a) % 360) + 540) % 360 - 180)).toBeLessThanOrEqual(7.5); // at its dock
      expect(b.filter((q) => q.type === "spirit").length).toBe(n);
      const sizes = new Map<number, number>(); for (const q of b) if (q.type === "ground") sizes.set(q.group, (sizes.get(q.group) ?? 0) + 1);
      for (const v of sizes.values()) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(3); }
      for (const q of b) expect(L.nr(q.x, q.y)).toBeCloseTo(Q.RING_K, 6); // just in from the shore
      const prices = b.filter((q) => q.type === "ground").map((q) => q.price);
      expect(Math.min(...prices)).toBe(Q.PRICE_BASE); expect(Math.max(...prices)).toBeLessThanOrEqual(Q.PRICE_BASE + 5);
    }
  });

  it("the room's fish are spread over the grounds, and everyone starts at home with 15 coins", () => {
    const s = make("start", 4, 280);
    expect(lakeFish(s)).toBe(280); expect(s.start).toBe(280);
    for (const p of s.players) { expect(s.squares[p.pos].home).toBe(p.seat); expect(p.coins).toBe(Q.START_COINS); }
    expect(s.phase).toBe("roll"); expect(s.turn).toBe(0);
  });
});

describe("a turn", () => {
  it("only the player whose turn it is may roll; the die sails them 1-6 squares, and passing their own home pays 3", () => {
    const s = make("roll");
    expect(hold.input(s, 1, { k: "roll" })).toBeNull();
    const p = s.players[0], from = p.pos;
    act(s, 0, { k: "roll" });
    expect(s.roll).toBeGreaterThanOrEqual(1); expect(s.roll).toBeLessThanOrEqual(6);
    expect(p.pos).toBe((from + s.roll!) % Q.SQUARES);
    expect(s.phase).toBe("move");
    // a full lap from just before home: passing it pays
    const s2 = make("lap"); const q = s2.players[0]; q.pos = (q.pos + Q.SQUARES - 1) % Q.SQUARES; const coins = q.coins;
    act(s2, 0, { k: "roll" });
    expect(q.coins).toBe(coins + Q.HOME_PAY);
  });

  it("a ground nobody owns can be bought, or left; a toll is paid to its owner, double for a whole group", () => {
    const s = make("buy"), g = s.squares.find((q) => q.type === "ground")!;
    landOn(s, g.ix);
    expect(s.phase).toBe("act"); expect(s.act).toEqual(["buy", "pass"]);
    const before = s.players[0].coins;
    act(s, 0, { k: "buy" });
    expect(g.owner).toBe(0); expect(s.players[0].coins).toBe(before - g.price);
    until(s, () => s.turn === 1 && s.phase === "roll");
    const p1 = s.players[1], p0 = s.players[0], c1 = p1.coins, c0 = p0.coins;
    landOn(s, g.ix);
    expect(p1.coins).toBe(c1 - Q.TOLL.none); expect(p0.coins).toBe(c0 + Q.TOLL.none);
    for (const q of s.squares) if (q.type === "ground" && q.group === g.group) q.owner = 0;
    expect(tollOf(s, g)).toBe(Q.TOLL.none * 2);
  });

  it("your own ground: haul it (its fish, a coin each), or build a net or a pond; a hauled ground keeps less", () => {
    const s = make("own"), g = s.squares.find((q) => q.type === "ground")!; g.owner = 0;
    landOn(s, g.ix);
    expect(s.act).toEqual(["haul", "net", "pond", "pass"]);
    const stock = g.stock, coins = s.players[0].coins;
    act(s, 0, { k: "haul" });
    expect(g.stock).toBe(stock - Q.HAUL.none); expect(s.players[0].coins).toBe(coins + Q.HAUL.none);
    g.build = "net"; expect(haulOf(g)).toBe(Math.min(g.stock, Q.HAUL.net));
    const s2 = make("own2"), g2 = s2.squares.find((q) => q.type === "ground")!; g2.owner = 0; landOn(s2, g2.ix);
    act(s2, 0, { k: "build", kind: "pond" });
    expect(g2.build).toBe("pond"); expect(s2.players[0].coins).toBe(Q.START_COINS - Q.BUILD_COST);
  });

  it("a choice nobody makes is a pass, and a roll nobody makes is made for them", () => {
    const s = make("clock");
    until(s, () => s.phase !== "roll");
    expect(s.roll).not.toBeNull(); // rolled for them at ROLL_S
    const s2 = make("clock2"), g = s2.squares.find((q) => q.type === "ground")!;
    landOn(s2, g.ix);
    until(s2, () => s2.phase !== "act");
    expect(g.owner).toBe(-1); // not bought
  });
});

describe("the lake", () => {
  it("after every round each ground breeds (an empty one stays empty unless it has a pond)", () => {
    const s = make("breed", 2), gs = s.squares.filter((q) => q.type === "ground");
    gs[0].stock = 10; gs[1].stock = 0; gs[2].stock = 0; gs[2].build = "pond";
    until(s, () => s.round === 2, 20000);
    expect(gs[0].stock).toBe(Math.min(Q.CAP, 10 + Math.round(Q.BREED * 10 * (1 - 10 / Q.CAP))));
    expect(gs[1].stock).toBe(0);
    expect(gs[2].stock).toBe(Q.POND_BREED);
  });

  it("a lake below 15% of K after a round has died: the match ends and the tier is No fish", () => {
    const s = make("dead", 2);
    for (const q of s.squares) if (q.type === "ground") q.stock = 1;
    until(s, () => s.phase === "end", 20000);
    expect(s.ended).toBe("dead");
    const r = hold.results(s);
    expect(r.tier).toBe("none");
  });

  it("after every round each net hauls its ground for its owner and each pond pays its owner", () => {
    const s = make("nets", 2), gs = s.squares.filter((q) => q.type === "ground");
    gs[0].owner = 0; gs[0].build = "net"; gs[0].stock = 15; gs[1].owner = 1; gs[1].build = "pond"; gs[1].stock = 10;
    const ev: { k: string; list?: number[][] }[] = [];
    for (let k = 0; k < 20000 && s.round === 1; k++) ev.push(...(step(s) as typeof ev));
    expect(ev.find((e) => e.k === "nets")!.list).toEqual([[gs[0].ix, 0, Q.NET_ROUND]]);
    expect(ev.find((e) => e.k === "ponds")!.list).toEqual([[gs[1].ix, 1, Q.POND_PAY]]);
  });

  it("before rolling you may build on one of your own empty grounds, anywhere on the board", () => {
    const s = make("pre"), g = s.squares.find((q) => q.type === "ground")!; g.owner = 0;
    expect(hold.input(s, 1, { k: "build", kind: "net", sq: g.ix })).toBeNull(); // not your turn
    expect(act(s, 0, { k: "build", kind: "pond", sq: g.ix })).not.toBeNull();
    expect(g.build).toBe("pond"); expect(s.players[0].coins).toBe(Q.START_COINS - Q.BUILD_COST);
    expect(s.phase).toBe("roll");
    const h = s.squares.filter((q) => q.type === "ground")[1]; h.owner = 0;
    expect(hold.input(s, 0, { k: "build", kind: "net", sq: h.ix })).toBeNull(); // one a turn
  });

  it("after 8 rounds: coins + 2 a ground + 2 a building + 1 a fish on your grounds, times next spring's tier", () => {
    const s = make("end", 2);
    s.squares.find((q) => q.type === "ground")!.owner = 0;
    until(s, () => s.phase === "end", 60000);
    expect(s.ended).toBe("rounds"); expect(s.round).toBe(Q.ROUNDS);
    const r = hold.results(s), tier = tierOf(nextSpring(lakeFish(s)));
    const p0 = s.players[0], g0 = s.squares.filter((q) => q.owner === 0);
    expect(r.seats[0].score).toBe(Math.round((p0.coins + g0.length * Q.GROUND_PTS + g0.filter((q) => q.build).length * Q.BUILD_PTS + g0.reduce((n, q) => n + q.stock, 0) * Q.FISH_PTS) * tier.mult));
    expect(r.lakeLeft).toBe(lakeFish(s));
    expect(r.highlights.length).toBe(3);
  });
});

describe("bots and replay", () => {
  const seats = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));
  function playOut(seed: string, n = 4) {
    const st = seats(n), s = hold.make(seed, st, { fish: 280, adults: 224, young: 56, boats: n });
    const inputs = new Map<number, { seat: number; i: HoldInput }[]>();
    for (let tick = 0; !hold.over(s) && tick < 80000; tick++) {
      const applied: { seat: number; i: HoldInput }[] = [];
      for (const x of st) for (const raw of hold.bot(s, x.seat, botStream(seed, x.bot!, tick, x.seat))) { const ok = hold.input(s, x.seat, raw); if (ok) applied.push({ seat: x.seat, i: ok }); }
      if (applied.length) inputs.set(tick, applied);
      hold.step(s, applied);
    }
    return { s, st, inputs };
  }
  it("four bots play a whole match, every move legal, in a few minutes of game time", () => {
    const { s } = playOut("bots");
    expect(s.phase).toBe("end");
    expect(s.t).toBeLessThan(8 * 60);
    expect(s.players.some((p) => s.squares.some((q) => q.owner === p.seat))).toBe(true);
  }, 60000);
  it("a match replays exactly from its inputs (the die and the deck are the match's own streams)", () => {
    const { s, st, inputs } = playOut("replay", 3);
    const r = replay(hold, "replay", st, { fish: 280, adults: 224, young: 56, boats: 3 }, inputs);
    expect(r.players.map((p) => [p.pos, p.coins])).toEqual(s.players.map((p) => [p.pos, p.coins]));
    expect(lakeFish(r)).toBe(lakeFish(s));
  }, 60000);
  it("frames hold everything (nothing is secret) and a watcher gets the same board", () => {
    const s = make("frame");
    const f = hold.frameFor(s, 0) as { sq: unknown[][]; p: unknown[]; lk: { docks: unknown[] } }, w = hold.frameFor(s, -1) as { sq: unknown[][] };
    expect(f.sq.length).toBe(Q.SQUARES); expect(f.p.length).toBe(4); expect(f.lk.docks.length).toBe(4);
    expect(w.sq).toEqual(f.sq);
    expect(K).toBe(340);
  });
});
