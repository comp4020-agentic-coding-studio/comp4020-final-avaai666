# Next Year, No Fish (明年无鱼): design v1.0

> 竭泽而渔，岂不获得？而明年无鱼。 Drain the lake to catch the fish, and of
> course you catch them; but next year there are no fish. (Lüshi Chunqiu, "Yi
> Shang", c. 239 BC)

## What it is

A fishing game for a table of people. Each player is a family on the shore of
one shared lake. Tap the water to cast; every fish you land is yours and builds
your house. At any time a family can pay 20 fish for a fine-mesh net, which
lands more than twice as many. After six short years, the game shows what the
table did to the lake and why.

It is an explainer of the tragedy of the commons that people play rather than
read. The dilemma is not scripted: it comes out of the lake's ecology and the
nets (see "Why it is a dilemma").

## A season

- A season is one game on one lake. Someone opens a lake; it gets a short code
  and its own URL. Others join by the URL or the code. A family is a name held
  by one browser (a cookie per lake). Two to six families.
- When the season starts, families are fixed. If there are fewer than four
  people, bot families fill the lake to four (see "Bots"). The lake's size is
  set then: K = 75 fish per family, A = K / 10. It never changes mid-season.
- Six years. Each year is 45 seconds of fishing, then a 15-second village
  meeting. A season lasts six minutes.
- The year and phase are computed from the season's start time and the clock
  (phaseAt). Nothing about the schedule lives only in memory, so a restart
  mid-season resumes at the right moment.
- The season ends after year 6, or the moment the lake dies.

## The lake

- Growth with a strong Allee threshold:
  dS/dt = r · S · (S/A − 1) · (1 − S/K), with r = 0.45 per minute.
  Below A the population shrinks on its own.
- Stock is evaluated from the last recorded stock and the elapsed time (fixed
  step RK4), as in v0.4. The lake is dead when stock falls below 1; a dead lake
  never comes back.

## Casting

- A family may cast once every 2.5 seconds, only during fishing.
- A cast names a point on the water (x, y in 0..1). The point is shown to
  everyone; it does not change the catch.
- Catch: a coarse net has capacity 3, a fine-mesh net 8. Expected catch is
  capacity × S / K. The server rounds it with one random draw (floor, plus one
  with probability equal to the fraction), never more than the whole fish left.
  So a full lake gives a coarse net about 3 fish, and a lake at a third full
  about 1: the nets come up emptier as the lake empties.
- A fine-mesh net costs 20 fish, once per season. It cannot be sold back.

## Why it is a dilemma (checked by spec/unit/dilemma.test.ts)

With four families each casting at 85% of their opportunities, averaged over
many seeded seasons:
- whatever the other three do, switching your own net to fine mesh lands you
  more fish, after its cost;
- when all four have fine nets, each lands far less than when all four keep
  coarse nets.
Numbers from sim/payoff.py: all coarse, about 223 each; all fine, about 91.

## The village meeting

- Each meeting chooses next year's rule: no rule, a quota (25 fish per family
  for the year), or a ban on fine-mesh nets (数罟不入洿池, Mencius).
- Each family has one vote; a family that does not vote counts as "no rule".
  An option wins if it has more votes than each other option and at least half
  of all families' votes. Otherwise there is no rule.
- Rules do not block anyone. A catch that breaks the rule lands, is marked as a
  breach on its ledger row, and is shown to everyone in red. (Ostrom: rules work
  when they are monitored.)

## Bots

Bot families make a lake playable by two people (or one). Each bot is a named
family with one fixed temperament, stated on screen:
- Old Wang (careful): keeps a coarse net; votes to ban fine nets once anyone has
  one, otherwise for a quota when the lake is below 60%; obeys every rule.
- Jin (greedy): buys a fine net as soon as he has 20 fish, unless it is banned
  that year; votes for no rule; ignores quotas.
- Mei (follower): buys a fine net once at least two families have one, unless
  banned; votes as the majority of human families voted at the last meeting
  (no rule if none voted); obeys every rule.
Bots cast on the same 2.5-second clock, taking 85% of their chances. Their
decisions are pure functions of the season's state and a seeded random source,
so a season can be replayed from its ledger.

## The record

Every state change is one append-only ledger row, written in the same
transaction: season opened, family joined, season started (with bots and K),
cast (point, catch, stock after, breach flag), net bought, vote, rule adopted,
collapse, season ended. The debrief is computed from these rows alone.

## The debrief

When the season ends, every player sees the story of this lake: the stock over
six years with the point of no recovery, each family's catch and breaches, and
what the table would have caught if every family had kept a coarse net (a
simulation with the season's real casting rate). Then four short paragraphs:
the dilemma, Hardin and Gordon, the Lüshi Chunqiu line, and Ostrom's other
ending. Every finished season stays on a list of past lakes with its own URL.

## Not building

Chat, or free text other than a family name. Accounts. Leaderboards across
lakes. Blame numbers for who killed a lake. AI-generated anything. Restocking a
dead lake.

## Assumptions to test

- H1: people at a table notice within the first two years that the nets are
  coming up emptier, and talk about it.
- H2: at least one family buys a fine net in most seasons.
- H3: when a ban or quota passes, breaches are rarer than in the year before.

## Migration

The app on Fly still runs v0.4 (one pond, one fish per tap). It moves to v1.0
when the new server lands; until then README.md describes v0.4.

## Changelog

- v1.0: the pivot to a game (after crit 8 feedback). Seasons of six years with
  village meetings; catch proportional to stock; fine-mesh nets; rules by vote,
  shown not blocked; bot families; debrief computed from the ledger. Lake
  parameters K = 75 per family, A = K/10, r = 0.45/min from sim/game_sim.py.
- v0.4: durability (WAL, synchronous NORMAL), routes, cookies, Origin check,
  limits, event payloads, viewers, stricter names, collapse time never in the
  future, the pond page, JSON logs.
- v0.3: ponds, names, rate limit, idempotency, collapse timing, ledger row,
  live-update ids and 'present' decided (the 13 open points from session 1).
  Governance limit is per net, not per person.
- v0.2: parameters K=300, A=30, G≈90 so that two sessions can meet the core
  conflict (markers use two sessions). Dropped the slogan "only a room can
  empty it" (a single net can finish off a weakened pond). Death at stock < 1
  stated as a design choice. Added the once-per-second server snapshot.
- v0.1: replaced plain logistic growth (one person could empty the pond; 0.4
  fish grew back), 1-second batched tides (a fairness promise that
  contradicted itself) and four rule types (too much before any playtest).
