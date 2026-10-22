import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, expect, it } from "vitest";
import { openStream, post } from "./play-helpers.ts";
import { A0, blockedAt, nr, Y0, ZONES } from "../src/lib/lake-world.ts";
import { RUSH } from "../src/lib/game-constants.ts";

// a steer target, in the v5 lake's own 92 x 64 space (rule change 2): open
// water, not a zone, the island or winter ice, so a wrong point fails loudly
// here rather than timing out below if the shape ever changes again
const STEER_X = 43, STEER_Y = 21;
const isOpenWater = (x: number, y: number) =>
  nr(x, y) < 0.6 && !blockedAt(x, y, 0) && !blockedAt(x, y, 3) && !Object.values(ZONES).some((z) => Math.hypot(x - z.x, y - z.y) < z.r);
if (!isOpenWater(STEER_X, STEER_Y)) throw new Error(`(${STEER_X}, ${STEER_Y}) is not open water in the current lake shape`);

// a full match's own length (4 seasons, their rests and markets), not a
// hard-coded number, so a future season-length tune cannot silently make
// this wait too short again (rule change 1, 4 x 45 s seasons)
const MATCH_S = RUSH.SEASONS * RUSH.SEASON_S + (RUSH.SEASONS - 1) * RUSH.REST_S + (RUSH.SEASONS - 1) * (RUSH.MARKET_S + RUSH.REVEAL_S); // winter's gong ends the match directly: no fourth rest (bug fix)
const END_WAIT_MS = MATCH_S * 1000 + 60_000;

// The marker's path (the course's "How it's marked"), as one test: start at
// /readme/, then /, two people in separate cookie jars in one room, a Boat
// Rush between them, the match in "What happened here", a restart, and two
// languages in one room. The restart needs a server this test owns, so, like
// scripts/restart-check.sh, it starts its own (node src/server.ts) on its own
// port with a temporary DATA_DIR. Never production.
const PORT = 8000 + (process.pid % 900) + 100;
const base = `http://localhost:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "marker-path-"));
let server: ChildProcess | null = null;

async function start(): Promise<void> {
  server = spawn(process.execPath, ["src/server.ts"], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("the test's server did not start");
}
async function stop(): Promise<void> {
  const s = server!;
  const gone = new Promise((r) => s.once("exit", r));
  s.kill("SIGTERM");
  await gone;
  server = null;
}
beforeAll(start);
afterAll(async () => { if (server) await stop(); rmSync(dataDir, { recursive: true, force: true }); });

const text = (html: string) => new JSDOM(html).window.document.body.textContent ?? "";
const page = async (path: string, cookie = "") => (await fetch(new URL(path, base), { headers: { cookie } })).text();
const jar = (...c: string[]) => c.filter(Boolean).join("; ");

// a jar: the cookies one browser profile holds
async function openFromHome(): Promise<string> {
  const home = await page("/");
  expect(home).toContain('action="/play"');
  const res = await fetch(new URL("/play", base), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "mode=rush" });
  expect(res.status).toBe(303);
  return res.headers.get("location")!.match(/^\/play\/([A-Z]{4})$/)![1];
}
async function joinAs(code: string, name: string, character: string, lang = ""): Promise<string> {
  const res = await fetch(new URL(`/play/${code}/join`, base), { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: lang }, body: new URLSearchParams({ name, character }) });
  expect(res.status).toBe(303);
  return res.headers.getSetCookie()[0].split(";")[0];
}

it("the marker's path: /readme/, two profiles in one room under 1 s, a match, a restart, two languages", { timeout: END_WAIT_MS + 60_000 }, async () => {
  // 1. /readme/ has README.md's headings in the HTML the server sends
  const readme = text(await page("/readme/"));
  const headings = readFileSync("README.md", "utf8").split("\n").filter((l) => /^#{1,6} /.test(l)).map((l) => l.replace(/^#+ /, "").replace(/\*/g, ""));
  expect(headings.length).toBeGreaterThan(2);
  for (const h of headings) expect(readme).toContain(h);

  // 2. jar A opens a room from /; jar B joins; A sees B arrive in under 1 s
  const code = await openFromHome();
  const a = await joinAs(code, "Ava", "mei");
  const sa = openStream(base, `/play/${code}/events`, a);
  await sa.next((e) => e.event === "room");
  const t0 = performance.now();
  const b = await joinAs(code, "Bo", "jin");
  await sa.next((e) => e.event === "room" && JSON.parse(e.data).players.some((p: { name: string }) => p.name === "Bo"));
  const arrive = performance.now() - t0;
  console.log(`B's arrival on A's stream: ${arrive.toFixed(1)} ms`);
  expect(arrive).toBeLessThan(1000);

  // 3. A starts Boat Rush with B; a steer from B reaches A's stream in under 1 s
  const sb = openStream(base, `/play/${code}/events`, b);
  await sb.next((e) => e.event === "room");
  expect((await post(base, code, "start", a, { bots: false })).status).toBe(200);
  const go = JSON.parse((await sa.next((e) => e.event === "go")).data);
  await new Promise((r) => setTimeout(r, Math.max(0, go.startedAt - go.serverNow) + 200));
  const t1 = performance.now();
  expect((await post(base, code, "in", b, { k: "steer", x: STEER_X, y: STEER_Y })).status).toBe(200);
  await sa.next((e) => e.event === "frame" && JSON.parse(e.data).f.b[1][11] === STEER_X * 10 && JSON.parse(e.data).f.b[1][12] === STEER_Y * 10);
  const steer = performance.now() - t1;
  console.log(`B's steer on A's stream: ${steer.toFixed(1)} ms`);
  expect(steer).toBeLessThan(1000);

  // 4. the match ends; both jars see it in "What happened here"
  const end = JSON.parse((await sa.next((e) => e.event === "room" && JSON.parse(e.data).state === "end", END_WAIT_MS)).data);
  const lakeNow = end.lake.fish;
  const line = (html: string) => text(html).match(/Boat Rush · (Ava|Bo) won|Boat Rush · no winner/)?.[0];
  const pageA = await page(`/play/${code}`, a), pageB = await page(`/play/${code}`, b);
  expect(line(pageA)).toBeTruthy();
  expect(line(pageB)).toBe(line(pageA));
  expect(text(pageA)).toContain(`${A0 + Y0} → ${end.results.lakeAfter}`);
  await sa.close(); await sb.close();

  // 5. restart the app: the room, its lake and that line are still there
  await stop();
  await start();
  const after = await page(`/play/${code}`, a);
  expect(text(after)).toContain(code);
  expect(text(after)).toContain(`${A0 + Y0} → ${end.results.lakeAfter}`);
  expect(line(after)).toBe(line(pageA));
  const lakeAfter = new JSDOM(after).window.document.getElementById("lakefish")!.textContent!;
  expect(lakeAfter.startsWith(`${lakeNow} `)).toBe(true);

  // 6. jar B reads Chinese, jar A English, in the same room
  const code2 = await openFromHome();
  const a2 = await joinAs(code2, "Ava", "mei");
  const s2 = openStream(base, `/play/${code2}/events`, a2);
  await s2.next((e) => e.event === "room");
  const t2 = performance.now();
  const b2 = await joinAs(code2, "Bo", "jin", "lang=zh");
  await s2.next((e) => e.event === "room" && JSON.parse(e.data).players.length === 2);
  expect(performance.now() - t2).toBeLessThan(1000);
  const enPage = await page(`/play/${code2}`, a2), zhPage = await page(`/play/${code2}`, jar(b2, "lang=zh"));
  expect(enPage).toContain('<html lang="en">');
  expect(text(enPage)).toContain("Who's here");
  expect(zhPage).toContain('<html lang="zh">');
  expect(text(zhPage)).toContain("谁在房间里");
  expect(text(zhPage)).not.toContain("Who's here");
  for (const p of [enPage, zhPage]) { expect(text(p)).toContain("Ava"); expect(text(p)).toContain("Bo"); expect(text(p)).toContain(code2); }
  await s2.close();
});
