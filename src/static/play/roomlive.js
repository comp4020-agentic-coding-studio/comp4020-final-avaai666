// The room page's live parts (src/site-pages.ts): who is here, the picked
// game, this room's lake and what happened here, kept current from the room's
// stream. When a match starts, every seat's browser goes to the full-screen
// game page. This page has no game on it: no canvas, no pads, no HUD. It
// decides nothing; every word comes from the dictionary the page embeds.
import { portrait } from "./art.js";

const boot = JSON.parse(document.getElementById("boot").textContent);
let view = boot.view;
const code = view.code;
const words = boot.words;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const t = (key, vars = {}) => (words[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (String(vars[k]).startsWith("@") ? t(String(vars[k]).slice(1)) : String(vars[k])) : m));
const post = (path, body) => fetch(`/play/${code}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, reason: "offline" }));

const A_ICON = { rush: ["👆", "🕸", "💨"], poach: ["👆", "👀", "🎈"], party: ["👆", "🛒", "🤫"], hold: ["🂠", "⬡", "🌊"] };
const LAKE_FULL = 220;
const whenFmt = new Intl.DateTimeFormat(boot.lang === "zh" ? "zh-CN" : "en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Sydney" });
function logLine(m) {
  const game = t(`${m.mode}_name`);
  const what = m.winner.kind === "seat" ? t("log_won", { game, name: m.winner.bot ? t("bot_suffix", { name: t(`c_${m.winner.character}`) }) : m.winner.name }) : m.winner.kind === "fishers" ? t("log_fishers", { game }) : m.winner.kind === "poacher" ? t("log_poacher", { game }) : t("log_nobody", { game });
  return `<li><time datetime="${new Date(m.endedAt).toISOString()}">${esc(whenFmt.format(m.endedAt))}</time><span>${esc(what)}</span><span class="fish">${m.lakeBefore} → ${m.lakeAfter}</span></li>`;
}
function draw() {
  const people = $("people");
  if (people) people.innerHTML = view.players.map((p) => `<div class="person on"><div class="f">${portrait(p.character, p.name)}</div><span class="dot"></span>${esc(p.name)}</div>`).join("") + `<div class="person empty"><div class="f">+</div>${esc(t("waiting"))}</div>`;
  const fish = $("lakefish"); if (fish) fish.innerHTML = `${view.lake.fish} <small>${esc(t("room_lake_of", { n: LAKE_FULL }))}</small>`;
  const bar = $("lakebar"); if (bar) bar.style.width = `${Math.min(100, (view.lake.fish / LAKE_FULL) * 100).toFixed(1)}%`;
  const log = $("log"); if (log) log.innerHTML = view.history.length ? view.history.map(logLine).join("") : `<li class="none">${esc(t("log_none"))}</li>`;
  document.querySelectorAll("#pick [data-pick]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === view.mode)));
  const c1 = $("c1");
  if (c1) { const id = view.mode, k = (s) => esc(t(`${id}_${s}`)); c1.innerHTML = `<p class="goalline"><b>${esc(t("goal"))}</b> ${k("goal")}</p>
    <div class="icons3">${[1, 2, 3].map((n, i) => `<div><span aria-hidden="true">${A_ICON[id][i]}</span><b>${k(`a${n}`)}</b><small>${k(`a${n}s`)}</small></div>`).join("")}</div>
    <p class="choice"><b>${esc(t("the_choice"))}</b> ${k("choice")}</p>${id === "rush" ? `<p class="small muted">${esc(t("rush_extra"))}</p>` : ""}`; }
  const pn = $("pickname"); if (pn) pn.textContent = t(`${view.mode}_name`);
  const pr = $("pickrules"); if (pr) pr.setAttribute("href", `/how/${view.mode}`);
  const note = $("roomnote"); if (note) note.textContent = view.note ? t(`g_note_${view.note}`) : "";
  const joined = view.me !== null;
  const go = $("startbtn"); if (go) go.hidden = !joined;
  const jf = document.querySelector(".joinform"); if (jf) jf.hidden = joined;
}
// a match is running: everyone in the room goes to the full-screen game
let leaving = false;
function maybeGo() {
  if (leaving || view.state !== "play") return;
  leaving = true;
  location.href = `/play/${code}/game`;
}

$("pick")?.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-pick]"); if (!b) return;
  const r = await post("mode", { mode: b.dataset.pick });
  const err = $("starterr"); if (err) err.textContent = r.ok ? "" : r.reason === "not_in_room" ? t("g_join_change") : r.reason;
});
$("startbtn")?.addEventListener("click", async () => {
  const r = await post("start", { bots: $("bots")?.checked === true });
  const err = $("starterr");
  if (!r.ok && err) err.textContent = { need_players: t("g_need_players"), coming_soon: t("g_coming_soon"), busy: t("g_busy"), playing: t("g_playing"), not_in_room: t("join_to_play") }[r.reason] ?? r.reason;
});

function connect() {
  const es = new EventSource(`/play/${code}/events`);
  es.addEventListener("room", (e) => { view = JSON.parse(e.data); draw(); maybeGo(); });
}
draw(); maybeGo(); connect();
