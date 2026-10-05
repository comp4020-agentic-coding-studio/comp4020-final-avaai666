# Checks, 2026-10-06

- `fly-commit-times.txt`: twenty `{"event":"commit"}` lines from the app's log
  on Fly, read with `flyctl logs`. The app was deployed from my machine with
  `flyctl deploy` at commit 9fee210 (the repo was still private, so CI could
  not deploy it). Each write took 0.2–1.1 ms.
- `local-commit-times.txt`: the output of `scripts/measure-commit.ts` on my
  development machine, comparing SQLite's default fsync (FULL) with NORMAL.
  Decision 2 (`docs/decisions/0002-durability.md`) rests on this comparison.
- On Fly only NORMAL was measured; FULL was measured only on the development machine.
