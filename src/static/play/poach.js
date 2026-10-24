// Who's Poaching on /play (poach 2.0, DESIGN.md "Who's Poaching 谁在偷鱼 (2.0)"):
// draws what the server sent this seat — only what its lantern lights by
// day — on the v5 lake (world5.js), and sends only steer, net, inspect,
// buoy, report, fine, dump, a line to say and a vote. The role card, the
// fog, the tasks, the meeting's map and table, the tally, the exile and the
// end are all drawn here from the server's frames; nothing here decides an
// outcome, and nothing the server did not send is shown.
import { CREW } from "./art.js";
import { ceremonySteps } from "./ceremony.js";
import { makeFishView } from "./fishview.js";

const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };

export function mount({ world, sound, ui, send, view, post }) {
  const t = ui.t, esc = ui.esc;
  const bootEl = document.getElementById("boot");
  const boot = bootEl ? JSON.parse(bootEl.textContent) : { lang: "en", world: {} };
  // the lake's outline, bays and places for the meeting's map, from the page's boot JSON (src/lib/lake-world)
  // the lantern's circle and a buoy's logging circle, in lake units (game-constants POACH, via the boot JSON)
  const SIGHT = { view: 12, buoyR: 7.5, ...(boot.poachSight ?? {}) };
  const W = { lake: { x: 92, y: 64 }, outline: [], bays: [], zones: {}, island: { x: 10, y: -15, r: 7.5 }, tiers: [], k: 340, ...(boot.world ?? {}) };
  let prev = null, cur = null, curAt = 0, seats = null, lastPhase = null, lastMeetKey = "", sel = null, typedFor = null;
  const fishView = makeFishView();
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const charOf = (seat) => seats?.[seat]?.character ?? "mei";
  const nameOf = (seat) => (seat === me() ? t("g_you") : ui.seatName(seats?.[seat]) ?? t("g_boat_n", { n: seat + 1 }));
  const place = (id) => t(`p2_pl_${id}`);
  const $ = (id) => document.getElementById(id);
  const list = (arr) => arr.join(boot.lang === "zh" ? "、" : ", ");
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  world.setCameraMode("follow");
  world.setSteerMode(true);
  world.setSeason(0, true);

  // ---- the fog: a circle of lantern light round your boat (pointer-events: none, P6) ----
  const fog = document.createElement("div"); fog.className = "po-fog"; fog.hidden = true; ui.stage.appendChild(fog);
  const seenEl = document.createElement("div"); seenEl.className = "po-seen"; seenEl.hidden = true; ui.stage.appendChild(seenEl);
  const pv = new world.THREE.Vector3();
  const toScreen = (x, y) => { const [wx, wz] = world.toWorld(x, y); pv.set(wx, 0, wz).project(world.camera); return [(pv.x * 0.5 + 0.5) * ui.stage.clientWidth, (-pv.y * 0.5 + 0.5) * ui.stage.clientHeight]; };

  // ---- input ----
  world.setTap((x, y) => { if (!canAct()) return; send({ k: "steer", x, y }); ui.did("sail"); });
  const wasdId = setInterval(() => {
    if (!canAct()) return;
    const dir = world.wantDir(); if (!dir) return;
    const b = cur?.b.find((x) => x[0] === me()); if (!b) return;
    send({ k: "steer", x: Math.round((b[1] / 10 + dir.x * 12) * 10) / 10, y: Math.round((b[2] / 10 + dir.z * 12) * 10) / 10 }); ui.did("sail");
  }, 100); // ten a second while you steer (the input limit is 30)
  const canAct = () => cur && cur.phase === "day" && me() !== null && !cur.out.includes(me());
  // only what this seat can do right now is sent (the server checks again)
  const can = (k) => { const m = cur?.me; if (!m) return false; return { net: m.netCd <= 0, inspect: m.canInspect, buoy: !m.buoy, report: m.canReport, fine: cur.role === "poacher" && m.fineCd <= 0, dump: cur.role === "poacher" && m.fry > 0 }[k] ?? false; };
  const act = (k) => { if (!canAct() || !can(k)) return; send({ k }); ui.did(k); };
  const onKey = (e) => {
    if (e.target.closest?.("input,textarea") || e.repeat) return;
    const k = { Space: "net", KeyE: "inspect", KeyB: "buoy", KeyR: "report", KeyF: "fine", KeyQ: "dump" }[e.code];
    if (k) { e.preventDefault(); act(k); }
  };
  addEventListener("keydown", onKey);

  // ---- the HUD ----
  function renderHud() {
    const poacher = cur?.role === "poacher";
    ui.hud.innerHTML = `
      <div class="card mine po-status"><div class="row"><span class="po-rolechip ${poacher ? "p" : "f"}">${esc(t(poacher ? "p2_role_p" : "p2_role_f"))}</span><span class="small" id="po-seen"></span></div>
        <div class="po-health"><small>${esc(t("p2_health"))}</small><b id="po-h">100%</b></div><div class="bar po-hbar"><i id="po-hbar"></i><span class="po-line" style="left:${cur?.line ?? 40}%"></span></div></div>
      <div class="card"><h4>${esc(t(poacher ? "p2_fake_h" : "p2_tasks_h"))}</h4><ul class="po-tasks" id="po-tasks"></ul></div>
      <div class="pads dock po-pads" id="po-pads">
        <button class="pad gold small" type="button" data-act="report" id="po-report">${esc(t("p2_a_report"))}</button>
        <button class="pad jade small" type="button" data-act="buoy" id="po-buoy">${esc(t("p2_a_buoy"))}</button>
        <button class="pad jade small" type="button" data-act="inspect" id="po-inspect">${esc(t("p2_a_inspect"))}</button>
        ${poacher ? `<button class="pad small" type="button" data-act="dump" id="po-dump">${esc(t("p2_a_dump"))}</button><button class="pad red" type="button" data-act="fine" id="po-fine">${esc(t("p2_a_fine"))}<i class="cd"></i></button>` : ""}
        <button class="pad" type="button" data-act="net" id="po-net">${esc(t("p2_a_net"))}</button>
      </div>
      <p class="small hide-sm po-keys">${esc(t("p2_keys"))}</p>`;
    ui.hud.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));
  }
  function updateHud(f) {
    const h = $("po-h"), hb = $("po-hbar");
    if (h) h.textContent = `${Math.round(f.health)}%`;
    if (hb) { hb.style.width = `${Math.min(100, f.health)}%`; hb.style.background = f.health < 50 ? "var(--lacquer)" : f.health < 65 ? "var(--gold)" : "var(--jade)"; }
    const m = f.me;
    if (!m) { const pads = $("po-pads"); if (pads) pads.hidden = true; return; }
    const sn = $("po-seen"); if (sn) { sn.textContent = `👁 ${m.seen ? t("p2_seen_n", { n: m.seen }) : t("p2_seen_0")}`; sn.classList.toggle("watched", m.seen > 0); }
    const tl = $("po-tasks");
    if (tl) tl.innerHTML = m.tasks.map(([, verb, pl, , , pct, done]) => `<li class="${done ? "done" : ""}">${esc(t(`p2_v_${verb}`))} · ${esc(place(pl))}${!done && pct ? ` <b>${pct}%</b>` : ""}</li>`).join("");
    const en = (id, on) => { const b = $(id); if (b) b.disabled = !on; };
    en("po-net", m.netCd <= 0); en("po-inspect", m.canInspect); en("po-buoy", !m.buoy); en("po-report", m.canReport); en("po-dump", m.fry > 0); en("po-fine", m.fineCd <= 0);
    $("po-report")?.classList.toggle("pulse", m.canReport);
    const cd = document.querySelector("#po-fine .cd"); if (cd) cd.style.setProperty("--p", `${(m.fineCd / m.fineMax) * 100}%`);
  }

  // ---- events: toasts, floats, sounds ----
  function events(ev) {
    for (const e of ev) {
      if (e.k === "day") { ui.banner(t("p2_day_b", { n: e.day }), t("p2_day_s"), 2600); world.setCameraMode("follow"); sound.chime?.(); }
      if (e.k === "net") { world.netDrop(e.x, e.y, 3.4, colorOf(e.seat)); if (e.seat === me()) { world.floatText(e.x, e.y, e.n ? t("p2_net_n", { n: e.n }) : t("p2_net_0"), e.n ? colorOf(e.seat) : "#b9b0c6"); e.n ? sound.catch(e.n) : sound.miss(); } }
      if (e.k === "fine") { world.netDrop(e.x, e.y, 5.2, "#cf3b2e"); ui.banner(t("p2_a_fine"), t("p2_fine_done", { n: e.n, y: e.young }), 3000); world.shake(0.25); sound.hit?.(); }
      if (e.k === "sawnet") { world.netDrop(e.x, e.y, 5.2, "#cf3b2e"); world.ripple(e.x, e.y, "#ff7a5a", 6); ui.banner(t("p2_saw_net", { name: nameOf(e.seat) }), "", 3500); sound.hit?.(); }
      if (e.k === "dumped") ui.banner(t("p2_dumped"));
      if (e.k === "insp_go") ui.banner(t("p2_insp_go", { name: nameOf(e.target) }));
      if (e.k === "insp_lost") ui.banner(t("p2_insp_lost"));
      if (e.k === "insp") { ui.banner(e.res === "fry" ? t("p2_insp_fry", { name: nameOf(e.target), n: e.n }) : t("p2_insp_clean", { name: nameOf(e.target) }), "", 3500); e.res === "fry" ? sound.hit?.() : sound.chime?.(); }
      if (e.k === "inspected") ui.banner(t("p2_insp_you"));
      if (e.k === "buoy") { ui.banner(t("p2_buoy_down")); sound.chime?.(); }
      if (e.k === "task") { ui.banner(cur?.role === "poacher" ? t("p2_task_fake") : t("p2_task_done"), e.all ? t("p2_all_done") : ""); sound.coin?.(); }
      if (e.k === "meeting") { sound.horn?.(); world.setCameraMode("overview"); }
      if (e.k === "night") ui.banner(t("p2_night", { n: e.pct }), "", 3500);
      if (e.k === "end") sound.horn?.();
    }
  }

  // ---- the day's world: boats, fish, dead fish, task rings, my buoy ----
  function draw(dt, tt) {
    if (!cur) return;
    const k = Math.min(1, (performance.now() - curAt) / 100);
    const lerp = (a, b) => a + (b - a) * k;
    const la = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
    const shown = new Set();
    for (const b of cur.b) {
      shown.add(b[0]);
      const p = prev.b.find((x) => x[0] === b[0]) ?? b;
      const bt = world.boat(b[0], colorOf(b[0]), `${nameOf(b[0])}${b[4] ? " · 🔍" : ""}`);
      world.drawBoat(bt, lerp(p[1] / 10, b[1] / 10), lerp(p[2] / 10, b[2] / 10), la(p[3] / 100, b[3] / 100), tt, { visible: true });
    }
    // a boat that left your lantern's light is hidden, not left where you last saw it
    for (const [seat, bt] of world.boats ?? []) if (!shown.has(seat)) { bt.mesh.visible = false; }
    world.setFish(fishView.list(cur.f, prev?.f, k), tt); // each fish followed by its own id, not by its place in the list
    for (const [id, x, y] of cur.ev ?? []) {
      const m = world.prop(`ev${id}`, () => { const g = new world.THREE.Group(); for (let i = 0; i < 14; i++) { const f = new world.THREE.Mesh(new world.THREE.SphereGeometry(0.22, 6, 5).scale(1.6, 0.5, 1), world.toon(i % 3 ? "#e9e3d6" : "#c9b9a6")); const a = i * 2.4, d = 0.4 + (i % 5) * 0.55; f.position.set(Math.cos(a) * d, 0.05, Math.sin(a) * d); f.rotation.set(Math.PI / 2, 0, a); g.add(f); } const ring = new world.THREE.Mesh(new world.THREE.RingGeometry(3.2, 3.5, 32).rotateX(-Math.PI / 2), new world.THREE.MeshBasicMaterial({ color: "#ff7a5a", transparent: true, opacity: 0.55 })); ring.position.y = 0.08; g.add(ring); return g; });
      const [wx, wz] = world.toWorld(x / 10, y / 10); m.position.set(wx, Math.sin(tt * 2) * 0.03, wz);
    }
    const mine = cur.me;
    if (mine && cur.phase === "day") {
      for (const [id, , , x, y, , done] of mine.tasks) {
        if (done) continue;
        const r = world.prop(`task${id}`, () => { const g = new world.THREE.Mesh(new world.THREE.RingGeometry(5.0, 5.5, 48).rotateX(-Math.PI / 2), new world.THREE.MeshBasicMaterial({ color: "#e8b84d", transparent: true, opacity: 0.85, depthWrite: false })); return g; });
        const [wx, wz] = world.toWorld(x / 10, y / 10); r.position.set(wx, 0.1 + Math.sin(tt * 3) * 0.04, wz);
      }
      if (mine.buoyAt) { const bu = world.prop("buoy", () => { const l = world.makeLantern(0.9); return l; }); const [wx, wz] = world.toWorld(mine.buoyAt[0] / 10, mine.buoyAt[1] / 10); bu.position.set(wx, 1.2, wz); }
      world.setLabels(mine.tasks.filter((x) => !x[6]).map(([id, verb, , x, y, pct]) => [id, x / 10, y / 10 + 6.5, `${t(`p2_v_${verb}`)}${pct ? ` ${pct}%` : ""}`, "could"]));
    } else world.setLabels([]);
    world.sweepProps();
    world.setLanterns(mine?.buoyAt ? [[mine.buoyAt[0] / 10, mine.buoyAt[1] / 10, 1.2]] : []);
    // the fog and the camera
    const myB = me() !== null ? cur.b.find((x) => x[0] === me()) : null;
    const lit = cur.phase === "day" && myB && !cur.out.includes(me());
    fog.hidden = !lit; seenEl.hidden = true;
    if (lit) {
      // the fog's hole: the lantern's circle on screen, along whichever lake axis runs across it (the camera turns on a tall phone)
      const view = cur.sight?.[0] ?? SIGHT.view;
      const x = myB[1] / 10, y = myB[2] / 10, [sx, sy] = toScreen(x, y), [ax, ay] = toScreen(x + view, y), [bx, by] = toScreen(x, y + view);
      const fr = Math.max(Math.hypot(ax - sx, ay - sy), Math.hypot(bx - sx, by - sy));
      fog.style.setProperty("--fx", `${sx}px`); fog.style.setProperty("--fy", `${sy}px`); fog.style.setProperty("--fr", `${Math.max(40, fr * 0.92)}px`);
      world.setCameraMode("follow", { x: world.toWorld(x, y)[0], z: world.toWorld(x, y)[1], h: myB[3] / 100, speed: 4 });
    }
    world.setNight(cur.phase === "day" ? 0.08 + 0.35 * Math.min(1, 1 - cur.left / 70) : 0.45);
  }

  // ---- the full screens: role, meeting, tally, exile ----
  const face = (seat, cls = "") => `<span class="po-face ${cls}">${ui.portrait(charOf(seat), nameOf(seat))}</span>`;
  // the role card waits for "I understand" (rule change 9); it is built once, then only who is ready and the
  // clock change, so the button never moves under a finger
  let roleSent = false;
  function roleScreen(f) {
    const poacher = f.role === "poacher";
    const mine = me() !== null && (roleSent || f.ready?.[me()]);
    if (ui.overlay.querySelector(".po-role")) {
      ui.overlay.querySelectorAll(".po-crew > .po-face").forEach((el, i) => el.classList.toggle("on", !!f.ready?.[i]));
      const st = $("po-starts"); if (st) st.textContent = t("p2_starts", { n: f.left });
      return;
    }
    ui.overlay.innerHTML = `<div class="sheet narrow po-role ${poacher ? "p" : "f"}"><p class="note">${esc(t("p2_role_h"))}</p>
      <div class="po-bigface">${face(me())}</div><div class="po-who">${esc(t(poacher ? "p2_role_p" : "p2_role_f"))}</div>
      <p class="lede">${esc(t(poacher ? "p2_role_p_s" : "p2_role_f_s"))}</p>
      ${f.partners?.length ? `<p class="po-partner">${esc(t("p2_partner", { name: list(f.partners.map(nameOf)) }))}</p>` : ""}
      <div><p class="note">${esc(t("p2_team"))}</p><div class="po-crew po-readyrow">${(seats ?? []).map((_, i) => face(i, `small${f.ready?.[i] ? " on" : ""}`)).join("")}</div></div>
      ${me() !== null ? `<button class="btn primary" type="button" id="po-ok" ${mine ? "disabled" : ""}>${esc(t(mine ? "p2_waiting" : "p2_ok"))}</button>` : ""}
      <p class="note" id="po-starts">${esc(t("p2_starts", { n: f.left }))}</p></div>`;
    $("po-ok")?.addEventListener("click", (e) => { if (roleSent) return; roleSent = true; send({ k: "ready" }); e.currentTarget.disabled = true; e.currentTarget.textContent = t("p2_waiting"); });
  }
  function lineText(l) {
    if (!l) return "";
    if (l.k === "was") return t("p2_s_was", { place: place(l.place) });
    if (l.k === "insp") return t(l.res === "fry" ? "p2_s_insp_f" : "p2_s_insp_c", { name: nameOf(l.i) });
    if (l.k === "saw") return t("p2_s_saw", { name: nameOf(l.i), place: place(l.place) });
    if (l.k === "sawnet") return t("p2_s_sawnet", { name: nameOf(l.i) });
    if (l.k === "buoy") return t("p2_s_buoy", { place: place(l.place), names: l.ids.length ? list(l.ids.map(nameOf)) : "—" });
    if (l.k === "sus") return t("p2_s_sus", { name: nameOf(l.i) });
    if (l.k === "vouch") return t("p2_s_vouch", { name: nameOf(l.i) });
    return t("p2_s_skip");
  }
  const lineClass = (l) => (l.k === "sus" || l.k === "sawnet" || (l.k === "insp" && l.res === "fry") ? "acc" : l.k === "vouch" ? "vouch" : "");
  function meetingScreen(f) {
    const m = f.m, mySeat = me(), out = f.out.includes(mySeat) || mySeat === null;
    const head = m.reason === "report" ? t("p2_meet_rep", { name: nameOf(m.by), place: place(m.place) }) : t("p2_meet_dusk");
    const voted = new Set(m.voted);
    const seatHtml = (i) => {
      const said = m.says.filter((x) => x.seat === i).slice(-2);
      const known = m.known?.[i], wit = m.witnessed?.includes(i);
      const isOut = f.out.includes(i);
      return `<button class="po-seat ${isOut ? "out" : ""} ${sel === i ? "sel" : ""}" type="button" data-seat="${i}" ${isOut || i === mySeat || out ? "disabled" : ""}>${face(i)}<span class="min0"><b>${esc(nameOf(i))}</b>
        ${known && i !== mySeat ? `<span class="po-known ${known === "fry" ? "bad" : ""}">${esc(t(known === "fry" ? "p2_k_fry" : "p2_k_clean"))}</span>` : ""}${wit ? `<span class="po-known bad">${esc(t("p2_k_net"))}</span>` : ""}
        ${said.map((x) => `<span class="po-say ${lineClass(x.line)}">${esc(lineText(x.line))}</span>`).join("")}</span>${voted.has(i) ? `<span class="po-vb">${esc(t("p2_m_voted"))}</span>` : ""}</button>`;
    };
    const used = new Set(m.says.filter((x) => x.seat === mySeat).map((x) => JSON.stringify(x.line)));
    const chips = [...(m.lines ?? []), { k: "skip" }];
    const myVote = m.myVote;
    ui.overlay.innerHTML = `<div class="sheet po-meet"><div class="po-mhead"><div><h2>${esc(t("p2_meet_h", { n: f.day }))}</h2><p class="lede">${esc(head)}</p></div><div class="po-mt"><b id="po-mt">${f.left}</b><small>${esc(t("p2_health"))} ${Math.round(f.health)}%</small></div></div>
      <div class="po-grid">
        <div class="po-mapbox"><b>${esc(t("p2_m_map"))}</b><canvas id="po-map" width="640" height="460"></canvas>
          <div class="po-legend"><span class="ev">✕ ${esc(t("p2_m_ev"))}</span><span class="bu">● ${esc(t("p2_m_buoy"))}</span><span class="pa">— ${esc(t("p2_m_path"))}</span><span>○ ${esc(t("p2_m_seen"))}</span></div>
          ${m.buoys.map((bu) => `<small class="note">● ${esc(place(bu.place))} (${esc(nameOf(bu.owner))}): ${bu.log.length ? esc(list(bu.log.map(([i, s]) => `${nameOf(i)} ${fmt(s)}`))) : "—"}</small>`).join("")}
        </div>
        <div class="po-side">
          <div class="po-seats">${(seats ?? []).map((_, i) => seatHtml(i)).join("")}</div>
          <div id="po-menu"></div>
          ${out ? `<p class="note">${esc(t("p2_you_out"))}</p>` : `<div><p class="note">${esc(t("p2_m_say"))}</p><div class="po-chips">${chips.map((l, i) => `<button class="chipbtn ${lineClass(l)}" type="button" data-chip="${i}" ${used.has(JSON.stringify(l)) ? "disabled" : ""}>${esc(lineText(l))}</button>`).join("")}</div></div>
          <div class="row spread"><span class="note">${esc(myVote !== undefined ? t("p2_m_you_voted") : t("p2_m_vote"))}</span>${m.final ? `<span class="note">${esc(t("p2_m_noskip"))}</span>` : `<button class="btn ghost small" type="button" id="po-skip" ${myVote !== undefined ? "disabled" : ""}>${esc(t("p2_m_skip"))}</button>`}</div>`}
        </div></div></div>`;
    drawMap($("po-map"), f);
    ui.overlay.querySelectorAll("[data-chip]").forEach((c) => c.addEventListener("click", () => { send({ k: "say", line: chips[+c.dataset.chip] }); c.disabled = true; }));
    ui.overlay.querySelectorAll("[data-seat]").forEach((s) => s.addEventListener("click", () => { sel = +s.dataset.seat; renderMenu(f); ui.overlay.querySelectorAll("[data-seat]").forEach((x) => x.classList.toggle("sel", +x.dataset.seat === sel)); }));
    $("po-skip")?.addEventListener("click", () => { send({ k: "vote", target: null }); $("po-skip").disabled = true; });
    renderMenu(f);
  }
  function renderMenu(f) {
    const el = $("po-menu"); if (!el) return;
    if (sel === null || !f.m) { el.innerHTML = ""; return; }
    const voted = f.m.myVote !== undefined;
    el.innerHTML = `<div class="po-menu"><b>${esc(nameOf(sel))}</b><button class="chipbtn acc" type="button" data-m="sus">${esc(t("p2_m_suspect"))}</button><button class="chipbtn vouch" type="button" data-m="vouch">${esc(t("p2_m_vouch"))}</button>${voted ? "" : `<button class="chipbtn vote" type="button" data-m="out">${esc(t("p2_m_out"))}</button>`}<button class="chipbtn" type="button" data-m="x">${esc(t("p2_m_cancel"))}</button></div>`;
    el.querySelectorAll("[data-m]").forEach((x) => x.addEventListener("click", () => {
      const mm = x.dataset.m;
      if (mm === "sus" || mm === "vouch") send({ k: "say", line: { k: mm, i: sel } });
      if (mm === "out") send({ k: "vote", target: sel });
      sel = null; renderMenu(f); ui.overlay.querySelectorAll("[data-seat]").forEach((y) => y.classList.remove("sel"));
    }));
  }
  // the map of what you know: the lake, the bays, your path, where you last saw each boat, dead fish, buoys
  function drawMap(cv, f, opts = {}) {
    if (!cv) return;
    const ctx = cv.getContext("2d"), w = cv.width, h = cv.height, L = W.lake;
    const mx = (x) => w / 2 + (x / (L.x * 1.12)) * (w / 2), my = (y) => h / 2 + (y / (L.y * 1.16)) * (h / 2);
    // the map is drawn from the page's lake; a match on a bigger or smaller lake (rule change 11) is that lake times kk
    const kk = f.lk?.k ?? cur?.lk?.k ?? 1, sx = (x) => mx(x / kk), sy = (y) => my(y / kk);
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); W.outline.forEach(([x, y], i) => (i ? ctx.lineTo(mx(x), my(y)) : ctx.moveTo(mx(x), my(y)))); ctx.closePath();
    ctx.fillStyle = "#1f5e66"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#d9c08a"; ctx.stroke();
    const isl = W.island; ctx.fillStyle = "#6f7a45"; ctx.beginPath(); ctx.arc(mx(isl.x), my(isl.y), (isl.r / (L.x * 1.12)) * (w / 2), 0, 6.28); ctx.fill();
    ctx.font = `700 ${Math.round(w / 34)}px sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(245,234,214,.6)";
    for (const bp of W.bays) ctx.fillText(place(bp.id), mx(bp.x), my(bp.y));
    const z = W.zones; for (const id of ["reeds", "lotus", "river"]) if (z[id]) ctx.fillText(place(id), mx(z[id].x), my(z[id].y));
    if (opts.replay) {
      ctx.strokeStyle = "#ff8a7a"; ctx.lineWidth = 3; ctx.beginPath(); opts.replay.path.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)))); ctx.stroke();
      for (const [x, y] of opts.replay.nets) cross(ctx, sx(x), sy(y), "#fff");
      return;
    }
    const m = f.m;
    ctx.strokeStyle = "rgba(232,184,77,.9)"; ctx.lineWidth = 3; ctx.beginPath(); m.path.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x / 10), sy(y / 10)) : ctx.moveTo(sx(x / 10), sy(y / 10)))); ctx.stroke();
    for (const [i, x, y, s] of m.seen) { ctx.fillStyle = colorOf(i); ctx.beginPath(); ctx.arc(sx(x / 10), sy(y / 10), 8, 0, 6.28); ctx.fill(); ctx.fillStyle = "#f5ead6"; ctx.fillText(`${nameOf(i)} ${fmt(s)}`, sx(x / 10), sy(y / 10) - 12); }
    for (const bu of m.buoys) { ctx.fillStyle = "#ffb45a"; ctx.beginPath(); ctx.arc(sx(bu.x / 10), sy(bu.y / 10), 8, 0, 6.28); ctx.fill(); ctx.strokeStyle = "rgba(255,180,90,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(bu.x / 10), sy(bu.y / 10), ((f.sight?.[1] ?? SIGHT.buoyR) / kk / (L.x * 1.12)) * (w / 2), 0, 6.28); ctx.stroke(); }
    for (const [x, y, s] of m.patches) { cross(ctx, sx(x / 10), sy(y / 10), "#ff8a7a"); ctx.fillStyle = "#ff8a7a"; ctx.fillText(fmt(s), sx(x / 10), sy(y / 10) + 24); }
    const meB = f.b?.find((x) => x[0] === me()); if (meB) { ctx.fillStyle = colorOf(me()); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx(meB[1] / 10), sy(meB[2] / 10), 9, 0, 6.28); ctx.fill(); ctx.stroke(); }
  }
  const cross = (ctx, X, Y, c) => { ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X - 8, Y - 8); ctx.lineTo(X + 8, Y + 8); ctx.moveTo(X + 8, Y - 8); ctx.lineTo(X - 8, Y + 8); ctx.stroke(); };
  function tallyScreen(f) {
    const votes = f.tally.votes, alive = (seats ?? []).map((_, i) => i).filter((i) => !f.out.includes(i) || i === f.tally.out);
    ui.overlay.innerHTML = `<div class="sheet narrow po-tally"><h2>${esc(t("p2_tally"))}</h2><div class="po-seats">${alive.map((i) => `<div class="po-seat">${face(i)}<span class="min0"><b>${esc(nameOf(i))}</b><span class="po-votes">${votes.map((v, j) => (v === i ? face(j, "tiny") : "")).join("")}</span></span></div>`).join("")}</div>
      <p class="note">${esc(t("p2_skipped"))}: ${esc(list(votes.map((v, j) => (v === null && !f.out.includes(j) ? nameOf(j) : null)).filter(Boolean))) || "—"}</p></div>`;
  }
  function exileScreen(f) {
    const who = f.tally.out;
    const key = `${f.day}-${who}`;
    if (typedFor === key) return;
    typedFor = key;
    if (who === null) { ui.overlay.innerHTML = `<div class="sheet narrow po-exile"><div class="po-typed" id="po-t1"></div></div>`; typeText(t("p2_ex_none"), "po-t1"); return; }
    ui.overlay.innerHTML = `<div class="sheet narrow po-exile"><div class="po-bigface drift">${face(who)}</div><div class="po-typed" id="po-t1"></div><div class="po-typed ${f.tally.role === "poacher" ? "bad" : "good"}" id="po-t2"></div></div>`;
    typeText(t("p2_ex_go", { name: nameOf(who) }), "po-t1", () => setTimeout(() => { typeText(t(f.tally.role === "poacher" ? "p2_ex_was" : "p2_ex_not", { name: nameOf(who) }), "po-t2"); f.tally.role === "poacher" ? sound.big?.() : sound.miss?.(); }, 500));
  }
  function typeText(s, id, done) { let k = 0; const tick = setInterval(() => { const el = $(id); if (!el) { clearInterval(tick); return; } el.textContent = s.slice(0, ++k); if (k >= s.length) { clearInterval(tick); done?.(); } }, 45); }

  function renderPhase(f) {
    const key = f.phase === "meeting" ? JSON.stringify([f.m.says, f.m.voted, f.m.myVote, f.m.lines, f.out]) : "";
    if (f.phase !== lastPhase) {
      ui.overlay.innerHTML = ""; sel = null;
      if (f.phase === "day") { renderHud(); }
      else { ui.hud.innerHTML = ""; world.setLabels([]); }
      lastPhase = f.phase; lastMeetKey = "";
    }
    if (f.phase === "role") { roleScreen(f); }
    if (f.phase === "meeting") { if (key !== lastMeetKey) { meetingScreen(f); lastMeetKey = key; } else { const mt = $("po-mt"); if (mt) mt.textContent = f.left; } }
    if (f.phase === "tally") tallyScreen(f);
    if (f.phase === "exile") exileScreen(f);
    if (f.phase === "day") updateHud(f);
    const label = f.phase === "day" ? t("p2_clock_day", { n: f.day, of: f.days }) : f.phase === "role" ? t("p2_clock_role") : f.phase === "end" ? "" : t("p2_clock_meet");
    ui.setClock(f.left, label);
    ui.goalEl.textContent = t("poach_hud");
    if (f.phase === "day" && f.me) {
      ui.coach([
        ["sail", t(typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? "r_coach_sail" : "r_coach_sail_keys")],
        ["task", t("p2_coach_task")],
        ["inspect", t("p2_coach_inspect"), () => f.me.canInspect],
        ["report", t("p2_coach_report"), () => f.me.canReport],
      ]);
      if (f.me.tasks.some((x) => x[6])) ui.did("task");
      if (f.me.canReport) ui.rearm?.(4000);
    }
  }

  // ---- the end: who it was, the poacher's path, then the year's ceremony ----
  function renderResults(v, overlayEl) {
    const r = v.results, x = r.extra ?? {};
    const poachers = (x.roles ?? []).map((role, i) => (role === "poacher" ? i : -1)).filter((i) => i >= 0);
    const names = list(poachers.map(nameOf));
    const title = t(x.winner === "fishers" ? "p2_win_f" : "p2_win_p");
    const sub = x.winner === "fishers" ? t("p2_win_f_s", { names, h: Math.round(x.health ?? 0) }) : t(x.why === "lake" ? "p2_win_p_lake" : "p2_win_p_survived", { names });
    overlayEl.innerHTML = `<div class="sheet narrow po-end"><h2>${esc(title)}</h2><p class="lede">${esc(sub)}</p>
      <div class="po-roles">${(x.roles ?? []).map((role, i) => `<span class="po-rolepill ${role === "poacher" ? "p" : "f"}"><i class="swatch" style="background:${colorOf(i)}"></i>${esc(nameOf(i))} · ${esc(t(role === "poacher" ? "p2_role_p" : "p2_role_f"))}</span>`).join("")}</div>
      <div class="po-mapbox"><b>${esc(t("p2_replay"))}</b><canvas id="po-replay" width="640" height="460"></canvas></div>
      <div class="row"><button class="btn primary" type="button" id="po-year">${esc(t("p2_to_year"))}</button></div></div>`;
    drawMap($("po-replay"), null, { replay: x.replay ?? { path: [], nets: [] } });
    $("po-year").addEventListener("click", () => ceremony(v, overlayEl));
    fog.hidden = true; ui.hud.innerHTML = ""; world.setLabels([]); world.setCameraMode("overview");
  }
  function ceremony(v, overlayEl) {
    const r = v.results, x = r.extra ?? {};
    const tiers = W.tiers, k = W.k;
    const tierOf = (n) => { for (const [min, id, mult] of tiers) if (n >= min * k) return { id, mult }; return { id: "none", mult: 0.5 }; };
    const next = x.next ?? r.lakeAfter, tier = tierOf(next);
    const data = {
      a: x.left?.a ?? r.lakeAfter, y: x.left?.y ?? 0, next, tier, unit: t("p2_unit"),
      ledger: (x.ledger ?? []).map((l) => ({ seat: l.seat, name: nameOf(l.seat), character: charOf(l.seat), isMe: l.seat === me(), home: l.home, young: l.young, spared: 0 })),
      fairShare: Math.max(1, Math.round((x.ledger ?? []).reduce((n, l) => n + l.home, 0) / Math.max(1, (x.ledger ?? []).length))),
      titles: [],
      podium: r.seats.map((s) => ({ seat: s.seat, name: nameOf(s.seat), character: charOf(s.seat), isMe: s.seat === me(), base: s.base ?? s.score, score: s.score, sub: s.won ? t("p2_winners") : undefined })),
    };
    const zh = (key) => (boot.lang === "zh" ? t(key) : (boot.other ?? {})[key] ?? key);
    const html = ceremonySteps(data, { t, esc, portrait: ui.portrait, zh });
    let step = 0;
    const render = () => {
      overlayEl.innerHTML = html[step];
      overlayEl.querySelector("[data-cer-next]")?.addEventListener("click", () => { step++; render(); });
      overlayEl.querySelector("[data-cer-skip]")?.addEventListener("click", () => { step = html.length - 1; render(); });
      overlayEl.querySelector("[data-cer-again]")?.addEventListener("click", () => post("start", { bots: false }));
      overlayEl.querySelector("[data-cer-village]")?.addEventListener("click", () => { location.href = `/play/${view().code}`; });
    };
    render();
  }

  return {
    room(v) { seats = v.seats; },
    start(frame, v) {
      seats = v.seats; prev = cur = frame; curAt = performance.now(); lastPhase = null; typedFor = null; fishView.clear();
      world.clearBoats?.(); world.clearProps?.(); world.setLake?.(frame.lk);
      world.setDocks(seats.map((s, i) => ({ x: world.docks[i]?.x ?? 0, y: world.docks[i]?.z ?? 0, color: COLORS[s.character] })));
      world.onFrame(draw); renderPhase(frame);
    },
    frame(f, ev) { seats = view().seats ?? seats; prev = cur ?? f; cur = f; curAt = performance.now(); world.setLake?.(f.lk); if (me() !== null) world.setHome?.(me(), colorOf(me()), t("g_your_home")); events(ev); renderPhase(f); },
    results(v, overlayEl) { renderResults(v, overlayEl); },
    end() { clearInterval(wasdId); removeEventListener("keydown", onKey); fishView.clear(); fog.remove(); seenEl.remove(); world.setLabels([]); },
  };
}
