// Types for the parts of sim/lakesim.mjs (model v2.2) that
// spec/unit/lake-sim.test.ts uses.
export type RefFish = {
  id: number;
  x: number;
  y: number;
  h: number;
  age: number;
  cool: number;
  scare: number;
  sx: number;
  sy: number;
};
export type RefNet = { fam: number; x: number; y: number; fine: boolean; closeAt: number };
export type RefKoi = { x: number; y: number; h: number; until: number };
export type RefLake = {
  t: number;
  fish: RefFish[];
  nets: RefNet[];
  start: number;
  koiRng: () => number;
  koi: RefKoi | null;
  koiYear: number;
};
export type RefStep = {
  hauls: { net: RefNet; got: number; gotFry: number; slipped: number; koi: boolean }[];
  spawns: { x: number; y: number }[];
  winter: boolean;
};
export const MODEL_VERSION: string;
export const DEFAULTS: Record<string, number>;
export function sfc32(a: number, b: number, c: number, d: number): () => number;
export function streamRng(secret: string, name: string): () => number;
export function secretHash(secret: string): string;
export function inLake(P: Record<string, number>, x: number, y: number, m?: number): boolean;
export function inShallows(P: Record<string, number>, x: number, y: number): boolean;
export function makeLake(
  P: Record<string, number>,
  families: number,
  secret: string,
  opts?: { startCount?: number },
): RefLake;
export function step(L: RefLake): RefStep;
export function cast(L: RefLake, fam: number, x: number, y: number, fine: boolean): RefNet;
export function bestSpot(
  L: RefLake,
  fine: boolean,
  rng: () => number,
  tries?: number,
  maxE?: number,
): { x: number; y: number; n: number };
export function dead(L: RefLake): boolean;
export function adults(L: RefLake): number;
export function fry(L: RefLake): number;
export function nextYear(L: RefLake): number;
