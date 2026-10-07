# Next Year, No Fish (明年无鱼): design v2.0

> 竭泽而渔，岂不获得？而明年无鱼。 Drain the lake to catch the fish, and of
> course you catch them; but next year there are no fish. (Lüshi Chunqiu, "Yi
> Shang", c. 239 BC)

## What it is

A fishing game for a table of people that explains the tragedy of the commons
by letting them cause it. Each player is a family on the shore of one shared
lake. The fish are real: they swim in schools, pair up and spawn in spring,
and their fry grow up over winter. Tap the water to throw your net; every fish
inside the ring is yours and builds your house. A fine-mesh net keeps the fry
too. Every winter the lake freezes and the village chooses a rule. After five
years the game shows what the table did to the lake, and what five other
villages did to the same lake.

The fish are the example; the subject is any shared resource. Nothing about
the dilemma is scripted: it comes out of how the fish breed and what the nets
catch (see "Why it is a dilemma").

Who it is for: two to eight people around one table, each on their own
phone or laptop; one person alone, with bot families; a room at the
showcase, watching one lake on a big screen.

## A lake, before it starts

- Someone opens a lake. It gets a four-letter code from an alphabet without
  look-alike letters ("lake KMPT") and its own URL, /l/KMPT.
- Anyone with the URL joins with a family name: 1 to 24 grapheme clusters, no
  control or format characters except the zero-width joiner inside emoji;
  names are compared after NFKC and lower case. The bot names Old Wang, Jin and
  Mei are reserved. A family is a name held by one browser (a cookie for that
  lake).
- Up to eight families may join before the start. A ninth, and anyone who
  arrives after the start, watches.
- Any family in the lake may start the season. A lake nobody starts stays
  open and is not on the list of past lakes.

## A season

- At the start, if fewer than four families have joined, bot families fill
  the lake to four, in this order: Jin, Mei, Old Wang.
- Five years. Each year is 40 seconds of fishing; the first 14 seconds are
  spring, when fish spawn. Years 1 to 4 end with a 14-second winter meeting.
  The season ends when year 5's fishing ends (4 min 16 s after the start), or
  the moment the lake has no fish.
- Year 1 has no rule.
- The year, the season and the phase come from the start time and the clock
  (phaseAt). Nothing about the schedule lives only in memory.

## The lake

The model is an agent simulation, in fixed steps of 0.1 s. Its reference
implementation is sim/lakesim.mjs, which produced every number in this file;
src/lib/lake-sim.ts must give exactly the same fish, step for step, for the
same seed and the same actions. Every constant lives in
src/lib/game-constants.ts.

- The lake is an ellipse (1000 by 700 units). The shallows are the band
  outside 72% of its radius; they are drawn paler.
- At the start the lake holds 75% of its capacity in grown fish, aged 1 to 3.
  Capacity is 55 fish per family (bots included), fixed at the start.
- Grown fish swim in schools (they steer towards nearby grown fish and away
  from any that come too close). Fry keep to the shallows and do not school.
- Spring: two grown fish closer than 30 units may spawn two fry, with a
  probability that falls to zero as the lake fills to capacity. A fish that
  has spawned rests 6 seconds. When grown fish are few they rarely meet, so
  few fry are born: the Allee effect, seen rather than stated.
- Winter (the end of each year's fishing): fry become grown fish, every fish
  ages a year, fish older than 4 die, and 12% of the others die.
- The lake is dead when it has no fish; it never comes back.

## Nets

- A family may throw its net once every 3.5 seconds, only during fishing, at
  any point inside the lake.
- The net closes 0.6 seconds after it lands and takes every fish inside its
  ring at that step. A coarse net (radius 36) holds grown fish; fry slip
  through. A fine-mesh net (radius 42) holds everything.
- A fine-mesh net costs 20 fish kept, once per season, bought only during
  fishing. A family that owns one may still throw its coarse net; that is how
  it keeps a ban.
- Fish nearby scatter when a net lands.
- Two nets that close on the same step take fish in the order they were
  thrown.
- Each throw from a person carries an idempotency key; sending the same key
  again returns the first answer and changes nothing.

## Fish and houses

- Fish landed is everything a family's nets took. Fish kept is landed minus
  20 for a fine net. The score shown is fish kept.
- Each family's house grows with fish kept: a thatched hut, a tiled house (25),
  a red gate (60), lanterns (110), a second storey (170), a pagoda (240).
  Everyone sees every house.
- The golden carp: once a year, 17 seconds into fishing, a golden carp swims
  for 12 seconds. The net that takes it lands 8 extra fish. It is outside the
  ecology: it does not breed and is not counted as a fish of the lake.

## Why it is a dilemma (checked by spec/unit/dilemma.test.ts)

Four families who all aim at the densest school and take 85% of their
chances, averaged over 24 seeded seasons (sim/payoff_output.txt):

| other families with fine nets | you keep a coarse net | you switch |
|---|---|---|
| 0 | 125 | 178 |
| 1 | 90 | 112 |
| 2 | 68 | 84 |
| 3 | 52 | 59 |

Whatever the others do, switching pays the family that switches, after the
net's cost. When all four switch, each keeps about 65 fish instead of about
133, and the lake dies in every one of the 24 seasons; with four coarse nets
it dies in none.

## What the rules do (checked by spec/unit/rules.test.ts)

Two families with fine nets, each rule kept by everyone from year 2, over 12
seeded seasons (sim/rules_output.txt): no rule, the lake dies 12 times; a ban,
a spring closure or protected shallows, it dies none. With four fine nets the
rules differ: the ban never loses the lake, the spring closure catches the
most but loses it 3 times in 12, protected shallows once. No rule is best for
every lake, so the meeting has something to argue about.

## The village meeting

- Each meeting (after years 1 to 4) chooses next year's rule:
  - 无 no rule;
  - 禁 ban fine-mesh nets (数罟不入洿池, Mencius);
  - 休 no fishing in spring (今鱼方别孕, Guoyu, Lu Yu I);
  - 护 keep out of the shallows (鱼禁鲲鲕, Guoyu, Lu Yu I).
- A family may vote and change its vote until the meeting ends; its last vote
  counts. Votes are shown as they are cast. A family that does not vote counts
  as no rule. An option wins with more votes than each other option and at
  least half of all families' votes; otherwise there is no rule.
- Rules block nobody. A throw that breaks the rule lands, is marked 违 on its
  ledger row, and is shown to everyone: a fine net under a ban, any throw in
  spring under a spring closure, a net landing in the shallows under
  protected shallows.

## Seals

A family can stamp a seal on another family: 赞 thanks, 求 please, 怒 stop
that, 喜 cheers. The seal flies from one house to the other and everyone sees
it. There is no text: the people are at the same table, and a seal is enough
to answer a breach in a room where some players are not.

## Bots

Bot families make a lake playable by one or two people. Each has one fixed
temperament, stated on screen:
- Old Wang (careful): never buys a fine net; votes 禁 once anyone has one,
  otherwise 护 once anyone has taken more than 6 fry, otherwise 休 when grown
  fish are below 60% of the start, otherwise no rule; keeps every rule; stamps
  怒 on each family the first time it breaks a rule in a year.
- Jin (greedy): buys a fine net as soon as he keeps 20 fish; votes no rule;
  breaks every rule until two different families have stamped 怒 on him in
  that year, then keeps it for the rest of the year.
- Mei (follower): buys a fine net once two other families have one; votes,
  last, as the human families have voted so far; keeps every rule until
  other families have broken it twice in that year, then breaks it too, until
  anyone stamps 怒 on her.
- Bots throw on their own 3.5-second clock, aim at the densest school their
  net can hold, and skip some chances. In each meeting Old Wang votes at 3
  seconds, Jin at 6, Mei at 10. Every choice a bot makes comes from the
  season's state and a random source derived from the seed, the step and
  the family, separate from the fish's own source. So replaying a season
  never needs to run a bot again: its actions are in the ledger.

## Real time

- The server runs each live lake: ten steps a second, bots included.
- Every 0.2 seconds it sends every open page a frame of fish positions; a
  throw, a haul, a seal, a vote and a rule go out the moment they happen.
  Pages draw between frames. A page that falls behind skips to the latest
  frame; events are replayed from the last one it saw.

## The record, and replay

- Every action is one append-only ledger row, written in the same
  transaction: lake opened; family joined; season started (the families, bots
  included, the capacity, and SHA-256 of the seed); throw (family, step,
  point, net, breach); haul (the throw it closes, fish taken, fry taken,
  golden carp); net bought; seal; vote; rule adopted; season ended (the seed,
  and the season's summary).
- A haul, a year's rule and the season's end follow from time: the server's
  tick writes them, at the step they happen.
- Where the fish are is never stored. The seed and the ledger determine the
  whole season: replaying them gives the same fish, step for step. The step
  is counted from the start time (ten a second), so a restart mid-season
  resumes the lake by replaying the ledger and stepping on to the present;
  while the server was down, nobody threw, bots included.
- The seed stays secret until the end row, so nobody can predict where the
  fish will go. Then anyone can check it against the hash published at the
  start and replay the season.

## The debrief

When the season ends, every player sees this lake's story: grown fish and fry
over five years, with spring, winter and the rule in force marked; each
family's catch, fry taken, breaches and house; "six villages, one lake": the
same seed played by four plain families under five other plans (all coarse;
all fine; all fine with each rule from year 2), and which of them left enough
fish to come back; then the dilemma, Hardin and Gordon, Ostrom's other ending,
and Li Ge cutting Duke Xuan's net (Guoyu, Lu Yu I). Every finished season stays
on the list of past lakes, with its own URL and a replay.

## Not building

Chat, or free text other than a family name. Accounts. Leaderboards across
lakes. Blame numbers for who killed a lake. AI-generated anything. Restocking a
dead lake.

## Assumptions to test

- H1: within two minutes, a new player has thrown a net at a school without
  being told how.
- H2: people at a table notice the fry and talk about the fine net before
  the first meeting.
- H3: at least one family buys a fine net in most seasons.
- H4: in a year after someone stamps 怒 on a breaker, there are fewer breaches
  than in the year before.

## Migration

The app on Fly still runs v0.4 until the new server lands; until then README.md
describes v0.4. The v1.x model in src/lib/lake.ts is replaced by
src/lib/lake-sim.ts. Lakes will live in new tables beside the v0.4 ponds, which
are never written again and never dropped.

## Changelog

- v2.0: the fish are agents. Prototype 2 showed that tapping a timer while a
  number falls is not a game: where you threw did not matter and the other
  families could only be watched. Now fish swim, meet, spawn and grow; a net
  takes the fish inside its ring; fine nets take fry; the Allee effect comes
  from fish failing to meet. Five years of 40 s plus 14 s meetings. Rules are
  the three oldest fishery tools (gear, season, nursery) instead of a quota.
  Seals let families answer each other without text. Bots react to seals.
  Up to eight families. Real time by frames; the ledger stores actions and the
  seed, and replay rebuilds the fish. Numbers from sim/lakesim.mjs.
- v1.1: open points from session 6 (start, bots, season length, who writes
  time rows, fine-net casting, votes, honest draws, debrief).
- v1.0: the pivot to a game (after crit 8 feedback).
- v0.4: durability, routes, cookies, Origin check, limits, events, viewers,
  names, the pond page, JSON logs.
- v0.3: ponds, names, rate limit, idempotency, collapse timing, ledger row,
  live-update ids, 'present'.
- v0.2: parameters so that two sessions can meet the core conflict.
- v0.1: replaced plain logistic growth, batched tides and four rule types.
