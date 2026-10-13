# Next Year, No Fish

A fishing game for the people at one table. Each player is a family on one
shared lake. The fish school, pair up and spawn in spring; their fry grow up
over winter. Throw your net, fill your basket, build your house. A fine-mesh
net catches more, fry included. Five years, about four minutes, and then
what the lake will hold next year.

## What good means here

Here the other people are not an audience but the problem: this is an
explainer of the tragedy of the commons that you play. It is good if:

1. **The dilemma is real and visible.** Other families' nets change what
   yours can catch, and you see why: a school someone reached first, fry
   slipping through your mesh, fish too few to meet in spring.
2. **The record is honest.** Every throw and haul is a public ledger row the
   database will not change. One fish is caught once. After a season its
   secret is revealed and anyone can replay it.
3. **A table can play in two minutes, and argue.** Every word that carries
   meaning is English. No chat: the players sit together. On screen they can
   stamp a seal on each other and make one kind of promise.
4. **It does not preach.** The goal on the first screen is your own house.
   The lake, not the game, says greed was costly.

## Where this comes from

Hardin (1968) said a shared resource is doomed without privatisation or
outside rule. Ostrom (1990) found commons that lasted centuries because their
users made, watched and enforced their own rules; Ostrom, Walker and Gardner
(1992) found that promises help, and promises with a way to answer cheaters
help more. The promise and the seals are those two layers. The village's three
rules are older still: no fine nets (Mencius), no fishing while fish spawn and
spare the fry (Li Ge, in the Guoyu). The title is the Lüshi Chunqiu's: drain
the lake for the fish, and next year there are no fish. The game leans on the
room for the talking, as situated software does (Shirky 2004).

## What I chose not to build

Chat or free text beyond a name. Accounts. Leaderboards. Blame numbers.
Restocking a dead lake.

## Enforced and judged

Enforced, by checks that fail if it breaks:

- For the strategies in `sim/`, a fine net pays the first three families to
  switch, and all four switching ruins the table (`spec/unit/dilemma.test.ts`).
- Each rule, kept from year 2, saves a lake two fine nets kill
  (`spec/unit/rules.test.ts`).
- Two nets on one fish: the first thrown takes it, and the other is told who
  (`spec/unit/lake-runner.test.ts`, `docs/decisions/0003-two-nets-one-fish.md`).
- Replaying a ledger gives back every haul; the secret is in no row before
  the end (`spec/unit/lake-runner.test.ts`).
- The ledger refuses edits and deletions (`spec/unit/lake-store.test.ts`).
- A throw reaches another open page within a second (`spec/lake-app.test.ts`).

Judged, by playing with people: whether newcomers throw at a school untold;
whether they talk about each other's nets and ask for promises; whether they
want another game.

## Known limits

The bots follow scripts; they show what the rules allow, not how people
behave. A slow connection loses ties for the same fish.

## References

- Hardin, G. (1968). The tragedy of the commons. *Science* 162(3859).
- Ostrom, E. (1990). *Governing the Commons*. Cambridge UP.
- Ostrom, E., Walker, J. & Gardner, R. (1992). Covenants with and without a sword. *APSR* 86(2).
- Shirky, C. (2004). Situated software.
- *Guoyu*, "Lu Yu I"; *Mencius*, "Liang Hui Wang I"; *Lüshi Chunqiu*, "Yi Shang".
