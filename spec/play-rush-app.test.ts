import { expect, inject, it } from "vitest";
import { openRoom, joinRoom, post, openStream } from "./play-helpers.ts";
import { A0, blockedAt, K, nr, Y0, ZONES } from "../src/lib/lake-world.ts";
import { RUSH } from "../src/lib/game-constants.ts";

// Boat Rush on /play over HTTP, against the RUNNING app (never production):
// two people open a room from the lobby, join with their own cookies, play a
// whole match (2½ minutes) to the results, and one of them asks for the
// rematch, which starts with the lake the first match left.
const baseUrl = inject("baseUrl");

// a steer target, in the v5 lake's own space (rule change 2): open water,
// not a zone, the island or winter ice, so a wrong point fails loudly here
// rather than timing out below if the shape ever changes again. Rule change 8
// (the lake at 0.7) moved (32, 23) onto the shore; (22, 16) is the same spot.
const STEER_X = 22, STEER_Y = 16;
const isOpenWater = (x: number, y: number) =>
  nr(x, y) < 0.6 && !blockedAt(x, y, 0) && !blockedAt(x, y, 3) && !Object.values(ZONES).some((z) => Math.hypot(x - z.x, y - z.y) < z.r);
if (!isOpenWater(STEER_X, STEER_Y)) throw new Error(`(${STEER_X}, ${STEER_Y}) is not open water in the current lake shape`);

// a full match's own length (4 seasons, their rests and markets), not a
// hard-coded number, so a future season-length tune cannot silently make
// this wait too short again (rule change 1, 4 x 45 s seasons)
const MATCH_S = RUSH.SEASONS * RUSH.SEASON_S + (RUSH.SEASONS - 1) * RUSH.REST_S + (RUSH.SEASONS - 1) * (RUSH.MARKET_S + RUSH.REVEAL_S); // winter's gong ends the match directly: no fourth rest (bug fix)
const END_WAIT_MS = MATCH_S * 1000 + 60_000;

it("rush 1. two people play Boat Rush from the lobby to the results and a rematch", { timeout: END_WAIT_MS + 60_000 }, async () => {
  const code = await openRoom(baseUrl, "rush");
  const a = await joinRoom(baseUrl, code, "Ava", "mei");
  const b = await joinRoom(baseUrl, code, "Bo", "jin");
  const sa = openStream(baseUrl, `/play/${code}/events`, a);
  const sb = openStream(baseUrl, `/play/${code}/events`, b);
  const room = JSON.parse((await sb.next((e) => e.event === "room" && JSON.parse(e.data).players.length === 2)).data);
  expect(room.mode).toBe("rush");
  expect(room.lake.fish).toBe(A0 + Y0);

  expect((await post(baseUrl, code, "start", a, { bots: false })).status).toBe(200);
  const go = JSON.parse((await sb.next((e) => e.event === "go")).data);
  expect(go.frame.b.length).toBe(2); // two boats, no bots
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 200));

  // one steer from Ava reaches Bo's frames, decided by the server
  const t0 = performance.now();
  expect((await post(baseUrl, code, "in", a, { k: "steer", x: STEER_X, y: STEER_Y })).status).toBe(200);
  await sb.next((e) => e.event === "frame" && JSON.parse(e.data).f.b[0][11] === STEER_X * 10 && JSON.parse(e.data).f.b[0][12] === STEER_Y * 10);
  const ms = performance.now() - t0;
  console.log(`rush steer -> the other stream: ${ms.toFixed(1)} ms`);
  expect((await post(baseUrl, code, "in", b, { k: "cast", charge: 1 })).status).toBe(200);
  const cast = await sb.next((e) => e.event === "frame" && JSON.parse(e.data).ev.some((x: { k: string }) => x.k === "cast"), 3000);
  expect(JSON.parse(cast.data).ev.find((x: { k: string }) => x.k === "cast").r).toBeCloseTo(RUSH.NET_R * 1.3);
  expect((await post(baseUrl, code, "in", a, { k: "teleport" })).status).toBe(409);

  // the horn, then the results with three highlights and the lake left
  const end = await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "end", END_WAIT_MS);
  const results = JSON.parse(end.data).results;
  expect(results.seats.length).toBe(2);
  expect(results.highlights.length).toBe(3);
  expect(results.lakeBefore).toBe(A0 + Y0);
  expect(results.seats[0].inputs.steer).toBeGreaterThanOrEqual(1);
  const lakeNow = JSON.parse(end.data).lake.fish;

  // Bo asks for the rematch; it starts from the room's lake
  expect((await post(baseUrl, code, "start", b, { bots: false })).status).toBe(200);
  const again = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "play")).data);
  expect(again.lake.fish).toBe(lakeNow);
  await sa.next((e) => e.event === "go");
  const summary = await (await fetch(new URL(`/play/${code}/summary.json`, baseUrl))).json();
  expect(summary.matches.length).toBe(2);
  expect(summary.matches[1].summary).toBeNull(); // still running
  expect(summary.matches[1].seed).toBeNull(); // no seed for an unfinished match
  expect(summary.matches[0].summary.lakeAfter).toBeGreaterThan(0); // what the match left
  expect(lakeNow).toBeLessThanOrEqual(K); // next spring never holds more than K
  expect(JSON.stringify(summary)).not.toContain(a.split("=")[1]); // no tokens
  expect(summary.matches[1].summary).toBeNull();
  // clean up: the room's first player stops the rematch, so it does not keep running on the server
  expect((await post(baseUrl, code, "stop", a, {})).status).toBe(200);
  await sa.close(); await sb.close();
});
