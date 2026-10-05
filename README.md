# Common Pool

A shared pond for people in the same room. Fish regrow on their own. Anyone can catch one at a time and keep it. Catch too fast, together, and the pond dies for good.

## What good means here

Ask an agent for "a multi-user, real-time website" and the other people become an audience: a chat room with the nouns swapped. The course's crit agents will submit that baseline too.

In Common Pool the other people are the problem. Alone, there is nothing to solve: the pond regrows faster than one person can fish it. With two or more, each person gains by catching more, and if everyone does, the pond falls below a threshold it cannot recover from. So the app is good if:

1. the dilemma is real: other people's catching visibly changes what you can catch;
2. the record is honest: every catch is public, and nothing that changes the pond happens off the record;
3. the people in the room can work out how to use it, from what is on screen and from talking to each other.

## Where this comes from

Hardin (1968) argued that a shared resource is doomed unless it is privatised or regulated from outside. Ostrom (1990) studied fisheries, forests and irrigation systems that lasted for centuries and found that their users governed them themselves, with clear boundaries, monitoring and graduated sanctions. In laboratory common-pool games, Ostrom, Walker and Gardner (1992) found that letting players talk, and letting them choose sanctions, raised what the group earned.

Shirky (2004) called software built for one group in one place "situated software": it can lean on the social context instead of rebuilding it. Sloan (2020) describes an app made for four people as a home-cooked meal. Common Pool is situated in a room. It has no chat, because the people using it can see and hear each other. The room is the conversation.

## What I chose not to build

- Chat, or any free text except a name.
- Accounts. A person is a named net held by one browser.
- Restocking: a dead pond stays dead, and stays listed.
- Leaderboards or blame numbers.

## Enforced and judged

Enforced: a check in `spec/` fails if it breaks.

- In a 30-minute run, one net at full speed cannot empty a full pond; two can (`spec/unit/pond.test.ts`).
- Below 30 fish the pond dies on its own, and a dead pond never regrows.
- Every catch is one public ledger row; the database refuses edits and deletions (`spec/unit/store.test.ts`).
- A repeated request never catches twice.
- A catch reaches another open page within a second on a local run (`spec/pond-app.test.ts`).
- Ponds and catches survive reopening the database.

Judged: no check can say.

- Whether people notice each other's effect, and talk.
- Whether a dead pond feels like a loss.
- Whether the page reads in ten seconds.

## Known limits

- The app sees nets, not people: one person with two browsers holds two nets.
- Casting needs JavaScript; viewing and joining do not.
- If the machine itself crashes, the last second of catches can be lost (`docs/decisions/0002-durability.md`).

## References

- Hardin, G. (1968). The Tragedy of the Commons. *Science*, 162(3859), 1243–1248.
- Ostrom, E. (1990). *Governing the Commons*. Cambridge University Press.
- Ostrom, E., Walker, J., & Gardner, R. (1992). Covenants with and without a sword: Self-governance is possible. *American Political Science Review*, 86(2), 404–417.
- Shirky, C. (2004). Situated Software.
- Sloan, R. (2020). An app can be a home-cooked meal.
