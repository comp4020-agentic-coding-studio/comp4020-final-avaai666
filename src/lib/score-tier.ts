// The tier and the final number on a stored summary (DESIGN.md v5.16, "The
// podium's tier and final score"). From v5.16 every mode's results() names its
// tier (extra.scoreTier) and each seat's final number (beside score and place),
// and the pages compute neither. A summary stored before v5.16 has neither:
// fillScoreTier() works them out the way that mode's page used to, from the
// same tierOf() and the same Rush arithmetic, when the summary is served. It
// writes nothing back into the stored row, and returns a new object.
import type { Summary } from "./game-store.ts";
import { tierOf } from "./lake-world.ts";
import { rushFinal } from "./modes/rush.ts";

type Tier = { id: string; mult: number };

// What each mode's page used, before v5.16, to name the tier: Lake Holdings
// says none for a dead lake, every mode judges extra.next if it has one, and
// Boat Rush (whose extra has no next) judges lakeAfter.
function oldTier(s: Summary): Tier {
  const x = (s.extra ?? {}) as { next?: unknown; dead?: unknown };
  if (s.mode === "hold" && x.dead) return { id: "none", mult: 0.5 };
  return tierOf(typeof x.next === "number" ? x.next : s.lakeAfter);
}

export function fillScoreTier(s: Summary): Summary {
  const known = (s.extra as { scoreTier?: Tier } | undefined)?.scoreTier;
  const hasFinals = s.seats.every((x) => typeof x.final === "number");
  if (known && hasFinals) return s;
  // a summary with no tier at all is one of the four modes recorded before v5.16, or a mode with no tier
  if (!known && !["rush", "hold", "party", "poach"].includes(s.mode)) {
    return hasFinals ? s : { ...s, seats: s.seats.map((x) => ({ ...x, final: x.final ?? x.score })) };
  }
  const tier = known ?? oldTier(s);
  // Rush's score is the unmultiplied base; the other three modes' score already carries the tier
  const finalOf = (score: number): number => (s.mode === "rush" ? rushFinal(score, tier.mult) : score);
  return {
    ...s,
    seats: s.seats.map((x) => ({ ...x, final: typeof x.final === "number" ? x.final : finalOf(x.score) })),
    extra: { ...(s.extra ?? {}), scoreTier: { id: tier.id, mult: tier.mult } },
  };
}
