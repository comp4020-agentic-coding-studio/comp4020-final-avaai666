import { expect, inject, it } from "vitest";
import { joinRoom, openRoom, openStream, post } from "./play-helpers.ts";
import { A0, Y0 } from "../src/lib/lake-world.ts";

// Fishing Party on /play over HTTP, against the RUNNING app (never
// production): two people play all five rounds (each a different game), use
// the shop, pick Last Net sizes in secret, reach the results, and rematch.
const baseUrl = inject("baseUrl");
const frameWith = (pred: (f: { phase: string; game: string; shoals: number[][] }, ev: { k: string }[]) => boolean) =>
  (e: { event: string; data: string }) => { if (e.event !== "frame") return false; const d = JSON.parse(e.data); return pred(d.f, d.ev); };

it("party 1. two people play Fishing Party from the lobby to the results and a rematch", { timeout: 420_000 }, async () => {
  const code = await openRoom(baseUrl, "party");
  const a = await joinRoom(baseUrl, code, "Ava", "lian");
  const b = await joinRoom(baseUrl, code, "Bo", "shitou");
  const sa = openStream(baseUrl, `/play/${code}/events`, a);
  const sb = openStream(baseUrl, `/play/${code}/events`, b);
  await sb.next((e) => e.event === "room" && JSON.parse(e.data).players.length === 2);
  expect((await post(baseUrl, code, "start", a, { bots: false })).status).toBe(200);
  await sa.next((e) => e.event === "go");

  const games: string[] = [];
  for (let round = 1; round <= 5; round++) {
    const r = await sa.next(frameWith((_f, ev) => ev.some((x) => x.k === "round")), 30_000);
    const game = JSON.parse(r.data).ev.find((x: { k: string }) => x.k === "round").game;
    games.push(game);
    if (game === "shoal") {
      const sh = await sb.next(frameWith((f) => f.shoals.length > 0), 10_000);
      const [x, y] = JSON.parse(sh.data).f.shoals[0];
      expect((await post(baseUrl, code, "in", b, { k: "tap", x, y })).status).toBe(200);
    }
    if (game === "tug") expect((await post(baseUrl, code, "in", a, { k: "reel" })).status).toBe(200);
    if (game === "koi" || game === "night") expect((await post(baseUrl, code, "in", a, { k: "steer", x: 500, y: 350 })).status).toBe(200);
    if (game === "last") {
      expect((await post(baseUrl, code, "in", a, { k: "pick", size: 3 })).status).toBe(200);
      // Bo cannot see Ava's pick
      const seen = await sb.next(frameWith((f) => f.phase === "round"), 5000);
      expect(JSON.parse(seen.data).f.myPick).toBeNull();
      expect(seen.data).not.toContain('"picks"');
      expect((await post(baseUrl, code, "in", b, { k: "pick", size: 6 })).status).toBe(200);
      expect((await post(baseUrl, code, "in", b, { k: "pick", size: 7 })).status).toBe(409);
    }
    if (round < 5) {
      await sa.next(frameWith((f) => f.phase === "shop"), 60_000);
      expect((await post(baseUrl, code, "in", a, { k: "buy", item: "bigNet" })).status).toBe(200);
    }
  }
  expect(games[4]).toBe("last");
  expect(new Set(games).size).toBe(5);

  const end = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "end", 60_000)).data);
  expect(end.results.seats.length).toBe(2);
  expect(end.results.highlights.length).toBe(3);
  expect(end.results.lakeAfter).toBeLessThan(A0 + Y0);

  expect((await post(baseUrl, code, "start", b, { bots: false })).status).toBe(200);
  await sb.next((e) => e.event === "go");
  // clean up: the room's first player stops the rematch, so it does not keep running on the server
  expect((await post(baseUrl, code, "stop", a, {})).status).toBe(200);
  await sa.close(); await sb.close();
});
