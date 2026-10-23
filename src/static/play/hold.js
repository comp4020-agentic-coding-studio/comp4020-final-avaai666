// Lake Holdings on /play (holdings 2.0, DESIGN.md "Lake Holdings 抢地盘经营 (2.0)"):
// the hex board over the v5 lake (world5.js), everyone's water and
// buildings, and this seat's own hand, all as the server sent them. Pick a
// card: the legal tiles glow; hover (or tap once on a phone) to see a
// one-line preview; click (or tap again) to place. Then the reveal, one
// placement at a time, and the harvest, step by step. Sends only "place
// this card on this tile" (or "pass" when nothing fits). The preview only
// reads the board the server sent; it decides nothing.
import { FAC } from "./art.js";
import { ceremonySteps } from "./ceremony.js";

const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const ICON = { claim: "claim", net: "net", pond: "pond", fence: "fence", corm: "cormorant", lantern: "lantern" };
// tiles: [ix, q, r, x*10, y*10, zone, cap, fish, owner, build, dry, paid]
const T = { ix: 0, q: 1, r: 2, x: 3, y: 4, zone: 5, cap: 6, fish: 7, owner: 8, build: 9, dry: 10, paid: 11 };

export function mount({ world, sound, ui, send, view, post }) {
  const t = ui.t, esc = ui.esc;
  const bootEl = document.getElementById("boot");
  const boot = bootEl ? JSON.parse(bootEl.textContent) : { lang: "en", world: {} };
  const W = { tiers: [[0.6, "rich", 1.2], [0.35, "fair", 1], [0.15, "lean", 0.8], [0, "none", 0.5]], k: 340, ...(boot.world ?? {}) };
  let cur = null, seats = null, card = null, armed = null, hover = null, sent = false, lastKey = "", lastPhase = "";
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const charOf = (seat) => seats?.[seat]?.character ?? "mei";
  const nameOf = (seat) => (seat === me() ? t("g_you") : ui.seatName(seats?.[seat]) ?? t("g_player_n", { n: seat + 1 }));
  const $ = (id) => document.getElementById(id);
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const HS = 8.4;

  world.setCameraMode("overview");
  world.setSteerMode(false);
  world.setSeason(0, true);

  // ---- the board's meshes: one hex fill and edge per tile, built once per match ----
  const { THREE } = world;
  const hexGeo = new THREE.CircleGeometry(HS * 0.96, 6, Math.PI / 6).rotateX(-Math.PI / 2);
  const edgeGeo = (() => { const p = []; for (let k = 0; k < 6; k++) { const a1 = Math.PI / 6 + (k * Math.PI) / 3, a2 = a1 + Math.PI / 3; p.push(Math.cos(a1) * HS, 0, Math.sin(a1) * HS, Math.cos(a2) * HS, 0, Math.sin(a2) * HS); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return g; })();
  const meshes = new Map(); // ix -> { fill, edge, obj, build, owner }
  function ensureBoard(tiles) {
    for (const tl of tiles) {
      if (meshes.has(tl[T.ix])) continue;
      const [wx, wz] = world.toWorld(tl[T.x] / 10, tl[T.y] / 10);
      const fill = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })); fill.position.set(wx, 0.24, wz);
      const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: "#d8f1ec", transparent: true, opacity: 0.35 })); edge.position.set(wx, 0.26, wz);
      world.scene.add(fill, edge);
      meshes.set(tl[T.ix], { fill, edge, obj: null, build: "", owner: -2, wx, wz });
    }
  }
  function clearBoard() { for (const m of meshes.values()) { world.scene.remove(m.fill, m.edge); if (m.obj) world.scene.remove(m.obj); } meshes.clear(); }
  function buildingMesh(kind, color) {
    const g = new THREE.Group(), toon = world.toon;
    if (kind === "net") { const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.22, 6, 32).rotateX(Math.PI / 2), toon("#f5ead6")); ring.position.y = 0.5; g.add(ring); for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 5), toon("#5a3a26")); const a = (k * Math.PI) / 2 + 0.4; p.position.set(Math.cos(a) * 4.4, 1, Math.sin(a) * 4.4); g.add(p); } }
    if (kind === "pond") { const d = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.3, 24), toon("#5fa86a")); d.position.y = 0.35; g.add(d); const f = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.3, 6), toon("#f29ab8")); f.position.set(1, 1, 0.5); g.add(f); }
    if (kind === "fence") for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28 + Math.PI / 6, rr = HS * 0.86; const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.5), toon("#8a5a34")); p.position.set(Math.cos(a) * rr, 1.1, Math.sin(a) * rr); g.add(p); }
    if (kind === "corm") { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.4, 6), toon("#5a3a26")); post.position.y = 1.6; const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8).scale(1.4, 0.9, 0.8), toon("#1f1d24")); body.position.y = 3.8; const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 5), toon("#e8b84d")); beak.position.set(1.6, 4.1, 0); beak.rotation.z = -Math.PI / 2; g.add(post, body, beak); }
    if (kind === "lantern") { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 5), toon("#3a2418")); pole.position.y = 2; const l = world.makeLantern(1.3); l.position.y = 4.4; g.add(pole, l); }
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 3), toon(color)); flag.position.set(-3.6, 1.6, -2.4); flag.rotation.z = Math.PI / 2; g.add(flag);
    return g;
  }
  function paintBoard(tt) {
    if (!cur) return;
    const ok = legalSet();
    for (const tl of cur.t) {
      const m = meshes.get(tl[T.ix]); if (!m) continue;
      const owner = tl[T.owner], col = owner >= 0 ? colorOf(owner) : "#ffffff", dry = tl[T.dry] === 1;
      const glow = ok.has(tl[T.ix]), hot = glow && (armed === tl[T.ix] || hover === tl[T.ix]);
      const k = 0.5 + Math.sin(tt * 6) * 0.5;
      m.fill.material.color.set(hot ? "#ffd34d" : glow ? "#e8b84d" : dry ? "#6d6a62" : col);
      m.fill.material.opacity = hot ? 0.5 : glow ? 0.14 + k * 0.12 : dry ? 0.55 : owner >= 0 ? 0.32 : 0;
      m.edge.material.color.set(glow ? "#e8b84d" : owner >= 0 ? col : "#d8f1ec"); m.edge.material.opacity = glow ? 0.6 + k * 0.4 : owner >= 0 ? 0.9 : 0.3;
      if (m.build !== tl[T.build] || m.owner !== owner) {
        if (m.obj) world.scene.remove(m.obj);
        m.obj = tl[T.build] ? buildingMesh(tl[T.build], col) : null;
        if (m.obj) { m.obj.position.set(m.wx, 0, m.wz); world.scene.add(m.obj); }
        m.build = tl[T.build]; m.owner = owner;
      }
    }
  }
  // fish drawn swimming in each tile (just the count the server sent, up to 12 a tile)
  function drawFish(tt) {
    if (!cur) return;
    const list = [];
    for (const tl of cur.t) { const n = Math.min(12, tl[T.fish]), x0 = tl[T.x] / 10, y0 = tl[T.y] / 10; for (let k = 0; k < n; k++) { const a = tt * (0.4 + (k % 3) * 0.15) + k * 2.1 + tl[T.ix], rr = 1.5 + (k % 4) * 0.9; list.push([x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr * 0.8, -a - Math.PI / 2 + Math.PI, 0.9]); } }
    world.setFish(list, tt);
  }
  function labels() {
    if (!cur) return;
    world.setLabels(cur.t.map((tl) => [`h${tl[T.ix]}`, tl[T.x] / 10, tl[T.y] / 10 + 3, tl[T.dry] ? t("h2_dry") : String(tl[T.fish]), tl[T.dry] ? "dry" : tl[T.paid] ? "paid" : ""]));
  }

  // ---- what you may do: legal tiles for the picked card, from the board as sent ----
  const tileAt = () => new Map(cur.t.map((x) => [`${x[T.q]},${x[T.r]}`, x]));
  const nbrsOf = (tl, at = tileAt()) => DIRS.map(([a, b]) => at.get(`${tl[T.q] + a},${tl[T.r] + b}`)).filter(Boolean);
  function legalFor(c) {
    if (!cur || me() === null) return [];
    const at = tileAt(), seat = me();
    if (c === "claim") return cur.t.filter((tl) => tl[T.owner] === -1 && nbrsOf(tl, at).some((x) => x[T.owner] === seat));
    return cur.t.filter((tl) => tl[T.owner] === seat && !tl[T.build]);
  }
  const legalSet = () => new Set(cur?.phase === "pick" && card && !sent ? legalFor(card).map((x) => x[T.ix]) : []);
  // a one-line preview of what the card would do on this tile
  function preview(tl, c) {
    const at = tileAt(), ns = nbrsOf(tl, at), seat = me();
    const others = (list) => list.filter((x) => x[T.owner] >= 0 && x[T.owner] !== seat).length;
    const fenced = (x) => x[T.build] === "fence" || (x[T.owner] >= 0 && nbrsOf(x, at).some((y) => y[T.build] === "fence" && y[T.owner] === x[T.owner]));
    const n = tl[T.fish];
    if (c === "claim") return t("h2_tip_claim", { n });
    if (c === "net") { const k = Math.min(7, n); return t("h2_tip_net", { n, k }) + (n <= 8 ? " " + t("h2_tip_net_dry", { s: Math.max(1, Math.ceil(n / 3)) }) : ""); }
    if (c === "pond") return t("h2_tip_pond", { m: ns.length, o: others(ns) });
    if (c === "fence") return t("h2_tip_fence", { m: ns.filter((x) => x[T.owner] === seat).length });
    if (c === "lantern") { const pull = ns.filter((x) => x[T.fish] > 0 && !fenced(x)); return t("h2_tip_lantern", { m: pull.length, o: others(pull) }); }
    if (c === "corm") {
      const d = (a, b) => (Math.abs(a[T.q] - b[T.q]) + Math.abs(a[T.r] - b[T.r]) + Math.abs(a[T.q] + a[T.r] - b[T.q] - b[T.r])) / 2;
      const v = cur.t.filter((o) => o !== tl && d(o, tl) <= 2 && o[T.build] === "net" && o[T.owner] >= 0 && o[T.owner] !== seat && !fenced(o)).sort((a, b) => b[T.fish] - a[T.fish])[0];
      return v ? t("h2_tip_corm", { name: nameOf(v[T.owner]) }) : t("h2_tip_corm_none");
    }
    return "";
  }
  const tipEl = document.createElement("div"); tipEl.className = "tip h2-tip"; tipEl.hidden = true; ui.stage.appendChild(tipEl);
  const pv = new THREE.Vector3();
  function showTip(tl, isArmed) {
    const [wx, wz] = world.toWorld(tl[T.x] / 10, tl[T.y] / 10); pv.set(wx, 1, wz).project(world.camera);
    tipEl.innerHTML = `<b>${esc(t(`h2_c_${card}`))}</b> · ${esc(preview(tl, card))}${isArmed ? `<br><span class="plus">${esc(t("h2_tip_again"))}</span>` : ""}`;
    tipEl.style.left = `${(pv.x * 0.5 + 0.5) * ui.stage.clientWidth}px`; tipEl.style.top = `${(-pv.y * 0.5 + 0.5) * ui.stage.clientHeight}px`; tipEl.hidden = false;
  }
  const tileNear = (x, y) => cur?.t.find((tl) => Math.hypot(tl[T.x] / 10 - x, tl[T.y] / 10 - y) < HS * 0.9) ?? null;
  world.setTap((x, y) => {
    if (!cur || cur.phase !== "pick" || sent || me() === null) return;
    if (!card) { ui.banner(t("h2_pick_first"), t("h2_pick_first_s")); return; }
    const tl = tileNear(x, y); if (!tl || !legalSet().has(tl[T.ix])) return;
    if (touch && armed !== tl[T.ix]) { armed = tl[T.ix]; showTip(tl, true); sound.tick?.(); return; }
    place(tl);
  });
  const onMove = (e) => {
    if (touch || !cur || cur.phase !== "pick" || !card || sent) { tipEl.hidden = true; hover = null; return; }
    const p = world.screenToSim(e.clientX, e.clientY); const tl = p ? tileNear(p[0], p[1]) : null;
    if (tl && legalSet().has(tl[T.ix])) { hover = tl[T.ix]; showTip(tl, false); } else { hover = null; tipEl.hidden = true; }
  };
  world.canvas.addEventListener("pointermove", onMove);
  function place(tl) {
    send({ k: "place", card, tile: tl[T.ix] }); sent = true; armed = null; hover = null; tipEl.hidden = true;
    ui.did("place"); sound.coin?.(1); renderHand();
  }

  // ---- the HUD ----
  ui.hud.innerHTML = `
    <div class="card mine h2-top"><div class="row"><div><h4 id="h2-step"></h4><div class="big" id="h2-timer">0:20</div></div><div style="text-align:right"><h4>${esc(t("h2_lake"))}</h4><div class="big" id="h2-lake">0</div></div></div>
      <div class="h2-bar"><i class="now" id="h2-now"></i><i class="next" id="h2-next"></i>${W.tiers.slice(0, 3).map(([m]) => `<i class="mark" style="left:${m * 100}%"></i>`).join("")}</div><p class="small" id="h2-tier"></p></div>
    <div class="card hide-sm"><h4>${esc(t("h2_board"))}</h4><div class="board" id="h2-board"></div></div>
    <div class="h2-hand pads dock" id="h2-hand"></div>`;
  $("h2-hand").addEventListener("click", (e) => {
    const b = e.target.closest("[data-card]");
    if (b && cur?.phase === "pick" && !sent) {
      card = card === b.dataset.card ? null : b.dataset.card; armed = null; ui.did("pick"); sound.tick?.();
      if (card && !legalFor(card).length) { ui.banner(t("h2_none", { card: t(`h2_c_${card}`) })); if (!cur.me.hand.some((c) => legalFor(c).length)) { send({ k: "pass" }); sent = true; } card = null; }
      renderHand();
    }
  });
  function renderHand() {
    const el = $("h2-hand"); if (!el) return;
    const hand = cur?.phase === "pick" && cur.me ? cur.me.hand : [];
    const key = `${hand.join()}|${card}|${sent}|${cur?.phase}`;
    if (key === lastKey) return; lastKey = key;
    el.innerHTML = sent ? `<p class="h2-wait">${esc(t("h2_wait"))}</p>` : hand.map((c) => { const f = FAC.find((x) => x.id === ICON[c]); return `<button class="hcard" type="button" data-card="${c}" aria-pressed="${card === c}">${f?.svg ?? ""}<b>${esc(t(`h2_c_${c}`))}</b><small>${esc(t(`h2_c_${c}_s`))}</small></button>`; }).join("");
  }
  function updateHud(f) {
    $("h2-step").textContent = t("h2_step", { s: f.season, a: f.action });
    $("h2-timer").textContent = f.phase === "pick" ? `0:${String(f.left).padStart(2, "0")}` : "—";
    $("h2-lake").textContent = f.lake;
    $("h2-now").style.width = `${Math.min(100, (f.lake / W.k) * 100)}%`; $("h2-next").style.width = `${Math.min(100, (f.next / W.k) * 100)}%`;
    $("h2-next").className = `next t-${f.tier}`;
    $("h2-tier").textContent = t("h2_next", { n: f.next, tier: t(`cer_v_${f.tier}`) });
    const rows = [...f.p].sort((a, b) => b.fish + b.tiles - (a.fish + a.tiles));
    $("h2-board").innerHTML = rows.map((p) => `<div><span><span class="swatch" style="background:${colorOf(p.seat)}"></span>${esc(nameOf(p.seat))}${p.picked && f.phase === "pick" ? " ✓" : ""}</span><b>${esc(t("h2_score", { f: p.fish, t: p.tiles }))}</b></div>`).join("");
    ui.setClock(f.left, t("h2_clock", { s: f.season, a: f.action }));
    ui.goalEl.textContent = t("hold_hud");
    ui.coach([["pick", t("h2_coach_pick")], ["place", t(touch ? "h2_coach_place_touch" : "h2_coach_place")]]);
  }

  // ---- events: the reveal, one placement at a time; the harvest's banners ----
  let revealTimers = [];
  function events(ev) {
    for (const e of ev) {
      if (e.k === "reveal") {
        revealTimers.forEach(clearTimeout); revealTimers = [];
        e.list.forEach((r, i) => revealTimers.push(setTimeout(() => {
          const tl = cur?.t[r.tile]; if (!tl) return;
          world.ripple(tl[T.x] / 10, tl[T.y] / 10, colorOf(r.seat), 6);
          world.floatText(tl[T.x] / 10, tl[T.y] / 10, `${t(`h2_c_${r.card}`)} · ${nameOf(r.seat)}${r.lost ? ` ✗` : ""}`, colorOf(r.seat));
          if (r.lost && (r.seat === me())) ui.banner(t("h2_conflict_you"));
          sound.coin?.(i + 1);
        }, i * 450)));
      }
      if (e.k === "harvest") {
        ui.banner(t(`h2_hv_${e.step}`), e.step === "swim" && e.dried?.length ? t("h2_hv_dry", { n: e.dried.length }) : "", 1200);
        if (e.step === "net") for (const [ix, n] of e.paid ?? []) { const tl = cur?.t[ix]; if (tl) world.floatText(tl[T.x] / 10, tl[T.y] / 10, `+${n}`, colorOf(tl[T.owner])); }
        if (e.step === "corm") for (const [, vix, n] of e.thefts ?? []) { const tl = cur?.t[vix]; if (tl) { world.floatText(tl[T.x] / 10, tl[T.y] / 10, `−${n}`, "#ff8a7a"); if (tl[T.owner] === me()) ui.banner(t("h2_robbed", { n })); } }
        if (e.step === "pond" || e.step === "grow") sound.chime?.();
      }
      if (e.k === "season") ui.banner(t(`r_season_${(e.season - 1) % 4}`), t("h2_step", { s: e.season, a: 1 }), 1800);
      if (e.k === "end") sound.horn?.();
    }
  }

  function onFrame(f, ev) {
    seats = view().seats ?? seats; cur = f;
    ensureBoard(f.t);
    if (f.phase !== lastPhase) { if (f.phase === "pick") { sent = f.me?.pick !== null && f.me?.pick !== undefined; card = null; armed = null; } lastPhase = f.phase; }
    if (f.phase === "pick" && f.me && f.me.pick) sent = true;
    events(ev ?? []); updateHud(f); renderHand(); labels();
    world.setSeason(Math.max(0, f.season - 1));
  }

  // ---- the end: the shared ceremony ----
  function renderResults(v, overlayEl) {
    const r = v.results, x = r.extra ?? {};
    const tierOf = (n) => { for (const [min, id, mult] of W.tiers) if (n >= min * W.k) return { id, mult }; return { id: "none", mult: 0.5 }; };
    const next = x.next ?? r.lakeAfter, tier = tierOf(next);
    const data = {
      a: x.left?.a ?? r.lakeAfter, y: 0, next, tier, unit: t("h2_unit"),
      ledger: (x.ledger ?? []).map((l) => ({ seat: l.seat, name: nameOf(l.seat), character: charOf(l.seat), isMe: l.seat === me(), home: l.home, young: 0, spared: 0 })),
      fairShare: Math.max(1, Math.round((x.ledger ?? []).reduce((n, l) => n + l.home, 0) / Math.max(1, (x.ledger ?? []).length))),
      titles: [],
      podium: r.seats.map((s) => ({ seat: s.seat, name: nameOf(s.seat), character: charOf(s.seat), isMe: s.seat === me(), base: s.base ?? s.score, score: s.score, sub: t("h2_score", { f: s.fish ?? 0, t: s.tiles ?? 0 }) })),
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

  world.onFrame((dt, tt) => { paintBoard(tt); drawFish(tt); });
  return {
    room(v) { seats = v.seats; },
    start(frame, v) { seats = v.seats; clearBoard(); lastPhase = ""; onFrame(frame, []); world.setDocks(seats.map((s, i) => ({ x: world.docks[i]?.x ?? 0, y: world.docks[i]?.z ?? 0, color: COLORS[s.character] }))); },
    frame(f, ev) { onFrame(f, ev); },
    results(v, overlayEl) { renderResults(v, overlayEl); },
    end() { revealTimers.forEach(clearTimeout); clearBoard(); tipEl.remove(); world.canvas.removeEventListener("pointermove", onMove); world.setLabels([]); world.setFish([], 0); world.setSteerMode(true); },
  };
}
