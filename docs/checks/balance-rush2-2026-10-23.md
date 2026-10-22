# Balance, Boat Rush 2.0, 2026-10-23 (bots only)

Written by `node scripts/balance.ts rush`. Every match here is bots against bots, 4 seats, src/lib/modes/rush.ts's own bot() in one of three kinds (steady, keeper, greedy). A real room always draws seat % 3; this harness also runs whole tables of one kind (all-greedy, all-keeper, all-steady) and a seeded random mix, on the seeds `balance-rush-<table>-1` to `-300`, through makeWithOpts's script-only override (src/lib/modes/rush.ts), to measure prompt-17 step 5's three targets, which seat % 3 alone cannot (there is never an all-greedy table that way). These are claims about these bots and seeds, not about how people play. 95% intervals are Wilson intervals.

## Boat Rush (prompt-17 step 5; 4 bots per match, src/lib/modes/rush.ts's own bot(), on 300 matches per table type)

**(a) all-greedy tables end Lean or No fish in most matches:** 0 / 300 (0.0%, 95% interval 0.0%–1.3%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 300 / 300 (100.0%, 95% interval 98.7%–100.0%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 126 | 31.3% | 26.9%–36.0% |
| keeper | 411 | 123 | 29.9% | 25.7%–34.5% |
| greedy | 386 | 53 | 13.7% | 10.7%–17.5% |

No kind over the 41% target.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 100.0% | 0.0% | 0.0% | 0.0% |
| all-keeper | 100.0% | 0.0% | 0.0% | 0.0% |
| all-steady | 100.0% | 0.0% | 0.0% | 0.0% |
| random mix | 100.0% | 0.0% | 0.0% | 0.0% |
