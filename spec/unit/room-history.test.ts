import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createGameHub, type GameHub } from "../../src/lib/game-hub.ts";
import { type Mode, streamOf } from "../../src/lib/game-platform.ts";
import { type GameStore, openGameStore } from "../../src/lib/game-store.ts";
import { A0, Y0 } from "../../src/lib/lake-world.ts";

// "What happened here" (DESIGN.md "The site"): a room's finished matches,
// from game_matches, with when, game, winner and the lake before and after.
// No seeds and no tokens; a running or stopped match is not a line.

interface Fake { tick: number; points: number[]; lake: number }
const fake: Mode<Fake, { k: "dig" }> = {
  id: "fake", model: "fake 1.0", seats: { min: 2, max: 3, botFill: 3 }, breeds: false,
  make: (seed, seats, lake) => { streamOf(seed, "lake"); return { tick: 0, points: seats.map(() => 0), lake: lake.fish }; },
  input: (_s, _seat, raw) => ((raw as { k?: unknown })?.k === "dig" ? { k: "dig" } : null),
  step(s, inputs) { for (const { seat } of inputs) if (s.lake > 0) { s.points[seat]++; s.lake--; } s.tick++; return []; },
  frameFor: (s) => ({ points: s.points }),
  over: (s) => s.tick >= 40,
  results: (s) => ({
    seats: s.points.map((p, seat) => ({ seat, score: p, place: 1 + s.points.filter((q) => q > p).length, firstScoreS: null })),
    lakeLeft: s.lake, highlights: [],
  }),
  bot: () => [],
};

let dir: string, store: GameStore, hub: GameHub, clock = 0;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "room-history-"));
  store = openGameStore(join(dir, "pond.db"), () => clock);
  clock = 7_000_000;
  hub = createGameHub(store, { fake }, () => clock, (e) => { throw e; }, ["fake"]);
});
afterEach(() => { hub.close(); store.close(); rmSync(dir, { recursive: true, force: true }); });

it("lists finished matches only, newest first, with the winner and the lake before and after, and no seed or token", () => {
  const { code } = hub.createRoom("fake");
  const a = hub.join(code, "Ava", "mei"), b = hub.join(code, "Bo", "jin");
  if (!a.ok || !b.ok) throw new Error("join failed");
  expect(hub.history(code)).toEqual([]);

  hub.start(code, a.seat, { bots: false });
  clock = hub.view(code, a.seat)!.startedAt! + 10;
  for (let i = 0; i < 5; i++) hub.input(code, b.seat, { k: "dig" }), (clock += 50), hub.tick();
  expect(hub.history(code)).toEqual([]); // still running
  for (let i = 0; i < 400; i++) { clock += 25; hub.tick(); }

  const lines = hub.history(code)!;
  expect(lines.length).toBe(1);
  expect(lines[0].mode).toBe("fake");
  expect(lines[0].winner).toEqual({ kind: "seat", name: "Bo", character: "jin", bot: false });
  expect(lines[0].lakeBefore).toBe(A0 + Y0);
  expect(lines[0].lakeAfter).toBeLessThan(A0 + Y0);
  expect(typeof lines[0].endedAt).toBe("number");

  // a stopped match is not a line
  hub.start(code, a.seat, { bots: false });
  hub.stop(code, a.seat);
  expect(hub.history(code)!.length).toBe(1);

  const m = store.lastMatch(store.roomByCode(code)!.id)!;
  const json = JSON.stringify(hub.history(code));
  expect(json).not.toContain(m.seed);
  expect(json).not.toContain(a.token);
  expect(json).not.toContain(b.token);
  expect(hub.history("ZZZZ")).toBeNull();
});

it("the room's stream carries the history with each room event, so an open page sees a match end in What happened here", () => {
  const { code } = hub.createRoom("fake");
  const a = hub.join(code, "Ava", "mei"), b = hub.join(code, "Bo", "jin");
  if (!a.ok || !b.ok) throw new Error("join failed");
  let out = "";
  const res = { destroyed: false, writeHead() { return this; }, write(s: string) { out += s; return true; }, end() {}, on() { return this; } };
  hub.open(code, res as never, b.seat);
  hub.start(code, a.seat, { bots: false });
  clock = hub.view(code, a.seat)!.startedAt! + 10;
  for (let i = 0; i < 400; i++) { clock += 25; hub.tick(); }
  const rooms = out.split("\n\n").filter((e) => e.startsWith("event: room")).map((e) => JSON.parse(e.split("data: ")[1]));
  const last = rooms[rooms.length - 1];
  expect(last.state).toBe("end");
  expect(last.history.length).toBe(1);
  expect(last.history[0].lakeBefore).toBe(A0 + Y0);
});
