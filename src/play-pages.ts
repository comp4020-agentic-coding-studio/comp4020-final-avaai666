// The /play pages: the lobby and the room shell (DESIGN.md "The lobby flow").
// Server-rendered HTML; the 3D, the HUD and every live word come from the
// room's stream, drawn by /static/play/*.js. The mode cards (goal, actions,
// the choice that matters) are the C1 card's words too.
import { esc } from "./pages.ts";
import type { RoomView } from "./lib/game-hub.ts";
import { DICT, t, type Lang } from "./lib/i18n.ts";
import { worldForPage } from "./lib/lake-world.ts";
import { RUSH } from "./lib/game-constants.ts";
import { CREW, portrait } from "./static/play/art.js";
import { WORLD5_MODES } from "./static/play/world-select.js";

export interface ModeCard {
  id: string; name: string; zh: string; tag: string; players: string; len: string; due: string;
  goal: string; hud: string; choice: string; actions: [string, string][]; flow: string[]; extra?: string;
}
export const MODE_CARDS: ModeCard[] = [
  {
    id: "rush", name: "Boat Rush", zh: "开船抢鱼", tag: "Sail, net, ram. Get home before the horn.", players: "2–4 players", len: "2½ min", due: "10/20",
    goal: "Most fish banked at your own dock when the horn blows. Fish still aboard count for nothing.",
    hud: "Most fish home wins",
    choice: "One more cast, or home now? The last 30 seconds, Lantern Rush, bank double.",
    actions: [["Tap the water", "Sail there"], ["CAST · hold to widen", "Net the fish at your bow"], ["DASH", "Ram a full boat: up to 3 fish spill"]],
    extra: "Upgrades at your dock: Big Hold (+5 hold), Fast Hull (12% faster), Wide Net (12% wider), Iron Bow (+1 spill dealt, −1 taken). The first costs 3 banked fish, the second 7.",
    flow: ["Sail out and cast at the bow. Fish go into your hold; a full hold is slow.", "Unload at your dock, then spend banked fish on an upgrade: the first costs 3, the second 7.", "The leader wears a crown: ramming them spills one more.", "Lantern Rush: the last 30 seconds bank double."],
  },
  {
    id: "poach", name: "Who's Poaching", zh: "谁在偷鱼", tag: "Someone is netting the fry. Find them before the lake dies.", players: "4–8 players", len: "about 8 min", due: "10/27",
    goal: "Fishers win if every poacher is exiled while the lake stays above 40%. A poacher wins if the lake falls below 40%, if they survive day 3, or if two innocents are exiled.",
    hud: "Find the poacher · keep the lake above 40%",
    choice: "Fish for the quota, or spend the day watching your neighbours?",
    actions: [["Tap the water", "Sail and fish"], ["Stay beside a boat", "3 s to look in its basket"], ["BUOY", "Logs every boat that passes"]],
    flow: ["Day: everyone fishes for the village quota. A poacher's fine net takes fry.", "Pull alongside a boat for 3 seconds to see its basket. Only you see it.", "Evening: set phrases (true or not), then a vote. Ties exile nobody.", "Three days, two meetings. The exiled player's role is revealed."],
  },
  {
    id: "party", name: "Fishing Party", zh: "钓鱼派对", tag: "Five rounds, five different games, one lake that remembers.", players: "2–4 players", len: "about 6 min", due: "10/27",
    goal: "Most coins after five rounds. The last round, Last Net, pays double. Fish taken early are gone for later rounds.",
    hud: "Most coins wins",
    choice: "Take fish now, or leave them for the last round that pays double?",
    actions: [["Tap", "Aim, steer, reel"], ["SHOP", "8 s between rounds"], ["PICK", "Small, medium or huge net, in secret"]],
    flow: ["Shoal Scramble, Koi Chase, Tug of Line, Lantern Night, Last Net: a new game each round.", "Eight seconds in the shop between rounds. Muddy Water is for players behind.", "The last-placed player picks the next round's variant.", "The lake carries over: Last Net's school is what the first rounds left."],
  },
  {
    id: "hold", name: "Lake Holdings", zh: "抢地盘经营", tag: "Build nets, ponds and fences. Bend the current your way.", players: "2–4 players", len: "3 min", due: "11/03",
    goal: "Tiles held plus fish harvested. The lake pays out every 15 seconds, twelve times. A tie goes to more fish harvested.",
    hud: "Tiles + fish harvested",
    choice: "Net hard now, or build ponds so the lane still has fish later?",
    actions: [["Pick a card", "Net, Pond, Fence, Cormorant, Lantern, Claim"], ["Tap a hex", "Place it; see what it paid last tide"], ["Tide", "Every 15 s the lake pays out"]],
    flow: ["Place nets where the current carries the schools.", "Fence the current away from a rival, or raid their net with a cormorant.", "Ponds breed fish for you and your neighbours. Lanterns pull schools in.", "Over-netted lanes thin out, for everyone downstream."],
  },
];
export const cardOf = (id: string): ModeCard => MODE_CARDS.find((m) => m.id === id)!;

function page(title: string, body: string, bodyClass: string, scripts: string, lang: Lang = "en"): string {
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&amp;family=Ma+Shan+Zheng&amp;family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&amp;display=swap" />
    <link rel="stylesheet" href="/static/play/play.css" />
    <script type="importmap">{ "imports": { "three": "/static/vendor/three.module.js" } }</script>
    ${scripts}
  </head>
  <body class="${bodyClass}">
    ${body}
  </body>
</html>
`;
}

const seal = `<div class="seal" aria-hidden="true"><span>明</span><span>年</span><span>无</span><span>鱼</span></div>`;
// inner: only the game's stage, its boot data and its script, for the site's
// room page (src/site-pages.ts), which has the join form and the top bar
export function roomPage(view: RoomView, error?: string, lang: Lang = "en"): string {
  const crew = CREW;
  const taken = new Set(view.players.map((p) => p.character));
  const firstFree = crew.find((c) => !taken.has(c.id as RoomView["players"][number]["character"]))?.id ?? "mei";
  const card = cardOf(view.mode);
  const join = view.me === null ? `<form class="joinform card" method="post" action="/play/${esc(view.code)}/join" novalidate>
      <h3>${esc(t(lang, "join_h", { code: view.code }))}</h3>
      <label for="name">${esc(t(lang, "join_name"))}</label><input id="name" name="name" maxlength="24" required autocomplete="nickname" />
      <div class="roster small">${crew.map((c) => `<label class="face-btn" title="${esc(t(lang, `c_${c.id}`))}"><input type="radio" name="character" value="${c.id}" ${c.id === firstFree ? "checked" : ""} />${portrait(c.id, t(lang, `c_${c.id}`))}</label>`).join("")}</div>
      <button class="btn primary" type="submit">${esc(t(lang, "join_btn"))}</button>
      ${error ? `<p class="toast" role="alert" id="join-error">${esc(error)}</p>` : ""}
    </form>` : "";
  const w = (k: string) => esc(t(lang, k));
  const shell = `<div class="app room" id="app" data-room="${esc(view.code)}">
  <div class="stage" id="stage">
    <canvas id="gl" tabindex="0" aria-label="${w("g_lake_3d")}"${WORLD5_MODES.includes(view.mode) ? " hidden" : ""}></canvas>
    <canvas id="gl5" tabindex="0" aria-label="${w("g_lake_3d")}"${WORLD5_MODES.includes(view.mode) ? "" : " hidden"}></canvas>
    <div class="tags" id="tags"></div><div class="floats" id="floats"></div>
    <div class="tags" id="tags5"></div><div class="floats" id="floats5"></div>
    <canvas id="mini" aria-hidden="true"${WORLD5_MODES.includes(view.mode) ? "" : " hidden"}></canvas>
    <div class="topbar" id="topbar"><a class="mini-seal" href="/play/${esc(view.code)}?stay=1" aria-label="${w("g_back_room")}">${seal}</a><div class="goalclock"><b id="goal">${w(`${view.mode}_hud`)}</b><span id="clock"></span></div><span class="conn" id="conn">${w("g_connecting")}</span><button class="tiny" id="sound" type="button">${w("g_sound_off")}</button>
      <div class="hostmenu" id="hostmenu" hidden><button class="tiny" id="hostbtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="${w("g_host_menu")}">⋯</button><div class="menu-list" id="hostlist" hidden><button type="button" class="danger" data-stop>${w("g_stop")}</button></div></div></div>
    <button class="hudtoggle" id="hudtoggle" type="button" aria-expanded="false" aria-controls="hud">${w("g_details")}</button>
    <div class="hud" id="hud"></div>
    <p class="coach" id="coach" hidden></p>
    <div class="banner" id="banner" hidden role="status"></div>
    <div class="overlay" id="overlay"></div>
  </div>
  ${join}
</div>
  <script type="application/json" id="boot">${JSON.stringify({
    view, cards: MODE_CARDS, lang, words: DICT[lang],
    other: Object.fromEntries([...MODE_CARDS.map((m) => `${m.id}_name`), "cer_v_rich", "cer_v_fair", "cer_v_lean", "cer_v_none", ...["scramble", "koi", "tug", "night", "last"].map((g) => `y2_v_${g}`)].map((k) => [k, DICT[lang === "en" ? "zh" : "en"][k]])),
    world: worldForPage(),
    // Boat Rush's practice runs in the browser alone (DESIGN.md "Practice runs in the browser only"); it sails
    // and nets with the match's own numbers, sent here so the page keeps no copy
    rushPractice: { speed: RUSH.SPEED, loadSlow: RUSH.LOAD_SLOW, hold: RUSH.HOLD, netR: RUSH.NET_R, netAhead: RUSH.NET_AHEAD, castCd: RUSH.CAST_CD, dockR: RUSH.DOCK_R },
  }).replace(/</g, "\\u003c")}</script>`;
  return page(`${t(lang, "room_title", { code: view.code })} · ${t(lang, `${card.id}_name`)}`, shell, "play in-room", `<script type="module" src="/static/play/room.js"></script>`, lang);
}
