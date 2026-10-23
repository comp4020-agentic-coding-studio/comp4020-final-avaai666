import { expect, inject, it } from "vitest";
import { joinRoom, openRoom, openStream, post } from "./play-helpers.ts";

// Fishing Party 2.0 on /play over HTTP, against the RUNNING app (never
// production): two people play all five rounds in DESIGN's order, each opened
// by its intro card (both say they are ready), use the shop after rounds 1-3,
// pick Last Net sizes in secret, reach the results, and rematch.
// (Rewritten for party 2.0 under rule change 1: v4's rounds, its variants and
// its "round" event are gone.)
const baseUrl = inject("baseUrl");
type Frame = { phase: string; round: number; game: string; left: number; coins: number[]; ready: boolean[]; done: boolean[]; me?: { buys: string[] }; spots?: number[][]; last?: { picked: boolean[]; picks: number[] | null; mine: number | null } };
const frameWith = (pred: (f: Frame) => boolean) =>
  (e: { event: string; data: string }) => e.event === "frame" && pred(JSON.parse(e.data).f);

it("party 1. two people play Fishing Party 2.0 from the room to the results and a rematch", { timeout: 420_000 }, async () => {
  const code = await openRoom(baseUrl, "party");
  const a = await joinRoom(baseUrl, code, "Ava", "lian");
  const b = await joinRoom(baseUrl, code, "Bo", "shitou");
  const sa = openStream(baseUrl, `/play/${code}/events`, a);
  const sb = openStream(baseUrl, `/play/${code}/events`, b);
  await sb.next((e) => e.event === "room" && JSON.parse(e.data).players.length === 2);
  expect((await post(baseUrl, code, "start", a, { bots: false })).status).toBe(200);
  await sa.next((e) => e.event === "go");

  const games: string[] = [];
  for (let round = 1; round <= 4; round++) {
    const intro = JSON.parse((await sa.next(frameWith((f) => f.phase === "intro" && f.round === round), 60_000)).data).f as Frame;
    games.push(intro.game);
    expect((await post(baseUrl, code, "in", a, { k: "ready" })).status).toBe(200);
    await sa.next(frameWith((f) => f.phase === "intro" && f.ready[0]), 5000);
    expect((await post(baseUrl, code, "in", a, { k: "ready" })).status).toBe(409); // once
    expect((await post(baseUrl, code, "in", b, { k: "ready" })).status).toBe(200);
    await sa.next(frameWith((f) => f.phase === "play" && f.round === round), 10_000);
    if (intro.game === "scramble") {
      // Bo takes one splash; Ava takes splashes until she has 4 coins (2 a splash), enough for the shop
      const sh = JSON.parse((await sb.next(frameWith((f) => f.phase === "play" && (f.spots ?? []).some((p) => p[3] === 1)), 15_000)).data).f as Frame;
      const [, x, y] = sh.spots!.find((p) => p[3] === 1)!;
      expect((await post(baseUrl, code, "in", b, { k: "tap", x: x / 10, y: y / 10 })).status).toBe(200);
      for (let k = 0; k < 30; k++) {
        const fa = JSON.parse((await sa.next(frameWith((f) => f.phase !== "play" || f.coins[0] >= 4 || (f.spots ?? []).some((p) => p[3] === 1)), 15_000)).data).f as Frame;
        if (fa.phase !== "play" || fa.coins[0] >= 4) break;
        const [, ax, ay] = fa.spots!.find((p) => p[3] === 1)!;
        expect((await post(baseUrl, code, "in", a, { k: "tap", x: ax / 10, y: ay / 10 })).status).toBe(200);
      }
    }
    if (intro.game === "tug") expect((await post(baseUrl, code, "in", a, { k: "reel" })).status).toBe(200);
    if (intro.game === "koi" || intro.game === "night") expect((await post(baseUrl, code, "in", a, { k: "steer", x: 10, y: 20 })).status).toBe(200);
    if (intro.game === "night") expect((await post(baseUrl, code, "in", b, { k: "lantern" })).status).toBe(200);
    if (round <= 3) {
      // the shop: anyone with fewer than 3 coins is done already, and if nobody can buy it is skipped
      const shop = JSON.parse((await sa.next(frameWith((f) => (f.phase === "shop" && f.round === round) || f.round > round), 60_000)).data).f as Frame;
      if (round === 1) { expect(shop.phase).toBe("shop"); expect(shop.coins[0]).toBeGreaterThanOrEqual(3); }
      if (shop.phase !== "shop") continue;
      if (shop.done[1]) expect((await post(baseUrl, code, "in", b, { k: "done" })).status).toBe(409);
      if (shop.coins[0] >= 3) {
        expect((await post(baseUrl, code, "in", a, { k: "buy", item: "net" })).status).toBe(200);
        await sa.next(frameWith((f) => f.phase === "shop" && !!f.me?.buys.includes("net")), 5000);
        expect((await post(baseUrl, code, "in", a, { k: "buy", item: "net" })).status).toBe(409);
      }
      if (!shop.done[0]) expect((await post(baseUrl, code, "in", a, { k: "done" })).status).toBe(200);
      if (!shop.done[1]) expect((await post(baseUrl, code, "in", b, { k: "done" })).status).toBe(200);
    }
  }
  expect(games).toEqual(["scramble", "koi", "tug", "night"]);

  // round 5, the Last Net: picks are secret until both are in
  await sa.next(frameWith((f) => f.phase === "pick"), 60_000);
  expect((await post(baseUrl, code, "in", a, { k: "pick", n: 3 })).status).toBe(200);
  const seen = JSON.parse((await sb.next(frameWith((f) => f.phase === "pick" && !!f.last?.picked[0]), 5000)).data).f as Frame;
  expect(seen.last!.picks).toBeNull();
  expect(seen.last!.mine).toBeNull();
  expect((await post(baseUrl, code, "in", b, { k: "pick", n: 7 })).status).toBe(409); // only 3, 6 or 10
  expect((await post(baseUrl, code, "in", b, { k: "pick", n: 6 })).status).toBe(200);
  const shown = JSON.parse((await sb.next(frameWith((f) => f.phase === "reveal"), 10_000)).data).f as Frame;
  expect((await post(baseUrl, code, "in", b, { k: "pick", n: 10 })).status).toBe(409); // once
  expect(shown.last!.picks).toEqual([3, 6]);

  const end = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "end", 60_000)).data);
  expect(end.results.seats.length).toBe(2);
  expect(end.results.highlights.length).toBe(3);
  expect(end.results.extra.last.picks).toEqual([3, 6]);

  expect((await post(baseUrl, code, "start", b, { bots: false })).status).toBe(200);
  await sb.next((e) => e.event === "go");
  // clean up: the room's first player stops the rematch, so it does not keep running on the server
  expect((await post(baseUrl, code, "stop", a, {})).status).toBe(200);
  await sa.close(); await sb.close();
});
