// Server-rendered lake pages (DESIGN.md v2.2, "Pages and routes"). No canvas
// yet: the live and done pages show a plain list of rows, which the client
// script (lake.js) appends to as they stream in. Everything typed is escaped.
import { HOUSE_PARTS } from "./lib/game-constants.ts";
import { esc, layout, time } from "./pages.ts";
import type { PublicRow, Snapshot } from "./lib/lake-runner.ts";

function rowWords(r: PublicRow, nameOf: (seat: number | null) => string): string {
  const who = nameOf(r.seat);
  const d = r.data as Record<string, unknown>;
  switch (r.kind) {
    case "open":
      return "The lake was opened";
    case "join":
      return `${who} joined`;
    case "start":
      return "The season started";
    case "throw":
      return `${who} threw a ${d.fine ? "fine" : "coarse"} net${d.breach ? " (a breach)" : ""}`;
    case "haul":
      return d.got ? `${who}'s net took ${d.got} fish${d.koi ? " and the golden carp" : ""}` : `${who}'s net came up empty`;
    case "buy":
      return `${who} bought a fine net`;
    case "ask":
      return `${who} asked ${nameOf(d.to as number)} to promise coarse nets only`;
    case "answer":
      return `${who} ${d.yes ? "accepted" : "declined"} a promise`;
    case "broken":
      return `${who} broke a promise with ${nameOf(d.to as number)}`;
    case "seal":
      return `${who} stamped ${d.seal} on ${nameOf(d.to as number)}`;
    case "vote":
      return `${who} voted ${d.rule}`;
    case "build":
      return (d.parts as string[]).length ? `${who} built ${(d.parts as string[]).join(", ")}` : `${who} built nothing new`;
    case "rule":
      return `The village chose: ${d.rule}`;
    case "end":
      return "The season ended";
  }
}

export function lakeHomePage(pastLakes: { code: string; openedAt: number }[]): string {
  const rows = pastLakes
    .map((l) => `<tr><td><a href="/l/${esc(l.code)}">${esc(l.code)}</a></td><td>${time(l.openedAt)}</td></tr>`)
    .join("");
  const table = pastLakes.length
    ? `<table>
        <caption>Past lakes</caption>
        <thead><tr><th scope="col">Lake</th><th scope="col">Opened</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : "<p>No finished lakes yet.</p>";
  return layout(
    "Next Year, No Fish",
    `<main>
      <h1>Next Year, No Fish (明年无鱼)</h1>
      <p>A fishing game for a table of people that explains the tragedy of the commons by letting them cause it.
      Grow your family's house. The fish in the lake belong to everyone.</p>
      <form method="post" action="/lakes"><button type="submit">Open a lake</button></form>
      ${table}
      <p><a href="/readme/">About</a></p>
    </main>`,
  );
}

function rowsList(rows: PublicRow[], nameOf: (seat: number | null) => string): string {
  const items = rows.map((r) => `<li data-id="${r.id}">${esc(rowWords(r, nameOf))}</li>`).join("");
  return `<ol id="rows" reversed>${items}</ol>`;
}

export interface PreStartView {
  state: "pre";
  code: string;
  families: { seat: number; name: string }[];
  me: number | null;
  error?: string;
  rows: PublicRow[];
}

export interface LiveView {
  state: "live";
  code: string;
  snapshot: Snapshot;
  me: number | null;
}

export interface DoneView {
  state: "done";
  code: string;
  families: { seat: number; name: string; bot: boolean }[];
  end: { kept: number[]; parts: number[]; grownFish: number; nextYear: number };
  rows: PublicRow[];
  me: number | null;
}

export type LakeView = PreStartView | LiveView | DoneView;

export function lakePage(v: LakeView): string {
  const title = `Lake ${v.code} · Next Year, No Fish`;
  if (v.state === "pre") {
    const nameOf = (seat: number | null): string => (seat === null ? "the village" : (v.families.find((f) => f.seat === seat)?.name ?? `seat ${seat}`));
    const joined = v.families.map((f) => `<li${f.seat === v.me ? ' class="me"' : ""}>${esc(f.name)}${f.seat === v.me ? " (you)" : ""}</li>`).join("");
    const errorLine = v.error ? `<p class="error" role="alert">${esc(v.error)}</p>` : "";
    const you =
      v.me === null
        ? `<form method="post" action="/l/${esc(v.code)}/join">
            <label for="name">Your family's name (1 to 24 characters)</label>
            <input id="name" name="name" required autocomplete="nickname" />
            <button type="submit">Join</button>
          </form>
          ${errorLine}`
        : `<form method="post" action="/l/${esc(v.code)}/start"><button type="submit">Start the season</button></form>`;
    return layout(
      title,
      `<main class="lake" data-lake="${esc(v.code)}">
        <h1>Lake ${esc(v.code)}</h1>
        <section><h2>Who has joined</h2><ul id="families">${joined || "<li>Nobody yet.</li>"}</ul></section>
        <section>${you}</section>
        <section><h2>What happened</h2>${rowsList(v.rows, nameOf)}</section>
      </main>`,
    );
  }

  if (v.state === "live") {
    const s = v.snapshot;
    const nameOf = (seat: number | null): string => (seat === null ? "the village" : (s.families.find((f) => f.seat === seat)?.name ?? `seat ${seat}`));
    const families = s.families
      .map(
        (f) =>
          `<li${f.seat === v.me ? ' class="me"' : ""}>${esc(f.name)}${f.bot ? " (bot)" : ""}${f.seat === v.me ? " (you)" : ""}
            · ${f.basket} in basket · ${HOUSE_PARTS[f.part].name}${f.hasFine ? " · owns a fine net" : ""}</li>`,
      )
      .join("");
    return layout(
      title,
      `<main class="lake" data-lake="${esc(v.code)}" data-last-id="${s.rows.at(-1)?.id ?? 0}">
        <h1>Lake ${esc(v.code)}</h1>
        <p id="phase">Year <span id="year">${s.year}</span>, <span id="season-phase">${s.phase}</span> · rule: <span id="rule">${s.rule}</span></p>
        <section><h2>Families</h2><ul id="families">${families}</ul></section>
        <section><h2>What happened</h2>${rowsList(s.rows, nameOf)}</section>
        <noscript><p>Refresh to see new rows.</p></noscript>
      </main>`,
    );
  }

  const nameOf = (seat: number | null): string => (seat === null ? "the village" : (v.families.find((f) => f.seat === seat)?.name ?? `seat ${seat}`));
  const debrief = v.families
    .map(
      (f, seat) =>
        `<li${seat === v.me ? ' class="me"' : ""}>${esc(f.name)}${f.bot ? " (bot)" : ""}: kept ${v.end.kept[seat]} fish, built ${HOUSE_PARTS[v.end.parts[seat]].name}</li>`,
    )
    .join("");
  return layout(
    title,
    `<main class="lake done" data-lake="${esc(v.code)}">
      <h1>Lake ${esc(v.code)}: the debrief</h1>
      <section>
        <h2>What happened to each house</h2>
        <ul>${debrief}</ul>
      </section>
      <section>
        <h2>What happened to the lake</h2>
        <p>${v.end.grownFish} grown fish are left. Left alone, next year it would hold ${v.end.nextYear === 0 ? "no fish" : `${v.end.nextYear} grown fish`}.</p>
      </section>
      <section><h2>What happened</h2>${rowsList(v.rows, nameOf)}</section>
    </main>`,
  );
}
