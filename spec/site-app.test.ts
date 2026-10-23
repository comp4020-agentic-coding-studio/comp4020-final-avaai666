import { expect, inject, it } from "vitest";

// One front door (DESIGN.md "The site"), against the RUNNING app (never
// production): "/" is the current game's home, the five-year lake's home is
// at /classic, and the earlier versions still answer at their URLs.
const baseUrl = inject("baseUrl");
const at = (path: string): URL => new URL(path, baseUrl);

it("site 1. / shows the new home: the idea, Play with friends and the four games", async () => {
  const res = await fetch(at("/"));
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("Play with friends");
  expect(html).toContain("One lake. Everyone fishes it.");
  for (const g of ["Boat Rush", "Fishing Party", "Who&#39;s Poaching", "Lake Holdings"]) expect(html).toContain(g);
  expect(html).not.toContain("Open a lake");
});

it("site 2. /classic shows the five-year lake's old home page", async () => {
  const res = await fetch(at("/classic"));
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain("Open a lake");
  expect(html).toContain('action="/lakes"');
});

it("site 3. an old lake at /l/CODE still opens", async () => {
  const open = await fetch(at("/lakes"), { method: "POST", redirect: "manual" });
  expect(open.status).toBe(303);
  const code = open.headers.get("location")!.match(/^\/l\/([A-Z]{4})$/)![1];
  const res = await fetch(at(`/l/${code}`));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain(code);
});

it("site 4. /b still answers", async () => {
  const res = await fetch(at("/b"));
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Quick Catch");
});

it("site 5. with lang=zh, / is the Chinese home", async () => {
  const html = await (await fetch(at("/"), { headers: { cookie: "lang=zh" } })).text();
  expect(html).toContain('<html lang="zh">');
  expect(html).toContain("和朋友一起玩");
  expect(html).not.toContain("Play with friends");
});

it("site 6. /favicon.ico answers without an error, so no page logs a 404 in the console", async () => {
  // browsers ask every site for /favicon.ico; a 404 shows as a console error on every page
  const res = await fetch(at("/favicon.ico"));
  expect(res.status).toBe(204);
});
