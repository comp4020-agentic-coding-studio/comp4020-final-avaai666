# The four games, design v4.0 (history)

Moved word for word from DESIGN.md v4.0.1 (19 October 2026) when DESIGN v5.0
replaced these sections. They describe the four modes as they were when
rush 1.0, party 1.0, poach 1.0 and holdings 1.0 were built. Boat Rush 2.0 is
v5.0's first mode; Poaching, Holdings and Party follow in later sessions, so
until then the other three still run as described here.

---

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

### The goal (v4.0)

One multiplayer lake game with four genuinely different ways to play. A
player picks a different game, not the same game with other numbers. Each
mode has several actions that affect each other. The theme stays: everyone
shares one lake, and the harder you fish today, the fewer fish there are
later. Each mode makes that dilemma appear in its own way, never by a storm
that makes everyone lose.


### Decisions and timeline (v4.0)

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

