# Phones, v2 (session 14)

By whom: Claude, session 14, headless Chromium (Playwright 1.62), one
emulated phone context (390×844, touch, scale 2) per mode, against the app
running locally. Not real phones, not a real network, not people.

What was measured: once a match was running (bots filling seats, or four
players for Who's Poaching), the share of the stage covered by the top bar,
the folded HUD, its "Details" toggle and any bottom bar, counted pixel by
pixel from their bounding boxes. Then the first player pressed "Stop match"
and the room went back to its lobby.

| Mode | Lake covered (folded) | Stop match | After stopping |
|---|---|---|---|
| Boat Rush | 19.6% | shown to the first player | lobby |
| Who's Poaching | 23.0% | shown | lobby |
| Fishing Party | 14.8% | shown | lobby |
| Lake Holdings | 14.8% | shown | lobby |

The bottom action bars (CAST/DASH, the Poaching pads) were not counted:
they sit on the shore below the lake in these shots, but on a shorter phone
they would cover water. No page or console errors (409 refusals excluded).

Screenshots: `<mode>-card.png` (the start card), `<mode>-play-folded.png`,
`<mode>-play-open.png` (after tapping Details).
