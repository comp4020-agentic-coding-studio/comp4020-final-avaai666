import { describe, expect, it } from "vitest";
import { botStream, eventsFor, type GameEvent, replay, type Seat } from "../../src/lib/game-platform.ts";
import { GAMES, party, type PartyInput, type PartySim, seesFish } from "../../src/lib/modes/party.ts";
import { PARTY as Q } from "../../src/lib/game-constants.ts";
import { nextSpring, tierOf } from "../../src/lib/lake-world.ts";

// Fishing Party 2.0 (DESIGN.md "Fishing Party 钓鱼派对 (2.0)"), pure logic.
const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));
const botsOf = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `B${i}`, bot: `bot${i}`, character: "mei" }));
const LAKE = { fish: 280, adults: 224, young: 56 };
const make = (seed = "party-test", n = 2): PartySim => party.make(seed, people(n), LAKE);
const step = (s: PartySim, inputs: { seat: number; i: PartyInput }[] = []): GameEvent[] => party.step(s, inputs);
const until = (s: PartySim, pred: () => boolean, max = 20000): GameEvent[] => { const all: GameEvent[] = []; for (let k = 0; k < max && !pred(); k++) all.push(...step(s)); return all; };
const inp = (s: PartySim, seat: number, raw: unknown) => party.input(s, seat, raw);
const allReady = (s: PartySim) => step(s, s.boats.map((b) => ({ seat: b.seat, i: { k: "ready" } as PartyInput })));
const toPlay = (s: PartySim) => { if (s.phase === "intro") allReady(s); until(s, () => s.phase === "play"); };
const toRound = (s: PartySim, r: number) => {
  // everyone ready at each intro and done at each shop, until round r begins
  for (let k = 0; k < 40000 && s.round < r; k++) {
    if (s.phase === "intro" && !s.ready.every(Boolean)) allReady(s);
    else if (s.phase === "shop" && !s.done.every(Boolean)) step(s, s.boats.filter((b) => !s.done[b.seat]).map((b) => ({ seat: b.seat, i: { k: "done" } as PartyInput })));
    else step(s);
  }
};

describe("the flow of a round", () => {
  it("five rounds in DESIGN's order; each opens on its intro card, which ends when everyone is ready (or after 20 s), then 3-2-1 and 28 s", () => {
    const s = make();
    expect(s.phase).toBe("intro"); expect(s.game).toBe("scramble");
    step(s, [{ seat: 0, i: inp(s, 0, { k: "ready" })! }]);
    expect(s.phase).toBe("intro");
    step(s, [{ seat: 1, i: inp(s, 1, { k: "ready" })! }]);
    expect(s.phase).toBe("count");
    until(s, () => s.phase === "play");
    const t0 = s.t; until(s, () => s.phase !== "play");
    expect(s.t - t0).toBeCloseTo(Q.ROUND_S, 1);
    expect(s.phase).toBe("standings");
    const t = make("timeout"); until(t, () => t.phase !== "intro");
    expect(t.t).toBeCloseTo(Q.INTRO_S, 1);
    expect(GAMES).toEqual(["scramble", "koi", "tug", "night", "last"]);
  });
  it("trying it first during the intro scores nothing and takes nothing from the lake", () => {
    const s = make("practice");
    const before = s.fish.length;
    until(s, () => s.spots.some((p) => p.open));
    const p = s.spots.find((x) => x.open)!;
    step(s, [{ seat: 0, i: inp(s, 0, { k: "tap", x: p.x, y: p.y })! }]);
    expect(p.taken).toBe(0);
    expect(s.coins[0]).toBe(0); expect(s.fish.length).toBe(before);
  });
  it("after rounds 1-3 a 9 s shop: 3 coins an item, for the next round only", () => {
    const s = make("shop"); toPlay(s);
    s.coins[0] = 7;
    until(s, () => s.phase === "shop");
    expect(inp(s, 0, { k: "buy", item: "net" })).not.toBeNull();
    step(s, [{ seat: 0, i: { k: "buy", item: "net" } }]);
    expect(s.coins[0]).toBe(4);
    expect(inp(s, 0, { k: "buy", item: "net" })).toBeNull(); // once
    expect(inp(s, 1, { k: "buy", item: "fast" })).toBeNull(); // no coins
    until(s, () => s.phase === "intro");
    expect(s.round).toBe(2); expect(s.buys[0]).toEqual(["net"]);
    toPlay(s);
    expect(s.next[0]).toEqual(["net"]); expect(s.buys[0]).toEqual([]);
  });
});

describe("the rounds", () => {
  it("Shoal Scramble: the first tap within TAP_R of an open splash takes it (8 at the prototype's scale; rule change 10 x 0.5): 2 coins and 2 fish out of the lake", () => {
    const s = make("scramble"); toPlay(s);
    until(s, () => s.spots.some((p) => p.open && p.taken < 0));
    const p = s.spots.find((x) => x.open && x.taken < 0)!, before = s.fish.length;
    step(s, [{ seat: 1, i: inp(s, 1, { k: "tap", x: p.x + Q.TAP_R - 0.5, y: p.y })! }, { seat: 0, i: inp(s, 0, { k: "tap", x: p.x, y: p.y })! }]);
    expect(p.taken).toBe(1);
    expect(s.coins).toEqual([0, Q.SCRAMBLE_COINS]);
    expect(before - s.fish.length).toBe(Q.SCRAMBLE_FISH);
  });
  it("Koi Chase: gates in order pay 1 coin and 1 fish each", () => {
    const s = make("koi"); toRound(s, 2); expect(s.game).toBe("koi"); toPlay(s);
    const b = s.boats[0], g = s.path[0], before = s.fish.length;
    b.x = b.tx = g[0]; b.y = b.ty = g[1]; s.koi.x = 999; step(s);
    expect(b.gate).toBe(1); expect(s.coins[0]).toBe(Q.GATE_COINS); expect(before - s.fish.length).toBe(1);
  });
  it("Tug of Line: REEL inside the green +9, outside -6 and a stun; finishing pays 6, 4, 2, 1 and takes no fish", () => {
    const s = make("tug"); toRound(s, 3); expect(s.game).toBe("tug"); toPlay(s);
    const before = s.fish.length;
    s.tug.needle = s.tug.zone; step(s, [{ seat: 0, i: { k: "reel" } }]);
    expect(s.boats[0].reel).toBe(Q.REEL_UP);
    s.tug.needle = s.tug.zone > 0.5 ? 0 : 1; s.tug.zv = 0; step(s, [{ seat: 0, i: { k: "reel" } }]);
    expect(s.boats[0].reel).toBe(Q.REEL_UP - Q.REEL_DOWN); expect(s.boats[0].stun).toBeGreaterThan(0);
    s.boats[1].reel = 95; s.tug.needle = s.tug.zone; step(s, [{ seat: 1, i: { k: "reel" } }]);
    expect(s.coins[1]).toBe(6); expect(s.fish.length).toBe(before);
  });
  it("Lantern Night: a seat's frame holds only the fish within NIGHT_VIEW of its boat or LANTERN_LIGHT of a dropped lantern (16 and 14 at the prototype's scale; rule change 10 x 0.5)", () => {
    const s = make("night"); toRound(s, 4); expect(s.game).toBe("night"); toPlay(s);
    const f0 = party.frameFor(s, 0) as { f: number[][] };
    expect(f0.f.length).toBeLessThan(s.fish.length);
    for (const [x, y] of f0.f) expect(seesFish(s, 0, x / 10, y / 10)).toBe(true);
    for (const [x, y] of f0.f) expect(Math.hypot(x / 10 - s.boats[0].x, y / 10 - s.boats[0].y)).toBeLessThan(Q.NIGHT_VIEW + 0.2);
    // a dropped lantern lights a spot for everyone
    const b1 = s.boats[1]; step(s, [{ seat: 1, i: { k: "lantern" } }]);
    expect(seesFish(s, 0, b1.x + 3, b1.y)).toBe(true);
  });
  it("the Last Net: the school is the lake / 7; picks are secret until all are in; a net that fits pays double, a torn one 1", () => {
    for (const [a, b, fit] of [[3, 6, true], [10, 10, false]] as const) {
      const s = make(`last-${a}-${b}`); toRound(s, 5);
      expect(s.phase).toBe("pick");
      s.last!.cap = 12; s.coins = [0, 0];
      step(s, [{ seat: 0, i: inp(s, 0, { k: "pick", n: a })! }]);
      expect(JSON.stringify(party.frameFor(s, 1))).not.toContain(`"picks":[${a}`);
      expect((party.frameFor(s, 1) as { last: { picked: boolean[] } }).last.picked).toEqual([true, false]);
      const before = s.fish.length;
      step(s, [{ seat: 1, i: inp(s, 1, { k: "pick", n: b })! }]);
      expect(s.last!.fit).toBe(fit);
      expect(s.coins).toEqual(fit ? [a * 2, b * 2] : [1, 1]);
      expect(before - s.fish.length).toBe(fit ? a + b : 12);
    }
  });
});

describe("results", () => {
  it("score = coins x the tier of next spring; the room keeps what is left, carried through nextSpring()", () => {
    const s = make("score"); s.coins = [10, 4]; s.phase = "end";
    const r = party.results(s), tier = tierOf(nextSpring(s.fish.length));
    expect(r.lakeLeft).toBe(s.fish.length); expect(party.breeds).toBe(false);
    expect(r.seats.map((x) => x.score)).toEqual([Math.round(10 * tier.mult), Math.round(4 * tier.mult)]);
  });
  it("bots play whole parties to the end, and a replay of the stored inputs is exact", () => {
    for (const seed of ["pb-a", "pb-b"]) {
      const seats = botsOf(4), s = party.make(seed, seats, LAKE);
      const inputs = new Map<number, { seat: number; i: unknown }[]>();
      let evs: GameEvent[] = [];
      for (let tick = 0; !party.over(s) && tick < 40000; tick++) {
        const applied: { seat: number; i: PartyInput }[] = [];
        for (const st of seats) for (const raw of party.bot(s, st.seat, botStream(seed, st.bot!, tick, st.seat))) { const ok = party.input(s, st.seat, raw); if (ok) applied.push({ seat: st.seat, i: ok }); }
        if (applied.length) inputs.set(tick, applied);
        evs = evs.concat(eventsFor(party.step(s, applied), 0));
      }
      expect(party.over(s)).toBe(true);
      expect(s.coins.some((c) => c > 0)).toBe(true);
      expect(party.results(replay(party, seed, seats, LAKE, inputs))).toEqual(party.results(s));
    }
  }, 120000);
});
