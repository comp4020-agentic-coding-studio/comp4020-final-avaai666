# Next Year, No Fish (明年无鱼): design v2.1

## What it is

A fishing game for a table of people that explains the tragedy of the commons
by letting them cause it. Each player is a family on the shore of one shared
lake. The fish are real: they swim in schools, pair up and spawn in spring,
and their fry grow up over winter. Tap the water to throw your net; every fish
inside the ring goes into your basket, and each winter your basket goes into
your house. A fine-mesh net keeps the fry too. Every winter the village may
agree on a rule, and any two families may make a promise. After five years
the game shows what the table did to the lake, and what the lake will hold
next year.

The goal on the first screen is the player's own: "Grow your family's house.
The fish in the lake belong to everyone." The game does not say greed is
wrong; the lake does.

Who it is for: two to eight people around one table, each on their own
phone or laptop; one person alone, with bot families; a room at the
showcase. The markers are English speakers: every word that carries meaning
is English. Chinese appears as the print's decoration (seals, the title,
quotations) and always with its English.

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
  the lake to four, in this order: Jin, Mei, Old Wang. Bots are labelled
  "bot" everywhere they appear.
- Five years. Each year is 40 seconds of fishing; the first 14 seconds are
  spring, when fish spawn. Years 1 to 4 end with a 14-second winter. The
  season ends when year 5's fishing ends (4 min 16 s after the start), or the
  moment the lake is dead.
- The season runs in steps of 0.1 s counted from the start time:
  step = floor((now − start) / 100 ms). The year, season and phase come from
  the step (stepAt, phaseAt). Nothing about the schedule lives only in memory.
- Year 1 has no rule.

## The lake (model "lake-sim 2.1")

The reference implementation is sim/lakesim.mjs. src/lib/lake-sim.ts must give
exactly the same fish, step for step, for the same secret and the same
actions. Every constant lives in src/lib/game-constants.ts. The model version
is recorded in each lake's start row; a lake is only ever replayed by the
model version it was played with.

- The lake is an ellipse (1000 by 700 units). The shallows are where
  hypot((x − 500)/460, (y − 350)/315) ≥ 0.72, computed by one function used
  everywhere; they are drawn paler.
- At the start the lake holds 75% of its capacity in grown fish, aged 1 to 3.
  Capacity is 55 fish per family (bots included), fixed at the start. Every
  fish has an id from a counter.
- Grown fish swim in schools. Fry keep to the shallows and do not school.
- Spring: two grown fish closer than 30 units may spawn two fry, with a
  probability that falls to zero as the lake fills to capacity. A fish that
  has spawned rests 6 seconds. When grown fish are few they rarely meet, so
  few fry are born: the Allee effect, seen rather than stated.
- Winter (the end of each year's fishing): every fish ages a year; fish older
  than 4 die; of the others, the fry that have just grown up all survive and
  12% of the older fish die.
- The lake is dead when fewer than two fish are left: one fish cannot spawn.
  This is the only definition of death, in the sims, the tests and the game.

## Randomness, and why the seed is secret

- Each season has a 256-bit secret. Each random stream is sfc32 (128 bits of
  state) seeded from SHA-256(secret | name): "lake" for the fish, "koi" for
  the golden carp, and, for bots, SHA-256(secret | bot | step | family | k).
  Replaying the ledger never runs a bot.
- The start row publishes SHA-256(secret). The end row reveals the secret.
  While the season runs, the secret is in no event, frame, page or log line,
  so nobody can predict where the fish will swim. Afterwards anyone can check
  it against the start row and replay the whole season.

## Nets

- A family may throw once every 3.5 seconds, only during fishing, at any point
  inside the lake. A throw that reaches the server between two steps is
  applied at the start of the next step, before the fish move; throws in the
  same step are applied in the order the server accepted them. The ledger
  row records that step.
- The net closes 0.6 seconds (6 steps) after it lands and takes every fish
  inside its ring at that step. A coarse net (radius 36) holds grown fish; fry
  slip through. A fine-mesh net (radius 42) holds everything. Nets that close
  in the same step take fish in the order they were thrown, so no fish is
  ever caught twice.
- Fish nearby scatter when a net lands.
- After each haul the thrower is told what happened: how many fish, how many
  were fry, how many fry slipped through, or, for an empty net, whether there
  were no fish under it, another family's net got there first, or the fish
  swam off.
- Each throw from a person carries an idempotency key; the same key again
  returns the first answer and changes nothing.

## Basket, house and fine net

- What a family's nets take goes into its basket.
- Each winter the basket goes into the house, part by part, while it can pay
  for the next part: a tiled roof (25), a red gate (35), lanterns (50), an
  upper floor (60), a pagoda (70). What is left stays in the basket. Built
  parts are never lost.
- A fine-mesh net costs 20 fish from the basket, once per season, bought only
  during fishing. A family that owns one may still throw its coarse net.
- A family's score is fish kept: built plus basket. Everyone sees every
  house, every basket and every net.
- The golden carp: once a year, 17 seconds into fishing, a golden carp swims
  for 12 seconds along a path from the "koi" stream. A net that closes within
  its radius + 6 of it takes it (first net thrown first) and lands 8 extra
  fish in the basket. It is outside the ecology: it does not breed and is not
  a fish of the lake. The simulations include it.

## Promises

- During fishing a family may ask another: "coarse nets only, until winter?"
  The other accepts or says no. An accepted promise is a red thread between
  the two houses until winter.
- Nothing enforces a promise. A family that throws a fine net while it has a
  promise breaks it: the thread snaps, everyone sees, and the record keeps it.
- This is the game's one negotiation between people. It works with two
  humans and no bots. It follows Ostrom, Walker and Gardner (1992): in
  laboratory commons, promises made face to face helped, and promises with a
  way to answer cheaters helped more.

## Seals

A family can stamp a seal on another: 赞 thanks, 求 please, 怒 stop that,
喜 cheers. Everyone sees it fly from house to house. There is no text.

## The village meeting

- In each winter (after years 1 to 4) the meeting first shows what happened
  that year: fry born (and the year before), fry netted before they grew up,
  which families have fine nets, promises broken.
- Then it chooses next year's rule, each option saying what it changes:
  - no rule: fish however you like;
  - ban fine nets: a fine net that lands is a breach (数罟不入洿池, Mencius);
  - no fishing in spring: nets wait 14 s while the fish spawn (今鱼方别孕,
    Guoyu, Lu Yu I);
  - keep out of the shallows: a net landing in the shallows is a breach
    (鱼禁鲲鲕, Guoyu, Lu Yu I).
- A family may vote and change its vote until the meeting ends; its last vote
  counts. Votes are shown as they are cast. A family that does not vote counts
  as no rule. An option wins with more votes than each other option and at
  least half of all families' votes; otherwise there is no rule.
- Rules block nobody. A breach lands, is marked on its ledger row and is shown
  to everyone.

## Bots

Each bot has one temperament, stated on screen. Their responses are scripts;
what they do is not evidence about how people behave.
- Old Wang (careful): never buys a fine net; votes ban once anyone has one,
  otherwise "keep out of the shallows" once any one family has taken more than
  6 fry in the season, otherwise "no spring fishing" when grown fish are below
  60% of the start, otherwise no rule; keeps every rule and promise; stamps
  怒 on a family the first time each year it breaks a rule; asks the player
  for a promise once a year, after 18 seconds of fishing (in year 1, only
  once someone has a fine net).
- Any bot that a promise was broken to stamps 怒 on the breaker.
- Jin (greedy): buys a fine net as soon as his basket holds 20; votes no rule;
  breaks every rule until two different families have stamped 怒 on him in
  that year (Old Wang's counts); accepts a promise only while he has no fine
  net, and breaks it half the times he could.
- Mei (follower): buys a fine net once two other families have one; votes,
  last, as the human families have voted so far; accepts a promise unless two
  others already have fine nets, and keeps it; keeps every rule until other
  families have broken it twice that year, then breaks it too, until anyone
  stamps 怒 on her.
- Bots throw on their own 3.5-second clock, skip 15% of their chances, and aim
  at the densest school their net can hold. Keeping a spring closure means
  not throwing in spring; keeping the shallows rule means aiming inside 95% of
  the shallows line and never landing past it. In each meeting Old Wang votes
  at 3 seconds, Jin at 6, Mei at 10.

## What the simulations show (sim/payoff_output.txt, sim/rules_output.txt)

These are results for the strategies, parameters and seeds in sim/, not
claims about every way people might play.

Each family compared with itself: the same seed and the same seat, once
keeping a coarse net and once buying a fine net as soon as it can afford one
(24 seeds × 4 seats; fish kept, after paying for the net):

| other families with fine nets | keep coarse | switch | switching paid |
|---|---|---|---|
| 0 | 132 | 165 | 86 of 96 |
| 1 | 95 | 108 | 70 of 96 |
| 2 | 75 | 82 | 64 of 96 |
| 3 | 68 | 67 | 39 of 96 |

The first, second and third family to switch gain by it; once three have, the
fourth gains nothing: the lake is already going. All coarse: about 132 each,
and the lake died in 0 of 24 seasons. All fine: about 67 each, and it died in
24 of 24. That is a social dilemma in the usual sense: each switch helps the
switcher until it is too late to matter, and the table ends far worse off.

The rules, kept by everyone from year 2 (12 seeds): with two fine nets, no
rule loses the lake 12 times, and every rule saves it; with four fine nets,
the ban leaves the most fish (173 grown fish next year), no spring fishing
catches the most but leaves the lake thin (51 next year), keeping out of the
shallows sits between (121). No rule is best for every lake.

## Real time

- The server runs each live lake: ten steps a second, bots included. If it
  falls behind, it runs the missing steps before the next frame; it never
  skips a step. At most 12 live lakes per machine.
- Every 0.2 seconds it sends every open page a frame of fish positions; a
  throw, a haul, a seal, a promise, a vote and a rule go out the moment they
  happen. Pages draw between frames. A page that falls behind skips to the
  latest frame; events are replayed from the last one it saw.
- A page says when an action is waiting, accepted or refused; an animation
  never pretends an action succeeded.

## The record, and replay

- Every action is one append-only ledger row, written in the same
  transaction: lake opened; family joined; season started (the families,
  bots included, the capacity, the model version, SHA-256 of the secret);
  throw (family, step, point, net, breach); haul (the throw it closes, fish,
  fry, fry slipped, golden carp); net bought; promise asked, answered,
  broken; seal; vote; rule adopted; winter building; season ended (the secret
  and the summary).
- A haul, a winter's building, a year's rule and the season's end follow from
  time: the tick writes them at the step they happen. A haul that leaves fewer
  than two fish writes the haul and the end row in one transaction.
- Where the fish are is never stored. Replaying the ledger with the secret
  gives the same fish, step for step. A restart mid-season replays each live
  lake to its last row and steps on to the present; while the server was down
  nobody threw, bots included.

## The debrief

The first screen answers three questions: what happened to my house (the
house, fish kept, its place among the four); what happened to the lake (how
many grown fish are left, and how many the lake would hold next year if left
alone: "next year, no fish" when that is none); and what happened (two to five
moments from this season: the first fine net, a rule agreed, a promise broken,
two families standing up to a rule-breaker, the golden carp). Then "play
again".

"Why it went this way" opens below: grown fish and fry over the season, the
families' table, six villages (this lake's first fish under five other plans),
the paired comparison, Hardin, Gordon, Ostrom, Ostrom, Walker and Gardner, and
Li Ge cutting Duke Xuan's net. The Lüshi Chunqiu line that names the game is
revealed here, at the end. Every finished season stays on the list of past
lakes, with its own URL.

## Phones and keyboards

- On a phone, a finger presses to show the net ring above the finger, drags
  to aim, and lifts to throw; lifting outside the lake cancels. Fish are drawn
  larger on small screens; the ring is drawn at its true size. Your basket,
  next part and net stay in a bar at the bottom of the screen.
- With a keyboard: arrows aim, space throws, B buys a fine net, F switches
  nets, Tab reaches the families, Enter opens seals and promises.

## Not building

Chat, or free text other than a family name. Accounts. Leaderboards across
lakes. Blame numbers for who killed a lake. AI-generated anything. Restocking a
dead lake. Trading, loans, alliances: one negotiation (the promise) first.

## Assumptions to test (with people, not bots)

- H1: within two minutes, a new player has thrown a net at a school without
  being told how, and can say why a net came up empty.
- H2: players mention another player's action, and change their own because
  of it.
- H3: at least one promise is asked for in most games with two or more people.
- H4: players want to play again, and can say what they would change.

## Migration

The app on Fly still runs v0.4 until the new server lands; until then README.md
describes v0.4. Lakes live in new tables beside the v0.4 ponds, which are never
written again and never dropped.

## Changelog

- v2.1: after a review of v2.0 and prototype 3. A 256-bit secret seeds sfc32
  streams (the 32-bit seed could be brute-forced from its published hash).
  One definition of a dead lake (fewer than two fish). Winter wording matches
  the model. Throws apply at the next step, in accepted order. The golden carp
  is specified and simulated. Fine nets are bought when a family can afford
  one, in the sims too, and the dilemma is measured by comparing each family
  with itself: switching pays the first three switchers, not the fourth.
  Houses are built each winter from the basket and never shrink. Promises
  between families. Meetings start from what happened. Empty nets explain
  themselves. English first. Phone aiming by press, drag and lift. The
  debrief starts with house, lake and moments, and a next-year forecast.
  Model version recorded per lake.
- v2.0: the fish are agents (after prototype 2 was not fun).
- v1.1: open points from session 6.
- v1.0: the pivot to a game (after crit 8 feedback).
- v0.4: durability, routes, cookies, Origin check, limits, events, viewers,
  names, the pond page, JSON logs.
- v0.3: ponds, names, rate limit, idempotency, collapse timing, ledger row,
  live-update ids, 'present'.
- v0.2: parameters so that two sessions can meet the core conflict.
- v0.1: replaced plain logistic growth, batched tides and four rule types.
