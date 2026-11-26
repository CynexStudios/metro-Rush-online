import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import {
  addUserFriend,
  backupDatabaseSnapshot,
  changeUserPassword,
  cleanResetTestRankingsAndStats,
  closeInvitationsForRoomCode,
  closeSqlite,
  createAuthSession,
  createFriendRequest,
  createLocalProfile,
  createOrDedupeRoomInvitation,
  createUserAccount,
  deleteLocalProfile,
  findUserById,
  findUserByIdentifier,
  getDatabaseDiagnostics,
  getIdempotentTx,
  getInvitationById,
  getLocalProfile,
  getPlayerSaveJson,
  getUserRunHistory,
  hashSecret,
  initSqlite,
  insertVerifiedRun,
  isRunIdUsed,
  linkLocalProfileToOnline,
  listFriendRequestsForUser,
  listInvitationsForUser,
  listLocalProfiles,
  listUserAuthSessions,
  queryRankings,
  recordIdempotentTx,
  recoverUserPassword,
  respondFriendRequest,
  revokeAllUserAuthSessions,
  revokeAuthSessionByRefreshToken,
  searchUsersByQuery,
  SqliteRunRow,
  SqliteUserRow,
  touchUserLastSeen,
  updateInvitationStatus,
  updateLocalProfileSave,
  updateUserAvatar,
  updateUserProfileDetails,
  upsertPlayerSaveJson,
  verifyAndRotateRefreshSession,
} from './src/db/sqlite';
import { GAME_VERSION } from './src/game/version';
import { checkForReleaseUpdate } from './electron/updater';
import {
  AuthoritativeRoomManager,
  getLanHostStatus,
  listLocalNetworkInterfaces,
  startLanMatchHostServer,
  stopLanMatchHostServer,
} from './src/net/matchHost';

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(process.env.APP_URL || 'metro-rush-neon-city-local-pc-secret')
    .digest('hex');

function signToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken<T>(token: string): T | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

const rateHits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxPerMin: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const now = Date.now();
    const cur = rateHits.get(ip);
    if (!cur || cur.resetAt < now) {
      rateHits.set(ip, { count: 1, resetAt: now + 60_000 });
      next();
      return;
    }
    if (cur.count >= maxPerMin) {
      res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento.' });
      return;
    }
    cur.count += 1;
    next();
  };
}

interface AuthSessionPayload {
  uid: string;
  username: string;
  exp: number;
}

interface RunSessionPayload {
  runId: string;
  uid: string;
  districtId: string;
  mode: string;
  startedAtMs: number;
}

function getAuthUser(req: Request): SqliteUserRow | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const payload = verifyToken<AuthSessionPayload>(token);
  if (!payload || payload.exp < Date.now()) return null;
  return findUserById(payload.uid);
}

const ACCESS_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4h access token paired with 30d rotating SQLite refresh session

const ORDERED_BOSS_IDS = [
  'titan_drone',
  'iron_hunter',
  'overseer',
  'neon_wraith',
  'cryo_leviathan',
  'volt_archon',
  'the_sentinel',
  'omega_core',
] as const;

function sanitizeUser(u: SqliteUserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    email: u.email,
    avatarId: u.avatarId,
    createdAt: u.createdAt,
    lastSeenAt: u.lastSeenAt,
    friends: u.friends,
    totalRuns: u.totalRuns,
    bestScore: u.bestScore,
    bestDistance: u.bestDistance,
  };
}

export interface RunningAppServer {
  port: number;
  close: () => Promise<void>;
}

export async function startAppServer(options?: {
  port?: number;
  host?: string;
  distDir?: string;
  forceProdStatic?: boolean;
}): Promise<RunningAppServer> {
  const dbEngine = await initSqlite();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Allow cross-origin calls when Electron renderer talks to an external central server
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const roomManager = new AuthoritativeRoomManager();
  roomManager.onRoomClosed = (roomCode, reason) => {
    closeInvitationsForRoomCode(roomCode, reason);
  };

  /* ---------------- HEALTH & DIAGNOSTICS ---------------- */

  app.get('/api/health', (_req, res) => {
    const dbStats = getDatabaseDiagnostics();
    res.json({
      ok: true,
      mode: IS_PROD || options?.forceProdStatic ? 'production' : 'development',
      dbEngine,
      gameVersion: GAME_VERSION,
      schemaVersion: dbStats.schemaVersion,
      users: dbStats.userCount,
      localProfiles: dbStats.localProfileCount,
      runs: dbStats.runCount,
    });
  });

  app.get('/api/db/info', (req, res) => {
    const auth = getAuthUser(req);
    const info = getDatabaseDiagnostics();
    res.json({
      ...info,
      authenticatedAs: auth ? auth.username : null,
      persistenceNote:
        'Base de datos SQLite persistente ubicada en el directorio de datos del usuario (sobrevive reinicios y actualizaciones).',
    });
  });

  app.get('/api/updates/check', async (req, res) => {
    const repo = req.query.repo ? String(req.query.repo) : undefined;
    const info = await checkForReleaseUpdate(GAME_VERSION, repo);
    res.json(info);
  });

  /* ---------------- ICE / STUN / TURN DISCOVERY ---------------- */

  app.get('/api/rtc/ice-config', (_req, res) => {
    const iceServers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }> = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    let hasTurn = false;
    if (process.env.METRO_RUSH_TURN_URL) {
      hasTurn = true;
      iceServers.push({
        urls: process.env.METRO_RUSH_TURN_URL,
        username: process.env.METRO_RUSH_TURN_USER || undefined,
        credential: process.env.METRO_RUSH_TURN_CREDENTIAL || undefined,
      });
    }
    res.json({
      iceServers,
      hasTurn,
      turnInfo: hasTurn
        ? 'Servidor TURN activo para retransmisión tras NAT estricto.'
        : 'Usando STUN público gratuito. Si ambos routers bloquean P2P directo, usa un túnel (playit.gg) o configura un servidor TURN.',
    });
  });

  /* ---------------- LAN HOST MANAGEMENT ---------------- */

  app.get('/api/lan/status', (_req, res) => {
    res.json({
      ...getLanHostStatus(),
      interfaces: listLocalNetworkInterfaces(),
      gameVersion: GAME_VERSION,
    });
  });

  app.post('/api/lan/start', async (req, res) => {
    const bindAddress = String(req.body?.bindAddress || '0.0.0.0');
    const port = Number(req.body?.port || 3077);
    const result = await startLanMatchHostServer({ bindAddress, port });
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error, state: result.state });
      return;
    }
    res.json({ ok: true, state: result.state });
  });

  app.post('/api/lan/stop', async (_req, res) => {
    const state = await stopLanMatchHostServer();
    res.json({ ok: true, state });
  });

  app.post('/api/net/probe', async (req, res) => {
    const raw = String(req.body?.target || req.body?.targetUrl || '').trim();
    if (!raw) {
      res.status(400).json({ ok: false, reason: 'invalid_url', error: 'Introduce una IP:Puerto o URL.' });
      return;
    }
    const cleanTarget = raw.split('#')[0].trim();
    let httpBase = cleanTarget;
    if (httpBase.startsWith('ws://')) {
      httpBase = `http://${httpBase.slice(5)}`;
    } else if (httpBase.startsWith('wss://')) {
      httpBase = `https://${httpBase.slice(6)}`;
    } else if (!httpBase.startsWith('http://') && !httpBase.startsWith('https://')) {
      const bareIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(httpBase);
      if (bareIpv4) httpBase = `${httpBase}:3077`;
      const isIpOrLocal =
        /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(httpBase) ||
        /^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(httpBase);
      httpBase = `${isIpOrLocal ? 'http' : 'https'}://${httpBase}`;
    }
    httpBase = httpBase.replace(/\/ws\/?$/i, '').replace(/\/+$/, '');

    let parsed: URL;
    try {
      parsed = new URL(httpBase);
    } catch {
      res.status(400).json({ ok: false, reason: 'invalid_url', error: `Dirección inválida: ${raw}` });
      return;
    }

    try {
      const probeRes = await fetch(`${parsed.origin}/api/health`, {
        signal: AbortSignal.timeout(4500),
      });
      if (!probeRes.ok) {
        const isTunnel = parsed.hostname.endsWith('.trycloudflare.com') || parsed.hostname.includes('playit');
        res.json({
          ok: false,
          reason: probeRes.status >= 500 ? 'tunnel_origin_offline' : 'http_error',
          httpStatus: probeRes.status,
          error: isTunnel
            ? `El túnel respondió con HTTP ${probeRes.status}: el anfitrión cerró el juego o el túnel todavía está terminando de conectar.`
            : `El servidor respondió HTTP ${probeRes.status}.`,
        });
        return;
      }
      const data = (await probeRes.json().catch(() => ({}))) as {
        ok?: boolean;
        gameVersion?: string;
        rooms?: unknown[];
        activeRoomCount?: number;
      };
      res.json({
        ok: true,
        httpBase: parsed.origin,
        gameVersion: data.gameVersion ?? null,
        rooms: Array.isArray(data.rooms) ? data.rooms : [],
        activeRoomCount: typeof data.activeRoomCount === 'number' ? data.activeRoomCount : null,
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string }; name?: string; code?: string }) || {};
      const code = cause.cause?.code || cause.code || cause.name || '';
      const hostLabel = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
      if (code === 'ECONNREFUSED') {
        res.json({
          ok: false,
          reason: 'connection_refused',
          error: `El equipo ${parsed.hostname} está conectado, pero el puerto ${parsed.port || '80'} está cerrado. El anfitrión debe crear la sala o pulsar "Iniciar Servidor" primero.`,
        });
        return;
      }
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        res.json({
          ok: false,
          reason: 'dns_not_ready',
          error: `No se pudo resolver "${parsed.hostname}". Si es un enlace trycloudflare nuevo, espera 5 segundos y vuelve a intentar.`,
        });
        return;
      }
      if (code === 'TimeoutError' || code === 'AbortError' || code === 'ETIMEDOUT' || code === 'EHOSTUNREACH') {
        res.json({
          ok: false,
          reason: 'timeout_or_firewall',
          error: `No hubo respuesta desde ${hostLabel} (tiempo agotado). Causa más probable: el Firewall de Windows del anfitrión está bloqueando el puerto ${parsed.port || '3077'} (muy común en Radmin VPN / Redes Públicas) o la VPN no está activa.`,
        });
        return;
      }
      res.json({
        ok: false,
        reason: 'network_error',
        error: `No se pudo contactar a ${hostLabel}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  /* ---------------- LOCAL PROFILES (OFFLINE-FIRST IN SQLITE) ---------------- */

  app.get('/api/local-profiles', (_req, res) => {
    const rows = listLocalProfiles();
    const summaries = rows.map((r) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(r.saveJson) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      const stats = (parsed.stats as Record<string, unknown> | undefined) ?? {};
      return {
        id: r.id,
        name: r.name,
        avatarId: r.avatarId,
        level: Number(parsed.level ?? 1),
        coins: Number(parsed.coins ?? 0),
        gems: Number(parsed.gems ?? 0),
        totalRuns: Number(stats.totalRuns ?? 0),
        bestScore: Number(stats.bestScore ?? 0),
        linkedOnlineUserId: r.linkedOnlineUserId,
        linkedOnlineUsername: r.linkedOnlineUsername,
        lastLinkedAt: r.lastLinkedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
    res.json({ profiles: summaries });
  });

  app.get('/api/local-profiles/:id', (req, res) => {
    const profile = getLocalProfile(String(req.params.id));
    if (!profile) {
      res.status(404).json({ error: 'Perfil local no encontrado.' });
      return;
    }
    try {
      res.json({
        profile: {
          ...profile,
          save: JSON.parse(profile.saveJson),
        },
      });
    } catch {
      res.status(500).json({ error: 'El guardado del perfil local está corrupto.' });
    }
  });

  app.post('/api/local-profiles', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const avatarId = String(req.body?.avatarId ?? 'kai').slice(0, 24);
    const save = req.body?.save;
    if (name.length < 2 || name.length > 22) {
      res.status(400).json({ error: 'El nombre local debe tener entre 2 y 22 caracteres.' });
      return;
    }
    if (!save || typeof save !== 'object') {
      res.status(400).json({ error: 'Datos de guardado iniciales inválidos.' });
      return;
    }
    const created = createLocalProfile({
      id: req.body?.id ? String(req.body.id) : undefined,
      name,
      avatarId,
      saveObj: save,
    });
    res.status(201).json({
      profile: {
        ...created,
        save: JSON.parse(created.saveJson),
      },
    });
  });

  app.put('/api/local-profiles/:id', (req, res) => {
    const id = String(req.params.id);
    const save = req.body?.save;
    if (!save || typeof save !== 'object') {
      res.status(400).json({ error: 'Datos de guardado inválidos.' });
      return;
    }
    const updated = updateLocalProfileSave({
      id,
      saveObj: save,
      name: req.body?.name ? String(req.body.name) : undefined,
      avatarId: req.body?.avatarId ? String(req.body.avatarId) : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Perfil local no encontrado.' });
      return;
    }
    res.json({ ok: true, updatedAt: updated.updatedAt });
  });

  app.delete('/api/local-profiles/:id', (req, res) => {
    const id = String(req.params.id);
    backupDatabaseSnapshot(`pre-delete-local-${id.slice(0, 8)}`);
    const removed = deleteLocalProfile(id);
    if (!removed) {
      res.status(404).json({ error: 'Perfil local no encontrado.' });
      return;
    }
    res.json({ ok: true });
  });

  /* ---------------- ACCOUNT LINKING & CONFLICT RESOLUTION ---------------- */

  app.post('/api/local-profiles/link', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión en una cuenta online primero.' });
      return;
    }
    const localProfileId = String(req.body?.localProfileId ?? '');
    const strategy = String(req.body?.strategy ?? 'merge');
    const txId = String(req.body?.txId ?? '');
    const mergedSave = req.body?.mergedSave;
    const summary = req.body?.summary ?? {};

    if (!localProfileId || !mergedSave || typeof mergedSave !== 'object') {
      res.status(400).json({ error: 'Faltan datos para vincular el perfil.' });
      return;
    }
    if (txId) {
      const existing = getIdempotentTx(txId);
      if (existing.found) {
        res.json({ ok: true, deduplicated: true, result: existing.result });
        return;
      }
    }

    backupDatabaseSnapshot('pre-account-link');
    const resLink = linkLocalProfileToOnline({
      localProfileId,
      onlineUserId: user.id,
      onlineUsername: user.username,
      strategy,
      mergedSaveObj: mergedSave,
      summary,
    });
    const out = {
      ok: true,
      linkedAt: resLink.linkedAt,
      linkedOnlineUsername: user.username,
    };
    if (txId) recordIdempotentTx(txId, 'account_link', out);
    res.json(out);
  });

  /* ---------------- ONLINE ACCOUNTS (AUTH + SYNC + BACKUP) ---------------- */

  app.post('/api/auth/register', rateLimit(20), (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const confirmPassword = String(req.body?.confirmPassword ?? password);
    const avatarId = String(req.body?.avatarId ?? 'kai').slice(0, 24);

    if (!/^[a-zA-Z0-9_]{3,18}$/.test(username)) {
      res.status(400).json({
        error: 'El usuario debe tener 3-18 caracteres alfanuméricos o "_".',
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Introduce un correo electrónico válido.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Las contraseñas no coinciden.' });
      return;
    }
    if (findUserByIdentifier(username)) {
      res.status(409).json({ error: 'Este nombre de corredor ya existe.' });
      return;
    }
    if (findUserByIdentifier(email)) {
      res.status(409).json({ error: 'Este correo electrónico ya está registrado.' });
      return;
    }

    const { user, recoveryCode } = createUserAccount({
      username,
      email,
      password,
      avatarId,
    });

    const token = signToken({
      uid: user.id,
      username: user.username,
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
    });
    const session = createAuthSession({
      userId: user.id,
      deviceLabel: String(req.headers['user-agent'] || 'Metro Rush Client').slice(0, 60),
    });
    res.status(201).json({
      token,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
      expiresAtMs: session.expiresAtMs,
      user: sanitizeUser(user),
      recoveryCode,
    });
  });

  app.post('/api/auth/login', rateLimit(30), (req, res) => {
    const identifier = String(
      req.body?.identifier ?? req.body?.username ?? req.body?.email ?? '',
    ).trim();
    const password = String(req.body?.password ?? '');
    const user = findUserByIdentifier(identifier);
    if (!user) {
      res.status(401).json({ error: 'Usuario, correo o contraseña incorrectos.' });
      return;
    }
    const candidateHash = hashSecret(password, user.salt);
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(user.passwordHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'Usuario, correo o contraseña incorrectos.' });
      return;
    }
    const token = signToken({
      uid: user.id,
      username: user.username,
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
    });
    const session = createAuthSession({
      userId: user.id,
      deviceLabel: String(req.body?.deviceLabel || req.headers['user-agent'] || 'Metro Rush Desktop').slice(0, 60),
    });
    res.json({
      token,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
      expiresAtMs: session.expiresAtMs,
      user: sanitizeUser(user),
    });
  });

  app.post('/api/auth/refresh', rateLimit(40), (req, res) => {
    const refreshToken = String(req.body?.refreshToken ?? '').trim();
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token requerido.' });
      return;
    }
    const rot = verifyAndRotateRefreshSession(refreshToken);
    if (!rot.ok || !rot.user || !rot.newRefreshToken) {
      res.status(401).json({ error: rot.error || 'Sesión expirada o revocada.' });
      return;
    }
    const token = signToken({
      uid: rot.user.id,
      username: rot.user.username,
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
    });
    res.json({
      token,
      refreshToken: rot.newRefreshToken,
      sessionId: rot.sessionId,
      expiresAtMs: rot.expiresAtMs,
      user: sanitizeUser(rot.user),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const refreshToken = String(req.body?.refreshToken ?? '').trim();
    if (refreshToken) {
      revokeAuthSessionByRefreshToken(refreshToken);
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/logout-all', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión primero.' });
      return;
    }
    const revoked = revokeAllUserAuthSessions(user.id);
    res.json({ ok: true, revokedCount: revoked });
  });

  app.get('/api/auth/sessions', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión no válida.' });
      return;
    }
    res.json({ sessions: listUserAuthSessions(user.id) });
  });

  app.post('/api/auth/change-password', rateLimit(15), (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión primero.' });
      return;
    }
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');
    const result = changeUserPassword({
      userId: user.id,
      currentPassword,
      newPassword,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const session = createAuthSession({
      userId: user.id,
      deviceLabel: 'Sesión actual (post cambio de clave)',
    });
    const token = signToken({
      uid: user.id,
      username: user.username,
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
    });
    res.json({
      ok: true,
      token,
      refreshToken: session.refreshToken,
      message: 'Contraseña actualizada y sesiones anteriores cerradas por seguridad.',
    });
  });

  app.post('/api/auth/profile', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión primero.' });
      return;
    }
    const displayName =
      typeof req.body?.displayName === 'string' ? req.body.displayName : undefined;
    const avatarId =
      typeof req.body?.avatarId === 'string' ? req.body.avatarId : undefined;
    const updated = updateUserProfileDetails(user.id, { displayName, avatarId });
    res.json({ user: updated ? sanitizeUser(updated) : sanitizeUser(user) });
  });

  app.post('/api/auth/recover', rateLimit(15), (req, res) => {
    const identifier = String(req.body?.identifier ?? '').trim();
    const recoveryCode = String(req.body?.recoveryCode ?? '').trim();
    const newPassword = String(req.body?.newPassword ?? '');
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    const result = recoverUserPassword({ identifier, recoveryCode, newPassword });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, message: 'Contraseña restablecida correctamente.' });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión no válida.' });
      return;
    }
    touchUserLastSeen(user.id);
    const history = getUserRunHistory(user.id, 25);
    const saveRecord = getPlayerSaveJson(user.id);
    res.json({
      user: sanitizeUser(user),
      history,
      cloudSaveUpdatedAt: saveRecord.updatedAt,
    });
  });

  app.get('/api/profile/sync', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión para cargar tu progreso SQLite.' });
      return;
    }
    const row = getPlayerSaveJson(user.id);
    if (!row.saveJson) {
      res.json({ hasSave: false, save: null, updatedAt: null });
      return;
    }
    try {
      res.json({
        hasSave: true,
        save: JSON.parse(row.saveJson),
        updatedAt: row.updatedAt,
      });
    } catch {
      res.status(500).json({ error: 'Progreso guardado corrupto en SQLite.' });
    }
  });

  app.put('/api/profile/sync', rateLimit(60), (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión para guardar en SQLite.' });
      return;
    }
    const save = req.body?.save;
    const txId = req.body?.txId ? String(req.body.txId) : '';
    if (!save || typeof save !== 'object') {
      res.status(400).json({ error: 'Datos de guardado inválidos.' });
      return;
    }
    if (txId) {
      const existing = getIdempotentTx(txId);
      if (existing.found) {
        res.json({ ok: true, deduplicated: true, updatedAt: new Date().toISOString() });
        return;
      }
    }
    const updatedAt = upsertPlayerSaveJson(user.id, save);
    if (txId) recordIdempotentTx(txId, 'profile_sync', { updatedAt });
    res.json({ ok: true, updatedAt });
  });

  app.get('/api/account/export', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión para exportar tu respaldo.' });
      return;
    }
    const saveRow = getPlayerSaveJson(user.id);
    const history = getUserRunHistory(user.id, 100);
    const payload = {
      format: 'metro-rush-sqlite-backup-v2',
      gameVersion: GAME_VERSION,
      exportedAt: new Date().toISOString(),
      account: sanitizeUser(user),
      save: saveRow.saveJson ? JSON.parse(saveRow.saveJson) : null,
      runs: history,
    };
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="metro-rush-backup-${user.username}.json"`,
    );
    res.json(payload);
  });

  app.post('/api/db/snapshot', (_req, res) => {
    const dest = backupDatabaseSnapshot('manual');
    res.json({ ok: true, backupFile: path.basename(dest) });
  });

  app.post('/api/db/reset-test', rateLimit(10), (req, res) => {
    const user = getAuthUser(req);
    const { backupPath } = cleanResetTestRankingsAndStats(user?.id);
    res.json({
      ok: true,
      backupCreated: path.basename(backupPath),
      message: 'Rankings y datos de prueba reiniciados limpiamente con respaldo previo.',
    });
  });

  app.post('/api/profile/avatar', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión primero.' });
      return;
    }
    const avatarId = String(req.body?.avatarId ?? 'kai').slice(0, 24);
    const updated = updateUserAvatar(user.id, avatarId);
    res.json({ user: updated ? sanitizeUser(updated) : sanitizeUser(user) });
  });

  app.post('/api/friends/add', rateLimit(30), (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión para añadir amigos.' });
      return;
    }
    const friendName = String(req.body?.friendName ?? '').trim();
    const result = addUserFriend(user.id, friendName);
    if (!result.ok || !result.user) {
      res.status(400).json({ error: result.error || 'Error añadiendo amigo.' });
      return;
    }
    res.json({ user: sanitizeUser(result.user) });
  });

  app.get('/api/friend-requests', (req, res) => {
    const user = getAuthUser(req);
    const peerId = String(req.query.userId ?? user?.id ?? '').trim();
    if (!peerId) {
      res.json({ incoming: [], outgoing: [], accepted: [] });
      return;
    }
    res.json(listFriendRequestsForUser(peerId));
  });

  app.post('/api/friend-requests', rateLimit(30), (req, res) => {
    const user = getAuthUser(req);
    const fromUserId = String(user?.id ?? req.body?.fromUserId ?? '').trim();
    const fromUsername = String(user?.username ?? req.body?.fromUsername ?? '').trim();
    const toUserId = String(req.body?.toUserId ?? '').trim();
    const toUsername = String(req.body?.toUsername ?? '').trim();
    const serverKey = String(req.body?.serverKey ?? 'local').trim();

    if (!fromUserId || !fromUsername || (!toUserId && !toUsername)) {
      res.status(400).json({ error: 'Datos de solicitud de amistad incompletos.' });
      return;
    }
    let resolvedToId = toUserId;
    let resolvedToName = toUsername;
    if (!resolvedToId && resolvedToName) {
      const targetUser = findUserByIdentifier(resolvedToName);
      if (targetUser) {
        resolvedToId = targetUser.id;
        resolvedToName = targetUser.username;
      } else {
        for (const p of roomManager.onlineUserProfiles.values()) {
          if (p.username.toLowerCase() === resolvedToName.toLowerCase()) {
            resolvedToId = p.id;
            resolvedToName = p.username;
            break;
          }
        }
      }
    }
    if (!resolvedToId) {
      res.status(404).json({ error: 'Corredor objetivo no encontrado en este servidor.' });
      return;
    }
    const created = createFriendRequest({
      fromUserId,
      fromUsername,
      toUserId: resolvedToId,
      toUsername: resolvedToName || resolvedToId,
      serverKey,
    });
    res.status(201).json({ request: created });
  });

  app.post('/api/friend-requests/respond', rateLimit(30), (req, res) => {
    const user = getAuthUser(req);
    const requestId = String(req.body?.requestId ?? '').trim();
    const responderId = String(user?.id ?? req.body?.userId ?? '').trim();
    const accept = Boolean(req.body?.accept);
    if (!requestId || !responderId) {
      res.status(400).json({ error: 'Solicitud inválida.' });
      return;
    }
    const updated = respondFriendRequest(requestId, responderId, accept);
    if (!updated) {
      res.status(404).json({ error: 'Solicitud no encontrada o sin permiso.' });
      return;
    }
    res.json({ request: updated });
  });

  app.get('/api/lan/online-peers', (_req, res) => {
    const peers = Array.from(roomManager.onlineUserProfiles.values()).map((p) => ({
      id: p.id,
      username: p.username,
      online: true,
    }));
    res.json({ peers });
  });

  /* ---------------- USER SEARCH & PERSISTENT INVITATIONS ---------------- */

  app.get('/api/users/search', rateLimit(60), (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const authUser = getAuthUser(req);
    const found = searchUsersByQuery(q, 20)
      .filter((u) => !authUser || u.id !== authUser.id)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatarId: u.avatarId,
        totalRuns: u.totalRuns,
        bestScore: u.bestScore,
        bestDistance: u.bestDistance,
        lastSeenAt: u.lastSeenAt,
        isOnline: roomManager.isUserOnline(u.id),
      }));

    // Also include connected guests/LAN peers if matching query and not already listed
    const seenIds = new Set(found.map((x) => x.id));
    for (const peerProf of roomManager.onlineUserProfiles.values()) {
      if (authUser && peerProf.id === authUser.id) continue;
      if (seenIds.has(peerProf.id)) continue;
      if (!q || peerProf.username.toLowerCase().includes(q.toLowerCase())) {
        found.push({
          id: peerProf.id,
          username: peerProf.username,
          displayName: peerProf.username,
          avatarId: 'kai',
          totalRuns: 0,
          bestScore: 0,
          bestDistance: 0,
          lastSeenAt: new Date().toISOString(),
          isOnline: true,
        });
      }
    }

    res.json({ users: found });
  });

  app.get('/api/invites', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión online para gestionar invitaciones.' });
      return;
    }
    const { incoming, outgoing } = listInvitationsForUser(user.id);
    // Sync active rooms status for invites created on this server instance
    const syncRoomStatus = (inv: ReturnType<typeof getInvitationById>) => {
      if (!inv) return inv;
      if (inv.status === 'sent' || inv.status === 'pending') {
        const room = roomManager.activeRooms.get(inv.roomCode);
        if (room && room.peers.size >= room.maxPlayers) {
          return updateInvitationStatus(inv.id, 'room_full') ?? inv;
        }
      }
      return inv;
    };
    res.json({
      incoming: incoming.map(syncRoomStatus),
      outgoing: outgoing.map(syncRoomStatus),
    });
  });

  app.post('/api/invites', rateLimit(30), (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Inicia sesión online para enviar invitaciones.' });
      return;
    }
    const targetUserId = String(req.body?.toUserId ?? '').trim();
    const targetUsername = String(req.body?.toUsername ?? '').trim();
    const roomCode = String(req.body?.roomCode ?? '').trim().toUpperCase();
    const districtId = String(req.body?.districtId ?? 'downtown');
    const mode = String(req.body?.mode ?? 'endless');
    const targetWsUrl = String(req.body?.targetWsUrl ?? '').trim();
    const message = String(req.body?.message ?? '').trim().slice(0, 140);

    if (!roomCode || roomCode.length < 4) {
      res.status(400).json({ error: 'Debes crear o estar dentro de una sala antes de invitar.' });
      return;
    }

    const target =
      (targetUserId ? findUserById(targetUserId) : null) ||
      (targetUsername ? findUserByIdentifier(targetUsername) : null);

    if (!target) {
      res.status(404).json({
        error: `El usuario "${targetUsername || targetUserId}" no existe en este servidor online.`,
      });
      return;
    }
    if (target.id === user.id) {
      res.status(400).json({ error: 'No puedes enviarte una invitación a ti mismo.' });
      return;
    }

    const activeRoom = roomManager.activeRooms.get(roomCode);
    if (activeRoom && activeRoom.peers.size >= activeRoom.maxPlayers) {
      res.status(409).json({ error: 'La sala está llena; no se pueden invitar más jugadores.' });
      return;
    }

    const targetOnline = roomManager.isUserOnline(target.id);
    const { invite, deduplicated } = createOrDedupeRoomInvitation({
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: target.id,
      toUsername: target.username,
      roomCode,
      districtId,
      mode,
      targetWsUrl,
      status: targetOnline ? 'pending' : 'sent',
      message,
    });

    if (targetOnline) {
      roomManager.sendToUser(target.id, 'room:invited', {
        inviteId: invite.id,
        code: invite.roomCode,
        fromUsername: user.username,
        districtId: invite.districtId,
        mode: invite.mode,
        targetWsUrl: invite.targetWsUrl,
      });
    }

    res.status(deduplicated ? 200 : 201).json({
      ok: true,
      invite,
      deduplicated,
      deliveredRealtime: targetOnline,
      message: targetOnline
        ? `Invitación entregada en tiempo real a ${target.username}.`
        : `Invitación guardada para ${target.username} (se mostrará al conectarse).`,
    });
  });

  app.post('/api/invites/:id/respond', rateLimit(30), (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión requerida.' });
      return;
    }
    const inv = getInvitationById(String(req.params.id));
    if (!inv) {
      res.status(404).json({ error: 'Invitación no encontrada.' });
      return;
    }
    const action = String(req.body?.action ?? '');
    if (action === 'cancel') {
      if (inv.fromUserId !== user.id) {
        res.status(403).json({ error: 'Solo quien envió la invitación puede cancelarla.' });
        return;
      }
      const updated = updateInvitationStatus(inv.id, 'cancelled');
      res.json({ ok: true, invite: updated });
      return;
    }

    if (inv.toUserId !== user.id) {
      res.status(403).json({ error: 'Esta invitación pertenece a otro jugador.' });
      return;
    }

    if (action === 'reject') {
      const updated = updateInvitationStatus(inv.id, 'rejected');
      roomManager.sendToUser(inv.fromUserId, 'room:info', {
        message: `${user.username} rechazó tu invitación a la sala ${inv.roomCode}.`,
      });
      res.json({ ok: true, invite: updated });
      return;
    }

    if (action === 'accept') {
      const activeRoom = roomManager.activeRooms.get(inv.roomCode);
      if (activeRoom && activeRoom.peers.size >= activeRoom.maxPlayers) {
        const updatedFull = updateInvitationStatus(inv.id, 'room_full');
        res.status(409).json({
          ok: false,
          error: 'La sala ya alcanzó el máximo de jugadores.',
          invite: updatedFull,
        });
        return;
      }
      if (!inv.targetWsUrl && !activeRoom) {
        const updatedClosed = updateInvitationStatus(inv.id, 'room_closed');
        res.status(410).json({
          ok: false,
          error: 'La sala ya fue cerrada o el anfitrión se desconectó.',
          invite: updatedClosed,
        });
        return;
      }
      const updated = updateInvitationStatus(inv.id, 'accepted');
      roomManager.sendToUser(inv.fromUserId, 'room:info', {
        message: `${user.username} aceptó la invitación a la sala ${inv.roomCode}.`,
      });
      res.json({ ok: true, invite: updated });
      return;
    }

    res.status(400).json({ error: 'Acción de invitación inválida.' });
  });

  /* ---------------- VERIFIED RUNS & RANKINGS ---------------- */

  app.post('/api/runs/start', rateLimit(60), (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión requerida para ranking verificado.' });
      return;
    }
    const districtId = String(req.body?.districtId ?? 'downtown');
    const mode = String(req.body?.mode ?? 'endless');
    const runId = crypto.randomUUID();
    const runToken = signToken({
      runId,
      uid: user.id,
      districtId,
      mode,
      startedAtMs: Date.now(),
    } satisfies RunSessionPayload);
    res.json({ runId, runToken });
  });

  app.post('/api/runs/submit', rateLimit(40), (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión expirada o no iniciada.' });
      return;
    }

    const runToken = String(req.body?.runToken ?? '');
    const session = verifyToken<RunSessionPayload>(runToken);
    if (!session || session.uid !== user.id) {
      res.status(403).json({ error: 'Firma de partida inválida (anti-cheat).' });
      return;
    }
    if (isRunIdUsed(session.runId)) {
      res.status(409).json({ error: 'Partida duplicada detectada y rechazada.' });
      return;
    }

    const score = Number(req.body?.score ?? 0);
    const distance = Number(req.body?.distance ?? 0);
    const durationSec = Math.max(1, Number(req.body?.durationSec ?? 1));
    const maxSpeedKmh = Number(req.body?.maxSpeedKmh ?? 0);
    const maxCombo = Number(req.body?.maxCombo ?? 1);
    const characterId = String(req.body?.characterId ?? 'kai');
    const districtId = String(req.body?.districtId ?? session.districtId);
    const mode = String(req.body?.mode ?? session.mode);
    const bossDefeatedId = req.body?.bossDefeatedId
      ? String(req.body.bossDefeatedId)
      : null;
    const victory = Boolean(req.body?.victory);

    const serverElapsedSec = (Date.now() - session.startedAtMs) / 1000;
    const avgSpeedMps = distance / durationSec;
    const maxTheoreticalScore =
      distance * 35 + maxCombo * 600 + (bossDefeatedId ? 10000 : 1000);

    if (
      !Number.isFinite(score) ||
      !Number.isFinite(distance) ||
      score < 0 ||
      distance < 0 ||
      maxSpeedKmh > 310 ||
      avgSpeedMps > 95 ||
      durationSec > serverElapsedSec + 12 ||
      score > maxTheoreticalScore
    ) {
      res.status(400).json({
        error: 'Puntuación rechazada por verificación física anti-cheat del servidor.',
      });
      return;
    }

    // Server-side linear 8-boss progression validation
    let verifiedBossId: string | null = bossDefeatedId;
    if (verifiedBossId) {
      const idx = ORDERED_BOSS_IDS.indexOf(
        verifiedBossId as (typeof ORDERED_BOSS_IDS)[number],
      );
      if (idx === -1) {
        verifiedBossId = null;
      } else if (idx > 0) {
        const prevBossId = ORDERED_BOSS_IDS[idx - 1];
        const saveRow = getPlayerSaveJson(user.id);
        let defeated: string[] = [];
        if (saveRow.saveJson) {
          try {
            const parsed = JSON.parse(saveRow.saveJson) as { defeatedBosses?: string[] };
            defeated = Array.isArray(parsed.defeatedBosses) ? parsed.defeatedBosses : [];
          } catch {
            defeated = [];
          }
        }
        if (!defeated.includes(prevBossId) && !defeated.includes(verifiedBossId)) {
          res.status(403).json({
            error: `Debes derrotar primero al jefe anterior (${prevBossId}) antes de registrar ${verifiedBossId}.`,
          });
          return;
        }
      }
    }

    const record: SqliteRunRow = {
      id: `run_${crypto.randomUUID()}`,
      userId: user.id,
      playerName: user.username,
      avatarId: user.avatarId,
      characterId,
      districtId,
      mode,
      score: Math.floor(score),
      distance: Math.floor(distance),
      durationSec: Math.floor(durationSec),
      maxSpeedKmh: Math.floor(maxSpeedKmh),
      maxCombo: Math.min(30, Math.max(1, Math.floor(maxCombo))),
      bossDefeatedId: verifiedBossId,
      victory,
      createdAt: new Date().toISOString(),
      timestampMs: Date.now(),
      verified: true,
    };

    insertVerifiedRun(record, session.runId);
    res.status(201).json({ run: record, verified: true });
  });

  app.get('/api/rankings', (req, res) => {
    const scope = String(req.query.scope ?? 'global');
    const districtId = String(req.query.districtId ?? '');
    const characterId = String(req.query.characterId ?? '');
    const authUser = getAuthUser(req);

    const friendUsernames = authUser
      ? [authUser.username, ...authUser.friends]
      : [];

    const entries = queryRankings({
      scope,
      districtId,
      characterId,
      friendUsernames,
      limit: 30,
    });

    res.json({ scope, entries });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: roomManager.listPublicRooms() });
  });

  app.get('/api/events/online', (_req, res) => {
    res.json({
      weeklyChallenge: {
        id: 'wc_nextgen_01',
        title: 'Desafío Semanal: Caza en Skyline Zero',
        description:
          'Alcanza 1.500m en Skyline Zero y supera los 35.000 pts para aparecer en el Top Semanal.',
        districtId: 'skyline',
        targetDistance: 1500,
        targetScore: 35000,
        rewardCoins: 2500,
        rewardGems: 40,
      },
      bossOfWeek: {
        bossId: 'the_sentinel',
        districtId: 'future',
        bonusLabel: 'Recompensa x2 en Future District',
      },
    });
  });

  /* ---------------- STATIC FRONTEND / VITE MIDDLEWARE ---------------- */

  if (!IS_PROD && !options?.forceProdStatic) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = options?.distDir || path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  /* ---------------- HTTP + WEBSOCKET UPGRADE ---------------- */

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  roomManager.attachSocketServer(
    wss,
    (token) => {
      const payload = verifyToken<AuthSessionPayload>(token);
      if (!payload || payload.exp < Date.now()) return null;
      const u = findUserById(payload.uid);
      return u ? { id: u.id, username: u.username, avatarId: u.avatarId } : null;
    },
    (targetUsername) => {
      const target = findUserByIdentifier(targetUsername);
      return target ? { id: target.id, username: target.username } : null;
    },
  );

  const listenPort = options?.port ?? DEFAULT_PORT;
  const listenHost = options?.host ?? '0.0.0.0';

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      try {
        wss.close();
      } catch {
        // Ignore cleanup close
      }
      reject(err);
    };
    wss.once('error', onError);
    server.once('error', onError);
    server.listen(listenPort, listenHost, () => {
      wss.off('error', onError);
      server.off('error', onError);
      wss.on('error', (err) => {
        console.error('[METRO RUSH WS error]', err);
      });
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : listenPort;
      console.log(
        `METRO RUSH server (${dbEngine} + WS v${GAME_VERSION}) running on http://${listenHost}:${actualPort}`,
      );
      resolve();
    });
  });

  const addr = server.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : listenPort;

  return {
    port: boundPort,
    close: async () => {
      roomManager.dispose();
      await stopLanMatchHostServer();
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => server.close(() => r()));
      closeSqlite();
    },
  };
}

if (!process.env.METRO_RUSH_EMBEDDED) {
  void startAppServer();
}
