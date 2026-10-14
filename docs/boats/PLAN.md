# One lake, several games: the plan after crit 9

Crit 9 and the playtests after it said the same thing: one action, a long
game, nothing to decide, and people stopped after two minutes. Every test was
green. This plan keeps the lake, the commons and the server, and rebuilds
what a player does. It is a plan, not a finding: every row below is checked
with people before it counts.

## One core, several modes

A mode may change the goal and the decisions. It may not be a different game
bolted on. Everything below runs on the same boats, nets, holds, docks and
lake, and only a mode that has passed a playtest with people appears in the
room's menu.

| | What it is | Status |
|---|---|---|
| **Shared core** | Sail (tap or drag), cast at the bow, a hold of 10, unload at your own dock, dash and ram (small, shielded, never near a dock), scoop spilled fish, the golden carp, a lake that breeds slowly and is never refilled. The server decides everything. | **Built** (boat-sim 0.1), automated checks pass; waiting for people |
| **Quick Catch** (direction 1) | Two minutes. Most fish home wins; the horn takes what is aboard. The whole game is "one more cast, or home now?" | **Built**, playable on two devices; the first mode to test |
| **Next Year, No Fish** (the theme) | The same boats over four short years. Spring breeding, winter freezes whatever is still in a hold, a winter vote on a rule (ban fine nets, protect the shallows), a fine net to buy at the dock. The goal is stated before the first cast: the biggest house wins **if the lake still holds its line after year 4**; if not, nobody wins, and everyone can watch the line all game. Present income against the lake's future. | Single-player prototype 6 exists (seeded runs: careful play leaves 104 fish against a line of 83; everyone greedy leaves 35). Next to build on the server |
| **Lake Party** (direction 2) | Not five minigames: events inside a match, on the same controls. Candidates, each tested alone: a school migrates and the good water moves; night, when you only see fish near lanterns (the server sends only what each boat can see); a golden-carp rush; a short shared goal ("the village needs 30 fish at the temple dock"). An event must create a choice, not punish at random. | Candidate; after Next Year |
| **Who's Poaching** (direction 3) | One player is secretly paid for fry. Everyone fishes; anyone may spend a trip inspecting a hold; a meeting votes. It needs at least four people, a secret the server keeps (each browser is sent only its own role), votes, and a rule for leaving. It shifts the theme from "everyone's reasonable choices" to "find the bad one"; that would be said openly. | Later candidate; separate evaluation |
| **Territory** (direction 4) | Its best idea, nets you leave in the water, can become a Party event. On its own it brings back waiting and numbers. | Not planned as a mode |

## What is reused and what had to change

| | |
|---|---|
| **Reused as it was** | node:http, the SQLite file (WAL), Fly and CI, cookie identity per room, the name rules, the Origin check, the server-sent-event transport, the New Year print look (lake.css), the art, and the rule from decision 0003 that the net cast first takes a shared fish. |
| **Reused, changed** | **Rooms**: new tables (boat_rooms, boat_players, boat_matches, boat_inputs); a room persists and the same people can rematch without new links or names. **The record**: a match is its seed plus the inputs applied at each tick (append-only), not one ledger row per action; replaying the inputs gives the same match. **The stream**: ten frames a second carrying every boat, fish, net and spilled fish, plus the events of those ticks; a reconnect gets the current room and frame, not a replay of effects. **The rate limit**: 25 inputs a second (a page sends about 10). |
| **New** | boat-sim.ts (a deterministic 20 Hz simulation with boats), boat-hub.ts (the loop: inputs queued and applied at the next tick, a steer replaces the previous steer of that tick, catch-up without skipping a tick, at most 8 races at once), boat-store.ts, boat-routes.ts under /b, boat.js (draws about 0.12 s behind the server so motion is smooth; no prediction, so nothing it shows is decided by the browser). |
| **Not reused** | The lake runner's one-row-per-action events (too slow and too heavy for movement 20 times a second) and the per-throw idempotency keys (a steer is "latest wins"; a cast or dash counts once per tick). |
| **Left alone** | The original game at /l and the ponds at /p, their tables and tests. The boats live at /b. |

## Playing it with two people

1. Two devices, ideally a phone and a laptop on different networks. Open
   `/b`, open a room, both join, start **without bots**. Play three matches in
   a row. Say only "most fish home wins"; let them find the rest.
2. Ask them to think aloud. Write down, per match: seconds to the first cast
   and to the first unload; every time someone says or shows they are torn
   about going home; every route change because of the other boat; every
   ram and what was said; one moment either could retell; who asks for the
   next match without being asked.
3. Afterwards ask: "What will you do differently next match?", "When did
   the other person change what you did?", "What would you cut?"
4. The server keeps each match's results (caught, trips, best trip, lost,
   rams, scooped); compare them with what you saw.

**Keep the core** if, within three matches, all four happen: someone goes
home early on purpose or regrets not doing so; someone changes route because
of the other boat; there is a moment they retell; someone asks for a rematch
unprompted. **Fix controls first** if a newcomer cannot sail, cast and unload
within 30 seconds. **Shrink ramming** if it decides matches (more than a
quarter of a winner's fish came from scooping) or people call it unfair;
**look at it again** if nobody rams.

## What is not known yet

- How it feels on real phones over real networks. Locally a steer reaches
  the other player's screen in 94–139 ms; Fly and 4G add to that.
- Fly's CPU with several races at once (about 1.2 ms per tick for four boats
  and 220 fish here; eight races would be about a fifth of a core).
- Whether the phone canvas is big enough and whether tap-to-sail is precise
  enough with a thumb.
- Whether two minutes, a hold of 10 and a 3-fish ram are right, and whether
  two players feel lonely on a lake sized for four.
- Whether players notice the lake running down at all.
- Bots exist only to fill seats; how strong they feel to a newcomer is
  unknown.
