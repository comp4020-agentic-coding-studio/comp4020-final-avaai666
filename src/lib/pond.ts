// The pond model (DESIGN.md): logistic growth with a strong Allee
// threshold A. The only place stock is evaluated.
import { A, K, R_PER_MIN, STEP_MS } from "./constants.ts";

const MS_PER_MIN = 60_000;

const clamp = (s: number): number => Math.min(K, Math.max(0, s));
const converged = (s: number): boolean => Math.abs(s - K) < 1e-9;

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
// empty pond stays empty. Stepping stops once the pond is dead (a dead pond's
// exact stock no longer matters) or has converged on K.
export function stockAt(s0: number, elapsedMs: number): number {
  if (!(s0 > 0)) return 0;
  let s = clamp(s0);
  for (let left = elapsedMs; left > 0 && !isDead(s) && !converged(s); left -= STEP_MS) {
    s = clamp(rk4(s, Math.min(STEP_MS, left) / MS_PER_MIN));
  }
  return s;
}

// ms from s0 until stock first falls below 1 with nobody fishing, to STEP_MS
// precision, on the same step grid as stockAt; null if it never does.
export function collapseAfterMs(s0: number): number | null {
  if (isDead(s0)) return 0;
  if (s0 >= A) return null;
  let s = s0;
  let ms = 0;
  while (!isDead(s)) {
    s = clamp(rk4(s, STEP_MS / MS_PER_MIN));
    ms += STEP_MS;
  }
  return ms;
}

// Fish that can be caught: the UI shows this, never the real-valued stock.
export function available(stock: number): number {
  return Math.max(0, Math.floor(stock));
}

// Our rule, not the model's: below one fish the pond is dead.
export function isDead(stock: number): boolean {
  return stock < 1;
}

