// The site's own pictures (DESIGN.md "The site"): the four game icons, the
// five small step pictures per game on /how, and the home page's lake scene.
// SVG code copied from the site plan v8 mock, which Claude wrote in chat; the
// portraits stay art.js's. Drawing only.
export const ICON: Record<string, string> = {
  rush: `<svg viewBox="0 0 40 40"><path d="M5 25 L35 25 L30 32 L10 32 Z" fill="#fff7ef"/><path d="M20 23 L20 6 L31 21 Z" fill="#fff7ef" opacity=".85"/></svg>`,
  party: `<svg viewBox="0 0 40 40"><path d="M9 34 V6" stroke="#fff7ef" stroke-width="2.4"/><path d="M9 7 L30 12 L9 18 Z" fill="#fff7ef"/><circle cx="27" cy="27" r="6" fill="none" stroke="#fff7ef" stroke-width="2.6"/></svg>`,
  poach: `<svg viewBox="0 0 40 40"><path d="M4 20 Q20 6 36 20 Q20 34 4 20 Z" fill="none" stroke="#fff7ef" stroke-width="2.4"/><circle cx="20" cy="20" r="5.5" fill="#fff7ef"/></svg>`,
  hold: `<svg viewBox="0 0 40 40"><path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" fill="none" stroke="#fff7ef" stroke-width="2.4"/><circle cx="20" cy="20" r="5" fill="#fff7ef"/></svg>`,
};
// tiny step pictures, one vocabulary for all four games
const W = `<path d="M0 50 Q10 46 20 50 T40 50 T60 50 T80 50 T100 50 V80 H0 Z" fill="#2b8571" opacity=".35"/>`;
const boat = (x: number, y: number, c = "#c8372d", s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 0 H12 L8 7 H-8 Z" fill="${c}"/><path d="M0 -2 V-18 L10 -3 Z" fill="#f4e6cf" stroke="#1f1a24" stroke-width="1"/></g>`;
const fishg = (x: number, y: number, c = "#f08a3c") => `<g transform="translate(${x} ${y})"><ellipse rx="5" ry="2.6" fill="${c}"/><path d="M-5 0 L-9 -3 L-9 3 Z" fill="${c}"/></g>`;
const net = (x: number, y: number, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#1f1a24" stroke-width="1.6" stroke-dasharray="3 2"/>`;
const tap = (x: number, y: number) => `<g transform="translate(${x} ${y})"><circle r="7" fill="none" stroke="#c9921f" stroke-width="2"/><circle r="2.5" fill="#c9921f"/></g>`;
const dock = (x: number, y: number) => `<rect x="${x}" y="${y}" width="22" height="5" fill="#8a5a34"/><path d="M${x + 4} ${y} V${y - 12} H${x + 18} V${y}" fill="#f4e6cf" stroke="#1f1a24" stroke-width="1"/><path d="M${x + 1} ${y - 12} L${x + 11} ${y - 20} L${x + 21} ${y - 12} Z" fill="#c8372d"/>`;
const svg = (inner: string) => `<svg viewBox="0 0 100 80" aria-hidden="true">${W}${inner}</svg>`;
export const PIC: Record<string, string[]> = {
  rush: [
    svg(boat(30, 48) + `<path d="M42 46 Q58 40 70 46" fill="none" stroke="#1f1a24" stroke-dasharray="3 3"/>` + tap(76, 48)),
    svg(boat(30, 48) + net(58, 54) + fishg(55, 54) + fishg(62, 57)),
    svg(dock(66, 50) + boat(44, 49) + fishg(80, 34) + `<text x="70" y="22" font-size="10" font-weight="700" fill="#2b8571">+1</text>`),
    svg(boat(36, 48, "#c8372d") + boat(62, 48, "#5a6fb0") + `<path d="M46 40 L52 34 M48 46 L56 44" stroke="#c9921f" stroke-width="2"/>` + fishg(70, 34) + fishg(78, 40)),
    svg(fishg(50, 40, "#f3c13a") + `<circle cx="50" cy="40" r="12" fill="none" stroke="#f3c13a" stroke-width="2"/><text x="28" y="22" font-size="11" font-weight="800" fill="#c8372d">×2</text>`),
  ],
  party: [
    svg(fishg(40, 40) + fishg(48, 34) + fishg(56, 41) + `<path d="M36 50 Q48 30 60 50" fill="none" stroke="#2b8571" stroke-width="2"/>` + tap(48, 38)),
    svg(`<rect x="22" y="36" width="4" height="14" fill="#c8372d"/><rect x="74" y="36" width="4" height="14" fill="#c8372d"/>` + boat(36, 50, "#c9921f", .8) + fishg(64, 44, "#f3c13a")),
    svg(`<rect x="12" y="14" width="76" height="9" rx="4" fill="#ece8de"/><rect x="42" y="14" width="16" height="9" fill="#2b8571"/><rect x="49" y="10" width="3" height="17" fill="#1f1a24"/>` + fishg(50, 52, "#7da3bd")),
    `<svg viewBox="0 0 100 80" aria-hidden="true"><rect width="100" height="80" fill="#1d2140"/><circle cx="50" cy="44" r="22" fill="#ffd27a" opacity=".3"/><circle cx="50" cy="40" r="5" fill="#e8402c"/>${fishg(44, 50)}${fishg(58, 46)}</svg>`,
    svg(`<circle cx="50" cy="46" r="14" fill="none" stroke="#1f1a24" stroke-width="1.4" stroke-dasharray="2 2"/>` + fishg(46, 44) + fishg(54, 48) + `<text x="10" y="22" font-size="10" font-weight="700" fill="#1f1a24">S</text><text x="44" y="22" font-size="12" font-weight="700" fill="#1f1a24">M</text><text x="80" y="22" font-size="15" font-weight="800" fill="#c8372d">L</text>`),
  ],
  poach: [
    `<svg viewBox="0 0 100 80" aria-hidden="true"><rect x="30" y="12" width="40" height="54" rx="6" fill="#1f1a24"/><text x="50" y="46" text-anchor="middle" font-size="22" fill="#f3c13a">?</text></svg>`,
    svg(boat(36, 48) + boat(60, 48, "#5a6fb0") + `<circle cx="48" cy="34" r="9" fill="none" stroke="#c9921f" stroke-width="2"/>` + fishg(48, 34, "#f6b6a4")),
    svg(`<rect x="46" y="34" width="8" height="14" rx="2" fill="#c8372d"/><circle cx="50" cy="32" r="3" fill="#f3c13a"/>` + boat(22, 52, "#5a6fb0", .7) + `<path d="M32 50 H44" stroke="#1f1a24" stroke-dasharray="2 2"/>`),
    `<svg viewBox="0 0 100 80" aria-hidden="true"><circle cx="50" cy="42" r="22" fill="#ece8de"/><circle cx="50" cy="16" r="6" fill="#c8372d"/><circle cx="76" cy="42" r="6" fill="#2b8571"/><circle cx="50" cy="68" r="6" fill="#5a6fb0"/><circle cx="24" cy="42" r="6" fill="#c9921f"/><path d="M50 26 L50 34" stroke="#1f1a24" stroke-width="2"/></svg>`,
    `<svg viewBox="0 0 100 80" aria-hidden="true"><rect x="14" y="34" width="72" height="12" rx="6" fill="#ece8de"/><rect x="14" y="34" width="34" height="12" rx="6" fill="#c9921f"/><path d="M43 30 V50" stroke="#c8372d" stroke-width="2.4"/><text x="58" y="26" font-size="11" font-weight="800" fill="#c8372d">−5</text></svg>`,
  ],
  hold: [
    `<svg viewBox="0 0 100 80" aria-hidden="true"><rect x="22" y="20" width="18" height="26" rx="3" fill="#fffdf8" stroke="#1f1a24"/><rect x="41" y="18" width="18" height="26" rx="3" fill="#fffdf8" stroke="#c9921f" stroke-width="2"/><rect x="60" y="20" width="18" height="26" rx="3" fill="#fffdf8" stroke="#1f1a24"/>${tap(50, 60)}</svg>`,
    svg(net(36, 50, 10) + fishg(36, 50) + `<ellipse cx="68" cy="52" rx="11" ry="7" fill="#3c8f6a"/>` + fishg(68, 40)),
    svg(`<path d="M20 42 Q50 22 80 42" fill="none" stroke="#1f1a24" stroke-width="1.6" marker-end="url(#a)"/><path d="M44 30 V48 M50 30 V48 M56 30 V48 M42 36 H58" stroke="#c99a5a" stroke-width="2"/>`),
    `<svg viewBox="0 0 100 80" aria-hidden="true"><path d="M30 20 L44 28 L44 44 L30 52 L16 44 L16 28 Z" fill="#c8372d" opacity=".35" stroke="#c8372d"/><path d="M58 20 L72 28 L72 44 L58 52 L44 44 L44 28 Z" fill="none" stroke="#1f1a24" stroke-dasharray="3 2"/><text x="52" y="42" font-size="14" font-weight="800" fill="#c8372d">+</text></svg>`,
    `<svg viewBox="0 0 100 80" aria-hidden="true"><path d="M0 34 H100 V52 H0 Z" fill="#9b9aa3" opacity=".5"/>${net(30, 43, 8)}${net(52, 43, 8)}${net(74, 43, 8)}</svg>`,
  ],
};
export const SCENE: string = `<svg viewBox="0 0 500 400" aria-hidden="true">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#28264f"/><stop offset=".55" stop-color="#c86a5a"/><stop offset="1" stop-color="#f2a35e"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
  <rect width="500" height="400" fill="url(#sky)"/>
  <circle cx="370" cy="130" r="34" fill="#ffd9a0" opacity=".85"/>
  <path d="M0 210 L70 150 L130 200 L200 140 L280 205 L360 160 L430 200 L500 170 V240 H0 Z" fill="#2c3b4a"/>
  <path d="M0 230 H500 V400 H0 Z" fill="#56703f"/>
  <ellipse cx="250" cy="300" rx="230" ry="82" fill="#c9a56b"/>
  <ellipse cx="250" cy="300" rx="218" ry="74" fill="#195d68"/>
  <ellipse cx="250" cy="300" rx="150" ry="44" fill="#1f7579" opacity=".6"/>
  <g fill="#fff2dc" opacity=".55"><ellipse cx="160" cy="290" rx="30" ry="2"/><ellipse cx="320" cy="320" rx="40" ry="2"/><ellipse cx="260" cy="270" rx="22" ry="2"/></g>
  <g>${[[170, 300], [182, 306], [190, 297], [300, 285], [312, 292], [322, 284], [260, 330], [272, 336]].map(([x, y]: number[]) => `<g transform="translate(${x} ${y})"><ellipse rx="6" ry="3" fill="#f08a3c"/><path d="M-6 0 L-10 -3 L-10 3 Z" fill="#f08a3c"/></g>`).join("")}</g>
  <g transform="translate(130 282)"><path d="M-22 0 H22 L15 12 H-15 Z" fill="#c8372d"/><path d="M2 -2 V-34 L22 -4 Z" fill="#f4e6cf"/></g>
  <g transform="translate(360 312)"><path d="M-22 0 H22 L15 12 H-15 Z" fill="#2b8571"/><path d="M2 -2 V-34 L22 -4 Z" fill="#f4e6cf"/></g>
  <g transform="translate(250 262) scale(.8)"><path d="M-22 0 H22 L15 12 H-15 Z" fill="#c9921f"/><path d="M2 -2 V-34 L22 -4 Z" fill="#f4e6cf"/></g>
  <circle cx="200" cy="322" r="26" fill="url(#glow)"/><circle cx="200" cy="320" r="5" fill="#e8402c"/>
  <g transform="translate(60 236)"><rect x="-14" y="-16" width="28" height="18" fill="#efe1c2"/><path d="M-18 -16 L0 -30 L18 -16 Z" fill="#b8352a"/></g>
  <g transform="translate(445 246)"><rect x="-14" y="-16" width="28" height="18" fill="#efe1c2"/><path d="M-18 -16 L0 -30 L18 -16 Z" fill="#b8352a"/></g>
</svg>`;

