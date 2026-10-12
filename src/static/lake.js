// The lake page's script: shows what the server sends (rows, a snapshot) and
// never computes an outcome. No canvas yet.
"use strict";

for (const el of document.querySelectorAll("time[datetime]")) {
  el.textContent = new Date(el.getAttribute("datetime")).toLocaleString();
}

const main = document.querySelector("main[data-lake]");
if (main && main.dataset.lastId !== undefined) lakeLive(main);

function lakeLive(main) {
  const code = main.dataset.lake;
  const $ = (name) => document.getElementById(name);

  // The same words as the server's page (src/lake-pages.ts, rowWords).
  function words(row) {
    const who = row.seat === null ? "the village" : `seat ${row.seat}`;
    const d = row.data || {};
    switch (row.kind) {
      case "throw":
        return `${who} threw a ${d.fine ? "fine" : "coarse"} net${d.breach ? " (a breach)" : ""}`;
      case "haul":
        return d.got ? `${who}'s net took ${d.got} fish${d.koi ? " and the golden carp" : ""}` : `${who}'s net came up empty`;
      case "buy":
        return `${who} bought a fine net`;
      case "ask":
        return `${who} asked for a promise`;
      case "answer":
        return `${who} ${d.yes ? "accepted" : "declined"} a promise`;
      case "broken":
        return `${who} broke a promise`;
      case "seal":
        return `${who} stamped ${d.seal}`;
      case "vote":
        return `${who} voted ${d.rule}`;
      case "build":
        return d.parts && d.parts.length ? `${who} built ${d.parts.join(", ")}` : `${who} built nothing new`;
      case "rule":
        return `The village chose: ${d.rule}`;
      case "end":
        return "The season ended";
      default:
        return row.kind;
    }
  }

  function addRow(row) {
    const list = $("rows");
    if (!list || list.querySelector(`[data-id="${row.id}"]`)) return;
    const li = document.createElement("li");
    li.dataset.id = String(row.id);
    li.textContent = words(row);
    list.prepend(li);
  }

  const source = new EventSource(`/l/${code}/events?after=${main.dataset.lastId}`);
  source.addEventListener("reload", () => location.reload());
  source.addEventListener("row", (e) => {
    const row = JSON.parse(e.data);
    addRow(row);
    if (row.kind === "end") setTimeout(() => location.reload(), 1000);
  });
  source.addEventListener("snapshot", (e) => {
    const s = JSON.parse(e.data);
    const year = $("year");
    if (year) year.textContent = String(s.year);
    const phase = $("season-phase");
    if (phase) phase.textContent = s.phase;
    const rule = $("rule");
    if (rule) rule.textContent = s.rule;
  });
}
