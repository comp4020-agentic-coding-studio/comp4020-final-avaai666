import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { DICT, t } from "../../src/lib/i18n.ts";

// The ceremony every mode ends with (DESIGN.md "The ceremony (every mode)"):
// three steps built from one results object, in both languages. Plain JS
// with no declarations: typed loosely, here, where it is loaded (as
// spec/unit/play-client.test.ts does for the other /play browser modules).
const importJs = (path: string): Promise<any> => import(/* @vite-ignore */ path);

function deps(lang: "en" | "zh") {
  return {
    t: (k: string, v: Record<string, string | number> = {}) => t(lang, k, v), esc: (s: string) => String(s), portrait: () => "<svg></svg>",
    zh: (k: string) => t("zh", k), // the tier stamp is always shown in Chinese characters, whichever language the page is in
  };
}

const rushData = (lang: "en" | "zh") => ({
  a: 280, y: 40, next: 317, tier: { id: "fair", mult: 1 },
  counterfactual: { alt: 330, tierId: "rich" },
  ledger: [
    { seat: 0, name: "Ava", character: "mei", isMe: true, home: 12, young: 2, spared: 0 },
    { seat: 1, name: "Bo (bot)", character: "jin", isMe: false, home: 8, young: 0, spared: 3 },
  ],
  fairShare: 10, unit: lang === "zh" ? "条鱼" : "fish",
  titles: [{ key: "king", vars: { name: "Ava", n: 12 } }],
  podium: [
    { seat: 0, name: "Ava", character: "mei", isMe: true, base: 12, score: 12 },
    { seat: 1, name: "Bo (bot)", character: "jin", isMe: false, base: 8, score: 8 },
  ],
});

describe("ceremonySteps()", () => {
  for (const lang of ["en", "zh"] as const) {
    it(`renders all three steps from a results object, in ${lang}`, async () => {
      const { ceremonySteps } = await importJs("../../src/static/play/ceremony.js");
      const html = ceremonySteps(rushData(lang), deps(lang));
      expect(html.length).toBe(3);
      const d = (h: string) => new JSDOM(h).window.document;
      // step 1: the verdict, what is left (a + y) -> next spring, the tier
      const s1 = d(html[0]);
      expect(s1.body.textContent).toContain("320");
      expect(s1.body.textContent).toContain("317");
      expect(s1.body.textContent).toContain(DICT[lang].cer_v_fair);
      // step 2: who took what, the counterfactual, the title earned
      const s2 = d(html[1]);
      expect(s2.body.textContent).toContain("Ava");
      expect(s2.body.textContent).toContain("330");
      expect(s2.body.textContent).toContain(DICT[lang].cer_v_rich);
      expect(s2.querySelectorAll(".cer-ledger .cer-lrow").length).toBe(2);
      // step 3: the podium, sorted by score, with the winner first; "You" for the viewer's own row
      const s3 = d(html[2]);
      const rows = [...s3.querySelectorAll(".podium .pl")];
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain(DICT[lang].g_you);
      expect(rows[1].textContent).toContain("Bo");
    });
  }

  it("skips step 2 (who took what) when there is no ledger (a mode with no per-player breakdown yet)", async () => {
    const { ceremonySteps } = await importJs("../../src/static/play/ceremony.js");
    const data = { a: 100, y: 20, next: 130, tier: { id: "lean", mult: 0.8 }, podium: [{ seat: 0, name: "Ava", character: "mei", isMe: true, score: 5 }] };
    const html = ceremonySteps(data, deps("en"));
    expect(html.length).toBe(2);
  });
});

describe("mountCeremony()", () => {
  it("wires Next, Skip, Again and Back to the village", async () => {
    const { mountCeremony } = await importJs("../../src/static/play/ceremony.js");
    const dom = new JSDOM(`<!doctype html><div id="c"></div>`);
    const container = dom.window.document.getElementById("c")!;
    let again = 0, village = 0;
    mountCeremony(container, rushData("en"), deps("en"), { onAgain: () => again++, onVillage: () => village++ });
    expect(container.querySelector("h2")?.textContent).toContain("The year is over");
    (container.querySelector("[data-cer-skip]") as HTMLElement).dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    expect(container.querySelector("[data-cer-again]")).not.toBeNull();
    (container.querySelector("[data-cer-again]") as HTMLElement).dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    expect(again).toBe(1);
  });
});
