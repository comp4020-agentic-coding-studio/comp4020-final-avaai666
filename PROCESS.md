# Process

## Where this stands (crit 10)

The app is one site with four multiplayer games on one shared lake. In Boat
Rush you sail, net, ram and race home. Fishing Party is five different
mini-games in a row. Who's Poaching is a hidden-role game about a secret
poacher. Lake Holdings is a board where you build on the water. A room keeps
its own lake between games. Every page is in English and Chinese. Design: `DESIGN.md` v5.4; rules: `CLAUDE.md`; checks: `spec/`.
The earlier versions still run and are linked from /making-of:
- the shared pond (crit 8);
- the five-year lake (crit 9);
- Quick Catch, the first boats.

This is why it changed shape three times, and what the harness learned.

## How I work with the agent

I design in chat and build a playable prototype as a single HTML file before
any session. Then one prompt hands the work to the agent, always with the
same shape:
- paste the real state of the repo;
- write the tests first and show them red;
- break the key test on purpose, to show it can fail;
- commit after each step;
- end with a list of what is still wrong, without fixing it.

Two rules turned out to matter most:
- The agent stops when the design is silent or a rule would break, and asks
  me instead of choosing.
- A second model reviews my plans. I check each of its claims before acting
  on it.

The agent decides how, never what; it tells me where my "what" is incomplete.

## Stack

One Fly machine, Node running TypeScript, `node:sqlite`,
`node:http` and Server-Sent Events, with no client framework and no build
step (`docs/decisions/0001-stack.md`). The games kept that stack:
- The server steps every match 20 times a second.
- It sends each seat its own frame 10 times a second.
- It stores only the seed and the inputs, so a match replays exactly.
- A browser draws what it is sent with Three.js, one vendored file.

The per-seat frame is the one real change: a hidden-role game cannot send
everyone one picture.

## Art

The six portraits are SVG and the 3D world is Three.js code, written by
Claude in chat for prototype v7 and moved into `src/static/play/` in
session 13. No image model was used and nothing is generated at run time.
In session 18 the code, including the party's intro pictures (SVG), was
written by Claude in claude.ai, working in its own clone of this repo.

## Moments

### Green tests, bored people

At crit 9 the five-year lake had 222 passing tests, and classmates stopped
playing after two minutes. It had one action, and nothing to decide about
anyone else. No test could catch that. I rebuilt the core as boats, a
hold and a trip home, and shipped it beside the old game, not over it
([`7ca9660`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/7ca9660)).

### The harness stopped my own prompt

My prompt for the boats said "do not touch `DESIGN.md`". `CLAUDE.md` says to
stop when the design is silent. The agent stopped before writing any code,
listed six conflicts and asked me to choose. I took its advice. The design
was updated first, in a commit of its own. Four rules the boats could not
follow became written exceptions, each with its reason
([`7c6b8ca`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/7c6b8ca)).
The rules bind me too.

### I narrowed the scope without asking

I asked for four games and said players should choose. The plan I handed
the agent turned the party into "events", made the poaching game a "later
candidate" and dropped the territory game. A second review caught it. The
tests were green, because they only check that code matches the plan. I
restored all four as promised and added a rule: no agent may drop, merge or
postpone a mode. A blocked mode stops with evidence and alternatives
([`779efa5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/779efa5)).

### Bots as an oracle for "no single move wins"

A balance harness plays 300 bot matches per game (`scripts/balance.ts`).
Before tuning:
- Boat Rush's "Big Hold first" won 46.5% of four-seat matches.
- Fishing Party's "always buy Fast Boat" won 53.3%.
- In Who's Poaching, the bot poacher sank the lake on day 1 in 39 of 40
  games, so no vote could matter.

The fixes were numbers, not rules. "Always skip" still wins the fishers 0%:
the game forces a vote. The report is about bots, never people
([`370b17a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/370b17a)).

### A rule changed, so a test changed

Making the last meeting vote compulsory turned an old app test red. That
test played a table where nobody ever votes, and that table no longer exists
in the game. The agent stopped instead of editing it. I chose: a meeting now ends when
everyone has voted, and the test's players vote. Every assertion stayed, and the commit says why
([`72b7469`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/72b7469)).

### Tests caught leaks I could not see

The four-browser poaching test found that the last frame sent every role
before the "end" event. The fix went into the code, and a unit test now
plays to the end
([`884eb6c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/884eb6c)).

### One front door

By crit 10 the site was three games stacked on each other:
- "/" was still the five-year lake;
- the current game was linked from nowhere;
- `DESIGN.md` described all three.

I designed the site as a clickable mock. The agent then:
- made "/" the current game, with one line saying what it is about;
- added a how-to-play page for each game and a /making-of page;
- moved the old designs into `docs/design-history/`
  ([`5a42cbf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/5a42cbf),
  [`fe73b88`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/fe73b88)).

The marker's route became a test. It reads /readme/, puts two separate
profiles in one room within a second, restarts the server and finds the
room's history, in two languages
([`e015058`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/e015058)).

### Green tests, broken game

In session 18 the school agent's budget ran out, so I moved the work to
Claude in claude.ai. It cloned the same repo, followed the same `CLAUDE.md`,
and hands the commits back to me as a git bundle; I push them myself.

Every unit test was green. Then it played each mode in a real browser, from
the home page to the end screen, on a laptop and a phone. That turned up
bugs no test had caught:
- the end screen said "280 → 280", and buttons showed key names ("skipall");
- on a laptop, WASD could not sail up or down, because the code read `dir.y`
  where the world gives `dir.z`;
- Fishing Party's intro card vanished when the room cleared its countdown;
- every page logged a 404 for `/favicon.ico`.

Each fix began with a test that failed first
([`bbd645a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/bbd645a),
[`cf60534`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/cf60534),
[`f01359b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/f01359b)).
This is why `CLAUDE.md` says a change to a /play script is not done until a
real browser has started a match. The 2.0 rebuilds of the other three modes
landed the same way
([`301e1a6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/301e1a6),
[`9da6314`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/9da6314),
[`f2d125a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/f2d125a)).

## Moved off the player's pages, 29 October

CLAUDE.md already said player-facing pages carry no course text; three
places on the live site still broke that rule, found by a sweep for
"commit", "PROCESS.md", "DESIGN.md", "seeded", "balance-check", the course
and my own name, run against every player page's rendered HTML in both
languages (`spec/unit/site-pages.test.ts`'s new describe block).

- `/making-of`'s lede said "The full story, with the commits, is in
  PROCESS.md" (`making_p`). That sentence is this very file's own pitch to
  the reader; a player does not need to be told where the commits are. Cut
  to the second sentence alone: every earlier version still runs, and its
  lakes are still there.
- Each of the four `/making-of` eras had a `_why` line that was a design
  log, not a game page: it named me by name ("it was one game where Ava
  wanted four"), reported a play test's outcome, or said "Balance-checked
  by bots over many seeded matches" — a claim about a harness, not something
  a player standing on the page needs. All four `era*_why` keys are gone
  from both dictionaries; each era still says what it *was*, in its own
  `era*_p` line, with no verdict attached. This also closed a wider leak the
  sweep's test found by accident: every page embeds the *whole* dictionary
  as boot JSON for the client scripts (`src/site-pages.ts`'s `#boot` script
  tag), so these four keys were not only visible on `/making-of` — their
  raw text sat in the HTML source of every page on the site, including the
  room and the game itself.
- `/readme/`'s Chinese page opened with a Chinese About, then a yellow
  banner apologising that the README is English-only (`readme_en_note`),
  above the collapsed English text. My call: a Chinese page is either fully
  Chinese or it does not apologise for being English. The note is gone from
  both dictionaries; the Chinese About stands on its own (it already told a
  player what the game is, how a room works, and that the lake remembers,
  in three paragraphs), and the English README sits one tap away with no
  note about its language. `CLAUDE.md`'s line on this is updated to match:
  "A Chinese page carries its own Chinese About, with the English text
  sitting behind a plain link, and no note about the language."

Nothing here is deleted from the project's own record: the commits, the
play-test findings and the balance numbers are still exactly where they
belong, in this file and in `docs/checks/`.

## Corrections that landed in the harness

- Scope belongs to me: the four modes are named in `CLAUDE.md`.
- One front door; earlier versions are frozen but kept.
- Two languages, and a missing key fails a test.
- A secret is never sent to a seat that may not see it.
- Simulation and bot results are claims about strategies and seeds, never
  about people.
- A test may change only when a rule I approved has changed, and the commit
  says so.

## Next

Crit 10 is the first group playtest of all four games, on phones. I will
watch:
- whether people name the choice that matters without being told;
- whether they change plans because of someone else;
- whether they ask for a rematch.

Each room's `summary.json` records actions, time to first score and the lake;
I will compare it with what I saw.
