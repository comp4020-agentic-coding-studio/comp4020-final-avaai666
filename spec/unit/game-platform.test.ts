import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGameHub, type GameHub } from "../../src/lib/game-hub.ts";
import { eventsFor, lakeAtStart, lakeBetween, type Mode, replay, type Seat, streamOf } from "../../src/lib/game-platform.ts";
import { type GameStore, openGameStore } from "../../src/lib/game-store.ts";

// The /play platform (DESIGN.md "One lake, four games"), with a fake mode
// that has a secret per seat. No server: a real store in a temporary file,
// a fake clock, and fake streams that record what each seat was sent.

interface Fake { tick: number; secrets: string[]; points: number[]; lake: number; firstAt: (number | null)[] }
type FakeInput = { k: "dig" } | { k: "peek"; at: number };
const fake: Mode<Fake, FakeInput> = {
  id: "fake", model: "fake 1.0", seats: { min: 2, max: 3, botFill: 3 },
  make(seed, seats, lake) {
    const r = streamOf(seed, "lake");
    return { tick: 0, secrets: seats.map(() => `secret-${Math.floor(r() * 1e9)}`), points: seats.map(() => 0), lake: lake.fish, firstAt: seats.map(() => null) };
  },
  input(_s, _seat, raw) {
    const o = raw as { k?: unknown; at?: unknown };
    if (o?.k === "dig") return { k: "dig" };
    if (o?.k === "peek" && Number.isInteger(o.at)) return { k: "peek", at: o.at as number };
    return null;
  },
  step(s, inputs) {
    const ev = [];
    for (const { seat, i } of inputs) {
      if (i.k === "dig" && s.lake > 0) { s.points[seat]++; s.lake--; s.firstAt[seat] ??= s.tick * 0.05; ev.push({ k: "dug", seat }); }
      if (i.k === "peek") ev.push({ k: "peeked", seat, to: [seat] }); // only the peeker hears it
    }
    s.tick++;
    return ev;
  },
  frameFor: (s, seat) => ({ points: s.points, lake: s.lake, mine: seat >= 0 ? s.secrets[seat] : null }),
  over: (s) => s.tick >= 40,
  results: (s) => ({
    seats: s.points.map((p, seat) => ({ seat, score: p, place: 1 + s.points.filter((q) => q > p).length, firstScoreS: s.firstAt[seat] })),
    lakeLeft: s.lake, highlights: [{ title: "Most dug", text: "someone dug" }],
  }),
  bot: (_s, _seat, rng) => (rng() < 0.5 ? [{ k: "dig" }] : []),
};

class FakeRes {
  out = "";
  destroyed = false;
  handlers: Record<string, () => void> = {};
  writeHead() { return this; }
  write(s: string) { this.out += s; return true; }
  end() { this.destroyed = true; }
  on(e: string, f: () => void) { this.handlers[e] = f; return this; }
}

let dir: string;
let store: GameStore;
let clock = 0;
const now = (): number => clock;
let hub: GameHub;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "game-platform-"));
  store = openGameStore(join(dir, "pond.db"), now);
  clock = 5_000_000;
  hub = createGameHub(store, { fake }, now, (e) => { throw e; }, ["fake"]);
});
afterEach(() => {
  hub.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const runToEnd = (): void => { for (let i = 0; i < 400; i++) { clock += 25; hub.tick(); } };

describe("frames and events are built per seat", () => {
  it("frameFor never sends one seat another seat's secret, and a private event reaches only its seat", () => {
    const { code } = hub.createRoom("fake");
    const a = hub.join(code, "Ava", "mei"), b = hub.join(code, "Bo", "jin");
    if (!a.ok || !b.ok) throw new Error("join failed");
    const ra = new FakeRes(), rb = new FakeRes();
    hub.open(code, ra as never, a.seat);
    hub.open(code, rb as never, b.seat);
    expect(hub.start(code, a.seat, { bots: false })).toEqual({ ok: true });
    clock = hub.view(code, a.seat)!.startedAt! + 10;
    hub.input(code, a.seat, { k: "peek", at: 1 });
    runToEnd();
    const room = store.roomByCode(code)!;
    const m = store.lastMatch(room.id)!;
    const sim = replay(fake, m.seed, m.seats, { fish: m.lakeBefore }, store.inputsOf(m.id));
    const [sa, sb] = sim.secrets;
    expect(ra.out).toContain(sa);
    expect(ra.out).not.toContain(sb);
    expect(rb.out).toContain(sb);
    expect(rb.out).not.toContain(sa);
    expect(ra.out).toContain('"peeked"');
    expect(rb.out).not.toContain('"peeked"');
    expect(ra.out + rb.out).not.toContain(m.seed); // the match's secret
  });

  it("eventsFor keeps public events and strips the audience", () => {
    const ev = [{ k: "a" }, { k: "b", to: [1] }, { k: "c", to: [0, 2] }];
    expect(eventsFor(ev, 0)).toEqual([{ k: "a" }, { k: "c" }]);
    expect(eventsFor(ev, -1)).toEqual([{ k: "a" }]);
  });
});

describe("a match is its seed and its inputs", () => {
  it("replaying the stored inputs, bots included, gives the stored results", () => {
    const { code } = hub.createRoom("fake");
    const a = hub.join(code, "Ava", "mei");
    if (!a.ok) throw new Error("join failed");
    hub.start(code, a.seat, { bots: true });
    clock = hub.view(code, a.seat)!.startedAt! + 10;
    for (let i = 0; i < 400; i++) { clock += 25; if (i % 7 === 0) hub.input(code, a.seat, { k: "dig" }); hub.tick(); }
    const m = store.lastMatch(store.roomByCode(code)!.id)!;
    expect(m.status).toBe("done");
    expect(m.seats.filter((s) => s.bot).length).toBe(2);
    const sim = replay(fake, m.seed, m.seats, { fish: m.lakeBefore }, store.inputsOf(m.id));
    const scores = fake.results(sim).seats.map((s) => s.score);
    expect(m.summary!.seats.map((s) => s.score)).toEqual(scores);
    expect(scores[1] + scores[2]).toBeGreaterThan(0); // the bots did play
    expect(m.seed).toMatch(/^[0-9a-f]{64}$/); // 256 bits
  });

  it("an input the mode does not accept is dropped and never stored", () => {
    const { code } = hub.createRoom("fake");
    const a = hub.join(code, "Ava", "mei"), b = hub.join(code, "Bo", "jin");
    if (!a.ok || !b.ok) throw new Error("join failed");
    hub.start(code, a.seat, { bots: false });
    clock = hub.view(code, a.seat)!.startedAt! + 10;
    expect(hub.input(code, a.seat, { k: "teleport" })).toEqual({ ok: false, reason: "bad_input" });
    runToEnd();
    const m = store.lastMatch(store.roomByCode(code)!.id)!;
    expect([...store.inputsOf(m.id).values()].flat()).toEqual([]);
  });
});

describe("the lake remembers", () => {
  it("a new room's lake holds 220; between matches it regrows 15% of the gap", () => {
    expect(lakeAtStart(220)).toEqual({ fish: 220, fresh: false });
    expect(lakeBetween(120)).toBe(135);
    expect(lakeBetween(219)).toBe(219);
    expect(lakeBetween(220)).toBe(220);
  });

  it("below 40 the lake has died: it does not regrow, and the next match starts a new lake", () => {
    expect(lakeBetween(39)).toBe(39);
    expect(lakeAtStart(39)).toEqual({ fish: 220, fresh: true });
    expect(lakeAtStart(40)).toEqual({ fish: 40, fresh: false });
  });

  it("a match starts from the room's lake and writes back what it left, regrown", () => {
    const { code } = hub.createRoom("fake");
    const a = hub.join(code, "Ava", "mei"), b = hub.join(code, "Bo", "jin");
    if (!a.ok || !b.ok) throw new Error("join failed");
    expect(hub.view(code, null)!.lake).toEqual({ fish: 220, died: false });
    hub.start(code, a.seat, { bots: false });
    clock = hub.view(code, a.seat)!.startedAt! + 10;
    for (let i = 0; i < 400; i++) { clock += 25; hub.input(code, a.seat, { k: "dig" }); hub.input(code, b.seat, { k: "dig" }); hub.tick(); }
    const m1 = store.lastMatch(store.roomByCode(code)!.id)!;
    expect(m1.lakeBefore).toBe(220);
    const left = m1.summary!.lakeAfter;
    expect(left).toBeLessThan(220);
    expect(hub.view(code, null)!.lake.fish).toBe(lakeBetween(left));
    expect(hub.start(code, b.seat, { bots: false })).toEqual({ ok: true }); // a rematch
    expect(store.lastMatch(store.roomByCode(code)!.id)!.lakeBefore).toBe(lakeBetween(left));
  });
});

describe("rooms, seats and names", () => {
  it("a person beyond the mode's seats.max is refused, and so is a bot's name", () => {
    const { code } = hub.createRoom("fake");
    expect(hub.join(code, "A", "mei").ok).toBe(true);
    expect(hub.join(code, "Lu (bot)", "lu")).toEqual({ ok: false, reason: "bot_name" });
    expect(hub.join(code, "B", "jin").ok).toBe(true);
    expect(hub.join(code, "C", "lu").ok).toBe(true);
    expect(hub.join(code, "D", "lian")).toEqual({ ok: false, reason: "full" });
  });

  it("bots are named as bots", () => {
    const { code } = hub.createRoom("fake");
    const a = hub.join(code, "Ava", "mei");
    if (!a.ok) throw new Error("join failed");
    hub.start(code, a.seat, { bots: true });
    const seats = hub.view(code, a.seat)!.seats!;
    for (const s of seats.filter((x: Seat) => x.bot)) expect(s.name).toMatch(/\(bot\)$/);
    expect(seats.filter((x: Seat) => !x.bot).map((s: Seat) => s.name)).toEqual(["Ava"]);
  });

  it("a mode that is not ready cannot start, and a room can switch mode between matches", () => {
    const h2 = createGameHub(store, { fake }, now, (e) => { throw e; }, []);
    const { code } = h2.createRoom("fake");
    const a = h2.join(code, "Ava", "mei");
    if (!a.ok) throw new Error("join failed");
    expect(h2.start(code, a.seat, { bots: true })).toEqual({ ok: false, reason: "coming_soon" });
    expect(hub.setMode(code, a.seat, "nope")).toEqual({ ok: false, reason: "bad_mode" });
    h2.close();
  });

  it("the summary counts inputs per seat and records who asked for the rematch", () => {
    const { code } = hub.createRoom("fake");
    const a = hub.join(code, "Ava", "mei"), b = hub.join(code, "Bo", "jin");
    if (!a.ok || !b.ok) throw new Error("join failed");
    hub.start(code, a.seat, { bots: false });
    clock = hub.view(code, a.seat)!.startedAt! + 10;
    hub.input(code, a.seat, { k: "dig" });
    runToEnd();
    hub.start(code, b.seat, { bots: false });
    clock = hub.view(code, a.seat)!.startedAt! + 10;
    runToEnd();
    const [m1, m2] = store.matches(store.roomByCode(code)!.id);
    expect(m1.summary!.seats[0].inputs).toEqual({ dig: 1 });
    expect(m1.summary!.seats[0].firstScoreS).not.toBeNull();
    expect(m1.summary!.rematchBy).toBeNull();
    expect(m2.summary!.rematchBy).toBe("Bo");
    expect(m1.summary!.durationS).toBeGreaterThan(0);
  });
});

describe("stop match", () => {
  it("the room's first player can stop a match: it is marked interrupted, with no results, and the room returns to its lobby", () => {
    const { code } = hub.createRoom("fake");
    const a = hub.join(code, "Ava", "mei"), b = hub.join(code, "Bo", "jin");
    if (!a.ok || !b.ok) throw new Error("join failed");
    hub.start(code, a.seat, { bots: false });
    clock = hub.view(code, a.seat)!.startedAt! + 10;
    for (let i = 0; i < 10; i++) { clock += 25; hub.tick(); }
    expect(hub.stop(code, b.seat)).toEqual({ ok: false, reason: "not_first" });
    expect(hub.stop(code, a.seat)).toEqual({ ok: true });
    const m = store.lastMatch(store.roomByCode(code)!.id)!;
    expect(m.status).toBe("interrupted");
    expect(m.summary).toBeNull();
    expect(hub.view(code, a.seat)!.state).toBe("lobby");
    expect(store.roomByCode(code)!.lakeFish).toBe(220); // a stopped match writes no lake back
    expect(hub.stop(code, a.seat)).toEqual({ ok: false, reason: "not_playing" });
  });
});
