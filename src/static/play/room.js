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
// every word comes from the dictionary the server embedded for this page's
// language (src/lib/i18n.ts); "@key" vars are themselves words
const words = boot.words;
const t = (key, vars = {}) => (words[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (String(vars[k]).startsWith("@") ? t(String(vars[k]).slice(1)) : String(vars[k])) : m));
// a seat's name: a bot's is its character's, worded here; a person's is theirs
const seatName = (s) => (!s ? null : s.bot ? t("bot_suffix", { name: t(`c_${s.character}`) }) : s.name);
const code = view.code;
const $ = (id) => document.getElementById(id);
const stage = $("stage"), overlay = $("overlay"), hud = $("hud"), coachEl = $("coach"), bannerEl = $("banner");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const crewOf = (id) => CREW.find((c) => c.id === id) ?? CREW[0];
const cardOf = (id) => cards.find((c) => c.id === id);
const ICON = { rush: ["👆", "🕸", "💨"], poach: ["👆", "👀", "🎈"], party: ["👆", "🛒", "🤫"], hold: ["🂠", "⬡", "🌊"] };

const world = createWorld($("gl"), stage);
const sound = createSound($("sound"), { on: t("g_sound_on"), off: t("g_sound_off") });
const send = (body) => fetch(`/play/${code}/in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true })
  .then((r) => { if (r.status === 429) banner(t("g_slow"), t("g_slow_s")); return r.json(); }).catch(() => ({ ok: false, reason: "offline" }));
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
// a mark that matters later (after the first 20 s) can open the coach again, briefly
const rearm = (ms = 8000) => { coachState.until = Math.max(coachState.until, performance.now() + ms); };
const ui = { hud, banner, setClock, coach, did, rearm, esc, crewOf, portrait, overlay, stage, goalEl, sound, t, seatName };

// ---- phones: the HUD folds to one line; a tap opens it ----
const toggle = $("hudtoggle");
toggle.addEventListener("click", () => { const open = !document.body.classList.contains("hud-open"); document.body.classList.toggle("hud-open", open); toggle.setAttribute("aria-expanded", String(open)); toggle.textContent = open ? t("g_close") : t("g_details"); });
// ---- stop match: only the room's first player, only during a match ----
const stopBtn = $("stopbtn");
stopBtn.addEventListener("click", async () => { if (confirm(t("g_stop_confirm"))) { const r = await post("stop", {}); if (!r.ok) banner(t("g_stop_fail"), r.reason); } });
const isFirst = () => view.me !== null && view.players[0]?.seat === view.me;

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
function whoHtml(players) { return `<div class="who">${players.map((p) => `<span class="p">${portrait(p.character, p.name)}${esc(p.name)}</span>`).join("") || `<small>${t("g_nobody")}</small>`}</div>`; }
function lakeHtml() {
  const l = view.lake;
  return `<div class="lakebar ${l.died ? "dead" : ""}"><span>${l.died ? t("g_lake_died") : t("g_lake_remembers")}</span><div class="bar"><i style="width:${Math.min(100, l.fish / 2.2)}%"></i></div><b>${t("room_fish_n", { n: l.fish })}</b></div>`;
}
function switchHtml() {
  return `<div><h4 class="section-h">${t("g_change")}</h4><div class="switch">${cards.map((c) => `<button type="button" data-mode="${c.id}" aria-pressed="${c.id === view.mode}">${esc(t(`${c.id}_name`))} ${view.ready.includes(c.id) ? "" : `<small>${t("coming_short", { date: esc(c.due) })}</small>`}</button>`).join("")}</div></div>`;
}
function startHtml(again) {
  const c = cardOf(view.mode), ready = view.ready.includes(view.mode);
  const n = view.players.length;
  const botsDefault = n < 2;
  const can = view.me !== null;
  return `<div class="row-btns">${can ? (ready
      ? `<button class="btn primary" id="startbtn" type="button">${again ? t("g_rematch") : t("start")}</button><label class="check"><input type="checkbox" id="bots" ${botsDefault ? "checked" : ""}/> ${t("g_bots")}</label>`
      : `<span class="status soon">${esc(t("g_coming", { game: t(`${c.id}_name`), date: c.due }))}</span>`)
    : `<span class="note">${t("join_to_play")}</span>`}</div>`;
}
function cardHtml() {
  const c = cardOf(view.mode);
  return `<section class="sheet" id="c1">
    <h2>${esc(t(`${c.id}_name`))}<span lang="${boot.lang === "zh" ? "en" : "zh"}">${esc(boot.other[`${c.id}_name`])}</span></h2>
    <p class="goal"><b>${t("goal")}</b>${esc(t(`${c.id}_goal`))}</p>
    <div class="icons3">${[1, 2, 3].map((n, i) => `<div><span class="ic" aria-hidden="true">${ICON[c.id][i]}</span><b>${esc(t(`${c.id}_a${n}`))}</b><small>${esc(t(`${c.id}_a${n}s`))}</small></div>`).join("")}</div>
    <p class="choice"><b>${t("the_choice")}</b> ${esc(t(`${c.id}_choice`))}</p>
    ${c.id === "rush" ? `<p class="small">${esc(t("rush_extra"))}</p>` : ""}
    ${whoHtml(view.players)}
    ${lakeHtml()}
    ${view.note ? `<p class="toast">${esc(t(`g_note_${view.note}`))}</p>` : ""}
    ${startHtml(false)}
    <p class="toast" id="starterr" role="alert"></p>
    ${switchHtml()}
  </section>`;
}
function resultsHtml() {
  const r = view.results;
  const seats = [...r.seats].sort((a, b) => a.place - b.place || b.score - a.score);
  const mine = seats.find((s) => s.seat === view.mySeat);
  const unit = r.mode === "poach" ? "" : t(`g_unit_${r.mode}`);
  const place = (n) => (n <= 3 ? t(`g_place${n}`) : t("g_placeN", { n }));
  const title = r.mode === "poach" ? (r.extra?.winner === "fishers" ? t("g_fishers_win") : t("g_poacher_wins")) : mine ? (mine.place === 1 ? t("g_you_win") : t("g_you_came", { place: place(mine.place) })) : t("g_results");
  const nameOfSeat = (s) => seatName({ ...s, bot: s.bot ? "bot" : null }) ?? s.name;
  // a highlight sent as a code is worded here; one stored before v4.0 has only its English
  const hl = (h) => h.key ? [t(h.tkey), t(h.key, { ...h.vars, name: nameOfSeat(seats.find((s) => s.seat === h.seat) ?? { name: "" }) })] : [h.title, h.text];
  return `<section class="sheet" id="results">
    <h2>${esc(title)}</h2>
    ${r.mode === "poach" && r.extra?.roles ? `<p class="roles">${seats.map((s) => `<span>${esc(nameOfSeat(s))}: <b>${esc(t(`g_role_${r.extra.roles[s.seat]}`))}</b>${s.detail?.quota !== undefined ? ` · ${t("g_for_quota", { n: s.detail.quota })}` : ""}</span>`).join("")}</p>` : ""}
    <div class="podium">${seats.map((s) => `<div class="pl ${s.place === 1 ? "first" : ""}">${portrait(s.character, s.name)}<span class="place">${place(s.place)}</span><b>${esc(nameOfSeat(s))}${s.seat === view.mySeat ? t("g_you_tag") : ""}</b>${unit || r.mode !== "poach" ? `<span class="sc">${s.score}</span> <small>${unit}</small>` : `<small>${s.score ? t("g_won") : t("g_lost")}</small>`}</div>`).join("")}</div>
    <div class="highs">${r.highlights.map((h) => { const [a, b] = hl(h); return `<div><b>${esc(a)}</b>${esc(b)}</div>`; }).join("")}</div>
    <div class="lakebar"><span>${t("g_lake_line", { before: r.lakeBefore, after: r.lakeAfter })}</span></div>
    ${lakeHtml()}
    ${startHtml(true)}
    <p class="toast" id="starterr" role="alert"></p>
    ${switchHtml()}
  </section>`;
}
function bindOverlay() {
  $("startbtn")?.addEventListener("click", async () => {
    const r = await post("start", { bots: $("bots")?.checked === true });
    if (!r.ok) $("starterr").textContent = { need_players: t("g_need_players"), coming_soon: t("g_coming_soon"), busy: t("g_busy"), playing: t("g_playing") }[r.reason] ?? r.reason;
  });
  overlay.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", async () => {
    const r = await post("mode", { mode: b.dataset.mode });
    if (!r.ok && $("starterr")) $("starterr").textContent = r.reason === "not_in_room" ? t("g_join_change") : r.reason;
  }));
}

// ---- the stream ----
let countdownT = 0;
function showRoom() {
  goalEl.textContent = t(`${view.mode}_hud`);
  stopBtn.hidden = !(view.state === "play" && isFirst());
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
  es.onopen = () => { conn.textContent = t("g_live"); conn.classList.add("live"); };
  es.onerror = () => { conn.textContent = t("g_reconnecting"); conn.classList.remove("live"); };
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
