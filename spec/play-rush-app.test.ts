import { expect, inject, it } from "vitest";
import { openRoom, joinRoom, post, openStream } from "./play-helpers.ts";

// Boat Rush on /play over HTTP, against the RUNNING app (never production):
// two people open a room from the lobby, join with their own cookies, play a
// whole match (2½ minutes) to the results, and one of them asks for the
// rematch, which starts with the lake the first match left.
const baseUrl = inject("baseUrl");

it("rush 1. two people play Boat Rush from the lobby to the results and a rematch", { timeout: 240_000 }, async () => {
  const code = await openRoom(baseUrl, "rush");
  const a = await joinRoom(baseUrl, code, "Ava", "mei");
  const b = await joinRoom(baseUrl, code, "Bo", "jin");
  const sa = openStream(baseUrl, `/play/${code}/events`, a);
  const sb = openStream(baseUrl, `/play/${code}/events`, b);
  const room = JSON.parse((await sb.next((e) => e.event === "room" && JSON.parse(e.data).players.length === 2)).data);
  expect(room.mode).toBe("rush");
  expect(room.lake.fish).toBe(220);

  expect((await post(baseUrl, code, "start", a, { bots: false })).status).toBe(200);
  const go = JSON.parse((await sb.next((e) => e.event === "go")).data);
  expect(go.frame.b.length).toBe(2); // two boats, no bots
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 200));

  // one steer from Ava reaches Bo's frames, decided by the server
  const t0 = performance.now();
  expect((await post(baseUrl, code, "in", a, { k: "steer", x: 321, y: 234 })).status).toBe(200);
  await sb.next((e) => e.event === "frame" && JSON.parse(e.data).f.b[0][11] === 321 && JSON.parse(e.data).f.b[0][12] === 234);
  const ms = performance.now() - t0;
  console.log(`rush steer -> the other stream: ${ms.toFixed(1)} ms`);
  expect((await post(baseUrl, code, "in", b, { k: "cast", charge: 1 })).status).toBe(200);
  const cast = await sb.next((e) => e.event === "frame" && JSON.parse(e.data).ev.some((x: { k: string }) => x.k === "cast"), 3000);
  expect(JSON.parse(cast.data).ev.find((x: { k: string }) => x.k === "cast").r).toBeCloseTo(38 * 1.6, 0);
  expect((await post(baseUrl, code, "in", a, { k: "teleport" })).status).toBe(409);

  // the horn, then the results with three highlights and the lake left
  const end = await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "end", 170_000);
  const results = JSON.parse(end.data).results;
  expect(results.seats.length).toBe(2);
  expect(results.highlights.length).toBe(3);
  expect(results.lakeBefore).toBe(220);
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
  expect(summary.matches[0].summary.lakeAfter).toBeGreaterThan(0); // what the match left (fish breed in a match, so it can pass 220)
  expect(lakeNow).toBeLessThanOrEqual(220); // between matches the lake never holds more than full
  expect(JSON.stringify(summary)).not.toContain(a.split("=")[1]); // no tokens
  expect(summary.matches[1].summary).toBeNull();
  await sa.close(); await sb.close();
});
