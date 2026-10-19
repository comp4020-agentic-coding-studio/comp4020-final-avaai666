/* ================================================================ BOAT RUSH 开船抢鱼: four seasons, a card between them, home before the gong */
const RU = {
  SEASONS: 4, SEASON_S: 45, RUSH_S: 10, MARKET_S: 14, REST_S: 4.5,
  NET_MAX: 6, HOLD: 12, SPEED: 15, FULL_SLOW: .35, NET_R: 3.5, NET_AHEAD: 4, CAST_CD: 1.0, DASH_CD: 4, DASH_T: .4, DASH_X: 2.4,
  RAM_SPILL: 3, SHIELD: 3, DOCK_SAFE: 11, KOI: 5, COMBO_T: 2.6, REROLL: 2, UNLOAD_R: 6.5,
};
const RCARDS = {
  bigHold: { kind: "plain", glyph: "🛶", en: ["Big Hold", "+4 fish in your boat."], zh: ["大船舱", "船上多装 4 条鱼。"] },
  fastHull: { kind: "plain", glyph: "💨", en: ["Fast Hull", "Sail 15% faster."], zh: ["快船", "船速快 15%。"] },
  wideNet: { kind: "plain", glyph: "🕸", en: ["Wide Net", "Your net is 18% wider."], zh: ["宽网", "网撒得宽 18%。"] },
  quickHands: { kind: "plain", glyph: "✋", en: ["Quick Hands", "Cast again 30% sooner."], zh: ["快手", "撒网冷却缩短 30%。"] },
  ironBow: { kind: "plain", glyph: "⚓", en: ["Iron Bow", "Your rams knock out 1 more fish; rams on you, 1 fewer."], zh: ["铁船头", "你撞人多撞掉 1 条；别人撞你少掉 1 条。"] },
  goldHook: { kind: "plain", glyph: "🪝", en: ["Golden Hook", "Golden carp are worth 8, and swim toward you."], zh: ["金钩", "金色锦鲤值 8 条，还会朝你游。"] },
  fineMesh: { kind: "greedy", glyph: "🔴", en: ["Fine Mesh", "Your net keeps the young fish too: about +40% catch. They were next year's fish."], zh: ["细网", "连小鱼也一起捞：多捞约 40%。可它们是明年的鱼。"] },
  trawl: { kind: "greedy", glyph: "⛓", en: ["Trawl", "While you sail, you scoop up every fish you pass over, young ones included."], zh: ["拖网", "开船时经过的鱼全被拖走，小鱼也不放过。"] },
  ladder: { kind: "steward", glyph: "🌿", en: ["Fish Ladder", "The whole lake breeds 15% better. You get 1 fish for every 8 born."], zh: ["鱼道", "全湖繁殖多 15%。每出生 8 条，你得 1 条。"] },
  release: { kind: "steward", glyph: "🤲", en: ["Let Them Go", "Young fish in your net go free; each one you spare scores ½ a fish if next year is Fair or better."], zh: ["放生", "网里的小鱼都放回去；如果明年是平年或更好，每放一条算半条鱼。"] },
  reeds: { kind: "steward", glyph: "🌾", en: ["Reed Bed", "Plant reeds by your dock: 10 more young fish hatch there each time the lake breeds."], zh: ["种芦苇", "在你码头边种芦苇：每次繁殖那里多孵 10 条小鱼。"] },
};
const rCard = (id) => RCARDS[id][LANG][0];
addWords({
  en: {
    r1t: "Fish fast", r1p: "Each season lasts 45 seconds. Sail to a school and press NET when the fish are just ahead of your bow.",
    r2t: "Home before the gong", r2p: "Unload at your own dock. Fish still in your boat when the gong sounds spoil.",
    r3t: "Pick one card", r3p: "Between seasons, pick one of three. Red cards catch more but kill the young fish: next year's fish.",
    r_choice: "Most fish home wins. But everyone's fish are multiplied by how full next year's lake is. Greed can lose you the game.",
    r_controls_touch: "drag anywhere on the left to sail · NET and DASH on the right · or tap the water",
    r_controls_keys: "<kbd>W A S D</kbd>/arrows sail · <kbd>Space</kbd> net · <kbd>Shift</kbd> dash · or click the water",
    season_l: "Season", time_l: "Time", home_l: "Home", hold_l: "In your boat", cast: "NET", dash: "DASH",
    s_start: "{season}", s_start_s: "{secs} seconds · fish, then get home", s_last: "Last season: winter",
    tw_spring: "Spring: fish come in at the river mouth; the young are in the reeds", tw_summer: "Summer: fish gather in the lotus and the deep water; two golden carp", tw_autumn: "Autumn: fat fish, each counts double", tw_winter: "Winter: ice along the shore; fish keep to the deep water",
    rush: "The gong is coming!", rush_s: "10 seconds · get home",
    gong: "Gong!", gong_s: "Fish still aboard spoiled: {n}",
    full: "Your boat is full: go home", empty: "Empty net", fry: "{n} young fish slipped through your net", fryk: "{n} young fish killed",
    home: "+{n} home", koi: "Golden carp!", koi_s: "Worth {n} at home", combo: "Chain ×{n}!", autumn2: "×2",
    rammed: "{name} rammed you: −{n}", ram: "Rammed {name}: {n} spilled", scoop: "Scooped +{n}",
    rest: "The lake breathes", rest_s: "{grew} young fish grew up · {born} were born", rest_bad: "Too few fish met to spawn: the lake shrinks",
    market: "Pick one", market_s: "{season} is next. Everyone sees what you take.", reroll: "New cards (−{n} fish)", skip: "No card this time",
    k_plain: "Gear", k_greedy: "Greedy", k_steward: "Keeper",
    picked: "{name} took {card}", picks_h: "What everyone took",
    p1: "Sail: drag on the left side of the screen", p1k: "Sail: W A S D or the arrow keys (or click the water)", p1s: "Head for the gold ring",
    p2: "Fish ahead of your bow: press NET", p2k: "Fish ahead of your bow: press Space", p2s: "The net lands just in front of the boat",
    p3: "Take the fish home to your dock", p3s: "Follow the arrow. Unloading is automatic.",
    p4: "That's it!", p4s: "In a real season, the gong ends it: fish still aboard spoil.",
    p_done: "You're ready", p_done_s: "Four seasons, three bots. Most fish home wins, times next year's lake.", p_start: "Start the real game",
  },
  zh: {
    r1t: "快快捕鱼", r1p: "每季 45 秒。开到鱼群旁边，鱼在船头正前方时按「撒网」。",
    r2t: "锣响前回家", r2p: "回自家码头卸鱼。锣响时还在船上的鱼会坏掉。",
    r3t: "选一张卡", r3p: "两季之间三选一。红色的卡捞得多，但会捞死小鱼——那是明年的鱼。",
    r_choice: "运回家的鱼最多的人赢。但每个人的鱼都要乘上明年湖的年景。太贪，反而会输。",
    r_controls_touch: "在屏幕左边按住拖动开船 · 右边是「撒网」和「冲刺」 · 也可以点水面",
    r_controls_keys: "<kbd>W A S D</kbd>/方向键开船 · <kbd>空格</kbd> 撒网 · <kbd>Shift</kbd> 冲刺 · 也可以点水面",
    season_l: "季节", time_l: "时间", home_l: "到家", hold_l: "船上的鱼", cast: "撒网", dash: "冲刺",
    s_start: "{season}", s_start_s: "{secs} 秒 · 捕鱼，然后回家", s_last: "最后一季：冬",
    tw_spring: "春：鱼从河口游进来，小鱼都在芦苇荡", tw_summer: "夏：鱼聚在荷花塘和深潭，有两条金色锦鲤", tw_autumn: "秋：鱼肥了，每条算两条", tw_winter: "冬：湖边结冰，鱼都躲在深水里",
    rush: "快敲锣了！", rush_s: "还剩 10 秒 · 快回家",
    gong: "锣响了！", gong_s: "船上没卸的鱼坏了：{n} 条",
    full: "船舱满了：快回家", empty: "空网", fry: "{n} 条小鱼从网眼漏走了", fryk: "捞死了 {n} 条小鱼",
    home: "+{n} 到家", koi: "金色锦鲤！", koi_s: "运回家值 {n} 条", combo: "连网 ×{n}！", autumn2: "×2",
    rammed: "{name} 撞了你：−{n}", ram: "撞了{name}：撞掉 {n} 条", scoop: "捞起 +{n}",
    rest: "湖缓了一口气", rest_s: "{grew} 条小鱼长大了 · 又生了 {born} 条", rest_bad: "鱼太少，碰不到一起产卵：湖在萎缩",
    market: "选一张", market_s: "接下来是{season}。你选了什么，大家都看得到。", reroll: "换一批（−{n} 条鱼）", skip: "这次不要卡",
    k_plain: "渔具", k_greedy: "贪心", k_steward: "护湖",
    picked: "{name} 选了{card}", picks_h: "大家选了什么",
    p1: "开船：在屏幕左边按住拖动", p1k: "开船：按 W A S D 或方向键（也可以点水面）", p1s: "开到金色的圈里",
    p2: "鱼在船头前面：按「撒网」", p2k: "鱼在船头前面：按空格撒网", p2s: "网落在船头正前方",
    p3: "把鱼运回自家码头", p3s: "跟着箭头走。靠岸就会自动卸鱼。",
    p4: "就是这样！", p4s: "正式比赛里，锣一响这一季就结束：船上的鱼会坏掉。",
    p_done: "可以开始了", p_done_s: "四个季节，三个机器人。运回家的鱼最多的人赢，再乘上明年湖的年景。", p_start: "开始正式比赛",
  },
});
const R = { boats: [], loose: [], koi: null, season: 0, clock: 0, history: [], phase: "", practice: null };
const rHas = (b, id) => b.cards.filter(c => c === id).length;
const holdMax = (b) => RU.HOLD + 4 * rHas(b, "bigHold");
const speedOf = (b) => RU.SPEED * (1 + .15 * rHas(b, "fastHull")) * (1 - RU.FULL_SLOW * b.hold.length / holdMax(b)) * (b.dash > 0 ? RU.DASH_X : 1);
const netR = (b) => RU.NET_R * (1 + .18 * rHas(b, "wideNet"));
const castCdOf = (b) => RU.CAST_CD * Math.pow(.7, rHas(b, "quickHands"));
const koiValue = (b) => rHas(b, "goldHook") ? 8 : RU.KOI;
const takesYoung = (b) => (rHas(b, "fineMesh") || rHas(b, "trawl")) && !rHas(b, "release");
const seasonName = (i) => t("s_" + SEASONS[i].id);

function rushRules() {
  rulesCard({
    id: "rush",
    steps: [
      [t("r1t"), t("r1p"), SV.water() + SV.school(206, 80, 9) + SV.net(214, 84, 30) + SV.boat(150, 104, "#d6473a", -20) + SV.text(272, 40, "0:45")],
      [t("r2t"), t("r2p"), SV.water() + SV.boat(150, 70, "#d6473a", 120) + SV.arrow(140, 86, 70, 150) + SV.dock(60, 160) + `<g transform="translate(240 60)"><circle r="26" fill="#e8b84d" opacity=".25"/>${SV.text(0, 9, "锣", "#e8b84d", 28)}</g>`],
      [t("r3t"), t("r3p"), `<rect width="320" height="200" fill="#1d1726"/>${[["#45a48c", "🌾"], ["#4a4458", "🕸"], ["#cf3b2e", "🔴"]].map(([c, g], i) => `<rect x="${24 + i * 96}" y="34" width="80" height="120" rx="12" fill="#241d2e" stroke="${c}" stroke-width="4"/>${SV.text(64 + i * 96, 108, g, "#fff", 34)}`).join("")}`],
    ],
    choice: t("r_choice"), controls: t(isTouch ? "r_controls_touch" : "r_controls_keys"),
    onStart: () => rushRun(false), onPractice: () => rushPractice(),
  });
}

/* ---------------------------------------------------------------- boats */
function rushBoats(n = 4) {
  removeBoats(R.boats);
  const ids = [G.me, ...CREW.map(c => c.id).filter(id => id !== G.me).slice(0, n - 1)];
  R.boats = ids.map((id, i) => { const b = makeCrewBoat(CREW.find(x => x.id === id), i, i === 0); Object.assign(b, { hold: [], banked: 0, castCd: 0, dashCd: 0, dash: 0, shield: 0, cards: [], combo: 0, lastCatch: -9, ai: { cd: 0, kind: b.c.bot }, unloadT: 0,
    stats: { home: 0, youngKilled: 0, youngSpared: 0, rams: 0, koi: 0, spoiled: 0 } }); return b; });
}
function rushHud() {
  hud({
    top: `<div class="pill"><span class="season-chip" id="rSeasonChip">春</span><div><small>${t("season_l")}</small><b id="rSeason">1/4</b></div><div><small>${t("time_l")}</small><b id="rClock">0:45</b></div></div>
      <div class="pill lakebox"><div class="lakehead"><small>${t("lake")}</small><span class="tier" id="rTier"></span></div><div class="lakebar"><i class="now" id="rNow"></i><i id="rNext"></i>${TIERS.slice(0, 3).map(([m]) => `<i class="mark" style="left:${m * 100}%"></i>`).join("")}</div></div>
      <div class="pill hide-sm"><div><small>${t("home_l")}</small><b id="rBanked" style="color:var(--gold)">0</b></div></div>`,
    left: `<div class="hold"><small>${t("hold_l")}</small><div class="fishrow" id="rHold"></div><div class="cards" id="rCards"></div></div>`,
    pads: [{ id: "rDash", label: t("dash"), cls: "red", key: "Shift", on: () => rDash(R.boats[0]) }, { id: "rCast", label: t("cast"), key: t("space_k"), on: () => rCast(R.boats[0]) }],
    keys: t("keys_boat"),
  });
  renderRCards();
}
addWords({ en: { space_k: "Space" }, zh: { space_k: "空格" } });
function renderRCards() { const el = $("#rCards"); if (el) el.innerHTML = R.boats[0]?.cards.map(id => `<span class="mini-card ${RCARDS[id].kind}">${rCard(id)}</span>`).join("") ?? ""; }

/* ---------------------------------------------------------------- practice: one boat, no clock, three things to learn */
function rushPractice() {
  hideScreen(); G.phase = "play"; R.phase = "practice"; setSeason(0, true); seedLake(160, 40); rushBoats(1); resetHouses();
  const me = R.boats[0]; atDock(me); cam.mode = "follow"; cam.target = me; cam.x = me.x; cam.z = me.z; cam.dist = distForSpan(viewSpan());
  rushHud(); $("#rClock").textContent = "—"; Music.mood("calm");
  const [rx, rz] = [me.x + Math.cos(me.h) * 26, me.z + Math.sin(me.h) * 26];
  const ring = makeRing("#e8b84d", 5); ring.position.set(rx, 0, rz);
  const s = schools[0]; s.x = rx + Math.cos(me.h) * 10; s.z = rz + Math.sin(me.h) * 10; s.tx = s.x; s.tz = s.z; s.t = 999;
  for (const f of fish) if (f.s === 0) { f.x = s.x + f.ox; f.z = s.z + f.oz; }
  for (let k = 0; k < 10; k++) addFish(true, s.x + rand(-3, 3), s.z + rand(-3, 3), 0);
  R.practice = { step: 1, ring };
  coach(t(isTouch ? "p1" : "p1k"), t("p1s")); pointAt(rx, rz);
}
function practiceUpdate() {
  const P = R.practice, me = R.boats[0]; if (!P) return;
  if (P.step === 1 && Math.hypot(me.x - P.ring.position.x, me.z - P.ring.position.z) < 6) { P.step = 2; scene.remove(P.ring); Music.chime(); const s = schools[0]; coach(t(isTouch ? "p2" : "p2k"), t("p2s")); pointAt(s.x, s.z); $("#rCast")?.classList.add("pulse"); }
  if (P.step === 2) { const s = schools[0]; pointAt(s.x, s.z); if (me.hold.length >= 3) { P.step = 3; $("#rCast")?.classList.remove("pulse"); coach(t("p3"), t("p3s")); pointAt(me.dock.wx, me.dock.wz); Music.chime(); } }
  if (P.step === 3 && me.banked > 0 && !me.hold.length) { P.step = 4; pointAt(null); coach(t("p4"), t("p4s")); Music.chime(); markSeen("rush-practice");
    later(() => { if (R.phase !== "practice") return; coach(null); hideHud(); G.phase = "rules"; screen(`<div class="sheet narrow" style="text-align:center"><h2>${t("p_done")}</h2><p class="lede">${t("p_done_s")}</p><div class="row" style="justify-content:center"><button class="btn primary" type="button" id="pGo">${t("p_start")} →</button></div></div>`); $("#pGo").onclick = () => rushRun(false); }, 2600); }
}

/* ---------------------------------------------------------------- the run */
function rushRun(keepLake = true) {
  hideScreen(); R.practice = null; coach(null); pointAt(null);
  const L = keepLake ? G.lake : { adults: LAKE.A0, fry: LAKE.Y0 };
  R.lakeStart = { ...L }; R.history = []; R.season = 0; resetHouses(); rushBoats(4); seedLake(L.adults, L.fry);
  rushHud(); cam.mode = "follow"; cam.target = R.boats[0]; cam.x = R.boats[0].x; cam.z = R.boats[0].z; cam.dist = distForSpan(viewSpan());
  rNextSeason();
}
function rNextSeason() {
  R.season++; G.phase = "play"; R.phase = "play"; R.clock = RU.SEASON_S; R.rushed = false;
  setSeason(R.season - 1); placeSchools();
  R.boats.forEach(b => { atDock(b); b.hold = []; b.castCd = 0; b.dashCd = 0; b.combo = 0; b.seasonStart = b.banked; });
  R.koi = { on: false, spawns: SEASONS[seasonIx].id === "summer" ? [rand(6, 14), rand(24, 30)] : [rand(8, 24)], idx: 0, x: 0, z: 0, h: 0, n: 0 };
  const [a, y] = counts(); R.startCounts = [a, y]; R.seasonCaught = 0; R.seasonYoung = 0; R.casts = 0; R.got = 0;
  const id = SEASONS[seasonIx].id;
  banner(`${t("sz_" + id)}${LANG === "zh" ? "" : " · " + seasonName(seasonIx)}`, t("tw_" + id));
  $("#rSeasonChip") && ($("#rSeasonChip").textContent = t("sz_" + id)); $("#rSeason") && ($("#rSeason").textContent = `${R.season}/${RU.SEASONS}`);
  Music.mood("calm"); Music.chime(); renderRCards();
  if (R.season === 1 && !seen("rush-practice")) { R.coachT = 0; R.coached = { sail: false, cast: false }; }
}
/* nets */
function rCast(b) {
  if (G.phase !== "play" || b.castCd > 0) return;
  b.castCd = castCdOf(b); if (R.phase === "play") R.casts++;
  const nx = b.x + Math.cos(b.h) * RU.NET_AHEAD, nz = b.z + Math.sin(b.h) * RU.NET_AHEAD, r = netR(b);
  netDrop(nx, nz, b.c.color, r, takesYoung(b)); if (b.isMe) { Music.splash(); if (R.coached) R.coached.cast = true; }
  later(() => rCloseNet(b, nx, nz, r), 380);
}
function rCloseNet(b, nx, nz, r) {
  if (G.phase !== "play") return;
  let room = Math.min(holdMax(b) - b.hold.length, RU.NET_MAX + 2 * rHas(b, "wideNet") + 2 * rHas(b, "fineMesh")), got = 0, young = 0, slipped = 0;
  const val = SEASONS[seasonIx].id === "autumn" ? 2 : 1;
  for (let i = fish.length - 1; i >= 0; i--) {
    const f = fish[i]; if (Math.hypot(f.x - nx, f.z - nz) > r) continue;
    if (f.adult) { if (room > 0) { fish.splice(i, 1); b.hold.push(val * (f.big ? 2 : 1)); room--; got++; } }
    else if (takesYoung(b)) { if (room > 0) { fish.splice(i, 1); b.hold.push(val); room--; got++; young++; } }
    else { f.flee = .6; f.fa = rand(0, 6.28); if (!(f.sp & (1 << b.i))) { f.sp |= 1 << b.i; slipped++; } }
  }
  const k = R.koi; if (k?.on && room > 0 && Math.hypot(k.x - nx, k.z - nz) < r + 1.4) { k.on = false; k.n++; b.hold.push(koiValue(b)); b.stats.koi++; floatAt(nx, nz, t("koi"), "#ffd34d", true); if (b.isMe) toast(t("koi_s", { n: koiValue(b) }), "good"); Music.chime(); }
  for (const f of fish) if (Math.hypot(f.x - nx, f.z - nz) < r * 2.2 && Math.random() < .5) { f.flee = .5; f.fa = Math.atan2(f.z - nz, f.x - nx); }
  b.stats.youngKilled += young; b.stats.youngSpared += slipped;
  if (R.phase === "play") { R.seasonCaught += got; R.seasonYoung += young; R.got += got; }
  if (got >= 3 && G.t - b.lastCatch < RU.COMBO_T) b.combo++; else if (got >= 3) b.combo = 1; else b.combo = 0;
  if (got >= 3) b.lastCatch = G.t;
  if (b.combo >= 2 && holdMax(b) - b.hold.length > 0) { b.hold.push(val); if (b.isMe) floatAt(nx, nz + 2, t("combo", { n: b.combo }), "#ffd34d", true); }
  if (b.isMe) {
    if (got) { floatAt(nx, nz, `+${got}${val > 1 ? " ×2" : ""}`, b.c.color, got >= 5); for (let j = 0; j < Math.min(got, 6); j++) setTimeout(() => Music.catchNote(j + b.combo * 2), j * 70); }
    else floatAt(nx, nz, holdMax(b) - b.hold.length <= 0 ? t("full") : t("empty"), "#b9b0c6");
    if (young) toast(t("fryk", { n: young }), "warn"); else if (slipped >= 2 && R.season <= 1) toast(t("fry", { n: slipped }));
    if (b.hold.length >= holdMax(b)) toast(t("full"), "warn");
    shake(got >= 5 ? .35 : .12);
  }
}
function rTrawl(b, dt) {
  if (!rHas(b, "trawl") || b.speed < 2 || b.hold.length >= holdMax(b)) return;
  b.trawlT = (b.trawlT || 0) + dt; if (b.trawlT < .35) return; b.trawlT = 0;
  for (let i = fish.length - 1; i >= 0; i--) { const f = fish[i]; if (Math.hypot(f.x - b.x, f.z - b.z) < 2.6) { fish.splice(i, 1); b.hold.push(1); if (!f.adult) { b.stats.youngKilled++; R.seasonYoung++; } R.seasonCaught++; if (b.isMe) Music.catchNote(1); break; } }
}
function rDash(b) { if (G.phase !== "play" || b.dashCd > 0) return; b.dash = RU.DASH_T; b.dashCd = RU.DASH_CD; }
function rSpill(v, n) { for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.3, 6, 5).scale(1.6, .7, 1), toon("#f08a3c")); const l = { x: v.x + rand(-2.5, 2.5), z: v.z + rand(-2.5, 2.5), m, val: v.hold.pop() ?? 1 }; m.position.set(l.x, .15, l.z); scene.add(m); R.loose.push(l); } }
const nearDock = (x, z) => DOCKS.some(d => Math.hypot(d.wx - x, d.wz - z) < RU.DOCK_SAFE);

/* the bots: steady, keeper, greedy */
function rThink(b, dt) {
  b.ai.cd -= dt; if (b.ai.cd > 0) return; b.ai.cd = .35;
  const d = b.dock, home = Math.hypot(d.wx - b.x, d.wz - b.z) / Math.max(4, speedOf(b)), full = b.hold.length / holdMax(b);
  const greedy = b.ai.kind === "greedy", keeper = b.ai.kind === "keeper";
  if (full >= (greedy ? .95 : keeper ? .6 : .75) || R.clock < home + (greedy ? 2.5 : 4.5)) { b.tx = d.wx; b.tz = d.wz; return; }
  const k = R.koi, koiNear = k?.on && Math.hypot(k.x - b.x, k.z - b.z) < 26 && b.hold.length < holdMax(b) - 1;
  if (koiNear) { b.tx = k.x; b.tz = k.z; if (Math.hypot(k.x - b.x, k.z - b.z) < 10) rDash(b); }
  else if (greedy && b.dashCd <= 0) { const v = R.boats.find(o => o !== b && o.hold.length >= 5 && o.shield <= 0 && Math.hypot(o.x - b.x, o.z - b.z) < 14 && !nearDock(o.x, o.z)); if (v) { b.tx = v.x; b.tz = v.z; if (Math.hypot(v.x - b.x, v.z - b.z) < 8) rDash(b); return; } }
  if (!koiNear) {
    const cnt = new Array(schools.length).fill(0); for (const f of fish) if (f.adult || takesYoung(b)) cnt[f.s]++;
    let best = null, bs = -1; schools.forEach((s, i) => { if (iceBlocks(s.x, s.z)) return; const sc = cnt[i] / (8 + Math.hypot(s.x - b.x, s.z - b.z)); if (sc > bs) { bs = sc; best = s; } });
    if (best) { const dx = best.x - b.x, dz = best.z - b.z, dd = Math.hypot(dx, dz) || 1; const off = dd > RU.NET_AHEAD + 1 ? RU.NET_AHEAD : 0; b.tx = best.x - dx / dd * off; b.tz = best.z - dz / dd * off; if (dd < RU.NET_AHEAD + 1.5) { b.tx = best.x + dx / dd * 4; b.tz = best.z + dz / dd * 4; } }
  }
  const nx = b.x + Math.cos(b.h) * RU.NET_AHEAD, nz = b.z + Math.sin(b.h) * RU.NET_AHEAD;
  let n = 0; for (const f of fish) if ((f.adult || takesYoung(b)) && Math.hypot(f.x - nx, f.z - nz) < netR(b)) n++;
  if (k?.on && Math.hypot(k.x - nx, k.z - nz) < netR(b) + 1) n += 5;
  if (n >= (keeper ? 3 : 2)) rCast(b);
}
function rushUpdate(dt) {
  if (G.phase !== "play") return;
  const dir = wantDir(), me = R.boats[0];
  if (input.tapPoint && !dir) { me.tx = input.tapPoint.x; me.tz = input.tapPoint.z; if (!input.tapPoint.hold) { ripple(me.tx, me.tz, me.c.color, 2, .5); input.tapPoint = null; } }
  if ((dir || me.speed > 2) && R.coached) R.coached.sail = true;
  for (const b of R.boats) {
    b.castCd = Math.max(0, b.castCd - dt); b.dashCd = Math.max(0, b.dashCd - dt); b.dash = Math.max(0, b.dash - dt); b.shield = Math.max(0, b.shield - dt);
    if (!b.isMe || AUTO) rThink(b, dt);
    steerBoat(b, dt, speedOf(b), b.isMe && !AUTO ? dir : null); rTrawl(b, dt);
    if (b.dash > 0) for (const v of R.boats) {
      if (v === b || !v.hold.length || v.shield > 0 || Math.hypot(v.x - b.x, v.z - b.z) > 3.4 || nearDock(v.x, v.z)) continue;
      const n = Math.max(1, Math.min(v.hold.length, RU.RAM_SPILL + rHas(b, "ironBow") - rHas(v, "ironBow"))); rSpill(v, n); v.shield = RU.SHIELD; b.stats.rams++;
      ripple(v.x, v.z, "#cf3b2e", 5); Music.thud();
      if (v.isMe) { toast(t("rammed", { name: displayName(b), n }), "warn"); shake(.6); }
      if (b.isMe) { floatAt(v.x, v.z, t("ram", { name: displayName(v), n }), "#ff8a7a", true); shake(.35); }
    }
    for (let i = R.loose.length - 1; i >= 0; i--) { const l = R.loose[i]; if (b.hold.length < holdMax(b) && Math.hypot(l.x - b.x, l.z - b.z) < 2.4) { b.hold.push(l.val); scene.remove(l.m); R.loose.splice(i, 1); if (b.isMe) floatAt(b.x, b.z, t("scoop", { n: 1 }), "#ffd34d"); } }
    const d = b.dock;
    if (Math.hypot(d.wx - b.x, d.wz - b.z) < RU.UNLOAD_R && b.hold.length) { b.unloadT -= dt; if (b.unloadT <= 0) { b.unloadT = .1; const v = b.hold.pop(); b.banked += v; b.stats.home += v; flyFish(b.x, b.z, d.tower.position.x, d.tower.position.z, .5); growHouse(d, b.banked, b.c.color); if (b.isMe) { Music.coin(b.stats.home); if (!b.hold.length) { floatAt(b.x, b.z, t("home", { n: b.banked - (b.lastShown ?? b.seasonStart) }), b.c.color, true); b.lastShown = b.banked; } } } }
  }
  if (R.phase === "practice") { practiceUpdate(); return; }
  R.clock -= dt;
  const k = R.koi, el = RU.SEASON_S - R.clock;
  if (!k.on && k.idx < k.spawns.length && el > k.spawns[k.idx]) { k.idx++; k.on = true; k.since = el; const a = rand(0, 6.28); k.x = ISLAND.x + Math.cos(a) * 16; k.z = ISLAND.z + Math.sin(a) * 14; ripple(k.x, k.z, "#ffd34d", 8); toast(t("koi"), "good"); }
  if (k.on && el > k.since + 10) k.on = false;
  if (k.on) { const hk = R.boats.find(b => rHas(b, "goldHook")); k.h += dt * .9; if (hk) { const a = Math.atan2(hk.z - k.z, hk.x - k.x); k.x += Math.cos(a) * dt * 1.6; k.z += Math.sin(a) * dt * 1.6; } k.x += Math.cos(k.h) * dt * 4.5; k.z += Math.sin(k.h * 1.3) * dt * 3.4; if (nr(k.x, k.z) > .7 || iceBlocks(k.x, k.z)) { k.x *= .98; k.z *= .98; } if (Math.hypot(k.x - ISLAND.x, k.z - ISLAND.z) < ISLAND.r + 3) { const a = Math.atan2(k.z - ISLAND.z, k.x - ISLAND.x); k.x = ISLAND.x + Math.cos(a) * (ISLAND.r + 3); k.z = ISLAND.z + Math.sin(a) * (ISLAND.r + 3); } }
  koi.visible = !!k.on; koi.position.set(k.x, -.1 + Math.sin(G.t * 3) * .1, k.z); koi.rotation.y = -k.h;
  if (!R.rushed && R.clock <= RU.RUSH_S) { R.rushed = true; banner(t("rush"), t("rush_s")); Music.mood("rush"); if (me.hold.length) { coach(t("p3"), t("p3s")); pointAt(me.dock.wx, me.dock.wz); later(() => { coach(null); pointAt(null); }, 5000); } }
  if (R.coached) { R.coachT += dt; if (R.coachT > 2 && !R.coached.sail) coach(t(isTouch ? "p1" : "p1k")); else if (R.coachT > 2 && !R.coached.cast && R.coachT < 24) coach(t(isTouch ? "p2" : "p2k")); else if (R.coachT < 30 && R.coached.cast) { coach(null); R.coached = null; } else if (R.coachT >= 30) { coach(null); R.coached = null; } }
  if (R.clock <= 0) rEndSeason();
}
function rEndSeason() {
  G.phase = "gong"; R.phase = "gong"; Music.gong(); koi.visible = false; coach(null); pointAt(null);
  let mine = 0; for (const b of R.boats) { b.stats.spoiled += b.hold.length; if (b.isMe) mine = b.hold.length; b.hold = []; }
  R.loose.splice(0).forEach(l => scene.remove(l.m));
  banner(t("gong"), mine ? t("gong_s", { n: mine }) : "");
  const [a, y] = counts(); R.history.push({ start: R.startCounts, end: [a, y], caught: R.seasonCaught, young: R.seasonYoung });
  later(() => R.season >= RU.SEASONS ? rFinale() : rRest(), 2200);
}
function rRest() {
  G.phase = "spring"; R.phase = "rest"; Music.mood("spring"); cam.mode = "overview";
  const [a, y] = counts(); const ladders = R.boats.reduce((s, b) => s + rHas(b, "ladder"), 0), reedsN = R.boats.reduce((s, b) => s + rHas(b, "reeds"), 0);
  const r = breed(a, y, .15 * ladders); const born = r.born + reedsN * 10;
  for (const f of fish) f.adult = true;
  const reedOwners = R.boats.filter(b => rHas(b, "reeds"));
  for (let i = 0; i < born; i++) { const ro = reedOwners[i % Math.max(1, reedOwners.length)]; if (ro && i < reedsN * 10) addFish(false, ro.dock.wx + rand(-4, 4) + Math.cos(ro.dock.inward) * 8, ro.dock.wz + rand(-4, 4) + Math.sin(ro.dock.inward) * 8); else addFish(false); }
  if (ladders) R.boats.forEach(b => { if (rHas(b, "ladder")) { const gift = Math.floor(born / 8) * rHas(b, "ladder"); b.banked += gift; b.stats.home += gift; } });
  banner(t("rest"), a < LAKE.ALLEE ? t("rest_bad") : t("rest_s", { grew: y, born }));
  later(rMarket, RU.REST_S * 1000);
}
/* the market */
function rOffer() {
  const ids = Object.keys(RCARDS), by = (k) => ids.filter(i => RCARDS[i].kind === k);
  const out = new Set([pick(by("greedy")), pick(by("steward"))]); while (out.size < 3) out.add(pick(by("plain")));
  return shuffle([...out]);
}
function rBotPick(b, cards) { const w = (id) => ({ greedy: { greedy: 5, plain: 2, steward: .3 }, keeper: { greedy: .2, plain: 1.5, steward: 4 }, steady: { greedy: 1, plain: 3, steward: 1.2 } })[b.ai.kind][RCARDS[id].kind] * (1 + Math.random()); return cards.slice().sort((p, q) => w(q) - w(p))[0]; }
function rMarket() {
  G.phase = "market"; R.phase = "market"; Music.mood("market"); hideHud();
  R.offer = rOffer(); R.marketT = RU.MARKET_S; R.botPicks = R.boats.slice(1).map(b => rBotPick(b, rOffer()));
  renderRMarket();
  if (AUTO && !Q.has("hold")) later(() => rChoose(Math.random() < .3 ? null : pick(R.offer)), 400);
}
function renderRMarket() {
  const me = R.boats[0];
  screen(`<div class="sheet"><div class="mhead"><div><h2>${t("market")}</h2><p class="lede" style="margin-top:6px">${t("market_s", { season: seasonName(R.season) })}</p></div><div class="mtimer" id="rMt">${Math.ceil(R.marketT)}</div></div>
    <div class="offer">${R.offer.map(id => { const c = RCARDS[id]; return `<button class="card ${c.kind}" type="button" data-card="${id}"><span class="glyph">${c.glyph}</span><div><span class="kind">${t("k_" + c.kind)}</span><br><b>${c[LANG][0]}</b><p>${c[LANG][1]}</p></div></button>`; }).join("")}</div>
    <div class="row"><button class="btn ghost" type="button" id="rReroll" ${me.banked < RU.REROLL ? "disabled" : ""}>${t("reroll", { n: RU.REROLL })}</button><button class="btn ghost" type="button" id="rSkip">${t("skip")}</button></div></div>`);
  screenEl.querySelectorAll("[data-card]").forEach(btn => btn.onclick = () => rChoose(btn.dataset.card));
  $("#rReroll").onclick = () => { if (me.banked < RU.REROLL) return; me.banked -= RU.REROLL; me.stats.home -= RU.REROLL; R.offer = rOffer(); renderRMarket(); };
  $("#rSkip").onclick = () => rChoose(null);
}
function rChoose(id) {
  if (R.phase !== "market") return;
  R.phase = "picked"; Music.chime();
  const me = R.boats[0]; if (id) me.cards.push(id); R.boats.slice(1).forEach((b, i) => b.cards.push(R.botPicks[i]));
  const all = R.boats.map((b, i) => ({ b, id: i === 0 ? id : R.botPicks[i - 1] }));
  screen(`<div class="sheet narrow"><h2>${t("picks_h")}</h2><div class="picks">${all.map(({ b, id }) => id ? `<span class="pick ${RCARDS[id].kind}"><span class="pf">${portrait(b.c.id, crewName(b.c))}</span>${t("picked", { name: displayName(b), card: rCard(id) })}</span>` : `<span class="pick"><span class="pf">${portrait(b.c.id, crewName(b.c))}</span>${displayName(b)} · —</span>`).join("")}</div></div>`);
  later(() => { hideScreen(); rushHud(); cam.mode = "follow"; rNextSeason(); }, 2600);
}
/* the end of the year */
function rForecast() { const [a, y] = counts(); const ladders = R.boats.reduce((s, b) => s + rHas(b, "ladder"), 0), reedsN = R.boats.reduce((s, b) => s + rHas(b, "reeds"), 0); return forecastOf(a, y, .15 * ladders, reedsN * 10); }
function rCounterfactual() {
  let a = R.history[0].start[0], y = R.history[0].start[1];
  R.history.forEach((h) => { const tookA = (h.caught - h.young) * .8, tookY = h.young * .8; const natural = Math.max(0, (h.start[0] - h.end[0]) - (h.caught - h.young)); a = Math.max(0, a - tookA - natural); y = Math.max(0, y - tookY); const r = breed(Math.round(a), Math.round(y)); a = r.adults; y = r.born; });
  return Math.round(a + y * .6);
}
function rTitles() {
  const by = (f) => R.boats.slice().sort((p, q) => f(q) - f(p))[0], out = [];
  const king = by(b => b.stats.home); out.push(["t_king", t("t_king_s", { name: displayName(king), n: king.stats.home })]);
  const keep = by(b => b.stats.youngSpared); if (keep.stats.youngSpared) out.push(["t_keeper", t("t_keeper_s", { name: displayName(keep), n: keep.stats.youngSpared })]);
  const mesh = by(b => b.stats.youngKilled); if (mesh.stats.youngKilled) out.push(["t_mesh", t("t_mesh_s", { name: displayName(mesh), n: mesh.stats.youngKilled })]);
  const ram = by(b => b.stats.rams); if (ram.stats.rams) out.push(["t_ram", t("t_ram_s", { name: displayName(ram), n: ram.stats.rams })]);
  const k = by(b => b.stats.koi); if (k.stats.koi) out.push(["t_koi", t("t_koi_s", { name: displayName(k) })]);
  return out.slice(0, 4);
}
function rFinale() {
  const next = rForecast(), [a, y] = counts(), tier = tierOf(next);
  const fair = Math.max(1, Math.round((K * .5 * LAKE.R * .5) / R.boats.length * RU.SEASONS * .55));
  R.final = { next, a, y };
  ceremony({
    mode: "rush", a, y, next, alt: rCounterfactual(), fair,
    ledger: R.boats.map(b => ({ c: b.c, isMe: b.isMe, home: b.stats.home, young: b.stats.youngKilled, spared: b.stats.youngSpared })),
    titles: rTitles(),
    rows: R.boats.map(b => { const spared = rHas(b, "release") && tier.mult >= 1 ? Math.floor(b.stats.youngSpared / 2) : 0; return { c: b.c, isMe: b.isMe, base: b.banked + spared, score: Math.round((b.banked + spared) * tier.mult) }; }),
    again: () => rushRun(true),
  });
}
function rushDraw(dt, tt) {
  const tag = (b) => `${displayName(b)} · ${b.hold.length}/${holdMax(b)}${takesYoung(b) ? ` <span class="red">●</span>` : ""}`;
  drawBoats(R.boats, tt, tag);
  R.loose.forEach((l, i) => { l.m.position.y = .15 + Math.sin(tt * 4 + i) * .08; l.m.rotation.y += dt * 2; });
  if (G.phase === "play" || G.phase === "gong") {
    const me = R.boats[0]; if (!me) return; const s = Math.max(0, Math.ceil(R.clock));
    const ck = $("#rClock"); if (ck && R.phase !== "practice") { ck.textContent = `0:${String(s).padStart(2, "0")}`; ck.style.color = R.clock <= RU.RUSH_S ? "#ff8a7a" : ""; }
    const bk = $("#rBanked"); if (bk) bk.textContent = me.banked;
    if ((tt * 4 | 0) !== R.lastHud) { R.lastHud = tt * 4 | 0; const fc = rForecast(), tier = tierOf(fc), [a] = counts();
      const nw = $("#rNow"), nx = $("#rNext"), tc = $("#rTier"), hd = $("#rHold");
      if (nw) nw.style.width = `${Math.min(100, a / K * 100)}%`; if (nx) { nx.style.width = `${Math.min(100, fc / K * 100)}%`; nx.style.background = tierCol[tier.id]; }
      if (tc) { tc.className = `tier t-${tier.id}`; tc.textContent = `${t("v_" + tier.id)} ×${tier.mult}`; }
      if (hd) { const max = holdMax(me); hd.innerHTML = Array.from({ length: max }, (_, i) => `<span class="${i < me.hold.length ? (me.hold[i] > 2 ? "on koi" : "on") : ""}"></span>`).join(""); }
    }
    const cc = $("#rCast .cd"), dc = $("#rDash .cd"); if (cc) cc.style.setProperty("--p", `${(me.castCd / castCdOf(me)) * 100}%`); if (dc) dc.style.setProperty("--p", `${(me.dashCd / RU.DASH_CD) * 100}%`);
  }
}
function rushMinimap(ctx) {
  const cnt = new Array(schools.length).fill(0); for (const f of fish) if (f.adult) cnt[f.s]++;
  schools.forEach((s, i) => { if (cnt[i] > 2) dot(ctx, s.x, s.z, 2 + Math.sqrt(cnt[i]) * .9, "rgba(255,154,74,.75)"); });
  R.boats.forEach(b => { dot(ctx, b.dock.wx, b.dock.wz, 4, "#efe1c2", b.c.color); });
  if (R.koi?.on) dot(ctx, R.koi.x, R.koi.z, 6, "#ffd34d");
  R.boats.forEach(b => dot(ctx, b.x, b.z, b.isMe ? 7 : 5, b.c.color, b.isMe ? "#fff" : "#120e18"));
}
MODES.rush = {
  start() { setSeason(0, true); seedLake(G.lake.adults, G.lake.fry); rushBoats(4); R.boats.forEach(atDock); rushRules(); },
  update: rushUpdate, draw: rushDraw, minimap: rushMinimap,
  end() { removeBoats(R.boats); R.boats = []; R.loose.splice(0).forEach(l => scene.remove(l.m)); koi.visible = false; if (R.practice?.ring) scene.remove(R.practice.ring); R.practice = null; resetHouses(); },
  relabel() { if (R.phase === "market") renderRMarket(); else if (G.phase === "play") { rushHud(); } },
  lanterns() { return []; },
  key(code) { if (G.phase !== "play") return; const me = R.boats[0]; if (code === "Space") rCast(me); if (code === "ShiftLeft" || code === "ShiftRight") rDash(me); },
};
