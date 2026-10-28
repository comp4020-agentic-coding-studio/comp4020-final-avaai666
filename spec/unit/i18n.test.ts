import { describe, expect, it } from "vitest";
import { DICT, langFrom, t } from "../../src/lib/i18n.ts";

// The two dictionaries (DESIGN.md "Languages"): every visible word of the
// site and the four games, in English and Chinese, with the same keys.
const vars = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the dictionaries", () => {
  it("en and zh have the same keys", () => {
    const en = Object.keys(DICT.en).sort(), zh = Object.keys(DICT.zh).sort();
    expect(en.filter((k) => !zh.includes(k)), "missing in zh").toEqual([]);
    expect(zh.filter((k) => !en.includes(k)), "missing in en").toEqual([]);
    expect(en.length).toBeGreaterThan(100);
  });

  it("no value is empty", () => {
    for (const lang of ["en", "zh"] as const) {
      const empty = Object.entries(DICT[lang]).filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k);
      expect(empty, `empty in ${lang}`).toEqual([]);
    }
  });

  it("every {var} in en is also in zh", () => {
    const bad = Object.keys(DICT.en).filter((k) => vars(DICT.en[k]).some((v) => !vars(DICT.zh[k] ?? "").includes(v)));
    expect(bad).toEqual([]);
  });

  it("t() fills in vars and gives the key's English when asked for an unknown language", () => {
    expect(t("en", "room_fish_n", { n: 168 })).toBe("168 fish");
    expect(t("zh", "room_fish_n", { n: 168 })).toBe("168 条鱼");
    expect(t("xx" as "en", "nav_play")).toBe("Play");
  });

  it("the words on the mock's top bar are the mock's, in both languages", () => {
    expect(["nav_play", "nav_how", "nav_about", "nav_making"].map((k) => t("en", k))).toEqual(["Play", "How to play", "About", "How it was made"]);
    expect(["nav_play", "nav_how", "nav_about", "nav_making"].map((k) => t("zh", k))).toEqual(["开始玩", "玩法说明", "关于", "制作过程"]);
    expect(t("en", "hero_line")).toBe("One lake. Everyone fishes it. What you take today, someone else can't catch tomorrow.");
    expect(t("zh", "hero_line")).toBe("一片湖，大家一起捞。你今天多拿一条，别人明天就少一条。");
  });
});

describe("Trawl and Let Them Go agree with the code (rule change 13, bug fix)", () => {
  // trawlPickup() in rush.ts was fixed to spare a young fish when the boat also
  // holds Let Them Go (takesYoung(b)), matching closeNets(). The cards' own
  // words must say the same thing, in both languages, or the card lies.
  it("Trawl's text no longer claims it always takes young fish", () => {
    for (const lang of ["en", "zh"] as const) expect(DICT[lang].r_text_trawl).not.toMatch(/young ones included|小鱼也不放过/);
  });
  it("Let Them Go's text covers the trawl too, in both languages", () => {
    expect(DICT.en.r_text_release).toMatch(/trawl/i);
    expect(DICT.zh.r_text_release).toMatch(/拖网/);
  });
});

describe("the lang cookie", () => {
  it("picks the language; a missing or unknown one gives English", () => {
    expect(langFrom("lang=zh")).toBe("zh");
    expect(langFrom("a=1; lang=zh; b=2")).toBe("zh");
    expect(langFrom("lang=en")).toBe("en");
    expect(langFrom(undefined)).toBe("en");
    expect(langFrom("")).toBe("en");
    expect(langFrom("lang=fr")).toBe("en");
    expect(langFrom("lang=ZH<script>")).toBe("en");
    expect(langFrom("xlang=zh")).toBe("en");
  });
});

describe("what a player reads", () => {
  // The player-facing pages (/, /how/*, the room, the games) carry no course
  // text. /readme/ and /making-of may name the project's history, but in plain
  // words, so one rule covers every key of both dictionaries.
  const BANNED = [/COMP/, /crit/i, /课程/, /README/, /测试/, /\bcourse\b/i, /\btests?\b/i];

  it("no key in either language contains course text", () => {
    const hits: string[] = [];
    for (const lang of ["en", "zh"] as const) for (const [k, v] of Object.entries(DICT[lang])) {
      if (k === "about_p" || k === "readme_en_note" || k === "nav_about" || k === "about_title" || k === "about_h") continue; // the About page IS the README: it may say so
      for (const re of BANNED) if (re.test(v)) hits.push(`${lang}.${k}: ${v}`);
    }
    expect(hits).toEqual([]);
  });

  it("the About page's own words say what it is without naming tests or the course", () => {
    for (const lang of ["en", "zh"] as const) {
      expect(DICT[lang].about_p).not.toMatch(/COMP|crit|课程|测试|\bcourse\b|\btests?\b/i);
      expect(DICT[lang].readme_en_note).not.toMatch(/COMP|crit|课程|\bcourse\b/i);
    }
    expect(DICT.zh.readme_en_note).toBe("README 只有英文版。");
  });

  it("the footer is the game's own line, the same in both languages, with no year", () => {
    expect(DICT.en.foot).toBe("明年无鱼 · Next Year, No Fish");
    expect(DICT.zh.foot).toBe("明年无鱼 · Next Year, No Fish");
  });

  it("Chinese uses 「」 for quoted words, never straight double quotes", () => {
    expect(Object.entries(DICT.zh).filter(([, v]) => /"/.test(v)).map(([k]) => k)).toEqual([]);
  });

  it("the Chinese place has its 名, and English places read 1st 2nd 3rd 4th", () => {
    expect(t("zh", "g_you_came", { place: t("zh", "g_place3") })).toBe("你是第 3 名");
    expect(t("zh", "g_you_came", { place: t("zh", "g_placeN", { n: 4 }) })).toBe("你是第 4 名");
    expect(["g_place1", "g_place2", "g_place3"].map((k) => t("en", k))).toEqual(["1st", "2nd", "3rd"]);
    expect(t("en", "g_placeN", { n: 4 })).toBe("4th");
    expect(t("en", "g_placeN", { n: 8 })).toBe("8th");
  });

  it("a bot is named through the dictionary: 阿金（机器人） in Chinese, Jin (bot) in English", () => {
    expect(t("zh", "bot_suffix", { name: t("zh", "c_jin") })).toBe("阿金（机器人）");
    expect(t("en", "bot_suffix", { name: t("en", "c_jin") })).toBe("Jin (bot)");
    expect(t("zh", "bot_suffix", { name: t("zh", "c_wang") })).toBe("老王（机器人）");
  });
});
