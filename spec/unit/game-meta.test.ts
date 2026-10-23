import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GAMES } from "../../src/lib/i18n.ts";
import { POACH, RUSH, PARTY, HOLD } from "../../src/lib/game-constants.ts";

// The home page and the room's game picker show each game's players and
// minutes (GAMES in i18n.ts). They once still said v4's "2½ min" and "6 min"
// after the 2.0 rebuild. DESIGN.md's 2.0 section for each game opens with its
// players and "About N minutes"; this keeps the two the same, and the player
// range the same as the mode's own seats.
const design = readFileSync(join(import.meta.dirname, "../../DESIGN.md"), "utf8");
const HEAD: Record<string, string> = { rush: "Boat Rush", party: "Fishing Party", poach: "Who's Poaching", hold: "Lake Holdings" };
const SEATS: Record<string, { min: number; max: number }> = { rush: RUSH.SEATS, party: PARTY.SEATS, poach: POACH.SEATS, hold: HOLD.SEATS };

describe("each game's players and minutes", () => {
  it.each(GAMES.map((g) => [g.id, g] as const))("%s: the minutes match DESIGN.md's 2.0 section and the players match the mode's seats", (id, g) => {
    const start = design.search(new RegExp(`^### ${HEAD[id]} .*\\(2\\.0\\)`, "m"));
    expect(start, `DESIGN.md has a 2.0 section for ${id}`).toBeGreaterThan(0);
    const head = design.slice(start, start + 600);
    expect(head.match(/About (\d+) minutes/)?.[1]).toBe(g.min);
    expect(g.players).toBe(`${SEATS[id].min}–${SEATS[id].max}`);
  });
});
