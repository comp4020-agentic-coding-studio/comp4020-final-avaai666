// The lake store (DESIGN.md v2.2, "The record, and replay"): lakes, families
// and the append-only ledger, in the same SQLite file as the ponds (its own
// connection: WAL, busy_timeout, as store.ts). Every write happens in a BEGIN
// IMMEDIATE transaction. Pure persistence: no game rules beyond what the
// ledger itself enforces (the lake-runner decides what is valid; this store
// only remembers what happened).
import { randomBytes, randomInt } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { NAME_MAX_GRAPHEMES } from "./constants.ts";
import { BOT_FILL_ORDER, BOT_NAMES, CAP_PER_FAMILY, MAX_FAMILIES } from "./game-constants.ts";
import { MODEL_VERSION, secretHash } from "./lake-sim.ts";
import type { BotKind } from "./rules.ts";

export type Clock = () => number;

const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"; // no look-alikes
const CODE_LENGTH = 4;

export type LedgerKind =
  | "open"
  | "join"
  | "start"
  | "throw"
  | "haul"
  | "buy"
  | "ask"
  | "answer"
  | "broken"
  | "seal"
  | "vote"
  | "build"
  | "rule"
  | "end";

// Kinds with no single family of their own.
const LAKE_WIDE_KINDS: ReadonlySet<LedgerKind> = new Set(["open", "start", "rule", "end"]);

export interface LakeLedgerRow {
  id: number;
  lakeId: number;
  at: number;
  step: number | null;
  kind: LedgerKind;
  familyId: number | null;
  data: unknown;
  key: string | null;
}

export interface NewRow {
  kind: LedgerKind;
  familyId: number | null;
  data: unknown;
  key?: string | null;
}

export interface LakeRow {
  id: number;
  code: string;
  openedAt: number;
  secret: string;
  secretHash: string;
  model: string;
}

export type LakeJoinResult =
  | { ok: true; familyId: number; token: string; seat: number; row: LakeLedgerRow }
  | { ok: false; reason: "bad_name" | "name_taken" | "bot_name" | "full" | "started" | "no_lake" };

export interface StartResult {
  row: LakeLedgerRow;
  bots: { familyId: number; seat: number; name: string; bot: BotKind }[];
}

export interface FamilyRow {
  familyId: number;
  seat: number;
  name: string;
  bot: BotKind | null;
  token: string | null;
}

export interface LakeStore {
  openLake(): { lakeId: number; code: string };
  lakeByCode(code: string): LakeRow | null;
  lakeById(id: number): LakeRow | null;
  join(code: string, name: string): LakeJoinResult;
  familyByToken(token: string): { familyId: number; lakeId: number; seat: number; name: string } | null;
  familiesOf(lakeId: number): FamilyRow[];
  start(lakeId: number, startedAt: number, bots: number): StartResult;
  append(lakeId: number, step: number, rows: NewRow[]): LakeLedgerRow[];
  // One transaction for one step: `build` may call `write` more than once,
  // each call seeing the row (with its id) the previous call wrote, so a
  // haul can carry the id of the throw it closes.
  appendStep<T>(lakeId: number, step: number, build: (write: (row: NewRow) => LakeLedgerRow) => T): T;
  rowsAfter(lakeId: number, afterId: number, limit: number): LakeLedgerRow[];
  allRows(lakeId: number): LakeLedgerRow[];
  throwByKey(familyId: number, key: string): LakeLedgerRow | null;
  liveLakes(): { lakeId: number; code: string }[];
  pastLakes(limit?: number): { lakeId: number; code: string; openedAt: number }[];
  close(): void;
}

const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`;

// Created in one transaction, so a new file costs one commit, not one per
// statement.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS lakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  opened_at INTEGER NOT NULL,
  secret TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lake INTEGER NOT NULL REFERENCES lakes (id),
  seat INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  token TEXT UNIQUE,
  bot TEXT,
  UNIQUE (lake, seat),
  UNIQUE (lake, name_key)
);

CREATE TABLE IF NOT EXISTS lake_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lake INTEGER NOT NULL REFERENCES lakes (id),
  at INTEGER NOT NULL,
  step INTEGER,
  kind TEXT NOT NULL CHECK (kind IN (
    'open', 'join', 'start', 'throw', 'haul', 'buy', 'ask', 'answer',
    'broken', 'seal', 'vote', 'build', 'rule', 'end'
  )),
  family INTEGER REFERENCES families (id),
  data TEXT NOT NULL,
  key TEXT,
  CHECK ((step IS NULL) = (kind IN ('open', 'join'))),
  CHECK ((family IS NULL) = (kind IN ('open', 'start', 'rule', 'end')))
);

CREATE INDEX IF NOT EXISTS lake_ledger_by_lake ON lake_ledger (lake, id);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_per_lake ON lake_ledger (lake) WHERE kind = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS one_start_per_lake ON lake_ledger (lake) WHERE kind = 'start';
CREATE UNIQUE INDEX IF NOT EXISTS one_end_per_lake ON lake_ledger (lake) WHERE kind = 'end';
CREATE UNIQUE INDEX IF NOT EXISTS one_rule_per_lake_year
  ON lake_ledger (lake, CAST(json_extract(data, '$.year') AS INTEGER)) WHERE kind = 'rule';
CREATE UNIQUE INDEX IF NOT EXISTS one_row_per_throw_key
  ON lake_ledger (family, key) WHERE kind = 'throw' AND key IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS lake_ledger_no_update BEFORE UPDATE ON lake_ledger
  BEGIN SELECT RAISE(ABORT, 'lake_ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS lake_ledger_no_delete BEFORE DELETE ON lake_ledger
  BEGIN SELECT RAISE(ABORT, 'lake_ledger is append-only'); END;
`;

interface DbLedgerRow {
  id: number;
  lake: number;
  at: number;
  step: number | null;
  kind: LedgerKind;
  family: number | null;
  data: string;
  key: string | null;
}

const toRow = (r: DbLedgerRow): LakeLedgerRow => ({
  id: r.id,
  lakeId: r.lake,
  at: r.at,
  step: r.step,
  kind: r.kind,
  familyId: r.family,
  data: JSON.parse(r.data) as unknown,
  key: r.key,
});

interface DbLake {
  id: number;
  code: string;
  opened_at: number;
  secret: string;
  secret_hash: string;
  model: string;
}

const toLake = (r: DbLake): LakeRow => ({
  id: r.id,
  code: r.code,
  openedAt: r.opened_at,
  secret: r.secret,
  secretHash: r.secret_hash,
  model: r.model,
});

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// A name as stored (trimmed, NFC), or null if it is not one: the v0.4 name
// rules (no control characters, no format characters except the zero-width
// joiner inside emoji, 1 to NAME_MAX_GRAPHEMES grapheme clusters).
function cleanName(raw: string): string | null {
  const name = raw.trim().normalize("NFC");
  if (/\p{Cc}|(?!‍)\p{Cf}/u.test(name)) return null;
  const length = [...graphemes.segment(name)].length;
  return length >= 1 && length <= NAME_MAX_GRAPHEMES ? name : null;
}

// What two names are compared by.
const nameKey = (name: string): string => name.normalize("NFKC").toLowerCase();

const BOT_NAME_KEYS = new Set(Object.values(BOT_NAMES).map(nameKey));

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

// onCommit, if given, hears how long each transaction that wrote something took.
export function openLakeStore(file: string, now: Clock, onCommit?: (ms: number) => void): LakeStore {
  const db = new DatabaseSync(file);
  db.exec(PRAGMAS);
  db.exec(`BEGIN IMMEDIATE; ${SCHEMA} COMMIT;`);

  const q = {
    insertLake: db.prepare(
      "INSERT INTO lakes (code, opened_at, secret, secret_hash, model) VALUES (?, ?, ?, ?, ?)",
    ),
    lakeByCode: db.prepare("SELECT * FROM lakes WHERE code = ?"),
    lakeById: db.prepare("SELECT * FROM lakes WHERE id = ?"),
    insertFamily: db.prepare("INSERT INTO families (lake, seat, name, name_key, token, bot) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"),
    familyCount: db.prepare("SELECT count(*) AS n FROM families WHERE lake = ?"),
    nameTaken: db.prepare("SELECT 1 FROM families WHERE lake = ? AND name_key = ?"),
    familyByToken: db.prepare("SELECT id, lake, seat, name FROM families WHERE token = ?"),
    familiesOf: db.prepare("SELECT id, seat, name, bot, token FROM families WHERE lake = ? ORDER BY seat"),
    hasStart: db.prepare("SELECT 1 FROM lake_ledger WHERE lake = ? AND kind = 'start'"),
    hasEnd: db.prepare("SELECT 1 FROM lake_ledger WHERE lake = ? AND kind = 'end'"),
    insertRow: db.prepare(
      "INSERT INTO lake_ledger (lake, at, step, kind, family, data, key) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    ),
    throwByKey: db.prepare("SELECT * FROM lake_ledger WHERE family = ? AND kind = 'throw' AND key = ?"),
    rowsAfter: db.prepare("SELECT * FROM lake_ledger WHERE lake = ? AND id > ? ORDER BY id LIMIT ?"),
    allRows: db.prepare("SELECT * FROM lake_ledger WHERE lake = ? ORDER BY id"),
    liveLakes: db.prepare(
      `SELECT l.id, l.code FROM lakes l
       WHERE EXISTS (SELECT 1 FROM lake_ledger g WHERE g.lake = l.id AND g.kind = 'start')
         AND NOT EXISTS (SELECT 1 FROM lake_ledger g WHERE g.lake = l.id AND g.kind = 'end')`,
    ),
    pastLakes: db.prepare(
      `SELECT l.id, l.code, l.opened_at FROM lakes l
       WHERE EXISTS (SELECT 1 FROM lake_ledger g WHERE g.lake = l.id AND g.kind = 'end')
       ORDER BY l.id DESC LIMIT ?`,
    ),
    changes: db.prepare("SELECT total_changes() AS n"),
  };

  const totalChanges = (): number => (q.changes.get() as { n: number }).n;

  function tx<T>(fn: () => T): T {
    const start = performance.now();
    const changesBefore = totalChanges();
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      if (onCommit && totalChanges() !== changesBefore) onCommit(performance.now() - start);
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  function insertRow(
    lakeId: number,
    at: number,
    step: number | null,
    kind: LedgerKind,
    familyId: number | null,
    data: unknown,
    key: string | null,
  ): LakeLedgerRow {
    return toRow(q.insertRow.get(lakeId, at, step, kind, familyId, JSON.stringify(data), key) as unknown as DbLedgerRow);
  }

  // A throw's key, seen again, returns the row already written; otherwise one
  // row is inserted. Shared by append() (independent rows) and appendStep()
  // (a step's rows, some of which may reference another's freshly-made id).
  function writeRow(lakeId: number, at: number, step: number | null, r: NewRow): LakeLedgerRow {
    if (r.kind === "throw" && r.key) {
      const prior = q.throwByKey.get(r.familyId, r.key) as unknown as DbLedgerRow | undefined;
      if (prior) return toRow(prior);
    }
    if (LAKE_WIDE_KINDS.has(r.kind) !== (r.familyId === null)) {
      throw new Error(`append: ${r.kind} must ${LAKE_WIDE_KINDS.has(r.kind) ? "not " : ""}carry a family`);
    }
    return insertRow(lakeId, at, step, r.kind, r.familyId, r.data, r.key ?? null);
  }

  return {
    openLake() {
      return tx(() => {
        const at = now();
        const secret = randomBytes(32).toString("hex");
        const hash = secretHash(secret);
        for (;;) {
          const code = randomCode();
          try {
            const lakeId = Number(q.insertLake.run(code, at, secret, hash, MODEL_VERSION).lastInsertRowid);
            insertRow(lakeId, at, null, "open", null, {}, null);
            return { lakeId, code };
          } catch (err) {
            if (String((err as Error).message).includes("UNIQUE") && String((err as Error).message).includes("code")) continue;
            throw err;
          }
        }
      });
    },

    lakeByCode(code) {
      const row = q.lakeByCode.get(code) as DbLake | undefined;
      return row ? toLake(row) : null;
    },

    lakeById(id) {
      const row = q.lakeById.get(id) as DbLake | undefined;
      return row ? toLake(row) : null;
    },

    join(code, rawName) {
      return tx((): LakeJoinResult => {
        const lake = q.lakeByCode.get(code) as DbLake | undefined;
        if (!lake) return { ok: false, reason: "no_lake" };
        if (q.hasStart.get(lake.id)) return { ok: false, reason: "started" };
        const name = cleanName(rawName);
        if (name === null) return { ok: false, reason: "bad_name" };
        const key = nameKey(name);
        if (BOT_NAME_KEYS.has(key)) return { ok: false, reason: "bot_name" };
        const { n } = q.familyCount.get(lake.id) as { n: number };
        if (n >= MAX_FAMILIES) return { ok: false, reason: "full" };
        if (q.nameTaken.get(lake.id, key)) return { ok: false, reason: "name_taken" };

        const token = randomBytes(16).toString("base64url");
        const familyId = Number((q.insertFamily.get(lake.id, n, name, key, token, null) as { id: number }).id);
        const row = insertRow(lake.id, now(), null, "join", familyId, { name }, null);
        return { ok: true, familyId, token, seat: n, row };
      });
    },

    familyByToken(token) {
      const row = q.familyByToken.get(token) as { id: number; lake: number; seat: number; name: string } | undefined;
      return row ? { familyId: row.id, lakeId: row.lake, seat: row.seat, name: row.name } : null;
    },

    familiesOf(lakeId) {
      return (q.familiesOf.all(lakeId) as { id: number; seat: number; name: string; bot: BotKind | null; token: string | null }[]).map(
        (f) => ({ familyId: f.id, seat: f.seat, name: f.name, bot: f.bot, token: f.token }),
      );
    },

    start(lakeId, startedAt, bots) {
      return tx((): StartResult => {
        if (bots > BOT_FILL_ORDER.length) throw new Error(`start: ${bots} bots requested, only ${BOT_FILL_ORDER.length} kinds exist`);
        const { n: seated } = q.familyCount.get(lakeId) as { n: number };
        const newBots: { familyId: number; seat: number; name: string; bot: BotKind }[] = [];
        for (let i = 0; i < bots; i++) {
          const kind = BOT_FILL_ORDER[i];
          const name = BOT_NAMES[kind];
          const seat = seated + i;
          const familyId = Number(
            (q.insertFamily.get(lakeId, seat, name, nameKey(name), null, kind) as { id: number }).id,
          );
          newBots.push({ familyId, seat, name, bot: kind });
        }
        const families = (q.familiesOf.all(lakeId) as { id: number; seat: number; name: string; bot: string | null }[]).map((f) => ({
          seat: f.seat,
          name: f.name,
          bot: f.bot !== null,
        }));
        const total = seated + bots;
        const lake = q.lakeById.get(lakeId) as unknown as DbLake;
        const row = insertRow(lakeId, startedAt, 0, "start", null, {
          families,
          capacity: CAP_PER_FAMILY * total,
          model: lake.model,
          secretHash: lake.secret_hash,
          startedAt,
        }, null);
        return { row, bots: newBots };
      });
    },

    append(lakeId, step, rows) {
      return tx(() => {
        const at = now();
        return rows.map((r) => writeRow(lakeId, at, step, r));
      });
    },

    appendStep(lakeId, step, build) {
      return tx(() => {
        const at = now();
        return build((r) => writeRow(lakeId, at, step, r));
      });
    },

    rowsAfter(lakeId, afterId, limit) {
      return (q.rowsAfter.all(lakeId, afterId, limit) as unknown as DbLedgerRow[]).map(toRow);
    },

    allRows(lakeId) {
      return (q.allRows.all(lakeId) as unknown as DbLedgerRow[]).map(toRow);
    },

    throwByKey(familyId, key) {
      const row = q.throwByKey.get(familyId, key) as unknown as DbLedgerRow | undefined;
      return row ? toRow(row) : null;
    },

    liveLakes() {
      return (q.liveLakes.all() as { id: number; code: string }[]).map((r) => ({ lakeId: r.id, code: r.code }));
    },

    pastLakes(limit = 50) {
      return (q.pastLakes.all(limit) as { id: number; code: string; opened_at: number }[]).map((r) => ({
        lakeId: r.id,
        code: r.code,
        openedAt: r.opened_at,
      }));
    },

    close() {
      db.close();
    },
  };
}
