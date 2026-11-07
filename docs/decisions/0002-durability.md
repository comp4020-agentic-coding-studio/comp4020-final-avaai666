# 2. Durability: WAL with synchronous = NORMAL

Date: 2026-10-01
Status: accepted, checked on Fly on 2026-10-06

## Context

- `node:sqlite` is synchronous (decision 1). While a commit runs, the server does nothing else, including sending live updates.
- With SQLite's default setting, every commit waits for an fsync. On the development machine that measured about 41 ms per write (`docs/checks/2026-10-06/local-commit-times.txt`).
- A dozen people tapping once a second would then block the server for about half of every second, and every live update would arrive late for everyone.

## Decision

SQLite in WAL mode with `PRAGMA synchronous = NORMAL`. A commit no longer waits for an fsync.

As built, this is true only of the lake store (`src/lib/lake-store.ts`). `synchronous` is set per connection, and the /play store (`src/lib/game-store.ts`) opens its own connection to the same file, sets WAL and leaves `synchronous` at the default, so its commits still wait for an fsync. Measured on 2026-11-08 with node:sqlite: on a WAL file where one connection had set `synchronous = NORMAL`, a second connection to the same file reported `PRAGMA synchronous` as 2 (FULL).

## Consequences

- If the app crashes, nothing committed is lost.
- If the machine itself crashes (power, host failure), the last commits can be lost. For a pond, losing the last second of catches after a host crash is acceptable. Late live updates for everyone, all the time, are not.
- The server logs every write's duration as `{"event":"commit","ms":…}`, so the cost on Fly's volume can be measured instead of assumed. On 2026-10-06, twenty writes on Fly took 0.2–1.1 ms each (`docs/checks/2026-10-06/fly-commit-times.txt`).
- The ledger is still append-only; durability does not change what is recorded, only how quickly it is forced to disk.
- 2026-11-08: found that the /play store was never given the setting this decision called for (see Decision above). It was left unchanged rather than altering the storage layer a day before the deadline.
