# Next Year, No Fish (明年无鱼): design v4.0

## What it is

One lake. Everyone fishes it. What you take today, someone else can't catch
tomorrow. A multiplayer game for phones and laptops: open a room, send the
link, pick one of four games (Boat Rush, Fishing Party, Who's Poaching, Lake
Holdings), and the room's lake remembers what each game left.

This file describes only the current game, at "/" and /play. The earlier
designs, which still run with their data, are kept word for word in
docs/design-history/:

- the ponds (/p, "Common Pool"), v0.4: docs/design-history/ponds-v0.4.md
- the five-year lake (/l, home page now at /classic), v2.3:
  docs/design-history/five-year-lake-v2.3.md
- Quick Catch (/b), v2.4: docs/design-history/quick-catch-v2.4.md

They are frozen: no new features, and they keep running.

## The site

Every page has the same top bar: the seal and the name (to "/"), Play, How to
play, About, How it was made, and the EN/中文 switch. The structure and the
words are those of the site plan v8 mock (site-plan-v8.html), without its
"Site plan v8" banner and its example data.

| Page | What it shows |
|---|---|
| / | The one-line idea, "Play with friends" (opens a room), "Join with a code", the three steps, the four game cards (one line, players, minutes, "The choice that matters", Play, How to play), "The lake remembers". |
| /how, /how/MODE | One page per game (/how is Boat Rush's): how you win, the choice that matters, five numbered steps with a small picture each, controls for phone and laptop, what the shared lake does. |
| /play/CODE | The room: the code and a Copy link button, who is here (live, from the room's stream), pick a game, Start, this room's lake, and "What happened here": the room's finished matches from game_matches (when, game, winner, lake before → after; no seeds, no tokens). During a match, the game. |
| /readme/ | README.md, inside the same top bar. |
| /making-of | The four versions, why each one changed, and a link to each one that still runs. |
| /classic | The five-year lake's home page, moved from "/". |

/l/CODE, /p/ID and /b keep working at their URLs with their data. They are
linked only from /making-of (and from /classic, which is the five-year
lake's own home). GET /play, the lobby of v3, keeps working for links made
before v4.0: it shows the four games and the six fishers and opens a room.

## Languages

Every page of the site exists in English and Chinese. English is the
default. The top bar's EN/中文 switch posts to /lang, which sets a `lang`
cookie (en or zh; a year; SameSite=Lax) and answers 303 back to the page.
The server renders the chosen language, so every page's headings are in the
HTML it sends. Every visible word comes from src/lib/i18n.ts; a key missing
in either language fails a test. Two people in one room may use different
languages: the server sends codes and numbers, and each page words them.
Meeting phrases and result highlights are sent as codes for this reason.

README.md stays English (the course reads it at /readme/). In Chinese,
/readme/ shows it with a one-line note that it is in English. The frozen
versions stay English.

## One lake, four games

This part translates Ava's plan of 15 October ("第五次修正：四个模式都要",
sections 1 to 6) and the session-13 depth and clarity rules. Where the two
differ, the session-13 rules are newer and win; the plan's number is kept in
brackets.

### The goal

One multiplayer lake game with four genuinely different ways to play. A
player picks a different game, not the same game with other numbers. Each
mode has several actions that affect each other. The theme stays: everyone
shares one lake, and the harder you fish today, the fewer fish there are
later. Each mode makes that dilemma appear in its own way, never by a storm
that makes everyone lose.

### The flow

1. Open "/": the idea, the four games, "Play with friends" and "Join with a
   code". Each game's card links to its rules (/how/MODE).
2. "Play with friends", or a card's Play, opens a room (/play/CODE) with that
   game picked. "Join with a code" goes to a room by its four letters.
3. In the room, each person joins with a name and a character (portrait).
   The room shows the code and a Copy link button, who is here, the four
   games, and the picked game's goal and win rule above the Start button.
4. Start, play one match, then results (portraits and the match's
   highlights).
5. At the same table: Rematch, or Change game, with no new link and no new
   name. "What happened here" lists every finished match.

Only modes that can be played get a Start button. An unfinished mode still
shows its card, marked with a date ("Coming: 10/28"), and never leaves the
menu. "First playable" means: a room can be opened, two or more people can
play from the start to the results, and they can rematch. A menu card alone
does not count.

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
  ram you take spills 1 fewer). The first upgrade costs 3 banked fish and
  the second 7, whichever they are. The start card lists them with their
  prices; your dock glows when you can afford one, and after your first
  unload a coach mark asks "Spend fish on an upgrade?". Spending lowers your
  score now for speed later.
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

Between rounds, after the standings, the last-placed player gets a 4 s
screen to pick one of two variants for the next round (only that player is
sent the choice; everyone else sees who is choosing). Then an 8 s shop: Big
Net (bigger catch next round), Fast Boat (faster next round), Bait (for the
first 10 s of the next round, fish within two lantern radii swim to you), and
Muddy Water, which only players behind the leader may buy and which shrinks
the leader's view next round. Tug of Line's needle is drawn over the fish on
the lake and as a full-width bar at the bottom of the screen.

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

Meeting (90 s; every day ends in one, so there are three): portraits round a table. Set phrases only: "I was in
[bay]", "I inspected [X]: [clean / N fry]" (true or not), "I suspect [X]",
"I vouch for [X]", "Skip". No free text and no chat; people talk face to
face. Then a vote; ties and skips exile nobody, and a meeting that exiles
nobody costs the lake 5 points of health ("the poacher worked the night
unwatched"). A meeting ends as soon as everyone still in has voted (or
skipped, where Skip exists): the vote is counted within a tick and the reveal
follows. A meeting where someone has not voted ends at 90 s. The last
meeting, after day 3, has no Skip, and the most votes go. A tie there is
drawn by the server when everyone voted; if anyone did not vote by 90 s they
abstained, and a tie then exiles nobody, so the poacher has survived day 3
and wins. If nobody votes at all, nobody goes. An exiled player's
role is revealed. Lake health is always shown. At the results, each
player's contribution to the quota is shown.

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
- nets take 2 from every school on or beside them, and each school stays
  smaller;
- a school smaller than 3 dies out and its water runs dry (grey on the
  board); a school on dry water loses a fish a tide; only a pond beside it
  brings dry water back;
- ponds breed 3 fish into the tiles next to them (neighbours benefit too);
- fences turn the current on their tile;
- a cormorant steals 2 from an enemy net within 2 tiles, once per tide;
- lanterns pull schools within 3 tiles, for two tides;
- over-netted lanes thin, and the board shows it.

Claim takes empty water next to yours; taking an enemy tile costs 2 cards.
Every net shows what it paid last tide, all game. While a card is selected,
every tile it could go on shows what a net there would have paid last tide,
and the best three are marked.
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
exemptions below, written for Quick Catch (/b), apply to every /play mode, with the model name
being each mode's `model`: a (the record), b (timer writes) and c
(restarts) as written. For d (streams), /play is stricter than /b: each
bot's decisions in one tick come from their own stream, SHA-256(secret | bot
| tick | seat), and the hub stores bot inputs as applied, so a replay never
runs a bot (CLAUDE.md's lake rule). A mode's own random draws use named
streams of the secret ("lake" and so on).

The lake remembers: a match starts with its room's lake_fish (220 for a new
room) and its results write back what is left. Between matches the lake
regrows 15% of the gap to 220. Below 40 the room shows "This lake died" and
the next match starts a new lake of 220.

Playtest instruments: every match's summary stores, per seat, the count of
each input kind, the seconds to the first scoring action, and the final
score; and per match, the duration, the lake before and after, and who asked
for the rematch. GET /play/CODE/summary.json returns a room's summaries
(no tokens, and no seeds of unfinished matches).

#### Quick Catch's four exemptions (DESIGN v2.4, kept because /play follows them)

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

## Not building

Chat, or free text other than a family name. Accounts. Leaderboards across
lakes. Blame numbers for who killed a lake. Art generated at run time, or by
an image model (art is SVG and Three.js code in this repo, written by Claude
in chat or in a session, and said so in PROCESS.md). Restocking a dead lake
(in /play a dead lake is never refilled: the room says "This lake died" and
the next match starts a new lake). Trading, loans, alliances: one
negotiation (the promise) first.

## Decisions and timeline

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

- v4.0 (19 Oct): one site, two languages. "/" is the current game's home
  (the site plan v8: /, /how, /how/MODE, the room, /readme/, /making-of);
  the five-year lake's home moves to /classic; every page in English and
  Chinese from src/lib/i18n.ts, chosen by a `lang` cookie; meeting phrases
  and highlights travel as codes. The designs of the ponds, the five-year
  lake and Quick Catch move word for word to docs/design-history/. No game
  rule changes.
- v3.2 (15 Oct): a Who's Poaching meeting ends as soon as everyone still in
  has voted (no 90 s wait); at the last meeting a non-voter abstains, and a
  tie with an abstention exiles nobody.
- v3.1 (15 Oct): Fishing Party's variant pick is its own screen, bait has a
  range and a time, the Tug needle is on the lake. Lake Holdings nets take 2 from every school; dry water,
  revived only by ponds; paid labels and card previews. Boat Rush upgrades cost 3 then 7, shown on the start card,
  with a dock glow and a coach mark (balance numbers in
  docs/checks/balance-2026-10-15.md). Who's Poaching after the balance
  harness (bots only): a
  meeting after day 3 with no Skip; a meeting that exiles nobody costs the
  lake 5; the results show each player's quota. The fine net's cooldown is
  1.5 s (was 0.6), because the bot poacher sank the lake below 40% on day 1
  in 39 of 40 seeded games, before any meeting.
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
