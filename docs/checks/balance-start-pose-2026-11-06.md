# Boat Rush, re-measured after boats start facing the water (2026-11-06)

Measured with `BALANCE_SET='{}' node scripts/balance.ts rush 300` and
`BALANCE_SET='{"RUSH":{"UNLOAD_EVERY":<v>}}' node scripts/balance.ts rush 300` on the finished code of this
session. Every match is bots against bots on `rush.ts`'s own `bot()`, 4 seats, in one of three kinds
(steady, keeper, greedy), on a fresh room's lake, on the seeds the script names. These are claims about
those bots, parameters and seeds, not about how people play. 95% intervals are Wilson intervals. The report
before this is docs/checks/balance-steer-fixed-2026-11-06.md, whose Boat Rush numbers this one supersedes
(its account of the float-precision bug in `moveBoats()`'s unload loop still stands as history — nothing
here touches that fix).

## What changed

Ava, playing live on 6 November: "at the start of a match the bow points the wrong way — it should be the
opposite — otherwise I have to turn round before I can set off." `dockPos()` gives each dock an `inward`
pointing from the dock toward the water, but all six places a mode starts a boat (`rush.ts`'s `make()` and
`startSeason()`, `party.ts`'s `make()` and `setupRound()`, `poach.ts`'s `make()` and `startDay()`) started
it facing `inward + Math.PI` (the bank) and, where the start position was offset at all, two units further
inland from a dock already on the shore line — onto the pier, which `keepOnWater()` then shoved back onto
the lake on the first tick. All six now face `inward` and start two units out on open water.

This is the third physics fix to make every bot's season a little more efficient (after the fish speed on
25 October and the braking fix on 29 October): a bot that starts already facing its fishing grounds spends
less of a season's first seconds turning round.

## The isolation: the start-pose fix alone moved the numbers, not the ring fix alongside it

The ring fix (`docs/checks/` — committed separately as `22c453f`) is a client-only rendering change; it
cannot touch the bot simulation `scripts/balance.ts` plays. Confirmed directly: stashing the ring fix's
files (`src/static/play/world5.js`, `src/static/play/rush.js`, their tests) out of the working tree and
re-running `BALANCE_SET='{}' node scripts/balance.ts rush 300` at `UNLOAD_EVERY = 0.30` gave the same
numbers, with or without the ring fix present — (a) 83.3%, (b) 49.3%, keeper 26.8%, both times, identically.

## Boat Rush's three targets at the unloading dial unchanged (0.30)

**(a) all-greedy tables end Lean or No fish in most matches:** 250 / 300 (83.3%, 95% interval 78.7%–87.1%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 148 / 300 (49.3%, 95% interval 43.7%–55.0%) — **below 50%, no longer "most."**

**(c) keeper's win rate:** 26.8%, no kind over 41%.

(a) cleared its own line by a wide margin (+33.3 points), but (b) fell under its own line for the first
time since this dial started moving. The start-pose fix alone is responsible: every bot's season begins a
little more efficiently, which makes the lake a little leaner, in the same direction as the fish-speed fix
of 25 October and the braking fix of 29 October.

## UNLOAD_EVERY sweep, with the start-pose fix in place

| UNLOAD_EVERY | (a) all-greedy Lean/No-fish | (b) counterfactual Fair+ | (c) keeper's win rate |
|---|---|---|---|
| 0.30 (before this fix's dial move) | 83.3% | 49.3% ✗ | 26.8% |
| 0.31 | 75.7% | 58.3% | 26.0% |
| **0.32 (committed)** | **68.7%** | **66.0%** | **27.0%** |
| 0.33 | 56.3% | 76.0% | 26.3% |

The predicted shape — (a) falling and (b) rising as the dial increases — held cleanly across all four
values. The predicted numbers at 0.33 (roughly (a) 53%, (b) 72%) were a few points off from what was
actually measured (56.3% / 76.0%); the shape was right, the magnitude was a touch conservative.

Both 0.31 and 0.32 clear 50% on both targets. 0.32 was chosen: both margins over 50% come out wide and
roughly even ((a) +18.7 points, (b) +16.0 points), while 0.31's margin on (b) is a thin +8.3 points — inside
the noise a single 300-match run can carry. 0.32's pair (68.7% / 66.0%) also sits close to 29 October's own
measured pair (70.0% / 63.7%), the same shape of outcome the dial has tracked back to each time it has
moved.

## Boat Rush: the published numbers (prompt-17 step 5, UNLOAD_EVERY = 0.32)

**(a) all-greedy tables end Lean or No fish in most matches:** 206 / 300 (68.7%, 95% interval 63.2%–73.7%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 198 / 300 (66.0%, 95% interval 60.5%–71.1%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 97 | 24.1% | 20.2%–28.5% |
| keeper | 411 | 111 | 27.0% | 22.9%–31.5% |
| greedy | 386 | 92 | 23.8% | 19.8%–28.3% |

No kind over the 41% target.

## The pattern, stated plainly

This is the third time `UNLOAD_EVERY` has moved: the fish-speed fix of 25 October, the braking fix of 29
October, and the start pose now. Each time, a physics bug got fixed, the simulation became more faithful to
what it was meant to model, every bot's season got a little more efficient as a result, and the unloading
dial was turned to hold the three published targets where they have always been. The targets themselves —
their wording, their "most," their 41% line — have never been reworded to fit the code. The dial moves; the
promise does not.
