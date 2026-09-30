// The server: node:http, one store, one live hub, one tick a second.
//   PORT (default 8080), DATA_DIR (default /data; the database is pond.db in it)
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { marked } from "marked";
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

// README.md is rendered once, at startup.
const readmeHtml = marked.parse(readFileSync(join(ROOT, "README.md"), "utf8"), { async: false });

const handle = createHandler({
  store,
  hub,
  now,
  readmeHtml,
  staticDir: join(ROOT, "src", "static"),
  docsDir: join(ROOT, "docs"),
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

server.listen(PORT, "0.0.0.0", () => log({ event: "listening", port: PORT, dataDir: DATA_DIR }));

function shutdown(signal: string): void {
  log({ event: "shutdown", signal });
  clearInterval(timer);
  hub.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  server.closeAllConnections();
  setTimeout(() => process.exit(1), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
