# Balance, Who's Poaching 2.0, 2026-10-23 (bots only)

Written by `node scripts/balance.ts poach`. Every match here is six bots (src/lib/modes/poach.ts's own bot()) on a fresh room's lake, on the seeds `balance-poach-<table>-1` to `-300`. These are claims about these bots and seeds, not about how people play: the bots read evidence more carefully, and lie less well, than a table of people. 95% intervals are Wilson intervals.

## Who's Poaching 2.0 (6 bots, 1 poacher; poach.ts's own bots)

| Table | Matches | Fishers won | Rate | 95% interval | Poacher voted out on day 1 / 2 / 3 | Mean lake health at the end |
|---|---|---|---|---|---|---|
| bots as written | 300 | 223 | 74.3% | 69.1%–78.9% | 108 / 48 / 67 | 88.3% |
| fishers always skip | 300 | 135 | 45.0% | 39.5%–50.7% | 0 / 0 / 135 | 84.6% |
