# Handoff: sessions 13 and 14 (four games on /play)

Written by Claude during session 13, 15 October 2026. Nothing here was
pushed; every commit is local, for Ava to review.

## Done (committed)

| Step | Commit | What |
|---|---|---|
| 1 | 779efa5 | DESIGN v3.0 "One lake, four games"; CLAUDE.md scope rules; the art rule replaces "AI-generated anything" |
| 2 | 798ad9a | The platform: Mode interface, game_* tables, 20 Hz hub with per-seat frames, lake memory, playtest summaries, lobby and room shells, shared 3D (world.js) and art (art.js) from v7, three 0.160.0 vendored |
| 3 | 53c788b | Boat Rush (rush 1.0), two-jar app test lobby → results → rematch |
| 4 | 884eb6c | Who's Poaching (poach 1.0), four-jar app test |
| 5 | 2e0525c | Fishing Party (party 1.0), two-jar app test |
| 6 | 2fa6f05 | Lake Holdings (holdings 1.0), app test with two people and two bots |
| 7 | 9cc6e80 | The lobby: four cards with Play, six portraits, per-mode stand-in, phone and desktop screenshots |
| 8 | (this commit) | docs/checks/2026-10-15-play: two-context runs of all four modes to the results |

Each mode's deliberate break went red and was restored (see the session
transcript): Rush (Lantern Rush multiplier), Poaching (every role sent to
every seat), Party (Last Net's school never breaks), Holdings (a net's catch
not taken out of the school).

## Next

All eight steps are committed. Nothing is pushed. Before any push, the
blocker below needs Ava's decision.

## Session 14: where it stopped

Steps 0-8 are committed (6eea5d6 to ded90af). Step 9 stopped before the
push: on a fresh local app, `pnpm check` had one red test (the blocker
below), and CLAUDE.md lets a push happen only when `pnpm check` passes.
Nothing from session 13 or 14 is pushed. Everything else in Step 9 passed:
typecheck, `pnpm test:unit` (18 files, 335 tests), check:evidence.

Also fixed in session 14 (worth knowing): the hand in Holdings, Rush's
upgrade buttons and Party's panel were rebuilt ten times a second, so taps
could land on a button that had just been replaced; they now change only
when their contents do.

## Session 14 blocker: the session-13 Poaching app test and the v3.1 last meeting

spec/play-poach-app.test.ts (session 13) has four players skip both
meetings, then waits 100 s after day 2's dawn for the end. Under DESIGN
v3.1 (Ava's session-14 rule) day 3 ends in a last meeting with no Skip; the
test's players cast no vote there, so the meeting runs its full 90 s and
the end comes about 170 s after that dawn. The test times out at
line 43. It cannot pass without being edited, and tests are not edited to
pass. Two alternatives, Ava's call:
1. allow that one wait to become 200 s (no assertion changes); or
2. end the last meeting as soon as everyone still in has voted, and change
   the test's players to vote there (an edit to the test either way).
Until this is decided, `pnpm check` has this one red test and session 14
does not push.

## Session 13 blocker (fixed in session 14, 6eea5d6): a session-12 test timed out sometimes

`spec/unit/boat-hub.test.ts` (written in session 12) plays a whole 120 s
match and takes about 3 s alone. Under the extra parallel load of the new
/play unit tests (each plays whole matches), it passed in two of three full
`pnpm test:unit` runs and timed out at vitest's default 5 s in the third
(5.7 s and 6.0 s seen). CLAUDE.md forbids editing a test to make it pass,
so I left it. Two alternatives, Ava's call:
1. give that one test an explicit timeout (for example 20 s), as the new
   /play tests that play whole matches already have; or
2. make the new heavy /play unit tests lighter or run them sequentially
   (vitest `sequential`), so they stop starving other workers.

## What I would check first

1. `pnpm check` with a FRESH local app. Back-to-back full runs against one
   app instance fail in two known ways that are load, not rules:
   - lake-app.test.ts hits the lake hub's cap of 12 live lakes
     (MAX_LIVE_LAKES in lake-live.ts) because each run leaves seasons
     running; a fresh app passes.
   - once, boat-hub.test.ts (session 12) timed out at vitest's default 5 s
     while the new /play app tests ran rematches and the unit sims ran in
     parallel (it takes 3 s alone). I did not touch that test. If it recurs
     in CI, the choices are: give that test a longer timeout (Ava's call,
     since tests are not edited to pass), or run the /play app tests in
     their own vitest project.
2. The app tests are long because they play whole matches: Rush ~155 s,
   Poaching ~245 s, Party ~200 s. `pnpm check` now takes about 4 minutes.

## Decisions I made that Ava should confirm

- Bot streams on /play are per bot, tick and seat, and bot inputs are
  stored, so replay never runs a bot. The session prompt said "follow v2.4
  d" (one shared stream, replay re-runs bots); I chose the stricter
  CLAUDE.md lake rule instead and wrote it in DESIGN v3.0 "The platform".
- Where the plan and the session prompt differ, the session prompt won,
  with the plan's number kept in DESIGN: Party rounds 35 s (plan 20 s),
  Poaching days 75 s (plan 60 s).
- "Restocking a dead lake" (Not building) vs "below 40 the next match starts
  a new lake": DESIGN now says a dead /play lake is never refilled; the room
  says "This lake died" and the next match starts a new one.
- Rush fish breed within a match (boat-sim's rule), so an unfished match can
  leave more than 220 (one app run left 284). Between matches the room's
  lake is capped at 220. Whether a match should be able to grow the lake
  past full is open.
- "6 units" and "10 units" in the Poaching rules are read as world units of
  the 3D lake (a tenth of the sim), so 60 and 100 in the sim.
- Poaching lake health is fry alive as a share of fry at dawn of day 1;
  the fine net and nothing else kills fry.
- Highlights name people by `{name}`, filled in by the hub from the seats.

## Known gaps (not hidden; for the list at the end)

- On a 390×844 phone, the Poaching HUD covers about half the lake; Rush's
  is better after moving CAST/DASH to a bottom bar.
- The lobby's 3D lake shows circling fish but not a per-mode stand-in.
- No chat or free text anywhere; the meeting is set phrases (by design).
