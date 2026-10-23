import { describe, expect, it } from "vitest";
import type { Seat } from "../../src/lib/game-platform.ts";
import { DICT, t } from "../../src/lib/i18n.ts";
import { hold, type HoldSim } from "../../src/lib/modes/hold.ts";
import { party, type PartySim } from "../../src/lib/modes/party.ts";
import { linesFor, poach, type PoachInput, type PoachSim } from "../../src/lib/modes/poach.ts";
import { rush, type RushSim } from "../../src/lib/modes/rush.ts";

// Two people in one room may read different languages (DESIGN.md
// "Languages"), so what the server says in words it sends as a code and
// numbers, and each page words it from src/lib/i18n.ts.
const people = (n: number): Seat[] => Array.from({ length: n }, (_, i) => ({ seat: i, name: `P${i}`, bot: null, character: "mei" }));

describe("meeting lines travel as codes", () => {
  // Who's Poaching 2.0 (rule change 1, prompt-17): a line is a code and its
  // arguments ({ k, i, place, ... }); each page words it from the dictionary.
  it("a line reaches every seat's frame as its code and arguments, never as a sentence", () => {
    const s: PoachSim = poach.make("codes", people(4), { fish: 220 });
    for (let i = 0; i < 20000 && s.phase !== "meeting"; i++) poach.step(s, []);
    expect(s.phase).toBe("meeting");
    const said: PoachInput[] = [
      { k: "say", line: { k: "sus", i: 1 } },
      { k: "say", line: { k: "vouch", i: 0 } },
      { k: "say", line: { k: "skip" } },
      { k: "say", line: linesFor(s, 3)[0] },
    ];
    poach.step(s, said.map((i, seat) => ({ seat, i: poach.input(s, seat, i)! })));
    const f = poach.frameFor(s, 0) as { m: { says: { seat: number; line: { k: string } }[] } };
    expect(f.m.says.map((x) => x.line.k)).toEqual(["sus", "vouch", "skip", linesFor(s, 3)[0].k]);
    expect(JSON.stringify(f.m.says)).not.toMatch(/I was|I suspect|I'm sure|我/);
    const KEY: Record<string, string[]> = { was: ["p2_s_was"], insp: ["p2_s_insp_c", "p2_s_insp_f"], saw: ["p2_s_saw"], sawnet: ["p2_s_sawnet"], buoy: ["p2_s_buoy"], sus: ["p2_s_sus"], vouch: ["p2_s_vouch"], skip: ["p2_s_skip"] };
    for (const keys of Object.values(KEY)) for (const k of keys) for (const lang of ["en", "zh"] as const) expect(DICT[lang][k], `${lang} ${k}`).toBeTruthy();
    expect(t("zh", "p2_s_was", { place: t("zh", "p2_pl_east") })).toBe("我在东湾。");
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
