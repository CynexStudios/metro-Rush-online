import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import { WebSocket, WebSocketServer } from 'ws';
import { recordIdempotentTx, getIdempotentTx, recordMultiplayerMatch } from '../db/sqlite';
import {
  ConnectionQuality,
  LanHostState,
  LanInterfaceInfo,
  MultiplayerRoomPlayer,
  MultiplayerRoomState,
  NetworkConnectionMode,
  PlayerModelStyle,
  RoomRulesConfig,
  VehicleId,
} from '../game/types';
import { GAME_VERSION, isVersionCompatible } from '../game/version';

const FIVE_LANE_DISTRICTS = new Set<string>();

export interface RoomPeerInternal {
  ws: WebSocket;
  userId: string;
  username: string;
  avatarId: string;
  characterId: string;
  modelStyle: PlayerModelStyle;
  ready: boolean;
  isHost: boolean;
  paused: boolean;
  finished: boolean;
  connected: boolean;
  reconnecting: boolean;
  disconnectTimer: NodeJS.Timeout | null;
  pingMs: number;
  connectionQuality: ConnectionQuality;
  x: number;
  y: number;
  z: number;
  rotY: number;
  lane: number;
  distance: number;
  score: number;
  coins: number;
  eliminations: number;
  hitsTaken: number;
  action: string;
  isRidingVehicle: boolean;
  vehicleId?: VehicleId;
  abilityActive: boolean;
  placement: number | null;
  rewardCoins: number;
  rewardGems: number;
  lastTickMs: number;
  lastAbilityMs: number;
  lastInterferenceMs: number;
  antiCheatStrikes: number;
}

export interface AuthoritativeRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  isPublic: boolean;
  districtId: string;
  mode: string;
  status: 'lobby' | 'racing' | 'finished';
  maxPlayers: number;
  gameVersion: string;
  connectionMode: NetworkConnectionMode;
  rules: RoomRulesConfig;
  startedAtMs: number | null;
  finishCounter: number;
  peers: Map<string, RoomPeerInternal>;
}

function classifyNetworkInterface(name: string, address: string, internal: boolean): {
  kind: 'lan' | 'vpn' | 'virtual' | 'loopback';
  label: string;
} {
  if (internal || address === '127.0.0.1') {
    return { kind: 'loopback', label: 'Localhost' };
  }
  const lower = name.toLowerCase();
  if (/radmin/i.test(lower) || address.startsWith('26.')) {
    return { kind: 'vpn', label: 'VPN (Radmin VPN)' };
  }
  if (/zerotier/i.test(lower)) {
    return { kind: 'vpn', label: 'VPN (ZeroTier)' };
  }
  if (/tailscale/i.test(lower) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address)) {
    return { kind: 'vpn', label: 'VPN (Tailscale)' };
  }
  if (/hamachi/i.test(lower) || address.startsWith('25.')) {
    return { kind: 'vpn', label: 'VPN (Hamachi)' };
  }
  if (/vethernet|wsl|vmware|virtualbox|vbox|hyper-v|docker/i.test(lower)) {
    return { kind: 'virtual', label: 'Adaptador Virtual' };
  }
  if (
    address.startsWith('192.168.') ||
    address.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  ) {
    return { kind: 'lan', label: 'Red Local (LAN / Wi-Fi)' };
  }
  return { kind: 'lan', label: 'Red IPv4' };
}

function scoreInterfacePriority(info: LanInterfaceInfo): number {
  if (info.internal) return 100;
  if (info.address.startsWith('169.254.')) return 90;
  if (info.kind === 'virtual') return 50;
  if (info.kind === 'vpn') return 4;
  if (info.address.startsWith('192.168.')) return 1;
  if (info.address.startsWith('10.')) return 2;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(info.address)) return 3;
  return 10;
}

export function listLocalNetworkInterfaces(): LanInterfaceInfo[] {
  const nets = os.networkInterfaces();
  const list: LanInterfaceInfo[] = [];
  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const info of addrs) {
      if (info.family === 'IPv4') {
        const cls = classifyNetworkInterface(name, info.address, info.internal);
        list.push({
          name,
          address: info.address,
          family: info.family,
          internal: info.internal,
          kind: cls.kind,
          label: cls.label,
        });
      }
    }
  }
  const hasRealLan = list.some(
    (i) => !i.internal && !i.address.startsWith('169.254.'),
  );
  const filtered = hasRealLan
    ? list.filter((i) => !i.address.startsWith('169.254.'))
    : list;
  return filtered.sort(
    (a, b) => scoreInterfacePriority(a) - scoreInterfacePriority(b),
  );
}

function classifyQuality(pingMs: number): ConnectionQuality {
  if (pingMs <= 45) return 'excellent';
  if (pingMs <= 105) return 'good';
  if (pingMs <= 185) return 'fair';
  return 'poor';
}

function sendWs(ws: WebSocket, event: string, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, payload }));
  }
}

export class AuthoritativeRoomManager {
  public readonly activeRooms = new Map<string, AuthoritativeRoom>();
  public readonly onlineSocketsByUser = new Map<string, Set<WebSocket>>();
  public readonly onlineUserProfiles = new Map<string, { id: string; username: string }>();
  public onRoomClosed?: (roomCode: string, reason: 'room_closed' | 'host_offline') => void;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const room of this.activeRooms.values()) {
        for (const peer of room.peers.values()) {
          if (peer.connected && peer.ws.readyState === WebSocket.OPEN) {
            sendWs(peer.ws, 'net:ping', { ts: now });
          }
        }
      }
    }, 2000);
  }

  public dispose(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    for (const room of this.activeRooms.values()) {
      for (const peer of room.peers.values()) {
        if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
        sendWs(peer.ws, 'room:host_closed', {
          code: room.code,
          reason: 'El anfitrión cerró la partida.',
        });
      }
      this.onRoomClosed?.(room.code, 'host_offline');
    }
    this.activeRooms.clear();
    this.onlineSocketsByUser.clear();
    this.onlineUserProfiles.clear();
  }

  public isUserOnline(userId: string): boolean {
    const s = this.onlineSocketsByUser.get(userId);
    return Boolean(s && s.size > 0);
  }

  public sendToUser(userId: string, event: string, payload: unknown): boolean {
    const s = this.onlineSocketsByUser.get(userId);
    if (!s || s.size === 0) return false;
    let sent = false;
    for (const sock of s) {
      if (sock.readyState === WebSocket.OPEN) {
        sendWs(sock, event, payload);
        sent = true;
      }
    }
    return sent;
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return this.activeRooms.has(out) ? this.generateRoomCode() : out;
  }

  public serializeRoom(room: AuthoritativeRoom): MultiplayerRoomState {
    const players: MultiplayerRoomPlayer[] = Array.from(room.peers.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      avatarId: p.avatarId,
      characterId: p.characterId,
      ready: p.ready,
      isHost: p.isHost,
      paused: p.paused,
      finished: p.finished,
      connected: p.connected,
      reconnecting: p.reconnecting,
      pingMs: p.pingMs,
      connectionQuality: p.connectionQuality,
      distance: Math.floor(p.distance),
      score: Math.floor(p.score),
      placement: p.placement,
      rewardCoins: p.rewardCoins,
      rewardGems: p.rewardGems,
    }));

    return {
      id: room.id,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      isPublic: room.isPublic,
      districtId: room.districtId as MultiplayerRoomState['districtId'],
      mode: room.mode as MultiplayerRoomState['mode'],
      status: room.status,
      maxPlayers: room.maxPlayers,
      gameVersion: room.gameVersion,
      connectionMode: room.connectionMode,
      rules: room.rules,
      startedAtMs: room.startedAtMs,
      players,
    };
  }

  public broadcastRoom(room: AuthoritativeRoom, event: string, payload: unknown): void {
    for (const peer of room.peers.values()) {
      if (peer.connected) {
        sendWs(peer.ws, event, payload);
      }
    }
  }

  public broadcastRoomTelemetry(room: AuthoritativeRoom): void {
    const players = Array.from(room.peers.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      avatarId: p.avatarId,
      characterId: p.characterId,
      modelStyle: p.modelStyle,
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      lane: p.lane,
      distance: Math.floor(p.distance),
      score: Math.floor(p.score),
      action: p.action,
      isRidingVehicle: p.isRidingVehicle,
      vehicleId: p.vehicleId,
      abilityActive: p.abilityActive,
      paused: p.paused,
      finished: p.finished,
      placement: p.placement ?? undefined,
      pingMs: p.pingMs,
      validated: p.antiCheatStrikes < 5,
    }));
    this.broadcastRoom(room, 'room:telemetry', { code: room.code, players });
  }

  public listPublicRooms() {
    return Array.from(this.activeRooms.values())
      .filter((r) => r.isPublic && r.status === 'lobby' && r.peers.size < r.maxPlayers)
      .map((r) => ({
        code: r.code,
        name: r.name,
        districtId: r.districtId,
        mode: r.mode,
        playerCount: r.peers.size,
        maxPlayers: r.maxPlayers,
        hostName: r.peers.get(r.hostId)?.username ?? 'Anfitrión',
        gameVersion: r.gameVersion,
        connectionMode: r.connectionMode,
      }));
  }

  private closeRoomAsHostEnded(room: AuthoritativeRoom, reason: string): void {
    for (const peer of room.peers.values()) {
      if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
      if (peer.connected) {
        sendWs(peer.ws, 'room:host_closed', { code: room.code, reason });
      }
    }
    this.activeRooms.delete(room.code);
    this.onRoomClosed?.(room.code, 'host_offline');
  }

  public handlePeerDisconnect(
    ws: WebSocket,
    peerUserId: string,
    currentCode: string | null,
    explicitLeave = false,
  ): void {
    if (!currentCode) return;
    const room = this.activeRooms.get(currentCode);
    if (!room) return;
    const peer = room.peers.get(peerUserId);
    if (!peer || peer.ws !== ws) return;

    if (room.hostId === peerUserId) {
      this.closeRoomAsHostEnded(room, 'El anfitrión cerró la partida.');
      return;
    }

    if (!explicitLeave && room.status === 'racing') {
      peer.connected = false;
      peer.reconnecting = true;
      peer.paused = true;
      if (peer.disconnectTimer) clearTimeout(peer.disconnectTimer);
      peer.disconnectTimer = setTimeout(() => {
        const curRoom = this.activeRooms.get(currentCode);
        if (!curRoom) return;
        const p = curRoom.peers.get(peerUserId);
        if (p && !p.connected) {
          curRoom.peers.delete(peerUserId);
          this.broadcastRoom(curRoom, 'room:info', {
            message: `${p.username} se desconectó y expiró su ventana de reconexión.`,
          });
          this.broadcastRoom(curRoom, 'room:state', this.serializeRoom(curRoom));
        }
      }, 45_000);

      this.broadcastRoom(room, 'room:info', {
        message: `${peer.username} perdió la conexión (esperando reconexión 45s)...`,
      });
      this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
      return;
    }

    room.peers.delete(peerUserId);
    if (room.peers.size === 0) {
      this.activeRooms.delete(currentCode);
      this.onRoomClosed?.(currentCode, 'room_closed');
      return;
    }
    this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
  }

  public attachSocketServer(
    wss: WebSocketServer,
    authenticateToken: (token: string) => {
      id: string;
      username: string;
      avatarId: string;
    } | null,
    findOnlineTarget?: (username: string) => { id: string; username: string } | null,
  ): void {
    wss.on('connection', (ws) => {
      let userId = `guest_${crypto.randomUUID().slice(0, 8)}`;
      let username = `CORREDOR_${userId.slice(-4).toUpperCase()}`;
      let avatarId = 'kai';
      let currentRoomCode: string | null = null;

      const trackUserSocket = (uid: string, uname?: string) => {
        let set = this.onlineSocketsByUser.get(uid);
        if (!set) {
          set = new Set();
          this.onlineSocketsByUser.set(uid, set);
        }
        set.add(ws);
        if (uname) {
          this.onlineUserProfiles.set(uid, { id: uid, username: uname });
        }
      };

      const untrackUserSocket = (uid: string) => {
        const set = this.onlineSocketsByUser.get(uid);
        if (set) {
          set.delete(ws);
          if (set.size === 0) this.onlineSocketsByUser.delete(uid);
        }
      };

      ws.on('message', (raw) => {
        let msg: { event?: string; payload?: Record<string, unknown> };
        try {
          msg = JSON.parse(String(raw));
        } catch {
          return;
        }
        const event = String(msg.event || '');
        const p = msg.payload ?? {};

        if (event === 'auth') {
          const clientVersion = p.gameVersion ? String(p.gameVersion) : GAME_VERSION;
          if (!isVersionCompatible(clientVersion)) {
            sendWs(ws, 'room:error', {
              code: 'VERSION_MISMATCH',
              error: `La versión del juego no coincide (tuya: ${clientVersion}, servidor: ${GAME_VERSION}).`,
            });
            return;
          }

          untrackUserSocket(userId);
          const token = String(p.token || '');
          const authUser = token ? authenticateToken(token) : null;
          if (authUser) {
            userId = authUser.id;
            username = authUser.username;
            avatarId = authUser.avatarId;
          } else {
            const guestName = String(p.guestName || '').trim().slice(0, 18);
            const persistentClientId = String(p.clientId || '').trim().slice(0, 48);
            if (persistentClientId) {
              userId = `pc_${persistentClientId}`;
            }
            if (guestName) username = guestName;
          }
          trackUserSocket(userId, username);
          sendWs(ws, 'auth:ok', {
            userId,
            username,
            avatarId,
            gameVersion: GAME_VERSION,
          });
          return;
        }

        if (event === 'net:pong') {
          if (!currentRoomCode) return;
          const room = this.activeRooms.get(currentRoomCode);
          const peer = room?.peers.get(userId);
          const sentTs = Number(p.ts ?? 0);
          if (peer && sentTs > 0) {
            const rtt = Math.max(1, Math.min(2000, Date.now() - sentTs));
            peer.pingMs = rtt;
            peer.connectionQuality = classifyQuality(rtt);
          }
          return;
        }

        if (event === 'room:create') {
          const clientVer = p.gameVersion ? String(p.gameVersion) : GAME_VERSION;
          if (!isVersionCompatible(clientVer)) {
            sendWs(ws, 'room:error', {
              code: 'VERSION_MISMATCH',
              error: `La versión del juego no coincide (${clientVer} vs ${GAME_VERSION}).`,
            });
            return;
          }

          this.handlePeerDisconnect(ws, userId, currentRoomCode, true);
          const code = this.generateRoomCode();
          const maxPlayers = Math.min(8, Math.max(2, Number(p.maxPlayers ?? 6)));
          const connectionMode = (
            ['lan', 'internet_ws', 'internet_webrtc'].includes(String(p.connectionMode))
              ? String(p.connectionMode)
              : 'lan'
          ) as NetworkConnectionMode;

          const rawRules = (p.rules as Partial<RoomRulesConfig> | undefined) ?? {};
          const rules: RoomRulesConfig = {
            allowVehicles: rawRules.allowVehicles ?? true,
            allowAbilities: rawRules.allowAbilities ?? true,
            difficulty: rawRules.difficulty ?? 'normal',
            targetDistance: rawRules.targetDistance ?? null,
          };

          const room: AuthoritativeRoom = {
            id: `room_${crypto.randomUUID()}`,
            code,
            name: String(p.name || `Sala de ${username}`).slice(0, 32),
            hostId: userId,
            isPublic: Boolean(p.isPublic ?? true),
            districtId: String(p.districtId || 'downtown'),
            mode: String(p.mode || 'endless'),
            status: 'lobby',
            maxPlayers,
            gameVersion: GAME_VERSION,
            connectionMode,
            rules,
            startedAtMs: null,
            finishCounter: 0,
            peers: new Map(),
          };
          const initialCenterLane = FIVE_LANE_DISTRICTS.has(room.districtId) ? 2 : 1;
          room.peers.set(userId, {
            ws,
            userId,
            username,
            avatarId,
            characterId: String(p.characterId || 'kai'),
            modelStyle: 'procedural',
            ready: true,
            isHost: true,
            paused: false,
            finished: false,
            connected: true,
            reconnecting: false,
            disconnectTimer: null,
            pingMs: 1,
            connectionQuality: 'excellent',
            x: 0,
            y: 0,
            z: 0,
            rotY: 0,
            lane: initialCenterLane,
            distance: 0,
            score: 0,
            coins: 0,
            eliminations: 0,
            hitsTaken: 0,
            action: 'idle',
            isRidingVehicle: false,
            vehicleId: undefined,
            abilityActive: false,
            placement: null,
            rewardCoins: 0,
            rewardGems: 0,
            lastTickMs: Date.now(),
            lastAbilityMs: 0,
            lastInterferenceMs: 0,
            antiCheatStrikes: 0,
          });
          this.activeRooms.set(code, room);
          currentRoomCode = code;
          sendWs(ws, 'room:state', this.serializeRoom(room));
          return;
        }

        if (event === 'room:join') {
          const clientVer = p.gameVersion ? String(p.gameVersion) : GAME_VERSION;
          if (!isVersionCompatible(clientVer)) {
            sendWs(ws, 'room:error', {
              code: 'VERSION_MISMATCH',
              error: `La versión del juego no coincide (tuya: ${clientVer}, anfitrión: ${GAME_VERSION}).`,
            });
            return;
          }

          const code = String(p.code || '').trim().toUpperCase();
          const room = this.activeRooms.get(code);
          if (!room) {
            sendWs(ws, 'room:error', {
              code: 'ROOM_NOT_FOUND',
              error: 'No se encontró ninguna partida con ese código.',
            });
            return;
          }

          const existingPeer = room.peers.get(userId);
          if (existingPeer && existingPeer.reconnecting) {
            if (existingPeer.disconnectTimer) {
              clearTimeout(existingPeer.disconnectTimer);
              existingPeer.disconnectTimer = null;
            }
            existingPeer.ws = ws;
            existingPeer.connected = true;
            existingPeer.reconnecting = false;
            existingPeer.paused = false;
            existingPeer.lastTickMs = Date.now();
            currentRoomCode = code;
            sendWs(ws, 'room:state', this.serializeRoom(room));
            if (room.status === 'racing') {
              sendWs(ws, 'room:started', this.serializeRoom(room));
            }
            this.broadcastRoom(room, 'room:info', {
              message: `${existingPeer.username} se reconectó a la carrera.`,
            });
            this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
            return;
          }

          if (room.peers.size >= room.maxPlayers) {
            sendWs(ws, 'room:error', {
              code: 'ROOM_FULL',
              error: 'La sala está llena.',
            });
            return;
          }
          if (room.status !== 'lobby') {
            sendWs(ws, 'room:error', {
              code: 'RACE_IN_PROGRESS',
              error: 'La carrera ya ha comenzado en esa sala.',
            });
            return;
          }

          this.handlePeerDisconnect(ws, userId, currentRoomCode, true);
          const joinCenterLane = FIVE_LANE_DISTRICTS.has(room.districtId) ? 2 : 1;
          room.peers.set(userId, {
            ws,
            userId,
            username,
            avatarId,
            characterId: String(p.characterId || 'kai'),
            modelStyle: 'procedural',
            ready: false,
            isHost: false,
            paused: false,
            finished: false,
            connected: true,
            reconnecting: false,
            disconnectTimer: null,
            pingMs: 12,
            connectionQuality: 'excellent',
            x: 0,
            y: 0,
            z: 0,
            rotY: 0,
            lane: joinCenterLane,
            distance: 0,
            score: 0,
            coins: 0,
            eliminations: 0,
            hitsTaken: 0,
            action: 'idle',
            isRidingVehicle: false,
            vehicleId: undefined,
            abilityActive: false,
            placement: null,
            rewardCoins: 0,
            rewardGems: 0,
            lastTickMs: Date.now(),
            lastAbilityMs: 0,
            lastInterferenceMs: 0,
            antiCheatStrikes: 0,
          });
          currentRoomCode = code;
          this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
          return;
        }

        if (event === 'room:leave') {
          this.handlePeerDisconnect(ws, userId, currentRoomCode, true);
          currentRoomCode = null;
          sendWs(ws, 'room:left', {});
          return;
        }

        if (!currentRoomCode) return;
        const room = this.activeRooms.get(currentRoomCode);
        if (!room) return;
        const peer = room.peers.get(userId);
        if (!peer) return;

        if (event === 'room:ready') {
          peer.ready = Boolean(p.ready);
          if (p.characterId) peer.characterId = String(p.characterId);
          this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
          return;
        }

        if (event === 'room:config' && room.hostId === userId && room.status === 'lobby') {
          if (p.districtId) room.districtId = String(p.districtId);
          if (p.mode) room.mode = String(p.mode);
          if (p.isPublic !== undefined) room.isPublic = Boolean(p.isPublic);
          if (p.maxPlayers !== undefined) {
            room.maxPlayers = Math.min(8, Math.max(room.peers.size, Number(p.maxPlayers)));
          }
          if (p.rules && typeof p.rules === 'object') {
            room.rules = { ...room.rules, ...(p.rules as Partial<RoomRulesConfig>) };
          }
          this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
          return;
        }

        if (event === 'room:kick' && room.hostId === userId) {
          const targetId = String(p.targetUserId || '');
          if (!targetId || targetId === userId) return;
          const targetPeer = room.peers.get(targetId);
          if (!targetPeer) return;
          if (targetPeer.disconnectTimer) clearTimeout(targetPeer.disconnectTimer);
          sendWs(targetPeer.ws, 'room:kicked', {
            code: room.code,
            reason: 'El anfitrión te expulsó de la sala.',
          });
          room.peers.delete(targetId);
          this.broadcastRoom(room, 'room:info', {
            message: `${targetPeer.username} fue expulsado de la sala por el anfitrión.`,
          });
          this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
          return;
        }

        if (event === 'room:start' && room.hostId === userId) {
          const unready = Array.from(room.peers.values()).filter((r) => !r.ready);
          if (unready.length > 0 && !p.forceStart) {
            sendWs(ws, 'room:error', {
              error: 'Todos los jugadores deben marcarse como Listos para iniciar.',
            });
            return;
          }
          room.status = 'racing';
          room.startedAtMs = Date.now();
          room.finishCounter = 0;
          const now = Date.now();
          const startCenterLane = FIVE_LANE_DISTRICTS.has(room.districtId) ? 2 : 1;
          for (const rPeer of room.peers.values()) {
            rPeer.finished = false;
            rPeer.paused = false;
            rPeer.x = 0;
            rPeer.y = 0;
            rPeer.z = 0;
            rPeer.rotY = 0;
            rPeer.lane = startCenterLane;
            rPeer.action = 'run';
            rPeer.isRidingVehicle = false;
            rPeer.vehicleId = undefined;
            rPeer.abilityActive = false;
            rPeer.distance = 0;
            rPeer.score = 0;
            rPeer.coins = 0;
            rPeer.eliminations = 0;
            rPeer.hitsTaken = 0;
            rPeer.placement = null;
            rPeer.rewardCoins = 0;
            rPeer.rewardGems = 0;
            rPeer.lastTickMs = now;
            rPeer.lastAbilityMs = 0;
            rPeer.lastInterferenceMs = 0;
            rPeer.antiCheatStrikes = 0;
          }
          const state = this.serializeRoom(room);
          this.broadcastRoom(room, 'room:state', state);
          this.broadcastRoom(room, 'room:started', state);
          this.broadcastRoomTelemetry(room);
          return;
        }

        if (event === 'room:invite') {
          const targetUsername = String(p.targetUsername ?? '').trim();
          const targetUserId = String(p.targetUserId ?? '').trim();
          let target: { id: string; username: string } | null = null;
          if (targetUserId && this.onlineUserProfiles.has(targetUserId)) {
            target = this.onlineUserProfiles.get(targetUserId)!;
          }
          if (!target && targetUsername) {
            for (const prof of this.onlineUserProfiles.values()) {
              if (prof.username.toLowerCase() === targetUsername.toLowerCase()) {
                target = prof;
                break;
              }
            }
          }
          if (!target && findOnlineTarget) {
            target = findOnlineTarget(targetUsername || targetUserId);
          }
          if (!target) {
            sendWs(ws, 'room:error', {
              error: `Usuario "${targetUsername || targetUserId}" no encontrado en el servidor activo.`,
            });
            return;
          }
          const targets = this.onlineSocketsByUser.get(target.id);
          if (!targets || targets.size === 0) {
            sendWs(ws, 'room:info', {
              message: `${target.username} está desconectado actualmente; si usas cuenta online recibirá la invitación al volver.`,
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
          sendWs(ws, 'room:info', {
            message: `Invitación enviada en tiempo real a ${target.username}.`,
          });
          return;
        }

        // WebRTC SDP / ICE Signaling Relay inside Room
        if (event === 'rtc:signal') {
          const toUserId = String(p.toUserId || '');
          const target = room.peers.get(toUserId);
          if (target && target.connected) {
            sendWs(target.ws, 'rtc:signal', {
              fromUserId: userId,
              signalType: p.signalType,
              sdp: p.sdp,
              candidate: p.candidate,
            });
          }
          return;
        }

        // Authoritative Telemetry & Anti-Cheat Validation
        if (event === 'player:telemetry' && room.status === 'racing') {
          const now = Date.now();
          const dtSec = Math.max(0.025, Math.min(2.0, (now - peer.lastTickMs) / 1000));
          peer.lastTickMs = now;

          const maxLaneIdx = FIVE_LANE_DISTRICTS.has(room.districtId) ? 4 : 2;
          const rawX = Number(p.x ?? peer.x);
          const rawY = Number(p.y ?? peer.y);
          const rawZ = Number(p.z ?? peer.z);
          const rawRotY = Number(p.rotY ?? peer.rotY);
          const rawLane = Math.max(0, Math.min(maxLaneIdx, Math.round(Number(p.lane ?? peer.lane))));
          const rawDistance = Math.max(0, Number(p.distance ?? peer.distance));
          const rawScore = Math.max(0, Number(p.score ?? peer.score));
          const rawAction = String(p.action ?? peer.action);
          const rawPaused = Boolean(p.paused);

          // Anti-cheat physics speed cap: max 74 m/s (~266 km/h)
          const maxStepDistance = rawPaused ? 0 : 74 * dtSec + 8;
          const distDelta = rawDistance - peer.distance;
          let validatedDist = peer.distance;
          if (distDelta >= 0 && distDelta <= maxStepDistance) {
            validatedDist = rawDistance;
          } else if (distDelta > maxStepDistance) {
            peer.antiCheatStrikes += 1;
            validatedDist = peer.distance + maxStepDistance;
          }

          // Anti-cheat score sanity ratio
          const maxAllowedTotalScore = validatedDist * 45 + 3500;
          const validatedScore =
            rawScore <= maxAllowedTotalScore ? rawScore : Math.min(rawScore, maxAllowedTotalScore);
          if (rawScore > maxAllowedTotalScore + 2000) {
            peer.antiCheatStrikes += 1;
          }

          // Clamp lane X within [-8.0, 8.0] (supports both 3-lane and 5-lane tracks), Y within [-10, 35]
          peer.x = Math.max(-8.0, Math.min(8.0, Number.isFinite(rawX) ? rawX : 0));
          peer.y = Math.max(-10, Math.min(35, Number.isFinite(rawY) ? rawY : 0));
          peer.z = Number.isFinite(rawZ) ? rawZ : -validatedDist;
          peer.rotY = Number.isFinite(rawRotY) ? rawRotY : 0;
          peer.lane = rawLane;
          peer.distance = validatedDist;
          peer.score = validatedScore;
          peer.action = rawAction;
          peer.paused = rawPaused;

          if (p.modelStyle && ['procedural', 'xbot', 'robot', 'soldier', 'custom'].includes(String(p.modelStyle))) {
            peer.modelStyle = String(p.modelStyle) as PlayerModelStyle;
          }
          if (p.isRidingVehicle !== undefined) {
            peer.isRidingVehicle = Boolean(p.isRidingVehicle);
          }
          if (p.vehicleId !== undefined) {
            peer.vehicleId = p.vehicleId ? (String(p.vehicleId) as VehicleId) : undefined;
          }
          if (p.abilityActive !== undefined) {
            peer.abilityActive = Boolean(p.abilityActive);
          }

          if (p.coins !== undefined) {
            const c = Math.max(0, Math.floor(Number(p.coins)));
            if (c <= validatedDist * 0.8 + 30) peer.coins = c;
          }
          if (p.eliminations !== undefined) {
            const el = Math.max(0, Math.floor(Number(p.eliminations)));
            if (el <= validatedDist * 0.08 + 10) peer.eliminations = el;
          }
          if (p.abilityTriggered && room.rules.allowAbilities) {
            if (now - peer.lastAbilityMs >= 3500) {
              peer.lastAbilityMs = now;
            } else {
              peer.antiCheatStrikes += 1;
            }
          }

          this.broadcastRoomTelemetry(room);
          return;
        }

        if (event === 'player:ability_interference' && room.status === 'racing') {
          if (!room.rules.allowAbilities) return;
          const now = Date.now();
          if (now - peer.lastInterferenceMs < 6000) return;
          peer.lastInterferenceMs = now;
          const payloadOut = {
            fromUserId: userId,
            fromUsername: username,
            characterId: peer.characterId,
            kind: String(p.kind || 'emp_disrupt').slice(0, 40),
            durationSec: Math.max(1.2, Math.min(4.0, Number(p.durationSec || 2.5))),
          };
          for (const targetPeer of room.peers.values()) {
            if (targetPeer.userId !== userId && targetPeer.connected) {
              sendWs(targetPeer.ws, 'room:interference', payloadOut);
            }
          }
          return;
        }

        if (event === 'player:pause') {
          peer.paused = Boolean(p.paused);
          this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
          this.broadcastRoomTelemetry(room);
          return;
        }

        if (event === 'player:finish') {
          const finishTxId = String(p.txId || `mpfin_${room.code}_${userId}`);
          const existingTx = getIdempotentTx(finishTxId);
          if (existingTx.found && peer.finished) {
            sendWs(ws, 'room:finish_ack', existingTx.result);
            return;
          }

          if (!peer.finished) {
            peer.finished = true;
            peer.paused = false;
            const claimedDist = Math.max(peer.distance, Number(p.distance ?? 0));
            const elapsedSec = room.startedAtMs
              ? Math.max(1, (Date.now() - room.startedAtMs) / 1000)
              : 1;
            const cappedDist = Math.min(claimedDist, elapsedSec * 74 + 30);
            const cappedScore = Math.min(
              Math.max(peer.score, Number(p.score ?? 0)),
              cappedDist * 45 + 4500,
            );
            peer.distance = Math.floor(cappedDist);
            peer.score = Math.floor(cappedScore);
            room.finishCounter += 1;
            peer.placement = room.finishCounter;

            // Server-authoritative placement rewards
            const placementBonusCoins =
              peer.placement === 1 ? 350 : peer.placement === 2 ? 220 : 120;
            const placementBonusGems = peer.placement === 1 ? 8 : peer.placement === 2 ? 4 : 2;
            peer.rewardCoins = Math.min(2500, peer.coins + placementBonusCoins);
            peer.rewardGems = placementBonusGems;

            const ackPayload = {
              txId: finishTxId,
              placement: peer.placement,
              validatedDistance: peer.distance,
              validatedScore: peer.score,
              rewardCoins: peer.rewardCoins,
              rewardGems: peer.rewardGems,
            };
            recordIdempotentTx(finishTxId, 'mp_finish', ackPayload);
            sendWs(ws, 'room:finish_ack', ackPayload);
          }

          const allFinished = Array.from(room.peers.values()).every((rPeer) => rPeer.finished);
          if (allFinished) {
            room.status = 'finished';
            recordMultiplayerMatch({
              roomCode: room.code,
              districtId: room.districtId,
              mode: room.mode,
              results: this.serializeRoom(room).players,
            });
          }
          this.broadcastRoom(room, 'room:state', this.serializeRoom(room));
          this.broadcastRoomTelemetry(room);
        }
      });

      ws.on('close', () => {
        this.handlePeerDisconnect(ws, userId, currentRoomCode, false);
        untrackUserSocket(userId);
      });
    });
  }
}

/* ---------------- DEDICATED LAN / HOST MATCH SERVER ---------------- */

let lanHttpServer: http.Server | null = null;
let lanWss: WebSocketServer | null = null;
let lanManager: AuthoritativeRoomManager | null = null;
let currentLanConfig: { bindAddress: string; port: number; error: string | null } = {
  bindAddress: '0.0.0.0',
  port: 3077,
  error: null,
};

export function getLanHostStatus(): LanHostState {
  const interfaces = listLocalNetworkInterfaces();
  let roomCode: string | null = null;
  let playerCount = 0;
  if (lanManager) {
    const first = lanManager.activeRooms.values().next().value as AuthoritativeRoom | undefined;
    if (first) {
      roomCode = first.code;
      playerCount = first.peers.size;
    }
  }
  return {
    running: Boolean(lanHttpServer && lanHttpServer.listening),
    port: currentLanConfig.port,
    bindAddress: currentLanConfig.bindAddress,
    interfaces,
    roomCode,
    playerCount,
    error: currentLanConfig.error,
  };
}

export async function startLanMatchHostServer(params: {
  bindAddress?: string;
  port?: number;
}): Promise<{ ok: boolean; state: LanHostState; error?: string }> {
  const bindAddress = params.bindAddress || '0.0.0.0';
  const port = Math.min(65535, Math.max(1024, Math.floor(Number(params.port || 3077))));

  await stopLanMatchHostServer();

  const manager = new AuthoritativeRoomManager();
  const srv = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const reqPath = (req.url || '/').split('?')[0];
    if (reqPath === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          role: 'lan_match_host',
          gameVersion: GAME_VERSION,
          rooms: manager.listPublicRooms(),
          activeRoomCount: manager.activeRooms.size,
        }),
      );
      return;
    }
    if (reqPath === '/api/rooms') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          gameVersion: GAME_VERSION,
          rooms: manager.listPublicRooms(),
          activeRoomCount: manager.activeRooms.size,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end('METRO RUSH LAN Match Host');
  });

  const wss = new WebSocketServer({ server: srv, path: '/ws' });
  manager.attachSocketServer(wss, () => null);

  return new Promise((resolve) => {
    let settled = false;
    const handleListenError = (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      const msg =
        err.code === 'EADDRINUSE'
          ? `El puerto ${port} ya está ocupado por otro programa.`
          : err.code === 'EACCES'
            ? `Windows/SO denegó permiso para abrir el puerto ${port}.`
            : err.code === 'EADDRNOTAVAIL'
              ? `La dirección IP seleccionada (${bindAddress}) no está disponible en este equipo.`
              : `No se pudo iniciar el servidor LAN (${err.message}).`;
      currentLanConfig = { bindAddress, port, error: msg };
      manager.dispose();
      try {
        wss.close();
      } catch {
        // Ignore cleanup close error
      }
      resolve({ ok: false, state: getLanHostStatus(), error: msg });
    };

    wss.on('error', (err) => {
      handleListenError(err as NodeJS.ErrnoException);
    });
    srv.once('error', handleListenError);

    srv.listen(port, bindAddress, () => {
      if (settled) return;
      settled = true;
      lanHttpServer = srv;
      lanWss = wss;
      lanManager = manager;
      currentLanConfig = { bindAddress, port, error: null };
      resolve({ ok: true, state: getLanHostStatus() });
    });
  });
}

export async function stopLanMatchHostServer(): Promise<LanHostState> {
  if (lanManager) {
    lanManager.dispose();
    lanManager = null;
  }
  if (lanWss) {
    for (const client of lanWss.clients) {
      try {
        client.terminate();
      } catch {
        // ignore
      }
    }
    await new Promise<void>((r) => lanWss!.close(() => r()));
    lanWss = null;
  }
  if (lanHttpServer) {
    const srv = lanHttpServer;
    lanHttpServer = null;
    await new Promise<void>((r) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          r();
        }
      };
      srv.close(finish);
      if (typeof srv.closeAllConnections === 'function') {
        srv.closeAllConnections();
      }
      setTimeout(finish, 1000);
    });
  }
  currentLanConfig.error = null;
  return getLanHostStatus();
}
