import {
  DistrictId,
  GameMode,
  MultiplayerPlayerTelemetry,
  MultiplayerRoomState,
  PlayerSaveData,
} from '../game/types';

export interface OnlineUser {
  id: string;
  username: string;
  email: string;
  avatarId: string;
  createdAt: string;
  friends: string[];
  totalRuns: number;
  bestScore: number;
  bestDistance: number;
}

export interface OnlineRankingEntry {
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
  verified: boolean;
}

export interface PublicRoomListing {
  code: string;
  name: string;
  districtId: DistrictId;
  mode: GameMode;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
}

export interface RoomInviteNotice {
  code: string;
  fromUsername: string;
  districtId: DistrictId;
  mode: GameMode;
}

export interface DatabaseDiagnosticsInfo {
  dbPath: string;
  backupDir: string;
  userCount: number;
  runCount: number;
  mpMatchCount: number;
  sizeBytes: number;
  authenticatedAs: string | null;
  persistenceNote: string;
}

export type RankingScope =
  | 'global'
  | 'city'
  | 'weekly'
  | 'monthly'
  | 'friends'
  | 'character';

export interface ActiveRunSession {
  runId: string;
  runToken: string;
}

export interface WeeklyChallengeInfo {
  weeklyChallenge: {
    id: string;
    title: string;
    description: string;
    districtId: DistrictId;
    targetDistance: number;
    targetScore: number;
    rewardCoins: number;
    rewardGems: number;
  };
  bossOfWeek: {
    bossId: string;
    districtId: DistrictId;
    bonusLabel: string;
  };
}

const TOKEN_KEY = 'metro_rush_auth_token_v2';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(url, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || `Error HTTP ${res.status}` };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor online.' };
  }
}

export async function checkServerOnline(): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/health');
  return Boolean(res.ok && res.data?.ok);
}

export async function fetchDatabaseInfo(): Promise<DatabaseDiagnosticsInfo | null> {
  const res = await apiFetch<DatabaseDiagnosticsInfo>('/api/db/info');
  return res.ok && res.data ? res.data : null;
}

export async function registerOnlineUser(
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
  avatarId: string,
): Promise<{ ok: boolean; user?: OnlineUser; recoveryCode?: string; error?: string }> {
  const res = await apiFetch<{
    token: string;
    user: OnlineUser;
    recoveryCode: string;
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, confirmPassword, avatarId }),
  });
  if (res.ok && res.data) {
    setStoredToken(res.data.token);
    return {
      ok: true,
      user: res.data.user,
      recoveryCode: res.data.recoveryCode,
    };
  }
  return { ok: false, error: res.error };
}

export async function loginOnlineUser(
  identifier: string,
  password: string,
): Promise<{ ok: boolean; user?: OnlineUser; error?: string }> {
  const res = await apiFetch<{ token: string; user: OnlineUser }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    },
  );
  if (res.ok && res.data) {
    setStoredToken(res.data.token);
    return { ok: true, user: res.data.user };
  }
  return { ok: false, error: res.error };
}

export async function recoverOnlinePassword(
  identifier: string,
  recoveryCode: string,
  newPassword: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await apiFetch<{ ok: boolean; message: string }>('/api/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ identifier, recoveryCode, newPassword }),
  });
  return res.ok
    ? { ok: true, message: res.data?.message }
    : { ok: false, error: res.error };
}

export function logoutOnlineUser(): void {
  setStoredToken(null);
}

export async function fetchMeOnline(): Promise<{
  ok: boolean;
  user?: OnlineUser;
  history?: OnlineRankingEntry[];
  cloudSaveUpdatedAt?: string | null;
  error?: string;
}> {
  if (!getStoredToken()) return { ok: false };
  const res = await apiFetch<{
    user: OnlineUser;
    history: OnlineRankingEntry[];
    cloudSaveUpdatedAt?: string | null;
  }>('/api/auth/me');
  if (!res.ok || !res.data) {
    if (res.error?.includes('Sesión')) setStoredToken(null);
    return { ok: false, error: res.error };
  }
  return {
    ok: true,
    user: res.data.user,
    history: res.data.history,
    cloudSaveUpdatedAt: res.data.cloudSaveUpdatedAt ?? null,
  };
}

export async function syncSaveToSqlite(
  save: PlayerSaveData,
): Promise<{ ok: boolean; updatedAt?: string; error?: string }> {
  if (!getStoredToken()) return { ok: false, error: 'Sin sesión iniciada' };
  const res = await apiFetch<{ ok: boolean; updatedAt: string }>('/api/profile/sync', {
    method: 'PUT',
    body: JSON.stringify({ save }),
  });
  return res.ok && res.data
    ? { ok: true, updatedAt: res.data.updatedAt }
    : { ok: false, error: res.error };
}

export async function loadSaveFromSqlite(): Promise<{
  ok: boolean;
  hasSave?: boolean;
  save?: PlayerSaveData;
  updatedAt?: string;
  error?: string;
}> {
  if (!getStoredToken()) return { ok: false, error: 'Sin sesión iniciada' };
  const res = await apiFetch<{
    hasSave: boolean;
    save: PlayerSaveData | null;
    updatedAt: string | null;
  }>('/api/profile/sync');
  if (!res.ok || !res.data) return { ok: false, error: res.error };
  return {
    ok: true,
    hasSave: res.data.hasSave,
    save: res.data.save ?? undefined,
    updatedAt: res.data.updatedAt ?? undefined,
  };
}

export async function exportAccountBackupJson(): Promise<{
  ok: boolean;
  filename?: string;
  content?: string;
  error?: string;
}> {
  const token = getStoredToken();
  if (!token) return { ok: false, error: 'Inicia sesión para exportar tu cuenta SQLite.' };
  try {
    const res = await fetch('/api/account/export', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, error: `Error HTTP ${res.status}` };
    const text = await res.text();
    return {
      ok: true,
      filename: `metro-rush-sqlite-backup-${Date.now()}.json`,
      content: text,
    };
  } catch {
    return { ok: false, error: 'No se pudo exportar desde SQLite.' };
  }
}

export async function resetServerTestRankings(): Promise<{
  ok: boolean;
  backupCreated?: string;
  message?: string;
  error?: string;
}> {
  const res = await apiFetch<{ ok: boolean; backupCreated: string; message: string }>(
    '/api/db/reset-test',
    { method: 'POST', body: JSON.stringify({}) },
  );
  return res.ok && res.data
    ? { ok: true, backupCreated: res.data.backupCreated, message: res.data.message }
    : { ok: false, error: res.error };
}

export async function updateOnlineAvatar(avatarId: string) {
  return apiFetch<{ user: OnlineUser }>('/api/profile/avatar', {
    method: 'POST',
    body: JSON.stringify({ avatarId }),
  });
}

export async function addOnlineFriend(friendName: string) {
  return apiFetch<{ user: OnlineUser }>('/api/friends/add', {
    method: 'POST',
    body: JSON.stringify({ friendName }),
  });
}

export async function startServerRun(
  districtId: DistrictId,
  mode: GameMode,
): Promise<ActiveRunSession | null> {
  if (!getStoredToken()) return null;
  const res = await apiFetch<ActiveRunSession>('/api/runs/start', {
    method: 'POST',
    body: JSON.stringify({ districtId, mode }),
  });
  return res.ok && res.data ? res.data : null;
}

export async function submitServerRun(
  session: ActiveRunSession | null,
  payload: {
    score: number;
    distance: number;
    durationSec: number;
    maxSpeedKmh: number;
    maxCombo: number;
    characterId: string;
    districtId: DistrictId;
    mode: GameMode;
    bossDefeatedId: string | null;
    victory: boolean;
  },
): Promise<{ verified: boolean; error?: string }> {
  if (!session || !getStoredToken()) {
    return { verified: false };
  }
  const res = await apiFetch<{ verified: boolean }>('/api/runs/submit', {
    method: 'POST',
    body: JSON.stringify({
      runToken: session.runToken,
      ...payload,
    }),
  });
  if (res.ok && res.data?.verified) {
    return { verified: true };
  }
  return { verified: false, error: res.error };
}

export async function fetchRankings(
  scope: RankingScope,
  districtId?: DistrictId,
  characterId?: string,
): Promise<{ ok: boolean; entries: OnlineRankingEntry[]; error?: string }> {
  const params = new URLSearchParams({ scope });
  if (districtId) params.set('districtId', districtId);
  if (characterId) params.set('characterId', characterId);
  const res = await apiFetch<{ entries: OnlineRankingEntry[] }>(
    `/api/rankings?${params.toString()}`,
  );
  if (res.ok && res.data) {
    return { ok: true, entries: res.data.entries };
  }
  return { ok: false, entries: [], error: res.error };
}

export async function fetchPublicRooms(): Promise<PublicRoomListing[]> {
  const res = await apiFetch<{ rooms: PublicRoomListing[] }>('/api/rooms');
  return res.ok && res.data ? res.data.rooms : [];
}

export async function fetchOnlineEvents(): Promise<WeeklyChallengeInfo | null> {
  const res = await apiFetch<WeeklyChallengeInfo>('/api/events/online');
  return res.ok && res.data ? res.data : null;
}

/* ---------------- REAL WEBSOCKET MULTIPLAYER CLIENT ---------------- */

export type MpClientListeners = {
  onConnection?: (connected: boolean, selfUserId?: string) => void;
  onRoomState?: (room: MultiplayerRoomState | null) => void;
  onRoomStarted?: (room: MultiplayerRoomState) => void;
  onTelemetry?: (players: MultiplayerPlayerTelemetry[]) => void;
  onInvited?: (invite: RoomInviteNotice) => void;
  onNotice?: (message: string, isError?: boolean) => void;
};

class MultiplayerWsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<MpClientListeners>();
  private selfUserId: string | null = null;
  private connected = false;
  private guestName = 'RUNNER_01';

  public subscribe(listener: MpClientListeners): () => void {
    this.listeners.add(listener);
    if (this.connected) {
      listener.onConnection?.(true, this.selfUserId ?? undefined);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  public getSelfUserId(): string | null {
    return this.selfUserId;
  }

  public connect(guestName: string): void {
    this.guestName = guestName;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.authenticate();
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.authenticate();
    };

    ws.onmessage = (evt) => {
      let msg: { event?: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(String(evt.data));
      } catch {
        return;
      }
      const p = msg.payload ?? {};
      switch (msg.event) {
        case 'auth:ok':
          this.selfUserId = String(p.userId ?? '');
          this.listeners.forEach((l) => l.onConnection?.(true, this.selfUserId ?? undefined));
          break;
        case 'room:state':
          this.listeners.forEach((l) => l.onRoomState?.(p as unknown as MultiplayerRoomState));
          break;
        case 'room:left':
          this.listeners.forEach((l) => l.onRoomState?.(null));
          break;
        case 'room:started':
          this.listeners.forEach((l) => l.onRoomStarted?.(p as unknown as MultiplayerRoomState));
          break;
        case 'room:telemetry':
          this.listeners.forEach((l) =>
            l.onTelemetry?.((p.players as MultiplayerPlayerTelemetry[]) ?? []),
          );
          break;
        case 'room:invited':
          this.listeners.forEach((l) => l.onInvited?.(p as unknown as RoomInviteNotice));
          break;
        case 'room:error':
          this.listeners.forEach((l) => l.onNotice?.(String(p.error ?? 'Error de sala'), true));
          break;
        case 'room:info':
          this.listeners.forEach((l) => l.onNotice?.(String(p.message ?? ''), false));
          break;
      }
    };

    ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.listeners.forEach((l) => l.onConnection?.(false));
    };
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  public authenticate(): void {
    this.send('auth', {
      token: getStoredToken(),
      guestName: this.guestName,
    });
  }

  public send(event: string, payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  public createRoom(params: {
    name?: string;
    isPublic: boolean;
    districtId: DistrictId;
    mode: GameMode;
    characterId: string;
    maxPlayers?: number;
  }): void {
    this.send('room:create', params);
  }

  public joinRoom(code: string, characterId: string): void {
    this.send('room:join', { code: code.toUpperCase(), characterId });
  }

  public leaveRoom(): void {
    this.send('room:leave', {});
  }

  public setReady(ready: boolean, characterId: string): void {
    this.send('room:ready', { ready, characterId });
  }

  public updateRoomConfig(params: {
    districtId?: DistrictId;
    mode?: GameMode;
    isPublic?: boolean;
  }): void {
    this.send('room:config', params);
  }

  public startRoomRace(): void {
    this.send('room:start', {});
  }

  public inviteFriend(targetUsername: string): void {
    this.send('room:invite', { targetUsername });
  }

  public sendTelemetry(data: {
    x: number;
    y: number;
    z: number;
    lane: number;
    distance: number;
    score: number;
    action: string;
    paused: boolean;
  }): void {
    this.send('player:telemetry', data);
  }

  public sendPauseState(paused: boolean): void {
    this.send('player:pause', { paused });
  }

  public sendFinish(distance: number, score: number): void {
    this.send('player:finish', { distance, score });
  }
}

export const mpClient = new MultiplayerWsClient();
