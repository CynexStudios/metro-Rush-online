import {
  AccountSyncConflict,
  CosmeticSlot,
  DistrictId,
  GameMode,
  LanHostState,
  LocalProfileSummary,
  MultiplayerPlayerTelemetry,
  MultiplayerRoomState,
  NetworkConnectionMode,
  PersistentInviteRecord,
  PlayerSaveData,
  ReleaseUpdateInfo,
  RoomRulesConfig,
  TunnelState,
  VehicleId,
} from '../game/types';
import { GAME_VERSION } from '../game/version';

export interface OnlineUser {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  avatarId: string;
  createdAt: string;
  lastSeenAt?: string;
  friends: string[];
  totalRuns: number;
  bestScore: number;
  bestDistance: number;
}

export interface SearchedUserEntry {
  id: string;
  username: string;
  displayName: string;
  avatarId: string;
  totalRuns: number;
  bestScore: number;
  bestDistance: number;
  lastSeenAt: string;
  isOnline: boolean;
}

export interface AuthSessionInfo {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAtMs: number;
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
  gameVersion?: string;
  connectionMode?: NetworkConnectionMode;
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
  engine?: string;
  schemaVersion?: number;
  userCount: number;
  localProfileCount?: number;
  runCount: number;
  mpMatchCount: number;
  sizeBytes: number;
  authenticatedAs: string | null;
  persistenceNote: string;
}

export interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
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

export interface FinishAckPayload {
  txId: string;
  placement: number;
  validatedDistance: number;
  validatedScore: number;
  rewardCoins: number;
  rewardGems: number;
}

const TOKEN_KEY = 'metro_rush_auth_token_v2';
const REFRESH_TOKEN_KEY = 'metro_rush_refresh_token_v1';
const LAST_USER_ID_KEY = 'metro_rush_last_user_id_v1';
const CLIENT_ID_KEY = 'metro_rush_client_id_v1';
const ACTIVE_LOCAL_PROFILE_KEY = 'metro_rush_active_local_profile_v1';
const ONLINE_API_URL_KEY = 'metro_rush_online_backend_url_v1';

let desktopBootstrapped = false;

function syncDesktopSecureSession(): void {
  if (!window.metroDesktop?.saveSecureSession) return;
  try {
    void window.metroDesktop.saveSecureSession({
      accessToken: localStorage.getItem(TOKEN_KEY) || undefined,
      refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || undefined,
      onlineBackendUrl: localStorage.getItem(ONLINE_API_URL_KEY) || undefined,
      activeLocalProfileId: localStorage.getItem(ACTIVE_LOCAL_PROFILE_KEY) || undefined,
      lastUserId: localStorage.getItem(LAST_USER_ID_KEY) || undefined,
    });
  } catch {
    // Ignore desktop IPC error
  }
}

export async function bootstrapDesktopSession(): Promise<void> {
  if (desktopBootstrapped) return;
  desktopBootstrapped = true;
  if (!window.metroDesktop?.loadSecureSession) return;
  try {
    const res = await window.metroDesktop.loadSecureSession();
    if (!res.ok || !res.data) return;
    const d = res.data;
    if (d.accessToken && !localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, d.accessToken);
    }
    if (d.refreshToken && !localStorage.getItem(REFRESH_TOKEN_KEY)) {
      localStorage.setItem(REFRESH_TOKEN_KEY, d.refreshToken);
    }
    if (d.onlineBackendUrl && !localStorage.getItem(ONLINE_API_URL_KEY)) {
      localStorage.setItem(ONLINE_API_URL_KEY, d.onlineBackendUrl);
    }
    if (d.activeLocalProfileId && !localStorage.getItem(ACTIVE_LOCAL_PROFILE_KEY)) {
      localStorage.setItem(ACTIVE_LOCAL_PROFILE_KEY, d.activeLocalProfileId);
    }
    if (d.lastUserId && !localStorage.getItem(LAST_USER_ID_KEY)) {
      localStorage.setItem(LAST_USER_ID_KEY, d.lastUserId);
    }
  } catch {
    // Ignore bootstrap errors
  }
}

export function getPersistentClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 12)
          : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return `pc_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getActiveLocalProfileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_LOCAL_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function setActiveLocalProfileId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_LOCAL_PROFILE_KEY, id);
    else localStorage.removeItem(ACTIVE_LOCAL_PROFILE_KEY);
    syncDesktopSecureSession();
  } catch {
    // Ignore storage errors
  }
}

export function getOnlineBackendUrl(): string {
  try {
    return (localStorage.getItem(ONLINE_API_URL_KEY) || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setOnlineBackendUrl(url: string): string {
  const clean = url.trim().replace(/\/+$/, '');
  try {
    if (clean) localStorage.setItem(ONLINE_API_URL_KEY, clean);
    else localStorage.removeItem(ONLINE_API_URL_KEY);
    syncDesktopSecureSession();
  } catch {
    // Ignore storage errors
  }
  return clean;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null, refreshToken?: string | null, userId?: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (refreshToken !== undefined) {
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      else localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    if (userId !== undefined) {
      if (userId) localStorage.setItem(LAST_USER_ID_KEY, userId);
      else localStorage.removeItem(LAST_USER_ID_KEY);
    }
    syncDesktopSecureSession();
  } catch {
    // Ignore storage errors
  }
}

let pendingRefreshPromise: Promise<boolean> | null = null;

export async function refreshOnlineSessionToken(): Promise<boolean> {
  if (pendingRefreshPromise) return pendingRefreshPromise;
  const rt = getStoredRefreshToken();
  if (!rt) return false;

  pendingRefreshPromise = (async () => {
    const base = getOnlineBackendUrl();
    try {
      const res = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setStoredToken(null, null, null);
        }
        return false;
      }
      const data = (await res.json()) as {
        token: string;
        refreshToken: string;
        user?: OnlineUser;
      };
      if (data.token && data.refreshToken) {
        setStoredToken(data.token, data.refreshToken, data.user?.id);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      pendingRefreshPromise = null;
    }
  })();

  return pendingRefreshPromise;
}

async function apiFetch<T>(
  pathUrl: string,
  options: RequestInit & { useOnlineOrigin?: boolean; _retriedRefresh?: boolean } = {},
): Promise<{ ok: boolean; data?: T; error?: string; status?: number }> {
  const token = getStoredToken();
  const base = options.useOnlineOrigin ? getOnlineBackendUrl() : '';
  const url = `${base}${pathUrl}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(url, { ...options, headers });
    if (
      res.status === 401 &&
      !options._retriedRefresh &&
      options.useOnlineOrigin &&
      !pathUrl.startsWith('/api/auth/login') &&
      !pathUrl.startsWith('/api/auth/register') &&
      !pathUrl.startsWith('/api/auth/refresh') &&
      getStoredRefreshToken()
    ) {
      const refreshed = await refreshOnlineSessionToken();
      if (refreshed) {
        return apiFetch<T>(pathUrl, { ...options, _retriedRefresh: true });
      }
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || `Error HTTP ${res.status}`, status: res.status };
    }
    return { ok: true, data: json as T, status: res.status };
  } catch {
    return {
      ok: false,
      error: base
        ? `No se pudo contactar al servidor online (${base}). El modo local sigue funcionando.`
        : 'Sin conexión con el servidor local.',
    };
  }
}

export async function checkServerOnline(useOnlineOrigin = false): Promise<boolean> {
  const res = await apiFetch<{ ok: boolean }>('/api/health', { useOnlineOrigin });
  return Boolean(res.ok && res.data?.ok);
}

export async function fetchDatabaseInfo(): Promise<DatabaseDiagnosticsInfo | null> {
  const res = await apiFetch<DatabaseDiagnosticsInfo>('/api/db/info');
  return res.ok && res.data ? res.data : null;
}

export async function fetchIceConfig(): Promise<{
  iceServers: IceServerEntry[];
  hasTurn: boolean;
  turnInfo: string;
} | null> {
  const res = await apiFetch<{
    iceServers: IceServerEntry[];
    hasTurn: boolean;
    turnInfo: string;
  }>('/api/rtc/ice-config', { useOnlineOrigin: true });
  return res.ok && res.data ? res.data : null;
}

/* ---------------- LAN MATCH HOST API ---------------- */

export async function fetchLanStatus(): Promise<(LanHostState & { gameVersion?: string }) | null> {
  if (window.metroDesktop?.getLanStatus) {
    try {
      return await window.metroDesktop.getLanStatus();
    } catch {
      // Fallback to HTTP
    }
  }
  const res = await apiFetch<LanHostState & { gameVersion?: string }>('/api/lan/status');
  return res.ok && res.data ? res.data : null;
}

export async function startLanHost(
  bindAddress: string,
  port: number,
): Promise<{ ok: boolean; state?: LanHostState; error?: string }> {
  if (window.metroDesktop?.startLanHost) {
    return window.metroDesktop.startLanHost(bindAddress, port);
  }
  const res = await apiFetch<{ ok: boolean; state: LanHostState; error?: string }>(
    '/api/lan/start',
    {
      method: 'POST',
      body: JSON.stringify({ bindAddress, port }),
    },
  );
  return res.ok && res.data
    ? { ok: true, state: res.data.state }
    : { ok: false, error: res.error };
}

export async function stopLanHost(): Promise<{ ok: boolean; state?: LanHostState }> {
  if (window.metroDesktop?.stopLanHost) {
    return window.metroDesktop.stopLanHost();
  }
  const res = await apiFetch<{ ok: boolean; state: LanHostState }>('/api/lan/stop', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.ok && res.data ? { ok: true, state: res.data.state } : { ok: false };
}

/* ---------------- TUNNEL HOST (CLOUDFLARED) ---------------- */

export async function getTunnelStatus(): Promise<TunnelState> {
  if (window.metroDesktop?.getTunnelStatus) {
    try {
      return await window.metroDesktop.getTunnelStatus();
    } catch {
      // Ignore
    }
  }
  return {
    running: false,
    available: false,
    binaryPath: null,
    publicUrl: null,
    wssUrl: null,
    provider: 'none',
    error: 'Túnel automático disponible únicamente en la aplicación de escritorio Windows (.exe).',
  };
}

export async function startCloudflaredTunnel(
  targetPort: number,
): Promise<{ ok: boolean; state: TunnelState; error?: string }> {
  if (!window.metroDesktop?.startCloudflaredTunnel) {
    return {
      ok: false,
      state: await getTunnelStatus(),
      error: 'Usa playit.gg manualmente o ejecuta la versión instalable de escritorio para túneles automáticos.',
    };
  }
  return window.metroDesktop.startCloudflaredTunnel(targetPort);
}

export async function stopCloudflaredTunnel(): Promise<{ ok: boolean; state: TunnelState }> {
  if (!window.metroDesktop?.stopCloudflaredTunnel) {
    return { ok: true, state: await getTunnelStatus() };
  }
  return window.metroDesktop.stopCloudflaredTunnel();
}

/* ---------------- LOCAL OFFLINE PROFILES (SQLITE IN USERDATA) ---------------- */

export async function listLocalProfilesApi(): Promise<{
  ok: boolean;
  profiles: LocalProfileSummary[];
  error?: string;
}> {
  const res = await apiFetch<{ profiles: LocalProfileSummary[] }>('/api/local-profiles');
  if (res.ok && res.data) {
    return { ok: true, profiles: res.data.profiles };
  }
  return { ok: false, profiles: [], error: res.error };
}

export async function getLocalProfileApi(id: string): Promise<{
  ok: boolean;
  save?: PlayerSaveData;
  profile?: LocalProfileSummary;
  error?: string;
}> {
  const res = await apiFetch<{
    profile: LocalProfileSummary & { save: PlayerSaveData };
  }>(`/api/local-profiles/${encodeURIComponent(id)}`);
  if (res.ok && res.data?.profile) {
    return {
      ok: true,
      profile: res.data.profile,
      save: res.data.profile.save,
    };
  }
  return { ok: false, error: res.error };
}

export async function createLocalProfileApi(params: {
  id?: string;
  name: string;
  avatarId: string;
  save: PlayerSaveData;
}): Promise<{ ok: boolean; profile?: LocalProfileSummary; error?: string }> {
  const res = await apiFetch<{ profile: LocalProfileSummary }>('/api/local-profiles', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.ok && res.data
    ? { ok: true, profile: res.data.profile }
    : { ok: false, error: res.error };
}

export async function saveLocalProfileApi(
  id: string,
  save: PlayerSaveData,
): Promise<{ ok: boolean; updatedAt?: string; error?: string }> {
  const res = await apiFetch<{ ok: boolean; updatedAt: string }>(
    `/api/local-profiles/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        save,
        name: save.playerName,
        avatarId: save.avatarId,
      }),
    },
  );
  return res.ok && res.data
    ? { ok: true, updatedAt: res.data.updatedAt }
    : { ok: false, error: res.error };
}

export async function deleteLocalProfileApi(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch<{ ok: boolean }>(
    `/api/local-profiles/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/* ---------------- ACCOUNT LINKING & CONFLICT RESOLUTION ---------------- */

function summarizeSave(s: PlayerSaveData) {
  return {
    level: s.level ?? 1,
    coins: s.coins ?? 0,
    gems: s.gems ?? 0,
    totalRuns: s.stats?.totalRuns ?? 0,
    bestScore: s.stats?.bestScore ?? 0,
    unlockedCount:
      (s.unlockedCharacters?.length ?? 0) +
      (s.unlockedDistricts?.length ?? 0) +
      (s.ownedVehicles?.length ?? 0) +
      (s.ownedCosmetics?.length ?? 0),
  };
}

export function buildAccountConflict(params: {
  localProfileId: string;
  localSave: PlayerSaveData;
  onlineUser: OnlineUser;
  onlineSave: PlayerSaveData | null;
}): AccountSyncConflict {
  const localSum = summarizeSave(params.localSave);
  const onlineSum = params.onlineSave
    ? summarizeSave(params.onlineSave)
    : {
        level: 1,
        coins: 0,
        gems: 0,
        totalRuns: params.onlineUser.totalRuns,
        bestScore: params.onlineUser.bestScore,
        unlockedCount: 0,
      };

  const hasLocalProgress = localSum.totalRuns > 0 || localSum.unlockedCount > 3 || localSum.coins > 1500;
  const hasOnlineProgress =
    Boolean(params.onlineSave) &&
    (onlineSum.totalRuns > 0 || onlineSum.unlockedCount > 3 || onlineSum.coins > 1500);

  return {
    localProfileId: params.localProfileId,
    localName: params.localSave.playerName,
    onlineUserId: params.onlineUser.id,
    onlineUsername: params.onlineUser.username,
    localSummary: localSum,
    onlineSummary: onlineSum,
    hasConflict: hasLocalProgress && hasOnlineProgress,
  };
}

function unionArrays<T extends string>(a?: T[], b?: T[]): T[] {
  return Array.from(new Set([...(a ?? []), ...(b ?? [])]));
}

function mergeById<T extends { id: string }>(a?: T[], b?: T[], limit = 40): T[] {
  const map = new Map<string, T>();
  for (const item of [...(a ?? []), ...(b ?? [])]) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values()).slice(0, limit);
}

export function mergeSavesWithoutDuplication(
  localSave: PlayerSaveData,
  onlineSave: PlayerSaveData,
): PlayerSaveData {
  const vehicles = [
    'hover_bike',
    'cyber_coupe',
    'quantum_glider',
    'titan_rammer',
    'star_viper',
  ] as VehicleId[];
  const vehicleUpgrades = { ...localSave.vehicleUpgrades };
  for (const v of vehicles) {
    vehicleUpgrades[v] = Math.max(
      localSave.vehicleUpgrades?.[v] ?? 0,
      onlineSave.vehicleUpgrades?.[v] ?? 0,
    );
  }

  const skillLevels: Record<string, number> = { ...localSave.skillLevels };
  for (const [k, v] of Object.entries(onlineSave.skillLevels ?? {})) {
    skillLevels[k] = Math.max(skillLevels[k] ?? 0, v);
  }

  const missionProgress: Record<string, number> = { ...localSave.missionProgress };
  for (const [k, v] of Object.entries(onlineSave.missionProgress ?? {})) {
    missionProgress[k] = Math.max(missionProgress[k] ?? 0, v);
  }

  const completedMissions = unionArrays(localSave.completedMissions, onlineSave.completedMissions);
  const claimableMissions = unionArrays(
    localSave.claimableMissions,
    onlineSave.claimableMissions,
  ).filter((id) => !completedMissions.includes(id));

  const bpLevel = Math.max(localSave.battlePass.level, onlineSave.battlePass.level);
  const bpXp =
    localSave.battlePass.level === onlineSave.battlePass.level
      ? Math.max(localSave.battlePass.xp, onlineSave.battlePass.xp)
      : localSave.battlePass.level > onlineSave.battlePass.level
        ? localSave.battlePass.xp
        : onlineSave.battlePass.xp;

  const equippedCosmetics: Record<CosmeticSlot, string | null> = {
    ...onlineSave.equippedCosmetics,
    ...localSave.equippedCosmetics,
  };

  const bestRun =
    (localSave.bestRun?.score ?? 0) >= (onlineSave.bestRun?.score ?? 0)
      ? localSave.bestRun
      : onlineSave.bestRun;

  return {
    ...localSave,
    level: Math.max(localSave.level, onlineSave.level),
    xp: Math.max(localSave.xp, onlineSave.xp),
    coins: Math.max(localSave.coins, onlineSave.coins),
    gems: Math.max(localSave.gems, onlineSave.gems),
    tickets: Math.max(localSave.tickets, onlineSave.tickets),
    reviveTokens: Math.max(localSave.reviveTokens, onlineSave.reviveTokens),
    talismans: Math.max(localSave.talismans, onlineSave.talismans),
    unlockedCharacters: unionArrays(localSave.unlockedCharacters, onlineSave.unlockedCharacters),
    unlockedDistricts: unionArrays(localSave.unlockedDistricts, onlineSave.unlockedDistricts),
    ownedCosmetics: unionArrays(localSave.ownedCosmetics, onlineSave.ownedCosmetics),
    equippedCosmetics,
    ownedVehicles: unionArrays(localSave.ownedVehicles, onlineSave.ownedVehicles),
    ownedPets: unionArrays(localSave.ownedPets, onlineSave.ownedPets),
    equippedPetId:
      localSave.equippedPetId === undefined
        ? (onlineSave.equippedPetId ?? null)
        : localSave.equippedPetId,
    vehicleUpgrades,
    skillLevels,
    missionProgress,
    completedMissions,
    claimableMissions,
    completedEvents: unionArrays(localSave.completedEvents, onlineSave.completedEvents),
    defeatedBosses: unionArrays(localSave.defeatedBosses, onlineSave.defeatedBosses),
    customBossMeta: {
      ...(onlineSave.customBossMeta ?? {}),
      ...(localSave.customBossMeta ?? {}),
    },
    useCustomBossModels:
      localSave.useCustomBossModels ?? onlineSave.useCustomBossModels ?? true,
    unlockedAchievements: unionArrays(localSave.unlockedAchievements, onlineSave.unlockedAchievements),
    storyChapter: Math.max(localSave.storyChapter, onlineSave.storyChapter),
    tutorialCompleted: localSave.tutorialCompleted || onlineSave.tutorialCompleted,
    battlePass: {
      season: Math.max(localSave.battlePass.season, onlineSave.battlePass.season),
      level: bpLevel,
      xp: bpXp,
      premiumUnlocked:
        localSave.battlePass.premiumUnlocked || onlineSave.battlePass.premiumUnlocked,
      claimedFreeTiers: Array.from(
        new Set([
          ...localSave.battlePass.claimedFreeTiers,
          ...onlineSave.battlePass.claimedFreeTiers,
        ]),
      ),
      claimedPremiumTiers: Array.from(
        new Set([
          ...localSave.battlePass.claimedPremiumTiers,
          ...onlineSave.battlePass.claimedPremiumTiers,
        ]),
      ),
    },
    transactions: mergeById(localSave.transactions, onlineSave.transactions, 50),
    upgradeHistory: mergeById(localSave.upgradeHistory, onlineSave.upgradeHistory, 50),
    matchHistory: mergeById(localSave.matchHistory, onlineSave.matchHistory, 50),
    leaderboard: mergeById(localSave.leaderboard, onlineSave.leaderboard, 50),
    bestRun,
    stats: {
      totalRuns: Math.max(localSave.stats.totalRuns, onlineSave.stats.totalRuns),
      wins: Math.max(localSave.stats.wins, onlineSave.stats.wins),
      losses: Math.max(localSave.stats.losses, onlineSave.stats.losses),
      totalDistance: Math.max(localSave.stats.totalDistance, onlineSave.stats.totalDistance),
      bestDistance: Math.max(localSave.stats.bestDistance, onlineSave.stats.bestDistance),
      totalTimeSeconds: Math.max(localSave.stats.totalTimeSeconds, onlineSave.stats.totalTimeSeconds),
      bestSurvivalTimeSec: Math.max(
        localSave.stats.bestSurvivalTimeSec,
        onlineSave.stats.bestSurvivalTimeSec,
      ),
      bestScore: Math.max(localSave.stats.bestScore, onlineSave.stats.bestScore),
      maxSpeedKmh: Math.max(localSave.stats.maxSpeedKmh, onlineSave.stats.maxSpeedKmh),
      maxCombo: Math.max(localSave.stats.maxCombo, onlineSave.stats.maxCombo),
      totalCoinsCollected: Math.max(
        localSave.stats.totalCoinsCollected,
        onlineSave.stats.totalCoinsCollected,
      ),
      coinsSpent: Math.max(localSave.stats.coinsSpent, onlineSave.stats.coinsSpent),
      totalWallRuns: Math.max(localSave.stats.totalWallRuns, onlineSave.stats.totalWallRuns),
      totalGrapples: Math.max(localSave.stats.totalGrapples, onlineSave.stats.totalGrapples),
      totalVehiclesHijacked: Math.max(
        localSave.stats.totalVehiclesHijacked,
        onlineSave.stats.totalVehiclesHijacked,
      ),
      dronesEvaded: Math.max(localSave.stats.dronesEvaded, onlineSave.stats.dronesEvaded),
      enemiesEliminated: Math.max(localSave.stats.enemiesEliminated, onlineSave.stats.enemiesEliminated),
      bossesDefeated: Math.max(localSave.stats.bossesDefeated, onlineSave.stats.bossesDefeated),
      secretsFound: Math.max(localSave.stats.secretsFound, onlineSave.stats.secretsFound),
      revivesUsed: Math.max(localSave.stats.revivesUsed, onlineSave.stats.revivesUsed),
      missionsCompleted: Math.max(localSave.stats.missionsCompleted, onlineSave.stats.missionsCompleted),
      challengesCompleted: Math.max(
        localSave.stats.challengesCompleted,
        onlineSave.stats.challengesCompleted,
      ),
      abilitiesUsed: Math.max(localSave.stats.abilitiesUsed, onlineSave.stats.abilitiesUsed),
      eventsCompleted: Math.max(localSave.stats.eventsCompleted, onlineSave.stats.eventsCompleted),
      mpMatchesPlayed: Math.max(
        localSave.stats.mpMatchesPlayed ?? 0,
        onlineSave.stats.mpMatchesPlayed ?? 0,
      ),
      mpWins: Math.max(localSave.stats.mpWins ?? 0, onlineSave.stats.mpWins ?? 0),
      mpBestPlacement:
        localSave.stats.mpBestPlacement > 0 && onlineSave.stats.mpBestPlacement > 0
          ? Math.min(localSave.stats.mpBestPlacement, onlineSave.stats.mpBestPlacement)
          : Math.max(localSave.stats.mpBestPlacement ?? 0, onlineSave.stats.mpBestPlacement ?? 0),
      shieldBreaks: Math.max(localSave.stats.shieldBreaks ?? 0, onlineSave.stats.shieldBreaks ?? 0),
      doubleJumps: Math.max(localSave.stats.doubleJumps ?? 0, onlineSave.stats.doubleJumps ?? 0),
      parkourChains: Math.max(localSave.stats.parkourChains ?? 0, onlineSave.stats.parkourChains ?? 0),
      bossPhasesCleared: Math.max(
        localSave.stats.bossPhasesCleared ?? 0,
        onlineSave.stats.bossPhasesCleared ?? 0,
      ),
      fiveLaneDistance: Math.max(
        localSave.stats.fiveLaneDistance ?? 0,
        onlineSave.stats.fiveLaneDistance ?? 0,
      ),
      obstaclesDodged: Math.max(
        localSave.stats.obstaclesDodged ?? 0,
        onlineSave.stats.obstaclesDodged ?? 0,
      ),
      trainsPassed: Math.max(localSave.stats.trainsPassed ?? 0, onlineSave.stats.trainsPassed ?? 0),
      noReviveWins: Math.max(localSave.stats.noReviveWins ?? 0, onlineSave.stats.noReviveWins ?? 0),
    },
  };
}

export async function checkReleaseUpdatesApi(repo?: string): Promise<ReleaseUpdateInfo> {
  if (typeof window !== 'undefined' && window.metroDesktop?.checkForUpdates) {
    return window.metroDesktop.checkForUpdates(repo);
  }
  try {
    const query = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`${getOnlineBackendUrl()}/api/updates/check${query}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      return (await res.json()) as ReleaseUpdateInfo;
    }
  } catch {
    // Fallback offline response
  }
  return {
    currentVersion: GAME_VERSION,
    latestVersion: GAME_VERSION,
    hasUpdate: false,
    repo: repo || 'CynexStudios/metro-Rush-online',
    releaseUrl: `https://github.com/${repo || 'CynexStudios/metro-Rush-online'}/releases/latest`,
    downloadUrl: null,
    assetName: null,
    sizeBytes: null,
    sha256: null,
    releaseDate: null,
    releaseNotes: '',
    source: 'offline',
    error: 'Sin conexión con el servidor de comprobación de actualizaciones.',
  };
}

export async function linkAccountApi(params: {
  localProfileId: string;
  strategy: string;
  mergedSave: PlayerSaveData;
  summary: Record<string, unknown>;
  txId: string;
}): Promise<{ ok: boolean; linkedAt?: string; error?: string }> {
  const res = await apiFetch<{ ok: boolean; linkedAt: string }>('/api/local-profiles/link', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify(params),
  });
  return res.ok && res.data
    ? { ok: true, linkedAt: res.data.linkedAt }
    : { ok: false, error: res.error };
}

/* ---------------- ONLINE ACCOUNTS (AUTH + SYNC + BACKUP) ---------------- */

export async function registerOnlineUser(
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
  avatarId: string,
): Promise<{ ok: boolean; user?: OnlineUser; recoveryCode?: string; error?: string }> {
  const res = await apiFetch<{
    token: string;
    refreshToken?: string;
    user: OnlineUser;
    recoveryCode: string;
  }>('/api/auth/register', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify({ username, email, password, confirmPassword, avatarId }),
  });
  if (res.ok && res.data) {
    setStoredToken(res.data.token, res.data.refreshToken ?? null, res.data.user.id);
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
  const res = await apiFetch<{
    token: string;
    refreshToken?: string;
    user: OnlineUser;
  }>('/api/auth/login', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify({ identifier, password }),
  });
  if (res.ok && res.data) {
    setStoredToken(res.data.token, res.data.refreshToken ?? null, res.data.user.id);
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
    useOnlineOrigin: true,
    body: JSON.stringify({ identifier, recoveryCode, newPassword }),
  });
  return res.ok
    ? { ok: true, message: res.data?.message }
    : { ok: false, error: res.error };
}

export async function logoutOnlineUser(): Promise<void> {
  const rt = getStoredRefreshToken();
  if (rt) {
    await apiFetch('/api/auth/logout', {
      method: 'POST',
      useOnlineOrigin: true,
      body: JSON.stringify({ refreshToken: rt }),
    });
  }
  setStoredToken(null, null, null);
}

export async function logoutAllOnlineSessions(): Promise<{
  ok: boolean;
  revokedCount?: number;
  error?: string;
}> {
  const res = await apiFetch<{ ok: boolean; revokedCount: number }>('/api/auth/logout-all', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify({}),
  });
  if (res.ok) {
    setStoredToken(null, null, null);
    return { ok: true, revokedCount: res.data?.revokedCount ?? 0 };
  }
  return { ok: false, error: res.error };
}

export async function listOnlineSessions(): Promise<{
  ok: boolean;
  sessions: AuthSessionInfo[];
  error?: string;
}> {
  const res = await apiFetch<{ sessions: AuthSessionInfo[] }>('/api/auth/sessions', {
    useOnlineOrigin: true,
  });
  return res.ok && res.data
    ? { ok: true, sessions: res.data.sessions }
    : { ok: false, sessions: [], error: res.error };
}

export async function changeOnlinePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await apiFetch<{
    ok: boolean;
    token?: string;
    refreshToken?: string;
    message?: string;
  }>('/api/auth/change-password', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.ok && res.data) {
    if (res.data.token) {
      setStoredToken(res.data.token, res.data.refreshToken ?? null);
    }
    return { ok: true, message: res.data.message };
  }
  return { ok: false, error: res.error };
}

export async function updateOnlineProfile(params: {
  displayName?: string;
  avatarId?: string;
}): Promise<{ ok: boolean; user?: OnlineUser; error?: string }> {
  const res = await apiFetch<{ user: OnlineUser }>('/api/auth/profile', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify(params),
  });
  return res.ok && res.data ? { ok: true, user: res.data.user } : { ok: false, error: res.error };
}

export async function fetchMeOnline(): Promise<{
  ok: boolean;
  user?: OnlineUser;
  history?: OnlineRankingEntry[];
  cloudSaveUpdatedAt?: string | null;
  error?: string;
}> {
  if (!getStoredToken()) {
    if (!getStoredRefreshToken()) return { ok: false };
    const refreshed = await refreshOnlineSessionToken();
    if (!refreshed) return { ok: false };
  }
  const res = await apiFetch<{
    user: OnlineUser;
    history: OnlineRankingEntry[];
    cloudSaveUpdatedAt?: string | null;
  }>('/api/auth/me', { useOnlineOrigin: true });
  if (!res.ok || !res.data) {
    if (res.status === 401) {
      setStoredToken(null, null, null);
    }
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
  txId?: string,
): Promise<{ ok: boolean; updatedAt?: string; error?: string }> {
  if (!getStoredToken()) return { ok: false, error: 'Sin sesión iniciada' };
  const res = await apiFetch<{ ok: boolean; updatedAt: string }>('/api/profile/sync', {
    method: 'PUT',
    useOnlineOrigin: true,
    body: JSON.stringify({ save, txId }),
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
  }>('/api/profile/sync', { useOnlineOrigin: true });
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
  const base = getOnlineBackendUrl();
  try {
    const res = await fetch(`${base}/api/account/export`, {
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

export async function exportLocalBackupJson(
  save: PlayerSaveData,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const payload = JSON.stringify(
    {
      format: 'metro-rush-local-backup-v2',
      gameVersion: GAME_VERSION,
      exportedAt: new Date().toISOString(),
      save,
    },
    null,
    2,
  );
  const filename = `metro-rush-perfil-${save.playerName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.json`;

  if (window.metroDesktop?.exportBackupFile) {
    const res = await window.metroDesktop.exportBackupFile(filename, payload);
    if (res.canceled) return { ok: false, error: 'Exportación cancelada.' };
    if (!res.ok) return { ok: false, error: res.error || 'Error guardando respaldo.' };
    return { ok: true, message: `Respaldo guardado en ${res.filePath}` };
  }

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, message: `Respaldo JSON descargado (${filename}).` };
}

export async function importLocalBackupNative(): Promise<{
  ok: boolean;
  save?: PlayerSaveData;
  fileName?: string;
  error?: string;
}> {
  if (!window.metroDesktop?.importBackupFile) {
    return { ok: false, error: 'Usa el selector de archivo del navegador.' };
  }
  const res = await window.metroDesktop.importBackupFile();
  if (res.canceled) return { ok: false, error: 'Importación cancelada.' };
  if (!res.ok || !res.content) {
    return { ok: false, error: res.error || 'No se pudo leer el archivo.' };
  }
  try {
    const parsed = JSON.parse(res.content) as { save?: PlayerSaveData } & Partial<PlayerSaveData>;
    const candidate = parsed.save ?? (parsed as PlayerSaveData);
    if (!candidate || typeof candidate.coins !== 'number' || !Array.isArray(candidate.unlockedCharacters)) {
      return { ok: false, error: 'El JSON seleccionado no contiene un guardado válido de Metro Rush.' };
    }
    return { ok: true, save: candidate, fileName: res.fileName };
  } catch {
    return { ok: false, error: 'El archivo seleccionado no es JSON válido.' };
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
    { method: 'POST', useOnlineOrigin: true, body: JSON.stringify({}) },
  );
  return res.ok && res.data
    ? { ok: true, backupCreated: res.data.backupCreated, message: res.data.message }
    : { ok: false, error: res.error };
}

export async function updateOnlineAvatar(avatarId: string) {
  return apiFetch<{ user: OnlineUser }>('/api/profile/avatar', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify({ avatarId }),
  });
}

export async function addOnlineFriend(friendName: string) {
  return apiFetch<{ user: OnlineUser }>('/api/friends/add', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify({ friendName }),
  });
}

/* ---------------- REAL USER SEARCH & PERSISTENT ROOM INVITES ---------------- */

export async function searchOnlineUsers(query: string): Promise<{
  ok: boolean;
  users: SearchedUserEntry[];
  error?: string;
}> {
  const res = await apiFetch<{ users: SearchedUserEntry[] }>(
    `/api/users/search?q=${encodeURIComponent(query.trim())}`,
    { useOnlineOrigin: true },
  );
  return res.ok && res.data
    ? { ok: true, users: res.data.users }
    : { ok: false, users: [], error: res.error };
}

export async function fetchInvites(): Promise<{
  ok: boolean;
  incoming: PersistentInviteRecord[];
  outgoing: PersistentInviteRecord[];
  error?: string;
}> {
  const res = await apiFetch<{
    incoming: PersistentInviteRecord[];
    outgoing: PersistentInviteRecord[];
  }>('/api/invites', { useOnlineOrigin: true });
  return res.ok && res.data
    ? { ok: true, incoming: res.data.incoming, outgoing: res.data.outgoing }
    : { ok: false, incoming: [], outgoing: [], error: res.error };
}

export async function sendPersistentInvite(params: {
  toUserId?: string;
  toUsername?: string;
  roomCode: string;
  districtId: DistrictId;
  mode: GameMode;
  targetWsUrl: string;
  message?: string;
}): Promise<{
  ok: boolean;
  invite?: PersistentInviteRecord;
  deliveredRealtime?: boolean;
  message?: string;
  error?: string;
}> {
  const res = await apiFetch<{
    ok: boolean;
    invite: PersistentInviteRecord;
    deliveredRealtime: boolean;
    message: string;
  }>('/api/invites', {
    method: 'POST',
    useOnlineOrigin: true,
    body: JSON.stringify(params),
  });
  return res.ok && res.data
    ? {
        ok: true,
        invite: res.data.invite,
        deliveredRealtime: res.data.deliveredRealtime,
        message: res.data.message,
      }
    : { ok: false, error: res.error };
}

export async function respondToInvite(
  inviteId: string,
  action: 'accept' | 'reject' | 'cancel',
): Promise<{
  ok: boolean;
  invite?: PersistentInviteRecord;
  error?: string;
}> {
  const res = await apiFetch<{ ok: boolean; invite?: PersistentInviteRecord }>(
    `/api/invites/${encodeURIComponent(inviteId)}/respond`,
    {
      method: 'POST',
      useOnlineOrigin: true,
      body: JSON.stringify({ action }),
    },
  );
  return res.ok
    ? { ok: true, invite: res.data?.invite }
    : { ok: false, error: res.error };
}

export async function startServerRun(
  districtId: DistrictId,
  mode: GameMode,
): Promise<ActiveRunSession | null> {
  if (!getStoredToken()) return null;
  const res = await apiFetch<ActiveRunSession>('/api/runs/start', {
    method: 'POST',
    useOnlineOrigin: true,
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
    useOnlineOrigin: true,
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
    { useOnlineOrigin: true },
  );
  if (res.ok && res.data) {
    return { ok: true, entries: res.data.entries };
  }
  return { ok: false, entries: [], error: res.error };
}

export async function fetchPublicRooms(customHttpBase?: string): Promise<PublicRoomListing[]> {
  if (customHttpBase) {
    try {
      const clean = customHttpBase.replace(/\/+$/, '');
      const res = await fetch(`${clean}/api/health`);
      if (!res.ok) return [];
      const data = (await res.json()) as { rooms?: PublicRoomListing[] };
      return Array.isArray(data.rooms) ? data.rooms : [];
    } catch {
      return [];
    }
  }
  const res = await apiFetch<{ rooms: PublicRoomListing[] }>('/api/rooms', {
    useOnlineOrigin: true,
  });
  return res.ok && res.data ? res.data.rooms : [];
}

export async function fetchOnlineEvents(): Promise<WeeklyChallengeInfo | null> {
  const res = await apiFetch<WeeklyChallengeInfo>('/api/events/online', {
    useOnlineOrigin: true,
  });
  return res.ok && res.data ? res.data : null;
}

/* ---------------- REAL WEBSOCKET MULTIPLAYER CLIENT (LAN + INTERNET + TUNNEL) ---------------- */

export function parseQuickConnectInput(rawInput: string): {
  targetAddr: string;
  roomCode?: string;
} {
  const trimmed = rawInput.trim();
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx >= 0) {
    const addr = trimmed.slice(0, hashIdx).trim();
    const code = trimmed
      .slice(hashIdx + 1)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return {
      targetAddr: addr,
      roomCode: code.length >= 4 ? code.slice(0, 8) : undefined,
    };
  }
  return { targetAddr: trimmed };
}

export function wsUrlToHttpBase(wsUrl: string): string | null {
  try {
    const u = new URL(normalizeWsTargetUrl(wsUrl));
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:';
    return `${proto}//${u.host}`;
  } catch {
    return null;
  }
}

export interface RemoteHostProbeResult {
  ok: boolean;
  httpBase?: string;
  gameVersion?: string | null;
  rooms?: PublicRoomListing[];
  activeRoomCount?: number | null;
  reason?: string;
  error?: string;
}

export async function probeRemoteHost(target: string): Promise<RemoteHostProbeResult> {
  const res = await apiFetch<RemoteHostProbeResult>('/api/net/probe', {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
  if (!res.ok || !res.data) {
    return { ok: false, error: res.error || 'No se pudo diagnosticar la conexión.' };
  }
  return res.data;
}

export function normalizeWsTargetUrl(rawInput?: string): string {
  const { targetAddr } = parseQuickConnectInput(rawInput || '');
  if (!targetAddr) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  let url = targetAddr;
  if (url.startsWith('http://')) {
    url = `ws://${url.slice(7)}`;
  } else if (url.startsWith('https://')) {
    url = `wss://${url.slice(8)}`;
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    // If bare IPv4 without port (e.g. 26.35.27.51 or 192.168.1.45), default to port 3077
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url)) {
      url = `${url}:3077`;
    }
    const isLocalOrIp =
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url) ||
      /^\d{1,3}(\.\d{1,3}){3}(:\d+)?/.test(url);
    url = `${isLocalOrIp ? 'ws' : 'wss'}://${url}`;
  }
  // Remove trailing slashes, normalize /ws/ -> /ws
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/ws')) {
    url = `${url}/ws`;
  }
  return url;
}

export type MpClientListeners = {
  onConnection?: (connected: boolean, selfUserId?: string, targetUrl?: string) => void;
  onRoomState?: (room: MultiplayerRoomState | null) => void;
  onRoomStarted?: (room: MultiplayerRoomState) => void;
  onTelemetry?: (players: MultiplayerPlayerTelemetry[]) => void;
  onInvited?: (invite: RoomInviteNotice) => void;
  onNotice?: (message: string, isError?: boolean) => void;
  onHostClosed?: (reason: string) => void;
  onKicked?: (reason: string) => void;
  onFinishAck?: (ack: FinishAckPayload) => void;
  onRtcSignal?: (signal: {
    fromUserId: string;
    signalType: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }) => void;
};

class MultiplayerWsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<MpClientListeners>();
  private selfUserId: string | null = null;
  private connected = false;
  private authenticated = false;
  private guestName = 'RUNNER_01';
  private targetUrl = '';
  private clientId = getPersistentClientId();
  private intentionalClose = false;
  private activeRoomCode: string | null = null;
  private activeRoomStatus: 'lobby' | 'racing' | 'finished' | null = null;
  private reconnectTimer: number | null = null;
  private connectTimeoutTimer: number | null = null;
  private pendingAuthQueue: Array<{ event: string; payload: Record<string, unknown> }> = [];
  private pendingConnectWaiters: Array<{ resolve: (ok: boolean) => void; timer: number }> = [];

  public subscribe(listener: MpClientListeners): () => void {
    this.listeners.add(listener);
    if (this.connected && this.authenticated) {
      listener.onConnection?.(true, this.selfUserId ?? undefined, this.targetUrl);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isConnected(): boolean {
    return this.connected && this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  public getSelfUserId(): string | null {
    return this.selfUserId;
  }

  public getTargetUrl(): string {
    return this.targetUrl || normalizeWsTargetUrl();
  }

  private resolveConnectWaiters(ok: boolean): void {
    const waiters = this.pendingConnectWaiters.splice(0);
    for (const w of waiters) {
      window.clearTimeout(w.timer);
      w.resolve(ok);
    }
  }

  public connectAsync(
    optsOrGuestName:
      | string
      | { targetUrl?: string; guestName?: string; clientId?: string } = 'RUNNER_PC',
    timeoutMs = 11500,
  ): Promise<boolean> {
    const opts =
      typeof optsOrGuestName === 'string' ? { guestName: optsOrGuestName } : optsOrGuestName;
    const requestedUrl = normalizeWsTargetUrl(opts.targetUrl ?? (this.targetUrl || undefined));
    if (
      this.connected &&
      this.authenticated &&
      this.ws?.readyState === WebSocket.OPEN &&
      (!this.targetUrl || this.targetUrl === requestedUrl)
    ) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.pendingConnectWaiters = this.pendingConnectWaiters.filter((w) => w.timer !== timer);
        resolve(false);
      }, timeoutMs);
      this.pendingConnectWaiters.push({ resolve, timer });
      this.connect(optsOrGuestName);
    });
  }

  public connect(
    optsOrGuestName:
      | string
      | { targetUrl?: string; guestName?: string; clientId?: string } = 'RUNNER_PC',
  ): void {
    const opts =
      typeof optsOrGuestName === 'string'
        ? { guestName: optsOrGuestName }
        : optsOrGuestName;

    if (opts.guestName) this.guestName = opts.guestName;
    if (opts.clientId) this.clientId = opts.clientId;
    const nextUrl = normalizeWsTargetUrl(opts.targetUrl ?? (this.targetUrl || undefined));

    const urlChanged = this.targetUrl !== '' && nextUrl !== this.targetUrl;
    this.targetUrl = nextUrl;

    if (
      !urlChanged &&
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      if (this.ws.readyState === WebSocket.OPEN && !this.authenticated) {
        this.authenticate();
      } else if (this.ws.readyState === WebSocket.OPEN && this.authenticated) {
        this.resolveConnectWaiters(true);
      }
      return;
    }

    if (this.ws) {
      this.intentionalClose = true;
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }

    this.authenticated = false;
    if (urlChanged) {
      this.pendingAuthQueue = [];
    }

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimeoutTimer !== null) {
      window.clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }

    this.intentionalClose = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(nextUrl);
    } catch {
      this.resolveConnectWaiters(false);
      this.listeners.forEach((l) =>
        l.onNotice?.(`Dirección WebSocket inválida: ${nextUrl}`, true),
      );
      return;
    }

    this.ws = ws;
    let errorNotified = false;
    this.connectTimeoutTimer = window.setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        errorNotified = true;
        try {
          ws.close();
        } catch {
          // Ignore
        }
        this.resolveConnectWaiters(false);
        this.listeners.forEach((l) =>
          l.onNotice?.(
            `Tiempo agotado conectando a ${nextUrl}. Revisa que la IP/puerto estén abiertos y el Firewall de Windows permita el puerto 3077.`,
            true,
          ),
        );
      }
    }, 10500);

    ws.onopen = () => {
      if (this.connectTimeoutTimer !== null) {
        window.clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      this.connected = true;
      this.authenticate();
    };

    ws.onerror = () => {
      this.resolveConnectWaiters(false);
      if (!errorNotified) {
        errorNotified = true;
        this.listeners.forEach((l) =>
          l.onNotice?.(
            `No se pudo establecer conexión WebSocket con ${nextUrl}.`,
            true,
          ),
        );
      }
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
        case 'auth:ok': {
          this.selfUserId = String(p.userId ?? '');
          this.authenticated = true;
          this.resolveConnectWaiters(true);
          this.listeners.forEach((l) =>
            l.onConnection?.(true, this.selfUserId ?? undefined, this.targetUrl),
          );
          const queued = this.pendingAuthQueue.splice(0);
          for (const item of queued) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify(item));
            }
          }
          if (this.activeRoomCode && this.activeRoomStatus === 'racing') {
            this.joinRoom(this.activeRoomCode, 'kai');
          }
          break;
        }
        case 'net:ping':
          this.sendImmediate('net:pong', { ts: p.ts });
          break;
        case 'room:state': {
          const roomState = p as unknown as MultiplayerRoomState;
          this.activeRoomCode = roomState?.code ?? null;
          this.activeRoomStatus = roomState?.status ?? null;
          this.listeners.forEach((l) => l.onRoomState?.(roomState));
          break;
        }
        case 'room:left':
          this.activeRoomCode = null;
          this.activeRoomStatus = null;
          this.listeners.forEach((l) => l.onRoomState?.(null));
          break;
        case 'room:started': {
          const startedRoom = p as unknown as MultiplayerRoomState;
          this.activeRoomCode = startedRoom?.code ?? this.activeRoomCode;
          this.activeRoomStatus = 'racing';
          this.listeners.forEach((l) => l.onRoomStarted?.(startedRoom));
          break;
        }
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
        case 'room:host_closed': {
          const reason = String(p.reason ?? 'El anfitrión cerró la partida.');
          this.activeRoomCode = null;
          this.activeRoomStatus = null;
          this.listeners.forEach((l) => {
            l.onRoomState?.(null);
            l.onHostClosed?.(reason);
          });
          break;
        }
        case 'room:kicked': {
          const reason = String(p.reason ?? 'Fuiste expulsado de la sala.');
          this.activeRoomCode = null;
          this.activeRoomStatus = null;
          this.listeners.forEach((l) => {
            l.onRoomState?.(null);
            l.onKicked?.(reason);
          });
          break;
        }
        case 'room:finish_ack':
          this.listeners.forEach((l) => l.onFinishAck?.(p as unknown as FinishAckPayload));
          break;
        case 'rtc:signal':
          this.listeners.forEach((l) =>
            l.onRtcSignal?.(
              p as {
                fromUserId: string;
                signalType: string;
                sdp?: RTCSessionDescriptionInit;
                candidate?: RTCIceCandidateInit;
              },
            ),
          );
          break;
      }
    };

    ws.onclose = () => {
      if (this.connectTimeoutTimer !== null) {
        window.clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
      }
      this.connected = false;
      this.authenticated = false;
      this.ws = null;
      this.resolveConnectWaiters(false);
      this.listeners.forEach((l) => l.onConnection?.(false, undefined, this.targetUrl));

      if (!this.intentionalClose && this.activeRoomCode && this.activeRoomStatus === 'racing') {
        this.listeners.forEach((l) =>
          l.onNotice?.('Conexión perdida con la sala. Reintentando reconexión...', true),
        );
        this.reconnectTimer = window.setTimeout(() => {
          this.connect({ targetUrl: this.targetUrl, guestName: this.guestName });
        }, 1800);
      }
    };
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.activeRoomCode = null;
    this.activeRoomStatus = null;
    this.authenticated = false;
    this.pendingAuthQueue = [];
    this.resolveConnectWaiters(false);
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private sendImmediate(event: string, payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  public authenticate(): void {
    this.sendImmediate('auth', {
      token: getStoredToken(),
      guestName: this.guestName,
      clientId: this.clientId,
      gameVersion: GAME_VERSION,
    });
  }

  public send(event: string, payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
      this.ws.send(JSON.stringify({ event, payload }));
      return;
    }
    // Queue critical room actions until auth:ok completes instead of silently dropping frames
    if (event !== 'player:telemetry' && this.pendingAuthQueue.length < 16) {
      this.pendingAuthQueue.push({ event, payload });
    }
  }

  public createRoom(params: {
    name?: string;
    isPublic: boolean;
    districtId: DistrictId;
    mode: GameMode;
    characterId: string;
    maxPlayers?: number;
    connectionMode?: NetworkConnectionMode;
    rules?: Partial<RoomRulesConfig>;
  }): void {
    this.send('room:create', {
      ...params,
      gameVersion: GAME_VERSION,
    });
  }

  public joinRoom(code: string, characterId: string): void {
    this.send('room:join', {
      code: code.toUpperCase(),
      characterId,
      gameVersion: GAME_VERSION,
    });
  }

  public leaveRoom(): void {
    this.activeRoomCode = null;
    this.activeRoomStatus = null;
    this.send('room:leave', {});
  }

  public setReady(ready: boolean, characterId: string): void {
    this.send('room:ready', { ready, characterId });
  }

  public updateRoomConfig(params: {
    districtId?: DistrictId;
    mode?: GameMode;
    isPublic?: boolean;
    maxPlayers?: number;
    rules?: Partial<RoomRulesConfig>;
  }): void {
    this.send('room:config', params);
  }

  public startRoomRace(forceStart = false): void {
    this.send('room:start', { forceStart });
  }

  public kickPlayer(targetUserId: string): void {
    this.send('room:kick', { targetUserId });
  }

  public inviteFriend(targetUsername: string): void {
    this.send('room:invite', { targetUsername });
  }

  public sendRtcSignal(params: {
    toUserId: string;
    signalType: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }): void {
    this.send('rtc:signal', params);
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
    coins?: number;
    eliminations?: number;
    abilityTriggered?: boolean;
  }): void {
    this.send('player:telemetry', data);
  }

  public sendPauseState(paused: boolean): void {
    this.send('player:pause', { paused });
  }

  public sendFinish(distance: number, score: number, txId?: string): void {
    this.send('player:finish', { distance, score, txId });
  }
}

export const mpClient = new MultiplayerWsClient();
