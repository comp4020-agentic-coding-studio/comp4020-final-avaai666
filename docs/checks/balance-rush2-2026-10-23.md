# Balance, Boat Rush 2.0, 2026-10-23 (bots only)

Written by `node scripts/balance.ts rush`. Every match here is bots against bots, 4 seats, src/lib/modes/rush.ts's own bot() in one of three kinds (steady, keeper, greedy). A real room always draws seat % 3; this harness also runs whole tables of one kind (all-greedy, all-keeper, all-steady) and a seeded random mix, on the seeds `balance-rush-<table>-1` to `-300`, through makeWithOpts's script-only override (src/lib/modes/rush.ts), to measure prompt-17 step 5's three targets, which seat % 3 alone cannot (there is never an all-greedy table that way). These are claims about these bots and seeds, not about how people play. 95% intervals are Wilson intervals.

**Result: no tune tried passes all four targets. The two closest are below. The untuned code is left as committed (c442c7b..5c8b5ab); no tuning commit follows this report.**

## Untuned, 300 matches per table type

**(a) all-greedy tables end Lean or No fish in most matches:** 30 / 300 (10.0%, 95% interval 7.1%–13.9%). **Fails** (target: most, i.e. over 50%).

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 286 / 300 (95.3%, 95% interval 92.3%–97.2%). Passes.

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 106 | 26.3% | 22.2%–30.8% |
| keeper | 411 | 84 | 20.4% | 16.8%–24.6% |
| greedy | 386 | 111 | 28.8% | 24.5%–33.5% |

No kind over the 41% target. Passes.

**(d) all-keeper tables end Fair or better in most matches (guard: a tune must not simply kill every lake):** rich 84.7% + fair 14.7% = 99.4%. Passes.

**Tier distribution:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 19.3% | 70.7% | 8.7% | 1.3% |
| all-keeper | 84.7% | 14.7% | 0.3% | 0.3% |
| all-steady | 18.0% | 63.7% | 14.7% | 3.7% |
| random mix | 45.0% | 50.7% | 3.7% | 0.7% |

Untuned, (a) fails badly: all-greedy tables almost never thin the lake past Fair. Tuning is needed.

## Tunes tried (60 matches per table type each, in the order allowed by CLAUDE.md's priority: greedy cards' own catch and net-cap bonus first, then how strongly greedy weights greedy cards, then greedy's home threshold, then everyone's net/hold/cooldown)

1. **Fine Mesh's net-cap bonus and Trawl's pickup rate (+2→+5, every 0.35s→0.2s).** Blocked: both numbers are pinned exactly by port-fidelity tests from 5c8b5ab ("Wide Net and Fine Mesh each add 2 to a cast's cap", "trawl picks up a fish within 2.6 units ... about every 0.35 s"), which CLAUDE.md says not to reopen. Not run against the targets; reverted before testing.
2. **Greedy's own-card weight, 5 → 9** (`botCardWeight`'s greedy/greedy entry). All-greedy tables already pick Fine Mesh/Trawl almost every market (confirmed by inspection of 20 seeds' card lists): no measurable change. (a) 6/60 (10.0%), (b) 57/60 (95.0%) — unchanged from untuned.
3. **Greedy's home threshold, 0.95 → 0.6** (fuller trips home sooner, more trips, more young fish taken per season). (a) 7/60 (11.7%), (b) 56/60 (93.3%) — negligible change; reverted.
4. **Everyone's net radius and cast cooldown, NET_R 3.5→4.5, CAST_CD 1.0→0.7.** (a) 32/60 (53.3%), (b) 35/60 (58.3%) — **both over 50% at N=60**. Kept as the leading candidate.
5. **Stronger version of tune 4, NET_R 3.5→5.0, CAST_CD 1.0→0.65.** (a) 41/60 (68.3%), (b) 22/60 (36.7%) — (a) improves, but (b) now fails; too strong.
6. **Intermediate version, NET_R 3.5→4.7, CAST_CD 1.0→0.7.** (a) 36/60 (60.0%), (b) 26/60 (43.3%) — (b) already fails at this strength.

Tune 4 was the only one passing both (a) and (b) at N=60, so it was run at 300 (the step 5 rule: "try at most 6 tunes ... then run the best one on 300").

## Tune 4 at 300 matches (NET_R 3.5→4.5, CAST_CD 1.0→0.7)

**(a) all-greedy tables end Lean or No fish in most matches:** 148 / 300 (49.3%, 95% interval 43.7%–55.0%). **Fails** — just under "most" (over 50%); the 95% interval straddles 50%.

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 189 / 300 (63.0%, 95% interval 57.4%–68.3%). Passes.

**(c) no bot kind wins more than 41% of the random-mix matches:**

| Bot kind | Seats played | Won (incl. shared first) | Rate | 95% interval |
|---|---|---|---|---|
| steady | 403 | 105 | 26.1% | 22.0%–30.6% |
| keeper | 411 | 87 | 21.2% | 17.5%–25.4% |
| greedy | 386 | 109 | 28.2% | 24.0%–32.9% |

No kind over the 41% target. Passes.

**(d) all-keeper tables end Fair or better in most matches:** rich 42.3% + fair 33.7% = 76.0%. Passes.

**Tier distribution:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 2.0% | 48.7% | 30.3% | 19.0% |
| all-keeper | 42.3% | 33.7% | 13.7% | 10.3% |
| all-steady | 4.7% | 23.3% | 22.3% | 49.7% |
| random mix | 10.7% | 47.0% | 18.0% | 24.3% |

At N=60 this tune cleared both (a) and (b); at N=300 the larger sample pulled (a) back to 49.3%, just short of "most" (c) and (d) hold at both sample sizes.

## The next-closest tune (tune 6, NET_R 4.7, CAST_CD 0.7), for comparison at N=60

**(a):** 36/60 (60.0%). **(b):** 26/60 (43.3%) — fails.

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 0.0% | 40.0% | 36.7% | 23.3% |
| all-keeper | 40.0% | 33.3% | 13.3% | 13.3% |
| all-steady | 0.0% | 16.7% | 25.0% | 58.3% |
| random mix | 6.7% | 45.0% | 18.3% | 30.0% |

Tune 4 and tune 6 trade off against each other: every version tried that pushes (a) comfortably past 50% pulls (b) under it, because a lighter counterfactual catch (×0.8) and the real catch move together once the only levers left (net radius, cast cooldown) apply to every bot kind, not just greedy.

## What this means

No tune stayed on the right side of both (a) and (b) at 300 matches. Tune 4 is the closest: it passes (b), (c) and (d) comfortably, and (a) is within its own 95% interval of "most" (49.3%, interval 43.7%–55.0%) — a coin flip away either way on a rerun, not a clear pass. The remaining lever, per CLAUDE.md's priority order, is also "everyone's net, hold, or cooldown" (tune 4's own category); the only other untried move in that category is HOLD or LOAD_SLOW, which were not tried to stay within the 6-tune budget.

No code change is committed from this report: the tune is not kept because it does not clearly pass. Ava's call: accept tune 4 as close enough (a's own measured value is under 50% but its interval straddles it, so a fresh 300-seed run might pass), allow a 7th tune, or treat all-greedy's resistance to thinning as acceptable since Fair is still a worse outcome than keepers/mixed tables consistently get.
