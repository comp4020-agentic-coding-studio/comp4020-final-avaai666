// The /play routes (DESIGN.md "One lake, four games"), separate from /l, /p
// and /b, which keep working as they are. /play is the lobby, /play/CODE a
// room. The pages are shells: /static/play/world.js and one script per mode
// draw what the room's stream sends; every outcome comes from game-hub.ts.
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { cookie, overHttps, readBody, redirect, sendHtml, sendJson } from "./http.ts";
import type { GameHub } from "./lib/game-hub.ts";
import type { GameStore } from "./lib/game-store.ts";
import { PLAY_INPUT_RATE } from "./lib/game-constants.ts";
import { log } from "./log.ts";
import { lobbyPage, noRoomPage, roomPage } from "./play-pages.ts";

const CODE = /^\/play\/([BCDFGHJKLMNPQRSTVWXZ]{4})(\/join|\/start|\/mode|\/in|\/events|\/summary\.json)?$/;
const COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;
// the files /play may load: one per mode, the shared ones, and three
const FILES: Record<string, string> = {
  "play/world.js": "text/javascript; charset=utf-8",
  "play/art.js": "text/javascript; charset=utf-8",
  "play/room.js": "text/javascript; charset=utf-8",
  "play/lobby.js": "text/javascript; charset=utf-8",
  "play/rush.js": "text/javascript; charset=utf-8",
  "play/poach.js": "text/javascript; charset=utf-8",
  "play/party.js": "text/javascript; charset=utf-8",
  "play/hold.js": "text/javascript; charset=utf-8",
  "play/play.css": "text/css; charset=utf-8",
  "vendor/three.module.js": "text/javascript; charset=utf-8",
};
const JOIN_MESSAGES: Record<string, string> = {
  bad_name: "That name will not do: use 1 to 24 characters, not only spaces.",
  name_taken: "Someone in this room already has that name.",
  bot_name: "Names with \"bot\" are kept for bots. Pick another.",
  bad_character: "Pick one of the six fishers.",
  full: "This room is full for this game.",
};

export function createPlayRoutes(hub: GameHub, store: GameStore, staticDir: string, modeIds: string[]) {
  const rate = new Map<string, { n: number; at: number }>();
  const within = (token: string, now: number): boolean => {
    const r = rate.get(token);
    if (!r || now - r.at >= 1000) { rate.set(token, { n: 1, at: now }); return true; }
    return ++r.n <= PLAY_INPUT_RATE;
  };
  const me = (req: IncomingMessage, code: string): { token: string; seat: number } | null => {
    const token = cookie(req, `play_${code}`);
    if (!token) return null;
    const p = store.playerByToken(token);
    const room = store.roomByCode(code);
    return p && room && p.roomId === room.id ? { token, seat: p.seat } : null;
  };
  const readJson = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
    try { const t = await readBody(req, 2048); return t ? (JSON.parse(t) as Record<string, unknown>) : {}; } catch { return {}; }
  };

  // Returns true when the request was a /play route.
  return async (req: IncomingMessage, res: ServerResponse, path: string, method: string): Promise<boolean> => {
    const file = path.match(/^\/static\/((?:play|vendor)\/[\w.-]+)$/);
    if (file && method === "GET" && FILES[file[1]]) {
      try {
        const body = await readFile(join(staticDir, file[1]));
        res.writeHead(200, { "content-type": FILES[file[1]], "cache-control": "no-cache" });
        res.end(body);
      } catch { sendJson(res, 404, { ok: false, reason: "not_found" }); }
      return true;
    }
    if (path === "/play" && method === "GET") { sendHtml(res, 200, lobbyPage(hub.readyModes())); return true; }
    if (path === "/play" && method === "POST") {
      const form = new URLSearchParams(await readBody(req, 4096));
      const mode = form.get("mode") ?? "";
      if (!modeIds.includes(mode)) { sendHtml(res, 400, lobbyPage(hub.readyModes(), "Pick one of the four games.")); return true; }
      if (!hub.knows(mode)) { sendHtml(res, 409, lobbyPage(hub.readyModes(), "That game is not built yet: its card says when it is coming.")); return true; }
      const { code } = hub.createRoom(mode);
      redirect(res, `/play/${code}`);
      return true;
    }
    const m = path.match(CODE);
    if (!m) return false;
    const code = m[1], sub = m[2];
    const who = me(req, code);
    if (sub === undefined && method === "GET") {
      const view = hub.view(code, who?.seat ?? null);
      if (!view) { sendHtml(res, 404, noRoomPage(code)); return true; }
      sendHtml(res, 200, roomPage(view));
      return true;
    }
    if (sub === "/join" && method === "POST") {
      const form = new URLSearchParams(await readBody(req, 4096));
      const r = hub.join(code, form.get("name") ?? "", form.get("character") ?? "");
      if (r.ok) {
        const secure = overHttps(req) ? "; Secure" : "";
        redirect(res, `/play/${code}`, { "set-cookie": `play_${code}=${r.token}; HttpOnly; SameSite=Lax; Path=/play/${code}; Max-Age=${COOKIE_MAX_AGE_S}${secure}` });
        return true;
      }
      log({ event: "refused", action: "play_join", room: code, reason: r.reason });
      if (r.reason === "no_room") { redirect(res, "/play"); return true; }
      sendHtml(res, 409, roomPage(hub.view(code, null)!, JOIN_MESSAGES[r.reason] ?? r.reason));
      return true;
    }
    if (sub === "/summary.json" && method === "GET") {
      const s = hub.summaries(code);
      if (!s) sendJson(res, 404, { ok: false, reason: "no_room" });
      else sendJson(res, 200, { code, matches: s });
      return true;
    }
    if (sub === "/events" && method === "GET") {
      if (!hub.open(code, res, who?.seat ?? null)) sendJson(res, 404, { ok: false, reason: "no_room" });
      return true;
    }
    if ((sub === "/start" || sub === "/mode" || sub === "/in") && method === "POST") {
      if (!who) { sendJson(res, 403, { ok: false, reason: "not_in_room" }); return true; }
      if (sub === "/in" && !within(who.token, Date.now())) { sendJson(res, 429, { ok: false, reason: "rate_limited" }); return true; }
      const body = await readJson(req);
      const r = sub === "/start" ? hub.start(code, who.seat, { bots: body.bots === true })
        : sub === "/mode" ? hub.setMode(code, who.seat, String(body.mode ?? ""))
        : hub.input(code, who.seat, body);
      if (!r.ok && sub !== "/in") log({ event: "refused", action: `play${sub.replace("/", "_")}`, room: code, seat: who.seat, reason: r.reason });
      sendJson(res, r.ok ? 200 : 409, r);
      return true;
    }
    sendJson(res, 405, { ok: false, reason: "method" });
    return true;
  };
}
