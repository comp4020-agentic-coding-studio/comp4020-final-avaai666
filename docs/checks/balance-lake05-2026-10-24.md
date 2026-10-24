# Balance after rule change 10: the whole lake on one screen (2026-10-24, bots only)

The tuned numbers below were measured with `BALANCE_SET='{}' node scripts/balance.ts <mode> 300`
on the rule-change-10 code. With `BALANCE_SET` set, the script prints and writes no file, so the
older reports stay as they were. The sweeps ran the same matches with other numbers
(`BALANCE_SET='{"RUSH":{...}}' node scripts/balance.ts rush 40|60`). Every match is bots against
bots on the modes' own bot() code and the seeds the script names. These are claims about these
bots, parameters and seeds, not about how people play. 95% intervals are Wilson intervals.
The old lake's reports are docs/checks/balance-rush2-2026-10-23.md,
docs/checks/balance-party2-2026-10-24.md, docs/checks/balance-poach2-2026-10-23.md and
docs/checks/balance-hold2-2026-10-24.md.

**What changed (rule change 10, Ava, 24 Oct: "four people do not need a lake this big"; the
whole lake on one screen):**
- every place on the shared lake is 0.5 of the prototype's (lake-world.ts WORLD_SCALE): 46 × 32,
  the island at (5, -7.5) with radius 3.75, the named places and bays with it;
- every distance a mode names in the prototype's units is scaled too. On the 0.7 lake some had
  been left as they were: Who's Poaching's task spots t1, t4, t7, t8 and t9, its bots' ranges,
  Fishing Party's splash box, Boat Rush's bot ranges and the golden carp's pull. A test now checks
  that every named place is on open water (spec/unit/boat-move.test.ts);
- sailing is shared (src/lib/modes/boat-move.ts). A steer target past the shore is moved onto the
  water, and a boat that meets the shore slides along it (95% of its speed kept per tick, 70%
  before). In a probe on rush's own sim (seed probe-1), the client's stick rule (a target 12 ahead,
  every 150 ms) held into the shore for 6 s left the old boat 4.5 s at the shore at a mean speed
  of 1.65 (of 15), and sliding east along it, 13.6 units in 3 s.

## Boat Rush: the sweep

On the half-size lake, with the rest unchanged (45 s seasons, hold 12, speed 15), every table
type ended No fish in 97.5–100% of 40 matches. In 8 matches of steady, keeper, greedy and steady
boats (a probe, not the harness), they took 156 fish in spring and left 66 (on the old lake: 102
and 192). Sweeps at 40 matches per table type:

| Run | Numbers | (a) greedy Lean/none | (b) greedy at 80% Fair+ | (c) best kind | all-keeper Fair+ |
|---|---|---|---|---|---|
| base | as before | 100% | 0% | greedy 54.2% | 0% |
| A | net max 4, cooldown 1.0 | 100% | 0% | greedy 49.2% | 0% |
| B | net max 3, cooldown 1.2 | 100% | 0% | greedy 54.2% | 0% |
| C | hold 8, net max 4 | 100% | 0% | greedy 45.8% | 0% |
| D | hold 10, net max 3, cooldown 1.2 | 100% | 0% | greedy 50.8% | 7.5% |
| E | net 3.2, net max 4, cooldown 1.1 | 100% | 0% | greedy 54.2% | 0% |
| F | unloading 0.3 s a fish, net max 4 | 100% | 0% | steady 28.9% | 0% |
| G | season 30 s, hold 8 | 40.0% | 85.0% | keeper 32.1% | 100% |
| H | season 30 s, unloading 0.25 s a fish | 10.0% | 97.5% | keeper 46.4% | 92.5% |
| I | season 32 s, hold 8, unloading 0.2 s | 5.0% | 97.5% | keeper 39.3% | 100% |
| J | season 30 s, hold 9 | 92.5% | 27.5% | greedy 32.2% | 90.0% |
| K | season 32 s, hold 8 | 95.0% | 25.0% | greedy 30.5% | 100% |
| L | season 34 s, hold 8 | 100% | 2.5% | greedy 30.5% | 77.5% |

At 60 matches per table type:

| Run | Numbers | (a) | (b) | (c) best kind | all-keeper Fair+ |
|---|---|---|---|---|---|
| M | season 31 s, hold 8 | 66.7% | 65.0% | keeper 30.9% | 100% |
| O | season 30 s, hold 8, cooldown 0.6 | 45.0% | 76.7% | greedy 28.7% | 100% |
| P | season 30 s, hold 8, speed 16 | 53.3% | 65.0% | keeper 32.1% | 98.3% |

The net's size and cooldown did not hold the catch: in a quarter of the water a net is full at
every cast, so what limits a season is how many trips fit in it. Ava chose P (30 s seasons, a
little faster boat, hold 8) over M (31 s) and over keeping 45 s, for which no numbers tried here
came near the targets (the nearest, unloading at 0.4 s a fish with a hold of 8, still left 53 fish
in the 8-match probe, where the old lake left 130). Her decision of 19 October (45 s seasons) changed with it.

## The tuned numbers, 300 matches

### Boat Rush (30 s seasons, hold 8, speed 16; 4 bots, rush.ts's own bot(), 300 matches per table type)

**(a) all-greedy tables end Lean or No fish in most matches:** 173 / 300 (57.7%, 95% interval 52.0%–63.1%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 213 / 300 (71.0%, 95% interval 65.6%–75.8%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 83 | 20.6% | 16.9%–24.8% |
| keeper | 411 | 123 | 29.9% | 25.7%–34.5% |
| greedy | 386 | 98 | 25.4% | 21.3%–30.0% |

No kind over the 41% target.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 0.3% | 42.0% | 45.3% | 12.3% |
| all-keeper | 72.0% | 25.7% | 2.0% | 0.3% |
| all-steady | 0.0% | 17.3% | 65.3% | 17.3% |
| random mix | 6.7% | 51.7% | 36.3% | 5.3% |

(1200 matches in 430 s on 1 workers)

### Fishing Party 2.0 (boats at 10, the night net every 2 s) (4 bots per match: party.ts's own bots; each seat's shop habit is one of 4 strategies drawn by a seeded shuffle each match)

Next spring's tier over 300 matches: rich 0.3%, fair 99.7%, lean 0.0%, none 0.0%. The last net held in 76 (25.3%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| Big Net always | 300 | 80 | 26.7% | 22.0%–31.9% |
| Fast Boat always | 300 | 79 | 26.3% | 21.7%–31.6% |
| Bait always | 300 | 57 | 19.0% | 15.0%–23.8% |
| never buy | 300 | 93 | 31.0% | 26.0%–36.4% |

No strategy over the 40% target.

(300 matches in 73 s on 1 workers)

Before tuning, on the half-size lake with the old numbers (boats at 14, the night net every
1.6 s), 60 matches: Fast Boat always won 43.3% (over the 40% target) and the last net held in 5.0%.
At 14 a lap of Koi Chase's gates took half the time. In 12 matches the koi round took 56 fish
(36.8 on the old lake) and the night 76 (63.7). At speed 10 with the night net every 2 s, the
same 12 took 36.5 and 64.5.

### Who's Poaching 2.0 (the lantern 12, the buoy 7.5, inspect 6, report 7) (6 bots, 1 poacher; poach.ts's own bots)

| Table | Matches | Fishers won | Rate | 95% interval | Poacher voted out on day 1 / 2 / 3 | Mean lake health at the end |
|---|---|---|---|---|---|---|
| bots as written | 300 | 198 | 66.0% | 60.5%–71.1% | 78 / 34 / 86 | 80.9% |
| fishers always skip | 300 | 146 | 48.7% | 43.1%–54.3% | 0 / 0 / 146 | 77.2% |

(600 matches in 135 s on 1 workers)

On the old lake the same bots' fishers won 74.3% (45.0% if they always skip). Who's Poaching has
no target for this; it is reported for Ava.

### Lake Holdings 2.0 (the hexes scale with the lake, 61 tiles) (4 bots per match; hold.ts's own bots)

**Next spring, by table:**

| Table | rich | fair | lean | none | Mean next spring | Mean tiles dry |
|---|---|---|---|---|---|---|
| all-greedy | 11.7% | 88.3% | 0.0% | 0.0% | 185 | 20.7 |
| all-keeper | 100.0% | 0.0% | 0.0% | 0.0% | 270 | 6.7 |
| all-steady | 90.7% | 9.3% | 0.0% | 0.0% | 222 | 15.3 |
| random mix | 86.7% | 13.3% | 0.0% | 0.0% | 228 | 14.0 |

**Who wins a random-mix table (incl. shared first):**

| Bot kind | Seats played | Won | Rate | 95% interval |
|---|---|---|---|---|
| steady | 430 | 126 | 29.3% | 25.2%–33.8% |
| keeper | 395 | 30 | 7.6% | 5.4%–10.6% |
| greedy | 375 | 166 | 44.3% | 39.3%–49.3% |

(1200 matches in 29 s on 1 workers)

These are the same as on the old lake (docs/checks/balance-hold2-2026-10-24.md): the board keeps
its tiles and nothing in Holdings depends on distance.
