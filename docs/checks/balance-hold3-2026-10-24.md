# Balance of Lake Holdings 3.0, Monopoly on the water (2026-10-24, bots only)

Measured with `BALANCE_SET='{}' node scripts/balance.ts hold 300` on the holdings 3.0 code (rule
change 12): four bots a match on the four-boat lake, the room's start (224 adults, 56 young), seeds
`balance-hold-<table>-1` to `-300`. Every match is bots against bots on hold.ts's own bot() code;
in the random mix the script picks each seat's kind from the seed (a real room keeps seat % 3).
These are claims about these bots, parameters and seeds, not about how people play. 95% intervals
are Wilson intervals. holdings 2.0's report is docs/checks/balance-hold2-2026-10-24.md.

## What was tried on the way (smaller runs, same harness and seeds)

| Run | Numbers | all-greedy tables | greedy wins (random mix) |
|---|---|---|---|
| H1 (40 a table) | nets haul 4 after a round, a net hauls 6 when you land; you may build before you roll | 92.5% rich, mean next spring 238 | 60.4% |
| H2 (30) | nets haul 6 after a round, 8 when you land | 13.3% rich, 80.0% fair, 6.7% lean | 54.5% |
| H3 (30) | nets haul 8 after a round, a plain haul takes 4 | 6.7% rich, 80.0% fair, 6.7% lean, 6.7% died | 54.5% |
| H4 (30) | H2, and fish on your grounds count 1 each at the end | as H2 | 51.5% |

In H1 to H4 the greedy bot won by owning more grounds and coins: the keeper bot kept 3 coins back
before buying and had almost no income (about 5 coins and 1.5 grounds at the end, in a probe of
60 random-mix matches). Two changes followed: a pond pays its owner 2 coins a round, and every bot
buys while it keeps a coin (greedy: keeps nothing). With those and H4's fish points (100 a
table): greedy 29.0%, steady 26.1%, keeper 21.0%; all-greedy tables ended Fair in 75.0%.

## The numbers kept (300 a table)

**Next spring, by table:**

| Table | rich | fair | lean | none | Mean next spring | Lake died |
|---|---|---|---|---|---|---|
| all-greedy | 20.0% | 77.0% | 3.0% | 0.0% | 177 | 0.0% |
| all-keeper | 100.0% | 0.0% | 0.0% | 0.0% | 327 | 0.0% |
| all-steady | 100.0% | 0.0% | 0.0% | 0.0% | 290 | 0.0% |
| random mix | 96.0% | 3.7% | 0.3% | 0.0% | 275 | 0.0% |

**Who wins a random-mix table (incl. shared first):**

| Bot kind | Seats played | Won | Rate | 95% interval |
|---|---|---|---|---|
| steady | 430 | 118 | 27.4% | 23.4%–31.8% |
| keeper | 395 | 90 | 22.8% | 18.9%–27.2% |
| greedy | 375 | 96 | 25.6% | 21.4%–30.2% |

(1200 matches in 29 s on 1 workers)

What this says about these bots: no kind wins more than 41% of random-mix tables. All-greedy
tables leave the lake Fair in 77.0% and Lean in 3.0% (none died), against Bountiful in every
all-keeper table; greed costs the whole table its multiplier (1.2 down to 1), and the lake
never died in these runs. A dead lake is reachable only by more hauling than these bots do.
