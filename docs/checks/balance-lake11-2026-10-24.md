# Balance after rule change 11: a lake for each match's boats, homes round the lake (2026-10-24, bots only)

Measured with `BALANCE_SET='{}' node scripts/balance.ts <mode> <matches> [boats]` on the
rule-change-11 code: every match is on the lake for its boats, as in a room (the harness passes
`boats`), and the homes are spread round it. The sweeps ran the same matches with other numbers
(`BALANCE_SET='{"RUSH":{...}}'`). Every match is bots against bots on the modes' own bot() code
and the seeds the script names. These are claims about these bots, parameters and seeds, not
about how people play. 95% intervals are Wilson intervals. The reports before this are
docs/checks/balance-lake05-2026-10-24.md and the files it names.

**What changed for balance:** with one home per boat spread round the lake, every school is near
somebody's dock and the trip home is short. On the rule-change-10 numbers (unloading 0.1 s a
fish), 60 four-boat matches per table type: all-greedy, all-steady and random-mix tables ended
No fish in 98.3–100%, all-keeper tables in 88.3%.

## Boat Rush: the sweep (four boats, 60 matches per table type)

| Run | Numbers | (a) greedy Lean/none | (b) greedy at 80% Fair+ | all-keeper Fair+ |
|---|---|---|---|---|
| U3 | unloading 0.3 s a fish | 98.3% | 8.3% | 15.0% |
| U32 | 0.32 s | 85.0% | 48.3% | 30.0% |
| U33 | 0.33 s | 71.7% | 61.7% | 33.3% |
| U34 | 0.34 s | 56.7% | 71.7% | 33.3% |
| U35 | 0.35 s | 40.0% | 95.0% | 48.3% |
| U4 | 0.4 s | 1.7% | 100% | 83.3% |
| CNU | cooldown 1.0 s, at most 4 a cast, unloading 0.25 s | 91.7% | 30.0% | 80.0% |

In every run no kind won more than 41% of random-mix tables. U33 was kept: the slowest unloading
at which (a) still holds with room. On this layout the bot kinds differ less in what they leave:
all-keeper tables end Fair or better about as often as all-greedy ones (greedy boats ram each
other, and a ram spills fish back into the lake).

## The kept numbers

### Boat Rush, four boats (unloading 0.33 s a fish, hold 8; 300 matches per table type)

**(a) all-greedy tables end Lean or No fish in most matches:** 211 / 300 (70.3%, 95% interval 64.9%–75.2%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 195 / 300 (65.0%, 95% interval 59.4%–70.2%).

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
| all-greedy | 0.0% | 29.7% | 62.7% | 7.7% |
| all-keeper | 0.0% | 32.3% | 39.0% | 28.7% |
| all-steady | 0.0% | 0.7% | 42.3% | 57.0% |
| random mix | 0.0% | 17.3% | 52.3% | 30.3% |

(1200 matches in 339 s on 1 workers)

### Boat Rush, three and two boats (60 matches per table type)

A hold of 8 × 4 / boats (11 for three, 16 for two). With fewer boats the lake is smaller but has
the same fish, and these bots do not fish it down: (a) does not hold, and keepers win more.

**3 boats:**


**(a) all-greedy tables end Lean or No fish in most matches:** 4 / 60 (6.7%, 95% interval 2.6%–15.9%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 59 / 60 (98.3%, 95% interval 91.1%–99.7%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 54 | 13 | 24.1% | 14.6%–36.9% |
| keeper | 63 | 29 | 46.0% | 34.3%–58.2% |
| greedy | 63 | 18 | 28.6% | 18.9%–40.7% |

Over the 41% target: keeper.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 0.0% | 93.3% | 6.7% | 0.0% |
| all-keeper | 8.3% | 81.7% | 10.0% | 0.0% |
| all-steady | 0.0% | 28.3% | 66.7% | 5.0% |
| random mix | 1.7% | 83.3% | 15.0% | 0.0% |


**2 boats:**


**(a) all-greedy tables end Lean or No fish in most matches:** 0 / 60 (0.0%, 95% interval 0.0%–6.0%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 60 / 60 (100.0%, 95% interval 94.0%–100.0%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 35 | 16 | 45.7% | 30.5%–61.8% |
| keeper | 42 | 34 | 81.0% | 66.7%–90.0% |
| greedy | 43 | 11 | 25.6% | 14.9%–40.2% |

Over the 41% target: steady, keeper.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 100.0% | 0.0% | 0.0% | 0.0% |
| all-keeper | 100.0% | 0.0% | 0.0% | 0.0% |
| all-steady | 100.0% | 0.0% | 0.0% | 0.0% |
| random mix | 100.0% | 0.0% | 0.0% | 0.0% |


### Fishing Party 2.0, four boats (4 bots per match: party.ts's own bots; each seat's shop habit is one of 4 strategies drawn by a seeded shuffle each match)

Next spring's tier over 300 matches: rich 0.0%, fair 100.0%, lean 0.0%, none 0.0%. The last net held in 57 (19.0%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| Big Net always | 300 | 78 | 26.0% | 21.4%–31.2% |
| Fast Boat always | 300 | 81 | 27.0% | 22.3%–32.3% |
| Bait always | 300 | 62 | 20.7% | 16.5%–25.6% |
| never buy | 300 | 87 | 29.0% | 24.2%–34.4% |

No strategy over the 40% target.

(300 matches in 67 s on 1 workers)

**Fishing Party, 3 boats (60 matches; with 3 seats a fair share is 33%, so the 40% target is not the measure):**


Next spring's tier over 60 matches: rich 15.0%, fair 85.0%, lean 0.0%, none 0.0%. The last net held in 53 (88.3%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| Big Net always | 42 | 13 | 31.0% | 19.1%–46.0% |
| Fast Boat always | 50 | 22 | 44.0% | 31.2%–57.7% |
| Bait always | 41 | 17 | 41.5% | 27.8%–56.6% |
| never buy | 47 | 8 | 17.0% | 8.9%–30.1% |

Over the 40% target: Fast Boat always, Bait always.


**Fishing Party, 2 boats (60 matches; with 2 seats a fair share is 50%, so the 40% target is not the measure):**


Next spring's tier over 60 matches: rich 100.0%, fair 0.0%, lean 0.0%, none 0.0%. The last net held in 60 (100.0%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| Big Net always | 31 | 16 | 51.6% | 34.8%–68.0% |
| Fast Boat always | 25 | 6 | 24.0% | 11.5%–43.4% |
| Bait always | 25 | 11 | 44.0% | 26.7%–62.9% |
| never buy | 39 | 29 | 74.4% | 58.9%–85.4% |

Over the 40% target: Big Net always, Bait always, never buy.


### Who's Poaching 2.0, six boats on the six-boat lake (k 1.224; the lantern 14.7) (6 bots, 1 poacher; poach.ts's own bots)

| Table | Matches | Fishers won | Rate | 95% interval | Poacher voted out on day 1 / 2 / 3 | Mean lake health at the end |
|---|---|---|---|---|---|---|
| bots as written | 300 | 205 | 68.3% | 62.9%–73.3% | 92 / 24 / 89 | 83.4% |
| fishers always skip | 300 | 151 | 50.3% | 44.7%–56.0% | 0 / 0 / 151 | 79.3% |

(600 matches in 140 s on 1 workers)

### Lake Holdings 2.0, four boats (to be replaced: Ava chose a Monopoly-style Lake Holdings) (4 bots per match; hold.ts's own bots)

**Next spring, by table:**

| Table | rich | fair | lean | none | Mean next spring | Mean tiles dry |
|---|---|---|---|---|---|---|
| all-greedy | 1.7% | 98.3% | 0.0% | 0.0% | 177 | 21.2 |
| all-keeper | 100.0% | 0.0% | 0.0% | 0.0% | 267 | 7.8 |
| all-steady | 75.0% | 25.0% | 0.0% | 0.0% | 213 | 16.1 |
| random mix | 75.0% | 25.0% | 0.0% | 0.0% | 220 | 15.1 |

**Who wins a random-mix table (incl. shared first):**

| Bot kind | Seats played | Won | Rate | 95% interval |
|---|---|---|---|---|
| steady | 430 | 126 | 29.3% | 25.2%–33.8% |
| keeper | 395 | 39 | 9.9% | 7.3%–13.2% |
| greedy | 375 | 157 | 41.9% | 37.0%–46.9% |

(1200 matches in 30 s on 1 workers)
