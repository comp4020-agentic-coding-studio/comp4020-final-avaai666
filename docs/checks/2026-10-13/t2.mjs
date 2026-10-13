import { chromium } from "playwright";
const BASE = "http://localhost:3311", out = "./shots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const A = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const pa = await A.newPage();
pa.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
pa.on("console", (m) => { if (m.type() === "error" && !/TUNNEL|404|409/.test(m.text())) errs.push(m.text()); });
await pa.goto(BASE + "/"); await pa.click("text=Open a lake"); await pa.waitForURL(/\/l\/[A-Z]{4}$/);
await pa.fill("#name", "Ava"); await pa.click("button:has-text('Join')"); await pa.waitForTimeout(200);
await pa.click("button:has-text('Start the season')"); await pa.waitForSelector("canvas#lake");
const t0 = Date.now(); const el = () => (Date.now() - t0) / 1000;
const box = await pa.locator("canvas#lake").boundingBox();
// aim at the densest fish from the page's own frame data
async function bestSpot() {
  return pa.evaluate(() => null);
}
const shots = new Set();
async function shot(name) { if (shots.has(name)) return; shots.add(name); await pa.screenshot({ path: `${out}/${name}.png` }); console.log(el().toFixed(1), "shot", name); }
let i = 0, voted = new Set(), promised = false, sealed = false;
while (el() < 275) {
  const state = await pa.evaluate(() => ({ url: location.pathname, done: !!document.querySelector("main.debrief"), meeting: !document.getElementById("meeting")?.hidden, offer: !document.getElementById("offer")?.hidden, buy: document.getElementById("buy") && !document.getElementById("buy").disabled, year: document.getElementById("year")?.textContent }));
  if (state.done) break;
  if (state.offer && !promised) { await shot("10-offer"); await pa.click("#offer button:has-text('Promise')"); promised = true; await pa.waitForTimeout(1500); await shot("11-promised"); }
  if (state.buy && i > 3) { await pa.click("#buy"); await pa.waitForTimeout(500); await shot("09-bought"); }
  if (state.meeting && !voted.has(state.year)) {
    await pa.waitForTimeout(5000); await shot(`12-meeting-y${state.year}`);
    await pa.click(`#vote-options button[data-v="${state.year === "1" ? "ban" : "nursery"}"]`); voted.add(state.year);
    await pa.waitForTimeout(1200); await shot(`13-voted-y${state.year}`);
    continue;
  }
  if (!state.meeting) {
    // throw at a random spot in the inner lake
    const x = box.x + box.width * (0.3 + Math.random() * 0.4), y = box.y + box.height * (0.35 + Math.random() * 0.3);
    await pa.mouse.click(x, y); i++;
    if (i === 8) { await pa.waitForTimeout(700); await shot("08-haul"); }
    if (el() > 30 && !sealed) { await pa.click(".fam[data-seat='1']"); await pa.waitForTimeout(300); await shot("14-react"); await pa.click("#react button[data-s='怒']"); sealed = true; await pa.waitForTimeout(1300); await shot("15-sealed"); }
  }
  await pa.waitForTimeout(3600);
  if (el() > 54 && el() < 60) await shot("16-newyear-y2");
}
await pa.waitForSelector("main.debrief", { timeout: 30000 }).catch(() => {});
await pa.waitForTimeout(800);
await pa.screenshot({ path: `${out}/20-debrief.png`, fullPage: false });
await pa.screenshot({ path: `${out}/21-debrief-full.png`, fullPage: true });
const P = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pp = await P.newPage(); await pp.goto(pa.url()); await pp.waitForTimeout(500);
await pp.screenshot({ path: `${out}/22-debrief-phone.png`, fullPage: true });
console.log("ERRORS:", errs.length ? errs.join("\n") : "none");
await browser.close();
