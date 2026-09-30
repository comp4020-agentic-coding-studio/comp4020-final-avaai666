// The pond model (DESIGN.md v0.2): logistic growth with a strong Allee
// threshold A. The only place stock is evaluated.
import { A, K, R_PER_MIN, STEP_MS } from "./constants.ts";

const MS_PER_MIN = 60_000;

const clamp = (s: number): number => Math.min(K, Math.max(0, s));

// dS/dt = r·S·(S/A − 1)·(1 − S/K), in fish per minute
export function growthPerMin(s: number): number {
  return R_PER_MIN * s * (s / A - 1) * (1 - s / K);
}

// The maximum of growthPerMin on [A, K], where its derivative is zero:
// −3S² + 2(A + K)S − AK = 0, larger root.
export function peakGrowthPerMin(): number {
  const s = (A + K + Math.sqrt((A + K) ** 2 - 3 * A * K)) / 3;
  return growthPerMin(s);
}

function rk4(s: number, dtMin: number): number {
  const k1 = growthPerMin(s);
  const k2 = growthPerMin(s + (dtMin * k1) / 2);
  const k3 = growthPerMin(s + (dtMin * k2) / 2);
  const k4 = growthPerMin(s + dtMin * k3);
  return s + (dtMin * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
}

// Stock after elapsedMs, from stock s0: fixed-step RK4 with STEP_MS, the last
// partial step using the remainder. Clamped to [0, K] at every step, so an
// empty pond stays empty.
export function stockAt(s0: number, elapsedMs: number): number {
  if (!(s0 > 0)) return 0;
  let s = clamp(s0);
  for (let left = elapsedMs; left > 0; left -= STEP_MS) {
    s = clamp(rk4(s, Math.min(STEP_MS, left) / MS_PER_MIN));
  }
  return s;
}

// Fish that can be caught: the UI shows this, never the real-valued stock.
export function available(stock: number): number {
  return Math.max(0, Math.floor(stock));
}

// Our rule, not the model's: below one fish the pond is dead.
export function isDead(stock: number): boolean {
  return stock < 1;
}
