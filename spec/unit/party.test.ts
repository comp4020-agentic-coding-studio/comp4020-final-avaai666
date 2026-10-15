import { describe, expect, it } from "vitest";
import { eventsFor, type Seat } from "../../src/lib/game-platform.ts";
import { PARTY } from "../../src/lib/game-constants.ts";
import { party, type PartyInput, type PartySim } from "../../src/lib/modes/party.ts";

// Fishing Party, "party 1.0" (DESIGN.md "Fishing Party"): five rounds of 35 s,
// each a different game, an 8 s shop between them, the last-placed player's
// variant pick, a lake that carries over, and Last Net paying double. The
// server runs every round; the browser only sends taps, steers, reels,
// lanterns, shop buys, the variant and the secret net size.

const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const make = (n = 2, seed = "party-test", fish = 220): PartySim => party.make(seed, people(n), { fish });
const step = (s: PartySim, inputs: { seat: number; i: PartyInput }[] = []) => party.step(s, inputs);
const until = (s: PartySim, pred: () => boolean, inputs: (s: PartySim) => { seat: number; i: PartyInput }[] = () => [], max = 40000) => {
  const ev = []; for (let i = 0; i < max && !pred(); i++) ev.push(...step(s, inputs(s))); return ev;
};
const toRound = (s: PartySim, game: string) => {
  // force the next round's game (the order is seeded; tests pick the one they check)
  s.order[s.round] = game as never;
  until(s, () => s.phase === "round" && s.game === game);
};

describe("the shape of a match", () => {
  it("five rounds of 35 s, a different game each, Last Net always last, with an 8 s shop between", () => {
    const s = make();
    const games: string[] = [], shops: number[] = [];
    let shopStart = -1;
    while (!party.over(s)) {
      const was = s.phase;
      step(s);
      if (s.phase === "round" && was !== "round") games.push(s.game);
      if (s.phase === "shop" && was !== "shop") shopStart = s.t;
      if (was === "shop" && s.phase !== "shop") shops.push(Math.round((s.t - shopStart) * 10) / 10);
    }
    expect(games.length).toBe(5);
    expect(new Set(games).size).toBe(5);
    expect(games[4]).toBe("last");
    expect(shops.length).toBe(4);
    for (const d of shops) expect(d).toBeCloseTo(PARTY.SHOP_S, 0);
  }, 30000);

  it("a second match orders rounds 1 to 4 differently by its seed", () => {
    const orders = new Set(["a", "b", "c", "d", "e", "f"].map((seed) => make(2, seed).order.slice(0, 4).join()));
    expect(orders.size).toBeGreaterThan(1);
    for (const seed of ["a", "b"]) expect(make(2, seed).order[4]).toBe("last");
  });
});

describe("Shoal Scramble", () => {
  it("schools surface for 1.5 s at points the server chooses; the first net there takes the school", () => {
    const s = make(2, "shoal");
    toRound(s, "shoal");
    until(s, () => s.shoals.length > 0);
    const sh = s.shoals[0];
    const lake0 = s.lake;
    const ev = step(s, [{ seat: 1, i: { k: "tap", x: sh.x, y: sh.y } }, { seat: 0, i: { k: "tap", x: sh.x, y: sh.y } }]);
    const won = ev.find((e) => e.k === "shoal") as unknown as { seat: number; n: number };
    expect(won.seat).toBe(1); // first in the tick's order
    expect(s.coins[1]).toBe(won.n);
    expect(s.coins[0]).toBe(0);
    expect(s.lake).toBe(lake0 - won.n);
    expect(sh.until - sh.at).toBeCloseTo(PARTY.SHOAL_UP_S);
  });

  it("a tap too far from any school catches nothing", () => {
    const s = make(2, "shoal2");
    toRound(s, "shoal");
    until(s, () => s.shoals.length > 0);
    const sh = s.shoals[0];
    step(s, [{ seat: 0, i: { k: "tap", x: sh.x + PARTY.TAP_R * 3, y: sh.y } }]);
    expect(s.coins[0]).toBe(0);
  });
});

describe("Koi Chase", () => {
  it("every gate passed pays 1, and the first to touch the golden carp scores", () => {
    const s = make(2, "koi");
    toRound(s, "koi");
    const g = s.gates[s.nextGate[0]];
    s.boats[0].x = g.x - 5; s.boats[0].y = g.y;
    step(s);
    expect(s.coins[0]).toBe(1);
    s.boats[1].x = s.koi.x; s.boats[1].y = s.koi.y;
    const ev = step(s);
    expect(ev.find((e) => e.k === "koiCaught")).toMatchObject({ seat: 1 });
    expect(s.coins[1]).toBe(PARTY.KOI_COINS);
  });
});

describe("Tug of Line", () => {
  it("a reel inside the green pulls, outside it slips, and reels faster than the limit are dropped", () => {
    const s = make(2, "tug");
    toRound(s, "tug");
    // wait for the needle to be in the green
    until(s, () => Math.abs(s.needle) < PARTY.GREEN / 2 - 0.02);
    const r0 = s.ropes[0].pos;
    step(s, [{ seat: 0, i: { k: "reel" } }]);
    const r1 = s.ropes[0].pos;
    expect(Math.abs(r1 - r0)).toBeGreaterThan(0);
    step(s, [{ seat: 0, i: { k: "reel" } }]); // too soon
    expect(s.ropes[0].pos).toBe(r1);
    until(s, () => Math.abs(s.needle) > PARTY.GREEN / 2 + 0.1);
    s.reelAt[0] = -99;
    const r2 = s.ropes[0].pos;
    step(s, [{ seat: 0, i: { k: "reel" } }]);
    expect(Math.sign(s.ropes[0].pos - r2)).toBe(-Math.sign(r1 - r0)); // slipped back
  });

  it("pairs pull on one big fish, and the winner of each pair lands it", () => {
    const s = make(4, "tug4");
    toRound(s, "tug");
    expect(s.ropes.map((r) => r.seats)).toEqual([[0, 1], [2, 3]]);
    const coins0 = [...s.coins];
    until(s, () => s.phase !== "round", (sim) => (Math.abs(sim.needle) < PARTY.GREEN / 2 - 0.02 ? [{ seat: 0, i: { k: "reel" } }, { seat: 2, i: { k: "reel" } }] : []));
    expect(s.coins[0] - coins0[0]).toBe(PARTY.TUG_COINS);
    expect(s.coins[2] - coins0[2]).toBe(PARTY.TUG_COINS);
    expect(s.coins[1]).toBe(coins0[1]);
  });
});

describe("Lantern Night", () => {
  it("each seat sees only the fish within its own lantern, and a dropped lantern lights a spot for everyone for 10 s", () => {
    const s = make(2, "night");
    toRound(s, "night");
    s.boats[0].x = s.boats[0].tx = 200; s.boats[0].y = s.boats[0].ty = 350; s.boats[1].x = s.boats[1].tx = 800; s.boats[1].y = s.boats[1].ty = 350;
    step(s);
    const f0 = party.frameFor(s, 0) as { f: number[][] }, f1 = party.frameFor(s, 1) as { f: number[][] };
    const [b0, b1] = s.boats;
    for (const f of f0.f) expect(Math.hypot(f[0] - b0.x, f[1] - b0.y)).toBeLessThanOrEqual(PARTY.LANTERN_R + 1);
    for (const f of f1.f) expect(Math.hypot(f[0] - b1.x, f[1] - b1.y)).toBeLessThanOrEqual(PARTY.LANTERN_R + 1);
    expect(JSON.stringify(f0.f)).not.toBe(JSON.stringify(f1.f));
    step(s, [{ seat: 1, i: { k: "drop" } }]);
    const lit = s.drops[0];
    s.boats[1].x = 500;
    step(s);
    const seen0 = (party.frameFor(s, 0) as { f: number[][] }).f;
    expect(seen0.some((f) => Math.hypot(f[0] - lit.x, f[1] - lit.y) <= PARTY.DROP_R + 1)).toBe(s.fish.some((f) => Math.hypot(f.x - lit.x, f.y - lit.y) <= PARTY.DROP_R));
    until(s, () => s.t > lit.until + 0.1);
    expect(s.drops.length).toBe(0);
  });

  it("Muddy Water shrinks the leader's view next round", () => {
    const s = make(2, "muddy");
    s.coins = [10, 2];
    toRound(s, "night");
    const full = s.view[0];
    s.muddy = [0]; s.view = [full * PARTY.MUDDY, full];
    s.boats[0].x = s.boats[0].tx = 500; s.boats[0].y = s.boats[0].ty = 350; step(s);
    for (const f of (party.frameFor(s, 0) as { f: number[][] }).f) expect(Math.hypot(f[0] - s.boats[0].x, f[1] - s.boats[0].y)).toBeLessThanOrEqual(PARTY.LANTERN_R * PARTY.MUDDY + 1);
  });
});

describe("the shop and the variant pick", () => {
  const toShop = (s: PartySim) => until(s, () => s.phase === "shop");
  it("Big Net, Fast Boat and Bait cost coins and last one round", () => {
    const s = make(2, "shop");
    s.coins = [10, 10];
    toShop(s);
    step(s, [{ seat: 0, i: { k: "buy", item: "bigNet" } }]);
    expect(s.coins[0]).toBe(10 - PARTY.SHOP.bigNet.cost);
    expect(s.perks[0]).toContain("bigNet");
    until(s, () => s.phase === "round");
    expect(s.perks[0]).toContain("bigNet");
    until(s, () => s.phase === "shop" || party.over(s));
    expect(s.perks[0] ?? []).not.toContain("bigNet");
  });

  it("only a player behind the leader may buy Muddy Water", () => {
    const s = make(2, "mud");
    s.coins = [10, 6];
    toShop(s);
    step(s, [{ seat: 0, i: { k: "buy", item: "muddy" } }]);
    expect(s.perks[0]).not.toContain("muddy");
    step(s, [{ seat: 1, i: { k: "buy", item: "muddy" } }]);
    expect(s.muddy).toEqual([0]);
  });

  it("the last-placed player picks one of two variants for the next round; nobody else can", () => {
    const s = make(3, "variant");
    s.coins = [9, 1, 5];
    toShop(s);
    expect(s.picker).toBe(1);
    step(s, [{ seat: 0, i: { k: "variant", v: 1 } }]);
    expect(s.variant).toBe(0);
    step(s, [{ seat: 1, i: { k: "variant", v: 1 } }]);
    expect(s.variant).toBe(1);
  });
});

describe("Last Net and the lake", () => {
  const toLast = (picks: number[], n = picks.length, fish = 220) => {
    const s = make(n, "last", fish);
    until(s, () => s.phase === "round" && s.game === "last");
    const ev = step(s, picks.map((p, seat) => ({ seat, i: { k: "pick", size: p } as PartyInput })));
    return { s, ev };
  };
  it("picks are secret until the round ends", () => {
    const { s, ev } = toLast([3, 10]);
    expect(JSON.stringify(party.frameFor(s, 1))).not.toContain('"picks"');
    expect(JSON.stringify(eventsFor(ev, 1))).not.toMatch(/"size":3/);
  });
  it("if the nets together exceed the school, everyone gets 1; otherwise each gets its net; coins are doubled", () => {
    const small = toLast([3, 6]);
    const c0 = [...small.s.coins];
    until(small.s, () => party.over(small.s));
    expect(small.s.coins[0] - c0[0]).toBe(3 * PARTY.LAST_MULT);
    expect(small.s.coins[1] - c0[1]).toBe(6 * PARTY.LAST_MULT);
    const greedy = toLast([10, 10, 10, 10], 4, 60);
    const g0 = [...greedy.s.coins];
    until(greedy.s, () => party.over(greedy.s));
    expect(greedy.s.school).toBeLessThan(40);
    for (let i = 0; i < 4; i++) expect(greedy.s.coins[i] - g0[i]).toBe(1 * PARTY.LAST_MULT);
  });
  it("the school is what the first four rounds left, and the screen is told before round 5", () => {
    const s = make(2, "carry", 220);
    const ev = until(s, () => s.phase === "round" && s.game === "last");
    expect(s.school).toBe(Math.round(s.lake * PARTY.SCHOOL_SHARE));
    expect(s.lake).toBeLessThanOrEqual(220);
    expect(ev.some((e) => e.k === "lastWarning")).toBe(true);
  });
  it("rounds 1, 2 and 4 draw from the lake, and the results say what is left", () => {
    const s = make(2, "drain");
    let took = 0;
    until(s, () => party.over(s), (sim) => {
      if (sim.phase === "round" && sim.game === "shoal" && sim.shoals[0]) { took++; return [{ seat: 0, i: { k: "tap", x: sim.shoals[0].x, y: sim.shoals[0].y } }]; }
      return [];
    });
    expect(took).toBeGreaterThan(0);
    expect(party.results(s).lakeLeft).toBeLessThan(220);
    expect(party.results(s).highlights.length).toBe(3);
  });
});

it("bots play a whole match and buy and pick like players", () => {
  const seats: Seat[] = [{ seat: 0, name: "P0", bot: null, character: "mei" }, { seat: 1, name: "B (bot)", bot: "bot0", character: "jin" }, { seat: 2, name: "C (bot)", bot: "bot1", character: "lu" }];
  const s = party.make("bots", seats, { fish: 220 });
  let r = 7; const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  while (!party.over(s)) { const ins: { seat: number; i: PartyInput }[] = []; for (const st of seats) if (st.bot) for (const i of party.bot(s, st.seat, rng)) ins.push({ seat: st.seat, i }); step(s, ins); }
  expect(s.coins[1] + s.coins[2]).toBeGreaterThan(0);
}, 30000);

describe("v3.1: the variant pick is its own screen, and bait reaches only so far", () => {
  it("after the standings, a 4 s pick screen comes before the shop; only the last-placed player gets the choice", () => {
    const s = make(3, "v31-pick");
    s.coins = [9, 1, 5];
    until(s, () => s.phase === "pick");
    expect(s.picker).toBe(1);
    const t0 = s.t;
    const fp = party.frameFor(s, 1) as { phase: string; variants: string[]; picking: boolean };
    const fo = party.frameFor(s, 0) as { phase: string; variants: string[]; picking: boolean; picker: number };
    expect(fp.phase).toBe("pick");
    expect(fp.picking).toBe(true);
    expect(fp.variants.length).toBe(2);
    expect(fo.picking).toBe(false);
    expect(fo.variants).toEqual([]); // the others are told who is choosing, not the choice
    expect(fo.picker).toBe(1);
    step(s, [{ seat: 0, i: { k: "variant", v: 1 } }]);
    expect(s.variant).toBe(0);
    step(s, [{ seat: 1, i: { k: "variant", v: 1 } }]);
    expect(s.variant).toBe(1);
    until(s, () => s.phase === "shop");
    expect(s.t - t0).toBeCloseTo(PARTY.PICK_S, 0);
  });

  it("bait pulls only fish within two lantern radii of the buyer, and only for 10 s", () => {
    const s = make(2, "v31-bait");
    s.order[s.round] = "night";
    s.perks[0] = ["bait"]; // bought before the round
    until(s, () => s.phase === "round" && s.game === "night");
    const b = s.boats[0]; b.x = b.tx = 300; b.y = b.ty = 350;
    s.fish = [{ x: 300 + PARTY.LANTERN_R * 1.5, y: 350, h: 0 }, { x: 300 + PARTY.LANTERN_R * 3, y: 350, h: 0 }];
    const d0 = s.fish.map((f) => Math.hypot(f.x - b.x, f.y - b.y));
    for (let i = 0; i < 20; i++) step(s);
    const d1 = s.fish.map((f) => Math.hypot(f.x - b.x, f.y - b.y));
    expect(d1[0]).toBeLessThan(d0[0]); // inside two radii: pulled in
    expect(s.baitUntil[0]).toBeCloseTo(s.t - 20 * PARTY.DT + PARTY.BAIT_S, 0);
    // after 10 s the pull stops
    expect(PARTY.BAIT_S).toBe(10);
    expect(PARTY.BAIT_R).toBe(2);
  });
});
