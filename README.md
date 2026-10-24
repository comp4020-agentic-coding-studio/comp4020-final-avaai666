# Next Year, No Fish

One lake. Everyone fishes it. What you take today, someone else can't catch
tomorrow. Open a room, send the link, pick one of four games. The room's lake
remembers what the last game left.

## What good means here

A commons is a dilemma only when someone else fishes the same water, so the
game should be better because others play at once. It is good if:

1. **You feel the dilemma within a minute, in every game.** Each asks one
   question born of sharing the lake: one more cast or home now
   (Boat Rush); grab now or leave fish for the double round (Fishing Party);
   who do you believe (Who's Poaching); haul your ground now or let it breed
   (Lake Holdings). Greed costs you through other players, never a random
   storm.
2. **No one can cheat or peek.** The server decides every catch, coin and
   vote, and sends each seat only what it may see.
3. **No single move wins**, or nobody needs to think about others.
4. **It reads at a glance, in English or Chinese**: one goal and one choice
   per game.
5. **The lake outlives the match**, through restarts and a day away.

## Where this comes from

Hardin (1968) called a shared resource doomed; Ostrom (1990) showed commons
that lasted because users watched and punished each other. Fehr and Gächter
(2000) found people pay to punish free riders: Who's Poaching is the
inspection, the buoy and the vote. Milinski et al. (2008) showed groups
failing to prevent a shared loss; Last Net is that experiment in one round.
Salen and Zimmerman (2004) ask for discernible, integrated outcomes: one
stated choice, visible feedback. The title is the Lüshi
Chunqiu's: drain the lake for fish, and next year there are no fish.

## What I chose not to build

Chat (players talk aloud), accounts, cross-room leaderboards, restocking a
dead lake, AI-generated content at run time.

## Enforced and judged

Enforced, by checks that fail if the claim breaks:

- Each seat's frames and events hold only what it may see, and a match
  replays from its stored inputs (`spec/unit/game-platform.test.ts`).
- No fisher is sent another's role before its reveal
  (`spec/unit/poach.test.ts`).
- The room's lake carries over and dies below 40
  (`spec/unit/game-platform.test.ts`).
- Two sessions with no shared cookies join one room over HTTP: the first sees
  the second arrive and act within a second, the room's history survives a
  restart, and each can use its own language (`spec/marker-path.test.ts`).
- Both dictionaries have the same keys (`spec/unit/i18n.test.ts`), and every
  page of the current site renders in both languages
  (`spec/unit/site-pages.test.ts`).

Measured, not enforced, in 300 bot matches per table (the 2.0 modes, each
match on the lake for its boats with the homes round it, rule change 11:
`docs/checks/balance-lake11-2026-10-24.md`; the earlier reports are named
there, the v4 numbers stay in `docs/checks/balance-2026-10-15.md`). These are
claims about the modes' own bots and seeds, not about people:
- Boat Rush, four boats: no bot kind won over 41% of random-mix tables
  (keeper 26.3%); all-greedy tables ended Lean or No fish in 70.3%, and
  replayed at 80% of their catch ended Fair or better in 65.0%. With two or
  three boats (60 matches) the lake was not fished down.
- Fishing Party, four boats: no shop habit won over 40% (never buy 29.0%);
  the last net held in 19.0%.
- Who's Poaching, six boats: fishers won 68.3%, and 50.3% if they always skip
  the vote.
- Lake Holdings 3.0 (`docs/checks/balance-hold3-2026-10-24.md`): no bot kind
  won over 41% of random-mix tables (steady 27.4%); all-greedy tables ended
  Fair in 77.0%, all-keeper tables Bountiful in 100%.

Judged, by watching people: whether they name the choice untold, change plans
for others, and want a rematch.

## Known limits

Your boat moves on the server's next frame: slow connections feel late.
Who's Poaching needs four people.

## References

- Fehr, E. & Gächter, S. (2000). Cooperation and punishment in public goods experiments. *American Economic Review* 90(4).
- Hardin, G. (1968). The tragedy of the commons. *Science* 162(3859).
- Milinski, M. et al. (2008). The collective-risk social dilemma and the prevention of simulated dangerous climate change. *PNAS* 105(7).
- Ostrom, E. (1990). *Governing the Commons*. Cambridge UP.
- Salen, K. & Zimmerman, E. (2004). *Rules of Play*. MIT Press.
- *Lüshi Chunqiu*, "Yi Shang".
