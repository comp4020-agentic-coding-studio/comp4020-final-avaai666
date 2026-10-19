import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BOT_VOTE_AT_S, FISH_S, MEET_S, STEP_MS } from "../../src/lib/game-constants.ts";
import { phase } from "../../src/lib/lake-sim.ts";
import { openLakeStore, type LakeStore } from "../../src/lib/lake-store.ts";
import { debugPokeFamily, debugSetRule, debugYears, rebuild, type Runner } from "../../src/lib/lake-runner.ts";

// The lake runner (DESIGN.md v2.2, "Real time" and "The record, and
// replay"). A fake clock, a fresh database file per test.

let dir: string;
let file: string;
let store: LakeStore;
let t: number;
const now = (): number => t;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lake-runner-"));
  file = join(dir, "pond.db");
  t = 1_700_000_000_000;
  store = openLakeStore(file, now);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const atStep = (startedAt: number, step: number): number => startedAt + step * STEP_MS;
const key = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function setup(humanNames: string[], bots: number) {
  const { lakeId, code } = store.openLake();
  for (const name of humanNames) {
    const r = store.join(code, name);
    if (!r.ok) throw new Error(`join failed: ${r.reason}`);
  }
  const startedAt = t;
  store.start(lakeId, startedAt, bots);
  const lake = store.lakeByCode(code)!;
  const families = store.familiesOf(lakeId);
  const rows = store.allRows(lakeId);
  const runner = rebuild({ store, lakeId, code, secret: lake.secret, startedAt, families, rows }, startedAt);
  const familyIdOf = (seat: number): number => families.find((f) => f.seat === seat)!.familyId;
  return { runner, lakeId, code, startedAt, secret: lake.secret, families, familyIdOf };
}

function rebuildFrom(ctx: ReturnType<typeof setup>, at: number): Runner {
  const families = store.familiesOf(ctx.lakeId);
  const rows = store.allRows(ctx.lakeId);
  return rebuild({ store, lakeId: ctx.lakeId, code: ctx.code, secret: ctx.secret, startedAt: ctx.startedAt, families, rows }, at);
}

describe("two nets on the same fish", () => {
  it("the one thrown first takes it; the other is told who got there first", () => {
    const { runner, lakeId, startedAt, familyIdOf } = setup(["Ava", "Bo"], 0);
    const adults = runner.frame().f.filter((f) => f[4] === 1);
    let best = adults[0],
      bestN = -1;
    for (const f of adults) {
      const n = adults.filter((o) => Math.hypot(o[1] - f[1], o[2] - f[2]) < 36).length;
      if (n > bestN) {
        bestN = n;
        best = f;
      }
    }
    const [, x, y] = best;
    expect(runner.throwNet(0, { x, y, net: "coarse", key: key(1) })).toEqual({ ok: true });
    expect(runner.throwNet(1, { x, y, net: "coarse", key: key(2) })).toEqual({ ok: true });
    runner.advance(atStep(startedAt, 10));

    const hauls = store.allRows(lakeId).filter((r) => r.kind === "haul");
    expect(hauls).toHaveLength(2);
    expect(hauls[0].familyId).toBe(familyIdOf(0));
    expect(hauls[1].familyId).toBe(familyIdOf(1));
    expect((hauls[0].data as { got: number }).got).toBeGreaterThan(0);
    expect(hauls[1].data).toMatchObject({ got: 0, rival: 0 });
  });
});

describe("throwNet refusals", () => {
  it("too_soon, outside, no_fine_net, not_fishing, over", () => {
    const { runner, startedAt } = setup(["Ava", "Bo"], 0);
    expect(runner.throwNet(0, { x: 500, y: 350, net: "fine", key: key(1) })).toEqual({ ok: false, reason: "no_fine_net" });
    expect(runner.throwNet(0, { x: 500, y: 350, net: "coarse", key: key(2) })).toEqual({ ok: true });
    expect(runner.throwNet(0, { x: 500, y: 350, net: "coarse", key: key(3) })).toEqual({ ok: false, reason: "too_soon" });
    expect(runner.throwNet(1, { x: -100, y: -100, net: "coarse", key: key(4) })).toEqual({ ok: false, reason: "outside" });

    runner.advance(atStep(startedAt, FISH_S * 10 + 1)); // into year 1's meeting
    expect(runner.throwNet(1, { x: 500, y: 350, net: "coarse", key: key(5) })).toEqual({ ok: false, reason: "not_fishing" });

    runner.advance(atStep(startedAt, 2700));
    expect(runner.isOver()).toBe(true);
    expect(runner.throwNet(1, { x: 500, y: 350, net: "coarse", key: key(6) })).toEqual({ ok: false, reason: "over" });
  });
});

describe("breaches", () => {
  it("under a ban, a fine net's throw row is marked breach true", () => {
    const { runner, lakeId, familyIdOf } = setup(["Ava"], 0);
    debugSetRule(runner, "ban");
    debugPokeFamily(runner, 0, { hasFine: true });
    expect(runner.throwNet(0, { x: 500, y: 350, net: "fine", key: key(1) })).toEqual({ ok: true });
    const row = store.allRows(lakeId).find((r) => r.kind === "throw" && r.familyId === familyIdOf(0))!;
    expect(row.data).toMatchObject({ fine: true, breach: true });
  });

  it("under the shallows rule, a net exactly on the line is a breach", () => {
    const { runner, lakeId, familyIdOf } = setup(["Ava"], 0);
    debugSetRule(runner, "nursery");
    // W/2 + SHALLOW*RX, H/2: exactly on the line (see rules.test.ts's breachOf test)
    const onLine = 1000 / 2 + 0.72 * 460;
    expect(runner.throwNet(0, { x: onLine, y: 350, net: "coarse", key: key(1) })).toEqual({ ok: true });
    const row = store.allRows(lakeId).find((r) => r.kind === "throw" && r.familyId === familyIdOf(0))!;
    expect(row.data).toMatchObject({ breach: true });
  });

  it("a fine net thrown while promised writes a broken row", () => {
    const { runner, lakeId, familyIdOf } = setup(["Ava", "Bo"], 0);
    expect(runner.ask(0, 1)).toEqual({ ok: true });
    expect(runner.answer(1, 0, true)).toEqual({ ok: true });
    debugPokeFamily(runner, 0, { hasFine: true });
    expect(runner.throwNet(0, { x: 500, y: 350, net: "fine", key: key(1) })).toEqual({ ok: true });
    const broken = store.allRows(lakeId).find((r) => r.kind === "broken")!;
    expect(broken.familyId).toBe(familyIdOf(0));
    expect(broken.data).toEqual({ to: 1 });
  });
});

describe("winter and the meeting", () => {
  it("winter writes a build row per family; a silent family counts as no rule; the rule row carries the votes", () => {
    const { runner, lakeId, startedAt, familyIdOf } = setup(["Ava", "Bo"], 0);
    debugPokeFamily(runner, 0, { basket: 30 });
    runner.advance(atStep(startedAt, FISH_S * 10 + 1)); // just into the meeting: winter has happened
    const builds = store.allRows(lakeId).filter((r) => r.kind === "build");
    expect(builds).toHaveLength(2);
    const avaBuild = builds.find((r) => r.familyId === familyIdOf(0))!;
    expect(avaBuild.data).toMatchObject({ parts: ["tiled roof"], left: 5 });

    expect(runner.vote(0, "ban")).toEqual({ ok: true });
    // Bo stays silent
    runner.advance(atStep(startedAt, (FISH_S + MEET_S) * 10 + 1)); // past the meeting, into year 2
    const rule = store.allRows(lakeId).find((r) => r.kind === "rule")!;
    expect(rule.data).toMatchObject({ year: 1, rule: "none" }); // 1 of 2 is a tie with the silent half
    expect((rule.data as { votes: Record<number, string> }).votes[0]).toBe("ban");
  });
});

describe("Jin and anger", () => {
  it('keeps a rule only after two different families stamp "stop that" (怒) in the same year', () => {
    const ctx = setup(["Ava", "Bo", "Cy"], 1); // seat 3: Jin (greedy)
    const { runner, lakeId, startedAt, familyIdOf } = ctx;
    debugSetRule(runner, "ban");
    debugPokeFamily(runner, 3, { hasFine: true });

    const throwUntil = (deadlineStep: number): { fine: boolean } => {
      for (let s = runner.frame().s; s < deadlineStep; s += 35) {
        debugPokeFamily(runner, 3, { nextThrowStep: s });
        const before = store.allRows(lakeId).filter((r) => r.kind === "throw" && r.familyId === familyIdOf(3)).length;
        runner.advance(atStep(startedAt, s + 1));
        const rows = store.allRows(lakeId).filter((r) => r.kind === "throw" && r.familyId === familyIdOf(3));
        if (rows.length > before) return rows.at(-1)!.data as { fine: boolean };
      }
      throw new Error("Jin never threw");
    };

    expect(throwUntil(400).fine).toBe(true); // breaks the ban until stamped

    runner.seal(0, 3, "怒");
    runner.seal(1, 3, "怒");

    expect(throwUntil(800).fine).toBe(false); // now keeps it
  });
});

describe("a whole season with bots", () => {
  it(
    "runs to its end row; rebuilding the ledger reproduces the same end state",
    { timeout: 60_000 },
    () => {
      const ctx = setup(["Ava"], 3); // Jin, Mei, Old Wang fill to four
      const { runner, lakeId, startedAt } = ctx;
      const farEnough = atStep(startedAt, 2700);
      runner.advance(farEnough);
      expect(runner.isOver()).toBe(true);
      expect(store.allRows(lakeId).filter((r) => r.kind === "end")).toHaveLength(1);
      const before = runner.snapshot();

      const rebuilt = rebuildFrom(ctx, farEnough);
      const after = rebuilt.snapshot();
      expect(after.families.map((f) => ({ seat: f.seat, basket: f.basket, part: f.part }))).toEqual(
        before.families.map((f) => ({ seat: f.seat, basket: f.basket, part: f.part })),
      );
      expect(store.allRows(lakeId).filter((r) => r.kind === "haul").length).toBeGreaterThan(0);
    },
  );
});

describe("the end row's years", () => {
  it("holds grown fish at the start of year 1 then each year reached, and a rebuild reproduces it", { timeout: 60_000 }, () => {
    const ctx = setup(["Ava"], 3);
    const { runner, lakeId, startedAt } = ctx;
    const farEnough = atStep(startedAt, 2700);
    runner.advance(farEnough);
    expect(runner.isOver()).toBe(true);
    const endRow = store.allRows(lakeId).find((r) => r.kind === "end")!;
    const years = (endRow.data as { years: number[] }).years;
    expect(years.length).toBe(5); // years 1 to 5 reached
    expect(years[0]).toBeGreaterThan(0);

    const rebuilt = rebuildFrom(ctx, farEnough);
    expect(debugYears(rebuilt)).toEqual(years);
  });
});

describe("every family's vote counts", () => {
  it("a bot's vote is tallied: with the person, Old Wang and Mei voting ban and Jin none, the rule is ban", () => {
    const ctx = setup(["Ava"], 3); // seat0 Ava; seat1 Jin (greedy); seat2 Mei (follower); seat3 Old Wang (careful)
    const { runner, lakeId, startedAt } = ctx;
    debugPokeFamily(runner, 3, { hasFine: true }); // anyFine true: Old Wang (careful) votes "ban"
    runner.advance(atStep(startedAt, FISH_S * 10 + 11)); // 1s into year 1's meeting
    expect(runner.vote(0, "ban")).toEqual({ ok: true });
    runner.advance(atStep(startedAt, (FISH_S + MEET_S) * 10 + 1)); // past the meeting
    const rule = store.allRows(lakeId).find((r) => r.kind === "rule")!;
    expect(rule.data).toMatchObject({ year: 1, rule: "ban" });
  });
});

describe("bots vote on time in the meeting", () => {
  it("Old Wang votes 3s in, Jin 6s in, Mei 10s in and follows a vote already cast", () => {
    const ctx = setup(["Ava"], 3); // seat0 Ava; seat1 Jin (greedy); seat2 Mei (follower); seat3 Old Wang (careful)
    const { runner, lakeId, startedAt, familyIdOf } = ctx;
    runner.advance(atStep(startedAt, FISH_S * 10 + 11)); // 1s into year 1's meeting
    expect(runner.vote(0, "ban")).toEqual({ ok: true });
    runner.advance(atStep(startedAt, (FISH_S + MEET_S) * 10 + 1)); // past the meeting

    const votes = store.allRows(lakeId).filter((r) => r.kind === "vote" && r.familyId !== familyIdOf(0));
    const by = (seat: number) => votes.find((r) => r.familyId === familyIdOf(seat))!;
    const jin = by(1),
      mei = by(2),
      wang = by(3);
    expect(wang.step).toBe(FISH_S * 10 + BOT_VOTE_AT_S.careful * 10);
    expect(jin.step).toBe(FISH_S * 10 + BOT_VOTE_AT_S.greedy * 10);
    expect(mei.step).toBe(FISH_S * 10 + BOT_VOTE_AT_S.follower * 10);
    expect((mei.data as { rule: string }).rule).toBe("ban");
  });
});

describe("bots after a winter", () => {
  it("every living bot throws again in year 2 and every later year the lake is alive", { timeout: 60_000 }, () => {
    const ctx = setup([], 3); // Jin, Mei, Old Wang; one more bot fills the fourth seat
    const { runner, lakeId, startedAt, families } = ctx;
    runner.advance(atStep(startedAt, 2700)); // the whole season
    const rows = store.allRows(lakeId);
    const botIds = new Set(families.filter((f) => f.bot !== null).map((f) => f.familyId));
    const throwYears = new Set(
      rows
        .filter((r) => r.kind === "throw" && r.familyId !== null && botIds.has(r.familyId) && r.step !== null)
        .map((r) => phase(r.step! * 0.1, 5).year),
    );
    expect(throwYears.has(2)).toBe(true);
  });
});

describe("a restart", () => {
  it("in year 2: rebuilds and catches up with nobody throwing, then advancing further lets bots resume only from the step it came back at", { timeout: 60_000 }, () => {
    const ctx = setup(["Ava"], 3);
    const { lakeId, startedAt, families } = ctx;
    ctx.runner.advance(atStep(startedAt, 600)); // partway into year 2's fishing
    const rowsSoFar = store.allRows(lakeId);
    const lastStep = Math.max(...rowsSoFar.map((r) => r.step ?? -1));
    const restartStep = 650;
    const botIds = new Set(families.filter((f) => f.bot !== null).map((f) => f.familyId));

    const restarted = rebuild(
      { store, lakeId, code: ctx.code, secret: ctx.secret, startedAt, families, rows: rowsSoFar },
      atStep(startedAt, restartStep),
    );

    const gapRows = store.allRows(lakeId).filter((r) => r.step !== null && r.step > lastStep && r.step < restartStep);
    expect(gapRows.filter((r) => r.familyId !== null && botIds.has(r.familyId))).toHaveLength(0);

    restarted.advance(atStep(startedAt, 2700));
    expect(restarted.isOver()).toBe(true);
    const afterRestart = store.allRows(lakeId).filter((r) => r.step !== null && r.step >= restartStep && r.familyId !== null && botIds.has(r.familyId));
    expect(afterRestart.length).toBeGreaterThan(0);
    const bootThrows = store
      .allRows(lakeId)
      .filter((r) => r.kind === "throw" && r.step !== null && r.step >= restartStep && r.familyId !== null && botIds.has(r.familyId));
    expect(bootThrows.length).toBeGreaterThan(0);
  });
});

describe("the secret", () => {
  it("is in no row, frame or snapshot before the end row", { timeout: 60_000 }, () => {
    const ctx = setup(["Ava"], 3);
    const { runner, lakeId, startedAt, secret } = ctx;
    runner.advance(atStep(startedAt, 300));
    expect(JSON.stringify(runner.snapshot())).not.toContain(secret);
    expect(JSON.stringify(runner.frame())).not.toContain(secret);
    for (const r of store.allRows(lakeId)) expect(JSON.stringify(r.data)).not.toContain(secret);

    runner.advance(atStep(startedAt, 2700));
    expect(runner.isOver()).toBe(true);
    const endRow = store.allRows(lakeId).find((r) => r.kind === "end")!;
    expect((endRow.data as { secret: string }).secret).toBe(secret);
    expect(JSON.stringify(runner.snapshot())).toContain(secret);
  });
});

describe("a frame is due whenever a tick ran an even step, however late the tick was", () => {
  it("a late tick that ran steps 6 and 7 still sends the frame of step 6", () => {
    // The timer ticks every 100 ms, but a busy event loop delivers ticks
    // late, so one advance() can run several steps. A frame is a snapshot of
    // the lake, due every second step (0.2 s). It must go out for any tick
    // that ran an even step, not only when the tick's LAST step was even.
    const run = (marks: number[]): boolean[] => {
      const { runner, startedAt } = setup(["Ava"], 0);
      return marks.map((m) => runner.advance(atStep(startedAt, m)));
    };
    // on time: steps 0 | 1,2 | 3 | 4,5... frames at the ticks that ran 0, 2, 4
    expect(run([1, 2, 3, 4, 5])).toEqual([true, false, true, false, true]);
    // late: the tick that ran steps 6 and 7 ends on an odd step
    expect(run([6, 8])).toEqual([true, true]);
    // late: 1,2 then 3 then 4,5,6 then 7
    expect(run([1, 3, 4, 7, 8])).toEqual([true, true, false, true, false]);
    // a tick that ran only an odd step has nothing to send (steps 0,1,2 | 3)
    expect(run([3, 4])).toEqual([true, false]);
  });
});
