// The shared 3D of /play: sky, water, shore, docks, boats, fish, lanterns,
// nets, ripples, floating words and the camera. Taken from prototype v7's art
// code (drawn by Claude in chat); v7's game logic is not here. This file
// decides nothing: the mode scripts tell it what the server's frames say.
// Math.random is used only for scenery (hills, trees) and effects.
import * as THREE from "three";

// The sims' lake is 1000 x 700 with radii 460 x 315; the 3D lake is a tenth.
export const R = { x: 46, z: 31.5 };
export const toWorld = (x, y) => [(x - 500) / 10, (y - 350) / 10];
export const toSim = (wx, wz) => [wx * 10 + 500, wz * 10 + 350];
const rand = (a, b) => a + Math.random() * (b - a); // scenery only

export function createWorld(canvas, stage, opts = {}) {
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch { stage.insertAdjacentHTML("beforeend", `<div class="fallback">This browser could not start 3D (WebGL). The game still runs; the panels show the state.</div>`); }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1200);
  const clock = new THREE.Clock();
  const toonTex = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  toonTex.minFilter = toonTex.magFilter = THREE.NearestFilter; toonTex.needsUpdate = true;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonTex, ...extra });
  const DAY = { top: new THREE.Color("#27264f"), mid: new THREE.Color("#c86a5a"), low: new THREE.Color("#f2a35e"), fog: new THREE.Color("#7d5a6e"), hemi: new THREE.Color("#ffc9a0"), sun: 1.5 };
  const NIGHT = { top: new THREE.Color("#05060f"), mid: new THREE.Color("#131a36"), low: new THREE.Color("#22284a"), fog: new THREE.Color("#10142a"), hemi: new THREE.Color("#5d6fae"), sun: .25 };
  let night = 0, nightTarget = 0;

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: DAY.top.clone() }, mid: { value: DAY.mid.clone() }, low: { value: DAY.low.clone() }, night: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 top, mid, low; uniform float night, time;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.10, h)); c = mix(c, top, smoothstep(0.10, 0.6, h));
        vec3 sd = normalize(vec3(-0.55, 0.06, -0.83)); float s = max(dot(d, sd), 0.0);
        c += vec3(1.0, 0.62, 0.3) * (pow(s, 300.0) * 2.0 + pow(s, 8.0) * 0.25) * (1.0 - night);
        vec3 q = floor(d * 220.0); float st = step(0.9965, hash(q)) * smoothstep(0.04, 0.3, h) * night;
        c += vec3(st) * (0.55 + 0.45 * sin(time * 2.0 + hash(q) * 30.0));
        vec3 md = normalize(vec3(0.45, 0.32, -0.83)); float m = dot(d, md);
        c = mix(c, vec3(1.0, 0.95, 0.82), smoothstep(0.9990, 0.9993, m) * night);
        c += vec3(0.5, 0.55, 0.8) * pow(max(m, 0.0), 60.0) * 0.25 * night;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat));
  scene.fog = new THREE.Fog(DAY.fog.clone(), 120, 420);
  const hemi = new THREE.HemisphereLight(DAY.hemi.clone(), new THREE.Color("#2b2440"), 1.25);
  const sun = new THREE.DirectionalLight(new THREE.Color("#ffd2a1"), 1.5); sun.position.set(-60, 40, -80);
  const moon = new THREE.DirectionalLight(new THREE.Color("#9fb3ff"), 0); moon.position.set(50, 60, -70);
  scene.add(hemi, sun, moon);

  const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2).scale(R.x * 1.02, 1, R.z * 1.02), new THREE.MeshBasicMaterial({ color: "#0b2a33" }));
  bed.position.y = -2.2; scene.add(bed);
  const LAN_MAX = 12;
  const waterU = {
    time: { value: 0 }, night: { value: 0 }, R: { value: new THREE.Vector2(R.x, R.z) },
    deep: { value: new THREE.Color("#0f4c5c") }, shallow: { value: new THREE.Color("#2f8f8a") }, sky: { value: new THREE.Color("#f2a35e") },
    glowCol: { value: new THREE.Color("#ffb45a") }, lan: { value: Array.from({ length: LAN_MAX }, () => new THREE.Vector3()) }, lanN: { value: 0 },
  };
  const water = new THREE.Mesh(new THREE.RingGeometry(0.001, 1, 120, 24).rotateX(-Math.PI / 2).scale(R.x, 1, R.z), new THREE.ShaderMaterial({
    transparent: true, uniforms: waterU,
    vertexShader: `uniform float time; varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
      w.y += (sin(w.x * 0.33 + time * 1.2) + sin(w.z * 0.41 - time * 0.9)) * 0.07; wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time, night; uniform vec2 R; uniform vec3 deep, shallow, sky, glowCol; uniform vec3 lan[${LAN_MAX}]; uniform int lanN; varying vec3 wp;
      void main(){ vec2 e = wp.xz / R; float r = length(e);
        vec3 c = mix(deep, shallow, smoothstep(0.55, 1.0, r));
        float w = sin(wp.x * 0.22 + time * 0.55 + sin(wp.z * 0.17 + time * 0.35) * 2.2) + sin(wp.z * 0.29 - time * 0.45);
        c = mix(c, sky, 0.07 * (1.0 - night));
        c *= 1.0 + smoothstep(0.6, 1.9, w) * 0.22;
        float line = smoothstep(1.6, 1.68, w) - smoothstep(1.7, 1.8, w);
        c += vec3(0.7, 0.9, 0.95) * line * 0.28 * (1.0 - night * 0.5);
        float sp = smoothstep(0.93, 1.0, sin(wp.x * 1.3 + time * 1.7) * sin(wp.z * 1.1 - time * 1.3));
        c += sp * 0.22 * (1.0 - night * 0.7);
        float a = atan(e.y, e.x); float foam = smoothstep(0.92, 0.995, r) * (0.65 + 0.35 * sin(time * 1.8 + a * 26.0));
        c = mix(c, vec3(0.96, 0.92, 0.84), foam * 0.75);
        vec3 g = vec3(0.0); for (int i = 0; i < ${LAN_MAX}; i++) { if (i >= lanN) break; float d = length(wp.xz - lan[i].xz); g += glowCol * exp(-d * d / 26.0) * lan[i].y; }
        c = c * (1.0 - night * 0.62) + g * night * 0.9;
        gl_FragColor = vec4(c, 0.66 + foam * 0.3); }`,
  }));
  scene.add(water);

  // ground with a lake-shaped hole, hills, trees
  {
    const sh = new THREE.Shape(); sh.moveTo(-400, -400); sh.lineTo(400, -400); sh.lineTo(400, 400); sh.lineTo(-400, 400); sh.lineTo(-400, -400);
    const hole = new THREE.Path(); hole.absellipse(0, 0, R.x * 1.005, R.z * 1.005, 0, Math.PI * 2, false, 0); sh.holes.push(hole);
    const g = new THREE.Mesh(new THREE.ShapeGeometry(sh, 96).rotateX(-Math.PI / 2), toon("#56703f")); g.position.y = 0.32; scene.add(g);
    const bank = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.07, 120, 1).rotateX(-Math.PI / 2).scale(R.x, 1, R.z), toon("#c9a56b")); bank.position.y = 0.34; scene.add(bank);
    const hillMat = toon("#2c3b4a");
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand(-.1, .1), d = rand(150, 260), h = rand(22, 60);
      const m = new THREE.Mesh(new THREE.ConeGeometry(rand(26, 48), h, 5), hillMat); m.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d * .8); m.rotation.y = rand(0, 3); scene.add(m);
    }
    const trees = 90, cone = new THREE.ConeGeometry(1.6, 4.8, 6), trunk = new THREE.CylinderGeometry(.25, .3, 1.4, 5);
    const tm = new THREE.InstancedMesh(cone, toon("#2f5a3a"), trees), km = new THREE.InstancedMesh(trunk, toon("#5a3a26"), trees);
    const o = new THREE.Object3D();
    for (let n = 0; n < trees; n++) {
      const a = rand(0, Math.PI * 2), k = rand(1.15, 1.9), x = Math.cos(a) * R.x * k, z = Math.sin(a) * R.z * k, s = rand(.7, 1.4);
      o.position.set(x, .32 + 1.4 * s + 2.4 * s - .2, z); o.scale.setScalar(s); o.rotation.set(0, rand(0, 3), 0); o.updateMatrix(); tm.setMatrixAt(n, o.matrix);
      o.position.y = .32 + .7 * s; o.updateMatrix(); km.setMatrixAt(n, o.matrix);
    }
    scene.add(tm, km);
  }

  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,220,150,1)"); g.addColorStop(.35, "rgba(255,170,80,.45)"); g.addColorStop(1, "rgba(255,150,60,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glowSprite = (s = 6, color = "#ffffff") => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); m.scale.set(s, s, 1); return m; };
  function makeLantern(size = 1) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(.55 * size, 12, 10).scale(1, 1.15, 1), new THREE.MeshBasicMaterial({ color: "#ff5a3c" }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.3 * size, .3 * size, .18 * size, 10), new THREE.MeshBasicMaterial({ color: "#e8b84d" }));
    cap.position.y = .62 * size; const cap2 = cap.clone(); cap2.position.y = -.62 * size;
    const glow = glowSprite(5.5 * size); g.add(body, cap, cap2, glow); g.userData.glow = glow; return g;
  }

  // docks and houses at given points (sim units); a mode places them
  const docks = [];
  function setDocks(list) {
    for (const d of docks) scene.remove(d.g);
    docks.length = 0;
    for (const p of list) {
      const [x, z] = toWorld(p.x, p.y);
      const g = new THREE.Group(), inward = Math.atan2(-z, -x);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(9, .35, 2.4), toon("#8a5a34")); plank.position.set(Math.cos(inward) * 1.5, .45, Math.sin(inward) * 1.5); plank.rotation.y = -inward; g.add(plank);
      const hx = -Math.cos(inward) * 6, hz = -Math.sin(inward) * 6;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), toon("#efe1c2")); wall.position.set(hx, 1.9, hz); wall.rotation.y = -inward;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.6, 4), toon(p.color ?? "#b8352a")); roof.position.set(hx, 4.8, hz); roof.rotation.y = -inward + Math.PI / 4;
      const lan = makeLantern(.8); lan.position.set(Math.cos(inward) * 5.6, 2.4, Math.sin(inward) * 5.6);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.color ?? "#f5ead6", transparent: true, opacity: .6, depthWrite: false }));
      ring.scale.setScalar((p.r ?? 60) / 10); ring.position.set(0, .14, 0);
      g.add(wall, roof, lan); g.position.set(x, 0, z); scene.add(g);
      const rg = new THREE.Group(); rg.add(ring); rg.position.set(x, 0, z); scene.add(rg); g.userData.ring = rg;
      docks.push({ g, ring: rg, lan, x, z });
    }
  }

  // boats
  const hullShape = (() => { const s = new THREE.Shape(); s.moveTo(-2.3, -1); s.lineTo(1.2, -1); s.quadraticCurveTo(2.6, -.8, 3.1, 0); s.quadraticCurveTo(2.6, .8, 1.2, 1); s.lineTo(-2.3, 1); s.quadraticCurveTo(-2.7, 0, -2.3, -1); return s; })();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: .9, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 2 }).rotateX(-Math.PI / 2);
  hullGeo.translate(0, -.3, 0);
  const outlineMat = new THREE.MeshBasicMaterial({ color: "#1a1016", side: THREE.BackSide });
  function makeBoat(color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, toon("#7b4a2b")); const ol = new THREE.Mesh(hullGeo, outlineMat); ol.scale.setScalar(1.07);
    const band = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: .18, bevelEnabled: false }).rotateX(-Math.PI / 2), toon(color)); band.position.y = .62; band.scale.set(1.02, 1, 1.04);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, .9, 1.3), toon("#e8d5b0")); cabin.position.set(-1.1, 1.05, 0);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 1.9, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), toon(color)); roof.position.set(-1.1, 1.5, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 4.4, 6), toon("#3a2418")); mast.position.set(.5, 2.6, 0);
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute([.55, 4.6, 0, .55, 1.1, 0, 2.6, 1.3, 0, .55, 4.6, 0, -1.3, 1.6, 0, .55, 1.1, 0], 3)); sg.computeVertexNormals();
    const sail = new THREE.Mesh(sg, toon(color, { side: THREE.DoubleSide }));
    const lan = makeLantern(.55); lan.position.set(.55, 5.1, 0); lan.visible = false;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.1, 5), new THREE.MeshBasicMaterial({ color: "#ffd34d" })); crown.position.set(.55, 5.6, 0); crown.visible = false;
    const shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 10), new THREE.MeshBasicMaterial({ color: "#8fe0c9", transparent: true, opacity: .18, depthWrite: false })); shield.position.y = 1; shield.visible = false;
    const pile = new THREE.Group();
    for (let i = 0; i < 15; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.28, 6, 5).scale(1.6, .7, 1), toon(i % 3 ? "#f08a3c" : "#d7dde2")); f.position.set(-.1 + (i % 4) * .5 - .8, .78 + Math.floor(i / 4) * .22, ((i * 7) % 3 - 1) * .45); f.rotation.y = i; f.visible = false; pile.add(f); }
    g.add(ol, hull, band, cabin, roof, mast, sail, lan, crown, shield, pile);
    g.userData = { lan, pile, sail, crown, shield };
    scene.add(g); return g;
  }
  const boats = new Map(); // seat -> { mesh, tag, prev, cur }
  const tagsEl = stage.querySelector("#tags");
  function boat(seat, color, label) {
    let b = boats.get(seat);
    if (!b) {
      const tag = document.createElement("div"); tag.className = "tag3d"; tag.style.setProperty("--c", color); tagsEl?.appendChild(tag);
      b = { mesh: makeBoat(color), tag, x: 0, z: 0, h: 0, ph: seat * 1.7, hold: 0, wakeT: 0, speed: 0 };
      boats.set(seat, b);
    }
    b.tag.textContent = label;
    return b;
  }
  function clearBoats() { for (const b of boats.values()) { scene.remove(b.mesh); b.tag.remove(); } boats.clear(); }

  // fish: one instanced mesh; a mode sends positions each frame
  function mergeGeos(list) { const pos = [], nor = []; for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return g; }
  const fishGeo = mergeGeos([
    new THREE.SphereGeometry(.5, 12, 8).scale(1.25, .48, .4),
    new THREE.ConeGeometry(.34, .6, 4).rotateZ(-Math.PI / 2).scale(1, 1, .22).translate(-.82, 0, 0),
    new THREE.ConeGeometry(.16, .34, 3).scale(1.6, 1, .2).translate(.05, .3, 0),
  ]);
  const FISH_MAX = 400;
  const fishMesh = new THREE.InstancedMesh(fishGeo, toon("#ffffff"), FISH_MAX);
  const fishCol = new THREE.Color();
  for (let i = 0; i < FISH_MAX; i++) fishMesh.setColorAt(i, fishCol.set(i % 4 === 0 ? "#eef4f6" : i % 4 === 1 ? "#ffb04a" : "#ff7a3c"));
  fishMesh.count = 0; scene.add(fishMesh);
  const dummy = new THREE.Object3D();
  // list: [x, y, h, size] in sim units, h in radians
  function setFish(list, t) {
    const n = Math.min(list.length, FISH_MAX);
    for (let i = 0; i < n; i++) {
      const [x, y, h, s = 1] = list[i]; const [wx, wz] = toWorld(x, y);
      dummy.position.set(wx, -.2 + Math.sin(t * 2.2 + i) * .05, wz); dummy.rotation.set(0, -h + Math.sin(t * 9 + i) * .18, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix);
    }
    fishMesh.count = n; fishMesh.instanceMatrix.needsUpdate = true;
  }
  const koi = new THREE.Group();
  { const b = new THREE.Mesh(fishGeo, new THREE.MeshBasicMaterial({ color: "#ffd34d" })); b.scale.setScalar(2); const gl = glowSprite(9, "#ffd34d"); gl.position.y = .4; koi.add(b, gl); koi.position.y = -.1; koi.visible = false; scene.add(koi); }
  function setKoi(k, t) { koi.visible = !!k; if (k) { const [x, z] = toWorld(k[0], k[1]); koi.position.set(x, -.1 + Math.sin(t * 3) * .1, z); koi.rotation.y = -k[2]; } }

  // things a mode places and moves: simple meshes keyed by id
  const props = new Map();
  function prop(id, make) { let p = props.get(id); if (!p) { p = make(); scene.add(p); props.set(id, p); } p.userData.seen = true; return p; }
  function sweepProps() { for (const [id, p] of props) { if (!p.userData.seen) { scene.remove(p); props.delete(id); } p.userData.seen = false; } }
  function clearProps() { for (const p of props.values()) scene.remove(p); props.clear(); }

  // small labels pinned to points on the water (sim units), drawn each frame
  const labels = new Map();
  function setLabels(list) { // [id, x, y, text, cls]
    const seen = new Set();
    for (const [id, x, y, text, cls] of list) {
      let el = labels.get(id);
      if (!el) { el = document.createElement("div"); el.className = "pin"; tagsEl?.appendChild(el); labels.set(id, el); }
      el.textContent = text; el.className = `pin ${cls ?? ""}`; el.dataset.x = x; el.dataset.y = y; seen.add(id);
    }
    for (const [id, el] of labels) if (!seen.has(id)) { el.remove(); labels.delete(id); }
  }

  // effects
  const fx = [];
  function ripple(x, y, color = "#f5ead6", size = 4, life = 1.2) {
    const [wx, wz] = toWorld(x, y);
    const m = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.position.set(wx, .12, wz); scene.add(m); fx.push({ m, t: 0, life, size, kind: "ripple" });
  }
  const netGridGeo = (() => { const p = []; for (let i = -4; i <= 4; i++) { const k = i / 4, w = Math.sqrt(1 - k * k); p.push(k, 0, -w, k, 0, w, -w, 0, k, w, 0, k); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return g; })();
  function netDrop(x, y, r, color, life = 1.1) {
    const [wx, wz] = toWorld(x, y);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#f5ead6", transparent: true, depthWrite: false }));
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .22, depthWrite: false }));
    const grid = new THREE.LineSegments(netGridGeo, new THREE.LineBasicMaterial({ color: "#f5ead6", transparent: true, opacity: .55 }));
    g.add(ring, mesh, grid); g.position.set(wx, .14, wz); scene.add(g); fx.push({ m: g, t: 0, life, size: r / 10, kind: "net" });
  }
  const wakeGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
  function wake(wx, wz, s = 1) { const m = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: "#eaf6f2", transparent: true, opacity: .35, depthWrite: false })); m.position.set(wx, .1, wz); scene.add(m); fx.push({ m, t: 0, life: 1.4, size: s, kind: "wake" }); }
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i]; e.t += dt; const k = e.t / e.life;
      if (e.kind === "ripple") { e.m.scale.setScalar(e.size * (.2 + k)); e.m.material.opacity = (1 - k) * .9; }
      if (e.kind === "wake") { e.m.scale.set(.5 + k * 1.6, 1, .5 + k * 1.6); e.m.material.opacity = (1 - k) * .3; }
      if (e.kind === "net") { const open = Math.min(1, e.t / .22), close = Math.max(0, (e.t - e.life * .5) / (e.life * .5)); e.m.scale.setScalar(e.size * open * (1 - close * .8)); e.m.position.y = .14 - close * .5; e.m.children.forEach((c) => c.material.opacity = (c.material.userData.o ??= c.material.opacity) * (1 - close)); }
      if (k >= 1) { scene.remove(e.m); e.m.traverse?.((o) => { if (o.material) o.material.dispose(); }); fx.splice(i, 1); }
    }
  }
  const floatsEl = stage.querySelector("#floats");
  const pv = new THREE.Vector3();
  function floatText(x, y, text, color = "#f5ead6", height = 3) {
    const [wx, wz] = toWorld(x, y);
    pv.set(wx, height, wz).project(camera); if (pv.z > 1 || !floatsEl) return;
    const el = document.createElement("div"); el.className = "float"; el.textContent = text; el.style.color = color;
    el.style.transform = `translate(${(pv.x * .5 + .5) * stage.clientWidth}px, ${(-pv.y * .5 + .5) * stage.clientHeight}px) translate(-50%, -100%)`;
    floatsEl.appendChild(el); setTimeout(() => el.remove(), 1400);
  }

  // camera: a mode sets where it looks; small phones pull back
  const cam = { p: new THREE.Vector3(0, 52, 60), l: new THREE.Vector3(0, 0, 3) };
  const camPos = new THREE.Vector3(0, 90, 120), camLook = new THREE.Vector3();
  function setCamera(p, l) { cam.p.set(...p); cam.l.set(...l); }
  function resize() {
    if (!renderer) return;
    const w = stage.clientWidth, h = stage.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false);
    const panelW = opts.panel && innerWidth > 860 ? 430 : 0;
    if (panelW) { camera.aspect = (w + panelW) / h; camera.setViewOffset(w + panelW, h, 0, 0, w, h); } else { camera.aspect = w / h; camera.clearViewOffset(); }
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  // tap on the water -> sim coordinates
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function screenToSim(clientX, clientY) {
    const r = canvas.getBoundingClientRect(); ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null;
    return toSim(hit.x, hit.z);
  }

  const lanVec = waterU.lan.value;
  let lanterns = []; // [x, y, strength] in sim units, drawn as glow on the water
  let onFrame = () => {};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function loop() {
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    night += (nightTarget - night) * Math.min(1, dt * 1.8);
    skyMat.uniforms.top.value.copy(DAY.top).lerp(NIGHT.top, night); skyMat.uniforms.mid.value.copy(DAY.mid).lerp(NIGHT.mid, night); skyMat.uniforms.low.value.copy(DAY.low).lerp(NIGHT.low, night);
    skyMat.uniforms.night.value = night; skyMat.uniforms.time.value = t;
    scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, night); hemi.color.copy(DAY.hemi).lerp(NIGHT.hemi, night); hemi.intensity = 1.25 - night * .55; sun.intensity = DAY.sun * (1 - night); moon.intensity = night * .6;
    waterU.time.value = t; waterU.night.value = night; waterU.sky.value.set(night > .5 ? "#3d4a85" : "#f2a35e");
    let n = 0;
    for (const d of docks) if (n < LAN_MAX) lanVec[n++].set(d.x + Math.cos(Math.atan2(-d.z, -d.x)) * 5.6, .8, d.z + Math.sin(Math.atan2(-d.z, -d.x)) * 5.6);
    for (const [x, y, k] of lanterns) { if (n >= LAN_MAX) break; const [wx, wz] = toWorld(x, y); lanVec[n++].set(wx, k, wz); }
    waterU.lanN.value = n;
    for (const d of docks) d.lan.userData.glow.material.opacity = .35 + night * .65;
    onFrame(dt, t);
    updateFx(dt);
    const W = stage.clientWidth, H = stage.clientHeight;
    for (const b of boats.values()) {
      if (!b.mesh.visible) { b.tag.style.display = "none"; continue; }
      pv.set(b.x, 5.6, b.z).project(camera); const vis = pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1;
      b.tag.style.display = vis ? "block" : "none";
      if (vis) b.tag.style.transform = `translate(${(pv.x * .5 + .5) * W}px, ${(-pv.y * .5 + .5) * H}px) translate(-50%, -100%)`;
    }
    for (const el of labels.values()) {
      const [wx, wz] = toWorld(+el.dataset.x, +el.dataset.y); pv.set(wx, .6, wz).project(camera);
      el.style.transform = `translate(${(pv.x * .5 + .5) * W}px, ${(-pv.y * .5 + .5) * H}px) translate(-50%, -50%)`;
    }
    const sway = reduced ? 0 : Math.sin(t * .08) * 4;
    const want = cam.p.clone(); want.x += sway;
    if (camera.aspect < 1.1) { const far = 1 + (1.1 - camera.aspect) * 1.25; want.sub(cam.l).multiplyScalar(far).add(cam.l); }
    camPos.lerp(want, Math.min(1, dt * 1.6)); camLook.lerp(cam.l, Math.min(1, dt * 1.8));
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (renderer) renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  resize(); requestAnimationFrame(loop);

  // place a boat from two frames (smoothly between them) and draw its state
  function drawBoat(b, x, y, h, t, state = {}) {
    const [wx, wz] = toWorld(x, y);
    const moved = Math.hypot(wx - b.x, wz - b.z);
    b.speed = b.speed * .8 + moved * 20 * .2;
    b.x = wx; b.z = wz; b.h = h;
    const m = b.mesh; m.visible = state.visible !== false;
    m.position.set(wx, Math.sin(t * 2 + b.ph) * .1, wz); m.rotation.set(0, -h, 0); m.rotateX(Math.sin(t * 1.6 + b.ph) * .05); m.rotateZ(Math.sin(t * 1.3 + b.ph) * .03);
    const pile = m.userData.pile.children; for (let i = 0; i < pile.length; i++) pile[i].visible = i < (state.hold ?? 0);
    m.userData.lan.visible = night > .4 || !!state.lantern; m.userData.lan.userData.glow.material.opacity = Math.max(night, state.lantern ? 1 : 0);
    m.userData.crown.visible = !!state.crown; m.userData.crown.rotation.y = t * 2;
    m.userData.shield.visible = !!state.shield;
    b.wakeT -= 1 / 60; if (b.speed > 1.2 && b.wakeT <= 0) { b.wakeT = state.dash ? .05 : .11; wake(wx - Math.cos(h) * 2.4, wz - Math.sin(h) * 2.4, state.dash ? 1.6 : 1); }
  }

  return {
    THREE, scene, camera, toon, makeLantern, glowSprite, R,
    setNight: (v) => { nightTarget = v; }, setLanterns: (l) => { lanterns = l; },
    setDocks, boat, drawBoat, clearBoats, boats, setFish, setKoi, prop, sweepProps, clearProps,
    ripple, netDrop, floatText, setLabels, setCamera, screenToSim, onFrame: (f) => { onFrame = f; },
    shake() { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); },
  };
}

// ---- sounds: a few tones, made here; off until the player turns them on ----
export function createSound(button) {
  let ac = null, on = false;
  try { on = localStorage.getItem("play-sound") === "on"; } catch {}
  const label = () => { if (button) button.textContent = on ? "sound on" : "sound off"; };
  label();
  button?.addEventListener("click", () => { on = !on; try { localStorage.setItem("play-sound", on ? "on" : "off"); } catch {} if (on && !ac) ac = new AudioContext(); label(); });
  const ok = () => { if (!on) return false; if (!ac) { try { ac = new AudioContext(); } catch { return false; } } return true; };
  function tone(freq, d = .12, type = "sine", g = .15, when = 0) {
    if (!ok()) return;
    const o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.frequency.value = freq;
    v.gain.setValueAtTime(g, ac.currentTime + when); v.gain.exponentialRampToValueAtTime(.001, ac.currentTime + when + d);
    o.connect(v).connect(ac.destination); o.start(ac.currentTime + when); o.stop(ac.currentTime + when + d + .02);
  }
  return {
    catch: (n = 1) => { for (let i = 0; i < Math.min(n, 5); i++) tone(660 + i * 110, .1, "triangle", .12, i * .05); },
    coin: () => { tone(988, .08, "square", .08); tone(1318, .12, "square", .08, .07); },
    bank: () => { tone(523, .1, "triangle"); tone(784, .16, "triangle", .15, .08); },
    hit: () => { tone(110, .25, "sawtooth", .2); tone(80, .3, "square", .12, .03); },
    miss: () => tone(220, .18, "sine", .1),
    horn: () => { tone(196, .9, "sawtooth", .16); tone(147, .9, "sawtooth", .12); },
    big: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, "triangle", .14, i * .09)); },
    tick: () => tone(1200, .04, "square", .05),
  };
}
