import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

// README.md may only name files that exist: every backticked span that looks
// like a repo path (contains a "/" or ends in .md, .ts, .txt or .sh).

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const readme = readFileSync(`${ROOT}README.md`, "utf8");
const paths = [...readme.matchAll(/`([^`\s]+)`/g)]
  .map((m) => m[1])
  .filter((s) => s.includes("/") || /\.(md|ts|txt|sh)$/.test(s));

it("README.md names at least one repo path", () => {
  expect(paths.length).toBeGreaterThan(0);
});

it("every repo path README.md names exists", () => {
  expect(paths.filter((p) => !existsSync(`${ROOT}${p}`))).toEqual([]);
});
