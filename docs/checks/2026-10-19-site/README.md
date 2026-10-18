# Checks, 2026-10-19: the site, two viewports, two languages

By whom: Claude, in session 15, driving headless Chromium (Playwright 1.62.1)
against the app running locally (`node src/server.ts`, localhost:8080, a
temporary DATA_DIR). Never against production. The scripts were in /tmp and
are not part of the repo; what they did is below.

Viewports: desktop 1280×800; phone 390×844 (emulated: touch, scale 2).
Languages: the `lang` cookie set to `en` and to `zh` before loading.

## Checked

Every page in the site map, at both viewports, in both languages (40
full-page screenshots, `{desktop,phone}-{en,zh}-{page}.png`): `/`, `/how`,
`/how/rush`, `/how/party`, `/how/poach`, `/how/hold`, a room at `/play/CODE`
(before anyone joins), `/readme/`, `/making-of`, `/classic`. For each, the
script measured `scrollWidth − innerWidth` and looked for any link or button
in the top bar that ran past the edge of the screen or was cut off inside its
box.

| | horizontal scroll | top bar clipped |
|---|---|---|
| all 36 site pages (9 pages × 2 viewports × 2 languages) | 0 px on every page | nothing |
| `/classic` (×4) | 0 px | has no site top bar: it is the frozen five-year lake's own page |

One room with two contexts side by side (`two-*.png`): A on desktop in
English opened a room from `/` with "Play with friends" and joined as Ava; B
on the phone in Chinese opened the same link and joined as Bo. A's "Who's
here" showed Bo 174 ms after B's join was sent (measured in this run, on one
machine). B picked Fishing Party then Boat Rush and A's page followed each
pick; A pressed Start and both pages took the whole screen for the match
(`two-*-playing.png`, about 4 s in). No page error or console error on
either page, and no horizontal scroll on the phone.

The phone menu (`phone-en-menu-open.png`): tapping Menu shows the four
links; tapping 中文 reloads the page in Chinese.

## Not checked

- Real phones, real browsers other than headless Chromium, slow networks.
- Whether people understand or like any page; nobody but a script used it.
- The four games' HUD in Chinese beyond Boat Rush's start card, its HUD in
  the first seconds and the room around it; Fishing Party, Who's Poaching
  and Lake Holdings were not played in Chinese in a browser. Their words
  are tested in spec/unit/i18n.test.ts and spec/unit/i18n-codes.test.ts,
  not seen.
- Sound, and the rest of a match after the first seconds.
- `/l/CODE`, `/p/ID` and `/b` pages at the two viewports (frozen, not
  changed in this session apart from links).
