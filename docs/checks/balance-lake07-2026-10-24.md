# Balance after rule change 8: the lake at 0.7 (2026-10-24, bots only)

Written from `node scripts/balance.ts <mode> 300` on the rule-change-8 code (the
script still writes to each mode's older report file; those are left as they
were and the numbers are copied here). Every match is bots against bots on
the modes' own bot() code and the seeds the script names. These are claims
about these bots, parameters and seeds, not about how people play. 95%
intervals are Wilson intervals.

**What changed (rule change 8, Ava, 24 Oct: "the pond is too big"):** every
place on the shared lake is 0.7 of the prototype's (lake-world.ts
WORLD_SCALE: the lake is 64.4 x 44.8, the island (7, -10.5) r 5.25, the
named places and bays with it). Lake Holdings' hexes scale with it, so its
board keeps the same 61 tiles and its numbers below are unchanged. Fishing
Party's distances (boat speed, tap radius, gates, the golden carp, the night
view, lanterns and nets, bait) are the prototype's times 0.7. Who's Poaching
keeps its 24-unit lantern (CLAUDE.md names it) and its 3.4 net; on the
smaller lake fishers win a little more often (77.7% against 74.3%). Its role
card now waits for every person (rule change 9), which does not change bots.

**Boat Rush had to be retuned.** With the old boat (speed 15) and net
(4.5), the same fish in less water were fished out at every table: all
four table types ended No fish in 91-100% of matches. Sweeps at 60
matches per table type (`balance.ts rush 60`), net radius / cast ahead /
boat speed:

```
=== A netR=3.15 ahead=2.8 speed=15
**(a) all-greedy tables end Lean or No fish in most matches:** 60 / 60 (100.0%, 95% interval 94.0%–100.0%).
**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 0 / 60 (0.0%, 95% interval 0.0%–6.0%).
**(c) no bot kind wins more than 41% of the random-mix matches:**
| steady | 72 | 13 | 18.1% | 10.9%–28.5% |
| keeper | 81 | 9 | 11.1% | 6.0%–19.8% |
| greedy | 87 | 38 | 43.7% | 33.7%–54.1% |
| all-greedy | 0.0% | 0.0% | 0.0% | 100.0% |
| all-keeper | 3.3% | 18.3% | 36.7% | 41.7% |
| all-steady | 0.0% | 1.7% | 3.3% | 95.0% |
| random mix | 0.0% | 3.3% | 11.7% | 85.0% |
=== B netR=3.15 ahead=2.8 speed=12
**(a) all-greedy tables end Lean or No fish in most matches:** 51 / 60 (85.0%, 95% interval 73.9%–91.9%).
**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 16 / 60 (26.7%, 95% interval 17.1%–39.0%).
**(c) no bot kind wins more than 41% of the random-mix matches:**
| steady | 72 | 15 | 20.8% | 13.1%–31.6% |
| keeper | 81 | 18 | 22.2% | 14.5%–32.4% |
| greedy | 87 | 27 | 31.0% | 22.3%–41.4% |
| all-greedy | 0.0% | 15.0% | 31.7% | 53.3% |
| all-keeper | 28.3% | 58.3% | 8.3% | 5.0% |
| all-steady | 0.0% | 18.3% | 15.0% | 66.7% |
| random mix | 0.0% | 36.7% | 26.7% | 36.7% |
=== C netR=2.6 ahead=2.8 speed=15
**(a) all-greedy tables end Lean or No fish in most matches:** 56 / 60 (93.3%, 95% interval 84.1%–97.4%).
**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 4 / 60 (6.7%, 95% interval 2.6%–15.9%).
**(c) no bot kind wins more than 41% of the random-mix matches:**
| steady | 72 | 11 | 15.3% | 8.8%–25.3% |
| keeper | 81 | 14 | 17.3% | 10.6%–26.9% |
| greedy | 87 | 36 | 41.4% | 31.6%–51.9% |
| all-greedy | 0.0% | 6.7% | 13.3% | 80.0% |
| all-keeper | 16.7% | 70.0% | 10.0% | 3.3% |
| all-steady | 0.0% | 11.7% | 26.7% | 61.7% |
| random mix | 3.3% | 23.3% | 31.7% | 41.7% |
=== D netR=3.6 ahead=3.2 speed=15
**(a) all-greedy tables end Lean or No fish in most matches:** 60 / 60 (100.0%, 95% interval 94.0%–100.0%).
**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 0 / 60 (0.0%, 95% interval 0.0%–6.0%).
**(c) no bot kind wins more than 41% of the random-mix matches:**
| steady | 72 | 13 | 18.1% | 10.9%–28.5% |
| keeper | 81 | 9 | 11.1% | 6.0%–19.8% |
| greedy | 87 | 38 | 43.7% | 33.7%–54.1% |
| all-greedy | 0.0% | 0.0% | 0.0% | 100.0% |
| all-keeper | 0.0% | 5.0% | 20.0% | 75.0% |
| all-steady | 0.0% | 1.7% | 3.3% | 95.0% |
| random mix | 0.0% | 3.3% | 5.0% | 91.7% |
=== E netR=3.15 ahead=2.8 speed=11
**(a) all-greedy tables end Lean or No fish in most matches:** 31 / 60 (51.7%, 95% interval 39.3%–63.8%).
**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 38 / 60 (63.3%, 95% interval 50.7%–74.4%).
**(c) no bot kind wins more than 41% of the random-mix matches:**
| steady | 72 | 17 | 23.6% | 15.3%–34.6% |
| keeper | 81 | 19 | 23.5% | 15.6%–33.8% |
| greedy | 87 | 25 | 28.7% | 20.3%–39.0% |
| all-greedy | 1.7% | 46.7% | 35.0% | 16.7% |
| all-keeper | 51.7% | 41.7% | 5.0% | 1.7% |
| all-steady | 0.0% | 33.3% | 43.3% | 23.3% |
| random mix | 10.0% | 41.7% | 26.7% | 21.7% |
=== F netR=2.9 ahead=2.8 speed=12
**(a) all-greedy tables end Lean or No fish in most matches:** 44 / 60 (73.3%, 95% interval 61.0%–82.9%).
**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 23 / 60 (38.3%, 95% interval 27.1%–51.0%).
**(c) no bot kind wins more than 41% of the random-mix matches:**
| steady | 72 | 15 | 20.8% | 13.1%–31.6% |
| keeper | 81 | 20 | 24.7% | 16.6%–35.1% |
| greedy | 87 | 27 | 31.0% | 22.3%–41.4% |
| all-greedy | 0.0% | 26.7% | 36.7% | 36.7% |
| all-keeper | 31.7% | 61.7% | 5.0% | 1.7% |
| all-steady | 3.3% | 20.0% | 41.7% | 35.0% |
| random mix | 5.0% | 48.3% | 26.7% | 20.0% |
```

E (net 3.15, ahead 2.8, speed 11) meets every target of rule change 7 at
60 matches, so it is the one applied; at 300 matches it is below. A faster
boat (B, speed 12) fished all-greedy and all-steady tables out more often
and failed (b).

## Boat Rush (prompt-17 step 5; 4 bots per match, src/lib/modes/rush.ts's own bot(), on 300 matches per table type)

**(a) all-greedy tables end Lean or No fish in most matches:** 149 / 300 (49.7%, 95% interval 44.0%–55.3%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 196 / 300 (65.3%, 95% interval 59.8%–70.5%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 104 | 25.8% | 21.8%–30.3% |
| keeper | 411 | 91 | 22.1% | 18.4%–26.4% |
| greedy | 386 | 109 | 28.2% | 24.0%–32.9% |

No kind over the 41% target.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 1.3% | 49.0% | 32.7% | 17.0% |
| all-keeper | 53.7% | 42.3% | 2.3% | 1.7% |
| all-steady | 1.3% | 37.0% | 34.0% | 27.7% |
| random mix | 12.0% | 50.0% | 23.7% | 14.3% |

(1200 matches in 700 s on 1 workers)
## Fishing Party 2.0 (4 bots per match: party.ts's own bots; each seat's shop habit is one of 4 strategies drawn by a seeded shuffle each match)

Next spring's tier over 300 matches: rich 9.3%, fair 90.7%, lean 0.0%, none 0.0%. The last net held in 147 (49.0%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| Big Net always | 300 | 63 | 21.0% | 16.8%–26.0% |
| Fast Boat always | 300 | 104 | 34.7% | 29.5%–40.2% |
| Bait always | 300 | 54 | 18.0% | 14.1%–22.7% |
| never buy | 300 | 88 | 29.3% | 24.5%–34.7% |

No strategy over the 40% target.

(300 matches in 81 s on 1 workers)
## Who's Poaching 2.0 (6 bots, 1 poacher; poach.ts's own bots)

| Table | Matches | Fishers won | Rate | 95% interval | Poacher voted out on day 1 / 2 / 3 | Mean lake health at the end |
|---|---|---|---|---|---|---|
| bots as written | 300 | 233 | 77.7% | 72.6%–82.0% | 120 / 53 / 60 | 87.7% |
| fishers always skip | 300 | 160 | 53.3% | 47.7%–58.9% | 0 / 0 / 160 | 82.8% |

(600 matches in 176 s on 1 workers)
## Lake Holdings 2.0 (4 bots per match; hold.ts's own bots)

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

(1200 matches in 40 s on 1 workers)
