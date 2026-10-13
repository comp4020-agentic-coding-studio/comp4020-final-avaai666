// The routes (DESIGN.md, Routes). Each answer is logged by server.ts; refused
// actions are logged here too.
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { isIdempotencyKey } from "./lib/keys.ts";
import { FILL_TO } from "./lib/game-constants.ts";
import { type LakeHub } from "./lib/lake-live.ts";
import { publicRow, rebuild as rebuildLakeRunner, type Runner } from "./lib/lake-runner.ts";
import type { FamilyRow, LakeLedgerRow, LakeStore } from "./lib/lake-store.ts";
import { available } from "./lib/pond.ts";
import type { Rule } from "./lib/rules.ts";
import { type Clock, NoPondError, type Store } from "./lib/store.ts";
import { cookie, overHttps, readBody, redirect, sameOrigin, sendHtml, sendJson, TooLarge } from "./http.ts";
import type { Hub } from "./live.ts";
import { lakeHomePage, lakePage } from "./lake-pages.ts";
import { log } from "./log.ts";
import { errorPage, pondPage, readmePage } from "./pages.ts";

const DIG_INTERVAL_MS = 10_000;
const COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;
const BODY_LIMIT = 4096;
const RECENT_ROWS = 30;
const LAKE_RATE_LIMIT = 10; // POSTs per second, per family
const RULES: Rule[] = ["none", "ban", "spring", "nursery"];
const CODE = "[BCDFGHJKLMNPQRSTVWXZ]{4}";

const STATIC: Record<string, string> = {
  "app.js": "text/javascript; charset=utf-8",
  "lake.js": "text/javascript; charset=utf-8",
  "lake.css": "text/css; charset=utf-8",
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
  lakeStore: LakeStore;
  lakeHub: LakeHub;
  now: Clock;
  readmeHtml: string;
  staticDir: string;
  docsDir: string;
}

const refused = (action: string, pond: number | null, net: number | null, reason: string): void =>
  log({ event: "refused", action, pond, net, reason });

const lakeRefused = (action: string, lake: string, seat: number | null, reason: string): void =>
  log({ event: "refused", action, lake, seat, reason });

export function createHandler({ store, hub, lakeStore, lakeHub, now, readmeHtml, staticDir, docsDir }: Deps) {
  // client IP → when it last dug, for the dig limit
  const lastDig = new Map<string, number>();
  // a family's token → posts in the current second, for the lake rate limit
  const lakeRate = new Map<string, { count: number; windowStart: number }>();

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

  // ---- lakes (DESIGN.md v2.2) ----

  const LAKE_STATUS: Record<string, number> = {
    no_lake: 404,
    not_in_lake: 403,
    started: 409,
    full: 409,
    bad_name: 400,
    name_taken: 409,
    bot_name: 409,
    over: 410,
    not_fishing: 422,
    not_meeting: 422,
    outside: 422,
    no_fine_net: 422,
    already_owned: 409,
    cannot_afford: 422,
    already_promised: 409,
    no_such_ask: 404,
    self: 400,
    bad_rule: 400,
    bad_seal: 400,
    bad_key: 400,
    too_soon: 429,
    rate_limited: 429,
  };

  function toPublicRows(rows: LakeLedgerRow[], families: FamilyRow[]): ReturnType<typeof publicRow>[] {
    const seatOf = new Map(families.map((f) => [f.familyId, f.seat]));
    return rows.map((r) => publicRow(r, seatOf));
  }

  const famIn = (req: IncomingMessage, code: string): { token: string; familyId: number; lakeId: number; seat: number; name: string } | null => {
    const token = cookie(req, `fam_${code}`);
    const fam = token ? lakeStore.familyByToken(token) : null;
    return token && fam ? { token, ...fam } : null;
  };

  // Within the rate limit (10 POSTs/second per family token).
  function withinRate(token: string): boolean {
    const t = now();
    const r = lakeRate.get(token);
    if (!r || t - r.windowStart >= 1000) {
      lakeRate.set(token, { count: 1, windowStart: t });
      return true;
    }
    r.count++;
    return r.count <= LAKE_RATE_LIMIT;
  }

  // A runner for a started lake, live in the hub already or rebuilt now
  // (e.g. the first request to reach it since the server started).
  function liveRunner(lakeId: number, code: string, secret: string, startedAt: number): Runner {
    const existing = lakeHub.runnerFor(lakeId);
    if (existing) return existing;
    const families = lakeStore.familiesOf(lakeId);
    const rows = lakeStore.allRows(lakeId);
    const runner = rebuildLakeRunner({ store: lakeStore, lakeId, code, secret, startedAt, families, rows }, now());
    lakeHub.register(runner);
    return runner;
  }

  function showLake(req: IncomingMessage, res: ServerResponse, code: string, status = 200, error?: string): void {
    const lake = lakeStore.lakeByCode(code);
    if (!lake) return notFound(res);
    const fam = famIn(req, code);
    const me = fam?.seat ?? null;
    const rows = lakeStore.allRows(lake.id);
    const startRow = rows.find((r) => r.kind === "start");
    const endRow = rows.find((r) => r.kind === "end");
    const families = lakeStore.familiesOf(lake.id);

    if (endRow) {
      const end = endRow.data as { kept: number[]; parts: number[]; grownFish: number; nextYear: number; secret: string; step: number; years: number[] };
      return sendHtml(
        res,
        status,
        lakePage({
          state: "done",
          code,
          families: families.map((f) => ({ seat: f.seat, name: f.name, bot: f.bot !== null })),
          end,
          rows: toPublicRows(rows, families),
          me,
        }),
      );
    }

    if (startRow) {
      const { startedAt } = startRow.data as { startedAt: number };
      const runner = liveRunner(lake.id, code, lake.secret, startedAt);
      return sendHtml(res, status, lakePage({ state: "live", code, snapshot: runner.snapshot(), me }));
    }

    return sendHtml(
      res,
      status,
      lakePage({ state: "pre", code, families: families.map((f) => ({ seat: f.seat, name: f.name })), me, error, rows: toPublicRows(rows, families) }),
    );
  }

  function openLake(res: ServerResponse): void {
    const { code } = lakeStore.openLake();
    redirect(res, `/l/${code}`);
  }

  async function joinLake(req: IncomingMessage, res: ServerResponse, code: string): Promise<void> {
    const name = new URLSearchParams(await readBody(req, BODY_LIMIT)).get("name") ?? "";
    const result = lakeStore.join(code, name);
    if (result.ok) {
      const lake = lakeStore.lakeByCode(code)!;
      lakeHub.lobbyJoined(lake.id, result.row, lakeStore.familiesOf(lake.id));
      const secure = overHttps(req) ? "; Secure" : "";
      const setCookie = `fam_${code}=${result.token}; HttpOnly; SameSite=Lax; Path=/l/${code}; Max-Age=${COOKIE_MAX_AGE_S}${secure}`;
      return redirect(res, `/l/${code}`, { "set-cookie": setCookie });
    }
    lakeRefused("join", code, null, result.reason);
    if (result.reason === "no_lake") return notFound(res);
    const messages: Record<string, string> = {
      bad_name: "That name will not do: use 1 to 24 characters, not only spaces, and no invisible characters.",
      name_taken: "Someone in this lake already has that name. Pick another.",
      bot_name: "That name belongs to a bot. Pick another.",
      full: "This lake already has eight families.",
      started: "This lake has already started.",
    };
    showLake(req, res, code, LAKE_STATUS[result.reason] ?? 400, messages[result.reason]);
  }

  function startLake(req: IncomingMessage, res: ServerResponse, code: string): void {
    const lake = lakeStore.lakeByCode(code);
    if (!lake) return notFound(res);
    const fam = famIn(req, code);
    if (!fam || fam.lakeId !== lake.id) {
      lakeRefused("start", code, null, "not_in_lake");
      return sendJson(res, 403, { ok: false, reason: "not_in_lake" });
    }
    const rows = lakeStore.allRows(lake.id);
    if (rows.some((r) => r.kind === "start")) {
      lakeRefused("start", code, fam.seat, "started");
      return redirect(res, `/l/${code}`);
    }
    const families = lakeStore.familiesOf(lake.id);
    const bots = Math.max(0, FILL_TO - families.length);
    const startedAt = now();
    lakeStore.start(lake.id, startedAt, bots);
    liveRunner(lake.id, code, lake.secret, startedAt);
    lakeHub.lobbyStarted(lake.id);
    redirect(res, `/l/${code}`);
  }

  async function lakeAction(req: IncomingMessage, res: ServerResponse, code: string, run: (runner: Runner, fam: NonNullable<ReturnType<typeof famIn>>, body: Record<string, unknown>) => { ok: true } | { ok: false; reason: string }): Promise<void> {
    const lake = lakeStore.lakeByCode(code);
    if (!lake) return notFound(res);
    const fam = famIn(req, code);
    if (!fam || fam.lakeId !== lake.id) {
      lakeRefused("action", code, null, "not_in_lake");
      return sendJson(res, 403, { ok: false, reason: "not_in_lake" });
    }
    if (!withinRate(fam.token)) {
      lakeRefused("action", code, fam.seat, "rate_limited");
      return sendJson(res, 429, { ok: false, reason: "rate_limited" });
    }
    const runner = lakeHub.runnerFor(lake.id);
    if (!runner) {
      lakeRefused("action", code, fam.seat, "not_started");
      return sendJson(res, 409, { ok: false, reason: "not_started" });
    }
    let body: Record<string, unknown> = {};
    try {
      const text = await readBody(req, BODY_LIMIT);
      if (text) body = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof TooLarge) throw err;
      return sendJson(res, 400, { ok: false, reason: "bad_body" });
    }
    const result = run(runner, fam, body);
    lakeHub.afterWrite(lake.id);
    if (result.ok) return sendJson(res, 200, { ok: true });
    lakeRefused("action", code, fam.seat, result.reason);
    sendJson(res, LAKE_STATUS[result.reason] ?? 400, { ok: false, reason: result.reason });
  }

  function lakeEvents(req: IncomingMessage, res: ServerResponse, url: URL, code: string): void {
    const lake = lakeStore.lakeByCode(code);
    if (!lake) return notFound(res);
    const rows = lakeStore.allRows(lake.id);
    const startRow = rows.find((r) => r.kind === "start");
    if (!startRow) return lakeHub.openLobby(lake.id, res);
    const { startedAt } = startRow.data as { startedAt: number };
    liveRunner(lake.id, code, lake.secret, startedAt);
    const header = req.headers["last-event-id"];
    const raw = typeof header === "string" ? header : url.searchParams.get("after");
    const lastEventId = raw !== null && /^\d{1,15}$/.test(raw) ? Number(raw) : null;
    const fam = famIn(req, code);
    lakeHub.open(lake.id, res, fam?.seat ?? null, lastEventId);
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

    if (path === "/" && method === "GET") {
      const rawCode = url.searchParams.get("code");
      if (rawCode !== null) {
        const upper = rawCode.toUpperCase();
        if (new RegExp(`^${CODE}$`).test(upper)) return redirect(res, `/l/${upper}`);
      }
      return sendHtml(res, 200, lakeHomePage(lakeStore.pastLakes()));
    }
    if (path === "/dig" && method === "POST") return dig(req, res);
    if (path === "/lakes" && method === "POST") return openLake(res);
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

    const lake = path.match(new RegExp(`^/l/(${CODE})(/join|/start|/throw|/buy|/vote|/promise/answer|/promise|/seal|/events)?$`));
    if (lake) {
      const code = lake[1];
      const sub = lake[2];
      if (sub === undefined && method === "GET") return showLake(req, res, code);
      if (sub === "/join" && method === "POST") return await joinLake(req, res, code);
      if (sub === "/start" && method === "POST") return startLake(req, res, code);
      if (sub === "/throw" && method === "POST") {
        return await lakeAction(req, res, code, (runner, fam, body) => {
          const x = Number(body.x),
            y = Number(body.y),
            key = body.key;
          const net = body.net === "fine" ? ("fine" as const) : ("coarse" as const);
          if (!Number.isFinite(x) || !Number.isFinite(y) || !isIdempotencyKey(key)) return { ok: false, reason: "bad_key" };
          return runner.throwNet(fam.seat, { x, y, net, key });
        });
      }
      if (sub === "/buy" && method === "POST") return await lakeAction(req, res, code, (runner, fam) => runner.buy(fam.seat));
      if (sub === "/vote" && method === "POST") {
        return await lakeAction(req, res, code, (runner, fam, body) => {
          const rule = body.rule;
          if (typeof rule !== "string" || !RULES.includes(rule as Rule)) return { ok: false, reason: "bad_rule" };
          return runner.vote(fam.seat, rule as Rule);
        });
      }
      if (sub === "/promise" && method === "POST") {
        return await lakeAction(req, res, code, (runner, fam, body) => {
          const to = Number(body.to);
          if (!Number.isInteger(to)) return { ok: false, reason: "self" };
          return runner.ask(fam.seat, to);
        });
      }
      if (sub === "/promise/answer" && method === "POST") {
        return await lakeAction(req, res, code, (runner, fam, body) => {
          const from = Number(body.from);
          if (!Number.isInteger(from)) return { ok: false, reason: "no_such_ask" };
          return runner.answer(fam.seat, from, body.yes === true);
        });
      }
      if (sub === "/seal" && method === "POST") {
        return await lakeAction(req, res, code, (runner, fam, body) => {
          const to = Number(body.to);
          const seal = typeof body.seal === "string" ? body.seal : "";
          if (!Number.isInteger(to)) return { ok: false, reason: "self" };
          return runner.seal(fam.seat, to, seal);
        });
      }
      if (sub === "/events" && method === "GET") return lakeEvents(req, res, url, code);
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
