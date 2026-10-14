import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createBoatHub } from "../../src/lib/boat-hub.ts";
import { Q, replay, resultsOf } from "../../src/lib/boat-sim.ts";
import { type BoatStore, openBoatStore } from "../../src/lib/boat-store.ts";

// The boat hub with a fake clock and a real store in a temporary file: no
// server. The stored inputs must be exactly what the simulation applied, so a
// match replayed from its record ends as it was played (DESIGN.md "Quick
// Catch", a).
let dir: string;
let store: BoatStore;
let clock = 0;
const now = (): number => clock;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "boat-hub-"));
  store = openBoatStore(join(dir, "pond.db"), now);
  clock = 1_000_000;
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

it("a steer outside the lake is stored as the point the boat was sent to, and the match replays from its record", () => {
  const hub = createBoatHub(store, now, (e) => { throw e; });
  const { code } = store.createRoom();
  const a = hub.join(code, "Ava");
  const b = hub.join(code, "Bo");
  if (!a.ok || !b.ok) throw new Error("join failed");
  expect(hub.start(code, a.seat, { bots: false })).toEqual({ ok: true });
  const view = hub.view(code, a.seat)!;
  const matchId = store.lastMatch(store.roomByCode(code)!.id)!.id;

  clock += 3000; // the countdown
  expect(hub.input(code, a.seat, { kind: "steer", x: 5000, y: -300 })).toEqual({ ok: true });
  expect(hub.input(code, b.seat, { kind: "steer", x: 12.6, y: 9999 })).toEqual({ ok: true });
  for (let ms = 0; ms <= Q.SECONDS * 1000 + 200; ms += 25) { clock += 25; hub.tick(); }

  const row = store.match(matchId)!;
  expect(row.status).toBe("done");
  const steers = [...store.inputsOf(matchId).values()].flat().filter((i) => i.kind === "steer");
  for (const s of steers) {
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(Q.W);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeLessThanOrEqual(Q.H);
    expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
  }
  expect(steers).toContainEqual({ seat: view.myBoat, kind: "steer", x: Q.W, y: 0 });
  const replayed = replay(row.seed, row.seats.map((s) => s.bot), store.inputsOf(matchId));
  expect(resultsOf(replayed)).toEqual(row.results);
  hub.close();
});
