# Balance, Lake Holdings 2.0, 2026-10-24 (bots only)

Written by `node scripts/balance.ts hold`. Every match here is four bots (src/lib/modes/hold.ts's own bot(), in one of three kinds) on a fresh room's lake, on the seeds `balance-hold-<table>-1` to `-300`. A real room always draws seat % 3; whole tables of one kind are set by the script only. These are claims about these bots and seeds, not about how people play. 95% intervals are Wilson intervals.

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
