import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface SqliteUserRow {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  recoveryHash: string;
  avatarId: string;
  friends: string[];
  totalRuns: number;
  bestScore: number;
  bestDistance: number;
  createdAt: string;
}

export interface SqliteRunRow {
  id: string;
  userId: string;
  playerName: string;
  avatarId: string;
  characterId: string;
  districtId: string;
  mode: string;
  score: number;
  distance: number;
  durationSec: number;
  maxSpeedKmh: number;
  maxCombo: number;
  bossDefeatedId: string | null;
  victory: boolean;
  createdAt: string;
  timestampMs: number;
  verified: boolean;
}

const DEFAULT_DATA_DIR =
  process.env.METRO_RUSH_DATA_DIR ||
  path.join(os.homedir(), '.metro-rush-neon-city');
const DB_FILE_PATH = path.join(DEFAULT_DATA_DIR, 'userdata.db');
const BACKUP_DIR_PATH = path.join(DEFAULT_DATA_DIR, 'backups');

fs.mkdirSync(DEFAULT_DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR_PATH, { recursive: true });

export const sqliteDb = new DatabaseSync(DB_FILE_PATH);

sqliteDb.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    recovery_hash TEXT NOT NULL,
    avatar_id TEXT NOT NULL DEFAULT 'kai',
    friends_json TEXT NOT NULL DEFAULT '[]',
    total_runs INTEGER NOT NULL DEFAULT 0,
    best_score INTEGER NOT NULL DEFAULT 0,
    best_distance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS player_saves (
    user_id TEXT PRIMARY KEY,
    save_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    avatar_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    district_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    distance INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    max_speed_kmh INTEGER NOT NULL,
    max_combo INTEGER NOT NULL,
    boss_defeated_id TEXT,
    victory INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    verified INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_runs_score ON runs(score DESC);
  CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id, timestamp_ms DESC);

  CREATE TABLE IF NOT EXISTS used_run_ids (
    run_id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mp_matches (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    district_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    results_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export function hashSecret(secret: string, salt: string): string {
  return crypto.scryptSync(secret, salt, 64).toString('hex');
}

function rowToUser(row: Record<string, unknown>): SqliteUserRow {
  let friends: string[] = [];
  try {
    friends = JSON.parse(String(row.friends_json || '[]')) as string[];
  } catch {
    friends = [];
  }
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    salt: String(row.salt),
    recoveryHash: String(row.recovery_hash),
    avatarId: String(row.avatar_id || 'kai'),
    friends,
    totalRuns: Number(row.total_runs || 0),
    bestScore: Number(row.best_score || 0),
    bestDistance: Number(row.best_distance || 0),
    createdAt: String(row.created_at),
  };
}

function rowToRun(row: Record<string, unknown>): SqliteRunRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    playerName: String(row.player_name),
    avatarId: String(row.avatar_id),
    characterId: String(row.character_id),
    districtId: String(row.district_id),
    mode: String(row.mode),
    score: Number(row.score),
    distance: Number(row.distance),
    durationSec: Number(row.duration_sec),
    maxSpeedKmh: Number(row.max_speed_kmh),
    maxCombo: Number(row.max_combo),
    bossDefeatedId: row.boss_defeated_id ? String(row.boss_defeated_id) : null,
    victory: Boolean(row.victory),
    createdAt: String(row.created_at),
    timestampMs: Number(row.timestamp_ms),
    verified: Boolean(row.verified),
  };
}

export function findUserById(id: string): SqliteUserRow | null {
  const row = sqliteDb
    .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserByIdentifier(identifier: string): SqliteUserRow | null {
  const clean = identifier.trim();
  const row = sqliteDb
    .prepare('SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?) LIMIT 1')
    .get(clean, clean) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function createUserAccount(params: {
  username: string;
  email: string;
  password: string;
  avatarId: string;
}): { user: SqliteUserRow; recoveryCode: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashSecret(params.password, salt);
  const recoveryCode = `MR-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const recoveryHash = hashSecret(recoveryCode, salt);
  const id = `usr_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  sqliteDb
    .prepare(
      `INSERT INTO users (id, username, email, password_hash, salt, recovery_hash, avatar_id, friends_json, total_runs, best_score, best_distance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 0, 0, 0, ?)`,
    )
    .run(id, params.username, params.email, passwordHash, salt, recoveryHash, params.avatarId, createdAt);

  return {
    user: findUserById(id)!,
    recoveryCode,
  };
}

export function recoverUserPassword(params: {
  identifier: string;
  recoveryCode: string;
  newPassword: string;
}): { ok: boolean; error?: string } {
  const user = findUserByIdentifier(params.identifier);
  if (!user) {
    return { ok: false, error: 'Cuenta no encontrada.' };
  }
  const candidate = hashSecret(params.recoveryCode.trim().toUpperCase(), user.salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.recoveryHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Código de recuperación incorrecto.' };
  }
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashSecret(params.newPassword, newSalt);
  const newRecoveryCodeHash = hashSecret(params.recoveryCode.trim().toUpperCase(), newSalt);
  sqliteDb
    .prepare('UPDATE users SET password_hash = ?, salt = ?, recovery_hash = ? WHERE id = ?')
    .run(newHash, newSalt, newRecoveryCodeHash, user.id);
  return { ok: true };
}

export function updateUserAvatar(userId: string, avatarId: string): SqliteUserRow | null {
  sqliteDb.prepare('UPDATE users SET avatar_id = ? WHERE id = ?').run(avatarId, userId);
  return findUserById(userId);
}

export function addUserFriend(userId: string, friendUsername: string): { ok: boolean; user?: SqliteUserRow; error?: string } {
  const user = findUserById(userId);
  if (!user) return { ok: false, error: 'Usuario no encontrado.' };
  const clean = friendUsername.trim();
  if (!clean || clean.toLowerCase() === user.username.toLowerCase()) {
    return { ok: false, error: 'Nombre de amigo inválido.' };
  }
  const nextFriends = user.friends.includes(clean)
    ? user.friends
    : [...user.friends, clean];
  sqliteDb
    .prepare('UPDATE users SET friends_json = ? WHERE id = ?')
    .run(JSON.stringify(nextFriends), userId);
  return { ok: true, user: findUserById(userId)! };
}

export function getPlayerSaveJson(userId: string): { saveJson: string | null; updatedAt: string | null } {
  const row = sqliteDb
    .prepare('SELECT save_json, updated_at FROM player_saves WHERE user_id = ? LIMIT 1')
    .get(userId) as { save_json: string; updated_at: string } | undefined;
  return row ? { saveJson: row.save_json, updatedAt: row.updated_at } : { saveJson: null, updatedAt: null };
}

export function upsertPlayerSaveJson(userId: string, saveObj: unknown): string {
  const updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(saveObj);
  sqliteDb
    .prepare(
      `INSERT INTO player_saves (user_id, save_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET save_json = excluded.save_json, updated_at = excluded.updated_at`,
    )
    .run(userId, serialized, updatedAt);
  return updatedAt;
}

export function isRunIdUsed(runId: string): boolean {
  const row = sqliteDb
    .prepare('SELECT run_id FROM used_run_ids WHERE run_id = ? LIMIT 1')
    .get(runId);
  return Boolean(row);
}

export function insertVerifiedRun(record: SqliteRunRow, runId: string): void {
  sqliteDb
    .prepare('INSERT INTO used_run_ids (run_id, created_at) VALUES (?, ?)')
    .run(runId, Date.now());
  sqliteDb
    .prepare(
      `INSERT INTO runs (
        id, user_id, player_name, avatar_id, character_id, district_id, mode,
        score, distance, duration_sec, max_speed_kmh, max_combo, boss_defeated_id,
        victory, created_at, timestamp_ms, verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.userId,
      record.playerName,
      record.avatarId,
      record.characterId,
      record.districtId,
      record.mode,
      record.score,
      record.distance,
      record.durationSec,
      record.maxSpeedKmh,
      record.maxCombo,
      record.bossDefeatedId,
      record.victory ? 1 : 0,
      record.createdAt,
      record.timestampMs,
      record.verified ? 1 : 0,
    );
  sqliteDb
    .prepare(
      `UPDATE users
       SET total_runs = total_runs + 1,
           best_score = MAX(best_score, ?),
           best_distance = MAX(best_distance, ?)
       WHERE id = ?`,
    )
    .run(record.score, record.distance, record.userId);
}

export function getUserRunHistory(userId: string, limit = 25): SqliteRunRow[] {
  const rows = sqliteDb
    .prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY timestamp_ms DESC LIMIT ?')
    .all(userId, limit) as Record<string, unknown>[];
  return rows.map(rowToRun);
}

export function queryRankings(params: {
  scope: string;
  districtId?: string;
  characterId?: string;
  friendUsernames?: string[];
  limit?: number;
}): SqliteRunRow[] {
  const limit = Math.min(50, Math.max(1, params.limit ?? 30));
  const now = Date.now();
  let rows: Record<string, unknown>[] = [];

  if (params.scope === 'city' && params.districtId) {
    rows = sqliteDb
      .prepare('SELECT * FROM runs WHERE district_id = ? ORDER BY score DESC LIMIT ?')
      .all(params.districtId, limit) as Record<string, unknown>[];
  } else if (params.scope === 'character' && params.characterId) {
    rows = sqliteDb
      .prepare('SELECT * FROM runs WHERE character_id = ? ORDER BY score DESC LIMIT ?')
      .all(params.characterId, limit) as Record<string, unknown>[];
  } else if (params.scope === 'weekly') {
    rows = sqliteDb
      .prepare('SELECT * FROM runs WHERE timestamp_ms >= ? ORDER BY score DESC LIMIT ?')
      .all(now - 7 * 86400_000, limit) as Record<string, unknown>[];
  } else if (params.scope === 'monthly') {
    rows = sqliteDb
      .prepare('SELECT * FROM runs WHERE timestamp_ms >= ? ORDER BY score DESC LIMIT ?')
      .all(now - 30 * 86400_000, limit) as Record<string, unknown>[];
  } else if (params.scope === 'friends') {
    const names = params.friendUsernames ?? [];
    if (names.length === 0) return [];
    const placeholders = names.map(() => '?').join(', ');
    rows = sqliteDb
      .prepare(`SELECT * FROM runs WHERE player_name IN (${placeholders}) ORDER BY score DESC LIMIT ?`)
      .all(...names, limit) as Record<string, unknown>[];
  } else {
    rows = sqliteDb
      .prepare('SELECT * FROM runs ORDER BY score DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
  }

  return rows.map(rowToRun);
}

export function recordMultiplayerMatch(params: {
  roomCode: string;
  districtId: string;
  mode: string;
  results: unknown[];
}): void {
  sqliteDb
    .prepare(
      'INSERT INTO mp_matches (id, room_code, district_id, mode, results_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      `mp_${crypto.randomUUID()}`,
      params.roomCode,
      params.districtId,
      params.mode,
      JSON.stringify(params.results),
      new Date().toISOString(),
    );
}

export function backupDatabaseSnapshot(label = 'auto'): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR_PATH, `userdata-${label}-${stamp}.db`);
  if (fs.existsSync(DB_FILE_PATH)) {
    fs.copyFileSync(DB_FILE_PATH, dest);
  }
  return dest;
}

export function cleanResetTestRankingsAndStats(userId?: string): { backupPath: string } {
  const backupPath = backupDatabaseSnapshot('pre-clean-reset');
  sqliteDb.exec('DELETE FROM runs; DELETE FROM used_run_ids; DELETE FROM mp_matches;');
  if (userId) {
    sqliteDb
      .prepare('UPDATE users SET total_runs = 0, best_score = 0, best_distance = 0 WHERE id = ?')
      .run(userId);
    sqliteDb.prepare('DELETE FROM player_saves WHERE user_id = ?').run(userId);
  } else {
    sqliteDb.exec('UPDATE users SET total_runs = 0, best_score = 0, best_distance = 0; DELETE FROM player_saves;');
  }
  return { backupPath };
}

export function getDatabaseDiagnostics(): {
  dbPath: string;
  backupDir: string;
  userCount: number;
  runCount: number;
  mpMatchCount: number;
  sizeBytes: number;
} {
  const userCount = Number(
    (sqliteDb.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
  );
  const runCount = Number(
    (sqliteDb.prepare('SELECT COUNT(*) as c FROM runs').get() as { c: number }).c,
  );
  const mpMatchCount = Number(
    (sqliteDb.prepare('SELECT COUNT(*) as c FROM mp_matches').get() as { c: number }).c,
  );
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(DB_FILE_PATH).size;
  } catch {
    sizeBytes = 0;
  }
  return {
    dbPath: DB_FILE_PATH,
    backupDir: BACKUP_DIR_PATH,
    userCount,
    runCount,
    mpMatchCount,
    sizeBytes,
  };
}
