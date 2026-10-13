# Checks, 2026-10-13

What was checked: the home page; two browser contexts joining a lobby live
(desktop and phone), the second's join showing up in the first without a
refresh; starting the season; throwing nets and seeing a haul; a promise
asked and kept; a seal ("stop that") sent to another family; four winter
meetings with their votes; the New Year card between years; a full season
played through to the debrief, on both a desktop viewport (1366×860) and a
phone viewport (390×844, iPhone 13 and a 390×844 context).

By whom: Claude, in chat, driving headless Chromium with Playwright
(`t1.mjs` for the lobby and the first throws, two contexts at once; `t2.mjs`
for a whole season, one context, through to the debrief and a final phone
screenshot).

Against what: the page files from `p11` (`lake.js`, `lake.css`,
`lake-pages.ts`) served by the real server at commit `aaeafd6` with the
runner fixes from this session's Step 1 applied on top, run locally at
`localhost:3311` — the state the page was in before this session copied
those files into `src/` and `src/static/`. It is not a check of the commits
in this repo's history, since the page files were not yet committed when
these screenshots were taken.

The three bugs it found (fixed in commit `44fda84`, test-first):

1. Every bot stopped throwing after the first winter: `runBot` only threw on
   the exact step its net dried (`n === fam.nextThrowStep`), and that step
   always passed during a meeting, so a bot's next throw step was never hit
   again.
2. Every bot voted on the meeting's very first step, so a follower bot
   (Mei) could never follow a person who voted later: the bot's "seconds
   into the meeting" clock was actually seconds into the year, which starts
   above 40 the moment a meeting opens.
3. The rule tally counted only human families' votes, so a bot forced to
   vote (for example Old Wang, with a fine net) never moved the result.

## Screenshots

- `01-home.png` — the home page.
- `02-lobby-A.png`, `03-lobby-B-phone.png` — the lobby, desktop and phone,
  after both families joined.
- `04-live-A.png`, `05-throw-A.png` — the live lake and a thrown net.
- `07-live-B-phone.png` — the live lake on a phone viewport.
- `10-offer.png` — a promise offered to a family.
- `13-voted-y1.png` — a vote cast in year 1's meeting.
- `15-sealed.png` — a "stop that" (怒) seal sent to another family.
- `16-newyear-y2.png` — the New Year card into year 2.
- `20-debrief.png`, `21-debrief-full.png` — the debrief at the season's end.

`t1.mjs` and `t2.mjs` are the scripts that took them.
