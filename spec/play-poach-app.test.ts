import { expect, inject, it } from "vitest";
import { joinRoom, openRoom, openStream, post } from "./play-helpers.ts";

// Who's Poaching on /play over HTTP, against the RUNNING app (never
// production): four people in one room, each with their own cookie. Each
// stream carries only its own role; a fisher's stream never names the
// poacher before the end. They skip every vote, so the poacher survives day
// 3; then the results reveal every role, and one of them asks for the rematch.
const baseUrl = inject("baseUrl");

it("poach 1. four people play Who's Poaching from the lobby to the results and a rematch", { timeout: 420_000 }, async () => {
  const code = await openRoom(baseUrl, "poach");
  const names = ["Ava", "Bo", "Cy", "Di"], chars = ["mei", "wang", "jin", "lu"];
  const jars: string[] = [];
  for (let i = 0; i < 4; i++) jars.push(await joinRoom(baseUrl, code, names[i], chars[i]));
  const streams = jars.map((c) => openStream(baseUrl, `/play/${code}/events`, c));
  await streams[3].next((e) => e.event === "room" && JSON.parse(e.data).players.length === 4);

  expect((await post(baseUrl, code, "start", jars[0], { bots: false })).status).toBe(200);
  const gos = await Promise.all(streams.map((s) => s.next((e) => e.event === "go")));
  const roles = gos.map((g) => JSON.parse(g.data).frame.role);
  expect(roles.filter((r) => r === "poacher").length).toBe(1);
  expect(roles.filter((r) => r === "fisher").length).toBe(3);
  const go = JSON.parse(gos[0].data);
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 300));

  // day 1: everyone fishes; the poacher uses the fine net
  const p = roles.indexOf("poacher");
  for (let i = 0; i < 4; i++) expect((await post(baseUrl, code, "in", jars[i], { k: "cast" })).status).toBe(200);
  expect((await post(baseUrl, code, "in", jars[p], { k: "fine" })).status).toBe(200);
  expect((await post(baseUrl, code, "in", jars[(p + 1) % 4], { k: "fine" })).status).toBe(409); // a fisher has no fine net
  expect((await post(baseUrl, code, "in", jars[0], { k: "say", p: "hello", text: "free text" })).status).toBe(409);

  // two meetings: everyone skips
  for (const day of [1, 2]) {
    await Promise.all(streams.map((s) => s.next((e) => e.event === "frame" && JSON.parse(e.data).ev.some((x: { k: string }) => x.k === "meeting"), 100_000)));
    expect((await post(baseUrl, code, "in", jars[1], { k: "say", p: "was", bay: "East Bay" })).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await post(baseUrl, code, "in", jars[i], { k: "vote", target: null })).status).toBe(200);
    await streams[0].next((e) => e.event === "frame" && JSON.parse(e.data).ev.some((x: { k: string }) => x.k === "dawn"), 20_000);
    expect(day).toBeGreaterThan(0);
  }

  const end = JSON.parse((await streams[0].next((e) => e.event === "room" && JSON.parse(e.data).state === "end", 100_000)).data);
  expect(end.results.extra.winner).toBe("poacher");
  expect(end.results.extra.roles[p]).toBe("poacher");
  expect(end.results.highlights.length).toBe(3);

  // no fisher's stream named the poacher before the end
  for (let i = 0; i < 4; i++) {
    if (i === p) continue;
    const raw = streams[i].raw();
    const before = raw.slice(0, raw.indexOf('"k":"end"'));
    expect(before).not.toContain("poacher");
    expect(before).toContain('"role":"fisher"');
  }

  // the rematch deals the roles again
  expect((await post(baseUrl, code, "start", jars[2], { bots: false })).status).toBe(200);
  const again = await streams[2].next((e) => e.event === "go");
  expect(["fisher", "poacher"]).toContain(JSON.parse(again.data).frame.role);
  const summary = await (await fetch(new URL(`/play/${code}/summary.json`, baseUrl))).json();
  expect(summary.matches[0].summary.rematchBy).toBeNull();
  expect(summary.matches[1].seed).toBeNull();
  // clean up: the room's first player stops the rematch, so it does not keep running on the server
  expect((await post(baseUrl, code, "stop", jars[0], {})).status).toBe(200);
  for (const s of streams) await s.close();
});
