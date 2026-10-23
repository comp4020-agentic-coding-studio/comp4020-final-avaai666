import { expect, inject, it } from "vitest";
import { joinRoom, openRoom, openStream, post } from "./play-helpers.ts";

// Who's Poaching 2.0 on /play over HTTP, against the RUNNING app (never
// production): four people in one room, each with their own cookie. Each
// stream carries only its own role; a fisher's stream never names the
// poacher before the end. They skip the first two votes and vote out an
// innocent at the last, so the poacher survives day 3; then the results
// reveal every role, and one of them asks for the rematch.
const baseUrl = inject("baseUrl");

it("poach 1. four people play Who's Poaching 2.0 from the room to the results and a rematch", { timeout: 480_000 }, async () => {
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
  expect(JSON.parse(gos[0].data).frame.phase).toBe("role");
  const p = roles.indexOf("poacher"), f = (p + 1) % 4;

  // day 1: the role card waits until everyone says they understand (rule change 9), then the day
  for (const jar of jars) expect((await post(baseUrl, code, "in", jar, { k: "ready" })).status).toBe(200);
  await streams[0].next((e) => e.event === "frame" && JSON.parse(e.data).f.phase === "day", 30_000);
  expect((await post(baseUrl, code, "in", jars[f], { k: "net" })).status).toBe(200);
  expect((await post(baseUrl, code, "in", jars[p], { k: "fine" })).status).toBe(200);
  expect((await post(baseUrl, code, "in", jars[f], { k: "fine" })).status).toBe(409); // a fisher has no fine net
  expect((await post(baseUrl, code, "in", jars[f], { k: "say", line: { k: "sus", i: p } })).status).toBe(409); // no talking by day

  // three meetings: two skipped, the last votes out an innocent
  for (const day of [1, 2, 3]) {
    const meet = JSON.parse((await streams[f].next((e) => e.event === "frame" && JSON.parse(e.data).f.phase === "meeting", 100_000)).data).f;
    expect(meet.m.final).toBe(day === 3);
    // free text is refused; a fisher cannot claim to have seen a fine net it never saw
    expect((await post(baseUrl, code, "in", jars[f], { k: "say", line: { k: "free", text: "hello" } })).status).toBe(409);
    if (!meet.m.witnessed.includes(p)) expect((await post(baseUrl, code, "in", jars[f], { k: "say", line: { k: "sawnet", i: p } })).status).toBe(409);
    expect((await post(baseUrl, code, "in", jars[f], { k: "say", line: meet.m.lines[0] })).status).toBe(200);
    const innocent = (p + 2) % 4, other = (p + 3) % 4;
    for (let i = 0; i < 4; i++) {
      const target = day < 3 ? null : i === innocent ? other : innocent;
      expect((await post(baseUrl, code, "in", jars[i], { k: "vote", target })).status, `day ${day} seat ${i}`).toBe(200);
    }
    if (day < 3) await streams[0].next((e) => e.event === "frame" && JSON.parse(e.data).f.phase === "day", 30_000);
  }

  const end = JSON.parse((await streams[0].next((e) => e.event === "room" && JSON.parse(e.data).state === "end", 60_000)).data);
  expect(end.results.extra.winner).toBe("poacher");
  expect(end.results.extra.roles[p]).toBe("poacher");
  expect(end.results.highlights.length).toBe(3);

  // no fisher's stream named the poacher before the end
  for (let i = 0; i < 4; i++) {
    if (i === p) continue;
    const raw = streams[i].raw();
    const before = raw.slice(0, raw.indexOf('"phase":"end"'));
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
