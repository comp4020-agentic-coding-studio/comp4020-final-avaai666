/* ---------------------------------------------------------------- portraits (original characters, drawn as vectors) */
const INK = "#2b1b17", SKIN = "#f6d4b4";
const ear = (x, y, s = SKIN) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="11" fill="${s}" stroke="${INK}" stroke-width="3"/>`;
const head = (rx = 44, ry = 50, cy = 124) => `${ear(110 - rx + 2, cy + 8)}${ear(110 + rx - 2, cy + 8)}<ellipse cx="110" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
const blush = (o = .55) => `<ellipse cx="84" cy="148" rx="9" ry="4.5" fill="#f2907f" opacity="${o}"/><ellipse cx="136" cy="148" rx="9" ry="4.5" fill="#f2907f" opacity="${o}"/>`;
const eyes = {
  open: `<ellipse cx="92" cy="132" rx="5.5" ry="7.5" fill="${INK}"/><ellipse cx="128" cy="132" rx="5.5" ry="7.5" fill="${INK}"/><circle cx="90" cy="129" r="2.1" fill="#fff"/><circle cx="126" cy="129" r="2.1" fill="#fff"/>`,
  big: `<ellipse cx="91" cy="134" rx="7" ry="9" fill="${INK}"/><ellipse cx="129" cy="134" rx="7" ry="9" fill="${INK}"/><circle cx="88" cy="130" r="2.8" fill="#fff"/><circle cx="126" cy="130" r="2.8" fill="#fff"/><circle cx="93" cy="137" r="1.3" fill="#fff"/><circle cx="131" cy="137" r="1.3" fill="#fff"/>`,
  smile: `<path d="M84 133 Q92 125 100 133 M120 133 Q128 125 136 133" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`,
  sly: `<ellipse cx="92" cy="133" rx="5.5" ry="5" fill="${INK}"/><ellipse cx="128" cy="133" rx="5.5" ry="5" fill="${INK}"/><path d="M84 130 L101 131 M119 131 L136 130" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><circle cx="90" cy="132" r="1.6" fill="#fff"/><circle cx="126" cy="132" r="1.6" fill="#fff"/>`,
  lash: `<ellipse cx="92" cy="132" rx="5.5" ry="7.5" fill="${INK}"/><ellipse cx="128" cy="132" rx="5.5" ry="7.5" fill="${INK}"/><circle cx="90" cy="129" r="2.1" fill="#fff"/><circle cx="126" cy="129" r="2.1" fill="#fff"/><path d="M85 126 L81 122 M99 126 L103 122 M121 126 L117 122 M135 126 L139 122" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
};
const mouths = {
  smile: `<path d="M100 155 Q110 163 120 155" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  calm: `<path d="M103 157 Q110 160 117 157" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  smirk: `<path d="M101 158 Q113 161 122 151" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  grin: `<path d="M95 152 Q110 174 125 152 Z" fill="#8f2b2b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M99 154 L121 154" stroke="#fff" stroke-width="3"/>`,
};
const nose = `<path d="M107 143 Q110 147 113 143" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
const bodyPath = (w = 80) => `M${110 - w - 4} 262 C${110 - w} 222 ${110 - w * .5} 200 110 200 C${110 + w * .5} 200 ${110 + w} 222 ${110 + w + 4} 262 Z`;
const neck = `<path d="M96 160 L96 202 L124 202 L124 160 Z" fill="#e8bd98" stroke="${INK}" stroke-width="3"/>`;
const bg = (c, ring) => `<rect width="220" height="260" fill="${c}"/><circle cx="110" cy="112" r="96" fill="none" stroke="${ring}" stroke-width="14" opacity=".35"/><circle cx="110" cy="112" r="70" fill="none" stroke="${ring}" stroke-width="5" opacity=".25"/>`;
const sealMark = (ch) => `<rect x="12" y="12" width="30" height="30" rx="4" fill="#cf3b2e"/><text x="27" y="35" text-anchor="middle" font-family="Ma Shan Zheng, KaiTi, serif" font-size="22" fill="#f5ead6">${ch}</text>`;

const DRAW = {
  mei: () => `${bg("#f2c7b6", "#d6473a")}
    <path d="M58 130 C52 176 66 200 82 212 L138 212 C154 200 168 176 162 130 Z" fill="#241b22" stroke="${INK}" stroke-width="3"/>
    ${neck}
    <path d="${bodyPath(78)}" fill="#c8372d" stroke="${INK}" stroke-width="3"/>
    <path d="M90 200 Q110 216 130 200 L128 190 Q110 200 92 190 Z" fill="#e8b84d" stroke="${INK}" stroke-width="2.5"/>
    <path d="M104 222 h12 M104 236 h12 M104 250 h12" stroke="#e8b84d" stroke-width="4" stroke-linecap="round"/>
    <circle cx="66" cy="74" r="22" fill="#241b22" stroke="${INK}" stroke-width="3"/><circle cx="154" cy="74" r="22" fill="#241b22" stroke="${INK}" stroke-width="3"/>
    ${head()}
    <path d="M64 126 C60 82 86 66 110 66 C134 66 160 82 156 126 C150 106 140 96 126 94 C120 104 106 108 94 100 C82 100 70 110 64 126 Z" fill="#241b22" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M78 88 l-14 -6 l2 14 Z M142 88 l14 -6 l-2 14 Z" fill="#cf3b2e" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M84 118 Q92 114 100 118 M120 118 Q128 114 136 118" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    ${eyes.open}${nose}${mouths.smile}${blush()}${sealMark("梅")}`,
  wang: () => `${bg("#c2d4df", "#4a7d9c")}
    ${neck}
    <path d="${bodyPath(84)}" fill="#46677c" stroke="${INK}" stroke-width="3"/>
    <rect x="58" y="226" width="22" height="20" rx="3" fill="#6f8ea0" stroke="${INK}" stroke-width="2.4" transform="rotate(-8 69 236)"/>
    ${head(44, 48, 126)}
    <path d="M78 148 C80 198 100 230 110 238 C120 230 140 198 142 148 C132 162 122 168 110 168 C98 168 88 162 78 148 Z" fill="#f3eee6" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M90 152 Q110 140 130 152 Q120 159 110 154 Q100 159 90 152 Z" fill="#f3eee6" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    ${eyes.smile}
    <path d="M80 120 Q92 112 103 121 M117 121 Q128 112 140 120" fill="none" stroke="#f3eee6" stroke-width="7" stroke-linecap="round"/>
    <path d="M80 120 Q92 112 103 121 M117 121 Q128 112 140 120" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
    <path d="M76 140 q4 4 2 9 M144 140 q-4 4 -2 9" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    ${nose}${blush(.35)}
    <path d="M10 104 Q110 14 210 104 Q110 122 10 104 Z" fill="#d7ae63" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M110 30 L40 104 M110 30 L70 110 M110 30 L110 113 M110 30 L150 110 M110 30 L180 104" stroke="#a57c3a" stroke-width="2.2"/>
    <path d="M14 104 Q110 122 206 104" fill="none" stroke="#8a6427" stroke-width="5"/>
    <path d="M66 112 L84 172 M154 112 L136 172" stroke="#8a6427" stroke-width="2"/>
    ${sealMark("王")}`,
  jin: () => `${bg("#efd49c", "#b5761f")}
    ${neck}
    <path d="${bodyPath(92)}" fill="#3d2b22" stroke="${INK}" stroke-width="3"/>
    <path d="M92 202 L110 240 L128 202" fill="#e8bd98" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 262 C28 226 54 206 92 202 M196 262 C192 226 166 206 128 202" fill="none" stroke="#e8b84d" stroke-width="4"/>
    ${head(46, 49, 126)}
    <path d="M62 122 C58 78 86 62 110 62 C134 62 162 78 158 122 C142 110 126 106 110 106 C94 106 78 110 62 122 Z" fill="#8e2420" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="90" cy="84" r="3" fill="#f5ead6"/><circle cx="112" cy="76" r="3" fill="#f5ead6"/><circle cx="134" cy="86" r="3" fill="#f5ead6"/><circle cx="76" cy="100" r="3" fill="#f5ead6"/><circle cx="146" cy="102" r="3" fill="#f5ead6"/>
    <path d="M154 96 L190 104 L178 118 Z M154 100 L184 128 L168 132 Z" fill="#8e2420" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M80 120 L101 126 M140 120 L119 126" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
    ${eyes.sly}${nose}${mouths.smirk}
    <path d="M78 138 L97 156" stroke="#c4675e" stroke-width="3" stroke-linecap="round"/><path d="M83 141 l4 -3 M89 147 l4 -3" stroke="#c4675e" stroke-width="2"/>
    <circle cx="66" cy="150" r="6.5" fill="none" stroke="#e8b84d" stroke-width="3.4"/>
    <path d="M90 166 l2 2 M100 170 l2 2 M118 170 l2 2 M128 166 l2 2" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
    ${sealMark("金")}`,
  lu: () => `${bg("#bfe0d9", "#2f9a8f")}
    ${neck}
    <path d="${bodyPath(78)}" fill="#2f7f86" stroke="${INK}" stroke-width="3"/>
    <path d="M70 212 L148 262" stroke="#f5ead6" stroke-width="10"/>
    ${head()}
    <path d="M62 124 C58 84 80 62 110 62 C140 62 162 84 158 124 L150 104 L144 118 L136 96 L126 112 L116 92 L106 110 L96 94 L88 114 L78 98 L70 118 Z" fill="#2a2320" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M83 119 Q92 115 101 120 M119 120 Q128 115 137 119" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    ${eyes.open}${nose}${mouths.calm}${blush(.4)}
    <g transform="translate(168 186) rotate(-12)">
      <ellipse cx="0" cy="18" rx="24" ry="36" fill="#1d1d26" stroke="${INK}" stroke-width="3"/>
      <path d="M-14 6 Q0 34 10 52 M-4 0 Q8 26 16 40" fill="none" stroke="#3a3a4c" stroke-width="2.5"/>
      <path d="M4 -14 Q8 -40 4 -52" fill="none" stroke="#1d1d26" stroke-width="13" stroke-linecap="round"/>
      <circle cx="4" cy="-56" r="13" fill="#1d1d26" stroke="${INK}" stroke-width="3"/>
      <path d="M14 -60 L40 -56 L42 -50 L16 -50 Z" fill="#9aa0a6" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M40 -56 q6 2 2 8" fill="none" stroke="${INK}" stroke-width="2.4"/>
      <ellipse cx="12" cy="-46" rx="6" ry="4" fill="#e8b84d"/>
      <circle cx="6" cy="-60" r="3" fill="#3fbf8f"/><circle cx="6.5" cy="-60.5" r="1" fill="#fff"/>
    </g>
    ${sealMark("鹭")}`,
  lian: () => `<defs><radialGradient id="glow-lian"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
    ${bg("#f3cbd5", "#d9668a")}
    <ellipse cx="110" cy="66" rx="32" ry="24" fill="#231b22" stroke="${INK}" stroke-width="3"/>
    ${neck}
    <path d="${bodyPath(76)}" fill="#d0607e" stroke="${INK}" stroke-width="3"/>
    <path d="M84 202 Q110 222 136 202 Q130 230 110 232 Q90 230 84 202 Z" fill="#f8e7ee" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    ${head(43, 50, 126)}
    <path d="M65 128 C60 84 86 70 110 70 C134 70 160 84 155 128 C148 102 132 92 112 92 L110 84 L108 92 C88 92 72 102 65 128 Z" fill="#231b22" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M122 60 L160 36" stroke="#e8b84d" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(162 34)"><path d="M0 0 C-10 -6 -10 -18 0 -22 C10 -18 10 -6 0 0 Z" fill="#f29ab4" stroke="${INK}" stroke-width="2"/><path d="M0 0 C-16 -2 -20 -12 -14 -16 C-6 -14 -2 -8 0 0 Z M0 0 C16 -2 20 -12 14 -16 C6 -14 2 -8 0 0 Z" fill="#f7b9cb" stroke="${INK}" stroke-width="2"/></g>
    <path d="M84 120 Q92 116 100 120 M120 120 Q128 116 136 120" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    ${eyes.lash}${nose}${mouths.smile}${blush(.6)}
    <circle cx="172" cy="214" r="50" fill="url(#glow-lian)"/>
    <path d="M172 150 L172 182" stroke="${INK}" stroke-width="2.4"/>
    <rect x="158" y="180" width="28" height="7" rx="2" fill="#e8b84d" stroke="${INK}" stroke-width="2"/>
    <ellipse cx="172" cy="212" rx="27" ry="28" fill="#d8392c" stroke="${INK}" stroke-width="3"/>
    <path d="M160 188 Q150 212 160 236 M184 188 Q194 212 184 236 M172 186 L172 238" fill="none" stroke="#8e1f17" stroke-width="2"/>
    <rect x="158" y="236" width="28" height="7" rx="2" fill="#e8b84d" stroke="${INK}" stroke-width="2"/>
    <path d="M172 243 L172 258 M168 246 L166 260 M176 246 L178 260" stroke="#e8b84d" stroke-width="2.4" stroke-linecap="round"/>
    ${sealMark("莲")}`,
  shitou: () => `${bg("#d2e6bf", "#62a344")}
    ${neck}
    <path d="${bodyPath(72)}" fill="#4f8a3a" stroke="${INK}" stroke-width="3"/>
    <rect x="122" y="224" width="24" height="20" rx="4" fill="#cf3b2e" stroke="${INK}" stroke-width="2.4"/>
    ${head(48, 47, 130)}
    <circle cx="70" cy="68" r="17" fill="#ec8a2a" stroke="${INK}" stroke-width="3"/><circle cx="70" cy="68" r="8" fill="#f6b6a4"/>
    <circle cx="150" cy="68" r="17" fill="#ec8a2a" stroke="${INK}" stroke-width="3"/><circle cx="150" cy="68" r="8" fill="#f6b6a4"/>
    <path d="M60 124 C56 72 84 56 110 56 C136 56 164 72 160 124 C146 112 128 106 110 106 C92 106 74 112 60 124 Z" fill="#ec8a2a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M62 120 C74 110 92 106 110 106 C128 106 146 110 158 120" fill="none" stroke="#fff6e8" stroke-width="9" stroke-linecap="round"/>
    <path d="M100 74 h20 M98 84 h24 M96 95 h28 M110 74 v21" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M72 86 l10 4 M70 98 l10 2 M148 86 l-10 4 M150 98 l-10 2" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    ${eyes.big}${nose}${mouths.grin}${blush(.75)}
    <circle cx="80" cy="142" r="1.6" fill="#b9705a"/><circle cx="86" cy="146" r="1.6" fill="#b9705a"/><circle cx="134" cy="146" r="1.6" fill="#b9705a"/><circle cx="140" cy="142" r="1.6" fill="#b9705a"/>
    ${sealMark("石")}`,
};
const portrait = (id, label = "") => `<svg viewBox="0 0 220 260" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${DRAW[id]()}</svg>`;

