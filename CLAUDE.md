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
- A timer may read and broadcast state. The only row a timer may write is the
  collapse row.
- Model and rate constants live only in src/lib/constants.ts.

The ledger
- Every state change writes exactly one ledger row, in the same transaction.
- Never write UPDATE or DELETE against the ledger.

Scope
- No free-text input except a name (max 24 characters). No chat. If a feature
  seems to need a message box, stop and ask me.
- Nothing from "Not building" in DESIGN.md.

Tests
- Test first. A first run that fails because a function is "not implemented"
  is fine; the test must then pass against real behaviour.
- Never edit or delete a test to make it pass. If a test looks wrong, stop and
  tell me why.
- Before saying "done", paste the real output of every script from Step 0 (b)
  that exists (for example pnpm test, pnpm check, pnpm check:evidence,
  pnpm build).
- For a key promise I name (stock, duplicate requests, persistence), prove the
  test catches a real bug: with the green version committed, change ONE line
  in ONE file, show the test going red, restore that file with
  `git restore <file>`, show `git status` clean and the tests green.

Honesty
- Paste real command output, never a summary.
- Never write in any file that something happened unless it happened in this
  repo (for example "deployed", "users liked it", "faster").

Safety
- Never read, print or commit mise.local.toml or FLY_API_TOKEN.
- Never touch .github/workflows or the app name in fly.toml.
- Never push. I push.
