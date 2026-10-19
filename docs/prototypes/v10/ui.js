/* ================================================================ the shared machine: state, HUD, input, camera, minimap, boats, the ceremony */
const K = 340; // what a full lake holds; every game's year is judged against it
const TIERS = [[.6, "rich", 1.2], [.35, "fair", 1], [.15, "lean", .8], [0, "none", .5]];
const tierOf = (n) => { const r = n / K; for (const [min, id, mult] of TIERS) if (r >= min) return { id, mult }; return { id: "none", mult: .5 }; };
const tierCol = { rich: "var(--leaf)", fair: "var(--sky)", lean: "var(--gold)", none: "#ff8a7a" };
const tierRange = (min) => { const k = TIERS.findIndex(x => x[0] === min), pc = (x) => Math.round(x * 100) + "%"; return k === 0 ? pc(min) + "+" : min === 0 ? "<" + pc(TIERS[k - 1][0]) : pc(min) + "–" + pc(TIERS[k - 1][0]); };
/* spring: the young grow up, the adults breed (logistic, with too-few-to-find-each-other below 36) */
const LAKE = { R: 1.55, ALLEE: 36, A0: 230, Y0: 50 };
function breed(adults, fry, bonus = 0) { const a = adults + fry; const born = adults < LAKE.ALLEE ? Math.round(adults * .1) : Math.round(LAKE.R * adults * Math.max(0, 1 - a / K) * (1 + bonus)); return { adults: a, born }; }
const forecastOf = (a, y, bonus = 0, extra = 0) => { const r = breed(a, y, bonus); return r.adults + Math.round((r.born + extra) * .6); };

const G = { mode: null, phase: "village", t: 0, me: "mei", lake: { adults: LAKE.A0, fry: LAKE.Y0 }, games: {} };
try { const m = localStorage.getItem("nynf-me"); if (CREW.some(c => c.id === m)) G.me = m; } catch (e) {}
try { const l = JSON.parse(localStorage.getItem("nynf-lake") || "null"); if (l && l.adults >= 0) G.lake = l; } catch (e) {}
const saveLake = () => { try { localStorage.setItem("nynf-lake", JSON.stringify(G.lake)); } catch (e) {} };
const seen = (k) => { try { return localStorage.getItem("nynf-seen-" + k) === "1"; } catch (e) { return false; } };
const markSeen = (k) => { try { localStorage.setItem("nynf-seen-" + k, "1"); } catch (e) {} };

/* ---------------------------------------------------------------- HUD pieces */
const topEl = $("#top"), sideEl = $("#side"), bottomEl = $("#bottom"), bleftEl = $("#bleft"), padsEl = $("#pads"), keysEl = $("#keys"), coachEl = $("#coach"), screenEl = $("#screen"), bannerEl = $("#banner"), toastEl = $("#toast"), miniEl = $("#mini"), fogEl = $("#fog"), marksEl = $("#marks");
function hud({ top = null, side = null, left = null, pads = null, keys = null, mini = true } = {}) {
  topEl.hidden = top === null; if (top !== null) topEl.innerHTML = top + `<button class="iconbtn" type="button" data-ui="sound" aria-label="${t("sound")}">♪</button><button class="iconbtn" type="button" data-ui="lang" aria-label="${t("lang")}">${LANG === "zh" ? "EN" : "中"}</button><button class="iconbtn" type="button" data-ui="home" aria-label="${t("back")}">⌂</button>`;
  sideEl.hidden = side === null; if (side !== null) sideEl.innerHTML = side;
  bottomEl.hidden = left === null && pads === null; bleftEl.innerHTML = left ?? ""; padsEl.innerHTML = "";
  if (pads) for (const p of pads) { const b = document.createElement("button"); b.type = "button"; b.className = "pad " + (p.cls ?? ""); b.id = p.id; b.innerHTML = `<span>${p.label}${!isTouch && p.key ? `<small>${p.key}</small>` : ""}</span><i class="cd"></i>`; b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); Music.start(); p.on(); }); padsEl.appendChild(b); }
  keysEl.hidden = !keys || isTouch; if (keys) keysEl.innerHTML = keys;
  miniEl.hidden = !mini;
}
function hideHud() { topEl.hidden = true; sideEl.hidden = true; bottomEl.hidden = true; keysEl.hidden = true; miniEl.hidden = true; coachEl.hidden = true; fogEl.hidden = true; marksEl.innerHTML = ""; arrowEl.hidden = true; }
topEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ui]"); if (!b) return;
  if (b.dataset.ui === "sound") { Music.start(); const on = Music.toggle(); b.style.opacity = on ? 1 : .45; }
  if (b.dataset.ui === "lang") setLang(LANG === "en" ? "zh" : "en");
  if (b.dataset.ui === "home") { if (confirm(t("leave_q"))) toVillage(); }
});
addWords({ en: { leave_q: "Leave this game and go back to the village?" }, zh: { leave_q: "离开这一局，回村口吗？" } });
function screen(html, cls = "") { screenEl.className = "screen " + cls; screenEl.innerHTML = html; screenEl.hidden = false; screenEl.scrollTop = 0; }
function hideScreen() { screenEl.hidden = true; screenEl.innerHTML = ""; }
function banner(big, small = "") { bannerEl.className = "banner"; void bannerEl.offsetWidth; bannerEl.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ""}`; bannerEl.className = "banner show"; }
function toast(text, kind = "") { const d = document.createElement("div"); d.className = kind; d.textContent = text; toastEl.appendChild(d); while (toastEl.children.length > 3) toastEl.firstChild.remove(); setTimeout(() => d.remove(), 3300); }
function coach(text, sub = "") { if (!text) { coachEl.hidden = true; return; } coachEl.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`; coachEl.hidden = false; }
let shakeA = 0; const shake = (a) => { shakeA = Math.max(shakeA, a); };
/* an arrow that points at a place on the lake, at the screen edge when it is off screen */
const arrowEl = document.createElement("div"); arrowEl.className = "arrow"; arrowEl.hidden = true; arrowEl.innerHTML = `<svg viewBox="0 0 44 44"><path d="M22 40 L8 16 L18 16 L18 4 L26 4 L26 16 L36 16 Z" fill="currentColor" stroke="#120e18" stroke-width="2.5" stroke-linejoin="round"/></svg>`; stage.appendChild(arrowEl);
let arrowAt = null;
function pointAt(x, z) { arrowAt = x === null ? null : { x, z }; arrowEl.hidden = !arrowAt; }
function updateArrow(tt) {
  if (!arrowAt) return; const W2 = stage.clientWidth, H2 = stage.clientHeight; pv.set(arrowAt.x, 3, arrowAt.z).project(camera);
  let sx = (pv.x * .5 + .5) * W2, sy = (-pv.y * .5 + .5) * H2; const behind = pv.z > 1; const m = 50;
  const on = !behind && sx > m && sx < W2 - m && sy > m + 60 && sy < H2 - m - 100;
  if (on) { arrowEl.style.transform = `translate(${sx}px, ${sy - 30 - Math.abs(Math.sin(tt * 4)) * 10}px)`; }
  else { const cx = W2 / 2, cy = H2 / 2; let dx = sx - cx, dy = sy - cy; if (behind) { dx = -dx; dy = -dy; } const k = Math.min((W2 / 2 - m) / Math.abs(dx || 1), (H2 / 2 - m - 70) / Math.abs(dy || 1)); const ex = cx + dx * k, ey = cy + dy * k; const a = Math.atan2(dy, dx) * 180 / Math.PI - 90; arrowEl.style.transform = `translate(${ex}px, ${ey}px) rotate(${a}deg)`; }
}
/* labels that float over places (task rings, zone names) */
const markEls = new Map();
function marks(list) { // [{id, x, z, text, cls}]
  const keep = new Set();
  for (const m of list) { keep.add(m.id); let el = markEls.get(m.id); if (!el) { el = document.createElement("div"); el.className = "ring-label " + (m.cls ?? ""); marksEl.appendChild(el); markEls.set(m.id, el); }
    el.textContent = m.text; const p = toScreen(m.x, 2.5, m.z); el.hidden = !p; if (p) el.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%, -100%)`; }
  for (const [id, el] of markEls) if (!keep.has(id)) { el.remove(); markEls.delete(id); }
}

/* ---------------------------------------------------------------- input: keys, a thumb stick, or a tap/click on the water */
const keys = new Set();
addEventListener("keydown", (e) => { if (e.target.closest?.("input, textarea")) return; keys.add(e.code); if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) && G.phase === "play") e.preventDefault(); mode?.key?.(e.code, e); });
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
const input = { joy: null, tapPoint: null, onTap: null, steerMode: true };
const joyEl = $("#joy"), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
function screenToWorld(cx, cy) { const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hitV) ? [hitV.x, hitV.z] : null; }
let ptr = null;
canvas.addEventListener("pointerdown", (e) => {
  Music.start();
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, touch: e.pointerType !== "mouse" };
  if (input.steerMode && ptr.touch && G.phase === "play") { input.joy = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; joyEl.style.left = e.clientX + "px"; joyEl.style.top = e.clientY + "px"; joyEl.hidden = false; joyEl.firstElementChild.style.transform = ""; }
  else if (!ptr.touch) { const w = screenToWorld(e.clientX, e.clientY); if (w) { input.tapPoint = { x: w[0], z: w[1], hold: true }; input.onTap?.(w[0], w[1], e); } }
});
addEventListener("pointermove", (e) => {
  if (!ptr || e.pointerId !== ptr.id) { if (!ptr && input.onHover && e.pointerType === "mouse") { const w = screenToWorld(e.clientX, e.clientY); if (w) input.onHover(w[0], w[1], e); } return; }
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; if (Math.hypot(dx, dy) > 12) ptr.moved = true;
  if (input.joy) { const L = Math.hypot(dx, dy), k = Math.min(1, 52 / (L || 1)); input.joy.dx = dx; input.joy.dy = dy; joyEl.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`; }
  else if (!ptr.touch && input.tapPoint?.hold) { const w = screenToWorld(e.clientX, e.clientY); if (w) { input.tapPoint.x = w[0]; input.tapPoint.z = w[1]; } }
  input.onHover?.(...(screenToWorld(e.clientX, e.clientY) ?? [0, 0]), e);
});
const endPtr = (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  if (ptr.touch && !ptr.moved && performance.now() - ptr.t < 300) { const w = screenToWorld(e.clientX, e.clientY); if (w) { if (input.steerMode && G.phase === "play") input.tapPoint = { x: w[0], z: w[1] }; input.onTap?.(w[0], w[1], e); } }
  if (input.tapPoint) input.tapPoint.hold = false;
  input.joy = null; joyEl.hidden = true; ptr = null;
};
addEventListener("pointerup", endPtr); addEventListener("pointercancel", endPtr);
/* the direction the player wants: keys, or the stick; null if neither */
function wantDir() {
  let x = 0, z = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1; if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1; if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (x || z) { const L = Math.hypot(x, z); return { x: x / L, z: z / L, mag: 1 }; }
  const j = input.joy; if (j) { const L = Math.hypot(j.dx, j.dy); if (L > 10) return { x: j.dx / L, z: j.dy / L, mag: Math.min(1, L / 52) }; }
  return null;
}

/* ---------------------------------------------------------------- boats: shared handling */
function makeCrewBoat(c, i, isMe, dock = DOCKS[i]) {
  const mesh = makeBoat(c.color), tag = document.createElement("div");
  tag.className = "tag3d" + (isMe ? " me" : ""); tag.style.setProperty("--c", c.color); $("#tags").appendChild(tag);
  return { c, i, isMe, mesh, tag, dock, x: dock.wx, z: dock.wz, h: dock.inward, tx: dock.wx, tz: dock.wz, speed: 0, wakeT: 0, ph: i * 1.7, slow: 1, seen: true };
}
function removeBoats(list) { list.forEach(b => { scene.remove(b.mesh); b.tag.remove(); }); }
function atDock(b) { const d = b.dock; b.x = d.wx; b.z = d.wz; b.h = d.inward; b.tx = b.x; b.tz = b.z; b.speed = 0; }
function steerBoat(b, dt, maxSpeed, dir) {
  // dir: {x, z, mag} from keys or the stick; otherwise sail towards (tx, tz)
  let want = null, throttle = 0;
  if (dir) { want = Math.atan2(dir.z, dir.x); throttle = dir.mag; b.tx = b.x; b.tz = b.z; }
  else { const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz); if (d > .9) { want = Math.atan2(dz, dx); throttle = Math.min(1, d / 4); } }
  if (want !== null) { const diff = Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h)); b.h += Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.2); throttle *= Math.max(.25, Math.cos(Math.min(1.4, Math.abs(diff)))); }
  const inReeds = inZone("reeds", b.x, b.z) && nr(b.x, b.z) > .6;
  b.slow = inReeds ? .62 : 1;
  b.speed += (maxSpeed * throttle * b.slow - b.speed) * Math.min(1, dt * 2.6);
  let nx = b.x + Math.cos(b.h) * b.speed * dt, nz = b.z + Math.sin(b.h) * b.speed * dt;
  const lim = .965; if (nr(nx, nz) > lim) { const k = lim / nr(nx, nz); nx *= k; nz *= k; b.speed *= .7; }
  if (iceBlocks(nx, nz)) { nx = b.x; nz = b.z; b.speed *= .3; if (b.isMe && G.t - (b.iceT ?? -9) > 2) { b.iceT = G.t; toast(t("ice"), "warn"); } }
  const di = Math.hypot(nx - ISLAND.x, nz - ISLAND.z); if (di < ISLAND.r + 2.2) { const a = Math.atan2(nz - ISLAND.z, nx - ISLAND.x); nx = ISLAND.x + Math.cos(a) * (ISLAND.r + 2.2); nz = ISLAND.z + Math.sin(a) * (ISLAND.r + 2.2); b.speed *= .8; }
  b.x = nx; b.z = nz;
  b.wakeT -= dt; if (b.speed > 2.5 && b.wakeT <= 0) { b.wakeT = .14; wake(b.x - Math.cos(b.h) * 2.4, b.z - Math.sin(b.h) * 2.4, b.dash > 0 ? 1.7 : 1); }
}
addWords({ en: { ice: "Ice. Winter has closed the shallows; keep to open water." }, zh: { ice: "结冰了。冬天湖边冻住了，往开阔的水面走。" } });
function drawBoats(list, tt, label, visible = () => true) {
  const W2 = stage.clientWidth, H2 = stage.clientHeight;
  for (const b of list) {
    const m = b.mesh, vis = visible(b); m.visible = vis;
    m.position.set(b.x, Math.sin(tt * 2 + b.ph) * .1, b.z); m.rotation.set(0, -b.h, 0); m.rotateZ(Math.sin(tt * 1.3 + b.ph) * .03);
    const pile = m.userData.pile.children, n = b.hold?.length ?? 0; for (let i = 0; i < pile.length; i++) pile[i].visible = i < n;
    pv.set(b.x, 5.6, b.z).project(camera); const show = vis && pv.z < 1 && G.phase === "play" && label;
    b.tag.style.display = show ? "block" : "none";
    if (show) { b.tag.style.transform = `translate(${(pv.x * .5 + .5) * W2}px, ${(-pv.y * .5 + .5) * H2}px) translate(-50%, -100%)`; const txt = label(b); if (txt !== b.lastTag) { b.tag.innerHTML = txt; b.lastTag = txt; } }
  }
}
const displayName = (b) => b.isMe ? t("you") : t("bot", { name: crewName(b.c) });

/* ---------------------------------------------------------------- camera: follow your boat, or show the whole lake */
const cam = { mode: "overview", x: 0, z: 10, span: 120, dist: 120, fx: 0, fz: 0, target: null, orbit: 0 };
const camPos = new THREE.Vector3();
const PITCH = 0.98; // about 56 degrees down
function viewSpan() { const w = stage.clientWidth, h = stage.clientHeight; return w < 700 ? (h > w ? 64 : 90) : 118; }
function distForSpan(span) { const aspect = stage.clientWidth / stage.clientHeight, hf = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * aspect); return (span / 2) / Math.tan(hf / 2); }
let overviewDist = 160;
function fitOverview() {
  camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix();
  const pts = outline(1.06, 36).map(([x, z]) => new THREE.Vector3(x, 0, z));
  let lo = 40, hi = 900; for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; placeCam(0, 4, mid); camera.updateMatrixWorld(); const ok = pts.every(p => { const q = p.clone().project(camera); return Math.abs(q.x) < .97 && q.y < (cam.overTop ?? .8) && q.y > (cam.overBot ?? -.78); }); if (ok) hi = mid; else lo = mid; }
  overviewDist = hi;
}
function placeCam(x, z, dist, pitch = PITCH) { camera.position.set(x, Math.sin(pitch) * dist, z + Math.cos(pitch) * dist); camera.up.set(0, 1, 0); camera.lookAt(x, 0, z); }
function updateCamera(dt, tt) {
  shakeA *= Math.pow(.02, dt); const sx = (Math.random() - .5) * shakeA, sz = (Math.random() - .5) * shakeA;
  if (cam.mode === "follow" && cam.target) {
    const b = cam.target, lead = Math.min(10, b.speed * .8);
    const gx = clamp(b.x + Math.cos(b.h) * lead, -LK.x * .72, LK.x * .72), gz = clamp(b.z + Math.sin(b.h) * lead - 4, -LK.z * .75, LK.z * .58);
    cam.x += (gx - cam.x) * Math.min(1, dt * 2.6); cam.z += (gz - cam.z) * Math.min(1, dt * 2.6);
    const want = distForSpan(cam.span ?? viewSpan()); cam.dist += (want - cam.dist) * Math.min(1, dt * 2);
    placeCam(cam.x + sx, cam.z + sz, cam.dist);
  } else if (cam.mode === "orbit") {
    cam.orbit += dt * .08; const d = overviewDist * .78; camera.position.set(Math.cos(cam.orbit) * d * .62, d * .6, Math.sin(cam.orbit) * d * .62 + 10); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 4);
  } else if (cam.mode === "fixed") {
    cam.dist += (distForSpan(cam.span) - cam.dist) * Math.min(1, dt * 2); cam.x += (cam.fx - cam.x) * Math.min(1, dt * 2); cam.z += (cam.fz - cam.z) * Math.min(1, dt * 2);
    placeCam(cam.x + sx, cam.z + sz, cam.dist, cam.pitch ?? PITCH);
  } else {
    cam.dist += (overviewDist - cam.dist) * Math.min(1, dt * 2); cam.x += (0 - cam.x) * Math.min(1, dt * 2); cam.z += (4 - cam.z) * Math.min(1, dt * 2);
    placeCam(cam.x + sx + Math.sin(tt * .1) * 1.2, cam.z + sz, cam.dist);
  }
}
function onResize() { if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(stage.clientWidth, stage.clientHeight, false); } camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix(); fitOverview(); }
new ResizeObserver(onResize).observe(stage);

/* ---------------------------------------------------------------- the minimap */
const mctx = miniEl.getContext("2d");
const MW = 300, MH = 224, mapX = (x) => MW / 2 + x / (LK.x * 1.18) * (MW / 2), mapZ = (z) => MH / 2 + z / (LK.z * 1.22) * (MH / 2);
const OUT36 = outline(1, 72);
function drawMapBase(ctx, w = MW, h = MH, mx = mapX, mz = mapZ) {
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath(); OUT36.forEach(([x, z], i) => i ? ctx.lineTo(mx(x), mz(z)) : ctx.moveTo(mx(x), mz(z))); ctx.closePath();
  ctx.fillStyle = seasonIx === 3 ? "#5c8f98" : "#2a7f80"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#d9c08a"; ctx.stroke();
  const sc = w / MW;
  ctx.fillStyle = "rgba(111,154,62,.55)"; ctx.beginPath(); ctx.arc(mx(ZONES.reeds.x), mz(ZONES.reeds.z), ZONES.reeds.r * sc * 1.5, 0, 6.28); ctx.fill();
  ctx.fillStyle = "rgba(63,143,69,.45)"; ctx.beginPath(); ctx.arc(mx(ZONES.lotus.x), mz(ZONES.lotus.z), ZONES.lotus.r * sc * 1.4, 0, 6.28); ctx.fill();
  ctx.fillStyle = "rgba(10,40,52,.5)"; ctx.beginPath(); ctx.arc(mx(ISLAND.x), mz(ISLAND.z), 20 * sc * 1.5, 0, 6.28); ctx.fill();
  ctx.fillStyle = "#8a8a50"; ctx.beginPath(); ctx.arc(mx(ISLAND.x), mz(ISLAND.z), ISLAND.r * sc * 1.5, 0, 6.28); ctx.fill();
  const [rx, rz] = polar(ZONES.river.a, 1.02); ctx.strokeStyle = "#2f7f86"; ctx.lineWidth = 7 * sc; ctx.beginPath(); ctx.moveTo(mx(rx), mz(rz)); ctx.lineTo(mx(rx + Math.cos(deg(ZONES.river.a)) * 30), mz(rz + Math.sin(deg(ZONES.river.a)) * 30)); ctx.stroke();
}
function dot(ctx, x, z, r, fill, stroke) { ctx.beginPath(); ctx.arc(mapX(x), mapZ(z), r, 0, 6.28); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); } }

/* ---------------------------------------------------------------- per-game hooks and the loop */
const MODES = {};
let mode = null;
function startMode(id, opts = {}) {
  hideScreen(); hideHud(); mode?.end?.(); mode = MODES[id]; G.mode = id; G.phase = "intro";
  fishOpts.view = null; fishOpts.lure = null; input.onTap = null; input.onHover = null; input.steerMode = true; pointAt(null); marks([]); coach(null);
  try { localStorage.setItem("nynf-last", id); } catch (e) {}
  mode.start(opts);
}
function toVillage() { mode?.end?.(); mode = null; G.mode = null; hideHud(); fishOpts.view = null; nightTarget = 0; renderVillage(); }
const lanVec = waterU.lan.value;
const clockR = new THREE.Clock();
function frame() {
  const dt0 = Math.min(clockR.getDelta(), .05); const tt = (G.t += dt0);
  for (let k = 0; k < SPEED; k++) { const dt = dt0; if (mode?.update) mode.update(dt, G.t); else MODES.village?.update?.(dt); updateFish(dt, G.t, G.phase); if (k < SPEED - 1) G.t += dt; }
  blendWorld(dt0); skyMat.uniforms.time.value = tt; waterU.time.value = tt;
  let n = 0; DOCKS.forEach(d => { if (n < LAN_MAX) { d.lantern.getWorldPosition(pv); lanVec[n++].set(pv.x, .8, pv.z); } });
  if (mode?.lanterns) for (const l of mode.lanterns()) if (n < LAN_MAX) lanVec[n++].set(l.x, l.k ?? 1, l.z);
  waterU.lanN.value = n;
  updateFx(dt0); updateCamera(dt0, tt); updateParts(dt0, cam.x, cam.z, tt);
  if (mode?.draw) mode.draw(dt0, tt);
  updateArrow(tt);
  if (!miniEl.hidden) { drawMapBase(mctx); mode?.minimap?.(mctx); }
  if (renderer) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------- the ceremony: every game ends the same way, with next year */
/* r = { mode, title?, sub?, a, y, next, alt?, rows: [{c, isMe, base, score, unit?, sub?}], ledger?: [{c, isMe, home, young, spared}], fair?, titles?: [[key, text]], again(), extraTop? } */
let CER = null, cerStep = 0;
function ceremony(r) {
  CER = r; cerStep = 0; G.phase = "finale"; hideHud(); cam.mode = "orbit"; bannerEl.className = "banner"; bannerEl.innerHTML = "";
  r.tier = tierOf(r.next); Music.mood(r.tier.id === "rich" || r.tier.id === "fair" ? "good" : "bad");
  G.lake = { adults: Math.min(K, Math.round(r.next * .8)), fry: Math.round(r.next * .2) }; saveLake();
  renderCeremony();
}
const dotsHtml = (n, on) => `<div class="dots">${Array.from({ length: n }, (_, i) => `<i class="${i <= on ? "on" : ""}"></i>`).join("")}</div>`;
function renderCeremony() {
  const r = CER, F = r.tier, col = tierCol[F.id], steps = r.ledger ? 3 : 2, last = cerStep >= steps - 1;
  const nav = `<div class="row spread">${dotsHtml(steps, cerStep)}<div class="row">${last ? "" : `<button class="btn ghost" type="button" id="cSkip">${t("skipall")}</button><button class="btn primary" type="button" id="cNext">${t("next")} →</button>`}</div></div>`;
  let html = "";
  if (cerStep === 0) {
    html = `<div class="sheet narrow">${r.extraTop ?? ""}<h2>${r.title ?? t("fin1")}</h2><p class="lede">${r.sub ?? t("fin1_s")}</p>
      <div class="verdict"><div style="display:grid;gap:8px;justify-items:center"><div class="stamp" style="color:${col}">${W.zh["v_" + F.id].split("").join("<br>")}</div>${LANG === "zh" ? "" : `<b style="color:${col};font-size:18px">${t("v_" + F.id)}</b>`}</div>
        <div><div class="row" style="gap:26px"><div><small class="note">${t("left")}</small><div class="big">${r.a}</div><small class="note">${t("fish")}${r.y ? ` · ${r.y} ${t("young")}` : ""}</small></div><div style="font-size:30px;color:var(--mist)">→</div><div><small class="note">${t("nextyear")}</small><div class="big" style="color:${col}" id="cntN">${r.a}</div><small class="note">${t("fish")}</small></div></div>
        <p>${t("v_" + F.id + "_p")}</p></div></div>${nav}</div>`;
  } else if (cerStep === 1 && r.ledger) {
    const fair = r.fair ?? 1; const maxv = Math.max(fair * 1.4, ...r.ledger.map(b => b.home + b.young));
    html = `<div class="sheet narrow"><h2>${t("fin2")}</h2>
      <div class="legend"><span style="--c:#ff9a4a">${r.homeLabel ?? t("lg_home")}</span><span style="--c:#cf3b2e">${t("lg_young")}</span><span style="--c:var(--gold)">${t("fair")}</span></div>
      <div class="ledger">${r.ledger.map(b => `<div class="lrow"><span class="pf">${portrait(b.c.id, crewName(b.c))}</span><div style="min-width:0"><div class="lbl"><b>${b.isMe ? t("you") : t("bot", { name: crewName(b.c) })}</b><span>${b.home} ${r.unit ?? t("fish")}${b.young ? ` · <em>${t("lg_young")} ${b.young}</em>` : ""}${b.spared ? ` · <span class="ok">${t("lg_spared")} ${b.spared}</span>` : ""}</span></div>
        <div class="bars"><i style="width:${b.home / maxv * 100}%;background:#ff9a4a"></i><i style="left:${b.home / maxv * 100}%;width:${b.young / maxv * 100}%;background:#cf3b2e"></i><span class="fair" style="left:${fair / maxv * 100}%"></span></div></div></div>`).join("")}</div>
      ${r.alt !== undefined ? `<div class="what">${tierOf(r.alt).id === F.id ? t("what_same", { tier: t("v_" + F.id) }) : t("what", { alt: r.alt, tier: t("v_" + tierOf(r.alt).id), real: r.next })}</div>` : ""}
      ${r.titles?.length ? `<div class="titles">${r.titles.map(([k, s]) => `<div class="ttl"><b>${t(k)}</b>${s}</div>`).join("")}</div>` : ""}${nav}</div>`;
  } else {
    const rows = r.rows.slice().sort((p, q) => q.score - p.score), myPlace = rows.findIndex(x => x.isMe) + 1;
    html = `<div class="sheet narrow"><h2>${r.podiumTitle ?? (myPlace === 1 ? t("you_won") : t("you_came", { n: ord(myPlace) }))}</h2><p class="lede">${r.podiumSub ?? t("fin3_s", { mult: F.mult, tier: t("v_" + F.id) })}</p>
      <div class="podium">${rows.map((x, i) => `<div class="prow ${x.isMe ? "me" : ""}"><span class="pl">${i + 1}</span><span class="pf">${portrait(x.c.id, crewName(x.c))}</span><b>${x.isMe ? t("you") : t("bot", { name: crewName(x.c) })}${x.sub ? `<br><small class="note">${x.sub}</small>` : ""}</b><span class="sc"><b>${x.score}</b><small>${x.base !== undefined ? `${x.base} × ${F.mult}` : ""}</small></span></div>`).join("")}</div>
      <div class="row"><button class="btn primary" type="button" id="cAgain">${t("nextyear_btn")}${LANG === "zh" ? "（" : " ("}${G.lake.adults + G.lake.fry} ${t("fish")}${LANG === "zh" ? "）" : ")"}</button><button class="btn ghost" type="button" id="cVillage">${t("tovillage")}</button></div>${nav}</div>`;
  }
  screen(html);
  if (cerStep === 0) { Music.stamp(); let v = r.a; const target = r.next, id = setInterval(() => { v += Math.sign(target - v) * Math.max(1, Math.round(Math.abs(target - v) / 8)); const e = $("#cntN"); if (!e) return clearInterval(id); e.textContent = v; if (v === target) clearInterval(id); }, 50); }
  $("#cNext") && ($("#cNext").onclick = () => { cerStep++; renderCeremony(); });
  $("#cSkip") && ($("#cSkip").onclick = () => { cerStep = steps - 1; renderCeremony(); });
  $("#cAgain") && ($("#cAgain").onclick = () => r.again());
  $("#cVillage") && ($("#cVillage").onclick = () => toVillage());
}

function setLang(l) { LANG = l; document.documentElement.lang = l; try { localStorage.setItem("nynf-lang", l); } catch (e) {} if (G.phase === "finale" && CER) renderCeremony(); else if (!mode) renderVillage(); else mode.relabel?.(); }
