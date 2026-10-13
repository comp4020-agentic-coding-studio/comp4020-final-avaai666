// The lake pages' script (DESIGN.md v2.2, "Pages and routes"). Ported from
// prototype 4 (docs/prototypes/next-year-no-fish-v4.html), with the model
// taken out: this script shows what the server sends (a snapshot, rows,
// frames) and sends one family's actions. It never decides an outcome. A
// haul, a breach, a broken promise, a winter's building and a rule all arrive
// as rows; the fish arrive as frames. What it adds is only drawing: where
// the houses stand, how a net flies, the words under an empty net (from the
// haul row's `rival` and the throw row's `under`), and the bots' lines.
"use strict";
(() => {
  document.documentElement.classList.add("js");
  for (const el of document.querySelectorAll("time[datetime]")) {
    el.textContent = new Date(el.getAttribute("datetime")).toLocaleString();
  }

  // ---------- constants mirrored from src/lib/game-constants.ts ----------
  const P = {
    W: 1000, H: 700, RX: 460, RY: 315, SHALLOW: 0.72, R_COARSE: 36, R_FINE: 42, FINE_COST: 20,
    COOLDOWN: 35, STEP_MS: 100, FISH: 400, SPRING: 140, MEET: 140, YEAR: 540, YEARS: 5,
    CAP: 55, START_FRAC: 0.75, KOI_BONUS: 8,
  };
  const PARTS = [["thatched hut", "茅屋", 0], ["tiled roof", "瓦房", 25], ["red gate", "红门", 35], ["lanterns", "灯笼", 50], ["upper floor", "楼", 60], ["pagoda", "宝塔", 70]];
  const RULES = {
    none: { g: "无", name: "No rule", short: "no rule", line: "Fish however you like." },
    ban: { g: "禁", name: "Fine nets are banned", short: "fine nets banned", line: "A fine net that lands is a breach." },
    spring: { g: "休", name: "No fishing in spring", short: "no fishing in spring", line: "A net thrown while the fish spawn is a breach." },
    nursery: { g: "护", name: "The shallows are protected", short: "the shallows protected", line: "A net in the pale ring, where the fry live, is a breach." },
  };
  const SEALS = { 赞: "thanks", 求: "please", 怒: "stop that", 喜: "cheers" };
  const BOT_KIND = { Jin: "jin", Mei: "mei", "Old Wang": "wang" };
  const BOT_NOTE = { jin: "bot · wants the biggest house", mei: "bot · does what the others do", wang: "bot · careful, never buys a fine net" };
  const BOT_COLOR = { wang: "#22327a", jin: "#c98a00", mei: "#1f8a5b" };
  const BOT_ZH = { wang: "王", jin: "金", mei: "梅" };
  const HUMAN_COLORS = ["#d7261e", "#b4407a", "#5b3f8c", "#0f6e78", "#a5480f", "#6b7d1f", "#2a6fb0", "#8a1f3d"];
  const LINE = "#1f2a5c";
  const colorOf = (kind, seat) => (kind && kind !== "you" ? BOT_COLOR[kind] : HUMAN_COLORS[seat % HUMAN_COLORS.length]);
  const builtValue = (part) => PARTS.slice(1, part + 1).reduce((n, p) => n + p[2], 0);

  function phaseOfStep(s) {
    const y = Math.floor(s / P.YEAR) + 1, into = s - (y - 1) * P.YEAR;
    if (y > P.YEARS || (y === P.YEARS && into >= P.FISH)) return { year: P.YEARS, phase: "over", into, spring: false };
    return { year: y, phase: into < P.FISH ? "fish" : "meet", into, spring: into < P.SPRING };
  }
  const yearOfStep = (s) => Math.min(P.YEARS, Math.floor((s || 0) / P.YEAR) + 1);
  const ell = (x, y) => Math.hypot((x - P.W / 2) / P.RX, (y - P.H / 2) / P.RY);
  const inLake = (x, y) => ell(x, y) < 1;

  // ---------- pictures (portraits, prints, houses) ----------
  const SKIN = "#f7d9bd", CHEEK = "#f0788f";
  function face(mood, beard = "") {
    const eyes = {
      happy: `<path d="M44 60 q6 -7 12 0 M64 60 q6 -7 12 0" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
      worried: `<circle cx="50" cy="61" r="3.2" fill="${LINE}"/><circle cx="70" cy="61" r="3.2" fill="${LINE}"/><path d="M43 52 l12 -3 M77 52 l-12 -3" stroke="${LINE}" stroke-width="2.4" stroke-linecap="round"/>`,
      sad: `<path d="M44 62 q6 5 12 0 M64 62 q6 5 12 0" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/><path d="M45 50 l11 4 M75 50 l-11 4" stroke="${LINE}" stroke-width="2.4" stroke-linecap="round"/><path d="M47 67 q-2 6 1 9 q3 -3 1 -9z M73 67 q-2 6 1 9 q3 -3 1 -9z" fill="#5ab4e6"/>`,
      angry: `<circle cx="50" cy="62" r="3.2" fill="${LINE}"/><circle cx="70" cy="62" r="3.2" fill="${LINE}"/><path d="M42 50 l13 6 M78 50 l-13 6" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
    }[mood];
    const c = { happy: 9, worried: 0, sad: -7, angry: -5 }[mood], e = c < 0 ? -c : 0;
    return `<circle cx="60" cy="64" r="29" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4"/><ellipse cx="44" cy="74" rx="7" ry="5" fill="${CHEEK}" opacity=".85"/><ellipse cx="76" cy="74" rx="7" ry="5" fill="${CHEEK}" opacity=".85"/>${eyes}${beard}<path d="M52 ${80 + e} Q60 ${80 + c} 68 ${80 + e}" fill="${c > 0 ? "#c4242b" : "none"}" stroke="${LINE}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  const bust = (jacket, trim, extra = "") => `<path d="M8 140 Q14 100 60 96 Q106 100 112 140 Z" fill="${jacket}" stroke="${LINE}" stroke-width="2.4"/><path d="M44 98 L60 120 L76 98" fill="none" stroke="${trim}" stroke-width="5" stroke-linejoin="round"/>${extra}`;
  const coin = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#a5480f" stroke-width="2"/><rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" fill="none" stroke="#a5480f" stroke-width="1.5"/>`;
  const plum = (x, y) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 3.4).toFixed(2)}" cy="${(Math.sin((a * Math.PI) / 180) * 3.4).toFixed(2)}" r="2.6" fill="#f06b8f"/>`).join("")}<circle r="1.6" fill="#f2b705"/></g>`;
  const HAIR = [
    `<path d="M33 54 Q36 28 60 30 Q84 28 87 54 Q80 40 60 40 Q40 40 33 54z" fill="${LINE}"/><circle cx="38" cy="30" r="10" fill="${LINE}"/><circle cx="82" cy="30" r="10" fill="${LINE}"/><path d="M30 24 l8 6 l-9 4z M90 24 l-8 6 l9 4z" fill="#d7261e"/>`,
    `<path d="M31 56 Q30 28 60 28 Q90 28 89 56 Q78 38 60 40 Q42 38 31 56z" fill="${LINE}"/><path d="M52 26 q8 -12 16 0" fill="${LINE}"/>`,
    `<path d="M32 58 Q30 30 60 30 Q90 30 88 58 L86 44 Q60 34 34 44z" fill="#3a2a1a"/><rect x="36" y="22" width="48" height="10" rx="5" fill="#f2b705" stroke="${LINE}" stroke-width="2"/>`,
  ];
  const ART = {
    you: (m, color, seat) => `${bust(color, "#f2b705", `<circle cx="28" cy="124" r="4" fill="#f2b705"/><circle cx="92" cy="124" r="4" fill="#f2b705"/>`)}${face(m)}${HAIR[seat % HAIR.length]}`,
    wang: (m) => `${bust("#22327a", "#e8e0c8")}${face(m, `<path d="M44 80 Q60 112 76 80 Q68 92 60 92 Q52 92 44 80z" fill="#fbf7ee" stroke="${LINE}" stroke-width="2"/>`)}<path d="M14 46 L60 14 L106 46 Q60 54 14 46z" fill="#d9a441" stroke="${LINE}" stroke-width="2.4"/><path d="M37 41 L60 18 M60 18 L83 41 M60 18 L60 48" stroke="#9c6b20" stroke-width="1.6"/>`,
    jin: (m) => `${bust("#f2b705", "#d7261e", coin(34, 122) + coin(86, 122))}${face(m, `<path d="M48 76 q6 -4 12 0 q6 -4 12 0" fill="none" stroke="${LINE}" stroke-width="2.4" stroke-linecap="round"/>`)}<path d="M30 50 Q32 26 60 25 Q88 26 90 50 Q60 42 30 50z" fill="#1d1d1d" stroke="${LINE}" stroke-width="2"/><circle cx="60" cy="32" r="7" fill="#f2b705" stroke="#a5480f" stroke-width="1.6"/><rect x="57.5" y="29.5" width="5" height="5" fill="#1d1d1d"/>`,
    mei: (m) => `${bust("#1f8a5b", "#f6b8c6", `<circle cx="30" cy="126" r="3" fill="#f6b8c6"/><circle cx="90" cy="126" r="3" fill="#f6b8c6"/>`)}${face(m)}<path d="M31 62 Q30 30 60 32 Q90 30 89 62 Q84 44 60 43 Q36 44 31 62z" fill="${LINE}"/><circle cx="34" cy="34" r="12" fill="${LINE}"/><circle cx="86" cy="34" r="12" fill="${LINE}"/>${plum(86, 24)}${plum(94, 34)}${plum(78, 30)}`,
  };
  const portrait = (kind, mood, seat) =>
    `<svg viewBox="0 8 120 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${(ART[kind] || ART.you)(mood, colorOf(kind, seat), seat)}</svg>`;
  function carpPrint() {
    const scales = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const x = 58 + c * 13 + (r % 2) * 6, y = 60 + r * 15; scales.push(`<path d="M${x - 6} ${y} q6 8 12 0" fill="none" stroke="#a51d16" stroke-width="2"/>`); }
    return `<rect x="4" y="4" width="152" height="192" rx="10" fill="#fbe7bf" stroke="${LINE}" stroke-width="3"/>
    <g stroke="#7fc6c0" stroke-width="2" fill="none">${[150, 162, 174, 186].map((y) => [20, 50, 80, 110, 140].map((x) => `<path d="M${x - 15} ${y} a15 15 0 0 1 30 0"/>`).join("")).join("")}</g>
    <path d="M40 40 C70 10 120 30 116 80 C114 120 100 150 74 168 L62 150 C80 130 84 108 82 88 C80 60 62 52 40 40z" fill="#d7261e" stroke="${LINE}" stroke-width="3"/>${scales.join("")}
    <path d="M62 150 L40 182 L70 170 L84 188 L74 168z" fill="#f2b705" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M112 70 L136 58 L126 86z M98 120 L124 126 L104 138z" fill="#f2b705" stroke="${LINE}" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="56" cy="36" r="6" fill="#fff" stroke="${LINE}" stroke-width="2.4"/><circle cx="57" cy="36" r="2.6" fill="${LINE}"/>
    <path d="M42 44 q-14 2 -22 -6 M46 48 q-10 10 -20 8" stroke="${LINE}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <g fill="#f06b8f" stroke="${LINE}" stroke-width="1.6"><path d="M20 120 q8 -16 16 0 q-8 8 -16 0z"/><path d="M128 150 q8 -14 16 0 q-8 7 -16 0z"/></g>
    <path d="M18 24 q8 -8 16 0 q8 -8 16 0" stroke="#f2b705" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  function cutNet() {
    const lines = [];
    for (let i = 0; i <= 8; i++) { lines.push(`<path d="M${10 + i * 12} 10 L${10 + i * 12} ${i === 4 ? 52 : 106}" />`); lines.push(`<path d="M10 ${10 + i * 12} L${i === 5 ? 52 : 106} ${10 + i * 12}" />`); }
    return `<g stroke="${LINE}" stroke-width="2" fill="none">${lines.join("")}</g><path d="M58 52 L64 60 L52 66 L66 74" stroke="#d7261e" stroke-width="3.5" fill="none" stroke-linecap="round"/><rect x="74" y="88" width="40" height="36" rx="5" fill="#d7261e"/><text x="94" y="114" font-family="Ma Shan Zheng,KaiTi,serif" font-size="20" fill="#fff6e3" text-anchor="middle">良罟</text>`;
  }
  function houseSVG(tier, color) {
    const w = 90 + tier * 8, base = 150;
    const roof = (y, ww) => `<path d="M${120 - ww / 2 - 14} ${y} Q${120 - ww / 4} ${y - 8} 120 ${y - 28} Q${120 + ww / 4} ${y - 8} ${120 + ww / 2 + 14} ${y}Z" fill="${tier === 0 ? "#b98b3e" : "#3b4a7a"}" stroke="${LINE}" stroke-width="3"/>`;
    let s = `<svg viewBox="0 0 240 180" aria-hidden="true"><rect x="0" y="160" width="240" height="20" fill="#86cbc2"/>`;
    s += `<rect x="${120 - w / 2}" y="${base - 50}" width="${w}" height="50" fill="${tier >= 2 ? "#fff6e3" : "#f3dfb8"}" stroke="${LINE}" stroke-width="3"/><rect x="110" y="${base - 26}" width="20" height="26" fill="${tier >= 2 ? "#d7261e" : "#9c6b20"}" stroke="${LINE}" stroke-width="3"/>`;
    if (tier >= 4) s += `<rect x="${120 - w / 2 + 10}" y="${base - 86}" width="${w - 20}" height="36" fill="#fff6e3" stroke="${LINE}" stroke-width="3"/>`;
    if (tier >= 5) s += `<rect x="${120 - w / 2 + 24}" y="${base - 130}" width="${w - 48}" height="30" fill="#fff6e3" stroke="${LINE}" stroke-width="3"/>${roof(base - 130, w - 48)}`;
    if (tier >= 4) s += roof(base - 86, w - 20);
    s += roof(base - 50, w);
    if (tier >= 3) s += [120 - w / 2 - 10, 120 + w / 2 + 10].map((x) => `<ellipse cx="${x}" cy="${base - 40}" rx="9" ry="12" fill="#d7261e" stroke="${LINE}" stroke-width="2.5"/>`).join("");
    s += `<rect x="${120 + w / 2 + 4}" y="${base - 34}" width="22" height="22" rx="4" fill="${color}" stroke="${LINE}" stroke-width="2.5"/>`;
    return s + "</svg>";
  }
  function fillArt(root = document) {
    for (const el of root.querySelectorAll("[data-art]")) {
      const art = el.dataset.art, seat = Number(el.dataset.seat || 0), kind = el.dataset.kind || "you";
      if (art === "carp") el.innerHTML = carpPrint();
      else if (art === "net") el.innerHTML = cutNet();
      else if (art === "portrait") el.innerHTML = portrait(kind, el.dataset.mood || "happy", seat);
      else if (art === "house") el.innerHTML = houseSVG(Number(el.dataset.part || 0), colorOf(kind, seat));
    }
  }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  fillArt();

  // ---------- home: the code box ----------
  const codeForm = $("join-code");
  if (codeForm) {
    codeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const code = $("code").value.trim().toUpperCase();
      if (/^[A-Z]{4}$/.test(code)) location.href = `/l/${code}`;
    });
  }

  const main = document.querySelector("main[data-lake]");
  if (!main) return;
  if (main.dataset.state === "pre") return lobby(main);
  if (main.dataset.state === "live") return live(main);

  // ---------- the lobby: who has joined, live ----------
  function lobby(main) {
    const code = main.dataset.lake;
    for (const el of document.querySelectorAll("[data-host]")) el.textContent = location.host;
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const res = await fetch(location.pathname, { cache: "no-store" });
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const next = doc.querySelector("main[data-lake]");
        if (!next) return;
        if (next.dataset.state !== "pre") return location.reload();
        if (next.dataset.families !== main.dataset.families) {
          main.dataset.families = next.dataset.families;
          for (const id of ["families", "joined-count"]) { const a = $(id), b = doc.getElementById(id); if (a && b) a.innerHTML = b.innerHTML; }
          const a = main.querySelector(".note"), b = next.querySelector(".note");
          if (a && b) a.textContent = b.textContent;
          fillArt(main);
        }
      } catch { /* the next poll tries again */ } finally { refreshing = false; }
    }
    // The stream says when someone joins or the season starts; if the server
    // offers no stream before the start, poll once a second instead.
    let polling = null;
    const es = new EventSource(`/l/${code}/events`);
    es.addEventListener("reload", () => location.reload());
    es.addEventListener("snapshot", () => location.reload());
    es.addEventListener("row", (e) => { const r = JSON.parse(e.data); if (r.kind === "start") location.reload(); else refresh(); });
    es.onerror = () => { if (es.readyState === EventSource.CLOSED && !polling) polling = setInterval(refresh, 1000); };
  }

  // =====================================================================
  // THE LIVE LAKE
  // =====================================================================
  function live(main) {
    const boot = JSON.parse($("boot").textContent);
    const code = boot.code, ME = boot.me;
    const S = {
      fams: [], rule: "none", votes: new Map(), asks: [], promises: new Set(), lastId: Number(main.dataset.lastId) || 0,
      ended: false, myNext: 0, useFine: false, start: 0, snapStep: 0, snapAt: performance.now(), seen: new Set(),
      yearStats: {}, anger: {}, phaseSeen: null, meetFor: 0, busy: {}, lastRows: [],
    };
    const pkey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const nameOf = (seat) => (seat === null || seat === undefined ? "The village" : S.fams[seat] ? S.fams[seat].name : `seat ${seat}`);
    const nameYou = (seat) => (seat === ME ? "you" : nameOf(seat));
    const NameYou = (seat) => (seat === ME ? "You" : nameOf(seat));
    const stats = (y) => (S.yearStats[y] ||= { fryTaken: 0, breaches: 0, broken: 0 });
    const me = () => (ME === null ? null : S.fams[ME]);

    function applySnapshot(s) {
      const old = S.fams;
      S.fams = s.families.map((f) => {
        const kind = f.bot ? BOT_KIND[f.name] || "you" : "you";
        const prev = old[f.seat] || {};
        return {
          seat: f.seat, name: f.name, bot: f.bot, kind, color: colorOf(kind, f.seat),
          zh: f.bot ? BOT_ZH[kind] : (f.name.trim()[0] || "?").toUpperCase(),
          basket: f.basket, part: f.part, hasFine: f.hasFine, breaches: f.breaches,
          broken: prev.broken || 0, bubble: prev.bubble || null,
        };
      });
      S.rule = s.rule;
      S.votes = new Map(s.vote.map((v) => [v.seat, v.rule]));
      S.asks = s.asks.slice();
      S.promises = new Set();
      for (const f of s.families) for (const o of f.promisedWith) S.promises.add(pkey(f.seat, o));
      S.snapStep = s.step; S.snapAt = performance.now();
      S.start = Math.round(P.CAP * S.fams.length * P.START_FRAC);
      if (me() && !me().hasFine) S.useFine = false;
      layoutHomes();
      renderRule(); renderOffer(); lastFamsKey = "";
    }

    // ---------- the clock: server steps, from the frames ----------
    let clockOff = null; // performance.now() - step * 100, the smallest seen (least delayed), creeping up slowly
    const nowStep = () => (clockOff === null ? S.snapStep + (performance.now() - S.snapAt) / P.STEP_MS : (performance.now() - clockOff) / P.STEP_MS);
    const DELAY = 2.3; // the fish are drawn this many steps behind the newest frame, so there is always a frame on each side

    // ---------- geometry: the houses around the shore ----------
    const VW = 1160, VH = 860, OX = 80, OY = 80, CX = OX + P.W / 2, CY = OY + P.H / 2;
    let HOMES = [], SHORE = [], HSCALE = 1;
    function layoutHomes() {
      const n = S.fams.length || 4, mine = ME === null ? 0 : ME;
      HSCALE = n <= 4 ? 1 : n <= 6 ? 0.85 : 0.74;
      HOMES = []; SHORE = [];
      for (let seat = 0; seat < n; seat++) {
        const a = Math.PI / 2 + (((seat - mine + n) % n) * 2 * Math.PI) / n;
        const c = Math.cos(a), s = Math.sin(a), pc = Math.sign(c) * Math.abs(c) ** 0.55, ps = Math.sign(s) * Math.abs(s) ** 0.55;
        HOMES[seat] = { x: CX + 534 * pc, y: CY + 386 * ps, c, s };
        SHORE[seat] = { x: CX + P.RX * c, y: CY + P.RY * s };
      }
    }

    // ---------- frames ----------
    const frames = []; // { s, fish: Map(id -> [x, y, h, a]), koi }
    let counts = { a: 0, f: 0 };
    const hearts = [];
    function onFrame(fr) {
      const at = performance.now(), off = at - fr.s * P.STEP_MS;
      clockOff = clockOff === null || off < clockOff ? off : clockOff + 1.5;
      const fish = new Map();
      let a = 0;
      for (const q of fr.f) { fish.set(q[0], [q[1], q[2], q[3] / 100, q[4]]); a += q[4]; }
      counts = { a, f: fr.f.length - a };
      const prev = frames[frames.length - 1];
      if (prev && fr.s - prev.s < 10) {
        for (const [id, q] of fish) {
          if (q[3] === 0 && !prev.fish.has(id) && !hearts.some((h) => Math.hypot(h.x - q[0], h.y - q[1]) < 30 && performance.now() - h.t < 900)) hearts.push({ x: q[0], y: q[1], t: performance.now() + DELAY * P.STEP_MS });
        }
        if (fr.k && !prev.koi) banner("koi-" + yearOfStep(fr.s), "锦", "A golden carp! Worth 8 fish to whichever net takes it.");
      }
      frames.push({ s: fr.s, fish, koi: fr.k ? { x: fr.k[0], y: fr.k[1], h: fr.k[2] / 100 } : null });
      while (frames.length > 8) frames.shift();
      const ph = phaseOfStep(fr.s);
      if (ph.phase === "fish" && ph.year === 1 && ph.spring && ph.into > 10) banner("spring1", "春", "Spring. Two fish that meet pair up and lay eggs. Watch for the hearts.");
      if (ph.phase === "fish" && ph.year === 1 && counts.f > 10 && S.seen.has("spring1")) banner("fry1", "鲕", "Fry! They keep to the pale shallows near the shore, and grow up by next year.");
      if (ph.phase === "fish" && ph.spring && ph.into > 80 && counts.a < 30 && counts.a > 1) banner("allee", "孤", "So few grown fish are left that they rarely meet. Hardly any eggs this spring.");
      if (ph.phase === "fish" && ph.spring && S.rule === "spring" && ph.into < 30) banner("springrule-" + ph.year, "休", "No fishing in spring this year. Anyone can still throw a net, and everyone will see it.");
    }
    const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };

    // ---------- nets, floats, flyers, stamps ----------
    const throws = new Map(); // throw row id -> net
    let ghost = null; // my net, between my tap and its row
    const floats = [], flyers = [], stamps = [], particles = [], snaps = [];
    const now = () => performance.now();
    function netOf(seat, x, y, fine, breach, under, t0) { return { seat, x, y, fine, breach, under, t0, haul: null, tHaul: 0 }; }

    // ---------- the record (the side panel's list) ----------
    function rowWords(r) {
      const who = NameYou(r.seat), d = r.data || {};
      switch (r.kind) {
        case "throw": return `${who} threw a ${d.fine ? "fine" : "coarse"} net${d.breach ? " (a breach)" : ""}`;
        case "haul": return d.got ? `${r.seat === ME ? "Your" : `${nameOf(r.seat)}'s`} net took ${d.got} fish${d.koi ? " and the golden carp" : ""}` : `${r.seat === ME ? "Your" : `${nameOf(r.seat)}'s`} net came up empty`;
        case "buy": return `${who} bought a fine net`;
        case "ask": return `${who} asked ${nameYou(d.to)}: coarse nets only, until winter?`;
        case "answer": return `${who} ${d.yes ? "promised" : "said no to"} ${nameYou(d.from)}`;
        case "broken": return `${who} broke a promise to ${nameYou(d.to)}`;
        case "seal": return `${who} sent ${nameYou(d.to)} ${d.seal} (${SEALS[d.seal] || ""})`;
        case "vote": return `${who} voted: ${RULES[d.rule] ? RULES[d.rule].short : d.rule}`;
        case "build": return d.parts && d.parts.length ? `${who} built ${d.parts.join(" and ")}` : `${who} built nothing new`;
        case "rule": return `The village chose: ${RULES[d.rule] ? RULES[d.rule].short : d.rule}`;
        case "end": return "The season ended";
        default: return r.kind;
      }
    }
    const HOT = (r) => ["buy", "broken", "rule"].includes(r.kind) || (r.kind === "seal" && r.data.seal === "怒") || (r.kind === "throw" && r.data.breach) || (r.kind === "haul" && r.data.koi);
    function logRow(r) {
      if (r.kind === "open" || r.kind === "join" || r.kind === "start") return;
      if (r.kind === "throw" && !r.data.breach) return;
      if (r.kind === "haul" && !r.data.koi && !(r.data.fry >= 5)) return;
      const list = $("rows");
      if (!list || list.querySelector(`[data-id="${r.id}"]`)) return;
      const li = document.createElement("li");
      li.dataset.id = String(r.id);
      li.innerHTML = `<span class="y">Y${yearOfStep(r.step)}</span><span class="${HOT(r) ? "hot" : ""}">${esc(r.kind === "haul" && !r.data.koi ? `${rowWords(r)}, ${r.data.fry} of them fry` : rowWords(r))}</span>`;
      list.prepend(li);
      while (list.children.length > 60) list.lastElementChild.remove();
    }

    // ---------- talk: what a family says when a row lands ----------
    function say(seat, text, seal = null, secs = 3.2) { const f = S.fams[seat]; if (f) f.bubble = { text, seal, until: now() + secs * 1000 }; }
    let bannerTm = 0;
    function banner(key, glyph, text) {
      if (key && S.seen.has(key)) return;
      if (key) S.seen.add(key);
      $("banner-g").textContent = glyph; $("banner-t").textContent = text; $("banner").hidden = false;
      clearTimeout(bannerTm); bannerTm = setTimeout(() => ($("banner").hidden = true), 5600);
    }
    let toastTm = 0;
    function toast(text) {
      let t = document.querySelector(".toast");
      if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); $("stagewrap").append(t); }
      t.textContent = text; t.hidden = false; clearTimeout(toastTm); toastTm = setTimeout(() => (t.hidden = true), 2600);
    }

    // Rows from the boot snapshot: only what the page needs to remember
    // (my next throw, this year's numbers, who already broke a promise).
    function noteRow(r, booting = false) {
      const d = r.data || {}, y = yearOfStep(r.step);
      if (booting && r.kind === "broken" && S.fams[r.seat]) S.fams[r.seat].broken++;
      if (r.kind === "throw" && r.seat === ME) S.myNext = Math.max(S.myNext, r.step + P.COOLDOWN);
      if (r.kind === "throw" && d.breach) stats(y).breaches++;
      if (r.kind === "haul") stats(y).fryTaken += d.fry || 0;
      if (r.kind === "broken") stats(y).broken++;
      if (r.kind === "buy") S.seen.add("finefirst");
      if (r.kind === "seal" && d.seal === "怒") { const k = `${d.to}-${y}`; (S.anger[k] ||= new Set()).add(r.seat); }
    }

    // A row from the stream: change the state, then draw it.
    function applyRow(r) {
      const d = r.data || {}, f = r.seat === null ? null : S.fams[r.seat], y = yearOfStep(r.step), fresh = Math.abs(nowStep() - (r.step || 0)) < 30;
      logRow(r);
      switch (r.kind) {
        case "throw": {
          if (!f) break;
          let net = null;
          if (r.seat === ME && ghost) { net = ghost; ghost = null; Object.assign(net, { x: d.x, y: d.y, fine: d.fine, breach: d.breach, under: d.under }); }
          else if (fresh) net = netOf(r.seat, d.x, d.y, d.fine, d.breach, d.under, now());
          if (net) throws.set(r.id, net);
          if (d.breach) {
            f.breaches++;
            stamps.push({ x: d.x, y: d.y, t: now(), ch: "违" });
            sfx.stamp();
            if (f.kind === "jin") banner("jin-breach-hint", "违", "Jin broke the rule. He backs down only when two families object. Tap Jin and send 怒 (stop that).");
            if (r.seat === ME) banner("me-breach", "违", `You broke the rule (${RULES[S.rule].short}). Nothing stops a net; everyone sees the stamp.`);
          }
          if (r.seat === ME && fresh) sfx.splash();
          break;
        }
        case "haul": {
          if (!f) break;
          f.basket += (d.got || 0) + (d.koi ? P.KOI_BONUS : 0);
          const net = throws.get(d.throw);
          if (!net) break;
          setTimeout(() => showHaul(r, net), DELAY * P.STEP_MS);
          break;
        }
        case "buy":
          if (!f) break;
          f.hasFine = true; f.basket -= P.FINE_COST;
          if (r.seat === ME) { S.useFine = true; banner("mefine", "罟", "Your fine net keeps everything in the ring, fry included. Switch nets with F or the button."); sfx.crackle(); }
          else banner("finefirst", "罟", `${f.name} bought a fine net. It keeps fry too, and fry are next year's grown fish.`);
          if (f.kind === "jin") say(r.seat, "A fine net! More for my house.", "喜");
          if (f.kind === "mei") say(r.seat, "Everyone else has one…", "求");
          break;
        case "ask":
          S.asks.push({ from: r.seat, to: d.to });
          if (f && f.kind === "wang") say(r.seat, d.to === ME ? "Neighbour, a promise?" : `${nameOf(d.to)}, a promise?`, "约");
          renderOffer();
          break;
        case "answer": {
          S.asks = S.asks.filter((a) => !(a.from === d.from && a.to === r.seat));
          if (d.yes) {
            S.promises.add(pkey(d.from, r.seat)); sfx.chime(4);
            if (d.from === ME || r.seat === ME) banner("promise1", "约", "A promise is a red thread between two houses until winter. Nothing enforces it; everyone sees if it snaps.");
          }
          if (f && f.bot) say(r.seat, d.yes ? (f.kind === "jin" ? "Sure, sure. A promise." : "Agreed. Coarse nets until winter.") : f.kind === "jin" ? "Not a chance." : "Not this year.", d.yes ? "约" : null);
          else if (d.from !== ME && S.fams[d.from] && S.fams[d.from].bot && !d.yes) say(d.from, "Hm. I'll be watching your net.");
          renderOffer();
          break;
        }
        case "broken":
          S.promises.delete(pkey(r.seat, d.to));
          if (f) f.broken++;
          snaps.push({ a: r.seat, b: d.to, t: now() });
          stamps.push({ home: r.seat, t: now(), ch: "失" });
          sfx.snap();
          if (r.seat === ME) banner(null, "失", `You broke your promise to ${nameOf(d.to)}. Everyone saw the thread snap.`);
          else if (d.to === ME) banner(null, "失", `${nameOf(r.seat)} broke their promise to you: a fine net before winter.`);
          break;
        case "seal": {
          flyers.push({ seal: d.seal, from: r.seat, to: d.to, t: now() });
          const to = S.fams[d.to];
          setTimeout(() => say(d.to, `${NameYou(r.seat)}: ${SEALS[d.seal]}`, d.seal, 2.6), 450);
          if (d.seal === "怒") {
            const k = `${d.to}-${y}`; (S.anger[k] ||= new Set()).add(r.seat);
            if (to && to.kind === "jin") setTimeout(() => say(d.to, S.rule === "none" ? "There's no rule against it!" : S.anger[k].size >= 2 ? "All right, all right. I'll keep the rule this year." : "Only one of you minds? I'll carry on.", S.anger[k].size >= 2 && S.rule !== "none" ? "求" : "喜"), 1400);
            if (to && to.kind === "mei") setTimeout(() => say(d.to, "Sorry! I'll stop.", "求"), 1400);
            if (to && to.kind === "wang") setTimeout(() => say(d.to, "Me? I keep a coarse net!", "怒"), 1400);
            if (f && f.kind === "wang" && d.to !== ME) {} // his stamp speaks for itself
          } else if (to && to.bot && (d.seal === "赞" || d.seal === "喜")) setTimeout(() => say(d.to, to.kind === "jin" ? "Ha!" : "Thank you!", "喜"), 1400);
          else if (to && to.kind === "jin" && d.seal === "求") setTimeout(() => say(d.to, to.hasFine ? "Everyone would, in my place." : "We'll see.", null), 1400);
          if (d.to === ME) sfx.chime(d.seal === "怒" ? 0 : 3);
          break;
        }
        case "vote":
          S.votes.set(r.seat, d.rule);
          if (f && f.kind === "wang") say(r.seat, { ban: "Fine nets take the young. Ban them.", nursery: "Leave the shallows to the fry.", spring: "Let them spawn in peace.", none: "The lake is full. No rule yet." }[d.rule], RULES[d.rule].g);
          if (f && f.kind === "jin") say(r.seat, "No rules! Plenty for all.", "无");
          if (f && f.kind === "mei") say(r.seat, d.rule === "none" ? "Nobody told me… no rule." : "I'll vote with the others.", RULES[d.rule].g);
          renderCouncil(); sfx.stamp();
          break;
        case "build":
          if (!f) break;
          f.part += (d.parts || []).length; f.basket = d.left;
          if (d.parts && d.parts.length && fresh) floats.push({ x: HOMES[r.seat].x - OX, y: HOMES[r.seat].y - OY - 60, text: d.parts[d.parts.length - 1], color: f.color, t: now(), big: r.seat === ME, home: true });
          break;
        case "rule":
          S.rule = d.rule; S.votes = new Map(); S.anger = {};
          renderRule(); renderCouncil();
          showNewYear(Number(d.year) + 1);
          break;
        case "end":
          S.ended = true;
          $("meeting").hidden = true; $("over").hidden = false; sfx.gong();
          setTimeout(() => location.reload(), 2400);
          break;
      }
    }

    function showHaul(r, net) {
      const d = r.data, f = S.fams[r.seat];
      net.haul = d; net.tHaul = now();
      if (d.koi) { floats.push({ x: net.x, y: net.y - 34, text: "golden carp +8", color: "#c98a00", t: now(), big: true }); burst(net.x, net.y); sfx.crackle(); if (f.bot) say(r.seat, "The golden carp!", "喜"); }
      for (let k = 0; k < Math.min(d.got, 12); k++) flyers.push({ fish: true, x: net.x + (Math.random() - 0.5) * 30, y: net.y + (Math.random() - 0.5) * 30, seat: r.seat, t: now() + k * 30, fry: k < d.fry });
      let why = "";
      if (!d.got) why = d.rival !== null && d.rival !== undefined ? `${d.rival === ME ? "You" : nameOf(d.rival)} got there first` : net.under === 0 ? "missed: no fish there" : "they swam off";
      const sub = why || (d.slipped && !net.fine ? `${d.slipped} fry slipped through` : d.fry ? `${d.fry} of them fry` : "");
      floats.push({ x: net.x, y: net.y, text: d.got ? `+${d.got}` : "empty", sub, color: f.color, t: now(), big: r.seat === ME || (!d.got && d.rival === ME) });
      if (r.seat === ME) {
        sfx.haul(d.got);
        if (d.slipped && !net.fine) banner("slip", "鲕", `${d.slipped} fry slipped through your coarse mesh. Fry are next year's grown fish.`);
        if (!d.got && d.rival !== null && d.rival !== undefined) banner("rival1", "先", `${nameOf(d.rival)} threw at the same fish a moment before you. The net thrown first takes them.`);
      }
      if (d.fry >= 4 && r.seat !== ME) banner("fryhaul-" + r.seat, "鲕", `${nameOf(r.seat)}'s fine net took ${d.fry} fry in one haul.`);
    }

    // ---------- meetings and the new year ----------
    function renderRule() {
      $("rule-g").textContent = RULES[S.rule].g;
      $("rule-t").textContent = `${RULES[S.rule].name}. ${RULES[S.rule].line}`;
    }
    function moodOf(f) {
      const r = S.start ? counts.a / S.start : 1;
      if (f.bubble && f.bubble.seal === "怒" && now() < f.bubble.until) return "angry";
      if (f.kind === "jin") return r >= 0.3 ? "happy" : r >= 0.12 ? "worried" : "sad";
      return r >= 0.6 ? "happy" : r >= 0.25 ? "worried" : "sad";
    }
    function renderCouncil() {
      $("council").innerHTML = S.fams.map((f) => {
        const v = S.votes.get(f.seat);
        return `<div class="member">${portrait(f.kind, moodOf(f), f.seat)}${v ? `<span class="stamp" title="${RULES[v].short}">${RULES[v].g}</span>` : ""}<span>${esc(f.seat === ME ? "You" : f.name)}</span></div>`;
      }).join("");
      const mine = S.votes.get(ME);
      for (const b of $("vote-options").querySelectorAll("button")) {
        b.setAttribute("aria-pressed", String(b.dataset.v === mine));
        b.disabled = ME === null;
      }
    }
    function openMeeting(year) {
      const s = stats(year), fine = S.fams.filter((f) => f.hasFine);
      $("meet-eyebrow").textContent = `Winter of year ${year} · the village meets`;
      $("facts").innerHTML = [
        `<div class="fact"><b id="fact-grown">${counts.a}</b>grown fish under the ice, of the ${S.start} you found.</div>`,
        `<div class="fact"><b>${s.fryTaken}</b>fry were netted this year before they could grow up.</div>`,
        `<div class="fact"><b>${fine.length}</b>${fine.length === 1 ? "family has" : "families have"} a fine net${fine.length ? `: ${fine.map((f) => esc(f.seat === ME ? "you" : f.name)).join(", ")}` : ""}.${s.broken ? ` ${s.broken} promise${s.broken > 1 ? "s" : ""} broken.` : ""}${s.breaches ? ` ${s.breaches} breach${s.breaches > 1 ? "es" : ""} of the rule.` : ""}</div>`,
      ].join("");
      renderCouncil();
      $("meeting").hidden = false; S.meetOpened = now();
      $("react").hidden = true;
      if (year === 1) banner("winter1", "冬", "Winter. The lake freezes, last spring's fry grow up, and every family builds with what it caught.");
    }
    let nyTm = 0;
    function showNewYear(year) {
      $("meeting").hidden = true;
      if (year > P.YEARS) return;
      const ratio = S.start ? counts.a / S.start : 1;
      $("ny-eyebrow").textContent = `New Year · year ${year} of ${P.YEARS}`;
      $("ny-big").innerHTML = ratio >= 0.6 ? `Fish to spare<span class="zh">年年有余</span>` : ratio >= 0.25 ? `Fewer fish<span class="zh">鱼少了</span>` : `Next year, no fish?<span class="zh">明年无鱼</span>`;
      $("ny-line").textContent = ratio >= 0.6 ? `${counts.a} grown fish greet the new year.` : `${counts.a} grown fish greet the new year, ${Math.max(0, S.start - counts.a)} fewer than the first.`;
      $("ny-rule").textContent = `This year: ${RULES[S.rule].short}.`;
      $("newyear").hidden = false; sfx.crackle();
      clearTimeout(nyTm); nyTm = setTimeout(() => ($("newyear").hidden = true), 2400);
    }

    // ---------- the offer: someone asks me for a promise ----------
    function renderOffer() {
      const box = $("offer");
      const a = ME === null ? null : S.asks.find((x) => x.to === ME);
      if (!a) { box.hidden = true; box.dataset.from = ""; return; }
      if (box.dataset.from === String(a.from) && !box.hidden) return;
      box.dataset.from = String(a.from);
      box.hidden = false;
      box.innerHTML = `<span><b>${esc(nameOf(a.from))}</b> asks you: <b>coarse nets only, until winter?</b></span><div class="row"><button class="btn go" type="button" data-yes="1">Promise</button><button class="btn alt" type="button" data-yes="0">Say no</button></div>`;
      for (const b of box.querySelectorAll("button")) b.addEventListener("click", async () => {
        box.hidden = true;
        const res = await post("/promise/answer", { from: a.from, yes: b.dataset.yes === "1" });
        if (!res.ok) { toast(REASONS[res.reason] || res.reason); renderOffer(); }
      });
      if (ME !== null) sfx.chime(4);
    }

    // ---------- talking to the server ----------
    const REASONS = {
      too_soon: "Your net is still drying.", not_fishing: "The lake is frozen until spring.", outside: "That's the shore: throw into the water.",
      no_fine_net: "You don't own a fine net.", over: "The season is over.", rate_limited: "Too fast.", cannot_afford: "A fine net costs 20 fish from your basket.",
      already_owned: "You already own a fine net.", already_promised: "You already have a promise, or an ask, with them.", no_such_ask: "That ask has lapsed.",
      not_meeting: "Votes are cast in winter.", not_in_lake: "You are not in this lake.", offline: "No connection. Try again.", self: "That's you.",
      not_started: "The season hasn't started.", bad_key: "Something went wrong. Try again.",
    };
    async function post(path, body) {
      try {
        const res = await fetch(`/l/${code}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}), credentials: "same-origin" });
        return await res.json().catch(() => ({ ok: res.ok, reason: res.ok ? "" : "offline" }));
      } catch { return { ok: false, reason: "offline" }; }
    }
    const uuid = () => {
      if (crypto.randomUUID) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
      const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    };

    async function throwNet(x, y) {
      const m = me();
      if (!m || S.ended) return;
      const ph = phaseOfStep(nowStep());
      if (ph.phase !== "fish") { toast(REASONS.not_fishing); return sfx.tick(); }
      if (!inLake(x, y)) { toast(REASONS.outside); return sfx.tick(); }
      if (nowStep() + 0.5 < S.myNext || ghost) return sfx.tick();
      const fine = m.hasFine && S.useFine;
      const before = S.myNext;
      S.myNext = nowStep() + P.COOLDOWN;
      ghost = netOf(ME, x, y, fine, false, null, now());
      const mine = ghost, key = uuid();
      let res = await post("/throw", { x: Math.round(x), y: Math.round(y), net: fine ? "fine" : "coarse", key });
      if (!res.ok && res.reason === "offline") res = await post("/throw", { x: Math.round(x), y: Math.round(y), net: fine ? "fine" : "coarse", key });
      if (!res.ok) {
        if (ghost === mine) ghost = null;
        if (res.reason !== "too_soon") S.myNext = before;
        toast(REASONS[res.reason] || res.reason); sfx.tick();
      }
    }
    async function buy() {
      const m = me();
      if (!m || m.hasFine || S.busy.buy) return;
      S.busy.buy = true;
      const res = await post("/buy");
      S.busy.buy = false;
      if (!res.ok) toast(REASONS[res.reason] || res.reason);
    }
    const toggle = () => { const m = me(); if (m && m.hasFine) S.useFine = !S.useFine; };

    // ---------- drawing ----------
    const cv = $("lake"), cx = cv.getContext("2d");
    let scale = 1, offX = 0, offY = 0, DPR = 1, bgCanvas = null, FISHZ = 1;
    const FISH_COLORS = [["#e8452c", "#f2b705"], ["#f2b705", "#e8452c"], ["#ffffff", "#e8452c"], ["#e8452c", "#ffffff"]];
    const ZH = `"Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi",serif`;
    function resize() {
      const r = cv.getBoundingClientRect(); if (!r.width) return;
      DPR = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.height * DPR);
      scale = Math.min(r.width / VW, r.height / VH); offX = (r.width - VW * scale) / 2; offY = (r.height - VH * scale) / 2;
      FISHZ = r.width < 640 ? 1.5 : r.width < 900 ? 1.2 : 1;
      bgCanvas = null;
    }
    const toWorld = (px, py) => ({ x: (px - offX) / scale - OX, y: (py - offY) / scale - OY });
    function buildBg() {
      const b = document.createElement("canvas"); b.width = cv.width; b.height = cv.height;
      const c = b.getContext("2d"); c.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * offX, DPR * offY);
      c.fillStyle = "#fbe7bf"; c.fillRect(-OX, -OY, VW + OX * 2, VH + OY * 2);
      c.strokeStyle = "rgba(31,138,91,.4)"; c.lineWidth = 2;
      for (let i = 0; i < 180; i++) { const a = (i / 180) * Math.PI * 2, rr = 1.05 + (i % 3) * 0.035; const x = CX + Math.cos(a) * P.RX * rr, y = CY + Math.sin(a) * P.RY * rr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 9); c.stroke(); }
      c.save(); c.beginPath(); c.ellipse(CX, CY, P.RX, P.RY, 0, 0, Math.PI * 2); c.clip();
      c.fillStyle = "#86cbc2"; c.fillRect(OX, OY, P.W, P.H);
      c.beginPath(); c.ellipse(CX, CY, P.RX * P.SHALLOW, P.RY * P.SHALLOW, 0, 0, Math.PI * 2); c.fillStyle = "#1f7f8c"; c.fill();
      c.strokeStyle = "rgba(255,255,255,.16)"; c.lineWidth = 2;
      for (let y = OY - 10; y < OY + P.H + 20; y += 22) for (let x = OX - 20 + ((y / 22) % 2) * 18; x < OX + P.W + 20; x += 36) { c.beginPath(); c.arc(x, y, 16, Math.PI, 0); c.stroke(); }
      c.restore();
      c.lineWidth = 7; c.strokeStyle = LINE; c.beginPath(); c.ellipse(CX, CY, P.RX, P.RY, 0, 0, Math.PI * 2); c.stroke();
      c.setLineDash([3, 7]); c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.6)"; c.beginPath(); c.ellipse(CX, CY, P.RX * P.SHALLOW, P.RY * P.SHALLOW, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      [[0.2, 0.18], [0.82, 0.2], [0.1, 0.62], [0.9, 0.7], [0.3, 0.88], [0.68, 0.9]].forEach(([u, v], i) => {
        if (ell(u * P.W, v * P.H) >= 0.98) return;
        const x = OX + u * P.W, y = OY + v * P.H; c.fillStyle = "#2f9a62"; c.strokeStyle = LINE; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y); c.arc(x, y, 15, 0.3 + i, Math.PI * 1.85 + i); c.closePath(); c.fill(); c.stroke();
      });
      bgCanvas = b;
    }
    function sealAt(x, y, ch, size, rot = 0.15, alpha = 1, color = "#d7261e") {
      cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, alpha)); cx.translate(x, y); cx.rotate(rot);
      cx.fillStyle = color; cx.strokeStyle = "#fff6e3"; cx.lineWidth = 2;
      cx.beginPath(); cx.roundRect(-size / 2, -size / 2, size, size, size * 0.16); cx.fill(); cx.strokeRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6);
      cx.fillStyle = "#fff6e3"; cx.font = `${size * 0.7}px ${ZH}`; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(ch, 0, 1);
      cx.restore();
    }
    function drawHouse(f, t, ph) {
      const h = HOMES[f.seat]; if (!h) return;
      const tier = f.part, w = 46 + tier * 5, hh = 26 + Math.min(tier, 3) * 3;
      cx.save(); cx.translate(h.x, h.y); cx.scale(HSCALE, HSCALE); cx.lineWidth = 2.5; cx.strokeStyle = LINE; cx.textBaseline = "middle";
      cx.fillStyle = tier >= 2 ? "#fff6e3" : "#f3dfb8"; cx.fillRect(-w / 2, -hh / 2, w, hh); cx.strokeRect(-w / 2, -hh / 2, w, hh);
      cx.fillStyle = tier >= 2 ? "#d7261e" : "#9c6b20"; cx.fillRect(-7, hh / 2 - 16, 14, 16); cx.strokeRect(-7, hh / 2 - 16, 14, 16);
      const roof = tier === 0 ? "#b98b3e" : "#3b4a7a";
      const drawRoof = (y, ww) => { cx.fillStyle = roof; cx.beginPath(); cx.moveTo(-ww / 2 - 10, y); cx.quadraticCurveTo(-ww / 4, y - 6, 0, y - 20); cx.quadraticCurveTo(ww / 4, y - 6, ww / 2 + 10, y); cx.closePath(); cx.fill(); cx.stroke(); };
      if (tier >= 4) { cx.fillStyle = "#fff6e3"; cx.fillRect(-w / 2 + 6, -hh / 2 - 22, w - 12, 22); cx.strokeRect(-w / 2 + 6, -hh / 2 - 22, w - 12, 22); }
      if (tier >= 5) { cx.fillStyle = "#fff6e3"; cx.fillRect(-w / 2 + 14, -hh / 2 - 46, w - 28, 18); cx.strokeRect(-w / 2 + 14, -hh / 2 - 46, w - 28, 18); drawRoof(-hh / 2 - 46, w - 28); }
      if (tier >= 4) drawRoof(-hh / 2 - 22, w - 12);
      drawRoof(-hh / 2, w);
      if (tier >= 3) [-w / 2 - 6, w / 2 + 6].forEach((x) => { cx.fillStyle = "#d7261e"; cx.beginPath(); cx.ellipse(x, -hh / 2 + 6 + Math.sin(t * 2 + x) * 1.5, 6, 8, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); cx.fillStyle = "#f2b705"; cx.fillRect(x - 2, -hh / 2 + 13, 4, 4); });
      cx.fillStyle = f.color; const fx = w / 2 + 18, fy = hh / 2 - 6;
      cx.beginPath(); cx.roundRect(fx - 14, fy - 30, 28, 28, 5); cx.fill(); cx.stroke();
      cx.fillStyle = "#fff6e3"; cx.font = `${f.bot ? 22 : 18}px ${f.bot ? ZH : "Nunito, system-ui, sans-serif"}`; cx.textAlign = "center"; cx.fillText(f.zh, fx, fy - 15);
      cx.fillStyle = LINE; cx.textAlign = "center";
      const labelY = hh / 2 + 14, labelX = h.c < -0.6 ? 22 : h.c > 0.6 ? -22 : 0;
      cx.font = "900 15px Nunito, system-ui, sans-serif"; cx.fillText(`${f.seat === ME ? "You" : f.name}${f.bot ? " (bot)" : ""}`, labelX, labelY, 150);
      cx.font = "800 13px Nunito, system-ui, sans-serif"; cx.fillText(`basket ${f.basket}${f.hasFine ? " · fine net" : ""}`, labelX, labelY + 16, 150);
      for (let k = 0; k < Math.min(f.breaches + f.broken, 6); k++) { cx.fillStyle = "#7a1010"; cx.fillRect(-w / 2 - 20, -hh / 2 + k * 11, 9, 9); }
      if (f.seat === ME && ph.phase === "fish" && !S.ended) {
        const p = Math.max(0, Math.min(1, 1 - (S.myNext - nowStep()) / P.COOLDOWN));
        cx.strokeStyle = p >= 1 ? "#1f8a5b" : "#d7261e"; cx.lineWidth = 4; cx.beginPath(); cx.arc(0, -4, w / 2 + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); cx.stroke();
      }
      if (f.bubble && now() < f.bubble.until) {
        const text = f.bubble.text; cx.font = "800 14px Nunito, system-ui, sans-serif";
        const tw = Math.min(260, cx.measureText(text).width) + (f.bubble.seal ? 34 : 0) + 22;
        let bx = 0, by = -hh / 2 - (tier >= 5 ? 84 : tier >= 4 ? 62 : 44);
        if (h.c < -0.4) bx = tw / 2 - 24; if (h.c > 0.4) bx = -tw / 2 + 24; if (h.s < -0.6) by = hh / 2 + 66;
        const gx = h.x + bx * HSCALE; // keep the bubble on the canvas
        if (gx - (tw / 2) * HSCALE < 6) bx += (6 - (gx - (tw / 2) * HSCALE)) / HSCALE;
        if (gx + (tw / 2) * HSCALE > VW - 6) bx -= (gx + (tw / 2) * HSCALE - (VW - 6)) / HSCALE;
        cx.fillStyle = "#fff6e3"; cx.lineWidth = 2.5; cx.beginPath(); cx.roundRect(bx - tw / 2, by - 17, tw, 34, 10); cx.fill(); cx.stroke();
        let tx = bx - tw / 2 + 10;
        if (f.bubble.seal) { cx.fillStyle = f.bubble.seal === "约" ? "#1f8a5b" : "#d7261e"; cx.beginPath(); cx.roundRect(tx, by - 13, 26, 26, 5); cx.fill(); cx.fillStyle = "#fff6e3"; cx.font = `19px ${ZH}`; cx.textAlign = "center"; cx.fillText(f.bubble.seal, tx + 13, by + 1); tx += 34; cx.font = "800 14px Nunito, system-ui, sans-serif"; }
        cx.fillStyle = LINE; cx.textAlign = "left"; cx.fillText(text, tx, by + 1, 260);
      }
      cx.restore();
    }
    function drawFish(x, y, h, adult, id, t, alpha) {
      cx.save(); cx.globalAlpha = alpha; cx.translate(OX + x, OY + y); cx.rotate(h); cx.scale(FISHZ, FISHZ);
      if (!adult) {
        cx.fillStyle = "rgba(255,240,200,.95)"; cx.strokeStyle = "rgba(31,42,92,.5)"; cx.lineWidth = 0.6; cx.beginPath(); cx.ellipse(0, 0, 4.6, 2.1, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
        cx.fillStyle = LINE; cx.fillRect(2, -0.7, 1.4, 1.4);
      } else {
        const [body, spot] = FISH_COLORS[id % 4], wig = Math.sin(t * 9 + id) * 0.35;
        cx.fillStyle = body; cx.strokeStyle = "rgba(31,42,92,.85)"; cx.lineWidth = 1.2;
        cx.beginPath(); cx.moveTo(-8, 0); cx.lineTo(-14, -5 + wig * 4); cx.lineTo(-13, 0); cx.lineTo(-14, 5 + wig * 4); cx.closePath(); cx.fill(); cx.stroke();
        cx.beginPath(); cx.ellipse(0, 0, 10, 4.6, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
        cx.fillStyle = spot; cx.beginPath(); cx.ellipse(1, -0.5, 3.6, 2.3, 0, 0, Math.PI * 2); cx.fill();
      }
      cx.restore();
    }
    function drawNet(x, y, r, fine, color, k, breach) {
      cx.save(); cx.translate(OX + x, OY + y);
      cx.save(); cx.beginPath(); cx.arc(0, 0, r * k, 0, Math.PI * 2); cx.clip();
      cx.strokeStyle = breach ? "#d7261e" : color; cx.globalAlpha *= 0.8; cx.lineWidth = fine ? 1 : 1.6;
      const g = fine ? 5 : 10;
      for (let d = -2 * r; d <= 2 * r; d += g) { cx.beginPath(); cx.moveTo(d - r, -r); cx.lineTo(d + r, r); cx.stroke(); cx.beginPath(); cx.moveTo(d + r, -r); cx.lineTo(d - r, r); cx.stroke(); }
      cx.restore();
      cx.strokeStyle = breach ? "#d7261e" : color; cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, r * k, 0, Math.PI * 2); cx.stroke();
      cx.fillStyle = LINE; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; cx.beginPath(); cx.arc(Math.cos(a) * r * k, Math.sin(a) * r * k, 2.2, 0, Math.PI * 2); cx.fill(); }
      cx.restore();
    }
    function threadPath(a, b) {
      const A = HOMES[a], B = HOMES[b];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      return { A, B, cxp: CX + (mx - CX) * 0.35, cyp: CY + (my - CY) * 0.35 };
    }
    function burst(x, y) { for (let i = 0; i < 28; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120; particles.push({ x: OX + x, y: OY + y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: ["#d7261e", "#f2b705", "#f06b8f"][i % 3] }); } }

    const aim = { x: P.W / 2, y: P.H / 2 + 120, show: false, touching: false };
    let lastT = now();
    function render() {
      const T = now(), real = Math.min(0.05, (T - lastT) / 1000), t = T / 1000; lastT = T;
      const step = nowStep(), ph = phaseOfStep(step);
      if (!bgCanvas) buildBg();
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(bgCanvas, 0, 0);
      cx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * offX, DPR * offY);
      cx.save(); cx.beginPath(); cx.ellipse(CX, CY, P.RX, P.RY, 0, 0, Math.PI * 2); cx.clip();
      if (S.rule === "nursery") { cx.beginPath(); cx.ellipse(CX, CY, P.RX, P.RY, 0, 0, Math.PI * 2); cx.ellipse(CX, CY, P.RX * P.SHALLOW, P.RY * P.SHALLOW, 0, 0, Math.PI * 2); cx.fillStyle = "rgba(215,38,30,.18)"; cx.fill("evenodd"); }
      if (ph.phase === "fish" && ph.spring) { cx.fillStyle = "rgba(240,107,143,.08)"; cx.fillRect(OX, OY, P.W, P.H); }
      cx.restore();

      // hearts where fry were born
      for (let i = hearts.length - 1; i >= 0; i--) { const k = (T - hearts[i].t) / 1600; if (k > 1) hearts.splice(i, 1); }
      cx.textAlign = "center"; cx.textBaseline = "alphabetic";
      for (const h of hearts) { const k = (T - h.t) / 1600; if (k < 0) continue; cx.globalAlpha = 1 - k; cx.fillStyle = "#f06b8f"; cx.font = `${16 + k * 6}px sans-serif`; cx.fillText("♥", OX + h.x, OY + h.y - 10 - k * 22); cx.globalAlpha = 1; }

      // the fish, between the two frames around the render time
      const rs = step - DELAY;
      let A = null, B = null;
      for (let i = frames.length - 1; i >= 0; i--) { if (frames[i].s <= rs) { A = frames[i]; B = frames[i + 1] || frames[i]; break; } }
      if (!A && frames.length) A = B = frames[0];
      if (A) {
        const k = B === A ? 0 : Math.max(0, Math.min(1, (rs - A.s) / (B.s - A.s)));
        for (const [id, q] of B.fish) {
          const p = A.fish.get(id);
          if (p) drawFish(p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, lerpAngle(p[2], q[2], k), q[3] === 1, id, t, 1);
          else drawFish(q[0], q[1], q[2], q[3] === 1, id, t, k);
        }
        for (const [id, p] of A.fish) if (!B.fish.has(id)) drawFish(p[0], p[1], p[2], p[3] === 1, id, t, 1 - k);
        const ka = A.koi, kb = B.koi;
        if (kb || ka) {
          const kk = ka && kb ? { x: ka.x + (kb.x - ka.x) * k, y: ka.y + (kb.y - ka.y) * k, h: lerpAngle(ka.h, kb.h, k) } : kb || ka;
          cx.save(); cx.translate(OX + kk.x, OY + kk.y); cx.rotate(kk.h); cx.scale(FISHZ, FISHZ); cx.shadowColor = "#f2b705"; cx.shadowBlur = 16; cx.fillStyle = "#f2b705"; cx.strokeStyle = LINE; cx.lineWidth = 1.6;
          cx.beginPath(); cx.moveTo(-13, 0); cx.lineTo(-22, -8); cx.lineTo(-20, 0); cx.lineTo(-22, 8); cx.closePath(); cx.fill(); cx.stroke(); cx.beginPath(); cx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); cx.restore();
        }
      }

      if (ph.phase === "meet") { cx.save(); cx.beginPath(); cx.ellipse(CX, CY, P.RX, P.RY, 0, 0, Math.PI * 2); cx.clip(); cx.fillStyle = "rgba(232,244,246,.72)"; cx.fillRect(OX, OY, P.W, P.H); cx.strokeStyle = "rgba(31,42,92,.25)"; cx.lineWidth = 1.5; for (let i = 0; i < 10; i++) { cx.beginPath(); cx.moveTo(OX + 80 + i * 95, OY + 40); cx.lineTo(OX + 120 + i * 90, OY + 330); cx.lineTo(OX + 70 + i * 97, OY + 660); cx.stroke(); } cx.restore(); }

      // promises: red threads; broken ones snap
      cx.save(); cx.lineWidth = 3;
      for (const k of S.promises) {
        const [a, b] = k.split("-").map(Number); if (!HOMES[a] || !HOMES[b]) continue;
        const { A: PA, B: PB, cxp, cyp } = threadPath(a, b);
        cx.strokeStyle = "#d7261e"; cx.setLineDash([2, 6]); cx.lineDashOffset = -t * 20; cx.beginPath(); cx.moveTo(PA.x, PA.y); cx.quadraticCurveTo(cxp, cyp, PB.x, PB.y); cx.stroke();
      }
      cx.setLineDash([]);
      for (let i = snaps.length - 1; i >= 0; i--) {
        const s = snaps[i], k = (T - s.t) / 2200; if (k > 1) { snaps.splice(i, 1); continue; }
        if (!HOMES[s.a] || !HOMES[s.b]) continue;
        const { A: PA, B: PB, cxp, cyp } = threadPath(s.a, s.b);
        cx.globalAlpha = 1 - k; cx.strokeStyle = "#7a1010";
        cx.beginPath(); cx.moveTo(PA.x, PA.y); cx.quadraticCurveTo(cxp, cyp + k * 60, (PA.x + cxp) / 2, (PA.y + cyp) / 2 + k * 80); cx.stroke();
        cx.beginPath(); cx.moveTo(PB.x, PB.y); cx.quadraticCurveTo(cxp, cyp + k * 60, (PB.x + cxp) / 2, (PB.y + cyp) / 2 + k * 80); cx.stroke();
        cx.globalAlpha = 1;
      }
      cx.restore();

      // nets: thrown from the shore, sinking, then hauled
      if (ghost && T - ghost.t0 > 3000) ghost = null; // a repeated key: no new row comes
      const nets = [...throws.entries()];
      if (ghost) nets.push([0, ghost]);
      for (const [id, n] of nets) {
        const since = (T - n.t0) / 1000, r = n.fine ? P.R_FINE : P.R_COARSE, f = S.fams[n.seat], color = f ? f.color : LINE, sh = SHORE[n.seat] || { x: CX, y: CY };
        if (n.haul === null && since > 4) { throws.delete(id); continue; }
        if (n.haul !== null && T - n.tHaul > 1200) { throws.delete(id); continue; }
        if (since < 0.25) {
          const k = since / 0.25, x = sh.x + (OX + n.x - sh.x) * k, y = sh.y + (OY + n.y - sh.y) * k - Math.sin(k * Math.PI) * 60;
          cx.strokeStyle = color; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(sh.x, sh.y); cx.lineTo(x, y); cx.stroke();
          cx.fillStyle = color; cx.beginPath(); cx.arc(x, y, 6 + k * 6, 0, Math.PI * 2); cx.fill();
        } else if (n.haul === null) {
          const k = 1.15 - 0.15 * Math.min(1, (since - 0.25) / 0.35);
          cx.strokeStyle = color; cx.globalAlpha = 0.5; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(sh.x, sh.y); cx.lineTo(OX + n.x, OY + n.y); cx.stroke(); cx.globalAlpha = 1;
          drawNet(n.x, n.y, r, n.fine, color, k, n.breach);
        } else {
          const k = Math.max(0, 1 - (T - n.tHaul) / 900); cx.globalAlpha = k; drawNet(n.x, n.y, r * (0.55 + 0.45 * k), n.fine, color, 1, n.breach); cx.globalAlpha = 1;
          if (n.haul.slipped && !n.fine) for (let i = 0; i < Math.min(n.haul.slipped, 8); i++) { const ang = i * 0.8 + n.t0; cx.fillStyle = "rgba(255,240,200,.95)"; cx.beginPath(); cx.arc(OX + n.x + Math.cos(ang) * r * (1.6 - k * 0.6), OY + n.y + Math.sin(ang) * r * (1.6 - k * 0.6), 2.4 * FISHZ, 0, Math.PI * 2); cx.fill(); }
        }
      }

      // stamps: 违 where a rule was broken, 失 at a house that broke a promise
      for (let i = stamps.length - 1; i >= 0; i--) {
        const s = stamps[i], k = (T - s.t) / 1000; if (k > 2.4) { stamps.splice(i, 1); continue; }
        const x = s.home !== undefined ? HOMES[s.home].x - 40 : OX + s.x + 30, y = s.home !== undefined ? HOMES[s.home].y - 40 : OY + s.y - 30;
        sealAt(x, y, s.ch, 36 * (k < 0.15 ? 1.8 - k * 5 : 1), -0.2, Math.min(1, 2.4 - k), s.ch === "失" ? "#7a1010" : "#d7261e");
      }
      // flyers: seals between houses, fish from a net to its house
      for (let i = flyers.length - 1; i >= 0; i--) {
        const fl = flyers[i], k = (T - fl.t) / 850; if (k > 1) { flyers.splice(i, 1); continue; }
        if (k < 0) continue;
        if (fl.seal) { const PA = HOMES[fl.from], PB = HOMES[fl.to]; if (!PA || !PB) continue; sealAt(PA.x + (PB.x - PA.x) * k, PA.y + (PB.y - PA.y) * k - Math.sin(k * Math.PI) * 80, fl.seal, 30, k * 6, 1); continue; }
        const H = HOMES[fl.seat]; if (!H) continue;
        const x = OX + fl.x + (H.x - OX - fl.x) * k, y = OY + fl.y + (H.y - OY - fl.y) * k - Math.sin(k * Math.PI) * 50;
        cx.fillStyle = fl.fry ? "#fff0c8" : "#e8452c"; cx.strokeStyle = LINE; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(x, y, fl.fry ? 4 : 8, fl.fry ? 2 : 4, k * 8, 0, Math.PI * 2); cx.fill(); cx.stroke();
      }
      // floats: +n, empty, and why
      for (let i = floats.length - 1; i >= 0; i--) {
        const fl = floats[i], k = (T - fl.t) / 1800; if (k > 1) { floats.splice(i, 1); continue; }
        const y = OY + fl.y - 30 * k; cx.globalAlpha = 1 - k * k; cx.textAlign = "center"; cx.textBaseline = "alphabetic"; cx.lineWidth = 4; cx.strokeStyle = "#fff6e3";
        cx.font = `900 ${fl.big ? 26 : 18}px Nunito, system-ui, sans-serif`; cx.strokeText(fl.text, OX + fl.x, y); cx.fillStyle = fl.color; cx.fillText(fl.text, OX + fl.x, y);
        if (fl.sub && fl.big) { cx.font = "800 15px Nunito, system-ui, sans-serif"; cx.strokeText(fl.sub, OX + fl.x, y + 21); cx.fillStyle = LINE; cx.fillText(fl.sub, OX + fl.x, y + 21); }
        cx.globalAlpha = 1;
      }
      for (const p of particles) { p.x += p.vx * real; p.y += p.vy * real; p.vy += 140 * real; p.life -= real * 1.2; }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
      for (const p of particles) { cx.globalAlpha = Math.max(0, p.life); cx.fillStyle = p.c; cx.fillRect(p.x - 2, p.y - 2, 4, 4); }
      cx.globalAlpha = 1;

      // my aim: true net size, with the drying time drawn around it
      const m = me();
      if (m && aim.show && ph.phase === "fish" && !S.ended) {
        const r = m.hasFine && S.useFine ? P.R_FINE : P.R_COARSE, p = Math.max(0, Math.min(1, 1 - (S.myNext - step) / P.COOLDOWN)), ax = OX + aim.x, ay = OY + aim.y;
        cx.setLineDash([5, 5]); cx.strokeStyle = p >= 1 ? "#fff6e3" : "rgba(255,246,227,.45)"; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(ax, ay, r, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]);
        if (p < 1) { cx.strokeStyle = "#f2b705"; cx.lineWidth = 4; cx.beginPath(); cx.arc(ax, ay, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); cx.stroke(); }
        if (aim.touching) { cx.strokeStyle = "rgba(255,246,227,.6)"; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(ax, ay + r); cx.lineTo(ax, ay + r + 50); cx.stroke(); }
      }
      for (const f of S.fams) drawHouse(f, t, ph);
      const sg = ph.phase === "meet" ? ["冬", "WINTER"] : ph.phase === "over" || S.ended ? ["终", "THE END"] : ph.spring ? ["春", "SPRING"] : ["夏", "SUMMER"];
      sealAt(OX + 10, OY + 6, sg[0], 46, -0.08, 1); cx.font = "900 13px Nunito, system-ui, sans-serif"; cx.fillStyle = LINE; cx.textAlign = "center"; cx.textBaseline = "alphabetic"; cx.fillText(sg[1], OX + 10, OY + 44);
      if (S.rule !== "none") { sealAt(VW - OX - 10, OY + 6, RULES[S.rule].g, 46, 0.08, 1); cx.font = "900 13px Nunito, system-ui, sans-serif"; cx.fillStyle = LINE; cx.fillText({ ban: "NO FINE NETS", spring: "NO SPRING FISHING", nursery: "SHALLOWS CLOSED" }[S.rule], VW - OX - 10, OY + 44); }
      if (ph.phase === "fish" && ph.spring && S.rule === "spring") { cx.save(); cx.strokeStyle = "rgba(215,38,30,.75)"; cx.lineWidth = 10; cx.setLineDash([16, 12]); cx.beginPath(); cx.ellipse(CX, CY, P.RX - 6, P.RY - 6, 0, 0, Math.PI * 2); cx.stroke(); cx.restore(); }

      // the meeting opens and closes with the clock
      if (!S.ended) {
        if (ph.phase === "meet" && S.meetFor !== ph.year) { S.meetFor = ph.year; openMeeting(ph.year); }
        if (ph.phase === "meet" && $("fact-grown")) $("fact-grown").textContent = counts.a;
        if (ph.phase === "meet") $("meet-left").style.width = `${Math.max(0, 100 - ((ph.into - P.FISH) / P.MEET) * 100)}%`;
        if (ph.phase !== "meet" && !$("meeting").hidden && step - (S.meetFor * P.YEAR) > 5) $("meeting").hidden = true;
      }
      updateHud(ph, step);
      requestAnimationFrame(render);
    }

    // ---------- the panel ----------
    let lastFamsKey = "";
    function renderFams() {
      const key = S.fams.map((f) => [f.basket, f.part, f.hasFine, f.breaches, f.broken, moodOf(f), [...S.promises].filter((k) => k.split("-").includes(String(f.seat))).length].join(",")).join("|");
      if (key === lastFamsKey) return; lastFamsKey = key;
      $("fams").innerHTML = S.fams.map((f) => {
        const promised = [...S.promises].some((k) => k.split("-").map(Number).includes(f.seat));
        const kept = builtValue(f.part) + f.basket;
        return `<button type="button" class="fam ${f.seat === ME ? "me" : ""}" data-seat="${f.seat}" ${ME === null || f.seat === ME ? "disabled" : ""} aria-label="${esc(f.name)}${f.bot ? " (bot)" : ""}: ${kept} fish kept, ${PARTS[f.part][0]}${f.seat === ME || ME === null ? "" : ". Send a seal or ask for a promise"}"><div class="chips">${f.bot ? '<span class="chip bot">BOT</span>' : ""}${f.hasFine ? '<span class="chip fine">FINE NET</span>' : ""}${promised ? '<span class="chip promise">PROMISED</span>' : ""}${f.breaches ? `<span class="chip breach">broke rule ×${f.breaches}</span>` : ""}${f.broken ? `<span class="chip breach">broke promise ×${f.broken}</span>` : ""}</div><div class="pic" style="--c:${f.color}">${portrait(f.kind, moodOf(f), f.seat)}</div><div class="line"><span class="nm">${esc(f.seat === ME ? `${f.name} (you)` : f.name)}</span><span class="ct" style="color:${f.color}">${kept}</span></div><div class="line"><span class="note">${f.bot ? BOT_NOTE[f.kind] : "basket " + f.basket}</span><span class="note">${PARTS[f.part][0]}</span></div></button>`;
      }).join("");
    }
    function updateHud(ph, step) {
      $("year").textContent = ph.year;
      const into = ph.phase === "over" || S.ended ? P.YEAR : ph.into;
      $("seasonfill").style.width = `${Math.min(100, (into / P.YEAR) * 100)}%`;
      if (frames.length) { $("adults").textContent = counts.a; $("fry").textContent = counts.f; cv.style.setProperty("--life", Math.max(0, Math.min(1, (counts.a / S.start - 0.1) / 0.6)).toFixed(3)); }
      const m = me();
      if (m) {
        const np = PARTS[m.part + 1];
        $("basket").textContent = m.basket; $("ab-basket").textContent = m.basket;
        $("nextpart").textContent = np ? `Next winter: ${np[0]} (${np[2]} fish)` : "Your pagoda is finished";
        $("partbar").style.width = `${np ? Math.min(100, (m.basket / np[2]) * 100) : 100}%`;
        $("ab-next").textContent = np ? `${np[0]} ${Math.min(m.basket, np[2])}/${np[2]}` : "pagoda done";
        const canBuy = !m.hasFine && m.basket >= P.FINE_COST && ph.phase === "fish" && !S.ended;
        $("buy").disabled = !canBuy; $("ab-buy").disabled = !canBuy;
        $("buy").textContent = m.hasFine ? "You own a fine net" : `Buy a fine net · ${P.FINE_COST} fish`;
        $("ab-buy").textContent = m.hasFine ? "Fine net ✓" : "Fine net · 20";
        $("toggle").hidden = !m.hasFine; $("ab-toggle").hidden = !m.hasFine;
        $("toggle").textContent = S.useFine ? "Use coarse net" : "Use fine net"; $("ab-toggle").textContent = S.useFine ? "Use coarse" : "Use fine";
        const promised = S.fams.filter((o) => o.seat !== ME && S.promises.has(pkey(ME, o.seat)));
        $("netdesc").textContent = (m.hasFine && S.useFine ? "Fine net: keeps everything in the ring, fry included." : "Coarse net: grown fish only. Fry slip through.") + (promised.length ? ` You promised ${promised.map((o) => o.name).join(" and ")} coarse nets until winter.` : "");
      }
      renderFams();
    }

    // ---------- input: a click throws; a finger presses, drags, lifts ----------
    function canvasPoint(e) { const r = cv.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); }
    const FINGER_LIFT = 70; // the ring sits above the finger, so the finger does not hide it
    cv.addEventListener("pointerdown", (e) => {
      if (ME === null) return;
      const w = canvasPoint(e);
      sfx.enable();
      if (e.pointerType === "mouse") { Object.assign(aim, { x: w.x, y: w.y, show: true, touching: false }); throwNet(w.x, w.y); return; }
      cv.setPointerCapture(e.pointerId); Object.assign(aim, { x: w.x, y: w.y - FINGER_LIFT, show: true, touching: true });
    });
    cv.addEventListener("pointermove", (e) => { const w = canvasPoint(e); if (e.pointerType === "mouse") Object.assign(aim, { x: w.x, y: w.y, show: true, touching: false }); else if (aim.touching) { aim.x = w.x; aim.y = w.y - FINGER_LIFT; } });
    cv.addEventListener("pointerup", (e) => { if (e.pointerType === "mouse" || !aim.touching) return; aim.touching = false; throwNet(aim.x, aim.y); });
    cv.addEventListener("pointercancel", () => (aim.touching = false));
    cv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") aim.show = false; });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { $("react").hidden = true; return; }
      if (ME === null || e.target.closest("input, textarea")) return;
      const k = e.key;
      if (k === "b" || k === "B") return buy();
      if (k === "f" || k === "F") return toggle();
      if (document.activeElement !== cv) return;
      const d = 22;
      if (k.startsWith("Arrow")) { e.preventDefault(); aim.show = true; if (k === "ArrowLeft") aim.x -= d; if (k === "ArrowRight") aim.x += d; if (k === "ArrowUp") aim.y -= d; if (k === "ArrowDown") aim.y += d; aim.x = Math.max(20, Math.min(P.W - 20, aim.x)); aim.y = Math.max(20, Math.min(P.H - 20, aim.y)); }
      if (k === " " || k === "Enter") { e.preventDefault(); aim.show = true; throwNet(aim.x, aim.y); }
    });
    cv.addEventListener("focus", () => (aim.show = true));
    if (ME !== null) {
      $("buy").addEventListener("click", buy); $("ab-buy").addEventListener("click", buy);
      $("toggle").addEventListener("click", toggle); $("ab-toggle").addEventListener("click", toggle);
    }
    $("sound").addEventListener("click", () => { SOUND.on = !SOUND.on; sfx.enable(); $("sound").textContent = SOUND.on ? "sound on" : "sound off"; $("sound").setAttribute("aria-pressed", String(SOUND.on)); });
    for (const b of $("vote-options").querySelectorAll("button")) b.addEventListener("click", async () => {
      if (ME === null || now() - (S.meetOpened || 0) < 600) return;
      const before = S.votes.get(ME);
      S.votes.set(ME, b.dataset.v); renderCouncil(); sfx.chime(2);
      const res = await post("/vote", { rule: b.dataset.v });
      if (!res.ok) { if (before) S.votes.set(ME, before); else S.votes.delete(ME); renderCouncil(); toast(REASONS[res.reason] || res.reason); }
    });
    $("fams").addEventListener("click", (e) => {
      const b = e.target.closest(".fam"); if (!b || b.disabled || ME === null) return;
      const to = S.fams[Number(b.dataset.seat)]; if (!to || to.seat === ME) return;
      const r = b.getBoundingClientRect(), box = $("react");
      const ph = phaseOfStep(nowStep());
      const canAsk = ph.phase === "fish" && !S.promises.has(pkey(ME, to.seat)) && !S.asks.some((a) => (a.from === ME && a.to === to.seat) || (a.from === to.seat && a.to === ME));
      box.innerHTML = `<div class="seals">${Object.entries(SEALS).map(([s, w]) => `<button type="button" data-s="${s}" aria-label="Send ${esc(to.name)} ${w}"><span>${s}</span><small>${w}</small></button>`).join("")}</div>${canAsk ? `<button type="button" class="ask" id="ask">Ask ${esc(to.name)} for a promise<small>“Coarse nets only, until winter?” Nothing enforces it; everyone sees if it breaks.</small></button>` : ""}`;
      box.hidden = false;
      const bw = Math.min(window.innerWidth - 16, 4 * 62 + 24), left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2));
      box.style.left = `${left}px`; box.style.top = `${Math.max(8, r.top - (canAsk ? 130 : 78))}px`;
      for (const x of box.querySelectorAll(".seals button")) x.addEventListener("click", async () => { box.hidden = true; const res = await post("/seal", { to: to.seat, seal: x.dataset.s }); if (!res.ok) toast(REASONS[res.reason] || res.reason); });
      if (canAsk) $("ask").addEventListener("click", async () => { box.hidden = true; const res = await post("/promise", { to: to.seat }); if (!res.ok) toast(REASONS[res.reason] || res.reason); else toast(`You asked ${to.name}. Waiting for an answer…`); });
      box.querySelector("button").focus();
    });
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#react") && !e.target.closest(".fam")) $("react").hidden = true; });

    // ---------- sound: synthesised, off until you turn it on ----------
    const SOUND = { on: false };
    const sfx = (() => {
      let ac = null;
      const ok = () => SOUND.on && ac;
      const tone = (f, d, type = "sine", g = 0.12, when = 0) => { if (!ok()) return; const o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.frequency.value = f; v.gain.setValueAtTime(g, ac.currentTime + when); v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + d); o.connect(v).connect(ac.destination); o.start(ac.currentTime + when); o.stop(ac.currentTime + when + d + 0.05); };
      const noise = (d, g = 0.2, freq = 900, when = 0) => { if (!ok()) return; const n = ac.createBufferSource(), b = ac.createBuffer(1, Math.floor(ac.sampleRate * d), ac.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); n.buffer = b; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; const v = ac.createGain(); v.gain.value = g; n.connect(f).connect(v).connect(ac.destination); n.start(ac.currentTime + when); };
      const PENTA = [523, 587, 659, 784, 880, 1047, 1175];
      return {
        enable() { if (!ac && SOUND.on) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } },
        splash() { noise(0.35, 0.25, 700); },
        haul(n) { for (let i = 0; i < Math.min(n, 6); i++) tone(PENTA[i], 0.25, "triangle", 0.08, i * 0.06); if (!n) tone(196, 0.2, "sine", 0.08); },
        chime(i) { tone(PENTA[i % PENTA.length], 0.4, "sine", 0.1); },
        gong() { tone(98, 2.4, "sine", 0.25); tone(147, 1.8, "sine", 0.08); },
        stamp() { tone(140, 0.15, "square", 0.06); noise(0.08, 0.3, 300); },
        snap() { noise(0.12, 0.4, 1800); tone(90, 0.3, "sawtooth", 0.05); },
        crackle() { for (let i = 0; i < 9; i++) noise(0.05, 0.25, 2500, i * 0.07 + Math.random() * 0.03); },
        tick() { tone(330, 0.05, "square", 0.03); },
      };
    })();

    // ---------- start ----------
    applySnapshot(boot.snapshot);
    for (const r of boot.snapshot.rows) noteRow(r, true);
    const bootPh = phaseOfStep(boot.snapshot.step);
    if (bootPh.phase === "meet") S.meetFor = 0; // opens on the first frame
    for (const k of ["spring1", "fry1"]) if (boot.snapshot.step > P.YEAR) S.seen.add(k);
    new ResizeObserver(resize).observe(cv);
    resize();
    if (document.fonts && document.fonts.load) document.fonts.load(`22px ${ZH}`, "明年无鱼春夏冬终").then(() => (bgCanvas = null)).catch(() => {});
    requestAnimationFrame(render);
    if (ME !== null) { aim.show = true; cv.focus({ preventScroll: true }); }

    const conn = $("conn");
    const es = new EventSource(`/l/${code}/events?after=${S.lastId}`);
    es.onopen = () => { conn.textContent = "live"; conn.className = "tiny conn ok"; };
    es.onerror = () => { conn.textContent = "reconnecting…"; conn.className = "tiny conn bad"; };
    es.addEventListener("reload", () => location.reload());
    es.addEventListener("snapshot", (e) => { applySnapshot(JSON.parse(e.data)); conn.textContent = "live"; conn.className = "tiny conn ok"; });
    es.addEventListener("frame", (e) => onFrame(JSON.parse(e.data)));
    es.addEventListener("row", (e) => {
      const r = JSON.parse(e.data);
      if (r.id <= S.lastId) return;
      S.lastId = r.id;
      noteRow(r);
      applyRow(r);
    });
  }
})();
