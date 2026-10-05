# Browser check, 2026-10-01 (commit 9fee210, before the first deploy)

The session that wrote the server said the page script had never run in a real
browser. This check ran it in two real Chromium browsers (Playwright 1.56) against
the server started locally with `node src/server.ts` and a fresh DATA_DIR.

| What | Result |
|---|---|
| Desktop (1920×1080) presses Space; phone (390×844) sees the catch | 39, 13, 17, 10, 11 ms (5 taps, local) |
| Keyboard only | Tab ×3 to "Dig a new pond", ×3 to the name field, ×3 to "Cast" |
| Resize the desktop to 390 wide mid-use | no horizontal scroll |
| Phone at 390 wide | no horizontal scroll |
| Server killed and restarted (like a Fly stop or redeploy), down ~3 s | phone shows "reconnecting…", reconnects, sees the next catch 34 ms after the tap |
| Pond dies while the phone watches | phone shows the death record |
| Reload | still "You are Ava", catch counts kept |
| Phone at 400 ms latency (Chrome network emulation) | page loads in ~1.0 s, live connection open in ~1.5 s |

## What this check could not measure

- **Delivery delay on a slow network.** Chrome's emulation delays the start of a
  request, not data already flowing on an open stream, so the 3–25 ms it reported
  is not meaningful. Judge on a real phone after deploying.
- **Losing the network.** Playwright's `setOffline` does not cut a stream that is
  already open. A first run reported "the phone did not catch up after going back
  online"; that was the test's own mistake (the phone had received the catches
  live). Replaced with the server-restart check above.
- Anything on Fly: the proxy, TLS, the Origin/Host match, `Fly-Client-IP`,
  commit times on the volume, auto-stop with a stream open.

## Observations for the playtest

- A full pond shows "+0 fish per minute regrowing". That is correct (logistic
  growth is zero at capacity) but a player may read it as "fish don't grow".
  Watch whether players understand the regrowth number.

Screenshots: `01-home-desktop.png`, `04-both-joined-desktop.png`, `05-both-joined-mobile.png`, `07-desktop-resized-to-mobile.png`, `10-dead-desktop.png`. Scripts: `e2e.mjs`, `e2e4.mjs`.
The scripts are kept as a record; they are not part of `pnpm check` and need Playwright, which this repo does not install.
