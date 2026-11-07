# Next Year, No Fish

One shared lake: what you take today, someone else can't catch tomorrow.

## Start here

No sign-up, no install. One of you opens a room and sends the link; the other
opens it in a second Chrome profile and joins. Pick a game and press Start —
two people are enough for three of them, and Who's Poaching seats four, so
leave "bots fill empty seats" ticked. Both screens move together. Reopen the
room link later: the lake is where you left it.

## What good means here

A commons is a dilemma only when others fish too, so playing together should
make it better. Good means:

1. **Every game's dilemma is felt within a minute**: one more cast or home
   (Boat Rush); grab now or leave fish for the double round (Fishing Party);
   whom to believe (Who's Poaching); haul or let it breed (Lake Holdings).
   Greed costs you through others, not luck.
2. **No one can cheat or peek.** The server decides every catch, coin and
   vote, and sends each seat only what it may see.
3. **No single move wins**, or nobody need think about others.
4. **It reads at a glance, in English or Chinese**: one goal, one choice per
   game.
5. **The lake outlives the match**, restarts and a day away.

## Where this comes from

Hardin (1968) called commons doomed; Ostrom (1990) saw them last where users
policed each other. Fehr and Gächter (2000): people pay to punish free riders
(the buoy and the vote). Milinski et al. (2008): groups fail to avert a shared
loss. Salen and Zimmerman (2004): outcomes must be discernible. The title is
the Lüshi Chunqiu's: drain the lake, and next year there are no fish.

## Not built

Chat (talk aloud), accounts, cross-room leaderboards, restocking a dead lake,
run-time AI content.

## Enforced and judged

Enforced, by checks that fail if broken:

- A seat's frames and events hold only what it may see; matches replay from
  inputs (`spec/unit/game-platform.test.ts`).
- No fisher gets another's role before its reveal (`spec/unit/poach.test.ts`).
- A lake carries over and dies below 40 (`spec/unit/game-platform.test.ts`).
- Two cookie-separate sessions join a room over HTTP; the first sees the
  second act within a second; history survives a restart; each can
  use its own language (`spec/marker-path.test.ts`).
- Both dictionaries share keys (`spec/unit/i18n.test.ts`); every current page
  renders in both languages (`spec/unit/site-pages.test.ts`).

Measured, not enforced (300 bot matches per table, lake sized to boats; Boat Rush from `docs/checks/balance-unload-countdown-2026-11-07.md`,
Party and Poaching from `docs/checks/balance-party-poach-2026-11-08.md`). About bots and seeds, not people:

- Boat Rush, four boats: no bot kind won over 41% of random-mix tables (keeper
  26.3%); all-greedy ended Lean or No fish in 65.0%; at 80% of their catch,
  Fair or better in 72.3%.
- Fishing Party, four boats: no shop habit won over 40% (the best, Fast Boat
  always, 27.7%); last net held 23.3%.
- Who's Poaching, six boats: fishers won 69.3%; 47.7% always skipping votes.
- Lake Holdings 3.0 (`docs/checks/balance-hold3-2026-10-24.md`): no bot kind
  won over 41% (steady 27.4%); all-greedy ended Fair in 77.0%, all-keeper
  Bountiful in 100%.

Judged by watching: do people name the choice untold, adapt to others, want a
rematch?

## Known limits

Boats move on the server's next frame; slow links feel late.

## References

- Fehr & Gächter (2000). Cooperation and punishment in public goods
  experiments.
- Hardin (1968). The tragedy of the commons.
- Milinski et al. (2008). The collective-risk social dilemma and the
  prevention of simulated dangerous climate change.
- Ostrom (1990). *Governing the Commons*.
- Salen & Zimmerman (2004). *Rules of Play*.
- *Lüshi Chunqiu*, "Yi Shang".
