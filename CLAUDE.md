# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the template is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the course website publishes the
[final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/).
What the agent needs to carry from any of it is your call.

## Common Pool: rules for every change

DESIGN.md is the current design and has a version number. If it is wrong,
unclear or silent about what you need, STOP and tell me what and why. Do not
work around it. When I agree to a change, update DESIGN.md, bump the version
and add a changelog line, in the same commit as the code that needs it.

Authority
- The server is the only authority on stock and catches. The client never
  computes stock or an outcome. It shows what the server sent.
- Stock is evaluated only by stockAt() in src/lib/pond.ts.
- A timer may read and broadcast state. The only row a timer or a read may
  write is the collapse row.
- Model and rate constants live only in src/lib/constants.ts.
- Events and snapshots never contain an idempotency key, a net id or a token.

The ledger
- No state change without a ledger row, written in the same transaction.
  One catch that kills a pond writes two rows (catch, then collapse) in one
  transaction.
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
