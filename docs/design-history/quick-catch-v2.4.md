# Quick Catch (/b), design v2.4

Moved word for word from DESIGN.md v3.2 (15 October 2026) in DESIGN v4.0.
Its rules are docs/boats/RULES.md. The four rules it does not follow (a to d)
are also kept in DESIGN.md, because /play follows them too. /b is frozen: it
keeps running and keeps its data, with no new features.

---

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

