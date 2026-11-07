# Fishing Party and Who's Poaching, re-measured (2026-11-08)

Measured on commit 1786d49 with:

```
BALANCE_SET='{}' node scripts/balance.ts party 300
BALANCE_SET='{}' node scripts/balance.ts poach 300
```

With `BALANCE_SET` set, the harness only prints; these tables are copied from its output. Every match is
bots against bots on each mode's own `bot()`, on a fresh room's lake, on the seeds the script names (the
same seeds as the report before this). These are claims about those bots, parameters and seeds, not about
how people play. 95% intervals are Wilson intervals. The report before this is
docs/checks/balance-fish-2026-10-25.md, whose numbers are the "25 Oct" column below.

## Why it was re-measured

The 25 October numbers predate two physics fixes that reach both modes: the braking fix of 29 October
(docs/checks/balance-steer-2026-10-29.md, in `boat-move.ts`, which both modes use to sail; committed in
b1530d0) and the start-pose fix of 6 November (docs/checks/balance-start-pose-2026-11-06.md, commit
8dadf44, which changed where `party.ts` and `poach.ts` start each boat). Each of those reports re-measured
Boat Rush only. README was still publishing these two modes' 25 October numbers for code that had changed
since.

## Fishing Party 2.0 (4 bots per match: party.ts's own bots; each seat's shop habit is one of 4 strategies drawn by a seeded shuffle each match)

Next spring's tier over 300 matches: rich 0.0%, fair 100.0%, lean 0.0%, none 0.0%. The last net held in 70 (23.3%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval | 25 Oct |
|---|---|---|---|---|---|
| Big Net always | 300 | 72 | 24.0% | 19.5%–29.1% | 25.7% (77) |
| Fast Boat always | 300 | 83 | 27.7% | 22.9%–33.0% | 25.3% (76) |
| Bait always | 300 | 69 | 23.0% | 18.6%–28.1% | 22.0% (66) |
| never buy | 300 | 77 | 25.7% | 21.1%–30.9% | 28.7% (86) |

No strategy over the 40% target. The last net held in 23.3% (95% interval 18.9%–28.4%; 25 Oct: 19.3%, 58
of 300). Next spring was Fair in 100.0% both times.

## Who's Poaching 2.0 (6 bots, 1 poacher; poach.ts's own bots)

| Table | Matches | Fishers won | Rate | 95% interval | Poacher voted out on day 1 / 2 / 3 | Mean lake health at the end | 25 Oct |
|---|---|---|---|---|---|---|---|
| bots as written | 300 | 208 | 69.3% | 63.9%–74.3% | 91 / 32 / 85 | 83.9% | 67.7% (203); 91 / 23 / 89; 83.3% |
| fishers always skip | 300 | 143 | 47.7% | 42.1%–53.3% | 0 / 0 / 143 | 79.6% | 50.7% (152); 0 / 0 / 152; 79.3% |

## What this shows, and what it does not

Every 25 October win rate above, and the last net's 19.3%, falls inside today's 95% interval. (The
harness prints no interval for the day-by-day counts or the lake health, so those are not compared.) This
run therefore shows no real shift in either mode; it shows only that the published numbers were stale for
the current code. One run per side,
without a per-seed comparison, cannot say which way either fix moved these bots.

Two things did change what README says. Which shop habit wins most changed (Fast Boat always now, never buy
on 25 October), so README now quotes the best habit by name. Fishers who always skip the vote now win
47.7%, below half, where 25 October's 50.7% was just above it.

No dial was touched. Both claims still hold for these bots and seeds: no Fishing Party shop habit won over
40%, and Who's Poaching fishers who read the evidence won more often than fishers who always skip.
