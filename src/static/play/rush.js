// Boat Rush on /play (rush 2.0): draws the frames the server sends (boats,
// fish, nets, spills, the golden carp, the market), sends only steer, cast
// (with how long it was held), dash, pick and reroll, and runs the 30 s
// practice entirely in the browser (DESIGN.md's explicit exception: never
// sent, stored or scored). It decides nothing about a real match.
import { CREW } from "./art.js";
import { ceremonySteps } from "./ceremony.js";

const COLORS = { mei: "#d6473a", wang: "#4a7d9c", jin: "#e0a93a", lu: "#2f9a8f", lian: "#d9668a", shitou: "#62a344" };

export function mount({ world, sound, ui, send, view, post }) {
  const t = ui.t, esc = ui.esc;
  let prev = null, cur = null, curAt = 0, seats = null, practice = null;
  const me = () => view().mySeat;
  const colorOf = (seat) => COLORS[seats?.[seat]?.character] ?? "#f5ead6";
  const nameOf = (seat) => (seat === me() ? t("g_you") : ui.seatName(seats?.[seat]) ?? t("g_boat_n", { n: seat + 1 }));
  const $ = (id) => document.getElementById(id);

  world.setCameraMode("follow");
  world.setSteerMode(true);

  ui.hud.innerHTML = `
    <div class="card mine"><div class="row"><div><h4>${t("r_hold")}</h4><div class="big" id="r-hold">0 / 12</div></div><div style="text-align:right"><h4>${t("r_banked")}</h4><div class="big" id="r-bank">0</div></div></div>
      <div class="bar" style="margin-top:6px"><i id="r-holdbar" style="width:0%"></i></div><p class="small" id="r-tip">${t("r_tip")}</p></div>
    <div class="card hide-sm"><h4>${t("r_board")}</h4><div class="board" id="r-board"></div></div>
    <div class="pads dock"><button class="pad" type="button" id="r-cast">${t("r_cast")}<br><small>${t("r_cast_s")}</small></button><button class="pad red" type="button" id="r-dash">${t("r_dash")}</button></div>`;

  // ---- input: tap/drag the water to steer (keys and the thumb stick come from world5.js's wantDir()) ----
  world.setTap((x, y) => { if (me() === null) return; send({ k: "steer", x, y }); ui.did("sail"); });
  let wasdId = setInterval(() => {
    if (me() === null || practice) return;
    const dir = world.wantDir(); if (!dir) return;
    const b = cur?.b.find((x) => x[0] === me()); if (!b) return;
    send({ k: "steer", x: Math.round(b[1] / 10 + dir.x * 12), y: Math.round(b[2] / 10 + dir.y * 12) }); ui.did("sail");
  }, 150);
  let chargeFrom = 0;
  const castDown = () => { chargeFrom = performance.now(); $("r-cast").classList.add("held"); };
  const castUp = () => {
    if (!chargeFrom) return;
    const charge = Math.min(1, (performance.now() - chargeFrom) / 1000); chargeFrom = 0; $("r-cast").classList.remove("held");
    if (practice) { practiceCast(charge); return; }
    send({ k: "cast", charge }); ui.did("cast"); if (charge > 0.5) ui.did("charge");
  };
  const dash = () => { if (practice) { practiceDash(); return; } send({ k: "dash" }); ui.did("dash"); };
  $("r-cast").addEventListener("pointerdown", castDown); $("r-cast").addEventListener("pointerup", castUp); $("r-cast").addEventListener("pointerleave", castUp);
  $("r-dash").addEventListener("click", dash);
  const onKey = (e) => {
    if (e.target.closest?.("input,textarea")) return;
    if (e.type === "keydown" && e.code === "Space" && !e.repeat) { e.preventDefault(); castDown(); }
    if (e.type === "keyup" && e.code === "Space") { e.preventDefault(); castUp(); }
    if (e.type === "keydown" && e.key === "Shift" && !e.repeat) dash();
  };
  addEventListener("keydown", onKey); addEventListener("keyup", onKey);

  // ---- events: floats, sounds, shakes, banners ----
  function events(ev) {
    for (const e of ev) {
      if (e.k === "cast") world.netDrop(e.x, e.y, e.r, colorOf(e.seat));
      if (e.k === "catch") {
        if (e.full) { world.floatText(e.x, e.y, t("r_hold_full"), "#ff9a86"); if (e.seat === me()) { sound.miss(); ui.banner(t("r_hold_full_b"), t("r_hold_full_s")); } }
        else if (e.n || e.koi) { world.floatText(e.x, e.y, `+${e.n + (e.koi ? 5 : 0)}${e.koi ? t("r_golden") : ""}`, colorOf(e.seat)); if (e.seat === me()) sound.catch(e.n); world.ripple(e.x, e.y, colorOf(e.seat), 1); if (e.combo) world.floatText(e.x, e.y + 0.6, t("r_combo", { n: e.combo }), "#ffd34d"); }
        else { world.floatText(e.x, e.y, e.fry ? t("r_fry_slip", { n: e.fry }) : t("r_empty"), "#b9b0c6"); if (e.seat === me()) sound.miss(); }
      }
      if (e.k === "bank" && cur) { const b = cur.b.find((x) => x[0] === e.seat); if (b) world.floatText(b[1] / 10, b[2] / 10, t("r_home", { n: e.v }), "#ffd34d"); if (e.seat === me()) sound.bank(); }
      if (e.k === "ram") {
        const v = cur?.b.find((x) => x[0] === e.v);
        if (v) { world.floatText(v[1] / 10, v[2] / 10, t("r_ram", { n: e.n }), "#ff7a5a"); world.ripple(v[1] / 10, v[2] / 10, "#ff7a5a", 0.7); }
        if (e.v === me()) { world.shake(); sound.hit(); ui.banner(t("r_rammed_you", { name: nameOf(e.a) }), t("r_rammed_you_s", { n: e.n })); }
        if (e.a === me()) ui.banner(t("r_you_rammed", { name: nameOf(e.v) }), t("r_you_rammed_s", { n: e.n }));
      }
      if (e.k === "pick") { world.floatText(e.x, e.y, t("r_scooped", { n: e.v }), colorOf(e.seat)); if (e.seat === me()) sound.coin(); }
      if (e.k === "koi") { world.ripple(e.x, e.y, "#ffd34d", 0.9, 2); ui.banner(t("r_koi"), t("r_koi_s", { n: 5 })); sound.big(); }
      if (e.k === "gong") { sound.horn(); ui.banner(t("r_gong"), e.spoiled ? t("r_gong_s", { n: e.spoiled }) : "", 2500); }
      if (e.k === "rest") { ui.banner(t("r_rest"), t("r_rest_s", { grew: e.grew, born: e.born }), 3500); world.setCameraMode("overview"); }
      if (e.k === "season") { ui.banner(t(`r_season_${e.season}`), t(`r_twist_${e.season}`), 3000); world.setCameraMode("follow", null); sound.chime?.(); }
      if (e.k === "market") renderMarket();
      if (e.k === "picked" && e.seat === me()) ui.rearm?.();
      if (e.k === "picks") renderPicks(e.picks);
      if (e.k === "end") sound.horn();
    }
  }

  // ---- the market overlay: three cards, a reroll, secret until it closes ----
  function cardHtml(id) {
    const kind = cur?.market ? Object.keys({}).length : 0; void kind;
    return `<button class="card" type="button" data-pick="${id}"><b>${esc(t(`r_card_${id}`))}</b><small>${t(`r_kind_${cardKindOf(id)}`)}</small><p>${esc(t(`r_text_${id}`))}</p></button>`;
  }
  const CARD_KIND = { bigHold: "plain", fastHull: "plain", wideNet: "plain", quickHands: "plain", ironBow: "plain", goldHook: "plain", fineMesh: "greedy", trawl: "greedy", ladder: "keeper", release: "keeper", reeds: "keeper" };
  const cardKindOf = (id) => CARD_KIND[id] ?? "plain";
  let marketPicked = false;
  function renderMarket() {
    marketPicked = false;
    const m = cur?.market; if (!m) return;
    ui.overlay.innerHTML = `<div class="sheet"><h2>${t("r_market")}</h2><p class="lede">${t("r_market_s", { season: t(`r_season_${(cur.season + 1) % 4}`) })}</p>
      <div class="offer">${m.offer.map(cardHtml).join("")}</div>
      <div class="row"><button class="btn ghost" type="button" id="r-reroll">${t("r_reroll", { n: 2 })}</button><button class="btn ghost" type="button" id="r-skip">${t("r_skip")}</button></div></div>`;
    ui.overlay.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { if (marketPicked) return; marketPicked = true; send({ k: "pick", id: b.dataset.pick }); }));
    $("r-reroll")?.addEventListener("click", () => send({ k: "reroll" }));
    $("r-skip")?.addEventListener("click", () => { if (marketPicked) return; marketPicked = true; send({ k: "pick", id: null }); });
  }
  function renderPicks(picks) {
    ui.overlay.innerHTML = `<div class="sheet narrow"><h2>${t("r_picks_h")}</h2><div class="picks">${(seats ?? []).map((s, seat) => {
      const id = picks[seat];
      return id ? `<span class="pick ${cardKindOf(id)}">${esc(t("r_picked", { name: nameOf(seat), card: t(`r_card_${id}`) }))}</span>` : `<span class="pick">${esc(t("r_picked_none", { name: nameOf(seat) }))}</span>`;
    }).join("")}</div></div>`;
    setTimeout(() => { ui.overlay.innerHTML = ""; world.setCameraMode("follow"); }, 2600);
  }

  function hudFrom(f) {
    const mine = me() !== null ? f.b.find((b) => b[0] === me()) : null;
    ui.setClock(f.left, f.phase !== "play" ? t(`r_season_${f.season}`) : "");
    ui.goalEl.textContent = t("rush_hud");
    if (mine) {
      $("r-hold").textContent = `${mine[4]} / ${mine[5]}`; $("r-bank").textContent = mine[7];
      $("r-holdbar").style.width = `${(mine[4] / mine[5]) * 100}%`; $("r-holdbar").style.background = mine[4] >= mine[5] ? "#ff7a5a" : "";
      $("r-tip").textContent = mine[10].length ? mine[10].map((id) => t(`r_card_${id}`)).join(", ") : t("r_tip");
      $("r-cast").disabled = mine[8] > 0; $("r-dash").disabled = mine[9] > 0;
    }
    $("r-board").innerHTML = [...f.b].sort((a, b) => b[7] - a[7]).map((b) => `<div><span><span class="swatch" style="background:${colorOf(b[0])}"></span>${esc(nameOf(b[0]))}</span><b>${b[7]} <small>${t("r_aboard", { n: b[4] })}</small></b></div>`).join("");
  }

  function coach() {
    if (!cur || me() === null) return;
    const b = cur.b.find((x) => x[0] === me()); if (!b) return;
    ui.coach([
      ["sail", t("r_coach_sail")],
      ["cast", t("r_coach_cast")],
      ["home", t("r_coach_home"), () => b[4] >= b[5] * 0.6],
      ["pick", t("r_coach_pick"), () => cur.phase === "market"],
    ]);
  }

  // ---- the ceremony: the server's results, worded from the room's dictionary ----
  function ceremonyData(results) {
    const extra = results.extra ?? {};
    const tier = { id: extra.tier?.id, mult: extra.tier?.mult };
    // the tier itself is not sent directly; derive it from lakeAfter against the shared tiers in the boot world data
    const boot = JSON.parse(document.getElementById("boot").textContent);
    const tiers = boot.world?.tiers ?? [[0.6, "rich", 1.2], [0.35, "fair", 1], [0.15, "lean", 0.8], [0, "none", 0.5]];
    const k = boot.world?.k ?? 340;
    const tierOf = (n) => { for (const [min, id, mult] of tiers) if (n >= min * k) return { id, mult }; return { id: "none", mult: 0.5 }; };
    const realTier = tierOf(results.lakeAfter);
    const ledger = (extra.ledger ?? []).map((l) => { const s = results.seats.find((x) => x.seat === l.seat); return { seat: l.seat, name: s?.name ?? "", character: s?.character ?? "mei", isMe: l.seat === me(), home: l.home, young: l.young, spared: l.spared }; });
    const podium = results.seats.map((s) => ({ seat: s.seat, name: s.name, character: s.character, isMe: s.seat === me(), base: s.score, score: Math.round(s.score * realTier.mult), sub: undefined }));
    return {
      a: results.lakeAfter, y: 0, next: results.lakeAfter, tier: realTier,
      counterfactual: extra.counterfactual, ledger, fairShare: extra.fairShare, unit: t("g_unit_rush"),
      titles: (extra.titles ?? []).map((ti) => ({ key: ti.key, vars: { ...ti.vars, name: results.seats.find((s) => s.seat === ti.seat)?.name } })),
      podium,
    };
  }
  function renderResults(v, overlayEl) {
    const data = ceremonyData(v.results);
    const deps = { t, esc, portrait: ui.portrait, zh: (key) => { const z = i18nZh(key); return z ?? key; } };
    const boot = JSON.parse(document.getElementById("boot").textContent);
    const zhWords = boot.other ?? {};
    deps.zh = (key) => zhWords[key] ?? key;
    const html = ceremonySteps(data, deps);
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
  function i18nZh() { return undefined; } // placeholder, replaced by the boot-sourced lookup above

  // ---- the 30 s practice (client-only; never sent, stored or scored) ----
  function startPractice() {
    world.resetHouses?.();
    practice = { step: 1, hold: 0, fish: [{ x: 10, y: 6 }, { x: 10.5, y: 6 }, { x: 9.5, y: 6.3 }], ring: [12, 8], dockX: 0, dockY: 0, banked: 0 };
    world.pointAt(practice.ring[0], practice.ring[1]);
    const b = world.boat(me() ?? 0, colorOf(me() ?? 0), t("g_you"));
    world.drawBoat(b, 0, 0, 0, 0, { hold: 0 });
    ui.coach(null);
    ui.banner(t("r_p1t"), t("r_p1p"));
  }
  function practiceCast(charge) { if (!practice) return; void charge; if (Math.hypot(practice.fish[0].x - practice.ring[0], practice.fish[0].y - practice.ring[1]) < 6) practice.hold = Math.min(12, practice.hold + 3); }
  function practiceDash() { /* no ram target in practice */ }
  function endPractice() { practice = null; world.pointAt(null); }

  return {
    room(v) { seats = v.seats; },
    start(frame, v) {
      seats = v.seats; prev = cur = frame; curAt = performance.now();
      world.setDocks(seats.map((s, i) => ({ x: world.docks[i]?.x ?? 0, y: world.docks[i]?.z ?? 0, color: COLORS[s.character] })));
      for (const b of frame.b) world.boat(b[0], colorOf(b[0]), nameOf(b[0]));
      world.onFrame(draw); hudFrom(frame);
    },
    frame(f, ev) { seats = view().seats ?? seats; prev = cur ?? f; cur = f; curAt = performance.now(); events(ev); hudFrom(f); coach(); },
    results(v, overlayEl) { renderResults(v, overlayEl); },
    practice: { start: startPractice, end: endPractice },
    end() { clearInterval(wasdId); removeEventListener("keydown", onKey); removeEventListener("keyup", onKey); },
  };

  function draw(dt, t) {
    if (!cur) return;
    const k = Math.min(1, (performance.now() - curAt) / 100);
    const lerp = (a, b) => a + (b - a) * k;
    const la = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
    for (const b of cur.b) {
      const p = prev.b.find((x) => x[0] === b[0]) ?? b;
      const bt = world.boat(b[0], colorOf(b[0]), `${nameOf(b[0])} · ${b[7]}${b[4] ? ` (+${b[4]})` : ""}`);
      world.drawBoat(bt, lerp(p[1] / 10, b[1] / 10), lerp(p[2] / 10, b[2] / 10), la(p[3] / 100, b[3] / 100), t, { hold: b[4] });
    }
    const fish = cur.f.map((f, i) => { const p = prev.f[i]; return p ? [lerp(p[0] / 10, f[0] / 10), lerp(p[1] / 10, f[1] / 10), f[2] / 100, f[3] ? 1 : 0.6] : [f[0] / 10, f[1] / 10, f[2] / 100, f[3] ? 1 : 0.6]; });
    world.setFish(fish, t);
    world.setKoi(cur.k ? [cur.k[0] / 10, cur.k[1] / 10, cur.k[2] / 100] : null, t);
    for (const l of cur.l) { const m = world.prop(`l${l[0]}`, () => { const g = new world.THREE.Mesh(new world.THREE.SphereGeometry(0.04, 6, 5).scale(1.6, 0.7, 1), world.toon(l[3] > 1 ? "#ffd34d" : "#f08a3c")); return g; }); m.position.set(l[1] / 10, 0.015 + Math.sin(t * 4 + l[0]) * 0.008, l[2] / 10); m.rotation.y += dt * 2; }
    world.sweepProps();
    if (me() !== null) { const b = cur.b.find((x) => x[0] === me()); if (b) world.setCameraMode("follow", { x: b[1] / 10, z: b[2] / 10, h: b[3] / 100, speed: 5 }); }
    world.setLanterns([]);
    world.setNight(0);
  }
}
