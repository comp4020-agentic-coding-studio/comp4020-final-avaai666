import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { A, K } from "../../src/lib/constants.ts";
import { collapseAfterMs, stockAt } from "../../src/lib/pond.ts";
import { openStore, type Store } from "../../src/lib/store.ts";

// The store (DESIGN.md): a fresh database file and a fake clock per test.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

let dir: string;
let file: string;
let t: number;
let store: Store;
const now = (): number => t;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pond-store-"));
  file = join(dir, "pond.db");
  t = 1_700_000_000_000;
  store = openStore(file, now);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

// Test-only: puts a pond in a given state by INSERTing a `join` row for an
// existing net, carrying the stock we want, at the current clock time. It never
// UPDATEs or DELETEs a row.
function forceStock(pondId: number, netId: number, stock: number): void {
  const db = new DatabaseSync(file);
  db.prepare("INSERT INTO ledger (pond, at, kind, net, stock_after) VALUES (?, ?, 'join', ?, ?)").run(
    pondId,
    t,
    netId,
    stock,
  );
  db.close();
}

function rowCount(): number {
  const db = new DatabaseSync(file);
  const { n } = db.prepare("SELECT count(*) AS n FROM ledger").get() as { n: number };
  db.close();
  return n;
}

const allRows = (pondId: number) => store.ledgerAfter(pondId, 0, 10_000);

function joinOk(pondId: number, name: string): { netId: number; token: string } {
  const res = store.join(pondId, name);
  if (!res.ok) throw new Error(`join ${name} failed: ${res.reason}`);
  return res;
}

it("1. digPond writes one dig row with stock K, and evaluate shows K", () => {
  const { pondId } = store.digPond();
  const rows = allRows(pondId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ kind: "dig", pondId, at: t, netId: null, stockAfter: K });
  const state = store.evaluate(pondId);
  expect(state.stock).toBe(K);
  expect(state.available).toBe(K);
  expect(state.dead).toBe(false);
  expect(state.diedAt).toBeNull();
});

describe("2. names", () => {
  it("are trimmed", () => {
    const { pondId } = store.digPond();
    const { token } = joinOk(pondId, "  Ava  ");
    expect(store.netByToken(token)?.name).toBe("Ava");
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["25 graphemes", "a".repeat(25)],
    ["a control character", "A\u0007va"],
  ])("reject %s as bad_name", (_label, name) => {
    const { pondId } = store.digPond();
    expect(store.join(pondId, name)).toEqual({ ok: false, reason: "bad_name" });
  });

  it("are unique in a pond, case-insensitively, but not across ponds", () => {
    const p1 = store.digPond().pondId;
    const p2 = store.digPond().pondId;
    joinOk(p1, "Ava");
    expect(store.join(p1, "ava")).toEqual({ ok: false, reason: "name_taken" });
    expect(store.join(p2, "Ava").ok).toBe(true);
  });

  it("count grapheme clusters, not UTF-16 units", () => {
    const { pondId } = store.digPond();
    const family = "👨‍👩‍👧‍👦";
    const name = family + "a".repeat(23);
    expect(name.length).toBeGreaterThan(24);
    expect(store.join(pondId, name).ok).toBe(true);
    expect(store.join(pondId, family + "b".repeat(24))).toEqual({ ok: false, reason: "bad_name" });
  });
});

it("3. a catch writes one catch row with stock_after = stockAt(previous) - 1 and counts it", () => {
  const { pondId } = store.digPond();
  const a = joinOk(pondId, "Ava");
  const b = joinOk(pondId, "Bo");

  const first = store.catchFish(a.token, pondId, "k1");
  expect(first).toMatchObject({ ok: true, duplicate: false, row: { kind: "catch", netId: a.netId, stockAfter: K - 1 } });

  t += 400;
  const before = rowCount();
  const second = store.catchFish(b.token, pondId, "k2");
  expect(second).toMatchObject({ ok: true, row: { kind: "catch", netId: b.netId, at: t, stockAfter: stockAt(K - 1, 400) - 1 } });
  expect(rowCount()).toBe(before + 1);

  const nets = store.evaluate(pondId).nets;
  expect(nets.find((n) => n.netId === a.netId)?.catches).toBe(1);
  expect(nets.find((n) => n.netId === b.netId)?.catches).toBe(1);
});

it("4. rate limit: 999 ms later is too_soon with 1 ms left and writes nothing; 1000 ms later succeeds", () => {
  const { pondId } = store.digPond();
  const a = joinOk(pondId, "Ava");
  expect(store.catchFish(a.token, pondId, "k1").ok).toBe(true);

  t += 999;
  const before = rowCount();
  expect(store.catchFish(a.token, pondId, "k2")).toEqual({ ok: false, reason: "too_soon", retryInMs: 1 });
  expect(rowCount()).toBe(before);

  t += 1;
  expect(store.catchFish(a.token, pondId, "k2").ok).toBe(true);
});

it("5. idempotency: the same key returns the original row once; another net's same key is its own catch", () => {
  const { pondId } = store.digPond();
  const a = joinOk(pondId, "Ava");
  const b = joinOk(pondId, "Bo");

  const first = store.catchFish(a.token, pondId, "same");
  if (!first.ok) throw new Error("first catch failed");
  const again = store.catchFish(a.token, pondId, "same");
  t += 5000;
  const later = store.catchFish(a.token, pondId, "same");
  expect(again).toEqual({ ok: true, row: first.row, duplicate: true });
  expect(later).toEqual({ ok: true, row: first.row, duplicate: true });

  const other = store.catchFish(b.token, pondId, "same");
  expect(other).toMatchObject({ ok: true, duplicate: false, row: { netId: b.netId } });

  const catches = allRows(pondId).filter((r) => r.kind === "catch");
  expect(catches.map((r) => r.netId)).toEqual([a.netId, b.netId]);
});

it("6. last fish: ten nets tap at the same moment on 1.5 fish; exactly one catches", () => {
  const { pondId } = store.digPond();
  const nets = Array.from({ length: 10 }, (_, i) => joinOk(pondId, `net ${i}`));
  forceStock(pondId, nets[0].netId, 1.5);

  const results = nets.map((n, i) => store.catchFish(n.token, pondId, `k${i}`));
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  for (const r of results.filter((r) => !r.ok)) {
    expect(["no_fish", "dead"]).toContain(r.reason);
  }
  expect(allRows(pondId).filter((r) => r.kind === "catch")).toHaveLength(1);
});

it("7. kill shot: a catch from 1.3 to 0.3 writes catch then collapse together; then taps and joins are dead", () => {
  const { pondId } = store.digPond();
  const a = joinOk(pondId, "Ava");
  const b = joinOk(pondId, "Bo");
  forceStock(pondId, a.netId, 1.3);

  const res = store.catchFish(a.token, pondId, "k1");
  expect(res.ok).toBe(true);
  const [catchRow, collapse] = allRows(pondId).slice(-2);
  expect(catchRow).toMatchObject({ kind: "catch", netId: a.netId, at: t });
  expect(catchRow.stockAfter).toBeCloseTo(0.3, 9);
  expect(collapse).toMatchObject({ kind: "collapse", netId: null, at: t, id: catchRow.id + 1 });

  t += 1000;
  expect(store.catchFish(b.token, pondId, "k2")).toEqual({ ok: false, reason: "dead" });
  expect(store.join(pondId, "Cy")).toEqual({ ok: false, reason: "dead" });
  expect(store.evaluate(pondId)).toMatchObject({ dead: true, diedAt: t - 1000 });
});

it("8. unaided death: evaluate writes one collapse row at the computed moment, and only once", () => {
  const { pondId } = store.digPond();
  const a = joinOk(pondId, "Ava");
  forceStock(pondId, a.netId, 0.95 * A);
  const lastAt = t;

  t += 60 * MINUTE;
  const before = rowCount();
  const state = store.evaluate(pondId);
  expect(state.dead).toBe(true);
  expect(rowCount()).toBe(before + 1);

  const collapse = allRows(pondId).at(-1)!;
  expect(collapse.kind).toBe("collapse");
  expect(Math.abs(collapse.at - (lastAt + collapseAfterMs(0.95 * A)!))).toBeLessThanOrEqual(1000);
  expect(state.diedAt).toBe(collapse.at);

  store.evaluate(pondId);
  expect(rowCount()).toBe(before + 1);
});

it("9. the ledger is append-only: raw UPDATE and DELETE both throw", () => {
  store.digPond();
  const db = new DatabaseSync(file);
  try {
    expect(() => db.exec("UPDATE ledger SET stock_after = 0")).toThrow("ledger is append-only");
    expect(() => db.exec("DELETE FROM ledger")).toThrow("ledger is append-only");
  } finally {
    db.close();
  }
  expect(rowCount()).toBe(1);
});

it("10. persistence: close and reopen the same file, and state and ledger are identical", () => {
  const { pondId } = store.digPond();
  const a = joinOk(pondId, "Ava");
  t += 2000;
  expect(store.catchFish(a.token, pondId, "k1").ok).toBe(true);
  t += 3000;
  const state = store.evaluate(pondId);
  const rows = allRows(pondId);
  const ponds = store.listPonds();
  store.close();

  store = openStore(file, now);
  expect(store.evaluate(pondId)).toEqual(state);
  expect(allRows(pondId)).toEqual(rows);
  expect(store.listPonds()).toEqual(ponds);
  expect(store.netByToken(a.token)).toEqual({ netId: a.netId, pondId, name: "Ava" });
});

it("11. a week away: evaluate shows a full pond and writes no rows", () => {
  const { pondId } = store.digPond();
  t += 7 * DAY;
  const state = store.evaluate(pondId);
  expect(Math.abs(state.stock - K)).toBeLessThanOrEqual(0.1);
  expect(rowCount()).toBe(1);
});

it("12. ledgerAfter returns the pond's rows in id order after the given id, at most limit", () => {
  const { pondId } = store.digPond();
  const other = store.digPond().pondId;
  joinOk(pondId, "Ava");
  joinOk(other, "Zed");
  joinOk(pondId, "Bo");
  joinOk(pondId, "Cy");

  const rows = allRows(pondId);
  expect(rows.map((r) => r.kind)).toEqual(["dig", "join", "join", "join"]);
  expect(rows.every((r) => r.pondId === pondId)).toBe(true);
  expect(rows.map((r) => r.id)).toEqual([...rows.map((r) => r.id)].sort((x, y) => x - y));

  expect(store.ledgerAfter(pondId, rows[0].id, 2).map((r) => r.id)).toEqual([rows[1].id, rows[2].id]);
  expect(store.ledgerAfter(pondId, rows[3].id, 10)).toEqual([]);
});
