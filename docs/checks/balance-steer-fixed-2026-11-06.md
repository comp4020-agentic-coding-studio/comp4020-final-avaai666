# Boat Rush, re-measured after a timing bug in unloading (2026-11-06)

Measured with `BALANCE_SET='{}' node scripts/balance.ts rush 300` on the finished code of this session (the
steering fix of 29 October, rule change 14, committed here together with the fix below). Every match is
bots against bots on `rush.ts`'s own `bot()`, 4 seats, in one of three kinds (steady, keeper, greedy), on a
fresh room's lake, on the seeds the script names. These are claims about those bots, parameters and seeds,
not about how people play. 95% intervals are Wilson intervals. The report before this is
docs/checks/balance-steer-2026-10-29.md, whose numbers this one supersedes (not confirms — see below).

## A bug the 29 October numbers were measured with

Picking this work back up on 6 November, `pnpm test:unit` failed on the first run, before any new code was
written: "a fish unloads every UNLOAD_EVERY" expected 2 fish left, got 3. The cause is in
`moveBoats()` (`src/lib/modes/rush.ts`), in code that predates this session — `while (b.unloadT <= 0 && ...)`.
With `RUSH.DT = 0.05` and the 29 October session's new `UNLOAD_EVERY = 0.3`, six ticks of `b.unloadT -= dt`
from 0.3 lands on `1.3877787807814457e-17` in IEEE float, not exactly `0`, so the loop's `<= 0` check misses
the tick a fish is due and it waits one more tick — every cycle, forever, deterministically. At the old
`UNLOAD_EVERY = 0.33`, `0.33 - 7 * 0.05` happens to land on a small *negative* number instead, so the same
bug was always there but never fired. 0.30 was the first value in this file's own history to expose it.

Fixed by comparing against `1e-9` instead of a bare `0` (the file already uses this epsilon at five other
phase/market comparisons for the same reason, `src/lib/modes/rush.ts` lines 228, 229, 235, 242, 376). This
makes a boat's hold finish unloading exactly on schedule instead of one tick late every UNLOAD_EVERY, which
means every fish caught takes a hair less real time to bank — the boat spends an extra tick back out
fishing, roughly once a dock visit.

This means `docs/checks/balance-steer-2026-10-29.md`'s own Boat Rush numbers (70.0% / 63.7% / keeper 26.5%)
were measured against code carrying this bug: unloading was quietly running at an effective ~0.35 s a fish
instead of the intended 0.30 s. Confirmed directly — toggling only this one line, holding everything else
(the steering fix, UNLOAD_EVERY = 0.30) fixed, reproduces the 29 October numbers exactly:

| | (a) all-greedy Lean/No-fish | (b) counterfactual Fair+ | (c) keeper's win rate |
|---|---|---|---|
| with the bug (`<= 0`, what 29 Oct measured) | 70.0% | 63.7% | 26.5% |
| with the fix (`<= 1e-9`, correct timing) | 72.0% | 62.0% | 26.8% |

The gap is the bug's own size, not noise from a changed mechanism: the two bands overlap in their 95%
intervals. The numbers below are the real, correct ones for the code as committed.

## Boat Rush: the three targets (prompt-17 step 5)

Before any of the 29 October or this session's fixes (docs/checks/balance-fish-2026-10-25.md, same harness
and seeds): (a) 56.7%, (b) 73.0%, (c) no kind over 41% (keeper 26.3%).

## Boat Rush (prompt-17 step 5; 4 bots per match, src/lib/modes/rush.ts's own bot(), on 300 matches per table type)

**(a) all-greedy tables end Lean or No fish in most matches:** 216 / 300 (72.0%, 95% interval 66.7%–76.8%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 186 / 300 (62.0%, 95% interval 56.4%–67.3%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 97 | 24.1% | 20.2%–28.5% |
| keeper | 411 | 110 | 26.8% | 22.7%–31.2% |
| greedy | 386 | 94 | 24.4% | 20.3%–28.9% |

No kind over the 41% target.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 0.0% | 28.0% | 57.7% | 14.3% |
| all-keeper | 1.0% | 32.0% | 52.3% | 14.7% |
| all-steady | 0.0% | 10.0% | 64.0% | 26.0% |
| random mix | 0.7% | 23.0% | 54.7% | 21.7% |

(1200 matches in 112 s on 7 workers)

Both (a) and (b) still hold their own "most" wording at 0.30, by a wider margin on (a) than 29 October's own
(incorrect) numbers suggested and a narrower one on (b), but neither is close to its own 50% line. (c) is
essentially unchanged (keeper 26.8% vs 26.3% before the whole line of fixes — within noise).

## UNLOAD_EVERY sweep, with the timing fix in place

Re-run of the 29 October sweep, same code otherwise, to confirm 0.30 is still the only value that clears
both targets. `BALANCE_SET='{"RUSH":{"UNLOAD_EVERY":<v>}}' node scripts/balance.ts rush 300` for each row.

| UNLOAD_EVERY | (a) all-greedy Lean/No-fish | (b) counterfactual Fair+ | (c) keeper's win rate |
|---|---|---|---|
| 0.33 (before rule change 14) | 40.7% | 85.7% | 26.8% |
| **0.30 (committed)** | **72.0%** | **62.0%** | **26.8%** |
| 0.28 | 91.7% | 36.7% ✗ | 26.5% |
| 0.26 | 95.3% | 20.7% ✗ | 26.5% |
| 0.24 | 99.0% | 6.7% ✗ | 26.5% |

0.30 remains the only value where (a) and (b) both clear their own "most" wording, with or without the
timing bug. No dial beyond the steering fix and the timing fix was touched to produce these numbers; the
dial itself (0.30) is unchanged from 29 October — it was the code under it that was wrong, not the choice.
