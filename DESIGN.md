# Next Year, No Fish (明年无鱼): design v1.1

> 竭泽而渔，岂不获得？而明年无鱼。 Drain the lake to catch the fish, and of
> course you catch them; but next year there are no fish. (Lüshi Chunqiu, "Yi
> Shang", c. 239 BC)

## What it is

A fishing game for a table of people. Each player is a family on the shore of
one shared lake. Tap the water to cast; every fish you land is yours. At any
time while fishing, a family can pay 20 fish for a fine-mesh net, which lands
more than twice as many. After six short years, the game shows what the table
did to the lake and why.

It is an explainer of the tragedy of the commons that people play rather than
read. The fish are the example; the subject is any shared resource. The
dilemma is not scripted: it comes out of the lake's ecology and the nets (see
"Why it is a dilemma").

## A lake, before it starts

- Someone opens a lake. It gets a four-letter code from an alphabet without
  look-alike letters (said aloud at a table: "lake KMPT") and its own URL,
  /l/KMPT.
- Anyone with the URL joins with a family name: 1 to 24 grapheme clusters, no
  control or format characters except the zero-width joiner inside emoji;
  names are compared after NFKC and lower case (the v0.4 rules). The bot names
  Old Wang, Jin and Mei are reserved. A family is a name held by one browser
  (a cookie for that lake).
- Up to six families may join before the start. A seventh is told the lake is
  full and may watch.
- Any family in the lake may start the season. After the start nobody joins;
  latecomers watch.
- A lake nobody starts stays open. It is not on the list of past lakes.

## A season

- At the start, if fewer than four families have joined, bot families fill
  the lake to four, in this order: Jin, Mei, Old Wang. One person plays with
  all three; three people play with Jin. The lake's size is set then:
  K = 75 fish per family (bots included), A = K / 10. It never changes.
- Six years. Each year is 45 seconds of fishing. Years 1 to 5 end with a
  15-second village meeting. The season ends when year 6's fishing ends
  (5 minutes 45 seconds after the start), or the moment the lake dies. There
  is no meeting after year 6: its rule would govern nothing.
- Year 1 has no rule.
- The year and phase are computed from the season's start time and the clock
  (phaseAt). Nothing about the schedule lives only in memory, so a restart
  mid-season resumes at the right moment.

## Who writes what, and when

- An action writes its own row: a person's request, or, for a bot, the tick.
- Some rows follow from time alone: the next year's rule (at the end of a
  meeting), the collapse (the moment stock fell below 1), the season's end.
  Whoever touches the lake next, a request or the tick, writes them first,
  in time order, each stamped with the moment it happened, never later than
  now.

## The lake

- Growth with a strong Allee threshold:
  dS/dt = r · S · (S/A − 1) · (1 − S/K), with r = 0.45 per minute.
  Below A the population shrinks on its own. The lake grows during meetings
  too.
- Stock is evaluated from the last recorded stock and the elapsed time (fixed
  step RK4), as in v0.4. The lake is dead when stock falls below 1; a dead lake
  never comes back.

## Casting

- A family may cast once every 2.5 seconds after its own last cast, only
  during fishing. Too soon, a meeting, or a finished season each get their
  own answer (too soon says how long to wait; a meeting says how long it has
  left).
- A cast names a point on the water (x, y in 0..1) and a net. The point is
  shown to everyone; it does not change the catch. A family that owns a
  fine-mesh net may still cast its coarse net: that is how it obeys a ban.
- Catch: a coarse net has capacity 3, a fine-mesh net 8. Expected catch is
  capacity × S / K, rounded with one random draw (floor, plus one with
  probability equal to the fraction), never more than the whole fish left. A
  full lake gives a coarse net about 3 fish; a lake a third full, about 1. The
  nets come up emptier as the lake empties.
- Each cast from a person carries an idempotency key. Sending the same key
  again returns the first answer and writes nothing.

## Fish, and the fine-mesh net

- A family's fish landed is the sum of its catches. Its fish kept is fish
  landed minus 20 if it bought a fine net. The score shown is fish kept.
- A fine-mesh net costs 20 fish kept, once per season, and can only be bought
  during fishing. It cannot be sold back. Buying twice is answered as already
  owned and writes nothing.
- A quota counts fish landed in that year. Buying a net does not change it.

## Honest draws

- Each season has a secret random seed. The draw for a family's n-th cast is
  HMAC-SHA256(seed, "cast:<family id>:<n>"), read as a number in [0, 1). It
  does not depend on who cast first, so the catches can be recomputed from the
  ledger in any order.
- The start row publishes SHA-256 of the seed. The end row reveals the seed.
  After the season, anyone can check that the seed matches the hash published
  at the start and recompute every catch from the ledger. The server could not
  have chosen anyone's catch.
- Until the end row exists, the seed appears in no event, snapshot, page or
  log line. If it leaked, anyone could predict catches.

## Why it is a dilemma (checked by spec/unit/dilemma.test.ts)

With four families each casting at 85% of their opportunities, averaged over
many seeded seasons:
- whatever the other three do, switching your own net to fine mesh lands you
  more fish, after its cost;
- when all four have fine nets, each lands far less than when all four keep
  coarse nets.
Numbers from sim/payoff.py: all coarse, about 223 each; all fine, about 91.

The test gives each family its net from the first cast. In play a net is
bought after 20 fish (about seven casts), so the test slightly overstates the
fine net's advantage in year 1. The direction of every comparison holds.

## The village meeting

- Each meeting (after years 1 to 5) chooses next year's rule: no rule, a quota
  (25 fish landed per family that year), or a ban on fine-mesh nets
  (数罟不入洿池, Mencius).
- During the meeting a family may vote, and change its vote; its last vote
  counts. Votes are shown to everyone as they are cast. Voting for what you
  already voted writes nothing.
- A family that does not vote counts as "no rule". An option wins if it has
  more votes than each other option and at least half of all families'
  votes. Otherwise there is no rule.
- Rules do not block anyone. A breach lands, is marked on its ledger row, and
  is shown to everyone in red. A catch breaks a quota when it takes the
  family's year past 25; it breaks a ban when it is landed with a fine-mesh
  net. (Ostrom: rules work when they are monitored.)

## Bots

Bot families make a lake playable by one or two people. Each bot is a named
family with one fixed temperament, stated on screen:
- Old Wang (careful): keeps a coarse net. Votes to ban fine nets once anyone
  has one; otherwise for a quota when the lake is below 60% of K; otherwise no
  rule. Obeys every rule: under a quota he stops casting for the year when
  one more cast could take him past it.
- Jin (greedy): buys a fine net as soon as he has 20 fish kept, unless fine
  nets are banned that year. Votes for no rule. Ignores quotas. Obeys a ban by
  casting his coarse net: a banned net is seen by everyone, a quota broken is
  only a number.
- Mei (follower): buys a fine net once at least two other families have one,
  unless banned. Votes last, as the human families have voted so far in this
  meeting (a silent human counts as no rule). Obeys every rule.

Timing:
- Bots cast once every THROW_MS / BOT_TAKE (about 2.9 seconds) during
  fishing, the same average rate as the 85% in the dilemma test. Each bot's
  first cast of the season waits a seeded offset.
- In each meeting Old Wang votes at 3 seconds, Jin at 6, Mei at 12.
- Bots act only when the tick runs. If the server was down, the casts they
  missed are not made up.
- A bot's choices are pure functions of the season's state. Its casting point
  comes from a seeded draw.

## The record

Every state change is one append-only ledger row, written in the same
transaction: lake opened; family joined; season started (the families,
bots included, K, and the seed's hash); cast (family, point, net, catch, stock
after, breach); net bought; vote (year, rule); rule adopted (the year it
governs, the rule, the counts); collapse; season ended (the seed). The debrief
is computed from these rows alone.

## The debrief

When the season ends, every player sees the story of this lake:
- the stock over the season, with the point of no recovery: the first moment
  stock fell below A, from which, with nobody restocking, it cannot come back;
- each family's fish landed, fish kept and breaches;
- what the table would have landed if every family had kept a coarse net:
  the same families simulated with coarse nets, at the table's real casting
  rate (casts made / cast chances in the fishing time played, one chance per
  family every 2.5 s), averaged over seeds 0 to 19;
- that every catch was checked against the revealed seed;
- four short paragraphs: the dilemma, Hardin and Gordon, the Lüshi Chunqiu
  line, and Ostrom's other ending.
Every finished season stays on a list of past lakes with its own URL.

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

The app on Fly still runs v0.4 (one pond, one fish per tap) until the new
server lands; until then README.md describes v0.4. Lakes live in new tables
(lakes, families, lake_ledger) in the same SQLite file as the v0.4 ponds. When
the new server lands, the v0.4 routes go; their tables stay as they are, never
written again and never dropped.

## Changelog

- v1.1: answers the open points from session 6, except the ledger's columns
  and the routes and event payloads, which are decided when the store and the
  server are built. Any family starts a lake;
  bots fill in the order Jin, Mei, Old Wang; bot names reserved; a 7th joiner
  or a latecomer watches. No meeting after year 6 (the season is 5 min 45 s).
  Rows that follow from time are written by the next touch, stamped with
  their own moment. A fine-net owner may cast coarse; nets are bought only
  while fishing; fish kept = landed − 20; a quota counts fish landed. Votes
  can change until the meeting ends. Draws are HMAC(seed, family, cast
  number); the seed's hash is published at the start and the seed at the end.
  Bots cast every 2.9 s, vote at fixed moments, Mei follows this meeting's
  human votes; Jin obeys bans, ignores quotas. Point of no recovery and the
  all-coarse comparison defined. v0.4 tables kept, not dropped.
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
