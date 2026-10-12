import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NAME_MAX_GRAPHEMES } from "../../src/lib/constants.ts";
import { BOT_NAMES, CAP_PER_FAMILY, MAX_FAMILIES } from "../../src/lib/game-constants.ts";
import { MODEL_VERSION, secretHash } from "../../src/lib/lake-sim.ts";
import { openLakeStore, type LakeStore } from "../../src/lib/lake-store.ts";

// The lake store (DESIGN.md v2.2, "The record, and replay"): a fresh
// database file and a fake clock per test. Pure persistence: no server, no
// game rules beyond what the ledger itself enforces.

let dir: string;
let file: string;
let t: number;
let store: LakeStore;
const now = (): number => t;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lake-store-"));
  file = join(dir, "pond.db");
  t = 1_700_000_000_000;
  store = openLakeStore(file, now);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function joinOk(code: string, name: string): { familyId: number; token: string; seat: number } {
  const res = store.join(code, name);
  if (!res.ok) throw new Error(`join ${name} failed: ${res.reason}`);
  return res;
}

describe("openLake", () => {
  it("gives a four-letter code from the look-alike-free alphabet, with an open row", () => {
    const { code } = store.openLake();
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    const lake = store.lakeByCode(code);
    expect(lake).not.toBeNull();
    expect(lake!.model).toBe(MODEL_VERSION);
    expect(lake!.secretHash).toBe(secretHash(lake!.secret));
  });

  it("retries on a clash", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 30; i++) codes.add(store.openLake().code);
    expect(codes.size).toBe(30);
  });

  it("each lake gets its own 256-bit secret", () => {
    const a = store.lakeByCode(store.openLake().code)!;
    const b = store.lakeByCode(store.openLake().code)!;
    expect(a.secret).not.toBe(b.secret);
    expect(Buffer.from(a.secret, "hex").length).toBe(32);
  });
});

describe("join", () => {
  it("v0.4 name rules: trims, rejects empty and over-long names", () => {
    const { code } = store.openLake();
    const { familyId } = joinOk(code, "  Ava  ");
    expect(familyId).toBeGreaterThan(0);
    expect(store.join(code, "   ")).toEqual({ ok: false, reason: "bad_name" });
    expect(store.join(code, "x".repeat(NAME_MAX_GRAPHEMES + 1))).toEqual({ ok: false, reason: "bad_name" });
  });

  it("refuses a name already taken (NFKC, case-folded)", () => {
    const { code } = store.openLake();
    joinOk(code, "Ava");
    expect(store.join(code, "ava")).toEqual({ ok: false, reason: "name_taken" });
  });

  it("refuses a bot's reserved name", () => {
    const { code } = store.openLake();
    for (const name of Object.values(BOT_NAMES)) {
      expect(store.join(code, name)).toEqual({ ok: false, reason: "bot_name" });
    }
  });

  it("a ninth family is refused as full", () => {
    const { code } = store.openLake();
    for (let i = 0; i < MAX_FAMILIES; i++) joinOk(code, `family-${i}`);
    expect(store.join(code, "one-too-many")).toEqual({ ok: false, reason: "full" });
  });

  it("gives seats 0, 1, 2, ... in joining order", () => {
    const { code } = store.openLake();
    const seats = [joinOk(code, "a"), joinOk(code, "b"), joinOk(code, "c")].map((f) => f.seat);
    expect(seats).toEqual([0, 1, 2]);
  });

  it("is refused after the start", () => {
    const { lakeId, code } = store.openLake();
    joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    expect(store.join(code, "late")).toEqual({ ok: false, reason: "started" });
  });

  it("no such lake", () => {
    expect(store.join("ZZZZ", "Ava")).toEqual({ ok: false, reason: "no_lake" });
  });
});

describe("familyByToken", () => {
  it("round-trips a joined family", () => {
    const { lakeId, code } = store.openLake();
    const { familyId, token, seat } = joinOk(code, "Ava");
    expect(store.familyByToken(token)).toEqual({ familyId, lakeId, seat, name: "Ava" });
  });

  it("is null for an unknown token", () => {
    expect(store.familyByToken("nope")).toBeNull();
  });
});

describe("start", () => {
  it("writes the start row (families, capacity, model, secretHash) and the bot families, seated after the people", () => {
    const { lakeId, code } = store.openLake();
    const ava = joinOk(code, "Ava");
    const { row, bots } = store.start(lakeId, t, 3);
    expect(bots.map((b) => b.name)).toEqual(["Jin", "Mei", "Old Wang"]);
    expect(bots.map((b) => b.seat)).toEqual([1, 2, 3]);
    const data = row.data as { families: { seat: number; name: string; bot: boolean }[]; capacity: number; model: string; secretHash: string; startedAt: number };
    expect(data.families).toEqual([
      { seat: 0, name: "Ava", bot: false },
      { seat: 1, name: "Jin", bot: true },
      { seat: 2, name: "Mei", bot: true },
      { seat: 3, name: "Old Wang", bot: true },
    ]);
    expect(data.capacity).toBe(CAP_PER_FAMILY * 4);
    expect(data.model).toBe(MODEL_VERSION);
    expect(data.startedAt).toBe(t);
    expect(row.step).toBe(0);
    expect(row.familyId).toBeNull();
    void ava;
  });

  it("a second start for the same lake is refused by the database", () => {
    const { lakeId, code } = store.openLake();
    joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    expect(() => store.start(lakeId, t, 0)).toThrow();
  });
});

describe("append and throw idempotency", () => {
  it("a throw key used twice returns the first row, and writes it once", () => {
    const { lakeId, code } = store.openLake();
    const { familyId } = joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    const key = "00000000-0000-4000-8000-000000000001";
    const [first] = store.append(lakeId, 10, [{ kind: "throw", familyId, data: { x: 1, y: 2, fine: false, breach: false, under: 0 }, key }]);
    const [second] = store.append(lakeId, 11, [{ kind: "throw", familyId, data: { x: 9, y: 9, fine: true, breach: false, under: 0 }, key }]);
    expect(second).toEqual(first);
    expect(store.throwByKey(familyId, key)).toEqual(first);
    expect(store.allRows(lakeId).filter((r) => r.kind === "throw")).toHaveLength(1);
  });

  it("throwByKey is null for a key never thrown", () => {
    const { lakeId, code } = store.openLake();
    const { familyId } = joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    expect(store.throwByKey(familyId, "00000000-0000-4000-8000-000000000099")).toBeNull();
  });

  it("writes every row of a step in one call, and rowsAfter/allRows see them", () => {
    const { lakeId, code } = store.openLake();
    const { familyId } = joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    const rows = store.append(lakeId, 5, [
      { kind: "buy", familyId, data: {} },
      { kind: "seal", familyId, data: { to: 0, seal: "赞" } },
    ]);
    expect(rows).toHaveLength(2);
    const all = store.allRows(lakeId);
    expect(all.map((r) => r.kind)).toContain("buy");
    expect(all.map((r) => r.kind)).toContain("seal");
    const after = store.rowsAfter(lakeId, rows[0].id - 1, 10);
    expect(after.map((r) => r.id)).toEqual(expect.arrayContaining(rows.map((r) => r.id)));
  });
});

describe("the ledger is append-only", () => {
  it("a raw UPDATE is refused", () => {
    const { lakeId } = store.openLake();
    const raw = new DatabaseSync(file);
    expect(() => raw.exec(`UPDATE lake_ledger SET at = 0 WHERE lake = ${lakeId}`)).toThrow();
    raw.close();
  });

  it("a raw DELETE is refused", () => {
    const { lakeId } = store.openLake();
    const raw = new DatabaseSync(file);
    expect(() => raw.exec(`UPDATE lake_ledger SET at = 0 WHERE lake = ${lakeId}`)).toThrow();
    expect(() => raw.exec(`DELETE FROM lake_ledger WHERE lake = ${lakeId}`)).toThrow();
    raw.close();
  });

  it("a second end row for the same lake is refused by the database", () => {
    const { lakeId, code } = store.openLake();
    joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    store.append(lakeId, 2560, [{ kind: "end", familyId: null, data: { secret: "x", step: 2560, kept: [], parts: [], grownFish: 0, nextYear: 0 } }]);
    expect(() =>
      store.append(lakeId, 2561, [{ kind: "end", familyId: null, data: { secret: "x", step: 2561, kept: [], parts: [], grownFish: 0, nextYear: 0 } }]),
    ).toThrow();
  });

  it("a second rule row for the same year is refused by the database", () => {
    const { lakeId, code } = store.openLake();
    joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    store.append(lakeId, 540, [{ kind: "rule", familyId: null, data: { year: 1, rule: "none", votes: {} } }]);
    expect(() => store.append(lakeId, 541, [{ kind: "rule", familyId: null, data: { year: 1, rule: "ban", votes: {} } }])).toThrow();
    // a different year is fine
    expect(() => store.append(lakeId, 1080, [{ kind: "rule", familyId: null, data: { year: 2, rule: "ban", votes: {} } }])).not.toThrow();
  });
});

describe("liveLakes and pastLakes", () => {
  it("a started lake with no end row is live", () => {
    const { lakeId, code } = store.openLake();
    joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    expect(store.liveLakes().map((l) => l.lakeId)).toContain(lakeId);
  });

  it("an unstarted lake is neither live nor past", () => {
    const { lakeId } = store.openLake();
    expect(store.liveLakes().map((l) => l.lakeId)).not.toContain(lakeId);
    expect(store.pastLakes(100).map((l) => l.lakeId)).not.toContain(lakeId);
  });

  it("a lake with an end row is past, not live", () => {
    const { lakeId, code } = store.openLake();
    joinOk(code, "Ava");
    store.start(lakeId, t, 0);
    store.append(lakeId, 2560, [{ kind: "end", familyId: null, data: { secret: "x", step: 2560, kept: [], parts: [], grownFish: 0, nextYear: 0 } }]);
    expect(store.liveLakes().map((l) => l.lakeId)).not.toContain(lakeId);
    expect(store.pastLakes(100).map((l) => l.lakeId)).toContain(lakeId);
  });
});

describe("the secret", () => {
  it("is in the lakes table and in no row before the end row", () => {
    const { lakeId, code } = store.openLake();
    const lake = store.lakeByCode(code)!;
    const { familyId } = joinOk(code, "Ava");
    store.start(lakeId, t, 2);
    store.append(lakeId, 5, [{ kind: "buy", familyId, data: {} }]);
    for (const row of store.allRows(lakeId)) {
      expect(JSON.stringify(row.data)).not.toContain(lake.secret);
    }
    store.append(lakeId, 2560, [
      { kind: "end", familyId: null, data: { secret: lake.secret, step: 2560, kept: [], parts: [], grownFish: 0, nextYear: 0 } },
    ]);
    const end = store.allRows(lakeId).find((r) => r.kind === "end")!;
    expect((end.data as { secret: string }).secret).toBe(lake.secret);
  });
});
