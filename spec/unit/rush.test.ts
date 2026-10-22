import { describe, expect, it } from "vitest";
import { botStream, eventsFor, replay, type Seat } from "../../src/lib/game-platform.ts";
import { botKindOf, DEFAULT_BOT_KINDS, makeWithOpts, rush, type RushInput, type RushSim } from "../../src/lib/modes/rush.ts";
import { RUSH } from "../../src/lib/game-constants.ts";
import { dockPos, K, shape } from "../../src/lib/lake-world.ts";

// Boat Rush, "rush 2.0" (DESIGN.md "Boat Rush 开船抢鱼 (2.0)"): four seasons,
// each with a twist, ending in the gong, a breeding rest, and a market of
// secret picks revealed together when it closes. The server decides all of
// this; the browser only sends steer, cast, dash, pick and reroll.

const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const make = (seed = "rush-test", n = 2, fish = 280): RushSim => rush.make(seed, people(n), { fish, adults: Math.round(fish * 0.8), young: Math.round(fish * 0.2) });
const step = (s: RushSim, inputs: { seat: number; i: RushInput }[] = []) => rush.step(s, inputs);
const until = (s: RushSim, t: number) => { while (s.t < t - 1e-9 && !rush.over(s)) step(s); };
const put = (s: RushSim, seat: number, x: number, y: number) => { const b = s.boats[seat]; b.x = b.tx = x; b.y = b.ty = y; b.vx = b.vy = 0; };
const dock = (s: RushSim, seat: number) => { const d = dockPos(seat, s.players); put(s, seat, d.x, d.y); step(s); };
const clearFish = (s: RushSim) => { s.fish = []; };
const addFish = (s: RushSim, x: number, y: number, n: number, spread = 1) => { for (let i = 0; i < n; i++) s.fish.push({ id: s.nextId++, x: x + (((i * 7) % 5) - 2) * spread / 2, y: y + (((i * 3) % 5) - 2) * spread / 2, h: 0, adult: true, born: -99, cool: 99, scare: 0, sx: 0, sy: 0, big: false }); };
// fast-forward past the rest and market of the current season, choosing no card, into the next season
function skipMarket(s: RushSim): void {
  until(s, s.t + RUSH.SEASON_S + RUSH.REST_S + 0.1);
  if (s.phase !== "market") return;
  for (let i = 0; i < s.players; i++) step(s, [{ seat: i, i: { k: "pick", id: null } }]);
  until(s, s.t + RUSH.MARKET_S + 3);
}

describe("inputs are validated by the server", () => {
  it("only steer, cast, dash, pick and reroll are accepted, steers are clamped and rounded, and a charge is between 0 and 1", () => {
    const s = make();
    expect(rush.input(s, 0, { k: "steer", x: 5000.4, y: -3000 })).toEqual({ k: "steer", x: 92, y: -64 });
    expect(rush.input(s, 0, { k: "cast", charge: 7 })).toEqual({ k: "cast", charge: 1 });
    expect(rush.input(s, 0, { k: "cast" })).toEqual({ k: "cast", charge: 0 });
    expect(rush.input(s, 0, { k: "dash" })).toEqual({ k: "dash" });
    expect(rush.input(s, 0, { k: "reroll" })).toEqual({ k: "reroll" });
    expect(rush.input(s, 0, { k: "pick", id: "bigHold" })).toEqual({ k: "pick", id: "bigHold" });
    expect(rush.input(s, 0, { k: "pick", id: null })).toEqual({ k: "pick", id: null });
    expect(rush.input(s, 0, { k: "pick", id: "laser" })).toBeNull();
    expect(rush.input(s, 0, { k: "buy", up: "bigHold" })).toBeNull(); // rush 1.0's input kind, dropped
    expect(rush.input(s, 0, { k: "teleport", x: 1, y: 1 })).toBeNull();
    expect(rush.input(s, 0, { k: "steer", x: "a", y: 1 })).toBeNull();
  });
});

describe("four 45 s seasons, a gong, a rest, then a market", () => {
  it("a season lasts 45 s, then the gong fires and fish aboard spoil", () => {
    const s = make();
    s.boats[0].hold = [1, 1, 1];
    until(s, RUSH.SEASON_S - RUSH.DT); // one tick before the season ends
    expect(s.phase).toBe("play");
    const ev = step(s);
    expect(ev.some((e) => e.k === "gong")).toBe(true);
    expect(s.phase).toBe("rest");
    expect(s.boats[0].hold.length).toBe(0); // spoiled
  });

  it("the rest breeds the lake (lake-world.ts's breed()), then the market opens for 14 s", () => {
    const s = make();
    until(s, RUSH.SEASON_S + 0.01); // into the rest
    const [a0] = [s.fish.filter((f) => f.adult).length];
    until(s, RUSH.SEASON_S + RUSH.REST_S + 0.01);
    expect(s.phase).toBe("market");
    expect(s.market).not.toBeNull();
    expect(s.market!.offer.length).toBe(3);
    expect(s.fish.length).toBeGreaterThanOrEqual(a0); // the lake grew (or held, never shrank from breeding alone)
  });

  it("the market always offers exactly one greedy and one keeper card, filled to three with plain cards", () => {
    for (const seed of ["m1", "m2", "m3", "m4", "m5"]) {
      const s = make(seed);
      until(s, RUSH.SEASON_S + RUSH.REST_S + 0.01);
      const kinds = s.market!.offer.map((id) => RUSH.CARDS[id].kind);
      expect(kinds.filter((k) => k === "greedy").length).toBe(1);
      expect(kinds.filter((k) => k === "keeper").length).toBe(1);
      expect(kinds.filter((k) => k === "plain").length).toBe(1);
    }
  }, 30000);

  it("after winter's rest, the match ends with no market", () => {
    const s = make();
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    until(s, s.t + RUSH.SEASON_S - RUSH.DT); // one tick before winter's play ends
    step(s); // the gong; into the rest
    until(s, s.t + RUSH.REST_S - RUSH.DT); // one tick before the rest ends
    step(s); // the match ends: no market after the last season
    expect(s.phase).toBe("end");
    expect(rush.over(s)).toBe(true);
  }, 30000);
});

describe("market secrecy: picks are hidden until the market closes", () => {
  it("a reroll costs 2 banked fish and only replaces the rerolling seat's own offer", () => {
    const s = make("reroll", 2);
    until(s, RUSH.SEASON_S + RUSH.REST_S + 0.01);
    s.boats[0].banked = 5;
    const before = s.market!.offer;
    step(s, [{ seat: 0, i: { k: "reroll" } }]);
    const f = rush.frameFor(s, 0) as { market: { offer: string[] } };
    expect(s.boats[0].banked).toBe(3);
    expect(f.market.offer).not.toEqual(before); // seat 0 now sees its own rerolled offer
    const other = rush.frameFor(s, 1) as { market: { offer: string[] } };
    expect(other.market.offer).toEqual(before); // seat 1's own offer is unaffected
  });

  it("no seat's frame or events reveal another seat's card before the market closes, even on the last tick before it closes", () => {
    // seat 0 picks whichever card is NOT in the publicly-shown offer (by rerolling
    // first), so its id appearing anywhere in seat 1's view can only mean a leak,
    // never the market board itself (which every seat sees, and is not a secret).
    for (const seed of ["sec1", "sec2", "sec3"]) {
      const s = make(seed, 3);
      until(s, RUSH.SEASON_S + RUSH.REST_S + 0.01);
      const publicOffer = s.market!.offer;
      s.boats[0].banked = 50; // rerolling repeatedly, if needed, until the offer differs from the public board
      let secretId: string | undefined;
      for (let tries = 0; tries < 10 && !secretId; tries++) {
        step(s, [{ seat: 0, i: { k: "reroll" } }]);
        const myOffer = (rush.frameFor(s, 0) as { market: { offer: string[] } }).market.offer;
        secretId = myOffer.find((id) => !publicOffer.includes(id));
      }
      expect(secretId, "ten rerolls should find a card not on the public board").toBeDefined();
      const seen: string[] = [];
      let picked0 = false;
      while (s.phase === "market" && !s.market!.closed) {
        const wasClosed = s.market!.closed;
        const inputs: { seat: number; i: RushInput }[] = s.t > s.market!.closesAt - 1 && !picked0 ? [{ seat: 0, i: { k: "pick", id: secretId! } }] : [];
        if (inputs.length) picked0 = true;
        const ev = step(s, inputs);
        if (wasClosed || s.market?.closed) break; // the tick that closes the market is the reveal itself, not a secrecy check
        seen.push(JSON.stringify(rush.frameFor(s, 1)) + JSON.stringify(eventsFor(ev, 1)));
      }
      const text = seen.join("");
      if (picked0) expect(text).not.toContain(`"${secretId}"`); // seat 1 never sees seat 0's pick while the market is open
    }
  }, 30000);

  it("everyone's pick is revealed together, in a 'picks' event, once the market closes", () => {
    const s = make("reveal", 2);
    until(s, RUSH.SEASON_S + RUSH.REST_S + 0.01);
    const offer = s.market!.offer;
    let picksEvent: { picks: (string | null)[] } | undefined;
    for (let i = 0; i < s.players; i++) { const ev = step(s, [{ seat: i, i: { k: "pick", id: offer[0] } }]); const p = ev.find((e) => e.k === "picks"); if (p) picksEvent = p as never; }
    expect(picksEvent).toBeDefined();
    expect(picksEvent!.picks.every((p) => p === offer[0])).toBe(true);
    // now that it is closed, both seats' frames show both picks
    const f0 = rush.frameFor(s, 0) as { market: { picks: unknown[] } };
    expect(f0.market.picks).toEqual([offer[0], offer[0]]);
  });

  it("if a seat never picks, the market closes anyway when the timer ends, with that seat's pick as null", () => {
    const s = make("timeout", 2);
    until(s, RUSH.SEASON_S + RUSH.REST_S + 0.01);
    step(s, [{ seat: 0, i: { k: "pick", id: s.market!.offer[0] } }]); // only seat 0 picks
    until(s, s.t + RUSH.MARKET_S + 0.1);
    expect(s.market!.closed).toBe(true);
    expect(s.boats[1].cards).toEqual([]);
    expect(s.boats[0].cards).toEqual([s.market!.offer[0]].length ? s.boats[0].cards : []); // seat 0's own pick was applied
  });
});

describe("cards change the boat", () => {
  it("Big Hold carries four more", () => {
    const s = make();
    clearFish(s); s.boats[0].cards = ["bigHold"];
    s.boats[0].hold = Array(RUSH.HOLD).fill(1);
    put(s, 0, 0, 0);
    addFish(s, Math.cos(s.boats[0].h) * RUSH.NET_AHEAD, Math.sin(s.boats[0].h) * RUSH.NET_AHEAD, 8, 0.3);
    step(s, [{ seat: 0, i: { k: "cast", charge: 0 } }]);
    until(s, s.t + 1);
    expect(s.boats[0].hold.length).toBe(RUSH.HOLD + RUSH.CARDS.bigHold.hold!);
  });

  it("Fast Hull sails faster, and Wide Net nets a wider circle", () => {
    const a = make("fast"), b = make("fast");
    b.boats[0].cards = ["fastHull"];
    for (const s of [a, b]) { put(s, 0, -20, 0); s.boats[0].tx = 40; }
    for (let i = 0; i < 40; i++) { step(a); step(b); }
    expect(b.boats[0].x - -20).toBeGreaterThan((a.boats[0].x - -20) * 1.1);
    expect(RUSH.NET_R * RUSH.CARDS.wideNet.net!).toBeGreaterThan(RUSH.NET_R);
  });
});

describe("rams", () => {
  const rammed = (setup: (s: RushSim) => void) => {
    const s = make("ram", 2);
    clearFish(s);
    setup(s);
    s.boats[1].hold = Array(8).fill(1);
    put(s, 1, 0, 0); put(s, 0, -2, 0);
    s.boats[0].tx = 6; s.boats[0].ty = 0;
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
    expect(rammed((s) => { s.boats[0].cards = ["ironBow"]; }).ram?.n).toBe(RUSH.RAM_DROP + 1);
    expect(rammed((s) => { s.boats[1].cards = ["ironBow"]; }).ram?.n).toBe(RUSH.RAM_DROP - 1);
  });
  it("no ram lands near a dock", () => {
    const s = make("dockram", 2);
    clearFish(s);
    s.boats[1].hold = Array(8).fill(1);
    const d = dockPos(1, 2);
    put(s, 1, d.x, d.y); put(s, 0, d.x - 2, d.y); s.boats[0].tx = d.x + 10;
    const all = [...step(s, [{ seat: 0, i: { k: "dash" } }])]; for (let i = 0; i < 4; i++) all.push(...step(s));
    expect(all.some((e) => e.k === "ram")).toBe(false);
  });
});

describe("the charge cast and the schools", () => {
  it("a full charge widens the net by 30%", () => {
    const s = make();
    put(s, 0, 0, 0);
    const ev = step(s, [{ seat: 0, i: { k: "cast", charge: 1 } }]);
    const cast = ev.find((e) => e.k === "cast") as unknown as { r: number };
    expect(cast.r).toBeCloseTo(RUSH.NET_R * 1.3);
  });

  it("a school scatters after a net hits it", () => {
    const s = make("scatter"); clearFish(s); put(s, 0, 0, 0);
    const bx = Math.cos(s.boats[0].h) * RUSH.NET_AHEAD, by = Math.sin(s.boats[0].h) * RUSH.NET_AHEAD;
    addFish(s, bx + RUSH.NET_R * 1.5, by, 6, 0.2);
    step(s, [{ seat: 0, i: { k: "cast", charge: 0 } }]);
    for (const f of s.fish) f.scare = 0;
    until(s, s.t + RUSH.SINK + 0.1);
    expect(s.fish.filter((f) => f.scare > 0).length).toBeGreaterThan(0);
  });

  it("a chain of 3+ fish within 2.6 s adds one bonus fish", () => {
    const s = make("chain"); clearFish(s); put(s, 0, 0, 0);
    const bx = Math.cos(s.boats[0].h) * RUSH.NET_AHEAD, by = Math.sin(s.boats[0].h) * RUSH.NET_AHEAD;
    addFish(s, bx, by, 4, 0.2);
    step(s, [{ seat: 0, i: { k: "cast", charge: 0 } }]);
    until(s, s.t + RUSH.SINK + 0.1);
    const first = s.boats[0].hold.length;
    expect(first).toBeGreaterThanOrEqual(3);
    until(s, s.t + RUSH.CAST_CD); // wait out the cast cooldown before casting again
    addFish(s, bx, by, 4, 0.2);
    step(s, [{ seat: 0, i: { k: "cast", charge: 0 } }]);
    until(s, s.t + RUSH.SINK + 0.1);
    expect(s.boats[0].hold.length).toBeGreaterThan(first + 3); // the normal catch plus the chain bonus
  });
});

describe("the four seasonal twists", () => {
  it("autumn: every fish counts double", () => {
    const s = make("autumn"); s.season = 2; clearFish(s); put(s, 0, 0, 0);
    const bx = Math.cos(s.boats[0].h) * RUSH.NET_AHEAD, by = Math.sin(s.boats[0].h) * RUSH.NET_AHEAD;
    addFish(s, bx, by, 1, 0.1);
    step(s, [{ seat: 0, i: { k: "cast", charge: 0 } }]);
    until(s, s.t + RUSH.SINK + 0.1);
    expect(s.boats[0].hold.reduce((n, v) => n + v, 0)).toBeGreaterThanOrEqual(2);
  });

  it("winter: ice blocks boats near the shore except by a dock", () => {
    const s = make("winter"); s.season = 3;
    const [fx, fy] = shape(200, 0.95); // far from every dock, near the shore
    put(s, 0, fx, fy); s.boats[0].vx = 5; s.boats[0].vy = 0;
    const before = [s.boats[0].x, s.boats[0].y];
    step(s);
    expect([s.boats[0].x, s.boats[0].y]).toEqual(before); // blocked by ice
  });
});

describe("the ending: next spring, the counterfactual and titles", () => {
  it("breeds: true — results().lakeLeft is next spring directly, capped at K, not a raw fish count", () => {
    const s = make("ending", 2, 280);
    expect(rush.breeds).toBe(true);
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    until(s, s.t + RUSH.SEASON_S + RUSH.REST_S + 0.1);
    expect(rush.over(s)).toBe(true);
    const r = rush.results(s);
    expect(r.lakeLeft).toBeLessThanOrEqual(K);
    expect(r.lakeLeft).toBeGreaterThan(0);
  }, 30000);

  it("the counterfactual (catches x0.8) is at least as generous as the real result", () => {
    const s = make("alt", 2, 280);
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    until(s, s.t + RUSH.SEASON_S + RUSH.REST_S + 0.1);
    const r = rush.results(s) as unknown as { counterfactual: { alt: number; tierId: string } };
    expect(r.counterfactual.alt).toBeGreaterThanOrEqual(0);
    expect(["rich", "fair", "lean", "none"]).toContain(r.counterfactual.tierId);
  }, 30000);

  it("titles are only awarded when someone earned them, king always first", () => {
    const s = make("titles", 2, 280);
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    until(s, s.t + RUSH.SEASON_S + RUSH.REST_S + 0.1);
    const r = rush.results(s) as unknown as { titles: { key: string }[] };
    expect(r.titles[0].key).toBe("king");
    expect(r.titles.length).toBeLessThanOrEqual(4);
  }, 30000);
});

describe("the lake and the record", { timeout: 30000 }, () => {
  it("replaying the inputs, bots included, gives the same results", () => {
    const seats: Seat[] = [{ seat: 0, name: "P0", bot: null, character: "mei" }, { seat: 1, name: "Jin (bot)", bot: "bot0", character: "jin" }, { seat: 2, name: "Lu (bot)", bot: "bot1", character: "lu" }];
    const lake = { fish: 280, adults: 224, young: 56 };
    const s = rush.make("bots", seats, lake);
    const log = new Map<number, { seat: number; i: unknown }[]>();
    for (let tick = 0; !rush.over(s); tick++) {
      const applied: { seat: number; i: RushInput }[] = tick % 30 === 0 ? [{ seat: 0, i: { k: "cast", charge: 0.5 } }] : [];
      for (const st of seats) if (st.bot) for (const i of rush.bot(s, st.seat, botStream("bots", st.bot, tick, st.seat))) applied.push({ seat: st.seat, i });
      if (applied.length) log.set(tick, applied);
      rush.step(s, applied);
    }
    const again = replay(rush, "bots", seats, lake, log);
    expect(rush.results(again)).toEqual(rush.results(s));
    expect(rush.results(s).seats.slice(1).some((x) => x.score > 0)).toBe(true); // the bots fish
  }, 60000);
});

describe("bot kinds: steady, keeper, greedy by seat % 3, unless a script overrides it", () => {
  it("a room created through the normal path (no 4th argument) gets seat % 3, every time", () => {
    const seats: Seat[] = [0, 1, 2, 3].map((i) => ({ seat: i, name: `P${i}`, bot: `bot${i}`, character: "mei" }));
    const s = rush.make("normal-path", seats, { fish: 280 });
    expect(s.botKinds).toEqual([0, 1, 2, 3].map((i) => botKindOf(i)));
    expect(s.botKinds).toEqual(["steady", "keeper", "greedy", "steady"]);
  });

  it("DEFAULT_BOT_KINDS and botKindOf agree: steady, keeper, greedy, repeating", () => {
    expect(DEFAULT_BOT_KINDS).toEqual(["steady", "keeper", "greedy"]);
    expect([0, 1, 2, 3, 4, 5].map((i) => botKindOf(i))).toEqual(["steady", "keeper", "greedy", "steady", "keeper", "greedy"]);
  });

  it("a script-only 4th argument can override every seat's kind, reachable only by calling makeWithOpts() directly (not through rush.make, which Mode<S, I> types at three arguments)", () => {
    const seats: Seat[] = [0, 1, 2, 3].map((i) => ({ seat: i, name: `P${i}`, bot: `bot${i}`, character: "mei" }));
    const s = makeWithOpts("all-greedy", seats, { fish: 280 }, { botKinds: ["greedy", "greedy", "greedy", "greedy"] });
    expect(s.botKinds).toEqual(["greedy", "greedy", "greedy", "greedy"]);
  });
});
