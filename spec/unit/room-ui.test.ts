import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { roomPage } from "../../src/play-pages.ts";
import { roomSitePage } from "../../src/site-pages.ts";
import type { RoomView } from "../../src/lib/game-hub.ts";
import { WORLD5_MODES, worldModuleFor } from "../../src/static/play/world-select.js";

// The room page is a page and the game is full screen (DESIGN.md "UI rules").
// There is no layout engine here, so these check what decides who gets a tap:
// what is in the markup, and which stylesheet rules take pointer events. The
// real 390x844 hit test is in docs/checks/2026-10-19-site/, run in a browser.

const view: RoomView = { code: "MZHB", mode: "rush", state: "lobby", me: 0, mySeat: null, players: [{ seat: 0, name: "Ava", character: "mei" }], seats: null, startedAt: null, lake: { fish: 220, died: false }, results: null, note: null, ready: ["rush", "poach", "party", "hold"], history: [] };
const doc = (html: string) => new JSDOM(html).window.document;
const css = (f: string) => readFileSync(new URL(`../../src/static/${f}`, import.meta.url), "utf8");

describe("the room page before a match", () => {
  const d = doc(roomSitePage("en", view, [], "https://example.test"));

  it("has nothing of the game on it: no canvas, no pads, no HUD, no overlay, no game script", () => {
    for (const sel of ["canvas", ".pads", ".pad", "#hud", ".hud", "#overlay", ".overlay", "#stage", ".stage", ".banner", ".coach", ".topbar", "script[src*='room.js']", "script[src*='rush.js']"]) {
      expect(d.querySelector(sel), sel).toBeNull();
    }
    // the room page has its own small boot data (the view and the words); the game's (cards, the mode scripts' data) is not here
    expect(JSON.parse(d.querySelector("#boot")!.textContent!)).not.toHaveProperty("cards");
  });

  it("has the pick-a-game buttons and Start, and the page is not a fixed full-screen layer", () => {
    expect(d.querySelectorAll("#pick [data-pick]").length).toBe(4);
    expect(d.querySelector("#tostart, #startbtn")).not.toBeNull();
    const html = new JSDOM(roomSitePage("en", view, [], "https://example.test")).serialize();
    expect(html).not.toMatch(/class="[^"]*game-stage/);
  });

  it("Boat Rush's rules card offers \"Practise first\" next to Start, as a link to the game page alone; other games and visitors who have not joined do not see it", () => {
    // DESIGN.md Boat Rush 2.0, flow step 1: the rules card, with "Start" and "Practise first (30 s)"
    const link = d.querySelector<HTMLAnchorElement>("#practisebtn")!;
    expect(link.hidden).toBe(false);
    expect(link.getAttribute("href")).toBe("/play/MZHB/game?practice=1");
    // Codex review (24 Oct): "(30 s)" read as a timer, but the practice is three steps with no clock
    expect(link.textContent).toBe("Practise first: 3 steps, about 30 s");
    expect(doc(roomSitePage("en", { ...view, mode: "party" }, [], "https://example.test")).querySelector<HTMLAnchorElement>("#practisebtn")!.hidden).toBe(true);
    expect(doc(roomSitePage("en", { ...view, me: null }, [], "https://example.test")).querySelector<HTMLAnchorElement>("#practisebtn")!.hidden).toBe(true);
  });

  it("links to the game page once a match runs; it never embeds it", () => {
    const running = doc(roomSitePage("en", { ...view, state: "play" }, [], "https://example.test"));
    expect(running.querySelector('a[href="/play/MZHB/game"]')).not.toBeNull();
    expect(d.querySelector("iframe, canvas, .game-stage")).toBeNull();
  });

  it("shows the card before the start (C1): the goal, three actions and the choice that matters", () => {
    const c1 = d.querySelector("#c1")!;
    expect(c1.textContent).toContain("How you win");
    expect(c1.querySelectorAll(".icons3 > div").length).toBe(3);
    expect(c1.textContent).toContain("The choice that matters:");
  });

  it("loads the small live script, not the game's", () => {
    const srcs = [...d.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
    expect(srcs).toContain("/static/play/roomlive.js");
    expect(srcs.some((s) => /\/(room|rush|poach|party|hold|world)\.js$/.test(s ?? ""))).toBe(false);
  });
});

describe("the game page during a match", () => {
  const d = doc(roomPage(view, undefined, "en"));

  it("is full screen with the site header hidden: it has no site top bar and nothing else to click", () => {
    expect(d.querySelector("header.top, .top .wrap, nav.links")).toBeNull();
    expect(d.querySelector("canvas#gl")).not.toBeNull();
    expect(d.querySelector("#hud")).not.toBeNull();
    expect(d.body.className).toMatch(/in-room/);
  });

  it("has both #gl (world.js) and #gl5 (world5.js), with exactly one shown for the room's mode", () => {
    for (const mode of ["rush", "poach", "party", "hold"]) {
      const dm = doc(roomPage({ ...view, mode }, undefined, "en"));
      const gl = dm.querySelector("#gl")!, gl5 = dm.querySelector("#gl5")!;
      expect(gl).not.toBeNull(); expect(gl5).not.toBeNull();
      const glShown = !gl.hasAttribute("hidden"), gl5Shown = !gl5.hasAttribute("hidden");
      expect(glShown).toBe(!WORLD5_MODES.includes(mode));
      expect(gl5Shown).toBe(WORLD5_MODES.includes(mode));
      expect(glShown).not.toBe(gl5Shown); // exactly one visible, never both or neither
    }
  });

  it("has a host menu with Stop match inside it, not a loose Stop button", () => {
    expect(d.querySelector("#stopbtn")).toBeNull();
    const menu = d.querySelector("#hostmenu");
    expect(menu).not.toBeNull();
    expect(menu!.querySelector("[data-stop]")).not.toBeNull();
    expect(d.querySelector("#hostbtn")?.textContent).toContain("⋯");
  });

  it("offers Back to the room as a link to the room page", () => {
    const html = readFileSync(new URL("../../src/static/play/room.js", import.meta.url), "utf8");
    expect(html).toContain("/play/${code}");
    expect(html).toMatch(/g_back_room/);
  });
});

describe("nothing that only informs takes a tap", () => {
  const play = css("play/play.css");
  const rule = (sel: string): string => {
    const m = play.match(new RegExp(`(^|\\n)${sel.replace(/[.\\[\\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
    return m ? m[2] : "";
  };

  // the layers that float over the stage and only inform; the HUD, top bar, overlay sheets, meeting, tug bar and pads are controls and take taps
  for (const sel of [".tags", ".floats", ".tag3d", ".float", ".pin", ".hint", ".coach", ".banner", ".count"]) {
    it(`${sel} has pointer-events: none`, () => {
      const joined = play.split("\n").filter((l) => new RegExp(`^${sel.replace(/[.]/g, "\\.")}(,| |\\{|\\.)`).test(l) || l.startsWith(`${sel},`) || new RegExp(`(^|, )${sel.replace(/[.]/g, "\\.")}[ ,{]`).test(l.split("{")[0])).join("\n");
      expect(joined, `${sel} is not styled`).not.toBe("");
      expect(joined).toMatch(/pointer-events:\s*none/);
    });
  }

  it("the overlay lets taps through to the game except on what needs a choice", () => {
    expect(play).toMatch(/\.overlay\s*\{[^}]*pointer-events:\s*none/);
    expect(play).toMatch(/\.overlay\s*>\s*\*\s*\{[^}]*pointer-events:\s*auto/);
  });
});

describe("worldModuleFor(): each /play mode loads exactly one world module, and the right one", () => {
  it("all four modes are on v5.0 (world5.js)", () => {
    // rush moved here in the same commit that rewrote rush.js to world5.js's API
    // (setCameraMode, not world.js's setCamera): left out of 5fc2940, caught by the
    // world-calls-exist check below and by a real browser check (scripts/browser-check.ts).
    // poach, hold and party moved in the commits that rebuilt them as 2.0 (rule change 1).
    for (const mode of ["rush", "poach", "hold", "party"]) expect(worldModuleFor(mode)).toBe("world5.js");
  });

  it("a mode listed in WORLD5_MODES loads world5.js", () => {
    expect(worldModuleFor("some-future-mode")).toBe("world.js");
    const WAS = [...WORLD5_MODES];
    WORLD5_MODES.push("some-future-mode");
    try { expect(worldModuleFor("some-future-mode")).toBe("world5.js"); } finally { WORLD5_MODES.length = 0; WORLD5_MODES.push(...WAS); }
  });
});

// A mode's client script calls world.<method>(...) on whichever module
// worldModuleFor() gives it; if that module's own createWorld()/createWorld5()
// never returns that method, the call throws the moment the match starts
// ("world.setCameraMode is not a function") and no unit test (which never
// executes the browser script) sees it. This is a static check over the
// scripts' own source: it would have caught 5fc2940 leaving rush off
// WORLD5_MODES while rush.js already called world5.js's setCameraMode.
describe("each mode's world.* calls exist on the world module it is actually given", () => {
  const PLAY = new URL("../../src/static/play/", import.meta.url);
  const src = (name: string) => readFileSync(new URL(`${name}.js`, PLAY), "utf8");

  // depth-aware split of a `return { ... }` object literal's top-level keys,
  // so a method body's own commas (e.g. end() { a(); b(); }) are not split on
  function topLevelKeys(body: string): Set<string> {
    const names = new Set<string>();
    let depth = 0, seg = "";
    const flush = () => { const t = seg.trim(); const m = t.match(/^([A-Za-z_$][A-Za-z0-9_$]*)/); if (m) names.add(m[1]); seg = ""; };
    for (const ch of body) {
      if (ch === "{" || ch === "(" || ch === "[") depth++;
      else if (ch === "}" || ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) { flush(); continue; }
      seg += ch;
    }
    flush();
    return names;
  }
  function apiOf(moduleFile: string): Set<string> {
    const body = src(moduleFile.replace(/\.js$/, ""));
    const m = body.match(/\n  return \{([\s\S]*?)\n  \};\n\}/);
    if (!m) throw new Error(`no top-level "return { ... };" found in ${moduleFile}`);
    return topLevelKeys(m[1]);
  }
  function worldCallsOf(modeFile: string): Set<string> {
    const body = src(modeFile);
    return new Set([...body.matchAll(/\bworld\.([A-Za-z_$][A-Za-z0-9_$]*)/g)].map((m) => m[1]));
  }

  it("every call a mode script makes on `world.*` is a key the module worldModuleFor() gives it actually returns", () => {
    for (const mode of ["rush", "poach", "party", "hold"]) {
      const moduleFile = worldModuleFor(mode);
      const api = apiOf(moduleFile), calls = worldCallsOf(mode);
      const missing = [...calls].filter((c) => !api.has(c));
      expect(missing, `${mode}.js calls world.{${missing.join(", ")}}, not on ${moduleFile}`).toEqual([]);
    }
  });
});

describe("P7: the pads sit at least 22px, and the safe area, above the bottom edge", () => {
  it("the phone dock pads' bottom offset is at least 22px (plus the safe area)", () => {
    const play = css("play/play.css");
    const m = play.match(/\.room \.hud \.pads\.dock\s*\{([^}]*)\}/);
    expect(m, ".pads.dock is not styled").not.toBeNull();
    const bottom = m![1].match(/bottom:\s*max\((\d+)px/);
    expect(bottom, "no bottom: max(Npx, ...) on .pads.dock").not.toBeNull();
    expect(Number(bottom![1])).toBeGreaterThanOrEqual(22);
    expect(m![1]).toMatch(/env\(safe-area-inset-bottom/);
  });
});

describe("every page scrolls", () => {
  it("no site page locks the document's scroll; only the full-screen game page does", () => {
    const site = css("site.css");
    expect(site).not.toMatch(/body\.page-room\.playing\s*\{[^}]*overflow:\s*hidden/);
    expect(site).not.toMatch(/\bbody\s*\{[^}]*overflow:\s*hidden/);
    expect(site).not.toMatch(/\.site\s*\{[^}]*overflow:\s*hidden/);
    const play = css("play/play.css");
    // the game page is the only place where the body is fixed, and it is the game
    expect(play).toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
  });
});

describe("the host menu", () => {
  it("opens leftward from the ⋯ button on wide screens, so \"Stop match\" is on screen (it opened off the right edge, over the HUD)", () => {
    // the ⋯ button is the last thing in the top bar, at the right edge: a list anchored left: 0 ran 180 px past the screen
    const play = readFileSync(new URL("../../src/static/play/play.css", import.meta.url), "utf8");
    const base = play.match(/\n\.hostmenu \.menu-list \{([^}]*)\}/)![1];
    expect(base).toMatch(/(^|;)\s*right:\s*0/);
    expect(base).not.toMatch(/(^|;)\s*left:\s*0/);
  });
});

describe("the game page speaks the visitor's language", () => {
  // Codex review (24 Oct): a Chinese game page still had an English tab title, <html lang="en">, and an English join form
  it("its tab title, html lang and join form are in Chinese on a Chinese page, and in English on an English one", () => {
    const zh = new JSDOM(roomPage({ ...view, me: null }, undefined, "zh")).window.document;
    expect(zh.title).toBe("房间 MZHB · 开船抢鱼");
    expect(zh.documentElement.getAttribute("lang")).toBe("zh");
    const form = zh.querySelector(".joinform")!;
    expect(form.textContent).toContain("你的名字");
    expect(form.textContent).not.toMatch(/Your name|Join room|\bJoin\b/);
    expect(form.hasAttribute("novalidate")).toBe(true);
    const en = new JSDOM(roomPage({ ...view, me: null }, undefined, "en")).window.document;
    expect(en.title).toBe("Room MZHB · Boat Rush");
    expect(en.documentElement.getAttribute("lang")).toBe("en");
  });
});

describe("Back to the room, during a match", () => {
  // Codex review (24 Oct): the game's "Back to the room" seal led to the room page, which saw the match
  // running and sent you straight back to the game: the button could never work.
  it("the room page stays when you came back from a running match on purpose, and still takes you to the next match", async () => {
    const { shouldGoToGame } = await import("../../src/static/play/room-nav.js");
    const playing = { ...view, state: "play" as const, startedAt: 1000 };
    expect(shouldGoToGame(playing, { stay: false, startedAtOnArrival: 1000 })).toBe(true); // waiting in the room: go
    expect(shouldGoToGame(playing, { stay: true, startedAtOnArrival: 1000 })).toBe(false); // came back on purpose: stay
    expect(shouldGoToGame({ ...playing, startedAt: 5000 }, { stay: true, startedAtOnArrival: 1000 })).toBe(true); // a new match: go
    expect(shouldGoToGame(view, { stay: false, startedAtOnArrival: null })).toBe(false); // no match
  });
  it("the game page's seal asks the room page to stay", () => {
    const d = new JSDOM(roomPage({ ...view, state: "play", startedAt: 1000 }, undefined, "en")).window.document;
    expect(d.querySelector(".mini-seal")!.getAttribute("href")).toBe("/play/MZHB?stay=1");
  });
});
