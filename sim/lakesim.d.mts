// Types for the parts of sim/lakesim.mjs that spec/unit/lake-sim.test.ts uses.
export type RefFish = { x: number; y: number; h: number; age: number; cool: number; scare: number; sx: number; sy: number };
export type RefEvent =
  | { t: number; kind: "haul"; fam: number; got: number; gotFry: number; x: number; y: number; fine: boolean }
  | { t: number; kind: "spawn"; x: number; y: number };
export type RefLake = { t: number; fish: RefFish[]; events: RefEvent[] };
export const DEFAULTS: Record<string, number>;
export function rngFrom(seed: number): () => number;
export function makeLake(P: Record<string, number>, families: number, seed: number): RefLake;
export function step(L: RefLake): void;
export function cast(L: RefLake, fam: number, x: number, y: number, fine: boolean): void;
export function bestSpot(L: RefLake, fine: boolean, rng: () => number, tries?: number, maxE?: number): { x: number; y: number; n: number };
