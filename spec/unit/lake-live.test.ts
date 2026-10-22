import { describe, expect, it } from "vitest";
import { createLakeHub } from "../../src/lib/lake-live.ts";
import type { Runner } from "../../src/lib/lake-runner.ts";

// The lake hub's live-lake cap (DESIGN.md v2.2, "Real time"): crash fix in
// frozen code (CLAUDE.md "Rules for /play", "Frozen"). A 13th live lake used
// to answer an unhandled 500 (docs/checks/flaky-lake-app.md, "A known edge").

// a fake Runner: register() only reads lakeId, so nothing else needs to work
function fakeRunner(lakeId: number): Runner {
  return {
    lakeId,
    code: `L${lakeId}`,
  } as Runner;
}

describe("the live-lake cap", () => {
  it("registers up to MAX_LIVE_LAKES (12) lakes without throwing", () => {
    const hub = createLakeHub(() => {});
    for (let i = 1; i <= 12; i++) expect(() => hub.register(fakeRunner(i))).not.toThrow();
    expect(hub.isLive(12)).toBe(true);
  });

  it("a 13th live lake is refused with a LakeFull error, not an unhandled throw", () => {
    const hub = createLakeHub(() => {});
    for (let i = 1; i <= 12; i++) hub.register(fakeRunner(i));
    let caught: unknown;
    try {
      hub.register(fakeRunner(13));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as { lakeFull?: boolean }).lakeFull).toBe(true);
    expect(hub.isLive(13)).toBe(false);
  });

  it("re-registering an already-live lake (a rebuild) never counts against the cap", () => {
    const hub = createLakeHub(() => {});
    for (let i = 1; i <= 12; i++) hub.register(fakeRunner(i));
    expect(() => hub.register(fakeRunner(1))).not.toThrow();
  });
});
