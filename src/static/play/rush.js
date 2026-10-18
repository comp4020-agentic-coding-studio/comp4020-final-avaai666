// Boat Rush on /play: draws the frames the server sends (boats, fish, nets,
// spills, the golden carp, the crown, Lantern Rush) and sends only steer,
// cast (with how long it was held), dash and buy. It decides nothing.
const UPS = ["bigHold", "fastHull", "wideNet", "ironBow"];
const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
const NET_AHEAD = 40;

// replace a panel's markup only when it changed, so a tap is never lost to a rebuild
const setHtml = (el, html) => { if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };

export function mount({ world, sound, ui, send, view }) {
  const t = ui.t, up = (id) => t(`r_up_${id}`), upS = (id) => t(`r_up_${id}_s`);
  let prev = null, cur = null, curAt = 0, seats = null, canAfford = false, banked = 0, unloaded = false;
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const nameOf = (seat) => (seat === me() ? t("g_you") : ui.seatName(seats?.[seat]) ?? t("g_boat_n", { n: seat + 1 }));
  world.setCamera([0, 50, 62], [0, 0, 4]);

  ui.hud.innerHTML = `
    <div class="card mine"><div class="row"><div><h4>${t("r_hold")}</h4><div class="big" id="r-hold">0 / 10</div></div><div style="text-align:right"><h4>${t("r_banked")}</h4><div class="big" id="r-bank">0</div></div></div>
      <div class="bar" style="margin-top:6px"><i id="r-holdbar" style="width:0%"></i></div><p class="small" id="r-tip">${t("r_tip")}</p></div>
    <div class="card hide-sm"><h4>${t("r_board")}</h4><div class="board" id="r-board"></div></div>
    <div class="card" id="r-shop" hidden><h4>${t("r_shop")}</h4><div class="cards" id="r-ups"></div></div>
    <div class="pads dock"><button class="pad" type="button" id="r-cast">${t("r_cast")}<br><small>${t("r_cast_s")}</small></button><button class="pad red" type="button" id="r-dash">${t("r_dash")}</button></div>`;
  const $ = (id) => document.getElementById(id);

  // ---- input: tap/drag the water to steer, hold CAST to charge, DASH ----
  const canvas = document.getElementById("gl");
  let dragging = false, lastSteer = 0;
  const steerTo = (e) => {
    const p = world.screenToSim(e.clientX, e.clientY); if (!p || me() === null) return;
    const t = performance.now(); if (t - lastSteer < 80) return; lastSteer = t;
    send({ k: "steer", x: p[0], y: p[1] }); world.ripple(p[0], p[1], colorOf(me()), 2.2, .6); ui.did("sail");
  };
  const onDown = (e) => { dragging = true; canvas.setPointerCapture?.(e.pointerId); steerTo(e); };
  const onMove = (e) => { if (dragging) steerTo(e); };
  const onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); addEventListener("pointerup", onUp);
  let chargeFrom = 0;
  const castDown = () => { chargeFrom = performance.now(); $("r-cast").classList.add("held"); };
  const castUp = () => {
    if (!chargeFrom) return;
    const charge = Math.min(1, (performance.now() - chargeFrom) / 1000); chargeFrom = 0; $("r-cast").classList.remove("held");
    send({ k: "cast", charge }); ui.did("cast"); if (charge > .5) ui.did("charge");
  };
  const dash = () => { send({ k: "dash" }); ui.did("dash"); };
  $("r-cast").addEventListener("pointerdown", castDown); $("r-cast").addEventListener("pointerup", castUp); $("r-cast").addEventListener("pointerleave", castUp);
  $("r-dash").addEventListener("click", dash);
  const keys = new Set();
  const onKey = (e) => {
    if (e.target.closest?.("input,textarea")) return;
    if (e.type === "keydown" && (e.code === "Space") && !e.repeat) { e.preventDefault(); castDown(); }
    if (e.type === "keyup" && e.code === "Space") { e.preventDefault(); castUp(); }
    if (e.type === "keydown" && e.key === "Shift" && !e.repeat) dash();
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) { if (e.type === "keydown") keys.add(e.code); else keys.delete(e.code); }
  };
  addEventListener("keydown", onKey); addEventListener("keyup", onKey);
  const wasd = setInterval(() => {
    if (!keys.size || !cur || me() === null) return;
    const b = cur.b[me()]; const dx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), dy = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
    if (dx || dy) { send({ k: "steer", x: b[1] + dx * 120, y: b[2] + dy * 120 }); ui.did("sail"); }
  }, 150);
  $("r-ups").addEventListener("click", (e) => { const u = e.target.closest("[data-up]"); if (u) { send({ k: "buy", up: u.dataset.up }); ui.did("buy"); } });

  // ---- events: floats, sounds, shakes, banners (C4) ----
  function events(ev) {
    for (const e of ev) {
      if (e.k === "cast") world.netDrop(e.x, e.y, e.r, colorOf(e.seat), .6 + e.charge * .3 + .4);
      if (e.k === "catch") {
        if (e.full) { world.floatText(e.x, e.y, t("r_hold_full"), "#ff9a86"); if (e.seat === me()) { sound.miss(); ui.banner(t("r_hold_full_b"), t("r_hold_full_s")); } }
        else if (e.n || e.koi) { world.floatText(e.x, e.y, `+${e.n + (e.koi ? 5 : 0)}${e.koi ? t("r_golden") : ""}`, colorOf(e.seat)); if (e.seat === me()) sound.catch(e.n); world.ripple(e.x, e.y, colorOf(e.seat), 4); }
        else { world.floatText(e.x, e.y, e.fry ? t("r_fry_slip", { n: e.fry }) : t("r_empty"), "#b9b0c6"); if (e.seat === me()) sound.miss(); }
      }
      if (e.k === "bank" && e.seat === me() && !unloaded) { unloaded = true; ui.rearm(); }
      if (e.k === "bank" && cur) { const b = cur.b[e.seat]; world.floatText(b[1], b[2], `${t("r_home", { n: e.v })}${e.x2 ? " ×2" : ""}`, "#ffd34d", 6); if (e.seat === me()) sound.bank(); if (e.tier > 0 && e.seat === me()) ui.banner(t("r_house"), t("r_house_s", { n: e.banked })); }
      if (e.k === "ram") {
        world.floatText(e.x, e.y, t("r_ram", { n: e.n }), "#ff7a5a", 5); world.ripple(e.x, e.y, "#ff7a5a", 7);
        if (e.v === me() || e.a === me()) { world.shake(); sound.hit(); }
        if (e.v === me()) ui.banner(t("r_rammed_you", { name: nameOf(e.a) }), `${t("r_rammed_you_s", { n: e.n })}${e.crown ? t("r_crown_cost") : ""}`);
        if (e.a === me()) ui.banner(t("r_you_rammed", { name: nameOf(e.v) }), t("r_you_rammed_s", { n: e.n }));
      }
      if (e.k === "pick") { world.floatText(e.x, e.y, t("r_scooped", { n: e.v }), colorOf(e.seat)); if (e.seat === me()) sound.coin(); }
      if (e.k === "koi") { world.ripple(e.x, e.y, "#ffd34d", 9, 2); ui.banner(t("r_koi"), t("r_koi_s")); sound.big(); }
      if (e.k === "buy") { if (e.seat === me()) { ui.banner(t("r_bought", { up: up(e.up) }), t("r_bought_s", { what: upS(e.up), n: e.cost })); sound.big(); ui.did("buy"); } else if (cur) world.floatText(cur.b[e.seat][1], cur.b[e.seat][2], up(e.up), colorOf(e.seat), 6); }
      if (e.k === "crown" && e.seat !== null) { ui.banner(e.seat === me() ? t("r_crown_you") : t("r_crown_lead", { name: nameOf(e.seat) }), e.seat === me() ? t("r_crown_you_s") : t("r_crown_lead_s")); }
      if (e.k === "lantern") { ui.banner(t("r_lantern"), t("r_lantern_s"), 3000); world.setNight(.85); sound.big(); }
      if (e.k === "end") { sound.horn(); ui.banner(t("r_horn"), t("r_horn_s"), 2500); }
    }
  }

  function hudFrom(f) {
    const mine = me() !== null ? f.b[me()] : null;
    ui.setClock(f.left, f.lantern ? t("r_lantern_clock") : "");
    ui.goalEl.textContent = f.lantern ? t("r_goal_lantern") : t("rush_hud");
    if (mine) {
      $("r-hold").textContent = `${mine[4]} / ${mine[5]}`; $("r-bank").textContent = mine[7];
      $("r-holdbar").style.width = `${(mine[4] / mine[5]) * 100}%`; $("r-holdbar").style.background = mine[4] >= mine[5] ? "#ff7a5a" : "";
      const docked = (mine[6] & 8) !== 0;
      const price = mine[13], afford = price !== null && mine[7] >= price;
      $("r-shop").hidden = !docked || !afford;
      if (docked && afford) setHtml($("r-ups"), UPS.map((id) => `<button class="fac" type="button" data-up="${id}" ${mine[10].includes(id) ? "disabled" : ""}><b>${up(id)}</b>${t("r_price", { n: price })}<small>${upS(id)}</small></button>`).join(""));
      canAfford = afford; banked = mine[7];
      $("r-tip").textContent = mine[6] & 32 ? t("r_reeds") : mine[10].length ? t("r_upgrades", { list: mine[10].map(up).join(", ") }) : t("r_tip");
      $("r-cast").disabled = mine[8] > 0; $("r-dash").disabled = mine[9] > 0;
    }
    $("r-board").innerHTML = [...f.b].sort((a, b) => b[7] - a[7]).map((b) => `<div><span><span class="swatch" style="background:${colorOf(b[0])}"></span>${b[0] === f.crown ? "👑 " : ""}${ui.esc(nameOf(b[0]))}</span><b>${b[7]} <small>${t("r_aboard", { n: b[4] })}</small></b></div>`).join("");
  }

  function coach() {
    if (!cur || me() === null) return;
    const b = cur.b[me()];
    const ax = b[1] + Math.cos(b[3] / 100) * NET_AHEAD, ay = b[2] + Math.sin(b[3] / 100) * NET_AHEAD;
    const fishAhead = cur.f.some((f) => f[3] && (f[0] - ax) ** 2 + (f[1] - ay) ** 2 < 38 * 38);
    ui.coach([
      ["sail", t("r_coach_sail")],
      ["cast", t("r_coach_cast"), () => fishAhead],
      ["charge", t("r_coach_charge"), () => fishAhead],
      ["home", t("r_coach_home"), () => b[4] >= b[5] * .6],
      ["buy", t("r_coach_buy"), () => unloaded && canAfford],
    ]);
    if (b[6] & 8 && b[7] === 0 && b[4] === 0) ui.did("home");
  }

  return {
    room(v) { seats = v.seats; },
    start(frame, v) {
      seats = v.seats; prev = cur = frame; curAt = performance.now();
      world.setNight(0);
      world.setDocks(frame.b.map((b) => { const a = Math.PI / 2 + (b[0] * 2 * Math.PI) / Math.max(frame.players, 2); return { x: 500 + 414 * Math.cos(a), y: 350 + 283.5 * Math.sin(a), color: colorOf(b[0]), r: 60 }; }));
      for (const b of frame.b) world.boat(b[0], colorOf(b[0]), nameOf(b[0]));
      world.onFrame(draw); hudFrom(frame);
    },
    frame(f, ev) { seats = view().seats ?? seats; prev = cur ?? f; cur = f; curAt = performance.now(); events(ev); hudFrom(f); coach(); },
    end() { canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("keydown", onKey); removeEventListener("keyup", onKey); clearInterval(wasd); },
  };

  function draw(dt, t) {
    if (!cur) return;
    const k = Math.min(1, (performance.now() - curAt) / 100);
    const lerp = (a, b) => a + (b - a) * k;
    const la = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
    for (const b of cur.b) {
      const p = prev.b[b[0]] ?? b, bt = world.boat(b[0], colorOf(b[0]), `${nameOf(b[0])} · ${b[7]}${b[4] ? ` (+${b[4]})` : ""}`);
      bt.tag.classList.toggle("me", b[0] === me());
      world.drawBoat(bt, lerp(p[1], b[1]), lerp(p[2], b[2]), la(p[3] / 100, b[3] / 100), t, { hold: b[4], crown: b[0] === cur.crown, shield: (b[6] & 4) !== 0, dash: (b[6] & 1) !== 0, lantern: cur.lantern });
    }
    const fish = cur.f.map((f, i) => { const p = prev.f[i]; return p ? [lerp(p[0], f[0]), lerp(p[1], f[1]), f[2] / 100, f[3] ? 1 : .6] : [f[0], f[1], f[2] / 100, f[3] ? 1 : .6]; });
    world.setFish(fish, t);
    world.setKoi(cur.k ? [cur.k[0], cur.k[1], cur.k[2] / 100] : null, t);
    for (const l of cur.l) { const m = world.prop(`l${l[0]}`, () => { const g = new world.THREE.Mesh(new world.THREE.SphereGeometry(.4, 6, 5).scale(1.6, .7, 1), world.toon(l[3] > 1 ? "#ffd34d" : "#f08a3c")); return g; }); m.position.set((l[1] - 500) / 10, .15 + Math.sin(t * 4 + l[0]) * .08, (l[2] - 350) / 10); m.rotation.y += dt * 2; }
    for (const [i, r] of [[210, 300, 70], [790, 410, 70]].entries()) { const m = world.prop(`reed${i}`, () => reeds(world)); m.position.set((r[0] - 500) / 10, 0, (r[1] - 350) / 10); }
    world.sweepProps();
    if (me() !== null && cur.b[me()]) { const b = cur.b[me()]; world.setCamera([(b[1] - 500) / 10 * .8, 40, (b[2] - 350) / 10 * .8 + 46], [(b[1] - 500) / 10 * .8, 0, (b[2] - 350) / 10 * .8 + 2]); }
    const glow = canAfford && me() !== null ? (() => { const a = Math.PI / 2 + (me() * 2 * Math.PI) / Math.max(cur.players, 2); return [[500 + 414 * Math.cos(a), 350 + 283.5 * Math.sin(a), 1.4 + Math.sin(t * 5) * .5]]; })() : [];
    world.setLanterns([...(cur.lantern ? cur.b.map((b) => [b[1], b[2], .9]) : []), ...glow]);
    world.setNight(cur.lantern ? .85 : canAfford ? .35 : 0);
  }
}

// the reed shallows: a ring of stalks
function reeds(world) {
  const { THREE } = world, g = new THREE.Group();
  const stalk = new THREE.CylinderGeometry(.06, .09, 2.2, 4), mat = world.toon("#9fb35a");
  for (let i = 0; i < 70; i++) { const a = i * 2.4, d = Math.sqrt((i * 37 % 100) / 100) * 6.6; const m = new THREE.Mesh(stalk, mat); m.position.set(Math.cos(a) * d, .9, Math.sin(a) * d); m.rotation.z = Math.sin(i) * .2; g.add(m); }
  const pad = new THREE.Mesh(new THREE.CircleGeometry(7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#6f8f3a", transparent: true, opacity: .28, depthWrite: false })); pad.position.y = .12; g.add(pad);
  return g;
}
