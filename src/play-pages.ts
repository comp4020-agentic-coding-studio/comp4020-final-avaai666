// The /play pages: the lobby and the room shell (DESIGN.md "The lobby flow").
// Server-rendered HTML; the 3D, the HUD and every live word come from the
// room's stream, drawn by /static/play/*.js. The mode cards (goal, actions,
// the choice that matters) are the C1 card's words too.
import { esc } from "./pages.ts";
import type { RoomView } from "./lib/game-hub.ts";
import { DICT, type Lang } from "./lib/i18n.ts";
import { CREW, ICONS, portrait } from "./static/play/art.js";

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

function page(title: string, body: string, bodyClass: string, scripts: string): string {
  return `<!doctype html>
<html lang="en">
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
const statusOf = (m: ModeCard, ready: string[]): string =>
  ready.includes(m.id) ? `<span class="status live">Playable now</span>` : `<span class="status soon">Coming: ${esc(m.due)}</span>`;

function modeCardHtml(m: ModeCard, ready: string[]): string {
  return `<article class="mode-info" data-mode="${m.id}" hidden>
      <h2>${esc(m.name)}<span lang="zh">${m.zh}</span></h2>
      <p class="tag">${esc(m.tag)}</p>
      <div class="facts"><span class="fact">${esc(m.players)}</span><span class="fact">${esc(m.len)}</span>${statusOf(m, ready)}</div>
      <p class="goal"><b>How you win</b>${esc(m.goal)}</p>
      <ol class="flow">${m.flow.map((f) => `<li>${esc(f)}</li>`).join("")}</ol>
      <p class="choice"><b>The choice that matters:</b> ${esc(m.choice)}</p>
    </article>`;
}

export function lobbyPage(ready: string[], error?: string): string {
  const crew = CREW;
  return page("Next Year, No Fish · Play", `<div class="app">
  <div class="stage" id="stage"><canvas id="gl" aria-label="The lake, drawn in 3D"></canvas><div class="tags" id="tags"></div></div>
  <div class="ui" id="ui">
    <header class="brand">${seal}<div><h1>Next Year, No Fish</h1><p>One shared lake, four ways to play it. <span lang="zh">明年无鱼</span></p></div></header>
    <form method="post" action="/play" id="open">
      <div><h3 class="section-h">Choose a game</h3>
        <div class="modes" role="radiogroup" aria-label="Game modes">${MODE_CARDS.map((m, i) => `<label class="mode-btn" data-mode="${m.id}"><input type="radio" name="mode" value="${m.id}" ${i === 0 ? "checked" : ""} />${ICONS[m.id]}<b>${esc(m.name)}</b><i lang="zh">${m.zh}</i><small class="${ready.includes(m.id) ? "live" : "soon"}">${ready.includes(m.id) ? "Play" : `Coming ${esc(m.due)}`}</small></label>`).join("")}</div>
      </div>
      ${MODE_CARDS.map((m) => modeCardHtml(m, ready)).join("")}
      <section class="crew"><h3 class="section-h">Pick your fisher</h3>
        <div class="roster">${crew.map((c, i) => `<label class="face-btn" title="${esc(c.name)}"><input type="radio" name="character" value="${c.id}" ${i === 0 ? "checked" : ""} />${portrait(c.id, c.name)}</label>`).join("")}</div>
        <div class="heroes">${crew.map((c) => `<figure class="hero" data-me="${c.id}" hidden><div class="frame">${portrait(c.id, c.name)}</div><figcaption><b>${esc(c.name)} <span class="zh" lang="zh">${c.zh}</span></b><p><span class="swatch" style="background:${c.color}"></span>${esc(c.line)}</p></figcaption></figure>`).join("")}</div>
      </section>
      <div class="cta"><button class="btn primary" type="submit" id="create">Open a room</button><button class="btn ghost" type="button" id="joinbtn">Join with a code</button></div>
      <p class="lake-note">Every room has its own lake, and it remembers: the next match starts with what the last one left.</p>
      ${error ? `<p class="toast" role="alert">${esc(error)}</p>` : `<p class="toast" id="toast" role="status"></p>`}
    </form>
    <p class="note"><a href="/">The original Next Year, No Fish (five years on one lake)</a> · <a href="/b">Quick Catch (2D, experimental)</a></p>
  </div>
</div>`, "play lobby", `<script type="module" src="/static/play/lobby.js"></script>`);
}

export function noRoomPage(code: string): string {
  return page("No such room", `<main class="solo"><h1>No room ${esc(code)}</h1><p><a class="btn primary" href="/play">Back to the lobby</a></p></main>`, "play", "");
}

export function roomPage(view: RoomView, error?: string, lang: Lang = "en"): string {
  const crew = CREW;
  const taken = new Set(view.players.map((p) => p.character));
  const firstFree = crew.find((c) => !taken.has(c.id as RoomView["players"][number]["character"]))?.id ?? "mei";
  const card = cardOf(view.mode);
  const join = view.me === null ? `<form class="joinform card" method="post" action="/play/${esc(view.code)}/join">
      <h3>Join room ${esc(view.code)}</h3>
      <label for="name">Your name</label><input id="name" name="name" maxlength="24" required autocomplete="nickname" />
      <div class="roster small">${crew.map((c) => `<label class="face-btn" title="${esc(c.name)}"><input type="radio" name="character" value="${c.id}" ${c.id === firstFree ? "checked" : ""} />${portrait(c.id, c.name)}</label>`).join("")}</div>
      <button class="btn primary" type="submit">Join</button>
      ${error ? `<p class="toast" role="alert" id="join-error">${esc(error)}</p>` : ""}
    </form>` : "";
  return page(`Room ${view.code} · ${card.name}`, `<div class="app room" id="app" data-room="${esc(view.code)}">
  <div class="stage" id="stage"><canvas id="gl" tabindex="0" aria-label="The lake, drawn in 3D"></canvas><div class="tags" id="tags"></div><div class="floats" id="floats"></div>
    <div class="topbar" id="topbar"><a class="seal mini" href="/play" aria-label="Lobby">${seal}</a><div class="goalclock"><b id="goal">${esc(card.hud)}</b><span id="clock"></span></div><span class="conn" id="conn">connecting…</span><button class="tiny" id="stopbtn" type="button" hidden>Stop match</button><button class="tiny" id="sound" type="button">sound off</button></div>
    <button class="hudtoggle" id="hudtoggle" type="button" aria-expanded="false" aria-controls="hud">Details ▾</button>
    <div class="hud" id="hud"></div>
    <p class="coach" id="coach" hidden></p>
    <div class="banner" id="banner" hidden role="status"></div>
    <div class="overlay" id="overlay"></div>
  </div>
  ${join}
</div>
<script type="application/json" id="boot">${JSON.stringify({ view, cards: MODE_CARDS, lang, words: DICT[lang], other: Object.fromEntries(MODE_CARDS.map((m) => [`${m.id}_name`, DICT[lang === "en" ? "zh" : "en"][`${m.id}_name`]])) }).replace(/</g, "\\u003c")}</script>`, "play in-room", `<script type="module" src="/static/play/room.js"></script>`);
}
