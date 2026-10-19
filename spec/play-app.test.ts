import { expect, inject, it } from "vitest";

// The /play platform over HTTP, against the RUNNING app that
// spec/global-setup.ts finds. Never point APP_URL at production (CLAUDE.md).
// Each mode's own app test plays it from the lobby to the rematch.
const baseUrl = inject("baseUrl");
const at = (path: string): URL => new URL(path, baseUrl);

it("play 1. the lobby shows the four games, each with a Start or its date, and the six fishers", async () => {
  const res = await fetch(at("/play"));
  expect(res.status).toBe(200);
  const html = await res.text();
  for (const name of ["Boat Rush", "Fishing Party", "Who&#39;s Poaching", "Lake Holdings"]) expect(html).toContain(name);
  for (const id of ["mei", "wang", "jin", "lu", "lian", "shitou"]) expect(html).toContain(`value="${id}"`);
  expect(html).toContain("The choice that matters:");
  expect(html).toMatch(/Coming|Play/);
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
  for (const f of ["room", "roomlive", "lobby", "rush", "poach", "party", "hold", "art", "world", "world5", "world-select"]) expect((await fetch(at(`/static/play/${f}.js`))).status, f).toBe(200);
  expect((await fetch(at("/static/site.js"))).status).toBe(200);
  expect((await fetch(at("/static/site.css"))).status).toBe(200);
  expect((await fetch(at("/static/play/../../server.ts"))).status).toBe(404);
  expect((await fetch(at("/static/vendor/nope.js"))).status).not.toBe(200);
});
