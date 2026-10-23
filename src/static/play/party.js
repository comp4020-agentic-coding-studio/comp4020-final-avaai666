// Fishing Party on /play (party 2.0, DESIGN.md "Fishing Party 钓鱼派对 (2.0)"):
// five little games on the v5 lake (world5.js). Every round: an intro card
// (try it first, or say you're ready), 3-2-1, 28 s, the standings, and after
// rounds 1-3 the shop; round 5 is the Last Net, picked in secret and
// revealed one by one. Draws what the server sent; sends only ready, tap,
// steer, reel, net, lantern, buy, done and a pick. It decides nothing.
import { ceremonySteps } from "./ceremony.js";

const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
// a small picture for each round's intro card (SVG written here, no image model)
const ART = {
  scramble: `<rect width="320" height="170" rx="14" fill="#1d6b72"/>${[[80, 70, 18], [230, 110, 22], [150, 130, 26]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#e8b84d" stroke-width="4"/>${[0, 1, 2, 3].map((k) => `<ellipse cx="${x - 8 + k * 6}" cy="${y - 4 + (k % 2) * 6}" rx="6" ry="2.6" fill="#ff9a4a"/>`).join("")}`).join("")}<path d="M228 100 l14 22 l-8 2 l6 14 l-5 2 l-6 -14 l-7 5z" fill="#fff" stroke="#120e18" stroke-width="2"/>`,
  koi: `<rect width="320" height="170" rx="14" fill="#1d6b72"/>${[60, 130, 200, 270].map((x, i) => `<circle cx="${x}" cy="${55 + (i % 2) * 60}" r="11" fill="#ffd68a"/><circle cx="${x}" cy="${55 + (i % 2) * 60}" r="22" fill="#ffd68a" opacity=".2"/>`).join("")}<ellipse cx="236" cy="96" rx="22" ry="9" fill="#ffd34d"/><path d="M110 120 l40 -12 l-6 18 z" fill="#d6473a"/>`,
  tug: `<rect width="320" height="170" rx="14" fill="#1d6b72"/><rect x="30" y="120" width="260" height="24" rx="10" fill="#120e18"/><rect x="150" y="120" width="60" height="24" fill="#7ccf8e"/><rect x="176" y="114" width="6" height="36" fill="#fff"/><ellipse cx="160" cy="62" rx="40" ry="14" fill="#ffb04a"/><path d="M40 18 Q120 50 150 58" stroke="#f5ead6" stroke-width="2" fill="none"/>`,
  night: `<rect width="320" height="170" rx="14" fill="#0d1226"/><circle cx="140" cy="95" r="58" fill="#ffd68a" opacity=".16"/>${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${125 + k * 9}" cy="${90 + (k % 2) * 8}" rx="6" ry="2.6" fill="#ff9a4a"/>`).join("")}<circle cx="250" cy="52" r="10" fill="#ffd68a"/><circle cx="250" cy="52" r="26" fill="#ffd68a" opacity=".2"/>`,
  last: `<rect width="320" height="170" rx="14" fill="#1d6b72"/>${Array.from({ length: 12 }, (_, k) => `<ellipse cx="${120 + (k % 6) * 16}" cy="${50 + Math.floor(k / 6) * 14}" rx="7" ry="3" fill="#ff9a4a"/>`).join("")}${[["3", 70], ["6", 160], ["10", 250]].map(([n, x]) => `<rect x="${x - 32}" y="100" width="64" height="48" rx="10" fill="#241d2e" stroke="#e8b84d" stroke-width="3"/><text x="${x}" y="134" text-anchor="middle" font-size="24" font-weight="800" fill="#f5ead6">${n}</text>`).join("")}`,
};

export function mount({ world, sound, ui, send, view, post }) {
  const t = ui.t, esc = ui.esc;
  const bootEl = document.getElementById("boot");
  const boot = bootEl ? JSON.parse(bootEl.textContent) : { lang: "en", world: {} };
  const W = { tiers: [[0.6, "rich", 1.2], [0.35, "fair", 1], [0.15, "lean", 0.8], [0, "none", 0.5]], k: 340, ...(boot.world ?? {}) };
  let koiH = 0, prev = null, cur = null, curAt = 0, seats = null, lastKey = "", lastPhase = "", trying = false, revealT = [];
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const charOf = (seat) => seats?.[seat]?.character ?? "mei";
  const nameOf = (seat) => (seat === me() ? t("g_you") : ui.seatName(seats?.[seat]) ?? t("g_player_n", { n: seat + 1 }));
  const $ = (id) => document.getElementById(id);
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  // a choice is sent once per screen: a second tap before the next frame would only be refused (409)
  let sentOnce = new Set();
  const sendOnce = (key, msg) => { if (sentOnce.has(key)) return false; sentOnce.add(key); send(msg); return true; };
  const face = (seat, cls = "") => `<span class="po-face ${cls}">${ui.portrait(charOf(seat), nameOf(seat))}</span>`;

  world.setCameraMode("overview");
  world.setSeason(1, true);

  // ---- input ----
  const live = () => cur && (cur.phase === "intro" || cur.phase === "play") && me() !== null;
  world.setTap((x, y) => {
    if (!live()) return;
    if (cur.game === "scramble") { send({ k: "tap", x, y }); ui.did("tap"); }
    if (cur.game === "koi" || cur.game === "night") { send({ k: "steer", x, y }); ui.did("sail"); }
  });
  const wasdId = setInterval(() => {
    if (!live() || (cur.game !== "koi" && cur.game !== "night")) return;
    const dir = world.wantDir(); if (!dir) return;
    const b = cur.b?.find((x) => x[0] === me()); if (!b) return;
    send({ k: "steer", x: Math.round((b[1] / 10 + dir.x * 12) * 10) / 10, y: Math.round((b[2] / 10 + dir.z * 12) * 10) / 10 }); ui.did("sail");
  }, 150);
  const act = (k) => { if (live()) { send({ k }); ui.did(k); } };
  const onKey = (e) => {
    if (e.target.closest?.("input,textarea") || e.repeat || !cur) return;
    if (e.code === "Space") { e.preventDefault(); if (cur.game === "tug") act("reel"); if (cur.game === "night") act("net"); }
    if (e.code === "KeyL" && cur.game === "night") act("lantern");
  };
  addEventListener("keydown", onKey);

  // ---- the HUD for the round being played ----
  function hud() {
    const g = cur.game;
    ui.hud.innerHTML = `<div class="card mine"><div class="row"><div><h4>${esc(t(`y2_g_${g}`))}</h4><div class="big" id="y2-clock">0:28</div></div><div style="text-align:right"><h4>${esc(t("y2_lake"))}</h4><div class="big" id="y2-lake">0</div></div></div><div class="h2-bar"><i class="now" id="y2-now"></i>${W.tiers.slice(0, 3).map(([m]) => `<i class="mark" style="left:${m * 100}%"></i>`).join("")}</div></div>
      <div class="card hide-sm"><h4>${esc(t("y2_coins"))}</h4><div class="board" id="y2-board"></div></div>
      ${g === "tug" ? `<div class="pads dock"><button class="pad" type="button" id="y2-reel">${esc(t("y2_reel"))}</button></div>` : ""}
      ${g === "night" ? `<div class="pads dock"><button class="pad gold" type="button" id="y2-lan">${esc(t("y2_lantern"))}<i class="cd"></i></button><button class="pad" type="button" id="y2-net">${esc(t("y2_net"))}<i class="cd"></i></button></div>` : ""}`;
    $("y2-reel")?.addEventListener("pointerdown", (e) => { e.preventDefault(); act("reel"); });
    $("y2-net")?.addEventListener("click", () => act("net"));
    $("y2-lan")?.addEventListener("click", () => act("lantern"));
    tugEl.hidden = g !== "tug";
    if (g === "tug") tugEl.innerHTML = `<div class="y2-meter"><span class="zone"></span><span class="needle"></span></div><div class="y2-lanes">${(seats ?? []).map((_, i) => `<div class="y2-lane"><span class="sw" style="background:${colorOf(i)}"></span><div class="bar"><i data-l="${i}" style="background:${colorOf(i)}"></i></div><span>${esc(nameOf(i))}</span></div>`).join("")}</div>`;
  }
  const tugEl = document.createElement("div"); tugEl.className = "y2-tug"; tugEl.hidden = true; ui.stage.appendChild(tugEl);
  // Lantern Night's dark: lit round your boat and round every dropped lantern (pointer-events: none, P6)
  const fog = document.createElement("div"); fog.className = "y2-fog"; fog.hidden = true; ui.stage.appendChild(fog);
  const pv = new world.THREE.Vector3();
  const toScreen = (x, y) => { const [wx, wz] = world.toWorld(x, y); pv.set(wx, 0, wz).project(world.camera); return [(pv.x * 0.5 + 0.5) * ui.stage.clientWidth, (-pv.y * 0.5 + 0.5) * ui.stage.clientHeight]; };
  const holeAt = (x, y, r) => { const [sx, sy] = toScreen(x, y), [qx] = toScreen(x + r, y), R = Math.max(30, Math.abs(qx - sx)); return `radial-gradient(circle ${R.toFixed(0)}px at ${sx.toFixed(0)}px ${sy.toFixed(0)}px, transparent 0, transparent 70%, #000 100%)`; };
  function updateHud(f) {
    const clock = $("y2-clock"); if (clock) clock.textContent = `0:${String(f.left).padStart(2, "0")}`;
    const lk = $("y2-lake"); if (lk) lk.textContent = f.lake;
    const nw = $("y2-now"); if (nw) nw.style.width = `${Math.min(100, (f.lake / W.k) * 100)}%`;
    const bd = $("y2-board"); if (bd) bd.innerHTML = f.coins.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]).map(([c, i]) => `<div><span><span class="swatch" style="background:${colorOf(i)}"></span>${esc(nameOf(i))}</span><b>${c}${f.roundCoins[i] ? ` <small class="y2-plus">+${f.roundCoins[i]}</small>` : ""}</b></div>`).join("");
    if (f.me) { const nc = document.querySelector("#y2-net .cd"); if (nc) nc.style.setProperty("--p", `${(f.me.castCd / 1.6) * 100}%`); const lc = document.querySelector("#y2-lan .cd"); if (lc) lc.style.setProperty("--p", `${(f.me.lanT / 8) * 100}%`); }
    if (f.tug && !tugEl.hidden) {
      const z = tugEl.querySelector(".zone"), n = tugEl.querySelector(".needle");
      if (z) { z.style.left = `${(f.tug.zone - f.tug.zw / 2) * 100}%`; z.style.width = `${f.tug.zw * 100}%`; }
      if (n) n.style.left = `${f.tug.needle * 100}%`;
      f.tug.reels.forEach((r, i) => { const el = tugEl.querySelector(`[data-l="${i}"]`); if (el) el.style.width = `${Math.min(100, r)}%`; });
    }
  }

  // ---- full screens: the intro card (or the try-it bar), 3-2-1, standings, shop, the last net ----
  const ctrl = (g) => t(touch ? `y2_t_${g}` : `y2_k_${g}`);
  const readyRow = (f) => `<div class="y2-ready">${f.ready.map((r, i) => `<span class="${r ? "on" : ""}">${face(i, "small")}</span>`).join("")}</div>`;
  // the brush verb is always the Chinese word (DESIGN.md: 点！ 追！ 收！ 照！ 选！); an English page adds its own word under it
  const verb = (g) => boot.lang === "zh" ? `<div class="y2-verb">${esc(t(`y2_v_${g}`))}</div>` : `<div class="y2-verb">${esc((boot.other ?? {})[`y2_v_${g}`] ?? t(`y2_v_${g}`))}</div><div class="y2-verb-en">${esc(t(`y2_v_${g}`))}</div>`;
  function introScreen(f) {
    const g = f.game, mine = me() !== null && f.ready[me()];
    if (trying) {
      ui.overlay.innerHTML = `<div class="y2-trybar"><b>${esc(t(`y2_g_${g}`))}</b><span class="note">${esc(t("y2_practising"))} · <span id="y2-left">${f.left}</span></span>${readyRow(f)}<button class="btn primary small" type="button" id="y2-go" ${mine ? "disabled" : ""}>${esc(t(mine ? "y2_waiting" : "y2_ready"))}</button></div>`;
    } else {
      ui.overlay.innerHTML = `<div class="sheet narrow y2-intro"><span class="y2-num">${esc(t("y2_round_n", { n: f.round }))}</span>${verb(g)}<h2>${esc(t(`y2_g_${g}`))}</h2>
        <svg class="y2-art" viewBox="0 0 320 170">${ART[g]}</svg><p class="lede">${esc(t(`y2_d_${g}`))}</p><p class="note">${esc(t("y2_controls"))}: ${esc(ctrl(g))}</p>
        ${readyRow(f)}<div class="row y2-btns"><button class="btn ghost" type="button" id="y2-try">${esc(t("y2_try"))}</button><button class="btn primary" type="button" id="y2-go" ${mine ? "disabled" : ""}>${esc(t(mine ? "y2_waiting" : "y2_ready"))}</button></div><p class="note" id="y2-starts">${esc(t("y2_starts", { n: f.left }))}</p></div>`;
      $("y2-try")?.addEventListener("click", () => { trying = true; lastKey = ""; render(cur); });
    }
    $("y2-go")?.addEventListener("click", (e) => { if (sendOnce("ready", { k: "ready" })) { ui.did("ready"); e.currentTarget.disabled = true; e.currentTarget.textContent = t("y2_waiting"); } });
  }
  function standingsScreen(f) {
    const max = Math.max(10, ...f.coins);
    ui.overlay.innerHTML = `<div class="sheet narrow"><h2>${esc(t("y2_round_res", { n: f.round, game: t(`y2_g_${f.game}`) }))}</h2><p class="lede">${esc(t("y2_lake_left", { n: f.lake }))}</p>
      <div class="y2-coins">${f.coins.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]).map(([c, i]) => `<div class="y2-crow">${face(i, "small")}<div class="bar"><i style="width:${((c - f.roundCoins[i]) / max) * 100}%;background:${colorOf(i)}"></i><i class="gain" style="width:${(f.roundCoins[i] / max) * 100}%"></i></div><b>${c}${f.roundCoins[i] ? ` <small class="y2-plus">+${f.roundCoins[i]}</small>` : ""}</b></div>`).join("")}</div></div>`;
  }
  function shopScreen(f) {
    const mine = me() !== null ? f.coins[me()] : 0, bought = f.me?.buys ?? [], done = me() !== null && f.done[me()];
    ui.overlay.innerHTML = `<div class="sheet narrow"><div class="po-mhead"><div><h2>${esc(t("y2_shop_h"))}</h2><p class="lede">${esc(t("y2_shop_s"))}</p></div><div class="po-mt"><b id="y2-left">${f.left}</b></div></div>
      <div class="offer y2-shop">${["net", "fast", "bait"].map((id) => `<button class="card plain" type="button" data-buy="${id}" ${bought.includes(id) || mine < 3 || done ? "disabled" : ""}><span class="kind">${esc(bought.includes(id) ? t("y2_bought") : t("y2_buy3"))}</span><b>${esc(t(`y2_sh_${id}`))}</b><p>${esc(t(`y2_sh_${id}_s`))}</p></button>`).join("")}</div>
      <p class="note">${esc(t("y2_coins"))}: ${mine}</p><div class="row"><button class="btn primary" type="button" id="y2-done" ${done ? "disabled" : ""}>${esc(t("y2_done"))} →</button></div></div>`;
    ui.overlay.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => { if (sendOnce(`buy-${b.dataset.buy}`, { k: "buy", item: b.dataset.buy })) { b.disabled = true; sound.coin?.(1); } }));
    $("y2-done")?.addEventListener("click", (e) => { if (sendOnce("done", { k: "done" })) e.currentTarget.disabled = true; });
  }
  function lastScreen(f) {
    const L = f.last, mine = L.mine;
    if (f.phase === "pick") {
      ui.overlay.innerHTML = `<div class="sheet narrow y2-intro"><span class="y2-num">${esc(t("y2_round_n", { n: 5 }))}</span>${verb("last")}<h2>${esc(t("y2_g_last"))}</h2><p class="lede">${esc(t("y2_d_last"))}</p>
        <div class="y2-school"><b>${esc(t("y2_last_school", { n: L.cap }))}</b>${L.fished ? ` ${esc(t("y2_last_fished"))}` : ""}</div>
        <p class="note">${esc(mine ? t("y2_last_wait") : t("y2_last_pick"))} <b id="y2-left">${f.left}</b></p>
        <div class="y2-picks">${[3, 6, 10].map((n) => `<button class="y2-pick" type="button" data-n="${n}" aria-pressed="${mine === n}" ${mine ? "disabled" : ""}><span class="n">${n}</span></button>`).join("")}</div>
        <div class="y2-ready">${L.picked.map((p, i) => `<span class="${p ? "on" : ""}">${face(i, "small")}</span>`).join("")}</div></div>`;
      ui.overlay.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => { if (sendOnce("pick", { k: "pick", n: +b.dataset.n })) { ui.overlay.querySelectorAll("[data-n]").forEach((x) => { x.disabled = true; }); b.setAttribute("aria-pressed", "true"); sound.tick?.(); } }));
      return;
    }
    // the reveal: one pick at a time, with a drum, and a bar against the school's line
    if (revealT.length) return;
    const order = (seats ?? []).map((_, i) => i);
    const draw = (k) => {
      const sum = order.slice(0, k + 1).reduce((n, i) => n + (L.picks[i] ?? 0), 0);
      ui.overlay.innerHTML = `<div class="sheet narrow y2-intro"><h2>${esc(t("y2_g_last"))}</h2><div class="y2-school"><b>${esc(t("y2_last_school", { n: L.cap }))}</b></div>
        <div class="y2-reveal">${order.map((i, j) => `<div class="y2-rv">${face(i, "small")}<b>${esc(nameOf(i))}</b><span class="n ${j > k ? "hide" : ""}">${j > k ? "?" : L.picks[i]}</span></div>`).join("")}</div>
        <div class="y2-sum"><i style="width:${Math.min(100, (sum / (L.cap * 1.6)) * 100)}%" class="${sum > L.cap ? "over" : ""}"></i><span class="cap" style="left:${100 / 1.6}%"></span></div>
        <p class="note">${esc(t("y2_last_total", { n: sum, cap: L.cap }))}</p><p class="po-typed ${L.fit ? "good" : "bad"}" id="y2-verdict"></p></div>`;
    };
    order.forEach((_, k) => revealT.push(setTimeout(() => { draw(k); sound.tick?.(); }, 600 + k * 1100)));
    revealT.push(setTimeout(() => { const el = $("y2-verdict"); if (el) el.textContent = t(L.fit ? "y2_last_fit" : "y2_last_tear"); L.fit ? sound.big?.() : sound.miss?.(); }, 600 + order.length * 1100));
    draw(-1);
  }

  function render(f) {
    // a screen is rebuilt only when what you can choose changes; counters and who is ready update in place,
    // so a button never moves under a finger
    const phaseKey = `${f.phase}:${f.round}`, phaseChanged = phaseKey !== lastPhase;
    lastPhase = phaseKey;
    const mine = me() === null ? null : [f.ready[me()], f.done[me()], f.last?.picks ? 1 : 0, f.last?.mine];
    const key = JSON.stringify([phaseKey, mine, f.phase === "shop" ? f.coins : 0, f.me?.buys, trying, f.phase === "count" ? f.left : 0]);
    // the room page may clear the overlay (after its own start screen): a screen that should be up is put back
    const lost = f.phase !== "play" && !ui.overlay.firstElementChild;
    if (key === lastKey && !phaseChanged && !lost) {
      const l = $("y2-left"); if (l) l.textContent = f.left;
      const st = $("y2-starts"); if (st) st.textContent = t("y2_starts", { n: f.left });
      const marks = f.phase === "pick" ? f.last?.picked : f.ready;
      if (marks) ui.overlay.querySelectorAll(".y2-ready > span").forEach((el, i) => el.classList.toggle("on", !!marks[i]));
      return;
    }
    lastKey = key;
    if (phaseChanged) {
      if (f.phase === "intro" || f.phase === "play") { hud(); world.setCameraMode(f.game === "koi" || f.game === "night" ? "follow" : "overview"); world.setNight(f.game === "night" ? 0.92 : 0); world.setSteerMode(f.game === "koi" || f.game === "night"); }
      if (f.phase === "intro") { trying = false; }
      if (f.phase === "standings" || f.phase === "shop" || f.phase === "pick") { ui.hud.innerHTML = ""; tugEl.hidden = true; world.setNight(0); world.setCameraMode("overview"); }
      if (f.phase !== "reveal") { revealT.forEach(clearTimeout); revealT = []; }
      sentOnce = new Set();
    }
    if (f.phase === "intro") introScreen(f);
    else if (f.phase === "count") ui.overlay.innerHTML = `<div class="count" aria-live="assertive">${f.left}</div>`;
    else if (f.phase === "play") ui.overlay.innerHTML = "";
    else if (f.phase === "standings") standingsScreen(f);
    else if (f.phase === "shop") shopScreen(f);
    else if (f.phase === "pick" || f.phase === "reveal") lastScreen(f);
  }

  // ---- the lake: boats, fish, splashes, gates, the carp, lanterns ----
  function draw(dt, tt) {
    if (!cur) return;
    const k = Math.min(1, (performance.now() - curAt) / 100);
    const lerp = (a, b) => a + (b - a) * k;
    const shown = new Set();
    for (const b of cur.b ?? []) {
      shown.add(b[0]);
      const p = prev?.b?.find((x) => x[0] === b[0]) ?? b;
      const bt = world.boat(b[0], colorOf(b[0]), `${nameOf(b[0])} · ${cur.coins[b[0]]}`);
      world.drawBoat(bt, lerp(p[1] / 10, b[1] / 10), lerp(p[2] / 10, b[2] / 10), b[3] / 100, tt, { visible: true, lantern: cur.game === "night" });
    }
    for (const [seat, bt] of world.boats ?? []) if (!shown.has(seat)) bt.mesh.visible = false;
    world.setFish((cur.f ?? []).map((f, i) => { const p = prev?.f?.[i]; return p ? [lerp(p[0] / 10, f[0] / 10), lerp(p[1] / 10, f[1] / 10), f[2] / 100, f[3] ? 1 : 0.6] : [f[0] / 10, f[1] / 10, f[2] / 100, f[3] ? 1 : 0.6]; }), tt);
    for (const [id, x, y, state, by] of cur.spots ?? []) {
      // deep gold on a dark halo (pale gold vanished on sunlit water); a warning ring is dimmer, an open one pulses
      const ring = world.prop(`sp${id}`, () => world.makeRing(4.3, 6.4));
      const [wx, wz] = world.toWorld(x / 10, y / 10); ring.position.set(wx, 0.15, wz);
      const pulse = 0.5 + Math.sin(tt * 14) * 0.5, gold = ring.userData.gold, halo = ring.userData.halo;
      gold.material.color.set(state === 2 ? colorOf(by) : state === 1 ? "#ffa800" : "#b86a00"); gold.material.opacity = state === 0 ? 0.9 : 1;
      halo.material.opacity = state === 0 ? 0.45 : 0.7; ring.scale.setScalar(state === 1 ? 1 + pulse * 0.1 : 1);
    }
    if (cur.path) {
      const next = cur.me ? cur.me.gate % cur.path.length : -1;
      cur.path.forEach(([x, y], i) => { const l = world.prop(`gate${i}`, () => world.makeLantern(1.4)); const [wx, wz] = world.toWorld(x / 10, y / 10); l.position.set(wx, 2.4, wz); l.scale.setScalar(i === next ? 1.3 + Math.sin(tt * 6) * 0.2 : 0.9); });
      if (next >= 0 && cur.phase !== "count") world.pointAt(cur.path[next][0] / 10, cur.path[next][1] / 10);
    } else world.pointAt(null);
    if (cur.koi) { const pk = prev?.koi ?? cur.koi, kx = lerp(pk[0], cur.koi[0]) / 10, ky = lerp(pk[1], cur.koi[1]) / 10; if (pk[0] !== cur.koi[0] || pk[1] !== cur.koi[1]) koiH = Math.atan2(cur.koi[1] - pk[1], cur.koi[0] - pk[0]); world.setKoi([kx, ky, koiH], tt); } else world.setKoi(null, tt);
    for (const [seat, x, y] of cur.lanterns ?? []) { const l = world.prop(`lan${seat}-${x}-${y}`, () => world.makeLantern(1.2)); const [wx, wz] = world.toWorld(x / 10, y / 10); l.position.set(wx, 1.6, wz); }
    world.setLanterns((cur.lanterns ?? []).map(([, x, y]) => [x / 10, y / 10, 1.4]));
    world.sweepProps();
    const myB = me() !== null ? cur.b?.find((x) => x[0] === me()) : null;
    const dark = cur.game === "night" && (cur.phase === "intro" || cur.phase === "play" || cur.phase === "count") && cur.view;
    fog.hidden = !dark;
    if (dark) {
      const holes = [...(myB ? [holeAt(myB[1] / 10, myB[2] / 10, cur.view)] : []), ...(cur.lanterns ?? []).map(([, x, y]) => holeAt(x / 10, y / 10, cur.light))];
      const m = holes.length ? holes.join(",") : "linear-gradient(#000,#000)";
      fog.style.webkitMaskImage = m; fog.style.maskImage = m;
    }
    if (myB && (cur.game === "koi" || cur.game === "night")) world.setCameraMode("follow", { x: myB[1] / 10, z: myB[2] / 10, h: myB[3] / 100, speed: 4 });
  }

  // ---- events ----
  function events(ev) {
    for (const e of ev) {
      if (e.k === "coins" && e.x !== undefined) world.floatText(e.x, e.y, `+${e.n}`, colorOf(e.seat));
      if (e.k === "coins" && e.seat === me()) sound.coin?.(e.n);
      if (e.k === "claimed") { world.ripple(e.x, e.y, colorOf(e.seat), 7); if (e.practice && e.seat === me()) world.floatText(e.x, e.y, "✓", colorOf(e.seat)); }
      if (e.k === "jump") { world.ripple(e.x, e.y, "#e8b84d", 6); sound.splash?.(); }
      if (e.k === "miss") world.ripple(e.x, e.y, "#b9b0c6", 2, 0.5);
      if (e.k === "gate" && e.practice && e.seat === me()) ui.banner(t("y2_gate"));
      if (e.k === "koi") { ui.banner(t("y2_koi_got", { name: nameOf(e.seat) })); sound.big?.(); }
      if (e.k === "reel") e.ok ? sound.catch?.(1) : (sound.miss?.(), world.shake(0.15));
      if (e.k === "landed") ui.banner(t("y2_landed", { name: nameOf(e.seat), n: e.pay }));
      if (e.k === "netted") { world.netDrop(e.x, e.y, e.r, colorOf(e.seat)); if (e.seat === me() && !e.n) world.floatText(e.x, e.y, t("y2_empty"), "#b9b0c6"); }
      if (e.k === "lantern") sound.chime?.();
      if (e.k === "phase" && e.phase === "play") { ui.banner(t("y2_go")); sound.big?.(); }
      if (e.k === "bought") ui.banner(t("y2_bought_b", { item: t(`y2_sh_${e.item}`) }));
    }
  }

  function onFrame(f, ev) {
    seats = view().seats ?? seats; prev = cur ?? f; cur = f; curAt = performance.now();
    events(ev ?? []); render(f);
    ui.setClock(f.left, f.phase === "shop" ? t("y2_shop_h") : f.round === 5 ? t("y2_g_last") : t("y2_clock", { n: f.round }));
    ui.goalEl.textContent = t("party_hud");
    if (f.phase === "intro" || f.phase === "play" || f.phase === "count") {
      updateHud(f);
      const g = f.game;
      // the coach mark only while you can act on it (playing, or trying it first), never behind the intro card
      ui.coach(f.phase === "play" || trying ? [[g === "scramble" ? "tap" : g === "tug" ? "reel" : g === "night" ? "net" : "sail", t(`y2_coach_${g}`)]] : []);
    } else ui.coach([]);
  }

  // ---- the end: the shared ceremony ----
  function renderResults(v, overlayEl) {
    revealT.forEach(clearTimeout); revealT = [];
    const r = v.results, x = r.extra ?? {};
    const tierOf = (n) => { for (const [min, id, mult] of W.tiers) if (n >= min * W.k) return { id, mult }; return { id: "none", mult: 0.5 }; };
    const next = x.next ?? r.lakeAfter, tier = tierOf(next);
    const data = {
      // what the tier multiplies here is coins, not fish home, so there is no fish ledger step
      a: x.left?.a ?? r.lakeAfter, y: x.left?.y ?? 0, next, tier, multKey: "y2_cer_mult",
      podium: r.seats.map((s) => ({ seat: s.seat, name: nameOf(s.seat), character: charOf(s.seat), isMe: s.seat === me(), base: s.base ?? s.score, score: s.score })),
    };
    const zh = (key) => (boot.lang === "zh" ? t(key) : (boot.other ?? {})[key] ?? key);
    const html = ceremonySteps(data, { t, esc, portrait: ui.portrait, zh });
    let step = 0;
    const renderC = () => {
      overlayEl.innerHTML = html[step];
      overlayEl.querySelector("[data-cer-next]")?.addEventListener("click", () => { step++; renderC(); });
      overlayEl.querySelector("[data-cer-skip]")?.addEventListener("click", () => { step = html.length - 1; renderC(); });
      overlayEl.querySelector("[data-cer-again]")?.addEventListener("click", () => post?.("start", { bots: false }));
      overlayEl.querySelector("[data-cer-village]")?.addEventListener("click", () => { location.href = `/play/${view().code}`; });
    };
    renderC();
    ui.hud.innerHTML = ""; tugEl.hidden = true; fog.hidden = true; world.setNight(0);
  }

  world.onFrame(draw);
  return {
    room(v) { seats = v.seats; },
    start(frame, v) { seats = v.seats; prev = cur = null; lastKey = ""; lastPhase = ""; trying = false; world.clearBoats?.(); world.clearProps?.(); world.setDocks(seats.map((s, i) => ({ x: world.docks[i]?.x ?? 0, y: world.docks[i]?.z ?? 0, color: COLORS[s.character] }))); onFrame(frame, []); },
    frame(f, ev) { onFrame(f, ev); },
    results(v, overlayEl) { renderResults(v, overlayEl); },
    end() { clearInterval(wasdId); removeEventListener("keydown", onKey); revealT.forEach(clearTimeout); tugEl.remove(); fog.remove(); world.setNight(0); world.pointAt(null); world.setSteerMode(true); },
  };
}
