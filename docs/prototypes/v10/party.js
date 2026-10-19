/* ================================================================ FISHING PARTY 钓鱼派对: five little games, one lake, a last net for everyone */
const YP = { ROUND_S: 28, INTRO_S: 20, SHOP_S: 9, COST: 3, SPEED: 14 };
const YGAMES = ["scramble", "koi", "tug", "night", "last"];
addWords({
  en: {
    py1t: "Five little games", py1p: "Each round is a different game, about 30 seconds. A card shows you what to do first; you can try it before it counts.",
    py2t: "Coins, and a shop", py2p: "Win coins in each round. Between rounds, spend 3 coins on a bigger net, a faster boat or bait.",
    py3t: "The last net", py3p: "Rounds 1, 2 and 4 take fish from the lake. In the last round everyone nets the same school, secretly. Too greedy, and the net tears for everyone.",
    py_choice: "Grab coins now, or leave fish for the last net? Coins win, times next year's lake.",
    round_n: "Round {n} of 5", ready: "I'm ready", try_it: "Try it first", practising: "practice: nothing counts yet", ready_s: "Try it now: nothing counts yet. Starts when everyone is ready.", go321: "Go!",
    yg_scramble: "Shoal Scramble", yv_scramble: "Tap!", yd_scramble: "Fish jump out of the water for a moment. Tap the splash first to take the school: 2 coins.",
    yg_koi: "Koi Chase", yv_koi: "Chase!", yd_koi: "Sail through the lantern gates in order: 1 coin each. Touch the golden carp: 5 coins.",
    yg_tug: "Tug of Line", yv_tug: "Reel!", yd_tug: "A big fish is on your line. Press REEL when the needle is in the green. Outside it, the fish pulls back.",
    yg_night: "Lantern Night", yv_night: "Light!", yd_night: "It is dark. You only see fish near your lantern. Net them: 1 coin each. Drop a lantern to light a spot for everyone.",
    yg_last: "The Last Net", yv_last: "Choose!", yd_last: "Everyone nets the same school, secretly: small (3), medium (6) or huge (10). If the total fits the school, each gets double. If not, the net tears: everyone gets 1.",
    c_scramble_t: "tap the splash", c_koi_t: "drag on the left to steer", c_koi_k: "W A S D or arrows", c_tug_t: "tap REEL", c_tug_k: "Space", c_night_t: "drag to sail · NET · LANTERN", c_night_k: "W A S D · Space net · L lantern", c_last_t: "tap one",
    coins_h: "Coins", lake_left: "Fish left in the lake: {n}", round_res: "Round {n}: {game}",
    shop_h: "The shop", shop_s: "3 coins each. It helps in the next round only.", buy: "Buy", bought: "Bought", skip_shop: "Done",
    sh_net: "Big Net", sh_net_s: "Your net is half as wide again.", sh_fast: "Fast Boat", sh_fast_s: "Sail 25% faster.", sh_bait: "Bait", sh_bait_s: "Fish nearby swim to you for the first 8 seconds.",
    reel: "REEL", y_net: "NET", y_lantern: "LANTERN", gate: "Gate +1", koi_got: "Golden carp! +5",
    last_school: "This school: {n} fish", last_fished: "You fished hard early; this is what is left.", last_pick: "Pick your net, in secret", last_wait: "Waiting for everyone…",
    last_fit: "The net holds! Everyone gets double.", last_tear: "Too greedy. The net tears: everyone gets 1.", last_total: "Total: {n} / {cap}",
    pts: "+{n}", standings: "Standings after round {n}",
  },
  zh: {
    py1t: "五个小游戏", py1p: "每一回合是不同的游戏，大约 30 秒。先有一张卡告诉你怎么玩，正式开始前可以先试试。",
    py2t: "铜钱和小卖部", py2p: "每回合赢铜钱。两回合之间，花 3 枚铜钱买大网、快船或鱼饵。",
    py3t: "最后一网", py3p: "第 1、2、4 回合会从湖里拿鱼。最后一回合大家偷偷地捞同一群鱼。太贪的话，网会破，谁都捞不到。",
    py_choice: "现在抢铜钱，还是把鱼留给最后一网？铜钱多的人赢，再乘上明年湖的年景。",
    round_n: "第 {n} 回合 / 共 5 回合", ready: "我准备好了", try_it: "先试一试", practising: "练习中：还不算分", ready_s: "现在可以先试试：还不算分。大家都准备好就开始。", go321: "开始！",
    yg_scramble: "抢鱼群", yv_scramble: "点！", yd_scramble: "鱼会突然跳出水面一下。谁先点到水花，这群鱼就是谁的：2 枚铜钱。",
    yg_koi: "追锦鲤", yv_koi: "追！", yd_koi: "按顺序穿过灯笼门：每个 1 枚铜钱。碰到金色锦鲤：5 枚。",
    yg_tug: "拔河钓大鱼", yv_tug: "收！", yd_tug: "大鱼上钩了。指针在绿色区域里时按「收线」。在外面按，鱼会往回拉。",
    yg_night: "灯笼夜钓", yv_night: "照！", yd_night: "天黑了，你只看得见自己灯笼旁边的鱼。网到一条 1 枚铜钱。放一盏灯笼，可以给大家照亮一片。",
    yg_last: "最后一网", yv_last: "选！", yd_last: "大家偷偷地捞同一群鱼：小网 3、中网 6、大网 10。加起来没超过这群鱼，每人得双倍；超过了，网就破了：每人只得 1。",
    c_scramble_t: "点水花", c_koi_t: "在左边按住拖动转向", c_koi_k: "W A S D 或方向键", c_tug_t: "点「收线」", c_tug_k: "空格", c_night_t: "拖动开船 · 撒网 · 灯笼", c_night_k: "W A S D · 空格撒网 · L 放灯笼", c_last_t: "点一个",
    coins_h: "铜钱", lake_left: "湖里还剩 {n} 条鱼", round_res: "第 {n} 回合：{game}",
    shop_h: "小卖部", shop_s: "每样 3 枚铜钱，只在下一回合有用。", buy: "买", bought: "已买", skip_shop: "好了",
    sh_net: "大网", sh_net_s: "网大一半。", sh_fast: "快船", sh_fast_s: "船速快 25%。", sh_bait: "鱼饵", sh_bait_s: "开局 8 秒内，附近的鱼会游向你。",
    reel: "收线", y_net: "撒网", y_lantern: "灯笼", gate: "过门 +1", koi_got: "金色锦鲤！+5",
    last_school: "这一群鱼：{n} 条", last_fished: "前面捞得太狠，就只剩这么多了。", last_pick: "偷偷选你的网", last_wait: "等大家选……",
    last_fit: "网撑住了！每人得双倍。", last_tear: "太贪了。网破了：每人只得 1。", last_total: "加起来：{n} / {cap}",
    pts: "+{n}", standings: "第 {n} 回合后的排名",
  },
});
const Y = { boats: [], round: 0, phase: "", clock: 0, shop: {}, ready: new Set(), lakeStart: 0 };
const yName = (b) => b.isMe ? t("you") : t("bot", { name: crewName(b.c) });
function partyRules() {
  rulesCard({
    id: "party",
    steps: [
      [t("py1t"), t("py1p"), GAME_ART.party()],
      [t("py2t"), t("py2p"), `<rect width="320" height="200" fill="#1d1726"/>${[["🕸", 60], ["💨", 160], ["🪱", 260]].map(([g, x]) => `<rect x="${x - 40}" y="40" width="80" height="110" rx="12" fill="#241d2e" stroke="#e8b84d" stroke-width="3"/>${SV.text(x, 104, g, "#fff", 34)}${SV.text(x, 140, "3", "#e8b84d", 16)}`).join("")}`],
      [t("py3t"), t("py3p"), SV.water() + SV.school(160, 100, 12) + ["#d6473a", "#4a7d9c", "#e0a93a", "#2f9a8a"].map((c, i) => SV.boat(60 + i * 70, 170, c, -90, .8)).join("") + SV.text(160, 40, "3 · 6 · 10", "#e8b84d", 24)],
    ],
    choice: t("py_choice"), controls: null,
    onStart: () => partyRun(),
  });
}
function partyRun() {
  hideScreen(); setSeason(1, true); fishOpts.seasonal = true; seedLake(G.lake.adults, G.lake.fry); Y.lakeStart = fish.length; Y.lakeIn = { ...G.lake };
  removeBoats(Y.boats);
  const ids = [G.me, ...CREW.map(c => c.id).filter(id => id !== G.me).slice(0, 3)];
  Y.boats = ids.map((id, i) => { const b = makeCrewBoat(CREW.find(x => x.id === id), i, i === 0); Object.assign(b, { coins: 0, round: 0, buys: {}, next: {}, gate: 0, reel: 0, stun: 0, castCd: 0, lanT: 0, ai: { cd: 0, kind: b.c.bot, react: 0 }, took: 0 }); return b; });
  Y.boats.forEach(atDock); Y.round = 0; nextRound();
}
function yHud(extra = "") {
  const g = YGAMES[Y.round - 1];
  hud({
    top: `<div class="pill"><span class="season-chip">${Y.round}</span><div><small>${t("yg_" + g)}</small><b id="yClock">0:28</b></div></div>
      <div class="pill lakebox"><div class="lakehead"><small>${t("lake")}</small><span class="tier" id="yTier"></span></div><div class="lakebar"><i class="now" id="yNow"></i><i id="yNext"></i>${TIERS.slice(0, 3).map(([m]) => `<i class="mark" style="left:${m * 100}%"></i>`).join("")}</div></div>`,
    side: `<div class="card0"><h4>${t("coins_h")}</h4><div class="board" id="yBoard"></div></div>${extra}`,
    pads: g === "tug" ? [{ id: "yReel", label: t("reel"), key: t("space_k"), on: () => yReel(Y.boats[0]) }] : g === "night" ? [{ id: "yLan", label: t("y_lantern"), cls: "gold", key: "L", on: () => yLantern(Y.boats[0]) }, { id: "yNet", label: t("y_net"), key: t("space_k"), on: () => yNet(Y.boats[0]) }] : null,
    keys: g === "koi" ? t("c_koi_k") : g === "night" ? t("c_night_k") : null, mini: g === "koi" || g === "night",
  });
  yBoard();
}
function yBoard() { const el = $("#yBoard"); if (!el) return; el.innerHTML = Y.boats.slice().sort((a, b) => b.coins - a.coins).map(b => `<div><span><span class="sw" style="background:${b.c.color}"></span>${yName(b)}</span><b>${b.coins}${b.round ? ` <small style="color:var(--leaf)">+${b.round}</small>` : ""}</b></div>`).join(""); }
function yGive(b, n, x, z) { b.coins += n; b.round += n; if (x !== undefined) floatAt(x, z, t("pts", { n }), b.c.color, n >= 4); if (b.isMe) Music.coin(b.coins); yBoard(); }
function takeFish(n, x, z) { let k = 0; for (let i = 0; i < n && fish.length; i++) { let j = 0, bd = 1e9; if (x !== undefined) fish.forEach((f, ii) => { const d = Math.hypot(f.x - x, f.z - z); if (f.adult && d < bd) { bd = d; j = ii; } }); fish.splice(j, 1); k++; } return k; }

/* ---------------------------------------------------------------- each round: card, practice, 3-2-1, play, result, shop */
const YART = {
  scramble: () => SV.water() + [[80, 70], [230, 120], [150, 150]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${18 + i * 4}" fill="none" stroke="#e8b84d" stroke-width="4"/>${SV.school(x, y, 5)}`).join("") + `<path d="M228 110 l14 22 l-8 2 l6 14 l-5 2 l-6 -14 l-7 5z" fill="#fff" stroke="#120e18" stroke-width="2"/>`,
  koi: () => SV.water() + [60, 130, 200, 270].map((x, i) => SV.lantern(x, 60 + (i % 2) * 70, .8)).join("") + SV.fish(230, 100, "#ffd34d", 2.4) + SV.boat(110, 120, "#d6473a", -15),
  tug: () => `<rect width="320" height="200" fill="#1d6b72"/><rect x="30" y="140" width="260" height="26" rx="10" fill="#120e18"/><rect x="150" y="140" width="60" height="26" fill="#7ccf8e"/><rect x="176" y="134" width="6" height="38" fill="#fff"/>` + SV.fish(160, 70, "#ffb04a", 3.4, -20) + `<path d="M40 20 Q120 60 150 66" stroke="#f5ead6" stroke-width="2" fill="none"/>`,
  night: () => `<rect width="320" height="200" fill="#0d1226"/><circle cx="140" cy="110" r="60" fill="#ffd68a" opacity=".16"/>` + SV.school(150, 104, 6) + SV.boat(120, 120, "#d6473a", -10) + SV.lantern(250, 60, .9),
  last: () => SV.water() + SV.school(160, 80, 14) + [["3", 70], ["6", 160], ["10", 250]].map(([n, x]) => `<rect x="${x - 34}" y="130" width="68" height="52" rx="10" fill="#241d2e" stroke="#e8b84d" stroke-width="3"/>${SV.text(x, 166, n, "#f5ead6", 26)}`).join(""),
};
function nextRound() {
  Y.round++; const g = YGAMES[Y.round - 1]; Y.game = g; Y.phase = "intro"; G.phase = "play"; Y.ready = new Set(); Y.introT = YP.INTRO_S;
  Y.boats.forEach(b => { b.round = 0; atDock(b); b.gate = 0; b.reel = 0; b.stun = 0; b.castCd = 0; });
  setupRound(g, true);
  if (g === "last") return lastNet();
  yHud(); Music.mood(g === "night" ? "night" : "party");
  const ctrl = isTouch ? t("c_" + g + "_t") : (W[LANG]["c_" + g + "_k"] ? t("c_" + g + "_k") : t("c_" + g + "_t"));
  const card = () => `<div class="sheet narrow intro"><span class="num">${t("round_n", { n: Y.round })}</span><div class="verb">${t("yv_" + g)}</div><h2>${t("yg_" + g)}</h2><div class="ill">${SV.svg(YART[g]())}</div><p class="lede">${t("yd_" + g)}</p><p class="note">${t("controls_l")}: ${ctrl}</p>
    <div class="readyrow" id="yReady">${Y.boats.map(b => `<span class="pf" data-r="${b.i}">${portrait(b.c.id, crewName(b.c))}</span>`).join("")}</div>
    <div class="row" style="justify-content:center"><button class="btn ghost" type="button" id="yTry">${t("try_it")}</button><button class="btn primary" type="button" id="yGo">${t("ready")}</button></div></div>`;
  const bar = () => `<div class="sheet narrow"><div class="row spread"><div><b>${t("yg_" + g)}</b> · <span class="note">${t("practising")}</span></div><div class="readyrow" id="yReady">${Y.boats.map(b => `<span class="pf" data-r="${b.i}">${portrait(b.c.id, crewName(b.c))}</span>`).join("")}</div><button class="btn primary small" type="button" id="yGo">${t("ready")}</button></div></div>`;
  const bind = () => { $("#yGo").onclick = () => { Y.ready.add(0); paintReady(); }; $("#yTry") && ($("#yTry").onclick = () => { screen(bar(), "practice"); bind(); paintReady(); }); };
  screen(card(), "clear"); bind();
  Y.boats.slice(1).forEach(b => later(() => { Y.ready.add(b.i); paintReady(); }, 2500 + Math.random() * 4000));
  if (AUTO) later(() => { Y.ready.add(0); paintReady(); }, 500);
}
function paintReady() { Y.boats.forEach(b => { const el = document.querySelector(`[data-r="${b.i}"]`); el?.classList.toggle("on", Y.ready.has(b.i)); }); if (Y.ready.size === Y.boats.length && Y.phase === "intro") countIn(); }
function countIn() { Y.phase = "count"; hideScreen(); coach(null); setupRound(Y.game, false); let n = 3; const tick = () => { if (n > 0) { banner(String(n)); Music.tick(); n--; later(tick, 800); } else { banner(t("go321")); Music.chime(); Y.phase = "play"; Y.clock = YP.ROUND_S; } }; tick(); }
function setupRound(g, practice) {
  const me = Y.boats[0];
  input.steerMode = g === "koi" || g === "night"; input.onTap = g === "scramble" ? scrambleTap : null;
  nightTarget = g === "night" ? .92 : 0; fishOpts.view = null; koi.visible = false;
  Y.gates?.forEach(m => scene.remove(m)); Y.gates = null; Y.lans?.forEach(l => scene.remove(l.m)); Y.lans = [];
  Y.spots?.forEach(sp => scene.remove(sp.ring)); Y.spots = []; Y.spotT = .8;
  if (g === "scramble") { cam.mode = "fixed"; cam.fx = -10; cam.fz = 0; cam.span = stage.clientWidth < 700 ? 110 : 150; cam.pitch = 1.05; }
  else if (g === "tug") { cam.mode = "fixed"; cam.fx = me.x; cam.fz = me.z - 14; cam.span = 60; cam.pitch = .8; Y.tug = { needle: 0, dir: 1, zone: .45, zw: .2, zv: .18 }; }
  else { cam.mode = "follow"; cam.target = me; cam.x = me.x; cam.z = me.z; cam.span = viewSpan() * (g === "night" ? .8 : 1); }
  if (g === "koi") { const pts = [0, 1, 2, 3, 4, 5, 6, 7].map(k => polar(70 + k * 45, k % 2 ? .62 : .78)); Y.path = pts; Y.gates = pts.map(([x, z]) => { const m = makeLantern(1.4); m.position.set(x, 2.4, z); scene.add(m); return m; }); Y.koi = { k: 1, x: pts[0][0], z: pts[0][1] }; koi.visible = true; }
  if (g === "night") { fishOpts.view = { x: me.x, z: me.z, r: 16 }; }
  for (const b of Y.boats) { b.next = practice ? {} : { ...b.buys }; if (!practice) b.buys = {}; }
}
function yUpdate(dt) {
  const g = Y.game; if (!g || (Y.phase !== "play" && Y.phase !== "intro" && Y.phase !== "count")) return;
  if (Y.phase === "intro") { Y.introT -= dt; if (Y.introT <= 0 && !Y.ready.has(0)) { Y.ready.add(0); paintReady(); } }
  const scoring = Y.phase === "play";
  if (scoring) { Y.clock -= dt; if (Y.clock <= 0) return endRound(); }
  const me = Y.boats[0], dir = wantDir();
  if (g === "koi" || g === "night") {
    if (input.tapPoint && !dir) { me.tx = input.tapPoint.x; me.tz = input.tapPoint.z; if (!input.tapPoint.hold) input.tapPoint = null; }
    for (const b of Y.boats) { if (!b.isMe || AUTO) yThink(b, dt, g); b.castCd = Math.max(0, b.castCd - dt); b.lanT = Math.max(0, b.lanT - dt); steerBoat(b, dt, YP.SPEED * (b.next.fast ? 1.25 : 1), b.isMe && !AUTO ? dir : null); }
    if (Y.phase === "play" && Y.clock > YP.ROUND_S - 8) for (const b of Y.boats) if (b.next.bait) fishOpts.lure = { x: b.x, z: b.z, r: 30, until: G.t + .2 };
  }
  if (g === "koi") {
    const k = Y.koi, tgt = Y.path[k.k % Y.path.length]; const a = Math.atan2(tgt[1] - k.z, tgt[0] - k.x); k.x += Math.cos(a) * dt * 9; k.z += Math.sin(a) * dt * 9; if (Math.hypot(tgt[0] - k.x, tgt[1] - k.z) < 2) k.k++;
    koi.position.set(k.x, -.1, k.z); koi.rotation.y = -a; koi.visible = true;
    for (const b of Y.boats) {
      const gt = Y.path[b.gate % Y.path.length]; if (Math.hypot(gt[0] - b.x, gt[1] - b.z) < 7) { b.gate++; if (scoring) { yGive(b, 1, gt[0], gt[1]); takeFish(1); } else if (b.isMe) floatAt(gt[0], gt[1], t("gate"), "#e8b84d"); }
      if (scoring && Math.hypot(k.x - b.x, k.z - b.z) < 4) { yGive(b, 5, k.x, k.z); if (b.isMe) toast(t("koi_got"), "good"); Music.chime(); takeFish(2); k.k += 2; const p = Y.path[(k.k - 1) % Y.path.length]; k.x = p[0]; k.z = p[1]; ripple(k.x, k.z, "#ffd34d", 7); }
    }
    Y.gates.forEach((m, i) => { m.scale.setScalar(i === me.gate % Y.path.length ? 1.3 + Math.sin(G.t * 6) * .2 : .9); });
    pointAt(...Y.path[me.gate % Y.path.length]);
  }
  if (g === "night") { fishOpts.view = { x: me.x, z: me.z, r: 16 + (me.next.net ? 2 : 0) }; }
  if (g === "scramble") {
    Y.spotT -= dt; if (Y.spotT <= 0) { Y.spotT = rand(.9, 1.5); const [x, z] = [rand(-60, 40), rand(-32, 30)]; if (nr(x, z) < .85 && Math.hypot(x - ISLAND.x, z - ISLAND.z) > 12) { const ring = makeRing("#e8b84d", 6); ring.position.set(x, 0, z); ring.userData.ring.material.opacity = .35; Y.spots.push({ x, z, t: 0, open: false, taken: null, ring }); ripple(x, z, "#e8b84d", 6, .9); } }
    for (const s of Y.spots) { s.t += dt; if (!s.open && s.t > .8) { s.open = true; s.until = s.t + 1.5; Music.splash(); for (let k = 0; k < 6; k++) floatAt(s.x + rand(-2, 2), s.z + rand(-2, 2), "🐟", "#ffb04a"); Y.boats.slice(1).forEach(b => { b.ai.react = b.ai.react || 0; s["r" + b.i] = s.t + rand(.32, b.ai.kind === "greedy" ? .7 : 1.1) + (b.ai.kind === "keeper" ? .25 : 0); }); }
      if (s.open && !s.taken) for (const b of Y.boats.slice(1)) if (s["r" + b.i] && s.t >= s["r" + b.i] && Math.random() < .55) { claimSpot(s, b); break; }
      if (AUTO && s.open && !s.taken && s.t > s.until - 1.2 && Math.random() < .3) claimSpot(s, me); }
    for (const s of Y.spots) { if (s.open && !s.taken) { const k = .5 + Math.sin(s.t * 14) * .5; s.ring.userData.ring.material.opacity = .7 + k * .3; s.ring.userData.fill.material.opacity = .25 + k * .2; s.ring.scale.setScalar(1 + k * .08); } }
    Y.spots = Y.spots.filter(s => { const keep = (s.t < (s.until ?? 3) || !s.open) && !(s.taken && s.t > s.takenAt + .6); if (!keep) scene.remove(s.ring); return keep; });
  }
  if (g === "tug") {
    const T = Y.tug; T.needle += T.dir * dt * 1.25; if (T.needle > 1) { T.needle = 1; T.dir = -1; } if (T.needle < 0) { T.needle = 0; T.dir = 1; }
    T.zone += T.zv * dt; if (T.zone > .8 - T.zw / 2 || T.zone < .2 + T.zw / 2) T.zv *= -1;
    for (const b of Y.boats) { b.stun = Math.max(0, b.stun - dt); if ((!b.isMe || AUTO) && Math.random() < dt * (b.ai.kind === "greedy" ? 5 : 3.5)) { const inZ = Math.abs(T.needle - T.zone) < T.zw / 2; if (inZ || Math.random() < .12) yReel(b); } }
    const el = $("#yTug"); if (el) { el.querySelector(".zone").style.left = (T.zone - T.zw / 2) * 100 + "%"; el.querySelector(".zone").style.width = T.zw * 100 + "%"; el.querySelector(".needle").style.left = T.needle * 100 + "%"; Y.boats.forEach(b => { const i = el.querySelector(`[data-l="${b.i}"]`); if (i) i.style.width = Math.min(100, b.reel) + "%"; }); }
  }
}
function claimSpot(s, b) { if (s.taken) return; s.taken = b; s.takenAt = s.t; s.ring.userData.ring.material.color.set(b.c.color); s.ring.userData.fill.material.color.set(b.c.color); s.ring.userData.fill.material.opacity = .45; if (Y.phase === "play") { takeFish(2, s.x, s.z); yGive(b, 2, s.x, s.z); } else if (b.isMe) floatAt(s.x, s.z, "✓", b.c.color); ripple(s.x, s.z, b.c.color, 7); if (b.isMe) Music.catchNote(3); }
function scrambleTap(x, z) { const s = Y.spots.filter(s => s.open && !s.taken).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]; const r = Y.boats[0].next.net ? 11 : 8; if (s && Math.hypot(s.x - x, s.z - z) < r) claimSpot(s, Y.boats[0]); else ripple(x, z, "#b9b0c6", 2, .5); }
function yReel(b) {
  if (Y.game !== "tug" || b.stun > 0 || b.reel >= 100) return; const T = Y.tug; const inZ = Math.abs(T.needle - T.zone) < T.zw / 2 + (b.next.net ? .04 : 0);
  b.reel = Math.max(0, b.reel + (inZ ? 9 : -6)); if (!inZ) b.stun = .35;
  if (b.isMe) { inZ ? Music.catchNote(Math.floor(b.reel / 15)) : Music.thud(); if (!inZ) shake(.15); }
  if (b.reel >= 100 && Y.phase === "play") { const place = Y.boats.filter(o => o.reel >= 100 && o !== b).length; yGive(b, [6, 4, 2, 1][place], b.x, b.z); if (b.isMe) toast(t("pts", { n: [6, 4, 2, 1][place] }), "good"); }
  if (b.reel >= 100 && Y.phase !== "play") b.reel = 0;
}
function yNet(b) {
  if (Y.game !== "night" || b.castCd > 0) return; b.castCd = 1.6;
  const nx = b.x + Math.cos(b.h) * 4, nz = b.z + Math.sin(b.h) * 4, r = b.next.net ? 5 : 3.6; netDrop(nx, nz, b.c.color, r);
  let got = 0; for (let i = fish.length - 1; i >= 0 && got < 2; i--) { const f = fish[i]; if (f.adult && Math.hypot(f.x - nx, f.z - nz) < r) { if (Y.phase === "play") { fish.splice(i, 1); got++; } else { f.flee = .5; f.fa = rand(0, 6.28); got++; } } }
  if (got && Y.phase === "play") yGive(b, got, nx, nz); else if (b.isMe) floatAt(nx, nz, got ? "✓" : t("empty"), got ? b.c.color : "#b9b0c6");
  if (b.isMe) Music.splash();
}
function yLantern(b) { if (Y.game !== "night" || b.lanT > 0) return; b.lanT = 8; const m = makeLantern(1.2); m.position.set(b.x, 1.6, b.z); scene.add(m); Y.lans.push({ x: b.x, z: b.z, m, until: G.t + 10 }); if (b.isMe) Music.chime(); }
function yThink(b, dt, g) {
  b.ai.cd -= dt; if (b.ai.cd > 0) return; b.ai.cd = .3;
  if (g === "koi") { const gt = Y.path[b.gate % Y.path.length], k = Y.koi; const dk = Math.hypot(k.x - b.x, k.z - b.z); if (dk < 18 && b.ai.kind !== "keeper") { b.tx = k.x; b.tz = k.z; } else { b.tx = gt[0]; b.tz = gt[1]; } }
  if (g === "night") {
    const seeR = 16 + 6 * Y.lans.length; let best = null, bd = 1e9; for (const f of fish) { if (!f.adult) continue; const d = Math.hypot(f.x - b.x, f.z - b.z); const lit = Y.lans.some(l => Math.hypot(f.x - l.x, f.z - l.z) < 14); if ((d < seeR || lit) && d < bd) { bd = d; best = f; } }
    if (best) { b.tx = best.x - Math.cos(b.h) * 3; b.tz = best.z - Math.sin(b.h) * 3; if (bd < 6) yNet(b); } else { if (!b.ai.w || Math.hypot(b.ai.w[0] - b.x, b.ai.w[1] - b.z) < 5) b.ai.w = randomWater(.8); b.tx = b.ai.w[0]; b.tz = b.ai.w[1]; }
    if (b.ai.kind === "keeper" && b.lanT <= 0 && Math.random() < .06) yLantern(b);
  }
}
function endRound() {
  Y.phase = "result"; G.phase = "between"; pointAt(null); koi.visible = false; fishOpts.view = null; nightTarget = 0; Music.gong();
  Y.lans.forEach(l => scene.remove(l.m)); Y.lans = []; Y.gates?.forEach(m => scene.remove(m)); Y.gates = null; Y.spots?.forEach(sp => scene.remove(sp.ring)); Y.spots = []; coach(null); $("#yTug")?.remove();
  hideHud(); standings(() => Y.round < 4 ? shop() : nextRound());
}
function standings(then) {
  const max = Math.max(10, ...Y.boats.map(b => b.coins));
  screen(`<div class="sheet narrow"><h2>${t("round_res", { n: Y.round, game: t("yg_" + Y.game) })}</h2><p class="lede">${t("lake_left", { n: fish.length })}</p>
    <div class="coins">${Y.boats.slice().sort((a, b) => b.coins - a.coins).map(b => `<div class="crow"><span class="pf">${portrait(b.c.id, crewName(b.c))}</span><div class="bar"><i style="width:${(b.coins - b.round) / max * 100}%" data-w="${b.coins / max * 100}"></i></div><b>${b.coins}${b.round ? `<small style="color:var(--leaf);font-size:13px"> +${b.round}</small>` : ""}</b></div>`).join("")}</div></div>`);
  setTimeout(() => screenEl.querySelectorAll("[data-w]").forEach(i => i.style.width = i.dataset.w + "%"), 60);
  later(then, 3600);
}
function shop() {
  Y.phase = "shop"; Music.mood("market"); const me = Y.boats[0]; Y.shopT = YP.SHOP_S;
  const items = [["net", "🕸"], ["fast", "💨"], ["bait", "🪱"]];
  const render = () => screen(`<div class="sheet narrow"><div class="mhead"><div><h2>${t("shop_h")}</h2><p class="lede">${t("shop_s")}</p></div><div class="mtimer" id="yShopT">${Math.ceil(Y.shopT)}</div></div>
    <div class="shop">${items.map(([id, ic]) => `<button class="card plain" type="button" data-buy="${id}" ${me.buys[id] || me.coins < YP.COST ? "disabled" : ""}><span class="glyph">${ic}</span><div><b>${t("sh_" + id)}</b><p>${t("sh_" + id + "_s")}</p><span class="kind" style="color:var(--gold)">${me.buys[id] ? t("bought") : `${t("buy")} · 3`}</span></div></button>`).join("")}</div>
    <p class="note">${t("coins_h")}: ${me.coins}</p><div class="row"><button class="btn primary" type="button" id="yShopDone">${t("skip_shop")} →</button></div></div>`);
  render();
  screenEl.onclick = (e) => { const b = e.target.closest("[data-buy]"); if (b && !b.disabled) { me.buys[b.dataset.buy] = true; me.coins -= YP.COST; Music.coin(1); render(); } if (e.target.closest("#yShopDone")) closeShop(); };
  Y.boats.slice(1).forEach(b => { if (b.coins >= YP.COST && Math.random() < (b.ai.kind === "greedy" ? .7 : .35)) { const id = pick(["net", "fast", "bait"]); b.buys[id] = true; b.coins -= YP.COST; } });
  if (AUTO) later(closeShop, 500);
}
function closeShop() { if (Y.phase !== "shop") return; screenEl.onclick = null; nextRound(); }

/* ---------------------------------------------------------------- the last net */
function lastNet() {
  Y.phase = "last"; G.phase = "between"; hideHud(); Music.mood("tension"); cam.mode = "fixed"; cam.fx = 0; cam.fz = 0; cam.span = 120; cam.pitch = 1.1;
  const cap = Math.max(6, Math.round(fish.length / 7)); Y.cap = cap; Y.picks = new Map();
  const fished = fish.length < Y.lakeStart * .85;
  const render = (reveal = -1) => screen(`<div class="sheet narrow intro"><span class="num">${t("round_n", { n: 5 })}</span><div class="verb">${t("yv_last")}</div><h2>${t("yg_last")}</h2><p class="lede">${t("yd_last")}</p>
    <div class="choice"><b>${t("last_school", { n: cap })}</b>${fished ? ` ${t("last_fished")}` : ""}</div>
    ${reveal < 0 ? `<p class="note">${Y.picks.has(0) ? t("last_wait") : t("last_pick")}</p><div class="picks3">${[3, 6, 10].map(n => `<button class="pick3" type="button" data-n="${n}" aria-pressed="${Y.picks.get(0) === n}" ${Y.picks.has(0) ? "disabled" : ""}><span class="n">${n}</span><span class="note">${n === 3 ? "🕸" : n === 6 ? "🕸🕸" : "🕸🕸🕸"}</span></button>`).join("")}</div>`
      : `<div class="reveal">${Y.boats.map((b, i) => `<div class="rv"><span class="pf">${portrait(b.c.id, crewName(b.c))}</span><b style="font-size:13px">${yName(b)}</b><span class="n ${i > reveal ? "hide" : ""}">${i > reveal ? "?" : Y.picks.get(b.i)}</span></div>`).join("")}</div>
      <div class="sumbar"><i style="width:${Math.min(100, sumTo(reveal) / (cap * 1.6) * 100)}%"></i><span class="cap" style="left:${100 / 1.6}%"></span></div><p class="note">${t("last_total", { n: sumTo(reveal), cap })}</p><p class="typed" id="yVerdict"></p>`}</div>`);
  const sumTo = (k) => Y.boats.slice(0, k + 1).reduce((s, b) => s + (Y.picks.get(b.i) ?? 0), 0);
  render();
  screenEl.onclick = (e) => { const b = e.target.closest("[data-n]"); if (b && !Y.picks.has(0)) { Y.picks.set(0, +b.dataset.n); Music.tick(); render(); maybeReveal(); } };
  Y.boats.slice(1).forEach(b => later(() => { const k = b.ai.kind; const n = k === "greedy" ? (Math.random() < .75 ? 10 : 6) : k === "keeper" ? (Math.random() < .7 ? 3 : 6) : (cap > 24 ? 6 : Math.random() < .5 ? 3 : 6); Y.picks.set(b.i, n); maybeReveal(); }, 1000 + Math.random() * 3000));
  if (AUTO) later(() => { if (!Y.picks.has(0)) { Y.picks.set(0, 6); maybeReveal(); } }, 600);
  function maybeReveal() {
    if (Y.picks.size < Y.boats.length || Y.revealing) return; Y.revealing = true; screenEl.onclick = null;
    let k = -1; const step = () => { k++; render(k); Music.reveal(); if (k < Y.boats.length - 1) return later(step, 1100);
      const sum = sumTo(k), fit = sum <= cap; Y.boats.forEach(b => yGive(b, fit ? Y.picks.get(b.i) * 2 : 1)); takeFish(fit ? sum : cap);
      later(() => { typeText(t(fit ? "last_fit" : "last_tear"), "#yVerdict"); fit ? Music.chime() : Music.bad(); }, 400);
      later(partyEnd, 3600); };
    later(step, 700);
  }
}
function partyEnd() {
  Y.revealing = false; const [a, y] = counts(), next = forecastOf(a, y), tier = tierOf(next);
  ceremony({
    mode: "party", a, y, next, unit: t("coins"),
    ledger: Y.boats.map(b => ({ c: b.c, isMe: b.isMe, home: b.coins, young: 0, spared: 0 })), homeLabel: t("coins_h"), fair: Math.round(Y.lakeStart / 10 / 4 * 2 + 12),
    rows: Y.boats.map(b => ({ c: b.c, isMe: b.isMe, base: b.coins, score: Math.round(b.coins * tier.mult) })),
    again: () => partyRun(),
  });
}
function partyDraw(dt, tt) {
  if (G.mode !== "party") return;
  const g = Y.game, me = Y.boats[0];
  Y.boats.forEach(b => { b.mesh.userData.lan.visible = g === "night"; });
  drawBoats(Y.boats, tt, (b) => `${yName(b)}${g === "tug" ? "" : ` · ${b.coins}`}`, (b) => g !== "night" || b.isMe || Math.hypot(b.x - me.x, b.z - me.z) < 20 || Y.lans.some(l => Math.hypot(b.x - l.x, b.z - l.z) < 14));
  if (G.phase !== "play") return;
  const ck = $("#yClock"); if (ck) ck.textContent = Y.phase === "play" ? `0:${String(Math.max(0, Math.ceil(Y.clock))).padStart(2, "0")}` : "—";
  if ((tt * 3 | 0) !== Y.hudT) { Y.hudT = tt * 3 | 0; const [a, y] = counts(), fc = forecastOf(a, y), tier = tierOf(fc); const nw = $("#yNow"), nx = $("#yNext"), tc = $("#yTier"); if (nw) nw.style.width = `${Math.min(100, a / K * 100)}%`; if (nx) { nx.style.width = `${Math.min(100, fc / K * 100)}%`; nx.style.background = tierCol[tier.id]; } if (tc) { tc.className = `tier t-${tier.id}`; tc.textContent = `${t("v_" + tier.id)} ×${tier.mult}`; } }
  if (g === "tug" && !$("#yTug")) { const el = document.createElement("div"); el.className = "tug"; el.id = "yTug"; el.innerHTML = `<div class="meter"><span class="zone"></span><span class="needle"></span></div><div class="lanes">${Y.boats.map(b => `<div class="lane"><span class="pf">${portrait(b.c.id, "")}</span><div class="bar" style="--c:${b.c.color}"><i data-l="${b.i}"></i></div><span>${yName(b)}</span></div>`).join("")}</div>`; stage.appendChild(el); }
  if (g === "night") { Y.lans = Y.lans.filter(l => { if (l.until < G.t) { scene.remove(l.m); return false; } return true; }); const fv = fishOpts.view; if (fv) fishOpts.view = { ...fv, extra: Y.lans }; }
  const cd = $("#yNet .cd"); if (cd) cd.style.setProperty("--p", `${me.castCd / 1.6 * 100}%`); const ld = $("#yLan .cd"); if (ld) ld.style.setProperty("--p", `${me.lanT / 8 * 100}%`);
}
function partyMinimap(ctx) { if (Y.game === "koi") { Y.path.forEach(([x, z], i) => dot(ctx, x, z, i === Y.boats[0].gate % Y.path.length ? 6 : 3.5, "#ff5a3c")); dot(ctx, Y.koi.x, Y.koi.z, 5, "#ffd34d"); } Y.boats.forEach(b => (Y.game !== "night" || b.isMe) && dot(ctx, b.x, b.z, b.isMe ? 7 : 5, b.c.color, b.isMe ? "#fff" : "#120e18")); }
MODES.party = {
  start() { setSeason(1, true); seedLake(G.lake.adults, G.lake.fry); partyRules(); },
  update: yUpdate, draw: partyDraw, minimap: partyMinimap,
  end() { removeBoats(Y.boats); Y.boats = []; Y.spots?.forEach(sp => scene.remove(sp.ring)); Y.spots = []; Y.lans?.forEach(l => scene.remove(l.m)); Y.lans = []; Y.gates?.forEach(m => scene.remove(m)); Y.gates = null; koi.visible = false; $("#yTug")?.remove(); screenEl.onclick = null; Y.game = null; nightTarget = 0; },
  relabel() { if (Y.phase === "play") yHud(); },
  lanterns() { return Y.lans?.map(l => ({ x: l.x, z: l.z, k: 1.3 })) ?? []; },
  key(code) { const me = Y.boats[0]; if (!me) return; if (code === "Space") { if (Y.game === "tug") yReel(me); if (Y.game === "night") yNet(me); } if (code === "KeyL") yLantern(me); },
};
