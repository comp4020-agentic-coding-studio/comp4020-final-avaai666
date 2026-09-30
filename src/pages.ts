// Server-rendered pages (DESIGN.md, Routes and The pond page). Everything a
// person typed is escaped.
import { CATCH_INTERVAL_MS, K } from "./lib/constants.ts";
import { available, growthPerMin } from "./lib/pond.ts";
import type { LedgerRow, PondState, PondSummary } from "./lib/store.ts";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// A plain duration: "40 s", "12 min", "5 h", "3 days".
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 48 * 3600) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} days`;
}

// The script replaces the UTC text with the reader's local time.
const time = (ms: number): string => {
  const iso = new Date(ms).toISOString();
  return `<time datetime="${iso}">${iso.slice(0, 16).replace("T", " ")} UTC</time>`;
};

// A ledger row in plain words; the script says the same things.
export function rowWords(row: LedgerRow, name: string | null): string {
  const n = available(row.stockAfter);
  const who = esc(name ?? "Someone");
  switch (row.kind) {
    case "dig":
      return `The pond was dug · ${n} fish`;
    case "join":
      return `${who} joined · ${n} fish`;
    case "catch":
      return `${who} caught a fish · ${n} left`;
    case "collapse":
      return "The pond died";
  }
}

function layout(title: string, body: string, head = ""): string {
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    ${head}
    <link rel="stylesheet" href="/static/style.css" />
    <script src="/static/app.js" defer></script>
  </head>
  <body>
    <header><a href="/" class="home">Common Pool</a> <a href="/readme/">About</a></header>
    ${body}
  </body>
</html>
`;
}

const digForm = (label = "Dig a new pond"): string =>
  `<form method="post" action="/dig" class="dig"><button type="submit">${label}</button></form>`;

export function registerPage(ponds: PondSummary[], now: number): string {
  const rows = ponds
    .map(
      (p) => `<tr>
        <td><a href="/p/${p.pondId}">Pond ${p.pondId}</a></td>
        <td>${p.dead ? "dead" : "alive"}</td>
        <td>${duration(now - p.dugAt)}</td>
        <td>${p.dead ? `died ${time(p.diedAt!)}` : `${p.available} fish`}</td>
        <td>${p.nets}</td>
      </tr>`,
    )
    .join("");
  const table = ponds.length
    ? `<table>
        <caption>The most recent ponds</caption>
        <thead><tr><th scope="col">Pond</th><th scope="col">State</th><th scope="col">Age</th><th scope="col">Fish</th><th scope="col">Nets</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : "<p>No ponds yet. Dig the first one.</p>";
  return layout(
    "Common Pool",
    `<main>
      <h1>Common Pool</h1>
      <p>A shared pond. Fish regrow on their own. Anyone in the pond can catch one at a time and keep it.
      Catch too fast, all of you together, and the pond dies for good.</p>
      ${digForm()}
      ${table}
    </main>`,
  );
}

export interface PondView {
  state: PondState;
  rows: LedgerRow[]; // newest first
  me: string | null; // this browser's net name
  now: number;
  error?: string;
  typedName?: string;
}

export function pondPage({ state, rows, me, now, error, typedName }: PondView): string {
  const id = state.pondId;
  const names = new Map(state.nets.map((n) => [n.netId, n.name]));
  const regrowth = state.dead ? 0 : Math.round(growthPerMin(state.stock)) || 0;

  const errorLine = error ? `<p class="error" role="alert">${esc(error)}</p>` : "";
  let you: string;
  if (state.dead) {
    you = `<section class="record">
      <h2>This pond is dead</h2>
      <p>It died ${time(state.diedAt!)}, after living ${duration(state.diedAt! - state.dugAt)}.</p>
      ${digForm()}
    </section>`;
  } else if (me !== null) {
    you = `<section class="you">
      <p>You are <strong>${esc(me)}</strong>.</p>
      <button type="button" id="cast" class="cast">Cast (1 fish)</button>
      <p id="status" role="status" aria-live="polite"></p>
      <noscript><p>Casting needs JavaScript.</p></noscript>
    </section>`;
  } else {
    you = `<section class="you">
      <form method="post" action="/p/${id}/join">
        <label for="name">Your name (1 to 24 characters)</label>
        <input id="name" name="name" required autocomplete="nickname" value="${esc(typedName ?? "")}" />
        <button type="submit">Join this pond</button>
      </form>
      ${errorLine}
    </section>`;
  }

  const nets = state.nets.length
    ? state.nets
        .map(
          (n) =>
            `<li${n.name === me ? ' class="me"' : ""}>${esc(n.name)}${n.name === me ? " (you)" : ""} · ${n.catches} caught</li>`,
        )
        .join("")
    : "<li>No nets yet.</li>";
  const events = rows.map((r) => `<li data-id="${r.id}">${rowWords(r, r.netId === null ? null : (names.get(r.netId) ?? null))}</li>`).join("");

  return layout(
    `Pond ${id} · Common Pool`,
    `<main class="pond" data-pond="${id}" data-last-id="${rows[0]?.id ?? 0}" data-me="${esc(me ?? "")}" data-dead="${state.dead}" data-cooldown="${CATCH_INTERVAL_MS}">
      <h1>Pond ${id}</h1>
      <section class="stock" aria-label="The pond now">
        <p><span id="available" class="big">${state.available}</span> fish</p>
        <p><span id="regrowth">${regrowth >= 0 ? "+" : ""}${regrowth}</span> fish per minute regrowing
          · <span id="viewers">0</span> watching · <span id="live">connecting…</span></p>
        <div id="picture" class="picture" aria-hidden="true" data-max="${K}">${"<i></i>".repeat(Math.min(state.available, K))}</div>
      </section>
      ${you}
      <section>
        <h2>Nets in this pond</h2>
        <ul id="nets">${nets}</ul>
      </section>
      <section>
        <h2>What happened</h2>
        <ol id="events" reversed>${events}</ol>
      </section>
    </main>`,
  );
}

export function readmePage(html: string): string {
  // README links are relative to the repo root, so images in docs/ resolve
  // to /docs/.
  return layout("About · Common Pool", `<main class="readme">${html}</main>`, '<base href="/" />');
}

export function errorPage(title: string, message: string): string {
  return layout(`${title} · Common Pool`, `<main><h1>${esc(title)}</h1><p>${esc(message)}</p><p><a href="/">All ponds</a></p></main>`);
}
