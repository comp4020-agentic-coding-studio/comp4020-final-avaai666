import { expect, inject, it } from "vitest";
import { joinRoom, openRoom, openStream, post } from "./play-helpers.ts";

// Lake Holdings 3.0 (holdings 3.0) on /play over HTTP, against the RUNNING app (never production): two
// people and two bots play eight rounds turn by turn to the results, and a rematch. Only the player whose
// turn it is may roll, and only once. (Rewritten for holdings 3.0, Ava 24 Oct: "like Monopoly"; 2.0's
// cards, hands and simultaneous picks are gone, and with them this file's checks on hidden hands.)
const baseUrl = inject("baseUrl");
type Frame = { phase: string; round: number; turn: number; act: string[]; sq: (string | number)[][]; p: { seat: number; pos: number; coins: number }[] };

it("hold 1. two people and two bots play Lake Holdings 3.0 from the room to the results and a rematch", { timeout: 420_000 }, async () => {
  const code = await openRoom(baseUrl, "hold");
  const a = await joinRoom(baseUrl, code, "Ava", "lu");
  const b = await joinRoom(baseUrl, code, "Bo", "lian");
  const sa = openStream(baseUrl, `/play/${code}/events`, a);
  const sb = openStream(baseUrl, `/play/${code}/events`, b);
  await sb.next((e) => e.event === "room" && JSON.parse(e.data).players.length === 2);
  expect((await post(baseUrl, code, "start", a, { bots: true })).status).toBe(200);
  const room = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "play")).data);
  expect(room.seats.length).toBe(4);
  const go = JSON.parse((await sa.next((e) => e.event === "go")).data);
  expect(go.frame.sq.length).toBe(24);
  expect(go.frame.p.length).toBe(4);
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 300));

  const who = [a, b];
  expect((await post(baseUrl, code, "in", b, { k: "roll" })).status).toBe(409); // seat 0 goes first
  expect((await post(baseUrl, code, "in", a, { k: "dance" })).status).toBe(409);
  const done = new Set<string>();
  let rolls = 0, choices = 0, end: { results: { seats: { score: number }[]; highlights: unknown[] } } | null = null;
  while (!end) {
    const e = await sa.next((x) => x.event === "frame" || (x.event === "room" && JSON.parse(x.data).state === "end"), 60_000);
    if (e.event === "room") { end = JSON.parse(e.data); break; }
    const f = JSON.parse(e.data).f as Frame;
    if (f.turn > 1 || (f.phase !== "roll" && f.phase !== "act")) continue;
    const key = `${f.round}|${f.turn}|${f.phase}`;
    if (done.has(key)) continue;
    done.add(key);
    const cookie = who[f.turn];
    if (f.phase === "roll") {
      expect((await post(baseUrl, code, "in", cookie, { k: "roll" })).status, `roll ${key}`).toBe(200);
      // once the roll is applied (the next frame of this turn is past "roll"), a second roll is refused. (A
      // second roll inside the same tick is not refused: the room keeps one input of a kind per seat per
      // tick, so it replaces the first and there is still one roll.)
      await sa.next((x) => x.event === "frame" && JSON.parse(x.data).f.round === f.round && JSON.parse(x.data).f.turn === f.turn && JSON.parse(x.data).f.phase !== "roll", 10_000);
      expect((await post(baseUrl, code, "in", cookie, { k: "roll" })).status, `roll twice ${key}`).toBe(409);
      rolls++;
    } else {
      const k = f.act.includes("buy") ? "buy" : f.act.includes("haul") ? "haul" : "pass";
      expect((await post(baseUrl, code, "in", cookie, { k })).status, `${k} ${key}`).toBe(200);
      choices++;
    }
  }
  expect(rolls).toBe(16); // 8 rounds, two people
  expect(choices).toBeGreaterThan(0);

  expect(end!.results.seats.length).toBe(4);
  expect(end!.results.highlights.length).toBe(3);
  for (const s of end!.results.seats) expect(s.score).toBeGreaterThanOrEqual(1);

  expect((await post(baseUrl, code, "start", b, { bots: true })).status).toBe(200);
  await sb.next((e) => e.event === "go");
  // clean up: the room's first player stops the rematch, so it does not keep running on the server
  expect((await post(baseUrl, code, "stop", a, {})).status).toBe(200);
  await sa.close(); await sb.close();
});
