// The boat game's routes (experimental; docs/boats/RULES.md), all under /b
// and separate from the lakes (/l) and ponds (/p), which keep working as
// they are. The page is a shell: /static/boat.js draws the lobby, the race
// and the results from the stream; every outcome comes from boat-hub.ts.
import type { IncomingMessage, ServerResponse } from "node:http";
import { cookie, overHttps, readBody, redirect, sendHtml, sendJson } from "./http.ts";
import { esc } from "./pages.ts";
import type { BoatHub } from "./lib/boat-hub.ts";
import type { BoatStore } from "./lib/boat-store.ts";
import { BOAT_INPUT_RATE as INPUT_RATE } from "./lib/game-constants.ts";
import { log } from "./log.ts";

const CODE = /^\/b\/([BCDFGHJKLMNPQRSTVWXZ]{4})(\/join|\/start|\/in|\/events)?$/;
const COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;
const JOIN_MESSAGES: Record<string, string> = {
  bad_name: "That name will not do: use 1 to 24 characters, not only spaces.",
  name_taken: "Someone in this room already has that name.",
  bot_name: "That name belongs to a bot. Pick another.",
  full: "This room already has four players.",
};

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&amp;family=Fraunces:opsz,wght@9..144,800;9..144,900&amp;family=Nunito:wght@400;700;800;900&amp;family=IBM+Plex+Mono:wght@500&amp;display=swap" />
    <link rel="stylesheet" href="/static/lake.css" />
    <link rel="stylesheet" href="/static/boat.css" />
    <script src="/static/boat.js" defer></script>
  </head>
  <body class="nynf boat">
    ${body}
  </body>
</html>
`;
}

export function boatHome(): string {
  return page(
    "Quick Catch · Next Year, No Fish",
    `<header class="bar"><a class="seal" href="/">明年无鱼</a><div class="titles"><span class="title-en">Quick Catch <span class="zh">快抢</span></span><span class="sub">Boats on a shared lake · experimental</span></div></header>
    <main class="bhome">
      <section class="card">
        <p class="eyebrow">Two to four players · two minutes</p>
        <h1 class="goal">Fill your boat. Get it home. Most fish home wins.</h1>
        <ol class="rules">
          <li><b>Sail</b>: tap or drag on the water (or WASD).</li>
          <li><b>Cast</b>: your net lands just ahead of your bow. Grown fish go into your hold (10 at most); fry slip through.</li>
          <li><b>Home</b>: sail into your own dock to unload. Only fish unloaded at home count. The horn takes whatever is still aboard.</li>
          <li><b>Dash</b>: a burst of speed. Dash into a boat and up to 3 fish spill from its hold; anyone can scoop them. Docks are safe, and a boat that was just hit is shielded for 3 seconds.</li>
          <li><b>The lake</b> is shared and nothing refills it: fish breed slowly, so what you take now is not there later.</li>
        </ol>
        <form method="post" action="/b"><button class="cta" type="submit">Open a room</button></form>
        <form class="join-code" id="join-code"><label for="code">or join a room</label><input id="code" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="CODE" /><button class="btn" type="submit">Go</button></form>
      </section>
      <p class="foot"><a href="/making-of">← every version of Next Year, No Fish</a></p>
    </main>`,
  );
}

export function boatRoom(code: string, boot: unknown, error?: string): string {
  return page(
    `Room ${code} · Quick Catch`,
    `<div class="app" id="app">
      <header class="bar"><a class="seal" href="/b">明年无鱼</a><div class="titles"><span class="title-en">Quick Catch <span class="zh">快抢</span></span><span class="sub">Room <b class="code">${esc(code)}</b></span></div>
        <div class="clock"><span class="tiny conn" id="conn">connecting…</span><button class="tiny" id="sound" type="button">sound on</button></div></header>
      <main class="board" id="board" data-room="${esc(code)}">
        <div class="stagewrap" id="stagewrap">
          <canvas id="lake" tabindex="0" aria-label="The lake. Tap or drag to sail; Space casts; Shift dashes."></canvas>
          <div class="banner" id="banner" hidden role="status"><span class="g" id="banner-g">船</span><span id="banner-t"></span></div>
          <div class="overlay" id="lobby" hidden></div>
          <div class="overlay soft" id="count" hidden><div class="countdown" id="count-n">3</div></div>
          <div class="overlay" id="results" hidden></div>
        </div>
        <aside class="side">
          <section class="panel"><h3>The race · most fish home wins</h3><div class="ranks" id="ranks"></div></section>
          <section class="panel" id="mine">
            <h3>Your boat</h3>
            <div class="holdrow"><b>Hold</b><div class="holdbar"><i id="hold-bar"></i></div><span></span><small><b id="hold-n">0/10</b> · not yours until it's home</small></div>
            <div class="holdrow"><b>Home</b><span><b id="banked" class="bignum">0</b> fish banked</span></div>
            <div class="bigbtns"><button type="button" class="act cast" id="btn-cast">CAST 撒网<small>Space</small></button><button type="button" class="act dash" id="btn-dash">DASH 冲<small>Shift</small></button></div>
            <p class="keys"><kbd>tap/drag</kbd> or <kbd>WASD</kbd> sail · <kbd>Space</kbd> cast · <kbd>Shift</kbd> dash</p>
          </section>
          <section class="panel"><h3>On the lake</h3><ul class="log" id="log"></ul></section>
        </aside>
      </main>
      <div class="actionbar" id="actionbar"><span class="mini">hold <b id="ab-hold">0/10</b><br>home <b id="ab-banked">0</b></span><button type="button" class="act cast" id="ab-cast">CAST</button><button type="button" class="act dash" id="ab-dash">DASH</button></div>
    </div>
    ${error ? `<p class="error" role="alert" id="join-error">${esc(error)}</p>` : ""}
    <noscript><p class="card">This game needs JavaScript.</p></noscript>
    <script type="application/json" id="boot">${JSON.stringify(boot).replace(/</g, "\\u003c")}</script>`,
  );
}

export function createBoatRoutes(hub: BoatHub, store: BoatStore) {
  const rate = new Map<string, { n: number; at: number }>();
  const within = (token: string, now: number): boolean => {
    const r = rate.get(token);
    if (!r || now - r.at >= 1000) { rate.set(token, { n: 1, at: now }); return true; }
    return ++r.n <= INPUT_RATE;
  };
  const me = (req: IncomingMessage, code: string): { token: string; seat: number } | null => {
    const token = cookie(req, `boat_${code}`);
    if (!token) return null;
    const p = store.playerByToken(token);
    const room = store.roomByCode(code);
    return p && room && p.roomId === room.id ? { token, seat: p.seat } : null;
  };
  const readJson = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
    try { const t = await readBody(req, 1024); return t ? (JSON.parse(t) as Record<string, unknown>) : {}; } catch { return {}; }
  };

  // Returns true when the request was a boat route.
  return async (req: IncomingMessage, res: ServerResponse, path: string, method: string): Promise<boolean> => {
    if (path === "/b" && method === "GET") { sendHtml(res, 200, boatHome()); return true; }
    if (path === "/b" && method === "POST") { const { code } = store.createRoom(); redirect(res, `/b/${code}`); return true; }
    const m = path.match(CODE);
    if (!m) return false;
    const code = m[1], sub = m[2];
    const who = me(req, code);
    if (sub === undefined && method === "GET") {
      const view = hub.view(code, who?.seat ?? null);
      if (!view) { sendHtml(res, 404, page("No such room", `<main class="bhome"><section class="card"><h1>No room ${esc(code)}</h1><p><a href="/b">Open a new one</a></p></section></main>`)); return true; }
      sendHtml(res, 200, boatRoom(code, view));
      return true;
    }
    if (sub === "/join" && method === "POST") {
      const name = new URLSearchParams(await readBody(req, 4096)).get("name") ?? "";
      const r = hub.join(code, name);
      if (r.ok) {
        const secure = overHttps(req) ? "; Secure" : "";
        redirect(res, `/b/${code}`, { "set-cookie": `boat_${code}=${r.token}; HttpOnly; SameSite=Lax; Path=/b/${code}; Max-Age=${COOKIE_MAX_AGE_S}${secure}` });
        return true;
      }
      log({ event: "refused", action: "boat_join", room: code, reason: r.reason });
      if (r.reason === "no_room") { redirect(res, "/b"); return true; }
      const view = hub.view(code, null);
      sendHtml(res, 409, boatRoom(code, view, JOIN_MESSAGES[r.reason] ?? r.reason));
      return true;
    }
    if (sub === "/start" && method === "POST") {
      if (!who) { sendJson(res, 403, { ok: false, reason: "not_in_room" }); return true; }
      const body = await readJson(req);
      const r = hub.start(code, who.seat, { bots: body.bots === true });
      if (!r.ok) log({ event: "refused", action: "boat_start", room: code, seat: who.seat, reason: r.reason });
      sendJson(res, r.ok ? 200 : 409, r);
      return true;
    }
    if (sub === "/in" && method === "POST") {
      if (!who) { sendJson(res, 403, { ok: false, reason: "not_in_room" }); return true; }
      if (!within(who.token, Date.now())) { sendJson(res, 429, { ok: false, reason: "rate_limited" }); return true; }
      const body = await readJson(req);
      const r = hub.input(code, who.seat, { kind: String(body.k ?? ""), x: body.x, y: body.y });
      sendJson(res, r.ok ? 200 : 409, r);
      return true;
    }
    if (sub === "/events" && method === "GET") {
      if (!hub.open(code, res, who?.seat ?? null)) sendJson(res, 404, { ok: false, reason: "no_room" });
      return true;
    }
    sendJson(res, 405, { ok: false, reason: "method" });
    return true;
  };
}
