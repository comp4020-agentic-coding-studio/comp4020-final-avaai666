// The server: node:http, one store, one live hub, one tick a second (plus a
// 100 ms tick for lakes).
//   PORT (default 8080), DATA_DIR (default /data; the database is pond.db in it)
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { marked } from "marked";
import { createBoatRoutes } from "./boat-routes.ts";
import { createBoatHub } from "./lib/boat-hub.ts";
import { createGameHub } from "./lib/game-hub.ts";
import { openGameStore } from "./lib/game-store.ts";
import { MODE_IDS, MODES, READY } from "./lib/modes/index.ts";
import { createPlayRoutes } from "./play-routes.ts";
import { openBoatStore } from "./lib/boat-store.ts";
import { createLakeHub } from "./lib/lake-live.ts";
import { rebuild as rebuildLakeRunner } from "./lib/lake-runner.ts";
import { openLakeStore } from "./lib/lake-store.ts";
import { openStore } from "./lib/store.ts";
import { createHub } from "./live.ts";
import { log, roundMs } from "./log.ts";
import { createHandler } from "./routes.ts";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? "/data";

mkdirSync(DATA_DIR, { recursive: true });
const now = (): number => Date.now();
const store = openStore(join(DATA_DIR, "pond.db"), now, (ms) => log({ event: "commit", ms: roundMs(ms) }));
const hub = createHub(store, now, (err) => log({ event: "error", where: "tick", message: String(err) }));

const lakeStore = openLakeStore(join(DATA_DIR, "pond.db"), now, (ms) => log({ event: "commit", ms: roundMs(ms) }));
const lakeHub = createLakeHub((err) => log({ event: "error", where: "lake-tick", message: String(err) }));
// On boot, every live lake (started, no end row) is rebuilt from its ledger
// and stepped on to the present with nobody throwing, bots included.
for (const { lakeId, code } of lakeStore.liveLakes()) {
  const lake = lakeStore.lakeById(lakeId)!;
  const startRow = lakeStore.allRows(lakeId).find((r) => r.kind === "start")!;
  const { startedAt } = startRow.data as { startedAt: number };
  const families = lakeStore.familiesOf(lakeId);
  const rows = lakeStore.allRows(lakeId);
  const runner = rebuildLakeRunner({ store: lakeStore, lakeId, code, secret: lake.secret, startedAt, families, rows }, now());
  lakeHub.register(runner);
}

// The boat game (/b, experimental): its own tables in the same file, and a
// 20 Hz loop. A match that was running when the server stopped is interrupted.
const boatStore = openBoatStore(join(DATA_DIR, "pond.db"), now);
const boatHub = createBoatHub(boatStore, now, (err) => log({ event: "error", where: "boat-tick", message: String(err) }));

// The four games (/play): their own tables in the same file, and a 20 Hz loop.
const gameStore = openGameStore(join(DATA_DIR, "pond.db"), now);
const gameHub = createGameHub(gameStore, MODES, now, (err) => log({ event: "error", where: "play-tick", message: String(err) }), READY);

// README.md is rendered once, at startup.
const readmeHtml = marked.parse(readFileSync(join(ROOT, "README.md"), "utf8"), { async: false });

const handle = createHandler({
  store,
  hub,
  lakeStore,
  lakeHub,
  now,
  readmeHtml,
  staticDir: join(ROOT, "src", "static"),
  docsDir: join(ROOT, "docs"),
  boat: createBoatRoutes(boatHub, boatStore),
  play: createPlayRoutes(gameHub, gameStore, join(ROOT, "src", "static"), MODE_IDS),
});

const server = createServer((req, res) => {
  const start = performance.now();
  res.on("close", () => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    log({ method: req.method, path, status: res.statusCode, ms: roundMs(performance.now() - start) });
  });
  void handle(req, res);
});

const timer = setInterval(() => hub.tick(), 1000);
const lakeTimer = setInterval(() => lakeHub.tick(), 100);
const boatTimer = setInterval(() => boatHub.tick(), 25);
const playTimer = setInterval(() => gameHub.tick(), 25);

server.listen(PORT, "0.0.0.0", () => log({ event: "listening", port: PORT, dataDir: DATA_DIR }));

function shutdown(signal: string): void {
  log({ event: "shutdown", signal });
  clearInterval(timer);
  clearInterval(lakeTimer);
  clearInterval(boatTimer);
  clearInterval(playTimer);
  hub.close();
  lakeHub.close();
  boatHub.close();
  gameHub.close();
  server.close(() => {
    store.close();
    lakeStore.close();
    boatStore.close();
    gameStore.close();
    process.exit(0);
  });
  server.closeAllConnections();
  setTimeout(() => process.exit(1), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
