# Common Pool: design v0.4

## What it is

A shared pond. Fish regrow on their own. Anyone in the pond can tap to catch
one fish and keep it. You can see how your catching, and everyone else's,
changes the pond, and you work out with the people around you how to use it.

## A person

A named net in one pond, held by one browser (a cookie token, one year).
No accounts, no email. Name: 1–24 grapheme clusters (see Names).
Known limit: one human can open several browsers and hold several nets. We do
not prevent this. The app is made for people who can see each other.

## Ponds

- The home page lists every pond: number, alive or dead, age, fish now (or
  when it died), how many nets. A button digs a new pond.
- Ponds are numbered ("Pond 7"), not named, so the only free text in the app
  is a person's name.
- A pond has its own URL (/p/7). Two people join the same pond by opening the
  same URL. After a pond dies, its page shows the record and a button to dig a
  new one.
- Digging a pond writes a `dig` row with stock K.

## Names

- Trimmed. 1–24 grapheme clusters (Intl.Segmenter). No control characters.
  Whitespace-only is rejected.
- Unique within a pond, compared case-insensitively after trimming, so the
  ledger reads unambiguously.

## Names (tightened)

Stored in Unicode NFC. Compared by NFKC + lower case. Rejected if they contain
a control character (Cc) or a format character (Cf) other than U+200D (the
zero-width joiner inside emoji). This removes bidi overrides and other
invisible characters.

## The pond model

- Growth with a strong Allee threshold A:
  dS/dt = r · S · (S/A − 1) · (1 − S/K).
  In the model, a population below A shrinks toward zero even if nobody fishes.
- Parameters (v0.2, from sim/pond_sim.py): K = 300, A = 30, r = 0.2377 per
  minute. Peak regrowth G is about 90 fish/min.
- One tap catches one fish. At most one tap per net per second (60 fish/min),
  so one net at full speed (60/min) is below G, and two nets (120/min) are
  above it.
- Stock is a real number. Fish available = floor(stock). The UI shows floor.
- Design choice: when stock falls below 1 the pond is dead. A dead pond is
  read-only and never restocked. The equation only approaches zero; declaring
  death at 1 is our rule, not a result of the model.
- Stock is evaluated from the last recorded stock and the elapsed time with
  fixed-step RK4 (step = 1 second). Stored stock is never changed by a timer.

What the simulation shows (tested scenarios, not guarantees):
- From a full pond, one net at full speed did not empty it in 30 minutes.
- From a full pond, two nets at full speed emptied it in about 5 minutes.
- From a quarter-full pond, one net at full speed emptied it in under 2
  minutes. A single person can finish off a pond that others have weakened.

## Casting (v0.2)

First come, first served: a tap is settled in one database transaction when
the server receives it. The only fairness claim is: when two taps compete for
the last fish, the one that reaches the server first gets it. Every tap
carries an idempotency key, so a retried request never catches twice.

## Taps and the rate limit

- A net may catch again 1000 ms (60000 / MAX_TAPS_PER_MIN) after its last
  successful catch, by server time.
- A tap that is too soon gets a "too soon" answer with the milliseconds left.
  It writes no ledger row (nothing changed) and goes to the server log.
- A tap on a dead pond gets a "dead" answer. No row.
- Every tap carries an idempotency key made by the client (a random UUID per
  tap). It is stored on the catch row, unique per net, and kept. A repeated
  key gets the original result back and writes nothing.
  Known limit: a tap refused as "too soon" stores no key, so a retry after the
  cooldown can succeed. That is intended: a refused tap caught nothing.

## Collapse

- If a catch leaves stock below 1, the same transaction writes the `catch`
  row and then a `collapse` row.
- If a pond dies with nobody fishing, the collapse row is written the first
  time anything evaluates that pond after the moment of death (a page load, a
  tap, the live timer). Its time is the computed moment stock fell below 1
  (last row time + collapseAfterMs), not the time it was noticed.
- A pond has at most one collapse row.

## Collapse time (tightened)

An unaided collapse row's time is min(last row time + collapseAfterMs, now).
It is never in the future.

## Live state

- Every tap is broadcast to everyone in the pond right after its transaction
  commits.
- While a pond has viewers, the server also broadcasts a snapshot once per
  second: stock evaluated at that moment, fish available, who is present.
  This is how regrowth and a pond dying on its own reach the screen when
  nobody taps.
- A timer or a read may broadcast. It may write exactly one thing: the
  collapse row, when evaluated stock falls below 1.
- The client never computes stock. It shows the latest snapshot.

## Live updates (session 3)

- Server-Sent Events, one stream per pond.
- Ledger rows go out as events whose id is the row id.
- Snapshots (once per second while the pond has viewers) go out as a
  separate event type with no id, so a reconnecting browser's Last-Event-ID
  is always a ledger row.
- On reconnect the server replays rows after Last-Event-ID (at most 500; more
  than that sends a "reload" event), then sends a snapshot at once.

## Present

A net is present while it has an open live connection, and for 15 seconds
after that connection drops. Used by the vote (planned v0.5, crit 9) and
shown on screen.

## Live events

- Viewer: anyone with the pond's stream open, with or without a net.
- Present: a net whose browser has the stream open, plus 15 seconds after it
  closes.
- Ledger event (`event: row`, `id: {row id}`), data:
  {id, kind, at, name (null for dig and collapse), available}.
  Never the idempotency key, the net id or a token.
- Snapshot (`event: snapshot`, no id), once per second while the pond has at
  least one viewer, and once right after a (re)connect, data:
  {at, available, regrowthPerMin (growthPerMin at the current stock, rounded
  to a whole number, 0 if dead), dead, diedAt, viewers,
  nets: [{name, catches, present}]}.
- The stream also sends a comment line every 15 seconds so proxies do not
  close an idle stream.
- On reconnect with Last-Event-ID: replay rows after it (at most 500; beyond
  that, `event: reload`), then a snapshot.

## The ledger

No state change without a ledger row, written in the same transaction (a
catch that kills a pond writes two: catch, then collapse). Rows are append-only.
The database refuses UPDATE and DELETE on it (trigger). Row id = event id for
the live stream. Failed requests and server errors are NOT in the ledger; they
go to the server log.

## The ledger row

id (integer, increasing), pond, at (server ms), kind (dig | join | catch |
collapse), net (null for dig and collapse), stock_after (the real-valued
stock right after this row), idempotency key (catch rows only).
Stock at any time t = stockAt(stock_after of the pond's latest row,
t − that row's at).

## Durability

SQLite in WAL mode with synchronous = NORMAL. A commit no longer waits for an
fsync (about 44 ms each on the dev machine), which would block Node's event
loop and delay everyone's live updates. The cost: if the Fly machine itself
crashes (not just the app), the last commits can be lost. For a pond, losing
the last second of catches after a host crash is acceptable; a live update
that arrives late for everyone, all the time, is not. The server logs how long
each commit takes, so this can be checked on Fly.

## Routes

All pages are rendered on the server and work before any script runs.
- GET  /                 the register: the 50 most recent ponds, and a Dig button
- POST /dig              digs a pond, 303 to /p/{id}; 429 page if the same
                         client dug one less than 10 s ago
- GET  /p/{id}           the pond page (404 page if there is no such pond)
- POST /p/{id}/join      form field `name`; sets the cookie; 303 to /p/{id}.
                         Errors re-render the page with the message and status
                         400 (bad name), 409 (name taken), 410 (dead pond)
- POST /p/{id}/catch     JSON {"key": "<uuid v4>"}. Answers (JSON):
                         200 {ok, available, id}     (also for a duplicate key)
                         429 {retryInMs}             too soon
                         410 {}                      dead pond
                         403 {}                      no net in this pond
                         400 {}                      key is not a lowercase UUID v4
- GET  /p/{id}/events    the live stream (Server-Sent Events)
- GET  /readme/          README.md rendered as HTML (images under /docs/ served)
- GET  /static/*         the page script and stylesheet

## Identity

- One cookie per pond: name `net_{id}`, value the net's token, HttpOnly,
  SameSite=Lax, Path=/p/{id}, Max-Age one year, Secure when the request came
  over https (Fly's proxy sets X-Forwarded-Proto).
- A browser with a valid net in this pond sees "You are {name}" instead of the
  join form. An unknown or stale token is ignored and the join form shows.

## Requests from other sites, and limits

- Any POST whose Origin header is present and does not match the Host is
  refused with 403. (Browsers send Origin on POSTs; SameSite=Lax is the
  second layer.)
- Idempotency keys must be lowercase UUID v4. The server rejects anything
  else, and the store checks it too.
- At most one dig per 10 seconds per client IP, kept in memory. The IP comes
  from the Fly-Client-IP header, which Fly's proxy sets on every request.
  Requests without that header (local runs, CI's container) are not limited,
  so tests can dig freely. At most 100 nets per pond.

## The pond page

- Big: fish available now, and the regrowth per minute. A picture of the
  pond with one mark per fish (at most 300).
- One button, "Cast (1 fish)", also on the Space key when the page has focus.
  After a catch it shows the cooldown until it can be pressed again. It shows
  "too soon", "dead" and network errors in words, not just colour.
- The nets in this pond: name, catches, present or not. Your own net marked.
- The last 30 ledger events, newest first, in plain words
  ("Mia caught a fish · 12 left", "The pond died").
- A dead pond shows when it died, how long it lived, the catches per net, and
  a button to dig a new pond. No blame numbers.
- Works at 1920×1080 and at 390×844. Everything can be done with the keyboard.

## Logs

Every request and every refused action is one JSON line on stdout:
{t, method, path, status, ms}, plus {event, pond, net, reason} for refused
actions and {event: "commit", ms} for each store write. (Crit 10 builds on
this.)

## Governance (planned v0.5, crit 9)

The rule is a per-NET catch limit per minute (not per person: the app cannot
see people, only nets). One human holding two nets gets two limits. Stated in
the README as a known limit.

One rule type only. Anyone proposes a number; it passes when more than half
of the nets present vote yes within 60 seconds. Breaches are not blocked;
they are shown in red with the facts: who, when, how many, stock at the time.

## Not building

Chat, or any free text except a name. Accounts. Cross-pond leaderboards.
AI-generated anything. Restocking a dead pond. Async voting. Blame numbers
that claim how much one person shortened the pond's life.

## Assumptions to test

- H1 (two people): two strangers in two browsers notice within a few minutes
  that the other's catching changes what they can catch, and react to it.
- H2 (four people): with no rules, someone tries to coordinate before the pond
  dies.
- H3 (tap rates): real tap rates are close enough to the simulated ones that
  the timings above hold roughly. Check against the ledger after a playtest.

A playtest where the same group plays again after a collapse cannot show WHY
their behaviour changed (they also learned the game and each other). We report
what changed, not the cause.

## Changelog

- v0.4: durability (WAL, synchronous NORMAL), routes, cookies, Origin check,
  limits, event payloads, viewers, stricter names, collapse time never in the
  future, the pond page, JSON logs.
- v0.3: ponds, names, rate limit, idempotency, collapse timing, ledger row,
  live-update ids and 'present' decided (the 13 open points from session 1).
  Governance limit is per net, not per person.
- v0.2: parameters K=300, A=30, G≈90 so that two sessions can meet the core
  conflict (markers use two sessions). Dropped the slogan "only a room can
  empty it" (a single net can finish off a weakened pond). Death at stock < 1
  stated as a design choice. Added the once-per-second server snapshot.
- v0.1: replaced plain logistic growth (one person could empty the pond; 0.4
  fish grew back), 1-second batched tides (a fairness promise that
  contradicted itself) and four rule types (too much before any playtest).
