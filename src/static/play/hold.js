// Lake Holdings on /play: the hex lake, the current, the schools, everyone's
// water and buildings, and this seat's own hand, all as the server sent them.
// Sends only "play this card on this tile". Before you place a card, the
// tile shows what it paid (or would have paid) last tide. It decides nothing.
import { FAC } from "./art.js";

const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
const CARDS = ["net", "pond", "fence", "cormorant", "lantern", "claim"];
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const dirAngle = (d) => { const [dq, dr] = DIRS[d]; return Math.atan2(1.5 * dr, Math.sqrt(3) * (dq + dr / 2)); };

export function mount({ world, sound, ui, send, view }) {
  const t = ui.t, cardName = (c) => t(`h_card_${c}`);
  let cur = null, seats = null, card = null, fenceDir = 0, hover = null;
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const nameOf = (seat) => (seat === me() ? t("g_you") : ui.seatName(seats?.[seat]) ?? t("g_player_n", { n: seat + 1 }));
  const $ = (id) => document.getElementById(id);
  world.setCamera([0, 78, 30], [0, 0, 1]);
  ui.hud.innerHTML = `
    <div class="card"><div class="row"><div><h4>${t("h_next")}</h4><div class="big" id="h-next">0:15</div></div><div style="text-align:right"><h4>${t("h_tide")}</h4><div class="big" id="h-tide">0 / 12</div></div></div></div>
    <div class="card keep"><h4>${t("h_hand")}</h4><div class="cards" id="h-hand"></div><p class="small" id="h-help">${t("h_help")}</p></div>
    <div class="card hide-sm"><h4>${t("h_board")}</h4><div class="board" id="h-board"></div><p class="small">${t("h_tie")}</p></div>`;
  const { THREE } = world;
  const canvas = document.getElementById("gl");
  const nearest = (p) => { if (!cur) return null; let best = null, bd = 40; for (const t of cur.tiles) { const d = Math.hypot(t[1] - p[0], t[2] - p[1]); if (d < bd) { bd = d; best = t; } } return best; };
  const onDown = (e) => {
    const p = world.screenToSim(e.clientX, e.clientY); if (!p || !cur || me() === null) return;
    const t = nearest(p); if (!t) return;
    hover = t[0]; help();
    if (!card) { ui.banner(t("h_pick_first"), t("h_pick_first_s")); return; }
    send({ k: "play", card, tile: t[0], ...(card === "fence" ? { dir: fenceDir } : {}) });
    ui.did("place"); if (card === "claim") ui.did("claim");
    card = null; renderHand(); labels();
  };
  canvas.addEventListener("pointerdown", onDown);
  $("h-hand").addEventListener("click", (e) => {
    const b = e.target.closest("[data-card]"); if (b) { card = card === b.dataset.card ? null : b.dataset.card; ui.did("pick"); renderHand(); help(); labels(); }
    const r = e.target.closest("[data-rot]"); if (r) { fenceDir = (fenceDir + 1) % 6; renderHand(); }
  });
  function help() {
    const tl = hover !== null ? cur?.tiles[hover] : null;
    const owner = tl ? (tl[3] === -1 ? t("h_open") : tl[3] === me() ? t("h_yours") : t("h_theirs", { name: nameOf(tl[3]) })) : "";
    $("h-help").textContent = card ? `${t("h_help_card", { card: cardName(card), text: t(`h_text_${card}`) })}${tl ? t(tl[4] === 0 ? "h_help_tile_paid" : "h_help_tile_would", { owner, n: tl[7] }) : t("h_help_tap")}` : tl ? t("h_help_tile", { owner, n: tl[7] }) : t("h_help");
  }
  let handKey = "";
  function renderHand() {
    const hand = cur?.hand ?? [];
    const key = `${hand.join()}|${card}|${fenceDir}`;
    if (key === handKey) return; // only when it changes, so a tap never lands on a button that was just replaced
    handKey = key;
    $("h-hand").innerHTML = hand.map((c, i) => { const f = FAC.find((x) => x.id === c); return `<button class="fac" type="button" data-card="${c}" aria-pressed="${card === c}">${f?.svg ?? ""}${cardName(c)}</button>`; }).join("") + (card === "fence" ? `<button class="fac" type="button" data-rot="1">${t("h_turn")}<small>${t("h_points", { dir: t(`h_dir_${fenceDir}`) })}</small></button>` : "");
  }

  function events(ev) {
    for (const e of ev) {
      const tile = (id) => cur?.tiles[id];
      if (e.k === "net") { const x = tile(e.tile); if (x) { world.floatText(x[1], x[2], `+${e.n}`, colorOf(e.seat)); } if (e.seat === me()) sound.catch(e.n); }
      if (e.k === "dry") { const x = tile(e.tile); if (x && e.seat === me()) world.floatText(x[1], x[2], t("h_dry"), "#b9b0c6"); }
      if (e.k === "bred") { const x = tile(e.tile); if (x) { world.ripple(x[1], x[2], "#7ccf8e", 4); world.floatText(x[1], x[2], t("h_born", { n: e.n }), "#7ccf8e"); } }
      if (e.k === "cormorant") { const x = tile(e.tile); if (x) world.floatText(x[1], x[2], t("h_cormorant", { n: e.n }), "#ff7a6a", 4); if (e.from === me()) { ui.banner(t("h_corm_b", { name: nameOf(e.seat) }), t("h_corm_b_s", { n: e.n })); sound.hit(); world.shake(); } if (e.seat === me()) sound.coin(); }
      if (e.k === "dry-lane") { const x = tile(e.tile); if (x) world.floatText(x[1], x[2], t("h_ran_dry"), "#b9b0c6", 4); }
      if (e.k === "revived") { const x = tile(e.tile); if (x) { world.ripple(x[1], x[2], "#7ccf8e", 5); world.floatText(x[1], x[2], t("h_revived"), "#7ccf8e", 4); } }
      if (e.k === "thin") { const x = tile(e.tile); if (x) world.ripple(x[1], x[2], "#8a7f6a", 3); }
      if (e.k === "claimed" || e.k === "taken") { const x = tile(e.tile); if (x) world.ripple(x[1], x[2], colorOf(e.seat), 4); if (e.k === "taken" && e.from === me()) { ui.banner(t("h_took", { name: nameOf(e.seat) }), t("h_took_s")); sound.hit(); } }
      if (e.k === "built") { const x = tile(e.tile); if (x) world.ripple(x[1], x[2], "#e8b84d", 4); if (e.seat === me()) sound.coin(); }
      if (e.k === "tide") { ui.banner(t("h_tide_b", { n: e.n }), t("h_tide_b_s", { n: e.fish }), 1600); sound.bank(); }
      if (e.k === "end") sound.horn();
    }
  }

  function hudFrom(f) {
    ui.setClock(f.left, t("h_clock", { n: Math.ceil(f.next) }));
    $("h-next").textContent = `0:${String(Math.ceil(f.next)).padStart(2, "0")}`;
    $("h-tide").textContent = `${f.tide} / ${f.tides}`;
    const rows = f.harvest.map((h, p) => [p, f.held[p] + h, f.held[p], h]).sort((a, b) => b[1] - a[1] || b[3] - a[3]);
    $("h-board").innerHTML = rows.map(([p, sc, tl, h], i) => `<div><span><span class="swatch" style="background:${colorOf(p)}"></span>${i === 0 ? "👑 " : ""}${ui.esc(nameOf(p))}</span><b>${sc} <small>${t("h_score", { tiles: tl, fish: h })}</small></b></div>`).join("");
    ui.goalEl.textContent = rows[0] ? t("h_goal", { name: nameOf(rows[0][0]) }) : t("h_goal_none");
    renderHand(); help(); labels();
  }
  // where the selected card could go, with what a net there would have paid last tide; the best three are marked
  const preview = { best: [] };
  function placeable(c, tl) {
    if (me() === null) return false;
    if (c === "claim") return tl[3] !== me() && cur.tiles.some((o) => o[3] === me() && Math.hypot(o[1] - tl[1], o[2] - tl[2]) < 37 * 1.9);
    return tl[3] === me() && tl[4] < 0;
  }
  function labels() {
    if (!cur) return;
    const list = [];
    for (const tl of cur.tiles) if (tl[4] === 0) list.push([`p${tl[0]}`, tl[1], tl[2], t("h_paid", { n: tl[7] }), tl[7] ? "paid" : "paid zero"]);
    preview.best = [];
    if (card) {
      const spots = cur.tiles.filter((tl) => placeable(card, tl) && tl[4] !== 0);
      preview.best = [...spots].sort((a, b) => b[7] - a[7]).slice(0, 3).filter((tl) => tl[7] > 0).map((tl) => tl[0]);
      for (const tl of spots) list.push([`v${tl[0]}`, tl[1], tl[2], `${tl[7]}`, preview.best.includes(tl[0]) ? "best" : "could"]);
    }
    for (const tl of cur.tiles) if (tl[9] === 1) list.push([`d${tl[0]}`, tl[1], tl[2], t("h_dry"), "dry"]);
    world.setLabels(list);
  }

  function coach() {
    if (!cur || me() === null) return;
    ui.coach([
      ["pick", t("h_coach_pick")],
      ["place", t("h_coach_place"), () => card !== null],
      ["claim", t("h_coach_claim"), () => cur.hand.includes("claim")],
    ]);
  }

  // ---- the board in 3D ----
  const HS = 3.7, hexGeo = new THREE.CircleGeometry(HS * .94, 6, Math.PI / 6).rotateX(-Math.PI / 2);
  const arrowGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([.9, 0, 0, -.5, 0, .45, -.5, 0, -.45], 3)); return g; })();
  let fills = [], arrows = null, lines = null, built = new Map();
  function buildBoard(f) {
    for (const m of fills) world.scene.remove(m); fills = [];
    if (arrows) world.scene.remove(arrows); if (lines) world.scene.remove(lines);
    const p = [];
    for (const t of f.tiles) { const [x, z] = [(t[1] - 500) / 10, (t[2] - 350) / 10]; for (let k = 0; k < 6; k++) { const a1 = Math.PI / 6 + k * Math.PI / 3, a2 = a1 + Math.PI / 3; p.push(x + HS * Math.cos(a1), .16, z + HS * Math.sin(a1), x + HS * Math.cos(a2), .16, z + HS * Math.sin(a2)); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: "#d8f3ee", transparent: true, opacity: .25 })); world.scene.add(lines);
    arrows = new THREE.InstancedMesh(arrowGeo, new THREE.MeshBasicMaterial({ color: "#d8f3ee", transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }), f.tiles.length); world.scene.add(arrows);
    for (const t of f.tiles) { const m = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })); m.position.set((t[1] - 500) / 10, .13, (t[2] - 350) / 10); world.scene.add(m); fills.push(m); }
  }
  function facMesh(kind, color, dir) {
    const g = new THREE.Group();
    if (kind === "net") { for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, p = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.6, 5), world.toon("#5a3a26")); p.position.set(Math.cos(a) * 2.4, .5, Math.sin(a) * 2.4); g.add(p); } const n = new THREE.Mesh(new THREE.CircleGeometry(2.4, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#f5ead6", transparent: true, opacity: .2, depthWrite: false })); n.position.y = .2; g.add(n); }
    if (kind === "pond") { const p = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20).rotateX(-Math.PI / 2), world.toon("#3c8f6a")); p.position.y = .18; g.add(p); for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CircleGeometry(.6, 10).rotateX(-Math.PI / 2), world.toon("#7ccf8e")); l.position.set(Math.cos(k * 1.7) * 1.4, .22, Math.sin(k * 1.7) * 1.4); g.add(l); } }
    if (kind === "fence") { for (let k = -2; k <= 2; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 1.8, 5), world.toon("#c99a5a")); p.position.set(0, .6, k * 1.2); g.add(p); } for (const y of [.6, 1.2]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.12, .14, 5.2), world.toon(color)); r.position.y = y; g.add(r); } g.rotation.y = -dirAngle(dir) + Math.PI / 2; }
    if (kind === "cormorant") { const p = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, 2, 6), world.toon("#5a3a26")); p.position.y = .8; const body = new THREE.Mesh(new THREE.SphereGeometry(.6, 10, 8).scale(.8, 1.3, .8), world.toon("#22222c")); body.position.y = 2.3; const head = new THREE.Mesh(new THREE.SphereGeometry(.32, 8, 6), world.toon("#22222c")); head.position.set(.3, 3.3, 0); g.add(p, body, head); }
    if (kind === "lantern") { const p = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 2.4, 5), world.toon("#3a2418")); p.position.y = 1; const l = world.makeLantern(.9); l.position.y = 2.6; g.add(p, l); }
    return g;
  }
  const dummy = new THREE.Object3D();
  function draw(dt, t) {
    if (!cur || !arrows) return;
    cur.tiles.forEach((tl, i) => {
      const fill = fills[i]; if (!fill) return;
      const dry = tl[9] === 1, best = card && preview.best.includes(tl[0]);
      fill.material.color.set(dry ? "#7b7b7b" : best ? "#e8b84d" : tl[3] >= 0 ? colorOf(tl[3]) : tl[6] ? "#6f5a3a" : "#ffffff");
      fill.material.opacity = dry ? .55 : best ? .55 : tl[3] >= 0 ? (i === hover ? .5 : .3) : tl[6] ? .25 : i === hover ? .15 : 0;
      const a = tl[5] >= 0 ? dirAngle(tl[5]) : 0, k = (t * .45 + i * .13) % 1, s = tl[5] >= 0 ? Math.sin(k * Math.PI) : 0;
      dummy.position.set((tl[1] - 500) / 10 + Math.cos(a) * (k - .5) * 2.6, .2, (tl[2] - 350) / 10 + Math.sin(a) * (k - .5) * 2.6); dummy.rotation.set(0, -a, 0); dummy.scale.setScalar(.85 * s); dummy.updateMatrix(); arrows.setMatrixAt(i, dummy.matrix);
      const key = tl[4] >= 0 ? `${CARDS[tl[4]]}:${tl[3]}:${tl[5]}` : null, had = built.get(tl[0]);
      if (had && had.key !== key) { world.scene.remove(had.m); built.delete(tl[0]); }
      if (key && !built.has(tl[0])) { const m = facMesh(CARDS[tl[4]], colorOf(tl[3]), tl[5]); m.position.set((tl[1] - 500) / 10, 0, (tl[2] - 350) / 10); world.scene.add(m); built.set(tl[0], { key, m }); }
    });
    arrows.instanceMatrix.needsUpdate = true;
    const fish = [];
    for (const sc of cur.schools) { const tl = cur.tiles[sc[1]]; if (!tl) continue; for (let i = 0; i < Math.min(sc[2], 14); i++) { const a = i * 2.39 + t * .5; fish.push([tl[1] + Math.cos(a) * (6 + i * 1.6), tl[2] + Math.sin(a) * (5 + i * 1.2), a + Math.PI / 2, .9]); } }
    world.setFish(fish, t);
    world.setLanterns(cur.tiles.filter((x) => x[4] === 4).map((x) => [x[1], x[2], 1]));
  }

  return {
    room(v) { seats = v.seats; },
    start(frame, v) { seats = v.seats; cur = frame; world.setDocks([]); buildBoard(frame); world.onFrame(draw); hudFrom(frame); },
    frame(f, ev) { seats = view().seats ?? seats; if (!cur || cur.tiles.length !== f.tiles.length) buildBoard(f); cur = f; events(ev); hudFrom(f); coach(); },
    end() { world.setLabels([]); canvas.removeEventListener("pointerdown", onDown); for (const m of fills) world.scene.remove(m); if (arrows) world.scene.remove(arrows); if (lines) world.scene.remove(lines); for (const b of built.values()) world.scene.remove(b.m); },
  };
}
