# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the template is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the course website publishes the
[final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/).
What the agent needs to carry from any of it is your call.

## Next Year, No Fish: rules for every change

DESIGN.md is the current design and has a version number. If it is wrong,
unclear or silent about what you need, STOP and tell me what and why. Do not
work around it. When I agree to a change, update DESIGN.md, bump the version
and add a changelog line, in the same commit as the code that needs it.

Tests
- Test first. A first run that fails because a function is "not implemented"
  is fine; the test must then pass against real behaviour.
- Unit tests (spec/unit/) must pass with no server running. Run
  `pnpm test:unit` after every change to src/lib; run `pnpm check` with the
  app running before any commit that touches the server.
- Never edit or delete a test to make it pass. If a test looks wrong, stop and
  tell me why.
- Before saying "done", paste the real output of every script from Step 0 (b)
  that exists (for example pnpm test, pnpm check, pnpm check:evidence,
  pnpm build).
- For a key promise I name (stock, duplicate requests, persistence), prove the
  test catches a real bug: with the green version committed, change ONE line
  in ONE file, show the test going red, restore that file with
  `git restore <file>`, show `git status` clean and the tests green.
- README.md's Enforced list claims no more than the named test checks. If a
  change weakens a test, change the README line in the same commit.
  spec/unit/readme-paths.test.ts fails if README.md names a file that does not
  exist.

Honesty
- Paste real command output, never a summary.
- Never write in any file that something happened unless it happened in this
  repo (for example "deployed", "users liked it", "faster").
- Simulation results are claims about the strategies, parameters and seeds
  in sim/, and are written that way, never as facts about people.
- Bot behaviour is a script. Never write in README.md, PROCESS.md or a test
  name that a bot's response shows how people behave.

Safety
- Never read, print or commit mise.local.toml or FLY_API_TOKEN.
- Never touch .github/workflows or the app name in fly.toml.
- You may push to main, but only when all of these are true:
  - the tree is clean and every commit is one I have seen in this session;
  - pnpm typecheck, pnpm test:unit, pnpm check (app running locally, never
    fly.dev) and pnpm check:evidence have just passed, and you pasted their
    real output;
  - it is not between a crit cutoff (Wednesday 13:30 Canberra) and one hour
    after it, when the course sweep reads the repo.
  Once the repo is public, every push to main deploys to Fly through CI, so a
  push is a deploy: after pushing, run `gh run list` until the check and deploy
  jobs finish, and tell me if either is red.
  Never force-push, never push another branch, never delete or move a tag.
  Never deploy with flyctl yourself.
- Never run spec/ against production. The app tests dig ponds and join nets;
  against https://comp4020-final-avaai666.fly.dev they would fill the real
  register with junk. APP_URL stays local (or CI's container).

## Rules for /play (the current game)

Authority
- The server is the only authority on the fish and the catches. The client
  never computes where a fish is, what a net takes, or any outcome. It draws
  what the server sent, and may only move a fish smoothly between two frames
  it received.
- Model and game constants live only in src/lib/constants.ts and
  src/lib/game-constants.ts.
- Events, frames and snapshots never contain an idempotency key, a net
  id, a family token, or (before the season's end row) the seed.

Scope
- One front door. "/" is the current game's home. Earlier versions are
  reachable only from /making-of and keep their data.
- No free-text input except a name (max 24 characters). No chat. If a feature
  seems to need a message box, stop and ask me.
- Nothing from "Not building" in DESIGN.md.
- The four modes in DESIGN.md (Boat Rush, Fishing Party, Who's Poaching,
  Lake Holdings) and each one's first playable scope are Ava's decisions. No
  agent may drop, merge, downgrade or postpone one. If one is blocked, stop,
  give evidence and alternatives, and let Ava decide.
- A mode gets a Start button in the lobby only when two people can play it
  from start to results and rematch. Unfinished modes show their date and are
  never hidden.
- /play may load one vendored file, src/static/vendor/three.module.js (three
  0.160.0, MIT, header kept), as an ES module, plus one script per mode and
  one shared script. Still no framework and no build step.
- Art is SVG and Three.js code in this repo, written by Claude in chat or in
  a session, and said so in PROCESS.md. Nothing is generated at run time and
  no image model is used.
- No client framework and no build step. The page is server-rendered HTML
  plus one plain script in /static. Node runs src/*.ts directly.
- Every page exists in English and Chinese. English is the default. The
  top bar's EN/中文 switch sets a `lang` cookie. The server renders the
  chosen language, so /readme/ and every page's headings are in the HTML
  it sends. Every visible word comes from src/lib/i18n.ts. A key missing
  in either language fails a test.
- README.md stays English (the course reads it at /readme/). A Chinese
  page may show it with a one-line note that it is in English.
- Test names are English too.

## Frozen: /classic, /l, /p, /b (no new features; keep them running)

Authority (the five-year lake, /l)
- The fish are moved, born, aged and caught only by step() in
  src/lib/lake-sim.ts, which must match sim/lakesim.mjs step for step.
  (v0.4 ponds keep stockAt() in src/lib/pond.ts until they are retired.)
- A timer may read and broadcast state. The lake runner's timer may write
  only two kinds of rows, through the same store functions a request uses:
  rows that follow from time (a haul, a winter's building, a year's rule, the
  season's end), at the step they happen; and the actions of bot families
  (throws, net purchases, promise asks and answers, seals, votes). All rows of
  one step are written in one transaction. Nothing else writes on a timer.
  While the server is down nothing happens: on restart a lake is rebuilt from
  its ledger and stepped on to the present with nobody throwing, bots
  included.
- The season's step, year and phase come from the start time and the
  clock (stepAt and phaseAt in src/lib/lake-sim.ts). Never keep the schedule
  in a variable that a restart would lose.
- Each season has a 256-bit secret. Every random stream is sfc32 seeded
  from SHA-256 of the secret and the stream's name (streamRng). The fish draw
  only from the "lake" stream, inside makeLake() and step(); the golden carp
  only from "koi"; a bot's decisions in one step from one stream seeded with
  SHA-256(secret | bot | step | seat).
  Replaying the ledger never runs a bot. Math.random() is never used in
  src/lib or the server. The secret appears in no event, frame, snapshot,
  page or log line before the season's end row.
- A lake records the model version it was played with, and is only ever
  replayed by that version.

The ledger
The ledger
- No state change without a ledger row, written in the same transaction.
  One catch that kills a pond writes two rows (catch, then collapse) in one
  transaction; a haul that leaves a lake with fewer than two fish
  writes the haul and the season's end row in the same transaction.
- Never write UPDATE or DELETE against the ledger.

Scope
- The page never decides an outcome: lake.js draws what the snapshot, rows
  and frames say, and words for them.
- The boat game (/b, docs/boats/RULES.md) is experimental and separate:
  work on it never changes /l or /p, their tables, or their tests.
- In the boat game the server decides every catch, ram, pick-up and score; a
  browser sends only steer, cast and dash, and draws what it is sent.
- A boat match is its seed plus the inputs applied at each tick; changing
  how a stored match replays needs a new model name (BOAT_MODEL).
- DESIGN.md 'Quick Catch' lists the four lake rules the boat game does not
  follow (the record, timer writes, restarts, streams) and why. Every other
  rule in this file applies to /b.
