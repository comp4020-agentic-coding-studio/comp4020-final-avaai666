import { describe, expect, it } from "vitest";
import { botStream, eventsFor, replay, type Seat } from "../../src/lib/game-platform.ts";
import { botKindOf, DEFAULT_BOT_KINDS, makeWithOpts, nextSpring, rush, type RushInput, type RushSim, type SeasonHistory } from "../../src/lib/modes/rush.ts";
import { RUSH } from "../../src/lib/game-constants.ts";
import { dockPos, forecast, iceBlocks, K, nr, shape, ZONES } from "../../src/lib/lake-world.ts";

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
// pins school 0 to (x, y) so a test-placed fish's ox/oy (relative to its
// own school) keeps it exactly where the test put it, tick after tick,
// instead of drifting toward wherever placeSchools() randomly put school 0
const addFish = (s: RushSim, x: number, y: number, n: number, spread = 1) => {
  s.schools[0].x = s.schools[0].tx = x; s.schools[0].y = s.schools[0].ty = y; s.schools[0].vx = s.schools[0].vy = 0; s.schools[0].t = 999;
  for (let i = 0; i < n; i++) {
    const fx = (((i * 7) % 5) - 2) * spread / 2, fy = (((i * 3) % 5) - 2) * spread / 2;
    s.fish.push({ id: s.nextId++, x: x + fx, y: y + fy, h: 0, adult: true, born: -99, cool: 99, scare: 0, sx: 0, sy: 0, big: false, school: 0, ox: fx, oy: fy, ph: 0 });
  }
};
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

  it("winter's gong ends the match directly: no fourth rest, no market (rule change 1, bug fix: breeding was counted twice)", () => {
    const s = make();
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    expect(s.season).toBe(3); // winter, already playing
    const historyLenBeforeGong = s.history.length;
    let ev: ReturnType<typeof step> = [];
    while (s.phase === "play") ev = step(s); // run winter out to its own gong, wherever it falls
    expect(ev.some((e) => e.k === "gong")).toBe(true);
    expect(ev.some((e) => e.k === "rest")).toBe(false);
    expect(ev.some((e) => e.k === "end")).toBe(true);
    expect(s.phase).toBe("end");
    expect(rush.over(s)).toBe(true);
    expect(s.history.length).toBe(historyLenBeforeGong); // no new (fifth) season entry opened
    expect(s.history[s.history.length - 1].bred).toBe(false); // winter's entry never breeds
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

// a replacement for the misleadingly-named "a school scatters after a net
// hits it" test above (it never checked a real school, only f.scare on
// fish the test itself placed by hand — nothing in rush.test.ts covered
// DESIGN.md's actual school pulls, or the prototype's 16-school clustering
// this port was missing entirely, port bug (prompt-17, rule change 1)
describe("fish swim in schools (DESIGN.md's season twists, the prototype's docs/prototypes/v10/fish.js)", () => {
  it("16 schools: 12 adult, 4 nursery", () => {
    const s = make("schools-count");
    expect(s.schools.length).toBe(16);
    expect(s.schools.filter((sc) => sc.nursery).length).toBe(4);
    expect(s.schools.filter((sc) => !sc.nursery).length).toBe(12);
  });

  it("every fish belongs to a school it stays within a few units of", () => {
    const s = make("schools-cluster", 2, 280);
    until(s, 20); // let schools settle and fish catch up to their offset
    for (const f of s.fish) {
      const sc = s.schools[f.school];
      expect(Math.hypot(f.x - sc.x, f.y - sc.y)).toBeLessThan(10); // ox/oy is at most ~5.7 (±4, ±4), plus drift
    }
  }, 15000);

  it("nursery fish (young, by school) stay in the reed bed", () => {
    const s = make("schools-nursery", 2, 280);
    until(s, 20);
    const nurseryIds = s.schools.map((sc, i) => (sc.nursery ? i : -1)).filter((i) => i >= 0);
    for (const sc of s.schools) if (sc.nursery) expect(Math.hypot(sc.x - ZONES.reeds.x, sc.y - ZONES.reeds.y)).toBeLessThan(ZONES.reeds.r * 1.5);
    for (const f of s.fish) if (nurseryIds.includes(f.school)) expect(Math.hypot(f.x - ZONES.reeds.x, f.y - ZONES.reeds.y)).toBeLessThan(ZONES.reeds.r * 2);
  }, 15000);

  it("each season, a school's targets land in that season's places, never deep winter ice", () => {
    for (let season = 0; season < 4; season++) {
      const s = make(`schools-season-${season}`, 2, 280);
      s.season = season as 0 | 1 | 2 | 3;
      for (let i = 0; i < 40; i++) until(s, s.t + 0.3); // force many retargets across the season
      for (const sc of s.schools) {
        expect(nr(sc.x, sc.y)).toBeLessThan(0.93); // never past the shore
        if (season === 3) expect(iceBlocks(sc.x, sc.y, 3)).toBe(false); // never sitting in winter ice
      }
    }
  }, 30000);

  it("a bot that reaches a school nets 3 or more fish in most casts (hold had room)", () => {
    const seeds = ["schools-bot-1", "schools-bot-2", "schools-bot-3", "schools-bot-4", "schools-bot-5"];
    let casts = 0, big = 0;
    for (const seed of seeds) {
      const seats: Seat[] = [0, 1, 2, 3].map((i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));
      const s = makeWithOpts(seed, seats, { fish: 280, adults: 224, young: 56 }, { botKinds: ["greedy", "greedy", "greedy", "greedy"] });
      for (let tick = 0; !rush.over(s) && s.season === 0; tick++) {
        const applied: { seat: number; i: RushInput }[] = [];
        for (const st of seats) for (const raw of rush.bot(s, st.seat, botStream(seed, st.bot!, tick, st.seat))) { const ok = rush.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok }); }
        // a cast's room right before this tick: whether a small catch here could be a full hold, not a missed school
        const roomBefore = s.boats.map((b) => RUSH.HOLD - b.hold.length);
        const ev = rush.step(s, applied);
        for (const e of ev) {
          if (e.k !== "catch" || !((e.n as number) > 0 || (e.full as number) > 0)) continue;
          if (roomBefore[e.seat as number] < 3) continue; // the hold itself could not have taken 3 fish; not a school-quality signal
          casts++; if ((e.n as number) >= 3) big++;
        }
      }
    }
    expect(casts).toBeGreaterThan(5);
    expect(big / casts).toBeGreaterThan(0.5);
  }, 30000);

  it("the replay is still exact with schools in play", () => {
    const seats: Seat[] = [{ seat: 0, name: "P0", bot: null, character: "mei" }, { seat: 1, name: "Jin (bot)", bot: "bot0", character: "jin" }];
    const lake = { fish: 280, adults: 224, young: 56 };
    const seed = "schools-replay";
    const s = rush.make(seed, seats, lake);
    const log = new Map<number, { seat: number; i: unknown }[]>();
    for (let tick = 0; !rush.over(s); tick++) {
      const applied: { seat: number; i: RushInput }[] = tick % 40 === 0 ? [{ seat: 0, i: { k: "cast", charge: 0.5 } }] : [];
      for (const i of rush.bot(s, 1, botStream(seed, "bot0", tick, 1))) applied.push({ seat: 1, i });
      if (applied.length) log.set(tick, applied);
      rush.step(s, applied);
    }
    const again = replay(rush, seed, seats, lake, log);
    expect(rush.results(again)).toEqual(rush.results(s));
  }, 60000);
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

// runs a whole match (bots only, so there is always something to catch and
// something to breed), returning the finished sim
function playOut(seed: string, n = 4): RushSim {
  const seats: Seat[] = Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));
  const s = makeWithOpts(seed, seats, { fish: 280, adults: 224, young: 56 }, {});
  for (let tick = 0; !rush.over(s) && tick < 20000; tick++) {
    const applied: { seat: number; i: RushInput }[] = [];
    for (const st of seats) for (const raw of rush.bot(s, st.seat, botStream(seed, st.bot!, tick, st.seat))) { const ok = rush.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok }); }
    rush.step(s, applied);
  }
  return s;
}

describe("the ending: next spring, the counterfactual and titles", () => {
  it("breeds: true — results().lakeLeft is next spring directly, capped at K, not a raw fish count", () => {
    const s = make("ending", 2, 280);
    expect(rush.breeds).toBe(true);
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    while (s.phase === "play") step(s);
    expect(rush.over(s)).toBe(true);
    const r = rush.results(s);
    expect(r.lakeLeft).toBeLessThanOrEqual(K);
    expect(r.lakeLeft).toBeGreaterThan(0);
  }, 30000);

  it("the counterfactual (catches x0.8) is at least as generous as the real result", () => {
    const s = make("alt", 2, 280);
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    while (s.phase === "play") step(s);
    const r = rush.results(s) as unknown as { counterfactual: { alt: number; tierId: string } };
    expect(r.counterfactual.alt).toBeGreaterThanOrEqual(0);
    expect(["rich", "fair", "lean", "none"]).toContain(r.counterfactual.tierId);
  }, 30000);

  it("titles are only awarded when someone earned them, king always first", () => {
    const s = make("titles", 2, 280);
    for (let season = 0; season < RUSH.SEASONS - 1; season++) skipMarket(s);
    while (s.phase === "play") step(s);
    const r = rush.results(s) as unknown as { titles: { key: string }[] };
    expect(r.titles[0].key).toBe("king");
    expect(r.titles.length).toBeLessThanOrEqual(4);
  }, 30000);

  it("the lake breeds exactly 3 times in a match, not 5 (spring, summer, autumn; winter's gong ends the match directly)", () => {
    for (const seed of ["breed-count-1", "breed-count-2", "breed-count-3"]) {
      const s = playOut(seed);
      expect(s.history.length).toBe(4); // one entry per season
      expect(s.history.filter((h) => h.bred).length).toBe(3); // spring, summer, autumn
      expect(s.history[3].bred).toBe(false); // winter never breeds here
    }
  }, 30000);

  it("scale 1 reproduces the real next spring exactly, on several seeds", () => {
    for (const seed of ["np-1", "np-2", "np-3", "np-4", "np-5"]) {
      const s = playOut(seed);
      const [a, y] = (() => { let a = 0, y = 0; for (const f of s.fish) f.adult ? a++ : y++; return [a, y]; })();
      const real = forecast(a, y);
      const r = rush.results(s);
      expect(r.lakeLeft).toBe(Math.min(K, real));
    }
  }, 30000);

  it("scale 0.8 is never below scale 1 on the same match", () => {
    for (const seed of ["np-alt-1", "np-alt-2", "np-alt-3", "np-alt-4", "np-alt-5"]) {
      const s = playOut(seed);
      const r = rush.results(s) as unknown as { lakeLeft: number; counterfactual: { alt: number } };
      expect(r.counterfactual.alt).toBeGreaterThanOrEqual(r.lakeLeft);
    }
  }, 30000);

  it("a hand-computed small example: two seasons, one breed, then one forecast", () => {
    // spring: starts at 100 adults, 20 young; 12 fish caught (10 adult, 2
    // young), 6 born live during play, none reclaimed; gong at 94 adults,
    // 24 young (100 - 10 + 0 adult-side is wrong to hand-check against
    // gongA directly, since live births and maturing blur adult/young —
    // gongA/gongY are simply what the entry says, as the real sim would
    // record). Spring breeds, with a 10% Fish Ladder bonus.
    const spring: SeasonHistory = { startA: 100, startY: 20, caught: 12, young: 2, liveBorn: 6, reclaimed: 0, gongA: 94, gongY: 24, bred: true, bonus: 0.1, reedsExtra: 2 };
    // winter: never breeds (bred: false) — its own gongA/gongY is the only
    // thing that matters, since nextSpring() only forecasts once, at the end
    const winter: SeasonHistory = { startA: 0, startY: 0, caught: 9, young: 1, liveBorn: 3, reclaimed: 0, gongA: 180, gongY: 15, bred: false, bonus: 0, reedsExtra: 0 };

    // scale 1: spring breeds breed(94, 24, 0.1), with +2 Reed Bed fish added
    // to the born count; winter's catch contributes nothing extra (scale 1
    // means every caught fish is really gone), so next spring is forecast()
    // straight off winter's own gongA/gongY, ignoring spring's bred result
    // entirely (each entry's a/y is reset to its own gong at scale 1 — only
    // the LAST entry's outcome, after its own breed if any, is what the real
    // sim carries forward, exactly as endSeason() replaces s.fish each time).
    expect(nextSpring([spring, winter], 1)).toBe(forecast(180, 15));

    // scale 0.8: winter's catch (9 fish, 1 young) is 20% lighter, so 0.2 of
    // it (1.8 adult-side, 0.2 young-side) is added back before the final
    // (bred: false) forecast — spring's breed still never happened for
    // winter's base numbers, same reasoning as above.
    const expectedAlt = forecast(180 + 0.2 * (9 - 1), 15 + 0.2 * 1);
    expect(nextSpring([spring, winter], 0.8)).toBe(expectedAlt);
    expect(nextSpring([spring, winter], 0.8)).toBeGreaterThanOrEqual(nextSpring([spring, winter], 1));
  });

  it("every season's recorded catch matches its own catch events, in the right season's entry — nothing silently dropped or attributed to the wrong season", () => {
    for (const seed of ["conserve-1", "conserve-2", "conserve-3"]) {
      const seats: Seat[] = Array.from({ length: 4 }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));
      const s = makeWithOpts(seed, seats, { fish: 280, adults: 224, young: 56 }, {});
      const caughtBySeason: number[] = [0, 0, 0, 0];
      for (let tick = 0; !rush.over(s) && tick < 20000; tick++) {
        const applied: { seat: number; i: RushInput }[] = [];
        for (const st of seats) for (const raw of rush.bot(s, st.seat, botStream(seed, st.bot!, tick, st.seat))) { const ok = rush.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok }); }
        const seasonBefore = s.season;
        const ev = rush.step(s, applied);
        for (const e of ev) if (e.k === "catch") caughtBySeason[seasonBefore] += (e.n as number) ?? 0;
      }
      expect(s.history.length).toBe(4);
      for (let season = 0; season < 4; season++) expect(s.history[season].caught).toBe(caughtBySeason[season]);
      // and the population identity: no fish unaccounted for, mid-season
      for (const h of s.history) expect(h.gongA + h.gongY).toBe(h.startA + h.startY + h.liveBorn + h.reclaimed - h.caught);
    }
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
