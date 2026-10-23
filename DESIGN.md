# Next Year, No Fish (明年无鱼): design v5.1

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
| /play/CODE | The room, a normal page that scrolls and has nothing of the game on it (no canvas, pads or HUD): the code and a Copy link button, who is here (live, from the room's stream), pick a game with the card for it (C1), Start, this room's lake, and "What happened here": the room's finished matches from game_matches (when, game, winner, lake before → after; no seeds, no tokens). When a match starts, every seat's browser goes to /play/CODE/game. |
| /play/CODE/game | The game, full screen: no site header and nothing else to click. The 3-2-1, the match, then the results with Rematch, Change game and "Back to the room". With no match and no results it sends the player back to the room. |
| /readme/ | README.md, inside the same top bar. |
| /making-of | The four versions, why each one changed, and a link to each one that still runs. |
| /classic | The five-year lake's home page, moved from "/". |

/l/CODE, /p/ID and /b keep working at their URLs with their data. They are
linked only from /making-of (and from /classic, which is the five-year
lake's own home). GET /play, the lobby of v3, keeps working for links made
before v4.0: it shows the four games and the six fishers and opens a room.

## UI rules

- The game is full screen on its own page (/play/CODE/game) and is never embedded under another page.
- Every other page scrolls. Only the game page fixes the body.
- Nothing that only informs (floating text, boat tags, banners, coach marks, hints, the 3-2-1) takes pointer events. Only a screen that needs a choice (the start and results sheets, the meeting) covers the game, and only its own controls take taps.
- "Stop match" is in the host menu (⋯, shown to the room's first player during a match) and asks for a confirmation on the page, not a browser dialog.
- Player-facing pages (/, /how/*, the room, the game) carry no course text. /readme/ and /making-of may name the project's history, in plain words. The footer is the game's own line, "明年无鱼 · Next Year, No Fish", in both languages.
- Quoted words in Chinese use 「」. A place reads 1st, 2nd, 3rd, 4th in English and 第 N 名 in Chinese. A bot is named through the dictionary: Jin (bot), 阿金（机器人）.

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


## Where each mode stands

DESIGN v5.0 is the target for all four modes. It is built one mode at a time,
and until a mode is built, the live game still follows its v4.0 text
(docs/design-history/four-games-v4.0.md). The tests, not this table, say what
runs.

| Mode | Follows | Built in |
|---|---|---|
| Boat Rush | v5.0 (rush 2.0) | session 17, part A |
| Who's Poaching | v5.0 (poach 2.0) | session 18 (23 Oct, in chat) |
| Lake Holdings | v4.0 (holdings 1.0) | part C |
| Fishing Party | v4.0 (party 1.0) | part C |

## One lake, four games (v5.0)

### Why v5

Ava played every mode on a phone and a laptop on 19 October.
- Boat Rush was the only mode she could follow.
- Fishing Party, Who's Poaching and Lake Holdings were "impossible to
  understand".
- Lake Holdings did not work at all: a client error on the first tap.

What she asked for:
- a complete flow at every step;
- a bigger and more varied scene;
- controls that do not sit next to things you can hit by mistake;
- the standard of real games.

The four modes stay, with the scope Ava set. Each one now has a step-by-step
flow, and all four share one world and one ending.


### Principles (every mode)

P1. **One sentence, one verb, before you play.** Each mode opens with a
rules card. Each round of the party opens with an intro card. A card has:
- three pictures, one sentence each;
- "the choice that matters";
- the controls for this device.

P2. **Teach by doing.** Boat Rush has a 30-second practice. The party lets
everyone try a round before it counts. Coach marks point at the next thing
to do and disappear once it is done.

P3. **One new thing at a time.** Boat Rush adds one change per season. Lake
Holdings shows a preview before anything is placed.

P4. **Every action answers.** A float, a sound, a ripple. A shake for a hit.
A banner for a big moment.

P5. **The ending tells the story.** Every mode ends with the same three-step
ceremony about next year's lake.

P6. **Nothing that only informs takes a tap.** Toasts, banners, floats,
coach marks, tags and the fog all have `pointer-events: none`. Only a
screen that needs a choice covers the game: rules, market, meeting, shop,
ceremony.

P7. **Thumbs away from the edges.**
- The pads sit at least 22 px, and the safe area, above the bottom edge.
- On phones you sail by dragging anywhere on the left side, with a stick
  that appears under your thumb.
- On laptops: WASD or the arrow keys, Space and Shift, plus clicking the
  water.


### The world (shared)

- **The lake** is a lobed oval about twice the old size: 92 × 64 units.
  The radius at angle a is
  `1 + .09 sin(2a+.6) + .06 sin(3a+2.1) + .035 sin(5a+.3)`.
- **The island** sits at (10, -15), radius 7.5, with a pagoda. Boats and
  fish go round it. The deep water around it is the 深潭.
- **Named places:**
  - the reed bed 芦苇荡, west-north-west: the nursery, where young fish live
    and boats move at 0.62 speed;
  - the lotus pond 荷花塘, north-west;
  - the river mouth 河口, north-east, with a stone bridge;
  - the island 湖心岛;
  - four bays: 北湾, 东湾, 南湾, 西湾.

  Meeting phrases and labels use these places.
- **The village** is on the south shore: up to six docks, at 66°, 114°,
  42°, 138°, 90° and 18°. Each dock has a house that gains a floor for
  every 18 fish brought home, up to 6.
- **Seasons change the scene:** spring blossom, summer lotus, autumn red
  leaves, winter snow. Each has its own palette and falling particles.
  Winter puts ice on the water where the shore distance is above 0.86,
  except within 14 units of a dock. Boats cannot cross ice.
- **The camera:**
  - It follows your boat when you sail. The span is about 118 units wide
    on a laptop, 64 on a phone held upright and 90 on a phone held
    sideways.
  - It shows the whole lake for boards, meetings and the ceremony.
  - A minimap in the top-right corner shows the whole lake. Each mode
    decides what the minimap shows: in Who's Poaching it shows only what
    you know.
- **The lake remembers.**
  - A room's lake is stored as adults and young fish. A new room starts
    with 230 adults and 50 young fish.
  - K = 340.
  - Every mode reads the room's lake at its start and writes back next
    spring: adults = min(K, 0.8 × next) and young = 0.2 × next.
  - Every game writes next spring, computed by `nextSpring()`; there is no
    separate regrowth between matches. A mode whose own year already
    breeds (Boat Rush 2.0's seasons) only has its result capped at K; one
    that does not yet (Who's Poaching, Lake Holdings, Fishing Party, still
    v4.0) has its leftover carried through `nextSpring()`.
  - Below 40 fish, the room says "This lake died" and the next match
    starts a new lake. This is unchanged from v4.
- **Breeding:**
  - `born = adults < 36 ? round(adults × 0.1) : round(1.55 × adults × max(0, 1 − (adults+young)/K) × (1 + bonus))`.
  - Next spring = adults + young + round(0.6 × born).
- **Tiers on next spring as a share of K:**
  - ≥ 0.6: Bountiful 丰收年 ×1.2;
  - ≥ 0.35: Fair 平年 ×1;
  - ≥ 0.15: Lean 歉收年 ×0.8;
  - otherwise: No fish 无鱼年 ×0.5.

  The HUD shows the live tier during play.

### The ceremony (every mode)

1. **Verdict.** The title, then what is left in the lake → next spring,
   counted up. A tier stamp follows: the Chinese characters, with the
   English label under them when the page is in English. Then "everyone's
   catch ×N".
2. **Who took what.** One bar per player, in each mode's own unit (fish or
   coins), with young fish killed in red and a gold fair-share line.
   - Boat Rush adds the counterfactual: "If everyone had taken one fish in
     five fewer, next spring would hold N (tier) instead of M". The server
     computes N by replaying the year's seasons with each catch × 0.8.
   - Then titles, only when someone earned them: 渔王, 守湖人, 细网手,
     撞船王, 锦鲤运.
3. **Podium.** Score = base × tier multiplier, with the base shown. Two
   buttons: "Next year: same lake (N fish)" and "Back to the village"
   (the room).

### The flow

1. Open "/": the idea, the four games, "Play with friends" and "Join with a
   code". Each game's card links to its rules (/how/MODE).
2. "Play with friends", or a card's Play, opens a room (/play/CODE) with that
   game picked. "Join with a code" goes to a room by its four letters.
3. In the room, each person joins with a name and a character (portrait).
   The room shows the code and a Copy link button, who is here, the four
   games, and the picked game's goal and win rule above the Start button.
4. Start, play one match, then the ceremony (below): the verdict on next
   year's lake, who took what, and the podium.
5. At the same table: "Next year: same lake" (the next match starts from the
   fish this one left) or "Back to the village" (the room, where the game can
   be changed), with no new link and no new name. "What happened here" lists
   every finished match.

Only modes that can be played get a Start button. An unfinished mode still
shows its card, marked with a date ("Coming: 10/28"), and never leaves the
menu. "First playable" means: a room can be opened, two or more people can
play from the start to the results, and they can rematch. A menu card alone
does not count.


#### Practice runs in the browser only (an explicit exception)

Boat Rush's 30-second practice (the three-step teaching run before a match) is
simulated in the browser, alone, with no clock. The client's practice decides
nothing about any match: it is never sent to the server, never stored and
never scored, and it cannot be seen by other seats. This is the one place the
client simulates fish, nets and a hold, and it is allowed for that reason
only: a player learns the controls without a room, a server tick or a bot.
Everything in a match, including the same actions, is decided by the server.
The practice uses Math.random() for its fish, as the client already does for
particles; the server never does.

### Boat Rush 开船抢鱼 (2.0)

2 to 4 boats, with bots filling empty seats. About 4 minutes.

**Flow:**
1. The rules card, with "Start" and "Practise first (30 s)".
2. Practice (alone, no clock), three steps with an arrow:
   1. sail to the gold ring;
   2. net the school ahead of your bow (3 fish);
   3. take the fish home and unload.

   Then "You're ready".
3. Four seasons of 45 s each, in the order spring, summer, autumn, winter.
   Each season opens with a banner naming its twist:
   - spring: schools gather at the river mouth and the reeds;
   - summer: the lotus pond and the deep water, with two golden carp;
   - autumn: every fish counts double;
   - winter: ice, and the fish keep to the deep water.
4. The last 10 s are the Rush: faster music, and an arrow home if you
   carry fish.
5. The gong: fish still aboard spoil.
6. The lake breathes, for 4.5 s, with the camera on the whole lake: young
   fish grow up, and the adults breed by the formula, plus Fish Ladder and
   Reed Bed effects.
7. The market, 14 s:
   - one plain, one keeper and one greedy card;
   - a reroll costs 2 banked fish;
   - picks are hidden until the market closes, then everyone sees them.
8. After winter, the ceremony.

**Numbers:**
- hold 12; speed 15, 35% slower when full;
- net radius 4.5, cast 4 units ahead of the bow, cooldown 0.7 s, at most
  6 fish a cast;
- dash 0.4 s at ×2.4, cooldown 4 s;
- a ram spills at most 3 fish; shield 3 s; no ram within 11 units of a
  dock;
- the golden carp is worth 5 and lasts 10 s;
- 8% of adults are big fish worth 2;
- a chain of 3+ fish within 2.6 s adds 1;
- a steer target outside the lake is clamped to the shore on purpose, so a
  tap near the edge still sails the boat there instead of doing nothing.

**Cards** (11): Big Hold, Fast Hull, Wide Net, Quick Hands, Iron Bow and
Golden Hook (plain); Fine Mesh and Trawl (greedy: they take young fish); Fish
Ladder, Let Them Go and Reed Bed (keeper). The wording and numbers are those
in the prototype's RCARDS.

**Bots:** steady, keeper and greedy. These differ in when they go home
(0.75, 0.6 and 0.95 full) and in what they pick at the market.

**Measured in the prototype** (bots only, 6 runs, not people):
- the lake ended No fish ×1, Lean ×2, Fair ×2 and Bountiful ×1;
- the counterfactual was Bountiful in every run (225–271).

### Who's Poaching 谁在偷鱼 (2.0)

4 to 8 players: 1 poacher, or 2 at 7 or more. Three days of 70 s, each
ending in a meeting of at most 55 s. About 7 minutes.

**Flow:**
1. The rules card.
2. **Role reveal**, a full screen shown only to you:
   - your portrait;
   - 渔民 Fisher or 偷鱼贼 Poacher in large brush letters;
   - one sentence on how you win;
   - the whole village's portraits.

   A second poacher (at 7 or more) also sees their partner.
3. **Day**, 70 s, from morning light to dusk:
   - **Your lantern's circle.** You see only within 24 units of your boat
     (the fog). Beyond that, the server does not send boats, fish or dead
     fish. Your own buoy also lights a circle for you.
   - **Tasks.** Each player gets 3 tasks a day at named places, for
     example 收网·北湾 or 数鱼苗·芦苇荡. Stay inside the ring for 2.5 s.
     Each task adds 2 fish to the village for fishers. The poacher's
     tasks are a cover: they count nothing. The task list is on the left
     and the rings are on the minimap.
   - **Net**, for everyone: adults only, at most 3, cooldown 2 s.
   - **Inspect** (查船): stay within 8 units of a boat for 1.5 s. Only
     you learn "clean" or "N young fish". The target is told someone
     inspected them.
   - **Buoy** (浮标): one a day. It logs every boat that passes within 15
     units, with the time, and is shown at the meeting.
   - **Report** (报告): within 11 units of dead young fish nobody has
     reported, call the meeting now.
   - **Poacher only:**
     - **Fine net** (绝户网): cooldown 13 s, radius 5.2, up to 22 fish. It
       leaves a floating patch of dead young fish, the evidence. Every
       boat within 24 units at that moment witnessed it.
     - **Dump** (倒掉): empty the young fish from your boat. That leaves a
       patch too.
   - "👁 N boats can see you" is shown to everyone. It matters most to the
     poacher.
4. **Meeting**, at dusk or on a report:
   - **The map of what you know:**
     - your own path;
     - where you saw each boat, with times;
     - every dead-fish patch you saw or that was reported, with times;
     - buoys and their logs.
   - **The table:** every portrait with their last two statements, your
     private knowledge ("you inspected: clean" or "you saw them use a fine
     net") and a "voted" badge.
   - **Speaking:** chips built from what you actually know, for example
     "I was at 东湾", "I inspected Jin: clean", "I saw Lu at the reeds,
     near the dead fish" or "My buoy at 北湾 saw …". The poacher gets
     plausible lies instead. Tap a portrait to suspect, vouch for or vote
     out. Statements travel as codes, so each page words them in its own
     language. People also talk out loud.
   - **Voting:** tap a portrait, or "Skip". There is no skip at the last
     meeting. The meeting ends when everyone still in has voted.
5. **The tally** shows who voted for whom. Then the exile: the portrait
   drifts away and the text types "X is sent away…", then "X was / was not
   the poacher". With no exile, the lake loses 5%.
6. **Night:** while the poacher is free, the lake loses another 4%
   overnight. That is 6% for the poacher, less 2% recovery.
7. **The end:**
   - Fishers win if every poacher is exiled while health stays at 40% or
     more.
   - The poacher wins if health falls below 40% or they survive day 3.
   - The end screen reveals every role and replays the poacher's path and
     nets on the map. Then the ceremony: score = (fish netted + task fish)
     × tier, +20 for the winning side.

An exiled player becomes a ghost: they see everything and cannot act.

**How poach 2.0 settles what the text above leaves open** (session 18):
- the role card lasts 8 s for everyone (the server's clock, not a button), the
  tally 4 s and the exile 6 s;
- a seat may say at most 4 lines a meeting, each line once; suspect, vouch
  and skip are open to everyone, any other line must be one the server built
  for that seat (what it knows, or, for the poacher, its lies);
- a tie exiles nobody, except at the last meeting, where the tied seats are
  drawn from the match's own stream (and if nobody voted at all, any seat
  still in);
- a buoy lights a circle of 10.5 units for its owner (the prototype's
  0.7 × 15);
- the room's lake keeps the match's health as a share of what the room
  brought (the 40 extra young fish were the match's own), then
  `nextSpring()`;
- bots fill the room to six boats.

**Lake health** = fish now ÷ fish at the start of the match, as a
percentage. The start includes 40 extra young fish in the reeds.

**Measured in the prototype** (bots, 3 runs): the poacher was caught on day
2 or 3 in every run, and health ended near 75%. Bots are easier to read
than people.

**Removed from v4:**
- the Warden;
- planting fry;
- the village quota bar, replaced by tasks.

Ava decides on these: see "Decisions".

### Lake Holdings 抢地盘经营 (2.0)

2 to 4 players. Turn-based, everyone choosing at the same time. Four
seasons with 3 moves each, then the harvest. About 5 minutes.

**The board:**
- Hex tiles of size 8.4 over the lake: every tile whose centre has a shore
  distance up to 0.8, and none on the island.
- Each tile has a cap of `max(4, round(K × w / Σw))`, where w is 1.35 for
  deep water, 1.15 for the reeds and 1 otherwise.
- The lake's fish are spread over the tiles by w.
- Each player starts with the 2 tiles nearest their dock.

**A move:**
1. You hold 3 cards: always the Flag (claim), plus 2 drawn from Net 3,
   Pond 2, Fence 1.2, Cormorant 1 and Lantern 1.2 (weights).
2. Pick a card: legal tiles glow.
3. Hover or tap a tile to see a one-line preview of what it will do, for
   example "Net: takes 7 of the 9 fish here each season; this tile will
   run dry in about 2 seasons". Tap again (phones) or click (laptops) to
   place it.
4. 20 s per move. On time-out the bot's choice is played for you.
5. Reveal: everyone's placements appear one by one. Two flags on one tile:
   the player with fewer tiles gets it.

**The cards:**
- **Flag:** claim an empty tile next to yours.
- **Net:** takes up to 7 a season.
- **Pond:** +2 on its own tile and +1 on every tile around it, anyone's.
  It brings dry neighbours back.
- **Fence:** fish don't swim away from here. Lanterns and cormorants can't
  touch this tile or your tiles next to it.
- **Cormorant:** steals 2 a season from the richest neighbour's net within
  2 tiles.
- **Lantern:** pulls 1 fish a season from each tile around it.

**The harvest,** shown step by step with a banner each:
1. ponds breed;
2. lanterns pull;
3. nets haul, and every other tile you hold that is not dry gives you 2;
4. cormorants steal;
5. the lake breeds on each tile that is not dry, at rate 0.2 (0.4 in the
   reeds) × (1 − fish/cap);
6. fish swim one tile away from each net;
7. empty tiles run dry. Dry tiles stay dry unless next to a pond.

**Next spring for this mode** is the board after one more pond-and-breed
step, and dry water stays dry. Score = fish harvested + 1 per tile, × tier.

**Measured in the prototype** (bots, 5 runs): the lake fell from 260 to
199–209 and 13–15 tiles ran dry, but next spring was still 222–232
(Bountiful). Greed is not punished enough yet. The balance pass must fix
this.

**Removed from v4:**
- the real-time 15 s tide;
- the current's flow field;
- taking an enemy tile.

### Fishing Party 钓鱼派对 (2.0)

2 to 4 players. Five rounds of 28 s. About 5 minutes.

**Every round** goes through the same steps:
1. **The intro card:**
   - "Round n of 5";
   - one brush verb (点！ 追！ 收！ 照！ 选！);
   - the game's name and a picture;
   - one sentence, and the controls for this device;
   - a row of portraits that light up when each player is ready.
2. **Try it first:** the card shrinks to a bar at the top and you play
   without scoring.
3. When everyone is ready, or after 20 s: 3-2-1.
4. 28 s of play.
5. **Standings:** coin bars grow with this round's coins in green, and the
   screen shows how many fish are left in the lake.
6. **The shop,** after rounds 1–3, 9 s. Each item costs 3 coins and lasts
   one round:
   - Big Net: the net is half as wide again;
   - Fast Boat: +25% speed;
   - Bait: fish nearby swim to you for the first 8 s.

**The rounds:**
1. **Shoal Scramble** (tap). Gold rings warn for 0.8 s, then fish jump for
   1.5 s. The first tap within 8 units (11 with Big Net) takes the school:
   2 coins, 2 fish out of the lake.
2. **Koi Chase** (steer). Eight lantern gates in order: 1 coin and 1 fish
   each. Touching the golden carp: 5 coins and 2 fish, and it jumps two
   gates ahead.
3. **Tug of Line** (timing). A needle sweeps and a green zone drifts.
   REEL inside the zone: +9%. Outside: −6% and a 0.35 s stun. Finish
   places pay 6, 4, 2 and 1. No fish leave the lake.
4. **Lantern Night** (steer, net, light).
   - It is dark, and you see fish only within 16 units of your boat.
   - A dropped lantern lights a spot for everyone for 10 s (cooldown 8 s).
   - A net takes up to 2 adults, 1 coin each, cooldown 1.6 s.
5. **The Last Net** (choose, in secret).
   - The school is round(fish left ÷ 7). Before round 5 the screen says
     "You fished hard early; this is what is left" if the lake lost more
     than 15%.
   - Everyone picks 3, 6 or 10. Picks are revealed one by one with a
     drum, and a bar grows against the school's line.
   - If the total fits the school, each player gets double their pick and
     the fish leave the lake. If not, the net tears: everyone gets 1 and
     the school is lost.

**Score** = coins × tier.

**Measured in the prototype** (bots, 1 run after tuning): the last net
held, and the year ended Fair. Before the night round was weakened, two
runs ended Lean with the lake at 23–25 fish.

**Removed from v4:**
- the last-placed player's variant pick;
- Muddy Water.

### What is shared, and what is not

Shared: the lobby, rooms, identity (a cookie per room), the name rules,
room codes; the server-run framework (each mode has its own make, step and
frameFor; the platform only steps and sends); the 3D scene (lake, sky,
shore, village, light), boat and fish models, portraits, sounds, the results
screen; and "the lake remembers".

Not forced to be shared: controls (sailing, rhythm taps, set phrases,
cards); state and scoring (fish, coins, suspicion and roles, tiles); pace
(real time, seasons, rounds, day and meeting, turns); and the picture
(the same lake, but each mode has its own camera, light and HUD).

The move to the v5 world is one mode at a time, not a rescale of the old
scene. `src/static/play/world.js` (the 1000 × 700 ellipse) and
`src/static/play/world5.js` (the 92 × 64 lobed lake of "The world (shared)",
built from `lake-world.ts`'s boot JSON) run side by side while the four
modes move: Who's Poaching, Lake Holdings and Fishing Party send sim
coordinates straight into `world.js`'s drawing calls, so rescaling its
`toWorld` for the new shape would put their boats and fish somewhere that
makes no sense in it (on the new island, say, which their space has no room
for). A mode switches from `world.js` to `world5.js` only when it is itself
rebuilt to v5.0 (Boat Rush first, then Who's Poaching, then Holdings and
Party) and its own client script is rewritten to world5.js's API
(`setCameraMode(mode, target)`, not world.js's `setCamera(pos, look)`) —
`src/static/play/world-select.js`'s `WORLD5_MODES` list says which modes
have moved, and starts empty. `world.js` is deleted only once no mode uses
it. The room's game page keeps one canvas per world, lazily created the
first time a match needs it, so switching games mid-room (DESIGN.md's
"Change game") never tears either down.

### frameFor(sim, seat)

/b sends every viewer the same frame. Who's Poaching (secret roles, and from
2.0 a lantern's view) and Lantern Night (only what a lantern lights) need
each seat to get its own. So every mode builds its frame with
frameFor(sim, seat), separately for each seat, and a frame holds only what
that seat may see. A secret (a role, fish in the dark, an inspection result,
a boat outside your lantern) is never sent to a seat that may not see it.
Boat Rush 2.0's frames are the same for everyone, except that during a market
a seat's card pick is not in anyone else's frame or events until the market
closes.


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

The lake remembers (v5.0): a room's lake is stored as adults and young fish.
A new room starts with 230 adults and 50 young fish (280). A match reads it at
its start; its results write back next spring, from "The world": adults =
min(K, 0.8 × next) and young = 0.2 × next, with K = 340. There is no separate
regrowth between matches: breeding is part of each mode's year (Boat Rush's
rest, every season). Below 40 fish the room shows "This lake died" and the
next match starts a new lake of 230 adults and 50 young.

Confirmed by Ava (session 17 part A, reply to the reading note above):
v4.0's 15%-regrowth-toward-220 rule is dropped outright, for every mode, not
kept for the three still on v4.0. Next spring already is a year of breeding;
stacking the old regrowth on top of it would count breeding twice. One
function, `nextSpring()` (`src/lib/lake-world.ts`), is the single rule for
all four games: split what is left 0.8/0.2 into adults and young, breed
once, cap at K. Boat Rush 2.0 already breeds across its own seasons, so its
result is only capped at K, never passed through `nextSpring()` again.
Who's Poaching, Holdings and Party (still v4.0) write a raw leftover count
with no in-match breeding, so the hub runs it through `nextSpring()` to get
next spring. "Below 40 the lake died" is checked on the stored value either
way.

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


## Not building

Chat, or free text other than a family name. Accounts. Leaderboards across
lakes. Blame numbers for who killed a lake. Art generated at run time, or by
an image model (art is SVG and Three.js code in this repo, written by Claude
in chat or in a session, and said so in PROCESS.md). Restocking a dead lake
(in /play a dead lake is never refilled: the room says "This lake died" and
the next match starts a new lake). Trading, loans, alliances: one
negotiation (the promise) first.


## No mode is quietly cut

No mode is quietly cut to save time. If one truly cannot be finished, the
evidence, the remaining work and two or three alternatives go to Ava, who
decides. (v4.0 said this under its timeline; the timeline is in
docs/design-history/four-games-v4.0.md.)

## Decisions for Ava (accepted on 19 October, session 17 prompt)


1. Remove the Warden, planting fry and the quota bar from Who's Poaching
   [remove: one hidden role is clearer].
2. Remove the party's variant pick and Muddy Water [remove].
3. Lake Holdings is turn-based [yes].
4. Season length 45 s and four seasons in Boat Rush [yes].

All four defaults were accepted: the Warden, planting fry and the quota bar
leave Who's Poaching; the variant pick and Muddy Water leave Fishing Party;
Lake Holdings becomes turn-based; Boat Rush has four seasons of 45 s.

## Changelog

- v5.1 (23 Oct, session 18): Who's Poaching 2.0 is built (poach 2.0 on the v5 lake): the role card, the lantern's circle, tasks, inspect, buoy, report, the fine net and its dead fish, the meeting's map and lines, the tally, the exile, the night, the ceremony. What the section left open is settled under "How poach 2.0 settles…". poach 1.0's numbers made the lake die on day 1 (a fine net every 1.5 s); its tests are replaced by 2.0's.
- v5.0.1: net 4.5, cooldown 0.7 (rule change 7, balance report docs/checks/balance-rush2-2026-10-23.md).
- v5.0 (19 Oct, session 17): the design for all four games, step by step (prototype v10, docs/prototypes/v10/). The world is shared: one lake shape (92 × 64, an island, named places), seasons, K = 340, one ending ceremony. Boat Rush 2.0 is built first: four 45 s seasons with a rest and a market between them. Who's Poaching 2.0, Lake Holdings 2.0 and Fishing Party 2.0 follow. v4.0's mode sections moved word for word to docs/design-history/four-games-v4.0.md. Rule changes approved in the session 17 prompt: the lake shape and start (230 adults, 50 young), Boat Rush's browser-only practice (above), the shared ceremony, shared client modules, crash fixes in frozen code, and the removals listed under each mode.

- v4.0.1 (19 Oct): the UI rules. The room is a page and the game is its own full-screen page; the host menu holds Stop match; informing layers take no taps; no course text on player pages; Chinese corrections. No game rule changed. (Boat Rush seasons and the shared closing ceremony are not in this version.)
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
