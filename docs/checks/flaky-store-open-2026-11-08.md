# A flaky test: opening a fresh SQLite file timed out (2026-11-08)

Not fixed. Recorded so that "587 of 587 after a rerun" in PROCESS.md has its evidence.

## What failed

On 8 November, on commit 1786d49 plus documentation-only changes, `pnpm check` (app running locally) failed
3 of 587 tests on its first run and passed 587 of 587 on a rerun with nothing changed. That first run's
failure output was not kept, so which three tests failed is not known. Two further runs of the same suite
with a JSON reporter gave 587 of 587, then 586 of 587, with this one failure:

```
FAIL spec/unit/store.test.ts :: 2. names reject a control character as bad_name
     Error: Hook timed out in 10000ms.
```

The step that timed out is the `beforeEach` at `spec/unit/store.test.ts:21`. It does nothing but make a
temporary directory and open a fresh SQLite file in it (`openStore`); the test's own assertions never ran.
The file is in `os.tmpdir()` (`/tmp` here, on ext4), not in the app's data folder.

## What was measured

- This machine's disk (WSL2, ext4): a synced 4 KB write (`dd ... bs=4k oflag=dsync`) took about 41 ms
  (100 writes in 4.07–4.13 s, three times).
- The local server's log during the 3-failure run shows no request over 255 ms and no 5xx, so the server
  was not the slow part.
- `pnpm check` three times with both the app's data folder and `TMPDIR` on tmpfs (`/dev/shm`), everything
  else the same: 587 of 587, 587 of 587, 587 of 587. On the ext4 disk, 2 of 4 runs had a failure.
- CI: one run so far on 8 November (Canberra time), run 42391148390 on 1786d49, all 44 test files passed.
  The last 30 CI runs all succeeded; none produced this failure.

## What this does not show

The cause is not proved. Clean runs on tmpfs and failing runs on a slow-to-sync disk are consistent with
disk latency, but seven runs are few, and nothing here isolates the store open as the slow call. Whatever
the cause, a test whose setup can take over 10 seconds to open a database is a flaky test. The test and its
timeout were left unchanged, a day before the deadline.

The same disk is the likely reason `scripts/browser-check.ts` timed out on repeated local runs during the
8 November audit (17 of 42 runs, in all four modes), but that was not measured on tmpfs.
