import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { t, type Lang } from "../../src/lib/i18n.ts";
import { classicNote, homePage, howPage, makingOfPage, notFoundPage, readmeSitePage, roomSitePage, type MatchLine } from "../../src/site-pages.ts";

// The site's pages in both languages (DESIGN.md "The site", "Languages"):
// the server renders the chosen language, so the headings are in the HTML
// it sends. These render the pages without a server.
const doc = (html: string) => new JSDOM(html).window.document;
const title = (html: string) => doc(html).title;
const textOf = (html: string) => doc(html).body.textContent ?? "";

const room = { code: "MZHB", mode: "rush", state: "lobby" as const, me: null, mySeat: null, players: [{ seat: 0, name: "Ava", character: "mei" as const }], seats: null, startedAt: null, lake: { fish: 168, died: false }, results: null, note: null, ready: ["rush", "poach", "party", "hold"], history: [] };
const lines: MatchLine[] = [{ endedAt: Date.UTC(2026, 9, 19, 9, 14), mode: "rush", winner: { kind: "seat", name: "Ava", character: "mei", bot: false }, lakeBefore: 220, lakeAfter: 151 }];

const PAGES: [string, (lang: Lang) => string][] = [
  ["/", (lang) => homePage(lang)],
  ["/how", (lang) => howPage(lang, "rush")],
  ["/how/rush", (lang) => howPage(lang, "rush")],
  ["/how/party", (lang) => howPage(lang, "party")],
  ["/how/poach", (lang) => howPage(lang, "poach")],
  ["/how/hold", (lang) => howPage(lang, "hold")],
  ["/play/CODE", (lang) => roomSitePage(lang, room, lines, "https://example.test")],
  ["/readme/", (lang) => readmeSitePage(lang, "<h1>Next Year, No Fish</h1><h2>What good means here</h2>")],
  ["/making-of", (lang) => makingOfPage(lang)],
];

describe("every page in both languages", () => {
  for (const [path, render] of PAGES) {
    it(`${path} with lang=zh has the zh title and not the en hero line; with lang=en the opposite`, () => {
      const zh = render("zh"), en = render("en");
      expect(doc(zh).documentElement.lang).toBe("zh");
      expect(doc(en).documentElement.lang).toBe("en");
      expect(title(zh)).toContain("明年无鱼");
      expect(title(en)).toContain("Next Year, No Fish");
      expect(textOf(zh)).not.toContain(t("en", "hero_line"));
      expect(textOf(en)).not.toContain(t("zh", "hero_line"));
      // the top bar, in the page's language, with the EN/中文 switch
      for (const k of ["nav_play", "nav_how", "nav_about", "nav_making"]) {
        expect(textOf(zh)).toContain(t("zh", k));
        expect(textOf(en)).toContain(t("en", k));
      }
      expect(textOf(en)).toContain("中文");
      expect(textOf(zh)).toContain("EN");
    });
  }

  it("the home page carries the hero line of its own language", () => {
    expect(textOf(homePage("en"))).toContain(t("en", "hero_line"));
    expect(textOf(homePage("zh"))).toContain(t("zh", "hero_line"));
  });
});

describe("the home page", () => {
  it("has the idea, Play with friends (a form that opens a room), Join with a code, three steps, four game cards and the lake that remembers", () => {
    const d = doc(homePage("en"));
    const open = [...d.querySelectorAll("form")].find((f) => f.getAttribute("action") === "/play" && f.getAttribute("method") === "post");
    expect(open?.textContent).toContain("Play with friends");
    expect(d.body.textContent).toContain("Join with a code");
    expect(d.querySelectorAll(".step3").length).toBe(3);
    expect(d.querySelectorAll("article.game").length).toBe(4);
    for (const g of ["Boat Rush", "Fishing Party", "Who's Poaching", "Lake Holdings"]) expect(d.body.textContent).toContain(g);
    expect([...d.querySelectorAll("article.game a")].map((a) => a.getAttribute("href"))).toEqual(expect.arrayContaining(["/how/rush", "/how/party", "/how/poach", "/how/hold"]));
    expect(d.body.textContent).toContain("The lake remembers");
    expect(d.body.textContent).toContain("The choice that matters:");
  });

  it("links to no earlier version: they are reached from /making-of", () => {
    const hrefs = [...doc(homePage("en")).querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.filter((h) => /^\/(l|p|b|classic)(\/|$)/.test(h))).toEqual([]);
  });
});

describe("/how/<mode>", () => {
  it("has how you win, the choice that matters, five numbered steps with a picture each, controls for phone and laptop, and the shared lake", () => {
    for (const id of ["rush", "party", "poach", "hold"]) {
      const d = doc(howPage("en", id));
      expect(d.querySelectorAll("ol.steps > li").length).toBe(5);
      expect(d.querySelectorAll("ol.steps > li .pic svg").length).toBe(5);
      const text = d.body.textContent ?? "";
      for (const w of ["How you win", "The choice that matters", "Controls", "Phone", "Laptop", "The shared lake"]) expect(text).toContain(w);
      expect(text).toContain(t("en", `${id}_goal`));
    }
  });
});

describe("the room page", () => {
  it("has the code, Copy link, who is here, pick a game, Start, this room's lake and What happened here, with no seed or token", () => {
    const html = roomSitePage("en", room, lines, "https://example.test");
    const d = doc(html);
    expect(d.body.textContent).toContain("MZHB");
    expect(d.body.textContent).toContain("Copy link");
    expect(d.body.textContent).toContain("https://example.test/play/MZHB");
    expect(d.body.textContent).toContain("Who's here");
    expect(d.body.textContent).toContain("Pick a game");
    expect(d.body.textContent).toContain("This room's lake");
    expect(d.body.textContent).toContain("What happened here");
    expect(d.body.textContent).toContain("Boat Rush · Ava won");
    expect(d.body.textContent).toContain("220 → 151");
    expect(d.querySelector("#log li")).toBeTruthy();
  });

  it("in Chinese, the same room's line is worded in Chinese", () => {
    const d = doc(roomSitePage("zh", room, lines, "https://example.test"));
    expect(d.body.textContent).toContain("这里发生过什么");
    expect(d.body.textContent).toContain("开船抢鱼 · Ava 赢");
  });
});

describe("/readme/ and /making-of", () => {
  it("/readme/ shows README.md inside the top bar; in Chinese with a one-line note that it is in English", () => {
    const zh = readmeSitePage("zh", "<h2>What good means here</h2>");
    expect(zh).toContain("<h2>What good means here</h2>");
    expect(textOf(zh)).toContain(t("zh", "readme_en_note"));
    expect(textOf(readmeSitePage("en", "<h2>x</h2>"))).not.toContain(t("zh", "readme_en_note"));
  });

  it("/readme/ in Chinese leads with a Chinese summary, and keeps the English README one tap away (Codex review, 24 Oct)", () => {
    const d = doc(readmeSitePage("zh", "<h2>What good means here</h2>"));
    expect(d.querySelector(".about-zh h1")!.textContent).toBe(t("zh", "about_zh_h"));
    expect(d.querySelectorAll(".about-zh p").length).toBeGreaterThanOrEqual(3);
    expect(d.querySelector("details.readme-en article.readme h2")!.textContent).toBe("What good means here");
    expect(doc(readmeSitePage("en", "<h2>x</h2>")).querySelector(".about-zh, details.readme-en")).toBeNull(); // English: the README itself
  });

  it("/making-of lists the four versions, each earlier one with a link that still runs", () => {
    const d = doc(makingOfPage("en"));
    expect(d.querySelectorAll("ol.timeline > li").length).toBe(4);
    const hrefs = [...d.querySelectorAll("ol.timeline a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/p", "/classic", "/b"]));
  });

  it("the not-found page and the classic note are worded too", () => {
    expect(title(notFoundPage("zh"))).toContain("明年无鱼");
    expect(classicNote()).toContain("/making-of");
  });
});

describe("a bot that won is named in the reader's language", () => {
  const botLine: MatchLine[] = [{ endedAt: Date.UTC(2026, 9, 19, 9, 14), mode: "party", winner: { kind: "seat", name: "Jin (bot)", character: "jin", bot: true }, lakeBefore: 171, lakeAfter: 118 }];
  it("Jin (bot) in English, 阿金（机器人） in Chinese, in What happened here", () => {
    expect(textOf(roomSitePage("en", room, botLine, "https://example.test"))).toContain("Fishing Party · Jin (bot) won");
    const zh = textOf(roomSitePage("zh", room, botLine, "https://example.test"));
    expect(zh).toContain("钓鱼派对 · 阿金（机器人） 赢");
    expect(zh).not.toContain("(bot)");
  });
});
