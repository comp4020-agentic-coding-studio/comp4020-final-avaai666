/* ================================================================ effects */
const fx = [];
function ripple(x, z, color = "#f5ead6", size = 4, life = 1.2) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  m.position.set(x, .14, z); scene.add(m); fx.push({ m, t: 0, life, size, kind: "ripple" });
}
const netGridGeo = (() => { const p = []; for (let i = -4; i <= 4; i++) { const k = i / 4, w = Math.sqrt(1 - k * k); p.push(k, 0, -w, k, 0, w, -w, 0, k, w, 0, k); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return g; })();
function netDrop(x, z, color, size = 3.4, fine = false) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: fine ? "#ff8a7a" : "#f5ead6", transparent: true, depthWrite: false }));
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .22, depthWrite: false }));
  const grid = new THREE.LineSegments(netGridGeo, new THREE.LineBasicMaterial({ color: fine ? "#ff8a7a" : "#f5ead6", transparent: true, opacity: .55 }));
  g.add(ring, mesh, grid); if (fine) { const g2 = grid.clone(); g2.rotation.y = Math.PI / 8; g.add(g2); }
  g.position.set(x, .16, z); scene.add(g); fx.push({ m: g, t: 0, life: 1.1, size, kind: "net" });
}
const wakeGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
function wake(x, z, s = 1) { const m = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: "#eaf6f2", transparent: true, opacity: .35, depthWrite: false })); m.position.set(x, .12, z); scene.add(m); fx.push({ m, t: 0, life: 1.4, size: s, kind: "wake" }); }
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i]; e.t += dt; const k = e.t / e.life;
    if (e.kind === "ripple") { e.m.scale.setScalar(e.size * (.2 + k)); e.m.material.opacity = (1 - k) * .9; }
    if (e.kind === "wake") { e.m.scale.set(.5 + k * 1.3, 1, .5 + k * 1.3); e.m.material.opacity = (1 - k) * .2; }
    if (e.kind === "net") { const open = Math.min(1, e.t / .22), close = Math.max(0, (e.t - .55) / .55); e.m.scale.setScalar(e.size * open * (1 - close * .8)); e.m.position.y = .16 - close * .5; e.m.children.forEach(c => c.material.opacity = (c.material.userData.o ??= c.material.opacity) * (1 - close)); }
    if (e.kind === "fly") { const p = Math.min(1, k); e.m.position.set(e.x0 + (e.x1 - e.x0) * p, 1 + Math.sin(p * Math.PI) * 6, e.z0 + (e.z1 - e.z0) * p); }
    if (k >= 1) { scene.remove(e.m); e.m.traverse?.(o => { if (o.material) o.material.dispose?.(); }); fx.splice(i, 1); }
  }
}
const flyGeo = new THREE.SphereGeometry(.32, 6, 5).scale(1.6, .7, 1), flyMat = toon("#f08a3c");
function flyFish(x0, z0, x1, z1, life = .8) { const m = new THREE.Mesh(flyGeo, flyMat); scene.add(m); fx.push({ m, t: 0, life, kind: "fly", x0, z0, x1, z1 }); }
const pv = new THREE.Vector3();
function toScreen(x, y, z) { pv.set(x, y, z).project(camera); return pv.z > 1 ? null : [(pv.x * .5 + .5) * stage.clientWidth, (-pv.y * .5 + .5) * stage.clientHeight]; }
const floatsEl = $("#floats");
function floatAt(x, z, text, color = "#f5ead6", big = false) {
  const p = toScreen(x, 2, z); if (!p) return;
  const el = document.createElement("div"); el.className = "float" + (big ? " big" : ""); el.textContent = text; el.style.color = color;
  el.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%, -100%)`; floatsEl.appendChild(el); setTimeout(() => el.remove(), 1300);
}

/* ================================================================ fish: adults (catchable) and young fish (slip through ordinary nets) */
function mergeGeos(list) { const pos = [], nor = []; for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return g; }
const fishGeo = mergeGeos([
  new THREE.SphereGeometry(.5, 12, 8).scale(1.25, .48, .4),
  new THREE.ConeGeometry(.34, .6, 4).rotateZ(-Math.PI / 2).scale(1, 1, .22).translate(-.82, 0, 0),
  new THREE.ConeGeometry(.16, .34, 3).scale(1.6, 1, .2).translate(.05, .3, 0),
]);
const MAXF = 520;
const fishMesh = new THREE.InstancedMesh(fishGeo, toon("#ffffff"), MAXF);
fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(fishMesh);
const fcol = new THREE.Color(), dummy = new THREE.Object3D();
let fish = [];
/* schools pick where to swim by season; young fish stay in the reeds (the nursery) */
const schools = Array.from({ length: 16 }, (_, i) => ({ i, x: 0, z: 0, tx: 0, tz: 0, vx: 0, vz: 0, t: 0, nursery: i >= 12 }));
const SEASON_PULL = [
  [["river", .35], ["reeds", .15], [null, .5]],
  [["lotus", .35], ["deep", .25], [null, .4]],
  [[null, .75], ["deep", .25]],
  [["deep", .7], [null, .3]],
];
const fishOpts = { seasonal: true, view: null, lure: null };
function schoolTarget(s) {
  if (s.nursery) return nearZone("reeds", .8);
  if (!fishOpts.seasonal) return randomWater(.8);
  const pulls = SEASON_PULL[seasonIx]; let r = Math.random(); for (const [id, w] of pulls) { r -= w; if (r <= 0) return id === null ? randomWater(seasonIx === 3 ? .78 : .84) : id === "deep" ? (() => { const a = Math.random() * 6.28, d = 12 + Math.random() * 9; return [ISLAND.x + Math.cos(a) * d, ISLAND.z + Math.sin(a) * d]; })() : nearZone(id, .9); }
  return randomWater();
}
function placeSchools() { for (const s of schools) { [s.x, s.z] = schoolTarget(s); [s.tx, s.tz] = schoolTarget(s); s.t = 3 + Math.random() * 6; } }
function addFish(adult, x, z, school) {
  if (fish.length >= MAXF) return null;
  const s = school ?? (adult ? (Math.random() * 12) | 0 : 12 + ((Math.random() * 4) | 0)), sc = schools[s];
  const f = { s, ox: (Math.random() * 2 - 1) * 4, oz: (Math.random() * 2 - 1) * 4, ph: Math.random() * 6.28, h: 0, adult, grow: adult ? 1 : 0, flee: 0, sp: 0, big: adult && Math.random() < .08 };
  f.x = x ?? sc.x + f.ox; f.z = z ?? sc.z + f.oz; fish.push(f); return f;
}
function seedLake(adults, fry) { fish = []; placeSchools(); for (let i = 0; i < adults; i++) addFish(true); for (let i = 0; i < fry; i++) addFish(false); }
const counts = () => { let a = 0, y = 0; for (const f of fish) f.adult ? a++ : y++; return [a, y]; };
function updateFish(dt, t, phase) {
  for (const s of schools) {
    if (Math.hypot(s.tx - s.x, s.tz - s.z) < 3 || s.t <= 0) { [s.tx, s.tz] = schoolTarget(s); s.t = 6 + Math.random() * 8; }
    const lure = fishOpts.lure; if (lure && lure.until > t && Math.hypot(lure.x - s.x, lure.z - s.z) < lure.r) { s.tx += (lure.x - s.tx) * dt * .6; s.tz += (lure.z - s.tz) * dt * .6; }
    s.t -= dt; const d = Math.hypot(s.tx - s.x, s.tz - s.z) || 1, sp = s.nursery ? 1.6 : 2.6;
    s.vx += ((s.tx - s.x) / d * sp - s.vx) * dt; s.vz += ((s.tz - s.z) / d * sp - s.vz) * dt;
    s.x += s.vx * dt; s.z += s.vz * dt;
    if (Math.hypot(s.x - ISLAND.x, s.z - ISLAND.z) < ISLAND.r + 3) { const a = Math.atan2(s.z - ISLAND.z, s.x - ISLAND.x); s.x = ISLAND.x + Math.cos(a) * (ISLAND.r + 3); s.z = ISLAND.z + Math.sin(a) * (ISLAND.r + 3); }
  }
  const view = fishOpts.view;
  for (let i = 0; i < MAXF; i++) {
    const f = fish[i];
    if (!f) { dummy.scale.setScalar(0); dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix); continue; }
    if (f.flee > 0) { f.flee -= dt; f.x += Math.cos(f.fa) * dt * 9; f.z += Math.sin(f.fa) * dt * 9; if (nr(f.x, f.z) > .95) { f.x *= .97; f.z *= .97; } }
    else {
      const s = schools[f.s], a = t * .35 + f.ph;
      const tx = s.x + f.ox * Math.cos(a) - f.oz * Math.sin(a) * .6, tz = s.z + f.ox * Math.sin(a) * .6 + f.oz * Math.cos(a);
      const dx = tx - f.x, dz = tz - f.z; f.x += dx * Math.min(1, dt * 1.6); f.z += dz * Math.min(1, dt * 1.6);
      if (Math.abs(dx) + Math.abs(dz) > .02) { const nh = Math.atan2(dz, dx); f.h += Math.atan2(Math.sin(nh - f.h), Math.cos(nh - f.h)) * Math.min(1, dt * 5); }
    }
    if (!f.adult && f.grow < 1 && phase === "spring") f.grow = Math.min(1, f.grow + dt * .5);
    let sz = (f.adult ? (f.big ? 1.5 : 1.12) : .5 + .45 * Math.min(1, f.grow)) * 1.15;
    if (view && Math.hypot(f.x - view.x, f.z - view.z) > view.r && !(view.extra && view.extra.some(l => Math.hypot(f.x - l.x, f.z - l.z) < 14))) sz = 0;
    dummy.position.set(f.x, -.2 + Math.sin(t * 2.2 + f.ph) * .05, f.z);
    dummy.rotation.set(0, -f.h + Math.sin(t * (f.adult ? 9 : 14) + f.ph) * .18, 0);
    dummy.scale.setScalar(sz); dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix);
    fishMesh.setColorAt(i, fcol.set(!f.adult ? "#bfe9ff" : f.big ? "#ffd8a0" : i % 4 === 0 ? "#eef4f6" : i % 4 === 1 ? "#ffb04a" : "#ff7a3c"));
  }
  fishMesh.instanceMatrix.needsUpdate = true; if (fishMesh.instanceColor) fishMesh.instanceColor.needsUpdate = true;
}
/* the golden carp */
const koi = new THREE.Group();
{ const b = new THREE.Mesh(fishGeo, new THREE.MeshBasicMaterial({ color: "#ffd34d" })); b.scale.setScalar(2); const gl = glowSprite(9, "#ffd34d"); gl.position.y = .4; koi.add(b, gl); koi.visible = false; scene.add(koi); }
/* dead young fish floating: what a fine net leaves behind (Who's Poaching evidence) */
const deadMat = new THREE.MeshBasicMaterial({ color: "#e9eef0" });
function deadPatch(x, z, n = 14) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const m = new THREE.Mesh(fishGeo, deadMat); m.scale.setScalar(.5); m.position.set(x + (Math.random() * 2 - 1) * 3, .12, z + (Math.random() * 2 - 1) * 3); m.rotation.set(Math.PI, Math.random() * 6, 0); g.add(m); } scene.add(g); return g; }
