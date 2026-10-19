/* ================================================================ little pictures for the cards (flat SVG, drawn here) */
const SV = {
  water: (extra = "") => `<rect width="320" height="200" fill="#1d6b72"/><path d="M0 150 Q80 140 160 152 T320 148 L320 200 L0 200Z" fill="#17575d"/><path d="M20 40 q20 -8 40 0 M220 60 q20 -8 40 0 M120 120 q20 -8 40 0" stroke="#7fc6c0" stroke-width="3" fill="none" opacity=".5"/>${extra}`,
  boat: (x, y, c, a = 0, s = 1) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M-22 -9 L12 -9 Q26 -7 30 0 Q26 7 12 9 L-22 9 Q-26 0 -22 -9Z" fill="#7b4a2b" stroke="#1a1016" stroke-width="2.5"/><rect x="-14" y="-6" width="12" height="12" rx="2" fill="${c}"/><path d="M4 0 L4 -20 L20 -2Z" fill="${c}" stroke="#1a1016" stroke-width="2"/></g>`,
  fish: (x, y, c = "#ff9a4a", s = 1, a = 0) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><ellipse rx="9" ry="4" fill="${c}"/><path d="M-8 0 L-15 -5 L-15 5Z" fill="${c}"/></g>`,
  school: (x, y, n = 7, c = "#ff9a4a") => Array.from({ length: n }, (_, i) => SV.fish(x + Math.cos(i * 2.4) * (8 + i * 2.2), y + Math.sin(i * 2.4) * (6 + i * 1.5), i % 3 ? c : "#eef4f6", .9, 20)).join(""),
  fry: (x, y, n = 8) => Array.from({ length: n }, (_, i) => SV.fish(x + Math.cos(i * 2.1) * (6 + i * 2), y + Math.sin(i * 2.1) * (5 + i), "#bfe9ff", .5, 10)).join(""),
  net: (x, y, r = 26, c = "#f5ead6") => `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity=".15" stroke="${c}" stroke-width="2.5"/><path d="M${x - r} ${y} H${x + r} M${x} ${y - r} V${y + r} M${x - r * .7} ${y - r * .7} L${x + r * .7} ${y + r * .7} M${x + r * .7} ${y - r * .7} L${x - r * .7} ${y + r * .7}" stroke="${c}" stroke-width="1.5" opacity=".7"/></g>`,
  dock: (x, y) => `<g><rect x="${x - 26}" y="${y}" width="52" height="40" fill="#efe1c2" stroke="#1a1016" stroke-width="2"/><path d="M${x - 32} ${y} L${x} ${y - 22} L${x + 32} ${y}Z" fill="#b8352a" stroke="#1a1016" stroke-width="2"/><rect x="${x - 6}" y="${y - 6}" width="12" height="26" fill="#8a5a34"/></g>`,
  lantern: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="22" fill="#ffb45a" opacity=".25"/><ellipse rx="9" ry="11" fill="#ff5a3c" stroke="#1a1016" stroke-width="2"/><rect x="-5" y="-14" width="10" height="4" fill="#e8b84d"/><rect x="-5" y="10" width="10" height="4" fill="#e8b84d"/></g>`,
  arrow: (x1, y1, x2, y2, c = "#e8b84d") => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="4" stroke-dasharray="8 6" fill="none"/><circle cx="${x2}" cy="${y2}" r="6" fill="${c}"/>`,
  hex: (x, y, r, fill, stroke = "#0d2a30") => `<path d="${Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${i ? "L" : "M"}${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`; }).join(" ")}Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
  text: (x, y, s, c = "#f5ead6", size = 22) => `<text x="${x}" y="${y}" fill="${c}" font-size="${size}" font-weight="800" font-family="Baloo 2, Noto Sans SC, sans-serif" text-anchor="middle">${s}</text>`,
  svg: (body) => `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`,
};
const GAME_ART = {
  rush: () => SV.svg(SV.water() + SV.school(200, 70, 9) + SV.net(206, 72, 30) + SV.boat(150, 96, "#d6473a", -20) + SV.boat(80, 150, "#e0a93a", 30) + SV.arrow(90, 140, 40, 182) + SV.dock(40, 168) + SV.text(266, 40, "0:45")),
  party: () => SV.svg(`<rect width="320" height="200" fill="#141c3a"/>` + SV.lantern(70, 60, 1.3) + SV.lantern(250, 70, 1) + SV.fish(160, 110, "#ffd34d", 2.4, -10) + `<circle cx="160" cy="110" r="40" fill="#ffd34d" opacity=".12"/>` + [0, 1, 2, 3, 4].map(i => `<circle cx="${60 + i * 50}" cy="176" r="12" fill="${i < 3 ? "#e8b84d" : "#3a3550"}" stroke="#1a1016" stroke-width="2"/>${SV.text(60 + i * 50, 182, i + 1, "#120e18", 15)}`).join("")),
  poach: () => SV.svg(SV.water() + SV.fry(80, 70, 10) + SV.net(84, 72, 30, "#ff8a7a") + SV.boat(130, 100, "#4a7d9c", 160) + `<rect width="320" height="200" fill="url(#fog)"/><defs><radialGradient id="fog" cx="40%" cy="45%" r="60%"><stop offset="40%" stop-color="#0a0c16" stop-opacity="0"/><stop offset="100%" stop-color="#0a0c16" stop-opacity=".9"/></radialGradient></defs>` + SV.text(250, 110, "?", "#e8b84d", 80)),
  hold: () => { let s = `<rect width="320" height="200" fill="#1d6b72"/>`; const cols = ["#d6473a55", "#4a7d9c55", "#1d6b72", "#e0a93a55"]; for (let r = 0; r < 4; r++) for (let q = 0; q < 7; q++) { const x = 30 + q * 44 + (r % 2) * 22, y = 30 + r * 40; s += SV.hex(x, y, 24, cols[(q + r * 3) % 4]); } return SV.svg(s + SV.net(74, 70, 16) + `<circle cx="162" cy="110" r="14" fill="#7ccf8e"/>` + SV.lantern(250, 70, .8) + SV.fish(206, 110, "#ff9a4a", 1.2)); },
};

/* ================================================================ the village: pick a game */
addWords({
  en: {
    title: "Next Year, No Fish", tagline: "One lake. Everyone fishes it. What you take today, someone else can't catch tomorrow.",
    pickgame: "Pick a game", pickfisher: "Your fisher", newlake_btn: "New lake",
    g_rush: "Boat Rush", g_rush_q: "One more cast, or home before the gong?", g_rush_m: "2–4 players · 4 min",
    g_party: "Fishing Party", g_party_q: "Five little games. Grab now, or leave fish for the last net?", g_party_m: "2–4 players · 5 min",
    g_poach: "Who's Poaching", g_poach_q: "Someone is fishing the young fish at dusk. Who do you believe?", g_poach_m: "4–8 players · 7 min",
    g_hold: "Lake Holdings", g_hold_q: "Nets pay now. Ponds feed everyone later. Which do you build?", g_hold_m: "2–4 players · 5 min",
    play_x: "Play {game} →", proto_note: "Prototype: you play against bots in this browser. In the real site, friends join with a link.",
    seasons_show: "The lake through the year",
  },
  zh: {
    title: "明年无鱼", tagline: "一片湖，大家一起捞。你今天多拿一条，别人明天就少一条。",
    pickgame: "选一个游戏", pickfisher: "你的渔民", newlake_btn: "换一片新湖",
    g_rush: "开船抢鱼", g_rush_q: "再撒一网，还是锣响前回家？", g_rush_m: "2–4 人 · 4 分钟",
    g_party: "钓鱼派对", g_party_q: "五个小游戏。现在抢，还是把鱼留给最后一网？", g_party_m: "2–4 人 · 5 分钟",
    g_poach: "谁在偷鱼", g_poach_q: "黄昏有人在偷捞小鱼。你相信谁？", g_poach_m: "4–8 人 · 7 分钟",
    g_hold: "抢地盘经营", g_hold_q: "渔网马上赚，鱼塘以后养活大家。你建哪个？", g_hold_m: "2–4 人 · 5 分钟",
    play_x: "玩{game} →", proto_note: "原型：在这个浏览器里和机器人玩。正式网站里，朋友用链接加入。",
    seasons_show: "一年四季的湖",
  },
});
let villagePick = "rush";
try { const l = localStorage.getItem("nynf-last"); if (["rush", "party", "poach", "hold"].includes(l)) villagePick = l; } catch (e) {}
let villageSeasonT = 0;
function renderVillage() {
  G.phase = "village"; cam.mode = "orbit"; Music.mood("calm"); nightTarget = 0; fishOpts.seasonal = true;
  const total = G.lake.adults + G.lake.fry, tier = tierOf(total);
  screen(`<div class="sheet">
    <div class="titlerow"><div class="seal" aria-hidden="true"><span>明</span><span>年</span><span>无</span><span>鱼</span></div><div><h1>${t("title")}</h1><p>${t("tagline")}</p></div></div>
    <div class="lakejar"><span class="season-chip" id="vseason">${t("sz_" + SEASONS[seasonIx].id)}</span><div style="flex:1;min-width:0"><div class="row spread"><small class="note">${t("jar", { n: total })}</small><span class="tier t-${tier.id}">${t("v_" + tier.id)}</span></div><div class="lakebar"><i style="width:${Math.min(100, total / K * 100)}%;background:${tierCol[tier.id]}"></i></div></div><button class="btn ghost small" type="button" id="vNew">${t("newlake_btn")}</button></div>
    <div><p class="note" style="margin-bottom:8px">${t("pickgame")}</p>
      <div class="games">${["rush", "party", "poach", "hold"].map(id => `<button class="game" type="button" data-game="${id}" aria-pressed="${id === villagePick}"><span class="pic">${GAME_ART[id]()}</span><span class="txt"><b>${t("g_" + id)}</b><span class="q">${t("g_" + id + "_q")}</span><span class="meta">${t("g_" + id + "_m")}</span></span></button>`).join("")}</div></div>
    <div class="row spread" style="align-items:end"><div><p class="note" style="margin-bottom:6px">${t("pickfisher")}</p><div class="crew">${CREW.map(c => `<button class="face" type="button" data-me="${c.id}" aria-pressed="${c.id === G.me}" aria-label="${c[LANG]}">${portrait(c.id, c[LANG])}</button>`).join("")}</div></div>
      <div class="row"><span class="note">${t("lang")}</span><div class="seg"><button type="button" data-lang="en" aria-pressed="${LANG === "en"}">EN</button><button type="button" data-lang="zh" aria-pressed="${LANG === "zh"}">中文</button></div>
      <span class="note">${t("sound")}</span><div class="seg"><button type="button" data-snd="1" aria-pressed="${Music.on}">${t("on")}</button><button type="button" data-snd="0" aria-pressed="${!Music.on}">${t("off")}</button></div></div></div>
    <div class="row spread"><button class="btn primary" type="button" id="vGo">${t("play_x", { game: t("g_" + villagePick) })}</button><p class="note" style="max-width:420px">${t("proto_note")}</p></div>
  </div>`, "clear");
  screenEl.querySelectorAll("[data-game]").forEach(b => b.onclick = () => { villagePick = b.dataset.game; Music.start(); renderVillage(); });
  screenEl.querySelectorAll("[data-me]").forEach(b => b.onclick = () => { G.me = b.dataset.me; try { localStorage.setItem("nynf-me", G.me); } catch (e) {} renderVillage(); });
  screenEl.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => setLang(b.dataset.lang));
  screenEl.querySelectorAll("[data-snd]").forEach(b => b.onclick = () => { Music.start(); if ((b.dataset.snd === "1") !== Music.on) Music.toggle(); renderVillage(); });
  $("#vNew").onclick = () => { G.lake = { adults: LAKE.A0, fry: LAKE.Y0 }; saveLake(); renderVillage(); };
  $("#vGo").onclick = () => { Music.start(); startMode(villagePick); };
}
MODES.village = { update(dt) { if (G.phase !== "village") return; villageSeasonT += dt; if (villageSeasonT > 7) { villageSeasonT = 0; setSeason(seasonIx + 1); const el = $("#vseason"); if (el) el.textContent = t("sz_" + SEASONS[seasonIx].id); } } };

/* ================================================================ the rules card: three pictures, one sentence each, the choice that matters */
addWords({
  en: { how: "How to play", choice_l: "The choice that matters:", controls_l: "Controls", start_game: "Start", practice: "Practise first (30 s)", seen_skip: "You have played this before.", phone: "Phone", laptop: "Laptop" },
  zh: { how: "怎么玩", choice_l: "最关键的选择：", controls_l: "操作", start_game: "开始", practice: "先练一下（30 秒）", seen_skip: "你玩过这个。", phone: "手机", laptop: "电脑" },
});
function rulesCard({ id, steps, choice, controls, onStart, onPractice }) {
  G.phase = "rules"; cam.mode = "overview";
  screen(`<div class="sheet">
    <div class="titlerow"><div class="seal" aria-hidden="true"><span>明</span><span>年</span><span>无</span><span>鱼</span></div><div><h1>${t("g_" + id)}</h1><p>${t("g_" + id + "_q")}</p></div></div>
    <div class="steps3">${steps.map(([title, text, art], i) => `<div class="step"><div class="ill">${SV.svg(art)}</div><b><span class="n">${i + 1}</span>${title}</b><p>${text}</p></div>`).join("")}</div>
    <div class="choice"><b>${t("choice_l")}</b> ${choice}</div>
    ${controls ? `<div class="controls"><span><b>${t(isTouch ? "phone" : "laptop")}:</b> ${controls}</span></div>` : ""}
    <div class="row"><button class="btn primary" type="button" id="rStart">${t("start_game")} →</button>${onPractice ? `<button class="btn ghost" type="button" id="rPractice">${t("practice")}</button>` : ""}<button class="btn ghost small" type="button" id="rBack">${t("back")}</button></div>
  </div>`);
  $("#rStart").onclick = () => { Music.start(); markSeen(id); onStart(); };
  $("#rPractice") && ($("#rPractice").onclick = () => { Music.start(); onPractice(); });
  $("#rBack").onclick = () => toVillage();
}
