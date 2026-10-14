# Checks, 2026-10-15: /play, four modes, two devices

By whom: Claude, in session 13, driving headless Chromium (Playwright 1.62)
against the app running locally (`pnpm dev`, localhost:8080, its own
`.data/pond.db`). Never against production. The scripts were in /tmp and are
not part of the repo; what they did is below.

How: for each mode, a desktop context (1366×860) and an emulated phone
context (390×844, touch, scale 2) opened the lobby, the desktop opened a
room, both joined with their own cookie, the desktop pressed Start, both
played a little (taps on the lake; Space for CAST in Boat Rush), and the
run waited for the results. Who's Poaching had two more players join over
HTTP so the room had four; they skipped every vote, so the poacher survived
day 3. Lake Holdings started with "bots fill empty seats".

The players were scripts, the phone was an emulated viewport, and the
network was one machine. This shows nothing about real phones, real
networks, or whether people understand or enjoy any mode.

## What was seen on screen (C1–C6)

| | Boat Rush | Who's Poaching | Fishing Party | Lake Holdings |
|---|---|---|---|---|
| C1 card (goal, three actions, the choice) and 3-2-1 | seen | seen | seen | seen |
| C2 coach mark in the first 20 s | "Tap the water to sail" | "Tap the water to sail" | "Tap the water to steer" (and "Tap the flashing school!" in a separate run) | "Pick a card from your hand" |
| C3 goal and clock | "Most fish home wins · 2:24" | "Find the poacher · keep the lake above 40%" · Day 1 of 3 · 1:11 | "Most coins after five rounds wins" · Round 1 · 0:35 | "Tiles + fish harvested · Lu (bot) leads" · Tide in 11s |
| C4 feedback | floats seen; sounds not checked (headless, sound off by default); banners seen in other runs | not seen in this run's sampling moment; banners for dusk and meeting exist in poach.js | banner "Round 1: Shoal Scramble" seen in a separate run | banner seen ("Pick a card first") |
| C5 results | podium of 2, 3 highlights, lake line, Rematch, Change game | podium of 4, roles revealed, 3 highlights, Rematch, Change game | podium of 2, 3 highlights, Rematch, Change game | podium of 4, 3 highlights, Rematch, Change game |
| C6 bots named as bots | not used | not used (bots are for practice only) | seen in a separate run: "Jin (bot)", "Old Wang (bot)", "Lu (bot)" | "Old Wang (bot)", "Lu (bot)" |

Not seen and not checked: any sound (C4's audible part); the "small shake"
on hits, which is a CSS class on the stage and is not visible in a still;
C2 marks disappearing after the action (the scripts did not check the
second mark appeared).

## How fast an input reached the other context

- Boat Rush, in the browser: a steer sent from the desktop showed as boat
  0's target in a frame the phone page received 629 ms later. That figure
  includes opening a fresh event stream from the phone page to watch for
  it, so it is an upper bound.
- From the app tests over HTTP on the same machine (two cookie jars, no
  browser): a Boat Rush steer reached the other stream in 124.8, 85.3 and
  51.2 ms on three runs.
- The first frame after opening a stream arrived in 506–589 ms in every
  mode (frames are 10 a second; most of that is the stream's setup).
- Not measured for Poaching, Party or Holdings: their inputs do not echo a
  value the other seat sees in the next frame as directly as a steer target.

## Server-side refusals during the runs

The check script sent Poaching votes every 2 s throughout the match; the
server answered 409 to the 209 sent outside a meeting. These are correct
refusals, not page errors. No page error or console error otherwise.

## Screenshots

`<mode>-1-card-*`, `<mode>-2-play-*`, `<mode>-3-mid-*`, `<mode>-4-results-*`
for rush, poach, party and hold, each on desktop and phone; and
`lobby-desktop*.png`, `lobby-phone*.png` (the lobby, with Boat Rush and
Who's Poaching picked).
