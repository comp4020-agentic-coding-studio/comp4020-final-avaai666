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
  // in the practice (before any match, so no seat) you are seat 0, alone
  const me = () => (practice ? practice.seat : view().mySeat);
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
  world.setTap((x, y) => { if (practice) { practice.tx = x; practice.ty = y; return; } if (me() === null) return; send({ k: "steer", x, y }); ui.did("sail"); });
  let wasdId = setInterval(() => {
    if (me() === null || practice) return;
    const dir = world.wantDir(); if (!dir) return;
    const b = cur?.b.find((x) => x[0] === me()); if (!b) return;
    send({ k: "steer", x: Math.round((b[1] / 10 + dir.x * 12) * 10) / 10, y: Math.round((b[2] / 10 + dir.z * 12) * 10) / 10 }); ui.did("sail");
  }, 100); // ten a second while you steer (the input limit is 30)
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
    const kind = cardKindOf(id);
    return `<button class="card ${kind}" type="button" data-pick="${id}"><span class="kind">${esc(t(`r_kind_${kind}`))}</span><b>${esc(t(`r_card_${id}`))}</b><p>${esc(t(`r_text_${id}`))}</p></button>`;
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
    ui.overlay.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
      if (marketPicked) return; marketPicked = true; send({ k: "pick", id: b.dataset.pick });
      // show the choice at once: the card stays lit, the others and the buttons go quiet
      ui.overlay.querySelectorAll("[data-pick]").forEach((o) => { if (o === b) o.classList.add("chosen"); else o.disabled = true; });
      ui.overlay.querySelectorAll("#r-reroll,#r-skip").forEach((o) => { o.disabled = true; });
    }));
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
    // the match's lake (its size and docks, rule change 11) and your home on it
    if (!practice) { world.setLake?.(f.lk); if (me() !== null) world.setHome?.(me(), colorOf(me()), t("g_your_home")); }
    const mine = me() !== null ? f.b.find((b) => b[0] === me()) : null;
    // an arrow home when your boat is half full, or in the Rush with fish aboard (DESIGN.md: "an arrow home if you carry fish")
    if (!practice) { const d = mine ? world.docks?.[me()] : null; const go = d && f.phase === "play" && (mine[4] >= mine[5] * 0.5 || (f.left <= 10 && mine[4] > 0)); world.pointAt(go ? d.wx : null, go ? d.wz : null); }
    ui.setClock(f.left, t(`r_season_${f.season}`));
    ui.goalEl.textContent = t("rush_hud");
    // the last 10 s of a season is the Rush (DESIGN.md): faster music
    if (!practice) sound.music?.(f.phase === "play" && f.left <= 10 ? "rush" : "play");
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
      ["sail", t(matchMedia("(pointer: coarse)").matches ? "r_coach_sail" : "r_coach_sail_keys")],
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
    const ledger = (extra.ledger ?? []).map((l) => { const s = results.seats.find((x) => x.seat === l.seat); return { seat: l.seat, name: l.seat === me() ? (s?.name ?? "") : nameOf(l.seat), character: s?.character ?? "mei", isMe: l.seat === me(), home: l.home, young: l.young, spared: l.spared }; });
    const podium = results.seats.map((s) => ({ seat: s.seat, name: s.seat === me() ? s.name : nameOf(s.seat), character: s.character, isMe: s.seat === me(), base: s.score, score: Math.round(s.score * realTier.mult), sub: undefined }));
    return {
      a: extra.left?.a ?? results.lakeAfter, y: extra.left?.y ?? 0, next: results.lakeAfter, tier: realTier,
      counterfactual: extra.counterfactual, ledger, fairShare: extra.fairShare, unit: t("g_unit_rush"),
      titles: (extra.titles ?? []).map((ti) => ({ key: ti.key, vars: { ...ti.vars, name: nameOf(ti.seat) } })),
      podium,
    };
  }
  function renderResults(v, overlayEl) {
    const data = ceremonyData(v.results);
    // the stamp is always the Chinese characters (DESIGN "The ceremony"): on a
    // Chinese page that is the page's own word; on an English page it is in
    // the boot JSON's `other` (the opposite language's words)
    const boot = JSON.parse(document.getElementById("boot").textContent);
    const zh = (key) => (boot.lang === "zh" ? t(key) : (boot.other ?? {})[key] ?? key);
    const deps = { t, esc, portrait: ui.portrait, zh };
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

  // ---- the 30 s practice (client-only; never sent, stored or scored) ----
  // DESIGN.md "Practice runs in the browser only": alone, no clock, three steps with an arrow (sail to the
  // gold ring, net the school ahead of your bow, take the fish home). It builds frames in the match's own
  // shape so draw() and the HUD show it like a match; nothing here reaches the server.
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  function startPractice(onDone) {
    const bootEl = document.getElementById("boot");
    const P = (bootEl ? JSON.parse(bootEl.textContent).rushPractice : null) ?? { speed: 15, loadSlow: 0.35, hold: 12, netR: 4.5, netAhead: 4, castCd: 0.7, dockR: 6.5, ring: 24 };
    const seat = 0, d = world.docks[seat % world.docks.length], ix = Math.cos(d.inward), iy = Math.sin(d.inward);
    const ring = [d.x + ix * P.ring, d.z + iy * P.ring]; // the prototype's 24, at the lake's scale
    practice = { P, seat, step: 1, hold: 0, banked: 0, castCd: 0, x: d.x + ix * 6, y: d.z + iy * 6, h: d.inward, v: 0, tx: d.x + ix * 6, ty: d.z + iy * 6,
      dock: [d.x + ix * 3, d.z + iy * 3], ring, fish: [], ringT: 0, onDone, t: 0 };
    const mine = view().players?.[view().me];
    seats = [{ name: mine?.name ?? "", character: mine?.character ?? "mei", bot: null }];
    world.clearBoats?.(); world.setDocks([{ x: d.x, y: d.z, color: colorOf(seat) }]);
    world.setCameraMode("follow");
    world.pointAt(ring[0], ring[1]);
    ui.overlay.innerHTML = "";
    ui.setClock(null, t("r_practising"));
    pBanner(1);
    prev = cur = practiceFrame(); curAt = performance.now();
    world.onFrame(draw);
    practice.timer = setInterval(practiceTick, 50);
  }
  const pBanner = (n) => ui.banner(t(n < 3 && !touch ? `r_p${n}k` : `r_p${n}`), t(`r_p${n}s`), 4000);
  function practiceFrame() {
    const p = practice;
    return { phase: "sail", season: 0, left: 0, market: null, n: [], l: [], k: null,
      b: [[p.seat, Math.round(p.x * 10), Math.round(p.y * 10), Math.round(p.h * 100), p.hold, p.P.hold, 0, p.banked, Math.ceil(p.castCd * 10), 0, [], Math.round(p.tx * 10), Math.round(p.ty * 10)]],
      f: p.fish.map((f) => [Math.round(f.x * 10), Math.round(f.y * 10), Math.round(f.h * 100), 1]) };
  }
  function practiceTick() {
    const p = practice; if (!p) return;
    // steps of at most 0.05 s over the real time since the last tick, so a slow page still sails at full speed
    const now = performance.now(), elapsed = Math.min(0.5, (now - (p.last ?? now - 50)) / 1000); p.last = now;
    for (let left = elapsed; left > 1e-6 && practice === p && p.step < 4; left -= 0.05) practiceStep(p, Math.min(0.05, left));
    if (practice !== p) return;
    prev = cur; cur = practiceFrame(); curAt = performance.now();
    hudFrom(cur); ui.setClock(null, t("r_practising"));
  }
  function practiceStep(p, dt) {
    p.t += dt; p.castCd = Math.max(0, p.castCd - dt);
    const dir = world.wantDir(); if (dir) { p.tx = p.x + dir.x * 12; p.ty = p.y + dir.z * 12; }
    // sail toward the target: turn, then speed up; a fuller hold is slower (the match's own numbers)
    const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
    if (dist > 0.8) { let da = Math.atan2(dy, dx) - p.h; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; p.h += Math.max(-4 * dt, Math.min(4 * dt, da)); }
    const want = dist > 0.8 ? p.P.speed * (1 - p.P.loadSlow * (p.hold / p.P.hold)) : 0;
    p.v += (want - p.v) * Math.min(1, dt * 6);
    p.x += Math.cos(p.h) * p.v * dt; p.y += Math.sin(p.h) * p.v * dt;
    // stay on the water: not past the shore, not onto the island
    const share = world.shoreShare?.(p.x, p.y) ?? 0;
    if (share > 0.95) { p.x *= 0.95 / share; p.y *= 0.95 / share; }
    const isl = world.island, di = isl ? Math.hypot(p.x - isl.x, p.y - isl.z) : Infinity;
    if (isl && di < isl.r + 1.5) { p.x = isl.x + ((p.x - isl.x) / (di || 1)) * (isl.r + 1.5); p.y = isl.z + ((p.y - isl.z) / (di || 1)) * (isl.r + 1.5); }
    // the school circles just ahead of your bow (it keeps there while you sail), so NET is the next thing to press
    if (p.step === 2) { const bx = p.x + Math.cos(p.h) * (p.P.netAhead + 0.5), by = p.y + Math.sin(p.h) * (p.P.netAhead + 0.5), k = Math.min(1, dt * 3); p.ring[0] += (bx - p.ring[0]) * k; p.ring[1] += (by - p.ring[1]) * k; }
    for (const f of p.fish) { f.a += dt * 0.9; const nx = p.ring[0] + Math.cos(f.a) * f.r, ny = p.ring[1] + Math.sin(f.a) * f.r * 0.7; f.h = Math.atan2(ny - f.y, nx - f.x); f.x = nx; f.y = ny; }
    if (p.step === 1 && Math.hypot(p.x - p.ring[0], p.y - p.ring[1]) < 5) {
      // the school surfaces just ahead of your bow and the boat drifts to a stop: one NET takes it
      p.step = 2; p.tx = p.x; p.ty = p.y;
      p.ring = [p.x + Math.cos(p.h) * (p.P.netAhead + 1), p.y + Math.sin(p.h) * (p.P.netAhead + 1)];
      p.fish = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * Math.PI * 2, r: 1.2 + (i % 2) * 0.8, x: p.ring[0], y: p.ring[1], h: 0 }));
      world.pointAt(null); pBanner(2); ui.did("sail");
    }
    if (p.step === 3 && Math.hypot(p.x - p.dock[0], p.y - p.dock[1]) < p.P.dockR) {
      p.banked += p.hold; world.floatText(p.x, p.y, t("r_home", { n: p.hold }), "#ffd34d"); sound.bank?.(); p.hold = 0; p.step = 4;
      clearInterval(p.timer); world.pointAt(null);
      ui.overlay.innerHTML = `<div class="sheet narrow"><h2>${esc(t("r_p_done"))}</h2><p class="lede">${esc(t("r_p_done_s"))}</p><div class="row"><button class="btn primary" type="button" id="r-p-start">${esc(t("r_p_start"))}</button><a class="btn ghost" href="/play/${esc(view().code)}">${esc(t("g_back_room"))}</a></div></div>`;
      ui.overlay.querySelector("#r-p-start")?.addEventListener("click", () => p.onDone?.("start"));
    }
  }
  function practiceCast() {
    const p = practice; if (!p || p.castCd > 0 || p.step >= 4) return;
    p.castCd = p.P.castCd;
    const nx = p.x + Math.cos(p.h) * p.P.netAhead, ny = p.y + Math.sin(p.h) * p.P.netAhead;
    world.netDrop(nx, ny, p.P.netR, colorOf(p.seat));
    const caught = p.fish.filter((f) => Math.hypot(f.x - nx, f.y - ny) < p.P.netR);
    p.fish = p.fish.filter((f) => !caught.includes(f));
    if (caught.length) { p.hold += caught.length; world.floatText(nx, ny, `+${caught.length}`, colorOf(p.seat)); sound.catch?.(caught.length); ui.did("cast"); }
    else { world.floatText(nx, ny, t("r_empty"), "#b9b0c6"); sound.miss?.(); }
    if (p.step === 2 && (p.hold >= 3 || !p.fish.length)) { p.step = 3; world.pointAt(p.dock[0], p.dock[1]); pBanner(3); }
  }
  function practiceDash() { /* no boat to ram in practice */ }
  function endPractice() { if (!practice) return; clearInterval(practice.timer); practice = null; world.pointAt(null); prev = cur = null; ui.overlay.innerHTML = ""; }

  return {
    room(v) { seats = v.seats; },
    start(frame, v) {
      endPractice();
      seats = v.seats; prev = cur = frame; curAt = performance.now();
      world.setLake?.(frame.lk);
      world.setDocks(seats.map((s, i) => ({ x: world.docks[i]?.x ?? 0, y: world.docks[i]?.z ?? 0, color: COLORS[s.character] })));
      for (const b of frame.b) world.boat(b[0], colorOf(b[0]), nameOf(b[0]));
      world.onFrame(draw); hudFrom(frame);
    },
    frame(f, ev) { seats = view().seats ?? seats; prev = cur ?? f; cur = f; curAt = performance.now(); events(ev); hudFrom(f); coach(); },
    results(v, overlayEl) { renderResults(v, overlayEl); },
    practice: { start: startPractice, end: endPractice },
    end() { endPractice(); clearInterval(wasdId); removeEventListener("keydown", onKey); removeEventListener("keyup", onKey); },
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
    // the practice's gold ring (step 1)
    if (practice && practice.step === 1) {
      const ring = world.prop("practice-ring", () => world.makeRing(4.3, 6.4));
      ring.position.set(practice.ring[0], 0.15, practice.ring[1]); ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    }
    world.sweepProps();
    if (me() !== null) { const b = cur.b.find((x) => x[0] === me()); if (b) world.setCameraMode("follow", { x: b[1] / 10, z: b[2] / 10, h: b[3] / 100, speed: 5 }); }
    world.setLanterns([]);
    world.setNight(0);
  }
}
