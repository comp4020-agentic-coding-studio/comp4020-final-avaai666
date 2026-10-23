# Balance, Fishing Party 2.0, 2026-10-24 (bots only)

Written by `node scripts/balance.ts party`. Every match here is four bots (src/lib/modes/party.ts's own bot(), steady, keeper and greedy by seat) on a fresh room's lake, on the seeds `balance-party-1` to `-300`; only their shop habit is swapped by the script. These are claims about these bots and seeds, not about how people play. 95% intervals are Wilson intervals.

## Fishing Party 2.0 (4 bots per match: party.ts's own bots; each seat's shop habit is one of 4 strategies drawn by a seeded shuffle each match)

Next spring's tier over 300 matches: rich 0.7%, fair 99.3%, lean 0.0%, none 0.0%. The last net held in 73 (24.3%).

| Strategy | Matches it sat in | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| Big Net always | 300 | 64 | 21.3% | 17.1%–26.3% |
| Fast Boat always | 300 | 107 | 35.7% | 30.5%–41.2% |
| Bait always | 300 | 45 | 15.0% | 11.4%–19.5% |
| never buy | 300 | 86 | 28.7% | 23.8%–34.0% |

No strategy over the 40% target.
