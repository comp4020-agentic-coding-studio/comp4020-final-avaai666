import { chromium, devices } from "playwright";
const BASE = "http://localhost:3311";
const out = "./shots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
const errs = [];
const A = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const B = await browser.newContext({ ...devices["iPhone 13"] });
const pa = await A.newPage(), pb = await B.newPage();
for (const [n, p] of [["A", pa], ["B", pb]]) { p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${n} ${m.type()}: ${m.text()}`); }); p.on("pageerror", (e) => errs.push(`${n} pageerror: ${e.message}`)); }
await pa.goto(BASE + "/"); await pa.waitForTimeout(400);
await pa.screenshot({ path: `${out}/01-home.png`, fullPage: true });
await pa.click("text=Open a lake"); await pa.waitForURL(/\/l\/[A-Z]{4}$/);
const url = pa.url(); const code = url.slice(-4); console.log("lake", code);
await pa.fill("#name", "Ava"); await pa.click("button:has-text('Join')"); await pa.waitForTimeout(300);
await pb.goto(url); await pb.fill("#name", "Bill"); await pb.click("button:has-text('Join')");
const t0 = Date.now();
await pa.waitForSelector("text=Bill", { timeout: 5000 }); console.log("A saw Bill join after", Date.now() - t0, "ms");
await pa.screenshot({ path: `${out}/02-lobby-A.png`, fullPage: true });
await pb.screenshot({ path: `${out}/03-lobby-B-phone.png`, fullPage: true });
await pa.click("button:has-text('Start the season')");
await pa.waitForSelector("canvas#lake");
const t1 = Date.now(); await pb.waitForSelector("canvas#lake", { timeout: 6000 }); console.log("B moved to the lake after", Date.now() - t1, "ms");
await pa.waitForTimeout(3000);
await pa.screenshot({ path: `${out}/04-live-A.png` });
// throw a few nets at the middle of the lake from A, and tap from B
const box = await pa.locator("canvas#lake").boundingBox();
for (let i = 0; i < 3; i++) {
  await pa.mouse.click(box.x + box.width * (0.35 + 0.15 * i), box.y + box.height * 0.5);
  await pa.waitForTimeout(450);
  if (i === 0) await pa.screenshot({ path: `${out}/05-throw-A.png` });
  await pa.waitForTimeout(3300);
}
await pa.screenshot({ path: `${out}/06-after-throws-A.png` });
const bb = await pb.locator("canvas#lake").boundingBox();
await pb.tap ? null : null;
await pb.touchscreen.tap(bb.x + bb.width * 0.5, bb.y + bb.height * 0.45);
await pb.waitForTimeout(900);
await pb.screenshot({ path: `${out}/07-live-B-phone.png`, fullPage: false });
await pb.screenshot({ path: `${out}/07b-live-B-phone-full.png`, fullPage: true });
const log = await pa.locator("#rows").innerText(); console.log("A record:\n" + log.split("\n").slice(0, 12).join("\n"));
console.log("ERRORS:", errs.length ? errs.join("\n") : "none");
console.log(JSON.stringify({ code }));
await browser.close();
