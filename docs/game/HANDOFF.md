# Handoff: session 13 (four games on /play)

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

Each mode's deliberate break went red and was restored (see the session
transcript): Rush (Lantern Rush multiplier), Poaching (every role sent to
every seat), Party (Last Net's school never breaks).

## Next

- Step 6, Lake Holdings: see the bottom of this file for where it stands.
- Step 7, the lobby: /play already shows the four cards with real status
  (READY in src/lib/modes/index.ts), the six portraits, "Open a room",
  "Join with a code", and in a room the mode switch and the lake bar. Still
  to do: Playwright screenshots of the lobby on 390×844 and desktop; a
  live 3D stand-in per mode on the lobby's lake (it shows circling fish only).
- Step 8, checks: the per-mode two-context Playwright runs and
  docs/checks/2026-10-15-play/README.md.

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
