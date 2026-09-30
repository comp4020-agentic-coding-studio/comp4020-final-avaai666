// Model and rate constants (DESIGN.md v0.2, from sim/pond_sim.py). They live
// only here.
export const K = 300;
export const A = 30;
export const R_PER_MIN = 0.2377;
export const MAX_TAPS_PER_MIN = 60; // one tap per second per net
export const STEP_MS = 1000; // RK4 step
export const CATCH_INTERVAL_MS = 60_000 / MAX_TAPS_PER_MIN; // a net's cooldown after a catch
export const NAME_MAX_GRAPHEMES = 24;
export const MAX_NETS_PER_POND = 100;
export const REGISTER_SIZE = 50; // ponds listed on the home page
