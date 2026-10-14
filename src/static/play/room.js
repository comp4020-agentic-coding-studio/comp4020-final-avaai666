// A /play room: joining, the card before the start (C1), the 3-2-1, the
// stream, the results (C5), rematch and the mode switch. The match itself is
// drawn by the mode's own script (rush.js, poach.js, party.js, hold.js),
// which gets each frame the server built for this seat. Nothing here decides
// an outcome.
import { createSound, createWorld } from "./world.js";
import { CREW, portrait } from "./art.js";

const boot = JSON.parse(document.getElementById("boot").textContent);
const cards = boot.cards;
let view = boot.view;
const code = view.code;
const $ = (id) => document.getElementById(id);
const stage = $("stage"), overlay = $("overlay"), hud = $("hud"), coachEl = $("coach"), bannerEl = $("banner");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const crewOf = (id) => CREW.find((c) => c.id === id) ?? CREW[0];
const cardOf = (id) => cards.find((c) => c.id === id);
const ICON = { "Tap the water": "👆", "Tap": "👆", "Tap a hex": "⬡", "Pick a card": "🂠", "Tide": "🌊", "SHOP": "🛒", "PICK": "🤫", "DASH": "💨", "BUOY": "🎈", "Stay beside a boat": "👀" };
const iconFor = (label) => ICON[label] ?? (label.startsWith("CAST") ? "🕸" : "•");

const world = createWorld($("gl"), stage);
const sound = createSound($("sound"));
const send = (body) => fetch(`/play/${code}/in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true })
  .then((r) => { if (r.status === 429) banner("Slow down", "too many inputs a second"); return r.json(); }).catch(() => ({ ok: false, reason: "offline" }));
const post = (path, body) => fetch(`/play/${code}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, reason: "offline" }));

// ---- shared HUD pieces (C3, C4) ----
const clockEl = $("clock"), goalEl = $("goal");
export function setClock(seconds, label) {
  const s = Math.max(0, Math.ceil(seconds));
  clockEl.textContent = `${label ? label + " · " : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  clockEl.classList.toggle("hot", s <= 10);
}
let bannerT = 0;
function banner(title, small = "", ms = 1800) {
  bannerEl.innerHTML = `${esc(title)}${small ? `<small>${esc(small)}</small>` : ""}`; bannerEl.hidden = false;
  clearTimeout(bannerT); bannerT = setTimeout(() => { bannerEl.hidden = true; }, ms);
}
// C2: coach marks for the first 20 s, each until the player has done it
const coachState = { done: new Set(), until: 0 };
function coach(list) {
  const t = performance.now();
  if (t > coachState.until) { coachEl.hidden = true; return; }
  const next = list.find(([id, , when]) => !coachState.done.has(id) && (when === undefined || when()));
  coachEl.hidden = !next; if (next) coachEl.textContent = next[1];
}
const did = (id) => coachState.done.add(id);
const ui = { hud, banner, setClock, coach, did, esc, crewOf, portrait, overlay, stage, goalEl, sound };

// ---- the mode script ----
let mode = null, modeId = null, modeApi = null;
async function loadMode(id) {
  if (modeId === id && modeApi) return modeApi;
  modeApi?.end?.();
  world.clearBoats(); world.clearProps(); world.setFish([], 0); world.setKoi(null, 0); world.setNight(0); world.setLanterns([]);
  hud.innerHTML = "";
  mode = await import(`/static/play/${id}.js`);
  modeId = id;
  modeApi = mode.mount({ world, sound, ui, send, view: () => view });
  return modeApi;
}

// ---- overlays ----
function whoHtml(players) { return `<div class="who">${players.map((p) => `<span class="p">${portrait(p.character, p.name)}${esc(p.name)}</span>`).join("") || "<small>Nobody yet</small>"}</div>`; }
function lakeHtml() {
  const l = view.lake;
  return `<div class="lakebar ${l.died ? "dead" : ""}"><span>${l.died ? "This lake died. The next match starts a new lake." : "This room's lake remembers:"}</span><div class="bar"><i style="width:${Math.min(100, l.fish / 2.2)}%"></i></div><b>${l.fish} fish</b></div>`;
}
function switchHtml() {
  return `<div><h4 class="section-h">Change game</h4><div class="switch">${cards.map((c) => `<button type="button" data-mode="${c.id}" aria-pressed="${c.id === view.mode}">${esc(c.name)} ${view.ready.includes(c.id) ? "" : `<small>coming ${esc(c.due)}</small>`}</button>`).join("")}</div></div>`;
}
function startHtml(again) {
  const c = cardOf(view.mode), ready = view.ready.includes(view.mode);
  const n = view.players.length;
  const botsDefault = n < 2;
  const can = view.me !== null;
  return `<div class="row-btns">${can ? (ready
      ? `<button class="btn primary" id="startbtn" type="button">${again ? "Rematch" : "Start"}</button><label class="check"><input type="checkbox" id="bots" ${botsDefault ? "checked" : ""}/> bots fill empty seats</label>`
      : `<span class="status soon">${esc(c.name)} is coming: ${esc(c.due)}. Pick a game that is ready.</span>`)
    : `<span class="note">Join to play.</span>`}</div>`;
}
function cardHtml() {
  const c = cardOf(view.mode);
  return `<section class="sheet" id="c1">
    <h2>${esc(c.name)}<span lang="zh">${c.zh}</span></h2>
    <p class="goal"><b>How you win</b>${esc(c.goal)}</p>
    <div class="icons3">${c.actions.map(([a, b]) => `<div><span class="ic" aria-hidden="true">${iconFor(a)}</span><b>${esc(a)}</b><small>${esc(b)}</small></div>`).join("")}</div>
    <p class="choice"><b>The choice that matters:</b> ${esc(c.choice)}</p>
    ${whoHtml(view.players)}
    ${lakeHtml()}
    ${view.note ? `<p class="toast">${esc(view.note)}</p>` : ""}
    ${startHtml(false)}
    <p class="toast" id="starterr" role="alert"></p>
    ${switchHtml()}
  </section>`;
}
function resultsHtml() {
  const r = view.results;
  const seats = [...r.seats].sort((a, b) => a.place - b.place || b.score - a.score);
  const mine = seats.find((s) => s.seat === view.mySeat);
  const unit = r.mode === "party" ? "coins" : r.mode === "hold" ? "points" : r.mode === "poach" ? "" : "fish";
  const title = r.mode === "poach" ? (r.extra?.winner === "fishers" ? "The fishers win" : "The poacher wins") : mine ? (mine.place === 1 ? "You win!" : `You came ${["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][mine.place]}`) : "Results";
  return `<section class="sheet" id="results">
    <h2>${esc(title)}</h2>
    ${r.mode === "poach" && r.extra?.roles ? `<p class="goal">${seats.map((s) => `${esc(s.name)}: <b>${esc(r.extra.roles[s.seat])}</b>`).join(" · ")}</p>` : ""}
    <div class="podium">${seats.map((s) => `<div class="pl ${s.place === 1 ? "first" : ""}">${portrait(s.character, s.name)}<span class="place">${s.place === 1 ? "1st" : s.place === 2 ? "2nd" : s.place === 3 ? "3rd" : s.place + "th"}</span><b>${esc(s.name)}${s.seat === view.mySeat ? " (you)" : ""}</b>${unit || r.mode !== "poach" ? `<span class="sc">${s.score}</span> <small>${unit}</small>` : `<small>${s.score ? "won" : "lost"}</small>`}</div>`).join("")}</div>
    <div class="highs">${r.highlights.map((h) => `<div><b>${esc(h.title)}</b>${esc(h.text)}</div>`).join("")}</div>
    <div class="lakebar"><span>The lake: ${r.lakeBefore} fish before, ${r.lakeAfter} left.</span></div>
    ${lakeHtml()}
    ${startHtml(true)}
    <p class="toast" id="starterr" role="alert"></p>
    ${switchHtml()}
  </section>`;
}
function bindOverlay() {
  $("startbtn")?.addEventListener("click", async () => {
    const r = await post("start", { bots: $("bots")?.checked === true });
    if (!r.ok) $("starterr").textContent = { need_players: "This game needs more players: tick \"bots fill empty seats\", or wait for friends.", coming_soon: "This game is not ready yet.", busy: "The server is full right now. Try again in a minute.", playing: "A match is already running." }[r.reason] ?? r.reason;
  });
  overlay.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", async () => {
    const r = await post("mode", { mode: b.dataset.mode });
    if (!r.ok && $("starterr")) $("starterr").textContent = r.reason === "not_in_room" ? "Join to change the game." : r.reason;
  }));
}

// ---- the stream ----
let countdownT = 0;
function showRoom() {
  goalEl.textContent = cardOf(view.mode).hud;
  if (view.me === null && document.querySelector(".joinform")) { overlay.innerHTML = ""; return; }
  if (view.state === "lobby") { overlay.innerHTML = cardHtml(); bindOverlay(); setClock(0); clockEl.textContent = ""; }
  if (view.state === "end" && view.results) { overlay.innerHTML = resultsHtml(); bindOverlay(); }
  if (view.state === "play") { /* the countdown or the match */ }
}
function countdown(startedAt, serverNow) {
  const skew = Date.now() - serverNow;
  clearInterval(countdownT);
  const draw = () => {
    const left = startedAt + skew - Date.now();
    if (left <= 0) { clearInterval(countdownT); overlay.innerHTML = ""; coachState.until = performance.now() + 20000; coachState.done.clear(); sound.big(); return; }
    overlay.innerHTML = `<div class="count" aria-live="assertive">${Math.ceil(left / 1000)}</div>`; sound.tick();
  };
  draw(); countdownT = setInterval(draw, 250);
}

const conn = $("conn");
function connect() {
  const es = new EventSource(`/play/${code}/events`);
  es.onopen = () => { conn.textContent = "live"; conn.classList.add("live"); };
  es.onerror = () => { conn.textContent = "reconnecting…"; conn.classList.remove("live"); };
  es.addEventListener("room", async (e) => {
    const was = view.mode;
    view = JSON.parse(e.data);
    if (was !== view.mode || !modeApi) await loadMode(view.mode);
    modeApi.room?.(view);
    showRoom();
  });
  es.addEventListener("go", async (e) => {
    const g = JSON.parse(e.data);
    await loadMode(view.mode);
    modeApi.start?.(g.frame, view);
    countdown(g.startedAt, g.serverNow);
  });
  es.addEventListener("frame", (e) => {
    const d = JSON.parse(e.data);
    if (!modeApi) return;
    modeApi.frame(d.f, d.ev, view);
  });
}
await loadMode(view.mode);
showRoom();
connect();
window.__play = { view: () => view, mode: () => modeApi, send };
