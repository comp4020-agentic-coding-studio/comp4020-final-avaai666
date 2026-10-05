#!/usr/bin/env node
// Times SQLite write transactions in WAL mode under synchronous = FULL (the
// default fsync) and synchronous = NORMAL (what src/lib/store.ts uses), so
// decision 2 (docs/decisions/0002-durability.md) rests on a number anyone can
// re-measure. Usage: node scripts/measure-commit.ts [dir], default ./.data,
// the same disk `pnpm dev` writes to. Deletes the database files it makes.
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";

const WRITES = 50;
const MODES = ["FULL", "NORMAL"] as const;

const dir = resolve(process.argv[2] ?? "./.data");
mkdirSync(dir, { recursive: true });

// nearest-rank percentile of an ascending array
const percentile = (sorted: number[], p: number): number =>
  sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
const fmt = (ms: number): string => ms.toFixed(2);

console.log(`directory: ${dir}`);
console.log(`node: ${process.version}`);
console.log(`date: ${new Date().toISOString()}`);
console.log(`writes per mode: ${WRITES} (BEGIN IMMEDIATE; INSERT; COMMIT), WAL`);

for (const mode of MODES) {
  const file = join(dir, `measure-commit-${mode.toLowerCase()}-${process.pid}.db`);
  const db = new DatabaseSync(file);
  try {
    db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = ${mode};`);
    db.exec("CREATE TABLE t (v INTEGER)");
    const insert = db.prepare("INSERT INTO t (v) VALUES (?)");
    const times: number[] = [];
    for (let i = 0; i < WRITES; i++) {
      const start = performance.now();
      db.exec("BEGIN IMMEDIATE");
      insert.run(i);
      db.exec("COMMIT");
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    console.log(
      `${mode.padEnd(6)} median ${fmt(percentile(times, 50))} ms, p90 ${fmt(percentile(times, 90))} ms, ` +
        `min ${fmt(times[0])} ms, max ${fmt(times[times.length - 1])} ms`,
    );
  } finally {
    db.close();
    for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
  }
}
