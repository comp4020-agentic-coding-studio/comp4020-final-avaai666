# Next Year, No Fish (明年无鱼): design v5.11

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
| Lake Holdings | v5.8 (holdings 3.0) | session 18 (24 Oct, in chat) |
| Fishing Party | v5.0 (party 2.0) | session 18 (24 Oct, in chat) |

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

- **The lake** is a lobed oval, sized for the match's boats (rule change 11,
  Ava, 24 Oct: "decide the lake's size by how many people play"): every boat
  gets the same water, so the lake is the prototype's 92 × 64 times
  `0.5 × sqrt(boats / 4)`, from 2 to 8 boats: 0.354 for two, 0.5 (46 × 32)
  for four, 0.612 for six, 0.707 for eight. Bots count: Boat Rush and Fishing
  Party fill to four boats when bots are on. Every place, distance and sense
  below is given for the four-boat lake and scales with the match's lake
  (its `k`, 1 for four boats), unless a mode says otherwise; speeds, nets and
  the fish do not scale. (Rule change 10 had made one lake of 0.5 for every
  match.) `lake-world.ts`'s `makeLake(boats)` makes a match's lake; a frame
  carries its scale and docks (`lk`) and the page scales its scene to it.
  The radius at angle a is
  `1 + .09 sin(2a+.6) + .06 sin(3a+2.1) + .035 sin(5a+.3)`.
- **The island** sits at (5, -7.5), radius 3.75, with a pagoda. Boats and
  fish go round it. The deep water around it is the 深潭.
- **Named places:**
  - the reed bed 芦苇荡, west-north-west: the nursery, where young fish live
    and boats move at 0.62 speed;
  - the lotus pond 荷花塘, north-west;
  - the river mouth 河口, north-east, with a stone bridge;
  - the island 湖心岛;
  - four bays: 北湾, 东湾, 南湾, 西湾.

  Meeting phrases and labels use these places.
- **The homes** are spread round the lake (rule change 11, Ava: "spread
  everyone round the lake"): one dock and house per boat, at equal angles
  from due south, each moved (3° at a time) by the least it takes to keep
  clear of the reeds, the lotus pond and the river mouth: for four boats
  90°, 177°, 270° and 0°. Seat i has dock i. Each house takes its player's
  colour and gains a floor for every 18 fish brought home, up to 6. Your own
  home has a beam of light in your colour, a lantern and a "Your home"
  label; in Boat Rush an arrow points home when your boat is half full, and
  in the Rush when you carry fish.
- **Seasons change the scene:** spring blossom, summer lotus, autumn red
  leaves, winter snow. Each has its own palette and falling particles.
  Winter puts ice on the water where the shore distance is above 0.86,
  except within 7 units of a dock. Boats cannot cross ice; a boat that
  meets it slides along its edge.
- **The fish** swim in 16 schools (12 adult, 4 nursery in the reed bed;
  `src/lib/modes/lake-life.ts`). A fish follows its own school's centre with
  a small turning offset, is scared out of a closing net, and never moves
  faster than it swims: 4.2 a second for an adult, 2.6 for a young fish,
  ×2.2 while fleeing. A new season moves every school to that season's
  places and the fish travel with their school. Until 25 October a fish
  closed 8% of the gap to its school each tick with no limit, so a scared
  fish came back at up to 95 a second and a new season sent the whole lake
  streaking across the water (Ava: "the fish flicker, and suddenly vanish or
  appear"; the page's half of that is under frameFor below).
- **Sailing** (`src/lib/modes/boat-move.ts`, shared by Boat Rush, Who's
  Poaching and Fishing Party; rule changes 10 and 11): the prototype's
  steering (turn towards the target, then speed up), with the shore as a
  wall. A boat heads for its target wherever it is (only a target on the
  island is moved off it); where it meets the shore, the part of its move
  that goes out through the shore is taken away, so pushed straight at the
  shore it stays, and pushed along it, it slides at full speed. The
  prototype kept 70% of a boat's speed on every tick it touched the shore,
  which left it at about a tenth of its speed (Ava: "my own boat does not do
  what I tell it"); rule change 10 then moved a target past the shore in
  towards the middle, which put it beside or behind a boat at the shore, so
  a boat held towards the shore turned round and round (Ava: "it spins on
  the spot"). The page sends the stick's target ten times a second, and
  draws each boat easing towards where the frames put it, so a late frame
  slows it a little instead of stopping it and making it jump.
- **The camera** (rule change 11, Ava: "let people set it themselves, with
  a good default; the whole map more 3D"):
  - While you sail it follows your own boat from low down (about 42°), so
    the lake reads as a place in 3D and your boat stays in the middle. It
    eases after the boat and does not swing ahead of it (on the 0.7 lake a
    camera that did made it hard to tell where the boat was going). At the
    default zoom it shows about 38 units across an upright phone, 56 on one
    held sideways and 74 on a laptop.
  - You can change it: the wheel, a pinch or + and - zoom; a button turns it
    a quarter at a time; a button shows the whole lake instead. The page
    remembers your choice (in the browser only).
  - Boards, meetings and the ceremony show the whole lake, fitted into the
    part of the screen the HUD leaves free (the top bar, the pads, a
    laptop's HUD column); on a phone held upright it turns a quarter, so the
    lake's long side runs up the screen.
  - Up on the screen (W, the arrow, the stick pushed up) is always away from
    the camera, whichever way it faces.
  - There is no minimap.
  - The water is calm: no moving light streaks on it (Ava, 24 Oct: they
    were dazzling).
- **Sound** (sound.js, Web Audio, no files): a pentatonic tune on a plucked
  string over a soft drone and the sound of water, carried by a village
  drum. A bass walks under four phrases (gong, gong, yu, zhi), the tune is
  one motif over it, the drum keeps the beat with a woodblock on the
  backbeat; Boat Rush's last 10 s put the drum on every beat at 152, add the
  off-beat pushes, a cymbal each phrase and a tom fill, and the end screen
  drops the drum altogether. Until 25 October there was no drum, no bass and
  no motif — a random walk of plucks (Ava: "the music has no fire in it").
  Effects for a catch, coins, home, a ram, a miss, the gong, a splash. On
  unless the player turns it off; the button says which ("Sound: on").
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

How it is reached and run (session 18): the room page's rules card shows
"Practise first: 3 steps, about 30 s" beside Start when Boat Rush is picked and you have
joined; it opens the game page alone, before any match. It sails and nets
with the match's own numbers (sent in the page's boot data). The school
surfaces just ahead of your bow once you reach the ring, so NET is the next
thing to press. At the end, "Start the real game" sends the same start as
the room's button. If a match starts while you practise, the practice ends
and the match is shown.

### Boat Rush 开船抢鱼 (2.0)

2 to 4 boats, with bots filling empty seats. About 3 minutes.

**Flow:**
1. The rules card, with "Start" and "Practise first: 3 steps, about 30 s"
   (it has no clock; the label once read "(30 s)", like a timer).
2. Practice (alone, no clock), three steps with an arrow:
   1. sail to the gold ring;
   2. net the school ahead of your bow (3 fish);
   3. take the fish home and unload.

   Then "You're ready".
3. Four seasons of 30 s each (45 s until rule change 10), in the order
   spring, summer, autumn, winter.
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
7. The market, at most 14 s:
   - one plain, one keeper and one greedy card;
   - a reroll costs 2 banked fish;
   - picks are hidden until the market closes, then everyone sees them;
   - it closes as soon as everyone has picked, or when the 14 s run out, and
     the reveal is shown for 2.6 s from that moment. The reveal used to wait
     for the whole 14 s to pass however early the table had picked, so a
     player who picked at once sat in front of a frozen lake for 14 s (Ava,
     25 Oct: "after I pick there is a long wait").
8. After winter, the ceremony.

**Numbers:**
- hold 8; speed 16, 35% slower when full (rule change 10: 12 and 15 on
  the old lake; with the same fish in a quarter of the water, 45 s seasons
  and a hold of 12 let every bot table fish the lake out, and Ava chose
  30 s seasons, a hold of 8 and a slightly faster boat:
  docs/checks/balance-lake05-2026-10-24.md). The hold is 8 for four boats;
  with fewer boats each carries more, as the lake's fish are the same:
  8 × 4 / boats, so 11 for three and 16 for two (rule change 11);
- net radius 4.5, cast 4 units ahead of the bow, cooldown 0.7 s, at most
  6 fish a cast;
- dash 0.4 s at ×2.4, cooldown 4 s;
- a ram spills at most 3 fish; shield 3 s; no ram within 11 units of a
  dock; unloading starts within 6.5 units of your dock and takes 0.33 s a
  fish (0.1 s until rule change 11: with the homes spread round the lake
  every school is near a dock, and the trip home no longer held the catch;
  docs/checks/balance-lake11-2026-10-24.md);
- the golden carp is worth 5 and lasts 10 s;
- 8% of adults are big fish worth 2;
- a chain of 3+ fish within 2.6 s adds 1;
- a steer target outside the lake is accepted (clamped to the lake's box):
  the boat sails to the shore and slides along it (boat-move.ts), so a tap
  near the edge still sails the boat there instead of doing nothing.

**Cards** (11): Big Hold, Fast Hull, Wide Net, Quick Hands, Iron Bow and
Golden Hook (plain); Fine Mesh and Trawl (greedy: they take young fish); Fish
Ladder, Let Them Go and Reed Bed (keeper). The wording and numbers are those
in the prototype's RCARDS. Let Them Go spares young fish from a net and from
Trawl alike (rule change 13, bug fix, 29 Oct): Trawl's drive-over pickup used
to take every fish regardless of other cards, so a boat holding both scooped
up young fish its own Let Them Go promised to spare. The card words now say
this in both languages.

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
   - **Your lantern's circle.** You see only within 12 units of your boat
     on the four-boat lake, scaled with the match's lake (24 on the
     prototype's lake; rule changes 10 and 11; a frame carries it)
     — the fog. Beyond that, the server does not send boats, fish or dead
     fish. Your own buoy also lights a circle for you.
   - **Tasks.** Each player gets 3 tasks a day at named places, for
     example 收网·北湾 or 数鱼苗·芦苇荡. Stay inside the ring for 2.5 s.
     Each task adds 2 fish to the village for fishers. The poacher's
     tasks are a cover: they count nothing. The task list is in the HUD
     and the rings are on the lake.
   - **Net**, for everyone: adults only, at most 3, cooldown 2 s.
   - **Inspect** (查船): stay within 6 units of a boat for 1.5 s (a boat
     is about 6 long, so this is alongside, not half of 8). Only
     you learn "clean" or "N young fish". The target is told someone
     inspected them.
   - **Buoy** (浮标): one a day. It logs every boat that passes within 7.5
     units, with the time, and is shown at the meeting.
   - **Report** (报告): within 7 units of dead young fish nobody has
     reported, call the meeting now.
   - **Poacher only:**
     - **Fine net** (绝户网): cooldown 13 s, radius 5.2, up to 22 fish. It
       leaves a floating patch of dead young fish, the evidence. Every
       boat within 12 units at that moment witnessed it.
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
- the role card stays until every person taps "I understand" (bots at once),
  at least 3 s and at most 45 s (rule change 9, 24 Oct: at 8 s a new
  player on a phone could not read it); the tally 4 s and the exile 6 s;
- a seat may say at most 4 lines a meeting, each line once; suspect, vouch
  and skip are open to everyone, any other line must be one the server built
  for that seat (what it knows, or, for the poacher, its lies);
- a tie exiles nobody, except at the last meeting, where the tied seats are
  drawn from the match's own stream (and if nobody voted at all, any seat
  still in);
- a buoy lights a circle of 5.25 units for its owner (the prototype's
  0.7 × 15, at half the size);
- boats sail at 12.5, as before, so a crossing of the smaller lake takes
  half the time (rule change 10);
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

### Lake Holdings 抢地盘经营 (2.0) · holdings 3.0

2 to 4 players. Monopoly on the water, turn by turn: eight rounds, one turn
each. About 5 minutes. (Rule change 12, v5.8. The hex board of holdings 2.0
is in docs/design-history/holdings-v2.0.md; this section keeps the 2.0 in
its title because every 2.0-generation game is listed that way.)

**The board:** 24 squares round the lake, at 0.84 of the way out to the
shore, so the board fits every match's lake (rule change 11).
- Each player's **home** is the square nearest their dock.
- The **Lake Spirit** sits midway between two homes (one per gap of 3 or
  more squares).
- Every other square is a **fishing ground**. Grounds come in colour groups
  of at most 3 between the homes and the Spirit. A ground costs 3 coins plus
  its group's place round the board (3 to 8). It holds up to 19 fish.
- The room's fish are spread evenly over the grounds.

**A turn:**
1. Before you roll you may build a net or a pond on one of your own grounds
   that has none (4 coins, one a turn).
2. Roll one die (12 s, or it rolls itself) and sail that many squares. Passing
   or landing on your own home pays 3 coins.
3. The square acts:
   - a ground nobody owns: buy it, or pass;
   - your own ground: **haul** it (3 fish, 8 with a net, 2 with a pond; a coin
     a fish), or build a **net** or a **pond** there, or pass;
   - someone else's ground: pay its owner the toll (1, 2 with a net, 3 with a
     pond; twice that if the owner holds the whole group). You pay what you
     have, never more;
   - the Lake Spirit: a card, from a shuffled deck of eight: Bloom (+2 fish on
     every ground with any), Market day (+4 coins), The inspector (a fine of 2
     for each of your nets), Lantern festival (everyone gives you a coin),
     Tailwind (sail 3 more), Thieves (up to 4 fish gone from your fullest
     ground), Fry (+3 fish on each of your grounds), A lucky find (+3 coins).
4. 12 s to choose; a choice nobody makes is a pass.

**After every round** (when every player has had a turn):
1. each net hauls up to 6 fish from its ground for its owner, a coin a fish;
2. each pond pays its owner 2 coins (visitors come to see the fish);
3. each ground with fish breeds: + round(0.35 × fish × (1 − fish/19));
   an empty ground stays empty; a pond adds 2 fish to its ground;
4. if the lake is below 15% of K (51 fish), it has died: the match ends,
   and the tier is No fish.

**Score** after 8 rounds: coins + 2 a ground + 2 a building + 1 for each fish
still on your grounds, × the tier of next spring (the lake's fish, bred as
`nextSpring()`). Fish left on your grounds count and they breed; a net turns
them into coins now, and an emptied ground never fills again without a pond.

**What a frame holds:** everything (nothing in this mode is secret): the
squares with owner, building, fish and toll, every player's square, coins and
grounds, whose turn it is, the phase, the die, the path a boat sails, the
choices open now, and the lake and next spring.

**The page:** the whole lake from above (overview). Each square is a tile with
its group's colour on the shore side, the owner's flag, its net or pond, and
its fish swimming beside it; a tap on any square says what it is. Your turn:
ROLL (or Space), then pads for the square you landed on; before rolling, tap
one of your empty grounds to build on it. The die, tolls, cards, and each
round's nets, ponds and breeding are shown as they happen. The shared
ceremony ends the match.

**Bots** (steady, keeper, greedy by seat): roll after a moment; buy when they
can (greedy with nothing left over, the others keeping a coin); greedy builds
nets and hauls whatever it lands on; keeper builds ponds and hauls only a
ground at 60% or more; steady alternates and hauls at 40%.

**Measured in holdings 3.0** (bots only, 300 matches a table,
docs/checks/balance-hold3-2026-10-24.md): in a random mix no bot kind wins over 41% (steady
27.4%, greedy 25.6%, keeper 22.8%); all-greedy tables end Fair in 77.0% and
Lean in 3.0%, all-keeper tables Bountiful in 100%; no lake died.

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
   1.5 s. The first tap within 4 units (5.5 with Big Net) takes the school:
   2 coins, 2 fish out of the lake.
2. **Koi Chase** (steer). Eight lantern gates in order: 1 coin and 1 fish
   each. Touching the golden carp: 5 coins and 2 fish, and it jumps two
   gates ahead.
3. **Tug of Line** (timing). A needle sweeps (once across in 1.4 s; it was
   0.8 s, too fast to aim) and a green zone drifts.
   REEL inside the zone: +9%. Outside: −6% and a 0.35 s stun. Finish
   places pay 6, 4, 2 and 1. No fish leave the lake.
4. **Lantern Night** (steer, net, light).
   - It is dark, and you see fish only within 8 units of your boat.
   - A dropped lantern lights a spot for everyone for 10 s (cooldown 8 s).
   - A net takes up to 2 adults, 1 coin each, cooldown 2 s (1.6 s on the
     old lake; the fish are denser now).
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

**How party 2.0 settles what the text above leaves open** (session 18):
- the brush verb is the Chinese word on both pages; an English page adds
  its own word under it (TAP! CHASE! REEL! LIGHT! PICK!);
- Big Net in each round: taps reach 5.5 instead of 4; the green zone is
  0.04 wider each side; at night you see 9 instead of 8 and the net is 5
  wide instead of 3.6 (the nets keep the prototype's size: they decide how
  many fish a cast takes, and that is held by the cooldown);
- rule change 10: every place and distance is the prototype's at half the
  size, and boats sail at 10 (14 on the old lake; at 14 a lap of the gates
  took half the time, so Koi Chase paid twice the gates and took twice the
  fish);
- at night a seat's frame holds only the fish it may see (8 of its boat,
  or 7 of any dropped lantern) and the boats within 10; the dark itself is
  drawn by the page from the view radius the frame carries;
- the shop: a person with fewer than 3 coins is done already, so if nobody
  can buy the shop is skipped; bots always visit it;
- anyone who has not picked when the Last Net's 20 s run out gets 6;
- the end ceremony multiplies coins, not fish home, so it has no fish
  ledger step; the room's lake goes through next spring as for any mode
  that does not breed in its own year.

**Measured in the prototype** (bots, 1 run after tuning): the last net
held, and the year ended Fair. Before the night round was weakened, two
runs ended Lean with the lake at 23–25 fish.

**Measured in party 2.0** (bots only, 300 matches of four,
docs/checks/balance-party2-2026-10-24.md): next spring is Fair in 99.3% of
matches; the bots' Last Net held in 24.3%. Over shop habits, Fast Boat
always wins 35.7% (30.5%-41.2%), never buying 28.7%, Big Net 21.3%, Bait
15.0%: none is over the 40% target. These are claims about party.ts's bots,
not about people. On the half-size lake (rule change 10,
docs/checks/balance-lake05-2026-10-24.md): Fair in 99.7%, the Last Net held
in 25.3%, never buying 31.0%, Big Net 26.7%, Fast Boat 26.3%, Bait 19.0%.

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
`src/static/play/world5.js` (the lobed lake of "The world (shared)",
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

A frame names each fish it carries (its row is [x, y, h, adult, id]), in
Boat Rush, Fishing Party and Who's Poaching. The page follows a fish by that
name, through `src/static/play/fishview.js`, which keeps each one in the same
drawing slot while it is on screen. Before this it followed a fish by its
place in the frame's list, so one fish caught in the middle moved every fish
after it to its neighbour's place, and swapped its colour (Ava, 25 Oct: "the
fish flicker, and suddenly vanish or appear"; measured over 777 pairs of
frames of a bot match, 17.0% of them had a fish jump more than 2 units, the
worst 78.7 — a fish swims at most 0.92 between two frames). A name tells a
seat nothing it could not already see: only the fish in its own frame have
one.


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
4. Season length 45 s and four seasons in Boat Rush [yes]. Changed by Ava on
   24 October (rule change 10): 30 s, on the half-size lake.

All four defaults were accepted: the Warden, planting fry and the quota bar
leave Who's Poaching; the variant pick and Muddy Water leave Fishing Party;
Lake Holdings becomes turn-based; Boat Rush has four seasons of 45 s.

## Changelog

- v5.11 (29 Oct): rule change 13, bug fix. Trawl's drive-over pickup took every fish it passed over, young ones included, even for a boat that also held Let Them Go — the card's own text said the net lets them go, but the trawl did not ask. Fixed so `trawlPickup()` checks `takesYoung()` as `closeNets()` already does, and the Trawl and Let Them Go cards are reworded in both languages to say so. No balance re-measurement: across the balance harness's four rush tables (all-greedy, all-keeper, all-steady, random mix), 300 seeds each, 1200 matches and 4800 boats total, no boat ever ended a match holding both cards (greedy and keeper bots weight the other kind's cards too low to pick both across a match's three market visits), so the published numbers in README.md and docs/checks/balance-fish-2026-10-25.md are unaffected.
- v5.10 (25 Oct, session 18): what was left of "the fish flicker", and the music. A fish now never moves faster than it swims (it closed 8% of the gap to its school every tick with no limit: a scared fish came back at 95 a second against its own 4.2), and a new season's schools carry their fish to the season's places instead of leaving them to sprint after. A bot picks its market card from the three cards on the table, as everyone else does (71.5% of the picks the reveal showed were cards nobody had been offered). The music is rebuilt around a village drum, a four-phrase bass and one motif. Re-measured, 300 matches a table: docs/checks/balance-fish-2026-10-25.md. Boat Rush's three targets still hold, with (a) at 56.7% (70.3% before) and (b) at 73.0% (65.0%); README carries the new numbers. spec/unit/boat-move.test.ts's Boat Rush shore share is now the mean of eight tables, not one: the quantity sits at 0.145 either side of this change and one table against a 0.15 line turned on luck (0.139 before, 0.150 after; the eight-table mean, 0.143 and 0.145).
- v5.9 (25 Oct, session 18): three things Ava found playing rush 2.0. The market's reveal now runs from the moment the market closes, not from the end of its 14 s, so picking early no longer buys a wait in front of a frozen lake. Every fish in a frame carries its own id and the pages follow it by that (`src/static/play/fishview.js`), instead of by its place in the list, which made a catch move every fish after it. A net that lets young fish go says how many slipped through (the `fry` count in its catch event was always 0, so the page never said it). Nothing in the lake's own model changed: the balance of 24 October stands. Three more bugs are measured and written up for Ava to decide on, in the code where they are (a bot picks from a roll of its own instead of the three cards on the table; a fish crosses the lake at up to 20x its own speed after a scare or a new season's school places).
- v5.8 (24 Oct, session 18): rule change 12, Lake Holdings is Monopoly on the water (Ava: "the land-grab game is not complete and not fun", then "like Monopoly"; model holdings 3.0). 24 squares round the lake: homes at the docks, the Lake Spirit between them, grounds in colour groups to buy; roll and sail, tolls (double for a whole group), haul or build a net or a pond, nets haul and ponds pay after every round, the grounds breed, a dead lake ends the match. Score: coins + grounds + buildings + fish on your grounds, × next spring's tier. holdings 2.0's section moved word for word to docs/design-history/holdings-v2.0.md and its tests are replaced. Boat Rush's rules card says the hold is 8 with four boats (it said 12). The table under "Where each mode stands" now says Fishing Party follows v5.0. Measured in docs/checks/balance-hold3-2026-10-24.md.
- v5.7 (24 Oct, session 18): rule change 11 (Ava, after playing v5.6: "the boat spins on the spot; the lake did not change size; I cannot find my home; the 3D was better before"). Sailing: the shore is a wall a boat slides along, and a target past it is no longer moved (that made boats circle). Each match has a lake for its boats (`makeLake(boats)`, the same water per boat), and the homes are spread round it, one per boat; your home has a beam of light, a label and, in Boat Rush, an arrow. The camera follows your boat from low down by default; you can zoom, turn it or show the whole lake. Boat Rush: unloading 0.33 s a fish, a hold of 8 × 4 / boats. Measured in docs/checks/balance-lake11-2026-10-24.md. Ava also approved CC0 3D models (for a later change) and a Monopoly-style Lake Holdings (next).

- v5.6 (24 Oct, session 18): rule change 10, the whole lake on one screen. The lake is the prototype's at 0.5 (46 × 32): every place, distance and sense scales with it (`WORLD_SCALE`), Who's Poaching's lantern is 12 (CLAUDE.md changed with Ava's yes). The camera shows the whole lake always, fitted beside the HUD and turned a quarter on an upright phone; no minimap. Sailing is shared (boat-move.ts): steer targets past the shore are moved onto the water, and a boat slides along the shore instead of sticking. Boat Rush: 30 s seasons (Ava's choice; 45 s fished every lake out), hold 8, speed 16. Fishing Party: boats at 10, the night net waits 2 s. Measured in docs/checks/balance-lake05-2026-10-24.md.

- v5.5 (24 Oct, session 18): rule change 9, Who's Poaching's role card waits for "I understand"; Tug of Line's needle is slower; the camera's follow spans now apply (a fixed 120 had hidden them) with a lower tilt, and the water has no light streaks; sound and music (sound.js); the practice's label says "3 steps, about 30 s". A smaller lake (0.7) was tried the same day and taken back: Ava judged the old size and handling right, and the boats wandered on the small lake (what was measured: docs/checks/balance-lake07-2026-10-24.md).

- v5.4 (24 Oct, session 18): Boat Rush's practice is built and reachable from the room's rules card (see "Practice runs in the browser only"). The home page and room show each 2.0 game's own length.

- v5.3 (24 Oct, session 18): Fishing Party 2.0 is built (party 2.0 on the v5 lake): five rounds in a fixed order, each with its intro card, try it first, 3-2-1, standings, the shop after rounds 1-3, the Last Net picked in secret and revealed one by one, the ceremony. Its open points are settled under "How party 2.0 settles…". All four modes now run on the v5 lake.

- v5.2 (24 Oct, session 18): Lake Holdings 2.0 is built (holdings 2.0 on the v5 lake): turn-based, three cards, the preview, the reveal, the harvest step by step, next spring with dry water staying dry, the ceremony. Its open points are settled under "How holdings 2.0 settles…". The greedy bot still wins 44% of mixed tables (over the 41% target); left for the balance pass.
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
