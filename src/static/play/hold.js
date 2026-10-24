// Lake Holdings on /play (model "holdings 3.0", DESIGN.md "Lake Holdings 抢地盘经营 (2.0)" · holdings 3.0;
// Ava, 24 Oct: "make it like Monopoly"). Draws the board the server sent: 24 squares round the lake (homes
// at the players' docks, the Lake Spirit between them, fishing grounds in colour groups), who owns what,
// the nets and ponds, the fish on each ground, and every boat on its square. On your turn: ROLL (or
// Space), then the pads for the square you landed on. Before rolling you may tap one of your own empty
// grounds and build on it. Tapping any square says what it is. Sends only roll, buy, pass, haul and build;
// it computes no outcome: the die, the tolls, the cards and the breeding all come from the server.
import { ceremonySteps } from "./ceremony.js";

const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
// the colour band of a ground's group, as on a Monopoly board (cycled when there are more groups)
const GROUP = ["#8b5a2b", "#7ec8e3", "#d2559b", "#f08a24", "#e23b3b", "#f2d33d", "#2f9a5c", "#2f5fb3"];
// squares: [ix, type, x*10, y*10, home, group, price, owner, build, stock, cap, toll]
const S = { ix: 0, type: 1, x: 2, y: 3, home: 4, group: 5, price: 6, owner: 7, build: 8, stock: 9, cap: 10, toll: 11 };

export function mount({ world, sound, ui, send, view, post }) {
  const t = ui.t, esc = ui.esc;
  const bootEl = document.getElementById("boot");
  const boot = bootEl ? JSON.parse(bootEl.textContent) : { lang: "en", world: {} };
  const W = { tiers: [[0.6, "rich", 1.2], [0.35, "fair", 1], [0.15, "lean", 0.8], [0, "none", 0.5]], k: 340, ...(boot.world ?? {}) };
  let cur = null, seats = null, sel = null, sent = "", lastKey = "", frameAt = 0;
  const me = () => view().mySeat;
  const myTurn = () => cur && me() !== null && me() !== undefined && cur.turn === me();
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const charOf = (seat) => seats?.[seat]?.character ?? "mei";
  const nameOf = (seat) => (seat === me() ? t("g_you") : ui.seatName(seats?.[seat]) ?? t("g_player_n", { n: seat + 1 }));
  const $ = (id) => document.getElementById(id);
  const sx = (q) => q[S.x] / 10, sy = (q) => q[S.y] / 10;

  world.setCameraMode("overview");
  world.setSteerMode(false);
  world.setSeason(0, true);

  // ---- the board's meshes: one tile per square, built once per match (and again if the lake changes) ----
  const { THREE } = world, toon = world.toon;
  const meshes = new Map(); // ix -> { tile, band, rim, flag, obj, key }
  let boardSig = "";
  function clearBoard() { for (const m of meshes.values()) world.scene.remove(m.g); meshes.clear(); boardSig = ""; }
  function ensureBoard(f) {
    const sig = `${f.lk?.k}|${f.sq.length}`; if (sig === boardSig) return;
    clearBoard(); boardSig = sig;
    const k = Number(f.lk?.k) || 1, R = 2.2 * k;
    for (const q of f.sq) {
      const g = new THREE.Group(), [wx, wz] = world.toWorld(sx(q), sy(q));
      g.position.set(wx, 0, wz);
      // the tile faces the lake's middle, so its colour band sits on the shore side
      g.rotation.y = -Math.atan2(sy(q), sx(q)) + Math.PI / 2;
      const base = q[S.type] === "home" ? "#f5ead6" : q[S.type] === "spirit" ? "#6b4fa0" : "#e9dcc0";
      const tile = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.06, 0.7, 6), toon(base)); tile.position.y = 0.3; g.add(tile);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, 0.12 * k, 6, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#3a2a1c" })); rim.position.y = 0.68; rim.rotation.y = Math.PI / 6; g.add(rim);
      let band = null;
      if (q[S.type] === "ground") { band = new THREE.Mesh(new THREE.BoxGeometry(R * 1.5, 0.24, R * 0.5), toon(GROUP[q[S.group] % GROUP.length])); band.position.set(0, 0.72, R * 0.6); g.add(band); }
      if (q[S.type] === "spirit") { const orb = world.glowSprite ? world.glowSprite(3 * k, "#c9a8ff") : null; if (orb) { orb.position.y = 1.6; g.add(orb); } const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 * k), toon("#d9c4ff")); gem.position.y = 1.5; g.add(gem); g.userData.gem = gem; }
      if (q[S.type] === "home") { const hc = colorOf(q[S.home]); const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95 * k, 0.9 * k, 4), toon(hc)); roof.position.y = 1.55 * k; roof.rotation.y = Math.PI / 4; const wall = new THREE.Mesh(new THREE.BoxGeometry(1.1 * k, 0.8 * k, 1.1 * k), toon("#f5ead6")); wall.position.y = 0.85 * k; g.add(wall, roof); }
      world.scene.add(g);
      meshes.set(q[S.ix], { g, tile, rim, band, flag: null, obj: null, key: "", k });
    }
  }
  function buildingMesh(kind, k) {
    const g = new THREE.Group();
    if (kind === "net") { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45 * k, 0.1 * k, 6, 24).rotateX(Math.PI / 2), toon("#f5ead6")); ring.position.y = 0.95; g.add(ring); for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * k, 0.07 * k, 1.3 * k, 5), toon("#5a3a26")); const a = (i * Math.PI) / 2 + 0.4; p.position.set(Math.cos(a) * 1.45 * k, 0.6 + 0.6 * k, Math.sin(a) * 1.45 * k); g.add(p); } }
    if (kind === "pond") { const d = new THREE.Mesh(new THREE.CylinderGeometry(1.35 * k, 1.4 * k, 0.12, 20), toon("#3f9a8a")); d.position.y = 0.72; g.add(d); for (let i = 0; i < 3; i++) { const lily = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * k, 0.28 * k, 0.05, 10), toon("#5fa86a")); lily.position.set(Math.cos(i * 2.1) * 0.7 * k, 0.8, Math.sin(i * 2.1) * 0.7 * k); g.add(lily); } const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 * k, 0.4 * k, 6), toon("#f29ab8")); f.position.set(0.7 * k, 1.0, 0); g.add(f); }
    return g;
  }
  function flagMesh(color, k) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * k, 0.06 * k, 2.2 * k, 5), toon("#3a2418")); pole.position.y = 1.1 * k + 0.4; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9 * k, 0.55 * k, 0.05), toon(color)); cloth.position.set(0.45 * k, 1.9 * k + 0.4, 0); g.add(cloth);
    g.position.set(-1.1 * k, 0, -0.6 * k);
    return g;
  }
  function paintBoard(tt) {
    if (!cur) return;
    const pulse = 0.5 + Math.sin(tt * 5) * 0.5, here = cur.p[cur.turn]?.pos;
    for (const q of cur.sq) {
      const m = meshes.get(q[S.ix]); if (!m) continue;
      const owner = q[S.owner], key = `${owner}|${q[S.build]}`;
      if (key !== m.key) {
        if (m.flag) m.g.remove(m.flag); if (m.obj) m.g.remove(m.obj);
        m.flag = owner >= 0 ? flagMesh(colorOf(owner), m.k) : null; if (m.flag) m.g.add(m.flag);
        m.obj = q[S.build] ? buildingMesh(q[S.build], m.k) : null; if (m.obj) m.g.add(m.obj);
        if (q[S.type] === "ground") m.tile.material = toon(owner >= 0 ? mix(colorOf(owner), "#f5ead6", 0.2) : q[S.stock] > 0 ? "#f1e6cc" : "#9b9486");
        m.key = key;
      }
      // the square the player whose turn it is stands on, and a ground you picked to build on, glow
      const glow = sel === q[S.ix] ? 1 : here === q[S.ix] && cur.phase !== "move" ? 0.6 : 0;
      m.rim.material.color.set(glow ? (sel === q[S.ix] ? "#ffd34d" : colorOf(cur.turn)) : "#3a2a1c");
      m.rim.scale.setScalar(glow ? 1 + pulse * 0.06 * glow : 1);
      if (m.g.userData.gem) { m.g.userData.gem.rotation.y = tt * 1.5; m.g.userData.gem.position.y = 1.5 + Math.sin(tt * 2 + q[S.ix]) * 0.2; }
    }
  }
  function mix(a, b, w) { const ca = new THREE.Color(a), cb = new THREE.Color(b); return "#" + ca.lerp(cb, w).getHexString(); }

  // ---- the boats: each on its square; the one whose turn it is sails along its path square by square ----
  function boatSpot(seat) {
    const p = cur.p[seat], N = cur.sq.length;
    const at = p.pos;
    if (cur.phase === "move" && seat === cur.turn && cur.path.length) {
      const pt = Math.min(cur.moveS, (cur.pt ?? 0) + (performance.now() - frameAt) / 1000);
      const k = Math.min(cur.path.length, (pt / cur.moveS) * cur.path.length), i = Math.floor(k);
      const a = i === 0 ? (cur.path[0] - 1 + N) % N : cur.path[i - 1], b = cur.path[Math.min(i, cur.path.length - 1)];
      const w = i >= cur.path.length ? 1 : k - i, qa = cur.sq[a], qb = cur.sq[b];
      return { x: (sx(qa) + (sx(qb) - sx(qa)) * w) * 0.8, y: (sy(qa) + (sy(qb) - sy(qa)) * w) * 0.8, h: Math.atan2(sy(qb) - sy(qa), sx(qb) - sx(qa)) };
    }
    // boats sharing a square sit in a row towards the lake's middle
    const same = cur.p.filter((o) => o.pos === at && !(cur.phase === "move" && o.seat === cur.turn)).map((o) => o.seat), slot = Math.max(0, same.indexOf(seat));
    const q = cur.sq[at], nq = cur.sq[(at + 1) % N], r = 0.8 - slot * 0.11;
    return { x: sx(q) * r, y: sy(q) * r, h: Math.atan2(sy(nq) - sy(q), sx(nq) - sx(q)) };
  }
  function drawBoats(tt) {
    if (!cur) return;
    for (const p of cur.p) {
      const b = world.boat(p.seat, colorOf(p.seat), `${nameOf(p.seat)} · ${p.coins}`);
      const s = boatSpot(p.seat);
      world.drawBoat(b, s.x, s.y, s.h, tt, { visible: true });
      b.tag.classList.toggle("me", p.seat === me());
    }
  }
  // fish swimming round each ground: just the count the server sent, up to 8 a ground
  function drawFish(tt) {
    if (!cur) return;
    const list = [], k = Number(cur.lk?.k) || 1;
    for (const q of cur.sq) { if (q[S.type] !== "ground") continue; const n = Math.min(8, q[S.stock]); for (let i = 0; i < n; i++) { const a = tt * (0.5 + (i % 3) * 0.15) + i * 2.4 + q[S.ix], rr = (1.0 + (i % 3) * 0.35) * k; list.push([sx(q) * 1.1 + Math.cos(a) * rr * 0.5, sy(q) * 1.1 + Math.sin(a) * rr * 0.5, -a - Math.PI / 2 + Math.PI, 0.55 * k]); } }
    world.setFish(list, tt);
  }
  function labels() {
    if (!cur) return;
    world.setLabels(cur.sq.filter((q) => q[S.type] === "ground").map((q) => {
      const free = q[S.owner] < 0;
      return [`h${q[S.ix]}`, sx(q), sy(q) + 2.2 * (Number(cur.lk?.k) || 1), free ? t("h3_pin_free", { n: q[S.stock], p: q[S.price] }) : t("h3_pin_owned", { n: q[S.stock] }), q[S.stock] === 0 ? "dry" : free ? "could" : ""];
    }));
  }

  // ---- what a square is: a tap on it says so ----
  const tipEl = document.createElement("div"); tipEl.className = "tip h2-tip"; tipEl.hidden = true; ui.stage.appendChild(tipEl);
  let tipTimer = 0;
  const pv = new THREE.Vector3();
  function describe(q) {
    if (q[S.type] === "home") return t("h3_sq_home", { name: nameOf(q[S.home]) });
    if (q[S.type] === "spirit") return t("h3_sq_spirit");
    const fish = t("h3_sq_fish", { n: q[S.stock], cap: q[S.cap] });
    if (q[S.owner] < 0) return `${t("h3_sq_free", { p: q[S.price] })} · ${fish}`;
    return `${t("h3_sq_owned", { name: nameOf(q[S.owner]), toll: q[S.toll] })}${q[S.build] ? ` · ${t(`h3_b_${q[S.build]}`)}` : ""} · ${fish}`;
  }
  function showTip(q, extra = "") {
    const [wx, wz] = world.toWorld(sx(q), sy(q)); pv.set(wx, 1, wz).project(world.camera);
    tipEl.innerHTML = `${esc(describe(q))}${extra ? `<br><span class="plus">${esc(extra)}</span>` : ""}`;
    tipEl.style.left = `${(pv.x * 0.5 + 0.5) * ui.stage.clientWidth}px`; tipEl.style.top = `${(-pv.y * 0.5 + 0.5) * ui.stage.clientHeight}px`; tipEl.hidden = false;
    clearTimeout(tipTimer); tipTimer = setTimeout(() => { tipEl.hidden = true; }, 3500);
  }
  const canBuildOn = (q) => cur && myTurn() && cur.phase === "roll" && !cur.built && q[S.type] === "ground" && q[S.owner] === me() && !q[S.build] && cur.p[me()].coins >= cur.cost;
  const squareNear = (x, y) => { if (!cur) return null; const k = Number(cur.lk?.k) || 1; let best = null, bd = 2.6 * k; for (const q of cur.sq) { const d = Math.hypot(sx(q) - x, sy(q) - y); if (d < bd) { bd = d; best = q; } } return best; };
  world.setTap((x, y) => {
    const q = squareNear(x, y); if (!q) { sel = null; renderPads(); return; }
    if (canBuildOn(q)) { sel = sel === q[S.ix] ? null : q[S.ix]; showTip(q, sel !== null ? t("h3_tip_build") : ""); ui.did("select"); sound.tick?.(); renderPads(); return; }
    showTip(q);
  });
  const onKey = (e) => {
    if (e.target?.closest?.("input, textarea, button")) return;
    if (e.code === "Space" && cur?.phase === "roll" && myTurn() && sent !== keyOf("roll")) { e.preventDefault(); act({ k: "roll" }); }
  };
  addEventListener("keydown", onKey);

  // ---- sending ----
  const keyOf = (what) => `${cur?.round}|${cur?.turn}|${what}`;
  function act(i) {
    if (!cur) return;
    const what = i.k === "build" && cur.phase === "roll" ? "prebuild" : cur.phase;
    if (sent === keyOf(what)) return;
    send(i); sent = keyOf(what); ui.did(i.k); sel = null;
    if (i.k === "roll") sound.tick?.(); else if (i.k === "pass") sound.tick?.(); else sound.coin?.(1);
    renderPads();
  }

  // ---- the HUD ----
  ui.hud.innerHTML = `
    <div class="card mine h2-top"><div class="row"><div><h4 id="h3-round"></h4><div class="big" id="h3-turn"></div></div><div style="text-align:right"><h4>${esc(t("h3_lake"))}</h4><div class="big" id="h3-lake">0</div></div></div>
      <div class="h2-bar"><i class="now" id="h3-now"></i><i class="next" id="h3-next"></i>${W.tiers.slice(0, 3).map(([m]) => `<i class="mark" style="left:${m * 100}%"></i>`).join("")}</div><p class="small" id="h3-tier"></p></div>
    <div class="card hide-sm"><h4>${esc(t("h3_board"))}</h4><div class="board" id="h3-board"></div></div>
    <div class="pads dock h3-pads" id="h3-pads"></div>`;
  const dieEl = document.createElement("div"); dieEl.className = "h3-die"; dieEl.hidden = true; ui.stage.appendChild(dieEl);
  $("h3-pads").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === "roll") act({ k: "roll" });
    else if (a === "buy" || a === "pass" || a === "haul") act({ k: a });
    else if (a === "net" || a === "pond") act(cur.phase === "roll" ? { k: "build", kind: a, sq: sel } : { k: "build", kind: a });
  });
  function renderPads() {
    const el = $("h3-pads"); if (!el || !cur) return;
    const mine = myTurn(), here = cur.sq[cur.p[cur.turn]?.pos ?? 0];
    const key = `${cur.phase}|${cur.turn}|${cur.round}|${cur.act.join()}|${sel}|${sent}|${cur.built}|${mine}|${cur.p[me()]?.coins}`;
    if (key === lastKey) return; lastKey = key;
    const pad = (a, label, sub, cls = "") => `<button class="pad ${cls}" type="button" data-act="${a}">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
    let html = "";
    if (cur.phase === "end") html = "";
    else if (!mine) html = `<p class="h2-wait">${esc(cur.phase === "roll" ? t("h3_wait_roll", { name: nameOf(cur.turn) }) : t("h3_wait", { name: nameOf(cur.turn) }))}</p>`;
    else if (cur.phase === "roll") {
      if (sent === keyOf("roll")) html = `<p class="h2-wait">${esc(t("h3_rolling"))}</p>`;
      else {
        html = pad("roll", t("h3_roll"), t("h3_roll_s"), "red");
        if (sel !== null && sent !== keyOf("prebuild")) html += pad("net", t("h3_net", { c: cur.cost }), t("h3_net_s")) + pad("pond", t("h3_pond", { c: cur.cost }), t("h3_pond_s"));
      }
    } else if (cur.phase === "act" && sent !== keyOf("act")) {
      for (const a of cur.act) {
        if (a === "buy") html += pad("buy", t("h3_buy", { p: here[S.price] }), t("h3_buy_s"), "red");
        if (a === "haul") html += pad("haul", t("h3_haul", { n: cur.haulN }), t("h3_haul_s"), "red");
        if (a === "net") html += pad("net", t("h3_net", { c: cur.cost }), t("h3_net_s"));
        if (a === "pond") html += pad("pond", t("h3_pond", { c: cur.cost }), t("h3_pond_s"));
        if (a === "pass") html += pad("pass", t("h3_pass"), "");
      }
    } else html = `<p class="h2-wait">${esc(t("h3_wait", { name: nameOf(cur.turn) }))}</p>`;
    el.innerHTML = html;
  }
  function updateHud(f) {
    $("h3-round").textContent = t("h3_round", { r: f.round, n: f.rounds });
    $("h3-turn").textContent = myTurn() ? t("h3_turn_you") : t("h3_turn", { name: nameOf(f.turn) });
    $("h3-lake").textContent = f.lake;
    $("h3-now").style.width = `${Math.min(100, (f.lake / W.k) * 100)}%`; $("h3-next").style.width = `${Math.min(100, (f.next / W.k) * 100)}%`;
    $("h3-next").className = `next t-${f.tier}`;
    $("h3-tier").textContent = t("h3_next", { n: f.next, tier: t(`cer_v_${f.tier}`) });
    const rows = [...f.p].sort((a, b) => b.coins - a.coins || a.seat - b.seat);
    $("h3-board").innerHTML = rows.map((p) => `<div><span><span class="swatch" style="background:${colorOf(p.seat)}"></span>${esc(nameOf(p.seat))}${p.seat === f.turn ? " ◀" : ""}</span><b>${esc(t("h3_coins", { c: p.coins, g: p.grounds }))}</b></div>`).join("");
    ui.setClock(f.left, t("h3_clock", { r: f.round, n: f.rounds }));
    ui.goalEl.textContent = t("hold_hud");
    ui.coach([["roll", t("h3_coach_roll")], ["buy", t("h3_coach_land")], ["select", t("h3_coach_tap")]]);
  }

  // ---- events: the die, landings, the Spirit's cards, the round's end ----
  let dieTimer = 0;
  function showDie(n, seat) {
    const el = dieEl;
    el.innerHTML = `<b style="border-color:${colorOf(seat)}">${n}</b><span>${esc(t("h3_rolled", { name: nameOf(seat), n }))}</span>`;
    el.hidden = false; clearTimeout(dieTimer); dieTimer = setTimeout(() => { el.hidden = true; }, 1600);
  }
  const at = (ix) => cur?.sq[ix];
  function events(ev) {
    for (const e of ev) {
      const q = e.sq !== undefined ? at(e.sq) : null;
      if (e.k === "roll") { showDie(e.n, e.seat); sound.tick?.(); }
      if (e.k === "home" && q) { world.floatText(sx(q), sy(q), `+${e.n}`, colorOf(e.seat)); if (e.seat === me()) sound.coin?.(1); }
      if (e.k === "buy" && q) { world.ripple(sx(q), sy(q), colorOf(e.seat), 4); world.floatText(sx(q), sy(q), t("h3_ev_buy", { name: nameOf(e.seat) }), colorOf(e.seat)); sound.coin?.(2); }
      if (e.k === "haul" && q) { world.netDrop?.(sx(q), sy(q), 2, colorOf(e.seat)); world.floatText(sx(q), sy(q), t("h3_ev_haul", { n: e.n }), colorOf(e.seat)); sound.coin?.(2); }
      if (e.k === "build" && q) { world.ripple(sx(q), sy(q), colorOf(e.seat), 4); world.floatText(sx(q), sy(q), t(`h3_b_${e.kind}`), colorOf(e.seat)); sound.chime?.(); }
      if (e.k === "toll" && q) {
        world.floatText(sx(q), sy(q), `−${e.n} → ${nameOf(e.owner)}`, "#ff9a86");
        if (e.seat === me()) ui.banner(t("h3_ev_toll_you", { name: nameOf(e.owner), n: e.n }), "");
        else if (e.owner === me()) ui.banner(t("h3_ev_toll_got", { name: nameOf(e.seat), n: e.n }), "");
        sound.coin?.(1);
      }
      if (e.k === "card") { ui.banner(t(`h3_card_${e.card}`), t(`h3_card_${e.card}_s`), 2200); sound.chime?.(); }
      if (e.k === "nets") for (const [ix, owner, n] of e.list) { const g = at(ix); if (g) world.floatText(sx(g), sy(g), `+${n}`, colorOf(owner)); }
      if (e.k === "ponds") for (const [ix, owner, n] of e.list) { const g = at(ix); if (g) world.floatText(sx(g), sy(g), `+${n}`, colorOf(owner), 4.5); }
      if (e.k === "breed") ui.banner(t("h3_ev_breed", { before: e.before, after: e.after }), t("h3_ev_breed_s"), 1800);
      if (e.k === "round") ui.banner(t("h3_round", { r: e.round, n: cur?.rounds ?? 8 }), "", 1400);
      if (e.k === "dead") { ui.banner(t("h3_ev_dead"), t("h3_ev_dead_s"), 2600); sound.horn?.(); }
      if (e.k === "end") sound.horn?.();
    }
  }

  function onFrame(f, ev) {
    seats = view().seats ?? seats; cur = f; frameAt = performance.now();
    world.setLake?.(f.lk); if (me() !== null && me() !== undefined) world.setHome?.(me(), colorOf(me()), t("g_your_home"));
    ensureBoard(f);
    if (sel !== null && !(f.phase === "roll" && myTurn() && canBuildOn(f.sq[sel]))) sel = null;
    events(ev ?? []); updateHud(f); renderPads(); labels();
  }

  // ---- the end: the shared ceremony ----
  function renderResults(v, overlayEl) {
    const r = v.results, x = r.extra ?? {};
    const tierOf = (n) => { for (const [min, id, mult] of W.tiers) if (n >= min * W.k) return { id, mult }; return { id: "none", mult: 0.5 }; };
    const next = x.next ?? r.lakeAfter, tier = x.dead ? { id: "none", mult: 0.5 } : tierOf(next);
    const data = {
      a: x.left?.a ?? r.lakeAfter, y: 0, next, tier, unit: t("h3_unit"), multKey: "h3_cer_mult", // coins, grounds, buildings and fish: not fish home
      ledger: (x.ledger ?? []).map((l) => ({ seat: l.seat, name: nameOf(l.seat), character: charOf(l.seat), isMe: l.seat === me(), home: l.home, young: 0, spared: 0 })),
      fairShare: Math.max(1, Math.round((x.ledger ?? []).reduce((n, l) => n + l.home, 0) / Math.max(1, (x.ledger ?? []).length))),
      titles: [],
      podium: r.seats.map((s) => ({ seat: s.seat, name: nameOf(s.seat), character: charOf(s.seat), isMe: s.seat === me(), base: s.base ?? s.score, score: s.score, sub: t("h3_coins", { c: s.coins ?? 0, g: s.grounds ?? 0 }) })),
    };
    const zh = (key) => (boot.lang === "zh" ? t(key) : (boot.other ?? {})[key] ?? key);
    const html = ceremonySteps(data, { t, esc, portrait: ui.portrait, zh });
    let step = 0;
    const render = () => {
      overlayEl.innerHTML = html[step];
      overlayEl.querySelector("[data-cer-next]")?.addEventListener("click", () => { step++; render(); });
      overlayEl.querySelector("[data-cer-skip]")?.addEventListener("click", () => { step = html.length - 1; render(); });
      overlayEl.querySelector("[data-cer-again]")?.addEventListener("click", () => post?.("start", { bots: false }));
      overlayEl.querySelector("[data-cer-village]")?.addEventListener("click", () => { location.href = `/play/${view().code}`; });
    };
    render();
    tipEl.hidden = true;
  }

  world.onFrame((dt, tt) => { paintBoard(tt); drawBoats(tt); drawFish(tt); });
  return {
    room(v) { seats = v.seats; },
    start(frame, v) { seats = v.seats; clearBoard(); sent = ""; sel = null; lastKey = ""; world.clearBoats?.(); world.setLake?.(frame.lk); world.setDocks(seats.map((s, i) => ({ x: world.docks[i]?.x ?? 0, y: world.docks[i]?.z ?? 0, color: COLORS[s.character] }))); onFrame(frame, []); },
    frame(f, ev) { onFrame(f, ev); },
    results(v, overlayEl) { renderResults(v, overlayEl); },
    end() { clearTimeout(dieTimer); clearTimeout(tipTimer); clearBoard(); tipEl.remove(); dieEl.remove(); removeEventListener("keydown", onKey); world.clearBoats?.(); world.setLabels([]); world.setFish([], 0); world.setSteerMode(true); },
  };
}
