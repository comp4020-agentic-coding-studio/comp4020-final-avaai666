# Next Year, No Fish (明年无鱼): design v3.0

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

## The lake (model "lake-sim 2.2")

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
  The season ends at that step, in the sims too: nobody fishes a dead lake.
- The golden carp is part of the model, with its own "koi" stream. Once a
  year, at the first step 17 seconds into fishing, it appears; it swims for 12
  seconds and leaves at winter. At each step, after the nets close, a net that
  closed within its radius + 6 of the carp takes it (nets in throw order);
  then the carp moves. It is outside the ecology: it does not breed and is not
  a fish of the lake. A haul that takes it lands 8 extra fish.

## Randomness, and why the seed is secret

- Each season has a 256-bit secret. Each random stream is sfc32 (128 bits of
  state) seeded from SHA-256(secret | name): "lake" for the fish, "koi" for
  the golden carp, and, for a bot's decisions in one step, one stream from
  SHA-256(secret | bot | step | seat). Replaying the ledger never runs a bot.
- The secret is 32 random bytes (randomBytes(32), hex). It is kept in the
  lake's row in the database, which no route reads before the end row.
- The start row publishes SHA-256(secret). The end row reveals the secret.
  While the season runs, the secret is in no event, frame, page or log line,
  so nobody can predict where the fish will swim. Afterwards anyone can check
  it against the start row and replay the whole season.

## Nets

- A family may throw once every 3.5 seconds, only during fishing, at any point
  inside the lake. A throw is applied at the next step the lake's runner
  will run (the runner's own step counter, not the clock), before the fish
  move; throws in the same step are applied in ledger order (the row id is
  the accepted order). The ledger row records that step.
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
- The golden carp's 8 fish go into the basket like any other catch (see The
  lake). The simulations include it.

## Promises

- During fishing a family may ask another: "coarse nets only, until winter?"
  The other accepts or says no. An accepted promise is a red thread between
  the two houses until winter.
- Promises work between any two families, people or bots. With two people
  and two bots, the two people can promise each other.
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
  怒 on a family the first time each year it breaks a rule; once a year,
  after 18 seconds of fishing (in year 1, only once someone has a fine net),
  asks one human family for a promise: the one with the most fish in its
  basket that has no promise with him, lowest seat first on a tie.
- Any bot that a promise was broken to stamps 怒 on the breaker.
- Jin (greedy): buys a fine net as soon as his basket holds 20, ban or not
  (buying under a ban is part of breaking it); votes no rule;
  breaks every rule until two different families have stamped 怒 on him in
  that year (Old Wang's counts); accepts a promise only while he has no fine
  net, and breaks it half the times he could.
- Mei (follower): buys a fine net once two other families have one; votes,
  last, as the human families have voted so far; accepts a promise unless two
  others already have fine nets, and keeps it; keeps every rule until other
  families have broken it twice that year, then breaks it too, until anyone
  stamps 怒 on her.
- Bots throw every 35 steps from a first step drawn from their stream at
  step 0 (0 to 34), skip a chance when a draw is ≥ 0.85, aim at the densest
  school their net can hold (bestSpot with their step's stream), then add up
  to ±25 units of aim noise; a bot keeping the shallows rule that would land
  past the line throws at the spot it chose, without the noise. Keeping a
  spring closure means not throwing in spring. In each meeting Old Wang votes
  at 3 seconds, Jin at 6, Mei at 10. Bots answer a promise in the step after
  they are asked.
- The simulated families in sim/ are not these bots: they keep every rule
  from year 2, which includes not buying a fine net under a ban.

## What the simulations show (sim/payoff_output.txt, sim/rules_output.txt)

These are results for the strategies, parameters and seeds in sim/, not
claims about every way people might play.

Each family compared with itself: the same seed and the same seat, once
keeping a coarse net and once buying a fine net as soon as it can afford one
(24 seeds × 4 seats; fish kept, after paying for the net):

| other families with fine nets | keep coarse | switch | switching paid |
|---|---|---|---|
| 0 | 132 | 164 | 86 of 96 |
| 1 | 95 | 106 | 66 of 96 |
| 2 | 74 | 80 | 64 of 96 |
| 3 | 67 | 64 | 41 of 96 |

The first, second and third family to switch gain by it; once three have, the
fourth gains nothing: the lake is already going. All coarse: about 132 each,
and the lake died in 0 of 24 seasons. All fine: about 64 each, and it died in
24 of 24. That is a social dilemma in the usual sense: each switch helps the
switcher until it is too late to matter, and the table ends far worse off.

The rules, kept by everyone from year 2 (12 seeds): with two fine nets, no
rule loses the lake 12 times, and every rule saves it; with four fine nets,
the ban leaves the most fish (173 grown fish next year), no spring fishing
catches the most but leaves the lake thin (51 next year), keeping out of the
shallows sits between (116). No rule is best for every lake.

## Real time

- The server runs each live lake in memory: a runner per lake, driven by a
  timer every 100 ms. Each time, it runs every step from its own step counter
  up to stepAt(start, now), and never skips one. At most 12 live lakes per
  machine; a thirteenth start is refused with a message.
- In each step, in this order: the bots decide (writing their rows); the
  throws for this step are applied in ledger order; the lake steps; hauls,
  winter building, a year's rule and the season's end are written. All rows
  of one step are written in one transaction.
- Every second step (0.2 s) the runner sends every open page a frame; every
  row goes out as an event the moment it is written. A page that reconnects
  sends the last event id it saw and gets the rows after it, then a fresh
  snapshot; frames are never replayed. Pages move a fish smoothly between two
  frames they received, and draw nothing they were not sent.
- A page says when an action is waiting, accepted or refused; an animation
  never pretends an action succeeded.

## Pages and routes

- GET / : open a lake; the list of past lakes; a short line of what the game
  is, and a link to /readme/.
- POST /lakes : opens a lake and answers 303 to /l/CODE.
- GET /l/CODE : the lake. Before the start: who has joined, a name form, and
  Start. During the season: the game. After it: the debrief.
- POST /l/CODE/join {name} : 303 back, with the cookie fam_CODE
  (HttpOnly, SameSite=Lax, Path=/l/CODE, Secure on https, a year).
- POST /l/CODE/start, /throw {x, y, net, key}, /buy, /vote {rule},
  /promise {to}, /promise/answer {from, yes}, /seal {to, seal}: JSON answers.
  200 with what was accepted, or 4xx with a reason the page can show:
  not_in_lake (no cookie for this lake), not_started, over, not_fishing,
  not_meeting, too_soon (with steps to wait), outside (not on the water),
  no_fine_net, cannot_afford, already_owned, already_promised, no_such_ask,
  self, bad_rule, bad_seal, bad_key, full (eight families), started.
- GET /l/CODE/events : the stream (text/event-stream): "snapshot" on open,
  "row" for each public row (with its id), "frame" for fish.
- Every POST passes the Origin check. A family may send at most 10 POSTs a
  second; more are refused with 429.

## Frames and events

- A frame is JSON: { s: step, f: [id, x, y, h, a, ...], n: [...nets in the
  water: seat, x, y, fine, closeStep], k: [x, y, h] or null }. x and y are
  whole units, h is the heading in hundredths of a radian, a is 0 for fry and
  1 for grown fish. With 220 fish a frame is about 4 KB.
- A row event carries only public fields: never a token, an idempotency key,
  a name key or (before the end row) the secret.
- The snapshot carries the lake's phase and step, the rule, every family's
  seat, name, bot or not, basket, house parts, fine net, breaches, broken
  promises and current vote, the open promises and asks, and the recent rows.

## The record, and replay

Tables: lakes (id, code, opened_at, secret, secret_hash, model); families
(id, lake, seat 0–7 in joining order with bots after the people, name,
name_key, token or null for a bot, bot kind or null); lake_ledger (id, lake,
at, step or null before the start, kind, family or null, data as JSON, key
or null). The ledger is append-only (triggers), with at most one open, one
start and one end row per lake, and one rule row per year.

Row kinds and their data:
- open {}; join {name}; start {families: [{seat, name, bot}], capacity,
  model, secretHash, startedAt}
- throw {x, y, fine, breach, under}: under is how many fish the net could
  hold under its ring at that step, for the empty-net answer; key is the
  idempotency key
- haul {throw: the throw row's id, got, fry, slipped, koi, rival}: rival is
  the seat of a family whose net closed in the 6 steps before, within 84
  units, and took fish, or null
- buy {}; ask {to}; answer {from, yes}; broken {to}: a promise broken by a
  fine net; seal {to, seal}; vote {year, rule}
- build {parts: [...], left} at each winter, one row per family that built
- rule {year, rule, votes}; end {secret, step, kept: [...], parts: [...],
  grownFish, nextYear}

Where the fish are is never stored. A lake is rebuilt by makeLake(secret)
and stepping: before each step, the throw rows for that step are cast in id
order; after it, the hauls must equal the haul rows (a test checks this for a
whole season). On restart, each started lake without an end row is rebuilt
to the step of its last row, then stepped on to the present with nobody
throwing, bots included (they act again only from the step the server came
back at).

The end row's nextYear is computed by nextYear() on a copy of the lake in the
step the season ends. It holds the server up for a fraction of a second, once
per season; if logs show that delaying other lakes' frames, it moves to a
worker thread (decided then, not now).

## The debrief

The first screen answers three questions: what happened to my house (the
house, fish kept, its place among the families); what happened to the lake (how
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
lakes. Blame numbers for who killed a lake. Art generated at run time, or by
an image model (art is SVG and Three.js code in this repo, written by Claude
in chat or in a session, and said so in PROCESS.md). Restocking a dead lake
(in /play a dead lake is never refilled: the room says "This lake died" and
the next match starts a new lake). Trading, loans, alliances: one
negotiation (the promise) first.

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

## The page (v2.3)

The live page is drawn by `src/static/lake.js` from three things only: the
snapshot embedded in the page (`<script type="application/json" id="boot">`,
with `<` escaped), the rows and frames on the stream, and the answers to its
own POSTs. It never decides an outcome. What it adds is drawing and words.

- **Where everyone sits.** The houses stand round the shore, evenly spaced;
  your own house is always at the bottom, so every player sees the lake from
  their own shore. A family's colour comes from its seat (bots keep their own:
  Old Wang blue, Jin gold, Mei green). Bots are known by their reserved names.
- **The fish.** Drawn 230 ms (2.3 steps) behind the newest frame, between the
  two frames around that moment, so motion is smooth at five frames a second.
  The page's clock is the frames': the smallest (arrival time − step × 100 ms)
  seen, creeping up 1.5 ms a frame. A new fry in a frame draws a heart.
- **My net.** It flies from my shore the moment I tap (a ghost), and the throw
  row replaces it. A refusal removes it and says why in words ("Your net is
  still drying", "The lake is frozen until spring", "That's the shore"). The
  drying ring runs from my last throw row's step to that step + 35. A network
  failure retries once with the same key.
- **Every net.** Drawn from its throw row until its haul row, which shows
  +n, or "empty" with why: "X got there first" (the haul's `rival`), "missed:
  no fish there" (the throw's `under` was 0), or "they swam off". A coarse
  net shows the fry that slipped through.
- **Promises and seals.** Tap a family's card: four seals and, while fishing
  with nothing open between you, "Ask for a promise". An ask to me shows
  Promise / Say no. An open promise is a red thread between two houses; a
  broken row snaps it and stamps 失 on the house that broke it. A breach
  stamps 违 where the net landed.
- **The meeting.** Opens when the clock reaches winter: three facts (grown
  fish now, fry netted this year, who has fine nets, promises broken and
  breaches), every family's portrait with its vote stamp as vote rows arrive,
  and the four rules. The rule row closes it and shows the New Year card.
- **Phones.** A finger shows the ring 70 units above itself, drags, and throws
  on lift. Fish are drawn larger below 900 px; nets always true size. Your
  basket and the fine-net button stay pinned at the bottom.
- **Keyboard.** The lake is focusable: arrows aim, Space or Enter throws, B
  buys, F switches nets, Esc closes the seal box. Cards and votes are buttons.
- **Reconnecting.** The browser's EventSource reconnects with the last row id;
  rows after it replay, rows already seen are ignored, and the snapshot that
  follows replaces the families, rule, votes, asks and promises. A chip says
  "live" or "reconnecting…".
- **The lobby** lists who has joined and updates without a refresh: the stream
  works before the start (join rows, then `reload` when the season starts).
- **The debrief** (first screen): your house, the lake's verdict (next year
  ≥ 60% of what you found: "Fish to spare"; ≥ 2 fish: "Fewer fish"; else
  "Next year, no fish"), and up to six moments taken from the rows. Below:
  every house; a chart of grown fish at the start of each year (the end row's
  `years`), at the end and next year; a table per family; the simulation
  table and what it means; Ostrom; Li Ge; the whole record with the secret.

Server changes this needs: the end row gains `years` (grown fish at the start
of each year reached, the same after a rebuild); `/l/CODE/events` works before
the start; `GET /?code=abcd` answers 303 to `/l/ABCD`.

## Quick Catch (experimental, /b)

What it is. A second, separate game at /b. Its rules are docs/boats/RULES.md
and its plan is docs/boats/PLAN.md. It has its own tables: boat_rooms,
boat_players, boat_matches and boat_inputs. Its model name is BOAT_MODEL =
"boat-sim 0.1". It changes nothing at /l or /p.

The rules that apply to /b exactly as to the lake:
- The server decides every catch, ram, pick-up and score. A browser sends
  only steer, cast and dash.
- Model and game constants live only in src/lib/constants.ts and
  src/lib/game-constants.ts.
- Each match has a 256-bit secret. It appears in no event, frame, page or log.
- Every random stream is sfc32 seeded from SHA-256(secret | name).
- No Math.random() in src/lib or the server. boat.js uses it only for
  particles and screen shake, which are drawing, not state.
- The Origin check, the cookie identity per room, and the name rules.
- Nothing from "Not building". Never edit a test to make it pass.

The four lake rules /b does not follow, and why:

a. The record. A boat match's ledger is its boat_matches row (secret, seats,
   model, start time) plus boat_inputs, which is append-only, each input
   stamped with the tick that applied it. Boats, nets and holds change 20
   times a second with no row of their own; the state at any tick is
   replay(secret, seats, inputs up to that tick). The status, results and end
   time on boat_matches are a summary written once when the match ends. They
   can be recomputed by replay, so they are not ledger rows, and that one
   UPDATE is the only one allowed.
b. Writes on the timer. The boat timer writes the inputs it applies (with
   their tick) and the match's end. An input only becomes a fact when a tick
   applies it (a steer is "latest wins" in its tick; a cast or dash counts
   once per tick), so the request handler cannot know its row.
   POST /b/CODE/in answers "queued", never "caught".
c. Restarts. A running boat match is marked interrupted and its room goes
   back to the lobby. A two-minute live race cannot go on without its
   players, and stepping it on to the present would sail boats nobody steers.
   Nothing carries across matches, so only that race is lost.
d. Streams. boat-sim has two streams: "lake" (fish, breeding and the golden
   carp) and "bots" (every bot decision in tick order). Replaying a boat match
   re-runs the bots. That is why a replay needs the same BOAT_MODEL, and any
   change to bots, rules or stream use needs a new one.

## One lake, four games (v3.0)

This part describes /play. Everything above it still describes /l, /p and
/b, which keep working as they are. It translates Ava's plan of 15 October
("第五次修正：四个模式都要", sections 1 to 6) and the session-13 depth and
clarity rules. Where the two differ, the session-13 rules are newer and win;
the plan's number is kept in brackets.

### The goal

One multiplayer lake game with four genuinely different ways to play. A
player picks a different game, not the same game with other numbers. Each
mode has several actions that affect each other. The theme stays: everyone
shares one lake, and the harder you fish today, the fewer fish there are
later. Each mode makes that dilemma appear in its own way, never by a storm
that makes everyone lose.

### The lobby flow

1. Open /play: the 3D lake and the four modes.
2. Pick a mode: a short animation, its goal in one sentence, players and
   length.
3. Pick a character (portrait), then open a room or type a room code.
4. In the room, the mode's goal and win rule sit above the Start button.
5. Start, play one match, then results (portraits and the match's
   highlights).
6. At the same table: Rematch, or Change game, with no new link and no new
   name.

Only modes that can be played get a Start button. An unfinished mode still
shows its card, marked with a date ("Coming: 10/28"), and never leaves the
menu. "First playable" means: a room can be opened, two or more people can
play from the start to the results, and they can rematch. A menu card alone
does not count.

The plan moves the old game (the five-year lake, /l and /p) to a "Classic"
entry and makes the lobby the home page, keeping all data. That move is not
made yet: "/" does not change in session 13.

### What was promised, and when

| Mode | Promised (the preview, word for word, is the scope) | Due |
|---|---|---|
| Boat Rush | Each player sails a small boat round the lake: move, cast, ram, chase the golden carp, upgrade the boat. A match is 2 minutes. | Phase 1 (before 10/21) |
| Fishing Party | Five short rounds: shoal scramble, koi chase, tug of line, lantern night, last net. The lake's fish carry over between rounds. An 8-second shop between rounds: big net, fast boat, bait. "Fish hard early and later rounds have fewer fish." | Phase 2 (before 10/28), all five rounds in the first playable |
| Who's Poaching | One secret poacher steals with a fine net. Everyone fishes, inspects a neighbour's basket and votes at a meeting. Fishers win by exposing the poacher while the lake lives; the poacher wins if the lake dies or they are never found. | Phase 2 (before 10/28), ready for the crit's group playtest |
| Lake Holdings | Place nets, ponds, fences, cormorants and lanterns, fight neighbours for water; fish swim towards water nobody fishes. A payout every 15 seconds, 3 minutes a match, land plus harvest = score. | Phase 3 (before 11/4), all five buildings in the first playable |
| Lobby | Pick your mode once inside. | Phase 1 |

### Boat Rush (rush 1.0)

The experience: handling and risk. Every trip asks "one more cast, or home
now?" 2 to 4 boats (bots fill empty seats when asked), 2.5 minutes.

Win (stated at the start): the most fish banked at your own dock when the
horn blows. Fish still aboard count for nothing.

Actions: sail (tap or drag); cast at the bow; charge cast (hold to widen
the net up to 1.6 times; it sinks 0.3 s slower, so fish may escape); dash
and ram; scoop spilled fish; unload at your dock; upgrade at your dock.

Rules kept from boat-sim 0.1: a hold of 10, slower when full, unload at your
own dock, a ram spills at most 3 fish, a boat that was hit is shielded, no
ram near a dock, spilled fish float and can be scooped, the golden carp is
worth 5.

New in rush 1.0:
- Upgrades at your dock, paid from banked fish, at most two a match: Big
  Hold (+5), Fast Hull, Wide Net, Iron Bow (a ram you deal spills 1 more, a
  ram you take spills 1 fewer). Spending lowers your score now for speed
  later.
- Schools scatter after a net hits them.
- The reed shallows: dense fish, but boats there move at half speed.
- The leader's boat wears a crown; ramming it spills one extra fish.
- The last 30 s are "Lantern Rush": fish banked then count double.

Leading: go home often, buy Iron Bow, guard the golden carp. Behind: chase
the carp, ram the leader's full boat, gamble on a full hold in Lantern Rush.
The second match differs by upgrade route, learned timing, and the seed's
schools. First playable: Quick Catch's rules plus upgrades, charge cast, 3D,
characters and the lobby. boat-sim 0.1 is unchanged for /b; rush 1.0 is a
new model.

### Fishing Party (party 1.0)

The experience: novelty and rhythm; every round is a new game with new
controls. 2 to 4 players, about 6 minutes [plan: about 5]: five rounds of
35 s [plan: 20 s] and an 8 s shop between rounds.

Win (stated at the start): the most coins after five rounds. The last round
pays double.

The five rounds (Ava's five; none replaced):
1. Shoal Scramble. Schools surface for 1.5 s at points the server chooses;
   tap the spot. The first net there takes the school.
2. Koi Chase. Steer through gates after the golden carp. The first to touch
   it scores, and every gate passed pays 1.
3. Tug of Line. Pairs on one big fish. A needle sweeps; a reel inside the
   green zone pulls, outside it slips. Mashing is rate-limited by the server.
4. Lantern Night. Each seat sees only the fish within its lantern's radius
   (frameFor). A lantern you drop lights a spot for everyone for 10 s.
5. Last Net. Everyone secretly picks small (3), medium (6) or huge (10). If
   the sum exceeds the school, everyone gets 1. Coins are doubled.

Between rounds, an 8 s shop: Big Net (bigger catch next round), Fast Boat
(faster next round), Bait (schools swim to you first next round), and
Muddy Water, which only players behind the leader may buy and which shrinks
the leader's view next round. The last-placed player picks one of two
variants for the next round (for example, tug alone or in pairs).

The lake carries over: rounds 1, 2 and 4 draw from it and fish taken do not
come back; Last Net's school is what is left. Before round 5 the screen says
so ("You fished hard early; this is what is left"). Standings with portraits
between rounds. A second match reorders rounds 1 to 4 by the seed (Last Net
is always last). First playable: all five rounds, the shop, the lake carried
between rounds, Last Net doubled, final standings.

### Who's Poaching (poach 1.0)

The experience: suspicion, deception, deduction, trust. 4 to 8 people (bots
only for practice), three days and two meetings, about 8 minutes.

Roles: Fishers; 1 Poacher (2 at 7 or more seats); 1 Warden at 6 or more.
Each seat is sent only its own role.

Win: Fishers win if every poacher is exiled while lake health stays above
40%. The Poacher wins if health falls below 40%, if they survive day 3, or
if two innocents are exiled.

Day (75 s [plan: 60 s]): everyone fishes for the village quota (a bar at
the top).
- Anyone can inspect: stay within 6 units of a boat for 3 s to see its
  basket. Only the inspector sees the result; the target is told someone
  looked.
- Anyone can drop one buoy a day. It logs who passes, and the log is shown
  at the meeting.
- The Warden inspects once a day without coming close.
- Poacher only: the fine net (fast, takes fry, lake health drops); dump fry
  (destroys evidence, but the fry still die); plant fry (2 s alongside
  another boat puts fry in its basket; any boat within 10 units sees a
  splash).
- Each day ends with an announcement of the fry lost in each bay.

Meeting (90 s): portraits round a table. Set phrases only: "I was in
[bay]", "I inspected [X]: [clean / N fry]" (true or not), "I suspect [X]",
"I vouch for [X]", "Skip". No free text and no chat; people talk face to
face. Then a vote; ties and skips exile nobody. An exiled player's role is
revealed. Lake health is always shown.

First playable: 4 to 6 people, one poacher, three days, inspect, buoy, fine
net, dump, plant, set phrases, vote, the reveal; the Warden at 6 or more.

### Lake Holdings (holdings 1.0)

The experience: spatial strategy, economy and counterplay. 2 to 4 players,
3 minutes, a tide every 15 s (12 tides).

Win: tiles held plus fish harvested; the leader is shown, and the tie-break
is stated on screen.

The board is a hex lake (the v7 layout). Each player starts with 3 shore
tiles. The current comes from a seeded flow field and schools drift along
it. Each player holds 3 cards and draws back to 3 after each tide: Net,
Pond, Fence, Cormorant, Lantern and Claim.

At each tide:
- nets take from the schools passing them;
- ponds breed fish into the tiles next to them (neighbours benefit too);
- fences turn the current on their tile;
- a cormorant steals 2 from an enemy net within 2 tiles, once per tide;
- lanterns pull schools within 3 tiles, for two tides;
- over-netted lanes thin, and the board shows it.

Claim takes empty water next to yours; taking an enemy tile costs 2 cards.
Before you place a card, the tile shows what it would have paid last tide.
First playable: the hex board, the current, all five buildings and Claim,
a tide every 15 s, 3 minutes, standings.

### What is shared, and what is not

Shared: the lobby, rooms, identity (a cookie per room), the name rules,
room codes; the server-run framework (each mode has its own make, step and
frameFor; the platform only steps and sends); the 3D scene (lake, sky,
shore, village, light), boat and fish models, portraits, sounds, the results
screen; and "the lake remembers".

Not forced to be shared: controls (sailing, rhythm taps, set phrases,
cards); state and scoring (fish, coins, suspicion and roles, tiles); pace
(real time, rounds, day and meeting, a tide every 15 s); and the picture
(the same lake, but each mode has its own camera, light and HUD).

### frameFor(sim, seat)

/b sends every viewer the same frame. Who's Poaching (secret roles) and
Lantern Night (only what a lantern lights) need each seat to get its own.
So every mode builds its frame with frameFor(sim, seat), separately for
each seat, and a frame holds only what that seat may see. A secret (a role,
fish in the dark, an inspection result) is never sent to a seat that may
not see it. Boat Rush's frames happen to be the same for everyone.

### The platform

Every mode implements one interface (src/lib/game-platform.ts): id, model,
seats {min, max}, make(seed, seats, lake), input(sim, seat, raw) (validate
or drop), step(sim, inputs), frameFor(sim, seat), over(sim), results(sim)
(which includes the lake left), bot(sim, seat, rng).

Tables: game_rooms (code, mode, lake_fish), game_players, game_matches
(mode, model, seed, seats, status, summary) and game_inputs (append-only:
tick, seat, input). A room has at most 8 seats. The hub steps every running
match 20 times a second and sends frames 10 times a second. The four
exemptions in "Quick Catch" (a to d) apply to every /play mode, with the
model name being each mode's `model`; bot decisions use a stream per bot,
tick and seat seeded with SHA-256(secret | bot | tick | seat).

The lake remembers: a match starts with its room's lake_fish (220 for a new
room) and its results write back what is left. Between matches the lake
regrows 15% of the gap to 220. Below 40 the room shows "This lake died" and
the next match starts a new lake of 220.

Playtest instruments: every match's summary stores, per seat, the count of
each input kind, the seconds to the first scoring action, and the final
score; and per match, the duration, the lake before and after, and who asked
for the rematch. GET /play/CODE/summary.json returns a room's summaries
(no tokens, and no seeds of unfinished matches).

### Clarity (every mode)

- C1. Before the start, one card: the goal in one sentence, three icons for
  the three main actions, and "The choice that matters: ..." in one line.
  Then 3-2-1.
- C2. For the first 20 seconds, coach marks react to what the player has not
  done yet ("Tap the water to sail", "Fish ahead: tap CAST") and stop once
  they have.
- C3. The goal and the clock are always on screen ("Most fish home wins ·
  1:42").
- C4. Every server event has visible and audible feedback: a float, a sound,
  a small shake for hits, a banner for big moments.
- C5. Results: a podium with portraits, three highlights computed by the
  server (best trip, biggest loss, closest call), what the lake has left,
  and "Rematch" and "Change game".
- C6. A two-player room plays well: bots fill seats when asked, are always
  named as bots, and never claim to be people.

### Presentation: 3D and portraits

- Three.js 0.160.0, vendored as one file, stylised low-poly with toon
  outlines, in New Year print colours (vermilion, jade, ink, gold). The water
  is a shader written here; at night lanterns glow by emissive colour, not
  real lights, so phones can run it.
- 3D is only the picture. The server's frames are the same whether drawn in
  2D or 3D, so the 3D adds no rule.
- Six original characters drawn as SVG: Mei (阿梅), Old Wang (老王), Jin
  (阿金), Lu (小鹭), Lian (莲娘), Shitou (石头), each with a boat colour.
  They appear at the character pick, the Poaching meeting table and the
  results podium. One expression each in the first version; the
  "suspicious / surprised" expressions for Poaching are phase 2.
- The visual target is prototype v7 (prototype-v7-lobby-3d.html). Its art
  code is reused. Its game logic is a browser mock and is not.

### Decisions (provisional, Ava confirms on review)

1. The room's lake remembers between matches: on. The next match in the
   same room, in any mode, starts from what the last one left, regrown a
   little. The lobby says "This room's lake remembers."
2. Six characters: Mei, Old Wang, Jin, Lu, Lian, Shitou, each with a boat
   colour.
3. The order of the work: the lobby, 3D and Boat Rush first; Who's Poaching
   and Fishing Party second (Poaching before the 10/28 crit, which is the
   only group of four or more); Lake Holdings third.
4. Two rule changes: Three.js may be vendored as one ES module file under
   /static/vendor; and "AI-generated anything" in Not building becomes the
   art rule (art is SVG and Three.js code written by Claude, said so in
   PROCESS.md; nothing generated at run time; no image model).

### Timeline (from the plan)

| Phase | By | Delivers | People playing |
|---|---|---|---|
| 0 | 10/16 | DESIGN v3.0 and CLAUDE.md (one commit); per-seat frames | none |
| 1 | 10/20 (C10 cutoff 10/21 13:30) | Lobby, 3D, portraits, Boat Rush with upgrades, playtest instruments | Ava and one more, phone and desktop |
| 2 | 10/27 | Who's Poaching and Fishing Party first playable | the 10/28 crit group (4 or more) on Poaching; Party 2 to 4 |
| 3 | 11/3 | Lake Holdings first playable; the three others revised after playtests | the 11/4 group |
| 4 | 11/8 | Polish, README, PROCESS, reflection | none |
| Due | 11/9 12:00 | | |

No mode is quietly cut to save time. If one truly cannot be finished, the
evidence, the remaining work and two or three alternatives go to Ava, who
decides.

## Changelog

- v3.0 (15 Oct): one lake, four games at /play (Boat Rush, Fishing Party,
  Who's Poaching, Lake Holdings), per-seat frames, the lake that remembers,
  clarity and depth rules; Three.js vendored; the art rule replaces
  "AI-generated anything". Section 7 decisions are provisional.
- v2.4 (15 Oct): Quick Catch, an experimental second game at /b (boats,
  docs/boats/RULES.md), and the four lake rules it does not follow.
- v2.3 (13 Oct): the page; the end row's years; a lobby stream; three runner
  bugs found by playing (bots stopped throwing after the first winter, bots
  voted at the meeting's first step, the tally ignored bots' votes).
- v2.2: the server. The golden carp is part of the model; the sims stop at a
  dead lake, as the game does, and a family keeping the shallows rule never
  lands past the line (numbers re-run). Throws apply at the runner's next
  step in ledger order. Secret storage, bot streams per step and seat, bot
  timing, which family Old Wang asks, Jin buying under a ban. Promises work
  between people. The runner, pages and routes, refusal reasons, frames and
  events, tables and row kinds, rebuild and restart.
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
