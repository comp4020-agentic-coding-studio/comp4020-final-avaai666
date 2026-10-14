// The /play store (DESIGN.md "The platform"): rooms, players, matches, and
// every input a match applied (people's and bots'), in the same SQLite file
// as the ponds, lakes and boats (its own connection, WAL, busy_timeout as
// boat-store.ts). game_inputs is append-only. The status, summary and end
// time of a match are written once, when it ends (DESIGN.md v2.4 a).
import { randomBytes, randomInt } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { NAME_MAX_GRAPHEMES } from "./constants.ts";
import { LAKE_FULL, PLAY_CHARACTERS, PLAY_MAX_SEATS } from "./game-constants.ts";
import type { Character, Results, Seat } from "./game-platform.ts";

export type Clock = () => number;
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS game_rooms (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, mode TEXT NOT NULL, lake_fish INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS game_players (
  id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES game_rooms(id),
  seat INTEGER NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, character TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE, joined_at INTEGER NOT NULL,
  UNIQUE (room_id, seat), UNIQUE (room_id, name_key)
);
CREATE TABLE IF NOT EXISTS game_matches (
  id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES game_rooms(id),
  mode TEXT NOT NULL, model TEXT NOT NULL, seed TEXT NOT NULL, seats TEXT NOT NULL, lake_before INTEGER NOT NULL,
  started_at INTEGER NOT NULL, rematch_by TEXT, ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'interrupted')),
  summary TEXT
);
CREATE TABLE IF NOT EXISTS game_inputs (
  id INTEGER PRIMARY KEY, match_id INTEGER NOT NULL REFERENCES game_matches(id),
  tick INTEGER NOT NULL, seat INTEGER NOT NULL, input TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS game_inputs_match ON game_inputs (match_id, id);
CREATE TRIGGER IF NOT EXISTS game_inputs_no_update BEFORE UPDATE ON game_inputs BEGIN SELECT RAISE(ABORT, 'game_inputs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS game_inputs_no_delete BEFORE DELETE ON game_inputs BEGIN SELECT RAISE(ABORT, 'game_inputs is append-only'); END;
`;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// The same name rules as the lakes and boats.
function cleanName(raw: string): string | null {
  const name = raw.trim().normalize("NFC");
  if (/\p{Cc}|(?!‍)\p{Cf}/u.test(name)) return null;
  const length = [...graphemes.segment(name)].length;
  return length >= 1 && length <= NAME_MAX_GRAPHEMES ? name : null;
}
const nameKey = (name: string): string => name.normalize("NFKC").toLowerCase();
// "(bot)" marks a bot; no person may take a name that looks like one.
const looksLikeBot = (key: string): boolean => /\(\s*bot\s*\)|\bbot$/.test(key);

export interface SeatSummary { seat: number; name: string; bot: boolean; character: Character; inputs: Record<string, number>; firstScoreS: number | null; score: number; place: number }
export interface Summary { mode: string; model: string; durationS: number; lakeBefore: number; lakeAfter: number; rematchBy: string | null; seats: SeatSummary[]; highlights: Results["highlights"]; extra?: Record<string, unknown> }
export interface MatchRow { id: number; roomId: number; mode: string; model: string; seed: string; seats: Seat[]; lakeBefore: number; startedAt: number; rematchBy: string | null; endedAt: number | null; status: string; summary: Summary | null }
export type GameJoin = { ok: true; seat: number; token: string } | { ok: false; reason: "bad_name" | "name_taken" | "bot_name" | "bad_character" | "full" | "no_room" };
export interface RoomRow { id: number; code: string; mode: string; lakeFish: number; createdAt: number }

export interface GameStore {
  createRoom(mode: string): { id: number; code: string };
  roomByCode(code: string): RoomRow | null;
  setMode(roomId: number, mode: string): void;
  join(roomId: number, rawName: string, character: string, maxSeats: number): GameJoin;
  playerByToken(token: string): { roomId: number; seat: number; name: string } | null;
  players(roomId: number): { seat: number; name: string; character: Character }[];
  startMatch(roomId: number, mode: string, model: string, seed: string, seats: Seat[], lakeBefore: number, startedAt: number, rematchBy: string | null): number;
  logInputs(matchId: number, tick: number, inputs: { seat: number; i: unknown }[]): void;
  endMatch(matchId: number, endedAt: number, status: "done" | "interrupted", summary: Summary | null, lakeFish: number | null): void;
  match(matchId: number): MatchRow | null;
  lastMatch(roomId: number): MatchRow | null;
  matches(roomId: number): MatchRow[];
  runningMatches(): MatchRow[];
  inputsOf(matchId: number): Map<number, { seat: number; i: unknown }[]>;
  close(): void;
}

export function openGameStore(file: string, now: Clock): GameStore {
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
    room: db.prepare("SELECT id, code, mode, lake_fish AS lakeFish, created_at AS createdAt FROM game_rooms WHERE code = ?"),
    roomCode: db.prepare("SELECT 1 FROM game_rooms WHERE code = ?"),
    insRoom: db.prepare("INSERT INTO game_rooms (code, mode, lake_fish, created_at) VALUES (?, ?, ?, ?)"),
    setMode: db.prepare("UPDATE game_rooms SET mode = ? WHERE id = ?"),
    setLake: db.prepare("UPDATE game_rooms SET lake_fish = ? WHERE id = ?"),
    players: db.prepare("SELECT seat, name, character FROM game_players WHERE room_id = ? ORDER BY seat"),
    nameUsed: db.prepare("SELECT 1 FROM game_players WHERE room_id = ? AND name_key = ?"),
    insPlayer: db.prepare("INSERT INTO game_players (room_id, seat, name, name_key, character, token, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    byToken: db.prepare("SELECT room_id AS roomId, seat, name FROM game_players WHERE token = ?"),
    insMatch: db.prepare("INSERT INTO game_matches (room_id, mode, model, seed, seats, lake_before, started_at, rematch_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    insInput: db.prepare("INSERT INTO game_inputs (match_id, tick, seat, input) VALUES (?, ?, ?, ?)"),
    endMatch: db.prepare("UPDATE game_matches SET ended_at = ?, status = ?, summary = ? WHERE id = ? AND status = 'running'"),
    match: db.prepare("SELECT * FROM game_matches WHERE id = ?"),
    last: db.prepare("SELECT * FROM game_matches WHERE room_id = ? ORDER BY id DESC LIMIT 1"),
    all: db.prepare("SELECT * FROM game_matches WHERE room_id = ? ORDER BY id"),
    running: db.prepare("SELECT * FROM game_matches WHERE status = 'running'"),
    inputs: db.prepare("SELECT tick, seat, input FROM game_inputs WHERE match_id = ? ORDER BY id"),
  };
  const toMatch = (r: Record<string, unknown> | undefined): MatchRow | null =>
    r ? {
      id: r.id as number, roomId: r.room_id as number, mode: r.mode as string, model: r.model as string, seed: r.seed as string,
      seats: JSON.parse(r.seats as string), lakeBefore: r.lake_before as number, startedAt: r.started_at as number,
      rematchBy: (r.rematch_by as string) ?? null, endedAt: (r.ended_at as number) ?? null, status: r.status as string,
      summary: r.summary ? JSON.parse(r.summary as string) : null,
    } : null;

  return {
    createRoom(mode) {
      return tx(() => {
        for (let tries = 0; tries < 50; tries++) {
          let code = "";
          for (let i = 0; i < 4; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
          if (q.roomCode.get(code)) continue;
          const r = q.insRoom.run(code, mode, LAKE_FULL, now());
          return { id: Number(r.lastInsertRowid), code };
        }
        throw new Error("no free room code");
      });
    },
    roomByCode: (code) => (q.room.get(code) as RoomRow | undefined) ?? null,
    setMode(roomId, mode) { tx(() => q.setMode.run(mode, roomId)); },
    join(roomId, rawName, character, maxSeats) {
      const name = cleanName(rawName);
      if (name === null) return { ok: false, reason: "bad_name" };
      const key = nameKey(name);
      if (looksLikeBot(key)) return { ok: false, reason: "bot_name" };
      if (!(PLAY_CHARACTERS as readonly string[]).includes(character)) return { ok: false, reason: "bad_character" };
      return tx(() => {
        if (q.nameUsed.get(roomId, key)) return { ok: false as const, reason: "name_taken" as const };
        const seats = (q.players.all(roomId) as { seat: number }[]).map((p) => p.seat);
        if (seats.length >= Math.min(maxSeats, PLAY_MAX_SEATS)) return { ok: false as const, reason: "full" as const };
        let seat = 0; while (seats.includes(seat)) seat++;
        const token = randomBytes(16).toString("base64url");
        q.insPlayer.run(roomId, seat, name, key, character, token, now());
        return { ok: true as const, seat, token };
      });
    },
    playerByToken: (token) => (q.byToken.get(token) as { roomId: number; seat: number; name: string } | undefined) ?? null,
    players: (roomId) => q.players.all(roomId) as { seat: number; name: string; character: Character }[],
    startMatch(roomId, mode, model, seed, seats, lakeBefore, startedAt, rematchBy) {
      return tx(() => Number(q.insMatch.run(roomId, mode, model, seed, JSON.stringify(seats), lakeBefore, startedAt, rematchBy).lastInsertRowid));
    },
    logInputs(matchId, tick, inputs) {
      if (!inputs.length) return;
      tx(() => { for (const x of inputs) q.insInput.run(matchId, tick, x.seat, JSON.stringify(x.i)); });
    },
    endMatch(matchId, endedAt, status, summary, lakeFish) {
      tx(() => {
        const r = q.endMatch.run(endedAt, status, summary ? JSON.stringify(summary) : null, matchId);
        if (Number(r.changes) && lakeFish !== null) { const m = toMatch(q.match.get(matchId) as Record<string, unknown>)!; q.setLake.run(lakeFish, m.roomId); }
      });
    },
    match: (id) => toMatch(q.match.get(id) as Record<string, unknown> | undefined),
    lastMatch: (roomId) => toMatch(q.last.get(roomId) as Record<string, unknown> | undefined),
    matches: (roomId) => (q.all.all(roomId) as Record<string, unknown>[]).map((r) => toMatch(r)!),
    runningMatches: () => (q.running.all() as Record<string, unknown>[]).map((r) => toMatch(r)!),
    inputsOf(matchId) {
      const m = new Map<number, { seat: number; i: unknown }[]>();
      for (const r of q.inputs.all(matchId) as { tick: number; seat: number; input: string }[]) {
        if (!m.has(r.tick)) m.set(r.tick, []);
        m.get(r.tick)!.push({ seat: r.seat, i: JSON.parse(r.input) });
      }
      return m;
    },
    close: () => db.close(),
  };
}
