// The v5 shared 3D world (DESIGN.md "The world (shared)"): the 92 x 64 lobed
// lake, the island, named places, the village, four seasons, the follow and
// overview cameras, the minimap, and input (keys, a thumb stick, tap/click
// on the water). Only Boat Rush 2.0 uses this file for now — see
// world-select.js and DESIGN.md's "What is shared, and what is not" for why
// the other three modes keep loading world.js instead. Nothing here decides
// an outcome: the mode script tells it what the server's frames say.
//
// Unlike world.js (whose sim is a 1000 x 700 grid, scaled by /10 into Three
// world units), lake-world.ts's units already ARE Three.js world units
// (DESIGN.md: "about 118 units wide on a laptop" matches the camera span
// below exactly) — so toWorld/toSim here are the identity, and every size
// is ported from the prototype unscaled. The lake's shape, places, docks and
// seasons come from the page's boot JSON (worldForPage()), never re-derived
// or hand-copied here.
//
// Compass: x is east, y (the sim's "z" on screen) is south, towards the
// village, matching lake-world.ts.
import * as THREE from "../vendor/three.module.js";

export function createWorld5(canvas, stage, world, opts = {}) {
  // the page's lake is the four-boat one; a match's lake is that one times lakeK (setLake, rule change 11)
  let lakeK = 1, LX = world.lake.x, LY = world.lake.y;
  const toWorld = (x, y) => [x, y];
  const toSim = (wx, wz) => [wx, wz];

  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch { stage.insertAdjacentHTML("beforeend", `<div class="fallback">This browser could not start 3D (WebGL). The game still runs; the panels show the state.</div>`); }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 1600);
  const clock = new THREE.Clock();
  const toonTex = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  toonTex.minFilter = toonTex.magFilter = THREE.NearestFilter; toonTex.needsUpdate = true;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonTex, ...extra });

  // ---- the lake's outline, sampled server-side (lake-world.ts's outline()) ----
  const outlineW = world.outline;
  const outlineBankW = world.outlineBank;
  const islandB = { x: world.island.x, z: world.island.y, r: world.island.r }, island = { ...islandB };
  const zonesB = Object.fromEntries(Object.entries(world.zones).map(([id, z]) => [id, { x: z.x, z: z.y, r: z.r }]));
  const zones = Object.fromEntries(Object.entries(zonesB).map(([id, z]) => [id, { ...z }]));
  const docks = world.dockAngles.map((a) => { const [x, y] = polarFromOutline(a); return { a, x, z: y, inward: Math.atan2(-y, -x) }; });
  // a dock sits on the shore at angle a (degrees): interpolate the sampled outline
  function polarFromOutline(aDeg) {
    const n = outlineW.length, a = ((aDeg % 360) + 360) % 360, t = (a / 360) * n, i0 = Math.floor(t) % n, i1 = (i0 + 1) % n, f = t - Math.floor(t);
    const [x0, z0] = outlineW[i0], [x1, z1] = outlineW[i1];
    return [x0 + (x1 - x0) * f, z0 + (z1 - z0) * f];
  }
  // how far out toward the shore a point is (1 = on the shore); returned as shoreShare for the practice
  const nr = (x0, z0) => {
    const x = x0 / lakeK, z = z0 / lakeK; // in the page's lake units
    const a = (Math.atan2(z, x) * 180) / Math.PI, n = outlineW.length, t = ((((a % 360) + 360) % 360) / 360) * n;
    const i0 = Math.floor(t) % n, i1 = (i0 + 1) % n, f = t - Math.floor(t);
    const [sx0, sz0] = outlineW[i0], [sx1, sz1] = outlineW[i1];
    const shoreR = Math.hypot(sx0 + (sx1 - sx0) * f, sz0 + (sz1 - sz0) * f);
    return Math.hypot(x, z) / (shoreR || 1);
  };
  function randomWater(maxK = 0.82, avoidIsland = 11) {
    for (let k = 0; k < 60; k++) { const x = (Math.random() * 2 - 1) * LX, z = (Math.random() * 2 - 1) * LY; if (nr(x, z) < maxK && Math.hypot(x - island.x, z - island.z) > avoidIsland) return [x, z]; }
    return [0, 20];
  }
  function nearZone(id, spread = 1) {
    const zz = zones[id];
    for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * zz.r * spread; const x = zz.x + Math.cos(a) * r, z = zz.z + Math.sin(a) * r; if (nr(x, z) < 0.93 && Math.hypot(x - island.x, z - island.z) > 10) return [x, z]; }
    return randomWater();
  }

  // ---- seasons: spring, summer, autumn, winter ----
  const SEASONS = [
    { id: "spring", top: "#6f8fc9", mid: "#f0c2c6", low: "#fde4cc", fog: "#cdbfd0", hemi: "#ffe6e0", sun: 1.35, ground: "#7aa35a", round: "#f2a3bf", willow: "#a6d86f", pine: "#2f5a3a", deep: "#195a66", shallow: "#4aa596", bank: "#cfae76", part: "petal" },
    { id: "summer", top: "#3a78cf", mid: "#8cc3ea", low: "#e6f2ee", fog: "#a8c5cf", hemi: "#fff3d6", sun: 1.55, ground: "#5d9a45", round: "#3f8f45", willow: "#5aa24a", pine: "#2a5234", deep: "#0f5060", shallow: "#2e9a8a", bank: "#d1b27a", part: "none" },
    { id: "autumn", top: "#3b3a6b", mid: "#e0985a", low: "#f6c27a", fog: "#b8876e", hemi: "#ffd0a0", sun: 1.45, ground: "#8f8a45", round: "#d9572e", willow: "#d9b33a", pine: "#33553a", deep: "#1b4a55", shallow: "#3d8a7c", bank: "#c99f62", part: "leaf" },
    { id: "winter", top: "#5d6f8a", mid: "#b8c4d4", low: "#e8edf2", fog: "#c9d2dc", hemi: "#e8f0ff", sun: 1.2, ground: "#dfe6ec", round: "#7a6656", willow: "#8a7a5a", pine: "#2f4f45", deep: "#23485a", shallow: "#5c8f98", bank: "#c9c4bc", part: "snow" },
  ];
  const NIGHT = { top: "#05060f", mid: "#141b38", low: "#25294c", fog: "#10142a", hemi: "#5d6fae", sun: 0.22 };
  let seasonIx = 0, night = 0, nightTarget = 0;

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, night: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 top, mid, low; uniform float night, time;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.6, h));
        vec3 sd = normalize(vec3(-0.5, 0.18, -0.85)); float s = max(dot(d, sd), 0.0);
        c += vec3(1.0, 0.8, 0.55) * (pow(s, 400.0) * 1.6 + pow(s, 10.0) * 0.18) * (1.0 - night);
        vec3 q = floor(d * 220.0); float st = step(0.9965, hash(q)) * smoothstep(0.04, 0.3, h) * night;
        c += vec3(st) * (0.55 + 0.45 * sin(time * 2.0 + hash(q) * 30.0));
        vec3 md = normalize(vec3(0.45, 0.32, -0.83)); float m = dot(d, md);
        c = mix(c, vec3(1.0, 0.95, 0.82), smoothstep(0.9990, 0.9993, m) * night);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat));
  scene.fog = new THREE.Fog(new THREE.Color("#cdbfd0"), 180, 620);
  const hemi = new THREE.HemisphereLight("#ffe6e0", "#2b2440", 1.25);
  const sun = new THREE.DirectionalLight("#ffe0bb", 1.4); sun.position.set(-60, 70, -80);
  scene.add(hemi, sun);

  // ---- the lake and everything round it, in the page's (four-boat) lake units. A match on a lake for
  // more or fewer boats (rule change 11) scales this whole group by its k (setLake); the boats, fish and
  // the docks are drawn at the match's own positions and keep their size.
  const lakeG = new THREE.Group(); scene.add(lakeG);
  // ---- water: the lake's outline as a shape, foam along the shore and round the island ----
  const lakeShape = (() => { const s = new THREE.Shape(); outlineW.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); return s; })();
  const LAN_MAX = 12;
  const waterU = {
    time: { value: 0 }, night: { value: 0 }, lakeK: { value: 1 }, isl: { value: new THREE.Vector3(island.x, island.z, island.r) },
    deep: { value: new THREE.Color() }, shallow: { value: new THREE.Color() }, sky: { value: new THREE.Color() },
    glowCol: { value: new THREE.Color("#ffb45a") }, lan: { value: Array.from({ length: LAN_MAX }, () => new THREE.Vector3()) }, lanN: { value: 0 },
    shore: { value: null },
  };
  // the shore's distance at each of the outline's angles, as a 1-D texture, so the shader can tell how near the
  // shore a pixel is (as nr() does). Done per vertex it was smeared along the long thin triangles of the lake's
  // shape and drew bright diagonal streaks across the water.
  { const n = outlineW.length, d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = Math.hypot(outlineW[i][0], outlineW[i][1]);
    const tex = new THREE.DataTexture(d, n, 1, THREE.RedFormat, THREE.FloatType); tex.wrapS = THREE.RepeatWrapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; waterU.shore.value = tex; }
  const waterGeo = new THREE.ShapeGeometry(lakeShape, 64).rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.ShaderMaterial({
    transparent: true, uniforms: waterU,
    vertexShader: `uniform float time; varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
      w.y += (sin(w.x * 0.3 + time * 1.1) + sin(w.z * 0.37 - time * 0.8)) * 0.06; wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time, night, lakeK; uniform vec3 deep, shallow, sky, glowCol, isl; uniform vec3 lan[${LAN_MAX}]; uniform int lanN; uniform sampler2D shore; varying vec3 wp;
      void main(){
        vec2 q = wp.xz / lakeK; // the page's lake units, as the shore texture and the island are
        float ang = atan(q.y, q.x); float u = fract(ang / 6.2831853 + 1.0);
        float sr = texture2D(shore, vec2(u, 0.5)).r;
        float ve = max(length(q) / max(sr, 1.0), 1.0 - (length(q - isl.xy) - isl.z) / 4.0);
        vec3 c = mix(deep, shallow, 0.5 + 0.5 * smoothstep(0.2, 1.0, ve));
        float di = length(q - isl.xy); c *= mix(0.72, 1.0, smoothstep(isl.z + 4.0, isl.z + 18.0, di));
        // calm water (Ava, 24 Oct: the moving light bands, ripple lines and sparkles were dazzling): only a faint sky tint
        c = mix(c, sky, 0.06 * (1.0 - night));
        float foam = smoothstep(0.9, 0.995, ve) * (0.65 + 0.35 * sin(time * 1.8 + wp.x * 0.5 + wp.z * 0.4));
        c = mix(c, vec3(0.96, 0.93, 0.86), foam * 0.7);
        vec3 g = vec3(0.0); for (int i = 0; i < ${LAN_MAX}; i++) { if (i >= lanN) break; float d = length(wp.xz - lan[i].xz); g += glowCol * exp(-d * d / 30.0) * lan[i].y; }
        c = c * (1.0 - night * 0.62) + g * night * 0.95;
        gl_FragColor = vec4(c, 0.72 + foam * 0.25); }`,
  }));
  lakeG.add(water);
  const bed = new THREE.Mesh(new THREE.ShapeGeometry(lakeShape, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#0b2a33" })); bed.position.y = -2.4; lakeG.add(bed);

  // ---- land: ground with the lake cut out, a sandy bank, far hills ----
  const groundMat = toon("#7aa35a"), bankMat = toon("#cfae76");
  {
    const sh = new THREE.Shape(); sh.moveTo(-700, -700); sh.lineTo(700, -700); sh.lineTo(700, 700); sh.lineTo(-700, 700); sh.lineTo(-700, -700);
    const hole = new THREE.Path(); outlineW.forEach(([x, z], i) => (i ? hole.lineTo(x, -z) : hole.moveTo(x, -z))); sh.holes.push(hole);
    const g = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48).rotateX(-Math.PI / 2), groundMat); g.position.y = 0.34; lakeG.add(g);
    const bs = new THREE.Shape(); outlineBankW.forEach(([x, z], i) => (i ? bs.lineTo(x, -z) : bs.moveTo(x, -z)));
    const bh = new THREE.Path(); outlineW.forEach(([x, z], i) => (i ? bh.lineTo(x, -z) : bh.moveTo(x, -z))); bs.holes.push(bh);
    const bank = new THREE.Mesh(new THREE.ShapeGeometry(bs, 48).rotateX(-Math.PI / 2), bankMat); bank.position.y = 0.36; lakeG.add(bank);
    const layers = [["#4d5f78", 300, 420, 40, 90], ["#6b7d96", 420, 560, 60, 130], ["#8d9cb2", 560, 720, 80, 170]];
    for (const [col, d0, d1, h0, h1] of layers) {
      const mat = new THREE.MeshBasicMaterial({ color: col, fog: true });
      for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2 + Math.random() * 0.2, d = d0 + Math.random() * (d1 - d0), h = h0 + Math.random() * (h1 - h0);
        const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9 + 30, h, 6), mat); m.position.set(Math.cos(a) * d, h / 2 - 6, Math.sin(a) * d * 0.9); m.rotation.y = Math.random() * 3; scene.add(m); }
    }
  }

  // ---- the island and its pagoda ----
  {
    const g = new THREE.Group(); g.position.set(island.x, 0, island.z);
    const hill = new THREE.Mesh(new THREE.CylinderGeometry(island.r * 0.8, island.r, 1.6, 18), toon("#8a8a50")); hill.position.y = 0.5; g.add(hill);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2), toon("#8b8f94")); rock.position.set(-4, 1.2, 2); g.add(rock);
    for (let k = 0; k < 4; k++) { const s = 3.4 - k * 0.55; const body = new THREE.Mesh(new THREE.BoxGeometry(s * 1.2, 1.7, s * 1.2), toon("#efe1c2")); body.position.y = 2.2 + k * 2.2; const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 1.25, 1.1, 4), toon("#b8352a")); roof.position.y = 3.4 + k * 2.2; roof.rotation.y = Math.PI / 4; g.add(body, roof); }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2, 6), toon("#e8b84d")); tip.position.y = 12.4; g.add(tip);
    lakeG.add(g);
  }

  // ---- the river mouth and the stone bridge ----
  if (zones.river) {
    const a = Math.atan2(zones.river.z, zones.river.x), dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
    const [sx, sz] = polarFromOutline((a * 180) / Math.PI), len = 200, w = 11;
    const rv = new THREE.Mesh(new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#2f7f86" }));
    rv.position.set(sx + dir.x * (len / 2 - 2), 0.38, sz + dir.y * (len / 2 - 2)); rv.rotation.y = -a; lakeG.add(rv);
    const bx = sx + dir.x * 14, bz = sz + dir.y * 14;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 1.1, 8, 20, Math.PI), toon("#a9a39a")); arch.position.set(bx, 0.3, bz); arch.rotation.y = -a + Math.PI; lakeG.add(arch);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 15), toon("#b9b3a8")); deck.position.set(bx, 5.4, bz); deck.rotation.y = -a; lakeG.add(deck);
  }

  // ---- docks and the village (south shore) ----
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,220,150,1)"); g.addColorStop(0.35, "rgba(255,170,80,.45)"); g.addColorStop(1, "rgba(255,150,60,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glowSprite = (s = 6, color = "#ffffff") => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); m.scale.set(s, s, 1); return m; };
  // a ring on the water a player must find (a splash to tap, a place to sail to): deep gold over a dark
  // halo, so it reads on bright, sunlit water; .userData.gold is the ring a mode recolours
  function makeRing(inner, outer) {
    const g = new THREE.Group();
    const halo = new THREE.Mesh(new THREE.RingGeometry(inner - 0.7, outer + 0.7, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#140c02", transparent: true, opacity: 0.55, depthWrite: false }));
    const gold = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#d48a0a", transparent: true, opacity: 1, depthWrite: false }));
    gold.position.y = 0.02; g.add(halo, gold); g.userData.gold = gold; g.userData.halo = halo;
    return g;
  }
  function makeLantern(size = 1) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55 * size, 12, 10).scale(1, 1.15, 1), new THREE.MeshBasicMaterial({ color: "#ff5a3c" }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * size, 0.3 * size, 0.18 * size, 10), new THREE.MeshBasicMaterial({ color: "#e8b84d" }));
    cap.position.y = 0.62 * size; const cap2 = cap.clone(); cap2.position.y = -0.62 * size;
    const glow = glowSprite(5.5 * size); g.add(body, cap, cap2, glow); g.userData.glow = glow; return g;
  }
  const roofMats = [], snowMats = [];
  function makeDock(d) {
    const { x, z, inward } = d, g = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 2.4), toon("#8a5a34")); plank.position.set(Math.cos(inward) * 3, 0.45, Math.sin(inward) * 3); plank.rotation.y = -inward; g.add(plank);
    for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 6), toon("#5a3a26")); p.position.set(Math.cos(inward) * (k * 2.6 - 1) + Math.cos(inward + Math.PI / 2) * 1.2 * (k % 2 ? 1 : -1), -0.2, Math.sin(inward) * (k * 2.6 - 1) + Math.sin(inward + Math.PI / 2) * 1.2 * (k % 2 ? 1 : -1)); g.add(p); }
    const hx = -Math.cos(inward) * 8, hz = -Math.sin(inward) * 8;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), toon("#efe1c2")); wall.position.set(hx, 1.9, hz); wall.rotation.y = -inward;
    const rm = toon("#b8352a"); roofMats.push(rm);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.6, 4), rm); roof.position.set(hx, 4.8, hz); roof.rotation.y = -inward + Math.PI / 4;
    const sm = toon("#ffffff", { transparent: true, opacity: 0 }); snowMats.push(sm);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(4.5, 1.2, 4), sm); snow.position.set(hx, 5.7, hz); snow.rotation.y = -inward + Math.PI / 4;
    const lan = makeLantern(0.8); lan.position.set(Math.cos(inward) * 7.6, 2.4, Math.sin(inward) * 7.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 5), toon("#3a2418")); pole.position.set(Math.cos(inward) * 7.6, 1.2, Math.sin(inward) * 7.6);
    g.add(wall, roof, snow, lan, pole); g.position.set(x, 0, z); scene.add(g);
    const tower = new THREE.Group(); tower.position.set(x + hx, 0, z + hz); tower.rotation.y = -inward; scene.add(tower);
    return { x, z, inward, lantern: lan, g, tower, floors: 0, wx: x + Math.cos(inward) * 6.5, wz: z + Math.sin(inward) * 6.5, mesh: {}, roof: rm };
  }
  // the docks, one per seat (rule change 11: spread round the lake, and as many as the match has boats)
  const DOCKS = docks.map(makeDock);
  function rebuildDocks(list) {
    for (const d of DOCKS) { scene.remove(d.g, d.tower); }
    DOCKS.length = 0; roofMats.length = 0; snowMats.length = 0;
    for (const [x, y] of list) DOCKS.push(makeDock({ x, z: y, inward: Math.atan2(-y, -x) }));
    clearNearDocks();
    home.seat = -1;
  }

  function growHouse(d, banked, color) {
    const want = Math.min(world.maxFloors, Math.floor(banked / world.floorFish));
    while (d.floors < want) {
      const k = d.floors++;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2 - k * 0.25, 1.6, 3.4 - k * 0.2), toon("#efe1c2")); wall.position.y = 4.4 + k * 2.1;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8 - k * 0.22, 1, 4), toon(color)); roof.position.y = 5.7 + k * 2.1; roof.rotation.y = Math.PI / 4;
      d.tower.add(wall, roof); ripple(d.tower.position.x, d.tower.position.z, "#e8b84d", 6, 1);
    }
  }
  function resetHouses() { for (const d of DOCKS) { d.tower.clear(); d.floors = 0; } }

  // trees and winter ice that would stand on a dock: hidden when the docks move (setLake)
  const nearDockRecs = [];
  function clearNearDocks() {
    const hit = (x, z) => DOCKS.some((d) => Math.hypot(d.x - x, d.z - z) < 12 || Math.hypot(d.x - Math.cos(d.inward) * 8 - x, d.z - Math.sin(d.inward) * 8 - z) < 8);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const r of nearDockRecs) { r.pos.forEach(([x, z], i) => { if (i < r.mats.length) r.im.setMatrixAt(i, hit(x * lakeK, z * lakeK) ? zero : r.mats[i]); }); r.im.instanceMatrix.needsUpdate = true; }
  }
  // ---- trees: peach and maple (round), willow, pine ----
  const treeMats = { round: toon("#f2a3bf"), willow: toon("#a6d86f"), pine: toon("#2f5a3a"), trunk: toon("#5a3a26") };
  {
    const spots = [];
    while (spots.length < 230) {
      const ad = Math.random() * 360, k = 1.1 + Math.random() * 0.9, [bx, bz] = polarFromOutline(ad), x = bx * k, z = bz * k;
      if (DOCKS.some((d) => Math.hypot(d.x - x, d.z - z) < 14)) continue;
      spots.push([x, z, Math.random()]);
    }
    for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28; spots.push([island.x + Math.cos(a) * 5.5, island.z + Math.sin(a) * 5.5, 0.2]); }
    const kinds = { round: [], willow: [], pine: [] };
    spots.forEach(([x, z, r]) => (r < 0.38 ? kinds.round : r < 0.62 ? kinds.willow : kinds.pine).push([x, z]));
    const o = new THREE.Object3D();
    const geos = { round: new THREE.IcosahedronGeometry(2.4, 0), willow: new THREE.ConeGeometry(2.6, 5.6, 7), pine: new THREE.ConeGeometry(1.8, 5.4, 6) };
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.32, 2, 5), treeMats.trunk, spots.length); let ti = 0;
    const trunkRec = { im: trunks, pos: [], mats: [] }; nearDockRecs.push(trunkRec);
    for (const [kind, list] of Object.entries(kinds)) {
      const im = new THREE.InstancedMesh(geos[kind], treeMats[kind], list.length);
      const rec = { im, pos: list, mats: [] }; nearDockRecs.push(rec);
      list.forEach(([x, z], i) => { const s = 0.75 + Math.random() * 0.6; o.position.set(x, 0.3 + (kind === "pine" ? 4.2 : kind === "willow" ? 4.4 : 3.8) * s, z); o.scale.set(s, s * (kind === "round" ? 0.85 : 1), s); o.rotation.set(0, Math.random() * 3, kind === "willow" ? Math.PI : 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); rec.mats.push(o.matrix.clone());
        o.position.y = 1.2 * s; o.scale.setScalar(s); o.rotation.set(0, 0, 0); o.updateMatrix(); trunks.setMatrixAt(ti++, o.matrix); trunkRec.pos.push([x, z]); trunkRec.mats.push(o.matrix.clone()); });
      lakeG.add(im);
    }
    trunks.count = ti; lakeG.add(trunks);
  }

  // ---- the reed bed and the lotus pond ----
  const reedMat = toon("#6f9a3e");
  if (zones.reeds) {
    const n = 520, im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.14, 3.4, 4), reedMat, n), o = new THREE.Object3D(); let i = 0, tries = 0;
    while (i < n && tries < n * 6) { tries++; const [x, z] = nearZone("reeds", 1.05); if (nr(x, z) > 0.99) continue; const s = 0.6 + Math.random() * 0.8; o.position.set(x, 1.2 * s, z); o.scale.set(1, s, 1); o.rotation.set(Math.random() * 0.2 - 0.1, 0, Math.random() * 0.2 - 0.1); o.updateMatrix(); im.setMatrixAt(i++, o.matrix); }
    im.count = i; lakeG.add(im);
  }
  const lotusLeafMat = toon("#3f8f45"), lotusFlowerMat = toon("#f29ab8");
  const lotusFlowers = new THREE.Group(); lakeG.add(lotusFlowers);
  const lotusLeaves = zones.lotus ? (() => {
    const n = 90, im = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), lotusLeafMat, n), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { const [x, z] = nearZone("lotus", 1); o.position.set(x, 0.2, z); o.scale.setScalar(0.8 + Math.random() * 1.1); o.rotation.y = Math.random() * 6; o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      if (i % 3 === 0) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 6), lotusFlowerMat); f.position.set(x + 0.4, 0.7, z); lotusFlowers.add(f); } }
    lakeG.add(im); return im;
  })() : null;

  // ---- winter: ice along the shore, open water at every dock ----
  const iceMat = new THREE.MeshBasicMaterial({ color: "#e6f2f7", transparent: true, opacity: 0.85 });
  const ice = (() => {
    const plates = [];
    for (let k = 0; k < 2600 && plates.length < 760; k++) { const x = (Math.random() * 2 - 1) * LX * 1.1, z = (Math.random() * 2 - 1) * LY * 1.1, n = nr(x, z); if (n < world.iceK || n > 1.0) continue; if (DOCKS.some((d) => Math.hypot(d.wx - x, d.wz - z) < 13)) continue; plates.push([x, z]); }
    const im = new THREE.InstancedMesh(new THREE.CircleGeometry(2.6, 6).rotateX(-Math.PI / 2), iceMat, plates.length), o = new THREE.Object3D();
    const rec = { im, pos: plates, mats: [] }; nearDockRecs.push(rec);
    plates.forEach(([x, z], i) => { o.position.set(x, 0.22, z); o.scale.setScalar(0.8 + Math.random() * 0.6); o.rotation.y = Math.random() * 6; o.updateMatrix(); im.setMatrixAt(i, o.matrix); rec.mats.push(o.matrix.clone()); });
    im.visible = false; lakeG.add(im); return im;
  })();
  const iceBlocks = (x, z) => seasonIx === 3 && nr(x, z) > world.iceK && !DOCKS.some((d) => Math.hypot(d.wx - x, d.wz - z) < world.iceDockOpen * lakeK);

  // ---- falling things: petals, leaves, snow (none in summer) ----
  const PART_N = 420;
  const partGeo = new THREE.BufferGeometry(); const partPos = new Float32Array(PART_N * 3), partVel = new Float32Array(PART_N * 3);
  partGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
  const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const partMat = new THREE.PointsMaterial({ size: 1.1, map: dotTex, color: "#f6b8cc", transparent: true, opacity: 0.95, depthWrite: false, alphaTest: 0.05 });
  const parts = new THREE.Points(partGeo, partMat); parts.frustumCulled = false; scene.add(parts);
  function resetPart(i, cx, cz, top) { partPos[i * 3] = cx + (Math.random() * 2 - 1) * 90; partPos[i * 3 + 1] = top ? 30 + Math.random() * 10 : Math.random() * 40; partPos[i * 3 + 2] = cz + (Math.random() * 2 - 1) * 70; partVel[i * 3] = Math.random() * 2 - 1; partVel[i * 3 + 1] = -(1.5 + Math.random() * 2); partVel[i * 3 + 2] = Math.random() * 2 - 1; }
  for (let i = 0; i < PART_N; i++) resetPart(i, 0, 0, false);
  function updateParts(dt, cx, cz, tt) {
    const kind = SEASONS[seasonIx].part; parts.visible = kind !== "none" || night > 0.5;
    if (!parts.visible) return;
    const fire = kind === "none";
    for (let i = 0; i < PART_N; i++) {
      const s = kind === "snow" ? 0.7 : kind === "leaf" ? 1 : 1.2;
      partPos[i * 3] += (partVel[i * 3] + Math.sin(tt + i) * (kind === "snow" ? 0.4 : 1.2)) * dt * s;
      partPos[i * 3 + 1] += (fire ? Math.sin(tt * 2 + i) * 0.6 : partVel[i * 3 + 1] * (kind === "snow" ? 0.8 : 0.55)) * dt;
      partPos[i * 3 + 2] += partVel[i * 3 + 2] * dt * s;
      if (fire && partPos[i * 3 + 1] > 6) partPos[i * 3 + 1] = 1;
      if (partPos[i * 3 + 1] < 0 || Math.abs(partPos[i * 3] - cx) > 100 || Math.abs(partPos[i * 3 + 2] - cz) > 80) { resetPart(i, cx, cz, !fire); if (fire) partPos[i * 3 + 1] = 1 + Math.random() * 4; }
    }
    partGeo.attributes.position.needsUpdate = true;
  }

  // ---- seasons and night, blended every frame ----
  const C = (h) => new THREE.Color(h), tmpC = new THREE.Color();
  const cur = { top: C("#6f8fc9"), mid: C("#f0c2c6"), low: C("#fde4cc"), fog: C("#cdbfd0"), hemi: C("#ffe6e0"), ground: C("#7aa35a"), round: C("#f2a3bf"), willow: C("#a6d86f"), pine: C("#2f5a3a"), deep: C("#195a66"), shallow: C("#4aa596"), bank: C("#cfae76"), sun: 1.35 };
  let snowAmt = 0;
  function setSeason(i, instant = false) {
    seasonIx = ((i % 4) + 4) % 4; const S = SEASONS[seasonIx];
    ice.visible = seasonIx === 3; if (lotusFlowers) lotusFlowers.visible = seasonIx === 1; if (lotusLeaves) lotusLeaves.visible = seasonIx !== 3;
    lotusLeafMat.color.set(seasonIx === 2 ? "#8a7a3a" : "#3f8f45"); reedMat.color.set(seasonIx === 2 ? "#c8a24a" : seasonIx === 3 ? "#b7a88a" : seasonIx === 0 ? "#8fbf55" : "#6f9a3e");
    partMat.color.set({ petal: "#f6b8cc", leaf: "#e2742e", snow: "#ffffff", none: "#fff0a0" }[S.part]); partMat.size = S.part === "snow" ? 1.0 : 1.3;
    if (instant) for (const k of Object.keys(cur)) { if (k === "sun") cur.sun = S.sun; else cur[k].set(S[k] ?? cur[k]); }
  }
  function blendWorld(dt) {
    const S = SEASONS[seasonIx], k = Math.min(1, dt * 1.2);
    for (const key of ["top", "mid", "low", "fog", "hemi", "ground", "round", "willow", "pine", "deep", "shallow", "bank"]) cur[key].lerp(tmpC.set(S[key]), k);
    cur.sun += (S.sun - cur.sun) * k;
    night += (nightTarget - night) * Math.min(1, dt * 1.5);
    skyMat.uniforms.top.value.copy(cur.top).lerp(tmpC.set(NIGHT.top), night); skyMat.uniforms.mid.value.copy(cur.mid).lerp(tmpC.set(NIGHT.mid), night); skyMat.uniforms.low.value.copy(cur.low).lerp(tmpC.set(NIGHT.low), night); skyMat.uniforms.night.value = night;
    scene.fog.color.copy(cur.fog).lerp(tmpC.set(NIGHT.fog), night);
    hemi.color.copy(cur.hemi).lerp(tmpC.set(NIGHT.hemi), night); hemi.intensity = 1.25 - night * 0.55; sun.intensity = cur.sun * (1 - night * 0.85);
    groundMat.color.copy(cur.ground); bankMat.color.copy(cur.bank); treeMats.round.color.copy(cur.round); treeMats.willow.color.copy(cur.willow); treeMats.pine.color.copy(cur.pine);
    waterU.deep.value.copy(cur.deep); waterU.shallow.value.copy(cur.shallow); waterU.sky.value.copy(cur.low); waterU.night.value = night;
    snowAmt += ((seasonIx === 3 ? 1 : 0) - snowAmt) * k; snowMats.forEach((m) => { m.opacity = snowAmt * 0.95; });
  }
  setSeason(0, true);

  // ---- boats ----
  const hullShape = (() => { const s = new THREE.Shape(); s.moveTo(-2.3, -1); s.lineTo(1.2, -1); s.quadraticCurveTo(2.6, -0.8, 3.1, 0); s.quadraticCurveTo(2.6, 0.8, 1.2, 1); s.lineTo(-2.3, 1); s.quadraticCurveTo(-2.7, 0, -2.3, -1); return s; })();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 2 }).rotateX(-Math.PI / 2); hullGeo.translate(0, -0.3, 0);
  const outlineMat = new THREE.MeshBasicMaterial({ color: "#1a1016", side: THREE.BackSide });
  function makeBoat(color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, toon("#7b4a2b")); const ol = new THREE.Mesh(hullGeo, outlineMat); ol.scale.setScalar(1.07);
    const band = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.18, bevelEnabled: false }).rotateX(-Math.PI / 2), toon(color)); band.position.y = 0.62; band.scale.set(1.02, 1, 1.04);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.3), toon("#e8d5b0")); cabin.position.set(-1.1, 1.05, 0);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.9, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), toon(color)); roof.position.set(-1.1, 1.5, 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 6), toon("#3a2418")); mast.position.set(0.5, 2.6, 0);
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute([0.55, 4.6, 0, 0.55, 1.1, 0, 2.6, 1.3, 0, 0.55, 4.6, 0, -1.3, 1.6, 0, 0.55, 1.1, 0], 3)); sg.computeVertexNormals();
    const sail = new THREE.Mesh(sg, toon(color, { side: THREE.DoubleSide }));
    const lan = makeLantern(0.55); lan.position.set(0.55, 5.1, 0); lan.visible = false;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 5), new THREE.MeshBasicMaterial({ color: "#ffd34d" })); crown.position.set(0.55, 5.6, 0); crown.visible = false;
    const shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 10), new THREE.MeshBasicMaterial({ color: "#8fe0c9", transparent: true, opacity: 0.18, depthWrite: false })); shield.position.y = 1; shield.visible = false;
    const pile = new THREE.Group();
    for (let i = 0; i < 15; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5).scale(1.6, 0.7, 1), toon(i % 3 ? "#f08a3c" : "#d7dde2")); f.position.set(-0.1 + (i % 4) * 0.5 - 0.8, 0.78 + Math.floor(i / 4) * 0.22, ((i * 7) % 3 - 1) * 0.45); f.rotation.y = i; f.visible = false; pile.add(f); }
    g.add(ol, hull, band, cabin, roof, mast, sail, lan, crown, shield, pile);
    g.userData = { lan, pile, sail, crown, shield };
    scene.add(g); return g;
  }
  const boats = new Map(); // seat -> { mesh, tag, x, z, h, ph, speed, wakeT }
  const tagsEl = stage.querySelector("#tags5");
  function boat(seat, color, label) {
    let b = boats.get(seat);
    if (!b) { const tag = document.createElement("div"); tag.className = "tag3d"; tag.style.setProperty("--c", color); tagsEl?.appendChild(tag); b = { mesh: makeBoat(color), tag, x: 0, z: 0, h: 0, ph: seat * 1.7, speed: 0, wakeT: 0, color }; boats.set(seat, b); }
    b.tag.textContent = label;
    return b;
  }
  function clearBoats() { for (const b of boats.values()) { scene.remove(b.mesh); b.tag.remove(); } boats.clear(); }

  // ---- fish: one instanced mesh; a mode sends positions each frame ----
  function mergeGeos(list) { const pos = [], nor = []; for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return g; }
  const fishGeo = mergeGeos([
    new THREE.SphereGeometry(0.5, 12, 8).scale(1.25, 0.48, 0.4),
    new THREE.ConeGeometry(0.34, 0.6, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.22).translate(-0.82, 0, 0),
    new THREE.ConeGeometry(0.16, 0.34, 3).scale(1.6, 1, 0.2).translate(0.05, 0.3, 0),
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
      dummy.position.set(wx, -0.2 + Math.sin(t * 2.2 + i) * 0.05, wz); dummy.rotation.set(0, -h + Math.sin(t * 9 + i) * 0.18, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); fishMesh.setMatrixAt(i, dummy.matrix);
    }
    fishMesh.count = n; fishMesh.instanceMatrix.needsUpdate = true;
  }
  const koi = new THREE.Group();
  { const b = new THREE.Mesh(fishGeo, new THREE.MeshBasicMaterial({ color: "#ffd34d" })); b.scale.setScalar(2); const gl = glowSprite(9, "#ffd34d"); gl.position.y = 0.4; koi.add(b, gl); koi.position.y = -0.1; koi.visible = false; scene.add(koi); }
  function setKoi(k, t) { koi.visible = !!k; if (k) { const [x, z] = toWorld(k[0], k[1]); koi.position.set(x, -0.1 + Math.sin(t * 3) * 0.1, z); koi.rotation.y = -k[2]; } }

  // ---- things a mode places and moves: simple meshes keyed by id ----
  const props = new Map();
  function prop(id, make) { let p = props.get(id); if (!p) { p = make(); scene.add(p); props.set(id, p); } p.userData.seen = true; return p; }
  function sweepProps() { for (const [id, p] of props) { if (!p.userData.seen) { scene.remove(p); props.delete(id); } p.userData.seen = false; } }
  function clearProps() { for (const p of props.values()) scene.remove(p); props.clear(); }

  // ---- small labels pinned to points on the water (sim units) ----
  const labels = new Map();
  function setLabels(list) {
    const seen = new Set();
    for (const [id, x, y, text, cls] of list) {
      let el = labels.get(id);
      if (!el) { el = document.createElement("div"); el.className = "pin"; tagsEl?.appendChild(el); labels.set(id, el); }
      el.textContent = text; el.className = `pin ${cls ?? ""}`; el.dataset.x = x; el.dataset.y = y; seen.add(id);
    }
    for (const [id, el] of labels) if (!seen.has(id)) { el.remove(); labels.delete(id); }
  }

  // ---- effects: ripples, net drops, wakes ----
  const fx = [];
  function ripple(x, y, color = "#f5ead6", size = 4, life = 1.2) {
    const [wx, wz] = toWorld(x, y);
    const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.position.set(wx, 0.12, wz); scene.add(m); fx.push({ m, t: 0, life, size, kind: "ripple" });
  }
  const netGridGeo = (() => { const p = []; for (let i = -4; i <= 4; i++) { const k = i / 4, w = Math.sqrt(1 - k * k); p.push(k, 0, -w, k, 0, w, -w, 0, k, w, 0, k); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return g; })();
  function netDrop(x, y, r, color, life = 1.1) {
    const [wx, wz] = toWorld(x, y);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#f5ead6", transparent: true, depthWrite: false }));
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
    const grid = new THREE.LineSegments(netGridGeo, new THREE.LineBasicMaterial({ color: "#f5ead6", transparent: true, opacity: 0.55 }));
    g.add(ring, mesh, grid); g.position.set(wx, 0.14, wz); scene.add(g); fx.push({ m: g, t: 0, life, size: r, kind: "net" });
  }
  const wakeGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
  function wake(wx, wz, s = 1) { const m = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: "#eaf6f2", transparent: true, opacity: 0.35, depthWrite: false })); m.position.set(wx, 0.1, wz); scene.add(m); fx.push({ m, t: 0, life: 1.4, size: s, kind: "wake" }); }
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i]; e.t += dt; const k = e.t / e.life;
      if (e.kind === "ripple") { e.m.scale.setScalar(e.size * (0.2 + k)); e.m.material.opacity = (1 - k) * 0.9; }
      if (e.kind === "wake") { e.m.scale.set(0.5 + k * 1.6, 1, 0.5 + k * 1.6); e.m.material.opacity = (1 - k) * 0.3; }
      if (e.kind === "net") { const open = Math.min(1, e.t / 0.22), close = Math.max(0, (e.t - e.life * 0.5) / (e.life * 0.5)); e.m.scale.setScalar(e.size * open * (1 - close * 0.8)); e.m.position.y = 0.14 - close * 0.5; e.m.children.forEach((c) => { c.material.opacity = (c.material.userData.o ??= c.material.opacity) * (1 - close); }); }
      if (k >= 1) { scene.remove(e.m); e.m.traverse?.((o) => { if (o.material) o.material.dispose(); }); fx.splice(i, 1); }
    }
  }
  const floatsEl = stage.querySelector("#floats5");
  const pv = new THREE.Vector3();
  function floatText(x, y, text, color = "#f5ead6", height = 3) {
    const [wx, wz] = toWorld(x, y);
    pv.set(wx, height, wz).project(camera); if (pv.z > 1 || !floatsEl) return;
    const el = document.createElement("div"); el.className = "float"; el.textContent = text; el.style.color = color;
    el.style.transform = `translate(${(pv.x * 0.5 + 0.5) * stage.clientWidth}px, ${(-pv.y * 0.5 + 0.5) * stage.clientHeight}px) translate(-50%, -100%)`;
    floatsEl.appendChild(el); setTimeout(() => el.remove(), 1400);
  }

  // ---- camera (rule change 11, Ava: "let people set it themselves, with a good default; more 3D") ----
  // While you sail ("follow") the camera follows your own boat from low down, so the lake reads as a place in
  // 3D and your boat is always in the middle; it eases after the boat and does not swing ahead of it (on the
  // 0.7 lake a camera that did made "my own boat not do what I tell it"). You can zoom (wheel, pinch, + and -),
  // turn it a quarter at a time, or switch to the whole lake; the page remembers your choice. Boards,
  // meetings and the ceremony ("overview") show the whole lake, turned a quarter on a tall phone so the lake's
  // long side runs up the screen.
  const cam = { mode: "overview", x: 0, z: 4, dist: 120, target: null, orbit: 0, yaw: 0, pitch: null };
  const camPos = new THREE.Vector3();
  const PITCH = 1.05, PITCH_PLAY = 0.92, PITCH_FOLLOW = 0.74;
  const tall = () => stage.clientHeight > stage.clientWidth * 1.1;
  // your settings: zoom (1 = the default), a quarter-turn count, and whether you want the whole lake while sailing
  const user = { zoom: 1, turn: 0, whole: false };
  try { Object.assign(user, JSON.parse(localStorage.getItem("play-camera") ?? "{}")); } catch {}
  user.zoom = Math.max(0.55, Math.min(2.4, Number(user.zoom) || 1)); user.turn = ((Math.round(Number(user.turn) || 0) % 4) + 4) % 4; user.whole = !!user.whole;
  const saveUser = () => { try { localStorage.setItem("play-camera", JSON.stringify(user)); } catch {} };
  const following = () => cam.mode === "follow" && !user.whole && !!cam.target;
  const yawFor = () => (following() ? (user.turn * Math.PI) / 2 : (tall() ? Math.PI / 2 : 0) + (cam.mode === "follow" ? (user.turn * Math.PI) / 2 : 0));
  const pitchFor = (mode) => (mode === "follow" ? PITCH_PLAY : PITCH) + (tall() ? 0.12 : 0);
  // how much water the follow camera shows across the screen at zoom 1: a boat (about 6 long) is a sixth of
  // an upright phone's width
  function viewSpan() { const w = stage.clientWidth, h = stage.clientHeight; return (w < 700 ? (h > w ? 38 : 56) : 74) * user.zoom; }
  function distForSpan(span) { const aspect = (stage.clientWidth || 1) / (stage.clientHeight || 1), hf = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * aspect); return span / 2 / Math.tan(hf / 2); }
  const fitDist = { follow: 160, overview: 160 };
  // The whole lake is fitted into the part of the screen the HUD leaves free: the top bar (and on a phone the
  // strip under it), the pads at the bottom, and on a wide screen the HUD's column on the right. A view
  // offset moves the picture so the lake (or your boat) sits in the middle of that space.
  let free = { t: 0, b: 0, r: 0 };
  function freeArea() {
    const sr = stage.getBoundingClientRect(), W = sr.width, H = sr.height, out = { t: 0, b: 0, r: 0 };
    const vis = (e) => { if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
    const bar = vis(document.getElementById("topbar")); if (bar) out.t = bar.bottom - sr.top;
    const hud = vis(document.getElementById("hud"));
    if (hud && W >= 900 && hud.left - sr.left > W * 0.55 && hud.height > 40) out.r = sr.right - hud.left + 12;
    for (const pads of stage.querySelectorAll(".pads")) {
      const r = vis(pads); if (!r || r.top - sr.top < H * 0.5 || (out.r && r.left - sr.left > W * 0.55)) continue;
      if (r.width > W * 0.55) out.b = Math.max(out.b, sr.bottom - r.top); // across the bottom
      else if (r.left - sr.left > W * 0.4) out.r = Math.max(out.r, sr.right - r.left + 8); // in the bottom-right corner (a phone on its side)
    }
    // on a phone the HUD's first card is a strip across the top, under the bar
    if (hud && W < 900) { const card = vis(hud.firstElementChild); if (card && card.width > W * 0.4 && card.top - sr.top < H * 0.3) out.t = Math.max(out.t, card.bottom - sr.top); }
    for (const k of ["t", "b", "r"]) out[k] = Math.round(Math.min(out[k], (k === "r" ? W : H) * 0.45));
    return out;
  }
  function fitOverview() {
    const W = stage.clientWidth || 1, H = stage.clientHeight || 1;
    free = freeArea();
    camera.aspect = W / H;
    const ox = free.r / 2, oy = (free.b - free.t) / 2;
    if (ox || oy) camera.setViewOffset(W, H, ox, oy, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const right = 0.97 - (2 * free.r) / W, top = 0.97 - (2 * free.t) / H, bottom = -0.97 + (2 * free.b) / H;
    const pts = outlineBankW.map(([x, z]) => new THREE.Vector3(x * lakeK, 0, z * lakeK));
    const saved = cam.mode;
    for (const mode of ["follow", "overview"]) {
      cam.mode = mode === "follow" ? "follow" : "overview";
      let lo = 20, hi = 1400;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2; placeCam(0, 4 * lakeK, mid, pitchFor(mode), cam.mode === "follow" ? ((tall() ? Math.PI / 2 : 0) + (user.turn * Math.PI) / 2) : yawFor()); camera.updateMatrixWorld();
        const ok = pts.every((p) => { const q = p.clone().project(camera); return q.x > -0.97 && q.x < right && q.y < top && q.y > bottom; });
        if (ok) hi = mid; else lo = mid;
      }
      fitDist[mode] = hi;
    }
    cam.mode = saved;
  }
  // the HUD changes once a match starts: fit again when the space it leaves changes
  const refitT = setInterval(() => { const f = freeArea(); if (f.t !== free.t || f.b !== free.b || f.r !== free.r) fitOverview(); }, 700);
  // the camera looks at (x, z) from dist away, tilted pitch above the water, from the south (yaw 0), the west (yaw pi/2), ...
  function placeCam(x, z, dist, pitch = PITCH, yaw = 0) {
    const h = Math.cos(pitch) * dist;
    camera.position.set(x - Math.sin(yaw) * h, Math.sin(pitch) * dist, z + Math.cos(yaw) * h); camera.up.set(0, 1, 0); camera.lookAt(x, 0, z);
  }
  let shakeA = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angTo = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a));
  function updateCamera(dt, tt) {
    shakeA *= Math.pow(0.02, dt); const sx = (Math.random() - 0.5) * shakeA, sz = (Math.random() - 0.5) * shakeA;
    if (cam.mode === "orbit") {
      cam.orbit += dt * 0.08; const d = fitDist.overview * 0.78; camera.position.set(Math.cos(cam.orbit) * d * 0.62, d * 0.6, Math.sin(cam.orbit) * d * 0.62 + 10); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 4);
      return;
    }
    const k = 1 - Math.exp(-dt * 3), ky = 1 - Math.exp(-dt * 5);
    let wantX = 0, wantZ = 4 * lakeK, wantD, wantP;
    if (following()) {
      const b = cam.target, own = [...boats.values()].find((x) => Math.hypot(x.x - b.x, x.z - b.z) < 3); // the drawn (smoothed) boat, if it is there
      const tx = own ? own.x : b.x, tz = own ? own.z : b.z;
      wantX = clamp(tx, -LX * 0.85, LX * 0.85); wantZ = clamp(tz, -LY * 0.85, LY * 0.85);
      wantD = distForSpan(viewSpan()); wantP = PITCH_FOLLOW + (tall() ? 0.08 : 0);
    } else { const mode = cam.mode === "follow" ? "follow" : "overview"; wantD = fitDist[mode]; wantP = pitchFor(mode); }
    cam.x += (wantX - cam.x) * k; cam.z += (wantZ - cam.z) * k;
    cam.dist += (wantD - cam.dist) * Math.min(1, dt * 2.5); cam.pitch = (cam.pitch ?? wantP) + (wantP - (cam.pitch ?? wantP)) * Math.min(1, dt * 2.5);
    const yaw = angTo(cam.yaw, yawFor()); cam.yaw += (yaw - cam.yaw) * ky;
    placeCam(cam.x + sx, cam.z + sz, cam.dist, cam.pitch, cam.yaw);
  }
  function setCameraMode(mode, target = null) { cam.mode = mode; cam.target = target; }
  // your controls: the wheel and the + / - keys zoom; the page's camera buttons zoom, turn and show the whole lake
  function zoomBy(f) { user.zoom = clamp(user.zoom * f, 0.55, 2.4); if (user.whole) user.whole = false; saveUser(); }
  const onWheel = (e) => { if (cam.mode !== "follow") return; e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12); };
  canvas.addEventListener("wheel", onWheel, { passive: false });
  const onZoomKey = (e) => { if (e.target?.closest?.("input, textarea")) return; if (e.code === "Equal" || e.code === "NumpadAdd") zoomBy(1 / 1.15); if (e.code === "Minus" || e.code === "NumpadSubtract") zoomBy(1.15); };
  addEventListener("keydown", onZoomKey);
  const camBtn = (id, f) => { const el = document.getElementById(id); if (el) el.addEventListener("click", (e) => { e.preventDefault(); f(); el.blur(); }); };
  camBtn("cam-in", () => zoomBy(1 / 1.25)); camBtn("cam-out", () => zoomBy(1.25));
  camBtn("cam-turn", () => { user.turn = (user.turn + 1) % 4; saveUser(); fitOverview(); });
  camBtn("cam-whole", () => { user.whole = !user.whole; saveUser(); markWhole(); });
  const markWhole = () => document.getElementById("cam-whole")?.setAttribute("aria-pressed", String(user.whole));
  markWhole();
  function onResize() { if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(stage.clientWidth, stage.clientHeight, false); } camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix(); fitOverview(); }
  new ResizeObserver(onResize).observe(stage);

  // ---- the minimap ----
  // the minimap is not shown since rule change 10: the whole lake is always on the screen
  const miniEl = opts.minimap ?? stage.querySelector("#mini");
  if (miniEl) miniEl.hidden = true;
  const mctx = miniEl?.getContext("2d");
  function drawMinimap(reveal = () => true) {
    if (!mctx || miniEl.hidden) return;
    const w = (miniEl.width = miniEl.clientWidth * devicePixelRatio), h = (miniEl.height = miniEl.clientHeight * devicePixelRatio);
    const mx = (x) => w / 2 + (x / (LX * 1.18)) * (w / 2), mz = (z) => h / 2 + (z / (LY * 1.22)) * (h / 2);
    mctx.clearRect(0, 0, w, h);
    mctx.beginPath(); outlineW.forEach(([x, z], i) => (i ? mctx.lineTo(mx(x), mz(z)) : mctx.moveTo(mx(x), mz(z)))); mctx.closePath();
    mctx.fillStyle = seasonIx === 3 ? "#5c8f98" : "#2a7f80"; mctx.fill(); mctx.lineWidth = 2; mctx.strokeStyle = "#d9c08a"; mctx.stroke();
    mctx.fillStyle = "#8a8a50"; mctx.beginPath(); mctx.arc(mx(island.x), mz(island.z), island.r * (w / 300) * 1.5, 0, 6.28); mctx.fill();
    for (const d of DOCKS) { mctx.fillStyle = "#efe1c2"; mctx.beginPath(); mctx.arc(mx(d.wx), mz(d.wz), 3, 0, 6.28); mctx.fill(); }
    // a hidden boat (Who's Poaching: outside your lantern) is not on the minimap either
    for (const b of boats.values()) { if (!reveal(b) || !b.mesh.visible) continue; mctx.fillStyle = b.color ?? "#f5ead6"; mctx.beginPath(); mctx.arc(mx(b.x), mz(b.z), 4, 0, 6.28); mctx.fill(); }
  }

  // ---- input: keys, a thumb stick on phones, tap/click on the water ----
  const keys = new Set();
  const onKey = (e) => { if (e.target?.closest?.("input, textarea")) return; keys.add(e.code); };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();
  addEventListener("keydown", onKey); addEventListener("keyup", onKeyUp); addEventListener("blur", onBlur);
  // the direction you want, on the water: "up" on the screen (W, the arrow, the stick pushed up) is away from
  // the camera, whichever way the camera faces (on a tall phone it faces east, rule change 10)
  const camFwd = new THREE.Vector3();
  function screenToWater(sx, sy) {
    camera.getWorldDirection(camFwd); camFwd.y = 0; if (camFwd.lengthSq() < 1e-9) camFwd.set(0, 0, -1); camFwd.normalize();
    const rx = -camFwd.z, rz = camFwd.x; // the screen's right, on the water
    const x = rx * sx - camFwd.x * sy, z = rz * sx - camFwd.z * sy, L = Math.hypot(x, z) || 1;
    return { x: x / L, z: z / L };
  }
  function wantDir() {
    let x = 0, y = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1; if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1; if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (x || y) return { ...screenToWater(x, y), mag: 1 };
    const j = joy; if (j) { const L = Math.hypot(j.dx, j.dy); if (L > 10) return { ...screenToWater(j.dx, j.dy), mag: Math.min(1, L / 52) }; }
    return null;
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function screenToSim(clientX, clientY) {
    const r = canvas.getBoundingClientRect(); ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null;
    return toSim(hit.x, hit.z);
  }
  // the thumb stick: appears under the touch that started it, on the left half of the screen (P7)
  const joyEl = document.createElement("div"); joyEl.className = "joy"; joyEl.innerHTML = "<i></i>"; joyEl.hidden = true; stage.appendChild(joyEl);
  let joy = null, ptr = null, onTap = null, steerMode = true;
  // two fingers on the water pinch to zoom (the stick, if one was showing, goes away)
  const touches = new Map(); let pinch = null;
  const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  function onPointerDown(e) {
    if (e.pointerType !== "mouse") touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { pinch = { d0: spread(), z0: user.zoom }; joy = null; joyEl.hidden = true; ptr = null; return; }
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, touch: e.pointerType !== "mouse" };
    if (steerMode && ptr.touch && e.clientX < stage.clientWidth * 0.6) { joy = { dx: 0, dy: 0 }; joyEl.style.left = `${e.clientX}px`; joyEl.style.top = `${e.clientY}px`; joyEl.hidden = false; joyEl.firstElementChild.style.transform = ""; }
    else if (!ptr.touch) { const w = screenToSim(e.clientX, e.clientY); if (w) onTap?.(w[0], w[1], e); }
  }
  function onPointerMove(e) {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) { user.zoom = clamp(pinch.z0 * (pinch.d0 / spread()), 0.55, 2.4); user.whole = false; return; }
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; if (Math.hypot(dx, dy) > 12) ptr.moved = true;
    if (joy) { const L = Math.hypot(dx, dy), k = Math.min(1, 52 / (L || 1)); joy.dx = dx; joy.dy = dy; joyEl.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`; }
  }
  function onPointerEnd(e) {
    touches.delete(e.pointerId); if (pinch) { if (touches.size < 2) { pinch = null; saveUser(); markWhole(); } return; }
    if (!ptr || e.pointerId !== ptr.id) return;
    if (ptr.touch && !ptr.moved && performance.now() - ptr.t < 300) { const w = screenToSim(e.clientX, e.clientY); if (w) onTap?.(w[0], w[1], e); }
    joy = null; joyEl.hidden = true; ptr = null;
  }
  canvas.addEventListener("pointerdown", onPointerDown); addEventListener("pointermove", onPointerMove); addEventListener("pointerup", onPointerEnd); addEventListener("pointercancel", onPointerEnd);

  // ---- an arrow that points at a place on the lake (DESIGN.md's teaching coach) ----
  const arrowEl = document.createElement("div"); arrowEl.className = "world-arrow"; arrowEl.hidden = true;
  arrowEl.innerHTML = `<svg viewBox="0 0 44 44"><path d="M22 40 L8 16 L18 16 L18 4 L26 4 L26 16 L36 16 Z" fill="currentColor" stroke="#120e18" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  stage.appendChild(arrowEl);
  let arrowAt = null;
  function pointAt(x, y) { arrowAt = x === null ? null : toWorld(x, y); arrowEl.hidden = !arrowAt; }
  function updateArrow(tt) {
    if (!arrowAt) return;
    const [ax, az] = arrowAt, W2 = stage.clientWidth, H2 = stage.clientHeight; pv.set(ax, 3, az).project(camera);
    let sx = (pv.x * 0.5 + 0.5) * W2, sy = (-pv.y * 0.5 + 0.5) * H2; const behind = pv.z > 1; const m = 50;
    const on = !behind && sx > m && sx < W2 - m && sy > m + 60 && sy < H2 - m - 100;
    if (on) arrowEl.style.transform = `translate(${sx}px, ${sy - 30 - Math.abs(Math.sin(tt * 4)) * 10}px)`;
    else { const cx = W2 / 2, cy = H2 / 2; let dx = sx - cx, dy = sy - cy; if (behind) { dx = -dx; dy = -dy; } const k = Math.min((W2 / 2 - m) / Math.abs(dx || 1), (H2 / 2 - m - 70) / Math.abs(dy || 1)); const ex = cx + dx * k, ey = cy + dy * k; const a = (Math.atan2(dy, dx) * 180) / Math.PI - 90; arrowEl.style.transform = `translate(${ex}px, ${ey}px) rotate(${a}deg)`; }
  }

  // ---- place a boat from two frames (smoothly between them) and draw its state ----
  function drawBoat(b, x, y, h, t, state = {}) {
    let [wx, wz] = toWorld(x, y);
    // the server's frames come 10 a second and not always on time: the boat eases towards where they put it,
    // so a late frame slows it a little instead of stopping it and then making it jump (Ava: "not smooth")
    const now = performance.now(), dts = Math.min(0.1, Math.max(0, (now - (b.drawnAt ?? now)) / 1000)); b.drawnAt = now;
    if (b.sx === undefined || Math.hypot(wx - b.sx, wz - b.sz) > 12) { b.sx = wx; b.sz = wz; b.sh = h; }
    else { const a = 1 - Math.exp(-dts * 16); b.sx += (wx - b.sx) * a; b.sz += (wz - b.sz) * a; b.sh += Math.atan2(Math.sin(h - b.sh), Math.cos(h - b.sh)) * a; }
    wx = b.sx; wz = b.sz; h = b.sh;
    const moved = Math.hypot(wx - b.x, wz - b.z);
    b.speed = b.speed * 0.8 + moved * 20 * 0.2;
    b.x = wx; b.z = wz; b.h = h;
    const m = b.mesh; m.visible = state.visible !== false;
    m.position.set(wx, Math.sin(t * 2 + b.ph) * 0.1, wz); m.rotation.set(0, -h, 0); m.rotateX(Math.sin(t * 1.6 + b.ph) * 0.05); m.rotateZ(Math.sin(t * 1.3 + b.ph) * 0.03);
    const pile = m.userData.pile.children; for (let i = 0; i < pile.length; i++) pile[i].visible = i < (state.hold ?? 0);
    m.userData.lan.visible = night > 0.4 || !!state.lantern; m.userData.lan.userData.glow.material.opacity = Math.max(night, state.lantern ? 1 : 0);
    m.userData.crown.visible = !!state.crown; m.userData.crown.rotation.y = t * 2;
    m.userData.shield.visible = !!state.shield;
    b.wakeT -= 1 / 60; if (b.speed > 1.2 && b.wakeT <= 0) { b.wakeT = state.dash ? 0.05 : 0.11; wake(wx - Math.cos(h) * 2.4, wz - Math.sin(h) * 2.4, state.dash ? 1.6 : 1); }
  }

  // ---- setDocks: tints each dock's lantern for the seat using it (world.js's API, so a mode need not care which world is live) ----
  // each seat's dock takes its colour: the roof, so a player can tell which house is whose
  // (a mode lists them in seat order, and seat i has dock i, as on the server; kept for after setLake moves them)
  let dockColors = [];
  function setDocks(list) {
    dockColors = list.map((d) => d.color);
    list.forEach((d, i) => { const dk = DOCKS[i]; if (dk && d.color) { dk.color = d.color; dk.roof?.color.set(d.color); } });
  }
  // your home (Ava: "I cannot find my own home"): a tall beam of light in your colour over your dock, a
  // lantern, and a label; an arrow at the screen's edge when it is off screen (a mode turns that on)
  const home = { seat: -1, beam: null, tag: null };
  function setHome(seat, color, label) {
    if (seat === null || seat === undefined || seat < 0 || !DOCKS.length) { if (home.beam) home.beam.visible = false; if (home.tag) home.tag.hidden = true; home.seat = -1; return; }
    const d = DOCKS[seat % DOCKS.length];
    if (!home.beam) {
      home.beam = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 11, 14, 1, true), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 5.5; const lan = makeLantern(1.3); lan.position.y = 4.2; const ring = makeRing(2.2, 3.2); ring.position.y = 0.2;
      home.beam.add(beam, lan, ring); home.beam.userData = { beam, ring }; scene.add(home.beam);
      home.tag = document.createElement("div"); home.tag.className = "tag3d home"; tagsEl?.appendChild(home.tag);
    }
    home.seat = seat; home.beam.visible = true; home.tag.hidden = false;
    home.beam.position.set(d.wx, 0, d.wz);
    home.beam.userData.beam.material.color.set(color ?? "#ffd34d"); home.beam.userData.ring.userData.gold.material.color.set(color ?? "#ffd34d");
    home.tag.textContent = label ?? ""; home.tag.style.setProperty("--c", color ?? "#ffd34d");
  }
  function updateHome(tt) {
    if (!home.beam || !home.beam.visible) return;
    home.beam.userData.beam.material.opacity = 0.2 + Math.sin(tt * 2.4) * 0.07;
    const W = stage.clientWidth, H = stage.clientHeight; pv.set(home.beam.position.x, 9, home.beam.position.z).project(camera);
    const vis = pv.z < 1 && Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05; home.tag.style.display = vis ? "block" : "none";
    if (vis) home.tag.style.transform = `translate(${(pv.x * 0.5 + 0.5) * W}px, ${(-pv.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
  }
  // the match's lake (a frame's lk: its size against the page's lake, and its docks): the scene is scaled to
  // it and the docks are put where the match has them. Called with every frame; does nothing if it is the same.
  let lakeSig = "";
  function setLake(meta) {
    if (!meta || !Array.isArray(meta.docks)) return;
    const sig = `${meta.k}|${meta.docks.map((d) => d.join(",")).join(";")}`; if (sig === lakeSig) return; lakeSig = sig;
    lakeK = Number(meta.k) || 1; lakeG.scale.setScalar(lakeK); waterU.lakeK.value = lakeK;
    LX = world.lake.x * lakeK; LY = world.lake.y * lakeK;
    Object.assign(island, { x: islandB.x * lakeK, z: islandB.z * lakeK, r: islandB.r * lakeK });
    for (const [id, z] of Object.entries(zonesB)) Object.assign(zones[id], { x: z.x * lakeK, z: z.z * lakeK, r: z.r * lakeK });
    const seat = home.seat, hc = home.beam?.userData.beam.material.color.getStyle(), ht = home.tag?.textContent;
    rebuildDocks(meta.docks);
    dockColors.forEach((c, i) => { const dk = DOCKS[i]; if (dk && c) { dk.color = c; dk.roof?.color.set(c); } });
    if (seat >= 0) setHome(seat, hc, ht);
    fitOverview();
  }

  const lanVec = waterU.lan.value;
  let lanterns = [], onFrame = () => {};
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    blendWorld(dt); skyMat.uniforms.time.value = t; waterU.time.value = t;
    let n = 0;
    for (const d of DOCKS) if (n < LAN_MAX) lanVec[n++].set(d.wx, 0.8, d.wz);
    for (const [x, y, k] of lanterns) { if (n >= LAN_MAX) break; const [wx, wz] = toWorld(x, y); lanVec[n++].set(wx, k, wz); }
    waterU.lanN.value = n;
    for (const d of DOCKS) d.lantern.userData.glow.material.opacity = 0.35 + night * 0.65;
    onFrame(dt, t);
    updateFx(dt); updateCamera(dt, t); updateParts(dt, cam.x, cam.z, t); updateArrow(t); updateHome(t);
    const W = stage.clientWidth, H = stage.clientHeight;
    for (const b of boats.values()) {
      if (!b.mesh.visible) { b.tag.style.display = "none"; continue; }
      pv.set(b.x, 5.6, b.z).project(camera); const vis = pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1;
      b.tag.style.display = vis ? "block" : "none";
      // a name tag stays on screen even when its boat is at the edge (a long name ran past a phone's side)
      if (vis) { const half = (b.tag.offsetWidth || 0) / 2 + 4, x = Math.max(half, Math.min(W - half, (pv.x * 0.5 + 0.5) * W)); b.tag.style.transform = `translate(${x}px, ${(-pv.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`; }
    }
    for (const el of labels.values()) { const [wx, wz] = toWorld(+el.dataset.x, +el.dataset.y); pv.set(wx, 0.6, wz).project(camera); el.style.transform = `translate(${(pv.x * 0.5 + 0.5) * W}px, ${(-pv.y * 0.5 + 0.5) * H}px) translate(-50%, -50%)`; }
    drawMinimap();
    if (renderer) renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  onResize(); requestAnimationFrame(loop);

  // k and tiers are here so a mode never reaches into the page's own boot JSON for them
  return {
    THREE, scene, camera, toon, makeLantern, makeRing, glowSprite, toWorld, toSim, zones, island, docks: DOCKS,
    k: world.k, tiers: world.tiers,
    setSeason, setNight: (v) => { nightTarget = v; }, setLanterns: (l) => { lanterns = l; },
    setDocks, boat, drawBoat, clearBoats, boats, setFish, setKoi, prop, sweepProps, clearProps,
    ripple, netDrop, floatText, setLabels, screenToSim,
    setCameraMode, viewSpan, iceBlocks, growHouse, resetHouses, minimapEl: miniEl, setLake, setHome,
    shoreShare: nr, onFrame: (f) => { onFrame = f; }, pointAt, wantDir,
    setTap: (f) => { onTap = f; }, setSteerMode: (v) => { steerMode = v; },
    shake(a = 0.3) { shakeA = Math.max(shakeA, a); },
    canvas,
    end() {
      clearInterval(refitT); canvas.removeEventListener("wheel", onWheel); removeEventListener("keydown", onZoomKey);
      removeEventListener("keydown", onKey); removeEventListener("keyup", onKeyUp); removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown); removeEventListener("pointermove", onPointerMove); removeEventListener("pointerup", onPointerEnd); removeEventListener("pointercancel", onPointerEnd);
    },
  };
}

// Sound is one page-level thing, not per-world: room.js keeps using
// sound.js's createSound for both worlds (one button, one AudioContext).
