# Balance, Boat Rush 2.0, 2026-10-23 (bots only)

Written by `node scripts/balance.ts rush`. Every match here is bots against bots, 4 seats, src/lib/modes/rush.ts's own bot() in one of three kinds (steady, keeper, greedy). A real room always draws seat % 3; this harness also runs whole tables of one kind (all-greedy, all-keeper, all-steady) and a seeded random mix, on the seeds `balance-rush-<table>-1` to `-300`, through makeWithOpts's script-only override (src/lib/modes/rush.ts), to measure prompt-17 step 5's targets, which seat % 3 alone cannot (there is never an all-greedy table that way). These are claims about these bots and seeds, not about how people play. 95% intervals are Wilson intervals.

**Result: rule change 7 (Ava, 23 Oct) applies tune 4 — net radius 3.5 → 4.5, cast cooldown 1.0 s → 0.7 s — in src/lib/game-constants.ts's RUSH, and restates target (a) and adds target (e) below. No further matches were run to fish for a pass; the numbers are the ones already measured.**

## Untuned, 300 matches per table type (before rule change 7)

**(a, original wording) all-greedy tables end Lean or No fish in most matches:** 30 / 300 (10.0%, 95% interval 7.1%–13.9%). Fails outright.

**(b) all-greedy's counterfactual (the year replayed at 80% of the catch) is Fair or better in most:** 286 / 300 (95.3%, 95% interval 92.3%–97.2%). Passes.

**(c) no bot kind wins more than 41% of the random-mix matches:** steady 26.3%, keeper 20.4%, greedy 28.8% (all well under 41%). Passes.

**(d) all-keeper tables end Fair or better in most matches:** rich 84.7% + fair 14.7% = 99.4%. Passes.

**Tier distribution:**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 19.3% | 70.7% | 8.7% | 1.3% |
| all-keeper | 84.7% | 14.7% | 0.3% | 0.3% |
| all-steady | 18.0% | 63.7% | 14.7% | 3.7% |
| random mix | 45.0% | 50.7% | 3.7% | 0.7% |

Untuned, all-greedy tables almost never thinned the lake past Fair. Tuning was needed.

## Tunes tried (60 matches per table type each, in the priority order CLAUDE.md sets: the greedy cards' own catch and net-cap bonus first, then how strongly greedy weights greedy cards, then greedy's home threshold, then everyone's net/hold/cooldown)

1. **Fine Mesh's net-cap bonus and Trawl's pickup rate (+2→+5, every 0.35s→0.2s).** Blocked: both numbers are pinned exactly by port-fidelity tests from 5c8b5ab ("Wide Net and Fine Mesh each add 2 to a cast's cap", "trawl picks up a fish within 2.6 units ... about every 0.35 s"), which CLAUDE.md says not to reopen. Not run against the targets; reverted before testing.
2. **Greedy's own-card weight, 5 → 9** (`botCardWeight`'s greedy/greedy entry). All-greedy tables already pick Fine Mesh/Trawl almost every market (confirmed by inspection of 20 seeds' card lists): no measurable change. (a) 6/60 (10.0%), (b) 57/60 (95.0%) — unchanged from untuned.
3. **Greedy's home threshold, 0.95 → 0.6** (fuller trips home sooner, more trips, more young fish taken per season). (a) 7/60 (11.7%), (b) 56/60 (93.3%) — negligible change; reverted.
4. **Everyone's net radius and cast cooldown, NET_R 3.5→4.5, CAST_CD 1.0→0.7.** (a) 32/60 (53.3%), (b) 35/60 (58.3%) — both over 50% at N=60. Kept as the leading candidate.
5. **Stronger version of tune 4, NET_R 3.5→5.0, CAST_CD 1.0→0.65.** (a) 41/60 (68.3%), (b) 22/60 (36.7%) — (a) improves, but (b) now fails; too strong.
6. **Intermediate version, NET_R 3.5→4.7, CAST_CD 1.0→0.7.** (a) 36/60 (60.0%), (b) 26/60 (43.3%) — (b) already fails at this strength.

Tune 4 was the only one passing both (a) and (b) at N=60, so it was run at 300 (the step 5 rule: "try at most 6 tunes ... then run the best one on 300").

## Tune 4 at 300 matches — now RULE CHANGE 7, applied in game-constants.ts

**Ava's decision, 23 Oct:** target (a)'s original wording ("most") cannot be told apart from the measured 49.3% at this sample size. Restated:

- **(a), restated:** about half or more of all-greedy tables end Lean or No fish. **Measured: 148 / 300 (49.3%, 95% interval 43.7%–55.0%). Meets the restated target.**
- **(b) all-greedy's counterfactual (80% of the catch) is Fair or better in most:** 189 / 300 (63.0%, 95% interval 57.4%–68.3%). Passes.
- **(c) no bot kind wins more than 41% of the random-mix matches:** steady 26.1%, keeper 21.2%, greedy 28.2% (all well under 41%). Passes.
- **(d) all-keeper tables end Fair or better in most matches:** rich 42.3% + fair 33.7% = 76.0%. Passes.
- **(e), the theme check (Ava, 23 Oct): all-keeper tables end Fair or better clearly more often than all-greedy and all-steady tables.** Measured: all-keeper 76.0%, all-greedy 50.7% (fair 48.7% + rich 2.0%), all-steady 28.0% (fair 23.3% + rich 4.7%). **Passes: keeper tables clear fair-or-better at roughly 1.5x the rate of greedy tables and 2.7x the rate of steady tables.**

**Tier distribution (rule change 7, 300 matches per table type):**

| Table | rich | fair | lean | none |
|---|---|---|---|---|
| all-greedy | 2.0% | 48.7% | 30.3% | 19.0% |
| all-keeper | 42.3% | 33.7% | 13.7% | 10.3% |
| all-steady | 4.7% | 23.3% | 22.3% | 49.7% |
| random mix | 10.7% | 47.0% | 18.0% | 24.3% |

## The next-closest tune (tune 6, NET_R 4.7, CAST_CD 0.7), for comparison, not applied

At N=60: (a) 36/60 (60.0%), (b) 26/60 (43.3%) — fails (b). Tune 4 and tune 6 trade off against each other: every version tried that pushes (a) further past 50% pulls (b) under it, because a lighter counterfactual catch (×0.8) and the real catch move together once the only levers left (net radius, cast cooldown) apply to every bot kind, not just greedy. Tune 4 sits closest to both targets at once.

## Known limits

- All-steady thins the lake more than all-greedy (none: 49.7% vs 19.0%), because the greedy bot goes home only at 95% full and so makes fewer trips than steady does (DESIGN's bot thresholds: greedy 0.95, keeper 0.6, steady 0.75). "Greedy" and "steady" are bot labels for this harness's own strategies, not a claim about how a careless or careful person plays.
- Bots are not people: this whole report is bots against bots on fixed seeds. The 28 October group playtest will record each match's tier, and that is the real check on whether the tiers people reach look like this table.

## What changed

**Rule change 7 (Ava, 23 Oct 2026):** src/lib/game-constants.ts's RUSH.NET_R 3.5 → 4.5, RUSH.CAST_CD 1.0 → 0.7. DESIGN.md's Boat Rush numbers and changelog updated to v5.0.1 in the same commit. No test pinned the old literal values (RUSH.NET_R and RUSH.CAST_CD are referenced symbolically throughout spec/unit/rush.test.ts and spec/play-rush-app.test.ts), so no test needed to change.
