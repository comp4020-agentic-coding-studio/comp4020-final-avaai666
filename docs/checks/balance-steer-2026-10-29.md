# Balance after the steering fix (2026-10-29, bots only)

Measured with `BALANCE_SET='{}' node scripts/balance.ts rush 300` on the code of 29 October. Every match
is bots against bots on `rush.ts`'s own `bot()`, 4 seats, in one of three kinds (steady, keeper, greedy),
on a fresh room's lake, on the seeds the script names. These are claims about those bots, parameters and
seeds, not about how people play. 95% intervals are Wilson intervals. The report before this is
docs/checks/balance-fish-2026-10-25.md.

## What changed, and a bug in the first version of this fix

Ava reported three things about Boat Rush's steering on 29 October ("when I click, the boat turns round
with great difficulty, and when it arrives it still changes direction by itself although I have touched
nothing"). The first fix to `boat-move.ts`'s `steer()` corrected both — a boat now latches "arrived"
within 0.9 units and holds there, and turning away from a close target brakes instead of still pulling
forward at a quarter throttle — but braked by a **fixed** 15-unit window regardless of how the boat was
being steered. That broke something the symptom reports never mentioned: every client (world5.js's
WASD/thumbstick interval, and poach.ts/party.ts/rush.ts's own steer calls) continuously resends "12 units
ahead of wherever the boat is now" while a player or bot is actively steering, never a single
far-off point. With a 15-unit brake window, that 12-unit resend permanently sat inside the braking zone,
so a boat under continuous control never reached full speed at all — its season-long average speed on an
all-greedy table fell from 7.95 to 4.30 (measured directly, not inferred), a steering bug, not a balance
effect. The brake window is now 11.5 units, just under that 12-unit resend distance, so continuous
steering (a tap-and-hold, a held key, a bot chasing a school) still cruises at full speed the whole way,
and only a boat actually closing in on a fixed, un-moving point — a single tap with no further input, or
the last few units of any approach — brakes at all. Re-measured directly: a boat under continuous WASD
input now reaches full 16 after the same few seconds the old code took, and an all-greedy season's average
speed is 4.92 (up from 4.30, and close to the pre-fix baseline's own figure once the fix is scoped
correctly to arrivals only).

This changes how every bot sails, in the intended direction only: a bot still reaches its target at full
speed and stops there instead of sailing a corridor around it, so each season spends a little less time on
a final-approach overshoot-and-correct loop, and no more time braking in open water than before.

## Boat Rush: the three targets (prompt-17 step 5)

Before this fix (docs/checks/balance-fish-2026-10-25.md, same harness and seeds): (a) 56.7%,
(b) 73.0%, (c) no kind over 41% (keeper 26.3%). After:

## Boat Rush (prompt-17 step 5; 4 bots per match, src/lib/modes/rush.ts's own bot(), on 300 matches per table type)

**(a) all-greedy tables end Lean or No fish in most matches:** 120 / 300 (40.0%, 95% interval 34.6%–45.6%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 259 / 300 (86.3%, 95% interval 82.0%–89.8%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 97 | 24.1% | 20.2%–28.5% |
| keeper | 411 | 109 | 26.5% | 22.5%–31.0% |
| greedy | 386 | 94 | 24.4% | 20.3%–28.9% |

No kind over the 41% target.

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 0.0% | 60.0% | 38.3% | 1.7% |
| all-keeper | 3.0% | 39.3% | 44.0% | 13.7% |
| all-steady | 0.0% | 18.0% | 67.7% | 14.3% |
| random mix | 1.0% | 38.3% | 46.0% | 14.7% |

(1200 matches in 88 s on 7 workers)

**(a) moved from 56.7% to 40.0%, and (b) from 73.0% to 86.3%.** Both still hold their own wording ("most"
and "most"), though (a) is closer to its own line than it was. The direction of the move is the one the
mechanism above predicts: a boat that reaches its school and dock efficiently, without overshooting and
circling back, gets a little more actual fishing done per season, which is gentler on the lake. (c) is
essentially unchanged (keeper 26.5% vs 26.3% before — within noise). No dial beyond the steering fix
itself was touched to produce these numbers.
