// The site (DESIGN.md "The site"): /, /how, /how/MODE, the room's page around
// the game, /readme/ and /making-of, each with the same top bar, in the
// language the lang cookie chose. Every word comes from src/lib/i18n.ts. The
// structure and words are the site plan v8 mock's; the look is /play's.
import { esc } from "./pages.ts";
import type { RoomView } from "./lib/game-hub.ts";
import { DICT, GAMES, t, type Lang } from "./lib/i18n.ts";
import { A0, K, Y0 } from "./lib/lake-world.ts";
import { ICON, PIC, SCENE } from "./site-art.ts";
import { CREW, portrait } from "./static/play/art.js";

export type Nav = "play" | "how" | "about" | "making" | null;
// one finished match, as "What happened here" shows it (no seed, no token)
export interface MatchLine { endedAt: number; mode: string; winner: { kind: "seat"; name: string; character: string; bot: boolean } | { kind: "fishers" | "poacher" | "none" }; lakeBefore: number; lakeAfter: number }

const seal = `<span class="seal" aria-hidden="true"><span>明</span><span>年</span><span>无</span><span>鱼</span></span>`;
const other = (lang: Lang): Lang => (lang === "en" ? "zh" : "en");

function topBar(lang: Lang, nav: Nav, here: string): string {
  const link = (key: Nav, href: string, word: string) => `<a href="${href}"${nav === key ? ` aria-current="page"` : ""}>${esc(t(lang, word))}</a>`;
  const back = esc(here);
  const sw = (l: Lang, label: string) => `<button type="submit" name="lang" value="${l}" aria-pressed="${l === lang}"${l === "zh" ? ` lang="zh"` : ` lang="en"`}>${label}</button>`;
  return `<header class="top">
  <div class="wrap">
    <a class="brand" href="/" aria-label="${esc(t(lang, "home"))}">${seal}<b>${esc(t(lang, "name"))}</b></a>
    <details class="menu"><summary>${esc(t(lang, "menu"))}</summary></details>
    <nav class="links" aria-label="${esc(t(lang, "nav_main"))}">
      ${link("play", "/", "nav_play")}${link("how", "/how", "nav_how")}${link("about", "/readme/", "nav_about")}${link("making", "/making-of", "nav_making")}
    </nav>
    <form class="lang" method="post" action="/lang" role="group" aria-label="${esc(t(lang, "lang_group"))}"><input type="hidden" name="back" value="${back}" />${sw("en", "EN")}${sw("zh", "中文")}</form>
  </div>
</header>`;
}

function footer(lang: Lang): string {
  return `<footer><div class="wrap"><span>${esc(t(lang, "foot"))}</span><nav aria-label="${esc(t(lang, "nav_footer"))}"><a href="/readme/">${esc(t(lang, "nav_about"))}</a><a href="/making-of">${esc(t(lang, "nav_making"))}</a><a href="/making-of#earlier">${esc(t(lang, "foot_archive"))}</a></nav></div></footer>`;
}

export function sitePage(lang: Lang, o: { title: string | null; nav: Nav; here: string; body: string; bodyClass?: string; head?: string }): string {
  const name = t(lang, "name");
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(o.title ? `${o.title} · ${name}` : name)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&amp;family=Ma+Shan+Zheng&amp;family=Noto+Sans+SC:wght@400;500;700&amp;family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&amp;display=swap" />
    <link rel="stylesheet" href="/static/site.css" />
    ${o.head ?? ""}
    <script src="/static/site.js" defer></script>
  </head>
  <body class="site ${o.bodyClass ?? ""}">
    ${topBar(lang, o.nav, o.here)}
    <main class="wrap" id="main">${o.body}</main>
    ${footer(lang)}
  </body>
</html>
`;
}

const gameName = (lang: Lang, id: string) => t(lang, `${id}_name`);
const meta = (lang: Lang, g: (typeof GAMES)[number]) =>
  `<div class="meta"><span class="tagc">${g.players} ${esc(t(lang, "players"))}</span><span class="tagc">${g.min} ${esc(t(lang, "min"))}</span></div>`;
// "Play" on a card opens a room with that game picked
const playForm = (lang: Lang, id: string, label: string, cls: string) =>
  `<form method="post" action="/play" class="inline"><input type="hidden" name="mode" value="${id}" /><button class="btn ${cls}" type="submit">${esc(label)}</button></form>`;

function joinForm(lang: Lang): string {
  return `<form class="joincode" method="get" action="/play/join">
      <label for="code">${esc(t(lang, "join_label"))}</label>
      <input id="code" name="code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" pattern="[A-Za-z]{4}" required placeholder="MZHB" />
      <button class="btn ghost small" type="submit">${esc(t(lang, "join_go"))}</button>
    </form>`;
}

export function homePage(lang: Lang, error?: string): string {
  const body = `<section class="hero">
      <div>
        <p class="eyebrow">${esc(t(lang, "hero_eyebrow"))}</p>
        <h1>${esc(t(lang, "name"))}</h1>
        <span class="zhtitle" lang="${other(lang)}">${esc(t(lang, "name_other"))}</span>
        <p class="lede">${esc(t(lang, "hero_line"))}</p>
        <div class="row cta">
          <form method="post" action="/play" class="inline"><input type="hidden" name="mode" value="rush" /><button class="btn primary" type="submit">${esc(t(lang, "hero_play"))} →</button></form>
          <details class="join"><summary class="btn ghost">${esc(t(lang, "hero_join"))}</summary>${joinForm(lang)}</details>
        </div>
        <p class="proof">${esc(t(lang, "hero_proof"))}</p>
        ${error ? `<p class="toast" role="alert">${esc(error)}</p>` : ""}
      </div>
      <div class="scene">${SCENE}</div>
    </section>
    <div class="steps3">
      <div class="step3"><b>${esc(t(lang, "s1_t"))}</b><p>${esc(t(lang, "s1_p"))}</p></div>
      <div class="step3"><b>${esc(t(lang, "s2_t"))}</b><p>${esc(t(lang, "s2_p"))}</p></div>
      <div class="step3"><b>${esc(t(lang, "s3_t"))}</b><p>${esc(t(lang, "s3_p"))}</p></div>
    </div>
    <div class="section-h"><h2>${esc(t(lang, "games_h"))}</h2><a class="btn ghost small" href="/how">${esc(t(lang, "games_all"))}</a></div>
    <div class="games">${GAMES.map((g) => `<article class="game">
      <div class="ico" style="background:${g.color}">${ICON[g.id]}</div>
      <div class="min0">
        <h3>${esc(gameName(lang, g.id))}<span lang="${other(lang)}">${esc(DICT[other(lang)][`${g.id}_name`])}</span></h3>
        <p>${esc(t(lang, `${g.id}_one`))}</p>
        ${meta(lang, g)}
        <p class="choice"><b>${esc(t(lang, "the_choice"))}</b> ${esc(t(lang, `${g.id}_choice`))}</p>
        <div class="row">${playForm(lang, g.id, t(lang, "play"), "primary small")}<a class="btn ghost small" href="/how/${g.id}">${esc(t(lang, "rules"))}</a></div>
      </div></article>`).join("")}</div>
    <section class="memory">
      <div><h2>${esc(t(lang, "mem_h"))}</h2><p>${esc(t(lang, "mem_p"))}</p></div>
      <div class="panel"><h3>${esc(t(lang, "room_lake"))}</h3>
        <div class="row spread"><span class="fishn">${A0 + Y0} <small>${esc(t(lang, "room_lake_of", { n: K }))}</small></span></div>
        <div class="lakebar"><i style="width:${Math.round(((A0 + Y0) / K) * 100)}%"></i></div>
        <p class="muted small">${esc(t(lang, "mem_new", { n: A0 + Y0 }))}</p>
      </div>
    </section>`;
  return sitePage(lang, { title: null, nav: "play", here: "/", body, bodyClass: "page-home" });
}

export function howPage(lang: Lang, id: string): string {
  const g = GAMES.find((x) => x.id === id) ?? GAMES[0];
  const k = (s: string) => esc(t(lang, `${g.id}_${s}`));
  const body = `<p class="eyebrow">${esc(t(lang, "how_eyebrow"))}</p>
    <nav class="tabs" aria-label="${esc(t(lang, "how_title"))}">${GAMES.map((x) => `<a class="tab" href="/how/${x.id}"${x.id === g.id ? ` aria-current="page"` : ""}>${esc(gameName(lang, x.id))}</a>`).join("")}</nav>
    <div class="howhead"><div><h1>${k("name")}</h1><p class="lede">${k("one")}</p>${meta(lang, g)}</div>
      ${playForm(lang, g.id, `${t(lang, "play")} →`, "primary")}</div>
    <div class="goalgrid"><div class="goalbox"><h2 class="eyebrow">${esc(t(lang, "goal"))}</h2><p>${k("goal")}</p></div><div class="goalbox key"><h2 class="eyebrow">${esc(t(lang, "key"))}</h2><p>${k("choice")}</p></div></div>
    <ol class="steps">${[1, 2, 3, 4, 5].map((n, i) => `<li><div class="pic">${PIC[g.id][i]}</div><div class="min0"><b>${n}. ${k(`s${n}_t`)}</b><p>${k(`s${n}_p`)}</p></div></li>`).join("")}</ol>
    <div class="two">
      <div class="panel"><h3>${esc(t(lang, "controls"))}</h3><ul><li><b>${esc(t(lang, "phone"))}:</b> ${k("phone1")} · ${k("phone2")}</li><li><b>${esc(t(lang, "laptop"))}:</b> ${k("laptop1")} · ${k("laptop2")}</li></ul></div>
      <div class="panel"><h3>${esc(t(lang, "lake"))}</h3><p class="m0">${k("lake")}</p></div>
    </div>`;
  return sitePage(lang, { title: `${t(lang, "how_title")}: ${gameName(lang, g.id)}`, nav: "how", here: `/how/${g.id}`, body });
}

const when = (lang: Lang, ms: number) =>
  new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Sydney" }).format(ms);

// C1 (DESIGN.md "Clarity"): before the start, one card: the goal in one
// sentence, three icons for the three main actions, and the choice that matters.
const A_ICON: Record<string, string[]> = { rush: ["👆", "🕸", "💨"], poach: ["👆", "👀", "🎈"], party: ["👆", "🛒", "🤫"], hold: ["🂠", "⬡", "🌊"] };
export function c1Html(lang: Lang, id: string): string {
  const k = (s: string) => esc(t(lang, `${id}_${s}`));
  return `<p class="goalline"><b>${esc(t(lang, "goal"))}</b> ${k("goal")}</p>
    <div class="icons3">${[1, 2, 3].map((n, i) => `<div><span aria-hidden="true">${A_ICON[id][i]}</span><b>${k(`a${n}`)}</b><small>${k(`a${n}s`)}</small></div>`).join("")}</div>
    <p class="choice"><b>${esc(t(lang, "the_choice"))}</b> ${k("choice")}</p>${id === "rush" ? `<p class="small muted">${esc(t(lang, "rush_extra"))}</p>` : ""}`;
}

export function logLine(lang: Lang, m: MatchLine): string {
  const game = gameName(lang, m.mode);
  const what = m.winner.kind === "seat" ? t(lang, "log_won", { game, name: m.winner.bot ? t(lang, "bot_suffix", { name: t(lang, `c_${m.winner.character}`) }) : m.winner.name })
    : m.winner.kind === "fishers" ? t(lang, "log_fishers", { game }) : m.winner.kind === "poacher" ? t(lang, "log_poacher", { game }) : t(lang, "log_nobody", { game });
  return `<li><time datetime="${new Date(m.endedAt).toISOString()}">${esc(when(lang, m.endedAt))}</time><span>${esc(what)}</span><span class="fish">${m.lakeBefore} → ${m.lakeAfter}</span></li>`;
}

// The room's page: the share bar, who is here (live), pick a game, Start,
// this room's lake and what happened here, around the game's own stage.
// room.js keeps "who's here", the lake and the log live from the stream.
export function roomSitePage(lang: Lang, view: RoomView, lines: MatchLine[], origin: string, error?: string): string {
  const url = `${origin}/play/${view.code}`;
  const people = view.players.map((p) => `<div class="person on"><div class="f">${portrait(p.character, p.name)}</div><span class="dot"></span>${esc(p.name)}</div>`).join("");
  const join = view.me === null ? `<form class="joinform panel" method="post" action="/play/${esc(view.code)}/join">
      <h3>${esc(t(lang, "join_h", { code: view.code }))}</h3>
      <label for="name">${esc(t(lang, "join_name"))}</label><input id="name" name="name" maxlength="24" required autocomplete="nickname" />
      <div class="roster">${CREW.map((c, i) => `<label class="face-btn" title="${esc(t(lang, `c_${c.id}`))}"><input type="radio" name="character" value="${c.id}" ${(view.players.some((p) => p.character === c.id) ? false : !CREW.slice(0, i).some((d) => !view.players.some((p) => p.character === d.id))) ? "checked" : ""} />${portrait(c.id, t(lang, `c_${c.id}`))}</label>`).join("")}</div>
      <button class="btn primary" type="submit">${esc(t(lang, "join_btn"))}</button>
      ${error ? `<p class="toast" role="alert" id="join-error">${esc(error)}</p>` : ""}
    </form>` : "";
  const body = `<p class="eyebrow">${esc(t(lang, "room_eyebrow"))}</p>
    <div class="roomhead"><div class="code">${esc(view.code)}</div>
      <div class="share"><code id="shareurl">${esc(url)}</code><button class="btn ghost small" type="button" id="copy" data-copied="${esc(t(lang, "copied"))}">${esc(t(lang, "share"))}</button></div></div>
    ${join}
    <div class="roomgrid">
      <div class="panel"><h2 class="h3">${esc(t(lang, "here"))}</h2>
        <div class="people" id="people">${people}<div class="person empty"><div class="f">+</div>${esc(t(lang, "waiting"))}</div></div>
        <h2 class="h3 mt">${esc(t(lang, "pickgame"))}</h2>
        <div class="pick" id="pick">${GAMES.map((g) => `<button class="pickb" type="button" data-pick="${g.id}" aria-pressed="${g.id === view.mode}"><b>${esc(gameName(lang, g.id))}</b><span>${g.players} ${esc(t(lang, "players"))} · ${g.min} ${esc(t(lang, "min"))} · ${esc(t(lang, `${g.id}_choice`))}</span></button>`).join("")}</div>
        <section class="c1" id="c1" aria-live="polite">${c1Html(lang, view.mode)}</section>
        <div class="row mt"><button class="btn primary" type="button" id="startbtn"${view.me === null ? " hidden" : ""}>${esc(t(lang, "start"))}: <span id="pickname">${esc(gameName(lang, view.mode))}</span></button><label class="check"><input type="checkbox" id="bots" ${view.players.length < 2 ? "checked" : ""}/> ${esc(t(lang, "g_bots"))}</label><a class="btn ghost small" href="/how/${esc(view.mode)}" id="pickrules">${esc(t(lang, "rules"))}</a></div>
        <p class="toast" id="starterr" role="alert"></p><p class="toast" id="roomnote">${view.note ? esc(t(lang, `g_note_${view.note}`)) : ""}</p>
        ${view.state === "play" ? `<p><a class="btn primary" href="/play/${esc(view.code)}/game">${esc(t(lang, "g_to_game"))}</a></p>` : ""}
      </div>
      <div class="panel"><h2 class="h3">${esc(t(lang, "room_lake"))}</h2>
        <div class="row spread"><span class="fishn" id="lakefish">${view.lake.fish} <small>${esc(t(lang, "room_lake_of", { n: K }))}</small></span></div>
        <div class="lakebar"><i id="lakebar" style="width:${Math.min(100, (view.lake.fish / K) * 100).toFixed(1)}%"></i></div>
        <h2 class="h3 mt small-h">${esc(t(lang, "log_h"))}</h2>
        <ul class="log" id="log">${lines.length ? lines.map((m) => logLine(lang, m)).join("") : `<li class="none">${esc(t(lang, "log_none"))}</li>`}</ul>
      </div>
    </div>
    <script type="application/json" id="boot">${JSON.stringify({ view, lang, words: DICT[lang], k: K }).replace(/</g, "\\u003c")}</script>
    <script type="module" src="/static/play/roomlive.js"></script>`;
  return sitePage(lang, { title: t(lang, "room_title", { code: view.code }), nav: "play", here: `/play/${view.code}`, body, bodyClass: "page-room" });
}

export function noRoomSitePage(lang: Lang, code: string): string {
  const body = `<h1>${esc(t(lang, "room_none_title", { code }))}</h1><p class="lede">${esc(t(lang, "room_none_p"))}</p><p class="row cta"><a class="btn primary" href="/">${esc(t(lang, "room_back"))}</a></p>`;
  return sitePage(lang, { title: t(lang, "room_none_title", { code }), nav: null, here: "/", body });
}

export function readmeSitePage(lang: Lang, readmeHtml: string): string {
  const note = lang === "zh" ? `<p class="note-en" lang="zh">${esc(t(lang, "readme_en_note"))}</p>` : "";
  return sitePage(lang, { title: t(lang, "about_title"), nav: "about", here: "/readme/", body: `${note}<article class="readme" lang="en">${readmeHtml}</article>`, head: '<base href="/" />' });
}

const ERAS = [
  { n: 1, go: "/p", now: false },
  { n: 2, go: "/classic", now: false },
  { n: 3, go: "/b", now: false },
  { n: 4, go: "/", now: true },
];

export function makingOfPage(lang: Lang): string {
  const body = `<p class="eyebrow">${esc(t(lang, "making_eyebrow"))}</p><h1>${esc(t(lang, "making_h"))}</h1><p class="lede">${esc(t(lang, "making_p"))}</p>
    <ol class="timeline" id="earlier">${ERAS.map((e) => `<li class="${e.now ? "now" : ""}"><span class="when">${esc(t(lang, `era${e.n}_when`))}</span><h2 class="h3">${esc(t(lang, `era${e.n}_t`))}</h2><p>${esc(t(lang, `era${e.n}_p`))}</p><p class="why">${esc(t(lang, `era${e.n}_why`))}</p>${e.now ? "" : `<a class="btn ghost small" href="${e.go}">${esc(t(lang, "open_old"))} (${e.go})</a>`}</li>`).join("")}</ol>`;
  return sitePage(lang, { title: t(lang, "making_title"), nav: "making", here: "/making-of", body });
}

export function notFoundPage(lang: Lang): string {
  return sitePage(lang, { title: t(lang, "nf_title"), nav: null, here: "/", body: `<h1>${esc(t(lang, "nf_title"))}</h1><p class="lede">${esc(t(lang, "nf_p"))}</p><p class="row cta"><a class="btn primary" href="/">${esc(t(lang, "room_back"))}</a></p>` });
}

// a line /classic shows above the five-year lake's home: where it sits now
export function classicNote(): string {
  return `<p class="foot"><a href="/making-of">This is an earlier version of Next Year, No Fish. The current game is at <b>/</b>; every version is listed at /making-of.</a></p>`;
}
