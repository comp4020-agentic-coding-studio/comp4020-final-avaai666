import { expect, inject, it } from "vitest";
import { joinRoom, openRoom, openStream, post } from "./play-helpers.ts";

// Lake Holdings on /play over HTTP, against the RUNNING app (never
// production): two people and two bots, twelve tides, the results, and a
// rematch. Each person's frames carry only their own hand.
const baseUrl = inject("baseUrl");

it("hold 1. two people and two bots play Lake Holdings from the lobby to the results and a rematch", { timeout: 300_000 }, async () => {
  const code = await openRoom(baseUrl, "hold");
  const a = await joinRoom(baseUrl, code, "Ava", "lu");
  const b = await joinRoom(baseUrl, code, "Bo", "lian");
  const sa = openStream(baseUrl, `/play/${code}/events`, a);
  const sb = openStream(baseUrl, `/play/${code}/events`, b);
  await sb.next((e) => e.event === "room" && JSON.parse(e.data).players.length === 2);
  expect((await post(baseUrl, code, "start", a, { bots: true })).status).toBe(200);
  const room = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "play")).data);
  expect(room.seats.length).toBe(4);
  expect(room.seats.filter((s: { bot: string | null; name: string }) => s.bot).every((s: { name: string }) => s.name.endsWith("(bot)"))).toBe(true);
  const go = JSON.parse((await sa.next((e) => e.event === "go")).data);
  expect(go.frame.hand.length).toBe(3);
  expect(go.frame.hands).toEqual([3, 3, 3, 3]); // others' hands only as counts
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 300));

  // Ava plays a card from her own hand on her own water (or claims next to it)
  const f = JSON.parse((await sa.next((e) => e.event === "frame")).data).f;
  const card = f.hand[0];
  const mine = f.tiles.filter((t: number[]) => t[3] === 0).map((t: number[]) => t[0]);
  const target = card === "claim" ? f.tiles.find((t: number[]) => t[3] === -1)[0] : mine[0];
  expect((await post(baseUrl, code, "in", a, { k: "play", card, tile: target })).status).toBe(200);
  expect((await post(baseUrl, code, "in", a, { k: "play", card: "dragon", tile: 0 })).status).toBe(409);
  if (card !== "claim") await sb.next((e) => e.event === "frame" && JSON.parse(e.data).ev.some((x: { k: string; tile: number }) => x.k === "built" && x.tile === target), 5000);
  const tide = await sb.next((e) => e.event === "frame" && JSON.parse(e.data).ev.some((x: { k: string }) => x.k === "tide"), 20_000);
  expect(JSON.parse(tide.data).f.tide).toBe(1);

  const end = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "end", 200_000)).data);
  expect(end.results.seats.length).toBe(4);
  expect(end.results.highlights.length).toBe(3);
  for (const s of end.results.seats) expect(s.score).toBeGreaterThanOrEqual(3);

  expect((await post(baseUrl, code, "start", b, { bots: true })).status).toBe(200);
  await sb.next((e) => e.event === "go");
  // clean up: the room's first player stops the rematch, so it does not keep running on the server
  expect((await post(baseUrl, code, "stop", a, {})).status).toBe(200);
  await sa.close(); await sb.close();
});
