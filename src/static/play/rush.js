// Boat Rush on /play: draws the frames the server sends (boats, fish, nets,
// spills, the golden carp, the crown, Lantern Rush) and sends only steer,
// cast (with how long it was held), dash and buy. It decides nothing.
const UPS = { bigHold: ["Big Hold", "+5 hold"], fastHull: ["Fast Hull", "12% faster"], wideNet: ["Wide Net", "12% wider net"], ironBow: ["Iron Bow", "+1 spill dealt, −1 taken"] };
const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
const NET_AHEAD = 40;

// replace a panel's markup only when it changed, so a tap is never lost to a rebuild
const setHtml = (el, html) => { if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };

export function mount({ world, sound, ui, send, view }) {
  let prev = null, cur = null, curAt = 0, seats = null, canAfford = false, banked = 0, unloaded = false;
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const nameOf = (seat) => (seat === me() ? "You" : seats?.[seat]?.name ?? `Boat ${seat + 1}`);
  world.setCamera([0, 50, 62], [0, 0, 4]);

  ui.hud.innerHTML = `
    <div class="card mine"><div class="row"><div><h4>Your hold</h4><div class="big" id="r-hold">0 / 10</div></div><div style="text-align:right"><h4>Banked</h4><div class="big" id="r-bank">0</div></div></div>
      <div class="bar" style="margin-top:6px"><i id="r-holdbar" style="width:0%"></i></div><p class="small" id="r-tip">Fish aboard are not yours until they are home.</p></div>
    <div class="card hide-sm"><h4>Banked at home</h4><div class="board" id="r-board"></div></div>
    <div class="card" id="r-shop" hidden><h4>Upgrade at your dock · two at most</h4><div class="cards" id="r-ups"></div></div>
    <div class="pads dock"><button class="pad" type="button" id="r-cast">CAST<br><small>hold to widen</small></button><button class="pad red" type="button" id="r-dash">DASH</button></div>`;
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
        if (e.full) { world.floatText(e.x, e.y, "Hold full!", "#ff9a86"); if (e.seat === me()) { sound.miss(); ui.banner("Your hold is full", "sail home to your dock"); } }
        else if (e.n || e.koi) { world.floatText(e.x, e.y, `+${e.n + (e.koi ? 5 : 0)}${e.koi ? " golden carp!" : ""}`, colorOf(e.seat)); if (e.seat === me()) sound.catch(e.n); world.ripple(e.x, e.y, colorOf(e.seat), 4); }
        else { world.floatText(e.x, e.y, e.fry ? `${e.fry} fry slipped through` : "empty", "#b9b0c6"); if (e.seat === me()) sound.miss(); }
      }
      if (e.k === "bank" && e.seat === me() && !unloaded) { unloaded = true; ui.rearm(); }
      if (e.k === "bank" && cur) { const b = cur.b[e.seat]; world.floatText(b[1], b[2], `+${e.v} home${e.x2 ? " ×2" : ""}`, "#ffd34d", 6); if (e.seat === me()) sound.bank(); if (e.tier > 0 && e.seat === me()) ui.banner("Your house grows", `${e.banked} fish banked`); }
      if (e.k === "ram") {
        world.floatText(e.x, e.y, `RAM! ${e.n} spilled`, "#ff7a5a", 5); world.ripple(e.x, e.y, "#ff7a5a", 7);
        if (e.v === me() || e.a === me()) { world.shake(); sound.hit(); }
        if (e.v === me()) ui.banner(`${nameOf(e.a)} rammed you`, `${e.n} fish spilled${e.crown ? " (the crown costs one more)" : ""}`);
        if (e.a === me()) ui.banner(`You rammed ${nameOf(e.v)}`, `${e.n} fish spilled: scoop them`);
      }
      if (e.k === "pick") { world.floatText(e.x, e.y, `scooped +${e.v}`, colorOf(e.seat)); if (e.seat === me()) sound.coin(); }
      if (e.k === "koi") { world.ripple(e.x, e.y, "#ffd34d", 9, 2); ui.banner("The golden carp!", "worth 5 once it is home"); sound.big(); }
      if (e.k === "buy") { if (e.seat === me()) { ui.banner(`${UPS[e.up][0]} bought`, `${UPS[e.up][1]} · ${e.cost} fish`); sound.big(); ui.did("buy"); } else if (cur) world.floatText(cur.b[e.seat][1], cur.b[e.seat][2], UPS[e.up][0], colorOf(e.seat), 6); }
      if (e.k === "crown" && e.seat !== null) { ui.banner(e.seat === me() ? "You wear the crown" : `${nameOf(e.seat)} leads`, e.seat === me() ? "a ram on you spills one more" : "ram the crown: one more fish spills"); }
      if (e.k === "lantern") { ui.banner("Lantern Rush!", "30 seconds: fish banked now count double", 3000); world.setNight(.85); sound.big(); }
      if (e.k === "end") { sound.horn(); ui.banner("The horn!", "fish still aboard count for nothing", 2500); }
    }
  }

  function hudFrom(f) {
    const mine = me() !== null ? f.b[me()] : null;
    ui.setClock(f.left, f.lantern ? "Lantern Rush" : "");
    ui.goalEl.textContent = f.lantern ? "Most fish home wins · banked now counts double" : "Most fish home wins";
    if (mine) {
      $("r-hold").textContent = `${mine[4]} / ${mine[5]}`; $("r-bank").textContent = mine[7];
      $("r-holdbar").style.width = `${(mine[4] / mine[5]) * 100}%`; $("r-holdbar").style.background = mine[4] >= mine[5] ? "#ff7a5a" : "";
      const docked = (mine[6] & 8) !== 0;
      const price = mine[13], afford = price !== null && mine[7] >= price;
      $("r-shop").hidden = !docked || !afford;
      if (docked && afford) setHtml($("r-ups"), Object.entries(UPS).map(([id, [n, t]]) => `<button class="fac" type="button" data-up="${id}" ${mine[10].includes(id) ? "disabled" : ""}><b>${n}</b>${price} fish<small>${t}</small></button>`).join(""));
      canAfford = afford; banked = mine[7];
      $("r-tip").textContent = mine[6] & 32 ? "The reeds: thick with fish, but you sail at half speed." : mine[10].length ? `Upgrades: ${mine[10].map((u) => UPS[u][0]).join(", ")}` : "Fish aboard are not yours until they are home.";
      $("r-cast").disabled = mine[8] > 0; $("r-dash").disabled = mine[9] > 0;
    }
    $("r-board").innerHTML = [...f.b].sort((a, b) => b[7] - a[7]).map((b) => `<div><span><span class="swatch" style="background:${colorOf(b[0])}"></span>${b[0] === f.crown ? "👑 " : ""}${ui.esc(nameOf(b[0]))}</span><b>${b[7]} <small>(${b[4]} aboard)</small></b></div>`).join("");
  }

  function coach() {
    if (!cur || me() === null) return;
    const b = cur.b[me()];
    const ax = b[1] + Math.cos(b[3] / 100) * NET_AHEAD, ay = b[2] + Math.sin(b[3] / 100) * NET_AHEAD;
    const fishAhead = cur.f.some((f) => f[3] && (f[0] - ax) ** 2 + (f[1] - ay) ** 2 < 38 * 38);
    ui.coach([
      ["sail", "Tap the water to sail"],
      ["cast", "Fish ahead: tap CAST (or Space)", () => fishAhead],
      ["charge", "Hold CAST longer for a wider net", () => fishAhead],
      ["home", "Hold filling up: sail home to your dock", () => b[4] >= b[5] * .6],
      ["buy", "Spend fish on an upgrade?", () => unloaded && canAfford],
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
