import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

export interface SqliteUserRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  salt: string;
  recoveryHash: string;
  avatarId: string;
  friends: string[];
  totalRuns: number;
  bestScore: number;
  bestDistance: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface AuthSessionRow {
  id: string;
  userId: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAtMs: number;
  revokedAt: string | null;
}

export interface RoomInvitationRow {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  roomCode: string;
  districtId: string;
  mode: string;
  targetWsUrl: string;
  status: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  expiresAtMs: number;
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

export interface LocalProfileRow {
  id: string;
  name: string;
  avatarId: string;
  saveJson: string;
  linkedOnlineUserId: string | null;
  linkedOnlineUsername: string | null;
  lastLinkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function resolveDataDir(): string {
  return (
    process.env.METRO_RUSH_DATA_DIR ||
    path.join(os.homedir(), '.metro-rush-neon-city')
  );
}

export function getDataDirectoryPaths(): {
  dataDir: string;
  dbFilePath: string;
  backupDirPath: string;
} {
  const dataDir = resolveDataDir();
  return {
    dataDir,
    dbFilePath: path.join(dataDir, 'userdata.db'),
    backupDirPath: path.join(dataDir, 'backups'),
  };
}

interface PreparedStmt {
  run: (...params: unknown[]) => void;
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
}

interface SqlEngineAdapter {
  engineName: 'node:sqlite' | 'sql.js';
  exec: (sql: string) => void;
  prepare: (sql: string) => PreparedStmt;
  close: () => void;
}

let activeEngine: SqlEngineAdapter | null = null;
let initializedDataDir: string | null = null;
let initPromise: Promise<void> | null = null;

function createNodeSqliteAdapter(dbFilePath: string): SqlEngineAdapter | null {
  if (process.env.METRO_RUSH_SQL_ENGINE === 'sqljs') {
    return null;
  }
  try {
    const req =
      typeof require === 'function'
        ? require
        : createRequire(import.meta.url);
    const mod = req('node:sqlite') as {
      DatabaseSync: new (path: string) => {
        exec: (sql: string) => void;
        prepare: (sql: string) => PreparedStmt;
        close: () => void;
      };
    };
    const db = new mod.DatabaseSync(dbFilePath);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    return {
      engineName: 'node:sqlite',
      exec: (sql) => db.exec(sql),
      prepare: (sql) => db.prepare(sql),
      close: () => db.close(),
    };
  } catch {
    return null;
  }
}

function resolveSqlJsWasmPath(file: string): string {
  const candidates = [
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, file) : '',
    path.resolve(process.cwd(), 'dist-electron', file),
    path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    typeof process.resourcesPath === 'string'
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', file)
      : '',
    typeof process.resourcesPath === 'string'
      ? path.join(process.resourcesPath, 'dist-electron', file)
      : '',
    typeof process.resourcesPath === 'string'
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', file)
      : '',
  ].filter(Boolean);

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
}

async function createSqlJsAdapter(dbFilePath: string): Promise<SqlEngineAdapter> {
  const initSqlJsModule = (await import('sql.js')).default;
  const SQL = await initSqlJsModule({
    locateFile: (file: string) => resolveSqlJsWasmPath(file),
  });
  const initialBytes = fs.existsSync(dbFilePath)
    ? fs.readFileSync(dbFilePath)
    : null;
  const db = new SQL.Database(initialBytes);

  const flushAtomic = () => {
    const data = Buffer.from(db.export());
    const tmpPath = `${dbFilePath}.tmp`;
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, dbFilePath);
  };

  return {
    engineName: 'sql.js',
    exec: (sql: string) => {
      db.exec(sql);
      if (/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)\b/i.test(sql)) {
        flushAtomic();
      }
    },
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        const stmt = db.prepare(sql);
        try {
          stmt.bind(params);
          while (stmt.step()) {
            // drain
          }
        } finally {
          stmt.free();
        }
        flushAtomic();
      },
      get: (...params: unknown[]) => {
        const stmt = db.prepare(sql);
        try {
          stmt.bind(params);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all: (...params: unknown[]) => {
        const out: Record<string, unknown>[] = [];
        const stmt = db.prepare(sql);
        try {
          stmt.bind(params);
          while (stmt.step()) {
            out.push(stmt.getAsObject());
          }
          return out;
        } finally {
          stmt.free();
        }
      },
    }),
    close: () => {
      flushAtomic();
      db.close();
    },
  };
}

const CURRENT_SCHEMA_VERSION = 4;

export interface FriendRequestRow {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  serverKey: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function runMigrations(adapter: SqlEngineAdapter, dbFilePath: string, backupDirPath: string): void {
  adapter.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const row = adapter
    .prepare('SELECT version FROM schema_version WHERE id = 1 LIMIT 1')
    .get() as { version?: number } | undefined;
  let curVersion = Number(row?.version ?? 0);

  if (curVersion > 0 && curVersion < CURRENT_SCHEMA_VERSION && fs.existsSync(dbFilePath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(
      backupDirPath,
      `userdata-pre-migration-v${CURRENT_SCHEMA_VERSION}-${stamp}.db`,
    );
    fs.copyFileSync(dbFilePath, dest);
  }

  if (curVersion < 1) {
    adapter.exec(`
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
    curVersion = 1;
  }

  if (curVersion < 2) {
    adapter.exec(`
      CREATE TABLE IF NOT EXISTS local_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_id TEXT NOT NULL DEFAULT 'kai',
        save_json TEXT NOT NULL,
        linked_online_user_id TEXT,
        linked_online_username TEXT,
        last_linked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS idempotent_tx (
        tx_id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_link_logs (
        id TEXT PRIMARY KEY,
        local_profile_id TEXT NOT NULL,
        online_user_id TEXT NOT NULL,
        strategy TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    curVersion = 2;
  }

  if (curVersion < 3) {
    const safeAlter = (sql: string) => {
      try {
        adapter.exec(sql);
      } catch {
        // Column may already exist on partial migrations
      }
    };
    safeAlter(`ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`);
    safeAlter(`ALTER TABLE users ADD COLUMN last_seen_at TEXT NOT NULL DEFAULT ''`);

    adapter.exec(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        device_label TEXT NOT NULL DEFAULT 'Metro Rush Desktop',
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, revoked_at);

      CREATE TABLE IF NOT EXISTS room_invitations (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        from_username TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        to_username TEXT NOT NULL,
        room_code TEXT NOT NULL,
        district_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        target_ws_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invitations_to ON room_invitations(to_user_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_invitations_from ON room_invitations(from_user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_invitations_room ON room_invitations(room_code, status);
    `);
    curVersion = 3;
  }

  if (curVersion < 4) {
    adapter.exec(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        from_username TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        to_username TEXT NOT NULL,
        server_key TEXT NOT NULL DEFAULT 'local',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_friend_req_to ON friend_requests(to_user_id, status);
      CREATE INDEX IF NOT EXISTS idx_friend_req_from ON friend_requests(from_user_id, status);

      DELETE FROM runs;
      DELETE FROM used_run_ids;
      DELETE FROM mp_matches;
      DELETE FROM player_saves;
      DELETE FROM local_profiles;
      DELETE FROM account_link_logs;
      DELETE FROM room_invitations;
      UPDATE users SET total_runs = 0, best_score = 0, best_distance = 0;
    `);
    curVersion = 4;
  }

  adapter
    .prepare(
      `INSERT INTO schema_version (id, version, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at`,
    )
    .run(curVersion, new Date().toISOString());
}

function ensureDirectories(): { dataDir: string; dbFilePath: string; backupDirPath: string } {
  const paths = getDataDirectoryPaths();
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(paths.backupDirPath, { recursive: true });
  return paths;
}

function getEngineSync(): SqlEngineAdapter {
  const paths = ensureDirectories();
  if (activeEngine && initializedDataDir === paths.dataDir) {
    return activeEngine;
  }
  const nodeAdapter = createNodeSqliteAdapter(paths.dbFilePath);
  if (!nodeAdapter) {
    throw new Error(
      'SQLite no inicializado. Llama a await initSqlite() antes de consultar en entornos sin node:sqlite.',
    );
  }
  if (activeEngine) {
    try {
      activeEngine.close();
    } catch {
      // Ignore close error
    }
  }
  runMigrations(nodeAdapter, paths.dbFilePath, paths.backupDirPath);
  activeEngine = nodeAdapter;
  initializedDataDir = paths.dataDir;
  return activeEngine;
}

export async function initSqlite(): Promise<'node:sqlite' | 'sql.js'> {
  const paths = ensureDirectories();
  if (activeEngine && initializedDataDir === paths.dataDir) {
    return activeEngine.engineName;
  }
  if (initPromise) {
    await initPromise;
    return activeEngine!.engineName;
  }
  initPromise = (async () => {
    const nodeAdapter = createNodeSqliteAdapter(paths.dbFilePath);
    const adapter = nodeAdapter ?? (await createSqlJsAdapter(paths.dbFilePath));
    runMigrations(adapter, paths.dbFilePath, paths.backupDirPath);
    if (activeEngine) {
      try {
        activeEngine.close();
      } catch {
        // Ignore close error
      }
    }
    activeEngine = adapter;
    initializedDataDir = paths.dataDir;
  })();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
  return activeEngine!.engineName;
}

export function closeSqlite(): void {
  if (activeEngine) {
    try {
      activeEngine.close();
    } catch {
      // Ignore close error
    }
    activeEngine = null;
    initializedDataDir = null;
  }
}

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
    displayName: String(row.display_name || row.username),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    salt: String(row.salt),
    recoveryHash: String(row.recovery_hash),
    avatarId: String(row.avatar_id || 'kai'),
    friends: Array.isArray(friends) ? friends : [],
    totalRuns: Number(row.total_runs || 0),
    bestScore: Number(row.best_score || 0),
    bestDistance: Number(row.best_distance || 0),
    lastSeenAt: String(row.last_seen_at || row.created_at || ''),
    createdAt: String(row.created_at),
  };
}

function rowToRun(row: Record<string, unknown>): SqliteRunRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    playerName: String(row.player_name),
    avatarId: String(row.avatar_id || 'kai'),
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

function rowToLocalProfile(row: Record<string, unknown>): LocalProfileRow {
  return {
    id: String(row.id),
    name: String(row.name),
    avatarId: String(row.avatar_id || 'kai'),
    saveJson: String(row.save_json),
    linkedOnlineUserId: row.linked_online_user_id ? String(row.linked_online_user_id) : null,
    linkedOnlineUsername: row.linked_online_username
      ? String(row.linked_online_username)
      : null,
    lastLinkedAt: row.last_linked_at ? String(row.last_linked_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function findUserById(id: string): SqliteUserRow | null {
  const row = getEngineSync()
    .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
    .get(id);
  return row ? rowToUser(row) : null;
}

export function findUserByIdentifier(identifier: string): SqliteUserRow | null {
  const clean = identifier.trim();
  const row = getEngineSync()
    .prepare('SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?) LIMIT 1')
    .get(clean, clean);
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

  const cleanUsername = params.username.trim();
  getEngineSync()
    .prepare(
      `INSERT INTO users (id, username, display_name, email, password_hash, salt, recovery_hash, avatar_id, friends_json, total_runs, best_score, best_distance, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, 0, 0, ?, ?)`,
    )
    .run(
      id,
      cleanUsername,
      cleanUsername,
      params.email,
      passwordHash,
      salt,
      recoveryHash,
      params.avatarId,
      createdAt,
      createdAt,
    );

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
  getEngineSync()
    .prepare('UPDATE users SET password_hash = ?, salt = ?, recovery_hash = ? WHERE id = ?')
    .run(newHash, newSalt, newRecoveryCodeHash, user.id);
  return { ok: true };
}

export function updateUserAvatar(userId: string, avatarId: string): SqliteUserRow | null {
  getEngineSync().prepare('UPDATE users SET avatar_id = ? WHERE id = ?').run(avatarId, userId);
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
  getEngineSync()
    .prepare('UPDATE users SET friends_json = ? WHERE id = ?')
    .run(JSON.stringify(nextFriends), userId);
  return { ok: true, user: findUserById(userId)! };
}

export function touchUserLastSeen(userId: string): void {
  try {
    getEngineSync()
      .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .run(new Date().toISOString(), userId);
  } catch {
    // Non-critical telemetry
  }
}

export function updateUserProfileDetails(
  userId: string,
  params: { displayName?: string; avatarId?: string },
): SqliteUserRow | null {
  const user = findUserById(userId);
  if (!user) return null;
  const nextDisplay = params.displayName?.trim() || user.displayName || user.username;
  const nextAvatar = params.avatarId?.trim() || user.avatarId;
  getEngineSync()
    .prepare('UPDATE users SET display_name = ?, avatar_id = ? WHERE id = ?')
    .run(nextDisplay.slice(0, 28), nextAvatar, userId);
  return findUserById(userId);
}

export function changeUserPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): { ok: boolean; error?: string } {
  const user = findUserById(params.userId);
  if (!user) return { ok: false, error: 'Cuenta no encontrada.' };
  const curCandidate = hashSecret(params.currentPassword, user.salt);
  const a = Buffer.from(curCandidate, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'La contraseña actual no es correcta.' };
  }
  if (params.newPassword.length < 6) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashSecret(params.newPassword, newSalt);
  const now = new Date().toISOString();
  getEngineSync()
    .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
    .run(newHash, newSalt, user.id);
  getEngineSync()
    .prepare('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .run(now, user.id);
  return { ok: true };
}

export function searchUsersByQuery(query: string, limit = 16): SqliteUserRow[] {
  const clean = query.trim();
  const db = getEngineSync();
  const safeLimit = Math.min(30, Math.max(1, limit));
  if (!clean) {
    const rows = db
      .prepare('SELECT * FROM users ORDER BY last_seen_at DESC, best_score DESC LIMIT ?')
      .all(safeLimit);
    return rows.map(rowToUser);
  }
  const pattern = `%${clean.toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT * FROM users
       WHERE lower(username) LIKE ? OR lower(display_name) LIKE ?
       ORDER BY
         CASE WHEN lower(username) = lower(?) THEN 0 ELSE 1 END,
         best_score DESC
       LIMIT ?`,
    )
    .all(pattern, pattern, clean, safeLimit);
  return rows.map(rowToUser);
}

/* ---------------- PERSISTENT REFRESH SESSIONS ---------------- */

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createAuthSession(params: {
  userId: string;
  deviceLabel?: string;
  ttlDays?: number;
}): { sessionId: string; refreshToken: string; expiresAtMs: number } {
  const sessionId = `ses_${crypto.randomUUID()}`;
  const refreshToken = `mr_rt_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashRefreshToken(refreshToken);
  const nowIso = new Date().toISOString();
  const ttlMs = Math.max(1, params.ttlDays ?? 30) * 86400_000;
  const expiresAtMs = Date.now() + ttlMs;
  getEngineSync()
    .prepare(
      `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, device_label, created_at, last_used_at, expires_at_ms, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(
      sessionId,
      params.userId,
      tokenHash,
      (params.deviceLabel || 'Metro Rush Desktop').slice(0, 80),
      nowIso,
      nowIso,
      expiresAtMs,
    );
  touchUserLastSeen(params.userId);
  return { sessionId, refreshToken, expiresAtMs };
}

export function verifyAndRotateRefreshSession(refreshToken: string): {
  ok: boolean;
  user?: SqliteUserRow;
  sessionId?: string;
  newRefreshToken?: string;
  expiresAtMs?: number;
  error?: string;
} {
  const tokenHash = hashRefreshToken(refreshToken.trim());
  const db = getEngineSync();
  const row = db
    .prepare('SELECT * FROM auth_sessions WHERE refresh_token_hash = ? LIMIT 1')
    .get(tokenHash) as Record<string, unknown> | undefined;
  if (!row) {
    return { ok: false, error: 'Sesión no encontrada.' };
  }
  if (row.revoked_at) {
    return { ok: false, error: 'Sesión revocada. Inicia sesión nuevamente.' };
  }
  if (Number(row.expires_at_ms) < Date.now()) {
    return { ok: false, error: 'Sesión expirada. Inicia sesión nuevamente.' };
  }
  const user = findUserById(String(row.user_id));
  if (!user) {
    return { ok: false, error: 'Usuario de sesión no existe.' };
  }
  const newRefreshToken = `mr_rt_${crypto.randomBytes(32).toString('hex')}`;
  const newHash = hashRefreshToken(newRefreshToken);
  const nowIso = new Date().toISOString();
  const nextExpires = Date.now() + 30 * 86400_000;
  db.prepare(
    `UPDATE auth_sessions
     SET refresh_token_hash = ?, last_used_at = ?, expires_at_ms = ?
     WHERE id = ?`,
  ).run(newHash, nowIso, nextExpires, String(row.id));
  touchUserLastSeen(user.id);
  return {
    ok: true,
    user,
    sessionId: String(row.id),
    newRefreshToken,
    expiresAtMs: nextExpires,
  };
}

export function revokeAuthSessionByRefreshToken(refreshToken: string): void {
  const tokenHash = hashRefreshToken(refreshToken.trim());
  getEngineSync()
    .prepare('UPDATE auth_sessions SET revoked_at = ? WHERE refresh_token_hash = ?')
    .run(new Date().toISOString(), tokenHash);
}

export function revokeAllUserAuthSessions(userId: string): number {
  const db = getEngineSync();
  const countRow = db
    .prepare('SELECT COUNT(*) as c FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL')
    .get(userId) as { c: number };
  db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
    new Date().toISOString(),
    userId,
  );
  return Number(countRow?.c || 0);
}

export function listUserAuthSessions(userId: string): AuthSessionRow[] {
  const rows = getEngineSync()
    .prepare(
      `SELECT id, user_id, device_label, created_at, last_used_at, expires_at_ms, revoked_at
       FROM auth_sessions
       WHERE user_id = ?
       ORDER BY last_used_at DESC
       LIMIT 15`,
    )
    .all(userId);
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    deviceLabel: String(r.device_label || 'Desktop'),
    createdAt: String(r.created_at),
    lastUsedAt: String(r.last_used_at),
    expiresAtMs: Number(r.expires_at_ms),
    revokedAt: r.revoked_at ? String(r.revoked_at) : null,
  }));
}

/* ---------------- PERSISTENT ROOM INVITATIONS ---------------- */

function rowToInvitation(r: Record<string, unknown>): RoomInvitationRow {
  return {
    id: String(r.id),
    fromUserId: String(r.from_user_id),
    fromUsername: String(r.from_username),
    toUserId: String(r.to_user_id),
    toUsername: String(r.to_username),
    roomCode: String(r.room_code),
    districtId: String(r.district_id),
    mode: String(r.mode),
    targetWsUrl: String(r.target_ws_url || ''),
    status: String(r.status),
    message: String(r.message || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    expiresAtMs: Number(r.expires_at_ms),
  };
}

export function createOrDedupeRoomInvitation(params: {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  roomCode: string;
  districtId: string;
  mode: string;
  targetWsUrl?: string;
  status?: 'sent' | 'pending';
  message?: string;
}): { invite: RoomInvitationRow; deduplicated: boolean } {
  const db = getEngineSync();
  const nowIso = new Date().toISOString();
  const cleanCode = params.roomCode.trim().toUpperCase();
  const existing = db
    .prepare(
      `SELECT * FROM room_invitations
       WHERE from_user_id = ? AND to_user_id = ? AND room_code = ? AND status IN ('sent', 'pending')
       LIMIT 1`,
    )
    .get(params.fromUserId, params.toUserId, cleanCode);
  if (existing) {
    const nextStatus = params.status || String(existing.status);
    db.prepare(
      'UPDATE room_invitations SET updated_at = ?, status = ?, target_ws_url = ?, expires_at_ms = ? WHERE id = ?',
    ).run(
      nowIso,
      nextStatus,
      params.targetWsUrl ?? String(existing.target_ws_url || ''),
      Date.now() + 20 * 60_000,
      String(existing.id),
    );
    const updated = db
      .prepare('SELECT * FROM room_invitations WHERE id = ? LIMIT 1')
      .get(String(existing.id))!;
    return { invite: rowToInvitation(updated), deduplicated: true };
  }

  const id = `inv_${crypto.randomUUID()}`;
  const expiresAtMs = Date.now() + 20 * 60_000;
  db.prepare(
    `INSERT INTO room_invitations (
      id, from_user_id, from_username, to_user_id, to_username,
      room_code, district_id, mode, target_ws_url, status, message,
      created_at, updated_at, expires_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.fromUserId,
    params.fromUsername,
    params.toUserId,
    params.toUsername,
    cleanCode,
    params.districtId,
    params.mode,
    params.targetWsUrl || '',
    params.status || 'pending',
    params.message || '',
    nowIso,
    nowIso,
    expiresAtMs,
  );
  const created = db.prepare('SELECT * FROM room_invitations WHERE id = ? LIMIT 1').get(id)!;
  return { invite: rowToInvitation(created), deduplicated: false };
}

export function expireOldRoomInvitations(): void {
  const db = getEngineSync();
  db.prepare(
    `UPDATE room_invitations
     SET status = 'room_closed', updated_at = ?
     WHERE status IN ('sent', 'pending') AND expires_at_ms < ?`,
  ).run(new Date().toISOString(), Date.now());
}

export function listInvitationsForUser(userId: string): {
  incoming: RoomInvitationRow[];
  outgoing: RoomInvitationRow[];
} {
  expireOldRoomInvitations();
  const db = getEngineSync();
  const incRows = db
    .prepare(
      `SELECT * FROM room_invitations
       WHERE to_user_id = ?
       ORDER BY updated_at DESC
       LIMIT 25`,
    )
    .all(userId);
  const outRows = db
    .prepare(
      `SELECT * FROM room_invitations
       WHERE from_user_id = ?
       ORDER BY updated_at DESC
       LIMIT 25`,
    )
    .all(userId);
  return {
    incoming: incRows.map(rowToInvitation),
    outgoing: outRows.map(rowToInvitation),
  };
}

export function getInvitationById(id: string): RoomInvitationRow | null {
  const row = getEngineSync()
    .prepare('SELECT * FROM room_invitations WHERE id = ? LIMIT 1')
    .get(id);
  return row ? rowToInvitation(row) : null;
}

export function updateInvitationStatus(
  id: string,
  status: string,
  message?: string,
): RoomInvitationRow | null {
  const db = getEngineSync();
  db.prepare(
    `UPDATE room_invitations SET status = ?, message = COALESCE(?, message), updated_at = ? WHERE id = ?`,
  ).run(status, message ?? null, new Date().toISOString(), id);
  return getInvitationById(id);
}

export function closeInvitationsForRoomCode(
  roomCode: string,
  status: 'room_closed' | 'host_offline' = 'room_closed',
): void {
  const cleanCode = roomCode.trim().toUpperCase();
  getEngineSync()
    .prepare(
      `UPDATE room_invitations
       SET status = ?, updated_at = ?
       WHERE room_code = ? AND status IN ('sent', 'pending')`,
    )
    .run(status, new Date().toISOString(), cleanCode);
}

export function getPlayerSaveJson(userId: string): { saveJson: string | null; updatedAt: string | null } {
  const row = getEngineSync()
    .prepare('SELECT save_json, updated_at FROM player_saves WHERE user_id = ? LIMIT 1')
    .get(userId) as { save_json: string; updated_at: string } | undefined;
  return row ? { saveJson: row.save_json, updatedAt: row.updated_at } : { saveJson: null, updatedAt: null };
}

export function upsertPlayerSaveJson(userId: string, saveObj: unknown): string {
  const updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(saveObj);
  getEngineSync()
    .prepare(
      `INSERT INTO player_saves (user_id, save_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET save_json = excluded.save_json, updated_at = excluded.updated_at`,
    )
    .run(userId, serialized, updatedAt);
  return updatedAt;
}

/* ---------------- LOCAL PROFILES (OFFLINE-FIRST IN USERDATA) ---------------- */

export function listLocalProfiles(): LocalProfileRow[] {
  const rows = getEngineSync()
    .prepare('SELECT * FROM local_profiles ORDER BY updated_at DESC')
    .all();
  return rows.map(rowToLocalProfile);
}

export function getLocalProfile(id: string): LocalProfileRow | null {
  const row = getEngineSync()
    .prepare('SELECT * FROM local_profiles WHERE id = ? LIMIT 1')
    .get(id);
  return row ? rowToLocalProfile(row) : null;
}

export function createLocalProfile(params: {
  id?: string;
  name: string;
  avatarId: string;
  saveObj: unknown;
}): LocalProfileRow {
  const id = params.id || `loc_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const serialized = JSON.stringify(params.saveObj);
  getEngineSync()
    .prepare(
      `INSERT INTO local_profiles (id, name, avatar_id, save_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, params.name.trim(), params.avatarId, serialized, now, now);
  return getLocalProfile(id)!;
}

export function updateLocalProfileSave(params: {
  id: string;
  saveObj: unknown;
  name?: string;
  avatarId?: string;
}): LocalProfileRow | null {
  const existing = getLocalProfile(params.id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const serialized = JSON.stringify(params.saveObj);
  getEngineSync()
    .prepare(
      `UPDATE local_profiles
       SET save_json = ?, name = ?, avatar_id = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      serialized,
      params.name?.trim() || existing.name,
      params.avatarId || existing.avatarId,
      now,
      params.id,
    );
  return getLocalProfile(params.id);
}

export function deleteLocalProfile(id: string): boolean {
  const existing = getLocalProfile(id);
  if (!existing) return false;
  getEngineSync().prepare('DELETE FROM local_profiles WHERE id = ?').run(id);
  return true;
}

export function linkLocalProfileToOnline(params: {
  localProfileId: string;
  onlineUserId: string;
  onlineUsername: string;
  strategy: string;
  mergedSaveObj: unknown;
  summary: unknown;
}): { profile: LocalProfileRow | null; linkedAt: string } {
  const linkedAt = new Date().toISOString();
  const serialized = JSON.stringify(params.mergedSaveObj);
  const db = getEngineSync();
  db.prepare(
    `UPDATE local_profiles
     SET save_json = ?, linked_online_user_id = ?, linked_online_username = ?, last_linked_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    serialized,
    params.onlineUserId,
    params.onlineUsername,
    linkedAt,
    linkedAt,
    params.localProfileId,
  );
  db.prepare(
    `INSERT INTO account_link_logs (id, local_profile_id, online_user_id, strategy, summary_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    `lnk_${crypto.randomUUID()}`,
    params.localProfileId,
    params.onlineUserId,
    params.strategy,
    JSON.stringify(params.summary),
    linkedAt,
  );
  upsertPlayerSaveJson(params.onlineUserId, params.mergedSaveObj);
  return { profile: getLocalProfile(params.localProfileId), linkedAt };
}

/* ---------------- IDEMPOTENT TRANSACTIONS ---------------- */

export function getIdempotentTx(txId: string): { found: boolean; result?: unknown } {
  const row = getEngineSync()
    .prepare('SELECT result_json FROM idempotent_tx WHERE tx_id = ? LIMIT 1')
    .get(txId) as { result_json?: string } | undefined;
  if (!row) return { found: false };
  try {
    return {
      found: true,
      result: row.result_json ? JSON.parse(row.result_json) : null,
    };
  } catch {
    return { found: true, result: null };
  }
}

export function recordIdempotentTx(txId: string, scope: string, resultObj: unknown): void {
  getEngineSync()
    .prepare(
      `INSERT OR IGNORE INTO idempotent_tx (tx_id, scope, result_json, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(txId, scope, JSON.stringify(resultObj), new Date().toISOString());
}

/* ---------------- VERIFIED RUNS & RANKINGS ---------------- */

export function isRunIdUsed(runId: string): boolean {
  const row = getEngineSync()
    .prepare('SELECT run_id FROM used_run_ids WHERE run_id = ? LIMIT 1')
    .get(runId);
  return Boolean(row);
}

export function insertVerifiedRun(record: SqliteRunRow, runId: string): void {
  const db = getEngineSync();
  db.prepare('INSERT INTO used_run_ids (run_id, created_at) VALUES (?, ?)').run(
    runId,
    Date.now(),
  );
  db.prepare(
    `INSERT INTO runs (
      id, user_id, player_name, avatar_id, character_id, district_id, mode,
      score, distance, duration_sec, max_speed_kmh, max_combo, boss_defeated_id,
      victory, created_at, timestamp_ms, verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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
  db.prepare(
    `UPDATE users
     SET total_runs = total_runs + 1,
         best_score = MAX(best_score, ?),
         best_distance = MAX(best_distance, ?)
     WHERE id = ?`,
  ).run(record.score, record.distance, record.userId);
}

export function getUserRunHistory(userId: string, limit = 25): SqliteRunRow[] {
  const rows = getEngineSync()
    .prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY timestamp_ms DESC LIMIT ?')
    .all(userId, limit);
  return rows.map(rowToRun);
}

export function queryRankings(params: {
  scope: string;
  districtId?: string;
  characterId?: string;
  friendUsernames?: string[];
  limit?: number;
}): SqliteRunRow[] {
  const db = getEngineSync();
  const limit = Math.min(50, Math.max(1, params.limit ?? 30));
  const now = Date.now();
  let rows: Record<string, unknown>[] = [];

  if (params.scope === 'city' && params.districtId) {
    rows = db
      .prepare('SELECT * FROM runs WHERE district_id = ? ORDER BY score DESC LIMIT ?')
      .all(params.districtId, limit);
  } else if (params.scope === 'character' && params.characterId) {
    rows = db
      .prepare('SELECT * FROM runs WHERE character_id = ? ORDER BY score DESC LIMIT ?')
      .all(params.characterId, limit);
  } else if (params.scope === 'weekly') {
    rows = db
      .prepare('SELECT * FROM runs WHERE timestamp_ms >= ? ORDER BY score DESC LIMIT ?')
      .all(now - 7 * 86400_000, limit);
  } else if (params.scope === 'monthly') {
    rows = db
      .prepare('SELECT * FROM runs WHERE timestamp_ms >= ? ORDER BY score DESC LIMIT ?')
      .all(now - 30 * 86400_000, limit);
  } else if (params.scope === 'friends') {
    const names = params.friendUsernames ?? [];
    if (names.length === 0) return [];
    const placeholders = names.map(() => '?').join(', ');
    rows = db
      .prepare(`SELECT * FROM runs WHERE player_name IN (${placeholders}) ORDER BY score DESC LIMIT ?`)
      .all(...names, limit);
  } else {
    rows = db
      .prepare('SELECT * FROM runs ORDER BY score DESC LIMIT ?')
      .all(limit);
  }

  return rows.map(rowToRun);
}

export function recordMultiplayerMatch(params: {
  roomCode: string;
  districtId: string;
  mode: string;
  results: unknown[];
}): void {
  getEngineSync()
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
  const { dbFilePath, backupDirPath } = ensureDirectories();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDirPath, `userdata-${label}-${stamp}.db`);
  if (fs.existsSync(dbFilePath)) {
    fs.copyFileSync(dbFilePath, dest);
  }
  return dest;
}

export function cleanResetTestRankingsAndStats(userId?: string): { backupPath: string } {
  const backupPath = backupDatabaseSnapshot('pre-clean-reset');
  const db = getEngineSync();
  db.exec('DELETE FROM runs; DELETE FROM used_run_ids; DELETE FROM mp_matches;');
  if (userId) {
    db.prepare('UPDATE users SET total_runs = 0, best_score = 0, best_distance = 0 WHERE id = ?').run(userId);
    db.prepare('DELETE FROM player_saves WHERE user_id = ?').run(userId);
  } else {
    db.exec('UPDATE users SET total_runs = 0, best_score = 0, best_distance = 0; DELETE FROM player_saves;');
  }
  return { backupPath };
}

export function getDatabaseDiagnostics(): {
  dbPath: string;
  backupDir: string;
  engine: string;
  schemaVersion: number;
  userCount: number;
  localProfileCount: number;
  runCount: number;
  mpMatchCount: number;
  sizeBytes: number;
} {
  const db = getEngineSync();
  const { dbFilePath, backupDirPath } = getDataDirectoryPaths();
  const verRow = db.prepare('SELECT version FROM schema_version WHERE id = 1 LIMIT 1').get() as
    | { version?: number }
    | undefined;
  const userCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
  );
  const localProfileCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM local_profiles').get() as { c: number }).c,
  );
  const runCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM runs').get() as { c: number }).c,
  );
  const mpMatchCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM mp_matches').get() as { c: number }).c,
  );
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(dbFilePath).size;
  } catch {
    sizeBytes = 0;
  }
  return {
    dbPath: dbFilePath,
    backupDir: backupDirPath,
    engine: db.engineName,
    schemaVersion: Number(verRow?.version ?? CURRENT_SCHEMA_VERSION),
    userCount,
    localProfileCount,
    runCount,
    mpMatchCount,
    sizeBytes,
  };
}

export function createFriendRequest(params: {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  serverKey: string;
}): FriendRequestRow {
  const db = getEngineSync();
  const existing = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
         AND status IN ('pending', 'accepted')
       LIMIT 1`,
    )
    .get(params.fromUserId, params.toUserId, params.toUserId, params.fromUserId);

  const nowIso = new Date().toISOString();
  if (existing) {
    return {
      id: String(existing.id),
      fromUserId: String(existing.from_user_id),
      fromUsername: String(existing.from_username),
      toUserId: String(existing.to_user_id),
      toUsername: String(existing.to_username),
      serverKey: String(existing.server_key || 'local'),
      status: String(existing.status),
      createdAt: String(existing.created_at),
      updatedAt: String(existing.updated_at),
    };
  }

  const id = `freq_${crypto.randomUUID()}`;
  db.prepare(
    `INSERT INTO friend_requests (
      id, from_user_id, from_username, to_user_id, to_username, server_key, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(
    id,
    params.fromUserId,
    params.fromUsername,
    params.toUserId,
    params.toUsername,
    params.serverKey || 'local',
    nowIso,
    nowIso,
  );
  return {
    id,
    fromUserId: params.fromUserId,
    fromUsername: params.fromUsername,
    toUserId: params.toUserId,
    toUsername: params.toUsername,
    serverKey: params.serverKey || 'local',
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function listFriendRequestsForUser(userId: string): {
  incoming: FriendRequestRow[];
  outgoing: FriendRequestRow[];
  accepted: FriendRequestRow[];
} {
  const db = getEngineSync();
  const rows = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE from_user_id = ? OR to_user_id = ?
       ORDER BY updated_at DESC LIMIT 60`,
    )
    .all(userId, userId);

  const mapRow = (r: Record<string, unknown>): FriendRequestRow => ({
    id: String(r.id),
    fromUserId: String(r.from_user_id),
    fromUsername: String(r.from_username),
    toUserId: String(r.to_user_id),
    toUsername: String(r.to_username),
    serverKey: String(r.server_key || 'local'),
    status: String(r.status),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  });

  const mapped = rows.map(mapRow);
  return {
    incoming: mapped.filter((r) => r.toUserId === userId && r.status === 'pending'),
    outgoing: mapped.filter((r) => r.fromUserId === userId && r.status === 'pending'),
    accepted: mapped.filter((r) => r.status === 'accepted'),
  };
}

export function respondFriendRequest(
  requestId: string,
  userId: string,
  accept: boolean,
): FriendRequestRow | null {
  const db = getEngineSync();
  const existing = db
    .prepare('SELECT * FROM friend_requests WHERE id = ? LIMIT 1')
    .get(requestId);
  if (!existing) return null;
  if (String(existing.to_user_id) !== userId && String(existing.from_user_id) !== userId) {
    return null;
  }
  const nextStatus = accept ? 'accepted' : 'rejected';
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE friend_requests SET status = ?, updated_at = ? WHERE id = ?').run(
    nextStatus,
    nowIso,
    requestId,
  );
  if (accept) {
    try {
      const fromU = String(existing.from_username);
      const toU = String(existing.to_username);
      addUserFriend(String(existing.from_user_id), toU);
      addUserFriend(String(existing.to_user_id), fromU);
    } catch {
      // Guests on same Radmin server may not have full registered rows
    }
  }
  return {
    id: String(existing.id),
    fromUserId: String(existing.from_user_id),
    fromUsername: String(existing.from_username),
    toUserId: String(existing.to_user_id),
    toUsername: String(existing.to_username),
    serverKey: String(existing.server_key || 'local'),
    status: nextStatus,
    createdAt: String(existing.created_at),
    updatedAt: nowIso,
  };
}
