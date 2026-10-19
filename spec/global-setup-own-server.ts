import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    ownServerUrl: string;
  }
}

// For the tests that need a server to themselves (spec/lake-frames.test.ts):
// start one app on its own port with a temporary DATA_DIR before the project
// runs, stop it after. Never production; the port is the test's own.
let server: ChildProcess | null = null;
let dir = "";

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const port = 9100 + (process.pid % 700);
  dir = mkdtempSync(join(tmpdir(), "own-server-"));
  server = spawn(process.execPath, ["src/server.ts"], { env: { ...process.env, PORT: String(port), DATA_DIR: dir }, stdio: "ignore" });
  const base = `http://localhost:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ }
    if (i > 300) throw new Error("the test's own server did not start");
    await new Promise((r) => setTimeout(r, 100));
  }
  project.provide("ownServerUrl", base);
  return async () => {
    const s = server!;
    const gone = new Promise((r) => s.once("exit", r));
    s.kill("SIGTERM");
    await gone;
    rmSync(dir, { recursive: true, force: true });
  };
}
