import { expect, inject, it } from "vitest";
import { joinRoom, openRoom, openStream, post } from "./play-helpers.ts";

// Lake Holdings 2.0 on /play over HTTP, against the RUNNING app (never
// production): two people and two bots, four seasons of three moves, the
// results, and a rematch. Each person's frames carry only their own hand, and
// nobody's pick shows before the reveal.
const baseUrl = inject("baseUrl");
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
type Frame = { phase: string; season: number; action: number; t: (string | number)[][]; p: { seat: number; picked: boolean }[]; me: { hand: string[]; pick: unknown } };
// a legal move from what the frame shows: a Flag next to your water, else a building on your own empty tile
function moveFor(f: Frame, seat: number): { k: string; card?: string; tile?: number } {
  const at = new Map(f.t.map((x) => [`${x[1]},${x[2]}`, x]));
  const flag = f.t.find((x) => x[8] === -1 && DIRS.some(([a, b]) => at.get(`${(x[1] as number) + a},${(x[2] as number) + b}`)?.[8] === seat));
  if (flag) return { k: "place", card: "claim", tile: flag[0] as number };
  const card = f.me.hand.find((c) => c !== "claim"), own = f.t.find((x) => x[8] === seat && x[9] === "");
  return card && own ? { k: "place", card, tile: own[0] as number } : { k: "pass" };
}

it("hold 1. two people and two bots play Lake Holdings 2.0 from the room to the results and a rematch", { timeout: 300_000 }, async () => {
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
  expect(go.frame.me.hand.length).toBe(3);
  expect(go.frame.me.hand[0]).toBe("claim");
  const goB = JSON.parse((await sb.next((e) => e.event === "go")).data);
  expect(JSON.stringify(go.frame)).not.toContain(`"hand":${JSON.stringify(goB.frame.me.hand)}`); // only your own hand
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 300));

  expect((await post(baseUrl, code, "in", a, { k: "place", card: "dragon", tile: 0 })).status).toBe(409);
  // every move, both people place a legal card as soon as the pick opens
  for (let move = 0; move < 12; move++) {
    const fa = JSON.parse((await sa.next((e) => e.event === "frame" && JSON.parse(e.data).f.phase === "pick" && !JSON.parse(e.data).f.p[0].picked, 60_000)).data).f as Frame;
    const fb = JSON.parse((await sb.next((e) => e.event === "frame" && JSON.parse(e.data).f.phase === "pick" && !JSON.parse(e.data).f.p[1].picked, 60_000)).data).f as Frame;
    const ma = moveFor(fa, 0), mb = moveFor(fb, 1);
    expect((await post(baseUrl, code, "in", a, ma)).status, `move ${move} A`).toBe(200);
    // B's frame may not show what A picked, only that A has picked
    const fb2 = JSON.parse((await sb.next((e) => e.event === "frame" && JSON.parse(e.data).f.p[0].picked, 10_000)).data).f;
    expect(fb2.reveal).toBeNull();
    expect((await post(baseUrl, code, "in", b, mb)).status, `move ${move} B`).toBe(200);
    await sa.next((e) => e.event === "frame" && JSON.parse(e.data).f.phase !== "pick", 30_000);
  }

  const end = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "end", 120_000)).data);
  expect(end.results.seats.length).toBe(4);
  expect(end.results.highlights.length).toBe(3);
  for (const s of end.results.seats) expect(s.score).toBeGreaterThanOrEqual(2);

  expect((await post(baseUrl, code, "start", b, { bots: true })).status).toBe(200);
  await sb.next((e) => e.event === "go");
  // clean up: the room's first player stops the rematch, so it does not keep running on the server
  expect((await post(baseUrl, code, "stop", a, {})).status).toBe(200);
  await sa.close(); await sb.close();
});
