# The ring, the hull, and a sim change measured and reverted (2026-11-06)

Measured with `BALANCE_SET='{}' node scripts/balance.ts rush 300` and
`BALANCE_SET='{"RUSH":{"UNLOAD_EVERY":0.32}}' node scripts/balance.ts rush 300` (the two are the same table
at the dial's current, unchanged value). Every match is bots against bots on `rush.ts`'s own `bot()`, 4
seats, in one of three kinds (steady, keeper, greedy), on a fresh room's lake, on the seeds the script
names. These are claims about those bots, parameters and seeds, not about how people play. 95% intervals
are Wilson intervals. The report before this is docs/checks/balance-start-pose-2026-11-06.md, whose numbers
this one does not change.

## What Ava found

Even after the ring's own drawing bug was fixed (22c453f: its outer edge lands exactly on `DOCK_R`, not
1.4 units past it), Ava reported she still had to push her boat further in than the ring — "only this far
in will it put the fish down — touching the outer edge of the ring does nothing" — before unloading started.

The cause: `moveBoats()` (`src/lib/modes/rush.ts`) tests `b.docked` against the boat's **centre**:
`Math.hypot(b.x - d.x, b.y - d.y) < Q.DOCK_R`. But the ring is a picture that promises "any part of the
boat inside this circle." A boat's hull (`world5.js`'s `hullShape`) reaches 3.1 units ahead of its centre
at the bow — so a boat whose bow is touching the ring still has its centre 3.1 units short of `DOCK_R`, and
nothing happens until she pushes the extra distance, landing her at the plank.

## The first fix, measured and reverted: moving the sim's own boundary

The faithful fix to the rule, matching the ring's own promise, is to test the boat's hull against `DOCK_R`
instead of its centre: `b.docked = Math.hypot(...) < Q.DOCK_R + HULL_FWD` (`HULL_FWD = 3.1`, named once in
`src/lib/modes/boat-move.ts`, matching `world5.js`'s hull geometry). This makes the effective docked radius
9.6 instead of 6.5 — a large jump, since `HULL_FWD` is nearly half of `DOCK_R` itself.

Measured with this change in place, `UNLOAD_EVERY` still at 0.32:

**(a) all-greedy tables end Lean or No fish in most matches:** 300 / 300 (100.0%, 95% interval 98.7%–100.0%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 6 / 300 (2.0%, 95% interval 0.9%–4.3%).

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 98 | 24.3% | 20.4%–28.7% |
| keeper | 411 | 108 | 26.3% | 22.3%–30.7% |
| greedy | 386 | 94 | 24.4% | 20.3%–28.9% |

**Tier distribution, by table type:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 0.0% | 0.0% | 8.0% | 92.0% |
| all-keeper | 0.0% | 1.7% | 50.3% | 48.0% |
| all-steady | 0.0% | 1.0% | 30.7% | 68.3% |
| random mix | 0.0% | 0.3% | 20.0% | 79.7% |

(a) rose to 100.0% and (b) collapsed to 2.0% — nowhere near its own "most" wording, and nowhere near the
55% floor this change was to be judged against. The tier table shows why: 92% of all-greedy tables end with
the lake completely fished out ("none" tier), against 13.0% at the unchanged sim (below). A boat able to
unload from 9.6 units out, nearly half again further than 6.5, spends far less of a season's time sailing
to and from its dock, and the lake pays for it directly.

`UNLOAD_EVERY` was not touched to try to recover this: Ava has already spent two sweeps tuning that dial
(29 October and 6 November's start-pose fix), and a jump of this size is not something the dial alone can
absorb without moving it far from where both prior sweeps put it for good reason.

## The fix that was kept: the ring is drawn smaller, not the sim changed

`b.docked` is reverted to exactly its original form — `Math.hypot(b.x - d.x, b.y - d.y) < Q.DOCK_R`, no
`HULL_FWD` in the sim at all. Instead, the ring (`world5.js`'s `setHome`, drawn by `rush.js`) is drawn at
`DOCK_R - HULL_FWD` instead of `DOCK_R`: the gold band's outer edge now sits 3.1 units inside where it did
before. Because a boat's hull reaches `HULL_FWD` ahead of its own centre, the hull crosses this smaller
ring at the exact moment the boat's centre crosses `DOCK_R` — which is exactly when the unchanged sim
starts unloading it. The picture and the rule now agree, at zero cost to the sim: nothing in `rush.ts`'s
own math changed from before this investigation.

`HULL_FWD` is sent to the page once, in `rushPractice.hullFwd` (`src/play-pages.ts`'s boot JSON), the same
pattern `DOCK_R` itself already used — the number is named once, in `boat-move.ts`, and typed nowhere else.

A new test (`spec/unit/rush.test.ts`, "a boat sailing straight at its dock starts unloading at the same
moment its hull crosses the ring the page draws") checks this equivalence directly, on a two-boat and a
four-boat lake, against the unmodified sim.

## Balance: confirmed unchanged

Re-measured with the ring-shrink fix (the sim unchanged) in place:

**(a) all-greedy tables end Lean or No fish in most matches:** 206 / 300 (68.7%, 95% interval 63.2%–73.7%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 198 / 300 (66.0%, 95% interval 60.5%–71.1%).

**(c) keeper's win rate:** 27.0%, no kind over 41%.

Identical to docs/checks/balance-start-pose-2026-11-06.md's own published numbers — as it must be, since
`moveBoats()`'s own arithmetic is byte-for-byte what it was before this investigation began. The circle
drawn on the water is smaller now, on purpose: it marks where the boat's hull must reach, not where its
centre must be, and that is a smaller circle than the one that promised more than the sim could keep.
