// The pond page's script. It shows what the server sends (rows and snapshots)
// and sends casts. It never computes stock or an outcome.
"use strict";

for (const el of document.querySelectorAll("time[datetime]")) {
  el.textContent = new Date(el.getAttribute("datetime")).toLocaleString();
}

const main = document.querySelector("main[data-pond]");
if (main) pond(main);

function pond(main) {
  const id = main.dataset.pond;
  const me = main.dataset.me || null;
  const cooldownMs = Number(main.dataset.cooldown);
  let dead = main.dataset.dead === "true";
  const $ = (name) => document.getElementById(name);
  const cast = $("cast");
  const status = $("status");
  const picture = $("picture");
  const castLabel = cast ? cast.textContent : "";

  const say = (text) => {
    if (status) status.textContent = text;
  };

  function setAvailable(n) {
    $("available").textContent = String(n);
    const marks = Math.min(n, Number(picture.dataset.max));
    while (picture.childElementCount > marks) picture.lastElementChild.remove();
    while (picture.childElementCount < marks) picture.append(document.createElement("i"));
  }

  // The same words as the server's page (src/pages.ts, rowWords).
  function words(row) {
    const who = row.name ?? "Someone";
    switch (row.kind) {
      case "dig":
        return `The pond was dug · ${row.available} fish`;
      case "join":
        return `${who} joined · ${row.available} fish`;
      case "catch":
        return `${who} caught a fish · ${row.available} left`;
      case "collapse":
        return "The pond died";
    }
    return "";
  }

  function addRow(row) {
    const list = $("events");
    if (list.querySelector(`[data-id="${row.id}"]`)) return;
    const li = document.createElement("li");
    li.dataset.id = String(row.id);
    li.textContent = words(row);
    list.prepend(li);
    while (list.childElementCount > 30) list.lastElementChild.remove();
  }

  function renderNets(nets) {
    const list = $("nets");
    list.replaceChildren(
      ...nets.map((n) => {
        const li = document.createElement("li");
        if (n.name === me) li.className = "me";
        li.textContent = `${n.name}${n.name === me ? " (you)" : ""} · ${n.catches} caught · ${n.present ? "here" : "away"}`;
        return li;
      }),
    );
    if (nets.length === 0) list.innerHTML = "<li>No nets yet.</li>";
  }

  // The server renders a dead pond's record, so a pond that dies while this
  // page is open reloads to show it.
  function died() {
    if (dead) return;
    dead = true;
    if (cast) cast.disabled = true;
    say("The pond died.");
    setTimeout(() => location.reload(), 1500);
  }

  const source = new EventSource(`/p/${id}/events?after=${main.dataset.lastId}`);
  source.addEventListener("open", () => ($("live").textContent = "live"));
  source.addEventListener("error", () => ($("live").textContent = "reconnecting…"));
  source.addEventListener("reload", () => location.reload());
  source.addEventListener("row", (e) => {
    const row = JSON.parse(e.data);
    addRow(row);
    setAvailable(row.available);
    if (row.kind === "collapse") died();
  });
  source.addEventListener("snapshot", (e) => {
    const s = JSON.parse(e.data);
    setAvailable(s.available);
    $("regrowth").textContent = `${s.regrowthPerMin >= 0 ? "+" : ""}${s.regrowthPerMin}`;
    $("viewers").textContent = String(s.viewers);
    renderNets(s.nets);
    if (s.dead) died();
  });

  if (!cast) return;

  let busy = false;
  let readyAt = 0;
  let countdown = null;

  function coolDown(ms) {
    readyAt = Date.now() + ms;
    cast.disabled = true;
    clearInterval(countdown);
    const show = () => {
      const left = readyAt - Date.now();
      if (left <= 0 || dead) {
        clearInterval(countdown);
        cast.textContent = castLabel;
        cast.disabled = dead;
        return;
      }
      cast.textContent = `Wait ${(left / 1000).toFixed(1)} s`;
    };
    show();
    countdown = setInterval(show, 100);
  }

  const send = (key) =>
    fetch(`/p/${id}/catch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });

  async function doCast() {
    if (busy || dead || Date.now() < readyAt) return;
    busy = true;
    cast.disabled = true;
    const key = crypto.randomUUID();
    let res;
    try {
      res = await send(key);
    } catch {
      try {
        res = await send(key); // once more, with the same key: it can never catch twice
      } catch {
        busy = false;
        cast.disabled = false;
        say("Network error: the cast did not reach the server. Try again.");
        return;
      }
    }
    busy = false;
    const body = await res.json().catch(() => ({}));
    if (res.status === 200) {
      say("You caught a fish.");
      coolDown(cooldownMs);
    } else if (res.status === 429) {
      say(`Too soon: you can cast again in ${(body.retryInMs / 1000).toFixed(1)} s.`);
      coolDown(body.retryInMs);
    } else if (res.status === 410) {
      say("The pond is dead. There is nothing to catch.");
      died();
    } else if (res.status === 403) {
      cast.disabled = false;
      say("You have no net in this pond. Reload the page and join with a name.");
    } else {
      cast.disabled = false;
      say(`Something went wrong (HTTP ${res.status}). Try again.`);
    }
  }

  cast.addEventListener("click", doCast);
  // Space casts when the focus is not on something Space already works on.
  document.addEventListener("keydown", (e) => {
    if (e.key !== " " || e.repeat) return;
    if (e.target.closest("button, input, textarea, select, a, summary")) return;
    e.preventDefault();
    doCast();
  });
}
