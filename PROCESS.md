# Process

## Where this stands (crit 8)

After one week: a pond model, an append-only ledger, a server with live updates and a page, in 16 commits after the template ([`f71d6dd...9fee210`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/compare/f71d6dd...9fee210)). The design is in `DESIGN.md` (v0.4), the rules in `CLAUDE.md`, the checks in `spec/`.

## How I work with the agent

Each session is one prompt with the same shape. First, paste the real state of the repo. Then make the change test-first. Then prove one or two key tests catch a real bug, by breaking the code on purpose and restoring it. Last, list what the design gets wrong or leaves out, without fixing it. I decide each listed point and write it into `DESIGN.md` with a version bump and a changelog line. The agent never pushes or deploys.

## Stack

The constraint is in `fly.toml`: one shared-cpu machine with 256 MB and one volume. I chose Node 24 running TypeScript directly, `node:sqlite`, `node:http` and Server-Sent Events, with no client framework and no build step ([`e0f6bea`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/e0f6bea), [`698dc13`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/698dc13), [`8c8b6bc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/8c8b6bc)).

What I weighed it against: a full-stack framework such as Astro with SQLite and SSE (a framework and a build for a two-page app); better-sqlite3 (a native build in Docker); WebSockets (writes are plain POSTs, and SSE's Last-Event-ID lets a reconnecting page replay ledger rows by id, so the ledger is also the stream). The record is `docs/decisions/0001-stack.md`.

## Moments

### A simulation threw away three promises

The first design used plain logistic growth, promised that "only a room can empty it", and settled taps in one-second "tides" with ties going to the lower ledger id. A second agent reviewed it, and a short simulation showed three problems. One person could empty the pond in 12 minutes. A pond with 0.4 fish grew back. And ledger ids are arrival order, so "the split doesn't depend on arrival order" contradicted the tie rule; my shuffle test kept the ids, so it could not see this. Instead of building it, I replaced the model with an Allee threshold, dropped tides for first-come-first-served, and committed the simulation ([`8d15c9c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/8d15c9c)). The changelog in `DESIGN.md` records what was thrown away ([`c7b17b3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/c7b17b3)).

### Designing for two sessions

Markers use the app in two browsers. With my first fixed parameters, two nets at full speed never emptied the pond, so a marker could never meet the conflict. I made the pond smaller (300 fish): in the simulation two nets empty it in about five minutes and one never does. That claim is now a test: one net's maximum is below the peak regrowth, and two nets' maximum is above it ([`f93a9f8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/f93a9f8)). I also dropped the slogan, because one net can finish off a weakened pond; that limit is kept as a test too.

### A test that could not fail

`CLAUDE.md` says to prove that key tests catch a bug ([`76f538c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/76f538c)). Changing the per-net rate turned the parameter check red but left three scenario tests green: their helper hard-coded one tap per second. The fix derives the interval from the constant ([`f93a9f8...2753509`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/compare/f93a9f8...2753509)).

### A number decided durability

With SQLite's default fsync, a commit took about 41 ms on my machine (`docs/checks/2026-10-06/local-commit-times.txt`). `node:sqlite` is synchronous, so a dozen people tapping would block the server for half of every second, and everyone's live updates would arrive late. I chose WAL with `synchronous = NORMAL` and wrote down the cost: if the machine itself crashes, the last commits can be lost ([`5ba1c16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/5ba1c16), [`c3d0df2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/c3d0df2)). Every commit's time is logged; on Fly, twenty writes took 0.2–1.1 ms each (`docs/checks/2026-10-06/fly-commit-times.txt`).

### Checking the layer the tests could not see

The agent reported every check green, and in the same message said the page script had never run in a browser. Before the first deploy I ran it in two real Chromium browsers, at 1920×1080 and 390×844: 10–39 ms on a local run from one page's tap to the other page, digging, joining and casting each reachable by keyboard, no horizontal scroll after a resize mid-use, and a clean reconnect after a server restart. One "bug" turned out to be my own test's mistake: Playwright's offline mode does not cut a stream that is already open ([`789206e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/789206e)).

## Next

A two-person playtest of assumption H1 in `DESIGN.md`, and for crit 9, the one multi-user decision.
