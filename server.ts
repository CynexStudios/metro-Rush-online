import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  addUserFriend,
  cleanResetTestRankingsAndStats,
  createUserAccount,
  findUserById,
  findUserByIdentifier,
  getDatabaseDiagnostics,
  getPlayerSaveJson,
  getUserRunHistory,
  hashSecret,
  insertVerifiedRun,
  isRunIdUsed,
  queryRankings,
  recordMultiplayerMatch,
  recoverUserPassword,
  SqliteRunRow,
  SqliteUserRow,
  updateUserAvatar,
  upsertPlayerSaveJson,
} from './src/db/sqlite';

const PORT = Number(process.env.PORT || 3000);
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

function sanitizeUser(u: SqliteUserRow) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatarId: u.avatarId,
    createdAt: u.createdAt,
    friends: u.friends,
    totalRuns: u.totalRuns,
    bestScore: u.bestScore,
    bestDistance: u.bestDistance,
  };
}

/* ---------------- REAL-TIME WEBSOCKET MULTIPLAYER ROOMS ---------------- */

interface RoomPeer {
  ws: WebSocket;
  userId: string;
  username: string;
  avatarId: string;
  characterId: string;
  ready: boolean;
  isHost: boolean;
  paused: boolean;
  finished: boolean;
  x: number;
  y: number;
  z: number;
  lane: number;
  distance: number;
  score: number;
  action: string;
  placement: number | null;
}

interface ServerRoom {
  code: string;
  name: string;
  hostId: string;
  isPublic: boolean;
  districtId: string;
  mode: string;
  status: 'lobby' | 'racing' | 'finished';
  maxPlayers: number;
  startedAtMs: number | null;
  finishCounter: number;
  peers: Map<string, RoomPeer>;
}

const activeRooms = new Map<string, ServerRoom>();
const onlineSocketsByUser = new Map<string, Set<WebSocket>>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return activeRooms.has(out) ? generateRoomCode() : out;
}

function serializeRoom(room: ServerRoom) {
  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    isPublic: room.isPublic,
    districtId: room.districtId,
    mode: room.mode,
    status: room.status,
    maxPlayers: room.maxPlayers,
    startedAtMs: room.startedAtMs,
    players: Array.from(room.peers.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      avatarId: p.avatarId,
      characterId: p.characterId,
      ready: p.ready,
      isHost: p.isHost,
      paused: p.paused,
      finished: p.finished,
      distance: Math.floor(p.distance),
      score: Math.floor(p.score),
      placement: p.placement,
    })),
  };
}

function sendWs(ws: WebSocket, event: string, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, payload }));
  }
}

function broadcastRoom(room: ServerRoom, event: string, payload: unknown): void {
  for (const peer of room.peers.values()) {
    sendWs(peer.ws, event, payload);
  }
}

function broadcastRoomTelemetry(room: ServerRoom): void {
  const players = Array.from(room.peers.values()).map((p) => ({
    userId: p.userId,
    username: p.username,
    avatarId: p.avatarId,
    characterId: p.characterId,
    x: p.x,
    y: p.y,
    z: p.z,
    lane: p.lane,
    distance: Math.floor(p.distance),
    score: Math.floor(p.score),
    action: p.action,
    paused: p.paused,
    finished: p.finished,
    placement: p.placement ?? undefined,
  }));
  broadcastRoom(room, 'room:telemetry', { code: room.code, players });
}

function leaveCurrentRoom(ws: WebSocket, peerUserId: string, currentCode: string | null): void {
  if (!currentCode) return;
  const room = activeRooms.get(currentCode);
  if (!room) return;
  const existing = room.peers.get(peerUserId);
  if (existing && existing.ws === ws) {
    room.peers.delete(peerUserId);
  }
  if (room.peers.size === 0) {
    activeRooms.delete(currentCode);
    return;
  }
  if (room.hostId === peerUserId) {
    const nextHost = room.peers.values().next().value as RoomPeer | undefined;
    if (nextHost) {
      nextHost.isHost = true;
      room.hostId = nextHost.userId;
    }
  }
  broadcastRoom(room, 'room:state', serializeRoom(room));
}

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    const dbStats = getDatabaseDiagnostics();
    res.json({
      ok: true,
      mode: IS_PROD ? 'production' : 'development',
      dbEngine: 'sqlite',
      users: dbStats.userCount,
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
        'Base de datos SQLite local persistente guardada fuera de la carpeta del proyecto.',
    });
  });

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
      res.status(400).json({
        error: 'Introduce un correo electrónico válido.',
      });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres.',
      });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({
        error: 'Las contraseñas no coinciden.',
      });
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
      exp: Date.now() + 14 * 86400_000,
    });
    res.status(201).json({
      token,
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
      exp: Date.now() + 14 * 86400_000,
    });
    res.json({ token, user: sanitizeUser(user) });
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
    if (!save || typeof save !== 'object') {
      res.status(400).json({ error: 'Datos de guardado inválidos.' });
      return;
    }
    const updatedAt = upsertPlayerSaveJson(user.id, save);
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
      format: 'metro-rush-sqlite-backup-v1',
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
      distance * 35 + maxCombo * 600 + (bossDefeatedId ? 8000 : 1000);

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
        error:
          'Puntuación rechazada por verificación física anti-cheat del servidor.',
      });
      return;
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
      bossDefeatedId,
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
    const list = Array.from(activeRooms.values())
      .filter((r) => r.isPublic && r.status === 'lobby' && r.peers.size < r.maxPlayers)
      .map((r) => ({
        code: r.code,
        name: r.name,
        districtId: r.districtId,
        mode: r.mode,
        playerCount: r.peers.size,
        maxPlayers: r.maxPlayers,
        hostName: r.peers.get(r.hostId)?.username ?? 'Host',
      }));
    res.json({ rooms: list });
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

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let userId = `guest_${crypto.randomUUID().slice(0, 8)}`;
    let username = `INVITADO_${userId.slice(-4).toUpperCase()}`;
    let avatarId = 'kai';
    let currentRoomCode: string | null = null;

    const trackUserSocket = (uid: string) => {
      let set = onlineSocketsByUser.get(uid);
      if (!set) {
        set = new Set();
        onlineSocketsByUser.set(uid, set);
      }
      set.add(ws);
    };

    const untrackUserSocket = (uid: string) => {
      const set = onlineSocketsByUser.get(uid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) onlineSocketsByUser.delete(uid);
      }
    };

    ws.on('message', (raw) => {
      let msg: { event?: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString()) as {
          event?: string;
          payload?: Record<string, unknown>;
        };
      } catch {
        return;
      }

      const event = msg.event;
      const p = msg.payload ?? {};

      if (event === 'auth') {
        const token = typeof p.token === 'string' ? p.token : '';
        const authPayload = token ? verifyToken<AuthSessionPayload>(token) : null;
        if (authPayload && authPayload.exp >= Date.now()) {
          const user = findUserById(authPayload.uid);
          if (user) {
            untrackUserSocket(userId);
            userId = user.id;
            username = user.username;
            avatarId = user.avatarId;
            trackUserSocket(userId);
          }
        } else if (typeof p.guestName === 'string' && p.guestName.trim()) {
          username = p.guestName.trim().slice(0, 18);
          trackUserSocket(userId);
        }
        sendWs(ws, 'auth:ok', { userId, username, avatarId });
        return;
      }

      if (event === 'room:create') {
        leaveCurrentRoom(ws, userId, currentRoomCode);
        const code = generateRoomCode();
        const characterId = String(p.characterId ?? 'kai');
        const districtId = String(p.districtId ?? 'downtown');
        const mode = String(p.mode ?? 'endless');
        const isPublic = p.isPublic !== false;
        const maxPlayers = Math.min(8, Math.max(2, Number(p.maxPlayers ?? 4)));
        const name = String(p.name ?? `Sala de ${username}`).slice(0, 32);

        const room: ServerRoom = {
          code,
          name,
          hostId: userId,
          isPublic,
          districtId,
          mode,
          status: 'lobby',
          maxPlayers,
          startedAtMs: null,
          finishCounter: 0,
          peers: new Map(),
        };
        room.peers.set(userId, {
          ws,
          userId,
          username,
          avatarId,
          characterId,
          ready: true,
          isHost: true,
          paused: false,
          finished: false,
          x: 0,
          y: 0,
          z: 0,
          lane: 1,
          distance: 0,
          score: 0,
          action: 'idle',
          placement: null,
        });
        activeRooms.set(code, room);
        currentRoomCode = code;
        sendWs(ws, 'room:state', serializeRoom(room));
        return;
      }

      if (event === 'room:join') {
        const code = String(p.code ?? '').trim().toUpperCase();
        const room = activeRooms.get(code);
        if (!room) {
          sendWs(ws, 'room:error', { error: `Sala ${code} no encontrada.` });
          return;
        }
        if (room.peers.size >= room.maxPlayers && !room.peers.has(userId)) {
          sendWs(ws, 'room:error', { error: 'La sala está llena.' });
          return;
        }
        if (room.status === 'racing' && !room.peers.has(userId)) {
          sendWs(ws, 'room:error', { error: 'La carrera ya ha comenzado.' });
          return;
        }
        if (currentRoomCode && currentRoomCode !== code) {
          leaveCurrentRoom(ws, userId, currentRoomCode);
        }
        const characterId = String(p.characterId ?? 'kai');
        room.peers.set(userId, {
          ws,
          userId,
          username,
          avatarId,
          characterId,
          ready: false,
          isHost: room.hostId === userId,
          paused: false,
          finished: false,
          x: 0,
          y: 0,
          z: 0,
          lane: 1,
          distance: 0,
          score: 0,
          action: 'idle',
          placement: null,
        });
        currentRoomCode = code;
        broadcastRoom(room, 'room:state', serializeRoom(room));
        return;
      }

      if (event === 'room:leave') {
        leaveCurrentRoom(ws, userId, currentRoomCode);
        currentRoomCode = null;
        sendWs(ws, 'room:left', {});
        return;
      }

      if (!currentRoomCode) return;
      const room = activeRooms.get(currentRoomCode);
      if (!room) return;
      const peer = room.peers.get(userId);
      if (!peer) return;

      if (event === 'room:ready') {
        peer.ready = Boolean(p.ready);
        if (typeof p.characterId === 'string') {
          peer.characterId = p.characterId;
        }
        broadcastRoom(room, 'room:state', serializeRoom(room));
        return;
      }

      if (event === 'room:config' && room.hostId === userId && room.status === 'lobby') {
        if (typeof p.districtId === 'string') room.districtId = p.districtId;
        if (typeof p.mode === 'string') room.mode = p.mode;
        if (typeof p.isPublic === 'boolean') room.isPublic = p.isPublic;
        broadcastRoom(room, 'room:state', serializeRoom(room));
        return;
      }

      if (event === 'room:start' && room.hostId === userId) {
        room.status = 'racing';
        room.startedAtMs = Date.now();
        room.finishCounter = 0;
        for (const rPeer of room.peers.values()) {
          rPeer.paused = false;
          rPeer.finished = false;
          rPeer.distance = 0;
          rPeer.score = 0;
          rPeer.placement = null;
        }
        broadcastRoom(room, 'room:started', serializeRoom(room));
        broadcastRoom(room, 'room:state', serializeRoom(room));
        return;
      }

      if (event === 'room:invite') {
        const targetUsername = String(p.targetUsername ?? '').trim();
        const target = findUserByIdentifier(targetUsername);
        if (!target) {
          sendWs(ws, 'room:error', { error: `Usuario "${targetUsername}" no conectado.` });
          return;
        }
        const targets = onlineSocketsByUser.get(target.id);
        if (!targets || targets.size === 0) {
          sendWs(ws, 'room:error', {
            error: `${target.username} no tiene la red online abierta ahora mismo.`,
          });
          return;
        }
        for (const tWs of targets) {
          sendWs(tWs, 'room:invited', {
            code: room.code,
            fromUsername: username,
            districtId: room.districtId,
            mode: room.mode,
          });
        }
        sendWs(ws, 'room:info', { message: `Invitación enviada a ${target.username}.` });
        return;
      }

      if (event === 'player:telemetry') {
        peer.x = Number(p.x ?? peer.x);
        peer.y = Number(p.y ?? peer.y);
        peer.z = Number(p.z ?? peer.z);
        peer.lane = Number(p.lane ?? peer.lane);
        peer.distance = Number(p.distance ?? peer.distance);
        peer.score = Number(p.score ?? peer.score);
        peer.action = String(p.action ?? peer.action);
        peer.paused = Boolean(p.paused);
        broadcastRoomTelemetry(room);
        return;
      }

      if (event === 'player:pause') {
        peer.paused = Boolean(p.paused);
        broadcastRoom(room, 'room:state', serializeRoom(room));
        broadcastRoomTelemetry(room);
        return;
      }

      if (event === 'player:finish') {
        if (!peer.finished) {
          peer.finished = true;
          peer.paused = false;
          peer.distance = Math.max(peer.distance, Number(p.distance ?? 0));
          peer.score = Math.max(peer.score, Number(p.score ?? 0));
          room.finishCounter += 1;
          peer.placement = room.finishCounter;
        }
        const allFinished = Array.from(room.peers.values()).every((rPeer) => rPeer.finished);
        if (allFinished) {
          room.status = 'finished';
          recordMultiplayerMatch({
            roomCode: room.code,
            districtId: room.districtId,
            mode: room.mode,
            results: serializeRoom(room).players,
          });
        }
        broadcastRoom(room, 'room:state', serializeRoom(room));
        broadcastRoomTelemetry(room);
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(ws, userId, currentRoomCode);
      untrackUserSocket(userId);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`METRO RUSH server (SQLite + WebSocket) running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
