// The /play modes (DESIGN.md "One lake, four games"). READY lists the modes
// that passed their two-device app test (lobby to results to rematch); only
// they get a Start button (CLAUDE.md).
import type { AnyMode } from "../game-platform.ts";
import { poach } from "./poach.ts";
import { rush } from "./rush.ts";

export const MODES: Record<string, AnyMode> = { rush, poach };
export const READY: string[] = ["rush", "poach"];
export const MODE_IDS = ["rush", "poach", "party", "hold"];
