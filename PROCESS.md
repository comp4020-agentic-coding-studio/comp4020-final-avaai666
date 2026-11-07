# Process

Next Year, No Fish is four multiplayer games on one shared lake: Boat Rush
(sail, net, ram, race home), Fishing Party (five mini-games), Who's Poaching
(find the hidden poacher) and Lake Holdings (build on the water). A room keeps
its lake between games, and every page is in English and Chinese. Design:
`DESIGN.md` v5.15; rules: `CLAUDE.md`; checks: `spec/`. Earlier versions run
from /making-of.

## Stack, and what it cost

One Fly machine runs Node on TypeScript directly, with `node:sqlite`,
`node:http` and Server-Sent Events. There is no client framework and no build
step ([0001](docs/decisions/0001-stack.md)).

- **`node:sqlite`, not a hosted database.** `fly.toml` gives one small machine
  and a volume. Every state change is a ledger row in the same
  transaction as the change, and a match is stored as its seed plus inputs, so
  it replays exactly. A local file keeps that one transaction. The cost: writes are synchronous and block the event loop. A default
  fsync measured 41 ms per write, so I chose WAL with `synchronous = NORMAL`
  and accepted losing the last commits if the host itself crashes
  ([0002](docs/decisions/0002-durability.md)).
- **SSE, not WebSockets.** The server steps each match 20 times a second and
  sends every seat its own frame 10 times a second. Inputs go up as ordinary
  POSTs. SSE reconnects by itself and its `Last-Event-ID` maps onto ledger row
  ids. The cost: every steer is an HTTP request, and your boat moves on the
  server's next frame, so a slow connection feels late.
- **No framework, no build step.** The page is server-rendered HTML plus plain
  scripts and one vendored Three.js file. A session's diff is the code that
  runs, which I can actually read. It cost hand-written DOM code, a
  hand-built two-language dictionary with a test for missing keys, and only the
  TypeScript Node can strip (`erasableSyntaxOnly`).

## The agent workflow, and why

I design in chat and build a one-file playable prototype first. Then one
prompt hands the work over, always in the same shape:

1. Paste the real repo state.
2. Write the tests and show them red.
3. Break the key test on purpose, to show it can fail.
4. Commit after each step.
5. End with what is still wrong, without fixing it.

The agent decides how, never what: when the design is silent it stops and
asks. A second model reviews my plans, and I check each claim before acting on
it.

The art is SVG and Three.js code written by Claude, in chat and in sessions;
no image model was used. From session 18 the work moved to Claude in
claude.ai under the same `CLAUDE.md`; I pushed every commit myself.

## Green tests, bored people

At crit 9 the five-year lake had 222 passing tests, and classmates stopped
playing after two minutes. It had one action and nothing to decide about
anyone else; no test could catch that. I rebuilt the core around boats, a hold
and a trip home, beside the old game
([`7ca9660`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/7ca9660)).
Tests show the code does what I said, not that it is worth playing.

## I narrowed the scope without asking

I asked for four games and said players should choose. The plan I handed the
agent turned the party into "events", made the poaching game a "later
candidate" and dropped the territory game. The tests were green because they
only check that code matches the plan. A second review caught it. I restored
all four modes and added the rule that no agent may drop, merge, downgrade or
postpone one, and that a blocked mode stops with evidence and alternatives
([`779efa5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/779efa5)).

## Green tests, broken game

Every unit test was green. Then the agent played each mode in a real browser,
from the home page to the end screen, on a laptop and a phone:

- the end screen said "280 → 280", and buttons showed raw key names
  ("skipall");
- WASD could not sail up or down, because the code read `dir.y` where the
  world gives `dir.z`.

Each fix began with a test that failed first
([`bbd645a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/bbd645a),
[`f01359b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/f01359b)).
That is why `CLAUDE.md` says a /play change is not done until
`scripts/browser-check.ts` has started a match. Playwright is dev-only
([0004](docs/decisions/0004-playwright-dev-only.md)), so CI cannot enforce it.

## One dial, three physics fixes

Boat Rush publishes three balance targets, measured over 300 bot matches by
`scripts/balance.ts`. `RUSH.UNLOAD_EVERY` was set to 0.33 on 24 October. Then
three physics fixes each made the simulation more faithful and every bot's
season a little more efficient:

- Fish could cross the lake at over 20 times their own speed; the targets held
  and the dial stayed at 0.33
  ([`ef93a34`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/ef93a34)).
- Boats braked whenever they were being steered. The dial moved to 0.30
  ([`b1530d0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/b1530d0)).
- Boats started facing the bank. The dial moved to 0.32
  ([`8dadf44`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/8dadf44)).

Each time I was shown the sweep as a table and chose. The targets' wording,
their "most" and the 41% line were never reworded to fit the code
(`docs/checks/balance-start-pose-2026-11-06.md`).

## Verification stayed mine

Across the last three sessions the agent pasted real green output every time:
typecheck, 526 unit tests, `pnpm check` and a real browser. It still left work
uncommitted twice. It left README publishing the previous version's balance
numbers (fixed in
[`43fee2d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/43fee2d)).
In that same fix it wrote "identical seeds, so this is not sampling noise",
which did not hold: the change alters each match's path from its first docking
on (corrected in
[`9bdf2b9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/9bdf2b9)).
None of these three would ever turn a test red. So now I check four things:

- that origin/main actually contains the change;
- that README and DESIGN agree with the newest `docs/checks/` report;
- that the deployed file carries the code;
- that a report's causal and statistical wording does not claim more than was
  measured.

The same held for my own research note. Its draft had real quotations,
accurate figures and a legal word count: every mechanisable check passed. A
second model that had read the sources found five faults, one of them mine.
Agreement between artefacts can be checked; justification
cannot.

## Where it ended

All four modes are playable from start to results and rematch. On 7 November, with the app running locally:
typecheck was clean, `pnpm test:unit` passed 526 of 526, `pnpm check` passed
568 of 568, and `pnpm check:evidence` resolved every cited commit. The newest
Boat Rush report (`docs/checks/balance-unload-countdown-2026-11-07.md`) keeps
all three targets clear.

If the project continued, I would do two things:

- run a group playtest of all four modes on phones against each room's
  `summary.json`;
- put the real-browser check into a gate the agent cannot skip.
