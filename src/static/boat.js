// The boat game's page (experimental; docs/boats/RULES.md). It sends this
// player's inputs (steer, cast, dash) and draws what the server sends: the
// room, frames ten times a second, and the events inside them. It never
// decides a catch, a ram, a pick-up or a score; it only draws them, about a
// tenth of a second behind the server so the motion is smooth.
"use strict";
(() => {
  document.documentElement.classList.add("js");
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const homeForm = $("join-code");
  if (homeForm) homeForm.addEventListener("submit", (e) => { e.preventDefault(); const c = $("code").value.trim().toUpperCase(); if (/^[A-Z]{4}$/.test(c)) location.href = `/b/${c}`; });
  const board = $("board");
  if (!board) return;

  // ---- the numbers the drawing needs (boat-sim.ts Q) ----
  const W = 1000, H = 700, RX = 460, RY = 315, SHALLOW = 0.72, NET_R = 38, NET_AHEAD = 40, DOCK_R = 60, SAFE_R = 95, HOLD = 10, KOI_VALUE = 5;
  const TIERS = [0, 10, 25, 45, 70, 100], PARTS = ["thatched hut", "tiled roof", "red gate", "lanterns", "upper floor", "pagoda"];
  const COLORS = ["#d7261e", "#22327a", "#c98a00", "#1f8a5b"];
  const FLAG = { DASH: 1, STUN: 2, SHIELD: 4, DOCKED: 8, KOI: 16 };
  const BOT_ZH = { "Old Wang": "王", Jin: "金", Mei: "梅" };
  const LINE = "#1f2a5c", ZH = `"Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi",serif`;
  const ell = (x, y) => Math.hypot((x - W / 2) / RX, (y - H / 2) / RY);
  const tierOf = (n) => { let t = 0; TIERS.forEach((v, i) => { if (n >= v) t = i; }); return t; };

  let view = JSON.parse($("boot").textContent);
  const code = view.code;
  const S = { frames: [], off: null, events: [], seats: view.seats || [], go: null, log: [], floats: [], particles: [], splashes: [], pops: {}, seen: new Set(), lastBanked: {}, bots: null };
  const nBoats = () => (S.seats.length || 2);
  const mine = () => view.myBoat;
  const nameOf = (seat) => (seat === mine() ? "You" : S.seats[seat] ? S.seats[seat].name : `Boat ${seat + 1}`);
  const zhOf = (seat) => { const s = S.seats[seat]; if (!s) return "?"; return s.bot ? BOT_ZH[s.name] || "?" : (s.name.trim()[0] || "?").toUpperCase(); };
  function dockOf(seat) { const a = Math.PI / 2 + (seat * 2 * Math.PI) / Math.max(nBoats(), 2); return { x: W / 2 + RX * 0.9 * Math.cos(a), y: H / 2 + RY * 0.9 * Math.sin(a), a }; }

  // ---- canvas geometry ----
  const cv = $("lake"), cx = cv.getContext("2d");
  const VW = 1160, VH = 860, OX = 80, OY = 80, CX = OX + W / 2, CY = OY + H / 2;
  let scale = 1, offX = 0, offY = 0, DPR = 1, bg = null, Z = 1;
  function homeOf(seat) { const d = dockOf(seat), c = Math.cos(d.a), s = Math.sin(d.a); return { x: CX + 534 * Math.sign(c) * Math.abs(c) ** 0.55, y: CY + 386 * Math.sign(s) * Math.abs(s) ** 0.55, c, s }; }
  function resize() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.height * DPR);
    scale = Math.min(r.width / VW, r.height / VH); offX = (r.width - VW * scale) / 2; offY = (r.height - VH * scale) / 2;
    Z = r.width < 640 ? 1.45 : r.width < 900 ? 1.15 : 1; bg = null;
  }
  const toWorld = (px, py) => ({ x: (px - offX) / scale - OX, y: (py - offY) / scale - OY });
  function buildBg() {
    const b = document.createElement("canvas"); b.width = cv.width; b.height = cv.height;
    const c = b.getContext("2d"); c.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * offX, DPR * offY);
    c.fillStyle = "#fbe7bf"; c.fillRect(-OX, -OY, VW + 2 * OX, VH + 2 * OY);
    c.strokeStyle = "rgba(31,138,91,.4)"; c.lineWidth = 2;
    for (let i = 0; i < 180; i++) { const a = (i / 180) * Math.PI * 2, rr = 1.05 + (i % 3) * 0.035; const x = CX + Math.cos(a) * RX * rr, y = CY + Math.sin(a) * RY * rr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 9); c.stroke(); }
    c.save(); c.beginPath(); c.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = "#86cbc2"; c.fillRect(OX, OY, W, H);
    c.beginPath(); c.ellipse(CX, CY, RX * SHALLOW, RY * SHALLOW, 0, 0, Math.PI * 2); c.fillStyle = "#1f7f8c"; c.fill();
    c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 2;
    for (let y = OY - 10; y < OY + H + 20; y += 22) for (let x = OX - 20 + ((y / 22) % 2) * 18; x < OX + W + 20; x += 36) { c.beginPath(); c.arc(x, y, 16, Math.PI, 0); c.stroke(); }
    c.restore();
    c.lineWidth = 7; c.strokeStyle = LINE; c.beginPath(); c.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2); c.stroke();
    for (let seat = 0; seat < nBoats(); seat++) {
      const d = dockOf(seat), hm = homeOf(seat), dx = OX + d.x, dy = OY + d.y, col = COLORS[seat];
      c.setLineDash([2, 8]); c.strokeStyle = "rgba(255,246,227,.55)"; c.lineWidth = 2; c.beginPath(); c.arc(dx, dy, SAFE_R, 0, Math.PI * 2); c.stroke();
      c.setLineDash([7, 6]); c.strokeStyle = col; c.lineWidth = 4; c.fillStyle = "rgba(255,246,227,.28)"; c.beginPath(); c.arc(dx, dy, DOCK_R, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash([]);
      c.save(); c.translate(dx, dy); c.rotate(d.a);
      c.fillStyle = "#9c6b20"; c.strokeStyle = LINE; c.lineWidth = 2.5; c.fillRect(-4, -13, 66, 26); c.strokeRect(-4, -13, 66, 26);
      c.strokeStyle = "rgba(31,42,92,.45)"; c.lineWidth = 1.5; for (let k = 6; k < 62; k += 10) { c.beginPath(); c.moveTo(k, -13); c.lineTo(k, 13); c.stroke(); }
      c.restore();
      c.strokeStyle = "#9c6b20"; c.lineWidth = 6; c.beginPath(); c.moveTo(dx + Math.cos(d.a) * 60, dy + Math.sin(d.a) * 60); c.lineTo(hm.x, hm.y); c.stroke();
    }
    bg = b;
  }
  function seal(x, y, ch, size, rot = 0.12, color = "#d7261e", alpha = 1) {
    cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, alpha)); cx.translate(x, y); cx.rotate(rot); cx.fillStyle = color; cx.strokeStyle = "#fff6e3"; cx.lineWidth = 2;
    cx.beginPath(); cx.roundRect(-size / 2, -size / 2, size, size, size * 0.16); cx.fill(); cx.strokeRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6);
    cx.fillStyle = "#fff6e3"; cx.font = `${size * 0.66}px ${ZH}`; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(ch, 0, 1); cx.restore();
  }
  function drawHouse(seat, banked, leader, t) {
    const h = homeOf(seat), tier = tierOf(banked), w = 46 + tier * 5, hh = 26 + Math.min(tier, 3) * 3, col = COLORS[seat];
    const since = (performance.now() - (S.pops[seat] || -9e9)) / 1000, bounce = since < 0.6 ? 1 + Math.sin((since / 0.6) * Math.PI) * 0.35 : 1;
    cx.save(); cx.translate(h.x, h.y); cx.scale(bounce, bounce); cx.lineWidth = 2.5; cx.strokeStyle = LINE; cx.textBaseline = "middle";
    cx.fillStyle = tier >= 2 ? "#fff6e3" : "#f3dfb8"; cx.fillRect(-w / 2, -hh / 2, w, hh); cx.strokeRect(-w / 2, -hh / 2, w, hh);
    cx.fillStyle = tier >= 2 ? "#d7261e" : "#9c6b20"; cx.fillRect(-7, hh / 2 - 16, 14, 16); cx.strokeRect(-7, hh / 2 - 16, 14, 16);
    const roofC = tier === 0 ? "#b98b3e" : "#3b4a7a";
    const roof = (y, ww) => { cx.fillStyle = roofC; cx.beginPath(); cx.moveTo(-ww / 2 - 10, y); cx.quadraticCurveTo(-ww / 4, y - 6, 0, y - 20); cx.quadraticCurveTo(ww / 4, y - 6, ww / 2 + 10, y); cx.closePath(); cx.fill(); cx.stroke(); };
    if (tier >= 4) { cx.fillStyle = "#fff6e3"; cx.fillRect(-w / 2 + 6, -hh / 2 - 22, w - 12, 22); cx.strokeRect(-w / 2 + 6, -hh / 2 - 22, w - 12, 22); }
    if (tier >= 5) { cx.fillStyle = "#fff6e3"; cx.fillRect(-w / 2 + 14, -hh / 2 - 46, w - 28, 18); cx.strokeRect(-w / 2 + 14, -hh / 2 - 46, w - 28, 18); roof(-hh / 2 - 46, w - 28); }
    if (tier >= 4) roof(-hh / 2 - 22, w - 12);
    roof(-hh / 2, w);
    if (tier >= 3) [-w / 2 - 6, w / 2 + 6].forEach((x) => { cx.fillStyle = "#d7261e"; cx.beginPath(); cx.ellipse(x, -hh / 2 + 6 + Math.sin(t * 2 + x) * 1.5, 6, 8, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); });
    cx.fillStyle = col; const fx = w / 2 + 18, fy = hh / 2 - 6; cx.beginPath(); cx.roundRect(fx - 14, fy - 30, 28, 28, 5); cx.fill(); cx.stroke();
    cx.fillStyle = "#fff6e3"; cx.font = `20px ${ZH}`; cx.textAlign = "center"; cx.fillText(zhOf(seat), fx, fy - 15);
    if (leader) seal(-w / 2 - 18, -hh / 2 - 14, "首", 26, -0.2, "#c98a00");
    const lx = h.c < -0.6 ? 34 : h.c > 0.6 ? -34 : 0;
    cx.fillStyle = LINE; cx.font = "900 16px Nunito, system-ui, sans-serif"; cx.fillText(`${nameOf(seat)} · ${banked}`, lx, hh / 2 + 14, 150);
    cx.restore();
  }
  function drawFish(x, y, h, adult, id, t, a) {
    cx.save(); cx.globalAlpha = a; cx.translate(OX + x, OY + y); cx.rotate(h); cx.scale(Z, Z);
    if (!adult) { cx.fillStyle = "rgba(255,240,200,.95)"; cx.strokeStyle = "rgba(31,42,92,.5)"; cx.lineWidth = 0.6; cx.beginPath(); cx.ellipse(0, 0, 4.6, 2.1, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); }
    else {
      const C = [["#e8452c", "#f2b705"], ["#f2b705", "#e8452c"], ["#ffffff", "#e8452c"], ["#e8452c", "#ffffff"]][id % 4], wig = Math.sin(t * 9 + id) * 0.35;
      cx.fillStyle = C[0]; cx.strokeStyle = "rgba(31,42,92,.85)"; cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(-8, 0); cx.lineTo(-14, -5 + wig * 4); cx.lineTo(-13, 0); cx.lineTo(-14, 5 + wig * 4); cx.closePath(); cx.fill(); cx.stroke();
      cx.beginPath(); cx.ellipse(0, 0, 10, 4.6, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
      cx.fillStyle = C[1]; cx.beginPath(); cx.ellipse(1, -0.5, 3.6, 2.3, 0, 0, Math.PI * 2); cx.fill();
    }
    cx.restore();
  }
  function drawBoat(b, t, isMe) {
    const [seat, x0, y0, h100, holdN, holdV, flags] = b, x = OX + x0, y = OY + y0, h = h100 / 100, col = COLORS[seat];
    cx.save(); cx.translate(x, y); cx.scale(1.3 * Z, 1.3 * Z);
    if (isMe) { cx.strokeStyle = "#fff6e3"; cx.lineWidth = 3; cx.setLineDash([4, 4]); cx.beginPath(); cx.arc(0, 0, 27, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]); }
    if (flags & FLAG.SHIELD) { cx.strokeStyle = "rgba(255,255,255,.7)"; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, 22 + Math.sin(t * 10) * 1.5, 0, Math.PI * 2); cx.stroke(); }
    if (flags & FLAG.KOI) { cx.shadowColor = "#f2b705"; cx.shadowBlur = 22; }
    cx.rotate(h + (flags & FLAG.STUN ? Math.sin(t * 40) * 0.4 : 0));
    if (flags & FLAG.DASH) { cx.strokeStyle = "rgba(255,255,255,.95)"; cx.lineWidth = 3; for (let k = 0; k < 3; k++) { cx.beginPath(); cx.moveTo(-26 - k * 9, -8 + k * 8); cx.lineTo(-50 - k * 12, -8 + k * 8); cx.stroke(); } }
    cx.fillStyle = "#8a5a22"; cx.strokeStyle = LINE; cx.lineWidth = 2.5;
    cx.beginPath(); cx.moveTo(24, 0); cx.quadraticCurveTo(12, -12, -18, -11); cx.lineTo(-22, 0); cx.lineTo(-18, 11); cx.quadraticCurveTo(12, 12, 24, 0); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = col; cx.fillRect(-16, -5, 26, 10);
    for (let k = 0; k < Math.min(holdN, 10); k++) { cx.fillStyle = k % 3 ? "#e8452c" : "#f2b705"; cx.beginPath(); cx.ellipse(-12 + (k % 5) * 5, -3 + Math.floor(k / 5) * 6, 3.4, 2, 0, 0, Math.PI * 2); cx.fill(); }
    cx.shadowBlur = 0;
    cx.fillStyle = "#fff6e3"; cx.beginPath(); cx.moveTo(4, 0); cx.lineTo(-10, -20); cx.lineTo(-10, 0); cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = col; cx.fillRect(-12, -24, 10, 6);
    cx.restore();
    const full = holdN >= HOLD, tag = full ? "FULL" : `${holdN}/${HOLD}`;
    cx.font = `900 ${Math.round(13 * Math.max(1, Z * 0.9))}px Nunito, system-ui, sans-serif`; cx.textAlign = "center"; cx.textBaseline = "middle";
    const tw = cx.measureText(tag).width + 14;
    cx.fillStyle = full ? "#d7261e" : col; cx.beginPath(); cx.roundRect(x - tw / 2, y - 44 * Z, tw, 19, 9); cx.fill();
    cx.fillStyle = "#fff6e3"; cx.fillText(tag, x, y - 34.5 * Z);
    cx.font = "900 12px Nunito, system-ui, sans-serif"; cx.lineWidth = 3; cx.strokeStyle = "rgba(31,42,92,.8)"; const nm = isMe ? "YOU" : nameOf(seat);
    cx.strokeText(nm, x, y + 34 * Z); cx.fillStyle = "#fff6e3"; cx.fillText(nm, x, y + 34 * Z);
    if (flags & FLAG.STUN) { cx.font = "900 16px Nunito, system-ui, sans-serif"; cx.fillStyle = "#fff6e3"; cx.fillText("✶ ✶", x, y - 58 * Z); }
    if (holdV > holdN) { cx.font = "900 12px Nunito, system-ui, sans-serif"; cx.fillStyle = "#c98a00"; cx.fillText(`worth ${holdV}`, x, y - 56 * Z); }
  }

  // ---- frames and the clock ----
  const DELAY = 0.12;
  function onFrame(fr) {
    const at = performance.now(), off = at - fr.t * 1000;
    S.off = S.off === null || off < S.off ? off : S.off + 0.5; // the least-delayed frame, drifting up slowly
    const boats = new Map(fr.b.map((b) => [b[0], b])), fish = new Map(fr.f.map((f) => [f[0], f]));
    S.frames.push({ t: fr.t, boats, fish, n: fr.n, l: fr.l, k: fr.k, left: fr.left, fishN: fr.fishN, adultsN: fr.adultsN });
    while (S.frames.length > 10) S.frames.shift();
    for (const e of fr.ev || []) onEvent(e, fr);
  }
  const serverT = () => (S.off === null ? 0 : (performance.now() - S.off) / 1000);
  const latest = () => S.frames[S.frames.length - 1];

  // ---- what happened: words and effects (the server already decided) ----
  function floatAt(x, y, text, sub, color, big) { S.floats.push({ x, y, text, sub, color, big, at: performance.now() }); }
  function burst(x, y, colors, n = 26) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120; S.particles.push({ x: OX + x, y: OY + y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: colors[i % colors.length] }); } }
  function logLine(text, hot) { S.log.unshift({ text, hot }); $("log").innerHTML = S.log.slice(0, 18).map((e) => `<li class="${e.hot ? "hot" : ""}">${esc(e.text)}</li>`).join(""); }
  let bannerTm = 0;
  function banner(key, g, html, ms = 4000) { if (key && S.seen.has(key)) return; if (key) S.seen.add(key); $("banner-g").textContent = g; $("banner-t").innerHTML = html; $("banner").hidden = false; clearTimeout(bannerTm); bannerTm = setTimeout(() => ($("banner").hidden = true), ms); }
  function onEvent(e) {
    const me = mine();
    if (e.k === "cast") S.splashes.push({ x: e.x, y: e.y, at: performance.now(), seat: e.seat });
    if (e.k === "catch") {
      const col = COLORS[e.seat];
      if (e.full && !e.n && !e.koi) { if (e.seat === me) { floatAt(e.x, e.y - 40, "hold full!", "sail home to unload", LINE, true); sfx.tick(); banner("full", "满", "Your hold is <b>full</b>. Nothing more fits: <b>sail home</b> to unload it."); } return; }
      const sub = e.full ? `hold full: ${e.full} swam on` : e.fry ? `${e.fry} fry slipped through` : !e.n ? "missed" : "";
      floatAt(e.x, e.y, e.n || e.koi ? `+${e.n}${e.koi ? " + golden carp" : ""}` : "empty", sub, col, e.seat === me);
      if (e.seat === me) { sfx.haul(e.n); if (e.n) banner("first-catch", "舱", "Those fish are in your <b>hold</b>, not your house. <b>Sail into your dock</b> to bank them. A ram can spill them first."); }
      if (e.koi) { logLine(`${nameOf(e.seat)} netted the golden carp (worth ${KOI_VALUE}). Not home yet!`, true); burst(e.x, e.y, ["#f2b705", "#fff6e3"]); if (e.seat === me) banner(null, "锦", "You have the <b>golden carp</b>. Everyone can see it glowing. <b>Get it home.</b>", 3000); }
    }
    if (e.k === "bank") {
      const d = dockOf(e.seat);
      floatAt(d.x, d.y - 30, `+${e.v}`, "", COLORS[e.seat], e.seat === me);
      if (e.seat === me) sfx.coin(e.banked);
      if (e.tier >= 0) { S.pops[e.seat] = performance.now(); const hm = homeOf(e.seat); burst(hm.x - OX, hm.y - OY - 20, ["#d7261e", "#f2b705", COLORS[e.seat]], 34); logLine(`${nameOf(e.seat)} built ${e.tier === 4 ? "an" : "a"} ${PARTS[e.tier]}`, e.tier >= 3); if (e.seat === me) { sfx.build(); banner(null, "家", `You built ${e.tier === 4 ? "an" : "a"} <b>${PARTS[e.tier]}</b>!`, 2000); } }
      if (e.seat === me) banner("first-bank", "家", "Banked! Those fish are yours for good. <b>Most fish home wins.</b>");
    }
    if (e.k === "ram") {
      floatAt(e.x, e.y - 30, e.n ? `-${e.n}${e.koi ? " incl. golden carp" : ""}` : "bump!", `${nameOf(e.a)} rammed ${e.v === me ? "you" : nameOf(e.v)}`, COLORS[e.a], e.a === me || e.v === me);
      for (let i = 0; i < 16; i++) S.particles.push({ x: OX + e.x, y: OY + e.y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 1, c: "#ffffff" });
      sfx.thunk(); logLine(`${nameOf(e.a)} rammed ${e.v === me ? "you" : nameOf(e.v)}${e.n ? `: ${e.n} spilled` : ""}`, true);
      if (e.v === me) { shake = performance.now(); banner(null, "撞", `${nameOf(e.a)} rammed you: <b>${e.n} fish</b> spilled. Scoop them back, or head home. You're shielded for 3 s.`, 3000); }
      else banner("first-ram", "撞", "A dash into a boat spills <b>up to 3 fish</b> from its hold. Sail over spilled fish to scoop them. Docks are safe.");
    }
    if (e.k === "pick") { floatAt(e.x, e.y - 18, `+${e.v}`, "", COLORS[e.seat], e.seat === me); if (e.seat === me) sfx.coin(3); }
    if (e.k === "koi") { banner(null, "锦", `A <b>golden carp</b>! Worth ${KOI_VALUE} fish, if you can get it home.`, 2600); sfx.chime(5); logLine("A golden carp appeared", false); }
  }
  let shake = 0;

  // ---- drawing ----
  function render() {
    const now = performance.now(), t = now / 1000;
    if (!bg) buildBg();
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.drawImage(bg, 0, 0);
    const sh = now - shake < 300 ? (1 - (now - shake) / 300) * 6 : 0;
    cx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * (offX + (Math.random() - 0.5) * sh), DPR * (offY + (Math.random() - 0.5) * sh));
    const rt = serverT() - DELAY;
    let A = null, B = null;
    for (let i = S.frames.length - 1; i >= 0; i--) if (S.frames[i].t <= rt) { A = S.frames[i]; B = S.frames[i + 1] || A; break; }
    if (!A && S.frames.length) A = B = S.frames[0];
    const k = A && B !== A ? Math.max(0, Math.min(1, (rt - A.t) / (B.t - A.t))) : 0;
    const lerpA = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
    const playing = view.state === "play" && A;
    const banked = {}; let lead = -1, leadV = 0;
    if (A) for (const [seat, b] of B.boats) { banked[seat] = b[7]; if (b[7] > leadV) { leadV = b[7]; lead = seat; } }
    else if (view.results) for (const r of view.results) { banked[r.seat] = r.banked; if (r.banked > leadV) { leadV = r.banked; lead = r.seat; } }
    if (A) {
      for (const [id, q] of B.fish) { const p = A.fish.get(id); if (p) drawFish(p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k, lerpA(p[3] / 100, q[3] / 100), q[4] === 1, id, t, 1); else drawFish(q[1], q[2], q[3] / 100, q[4] === 1, id, t, k); }
      for (const n of B.n) { const left = Math.max(0, n[4] / 600), r = NET_R * (1.12 - 0.12 * (1 - left)); cx.save(); cx.translate(OX + n[2], OY + n[3]); cx.globalAlpha = 0.85; cx.strokeStyle = COLORS[n[1]]; cx.lineWidth = 1.6; cx.save(); cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.clip(); for (let d = -2 * r; d <= 2 * r; d += 11) { cx.beginPath(); cx.moveTo(d - r, -r); cx.lineTo(d + r, r); cx.stroke(); cx.beginPath(); cx.moveTo(d + r, -r); cx.lineTo(d - r, r); cx.stroke(); } cx.restore(); cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.stroke(); cx.restore(); }
      for (const l of B.l) { const bob = Math.sin(now / 150 + l[0]) * 2; cx.save(); cx.translate(OX + l[1], OY + l[2] + bob); if (l[3] > 1) { cx.shadowColor = "#f2b705"; cx.shadowBlur = 18; } cx.fillStyle = l[3] > 1 ? "#f2b705" : "#e8452c"; cx.strokeStyle = LINE; cx.lineWidth = 1.4; cx.beginPath(); cx.ellipse(0, 0, l[3] > 1 ? 13 : 8, l[3] > 1 ? 6 : 4, 0.6, 0, Math.PI * 2); cx.fill(); cx.stroke(); cx.restore(); }
      if (B.k) { const kk = A.k && B.k ? [A.k[0] + (B.k[0] - A.k[0]) * k, A.k[1] + (B.k[1] - A.k[1]) * k, B.k[2] / 100] : [B.k[0], B.k[1], B.k[2] / 100]; cx.save(); cx.translate(OX + kk[0], OY + kk[1]); cx.rotate(kk[2]); cx.scale(Z, Z); cx.shadowColor = "#f2b705"; cx.shadowBlur = 18; cx.fillStyle = "#f2b705"; cx.strokeStyle = LINE; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(-13, 0); cx.lineTo(-22, -8); cx.lineTo(-20, 0); cx.lineTo(-22, 8); cx.closePath(); cx.fill(); cx.stroke(); cx.beginPath(); cx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); cx.restore(); }
      // cast splashes
      S.splashes = S.splashes.filter((s) => now - s.at < 700);
      for (const s of S.splashes) { const q = (now - s.at) / 700; cx.strokeStyle = `rgba(255,255,255,${1 - q})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(OX + s.x, OY + s.y, 8 + q * 30, 0, Math.PI * 2); cx.stroke(); }
      // my target, and where my net would land
      const meB = B.boats.get(mine());
      if (playing && meB) {
        const p = A.boats.get(mine()) || meB, bx = p[1] + (meB[1] - p[1]) * k, by = p[2] + (meB[2] - p[2]) * k, bh = lerpA(p[3] / 100, meB[3] / 100);
        const tx = target ? target.x : meB[8], ty = target ? target.y : meB[9];
        if (Math.hypot(tx - bx, ty - by) > 14) { cx.strokeStyle = "rgba(255,246,227,.85)"; cx.lineWidth = 2; cx.setLineDash([3, 6]); cx.beginPath(); cx.moveTo(OX + bx, OY + by); cx.lineTo(OX + tx, OY + ty); cx.stroke(); cx.setLineDash([]); cx.beginPath(); cx.arc(OX + tx, OY + ty, 7, 0, Math.PI * 2); cx.stroke(); }
        const ready = meB[10] === 0 && meB[4] < HOLD, nx = bx + Math.cos(bh) * NET_AHEAD, ny = by + Math.sin(bh) * NET_AHEAD;
        cx.strokeStyle = ready ? "rgba(255,246,227,.9)" : "rgba(255,246,227,.3)"; cx.lineWidth = 2.5; cx.setLineDash([6, 5]); cx.beginPath(); cx.arc(OX + nx, OY + ny, NET_R, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]);
      }
      for (const [seat, b] of B.boats) {
        const p = A.boats.get(seat) || b;
        const ib = [seat, p[1] + (b[1] - p[1]) * k, p[2] + (b[2] - p[2]) * k, lerpA(p[3] / 100, b[3] / 100) * 100, b[4], b[5], b[6]];
        drawBoat(ib, t, seat === mine());
      }
    }
    for (let seat = 0; seat < nBoats(); seat++) drawHouse(seat, banked[seat] || 0, seat === lead && leadV > 0, t);
    // floats and particles
    S.floats = S.floats.filter((f) => now - f.at < 1500);
    for (const f of S.floats) { const q = (now - f.at) / 1500, y = OY + f.y - 30 * q; cx.globalAlpha = 1 - q * q; cx.textAlign = "center"; cx.textBaseline = "alphabetic"; cx.lineWidth = 4; cx.strokeStyle = "#fff6e3"; cx.font = `900 ${f.big ? 26 : 16}px Nunito, system-ui, sans-serif`; cx.strokeText(f.text, OX + f.x, y); cx.fillStyle = f.color; cx.fillText(f.text, OX + f.x, y); if (f.sub && f.big) { cx.font = "800 14px Nunito, system-ui, sans-serif"; cx.strokeText(f.sub, OX + f.x, y + 20); cx.fillStyle = LINE; cx.fillText(f.sub, OX + f.x, y + 20); } cx.globalAlpha = 1; }
    const dt = 1 / 60;
    for (const p of S.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.life -= dt * 1.3; }
    S.particles = S.particles.filter((p) => p.life > 0);
    for (const p of S.particles) { cx.globalAlpha = p.life; cx.fillStyle = p.c; cx.fillRect(p.x - 2, p.y - 2, 4, 4); } cx.globalAlpha = 1;
    // the clock
    if (playing) {
      const left = Math.max(0, Math.ceil(B.left)), hurry = left <= 20;
      const txt = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      cx.textAlign = "left"; cx.textBaseline = "alphabetic"; cx.font = `900 ${hurry ? 42 + Math.sin(now / 120) * 3 : 36}px Fraunces, Georgia, serif`; cx.lineWidth = 6; cx.strokeStyle = "#fff6e3"; cx.strokeText(txt, 16, 46); cx.fillStyle = hurry ? "#d7261e" : LINE; cx.fillText(txt, 16, 46);
      cx.font = "800 14px Nunito, system-ui, sans-serif"; cx.fillStyle = LINE; cx.fillText(hurry ? "HEAD HOME: the horn takes what's aboard" : `${B.adultsN} grown fish in the lake`, 18, 66);
      if (left === 20 && !S.seen.has("hurry")) { S.seen.add("hurry"); banner(null, "归", "<b>20 seconds!</b> Fish still aboard at the horn count for nothing. <b>Head home.</b>", 4000); sfx.gong(); }
    }
    updateHud(B);
    requestAnimationFrame(render);
  }

  // ---- the side panel ----
  let lastRanks = "";
  function updateHud(F) {
    if (!F) return;
    const me = F.boats.get(mine());
    if (me) {
      $("hold-n").textContent = `${me[4]}/${HOLD}${me[5] > me[4] ? ` (worth ${me[5]})` : ""}`; $("ab-hold").textContent = `${me[4]}/${HOLD}`;
      $("hold-bar").style.width = `${(me[4] / HOLD) * 100}%`; $("hold-bar").className = me[4] >= HOLD ? "full" : "";
      $("banked").textContent = me[7]; $("ab-banked").textContent = me[7];
      for (const id of ["btn-cast", "ab-cast"]) { const el = $(id); el.style.setProperty("--cd", Math.min(1, me[10] / 9).toFixed(2)); el.classList.toggle("off", me[4] >= HOLD); }
      for (const id of ["btn-dash", "ab-dash"]) $(id).style.setProperty("--cd", Math.min(1, me[11] / 40).toFixed(2));
    }
    const order = [...F.boats.values()].sort((a, b) => b[7] - a[7]);
    const key = order.map((b) => `${b[0]}:${b[7]}:${b[4]}`).join("|");
    if (key !== lastRanks) { lastRanks = key; $("ranks").innerHTML = order.map((b, i) => `<div class="rank ${b[0] === mine() ? "me" : ""}"><span class="pos">${i + 1}</span><span class="dot" style="background:${COLORS[b[0]]}">${esc(zhOf(b[0]))}</span><span class="who"><b>${esc(nameOf(b[0]))}</b>${S.seats[b[0]] && S.seats[b[0]].bot ? ' <i class="chip bot">BOT</i>' : ""}<small>aboard ${b[4]}/${HOLD}</small></span><span class="score" style="color:${COLORS[b[0]]}">${b[7]}</span></div>`).join(""); }
  }

  // ---- the room: lobby, countdown, results ----
  function renderRoom() {
    S.seats = view.seats || S.seats;
    bg = null;
    document.body.classList.toggle("in-play", view.state === "play");
    document.body.classList.toggle("spectator", view.myBoat === null && view.state === "play");
    $("lobby").hidden = view.state !== "lobby";
    $("results").hidden = view.state !== "end";
    if (view.state === "lobby") renderLobby();
    if (view.state === "end") renderResults();
  }
  const rulesHtml = `<ol class="rules"><li><b>Sail</b>: tap or drag the water (or WASD).</li><li><b>Cast</b> (Space): the net lands just ahead of your bow. Grown fish go in your hold, ${HOLD} at most.</li><li><b>Home</b>: sail into your dock. Only fish unloaded at home count; the horn takes what's still aboard.</li><li><b>Dash</b> (Shift): ram a boat and up to 3 fish spill; anyone can scoop them. Docks are safe; a hit boat is shielded 3 s.</li><li><b>The lake</b> is shared and nothing refills it: what you take now is not there later.</li></ol>`;
  function renderLobby() {
    const err = $("join-error") ? `<p class="error">${esc($("join-error").textContent)}</p>` : "";
    const players = view.players.map((p) => `<li class="${p.seat === view.me ? "me" : ""}">${esc(p.name)}${p.seat === view.me ? " <small>(you)</small>" : ""}</li>`).join("") || '<li class="nobody">Nobody yet</li>';
    const joined = view.me !== null;
    const defaultBots = view.players.length < 2;
    $("lobby").innerHTML = `<div class="card lobbycard">
      <p class="eyebrow">Room · everyone opens <span class="url">${esc(location.host)}/b/<b>${esc(code)}</b></span></p>
      <div class="bigcode">${code.split("").map((c) => `<span>${c}</span>`).join("")}</div>
      ${view.note ? `<p class="note">${esc(view.note)}</p>` : ""}
      <div class="lobbycols"><div><h2>On the dock <small>${view.players.length}/4</small></h2><ul class="joined">${players}</ul>
      ${joined ? `<label class="botopt"><input type="checkbox" id="bots" ${defaultBots ? "checked" : ""}> fill empty boats with bots (Jin, Old Wang, Mei)</label><button class="cta" id="startbtn" type="button">Start · 2 minutes</button><p class="keys">Anyone in the room can start. Wait for everyone.</p>`
        : `<form method="post" action="/b/${esc(code)}/join" class="joinform"><label for="name">Your name</label><div class="row"><input id="name" name="name" required maxlength="24" autocomplete="nickname" placeholder="e.g. Liu"><button class="cta" type="submit">Join</button></div></form>${err}`}
      </div><div><h2>How to play</h2>${rulesHtml}</div></div></div>`;
    const sb = $("startbtn"); if (sb) sb.addEventListener("click", () => start($("bots").checked));
  }
  async function start(bots) {
    sfx.enable(); S.lastBots = bots;
    const r = await fetch(`/b/${code}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bots }) }).then((x) => x.json()).catch(() => ({ ok: false, reason: "offline" }));
    if (!r.ok) banner(null, "!", r.reason === "busy" ? "The server is full of races right now. Try again in a minute." : `Could not start: ${esc(r.reason)}`);
  }
  function renderResults() {
    const res = (view.results || []).slice().sort((a, b) => a.place - b.place);
    const me = view.myBoat, winner = res[0];
    const name = (seat) => (seat === me ? "You" : view.seats && view.seats[seat] ? view.seats[seat].name : `Boat ${seat + 1}`);
    const best = (fn, fmt) => { const r = res.slice().sort((a, b) => fn(b) - fn(a))[0]; return r && fn(r) > 0 ? fmt(r) : ""; };
    const awards = [
      best((r) => r.stats.bestTrip, (r) => `<div><span class="zh">满</span><b>Biggest trip</b>${esc(name(r.seat))} brought ${r.stats.bestTrip} home at once</div>`),
      best((r) => r.stats.rams, (r) => `<div><span class="zh">撞</span><b>Pirate</b>${esc(name(r.seat))} rammed ${r.stats.rams}×</div>`),
      best((r) => r.stats.scooped, (r) => `<div><span class="zh">捞</span><b>Scavenger</b>${esc(name(r.seat))} scooped ${r.stats.scooped}</div>`),
      best((r) => r.stats.lost, (r) => `<div><span class="zh">失</span><b>Unlucky</b>${esc(name(r.seat))} lost ${r.stats.lost} (rams + the horn)</div>`),
    ].join("");
    const meR = res.find((r) => r.seat === me);
    const tip = meR ? (meR.stats.lost >= 6 ? "Next time: go home a little earlier. You lost " + meR.stats.lost + " fish." : meR.stats.trips <= 4 ? "Next time: shorter trips, more of them?" : meR.stats.rams === 0 ? "Next time: try a dash at a full boat." : "Next time: chase the golden carp?") : "";
    $("results").innerHTML = `<div class="card resultcard">
      <p class="eyebrow">The horn! Fish still aboard didn't count.</p>
      <h1 class="win">${winner ? (winner.seat === me ? "You win!" : `${esc(name(winner.seat))} wins`) : "Done"}</h1>
      <ol class="podium">${res.map((r) => `<li class="${r.seat === me ? "me" : ""}"><span class="dot" style="background:${COLORS[r.seat]}">${r.place}</span><b>${esc(name(r.seat))}</b><span class="n">${r.banked}</span><small>caught ${r.stats.caught} · ${r.stats.trips} trips · best trip ${r.stats.bestTrip} · scooped ${r.stats.scooped} · lost ${r.stats.lost} · rammed others ${r.stats.rams}</small></li>`).join("")}</ol>
      <div class="awards">${awards}</div>
      ${tip ? `<p class="tip">${esc(tip)}</p>` : ""}
      ${view.me !== null ? `<p class="again"><button class="cta" id="rematch" type="button">Rematch</button><label class="botopt"><input type="checkbox" id="bots2" ${S.lastBots ?? view.players.length < 2 ? "checked" : ""}> bots fill empty boats</label></p>` : ""}
    </div>`;
    const rb = $("rematch"); if (rb) rb.addEventListener("click", () => start($("bots2").checked));
  }

  // ---- input: tap/drag to sail, CAST and DASH ----
  let target = null, lastSteer = 0, steerTimer = 0;
  const send = (body) => fetch(`/b/${code}/in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  function steer(x, y, force) {
    target = { x, y };
    const now = performance.now();
    if (force || now - lastSteer > 90) { lastSteer = now; send({ k: "steer", x: Math.round(x), y: Math.round(y) }); }
    else { clearTimeout(steerTimer); steerTimer = setTimeout(() => steer(target.x, target.y, true), 95); }
  }
  const canAct = () => view.state === "play" && mine() !== null && mine() !== undefined;
  function canvasPoint(e) { const r = cv.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); }
  let dragging = false;
  cv.addEventListener("pointerdown", (e) => { if (!canAct()) return; sfx.enable(); const w = canvasPoint(e); steer(w.x, w.y, true); dragging = true; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (!dragging) return; const w = canvasPoint(e); steer(w.x, w.y); });
  cv.addEventListener("pointerup", () => (dragging = false));
  cv.addEventListener("pointercancel", () => (dragging = false));
  const keys = { up: 0, down: 0, left: 0, right: 0 }, KEYMAP = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  setInterval(() => {
    if (!canAct() || !(keys.up || keys.down || keys.left || keys.right)) return;
    const F = latest(); const b = F && F.boats.get(mine()); if (!b) return;
    const dx = keys.right - keys.left, dy = keys.down - keys.up, n = Math.hypot(dx, dy) || 1;
    steer(b[1] + (dx / n) * 140, b[2] + (dy / n) * 140, true);
  }, 120);
  const cast = () => { if (!canAct()) return; sfx.enable(); send({ k: "cast" }); };
  const dash = () => { if (!canAct()) return; sfx.enable(); sfx.whoosh(); send({ k: "dash" }); };
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (KEYMAP[e.key]) { keys[KEYMAP[e.key]] = 1; e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.key === " " || e.key === "j" || e.key === "J") { e.preventDefault(); cast(); }
    if (e.key === "Shift" || e.key === "k" || e.key === "K") { e.preventDefault(); dash(); }
  });
  document.addEventListener("keyup", (e) => { if (KEYMAP[e.key]) { keys[KEYMAP[e.key]] = 0; if (!keys.up && !keys.down && !keys.left && !keys.right) { const F = latest(); const b = F && F.boats.get(mine()); if (b) steer(b[1], b[2], true); } } });
  for (const id of ["btn-cast", "ab-cast"]) $(id).addEventListener("pointerdown", (e) => { e.preventDefault(); cast(); });
  for (const id of ["btn-dash", "ab-dash"]) $(id).addEventListener("pointerdown", (e) => { e.preventDefault(); dash(); });
  $("sound").addEventListener("click", () => { SOUND.on = !SOUND.on; sfx.enable(); $("sound").textContent = SOUND.on ? "sound on" : "sound off"; });

  // ---- sound ----
  const SOUND = { on: true };
  const sfx = (() => {
    let ac = null; const ok = () => SOUND.on && ac;
    const tone = (f, d, type = "sine", g = 0.1, when = 0) => { if (!ok()) return; const o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.frequency.value = f; v.gain.setValueAtTime(g, ac.currentTime + when); v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + d); o.connect(v).connect(ac.destination); o.start(ac.currentTime + when); o.stop(ac.currentTime + when + d + 0.05); };
    const noise = (d, g = 0.2, freq = 900, when = 0) => { if (!ok()) return; const n = ac.createBufferSource(), b = ac.createBuffer(1, Math.floor(ac.sampleRate * d), ac.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); n.buffer = b; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; const v = ac.createGain(); v.gain.value = g; n.connect(f).connect(v).connect(ac.destination); n.start(ac.currentTime + when); };
    const P5 = [523, 587, 659, 784, 880, 1047, 1175];
    return {
      enable() { if (!ac && SOUND.on) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } },
      haul(n) { for (let i = 0; i < Math.min(n, 6); i++) tone(P5[i], 0.18, "triangle", 0.06, i * 0.04); if (!n) tone(196, 0.15, "sine", 0.06); },
      coin(i) { tone(P5[(i % 5) + 2] * 2, 0.08, "triangle", 0.05); },
      build() { [0, 2, 4, 6].forEach((i, k) => tone(P5[i], 0.3, "triangle", 0.08, k * 0.07)); },
      chime(i) { tone(P5[i % P5.length], 0.35, "sine", 0.09); },
      gong() { tone(98, 2, "sine", 0.22); },
      thunk() { tone(90, 0.2, "square", 0.09); noise(0.4, 0.4, 400); },
      whoosh() { noise(0.3, 0.25, 1600); },
      tick() { tone(330, 0.05, "square", 0.03); },
      horn() { tone(196, 1.2, "sawtooth", 0.06); tone(147, 1.2, "sawtooth", 0.05); },
    };
  })();

  // ---- the stream ----
  const conn = $("conn");
  function connect() {
    const es = new EventSource(`/b/${code}/events`);
    es.onopen = () => { conn.textContent = "live"; conn.className = "tiny conn ok"; };
    es.onerror = () => { conn.textContent = "reconnecting…"; conn.className = "tiny conn bad"; };
    es.addEventListener("room", (e) => {
      const prev = view.state; view = JSON.parse(e.data);
      if (prev === "play" && view.state === "end") { sfx.horn(); }
      if (view.state !== "play") { S.frames = []; S.off = null; }
      renderRoom();
    });
    es.addEventListener("go", (e) => {
      const g = JSON.parse(e.data);
      S.frames = []; S.off = null; S.seen.delete("hurry"); S.log = []; $("log").innerHTML = ""; target = null;
      onFrame({ ...g.frame, ev: [] });
      const startIn = g.startedAt - g.serverNow;
      if (startIn > 200) {
        const until = performance.now() + startIn; $("count").hidden = false;
        const tickDown = () => { const left = until - performance.now(); if (left <= 0) { $("count").hidden = true; sfx.gong(); return; } $("count-n").textContent = String(Math.ceil(left / 1000)); setTimeout(tickDown, 100); };
        tickDown();
        banner("howto", "船", "<b>Tap the water</b> to sail. <b>CAST</b> nets fish ahead of your bow. Bring them <b>home</b> to count.", 5000);
      }
    });
    es.addEventListener("frame", (e) => onFrame(JSON.parse(e.data)));
  }
  // for automated browser checks only: what this page last received (read-only)
  window.__quickCatch = { latest: () => latest(), view: () => view, serverT };
  new ResizeObserver(resize).observe(cv);
  resize(); renderRoom(); connect();
  requestAnimationFrame(render);
})();
