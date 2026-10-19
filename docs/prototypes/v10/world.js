/* ================================================================ the world: one lake, a village, four seasons
   Compass: the camera's home view looks north. x = east, z = south (towards you).
   An angle a puts a point at (cos a, sin a): 0 east, 90 south, 180 west, 270 north. */
const stage = $("#stage"), canvas = $("#gl");
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
catch (e) { stage.insertAdjacentHTML("beforeend", `<div class="fallback">This browser could not start 3D (WebGL). Try another browser.</div>`); }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 1600);
const toonTex = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
toonTex.minFilter = toonTex.magFilter = THREE.NearestFilter; toonTex.needsUpdate = true;
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonTex, ...extra });
const deg = (d) => d * Math.PI / 180;

/* the lake's outline: a lobed oval, about twice the old pond */
const LK = { x: 92, z: 64 };
const shapeR = (a) => 1 + .09 * Math.sin(2 * a + .6) + .06 * Math.sin(3 * a + 2.1) + .035 * Math.sin(5 * a + .3);
const angOf = (x, z) => Math.atan2(z / LK.z, x / LK.x);
const nr = (x, z) => Math.hypot(x / LK.x, z / LK.z) / shapeR(angOf(x, z)); // 0 at the middle, 1 at the shore
const polar = (aDeg, k) => { const a = deg(aDeg), r = shapeR(Math.atan2(Math.sin(a), Math.cos(a))) * k; return [Math.cos(a) * LK.x * r, Math.sin(a) * LK.z * r]; };
const ISLAND = { x: 10, z: -15, r: 7.5 };
const outline = (k = 1, n = 180) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = shapeR(a) * k; p.push([Math.cos(a) * LK.x * r, Math.sin(a) * LK.z * r]); } return p; };

/* the named places */
const ZONES = {
  reeds: { a: 195, k: .78, r: 19, tint: "#5d8a3a" },   // 芦苇荡: the nursery, young fish live here
  lotus: { a: 237, k: .7, r: 16, tint: "#4f8f5a" },    // 荷花塘
  river: { a: 318, k: .86, r: 15, tint: "#3f8fa0" },   // 河口: spring fish come in here
  deep: { x: ISLAND.x, z: ISLAND.z, r: 22, tint: "#0b3340" }, // 深潭 round the island
};
for (const z of Object.values(ZONES)) if (z.a !== undefined) [z.x, z.z] = polar(z.a, z.k);
const BAYS = [ // where people say they were (the meeting's map uses these)
  { id: "north", x: -14, z: -44 }, { id: "east", x: 58, z: -4 }, { id: "south", x: 4, z: 34 }, { id: "west", x: -60, z: 6 },
  { id: "reeds", x: ZONES.reeds.x, z: ZONES.reeds.z }, { id: "lotus", x: ZONES.lotus.x, z: ZONES.lotus.z },
  { id: "river", x: ZONES.river.x, z: ZONES.river.z }, { id: "island", x: ISLAND.x, z: ISLAND.z + 11 },
];
function placeOf(x, z) {
  for (const id of ["reeds", "lotus", "river"]) { const zz = ZONES[id]; if (Math.hypot(x - zz.x, z - zz.z) < zz.r) return id; }
  if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < 20) return "island";
  let best = "south", bd = 1e9; for (const b of BAYS.slice(0, 4)) { const d = Math.hypot(x - b.x, z - b.z); if (d < bd) { bd = d; best = b.id; } } return best;
}
const inZone = (id, x, z) => { const zz = ZONES[id]; return Math.hypot(x - zz.x, z - zz.z) < zz.r; };
function randomWater(maxK = .82, avoidIsland = 11) {
  for (let k = 0; k < 60; k++) { const x = (Math.random() * 2 - 1) * LK.x, z = (Math.random() * 2 - 1) * LK.z; if (nr(x, z) < maxK && Math.hypot(x - ISLAND.x, z - ISLAND.z) > avoidIsland) return [x, z]; }
  return [0, 20];
}
function nearZone(id, spread = 1) { const zz = ZONES[id]; for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * zz.r * spread; const x = zz.x + Math.cos(a) * r, z = zz.z + Math.sin(a) * r; if (nr(x, z) < .93 && Math.hypot(x - ISLAND.x, z - ISLAND.z) > 10) return [x, z]; } return randomWater(); }

/* sky, light and the four seasons */
const SEASONS = [
  { id: "spring", top: "#6f8fc9", mid: "#f0c2c6", low: "#fde4cc", fog: "#cdbfd0", hemi: "#ffe6e0", sun: 1.35, ground: "#7aa35a", round: "#f2a3bf", willow: "#a6d86f", pine: "#2f5a3a", deep: "#195a66", shallow: "#4aa596", bank: "#cfae76", part: "petal" },
  { id: "summer", top: "#3a78cf", mid: "#8cc3ea", low: "#e6f2ee", fog: "#a8c5cf", hemi: "#fff3d6", sun: 1.55, ground: "#5d9a45", round: "#3f8f45", willow: "#5aa24a", pine: "#2a5234", deep: "#0f5060", shallow: "#2e9a8a", bank: "#d1b27a", part: "none" },
  { id: "autumn", top: "#3b3a6b", mid: "#e0985a", low: "#f6c27a", fog: "#b8876e", hemi: "#ffd0a0", sun: 1.45, ground: "#8f8a45", round: "#d9572e", willow: "#d9b33a", pine: "#33553a", deep: "#1b4a55", shallow: "#3d8a7c", bank: "#c99f62", part: "leaf" },
  { id: "winter", top: "#5d6f8a", mid: "#b8c4d4", low: "#e8edf2", fog: "#c9d2dc", hemi: "#e8f0ff", sun: 1.2, ground: "#dfe6ec", round: "#7a6656", willow: "#8a7a5a", pine: "#2f4f45", deep: "#23485a", shallow: "#5c8f98", bank: "#c9c4bc", part: "snow" },
];
const NIGHT = { top: "#05060f", mid: "#141b38", low: "#25294c", fog: "#10142a", hemi: "#5d6fae", sun: .22 };
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

/* water: the lake's outline as a shape, foam along the shore and round the island */
const lakeShape = (() => { const s = new THREE.Shape(); outline(1.003).forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); return s; })();
const LAN_MAX = 12;
const waterU = {
  time: { value: 0 }, night: { value: 0 }, LK: { value: new THREE.Vector2(LK.x, LK.z) }, isl: { value: new THREE.Vector3(ISLAND.x, ISLAND.z, ISLAND.r) },
  deep: { value: new THREE.Color() }, shallow: { value: new THREE.Color() }, sky: { value: new THREE.Color() },
  glowCol: { value: new THREE.Color("#ffb45a") }, lan: { value: Array.from({ length: LAN_MAX }, () => new THREE.Vector3()) }, lanN: { value: 0 },
};
const waterGeo = new THREE.ShapeGeometry(lakeShape, 64).rotateX(-Math.PI / 2);
{ // the shore distance as an attribute, so the shader knows where the foam goes
  const p = waterGeo.attributes.position, e = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); e[i] = Math.max(nr(x, z), 1 - (Math.hypot(x - ISLAND.x, z - ISLAND.z) - ISLAND.r) / 4); }
  waterGeo.setAttribute("edge", new THREE.BufferAttribute(e, 1));
}
const water = new THREE.Mesh(waterGeo, new THREE.ShaderMaterial({
  transparent: true, uniforms: waterU,
  vertexShader: `uniform float time; attribute float edge; varying vec3 wp; varying float ve; void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
    w.y += (sin(w.x * 0.3 + time * 1.1) + sin(w.z * 0.37 - time * 0.8)) * 0.06; wp = w.xyz; ve = edge; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float time, night; uniform vec3 deep, shallow, sky, glowCol, isl; uniform vec3 lan[${LAN_MAX}]; uniform int lanN; varying vec3 wp; varying float ve;
    void main(){
      vec3 c = mix(deep, shallow, smoothstep(0.55, 1.0, ve));
      float di = length(wp.xz - isl.xy); c *= mix(0.72, 1.0, smoothstep(isl.z + 4.0, isl.z + 18.0, di));
      float w = sin(wp.x * 0.55 + time * 0.7 + sin(wp.z * 0.42 + time * 0.4) * 2.0) + sin(wp.z * 0.68 - time * 0.55 + wp.x * 0.2);
      c = mix(c, sky, 0.08 * (1.0 - night));
      c *= 1.0 + smoothstep(0.6, 1.9, w) * 0.06;
      float line = smoothstep(1.6, 1.68, w) - smoothstep(1.7, 1.8, w);
      c += vec3(0.7, 0.9, 0.95) * line * 0.1 * (1.0 - night * 0.5);
      float sp = smoothstep(0.93, 1.0, sin(wp.x * 1.2 + time * 1.6) * sin(wp.z * 1.05 - time * 1.25));
      c += sp * 0.12 * (1.0 - night * 0.7);
      float foam = smoothstep(0.9, 0.995, ve) * (0.65 + 0.35 * sin(time * 1.8 + wp.x * 0.5 + wp.z * 0.4));
      c = mix(c, vec3(0.96, 0.93, 0.86), foam * 0.7);
      vec3 g = vec3(0.0); for (int i = 0; i < ${LAN_MAX}; i++) { if (i >= lanN) break; float d = length(wp.xz - lan[i].xz); g += glowCol * exp(-d * d / 30.0) * lan[i].y; }
      c = c * (1.0 - night * 0.62) + g * night * 0.95;
      gl_FragColor = vec4(c, 0.72 + foam * 0.25); }`,
}));
scene.add(water);
const bed = new THREE.Mesh(new THREE.ShapeGeometry(lakeShape, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#0b2a33" })); bed.position.y = -2.4; scene.add(bed);

/* land: ground with the lake cut out, a sandy bank, far hills in ink-wash layers */
const groundMat = toon("#7aa35a"), bankMat = toon("#cfae76");
{
  const sh = new THREE.Shape(); sh.moveTo(-700, -700); sh.lineTo(700, -700); sh.lineTo(700, 700); sh.lineTo(-700, 700); sh.lineTo(-700, -700);
  const hole = new THREE.Path(); outline(1.0).forEach(([x, z], i) => i ? hole.lineTo(x, -z) : hole.moveTo(x, -z)); sh.holes.push(hole);
  const g = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48).rotateX(-Math.PI / 2), groundMat); g.position.y = .34; scene.add(g);
  const bs = new THREE.Shape(); outline(1.075).forEach(([x, z], i) => i ? bs.lineTo(x, -z) : bs.moveTo(x, -z));
  const bh = new THREE.Path(); outline(1.0).forEach(([x, z], i) => i ? bh.lineTo(x, -z) : bh.moveTo(x, -z)); bs.holes.push(bh);
  const bank = new THREE.Mesh(new THREE.ShapeGeometry(bs, 48).rotateX(-Math.PI / 2), bankMat); bank.position.y = .36; scene.add(bank);
  const layers = [["#4d5f78", 300, 420, 40, 90], ["#6b7d96", 420, 560, 60, 130], ["#8d9cb2", 560, 720, 80, 170]];
  for (const [col, d0, d1, h0, h1] of layers) {
    const mat = new THREE.MeshBasicMaterial({ color: col, fog: true });
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2 + Math.random() * .2, d = d0 + Math.random() * (d1 - d0), h = h0 + Math.random() * (h1 - h0);
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * .9 + 30, h, 6), mat); m.position.set(Math.cos(a) * d, h / 2 - 6, Math.sin(a) * d * .9); m.rotation.y = Math.random() * 3; scene.add(m); }
  }
}

/* the island and its pagoda */
{
  const g = new THREE.Group(); g.position.set(ISLAND.x, 0, ISLAND.z);
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND.r * .8, ISLAND.r, 1.6, 18), toon("#8a8a50")); hill.position.y = .5; g.add(hill);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2), toon("#8b8f94")); rock.position.set(-4, 1.2, 2); g.add(rock);
  for (let k = 0; k < 4; k++) { const s = 3.4 - k * .55; const body = new THREE.Mesh(new THREE.BoxGeometry(s * 1.2, 1.7, s * 1.2), toon("#efe1c2")); body.position.y = 2.2 + k * 2.2; const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 1.25, 1.1, 4), toon("#b8352a")); roof.position.y = 3.4 + k * 2.2; roof.rotation.y = Math.PI / 4; g.add(body, roof); }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.3, 2, 6), toon("#e8b84d")); tip.position.y = 12.4; g.add(tip);
  scene.add(g);
}

/* the river mouth and the stone bridge, north-east */
{
  const a = deg(ZONES.river.a), [sx, sz] = polar(ZONES.river.a, 1.0), dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
  const len = 200, w = 11;
  const rv = new THREE.Mesh(new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#2f7f86" }));
  rv.position.set(sx + dir.x * (len / 2 - 2), .38, sz + dir.y * (len / 2 - 2)); rv.rotation.y = -a; scene.add(rv);
  const bx = sx + dir.x * 14, bz = sz + dir.y * 14;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 1.1, 8, 20, Math.PI), toon("#a9a39a")); arch.position.set(bx, .3, bz); arch.rotation.y = -a + Math.PI / 2 + Math.PI / 2; scene.add(arch);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, .5, 15), toon("#b9b3a8")); deck.position.set(bx, 5.4, bz); deck.rotation.y = -a; scene.add(deck);
}

/* docks and the village (south shore). Up to six fishers; each has a dock and a house. */
const DOCK_ANGLES = [66, 114, 42, 138, 90, 18];
const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,220,150,1)"); g.addColorStop(.35, "rgba(255,170,80,.45)"); g.addColorStop(1, "rgba(255,150,60,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const glowSprite = (s = 6, color = "#ffffff") => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); m.scale.set(s, s, 1); return m; };
function makeLantern(size = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(.55 * size, 12, 10).scale(1, 1.15, 1), new THREE.MeshBasicMaterial({ color: "#ff5a3c" }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.3 * size, .3 * size, .18 * size, 10), new THREE.MeshBasicMaterial({ color: "#e8b84d" }));
  cap.position.y = .62 * size; const cap2 = cap.clone(); cap2.position.y = -.62 * size;
  const glow = glowSprite(5.5 * size); g.add(body, cap, cap2, glow); g.userData.glow = glow; return g;
}
const roofMats = [], snowMats = [];
const DOCKS = DOCK_ANGLES.map((ad) => {
  const [x, z] = polar(ad, 1.0); const inward = Math.atan2(-z, -x);
  const g = new THREE.Group();
  const plank = new THREE.Mesh(new THREE.BoxGeometry(10, .35, 2.4), toon("#8a5a34")); plank.position.set(Math.cos(inward) * 3, .45, Math.sin(inward) * 3); plank.rotation.y = -inward; g.add(plank);
  for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 2.2, 6), toon("#5a3a26")); p.position.set(Math.cos(inward) * (k * 2.6 - 1) + Math.cos(inward + Math.PI / 2) * 1.2 * (k % 2 ? 1 : -1), -.2, Math.sin(inward) * (k * 2.6 - 1) + Math.sin(inward + Math.PI / 2) * 1.2 * (k % 2 ? 1 : -1)); g.add(p); }
  const hx = -Math.cos(inward) * 8, hz = -Math.sin(inward) * 8;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), toon("#efe1c2")); wall.position.set(hx, 1.9, hz); wall.rotation.y = -inward;
  const rm = toon("#b8352a"); roofMats.push(rm);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.6, 4), rm); roof.position.set(hx, 4.8, hz); roof.rotation.y = -inward + Math.PI / 4;
  const sm = toon("#ffffff", { transparent: true, opacity: 0 }); snowMats.push(sm);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(4.5, 1.2, 4), sm); snow.position.set(hx, 5.7, hz); snow.rotation.y = -inward + Math.PI / 4;
  const lan = makeLantern(.8); lan.position.set(Math.cos(inward) * 7.6, 2.4, Math.sin(inward) * 7.6);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 2.4, 5), toon("#3a2418")); pole.position.set(Math.cos(inward) * 7.6, 1.2, Math.sin(inward) * 7.6);
  g.add(wall, roof, snow, lan, pole); g.position.set(x, 0, z); scene.add(g);
  const tower = new THREE.Group(); tower.position.set(x + hx, 0, z + hz); tower.rotation.y = -inward; scene.add(tower);
  return { a: deg(ad), x, z, inward, lantern: lan, g, roof, tower, floors: 0, wx: x + Math.cos(inward) * 6.5, wz: z + Math.sin(inward) * 6.5 };
});
// the rest of the village behind the docks, and rice fields
{
  for (let i = 0; i < 16; i++) {
    const ad = 30 + Math.random() * 120, [x, z] = polar(ad, 1.28 + Math.random() * .35), s = .7 + Math.random() * .5;
    const g = new THREE.Group(); const wall = new THREE.Mesh(new THREE.BoxGeometry(4 * s, 2.6 * s, 3.4 * s), toon("#efe1c2")); wall.position.y = 1.6 * s;
    const rm = toon(Math.random() < .5 ? "#b8352a" : "#3c3a46"); roofMats.push(rm);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6 * s, 2 * s, 4), rm); roof.position.y = 3.9 * s; roof.rotation.y = Math.PI / 4;
    const sm = toon("#ffffff", { transparent: true, opacity: 0 }); snowMats.push(sm);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(3.7 * s, .9 * s, 4), sm); snow.position.y = 4.6 * s; snow.rotation.y = Math.PI / 4;
    g.add(wall, roof, snow); g.position.set(x, .3, z); g.rotation.y = Math.random() * 3; scene.add(g);
  }
}
const paddyMat = toon("#7fae4c");
for (let i = 0; i < 18; i++) { const ad = 20 + Math.random() * 140, [x, z] = polar(ad, 1.75 + Math.random() * .5); const m = new THREE.Mesh(new THREE.BoxGeometry(16 + Math.random() * 10, .3, 10 + Math.random() * 6), paddyMat); m.position.set(x, .4, z); m.rotation.y = Math.random() * .6 - .3; scene.add(m); }

/* trees: peach and maple (round), willow, pine. Their colour is the season. */
const treeMats = { round: toon("#f2a3bf"), willow: toon("#a6d86f"), pine: toon("#2f5a3a"), trunk: toon("#5a3a26") };
{
  const spots = [];
  while (spots.length < 230) {
    const ad = Math.random() * 360, k = 1.1 + Math.random() * .9, [x, z] = polar(ad, k);
    if (DOCKS.some(d => Math.hypot(d.x - x, d.z - z) < 14)) continue;
    if (Math.abs(((ad - ZONES.river.a + 540) % 360) - 180) < 9) continue;
    spots.push([x, z, Math.random()]);
  }
  for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28; spots.push([ISLAND.x + Math.cos(a) * 5.5, ISLAND.z + Math.sin(a) * 5.5, .2]); }
  const kinds = { round: [], willow: [], pine: [] };
  spots.forEach(([x, z, r]) => (r < .38 ? kinds.round : r < .62 ? kinds.willow : kinds.pine).push([x, z]));
  const o = new THREE.Object3D();
  const geos = { round: new THREE.IcosahedronGeometry(2.4, 0), willow: new THREE.ConeGeometry(2.6, 5.6, 7), pine: new THREE.ConeGeometry(1.8, 5.4, 6) };
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .32, 2, 5), treeMats.trunk, spots.length); let ti = 0;
  for (const [kind, list] of Object.entries(kinds)) {
    const im = new THREE.InstancedMesh(geos[kind], treeMats[kind], list.length);
    list.forEach(([x, z], i) => { const s = .75 + Math.random() * .6; o.position.set(x, .3 + (kind === "pine" ? 4.2 : kind === "willow" ? 4.4 : 3.8) * s, z); o.scale.set(s, s * (kind === "round" ? .85 : 1), s); o.rotation.set(0, Math.random() * 3, kind === "willow" ? Math.PI : 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      o.position.y = 1.2 * s; o.scale.setScalar(s); o.rotation.set(0, 0, 0); o.updateMatrix(); trunks.setMatrixAt(ti++, o.matrix); });
    scene.add(im);
  }
  trunks.count = ti; scene.add(trunks);
}

/* the reed bed (芦苇荡) and the lotus pond (荷花塘) */
const reedMat = toon("#6f9a3e");
{
  const n = 520, im = new THREE.InstancedMesh(new THREE.ConeGeometry(.14, 3.4, 4), reedMat, n), o = new THREE.Object3D(); let i = 0;
  while (i < n) { const [x, z] = nearZone("reeds", 1.05); if (nr(x, z) > .99) continue; const s = .6 + Math.random() * .8; o.position.set(x, 1.2 * s, z); o.scale.set(1, s, 1); o.rotation.set(Math.random() * .2 - .1, 0, Math.random() * .2 - .1); o.updateMatrix(); im.setMatrixAt(i++, o.matrix); }
  scene.add(im);
}
const lotusLeafMat = toon("#3f8f45"), lotusFlowerMat = toon("#f29ab8");
const lotusFlowers = new THREE.Group(); scene.add(lotusFlowers);
const lotusLeaves = (() => {
  const n = 90, im = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), lotusLeafMat, n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { const [x, z] = nearZone("lotus", 1); o.position.set(x, .2, z); o.scale.setScalar(.8 + Math.random() * 1.1); o.rotation.y = Math.random() * 6; o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    if (i % 3 === 0) { const f = new THREE.Mesh(new THREE.ConeGeometry(.5, .9, 6), lotusFlowerMat); f.position.set(x + .4, .7, z); lotusFlowers.add(f); } }
  scene.add(im); return im;
})();

/* winter: ice along the shore, open water at every dock */
const iceMat = new THREE.MeshBasicMaterial({ color: "#e6f2f7", transparent: true, opacity: .85 });
const ice = (() => {
  const plates = []; const o = new THREE.Object3D();
  for (let k = 0; k < 2600 && plates.length < 760; k++) { const x = (Math.random() * 2 - 1) * LK.x * 1.1, z = (Math.random() * 2 - 1) * LK.z * 1.1, n = nr(x, z); if (n < .86 || n > 1.0) continue; if (DOCKS.some(d => Math.hypot(d.wx - x, d.wz - z) < 13)) continue; plates.push([x, z]); }
  const im = new THREE.InstancedMesh(new THREE.CircleGeometry(2.6, 6).rotateX(-Math.PI / 2), iceMat, plates.length);
  plates.forEach(([x, z], i) => { o.position.set(x, .22, z); o.scale.setScalar(.8 + Math.random() * .6); o.rotation.y = Math.random() * 6; o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.visible = false; scene.add(im); return im;
})();
const ICE_K = .86;
const iceBlocks = (x, z) => seasonIx === 3 && nr(x, z) > ICE_K && !DOCKS.some(d => Math.hypot(d.wx - x, d.wz - z) < 14);

/* falling things: petals, leaves, snow (none in summer) */
const PART_N = 420;
const partGeo = new THREE.BufferGeometry(); const partPos = new Float32Array(PART_N * 3), partVel = new Float32Array(PART_N * 3);
partGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.55, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const partMat = new THREE.PointsMaterial({ size: 1.1, map: dotTex, color: "#f6b8cc", transparent: true, opacity: .95, depthWrite: false, alphaTest: .05 });
const parts = new THREE.Points(partGeo, partMat); parts.frustumCulled = false; scene.add(parts);
function resetPart(i, cx, cz, top) { partPos[i * 3] = cx + (Math.random() * 2 - 1) * 90; partPos[i * 3 + 1] = top ? 30 + Math.random() * 10 : Math.random() * 40; partPos[i * 3 + 2] = cz + (Math.random() * 2 - 1) * 70; partVel[i * 3] = Math.random() * 2 - 1; partVel[i * 3 + 1] = -(1.5 + Math.random() * 2); partVel[i * 3 + 2] = Math.random() * 2 - 1; }
for (let i = 0; i < PART_N; i++) resetPart(i, 0, 0, false);
function updateParts(dt, cx, cz, tt) {
  const kind = SEASONS[seasonIx].part; parts.visible = kind !== "none" || night > .5;
  if (!parts.visible) return;
  const fire = kind === "none"; // summer nights: fireflies
  for (let i = 0; i < PART_N; i++) {
    const s = kind === "snow" ? .7 : kind === "leaf" ? 1 : 1.2;
    partPos[i * 3] += (partVel[i * 3] + Math.sin(tt + i) * (kind === "snow" ? .4 : 1.2)) * dt * s;
    partPos[i * 3 + 1] += (fire ? Math.sin(tt * 2 + i) * .6 : partVel[i * 3 + 1] * (kind === "snow" ? .8 : .55)) * dt;
    partPos[i * 3 + 2] += partVel[i * 3 + 2] * dt * s;
    if (fire && partPos[i * 3 + 1] > 6) partPos[i * 3 + 1] = 1;
    if (partPos[i * 3 + 1] < 0 || Math.abs(partPos[i * 3] - cx) > 100 || Math.abs(partPos[i * 3 + 2] - cz) > 80) { resetPart(i, cx, cz, !fire); if (fire) partPos[i * 3 + 1] = 1 + Math.random() * 4; }
  }
  partGeo.attributes.position.needsUpdate = true;
}

/* seasons and night, blended every frame */
const C = (h) => new THREE.Color(h);
const cur = { top: C("#6f8fc9"), mid: C("#f0c2c6"), low: C("#fde4cc"), fog: C("#cdbfd0"), hemi: C("#ffe6e0"), ground: C("#7aa35a"), round: C("#f2a3bf"), willow: C("#a6d86f"), pine: C("#2f5a3a"), deep: C("#195a66"), shallow: C("#4aa596"), bank: C("#cfae76"), sun: 1.35 };
let snowAmt = 0;
function setSeason(i, instant = false) {
  seasonIx = ((i % 4) + 4) % 4; const S = SEASONS[seasonIx];
  ice.visible = seasonIx === 3; lotusFlowers.visible = seasonIx === 1; lotusLeaves.visible = seasonIx !== 3;
  lotusLeafMat.color.set(seasonIx === 2 ? "#8a7a3a" : "#3f8f45"); reedMat.color.set(seasonIx === 2 ? "#c8a24a" : seasonIx === 3 ? "#b7a88a" : seasonIx === 0 ? "#8fbf55" : "#6f9a3e");
  paddyMat.color.set(["#8fc45a", "#6fa43c", "#e0b84a", "#d9dde0"][seasonIx]);
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
  hemi.color.copy(cur.hemi).lerp(tmpC.set(NIGHT.hemi), night); hemi.intensity = 1.25 - night * .55; sun.intensity = cur.sun * (1 - night * .85);
  groundMat.color.copy(cur.ground); bankMat.color.copy(cur.bank); treeMats.round.color.copy(cur.round); treeMats.willow.color.copy(cur.willow); treeMats.pine.color.copy(cur.pine);
  waterU.deep.value.copy(cur.deep); waterU.shallow.value.copy(cur.shallow); waterU.sky.value.copy(cur.low); waterU.night.value = night;
  snowAmt += ((seasonIx === 3 ? 1 : 0) - snowAmt) * k; snowMats.forEach(m => m.opacity = snowAmt * .95);
}
const tmpC = new THREE.Color();

/* boats */
const hullShape = (() => { const s = new THREE.Shape(); s.moveTo(-2.3, -1); s.lineTo(1.2, -1); s.quadraticCurveTo(2.6, -.8, 3.1, 0); s.quadraticCurveTo(2.6, .8, 1.2, 1); s.lineTo(-2.3, 1); s.quadraticCurveTo(-2.7, 0, -2.3, -1); return s; })();
const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: .9, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 2 }).rotateX(-Math.PI / 2); hullGeo.translate(0, -.3, 0);
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
  const sailEdge = new THREE.LineSegments(new THREE.EdgesGeometry(sg), new THREE.LineBasicMaterial({ color: "#1a1016" }));
  const lan = makeLantern(.55); lan.position.set(.55, 5.1, 0); lan.visible = false;
  const pile = new THREE.Group();
  for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.28, 6, 5).scale(1.6, .7, 1), toon(i % 3 ? "#f08a3c" : "#d7dde2")); f.position.set(-.1 + (i % 4) * .5 - .8, .78 + Math.floor(i / 4) * .22, ((i * 7) % 3 - 1) * .45); f.rotation.y = i; f.visible = false; pile.add(f); }
  g.add(ol, hull, band, cabin, roof, mast, sail, sailEdge, lan, pile);
  g.userData = { lan, pile, sail };
  scene.add(g); return g;
}
function growHouse(d, banked, color, per = 18) {
  const want = Math.min(6, Math.floor(banked / per));
  while (d.floors < want) {
    const k = d.floors++;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2 - k * .25, 1.6, 3.4 - k * .2), toon("#efe1c2")); wall.position.y = 4.4 + k * 2.1;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8 - k * .22, 1, 4), toon(color)); roof.position.y = 5.7 + k * 2.1; roof.rotation.y = Math.PI / 4;
    d.tower.add(wall, roof); ripple(d.tower.position.x, d.tower.position.z, "#e8b84d", 6, 1);
  }
}
function resetHouses() { DOCKS.forEach(d => { d.tower.clear(); d.floors = 0; }); }

/* a marker ring on the water (tasks, buoys, targets) */
function makeRing(color = "#e8b84d", r = 4) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - .35, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r - .35, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .14, depthWrite: false }));
  ring.position.y = .2; fill.position.y = .19; g.add(ring, fill); g.userData = { ring, fill }; scene.add(g); return g;
}
