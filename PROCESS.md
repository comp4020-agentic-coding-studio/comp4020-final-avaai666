# Process

## Where this stands (crit 9)

The app started as Common Pool, one shared pond where each tap caught a fish
(crit 8, [`f71d6dd...82a90d7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/compare/f71d6dd...82a90d7)).
It is now Next Year, No Fish: a game for one table in which families fish a
lake of fish that school, spawn and grow, with a server that runs each lake
and streams it to every player ([`82a90d7...5f0fc7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/compare/82a90d7...5f0fc7f)).
The design is `DESIGN.md` (v2.3), the rules `CLAUDE.md`, the checks `spec/`.
Two pivots happened in between, and both are the story of this document.

## How I work with the agent

Every session is one prompt with the same shape: paste the real state of the
repo, change it test-first, break one or two key tests on purpose to prove
they can fail, and list what the design gets wrong without fixing it. I answer
each listed point myself and the answers become the next version of
`DESIGN.md`, with a changelog line.

Two habits were added after crit 8. I build a playable prototype in a single
HTML file before I spend a session on a mechanic, and play it myself. And I
have a second model review the design and the simulations, then check each
of its claims before I act on it. The agent never decides what the game is;
it is told, and it tells me where the telling is incomplete.

## Stack

One small Fly machine, one volume (`fly.toml`). Node 24 runs TypeScript
directly, with `node:sqlite`, `node:http` and Server-Sent Events, and no
client framework or build (`docs/decisions/0001-stack.md`). The game kept the
stack and changed how it is used. A lake is simulated in memory by one runner,
ten steps a second, and sent as a frame of fish positions five times a
second. Fish positions are never stored: the ledger stores only what people
and bots did, and a 256-bit secret seeds every random stream, so a season can
be rebuilt by replaying its ledger. That is also how a lake survives a
restart. SSE still fits: actions are plain POSTs, rows replay by id after a
reconnect, and frames are simply not replayed.

## Moments

### A pond became a game

At crit 8 my tutor said the pond was an explainer and should be a game that
three people at a table understand in two minutes. I did not add buttons to
the pond. I went back to the model: if a net's catch depends on how many fish
are left, buying a fine net becomes a social dilemma by itself. A simulation
checked it before any code ([`0a7423a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/0a7423a)),
and the dilemma became a test ([`91021fa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/91021fa)).

### The prototype said it was not fun

I built that version as a prototype and played it. Tapping a timer while a
number falls is not a game: where you threw did not matter, and other
families could only be watched. Instead of adding features, I made the fish
agents. Two grown fish must meet to spawn, so a thin lake fails to recover on
its own (the Allee effect, seen instead of stated); fry live in the shallows
and slip through a coarse net; a fine net takes them, and they were next
year's fish. The re-run simulations ([`15185ac`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/15185ac))
became `DESIGN.md` v2.0 ([`e23c32d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/e23c32d)),
and the TypeScript model must match the reference model step for step
([`c979c36`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/c979c36)).

### A review overturned my proof

The v2.0 tests said switching to a fine net always pays. A review pointed out
that the simulation gave fine nets from the first throw, compared different
seats, and left out the golden carp. Each point held. When each family is
compared with itself, and nets are bought when a family can afford one,
switching pays the first three families but not the fourth: by then the lake
is already going ([`403ea6f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/403ea6f)).
I changed the claim rather than the parameters. The test no longer checks the
fourth row, and `CLAUDE.md` now says simulation results are claims about the
strategies and seeds in `sim/`, never about people
([`584fd89`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/584fd89), [`7d92014`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/7d92014)).
The agent's own list at the end of session 8 caught a mistake of mine: a
32-bit seed whose SHA-256 I meant to publish could be found by trying every
seed. The secret is now 256 bits.

### Who gets the fish (crit 9)

Two families aiming at the same school is the game working. When their nets
close on the same fish, the net thrown first takes it, and the other family
is told who got there first. I chose this over splitting, nearest-centre and
random draws because it is what the table sees, it never counts a fish twice,
and it replays exactly from the ledger order. It costs a player on a slow
connection some ties (`docs/decisions/0003-two-nets-one-fish.md`). A test
builds two throws in one step over one school; reversing the order a step's
throws are applied turns it red ([`ff3084c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/ff3084c)).

### Playing the page found what 222 green tests missed

The server had 222 passing tests when the page first ran a whole season
against it. Watching it, the bots' houses stopped growing after the first
winter: a bot threw only on the exact step its net was dry again, and that
step passed while the lake was frozen, so no bot threw again. The same season
showed two meeting bugs: bots voted the moment winter began, so Mei could
never follow a person's vote, and the tally counted only people's votes,
treating Old Wang's ban as "no rule". Each test had checked a step in
isolation; none had watched five years. Each got a test that fails first
([`44fda84`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/44fda84)).

### Corrections land in the harness

The markers read English, and my prototype still had Chinese-only labels.
That became a rule in `CLAUDE.md`: every word that carries meaning is
English; Chinese is decoration and always comes with its English. The bots
became a rule too: their behaviour is a script and may never be cited as
evidence about people. From crit 8, two older corrections still stand: a
simulation threw out three promises before they were built
([`8d15c9c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/8d15c9c)),
and a measured 41 ms commit decided durability
([`5ba1c16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-avaai666/commit/5ba1c16)).

## Next

Playtests with people, not bots: two people with no bots, four people, and
one person with bots, recording whether newcomers throw without being told,
whether they talk about each other's nets, and whether they ask for promises.
For crit 10, server-side logs that tell two people apart.
