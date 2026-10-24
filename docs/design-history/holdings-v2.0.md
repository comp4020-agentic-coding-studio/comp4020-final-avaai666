# Lake Holdings, holdings 2.0 (history)

Moved word for word from DESIGN.md v5.7 (24 October 2026) when DESIGN v5.8
replaced this section with the Monopoly-style holdings 3.0 (rule change 12;
Ava, 24 Oct: "the land-grab game is not complete and not fun; make it like
Monopoly"). It describes the mode as it ran from v5.2 to v5.7.

---

### Lake Holdings 抢地盘经营 (2.0)

2 to 4 players. Turn-based, everyone choosing at the same time. Four
seasons with 3 moves each, then the harvest. About 5 minutes.

**The board:**
- Hex tiles of size 4.2 (the prototype's 8.4, at the lake's half size, so the
  board keeps its 61 tiles) over the lake: every tile whose centre has a shore
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

**How holdings 2.0 settles what the text above leaves open** (session 18):
- a move's reveal shows one placement every 0.45 s, then a 0.8 s pause; each
  harvest step is shown for 1.3 s;
- a time-out plays the bot's choice, drawn from the match's own stream; a seat
  with no legal tile for any card in its hand passes;
- two flags with the same number of tiles: the match's own stream decides;
- bots are steady, keeper and greedy by seat (the prototype's botChoose with
  their weights); the room's lake keeps next spring as this mode computes it
  (the mode breeds in its own year, like Boat Rush).

**Measured in holdings 2.0** (bots only, 300 matches a table,
docs/checks/balance-hold2-2026-10-24.md): all-greedy tables end Fair (88%),
all-keeper tables Bountiful (100%), but in a random mix the greedy bot wins
44.3% (39.3%-49.3%), over the 41% target, and the keeper 7.6%. Greed still
pays the player who is greedy; this is for Ava's balance pass.

**Removed from v4:**
- the real-time 15 s tide;
- the current's flow field;
- taking an enemy tile.
