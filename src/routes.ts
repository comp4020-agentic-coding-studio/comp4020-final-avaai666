// The routes (DESIGN.md, Routes). Each answer is logged by server.ts; refused
// actions are logged here too.
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { isIdempotencyKey } from "./lib/keys.ts";
import { available } from "./lib/pond.ts";
import { type Clock, NoPondError, type Store } from "./lib/store.ts";
import { cookie, overHttps, readBody, redirect, sameOrigin, sendHtml, sendJson, TooLarge } from "./http.ts";
import type { Hub } from "./live.ts";
import { log } from "./log.ts";
import { errorPage, pondPage, readmePage, registerPage } from "./pages.ts";

const DIG_INTERVAL_MS = 10_000;
const COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;
const BODY_LIMIT = 4096;
const RECENT_ROWS = 30;

const STATIC: Record<string, string> = {
  "app.js": "text/javascript; charset=utf-8",
  "style.css": "text/css; charset=utf-8",
};
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export interface Deps {
  store: Store;
  hub: Hub;
  now: Clock;
  readmeHtml: string;
  staticDir: string;
  docsDir: string;
}

const refused = (action: string, pond: number | null, net: number | null, reason: string): void =>
  log({ event: "refused", action, pond, net, reason });

export function createHandler({ store, hub, now, readmeHtml, staticDir, docsDir }: Deps) {
  // client IP → when it last dug, for the dig limit
  const lastDig = new Map<string, number>();

  const crossOrigin = (res: ServerResponse): void => {
    refused("post", null, null, "cross_origin");
    sendJson(res, 403, {});
  };

  const notFound = (res: ServerResponse): void =>
    sendHtml(res, 404, errorPage("Not found", "There is nothing at this address."));

  const netIn = (req: IncomingMessage, pondId: number): { token: string; netId: number; name: string } | null => {
    const token = cookie(req, `net_${pondId}`);
    const net = token ? store.netByToken(token) : null;
    return token && net && net.pondId === pondId ? { token, netId: net.netId, name: net.name } : null;
  };

  function showPond(req: IncomingMessage, res: ServerResponse, pondId: number, status = 200, error?: string, typedName?: string): void {
    const state = store.evaluate(pondId);
    const me = netIn(req, pondId)?.name ?? null;
    const rows = store.recentRows(pondId, RECENT_ROWS);
    sendHtml(res, status, pondPage({ state, rows, me, now: now(), error, typedName }));
  }

  function dig(req: IncomingMessage, res: ServerResponse): void {
    const ip = req.headers["fly-client-ip"];
    const t = now();
    if (typeof ip === "string") {
      const last = lastDig.get(ip);
      if (last !== undefined && t - last < DIG_INTERVAL_MS) {
        refused("dig", null, null, "too_soon");
        return sendHtml(res, 429, errorPage("Too soon", "You dug a pond a few seconds ago. Wait a moment and try again."));
      }
      if (lastDig.size > 10_000) for (const [k, v] of lastDig) if (t - v >= DIG_INTERVAL_MS) lastDig.delete(k);
      lastDig.set(ip, t);
    }
    const { pondId } = store.digPond();
    redirect(res, `/p/${pondId}`);
  }

  async function joinPond(req: IncomingMessage, res: ServerResponse, pondId: number): Promise<void> {
    const name = new URLSearchParams(await readBody(req, BODY_LIMIT)).get("name") ?? "";
    const result = store.join(pondId, name);
    if (result.ok) {
      hub.afterWrite(pondId);
      const secure = overHttps(req) ? "; Secure" : "";
      const setCookie = `net_${pondId}=${result.token}; HttpOnly; SameSite=Lax; Path=/p/${pondId}; Max-Age=${COOKIE_MAX_AGE_S}${secure}`;
      return redirect(res, `/p/${pondId}`, { "set-cookie": setCookie });
    }
    refused("join", pondId, null, result.reason);
    if (result.reason === "no_pond") return notFound(res);
    const answers = {
      bad_name: [400, "That name will not do: use 1 to 24 characters, not only spaces, and no invisible characters."],
      name_taken: [409, "Someone in this pond already has that name. Pick another."],
      pond_full: [409, "This pond is full: it already has 100 nets."],
      dead: [410, "This pond is dead. Nobody can join it now."],
    } as const;
    const [status, message] = answers[result.reason];
    showPond(req, res, pondId, status, message, name);
  }

  async function catchFish(req: IncomingMessage, res: ServerResponse, pondId: number): Promise<void> {
    let key: unknown;
    try {
      key = (JSON.parse(await readBody(req, BODY_LIMIT)) as { key?: unknown })?.key;
    } catch (err) {
      if (err instanceof TooLarge) throw err;
    }
    if (!isIdempotencyKey(key)) {
      refused("catch", pondId, null, "bad_key");
      return sendJson(res, 400, {});
    }
    const token = cookie(req, `net_${pondId}`);
    const result = token ? store.catchFish(token, pondId, key) : ({ ok: false, reason: "not_in_pond" } as const);
    if (result.ok) {
      hub.afterWrite(pondId);
      return sendJson(res, 200, { ok: true, available: available(result.row.stockAfter), id: result.row.id });
    }
    refused("catch", pondId, token ? (store.netByToken(token)?.netId ?? null) : null, result.reason);
    if (result.reason === "too_soon") return sendJson(res, 429, { retryInMs: result.retryInMs });
    const status = { dead: 410, not_in_pond: 403, bad_key: 400 }[result.reason];
    sendJson(res, status, {});
  }

  function events(req: IncomingMessage, res: ServerResponse, url: URL, pondId: number): void {
    const header = req.headers["last-event-id"];
    const raw = typeof header === "string" ? header : url.searchParams.get("after");
    const lastEventId = raw !== null && /^\d{1,15}$/.test(raw) ? Number(raw) : null;
    hub.open(pondId, res, netIn(req, pondId)?.netId ?? null, lastEventId);
  }

  async function sendFile(res: ServerResponse, path: string, type: string): Promise<void> {
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
      res.end(body);
    } catch {
      notFound(res);
    }
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method === "HEAD" ? "GET" : req.method;

    if (req.method === "POST" && !sameOrigin(req)) return crossOrigin(res);

    if (path === "/" && method === "GET") return sendHtml(res, 200, registerPage(store.listPonds(), now()));
    if (path === "/dig" && method === "POST") return dig(req, res);
    if (path === "/readme") return redirect(res, "/readme/");
    if (path === "/readme/" && method === "GET") return sendHtml(res, 200, readmePage(readmeHtml));

    const stat = path.match(/^\/static\/([\w.-]+)$/);
    if (stat && method === "GET" && STATIC[stat[1]]) return sendFile(res, join(staticDir, stat[1]), STATIC[stat[1]]);
    const doc = path.match(/^\/docs\/([\w-][\w.-]*)\.(\w+)$/);
    if (doc && method === "GET" && IMAGE_TYPES[doc[2].toLowerCase()]) {
      return sendFile(res, join(docsDir, `${doc[1]}.${doc[2]}`), IMAGE_TYPES[doc[2].toLowerCase()]);
    }

    const pond = path.match(/^\/p\/([1-9]\d{0,9})(\/join|\/catch|\/events)?$/);
    if (pond) {
      const pondId = Number(pond[1]);
      try {
        if (pond[2] === undefined && method === "GET") return showPond(req, res, pondId);
        if (pond[2] === "/join" && method === "POST") return await joinPond(req, res, pondId);
        if (pond[2] === "/catch" && method === "POST") return await catchFish(req, res, pondId);
        if (pond[2] === "/events" && method === "GET") return events(req, res, url, pondId);
      } catch (err) {
        if (err instanceof NoPondError) return notFound(res);
        throw err;
      }
      return sendHtml(res, 405, errorPage("Not allowed", "That method is not allowed here."));
    }

    notFound(res);
  }

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      await route(req, res);
    } catch (err) {
      if (err instanceof TooLarge) return sendJson(res, 413, {});
      log({ event: "error", path: new URL(req.url ?? "/", "http://localhost").pathname, message: String(err) });
      if (!res.headersSent) sendHtml(res, 500, errorPage("Something broke", "The server hit an error. Try again."));
      else res.end();
    }
  };
}
