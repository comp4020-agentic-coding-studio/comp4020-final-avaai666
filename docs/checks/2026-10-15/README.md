# Checks, 2026-10-15: Quick Catch (/b) on two devices

What was checked: a room opened at /b; a lobby seeing the second player's
join live; a start without bots (two boats); a desktop context (1366×860)
and an emulated phone context (390×844, touch, scale 2) in one race; casts
from the keyboard (Space) and from the phone's CAST button; unloads at each
dock, with house parts built ("a red gate", "a tiled roof", "an upper
floor", "lanterns"); two rams by the phone boat, each spilling 3 fish, and
spilled fish scooped (5 by the phone player); the horn and the results
screen on both contexts, with the Rematch button shown.

Not shown here: a rematch. `two-devices.mjs` stops at the results screen
and never presses Rematch, and no screenshot shows a second match. No test
in this repo starts a second match in a room either.

By whom: Claude, in chat, driving headless Chromium with Playwright
(`two-devices.mjs`, two browser contexts at once). Both players were the
script: it sails to the densest school it can see in the frames, casts when
two or more grown fish are at the bow, goes home at 7 (desktop) or 9
(phone) fish, and the phone boat dashes at the desktop boat when it carries
4 or more.

Against what: the p14 files served by the real server at commit `aaeafd6`
plus the session-11 changes, run locally at `localhost:3311`. This is the
state before this session copied those files into the repo; it is not a run
of the commits in this repo's history.

Speed: the script steers the desktop boat five times and times how long the
phone context's frames take to show that boat's new target. Locally, on one
machine, this was 94–139 ms. In this repo, spec/boat-app.test.ts measures
the same thing over HTTP between two streams (it printed 105.8 ms on
localhost while integrating, 2026-10-15).

What it does not show: real phones (touch latency, small screens held in a
hand, the browser chrome, a phone going to sleep); real networks (latency,
jitter, a dropped stream, two players far apart); people (whether anyone
finds it fun, understands the hold, or rams). The players were scripts.

## Screenshots

- `02-lobby-A.png`, `03-lobby-B.png`: the lobby, desktop and phone, after
  both joined.
- `04-countdown.png`: the three-second countdown.
- `20-smart-A.png`, `21-smart-B.png`: about 30 s in, desktop and phone.
- `22-smart-A.png`: about 75 s in, desktop.
- `23-results-A.png`, `24-results-B.png`: the results, desktop and phone
  (the phone one full page).

## Script

- `two-devices.mjs`: needs Playwright and a Chromium path of its own; its
  BASE is `http://localhost:3311`. Never point it at production.
