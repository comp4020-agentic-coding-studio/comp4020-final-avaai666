import { describe, expect, it } from "vitest";
import type { Seat } from "../../src/lib/game-platform.ts";
import { DICT, t } from "../../src/lib/i18n.ts";
import { hold, type HoldSim } from "../../src/lib/modes/hold.ts";
import { party, type PartySim } from "../../src/lib/modes/party.ts";
import { poach, type PoachInput, type PoachSim } from "../../src/lib/modes/poach.ts";
import { rush, type RushSim } from "../../src/lib/modes/rush.ts";

// Two people in one room may read different languages (DESIGN.md
// "Languages"), so what the server says in words it sends as a code and
// numbers, and each page words it from src/lib/i18n.ts.
const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));

describe("meeting phrases travel as codes", () => {
  it("a set phrase reaches the frame as its code and arguments, never as an English sentence", () => {
    const s: PoachSim = poach.make("codes", people(4), { fish: 220 });
    for (let i = 0; i < 20000 && s.phase !== "meeting"; i++) poach.step(s, []);
    expect(s.phase).toBe("meeting");
    const said: PoachInput[] = [
      { k: "say", p: "was", bay: "East Bay" },
      { k: "say", p: "inspected", target: 2, fry: 3 },
      { k: "say", p: "suspect", target: 3 },
    ];
    poach.step(s, said.map((i, seat) => ({ seat, i })));
    poach.step(s, [{ seat: 3, i: { k: "say", p: "vouch", target: 0 } }]);
    const f = poach.frameFor(s, 0) as { said: { seat: number; p: string; bay?: string; target?: number; fry?: number }[] };
    expect(f.said.map(({ seat, p, bay, target, fry }) => ({ seat, p, bay, target, fry }))).toEqual([
      { seat: 0, p: "was", bay: "east", target: undefined, fry: undefined },
      { seat: 1, p: "inspected", bay: undefined, target: 2, fry: 3 },
      { seat: 2, p: "suspect", bay: undefined, target: 3, fry: undefined },
      { seat: 3, p: "vouch", bay: undefined, target: 0, fry: undefined },
    ]);
    expect(JSON.stringify(f.said)).not.toMatch(/I was in|I suspect|I vouch|I inspected/);
    for (const x of f.said) for (const lang of ["en", "zh"] as const) expect(DICT[lang][`p_say_${x.p}`]).toBeTruthy();
    expect(t("zh", "p_say_was", { bay: t("zh", "p_bay_east") })).toBe("我在东湾。");
  });
});

describe("highlights travel as codes", () => {
  const sims: [string, () => { highlights: { key?: string; tkey?: string; vars?: Record<string, unknown> }[] }][] = [
    ["rush", () => { const s: RushSim = rush.make("h", people(2), { fish: 220 }); return rush.results(s); }],
    ["poach", () => { const s: PoachSim = poach.make("h", people(4), { fish: 220 }); return poach.results(s); }],
    ["party", () => { const s: PartySim = party.make("h", people(2), { fish: 220 }); return party.results(s); }],
    ["hold", () => { const s: HoldSim = hold.make("h", people(2), { fish: 220 }); return hold.results(s); }],
  ];
  for (const [id, results] of sims) {
    it(`every ${id} highlight has a title key and a text key in both dictionaries, and its vars fill every {var}`, () => {
      for (const h of results().highlights) {
        expect(h.tkey, "title key").toBeTruthy();
        expect(h.key, "text key").toBeTruthy();
        for (const lang of ["en", "zh"] as const) {
          expect(DICT[lang][h.tkey!], `${lang} ${h.tkey}`).toBeTruthy();
          const filled = t(lang, h.key!, { name: "X", ...(h.vars as Record<string, string | number>) });
          expect(filled, `${lang} ${h.key}`).not.toMatch(/\{\w+\}/);
        }
      }
    });
  }
});

describe("Fishing Party names its round and variant by code", () => {
  it("frames carry the variant's index, so a page words the round and variant in its own language", () => {
    const s: PartySim = party.make("v", people(2), { fish: 220 });
    for (let i = 0; i < 200 && s.phase !== "round"; i++) party.step(s, []);
    const f = party.frameFor(s, 0) as { game: string; vi: number };
    expect(["shoal", "koi", "tug", "night", "last"]).toContain(f.game);
    expect([0, 1]).toContain(f.vi);
    expect(DICT.zh[`y_var_${f.game}_${f.vi}`]).toBeTruthy();
  });
});
