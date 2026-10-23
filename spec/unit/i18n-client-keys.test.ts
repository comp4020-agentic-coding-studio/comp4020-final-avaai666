import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DICT } from "../../src/lib/i18n.ts";

// CLAUDE.md: "Every visible word comes from src/lib/i18n.ts. A key missing in
// either language fails a test." The client scripts call t("key"); a key that
// is not in the dictionary shows its own name on the page (the ceremony once
// showed "skipall" and "next" to every player). This reads every literal
// t("...") call in the /play scripts and checks the key exists (a prefix
// joined to an id, like t("cer_v_" + id), is left to the tests of that id).
const DIR = join(import.meta.dirname, "../../src/static/play");
const files = readdirSync(DIR).filter((f) => f.endsWith(".js"));

describe("the /play scripts' words", () => {
  it.each(files)("every literal t(\"key\") in %s is in the dictionary", (f) => {
    const src = readFileSync(join(DIR, f), "utf8");
    const keys = [...src.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_]+)["'`]/g)].map((m) => m[1]);
    const missing = [...new Set(keys)].filter((k) => !k.endsWith("_")).filter((k) => !(k in DICT.en) || !(k in DICT.zh));
    expect(missing).toEqual([]);
  });
});
