#!/usr/bin/env node
// One-off visual checks against the RUNNING app (never production), using
// Playwright (docs/decisions/0004-playwright-dev-only.md). Not run by pnpm
// test or pnpm check: a jsdom test cannot tell a black screen from a lake,
// so this is how a 3D rendering change is actually looked at, by hand.
// CLAUDE.md "Rules for /play": a change to a /play client script is not done
// until this script has started a match of that mode with no console errors.
//
//   APP_URL=http://localhost:8080 node scripts/browser-check.ts rush-world5
//   APP_URL=http://localhost:8080 node scripts/browser-check.ts match rush
import { chromium } from "playwright";

const base = process.env.APP_URL ?? "http://localhost:8080";
if (/fly\.dev/.test(base)) throw new Error("never point this at production");

// starts a real match of `mode` (host + bots), waits past the 3-2-1
// countdown, and reports every console/page error seen along the way
async function matchCheck(mode: string): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(`${base}/play`);
  await page.click(`.mode-btn[data-mode='${mode}']`);
  await page.click("#create");
  await page.waitForURL(/\/play\/[A-Z]{4}$/);
  await page.fill("#name", "Mei");
  await page.click(".joinform button[type=submit]");
  await page.waitForSelector("#startbtn:not([hidden])");
  await page.check("#bots");
  await page.click("#startbtn");
  await page.waitForURL(/\/play\/[A-Z]{4}\/game$/, { timeout: 10000 });
  await page.waitForTimeout(4000); // past the 3-2-1 countdown, into play
  console.log(`${mode}: reached play, ${errors.length === 0 ? "no console errors" : `errors: ${errors.join(" | ")}`}`);
  await browser.close();
  if (errors.length) process.exitCode = 1;
}

async function rushWorld5(): Promise<void> {
  const r = await fetch(`${base}/play`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "mode=rush" });
  const code = new URL(r.headers.get("location")!, base).pathname.split("/")[2];
  console.log(`created room ${code}`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(`${base}/play/${code}/game`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // let the scene build and a few frames render

  const glHidden = await page.$eval("#gl", (el) => (el as HTMLElement).hidden);
  const gl5Hidden = await page.$eval("#gl5", (el) => (el as HTMLElement).hidden);
  const miniHidden = await page.$eval("#mini", (el) => (el as HTMLElement).hidden);
  console.log(`room ${code}: #gl hidden=${glHidden}, #gl5 hidden=${gl5Hidden}, #mini hidden=${miniHidden}`);
  console.log(`console/page errors: ${errors.length ? errors.join(" | ") : "none"}`);

  await page.screenshot({ path: "/tmp/browser-check-rush-world5.png" });
  console.log("screenshot: /tmp/browser-check-rush-world5.png");
  await browser.close();
}

const CHECKS: Record<string, () => Promise<void>> = {
  "rush-world5": rushWorld5,
  match: async () => {
    const mode = process.argv[3];
    if (!mode) { console.error("usage: node scripts/browser-check.ts match <rush|poach|party|hold>"); process.exit(1); }
    await matchCheck(mode);
  },
};
const name = process.argv[2];
if (!name || !CHECKS[name]) { console.error(`usage: node scripts/browser-check.ts <${Object.keys(CHECKS).join("|")}>`); process.exit(1); }
await CHECKS[name]();
