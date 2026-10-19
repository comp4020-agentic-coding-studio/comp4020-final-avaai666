# 4. Playwright is a dev-only tool, never part of the app or of CI

Date: 2026-10-19
Status: accepted

## Context

Automated tests check markup, CSS text and plain-JS logic (jsdom, no GPU, as
`spec/unit/*.test.ts` already does for the `/play` mode scripts). They cannot
catch a rendering bug in the 3D world — a black screen, a wrong camera angle,
a scene that never finishes building. Session 17 part A needed a real browser
to confirm `world5.js` actually draws the v5 lake before calling that step
done, and prompt-17's step 6 needs real screenshots for evidence.

## Decision

`playwright` is a devDependency only. It is used from one-off scripts under
`scripts/` (run by hand, never by `pnpm test` or `pnpm check`), whose output
and screenshots are saved to `docs/checks/`. Nothing under `src/` imports it.
`.github/workflows/checks.yml` is untouched (CLAUDE.md): CI runs `pnpm check`
only, which never touches Playwright, so a CI machine never needs a browser
installed. Neither `playwright` nor `playwright-core` has an install or
postinstall script (checked directly in `node_modules/.pnpm/`), so `pnpm
install --frozen-lockfile` — in CI, in the Docker build, or locally — never
downloads a browser; that is a separate, explicit step (`npx playwright
install chromium`) run only on the machine doing the visual check.

## Why not something else

- **Skip the visual check.** Rejected for this session: the 3D world is new
  code with real scale and camera-math risk (a wrong unit conversion first
  put the whole lake at a tenth its size, caught only by actually rendering
  it). A jsdom smoke test catches thrown errors, not a wrong picture.
- **Add Playwright to `pnpm check` / CI.** Rejected: CI's Docker build has no
  browser, and installing one there is exactly the kind of CI-pipeline
  change CLAUDE.md asks an agent never to make without being told to.

## Consequences

- The production image is unaffected: `Dockerfile`'s `pnpm install --prod`
  never installs `playwright` in the first place (it is a devDependency).
- A visual check or an evidence capture needs a Chromium binary on the local
  machine (`npx playwright install chromium`), done once, by hand.
