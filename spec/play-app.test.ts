import { expect, inject, it } from "vitest";

// The /play platform over HTTP, against the RUNNING app that
// spec/global-setup.ts finds. Never point APP_URL at production (CLAUDE.md).
// Each mode's own app test plays it from the lobby to the rematch.
const baseUrl = inject("baseUrl");
const at = (path: string): URL => new URL(path, baseUrl);

// One front door (CLAUDE.md): "/" is the game's home and lists the four
// games in both languages. /play was v4's English-only lobby with rush 1.0's
// rules; Ava approved (23 Oct) sending it to "/" instead of keeping a second,
// stale front door.
it("play 1. /play sends you to the one front door, which shows the four games in either language", async () => {
  const res = await fetch(at("/play"), { redirect: "manual" });
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("/");
  for (const [lang, names] of [["en", ["Boat Rush", "Fishing Party", "Who&#39;s Poaching", "Lake Holdings"]], ["zh", ["开船抢鱼", "钓鱼派对", "谁在偷鱼", "抢地盘经营"]]] as const) {
    const html = await (await fetch(at("/"), { headers: { cookie: `lang=${lang}` } })).text();
    for (const name of names) expect(html, `${lang}: ${name}`).toContain(name);
  }
});

it("play 1b. a POST /play with an unknown game answers on the front door, in the visitor's language", async () => {
  const res = await fetch(at("/play"), { method: "POST", redirect: "manual", headers: { cookie: "lang=zh", "content-type": "application/x-www-form-urlencoded" }, body: "mode=nope" });
  expect(res.status).toBe(400);
  const html = await res.text();
  expect(html).toContain('lang="zh"');
  expect(html).not.toContain("Pick one of the four games.");
});

it("play 2. a cross-origin POST is refused with 403", async () => {
  const res = await fetch(at("/play"), { method: "POST", redirect: "manual", headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" }, body: "mode=rush" });
  expect(res.status).toBe(403);
  const join = await fetch(at("/play/BCDF/join"), { method: "POST", redirect: "manual", headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" }, body: "name=x&character=mei" });
  expect(join.status).toBe(403);
});

it("play 3. an unknown room is 404, and so is its summary", async () => {
  expect((await fetch(at("/play/ZZZZ"))).status).toBe(404);
  expect((await fetch(at("/play/ZZZZ/summary.json"))).status).toBe(404);
});

it("play 4. the vendored three.js keeps its MIT header, and only listed files are served", async () => {
  const three = await fetch(at("/static/vendor/three.module.js"));
  expect(three.status).toBe(200);
  expect(three.headers.get("content-type")).toMatch(/javascript/);
  expect((await three.text()).slice(0, 200)).toContain("SPDX-License-Identifier: MIT");
  expect((await fetch(at("/static/play/world.js"))).status).toBe(200);
  // every script the pages load is served (the room page's live script was missing once, so Start did nothing)
  for (const f of ["room", "roomlive", "lobby", "rush", "poach", "party", "hold", "art", "world", "world5", "world-select", "ceremony"]) expect((await fetch(at(`/static/play/${f}.js`))).status, f).toBe(200);
  expect((await fetch(at("/static/site.js"))).status).toBe(200);
  expect((await fetch(at("/static/site.css"))).status).toBe(200);
  expect((await fetch(at("/static/play/../../server.ts"))).status).toBe(404);
  expect((await fetch(at("/static/vendor/nope.js"))).status).not.toBe(200);
});

// Codex review (24 Oct): "Join with a code" let AAAA through in the browser, the server sent it back
// to "/" with no word, and the form folded away. Room codes use no vowels (A E I O U Y).
it("play 5. a bad room code (AAAA) or one with no room (ZZZZ) answers on the home page, in the visitor's language, with the code kept and the form open", async () => {
  for (const lang of ["en", "zh"] as const) {
    const bad = await fetch(at("/play/join?code=aaaa"), { headers: { cookie: `lang=${lang}` }, redirect: "manual" });
    expect(bad.status).toBe(400);
    const badHtml = await bad.text();
    expect(badHtml).toContain(lang === "en" ? "without vowels" : "不含元音");
    expect(badHtml).toMatch(/<details class="join" open>/);
    expect(badHtml).toMatch(/<input id="code"[^>]*value="AAAA"/);
    const none = await fetch(at("/play/join?code=zzzz"), { headers: { cookie: `lang=${lang}` }, redirect: "manual" });
    expect(none.status).toBe(404);
    const noneHtml = await none.text();
    expect(noneHtml).toContain(lang === "en" ? "No room ZZZZ" : "没有房间 ZZZZ");
    expect(noneHtml).toMatch(/<input id="code"[^>]*value="ZZZZ"/);
    // the browser's own (English) bubble never stands in for these words
    expect(noneHtml).toMatch(/<form class="joincode"[^>]*novalidate/);
  }
});
