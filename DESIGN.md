# Common Pool: design v0.2

## What it is

A shared pond. Fish regrow on their own. Anyone in the pond can tap to catch
one fish and keep it. You can see how your catching, and everyone else's,
changes the pond, and you work out with the people around you how to use it.

## A person

A named net in one pond, held by one browser (a cookie token, one year).
No accounts, no email. Name: 1–24 characters.
Known limit: one human can open several browsers and hold several nets. We do
not prevent this. The app is made for people who can see each other.

## The pond model

- Growth with a strong Allee threshold A:
  dS/dt = r · S · (S/A − 1) · (1 − S/K).
  In the model, a population below A shrinks toward zero even if nobody fishes.
- Parameters (v0.2, from sim/pond_sim.py): K = 300, A = 30, r = 0.2377 per
  minute. Peak regrowth G is about 90 fish/min.
- One tap catches one fish. At most one tap per net per second (60 fish/min),
  so one net at full speed (60/min) is below G, and two nets (120/min) are
  above it.
- Stock is a real number. Fish available = floor(stock). The UI shows floor.
- Design choice: when stock falls below 1 the pond is dead. A dead pond is
  read-only and never restocked. The equation only approaches zero; declaring
  death at 1 is our rule, not a result of the model.
- Stock is evaluated from the last recorded stock and the elapsed time with
  fixed-step RK4 (step = 1 second). Stored stock is never changed by a timer.

What the simulation shows (tested scenarios, not guarantees):
- From a full pond, one net at full speed did not empty it in 30 minutes.
- From a full pond, two nets at full speed emptied it in about 5 minutes.
- From a quarter-full pond, one net at full speed emptied it in under 2
  minutes. A single person can finish off a pond that others have weakened.

## Casting (v0.2)

First come, first served: a tap is settled in one database transaction when
the server receives it. The only fairness claim is: when two taps compete for
the last fish, the one that reaches the server first gets it. Every tap
carries an idempotency key, so a retried request never catches twice.

## Live state

- Every tap is broadcast to everyone in the pond right after its transaction
  commits.
- While a pond has viewers, the server also broadcasts a snapshot once per
  second: stock evaluated at that moment, fish available, who is present.
  This is how regrowth and a pond dying on its own reach the screen when
  nobody taps.
- A timer may read and broadcast. It may write exactly one thing: the
  collapse row, when evaluated stock falls below 1.
- The client never computes stock. It shows the latest snapshot.

## The ledger

Every state change is exactly one append-only row in the same transaction.
The database refuses UPDATE and DELETE on it (trigger). Row id = event id for
the live stream. Failed requests and server errors are NOT in the ledger; they
go to the server log.

## Governance (planned v0.3, crit 9)

One rule type only: a per-person catch limit per minute. Anyone proposes a
number; it passes when more than half of the people present vote yes within
60 seconds. Breaches are not blocked; they are shown in red with the facts:
who, when, how many, stock at the time.

## Not building

Chat, or any free text except a name. Accounts. Cross-pond leaderboards.
AI-generated anything. Restocking a dead pond. Async voting. Blame numbers
that claim how much one person shortened the pond's life.

## Assumptions to test

- H1 (two people): two strangers in two browsers notice within a few minutes
  that the other's catching changes what they can catch, and react to it.
- H2 (four people): with no rules, someone tries to coordinate before the pond
  dies.
- H3 (tap rates): real tap rates are close enough to the simulated ones that
  the timings above hold roughly. Check against the ledger after a playtest.

A playtest where the same group plays again after a collapse cannot show WHY
their behaviour changed (they also learned the game and each other). We report
what changed, not the cause.

## Changelog

- v0.2: parameters K=300, A=30, G≈90 so that two sessions can meet the core
  conflict (markers use two sessions). Dropped the slogan "only a room can
  empty it" (a single net can finish off a weakened pond). Death at stock < 1
  stated as a design choice. Added the once-per-second server snapshot.
- v0.1: replaced plain logistic growth (one person could empty the pond; 0.4
  fish grew back), 1-second batched tides (a fairness promise that
  contradicted itself) and four rule types (too much before any playtest).
