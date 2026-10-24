# Balance after the fish fixes (2026-10-25, bots only)

Measured with `BALANCE_SET='{}' node scripts/balance.ts <mode> 300` on the code of 25 October: every
match is bots against bots on each mode's own `bot()`, on a fresh room's lake, with the seeds the script
names. These are claims about those bots, parameters and seeds, not about how people play. 95% intervals
are Wilson intervals. The report before this is docs/checks/balance-lake11-2026-10-24.md (Boat Rush,
Fishing Party, Who's Poaching) and docs/checks/balance-hold3-2026-10-24.md (Lake Holdings, unchanged
here: that mode has no swimming fish).

**What changed in the lake, and why it moves these numbers.** Two bugs in how a fish moves were fixed
(Ava, 25 Oct: "the fish still flicker, it looks terrible"):

- a fish closed 8% of the gap to its school every tick with no speed limit, so a fish a net had scared
  20 units away came back at up to 95 units a second, twenty times its own 4.2. A fish now never moves
  faster than it swims (×2.2 while fleeing, as the flee already was);
- a new season moved every school to that season's places and left the fish behind, up to 54 units, so
  the whole lake streaked across the water for the first seconds of every season. The fish now travel
  with their school.

Both make a scattered school slower to re-form, so a table of bots takes a little less out of the lake.
A third fix changed the bots' own random stream: they now pick a market card from the three on the table
instead of from a roll of their own.

## Boat Rush: the three targets (prompt-17 step 5)

Before these fixes (docs/checks/balance-lake11-2026-10-24.md, same harness and seeds): (a) 70.3%,
(b) 65.0%, (c) no kind over 41% (keeper 26.3%). After:

## Boat Rush (prompt-17 step 5; 4 bots per match, src/lib/modes/rush.ts's own bot(), on 300 matches per table type)

**(a) all-greedy tables end Lean or No fish in most matches:** 170 / 300 (56.7%, 95% interval 51.0%–62.2%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 219 / 300 (73.0%, 95% interval 67.7%–77.7%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 98 | 24.3% | 20.4%–28.7% |
| keeper | 411 | 108 | 26.3% | 22.3%–30.7% |
| greedy | 386 | 94 | 24.4% | 20.3%–28.9% |

No kind over the 41% target.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 0.0% | 43.3% | 51.7% | 5.0% |
| all-keeper | 2.0% | 32.7% | 45.3% | 20.0% |
| all-steady | 0.0% | 1.3% | 47.7% | 51.0% |
| random mix | 0.0% | 19.0% | 53.7% | 27.3% |

(1200 matches in 350 s on 1 workers)

All three targets still hold, but (a) has less room than it had: greed costs the lake in 56.7% of
all-greedy tables, against 70.3% before. The counterfactual (b) rose from 65.0% to 73.0%, which says the
same thing from the other side: a lighter hand saves the year more often now. If Ava wants the old
pressure back, unloading (`RUSH.UNLOAD_EVERY`, now 0.33 s a fish) is the dial that was swept for it on
24 October.

## Fishing Party 2.0

Before: no shop habit over 40% (never buy 29.0%), the last net held in 19.0%. After:

## Fishing Party 2.0 (4 bots per match: party.ts's own bots; each seat's shop habit is one of 4 strategies drawn by a seeded shuffle each match)

Next spring's tier over 300 matches: rich 0.0%, fair 100.0%, lean 0.0%, none 0.0%. The last net held in 58 (19.3%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| Big Net always | 300 | 77 | 25.7% | 21.1%–30.9% |
| Fast Boat always | 300 | 76 | 25.3% | 20.7%–30.5% |
| Bait always | 300 | 66 | 22.0% | 17.7%–27.0% |
| never buy | 300 | 86 | 28.7% | 23.8%–34.0% |

No strategy over the 40% target.

(300 matches in 66 s on 1 workers)

## Who's Poaching 2.0

Before: fishers won 68.3%, and 50.3% when they always skip the vote. After:

## Who's Poaching 2.0 (6 bots, 1 poacher; poach.ts's own bots)

| Table | Matches | Fishers won | Rate | 95% interval | Poacher voted out on day 1 / 2 / 3 | Mean lake health at the end |
|---|---|---|---|---|---|---|
| bots as written | 300 | 203 | 67.7% | 62.2%–72.7% | 91 / 23 / 89 | 83.3% |
| fishers always skip | 300 | 152 | 50.7% | 45.0%–56.3% | 0 / 0 / 152 | 79.3% |

(600 matches in 139 s on 1 workers)
