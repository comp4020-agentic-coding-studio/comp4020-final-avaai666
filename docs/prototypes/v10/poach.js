/* ================================================================ WHO'S POACHING 谁在偷鱼: one poacher, tasks by day, a meeting at dusk */
const PO = { DAYS: 3, DAY_S: 70, MEET_S: 55, VIEW: 24, INSPECT_R: 8, INSPECT_T: 1.5, REPORT_R: 11, FINE_CD: 13, FINE_R: 5.2, FINE_MAX: 22, NIGHT: 6, NET_CD: 2, NET_MAX: 3, TASK_R: 5.5, TASK_T: 2.5, BUOY_R: 15, LINE: 40, NO_EXILE: 5, SPEED: 12.5 };
const TASKS = [
  { id: "t1", verb: "net", place: "north", x: -16, z: -42 }, { id: "t2", verb: "count", place: "reeds" }, { id: "t3", verb: "lotus", place: "lotus" },
  { id: "t4", verb: "trap", place: "east", x: 60, z: -2 }, { id: "t5", verb: "sluice", place: "river" }, { id: "t6", verb: "incense", place: "island", x: ISLAND.x - 2, z: ISLAND.z + 12 },
  { id: "t7", verb: "mend", place: "south", x: 2, z: 30 }, { id: "t8", verb: "trap", place: "west", x: -62, z: 8 }, { id: "t9", verb: "net", place: "east", x: 40, z: -30 },
];
for (const tk of TASKS) if (tk.x === undefined) { const z = ZONES[tk.place]; tk.x = z.x * .9; tk.z = z.z * .9; }
addWords({
  en: {
    po1t: "Find the poacher", po1p: "One of you is secretly netting the young fish with a fine net. It leaves dead young fish floating.",
    po2t: "Work, look, remember", po2p: "Do your village tasks. Your lantern only lights what is near you. Inspect boats, drop a buoy, report what you find.",
    po3t: "Vote at the meeting", po3p: "At dusk the village meets. Look at the map, say what you saw, vote someone out. Talk out loud!",
    po_choice: "Who do you believe? Fishers win if they vote out the poacher while the lake stays above 40%. The poacher wins if the lake falls below 40% or survives three days.",
    po_controls_touch: "drag on the left to sail · buttons on the right · tap a portrait at the meeting",
    po_controls_keys: "<kbd>W A S D</kbd> sail · <kbd>Space</kbd> net · <kbd>E</kbd> inspect · <kbd>B</kbd> buoy · <kbd>R</kbd> report · <kbd>F</kbd> fine net (poacher)",
    role_f: "Fisher", role_p: "Poacher", role_f_s: "There is one poacher among you. Do your tasks, watch, and find them before the lake dies.", role_p_s: "Net the young fish with your fine net when no one can see you. Lie at the meeting. Survive three days, or sink the lake below 40%.",
    role_team: "The village", role_go: "Begin day 1",
    day_b: "Day {n}", day_s: "Do your tasks · watch the water", dusk: "Dusk", dusk_s: "The village meets",
    tasks_h: "Your tasks today", fake_h: "Your cover (fake tasks)", health: "Lake health", line40: "40% line",
    v_net: "Haul the nets", v_count: "Count the young fish", v_lotus: "Pick lotus seeds", v_trap: "Check the fish traps", v_sluice: "Mend the sluice", v_incense: "Light incense", v_mend: "Mend the nets",
    task_done: "Task done: +2 fish for the village", all_done: "All tasks done. Keep watching.",
    a_net: "NET", a_inspect: "INSPECT", a_buoy: "BUOY", a_report: "REPORT", a_fine: "FINE NET", a_dump: "DUMP",
    seen_n: "{n} boats can see you", seen_0: "No one can see you",
    insp_go: "Inspecting {name}…", insp_clean: "{name}'s boat: clean", insp_fry: "{name}'s boat: {n} young fish!", insp_you: "Someone inspected your boat",
    buoy_down: "Buoy dropped: it will log who passes", fine_done: "Fine net: {n} fish, {y} young. It leaves dead fry floating.", dumped: "Dumped the young fish. That leaves a patch too.",
    saw_net: "You saw {name} use a fine net!", found: "Dead young fish here. Press REPORT to call a meeting.",
    meet_h: "Village meeting · day {n}", meet_dusk: "Dusk: everyone comes in.", meet_rep: "{name} reported dead young fish at {place}.",
    m_map: "What you know", m_ev: "dead young fish", m_buoy: "buoy", m_path: "your path", m_seen: "where you saw boats",
    m_say: "Say", m_vote: "Vote: tap a portrait", m_skip: "Skip vote", m_noskip: "Last meeting: no skipping", m_voted: "voted",
    m_suspect: "Suspect", m_vouch: "Vouch for", m_out: "Vote out", m_cancel: "Cancel",
    s_was: "I was at {place}.", s_insp_c: "I inspected {name}: clean.", s_insp_f: "I inspected {name}: young fish in the boat!", s_saw: "I saw {name} at {place}, near the dead fish.", s_sawnet: "I saw {name} use a fine net!", s_buoy: "My buoy at {place} saw {names}.", s_sus: "I suspect {name}.", s_vouch: "{name} is clean, I'm sure.", s_skip: "Not sure. Skip.",
    k_clean: "you inspected: clean", k_fry: "you inspected: young fish!", k_net: "you saw the fine net!",
    tally: "The votes", ex_go: "{name} is sent away from the village…", ex_was: "{name} was the poacher!", ex_not: "{name} was not the poacher.", ex_none: "No one is sent away. In the night, the lake loses 5%.",
    you_out: "You were sent away. You can still watch.",
    win_f: "The fishers win!", win_p: "The poacher wins!", win_f_s: "{name} was the poacher. The lake keeps {h}% of its fish.", win_p_s1: "{name} was the poacher, and survived three days.", win_p_s2: "{name} was the poacher. The lake fell below 40%.",
    replay: "The poacher's path, and every net they cast", to_year: "See next year's lake →",
    p_home: "Fish for the village", p_pr: "the poacher", p_fi: "fisher", night_loss: "In the night the poacher went out again: the lake lost {n}%.",
  },
  zh: {
    po1t: "找出偷鱼贼", po1p: "你们中间有一个人，偷偷用绝户网捞小鱼。网过的地方会浮起死掉的小鱼。",
    po2t: "干活、观察、记住", po2p: "做村里的活。你的灯只照得到身边。查别人的船，放浮标，看见死鱼苗就报告。",
    po3t: "村会投票", po3p: "黄昏开村会。看地图，说你看见了什么，投票把一个人赶走。大声讨论！",
    po_choice: "你相信谁？湖的健康保持在 40% 以上并把偷鱼贼赶走，渔民赢。湖掉到 40% 以下，或偷鱼贼撑过三天，偷鱼贼赢。",
    po_controls_touch: "在左边按住拖动开船 · 右边是动作按钮 · 开会时点头像",
    po_controls_keys: "<kbd>W A S D</kbd> 开船 · <kbd>空格</kbd> 撒网 · <kbd>E</kbd> 查船 · <kbd>B</kbd> 浮标 · <kbd>R</kbd> 报告 · <kbd>F</kbd> 绝户网（偷鱼贼）",
    role_f: "渔民", role_p: "偷鱼贼", role_f_s: "你们中间有一个偷鱼贼。做好村里的活，多观察，在湖死掉之前把他找出来。", role_p_s: "趁没人看见，用绝户网捞小鱼。开会时撒谎。撑过三天，或者让湖掉到 40% 以下。",
    role_team: "村里的人", role_go: "开始第 1 天",
    day_b: "第 {n} 天", day_s: "做村里的活 · 盯着湖面", dusk: "天黑了", dusk_s: "全村开会",
    tasks_h: "今天的活", fake_h: "掩护（假装干活）", health: "湖的健康", line40: "40% 线",
    v_net: "收网", v_count: "数鱼苗", v_lotus: "采莲蓬", v_trap: "查鱼笼", v_sluice: "修水闸", v_incense: "上香", v_mend: "补网",
    task_done: "活干完了：村里 +2 条鱼", all_done: "今天的活都干完了。继续观察。",
    a_net: "撒网", a_inspect: "查船", a_buoy: "浮标", a_report: "报告", a_fine: "绝户网", a_dump: "倒掉",
    seen_n: "{n} 条船看得见你", seen_0: "没人看得见你",
    insp_go: "正在查{name}的船……", insp_clean: "{name}的船：干净", insp_fry: "{name}的船：有 {n} 条小鱼！", insp_you: "有人查了你的船",
    buoy_down: "浮标放下了：它会记下谁经过", fine_done: "绝户网：{n} 条鱼，其中 {y} 条小鱼。死鱼苗会浮在水面上。", dumped: "把小鱼倒掉了。这样也会留下一片死鱼苗。",
    saw_net: "你看见{name}下了绝户网！", found: "这里有死掉的小鱼。按「报告」开村会。",
    meet_h: "村会 · 第 {n} 天", meet_dusk: "天黑了，大家都回来了。", meet_rep: "{name}报告：{place}有死掉的小鱼。",
    m_map: "你知道的", m_ev: "死鱼苗", m_buoy: "浮标", m_path: "你走过的路", m_seen: "你看见别人的地方",
    m_say: "发言", m_vote: "投票：点一个头像", m_skip: "跳过投票", m_noskip: "最后一次村会：不能跳过", m_voted: "已投",
    m_suspect: "怀疑", m_vouch: "担保", m_out: "投 Ta 出局", m_cancel: "取消",
    s_was: "我在{place}。", s_insp_c: "我查了{name}：干净。", s_insp_f: "我查了{name}：船上有小鱼！", s_saw: "我看见{name}在{place}，就在死鱼苗旁边。", s_sawnet: "我亲眼看见{name}下绝户网！", s_buoy: "我放在{place}的浮标看到了：{names}。", s_sus: "我怀疑{name}。", s_vouch: "{name}是干净的，我担保。", s_skip: "我不确定，跳过。",
    k_clean: "你查过：干净", k_fry: "你查过：有小鱼！", k_net: "你看见Ta下网！",
    tally: "投票结果", ex_go: "{name}被赶出了村子……", ex_was: "{name}就是偷鱼贼！", ex_not: "{name}不是偷鱼贼。", ex_none: "没有人被赶走。夜里，湖又少了 5%。",
    you_out: "你被赶出了村子。你还可以看着。",
    win_f: "渔民赢了！", win_p: "偷鱼贼赢了！", win_f_s: "{name}是偷鱼贼。湖还留着 {h}% 的鱼。", win_p_s1: "{name}是偷鱼贼，撑过了三天。", win_p_s2: "{name}是偷鱼贼。湖掉到了 40% 以下。",
    replay: "偷鱼贼走过的路，和下过的每一网", to_year: "看明年的湖 →",
    p_home: "给村里的鱼", p_pr: "偷鱼贼", p_fi: "渔民", night_loss: "夜里偷鱼贼又出去了：湖少了 {n}%。",
  },
});
const P = { boats: [], day: 0, clock: 0, phase: "", ev: [], buoys: [], says: [], votes: new Map(), log: [], start: 0, reported: null };
const pName = (b) => b.isMe ? t("you") : t("bot", { name: crewName(b.c) });
const pPlace = (id) => t("p_" + id);
const health = () => { const [a, y] = counts(); return Math.round((a + y) / P.start * 100); };
const alive = () => P.boats.filter(b => !b.out);
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function poachRules() {
  rulesCard({
    id: "poach",
    steps: [
      [t("po1t"), t("po1p"), SV.water() + SV.fry(110, 90, 12) + SV.net(116, 92, 34, "#ff8a7a") + SV.boat(190, 110, "#e0a93a", 200) + SV.text(250, 50, "?", "#e8b84d", 60)],
      [t("po2t"), t("po2p"), SV.water(`<circle cx="160" cy="100" r="70" fill="#ffd68a" opacity=".12"/>`) + SV.boat(160, 100, "#d6473a", -30) + SV.lantern(250, 60, .8) + `<rect width="320" height="200" fill="url(#fg2)"/><defs><radialGradient id="fg2" cx="50%" cy="50%" r="55%"><stop offset="45%" stop-color="#0a0c16" stop-opacity="0"/><stop offset="100%" stop-color="#0a0c16" stop-opacity=".9"/></radialGradient></defs>`],
      [t("po3t"), t("po3p"), `<rect width="320" height="200" fill="#1d1726"/>${["#d6473a", "#4a7d9c", "#e0a93a", "#2f9a8f", "#d9668a", "#62a344"].map((c, i) => `<circle cx="${60 + (i % 3) * 100}" cy="${60 + Math.floor(i / 3) * 80}" r="26" fill="${c}"/>${i === 2 ? `<rect x="${60 + 200 - 30}" y="${60 - 40}" width="60" height="18" rx="9" fill="#e8b84d"/>${SV.text(260, 33, "3", "#120e18", 14)}` : ""}`).join("")}`],
    ],
    choice: t("po_choice"), controls: t(isTouch ? "po_controls_touch" : "po_controls_keys"),
    onStart: () => poachRun(),
  });
}
function poachBoats() {
  removeBoats(P.boats); P.ev.forEach(e => scene.remove(e.mesh)); P.buoys.forEach(b => scene.remove(b.mesh));
  const ids = [G.me, ...CREW.map(c => c.id).filter(id => id !== G.me)];
  P.boats = ids.map((id, i) => { const b = makeCrewBoat(CREW.find(x => x.id === id), i, i === 0); Object.assign(b, { role: "fisher", out: false, hold: [], fry: 0, catch: 0, taskFish: 0, killed: 0, netCd: 0, fineCd: 6 + Math.random() * 6, tasks: [], taskT: 0, buoy: false, insp: null, known: {}, sus: {}, saw: [], witnessed: {}, ai: { cd: 0, next: 0, wander: null, inspected: {} } }); return b; });
  const pr = Q.get("role") === "poacher" ? 0 : Q.get("role") === "fisher" ? 1 + ((Math.random() * 5) | 0) : (Math.random() * 6) | 0;
  P.boats[pr].role = "poacher"; P.poacher = P.boats[pr];
}
function poachRun() {
  hideScreen(); setSeason(0, true); fishOpts.seasonal = false;
  const L = G.lake; seedLake(L.adults, L.fry); P.start = L.adults + L.fry; P.lakeStart = { ...L };
  // the reeds are full of young fish: that is what the fine net is for
  for (let i = 0; i < 40; i++) addFish(false);
  P.start = fish.length;
  poachBoats(); P.day = 0; P.ev = []; P.buoys = []; P.says = []; P.log = []; P.exiled = [];
  P.boats.forEach(atDock);
  roleCard();
}
function roleCard() {
  G.phase = "role"; P.phase = "role"; hideHud(); cam.mode = "overview"; nightTarget = .2; Music.mood("tension");
  const me = P.boats[0], pr = me.role === "poacher", col = pr ? "#ff8a7a" : "var(--leaf)";
  screen(`<div class="sheet narrow role" style="--c:${col}"><p class="note">${t("g_poach")}</p><div class="face-big">${portrait(me.c.id, crewName(me.c))}</div><div class="who">${t(pr ? "role_p" : "role_f")}</div><p class="lede">${t(pr ? "role_p_s" : "role_f_s")}</p>
    <div><p class="note" style="margin-bottom:6px">${t("role_team")}</p><div class="crewrow">${P.boats.map(b => `<span class="pf">${portrait(b.c.id, crewName(b.c))}</span>`).join("")}</div></div>
    <button class="btn primary" type="button" id="poGo">${t("role_go")} →</button></div>`);
  Music.reveal(); $("#poGo").onclick = () => startDay();
  if (AUTO) later(() => P.phase === "role" && startDay(), 600);
}
function startDay() {
  hideScreen(); P.day++; P.clock = PO.DAY_S; P.phase = "day"; G.phase = "play"; P.reported = null; P.meetN = (P.meetN || 0);
  P.ev.forEach(e => scene.remove(e.mesh)); P.ev = []; P.buoys.forEach(b => scene.remove(b.mesh)); P.buoys = []; P.log = []; P.dayStart = G.t;
  const spots = shuffle(TASKS);
  alive().forEach((b, i) => { atDock(b); b.hold = []; b.fry = 0; b.tasks = shuffle(spots).slice(0, 3).map(tk => ({ ...tk, done: false })); b.buoy = false; b.insp = null; b.ai.inspected = {}; b.saw = []; b.fineCd = 8 + Math.random() * 8; b.ai.next = 0; });
  P.boats.filter(b => b.out && !b.isMe).forEach(b => { b.x = 999; b.z = 999; });
  const me = P.boats[0]; cam.mode = me.out ? "overview" : "follow"; cam.target = me; cam.x = me.x; cam.z = me.z; cam.dist = distForSpan(viewSpan() * .82); cam.span = viewSpan() * .82;
  fogEl.hidden = me.out; fishOpts.view = me.out ? null : { x: me.x, z: me.z, r: PO.VIEW + 4 };
  poachHud(); banner(t("day_b", { n: P.day }), t("day_s")); Music.mood("tension"); nightTarget = .15;
  P.taskRings = me.tasks.map(tk => { const r = makeRing("#e8b84d", PO.TASK_R); r.position.set(tk.x, 0, tk.z); return r; });
}
function poachHud() {
  const me = P.boats[0], pr = me.role === "poacher";
  const pads = me.out ? [] : [
    { id: "pRep", label: t("a_report"), cls: "gold small", key: "R", on: () => pReport(me) },
    { id: "pBuoy", label: t("a_buoy"), cls: "jade small", key: "B", on: () => pBuoy(me) },
    { id: "pInsp", label: t("a_inspect"), cls: "jade small", key: "E", on: () => pInspect(me) },
    ...(pr ? [{ id: "pDump", label: t("a_dump"), cls: "small", key: "Q", on: () => pDump(me) }, { id: "pFine", label: t("a_fine"), cls: "red", key: "F", on: () => pFine(me) }] : []),
    { id: "pNet", label: t("a_net"), key: t("space_k"), on: () => pNet(me) },
  ];
  hud({
    top: `<div class="pill"><span class="season-chip">${P.day}</span><div><small>${t("day_b", { n: P.day })}</small><b id="pClock">1:10</b></div></div>
      <div class="pill lakebox"><div class="lakehead"><small>${t("health")}</small><b id="pHealth" style="font-size:16px">100%</b></div><div class="lakebar"><i id="pHbar" style="background:var(--jade)"></i><i class="mark" style="left:${PO.LINE}%;background:#ff8a7a;width:3px"></i></div></div>
      <div class="pill hide-sm"><span class="goal" style="color:${pr ? "#ff8a7a" : "var(--leaf)"}">${t(pr ? "role_p" : "role_f")}</span></div>`,
    side: `<div class="card0"><h4>${t(pr ? "fake_h" : "tasks_h")}</h4><ul class="tasks" id="pTasks"></ul></div><div class="card0" id="pSeen" style="font-size:12.5px;font-weight:700"></div>`,
    pads, keys: t("po_controls_keys"),
  });
  padsEl.style.flexWrap = "wrap"; padsEl.style.justifyContent = "flex-end"; padsEl.style.maxWidth = isTouch ? "250px" : "420px";
  renderTasks();
}
function renderTasks() { const el = $("#pTasks"); if (!el) return; const me = P.boats[0]; el.innerHTML = me.tasks.map(tk => `<li class="${tk.done ? "done" : ""} ${tk.here ? "here" : ""}">${t("v_" + tk.verb)} · ${pPlace(tk.place)}</li>`).join(""); }

/* actions */
function pNet(b) {
  if (P.phase !== "day" || b.out || b.netCd > 0) return; b.netCd = PO.NET_CD;
  const nx = b.x + Math.cos(b.h) * 4, nz = b.z + Math.sin(b.h) * 4; netDrop(nx, nz, b.c.color, 3.4);
  let got = 0; for (let i = fish.length - 1; i >= 0 && got < PO.NET_MAX; i--) { const f = fish[i]; if (f.adult && Math.hypot(f.x - nx, f.z - nz) < 3.4) { fish.splice(i, 1); got++; } }
  b.catch += got; if (b.isMe) { Music.splash(); floatAt(nx, nz, got ? `+${got}` : t("empty"), got ? b.c.color : "#b9b0c6"); }
}
addWords({ en: { empty: "Empty net" }, zh: { empty: "空网" } });
function watchers(b) { return alive().filter(o => o !== b && Math.hypot(o.x - b.x, o.z - b.z) < PO.VIEW); }
function pFine(b) {
  if (P.phase !== "day" || b.out || b.role !== "poacher" || b.fineCd > 0) return; b.fineCd = PO.FINE_CD;
  const nx = b.x + Math.cos(b.h) * 4, nz = b.z + Math.sin(b.h) * 4; netDrop(nx, nz, "#cf3b2e", PO.FINE_R, true);
  let n = 0, y = 0; for (let i = fish.length - 1; i >= 0 && n < PO.FINE_MAX; i--) { const f = fish[i]; if (Math.hypot(f.x - nx, f.z - nz) < PO.FINE_R + (f.adult ? 0 : 1.5)) { fish.splice(i, 1); n++; if (!f.adult) y++; } }
  // a fine net in the reeds always finds young fish: the nursery
  if (inZone("reeds", nx, nz) || inZone("lotus", nx, nz)) { const extra = Math.min(PO.FINE_MAX - n, 14); for (let k = 0; k < extra; k++) { const j = fish.findIndex(f => !f.adult); if (j >= 0) { fish.splice(j, 1); n++; y++; } } }
  b.fry += y; b.killed += n; b.youngKilled = (b.youngKilled || 0) + y; b.catch += n - y;
  const ev = { x: nx, z: nz, t: PO.DAY_S - P.clock, who: b, mesh: deadPatch(nx, nz, 8 + y), reported: false, seenBy: new Set() };
  P.ev.push(ev);
  for (const w of watchers(b)) { w.witnessed[b.i] = (w.witnessed[b.i] || 0) + 1; ev.seenBy.add(w.i); if (w.isMe) { toast(t("saw_net", { name: pName(b) }), "warn"); Music.bad(); } }
  if (b.isMe) { toast(t("fine_done", { n, y }), "warn"); Music.thud(); shake(.25); }
}
function pDump(b) {
  if (P.phase !== "day" || b.role !== "poacher" || !b.fry) return;
  const ev = { x: b.x, z: b.z, t: PO.DAY_S - P.clock, who: b, mesh: deadPatch(b.x, b.z, Math.min(16, b.fry)), reported: false, seenBy: new Set(), dump: true };
  P.ev.push(ev); for (const w of watchers(b)) { w.witnessed[b.i] = (w.witnessed[b.i] || 0) + .6; ev.seenBy.add(w.i); }
  b.fry = 0; if (b.isMe) toast(t("dumped"));
}
function pInspect(b) {
  if (P.phase !== "day" || b.out || b.insp) return;
  const tg = alive().filter(o => o !== b && Math.hypot(o.x - b.x, o.z - b.z) < PO.INSPECT_R).sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z))[0];
  if (!tg) return; b.insp = { tg, t: 0 }; if (b.isMe) toast(t("insp_go", { name: pName(tg) }));
}
function pBuoy(b) {
  if (P.phase !== "day" || b.out || b.buoy) return; b.buoy = true;
  const m = makeLantern(.9); m.position.set(b.x, 1.2, b.z); scene.add(m);
  P.buoys.push({ owner: b, x: b.x, z: b.z, place: placeOf(b.x, b.z), mesh: m, log: [], last: {} }); if (b.isMe) toast(t("buoy_down"), "good");
}
function pReport(b) {
  if (P.phase !== "day" || b.out) return;
  const ev = P.ev.find(e => !e.reported && Math.hypot(e.x - b.x, e.z - b.z) < PO.REPORT_R); if (!ev) return;
  ev.reported = true; P.reported = { by: b, ev }; Music.reveal(); startMeeting();
}

/* the day */
function poachUpdate(dt) {
  if (P.phase !== "day") return;
  const me = P.boats[0], dir = wantDir();
  if (!me.out && input.tapPoint && !dir) { me.tx = input.tapPoint.x; me.tz = input.tapPoint.z; if (!input.tapPoint.hold) { ripple(me.tx, me.tz, me.c.color, 2, .5); input.tapPoint = null; } }
  P.clock -= dt; const el = PO.DAY_S - P.clock;
  nightTarget = .12 + .5 * Math.min(1, el / PO.DAY_S);
  for (const b of alive()) {
    b.netCd = Math.max(0, b.netCd - dt); b.fineCd = Math.max(0, b.fineCd - dt);
    if (!b.isMe || AUTO) pThink(b, dt);
    steerBoat(b, dt, PO.SPEED, b.isMe && !AUTO ? dir : null);
    // tasks
    for (const tk of b.tasks) { if (tk.done) continue; const inT = Math.hypot(tk.x - b.x, tk.z - b.z) < PO.TASK_R; tk.here = inT && b.isMe;
      if (inT) { tk.p = (tk.p || 0) + dt; if (tk.p >= PO.TASK_T) { tk.done = true; if (b.role === "fisher") b.taskFish += 2; if (b.isMe) { toast(t("task_done"), "good"); Music.chime(); renderTasks(); const r = P.taskRings[me.tasks.indexOf(tk)]; if (r) scene.remove(r); if (me.tasks.every(x => x.done)) toast(t("all_done")); } } } }
    // inspecting: stay close
    if (b.insp) { const tg = b.insp.tg; if (Math.hypot(tg.x - b.x, tg.z - b.z) > PO.INSPECT_R + 2 || tg.out) b.insp = null; else { b.insp.t += dt; if (b.insp.t >= PO.INSPECT_T) {
      const res = tg.fry > 0 ? "fry" : "clean"; b.known[tg.i] = { res, n: tg.fry, day: P.day }; b.ai.inspected[tg.i] = true; b.insp = null;
      if (b.isMe) { toast(res === "fry" ? t("insp_fry", { name: pName(tg), n: tg.fry }) : t("insp_clean", { name: pName(tg) }), res === "fry" ? "warn" : "good"); res === "fry" ? Music.bad() : Music.chime(); }
      if (tg.isMe) toast(t("insp_you")); } } }
  }
  // what each boat sees: sightings and buoys
  if ((G.t * 2 | 0) !== P.lastSeeT) { P.lastSeeT = G.t * 2 | 0;
    for (const b of alive()) for (const o of alive()) if (o !== b && Math.hypot(o.x - b.x, o.z - b.z) < PO.VIEW) b.saw.push({ i: o.i, x: o.x, z: o.z, t: el });
    for (const bu of P.buoys) for (const o of alive()) if (Math.hypot(o.x - bu.x, o.z - bu.z) < PO.BUOY_R && (bu.last[o.i] ?? -99) < el - 8) { bu.last[o.i] = el; bu.log.push({ i: o.i, t: el }); }
    for (const ev of P.ev) for (const b of alive()) if (Math.hypot(ev.x - b.x, ev.z - b.z) < PO.VIEW) ev.seenBy.add(b.i);
    P.log.push({ t: el, pos: P.boats.map(b => [b.x, b.z]) });
  }
  // the lantern view
  fishOpts.view = me.out ? null : { x: me.x, z: me.z, r: PO.VIEW + 4 };
  if (health() < PO.LINE) { P.endReason = "lake"; return poachEnd("poacher"); }
  if (P.clock <= 0) { P.reported = null; startMeeting(); }
}
/* bots */
function pThink(b, dt) {
  b.ai.cd -= dt; if (b.ai.cd > 0) return; b.ai.cd = .3;
  const el = PO.DAY_S - P.clock;
  // fishers: report dead fish they can see
  const ev = P.ev.find(e => !e.reported && Math.hypot(e.x - b.x, e.z - b.z) < PO.VIEW);
  if (ev && b.role === "fisher") { if (Math.hypot(ev.x - b.x, ev.z - b.z) < PO.REPORT_R - 1) { if (Math.random() < .5) return pReport(b); } else { b.tx = ev.x; b.tz = ev.z; return; } }
  if (b.insp) { b.tx = b.insp.tg.x; b.tz = b.insp.tg.z; return; }
  if (b.role === "poacher") {
    const eyes = watchers(b).length;
    if (b.fry > 0 && alive().some(o => o !== b && Math.hypot(o.x - b.x, o.z - b.z) < 13) && Math.random() < .4) pDump(b);
    if (b.fineCd <= 0 && el > 6 && (eyes === 0 || (eyes === 1 && Math.random() < .06))) { const nearYoung = fish.some(f => !f.adult && Math.hypot(f.x - (b.x + Math.cos(b.h) * 4), f.z - (b.z + Math.sin(b.h) * 4)) < 7); if (nearYoung || Math.random() < .25) { pFine(b); b.ai.hunt = null; return; } }
    if (b.fineCd <= 3 && !b.ai.hunt) { // go where the young fish are and nobody else is
      const spots = [nearZone("reeds", .7), nearZone("reeds", .7), nearZone("lotus", .7), polar(150, .75), polar(250, .7), polar(5, .7)];
      b.ai.hunt = spots.map(sp => [sp, alive().filter(o => o !== b && Math.hypot(o.x - sp[0], o.z - sp[1]) < 32).length + Math.random() * .5]).sort((p, q) => p[1] - q[1])[0][0]; }
    if (b.ai.hunt) { b.tx = b.ai.hunt[0]; b.tz = b.ai.hunt[1]; if (Math.hypot(b.tx - b.x, b.tz - b.z) < 4 || b.fineCd > 5) b.ai.hunt = null; return; }
  } else {
    if (!b.buoy && el > 6 && Math.random() < .03) pBuoy(b);
    const tg = alive().find(o => o !== b && !b.ai.inspected[o.i] && Math.hypot(o.x - b.x, o.z - b.z) < PO.INSPECT_R);
    if (tg && Math.random() < .25) { pInspect(b); return; }
    if (Math.random() < .008) pNet(b);
  }
  const tk = b.tasks.find(x => !x.done);
  if (tk) { b.tx = tk.x + (b.i % 3 - 1) * 1.5; b.tz = tk.z + (b.i % 2) * 1.5; }
  else { if (!b.ai.wander || Math.hypot(b.ai.wander[0] - b.x, b.ai.wander[1] - b.z) < 4) b.ai.wander = randomWater(.8); b.tx = b.ai.wander[0]; b.tz = b.ai.wander[1]; }
}

/* ---------------------------------------------------------------- the meeting */
function startMeeting() {
  P.phase = "meeting"; G.phase = "meeting"; hideHud(); P.taskRings?.forEach(r => scene.remove(r)); fogEl.hidden = true; fishOpts.view = null;
  P.meetT = PO.MEET_S; P.says = []; P.votes = new Map(); P.sel = null; P.meetN++; Music.mood("meeting"); Music.gong();
  P.final = P.day >= PO.DAYS;
  // what the bots will say, spread over the first seconds
  P.queue = [];
  alive().filter(b => !b.isMe).forEach((b, k) => { const lines = botLines(b); lines.forEach((l, j) => P.queue.push({ at: 2 + k * 1.6 + j * 4 + Math.random() * 1.5, b, l })); });
  P.botVoteAt = new Map(alive().filter(b => !b.isMe).map(b => [b.i, 15 + Math.random() * 10]));
  renderMeeting();
  if (AUTO) later(() => { if (P.phase === "meeting" && !P.boats[0].out) { const sus = alive().filter(b => !b.isMe).sort((p, q) => susOf(P.boats[0], q) - susOf(P.boats[0], p))[0]; pVote(P.boats[0], P.final || Math.random() < .7 ? sus.i : -1); } }, 9000);
}
function mostPlace(b) { const c = {}; for (const r of P.log) { const [x, z] = r.pos[b.i]; const p = placeOf(x, z); c[p] = (c[p] || 0) + 1; } return Object.entries(c).sort((p, q) => q[1] - p[1])[0]?.[0] ?? "south"; }
function nearEv(b) { // a boat this bot saw close to a patch of dead fish, around the time it appeared
  const out = []; for (const ev of P.ev) for (const s of b.saw) if (Math.abs(s.t - ev.t) < 8 && Math.hypot(s.x - ev.x, s.z - ev.z) < 14 && s.i !== b.i) out.push({ i: s.i, place: placeOf(ev.x, ev.z), ev }); return out;
}
function susOf(b, o) {
  if (o === b) return -99; let s = Math.random() * .8;
  s += (b.witnessed[o.i] || 0) * 10;
  const k = b.known[o.i]; if (k) s += k.res === "fry" ? 9 : -5;
  s += nearEv(b).filter(x => x.i === o.i).length * 2.6;
  for (const bu of P.buoys) for (const ev of P.ev) for (const l of bu.log) if (l.i === o.i && Math.abs(l.t - ev.t) < 9 && Math.hypot(bu.x - ev.x, bu.z - ev.z) < 20) s += 1.6;
  for (const sy of P.says) { if (sy.b === b) continue; const w = sy.b === o ? 0 : 1; if (sy.l.k === "sus" && sy.l.i === o.i) s += 1.2 * w; if ((sy.l.k === "sawnet") && sy.l.i === o.i) s += 4 * w; if (sy.l.k === "insp" && sy.l.i === o.i) s += (sy.l.res === "fry" ? 3.5 : -1.5) * w; if (sy.l.k === "vouch" && sy.l.i === o.i) s -= 1 * w; if (sy.l.k === "saw" && sy.l.i === o.i) s += 1.2 * w;
    if ((sy.l.k === "sus" || sy.l.k === "sawnet") && sy.l.i === b.i && sy.b === o) s += 2.5; }
  if (b.role === "poacher") s = o.role === "poacher" ? -99 : s * .3 + (o.isMe ? .5 : 0) + Math.random() * 2; // the poacher votes for whoever is being blamed
  return s;
}
function botLines(b) {
  const L = [];
  if (b.role === "fisher") {
    const wit = Object.entries(b.witnessed).sort((p, q) => q[1] - p[1])[0]; if (wit) L.push({ k: "sawnet", i: +wit[0] });
    for (const [i, k] of Object.entries(b.known)) if (k.day === P.day) L.push({ k: "insp", i: +i, res: k.res });
    const ne = nearEv(b); if (ne.length && L.length < 2) L.push({ k: "saw", i: ne[0].i, place: ne[0].place });
    const bu = P.buoys.find(x => x.owner === b); if (bu && bu.log.length && L.length < 2) L.push({ k: "buoy", place: bu.place, ids: [...new Set(bu.log.filter(l => l.i !== b.i).map(l => l.i))].slice(0, 3) });
    if (!L.length) L.push({ k: "was", place: mostPlace(b) });
  } else {
    // the poacher: claims somewhere away from the dead fish, and points at someone who was near them
    const evPlaces = new Set(P.ev.map(e => placeOf(e.x, e.z))); const far = BAYS.map(x => x.id).find(id => !evPlaces.has(id)) ?? "south";
    L.push({ k: "was", place: far });
    const ne = nearEv(b).filter(x => x.i !== b.i); const scape = ne[0]?.i ?? pick(alive().filter(o => o !== b)).i;
    if (Math.random() < .7) L.push(Math.random() < .5 && P.ev.length ? { k: "saw", i: scape, place: ne[0]?.place ?? placeOf(P.ev[0].x, P.ev[0].z) } : { k: "sus", i: scape });
  }
  return L.slice(0, 2);
}
function lineText(l) {
  const nm = (i) => pName(P.boats[i]);
  if (l.k === "was") return t("s_was", { place: pPlace(l.place) });
  if (l.k === "insp") return t(l.res === "fry" ? "s_insp_f" : "s_insp_c", { name: nm(l.i) });
  if (l.k === "saw") return t("s_saw", { name: nm(l.i), place: pPlace(l.place) });
  if (l.k === "sawnet") return t("s_sawnet", { name: nm(l.i) });
  if (l.k === "buoy") return t("s_buoy", { place: pPlace(l.place), names: l.ids.length ? l.ids.map(nm).join(LANG === "zh" ? "、" : ", ") : "—" });
  if (l.k === "sus") return t("s_sus", { name: nm(l.i) });
  if (l.k === "vouch") return t("s_vouch", { name: nm(l.i) });
  return t("s_skip");
}
function say(b, l) { P.says.push({ b, l }); if (P.phase === "meeting") renderMeeting(); Music.tick(); }
function myChips() {
  const me = P.boats[0]; if (me.out) return [];
  if (P.chipsFor === P.meetN && P.chipsCache && me.role === "poacher") return P.chipsCache.map(c => ({ ...c, used: P.says.some(s => s.b === me && JSON.stringify(s.l) === JSON.stringify(c.l)) }));
  const out = [];
  if (me.role === "fisher") {
    out.push({ k: "was", place: mostPlace(me) });
    for (const [i, k] of Object.entries(me.known)) if (k.day === P.day) out.push({ k: "insp", i: +i, res: k.res });
    for (const [i] of Object.entries(me.witnessed)) out.push({ k: "sawnet", i: +i });
    for (const n of nearEv(me).slice(0, 2)) out.push({ k: "saw", i: n.i, place: n.place });
    const bu = P.buoys.find(x => x.owner === me); if (bu) out.push({ k: "buoy", place: bu.place, ids: [...new Set(bu.log.filter(l => l.i !== 0).map(l => l.i))].slice(0, 3) });
  } else {
    const evPlaces = new Set(P.ev.map(e => placeOf(e.x, e.z)));
    BAYS.map(x => x.id).filter(id => !evPlaces.has(id)).slice(0, 2).forEach(place => out.push({ k: "was", place }));
    const ne = nearEv(me).filter(x => x.i !== 0); const scape = ne[0] ?? (P.ev[0] ? { i: pick(alive().filter(o => !o.isMe)).i, place: placeOf(P.ev[0].x, P.ev[0].z) } : null);
    if (scape) out.push({ k: "saw", i: scape.i, place: scape.place }); else out.push({ k: "sus", i: pick(alive().filter(o => !o.isMe)).i });
    out.push({ k: "insp", i: pick(alive().filter(o => !o.isMe)).i, res: "clean" });
  }
  out.push({ k: "skip" });
  const said = new Set(P.says.filter(s => s.b === me).map(s => JSON.stringify(s.l)));
  const res = out.filter((l, i, a) => a.findIndex(x => JSON.stringify(x) === JSON.stringify(l)) === i).map(l => ({ l, used: said.has(JSON.stringify(l)) }));
  P.chipsFor = P.meetN; P.chipsCache = res; return res;
}
function renderMeeting() {
  if (P.phase !== "meeting") return;
  const me = P.boats[0], rep = P.reported;
  const head = rep ? t("meet_rep", { name: pName(rep.by), place: pPlace(placeOf(rep.ev.x, rep.ev.z)) }) : t("meet_dusk");
  const voted = (b) => P.votes.has(b.i);
  const seat = (b) => {
    const mine = P.says.filter(s => s.b === b).slice(-2);
    const k = me.known[b.i], w = me.witnessed[b.i];
    return `<button class="seat ${b.out ? "out" : ""}" type="button" data-seat="${b.i}" aria-pressed="${P.votes.get(0) === b.i}" ${b.out || b.isMe ? "disabled" : ""}><span class="pf">${portrait(b.c.id, crewName(b.c))}</span><span style="min-width:0"><b>${pName(b)}</b>${k && !b.isMe ? `<span class="known ${k.res === "fry" ? "bad" : ""}">${t(k.res === "fry" ? "k_fry" : "k_clean")}</span>` : ""}${w ? `<span class="known bad">${t("k_net")}</span>` : ""}${mine.map(s => `<span class="say ${s.l.k === "sus" || s.l.k === "sawnet" ? "acc" : s.l.k === "vouch" ? "vouch" : ""}">${lineText(s.l)}</span>`).join("")}</span>${voted(b) ? `<span class="vb">${t("m_voted")}</span>` : ""}</button>`;
  };
  const chips = myChips();
  screen(`<div class="sheet"><div class="mhead"><div><h2>${t("meet_h", { n: P.day })}</h2><p class="lede" style="margin-top:4px">${head}</p></div><div style="text-align:right"><div class="mtimer" id="pMt">${Math.ceil(P.meetT)}</div><small class="note">${t("health")} ${health()}%</small></div></div>
    <div class="meet">
      <div class="mapbox"><b style="font-size:14px">${t("m_map")}</b><canvas id="pMap" width="640" height="480"></canvas>
        <div class="legend2"><span style="color:#ff8a7a">✕ ${t("m_ev")}</span><span style="color:#ffb45a">● ${t("m_buoy")}</span><span style="color:var(--gold)">— ${t("m_path")}</span><span>· ${t("m_seen")}</span></div>
        ${P.buoys.map(bu => `<small class="note">● ${pPlace(bu.place)} (${pName(bu.owner)}): ${bu.log.filter(l => l.i !== bu.owner.i).map(l => `${pName(P.boats[l.i])} ${fmtT(l.t)}`).join(LANG === "zh" ? "，" : ", ") || "—"}</small>`).join("")}
      </div>
      <div style="display:grid;gap:10px;min-width:0">
        <div class="seats">${P.boats.map(seat).join("")}</div>
        <div id="pMenu"></div>
        ${me.out ? `<p class="note">${t("you_out")}</p>` : `<div><p class="note" style="margin-bottom:6px">${t("m_say")}</p><div class="says">${chips.map((c, i) => `<button class="chip ${c.l.k === "sus" || c.l.k === "sawnet" ? "acc" : ""}" type="button" data-chip="${i}" ${c.used ? "disabled" : ""}>${lineText(c.l)}</button>`).join("")}</div></div>
        <div class="row spread"><span class="note">${t("m_vote")}</span>${P.final ? `<span class="note">${t("m_noskip")}</span>` : `<button class="btn ghost small" type="button" id="pSkip" ${P.votes.has(0) ? "disabled" : ""}>${t("m_skip")}</button>`}</div>`}
      </div></div></div>`);
  drawMeetMap($("#pMap"));
  screenEl.querySelectorAll("[data-chip]").forEach(c => c.onclick = () => { const ch = chips[+c.dataset.chip]; say(me, ch.l); });
  screenEl.querySelectorAll("[data-seat]").forEach(s => s.onclick = () => { P.sel = +s.dataset.seat; renderMenu(); });
  $("#pSkip") && ($("#pSkip").onclick = () => pVote(me, -1));
  renderMenu();
}
function renderMenu() {
  const el = $("#pMenu"); if (!el) return; if (P.sel === null || P.sel === undefined) { el.innerHTML = ""; return; }
  const b = P.boats[P.sel], me = P.boats[0];
  el.innerHTML = `<div class="menu"><b style="align-self:center;margin-right:6px">${pName(b)}</b><button class="chip acc" type="button" data-m="sus">${t("m_suspect")}</button><button class="chip vouch" type="button" data-m="vouch">${t("m_vouch")}</button>${P.votes.has(0) ? "" : `<button class="chip acc" type="button" data-m="out" style="background:var(--lacquer)">${t("m_out")}</button>`}<button class="chip" type="button" data-m="x">${t("m_cancel")}</button></div>`;
  el.querySelectorAll("[data-m]").forEach(x => x.onclick = () => { const m = x.dataset.m; if (m === "sus" || m === "vouch") say(me, { k: m, i: b.i }); if (m === "out") pVote(me, b.i); P.sel = null; renderMeeting(); });
}
function pVote(b, target) { if (P.votes.has(b.i) || b.out) return; P.votes.set(b.i, target); if (b.isMe) Music.tick(); if (P.phase === "meeting") renderMeeting(); }
function drawMeetMap(cv) {
  if (!cv) return; const ctx = cv.getContext("2d"), w = cv.width, h = cv.height;
  const mx = (x) => w / 2 + x / (LK.x * 1.15) * (w / 2), mz = (z) => h / 2 + z / (LK.z * 1.2) * (h / 2);
  drawMapBase(ctx, w, h, mx, mz);
  ctx.font = `700 ${w / 34}px Noto Sans SC, sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(245,234,214,.55)";
  for (const bp of BAYS) ctx.fillText(pPlace(bp.id), mx(bp.x), mz(bp.z));
  const me = P.boats[0];
  // my path
  ctx.strokeStyle = "rgba(232,184,77,.85)"; ctx.lineWidth = 3; ctx.beginPath(); P.log.forEach((r, i) => { const [x, z] = r.pos[0]; i ? ctx.lineTo(mx(x), mz(z)) : ctx.moveTo(mx(x), mz(z)); }); ctx.stroke();
  // where I saw others (last sighting of each, faint)
  const last = {}; for (const s of me.saw) last[s.i] = s; for (const s of me.saw.filter((_, k) => k % 3 === 0)) { ctx.fillStyle = P.boats[s.i].c.color + "88"; ctx.beginPath(); ctx.arc(mx(s.x), mz(s.z), 4, 0, 6.28); ctx.fill(); }
  for (const s of Object.values(last)) { ctx.fillStyle = P.boats[s.i].c.color; ctx.beginPath(); ctx.arc(mx(s.x), mz(s.z), 7, 0, 6.28); ctx.fill(); ctx.fillStyle = "#f5ead6"; ctx.fillText(fmtT(s.t), mx(s.x), mz(s.z) - 11); }
  // buoys
  for (const bu of P.buoys) { ctx.fillStyle = "#ffb45a"; ctx.beginPath(); ctx.arc(mx(bu.x), mz(bu.z), 8, 0, 6.28); ctx.fill(); ctx.strokeStyle = "rgba(255,180,90,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx(bu.x), mz(bu.z), PO.BUOY_R / (LK.x * 1.15) * (w / 2), 0, 6.28); ctx.stroke(); }
  // dead fish: every patch someone reported, saw, or that I found
  for (const ev of P.ev) { const known = ev.reported || ev.seenBy.has(0) || P.boats[0].out; if (!known) continue;
    ctx.strokeStyle = "#ff8a7a"; ctx.lineWidth = 4; const X = mx(ev.x), Z = mz(ev.z); ctx.beginPath(); ctx.moveTo(X - 8, Z - 8); ctx.lineTo(X + 8, Z + 8); ctx.moveTo(X + 8, Z - 8); ctx.lineTo(X - 8, Z + 8); ctx.stroke(); ctx.fillStyle = "#ff8a7a"; ctx.fillText(fmtT(ev.t), X, Z + 22); }
  // me now
  ctx.fillStyle = me.c.color; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx(me.x), mz(me.z), 8, 0, 6.28); ctx.fill(); ctx.stroke();
}
function meetingTick(dt) {
  if (P.phase !== "meeting") return;
  P.meetT -= dt; const el = PO.MEET_S - P.meetT;
  for (const q of P.queue) if (!q.done && el >= q.at && !q.b.out) { q.done = true; say(q.b, q.l); }
  for (const [i, at] of P.botVoteAt) if (el >= at && !P.votes.has(i)) { const b = P.boats[i]; const ranked = alive().filter(o => o !== b).map(o => [o, susOf(b, o)]).sort((p, q) => q[1] - p[1]); const [top, sc] = ranked[0];
    if (sc > 1.2 && P.says.filter(s => s.b === b).length < 3 && (b.role === "fisher" ? sc > 4 : true) && Math.random() < .5) say(b, { k: "sus", i: top.i });
    pVote(b, P.final || sc > (b.role === "poacher" ? 1.5 : 3) ? top.i : -1); }
  const mt = $("#pMt"); if (mt) mt.textContent = Math.max(0, Math.ceil(P.meetT));
  const all = alive().every(b => P.votes.has(b.i));
  if (all || P.meetT <= 0) tally();
}
function tally() {
  P.phase = "tally"; const c = new Map(); for (const [, v] of P.votes) if (v >= 0) c.set(v, (c.get(v) || 0) + 1);
  const ranked = [...c.entries()].sort((p, q) => q[1] - p[1]); let out = null;
  if (ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) out = ranked[0][0];
  else if (ranked.length && P.final && alive().every(b => P.votes.has(b.i))) out = pick(ranked.filter(r => r[1] === ranked[0][1]))[0];
  screen(`<div class="sheet narrow"><h2>${t("tally")}</h2><div class="seats">${P.boats.filter(b => !b.out).map(b => `<div class="seat"><span class="pf">${portrait(b.c.id, crewName(b.c))}</span><span><b>${pName(b)}</b><span class="row" style="gap:3px;margin-top:4px">${[...P.votes].filter(([, v]) => v === b.i).map(([i]) => `<span class="pf" style="width:20px;height:24px">${portrait(P.boats[i].c.id, "")}</span>`).join("")}</span></span></div>`).join("")}</div>
    <p class="note">${t("m_skip")}: ${[...P.votes].filter(([, v]) => v < 0).map(([i]) => pName(P.boats[i])).join(LANG === "zh" ? "、" : ", ") || "—"}</p></div>`);
  Music.tick(); later(() => exile(out), 2600);
}
function exile(i) {
  P.phase = "exile"; Music.mood("tension");
  if (i === null) {
    // a night without a culprit: the poacher works unwatched
    const kill = Math.round(P.start * PO.NO_EXILE / 100); for (let k = 0; k < kill; k++) { const j = fish.findIndex(f => !f.adult) >= 0 ? fish.findIndex(f => !f.adult) : 0; if (fish.length) fish.splice(j, 1); }
    screen(`<div class="sheet narrow exile"><div class="typed" id="pTyped"></div></div>`); typeText(t("ex_none")); Music.bad();
    return later(afterExile, 4200);
  }
  const b = P.boats[i]; b.out = true; scene.remove(b.mesh); if (!b.isMe) { b.x = 999; b.z = 999; }
  screen(`<div class="sheet narrow exile"><div class="face-big">${portrait(b.c.id, crewName(b.c))}</div><div class="typed" id="pTyped"></div><div class="typed" id="pTyped2" style="color:${b.role === "poacher" ? "#ff8a7a" : "var(--leaf)"}"></div></div>`);
  typeText(t("ex_go", { name: pName(b) }), "#pTyped", () => later(() => { typeText(t(b.role === "poacher" ? "ex_was" : "ex_not", { name: pName(b) }), "#pTyped2"); b.role === "poacher" ? Music.reveal() : Music.bad(); }, 600));
  later(afterExile, 5600);
}
function typeText(s, sel = "#pTyped", done) { const el = $(sel); if (!el) return; let k = 0; const id = setInterval(() => { const e = $(sel); if (!e) return clearInterval(id); e.textContent = s.slice(0, ++k); if (k >= s.length) { clearInterval(id); done?.(); } }, 45 / SPEED); }
function afterExile() {
  if (P.poacher.out) return poachEnd("fishers");
  if (health() < PO.LINE) { P.endReason = "lake"; return poachEnd("poacher"); }
  if (P.day >= PO.DAYS) { P.endReason = "survived"; return poachEnd("poacher"); }
  // at night the poacher works unwatched; the lake recovers a little
  const night = Math.round(P.start * (PO.NIGHT - 2) / 100); for (let k = 0; k < night; k++) { const j = fish.findIndex(f => !f.adult); fish.splice(j >= 0 ? j : 0, 1); }
  P.poacher.youngKilled = (P.poacher.youngKilled || 0) + night;
  toast(t("night_loss", { n: PO.NIGHT - 2 }), "warn");
  if (P.boats[0].out) toast(t("you_out"));
  startDay();
}
function poachEnd(winner) {
  P.phase = "end"; G.phase = "end"; hideHud(); fogEl.hidden = true; fishOpts.view = null; nightTarget = .35; P.taskRings?.forEach(r => scene.remove(r));
  const pr = P.poacher, h = health();
  const title = t(winner === "fishers" ? "win_f" : "win_p");
  const sub = winner === "fishers" ? t("win_f_s", { name: pName(pr), h }) : t(P.endReason === "lake" ? "win_p_s2" : "win_p_s1", { name: pName(pr) });
  Music.mood(winner === "fishers" ? "good" : "bad"); Music.reveal();
  screen(`<div class="sheet narrow"><h2>${title}</h2><p class="lede">${sub}</p>
    <div class="row" style="gap:8px">${P.boats.map(b => `<span class="pick ${b.role === "poacher" ? "greedy" : "steward"}"><span class="pf">${portrait(b.c.id, crewName(b.c))}</span>${pName(b)} · ${t(b.role === "poacher" ? "p_pr" : "p_fi")}</span>`).join("")}</div>
    <div class="mapbox"><b style="font-size:14px">${t("replay")}</b><canvas id="pReplay" width="640" height="480"></canvas></div>
    <div class="row"><button class="btn primary" type="button" id="pYear">${t("to_year")}</button></div></div>`);
  const cv = $("#pReplay"), ctx = cv.getContext("2d"), w = cv.width, hh = cv.height;
  const mx = (x) => w / 2 + x / (LK.x * 1.15) * (w / 2), mz = (z) => hh / 2 + z / (LK.z * 1.2) * (hh / 2);
  drawMapBase(ctx, w, hh, mx, mz);
  ctx.strokeStyle = "#ff8a7a"; ctx.lineWidth = 3; ctx.beginPath(); P.log.forEach((r, i) => { const [x, z] = r.pos[pr.i]; if (x > 900) return; i ? ctx.lineTo(mx(x), mz(z)) : ctx.moveTo(mx(x), mz(z)); }); ctx.stroke();
  for (const ev of P.ev) { const X = mx(ev.x), Z = mz(ev.z); ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X - 8, Z - 8); ctx.lineTo(X + 8, Z + 8); ctx.moveTo(X + 8, Z - 8); ctx.lineTo(X - 8, Z + 8); ctx.stroke(); }
  $("#pYear").onclick = () => poachYear(winner);
  if (AUTO) later(() => P.phase === "end" && poachYear(winner), 1500);
}
function poachYear(winner) {
  const [a, y] = counts(), next = forecastOf(a, y), tier = tierOf(next);
  ceremony({
    mode: "poach", a, y, next,
    title: t(winner === "fishers" ? "win_f" : "win_p"), sub: t("fin1_s"),
    ledger: P.boats.map(b => ({ c: b.c, isMe: b.isMe, home: b.catch + b.taskFish, young: b.youngKilled || 0, spared: 0 })),
    homeLabel: t("p_home"), fair: Math.round(P.start * .5 / 6),
    rows: P.boats.map(b => { const base = b.catch + b.taskFish, won = (winner === "fishers") === (b.role === "fisher"); return { c: b.c, isMe: b.isMe, base, score: Math.round(base * tier.mult) + (won ? 20 : 0), sub: t(b.role === "poacher" ? "p_pr" : "p_fi") + (won ? " · +20" : "") }; }),
    podiumSub: t("fin3_s", { mult: tier.mult, tier: t("v_" + tier.id) }) + (LANG === "zh" ? " · 赢的一方 +20" : " · winners +20"),
    again: () => poachRun(),
  });
}
function poachDraw(dt, tt) {
  const me = P.boats[0];
  const vis = (b) => !b.out && (b.isMe || P.phase !== "day" || me.out || Math.hypot(b.x - me.x, b.z - me.z) < PO.VIEW || P.buoys.some(bu => bu.owner === me && Math.hypot(b.x - bu.x, b.z - bu.z) < PO.BUOY_R * .7));
  drawBoats(P.boats, tt, (b) => `${pName(b)}${b.insp ? " · 🔍" : ""}`, vis);
  if (P.phase === "meeting") meetingTick(dt * SPEED);
  if (P.phase !== "day") return;
  // the evening mist: a circle of lantern light round your boat
  const p = toScreen(me.x, 0, me.z), q = toScreen(me.x + PO.VIEW, 0, me.z);
  if (p && q && !me.out) { fogEl.style.setProperty("--fx", p[0] + "px"); fogEl.style.setProperty("--fy", p[1] + "px"); fogEl.style.setProperty("--fr", Math.max(60, (q[0] - p[0]) * .82) + "px"); }
  P.ev.forEach(ev => { ev.mesh.visible = me.out || Math.hypot(ev.x - me.x, ev.z - me.z) < PO.VIEW + 2; });
  marks([...BAYS.map(bp => ({ id: "b" + bp.id, x: bp.x, z: bp.z, text: pPlace(bp.id), cls: "tag3d place" })).filter(m => Math.hypot(m.x - me.x, m.z - me.z) < PO.VIEW * 1.6),
    ...me.tasks.filter(tk => !tk.done).map(tk => ({ id: tk.id, x: tk.x, z: tk.z, text: `${t("v_" + tk.verb)}${tk.p ? ` ${Math.min(100, Math.round(tk.p / PO.TASK_T * 100))}%` : ""}` }))]);
  const ck = $("#pClock"); if (ck) { ck.textContent = fmtT(Math.max(0, P.clock)); ck.style.color = P.clock < 10 ? "#ff8a7a" : ""; }
  const hv = health(), hb = $("#pHbar"), ht = $("#pHealth"); if (hb) { hb.style.width = hv + "%"; hb.style.background = hv < 50 ? "var(--lacquer)" : hv < 65 ? "var(--gold)" : "var(--jade)"; } if (ht) ht.textContent = hv + "%";
  const sn = $("#pSeen"); if (sn) { const n = watchers(me).length; sn.textContent = "👁 " + (n ? t("seen_n", { n }) : t("seen_0")); sn.style.color = n ? "var(--paper)" : "var(--leaf)"; }
  if ((tt * 4 | 0) !== P.padT) { P.padT = tt * 4 | 0; renderTasks();
    const near = (r) => alive().some(o => o !== me && Math.hypot(o.x - me.x, o.z - me.z) < r);
    const en = (id, on) => { const b = $("#" + id); if (b) b.disabled = !on; };
    en("pInsp", near(PO.INSPECT_R) && !me.insp); en("pBuoy", !me.buoy); en("pDump", me.fry > 0); en("pFine", me.fineCd <= 0);
    const evNear = P.ev.some(e => !e.reported && Math.hypot(e.x - me.x, e.z - me.z) < PO.REPORT_R); en("pRep", evNear); $("#pRep")?.classList.toggle("pulse", evNear);
    if (evNear && !P.foundTold) { P.foundTold = true; toast(t("found"), "warn"); }
    const fc = $("#pFine .cd"); if (fc) fc.style.setProperty("--p", `${me.fineCd / PO.FINE_CD * 100}%`);
  }
}
function poachMinimap(ctx) {
  const me = P.boats[0];
  if (P.phase === "day") for (const tk of me.tasks) if (!tk.done) dot(ctx, tk.x, tk.z, 5, "rgba(232,184,77,.9)");
  for (const bu of P.buoys) if (bu.owner === me) dot(ctx, bu.x, bu.z, 5, "#ffb45a");
  for (const ev of P.ev) if (ev.reported || ev.seenBy.has(0)) dot(ctx, ev.x, ev.z, 5, "#ff8a7a");
  dot(ctx, me.x, me.z, 7, me.c.color, "#fff");
}
MODES.poach = {
  start() { setSeason(0, true); fishOpts.seasonal = false; seedLake(G.lake.adults, G.lake.fry); poachRules(); },
  update: poachUpdate, draw: poachDraw, minimap: poachMinimap,
  end() { removeBoats(P.boats); P.boats = []; P.ev.forEach(e => scene.remove(e.mesh)); P.ev = []; P.buoys.forEach(b => scene.remove(b.mesh)); P.buoys = []; P.taskRings?.forEach(r => scene.remove(r)); fogEl.hidden = true; fishOpts.seasonal = true; padsEl.style.cssText = ""; },
  relabel() { if (P.phase === "meeting") renderMeeting(); else if (P.phase === "day") poachHud(); },
  lanterns() { return P.buoys.map(b => ({ x: b.x, z: b.z, k: 1.2 })); },
  key(code) { if (P.phase !== "day") return; const me = P.boats[0]; ({ Space: () => pNet(me), KeyE: () => pInspect(me), KeyB: () => pBuoy(me), KeyR: () => pReport(me), KeyF: () => pFine(me), KeyQ: () => pDump(me) })[code]?.(); },
};
