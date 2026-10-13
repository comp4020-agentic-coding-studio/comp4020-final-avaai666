import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { lakeHomePage, lakePage, type DoneView, type LiveView, type PreStartView } from "../../src/lake-pages.ts";
import type { Snapshot } from "../../src/lib/lake-runner.ts";

// Renders the lake pages directly, no server (DESIGN.md v2.3, "The page").
// Everything typed must come back escaped; the live page's boot JSON must
// round-trip and never let a family's name close the script element.

function baseSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    step: 10,
    year: 1,
    phase: "fish",
    rule: "none",
    families: [{ seat: 0, name: "Ava", bot: false, basket: 5, part: 0, hasFine: false, breaches: 0, promisedWith: [] }],
    asks: [],
    vote: [],
    rows: [],
    ...overrides,
  };
}

const textOf = (html: string): string => new JSDOM(html).window.document.body.textContent ?? "";

describe("the live page's boot JSON", () => {
  it("parses back to the snapshot it was given", () => {
    const snapshot = baseSnapshot();
    const html = lakePage({ state: "live", code: "BKMT", snapshot, me: 0 });
    const dom = new JSDOM(html);
    const boot = dom.window.document.getElementById("boot")!;
    const parsed = JSON.parse(boot.textContent!) as { code: string; me: number; snapshot: Snapshot };
    expect(parsed.code).toBe("BKMT");
    expect(parsed.me).toBe(0);
    expect(parsed.snapshot.step).toBe(snapshot.step);
    expect(parsed.snapshot.families).toEqual(snapshot.families);
  });

  it("a family named </script><script>alert(1)</script> cannot close the script element", () => {
    const evilName = "</script><script>alert(1)</script>";
    const snapshot = baseSnapshot({
      families: [{ seat: 0, name: evilName, bot: false, basket: 0, part: 0, hasFine: false, breaches: 0, promisedWith: [] }],
    });
    const html = lakePage({ state: "live", code: "BKMT", snapshot, me: 0 });
    expect(html).not.toContain("</script><script>alert");
    const dom = new JSDOM(html);
    const boot = dom.window.document.getElementById("boot")!;
    const parsed = JSON.parse(boot.textContent!) as { snapshot: Snapshot };
    expect(parsed.snapshot.families[0].name).toBe(evilName);
  });
});

describe("escaping family names", () => {
  const evilName = '<img src=x onerror=alert(1)>"Liu"';

  it("on the lobby page", () => {
    const view: PreStartView = { state: "pre", code: "BKMT", families: [{ seat: 0, name: evilName }], me: 0, rows: [] };
    const html = lakePage(view);
    expect(html).not.toContain("<img src=x onerror");
    expect(textOf(html)).toContain(evilName);
  });

  it("on the debrief page", () => {
    const view: DoneView = {
      state: "done",
      code: "BKMT",
      families: [{ seat: 0, name: evilName, bot: false }],
      end: { kept: [10], parts: [0], grownFish: 5, nextYear: 5 },
      rows: [],
      me: 0,
    };
    const html = lakePage(view);
    expect(html).not.toContain("<img src=x onerror");
    expect(textOf(html)).toContain(evilName);
  });
});

describe("the debrief's verdict", () => {
  function doneView(nextYear: number, grownFish = 10): DoneView {
    return {
      state: "done",
      code: "BKMT",
      families: [
        { seat: 0, name: "Ava", bot: false },
        { seat: 1, name: "Bo", bot: false },
        { seat: 2, name: "Jin", bot: true },
        { seat: 3, name: "Old Wang", bot: true },
      ],
      end: { kept: [10, 20, 5, 5], parts: [0, 0, 0, 0], grownFish, nextYear },
      rows: [],
      me: 0,
    };
  }

  it('nextYear 0 is "Next year, no fish"', () => {
    const html = lakePage(doneView(0));
    expect(textOf(html)).toContain("Next year, no fish");
  });

  it('nextYear at least 60% of what was found is "Fish to spare"', () => {
    // 4 families => start count is Math.round(CAP_PER_FAMILY * 4 * START_FRAC)
    const html = lakePage(doneView(1000)); // comfortably above 60% of any start count
    expect(textOf(html)).toContain("Fish to spare");
  });

  it('in between is "Fewer fish"', () => {
    const html = lakePage(doneView(2));
    expect(textOf(html)).toContain("Fewer fish");
  });

  it("with years given, the chart is drawn", () => {
    const view = doneView(100);
    view.end.years = [60, 70, 80, 90, 95];
    const html = lakePage(view);
    expect(html).toContain('class="chart"');
  });

  it("without years, no chart is drawn", () => {
    const html = lakePage(doneView(100));
    expect(html).not.toContain('class="chart"');
  });
});

describe("the lobby's bots to come", () => {
  it("names Jin, Mei and Old Wang with one family", () => {
    const view: PreStartView = { state: "pre", code: "BKMT", families: [{ seat: 0, name: "Ava" }], me: 0, rows: [] };
    const text = textOf(lakePage(view));
    expect(text).toContain("Jin");
    expect(text).toContain("Mei");
    expect(text).toContain("Old Wang");
  });

  it('says "No bots" with four families', () => {
    const view: PreStartView = {
      state: "pre",
      code: "BKMT",
      families: [
        { seat: 0, name: "Ava" },
        { seat: 1, name: "Bo" },
        { seat: 2, name: "Cy" },
        { seat: 3, name: "Dee" },
      ],
      me: 0,
      rows: [],
    };
    const text = textOf(lakePage(view));
    expect(text).toContain("No bots");
  });
});

describe("the home page", () => {
  it("has a form that POSTs to /lakes", () => {
    const html = lakeHomePage([]);
    const dom = new JSDOM(html);
    const form = [...dom.window.document.querySelectorAll("form")].find((f) => f.getAttribute("action") === "/lakes");
    expect(form).toBeTruthy();
    expect(form!.getAttribute("method")).toBe("post");
  });
});
