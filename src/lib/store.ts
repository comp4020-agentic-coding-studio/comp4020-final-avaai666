// The store (DESIGN.md): ponds, nets and the append-only ledger in one SQLite
// file, through node:sqlite. Every write happens in a BEGIN IMMEDIATE
// transaction together with its ledger row.
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { CATCH_INTERVAL_MS, K, NAME_MAX_GRAPHEMES } from "./constants.ts";
import { available, collapseAfterMs, isDead, stockAt } from "./pond.ts";

export type Clock = () => number;

export type LedgerKind = "dig" | "join" | "catch" | "collapse";

export interface LedgerRow {
  id: number;
  pondId: number;
  at: number;
  kind: LedgerKind;
  netId: number | null;
  stockAfter: number;
  key: string | null;
}

export interface NetState {
  netId: number;
  name: string;
  catches: number;
}

export interface PondState {
  pondId: number;
  dugAt: number;
  stock: number;
  available: number;
  dead: boolean;
  diedAt: number | null;
  nets: NetState[];
}

export interface PondSummary {
  pondId: number;
  dugAt: number;
  stock: number;
  available: number;
  dead: boolean;
  diedAt: number | null;
  nets: number;
}

export type JoinResult =
  | { ok: true; netId: number; token: string }
  | { ok: false; reason: "bad_name" | "name_taken" | "dead" | "no_pond" };

export type CatchResult =
  | { ok: true; row: LedgerRow; duplicate: boolean }
  | { ok: false; reason: "too_soon"; retryInMs: number }
  | { ok: false; reason: "dead" | "no_fish" | "not_in_pond" };

export interface Store {
  digPond(): { pondId: number };
  join(pondId: number, name: string): JoinResult;
  catchFish(token: string, pondId: number, key: string): CatchResult;
  // may write the pond's collapse row
  evaluate(pondId: number): PondState;
  ledgerAfter(pondId: number, afterId: number, limit: number): LedgerRow[];
  listPonds(): PondSummary[];
  netByToken(token: string): { netId: number; pondId: number; name: string } | null;
  close(): void;
}

const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`;

// Created in one transaction, so a new file costs one commit, not one per
// statement.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS ponds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dug_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pond INTEGER NOT NULL REFERENCES ponds (id),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  UNIQUE (pond, name_key)
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pond INTEGER NOT NULL REFERENCES ponds (id),
  at INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dig', 'join', 'catch', 'collapse')),
  net INTEGER REFERENCES nets (id),
  stock_after REAL NOT NULL,
  idem_key TEXT,
  CHECK ((net IS NULL) = (kind IN ('dig', 'collapse'))),
  CHECK ((idem_key IS NOT NULL) = (kind = 'catch')),
  UNIQUE (net, idem_key)
);

CREATE INDEX IF NOT EXISTS ledger_by_pond ON ledger (pond, id);
CREATE UNIQUE INDEX IF NOT EXISTS one_dig_per_pond ON ledger (pond) WHERE kind = 'dig';
CREATE UNIQUE INDEX IF NOT EXISTS one_collapse_per_pond ON ledger (pond) WHERE kind = 'collapse';

CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
`;

interface DbLedgerRow {
  id: number;
  pond: number;
  at: number;
  kind: LedgerKind;
  net: number | null;
  stock_after: number;
  idem_key: string | null;
}

const toRow = (r: DbLedgerRow): LedgerRow => ({
  id: r.id,
  pondId: r.pond,
  at: r.at,
  kind: r.kind,
  netId: r.net,
  stockAfter: r.stock_after,
  key: r.idem_key,
});

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// A name as stored, or null if it is not one: trimmed, no control characters,
// 1 to NAME_MAX_GRAPHEMES grapheme clusters.
function cleanName(raw: string): string | null {
  const name = raw.trim();
  if (/\p{Cc}/u.test(name)) return null;
  const length = [...graphemes.segment(name)].length;
  return length >= 1 && length <= NAME_MAX_GRAPHEMES ? name : null;
}

export function openStore(file: string, now: Clock): Store {
  const db = new DatabaseSync(file);
  db.exec(PRAGMAS);
  db.exec(`BEGIN IMMEDIATE; ${SCHEMA} COMMIT;`);

  const q = {
    insertPond: db.prepare("INSERT INTO ponds (dug_at) VALUES (?)"),
    pond: db.prepare("SELECT id, dug_at FROM ponds WHERE id = ?"),
    pondIds: db.prepare("SELECT id FROM ponds ORDER BY id"),
    insertNet: db.prepare("INSERT INTO nets (pond, name, name_key, token) VALUES (?, ?, ?, ?)"),
    nameTaken: db.prepare("SELECT 1 FROM nets WHERE pond = ? AND name_key = ?"),
    netByToken: db.prepare("SELECT id, pond, name FROM nets WHERE token = ?"),
    netsOf: db.prepare(
      `SELECT n.id, n.name, count(l.id) AS catches FROM nets n
       LEFT JOIN ledger l ON l.net = n.id AND l.kind = 'catch'
       WHERE n.pond = ? GROUP BY n.id ORDER BY n.id`,
    ),
    insertRow: db.prepare(
      "INSERT INTO ledger (pond, at, kind, net, stock_after, idem_key) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    ),
    latestRow: db.prepare("SELECT * FROM ledger WHERE pond = ? ORDER BY id DESC LIMIT 1"),
    rowByKey: db.prepare("SELECT * FROM ledger WHERE net = ? AND idem_key = ?"),
    lastCatchAt: db.prepare("SELECT max(at) AS at FROM ledger WHERE net = ? AND kind = 'catch'"),
    rowsAfter: db.prepare("SELECT * FROM ledger WHERE pond = ? AND id > ? ORDER BY id LIMIT ?"),
  };

  function tx<T>(fn: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  function append(
    pondId: number,
    at: number,
    kind: LedgerKind,
    netId: number | null,
    stockAfter: number,
    key: string | null = null,
  ): LedgerRow {
    return toRow(q.insertRow.get(pondId, at, kind, netId, stockAfter, key) as unknown as DbLedgerRow);
  }

  // The pond's state at time t, inside a transaction. If the pond has died
  // with nobody fishing and has no collapse row yet, writes it, at the moment
  // stock fell below 1. Null if there is no such pond.
  function evaluateAt(pondId: number, t: number): PondState | null {
    const pond = q.pond.get(pondId) as { id: number; dug_at: number } | undefined;
    if (!pond) return null;
    const last = q.latestRow.get(pondId) as unknown as DbLedgerRow;

    let stock: number;
    let diedAt: number | null = null;
    if (last.kind === "collapse") {
      stock = last.stock_after;
      diedAt = last.at;
    } else {
      stock = stockAt(last.stock_after, t - last.at);
      if (isDead(stock)) {
        const after = collapseAfterMs(last.stock_after) ?? 0;
        diedAt = append(pondId, last.at + after, "collapse", null, stockAt(last.stock_after, after)).at;
      }
    }

    const nets = (q.netsOf.all(pondId) as unknown as { id: number; name: string; catches: number }[]).map(
      (n) => ({ netId: n.id, name: n.name, catches: n.catches }),
    );
    return {
      pondId,
      dugAt: pond.dug_at,
      stock,
      available: available(stock),
      dead: diedAt !== null,
      diedAt,
      nets,
    };
  }

  return {
    digPond() {
      return tx(() => {
        const t = now();
        const pondId = Number(q.insertPond.run(t).lastInsertRowid);
        append(pondId, t, "dig", null, K);
        return { pondId };
      });
    },

    join(pondId, rawName) {
      return tx((): JoinResult => {
        const t = now();
        const state = evaluateAt(pondId, t);
        if (!state) return { ok: false, reason: "no_pond" };
        const name = cleanName(rawName);
        if (name === null) return { ok: false, reason: "bad_name" };
        if (state.dead) return { ok: false, reason: "dead" };
        const nameKey = name.toLowerCase();
        if (q.nameTaken.get(pondId, nameKey)) return { ok: false, reason: "name_taken" };

        const token = randomBytes(16).toString("base64url");
        const netId = Number(q.insertNet.run(pondId, name, nameKey, token).lastInsertRowid);
        append(pondId, t, "join", netId, state.stock);
        return { ok: true, netId, token };
      });
    },

    catchFish(token, pondId, key) {
      return tx((): CatchResult => {
        const t = now();
        const net = q.netByToken.get(token) as { id: number; pond: number } | undefined;
        if (!net || net.pond !== pondId) return { ok: false, reason: "not_in_pond" };
        const prior = q.rowByKey.get(net.id, key) as unknown as DbLedgerRow | undefined;
        if (prior) return { ok: true, row: toRow(prior), duplicate: true };

        const state = evaluateAt(pondId, t)!;
        if (state.dead) return { ok: false, reason: "dead" };
        const { at: lastCatchAt } = q.lastCatchAt.get(net.id) as { at: number | null };
        const sinceLast = lastCatchAt === null ? Infinity : t - lastCatchAt;
        if (sinceLast < CATCH_INTERVAL_MS) return { ok: false, reason: "too_soon", retryInMs: CATCH_INTERVAL_MS - sinceLast };
        if (available(state.stock) < 1) return { ok: false, reason: "no_fish" };

        const row = append(pondId, t, "catch", net.id, state.stock - 1, key);
        if (isDead(row.stockAfter)) append(pondId, t, "collapse", null, row.stockAfter);
        return { ok: true, row, duplicate: false };
      });
    },

    evaluate(pondId) {
      const state = tx(() => evaluateAt(pondId, now()));
      if (!state) throw new Error(`no pond ${pondId}`);
      return state;
    },

    ledgerAfter(pondId, afterId, limit) {
      return (q.rowsAfter.all(pondId, afterId, limit) as unknown as DbLedgerRow[]).map(toRow);
    },

    listPonds() {
      return tx(() => {
        const t = now();
        return (q.pondIds.all() as { id: number }[]).map(({ id }) => {
          const s = evaluateAt(id, t)!;
          const { nets, ...rest } = s;
          return { ...rest, nets: nets.length };
        });
      });
    },

    netByToken(token) {
      const net = q.netByToken.get(token) as { id: number; pond: number; name: string } | undefined;
      return net ? { netId: net.id, pondId: net.pond, name: net.name } : null;
    },

    close() {
      db.close();
    },
  };
}
