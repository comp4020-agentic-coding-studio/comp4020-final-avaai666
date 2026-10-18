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
