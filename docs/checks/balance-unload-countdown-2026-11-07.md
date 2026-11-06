# The unloading countdown running while away, measured (2026-11-07)

Measured with `BALANCE_SET='{}' node scripts/balance.ts rush 300`, before and after this change. Every
match is bots against bots on `rush.ts`'s own `bot()`, 4 seats, in one of three kinds (steady, keeper,
greedy), on a fresh room's lake, on the seeds the script names. These are claims about those bots,
parameters and seeds, not about how people play. 95% intervals are Wilson intervals. The report before
this is docs/checks/balance-hull-2026-11-06.md, whose numbers are the "before" row below.

## What Ava found

With v5.14's ring and `DOCK_R` already made to agree (a boat's hull reaches the ring's drawn edge at the
same moment its centre crosses `DOCK_R`), Ava still saw a delay before the first fish banked on a real
trip home: "the stern has to be inside too." The cause was `unloadT`, the per-fish countdown: `moveBoats()`
only decremented it while `b.docked` was true. A boat that had been away on a trip (seconds, well over
`UNLOAD_EVERY` = 0.32 s) still had its countdown sitting wherever the *previous* trip's unloading had left
it — up to a full `UNLOAD_EVERY` — because nothing ran it down while the boat was away. So a boat could
dock with a stale countdown and wait up to another 0.32 s before the first fish banked, instead of banking
on the very tick its hull reached the ring, as the picture promises.

## The fix

`b.unloadT` now counts down whenever it is above zero, docked or not (it is left to rest at zero rather
than going negative). On any trip of meaningful length this zeroes the leftover countdown long before the
boat gets home, so the first fish of a trip now banks on the very tick `b.docked` turns true. The
bobbing-fix behaviour from rule change 13's follow-up is unchanged: `unloadT` is never reset to a fresh
`UNLOAD_EVERY` on a docked transition, so a boat crossing the edge repeatedly still only unloads one fish
per `UNLOAD_EVERY` of real time, never faster.

Two tests cover this (`spec/unit/rush.test.ts`): a boat back from a real trip (away well over
`UNLOAD_EVERY`, with a stale countdown from its last trip) banks its first fish the instant it docks; and a
boat crossing the home edge repeatedly still banks no faster than one fish per `UNLOAD_EVERY`.

## Measured: balance barely moves

The only effect on the sim is removing the wait before the first fish of each trip — about 0.16 s on
average (half of `UNLOAD_EVERY`) — so targets (a) and (b) were expected to move only slightly, from bots
reaching home with their catch infinitesimally sooner across a match.

| | (a) all-greedy Lean/None | (b) all-greedy counterfactual Fair+ |
|---|---|---|
| Before (docs/checks/balance-hull-2026-11-06.md, same seeds) | 68.7% (206/300, 63.2%–73.7%) | 66.0% (198/300, 60.5%–71.1%) |
| After this change | 65.0% (195/300, 59.4%–70.2%) | 72.3% (217/300, 67.0%–77.1%) |

Both move only a few points, within a 300-match run's own noise, and both stay well clear of the 55%
revert threshold and of their own "most" wording. `UNLOAD_EVERY` is not touched.

Worth flagging: (a) moved down and (b) moved up, the opposite of what the mechanism itself predicts —
removing a wait gives every boat strictly more fishing time per trip, which should take more fish and push
the lake toward emptier, i.e. (a) up and (b) down, not the reverse. The same seed does not buy a paired
comparison here: the fix changes exactly when a boat's first fish of a trip banks, which perturbs that
match's trajectory from its first docking onward, so "seed 7 before" and "seed 7 after" are no longer
comparable runs of the same match — they diverge early and end up different matches that merely started
from the same draw. The two 300-match runs are therefore better read as independent samples from the seed
space, which is exactly what their Wilson intervals already describe, and those intervals overlap on both
targets (63.2%–73.7% vs. 59.4%–70.2% for (a); 60.5%–71.1% vs. 67.0%–77.1% for (b)). The three targets'
margins are what was checked, not the sign of the movement.

(c), the no-kind-over-41% target, is unaffected: steady 24.3%, keeper 26.3%, greedy 24.4% (vs. 24.3% /
27.0% / 24.4% before) — the same kinds, same seeds, no bot-kind advantage introduced.
