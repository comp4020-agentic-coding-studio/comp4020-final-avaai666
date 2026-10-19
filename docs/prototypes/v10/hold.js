/* ================================================================ LAKE HOLDINGS 抢地盘经营: claim water, build, and watch what the lake gives back */
const HO = { SEASONS: 4, ACTIONS: 3, PICK_S: 20, HS: 8.4, NET_TAKE: 7, BASE: 2, POND_SELF: 2, POND_NEAR: 1, CORM: 2, GROW: .2, GROW_REEDS: .4, TILE_PTS: 1 };
const HCARDS = {
  claim: { ic: "🚩", w: 0 }, net: { ic: "🕸", w: 3 }, pond: { ic: "🪷", w: 2 }, fence: { ic: "🪵", w: 1.2 }, corm: { ic: "🐦", w: 1 }, lantern: { ic: "🏮", w: 1.2 },
};
addWords({
  en: {
    ho1t: "Claim water", ho1p: "Each season, pick a card three times. A flag claims a tile next to yours. Every tile you hold gives you 2 fish a season.",
    ho2t: "Build", ho2p: "Nets catch fish now. Ponds breed fish for every tile around, yours or not. Lanterns, cormorants and fences fight your neighbours.",
    ho3t: "Watch the harvest", ho3p: "After each season the lake pays: ponds breed, nets haul, fish swim away from nets. Empty water runs dry.",
    ho_choice: "Fish home plus your tiles wins, multiplied by next year's lake. Net hard and the lake runs dry for everyone.",
    ho_controls: "pick a card, then tap a glowing tile (tap twice to place)",
    hc_claim: "Flag", hc_claim_s: "Claim an empty tile next to yours.", hc_net: "Net", hc_net_s: "Takes up to 7 fish from this tile every season.", hc_pond: "Pond", hc_pond_s: "+2 fish here and +1 to every tile around, anyone's. Brings dry water back.",
    hc_fence: "Fence", hc_fence_s: "Fish can't swim away from here; lanterns and cormorants can't touch this tile or your tiles next to it.", hc_corm: "Cormorant", hc_corm_s: "Steals 2 fish a season from the richest neighbour's net within 2 tiles.", hc_lantern: "Lantern", hc_lantern_s: "Pulls 1 fish a season from every tile next to it.",
    h_pick: "Pick a card", h_place: "Tap a glowing tile", h_wait: "Everyone is choosing…", h_none: "Nowhere to put {card}: it is lost", h_step: "Season {s}/4 · move {a}/3",
    h_board: "Holdings", h_score: "{f} fish + {t} tiles", h_lake: "Fish in the lake",
    tip_claim: "Claim: {n} fish here. You can build on it later.", tip_net: "Net: takes {k} of the {n} fish here each season.", tip_net_dry: "This tile will run dry in about {s} seasons.",
    tip_pond: "Pond: +2 here, +1 to {m} tiles around ({o} of them someone else's).", tip_fence: "Fence: keeps fish here; protects {m} of your tiles.", tip_corm: "Cormorant: would steal from {name}'s net.", tip_corm_none: "Cormorant: no neighbour's net in reach yet.", tip_lantern: "Lantern: pulls up to {m} fish a season from the tiles around ({o} someone else's).",
    tip_again: "Tap again to place", conflict: "{a} and {b} both wanted the same tile: {w} gets it (fewer tiles).",
    hv_pond: "Ponds breed", hv_lantern: "Lanterns pull fish", hv_net: "Nets haul", hv_corm: "Cormorants steal", hv_grow: "The lake breeds", hv_swim: "Fish swim away from the nets", hv_dry: "{n} tiles ran dry",
    h_paid: "+{n}", h_dry: "dry", ho_fin_s: "Winter comes. Water that ran dry stays dry; the rest breeds once more before spring.",
  },
  zh: {
    ho1t: "占水面", ho1p: "每一季选三次卡。旗子可以占一块挨着你的水面。你的每一格水面，每季给你 2 条鱼。",
    ho2t: "建设", ho2p: "渔网马上收鱼。鱼塘给周围每一格生鱼，不管是谁的。灯笼、鸬鹚、篱笆用来和邻居较劲。",
    ho3t: "看收成", ho3p: "每一季结束，湖会结算：鱼塘生鱼、渔网收鱼、鱼从网边游走。没鱼的水面会干掉。",
    ho_choice: "收的鱼加上你的地，最多的人赢，再乘上明年湖的年景。网下得太狠，湖会替所有人干掉。",
    ho_controls: "先选一张卡，再点发光的格子（点两次放下）",
    hc_claim: "旗子", hc_claim_s: "占一块挨着你的空水面。", hc_net: "渔网", hc_net_s: "每季从这一格收最多 7 条鱼。", hc_pond: "鱼塘", hc_pond_s: "这格 +2，周围每格 +1，不管是谁的。能让干掉的水面活过来。",
    hc_fence: "篱笆", hc_fence_s: "鱼不会从这里游走；灯笼和鸬鹚动不了这一格和旁边你的格子。", hc_corm: "鸬鹚", hc_corm_s: "每季从两格以内最肥的邻居的网里偷 2 条。", hc_lantern: "灯笼", hc_lantern_s: "每季从旁边每一格拉 1 条鱼过来。",
    h_pick: "选一张卡", h_place: "点一个发光的格子", h_wait: "大家在选……", h_none: "{card}没地方放：作废", h_step: "第 {s}/4 季 · 第 {a}/3 步",
    h_board: "产业", h_score: "{f} 条鱼 + {t} 格地", h_lake: "湖里的鱼",
    tip_claim: "占地：这里有 {n} 条鱼。以后可以在上面建。", tip_net: "渔网：这里 {n} 条鱼，每季收 {k} 条。", tip_net_dry: "大约 {s} 季后这格会干掉。",
    tip_pond: "鱼塘：这格 +2，周围 {m} 格各 +1（其中 {o} 格是别人的）。", tip_fence: "篱笆：鱼留在这里；护住你旁边的 {m} 格。", tip_corm: "鸬鹚：会去偷{name}的网。", tip_corm_none: "鸬鹚：附近还没有邻居的网。", tip_lantern: "灯笼：每季从周围拉最多 {m} 条鱼（其中 {o} 格是别人的）。",
    tip_again: "再点一次放下", conflict: "{a}和{b}抢同一格：{w}拿到（地少的人优先）。",
    hv_pond: "鱼塘生鱼", hv_lantern: "灯笼引鱼", hv_net: "渔网收鱼", hv_corm: "鸬鹚偷鱼", hv_grow: "湖里的鱼繁殖", hv_swim: "鱼从网边游走", hv_dry: "{n} 格水面干掉了",
    h_paid: "+{n}", h_dry: "干了", ho_fin_s: "冬天来了。干掉的水面不会自己回来；其余的水面在春天前再繁殖一次。",
  },
});
const H = { tiles: [], players: [], season: 0, action: 0, phase: "", card: null, hover: null, armed: null, hand: [], objs: [], timer: 0, log: [] };
const hName = (p) => p.isMe ? t("you") : t("bot", { name: crewName(p.c) });
const SQ3 = Math.sqrt(3);
function hexAt(q, r) { return [HO.HS * SQ3 * (q + r / 2), HO.HS * 1.5 * r + 4]; }
const nbrDirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const tileAt = (q, r) => H.byKey.get(q + "," + r);
const nbrs = (tl) => nbrDirs.map(([dq, dr]) => tileAt(tl.q + dq, tl.r + dr)).filter(Boolean);
const within2 = (tl) => H.tiles.filter(o => o !== tl && (Math.abs(o.q - tl.q) + Math.abs(o.r - tl.r) + Math.abs(o.q + o.r - tl.q - tl.r)) / 2 <= 2);

/* the board */
const hexGeo = new THREE.CircleGeometry(HO.HS * .96, 6, Math.PI / 6).rotateX(-Math.PI / 2);
const hexEdge = (() => { const p = []; for (let k = 0; k < 6; k++) { const a1 = Math.PI / 6 + k * Math.PI / 3, a2 = a1 + Math.PI / 3; p.push(Math.cos(a1) * HO.HS, 0, Math.sin(a1) * HO.HS, Math.cos(a2) * HO.HS, 0, Math.sin(a2) * HO.HS); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return g; })();
const tFishMesh = new THREE.InstancedMesh(fishGeo, toon("#ffffff"), 760); tFishMesh.visible = false; scene.add(tFishMesh);
function buildBoard() {
  H.objs.forEach(o => scene.remove(o)); H.objs = []; H.tiles = []; H.byKey = new Map();
  for (let q = -5; q <= 5; q++) for (let r = -4; r <= 4; r++) {
    const [x, z] = hexAt(q, r); if (nr(x, z) > .8) continue; if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + 2) continue;
    const zone = inZone("reeds", x, z) ? "reeds" : inZone("lotus", x, z) ? "lotus" : Math.hypot(x - ISLAND.x, z - ISLAND.z) < 22 ? "deep" : "open";
    const tl = { q, r, x, z, zone, w: zone === "deep" ? 1.35 : zone === "reeds" ? 1.15 : 1, cap: 0, fish: 0, owner: -1, build: null, dry: false, paid: 0, mesh: null, edge: null, obj: null, ix: H.tiles.length };
    const fill = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })); fill.position.set(x, .24, z); scene.add(fill);
    const edge = new THREE.LineSegments(hexEdge, new THREE.LineBasicMaterial({ color: "#d8f1ec", transparent: true, opacity: .35 })); edge.position.set(x, .26, z); scene.add(edge);
    tl.mesh = fill; tl.edge = edge; H.objs.push(fill, edge); H.tiles.push(tl); H.byKey.set(q + "," + r, tl);
  }
  // the lake's fish, spread over the water by where fish like to be
  const total = G.lake.adults + G.lake.fry, wsum = H.tiles.reduce((s, tl) => s + tl.w, 0);
  H.tiles.forEach(tl => { tl.cap = Math.max(4, Math.round(K * tl.w / wsum)); tl.fish = Math.min(tl.cap, Math.round(total * tl.w / wsum)); });
  H.start = H.tiles.reduce((s, tl) => s + tl.fish, 0);
}
function lakeFish() { return H.tiles.reduce((s, tl) => s + tl.fish, 0); }
/* next spring, on this board: ponds and breeding for one more season, and dry water stays dry */
function holdForecast() { let sum = 0; for (const tl of H.tiles) { if (tl.dry && !nbrs(tl).some(n => n.build === "pond")) continue; let f = tl.fish + (tl.build === "pond" ? HO.POND_SELF : 0) + nbrs(tl).filter(n => n.build === "pond").length * HO.POND_NEAR; f = Math.min(tl.cap, f); const g = tl.zone === "reeds" ? HO.GROW_REEDS : HO.GROW; f += f < 2 ? 0 : Math.round(f * g * (1 - f / tl.cap)); sum += Math.min(tl.cap, f); } return sum; }
function paintTile(tl) {
  const p = tl.owner >= 0 ? H.players[tl.owner] : null;
  tl.mesh.material.color.set(tl.dry ? "#6d6a62" : p ? p.c.color : "#ffffff");
  tl.mesh.material.opacity = tl.dry ? .55 : p ? .32 : 0;
  tl.edge.material.color.set(p ? p.c.color : "#d8f1ec"); tl.edge.material.opacity = p ? .9 : .3;
  if (tl.obj) { scene.remove(tl.obj); tl.obj = null; }
  if (tl.build) { tl.obj = buildingMesh(tl.build, p?.c.color ?? "#fff"); tl.obj.position.set(tl.x, 0, tl.z); scene.add(tl.obj); }
}
function buildingMesh(kind, color) {
  const g = new THREE.Group();
  if (kind === "net") { const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, .22, 6, 32).rotateX(Math.PI / 2), toon("#f5ead6")); ring.position.y = .5; const grid = new THREE.LineSegments(netGridGeo, new THREE.LineBasicMaterial({ color: "#f5ead6", transparent: true, opacity: .7 })); grid.scale.setScalar(4.4); grid.position.y = .45; for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 3, 5), toon("#5a3a26")); const a = k * Math.PI / 2 + .4; p.position.set(Math.cos(a) * 4.4, 1, Math.sin(a) * 4.4); g.add(p); } g.add(ring, grid); }
  if (kind === "pond") { const d = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, .3, 24), toon("#5fa86a")); d.position.y = .35; g.add(d); for (let k = 0; k < 10; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 2.2, 5), toon("#8fbf55")); const a = k / 10 * 6.28; p.position.set(Math.cos(a) * 4.4, 1, Math.sin(a) * 4.4); g.add(p); } const f = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.3, 6), toon("#f29ab8")); f.position.set(1, 1, .5); g.add(f); }
  if (kind === "fence") { for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28 + Math.PI / 6, rr = HO.HS * .86; const p = new THREE.Mesh(new THREE.BoxGeometry(.5, 2.4, .5), toon("#8a5a34")); p.position.set(Math.cos(a) * rr, 1.1, Math.sin(a) * rr); g.add(p); } }
  if (kind === "corm") { const post = new THREE.Mesh(new THREE.CylinderGeometry(.25, .3, 3.4, 6), toon("#5a3a26")); post.position.y = 1.6; const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8).scale(1.4, .9, .8), toon("#1f1d24")); body.position.y = 3.8; const neck = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, 1.4, 6), toon("#1f1d24")); neck.position.set(1, 4.6, 0); neck.rotation.z = -.6; const beak = new THREE.Mesh(new THREE.ConeGeometry(.2, .9, 5), toon("#e8b84d")); beak.position.set(1.8, 5.1, 0); beak.rotation.z = -Math.PI / 2; g.add(post, body, neck, beak); }
  if (kind === "lantern") { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 4, 5), toon("#3a2418")); pole.position.y = 2; const l = makeLantern(1.3); l.position.y = 4.4; g.add(pole, l); }
  const flag = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.1, 3), toon(color)); flag.position.set(-3.6, 1.6, -2.4); flag.rotation.z = Math.PI / 2; g.add(flag);
  return g;
}
/* fish drawn swimming in each tile */
let tfT = 0;
function drawTileFish(tt) {
  let i = 0;
  for (const tl of H.tiles) { const n = Math.min(12, tl.fish); for (let k = 0; k < n && i < 760; k++, i++) { const a = tt * (.4 + (k % 3) * .15) + k * 2.1 + tl.ix, rr = 1.5 + (k % 4) * .9; dummy.position.set(tl.x + Math.cos(a) * rr, -.15, tl.z + Math.sin(a) * rr * .8); dummy.rotation.set(0, -a - Math.PI / 2, 0); dummy.scale.setScalar(.9); dummy.updateMatrix(); tFishMesh.setMatrixAt(i, dummy.matrix); tFishMesh.setColorAt(i, fcol.set(k % 3 ? "#ff9a4a" : "#eef4f6")); } }
  tFishMesh.count = i; tFishMesh.instanceMatrix.needsUpdate = true; if (tFishMesh.instanceColor) tFishMesh.instanceColor.needsUpdate = true;
}

/* rules, players, hud */
function holdRules() {
  rulesCard({
    id: "hold",
    steps: [
      [t("ho1t"), t("ho1p"), (() => { let s = `<rect width="320" height="200" fill="#1d6b72"/>`; for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) s += SV.hex(50 + q * 46 + (r % 2) * 23, 50 + r * 42, 25, r === 1 && q < 2 ? "#d6473a66" : r === 1 && q === 2 ? "#e8b84d55" : "#1d6b72", r === 1 && q === 2 ? "#e8b84d" : "#0d2a30"); return s + SV.text(165, 100, "🚩", "#fff", 26); })()],
      [t("ho2t"), t("ho2p"), (() => { let s = `<rect width="320" height="200" fill="#1d6b72"/>`; for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) s += SV.hex(50 + q * 46 + (r % 2) * 23, 50 + r * 42, 25, (q + r) % 3 === 0 ? "#4a7d9c55" : "#1d6b72"); return s + SV.net(96, 92, 16) + `<circle cx="188" cy="92" r="16" fill="#5fa86a"/>` + SV.lantern(260, 54, .7) + SV.text(188, 140, "+2", "#7ccf8e", 18); })()],
      [t("ho3t"), t("ho3p"), (() => { let s = `<rect width="320" height="200" fill="#1d6b72"/>`; for (let r = 0; r < 3; r++) for (let q = 0; q < 6; q++) s += SV.hex(50 + q * 46 + (r % 2) * 23, 50 + r * 42, 25, q === 4 && r === 2 ? "#6d6a62" : "#1d6b72"); return s + SV.text(96, 70, "+4", "#e8b84d", 20) + SV.text(250, 140, LANG === "zh" ? "干了" : "dry", "#cfcac0", 16); })()],
    ],
    choice: t("ho_choice"), controls: t("ho_controls"),
    onStart: () => holdRun(),
  });
}
function holdRun() {
  hideScreen(); setSeason(0, true); fishOpts.seasonal = false; seedLake(0, 0); tFishMesh.visible = true;
  H.lakeStart = { ...G.lake };
  H.tiles.forEach(tl => { if (tl.obj) scene.remove(tl.obj); }); buildBoard();
  const ids = [G.me, ...CREW.map(c => c.id).filter(id => id !== G.me).slice(0, 3)];
  H.players = ids.map((id, i) => { const c = CREW.find(x => x.id === id); return { i, c, isMe: i === 0, dock: DOCKS[i], fish: 0, kind: c.bot, pick: null, place: null }; });
  // two tiles to start, the closest to each dock
  for (const p of H.players) { const near = H.tiles.filter(tl => tl.owner < 0).sort((a, b) => Math.hypot(a.x - p.dock.x, a.z - p.dock.z) - Math.hypot(b.x - p.dock.x, b.z - p.dock.z)); const a = near[0]; a.owner = p.i; const b = nbrs(a).filter(x => x.owner < 0).sort((u, v) => Math.hypot(u.x - p.dock.x, u.z - p.dock.z) - Math.hypot(v.x - p.dock.x, v.z - p.dock.z))[0] ?? near[1]; b.owner = p.i; }
  H.tiles.forEach(paintTile);
  cam.mode = "fixed"; cam.fx = 0; cam.fz = 12; cam.pitch = 1.12; cam.span = stage.clientWidth < 700 ? 150 : 170; cam.x = 0; cam.z = 6;
  input.steerMode = false; input.onTap = holdTap; input.onHover = holdHover;
  H.season = 0; H.firstHint = !seen("hold-played"); holdNextSeason();
}
function holdHud() {
  hud({
    top: `<div class="pill"><span class="season-chip" id="hSeasonChip">春</span><div><small id="hStep">${t("h_step", { s: H.season, a: H.action })}</small><b id="hTimer">0:20</b></div></div>
      <div class="pill lakebox"><div class="lakehead"><small>${t("lake")}</small><span class="tier" id="hTier"></span></div><div class="lakebar"><i class="now" id="hNow"></i><i id="hNext"></i>${TIERS.slice(0, 3).map(([m]) => `<i class="mark" style="left:${m * 100}%"></i>`).join("")}</div></div>`,
    side: `<div class="card0"><h4>${t("h_board")}</h4><div class="board" id="hBoard"></div></div>`,
    left: `<div class="hand" id="hHand"></div>`, mini: false,
  });
  renderHand(); renderBoard();
}
function renderBoard() {
  const el = $("#hBoard"); if (!el) return;
  const rows = H.players.map(p => ({ p, tiles: H.tiles.filter(tl => tl.owner === p.i).length })).sort((a, b) => (b.p.fish + b.tiles) - (a.p.fish + a.tiles));
  el.innerHTML = rows.map(({ p, tiles }) => `<div><span><span class="sw" style="background:${p.c.color}"></span>${hName(p)}</span><b>${t("h_score", { f: p.fish, t: tiles })}</b></div>`).join("");
}
function renderHand() {
  const el = $("#hHand"); if (!el) return;
  el.innerHTML = H.phase === "pick" || H.phase === "place" ? H.hand.map(id => `<button class="hcard" type="button" data-hc="${id}" aria-pressed="${H.card === id}"><span class="ic">${HCARDS[id].ic}</span><b>${t("hc_" + id)}</b><small>${t("hc_" + id + "_s")}</small></button>`).join("") : "";
  el.querySelectorAll("[data-hc]").forEach(b => b.onclick = () => { Music.start(); H.card = b.dataset.hc; H.armed = null; H.phase = "place"; Music.tick(); renderHand(); highlight(); coach(H.firstHint ? t("h_place") : null); if (!legal(0, H.card).length) { toast(t("h_none", { card: t("hc_" + H.card) }), "warn"); commit(null); } });
}
function deal() { const pool = ["net", "pond", "fence", "corm", "lantern"], w = pool.map(id => HCARDS[id].w); const draw = () => { let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; } return "net"; }; const a = draw(); let b = draw(); for (let k = 0; k < 6 && b === a; k++) b = draw(); return ["claim", a, b]; }
function legal(pi, card) {
  if (card === "claim") return H.tiles.filter(tl => tl.owner < 0 && nbrs(tl).some(n => n.owner === pi));
  return H.tiles.filter(tl => tl.owner === pi && !tl.build);
}
function highlight() {
  const ok = H.card ? new Set(legal(0, H.card)) : new Set();
  for (const tl of H.tiles) { tl.glow = ok.has(tl); if (!tl.glow) paintEdge(tl); }
}
function paintFill(tl) { const p = tl.owner >= 0 ? H.players[tl.owner] : null; tl.mesh.material.color.set(tl.dry ? "#6d6a62" : p ? p.c.color : "#ffffff"); tl.mesh.material.opacity = tl.dry ? .55 : p ? .32 : 0; }
function paintEdge(tl) { paintFill(tl); const p = tl.owner >= 0 ? H.players[tl.owner] : null; tl.edge.material.color.set(p ? p.c.color : "#d8f1ec"); tl.edge.material.opacity = p ? .9 : .3; }

/* the season: two picks, then the harvest */
function holdNextSeason() {
  H.season++; H.action = 0; setSeason(H.season - 1); G.phase = "play"; Music.mood("calm");
  holdHud(); banner(t("sz_" + SEASONS[seasonIx].id), t("h_step", { s: H.season, a: 1 }).split("·")[0]);
  holdNextAction();
}
function holdNextAction() {
  H.action++; H.phase = "pick"; H.card = null; H.armed = null; H.hand = deal(); H.timer = HO.PICK_S;
  H.players.forEach(p => { p.pick = null; p.place = null; });
  $("#hSeasonChip") && ($("#hSeasonChip").textContent = t("sz_" + SEASONS[seasonIx].id)); $("#hStep") && ($("#hStep").textContent = t("h_step", { s: H.season, a: H.action }));
  renderHand(); highlight(); coach(H.firstHint ? t("h_pick") : null);
  if (AUTO) later(() => { if (H.phase !== "pick") return; const choice = botChoose(H.players[0], H.hand); if (choice) { H.card = choice.card; commit(choice.tile); } else commit(null); }, 300);
}
function holdTap(x, z) {
  if (H.phase !== "place" || !H.card) return;
  const tl = H.tiles.find(tl => Math.hypot(tl.x - x, tl.z - z) < HO.HS * .9); if (!tl || !tl.glow) return;
  if (H.armed === tl || !isTouch) commit(tl); else { H.armed = tl; showTip(tl, true); Music.tick(); }
}
function holdHover(x, z) { if (H.phase !== "place" || !H.card) { tipEl.hidden = true; return; } const tl = H.tiles.find(tl => Math.hypot(tl.x - x, tl.z - z) < HO.HS * .9); H.hover = tl?.glow ? tl : null; if (H.hover) showTip(H.hover, false); else tipEl.hidden = true; }
const tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.hidden = true; stage.appendChild(tipEl);
function tipText(tl, pi, card) {
  const others = (list) => list.filter(n => n.owner >= 0 && n.owner !== pi).length;
  if (card === "claim") return t("tip_claim", { n: tl.fish });
  if (card === "net") { const k = Math.min(HO.NET_TAKE, tl.fish); return t("tip_net", { n: tl.fish, k }) + (tl.fish <= 8 ? " " + t("tip_net_dry", { s: Math.max(1, Math.ceil(tl.fish / 3)) }) : ""); }
  if (card === "pond") { const ns = nbrs(tl); return t("tip_pond", { m: ns.length, o: others(ns) }); }
  if (card === "fence") return t("tip_fence", { m: nbrs(tl).filter(n => n.owner === pi).length });
  if (card === "lantern") { const ns = nbrs(tl).filter(n => n.fish > 0 && !protectedTile(n)); return t("tip_lantern", { m: ns.length, o: others(ns) }); }
  if (card === "corm") { const v = cormTarget(tl, pi); return v ? t("tip_corm", { name: hName(H.players[v.owner]) }) : t("tip_corm_none"); }
  return "";
}
function showTip(tl, armed) { const p = toScreen(tl.x, 1, tl.z); if (!p) return; tipEl.innerHTML = `<b>${t("hc_" + H.card)}</b> · ${tipText(tl, 0, H.card)}${armed ? `<br><span class="plus">${t("tip_again")}</span>` : ""}`; tipEl.style.left = p[0] + "px"; tipEl.style.top = p[1] + "px"; tipEl.hidden = false; }
const protectedTile = (tl) => tl.build === "fence" || nbrs(tl).some(n => n.build === "fence" && n.owner === tl.owner && tl.owner >= 0);
function cormTarget(tl, pi) { return within2(tl).filter(o => o.build === "net" && o.owner >= 0 && o.owner !== pi && !protectedTile(o)).sort((a, b) => b.fish - a.fish)[0] ?? null; }

/* bots: value every card on every legal tile */
function botChoose(p, hand) {
  let best = null;
  for (const card of hand) for (const tl of legal(p.i, card)) {
    let v = 0; const greedy = p.kind === "greedy", keeper = p.kind === "keeper";
    if (card === "claim") v = tl.fish * .5 + nbrs(tl).filter(n => n.owner < 0).length * .6 + (tl.zone === "deep" ? 1.5 : 0) + 1.5;
    if (card === "net") v = Math.min(HO.NET_TAKE, tl.fish) * (greedy ? 1.9 : keeper ? .9 : 1.4) * (HO.SEASONS - H.season + 1) * .55 + (nbrs(tl).some(n => n.build === "pond") ? 1.5 : 0);
    if (card === "pond") v = (2 + nbrs(tl).filter(n => n.owner === p.i).length * 1.6 + (H.season <= 2 ? 1.5 : 0)) * (keeper ? 1.7 : greedy ? .7 : 1.1) + nbrs(tl).filter(n => n.dry).length * 1.5;
    if (card === "fence") v = nbrs(tl).filter(n => n.owner === p.i && n.build).length * 1.4 + (tl.build ? 0 : .5) + (keeper ? 1 : 0);
    if (card === "lantern") v = nbrs(tl).filter(n => n.owner >= 0 && n.owner !== p.i && n.fish > 0 && !protectedTile(n)).length * (greedy ? 1.6 : 1) + nbrs(tl).filter(n => n.owner < 0 && n.fish > 0).length * .5;
    if (card === "corm") { const c = cormTarget(tl, p.i); v = c ? (greedy ? 5 : 3.2) : .2; }
    v += Math.random() * 1.2;
    if (!best || v > best.v) best = { card, tile: tl, v };
  }
  return best;
}
function commit(tile) {
  if (H.phase !== "pick" && H.phase !== "place") return;
  const me = H.players[0]; me.pick = tile ? H.card : null; me.place = tile; H.phase = "reveal"; tipEl.hidden = true; coach(null); renderHand();
  for (const tl of H.tiles) tl.glow = false; H.tiles.forEach(paintEdge);
  for (const p of H.players.slice(1)) { const c = botChoose(p, deal()); p.pick = c?.card ?? null; p.place = c?.tile ?? null; }
  reveal();
}
function reveal() {
  // claims on the same tile: fewer tiles wins
  const byTile = new Map(); for (const p of H.players) if (p.place && p.pick === "claim") { const l = byTile.get(p.place) ?? []; l.push(p); byTile.set(p.place, l); }
  for (const [tl, list] of byTile) if (list.length > 1) { const cnt = (p) => H.tiles.filter(x => x.owner === p.i).length; list.sort((a, b) => cnt(a) - cnt(b) || Math.random() - .5); const w = list[0]; list.slice(1).forEach(p => { p.place = null; }); if (list.some(p => p.isMe)) toast(t("conflict", { a: hName(list[0]), b: hName(list[1]), w: hName(w) })); }
  const order = H.players.filter(p => p.place); let k = 0;
  const step = () => {
    if (k >= order.length) { renderBoard(); return later(H.action < HO.ACTIONS ? holdNextAction : harvest, 700); }
    const p = order[k++], tl = p.place;
    if (p.pick === "claim") tl.owner = p.i; else tl.build = p.pick;
    paintTile(tl); ripple(tl.x, tl.z, p.c.color, 6); floatAt(tl.x, tl.z, `${HCARDS[p.pick].ic} ${hName(p)}`, p.c.color); Music.coin(k);
    later(step, 420);
  };
  step();
}
function harvest() {
  H.phase = "harvest"; Music.mood("market"); const before = lakeFish();
  const steps = [
    ["hv_pond", () => { for (const tl of H.tiles) if (tl.build === "pond") { tl.fish = Math.min(tl.cap, tl.fish + HO.POND_SELF); tl.dry = false; floatAt(tl.x, tl.z, "+" + HO.POND_SELF, "#7ccf8e"); for (const n of nbrs(tl)) { n.fish = Math.min(n.cap, n.fish + HO.POND_NEAR); if (n.dry) { n.dry = false; paintTile(n); } ripple(n.x, n.z, "#7ccf8e", 4); } } }],
    ["hv_lantern", () => { for (const tl of H.tiles) if (tl.build === "lantern") for (const n of nbrs(tl)) if (n.fish > 0 && !protectedTile(n) && tl.fish < tl.cap) { n.fish--; tl.fish++; flyFish(n.x, n.z, tl.x, tl.z, .6); } }],
    ["hv_net", () => { for (const tl of H.tiles) { tl.paid = 0; if ((tl.build === "net" || (!tl.build && !tl.dry)) && tl.owner >= 0) { const k = Math.min(tl.build === "net" ? HO.NET_TAKE : HO.BASE, tl.fish); tl.fish -= k; tl.paid = k; H.players[tl.owner].fish += k; const p = H.players[tl.owner]; if (k) { floatAt(tl.x, tl.z, t("h_paid", { n: k }), p.c.color, true); flyFish(tl.x, tl.z, p.dock.x, p.dock.z, .9); } if (p.isMe && k) Music.catchNote(k); } } }],
    ["hv_corm", () => { for (const tl of H.tiles) if (tl.build === "corm" && tl.owner >= 0) { const v = cormTarget(tl, tl.owner); if (v && v.paid > 0) { const k = Math.min(HO.CORM, v.paid); H.players[v.owner].fish -= k; H.players[tl.owner].fish += k; flyFish(v.x, v.z, tl.x, tl.z, .7); floatAt(v.x, v.z, `-${k} 🐦`, "#ff8a7a"); if (H.players[v.owner].isMe) toast(`🐦 ${hName(H.players[tl.owner])} −${k}`, "warn"); } } }],
    ["hv_grow", () => { for (const tl of H.tiles) { if (tl.dry) continue; const g = tl.zone === "reeds" ? HO.GROW_REEDS : HO.GROW; const born = tl.fish < 2 ? 0 : Math.round(tl.fish * g * (1 - tl.fish / tl.cap)); if (born > 0) { tl.fish += born; ripple(tl.x, tl.z, "#7ccf8e", 3); } } }],
    ["hv_swim", () => { for (const tl of H.tiles) if (tl.build === "net" && tl.fish > 0 && !protectedTile(tl)) { const free = nbrs(tl).filter(n => n.build !== "net" && !n.dry && n.fish < n.cap); if (free.length) { const n = pick(free); tl.fish--; n.fish++; } }
      let dried = 0; for (const tl of H.tiles) if (!tl.dry && tl.fish <= 0) { tl.dry = true; tl.fish = 0; dried++; paintTile(tl); floatAt(tl.x, tl.z, t("h_dry"), "#cfcac0"); } if (dried) toast(t("hv_dry", { n: dried }), "warn"); }],
  ];
  let k = 0; const go = () => { if (k >= steps.length) { H.log.push({ before, after: lakeFish() }); renderBoard(); return later(() => H.season >= HO.SEASONS ? holdFinale() : holdNextSeason(), 900); } const [key, fn] = steps[k++]; banner(t(key)); fn(); renderBoard(); later(go, 1300); };
  go();
}
function holdFinale() {
  markSeen("hold-played");
  const a = lakeFish(), next = holdForecast(), tier = tierOf(next);
  ceremony({
    mode: "hold", sub: t("ho_fin_s"), a, y: 0, next, fair: Math.round(H.start * .35 / H.players.length),
    ledger: H.players.map(p => ({ c: p.c, isMe: p.isMe, home: p.fish, young: 0, spared: 0 })),
    rows: H.players.map(p => { const tiles = H.tiles.filter(tl => tl.owner === p.i).length; const base = p.fish + tiles * HO.TILE_PTS; return { c: p.c, isMe: p.isMe, base, score: Math.round(base * tier.mult), sub: t("h_score", { f: p.fish, t: tiles }) }; }),
    again: () => holdRun(),
  });
}
function holdUpdate(dt) {
  if (H.phase === "pick" || H.phase === "place") { H.timer -= dt; if (H.timer <= 0) { const c = botChoose(H.players[0], H.hand); if (c) { H.card = c.card; commit(c.tile); } else commit(null); } }
}
function holdDraw(dt, tt) {
  if (!H.tiles.length || G.mode !== "hold") return;
  drawTileFish(tt);
  for (const tl of H.tiles) if (tl.glow) { const k = .5 + Math.sin(tt * 6) * .5; tl.edge.material.color.set("#e8b84d"); tl.edge.material.opacity = .6 + k * .4; tl.mesh.material.color.set(tl === H.armed || tl === H.hover ? "#ffd34d" : "#e8b84d"); tl.mesh.material.opacity = (tl === H.armed || tl === H.hover ? .45 : .14) + k * .12; }
  if (G.phase === "play") marks(H.tiles.map(tl => ({ id: "h" + tl.ix, x: tl.x, z: tl.z + 3, text: tl.dry ? t("h_dry") : String(tl.fish), cls: tl.glow ? "" : "" })));
  const tm = $("#hTimer"); if (tm) tm.textContent = H.phase === "pick" || H.phase === "place" ? `0:${String(Math.max(0, Math.ceil(H.timer))).padStart(2, "0")}` : "—";
  if ((tt * 3 | 0) !== H.hudT) { H.hudT = tt * 3 | 0; const a = lakeFish(), fc = holdForecast(), tier = tierOf(fc);
    const nw = $("#hNow"), nx = $("#hNext"), tc = $("#hTier"); if (nw) nw.style.width = `${Math.min(100, a / K * 100)}%`; if (nx) { nx.style.width = `${Math.min(100, fc / K * 100)}%`; nx.style.background = tierCol[tier.id]; } if (tc) { tc.className = `tier t-${tier.id}`; tc.textContent = `${t("v_" + tier.id)} ×${tier.mult}`; } }
}
MODES.hold = {
  start() { setSeason(0, true); fishOpts.seasonal = false; seedLake(0, 0); buildBoard(); tFishMesh.visible = true; cam.mode = "overview"; holdRules(); },
  update: holdUpdate, draw: holdDraw,
  end() { H.tiles.forEach(tl => { if (tl.obj) scene.remove(tl.obj); }); H.objs.forEach(o => scene.remove(o)); H.objs = []; H.tiles = []; tFishMesh.visible = false; tipEl.hidden = true; fishOpts.seasonal = true; seedLake(G.lake.adults, G.lake.fry); },
  relabel() { if (G.phase === "play") holdHud(); },
  key(code) { if ((H.phase === "pick" || H.phase === "place") && /^Digit[123]$/.test(code)) { const id = H.hand[+code.slice(5) - 1]; if (id) { H.card = id; H.phase = "place"; renderHand(); highlight(); } } },
};
