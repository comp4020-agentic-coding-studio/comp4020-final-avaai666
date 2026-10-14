// The boat game's store (experimental; docs/boats/RULES.md): rooms, players,
// matches, and every input a match applied, in the same SQLite file as the
// ponds and lakes (its own connection, WAL, busy_timeout as store.ts). The
// inputs are append-only: a match is its seed plus its inputs, so it can be
// replayed (boat-sim.ts replay) and checked against its stored results.
import { randomBytes, randomInt } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { NAME_MAX_GRAPHEMES } from "./constants.ts";
import { BOAT_BOT_NAMES, BOAT_MAX_PLAYERS } from "./game-constants.ts";
import type { BotKind, Input, Result } from "./boat-sim.ts";

export type Clock = () => number;
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export { BOAT_MAX_PLAYERS };
export const BOT_NAMES = BOAT_BOT_NAMES;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS boat_rooms (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS boat_players (
  id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES boat_rooms(id),
  seat INTEGER NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, token TEXT NOT NULL UNIQUE, joined_at INTEGER NOT NULL,
  UNIQUE (room_id, seat), UNIQUE (room_id, name_key)
);
CREATE TABLE IF NOT EXISTS boat_matches (
  id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES boat_rooms(id),
  model TEXT NOT NULL, mode TEXT NOT NULL, seed TEXT NOT NULL, seats TEXT NOT NULL,
  started_at INTEGER NOT NULL, ended_at INTEGER, status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'done', 'interrupted')),
  results TEXT
);
CREATE TABLE IF NOT EXISTS boat_inputs (
  id INTEGER PRIMARY KEY, match_id INTEGER NOT NULL REFERENCES boat_matches(id),
  tick INTEGER NOT NULL, seat INTEGER NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('steer', 'cast', 'dash')),
  x INTEGER, y INTEGER
);
CREATE INDEX IF NOT EXISTS boat_inputs_match ON boat_inputs (match_id, id);
CREATE TRIGGER IF NOT EXISTS boat_inputs_no_update BEFORE UPDATE ON boat_inputs BEGIN SELECT RAISE(ABORT, 'boat_inputs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS boat_inputs_no_delete BEFORE DELETE ON boat_inputs BEGIN SELECT RAISE(ABORT, 'boat_inputs is append-only'); END;
`;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// The same name rules as the lakes (lake-store.ts cleanName).
function cleanName(raw: string): string | null {
  const name = raw.trim().normalize("NFC");
  if (/\p{Cc}|(?!‍)\p{Cf}/u.test(name)) return null;
  const length = [...graphemes.segment(name)].length;
  return length >= 1 && length <= NAME_MAX_GRAPHEMES ? name : null;
}
const nameKey = (name: string): string => name.normalize("NFKC").toLowerCase();
const BOT_KEYS = new Set(Object.values(BOT_NAMES).map(nameKey));

export interface SeatInfo { seat: number; name: string; bot: BotKind | null }
export interface MatchRow { id: number; roomId: number; model: string; mode: string; seed: string; seats: SeatInfo[]; startedAt: number; endedAt: number | null; status: string; results: Result[] | null }
export type BoatJoin = { ok: true; seat: number; token: string } | { ok: false; reason: "bad_name" | "name_taken" | "bot_name" | "full" | "no_room" };

export interface BoatStore {
  createRoom(): { id: number; code: string };
  roomByCode(code: string): { id: number; code: string; createdAt: number } | null;
  join(roomId: number, rawName: string): BoatJoin;
  playerByToken(token: string): { roomId: number; seat: number; name: string } | null;
  players(roomId: number): { seat: number; name: string }[];
  startMatch(roomId: number, model: string, mode: string, seed: string, seats: SeatInfo[], startedAt: number): number;
  logInputs(matchId: number, tick: number, inputs: Input[]): void;
  endMatch(matchId: number, endedAt: number, status: "done" | "interrupted", results: Result[] | null): void;
  match(matchId: number): MatchRow | null;
  lastMatch(roomId: number): MatchRow | null;
  runningMatches(): MatchRow[];
  inputsOf(matchId: number): Map<number, Input[]>;
  close(): void;
}

export function openBoatStore(file: string, now: Clock): BoatStore {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec("BEGIN IMMEDIATE");
  db.exec(SCHEMA);
  db.exec("COMMIT");
  const tx = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  const q = {
    room: db.prepare("SELECT id, code, created_at AS createdAt FROM boat_rooms WHERE code = ?"),
    roomCode: db.prepare("SELECT 1 FROM boat_rooms WHERE code = ?"),
    insRoom: db.prepare("INSERT INTO boat_rooms (code, created_at) VALUES (?, ?)"),
    players: db.prepare("SELECT seat, name FROM boat_players WHERE room_id = ? ORDER BY seat"),
    nameUsed: db.prepare("SELECT 1 FROM boat_players WHERE room_id = ? AND name_key = ?"),
    insPlayer: db.prepare("INSERT INTO boat_players (room_id, seat, name, name_key, token, joined_at) VALUES (?, ?, ?, ?, ?, ?)"),
    byToken: db.prepare("SELECT room_id AS roomId, seat, name FROM boat_players WHERE token = ?"),
    insMatch: db.prepare("INSERT INTO boat_matches (room_id, model, mode, seed, seats, started_at) VALUES (?, ?, ?, ?, ?, ?)"),
    insInput: db.prepare("INSERT INTO boat_inputs (match_id, tick, seat, kind, x, y) VALUES (?, ?, ?, ?, ?, ?)"),
    endMatch: db.prepare("UPDATE boat_matches SET ended_at = ?, status = ?, results = ? WHERE id = ? AND status = 'running'"),
    match: db.prepare("SELECT * FROM boat_matches WHERE id = ?"),
    last: db.prepare("SELECT * FROM boat_matches WHERE room_id = ? ORDER BY id DESC LIMIT 1"),
    running: db.prepare("SELECT * FROM boat_matches WHERE status = 'running'"),
    inputs: db.prepare("SELECT tick, seat, kind, x, y FROM boat_inputs WHERE match_id = ? ORDER BY id"),
  };
  const toMatch = (r: Record<string, unknown> | undefined): MatchRow | null =>
    r ? { id: r.id as number, roomId: r.room_id as number, model: r.model as string, mode: r.mode as string, seed: r.seed as string, seats: JSON.parse(r.seats as string), startedAt: r.started_at as number, endedAt: (r.ended_at as number) ?? null, status: r.status as string, results: r.results ? JSON.parse(r.results as string) : null } : null;

  return {
    createRoom() {
      return tx(() => {
        for (let tries = 0; tries < 50; tries++) {
          let code = "";
          for (let i = 0; i < 4; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
          if (q.roomCode.get(code)) continue;
          const r = q.insRoom.run(code, now());
          return { id: Number(r.lastInsertRowid), code };
        }
        throw new Error("no free room code");
      });
    },
    roomByCode(code) {
      return (q.room.get(code) as { id: number; code: string; createdAt: number } | undefined) ?? null;
    },
    join(roomId, rawName) {
      const name = cleanName(rawName);
      if (name === null) return { ok: false, reason: "bad_name" };
      const key = nameKey(name);
      if (BOT_KEYS.has(key)) return { ok: false, reason: "bot_name" };
      return tx(() => {
        if (q.nameUsed.get(roomId, key)) return { ok: false as const, reason: "name_taken" as const };
        const seats = (q.players.all(roomId) as { seat: number }[]).map((p) => p.seat);
        if (seats.length >= BOAT_MAX_PLAYERS) return { ok: false as const, reason: "full" as const };
        let seat = 0; while (seats.includes(seat)) seat++;
        const token = randomBytes(16).toString("base64url");
        q.insPlayer.run(roomId, seat, name, key, token, now());
        return { ok: true as const, seat, token };
      });
    },
    playerByToken(token) {
      return (q.byToken.get(token) as { roomId: number; seat: number; name: string } | undefined) ?? null;
    },
    players(roomId) {
      return q.players.all(roomId) as { seat: number; name: string }[];
    },
    startMatch(roomId, model, mode, seed, seats, startedAt) {
      return tx(() => Number(q.insMatch.run(roomId, model, mode, seed, JSON.stringify(seats), startedAt).lastInsertRowid));
    },
    logInputs(matchId, tick, inputs) {
      if (!inputs.length) return;
      tx(() => { for (const i of inputs) q.insInput.run(matchId, tick, i.seat, i.kind, i.x ?? null, i.y ?? null); });
    },
    endMatch(matchId, endedAt, status, results) {
      tx(() => q.endMatch.run(endedAt, status, results ? JSON.stringify(results) : null, matchId));
    },
    match: (id) => toMatch(q.match.get(id) as Record<string, unknown> | undefined),
    lastMatch: (roomId) => toMatch(q.last.get(roomId) as Record<string, unknown> | undefined),
    runningMatches: () => (q.running.all() as Record<string, unknown>[]).map((r) => toMatch(r)!),
    inputsOf(matchId) {
      const m = new Map<number, Input[]>();
      for (const r of q.inputs.all(matchId) as { tick: number; seat: number; kind: Input["kind"]; x: number | null; y: number | null }[]) {
        if (!m.has(r.tick)) m.set(r.tick, []);
        m.get(r.tick)!.push(r.kind === "steer" ? { seat: r.seat, kind: r.kind, x: r.x!, y: r.y! } : { seat: r.seat, kind: r.kind });
      }
      return m;
    },
    close: () => db.close(),
  };
}
