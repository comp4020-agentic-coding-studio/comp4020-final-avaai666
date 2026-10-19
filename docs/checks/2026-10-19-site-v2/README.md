# Checks, 2026-10-19 (evening): the room page and the full-screen game

By whom: Claude, session 16, headless Chromium (Playwright 1.62.1) against the
app running locally (temporary DATA_DIR). Never production. Desktop 1280×800
and an emulated phone 390×844 (touch, scale 2), in English and Chinese.

## Checked (every row measured in the browser, one run each)

| | result |
|---|---|
| Room page, 4 combinations | no canvas, pads or HUD on it; it scrolls; 0 px horizontal overflow |
| Pick buttons at 390×844 | the element at each button's centre is that button (all four) |
| Start | both browsers (desktop en, phone zh) went to /play/CODE/game |
| Game page | no site header; the element at the CAST and DASH pads' centres is that pad |
| Host menu | shown to the first player only; Stop asks for a confirmation; Cancel keeps the match; confirming returns both to the room |
| Console / page errors | none, in the two-browser run |

Screenshots: `{desktop,phone}-{en,zh}-{room,game,game-hostmenu}.png`.

## Not checked

- Real phones, other browsers, slow networks.
- The results screen's "Back to the room" link in a browser (it is checked in
  spec/unit/room-ui.test.ts as markup in room.js only).
- Fishing Party, Who's Poaching and Lake Holdings full screen in Chinese.
- Whether anyone finds the new screens easier: nobody but a script used them.
