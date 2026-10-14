import { chromium } from "playwright";
const BASE = "http://localhost:3311", out = "./shots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const A = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const B = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pa = await A.newPage(), pb = await B.newPage();
for (const [n, p] of [["A", pa], ["B", pb]]) { p.on("pageerror", (e) => errs.push(`${n} pageerror ${e.message}`)); }
await pa.goto(BASE + "/b"); await pa.click("text=Open a room"); await pa.waitForURL(/\/b\/[A-Z]{4}$/); const url = pa.url();
await pa.fill("#name", "Ava"); await pa.click("button:has-text('Join')"); await pa.waitForTimeout(300);
await pb.goto(url); await pb.fill("#name", "Bill"); await pb.tap("button:has-text('Join')"); await pb.waitForTimeout(300);
await pa.evaluate(() => { document.getElementById("bots").checked = false; }); await pa.click("#startbtn");
await pa.waitForTimeout(3600);
const toScreen = (page, x, y) => page.evaluate(([x, y]) => { const cv = document.getElementById("lake"), r = cv.getBoundingClientRect(); const scale = Math.min(r.width / 1160, r.height / 860), offX = (r.width - 1160 * scale) / 2, offY = (r.height - 860 * scale) / 2; return { x: r.left + offX + (x + 80) * scale, y: r.top + offY + (y + 80) * scale }; }, [x, y]);
const state = (page) => page.evaluate(() => { const F = window.__quickCatch.latest(), v = window.__quickCatch.view(); if (!F) return null; const me = F.boats.get(v.myBoat); const fish = [...F.fish.values()].filter(f => f[4] === 1).map(f => [f[1], f[2]]); return { t: F.t, left: F.left, me, others: [...F.boats.values()].filter(b => b[0] !== v.myBoat), fish, state: v.state, myBoat: v.myBoat }; });
// latency: A steers; how soon does B's frame show A's new target?
const lat = [];
for (let i = 0; i < 5; i++) {
  const tx = 300 + i * 80, ty = 250 + (i % 2) * 150;
  const p = await toScreen(pa, tx, ty); const t0 = Date.now(); await pa.mouse.click(p.x, p.y);
  for (;;) { const s = await state(pb); const a = s && s.others.find(b => b[0] === 0); if (a && Math.abs(a[8] - tx) <= 2 && Math.abs(a[9] - ty) <= 2) { lat.push(Date.now() - t0); break; } if (Date.now() - t0 > 3000) { lat.push(-1); break; } await pb.waitForTimeout(15); }
  await pa.waitForTimeout(400);
}
console.log("A steer -> seen in B's frame (ms):", lat.join(", "));
// smart play for both: go to the densest school, cast when fish at the bow, go home at 7 (A) / 9 (B), B rams A when A is loaded
const dock = { 0: [500, 633], 1: [500, 67] };
async function play(page, who, homeAt, ram) {
  const s = await state(page); if (!s || !s.me || s.state !== "play") return s;
  const [seat, x, y, h100, n, , flags, banked, tx, ty, castCd, dashCd] = s.me; const h = h100 / 100;
  const go = async (gx, gy) => { const p = await toScreen(page, gx, gy); if (who === "A") await page.mouse.click(p.x, p.y); else await page.touchscreen.tap(p.x, p.y); };
  if (n >= homeAt || s.left < 12) { if (Math.hypot(tx - dock[seat][0], ty - dock[seat][1]) > 5) await go(...dock[seat]); return s; }
  if (ram) { const a = s.others[0]; if (a && a[4] >= 4 && Math.hypot(a[1] - x, a[2] - y) < 160 && dashCd === 0) { await go(a[1], a[2]); await page.waitForTimeout(100); if (who === "A") await page.keyboard.press("Shift"); else await page.tap("#ab-dash"); return s; } }
  // densest school
  let best = null, bn = 0; for (const f of s.fish) { let c = 0; for (const g of s.fish) if ((g[0] - f[0]) ** 2 + (g[1] - f[1]) ** 2 < 45 * 45) c++; if (c > bn) { bn = c; best = f; } }
  if (best && Math.hypot(tx - best[0], ty - best[1]) > 30) await go(best[0], best[1]);
  const bx = x + Math.cos(h) * 40, by = y + Math.sin(h) * 40; let under = 0; for (const f of s.fish) if ((f[0] - bx) ** 2 + (f[1] - by) ** 2 < 38 * 38) under++;
  if (under >= 2 && castCd === 0) { if (who === "A") await page.keyboard.press("Space"); else await page.tap("#ab-cast"); }
  return s;
}
let shot = 0;
for (let i = 0; i < 400; i++) {
  const s = await play(pa, "A", 7, false); await play(pb, "B", 9, true);
  if (!s || s.state !== "play") break;
  if (shot === 0 && s.t > 30) { await pa.screenshot({ path: `${out}/20-smart-A.png` }); await pb.screenshot({ path: `${out}/21-smart-B.png` }); shot++; }
  if (shot === 1 && s.t > 75) { await pa.screenshot({ path: `${out}/22-smart-A.png` }); shot++; }
  await pa.waitForTimeout(120);
}
await pa.waitForSelector("#results:not([hidden])", { timeout: 60000 }); await pa.waitForTimeout(600);
await pa.screenshot({ path: `${out}/23-results-A.png` }); await pb.screenshot({ path: `${out}/24-results-B.png`, fullPage: true });
const res = await pa.evaluate(() => window.__quickCatch.view().results);
console.log(JSON.stringify(res));
console.log("ERRORS:", errs.length ? errs.join("\n") : "none");
await browser.close();
