// Fishing Party on /play: five rounds, each with its own controls, drawn from
// what the server sent this seat (in Lantern Night, only what its lantern
// lights). Sends taps, steers, reels, casts, lantern drops, shop buys, the
// variant pick and the secret Last Net size. It decides nothing.
const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };
const SHOP = { bigNet: ["Big Net", 3, "bigger catch next round"], fastBoat: ["Fast Boat", 3, "faster next round"], bait: ["Bait", 3, "schools come to you first"], muddy: ["Muddy Water", 4, "the leader sees less next round"] };
const HOW = {
  shoal: "Schools flash up for 1.5 s: tap them first.",
  koi: "Sail through your next gate (+1) and touch the golden carp (+5).",
  tug: "Tap REEL when the needle is in the green. Off the green, the fish slips back.",
  night: "Dark lake: you only see fish in your lantern. CAST to net them; DROP a lantern lights a spot for everyone.",
  last: "Pick a net in secret. If all nets together are more than the school, everyone gets 1. Coins ×2.",
};

// replace a panel's markup only when it changed, so a tap is never lost to a rebuild
const setHtml = (el, html) => { if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };

export function mount({ world, sound, ui, send, view }) {
  let prev = null, cur = null, curAt = 0, seats = null, needle = 0;
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const nameOf = (seat) => (seat === me() ? "You" : seats?.[seat]?.name ?? `P${seat + 1}`);
  const $ = (id) => document.getElementById(id);
  world.setCamera([0, 44, 56], [0, 0, 2]);
  ui.hud.innerHTML = `
    <div class="card"><h4 id="y-title">Round 1 of 5</h4><p class="small" id="y-how" style="margin-top:0"></p><div class="rounds" id="y-rounds"></div></div>
    <div class="card" id="y-panel"></div>
    <div class="card hide-sm"><h4>Coins</h4><div class="board" id="y-board"></div><p class="small" id="y-lake"></p></div>`;
  // Tug of Line's needle: a full-width bar at the bottom with REEL (on every screen), and a meter over the fish on the lake
  const tugBar = document.createElement("div"); tugBar.className = "tugbar"; tugBar.hidden = true;
  tugBar.innerHTML = `<div class="meter"><b class="green"></b><i></i></div><button class="pad red" type="button" data-a="reel">REEL</button>`;
  ui.stage.appendChild(tugBar);
  tugBar.querySelector("button").addEventListener("pointerdown", (e) => { e.preventDefault(); send({ k: "reel" }); ui.did("reel"); });
  const canvas = document.getElementById("gl");
  let lastSteer = 0, dragging = false;
  const toSim = (e) => world.screenToSim(e.clientX, e.clientY);
  const onDown = (e) => {
    dragging = true; const p = toSim(e); if (!p || !cur || cur.phase !== "round" || me() === null) return;
    if (cur.game === "shoal") { send({ k: "tap", x: p[0], y: p[1] }); world.ripple(p[0], p[1], colorOf(me()), 2.5, .5); ui.did("tap"); }
    if (cur.game === "koi" || cur.game === "night") { send({ k: "steer", x: p[0], y: p[1] }); ui.did("steer"); }
  };
  const onMove = (e) => { if (!dragging || !cur || (cur.game !== "koi" && cur.game !== "night")) return; const t = performance.now(); if (t - lastSteer < 90) return; lastSteer = t; const p = toSim(e); if (p) send({ k: "steer", x: p[0], y: p[1] }); };
  const onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); addEventListener("pointerup", onUp);
  const onKey = (e) => { if (e.code === "Space" && e.type === "keydown" && cur?.phase === "round") { e.preventDefault(); if (cur.game === "tug") { send({ k: "reel" }); ui.did("reel"); } if (cur.game === "night") { send({ k: "cast" }); ui.did("cast"); } } };
  addEventListener("keydown", onKey);
  $("y-panel").addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    const d = a.dataset;
    if (d.a === "reel") { send({ k: "reel" }); ui.did("reel"); }
    if (d.a === "cast") { send({ k: "cast" }); ui.did("cast"); }
    if (d.a === "drop") send({ k: "drop" });
    if (d.a === "buy") { send({ k: "buy", item: d.item }); ui.did("shop"); }
    if (d.a === "variant") send({ k: "variant", v: Number(d.v) });
    if (d.a === "pick") { send({ k: "pick", size: Number(d.size) }); ui.did("pick"); }
  });

  function panel(f) {
    const el = $("y-panel"); if (me() === null) { setHtml(el, ""); return; }
    if (f.phase === "shop") {
      setHtml(el, `<h4>Shop · ${Math.ceil(f.left)} s · you have ${f.coins[me()]} coins</h4><div class="cards">${Object.entries(SHOP).map(([id, [n, c, t]]) => `<button class="fac" type="button" data-a="buy" data-item="${id}" ${f.coins[me()] < c || f.perks.includes(id) || (id === "muddy" && !f.behind) ? "disabled" : ""}><b>${n}</b>${c} coins<small>${t}</small></button>`).join("")}</div>
        ${f.perks.length ? `<p class="small">Next round you have: ${f.perks.map((p) => SHOP[p][0]).join(", ")}</p>` : ""}
        <p class="small">Next: ${ui.esc(f.name)} · ${ui.esc(f.variant)} (chosen by ${ui.esc(nameOf(f.picker))})</p>`);
      return;
    }
    if (f.phase === "pick") {
      setHtml(el, f.picking
        ? `<h4>You are last, so you choose: ${ui.esc(f.name)} · ${Math.ceil(f.left)} s</h4><div class="chips">${f.variants.map((v, i) => `<button class="chipbtn" type="button" data-a="variant" data-v="${i}" aria-pressed="${f.variant === v}">${ui.esc(v)}</button>`).join("")}</div>`
        : `<h4>${ui.esc(nameOf(f.picker))} is choosing…</h4><p class="small" style="margin:0">Next: ${ui.esc(f.name)}. The last-placed player picks how it is played.</p>`);
      return;
    }
    if (f.phase === "standings") { setHtml(el, `<h4>Standings after round ${f.round - 1}</h4><div class="podium">${[...f.coins.keys()].sort((a, b) => f.coins[b] - f.coins[a]).map((s, i) => `<div class="pl ${i === 0 ? "first" : ""}">${ui.portrait(seats?.[s]?.character ?? "mei", "")}<b>${ui.esc(nameOf(s))}</b><span class="sc">${f.coins[s]}</span></div>`).join("")}</div>`); return; }
    if (f.phase !== "round") { setHtml(el, `<p class="small">Get ready…</p>`); return; }
    if (f.game === "shoal") setHtml(el, `<h4>Shoal Scramble</h4><p class="small" style="margin:0">Tap a school the moment it flashes up.${f.perks.includes("bigNet") ? " Big Net: your tap reaches further." : ""}</p>`);
    if (f.game === "koi") setHtml(el, `<h4>Koi Chase</h4><p class="small" style="margin:0">Steer through the glowing gate, then the next. Touch the golden carp for 5.</p>`);
    if (f.game === "tug") {
      const rope = f.ropes.find((r) => r.seats.includes(me())), dir = rope?.seats[0] === me() ? 1 : -1, pos = rope ? rope.pos * dir : 0;
      const vs = rope?.seats.length === 2 ? `against ${ui.esc(nameOf(rope.seats.find((x) => x !== me())))}` : "against the fish";
      setHtml(el, `<h4>Tug of Line · ${vs}</h4><p class="small" style="margin:0">${pos > 0 ? "You are winning the line" : pos < 0 ? "The line is slipping away" : "Even"} (${pos > 0 ? "+" : ""}${pos} of 10) · REEL when the needle over the fish is in the green</p>`);
    }
    if (f.game === "night") setHtml(el, `<h4>Lantern Night</h4><p class="small" style="margin:0">Lantern ${f.view < 140 ? `<b>shrunk to ${f.view} (muddy water)</b>` : f.view}. Drops left: ${f.dropsLeft}.</p><div class="pads"><button class="pad" type="button" data-a="cast">CAST</button><button class="pad red" type="button" data-a="drop" ${f.dropsLeft ? "" : "disabled"}>DROP LANTERN</button></div>`);
    if (f.game === "last") setHtml(el, `<h4>Last Net · the school holds ${f.school}</h4><p class="small" style="margin:0">${f.lakeStart - f.lake > 0 ? `You started with ${f.lakeStart} fish in the lake; ${f.lake} are left. ` : ""}Pick in secret. ${f.picked.filter(Boolean).length} of ${f.picked.length} have picked.</p>
      <div class="picks">${[3, 6, 10].map((n) => `<button class="pad ${n === 10 ? "red" : ""}" type="button" data-a="pick" data-size="${n}" ${f.myPick !== null ? "disabled" : ""} aria-pressed="${f.myPick === n}">${n === 3 ? "Small" : n === 6 ? "Medium" : "Huge"} ${n}</button>`).join("")}</div>`);
  }

  function events(ev) {
    for (const e of ev) {
      if (e.k === "round") { ui.banner(`Round ${e.n}: ${e.name}`, e.game === "last" ? `the school holds ${e.school} · coins ×2` : e.variant, 2600); sound.big(); world.setNight(e.game === "night" ? 1 : 0); world.setCamera(e.game === "tug" ? [7, 18, 36] : [0, 44, 56], e.game === "tug" ? [7, 1, 5] : [0, 0, 2]); }
      if (e.k === "surface") world.ripple(e.x, e.y, "#ffd34d", 5, 1.5);
      if (e.k === "shoal") { world.floatText(e.x, e.y, `${nameOf(e.seat)} +${e.n}`, colorOf(e.seat)); world.netDrop(e.x, e.y, 55, colorOf(e.seat), .8); if (e.seat === me()) sound.catch(e.n); }
      if (e.k === "miss") { world.floatText(e.x, e.y, "missed", "#b9b0c6"); sound.miss(); }
      if (e.k === "sank") world.ripple(e.x, e.y, "#5b6f88", 3, .8);
      if (e.k === "gate") { world.floatText(e.x, e.y, "+1 gate", colorOf(e.seat)); if (e.seat === me()) sound.coin(); }
      if (e.k === "koiCaught") { world.floatText(e.x, e.y, `${nameOf(e.seat)} caught the golden carp! +5`, "#ffd34d"); world.ripple(e.x, e.y, "#ffd34d", 8); if (e.seat === me()) { sound.big(); world.shake(); } }
      if (e.k === "reel" && e.seat === me()) e.ok ? sound.coin() : sound.miss();
      if (e.k === "landed") { ui.banner(`${nameOf(e.seat)} landed the big fish`, `+${e.n} coins`); if (e.seat === me()) sound.big(); }
      if (e.k === "netted") { world.netDrop(e.x, e.y, 40, colorOf(e.seat), .7); if (e.n) world.floatText(e.x, e.y, `+${e.n}`, colorOf(e.seat)); if (e.seat === me()) e.n ? sound.catch(e.n) : sound.miss(); }
      if (e.k === "drop") { world.ripple(e.x, e.y, "#ffb45a", 6); ui.banner(`${nameOf(e.seat)} dropped a lantern`, "it lights that spot for everyone for 10 s"); }
      if (e.k === "lastNet") { ui.banner(e.broke ? "The school broke!" : "Every net came up full", `${e.picks.map((p, i) => `${nameOf(i)} ${p ?? "–"}`).join(" · ")} (school ${e.school})`, 4500); e.broke ? (sound.hit(), world.shake()) : sound.big(); }
      if (e.k === "standings") sound.horn();
      if (e.k === "lastWarning") ui.banner("Before the last round", `the lake started with ${e.started} fish and has ${e.lake} left: Last Net's school is ${e.school}`, 5000);
      if (e.k === "pick") ui.banner(e.picker === me() ? "You are last: you choose" : `${nameOf(e.picker)} is choosing…`, `how ${e.next} is played`, 2400);
      if (e.k === "shop") ui.banner("Shop: 8 seconds", `next: ${e.next} · ${e.variant}`);
      if (e.k === "bought" && e.seat === me()) { ui.banner(`${SHOP[e.item][0]} bought`, SHOP[e.item][2]); sound.coin(); }
      if (e.k === "coins" && e.seat === me()) ui.did("scored");
      if (e.k === "end") sound.horn();
    }
  }

  function hudFrom(f) {
    ui.setClock(f.left, f.phase === "round" ? `Round ${f.round}` : f.phase === "shop" ? "Shop" : "");
    ui.goalEl.textContent = f.round >= 5 ? "Most coins wins · Last Net pays double" : "Most coins after five rounds wins";
    $("y-title").textContent = `Round ${Math.min(f.round, 5)} of 5 · ${f.name}`;
    $("y-how").textContent = f.phase === "round" ? `${HOW[f.game]} (${f.variant})` : f.phase === "shop" ? "Spend coins on the next round, or save them." : "";
    $("y-rounds").innerHTML = ["1", "2", "3", "4", "5"].map((n, i) => `<span class="round" aria-pressed="${i + 1 === f.round}">${n}</span>`).join("");
    $("y-board").innerHTML = [...f.coins.keys()].sort((a, b) => f.coins[b] - f.coins[a]).map((s) => `<div><span><span class="swatch" style="background:${colorOf(s)}"></span>${ui.esc(nameOf(s))}</span><b>${f.coins[s]}</b></div>`).join("");
    $("y-lake").textContent = `The lake: ${f.lake} fish (started ${f.lakeStart}). Fish taken now are gone for later rounds.`;
    panel(f);
    const tug = f.phase === "round" && f.game === "tug" && me() !== null;
    tugBar.hidden = !tug;
    if (tug) { const g = tugBar.querySelector(".green"); g.style.left = `${50 - f.green * 50}%`; g.style.width = `${f.green * 100}%`; }
  }

  function coach() {
    if (!cur || cur.phase !== "round") return;
    ui.coach([
      ["tap", "Tap the flashing school!", () => cur.game === "shoal"],
      ["steer", "Tap the water to steer", () => cur.game === "koi" || cur.game === "night"],
      ["reel", "Tap REEL when the needle is in the green", () => cur.game === "tug"],
      ["cast", "Fish in your light: CAST", () => cur.game === "night" && cur.f.length > 0],
      ["pick", "Pick a net size, in secret", () => cur.game === "last"],
    ]);
  }

  return {
    room(v) { seats = v.seats; },
    start(frame, v) { seats = v.seats; prev = cur = frame; curAt = performance.now(); world.setDocks([]); world.onFrame(draw); hudFrom(frame); },
    frame(f, ev) { seats = view().seats ?? seats; prev = cur ?? f; cur = f; curAt = performance.now(); events(ev); hudFrom(f); coach(); },
    end() { tugBar.remove(); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("keydown", onKey); },
  };

  function draw(dt, t) {
    if (!cur) return;
    const k = Math.min(1, (performance.now() - curAt) / 100), lerp = (a, b) => a + (b - a) * k;
    const sail = cur.phase === "round" && (cur.game === "koi" || cur.game === "night");
    (seats ?? []).forEach((st, i) => {
      const bt = world.boat(i, colorOf(i), nameOf(i)); bt.tag.classList.toggle("me", i === me());
      const b = cur.b[i], p = prev.b?.[i] ?? b;
      if (!sail || !b) { bt.mesh.visible = false; return; }
      world.drawBoat(bt, lerp(p[0], b[0]), lerp(p[1], b[1]), b[2] / 100, t, { lantern: cur.game === "night" });
    });
    let fish = [];
    if (cur.phase === "round" && cur.game === "night") fish = cur.f.map((f) => [f[0], f[1], f[2] / 100, 1]);
    if (cur.phase === "round" && cur.game === "shoal") for (const sh of cur.shoals) for (let i = 0; i < sh[2] * 3; i++) fish.push([sh[0] + Math.cos(i * 2.1 + t * 3) * 18, sh[1] + Math.sin(i * 2.1 + t * 3) * 12, i + t * 3, 1]);
    world.setFish(fish, t);
    world.setKoi(cur.phase === "round" && cur.koi ? [cur.koi[0], cur.koi[1], cur.koi[2] / 100] : null, t);
    if (cur.phase === "round" && cur.game === "koi") cur.gates.forEach((g, i) => { const m = world.prop(`gate${i}`, () => world.makeLantern(.9)); m.position.set((g[0] - 500) / 10, 2 + (i === cur.next ? Math.sin(t * 5) * .4 : 0), (g[1] - 350) / 10); m.scale.setScalar(i === cur.next ? 1.5 : .8); });
    if (cur.phase === "round" && cur.game === "night") cur.drops.forEach((d, i) => { const m = world.prop(`drop${d[0]},${d[1]}`, () => world.makeLantern(1.2)); m.position.set((d[0] - 500) / 10, 1.5, (d[1] - 350) / 10); });
    if (cur.phase === "round" && cur.game === "tug") {
      // the server's needle, eased between frames
      needle += (cur.needle - needle) * Math.min(1, dt * 12);
      const ni = tugBar.querySelector("i"); if (ni) ni.style.left = `${50 + needle * 50}%`;
      const meter = world.prop("tugmeter", () => tugMeter(world));
      meter.position.set(7, 4.2, 5); meter.lookAt(world.camera.position);
      meter.userData.needle.position.x = needle * 3; meter.userData.green.scale.x = cur.green;
      const inG = Math.abs(cur.needle) <= cur.green / 2; meter.userData.needle.material.color.set(inG ? "#8fe0c9" : "#ff7a5a");
    }
    if (cur.phase === "round" && cur.game === "tug") { const m = world.prop("bigfish", () => { const g = world.makeLantern(.01); const f = new world.THREE.Mesh(new world.THREE.SphereGeometry(1.4, 12, 8).scale(2, .7, .8), world.toon("#ff9a3c")); g.add(f); return g; }); m.position.set(7 + Math.sin(t * 2) * 1.5, -.2, 5 + Math.cos(t * 1.3)); }
    world.sweepProps();
    world.setLanterns(cur.game === "night" && cur.phase === "round" ? [...cur.b.map((b) => [b[0], b[1], 1]), ...cur.drops.map((d) => [d[0], d[1], 1.2])] : []);
  }
}

// a meter that floats over the big fish: a bar, its green middle, and the needle
function tugMeter(world) {
  const { THREE } = world, g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(6.4, .7), new THREE.MeshBasicMaterial({ color: "#cf3b2e", transparent: true, opacity: .75, depthTest: false }));
  const green = new THREE.Mesh(new THREE.PlaneGeometry(6, .72), new THREE.MeshBasicMaterial({ color: "#45a48c", depthTest: false }));
  const needle = new THREE.Mesh(new THREE.PlaneGeometry(.18, 1.2), new THREE.MeshBasicMaterial({ color: "#f5ead6", depthTest: false }));
  green.position.z = .01; needle.position.z = .02; bar.renderOrder = green.renderOrder = needle.renderOrder = 10;
  g.add(bar, green, needle); g.userData = { needle, green }; return g;
}
