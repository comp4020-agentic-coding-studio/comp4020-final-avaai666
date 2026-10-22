# The flaky frame test (spec/lake-app.test.ts, test 3)

Written by Claude in session 16, 19 October 2026. Everything here is about
this repo's server on one 8-core machine, run locally. It says nothing about
the live site or about other machines.

## The symptom

Test 3 opens a lake, starts it, opens a second client's stream, waits for the
first client's throw row, then counts the `frame` events that arrive in the
next second and expects at least four (the server sends one every 0.2 s, so
five). It sometimes sees two or three.

It failed in the full `pnpm check` of session 15 (once, passing on a rerun)
and in the first full run of session 16 (a second time, in a run that was
also loaded by my own scratch work). It passed in another full run of
session 16 run on an otherwise idle machine. CLAUDE.md now says a test that
fails and then passes on a rerun is a bug, so this report is the
stop-and-report that rule asks for.

## What was ruled out, with the evidence

| Suspect | Result |
|---|---|
| The lake's idle frame rate | On an idle machine the stream carried 31 frames in 6 s, max gap 204 ms (three runs). |
| A real code bug in `advance()` | One was found and fixed (`1112879`): a late tick that ran several steps and ended on an odd step returned "no frame due". The new unit test fails on the old code and passes on the fix. It is not what made test 3 fail: with the fix in, test 3 still failed under the conditions below. |
| CPU load alone | 8 busy threads for 12 runs of test 3: 0 failures, with or without the fix. |
| Starting a lake | The start request took 6-7 ms, with and without `rules.test.ts` beside it. |
| A slow SQLite statement, step, stringify or response write | The instrument (below) logged none over 50 ms in any caught failure. |
| A long event-loop stall | None over 300 ms in any caught failure, other than the one-off ~0.5-1 s of schema setup at server start. |
| The test client's own timer | Its 1 s wait ended 0-1 ms late in every caught failure. |
| Live lakes piling up | With 1 to 12 live lakes on an otherwise idle machine, loop delay p99 grew from 11 ms to 41 ms. No tick passed 40 ms with nothing else running. |

## What the caught failures show

The instrument was a preload outside the repo (`node --import`). It timed
every SQLite statement, `JSON.stringify`, response write, timer callback and
GC pause, logged event-loop gaps over 300 ms, and, from the last version, the
time of every frame written to each lake's streams and
`performance.eventLoopUtilization()` once a second (the last two only in the
third hunt). Test 3 was run in three hunts of 48, 48 and 32 runs (128 in all),
each batch of 6 on a fresh server (6 lakes live, under the cap of 12), with
one `rules.test.ts` running beside it. That caught one failure in the first
hunt (batch 8, run 48: arrivals not recorded), one in the second (failure 1
below) and one more (failure 2), and one in the third (failure 3). The first
hunt's failure is not in the table because its client timing was not
recorded.

| Failure | Client saw frames at (ms into the window) | Server side |
|---|---|---|
| 1 | 152, 348 | startup gap only; no slow piece, no slow tick |
| 2 | 121, 335, 530 | startup gap; 28 lake ticks of 40-74 ms, almost all our own JS (SQL 1-17 ms), one 30 ms GC |
| 3 | 120, 312, 513 | event-loop utilisation 0.04-0.09 every second; one slow tick (45 ms); no gap over 300 ms; frames to that lake written at about 200 ms intervals |

In failure 3 the server was nearly idle (event-loop utilisation under 0.1, no
slow piece, no stall). Its per-lake record shows frames written about 200 ms
apart, as they should be, but I could not reconcile the server's request-log
timestamps with the test's window (the log's close time for the stream falls
before the window ended), so I do not claim how many frames the server wrote
inside the window. That comparison, server writes against client arrivals for
the same second, is exactly what the evidence cannot yet give.

## What this means, and what it does not

- **Not saturation.** In the failure with a per-second record (3), the event
  loop was under 10% busy. Failure 2 had many 40-74 ms ticks, but that
  evidence is from a single failure, and I did not find them in the controlled
  repeats that followed (see the note below).
- **Not located.** The lake hub sends a frame only when `advance()` has run an
  even step in a given 100 ms tick. What I could not measure is whether the 100 ms hub
  timer itself fired on schedule: my instrument times how long each callback
  takes, not the interval between calls, and its gap alarm only reports gaps
  over 300 ms. A timer that fires at irregular 100-250 ms intervals, with no
  single gap over 300 ms, would fit the failures and would pass every check
  here. That is the measurement that is missing, and it is the next one to
  take.
- It is a timing effect that appears when another CPU-bound process shares
  the machine. It did not appear on an idle machine, so this report treats
  it as environmental for the purposes of the test setup, and does not claim
  to have found its mechanism.

Several of my early measurements in this investigation ran while leftover
`rules.test.ts` workers from my own earlier runs were still spinning, so
they were not on a quiet machine. Only the controlled runs (no stray vitest
processes before or after) and the caught failures above are reliable.

## What was changed, and how little it shows

Test 3 moved, body unchanged, to `spec/lake-frames.test.ts`. It runs in its
own vitest project (`app-own-server`) against a server that
`spec/global-setup-own-server.ts` starts for that file alone (own port,
temporary data directory), one file at a time, after the shared-app tests. Its
assertion is word for word what it was; the only line that differs is the one
that reads the server's address.

Twenty runs of that project, each overlapping a `rules.test.ts` run, were all
green. That is weak evidence. On the shared setup the test failed in 4 of 128
runs (4 of 128, about 3%), so 20 clean runs would still happen about half the
time (0.97 to the 20th is 0.53) even if the change did nothing. The change removes two things that could matter (a
server shared with other tests' lakes, and starting inside another file's
timing), but the cause was not found, and this report does not claim it is
fixed. If the test fails again on its own server, that is new evidence and
the entry should be reopened.

Also changed, for a related failure in the same suite: the `unit` project now
has `testTimeout: 30_000`. In a loaded full run `lake-runner`'s "throwNet
refusals" took 6.45 s against vitest's 5 s default; alone it takes 2.9-3.9 s.
No assertion changed.

## A known edge, fixed

Starting a 13th live lake on one server used to answer an unhandled `500`
(`Error: full`) instead of a clear message, because the lake hub caps live
lakes at 12 (`MAX_LIVE_LAKES` in `src/lib/lake-live.ts`). Fixed as a crash fix
in frozen code (`/l`): `register()` now throws a typed `LakeFull` error
(`src/lib/lake-live.ts`), which `showLake`, `startLake` and `lakeEvents`
(`src/routes.ts`) each catch and answer with 503, `Retry-After: 60`, and
`g_busy` from `src/lib/i18n.ts` in both languages, instead of letting it
reach the generic 500 handler. `spec/unit/lake-live.test.ts` covers the cap
directly: 12 lakes register without throwing, a 13th throws `LakeFull` (not
a bare `Error`), and re-registering an already-live lake (a rebuild) never
counts against the cap. Two of the failures seen during this investigation
were this edge, from my own loop starting too many lakes on one server, and
were not the frame failure.
