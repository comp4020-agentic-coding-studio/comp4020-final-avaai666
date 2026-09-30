import { describe, expect, it } from "vitest";
import { A, K, MAX_TAPS_PER_MIN, R_PER_MIN } from "../../src/lib/constants.ts";
import { available, isDead, peakGrowthPerMin, stockAt } from "../../src/lib/pond.ts";

// The pond model (DESIGN.md v0.2). Pure functions: these tests need no server.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Steps the model one second at a time with stockAt, then each net catches one
// fish while one is available, as in sim/pond_sim.py with every net at max.
// Returns the second the pond died (or null) and the lowest stock seen.
function fish(nets: number, s0: number, maxSeconds: number): { diedAt: number | null; min: number } {
  let s = s0;
  let min = s0;
  for (let sec = 0; sec < maxSeconds; sec++) {
    s = stockAt(s, SECOND);
    for (let n = 0; n < nets; n++) {
      if (available(s) >= 1) s -= 1;
    }
    min = Math.min(min, s);
    if (isDead(s)) return { diedAt: sec + 1, min };
  }
  return { diedAt: null, min };
}

// An independent reference: the growth equation written out here, integrated
// with RK4 at a 10 ms step.
function reference(s0: number, elapsedMs: number): number {
  const f = (s: number): number => R_PER_MIN * s * (s / A - 1) * (1 - s / K);
  const dt = 10 / MINUTE; // minutes
  let s = s0;
  for (let i = 0; i < elapsedMs / 10; i++) {
    const k1 = f(s);
    const k2 = f(s + (dt * k1) / 2);
    const k3 = f(s + (dt * k2) / 2);
    const k4 = f(s + dt * k3);
    s += (dt * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
  }
  return s;
}

describe("stockAt", () => {
  it.each([0, 1, 30, 150, 300])("returns s unchanged after no time (s = %d)", (s) => {
    expect(stockAt(s, 0)).toBe(s);
  });

  describe("is within 0.1% of a 10 ms reference RK4", () => {
    for (const s0 of [45, 150, 290]) {
      for (const t of [10 * SECOND, MINUTE, 10 * MINUTE]) {
        it(`s0 = ${s0}, t = ${t / SECOND} s`, () => {
          const want = reference(s0, t);
          expect(Math.abs(stockAt(s0, t) - want)).toBeLessThanOrEqual(0.001 * want);
        });
      }
    }
  });
});

it("parameter check: one net at max < peak regrowth < two nets at max", () => {
  const g = peakGrowthPerMin();
  expect(g).toBeGreaterThan(MAX_TAPS_PER_MIN);
  expect(g).toBeLessThan(2 * MAX_TAPS_PER_MIN);
});

describe("scenarios", () => {
  it("from a full pond, one net at full speed for 30 minutes never brings stock below A", () => {
    const { diedAt, min } = fish(1, K, 30 * 60);
    expect(diedAt).toBeNull();
    expect(min).toBeGreaterThanOrEqual(A);
  });

  // tuning: update if the parameters change
  it("from a full pond, two nets at full speed kill it between 3 and 8 minutes", () => {
    const { diedAt } = fish(2, K, 30 * 60);
    expect(diedAt).not.toBeNull();
    expect(diedAt!).toBeGreaterThanOrEqual(3 * 60);
    expect(diedAt!).toBeLessThanOrEqual(8 * 60);
  });

  // the known limit, kept on purpose: one person can finish off a weakened pond
  it("from a quarter-full pond, one net at full speed kills it within 5 minutes", () => {
    const { diedAt } = fish(1, K / 4, 30 * 60);
    expect(diedAt).not.toBeNull();
    expect(diedAt!).toBeLessThanOrEqual(5 * 60);
  });
});

describe("the Allee threshold", () => {
  it("below A the pond dies unaided", () => {
    expect(isDead(stockAt(0.95 * A, 60 * MINUTE))).toBe(true);
  });

  it("above A the pond recovers", () => {
    expect(stockAt(1.05 * A, DAY)).toBeGreaterThan(0.99 * K);
  });
});

describe("dead stays dead", () => {
  it("0.4 fish never grow back", () => {
    expect(stockAt(0.4, 7 * DAY)).toBeLessThan(1);
  });

  it.each([SECOND, HOUR, 7 * DAY])("an empty pond stays at 0 (t = %d ms)", (t) => {
    expect(stockAt(0, t)).toBe(0);
  });
});

it("stays within [0, K] for s0 across [0, K] and t up to 7 days", () => {
  for (let s0 = 0; s0 <= K; s0 += 10) {
    for (const t of [1500, MINUTE, HOUR, DAY, 7 * DAY]) {
      const s = stockAt(s0, t);
      expect(s, `s0 = ${s0}, t = ${t} ms`).toBeGreaterThanOrEqual(0);
      expect(s, `s0 = ${s0}, t = ${t} ms`).toBeLessThanOrEqual(K);
    }
  }
});

it("available is the floor of stock, never below 0", () => {
  expect(available(12.9)).toBe(12);
  expect(available(0.4)).toBe(0);
  expect(available(-1)).toBe(0);
});

it("evaluates a 7-day gap in under 200 ms", () => {
  const start = performance.now();
  stockAt(150, 7 * DAY);
  expect(performance.now() - start).toBeLessThan(200);
});
