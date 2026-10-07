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

Authority
- The server is the only authority on the fish and the catches. The client
  never computes where a fish is, what a net takes, or any outcome. It draws
  what the server sent, and may only move a fish smoothly between two frames
  it received.
- The fish are moved, born, aged and caught only by step() in
  src/lib/lake-sim.ts, which must match sim/lakesim.mjs step for step.
  (v0.4 ponds keep stockAt() in src/lib/pond.ts until they are retired.)
- A timer may read and broadcast state. The tick may write only two
  kinds of rows, each through the same store function a request uses: rows
  that follow from time (a net's haul, a year's rule, the season's end),
  stamped with the step they happened at; and the actions of bot families
  (throws, net purchases, votes, seals). Nothing else writes on a timer.
  While the server is down nothing happens: on restart a lake is replayed
  from its ledger and stepped on to the present with nobody throwing.
- The season's step, year and phase come from the start time and the
  clock (stepAt and phaseAt in src/lib/lake-sim.ts). Never keep the schedule
  in a variable that a restart would lose.
- The fish draw only from the lake's own seeded source, inside
  makeLake() and step(). Bots and the golden carp draw from separate sources
  derived from the seed, the step and the family, so replaying the ledger
  never runs a bot. Math.random() is never used in src/lib or the server.
  The seed is secret until the season's end row: it never appears in an
  event, a frame, a snapshot, a page or a log line before then.
- Model and game constants live only in src/lib/constants.ts and
  src/lib/game-constants.ts.
- Events, frames and snapshots never contain an idempotency key, a net
  id, a family token, or (before the season's end row) the seed.

The ledger
- No state change without a ledger row, written in the same transaction.
  One catch that kills a pond writes two rows (catch, then collapse) in one
  transaction; one that kills a lake writes three (cast, collapse, end).
- Never write UPDATE or DELETE against the ledger.

Scope
- No free-text input except a name (max 24 characters). No chat. If a feature
  seems to need a message box, stop and ask me.
- Nothing from "Not building" in DESIGN.md.
- No client framework and no build step. The page is server-rendered HTML
  plus one plain script in /static. Node runs src/*.ts directly.

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
