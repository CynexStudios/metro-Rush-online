import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Globe,
  KeyRound,
  Link2,
  LogOut,
  Network,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Server,
  Shield,
  ShieldCheck,
  Swords,
  Terminal,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  CHARACTERS,
  DISTRICTS,
  getBossById,
  getCharacterById,
  getDistrictById,
} from '../game/data';
import { resetLocalProgressionClean } from '../game/storage';
import {
  AccountSyncConflict,
  BossId,
  ConflictResolutionStrategy,
  ConnectionQuality,
  DistrictId,
  GameMode,
  InviteStatus,
  LanHostState,
  LanguageCode,
  MultiplayerRoomState,
  NetworkConnectionMode,
  PersistentInviteRecord,
  PlayerSaveData,
  TunnelState,
} from '../game/types';
import { GAME_VERSION } from '../game/version';
import { getCityLabel, getModeLabel, t } from '../i18n';
import {
  addOnlineFriend,
  buildAccountConflict,
  changeOnlinePassword,
  checkServerOnline,
  DatabaseDiagnosticsInfo,
  exportAccountBackupJson,
  fetchDatabaseInfo,
  fetchInvites,
  fetchLanStatus,
  fetchMeOnline,
  fetchOnlineEvents,
  fetchPublicRooms,
  fetchRankings,
  getOnlineBackendUrl,
  getTunnelStatus,
  linkAccountApi,
  listOnlineSessions,
  loadSaveFromSqlite,
  loginOnlineUser,
  logoutAllOnlineSessions,
  logoutOnlineUser,
  mergeSavesWithoutDuplication,
  mpClient,
  normalizeWsTargetUrl,
  OnlineRankingEntry,
  OnlineUser,
  parseQuickConnectInput,
  probeRemoteHost,
  PublicRoomListing,
  RankingScope,
  recoverOnlinePassword,
  registerOnlineUser,
  resetServerTestRankings,
  respondToInvite,
  RoomInviteNotice,
  SearchedUserEntry,
  searchOnlineUsers,
  sendPersistentInvite,
  setOnlineBackendUrl,
  startCloudflaredTunnel,
  startLanHost,
  stopCloudflaredTunnel,
  stopLanHost,
  syncSaveToSqlite,
  updateOnlineAvatar,
  WeeklyChallengeInfo,
  wsUrlToHttpBase,
} from '../services/onlineClient';
import { rtcClient, RtcPeerStatus } from '../services/rtcClient';

interface OnlineHubViewProps {
  save: PlayerSaveData;
  serverOnline: boolean;
  onlineUser: OnlineUser | null;
  activeLocalProfileId: string | null;
  mpConnected: boolean;
  mpSelfId: string | null;
  mpTargetUrl: string;
  mpRoom: MultiplayerRoomState | null;
  mpInvite: RoomInviteNotice | null;
  mpNotice: { text: string; isError?: boolean } | null;
  pendingConflict: AccountSyncConflict | null;
  pendingOnlineSave: PlayerSaveData | null;
  onResolveConflict: (
    strategy: ConflictResolutionStrategy,
    mergedSave: PlayerSaveData,
  ) => Promise<void>;
  onDismissConflict: () => void;
  onDismissInvite: () => void;
  onClearNotice?: () => void;
  onOnlineUserChange: (user: OnlineUser | null) => void;
  onSwitchLocalProfile: (profileId: string, nextSave: PlayerSaveData) => void;
  onReplaceSave: (next: PlayerSaveData) => void;
  onStartChallenge: (districtId: DistrictId, bossId?: BossId) => void;
}

type HubSection = 'multiplayer' | 'account' | 'rankings' | 'network_info';
type NetTabMode = 'lan' | 'vpn' | 'tunnel' | 'webrtc';

const MP_MODES: GameMode[] = ['endless', 'timetrial', 'parkour', 'freerun'];

const INVITE_STATUS_META: Record<InviteStatus, { label: string; cls: string }> = {
  sent: { label: 'Enviada', cls: 'text-cyan-300' },
  pending: { label: 'Pendiente', cls: 'text-amber-300' },
  accepted: { label: 'Aceptada', cls: 'text-emerald-300' },
  rejected: { label: 'Rechazada', cls: 'text-rose-300' },
  room_full: { label: 'Sala Llena', cls: 'text-amber-300' },
  host_offline: { label: 'Anfitrión Desconectado', cls: 'text-slate-400' },
  room_closed: { label: 'Sala Cerrada', cls: 'text-slate-400' },
  cancelled: { label: 'Cancelada', cls: 'text-slate-400' },
};

function formatQualityLabel(q?: ConnectionQuality): { label: string; cls: string } {
  if (q === 'excellent') return { label: 'Excelente', cls: 'text-emerald-300' };
  if (q === 'good') return { label: 'Buena', cls: 'text-cyan-300' };
  if (q === 'fair') return { label: 'Media', cls: 'text-amber-300' };
  if (q === 'poor') return { label: 'Baja', cls: 'text-rose-300' };
  return { label: 'Estable', cls: 'text-slate-300' };
}

export const OnlineHubView: React.FC<OnlineHubViewProps> = ({
  save,
  serverOnline,
  onlineUser,
  activeLocalProfileId,
  mpConnected,
  mpSelfId,
  mpTargetUrl,
  mpRoom,
  mpInvite,
  mpNotice,
  pendingConflict,
  pendingOnlineSave,
  onResolveConflict,
  onDismissConflict,
  onDismissInvite,
  onClearNotice,
  onOnlineUserChange,
  onSwitchLocalProfile: _onSwitchLocalProfile,
  onReplaceSave,
  onStartChallenge,
}) => {
  const lang: LanguageCode = save.settings.language;
  const isElectron = Boolean(window.metroDesktop?.isElectron);

  const [section, setSection] = useState<HubSection>('multiplayer');
  const [netTab, setNetTab] = useState<NetTabMode>('lan');

  // Online Backend URL & Auth
  const [backendUrlInput, setBackendUrlInput] = useState(() => getOnlineBackendUrl());
  const [backendPingResult, setBackendPingResult] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover'>('login');
  const [identifier, setIdentifier] = useState(save.playerName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [avatarId, setAvatarId] = useState(save.selectedCharacterId || 'kai');
  const [issuedRecoveryCode, setIssuedRecoveryCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Conflict state inside view (when clicking "Vincular Perfil")
  const [localConflict, setLocalConflict] = useState<AccountSyncConflict | null>(null);
  const [localConflictOnlineSave, setLocalConflictOnlineSave] = useState<PlayerSaveData | null>(null);

  // SQLite Sync & Diagnostics state
  const [dbInfo, setDbInfo] = useState<DatabaseDiagnosticsInfo | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [confirmCleanReset, setConfirmCleanReset] = useState(false);

  // LAN / VPN / Tunnel state
  const [lanState, setLanState] = useState<LanHostState | null>(null);
  const [lanBindIp, setLanBindIp] = useState(() => localStorage.getItem('mr_radmin_bind_ip') || '0.0.0.0');
  const [lanPort, setLanPort] = useState(() => localStorage.getItem('mr_radmin_port') || '3077');
  const [lanBusy, setLanBusy] = useState(false);
  const [lanError, setLanError] = useState<string | null>(null);
  const [directJoinAddr, setDirectJoinAddr] = useState(() => localStorage.getItem('mr_direct_join_addr') || '');
  const [vpnJoinAddr, setVpnJoinAddr] = useState(() => localStorage.getItem('mr_radmin_join_addr') || '');
  const [internetWsInput, setInternetWsInput] = useState('');
  const [tunnelState, setTunnelState] = useState<TunnelState | null>(null);
  const [tunnelBusy, setTunnelBusy] = useState(false);
  const [firewallStatus, setFirewallStatus] = useState<{
    supported: boolean;
    allowed: boolean;
    busy?: boolean;
  } | null>(null);

  // User search & persistent invites
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SearchedUserEntry[]>([]);
  const [userSearchBusy, setUserSearchBusy] = useState(false);
  const [incomingInvites, setIncomingInvites] = useState<PersistentInviteRecord[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<PersistentInviteRecord[]>([]);

  // WebRTC state
  const [rtcPeers, setRtcPeers] = useState<RtcPeerStatus[]>([]);
  const [rtcSummary, setRtcSummary] = useState(() => rtcClient.getTurnSummary());
  const [showManualRtc, setShowManualRtc] = useState(false);
  const [manualOfferOut, setManualOfferOut] = useState('');
  const [manualRemoteIn, setManualRemoteIn] = useState('');
  const [manualRtcMsg, setManualRtcMsg] = useState<string | null>(null);

  // Rankings & Events
  const [scope, setScope] = useState<RankingScope>('global');
  const [filterCity, setFilterCity] = useState<DistrictId>(save.selectedDistrictId);
  const [filterChar, setFilterChar] = useState<string>(save.selectedCharacterId);
  const [rankings, setRankings] = useState<OnlineRankingEntry[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [history, setHistory] = useState<OnlineRankingEntry[]>([]);
  const [eventsInfo, setEventsInfo] = useState<WeeklyChallengeInfo | null>(null);
  const [friendInput, setFriendInput] = useState('');
  const [friendMsg, setFriendMsg] = useState<string | null>(null);

  // Multiplayer Room Creation / Joining
  const [publicRooms, setPublicRooms] = useState<PublicRoomListing[]>([]);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomIsPublic, setRoomIsPublic] = useState(true);
  const [roomDistrict, setRoomDistrict] = useState<DistrictId>(save.selectedDistrictId);
  const [roomMode, setRoomMode] = useState<GameMode>('endless');
  const [roomMaxPlayers, setRoomMaxPlayers] = useState<number>(6);
  const [allowVehicles, setAllowVehicles] = useState(true);
  const [allowAbilities, setAllowAbilities] = useState(true);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [inviteUserInput, setInviteUserInput] = useState('');
  const [localMpMsg, setLocalMpMsg] = useState<string | null>(null);

  const effectiveConflict = pendingConflict ?? localConflict;
  const effectiveOnlineSave = pendingOnlineSave ?? localConflictOnlineSave;

  const refreshLanState = useCallback(async () => {
    const st = await fetchLanStatus();
    if (st) {
      setLanState(st);
      if (st.running) {
        setLanBindIp(st.bindAddress);
        setLanPort(String(st.port));
      }
    }
  }, []);

  const refreshTunnelState = useCallback(async () => {
    const tState = await getTunnelStatus();
    setTunnelState(tState);
  }, []);

  const refreshFirewallStatus = useCallback(async () => {
    if (!window.metroDesktop?.checkFirewallPort) return;
    const portNum = Math.min(65535, Math.max(1024, Math.floor(Number(lanPort) || 3077)));
    const st = await window.metroDesktop.checkFirewallPort(portNum);
    if (st.ok) {
      setFirewallStatus({ supported: st.supported, allowed: st.allowed });
    }
  }, [lanPort]);

  const handleAllowFirewallPort = async () => {
    if (!window.metroDesktop?.allowFirewallPort) return;
    const portNum = Math.min(65535, Math.max(1024, Math.floor(Number(lanPort) || 3077)));
    setFirewallStatus((prev) => ({
      supported: prev?.supported ?? true,
      allowed: prev?.allowed ?? false,
      busy: true,
    }));
    const res = await window.metroDesktop.allowFirewallPort(portNum);
    await refreshFirewallStatus();
    setLocalMpMsg(
      res.ok
        ? res.message || `Puerto TCP ${portNum} habilitado en Firewall de Windows.`
        : res.error || 'No se pudo habilitar la regla de Firewall.',
    );
  };

  const refreshInvitesList = useCallback(async () => {
    if (!serverOnline || !onlineUser) {
      setIncomingInvites([]);
      setOutgoingInvites([]);
      return;
    }
    const res = await fetchInvites();
    if (res.ok) {
      setIncomingInvites(res.incoming);
      setOutgoingInvites(res.outgoing);
    }
  }, [serverOnline, onlineUser]);

  const loadRankings = useCallback(async () => {
    if (!serverOnline) return;
    setRankingsLoading(true);
    const res = await fetchRankings(
      scope,
      scope === 'city' ? filterCity : undefined,
      scope === 'character' ? filterChar : undefined,
    );
    if (res.ok) {
      setRankings(res.entries);
    }
    setRankingsLoading(false);
  }, [serverOnline, scope, filterCity, filterChar]);

  const loadDbAndRooms = useCallback(async () => {
    if (!serverOnline) return;
    const remoteHttp = mpTargetUrl ? wsUrlToHttpBase(mpTargetUrl) : null;
    const isExternalOrLanHost =
      Boolean(remoteHttp) &&
      remoteHttp !== window.location.origin;
    const [info, rooms] = await Promise.all([
      fetchDatabaseInfo(),
      isExternalOrLanHost && remoteHttp
        ? fetchPublicRooms(remoteHttp)
        : fetchPublicRooms(),
    ]);
    if (info) setDbInfo(info);
    setPublicRooms(rooms);
  }, [serverOnline, mpTargetUrl]);

  useEffect(() => {
    void refreshLanState();
    void refreshTunnelState();
    void refreshFirewallStatus();
    void rtcClient.refreshIceConfig().then((cfg) => {
      setRtcSummary({
        hasTurn: cfg.hasTurn,
        turnInfo: cfg.turnInfo,
        serverCount: cfg.iceServers.length,
      });
    });
    return rtcClient.subscribe(setRtcPeers);
  }, [refreshLanState, refreshTunnelState, refreshFirewallStatus]);

  useEffect(() => {
    void refreshInvitesList();
  }, [refreshInvitesList, mpRoom?.code]);

  useEffect(() => {
    void loadRankings();
  }, [loadRankings]);

  useEffect(() => {
    void loadDbAndRooms();
  }, [loadDbAndRooms, mpRoom?.code]);

  useEffect(() => {
    if (!serverOnline) return;
    void fetchOnlineEvents().then((info) => {
      if (info) setEventsInfo(info);
    });
    if (onlineUser) {
      void fetchMeOnline().then((me) => {
        if (me.ok && me.history) setHistory(me.history);
      });
    }
  }, [serverOnline, onlineUser]);

  const handleStartLanHost = async (preferredBind?: string) => {
    setLanError(null);
    onClearNotice?.();
    const parsedPort = Number(lanPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
      setLanError('El puerto debe estar entre 1024 y 65535.');
      return false;
    }
    const bindTarget = preferredBind ?? lanBindIp;
    setLanBusy(true);
    const res = await startLanHost(bindTarget, parsedPort);
    setLanBusy(false);
    if (!res.ok) {
      setLanError(res.error || 'No se pudo iniciar el servidor de partida.');
      return false;
    }
    if (res.state) setLanState(res.state);
    audioEngine.playClaimReward();

    localStorage.setItem('mr_radmin_bind_ip', bindTarget);
    localStorage.setItem('mr_radmin_port', String(parsedPort));

    // Always connect the host client over local loopback (127.0.0.1) when bound to 0.0.0.0 or a NIC
    const hostConnectIp =
      bindTarget !== '0.0.0.0' && bindTarget.startsWith('127.')
        ? bindTarget
        : '127.0.0.1';
    const ok = await mpClient.connectAsync({
      targetUrl: `ws://${hostConnectIp}:${parsedPort}/ws`,
      guestName: onlineUser?.username || save.playerName,
    });
    setLocalMpMsg(
      ok
        ? `Servidor de partida activo en puerto ${parsedPort} (LAN y VPN listos).`
        : `Servidor activo en puerto ${parsedPort}, pero falló la conexión del cliente local.`,
    );
    return ok;
  };

  const handleStopLanHost = async () => {
    setLanBusy(true);
    onClearNotice?.();
    const res = await stopLanHost();
    setLanBusy(false);
    if (res.state) setLanState(res.state);
    await stopCloudflaredTunnel();
    await refreshTunnelState();
    await mpClient.connectAsync({
      targetUrl: '',
      guestName: onlineUser?.username || save.playerName,
    });
    setLocalMpMsg('Servidor LAN y túneles detenidos.');
  };

  const handleStartTunnel = async () => {
    setTunnelBusy(true);
    setLanError(null);
    onClearNotice?.();
    const parsedPort = Number(lanPort) || 3077;
    if (!lanState?.running) {
      const startedHost = await handleStartLanHost('0.0.0.0');
      if (!startedHost) {
        setTunnelBusy(false);
        return;
      }
    }
    const res = await startCloudflaredTunnel(parsedPort);
    setTunnelState(res.state);
    setTunnelBusy(false);
    if (res.ok && res.state.wssUrl) {
      audioEngine.playClaimReward();
      setLocalMpMsg(
        `Túnel público listo y verificado: ${res.state.wssUrl}. Compártelo con tus amigos junto al código de sala.`,
      );
    } else {
      setLocalMpMsg(res.error || res.state.error || 'No se pudo iniciar cloudflared.');
    }
  };

  const handleStopTunnel = async () => {
    setTunnelBusy(true);
    const res = await stopCloudflaredTunnel();
    setTunnelState(res.state);
    setTunnelBusy(false);
    setLocalMpMsg('Túnel público detenido.');
  };

  const handleConnectCustomEndpoint = async (rawAddr: string, optionalCode?: string) => {
    const parsedInput = parseQuickConnectInput(rawAddr);
    const clean = parsedInput.targetAddr;
    const targetCode = optionalCode?.trim().toUpperCase() || parsedInput.roomCode;
    if (parsedInput.roomCode && !optionalCode?.trim()) {
      setJoinCodeInput(parsedInput.roomCode);
    }
    if (!clean) {
      setLocalMpMsg('Introduce una dirección IP:Puerto, URL WebSocket o invitación rápida.');
      return;
    }
    onClearNotice?.();
    const wsUrl = normalizeWsTargetUrl(clean);
    audioEngine.playUiClick(true);
    setLocalMpMsg(`Verificando conectividad con ${wsUrl}...`);

    // Real TCP/HTTP reachability diagnostic first (avoids blind WebSocket hangs and detects firewall/DNS delays)
    let probe = await probeRemoteHost(clean);
    if (!probe.ok && (probe.reason === 'dns_not_ready' || probe.reason === 'tunnel_origin_offline')) {
      setLocalMpMsg('El túnel está terminando de propagarse, reintentando en 2s...');
      await new Promise((r) => setTimeout(r, 2000));
      probe = await probeRemoteHost(clean);
    }

    if (probe.error && probe.reason && probe.reason !== 'network_error') {
      setLocalMpMsg(probe.error);
      return;
    }

    if (probe.ok && Array.isArray(probe.rooms)) {
      setPublicRooms(probe.rooms);
    }

    setLocalMpMsg(`Conectando WebSocket a ${wsUrl}...`);
    const ok = await mpClient.connectAsync({
      targetUrl: wsUrl,
      guestName: onlineUser?.username || save.playerName,
    });
    if (!ok) {
      setLocalMpMsg(
        probe.error ||
          `No se pudo conectar a ${wsUrl}. Verifica la IP/túnel, el código y que el Firewall de Windows del anfitrión permita el puerto 3077.`,
      );
      return;
    }
    if (targetCode) {
      setLocalMpMsg(`Conectado a ${wsUrl}. Entrando en sala ${targetCode}...`);
      mpClient.joinRoom(targetCode, save.selectedCharacterId);
    } else if (probe.ok && probe.rooms && probe.rooms.length === 1) {
      const found = probe.rooms[0];
      setJoinCodeInput(found.code);
      setLocalMpMsg(
        `¡Conectado a ${wsUrl}! Sala detectada: "${found.name}" (${found.code}). Pulsa Entrar o Unirse abajo.`,
      );
    } else if (probe.ok && probe.activeRoomCount === 0) {
      setLocalMpMsg(
        `¡Conectado a ${wsUrl}! El anfitrión todavía no ha creado una sala (pídele que pulse "Crear Sala").`,
      );
    } else {
      setLocalMpMsg(`Conectado correctamente a ${wsUrl}.`);
    }
    void loadDbAndRooms();
  };

  const handleCreateRoomAction = async (modeKind: NetworkConnectionMode) => {
    audioEngine.playUiClick(true);
    onClearNotice?.();

    const targetLanPort = Math.min(65535, Math.max(1024, Math.floor(Number(lanPort) || 3077)));
    const expectedLocalWs = `ws://127.0.0.1:${targetLanPort}/ws`;
    let isRemoteTarget = false;
    try {
      const parsed = new URL(mpTargetUrl || expectedLocalWs);
      isRemoteTarget =
        parsed.hostname !== '127.0.0.1' &&
        parsed.hostname !== 'localhost' &&
        parsed.host !== window.location.host;
    } catch {
      isRemoteTarget = false;
    }

    // Auto-start host server on 0.0.0.0:3077 so rooms are NEVER trapped on the private internal Electron port
    if (!isRemoteTarget && (!lanState?.running || mpTargetUrl !== expectedLocalWs)) {
      const started = await handleStartLanHost('0.0.0.0');
      if (!started) {
        setLocalMpMsg('No se pudo abrir el puerto anfitrión para crear la sala.');
        return;
      }
    }

    const payload = {
      name: roomNameInput.trim() || undefined,
      isPublic: roomIsPublic,
      districtId: roomDistrict,
      mode: roomMode,
      characterId: save.selectedCharacterId,
      maxPlayers: roomMaxPlayers,
      connectionMode: modeKind,
      rules: {
        allowVehicles,
        allowAbilities,
        difficulty: save.settings.difficulty,
        targetDistance: null,
      },
    };
    const ok = await mpClient.connectAsync({
      guestName: onlineUser?.username || save.playerName,
    });
    if (!ok) {
      setLocalMpMsg('No hay conexión activa al servidor WebSocket para crear la sala.');
      return;
    }
    mpClient.createRoom(payload);
  };

  const handleJoinRoomAction = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    audioEngine.playUiClick(true);
    onClearNotice?.();
    const ok = await mpClient.connectAsync({
      guestName: onlineUser?.username || save.playerName,
    });
    if (!ok) {
      setLocalMpMsg('No se pudo conectar al servidor WebSocket para entrar a la sala.');
      return;
    }
    mpClient.joinRoom(clean, save.selectedCharacterId);
  };

  const handleSearchUsers = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!serverOnline) return;
    setUserSearchBusy(true);
    const res = await searchOnlineUsers(userSearchQuery);
    setUserSearchBusy(false);
    if (res.ok) {
      setUserSearchResults(res.users);
    }
  };

  const handleSendPersistentInvite = async (targetUser: { id?: string; username: string }) => {
    if (!mpRoom) {
      setLocalMpMsg('Primero crea o únete a una sala para invitar jugadores.');
      return;
    }
    mpClient.inviteFriend(targetUser.username);
    if (onlineUser && serverOnline) {
      const shareWs =
        tunnelState?.running && tunnelState.wssUrl
          ? tunnelState.wssUrl
          : lanState?.running && nonInternalIps[0]
            ? `ws://${nonInternalIps[0].address}:${lanState.port}/ws`
            : mpTargetUrl;
      const res = await sendPersistentInvite({
        toUserId: targetUser.id,
        toUsername: targetUser.username,
        roomCode: mpRoom.code,
        districtId: mpRoom.districtId,
        mode: mpRoom.mode,
        targetWsUrl: shareWs,
      });
      setLocalMpMsg(
        res.ok
          ? res.message || `Invitación enviada a ${targetUser.username}.`
          : `Invitación en tiempo real enviada a ${targetUser.username} (${res.error || 'sin respaldo persistente'}).`,
      );
      void refreshInvitesList();
    } else {
      setLocalMpMsg(`Invitación enviada por sala activa a ${targetUser.username}.`);
    }
  };

  const handleTriggerAccountLink = async () => {
    if (!onlineUser) {
      setSyncNotice('Inicia sesión primero en una cuenta online para vincular.');
      return;
    }
    const cloudRes = await loadSaveFromSqlite();
    const onlineSave = cloudRes.ok && cloudRes.hasSave && cloudRes.save ? cloudRes.save : null;
    const conflict = buildAccountConflict({
      localProfileId: activeLocalProfileId || 'local_default',
      localSave: save,
      onlineUser,
      onlineSave,
    });
    if (conflict.hasConflict && onlineSave) {
      setLocalConflict(conflict);
      setLocalConflictOnlineSave(onlineSave);
    } else {
      const merged = onlineSave ? mergeSavesWithoutDuplication(save, onlineSave) : save;
      const txId = `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const res = await linkAccountApi({
        localProfileId: activeLocalProfileId || 'local_default',
        strategy: 'merge',
        mergedSave: merged,
        summary: { mode: 'no_conflict_auto' },
        txId,
      });
      if (res.ok) {
        audioEngine.playClaimReward();
        onReplaceSave(merged);
        setSyncNotice(`Perfil local vinculado con ${onlineUser.username}.`);
      } else {
        setSyncNotice(res.error || 'No se pudo vincular el perfil.');
      }
    }
  };

  const handleResolveConflictAction = async (strategy: ConflictResolutionStrategy) => {
    if (!effectiveConflict) return;
    const onlineSave = effectiveOnlineSave ?? save;
    let chosen: PlayerSaveData;
    if (strategy === 'keep_local') {
      chosen = save;
    } else if (strategy === 'keep_online') {
      chosen = onlineSave;
    } else {
      chosen = mergeSavesWithoutDuplication(save, onlineSave);
    }

    if (pendingConflict) {
      await onResolveConflict(strategy, chosen);
    } else {
      const txId = `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await linkAccountApi({
        localProfileId: effectiveConflict.localProfileId,
        strategy,
        mergedSave: chosen,
        summary: {
          local: effectiveConflict.localSummary,
          online: effectiveConflict.onlineSummary,
        },
        txId,
      });
      onReplaceSave(chosen);
      setLocalConflict(null);
      setLocalConflictOnlineSave(null);
    }
    audioEngine.playClaimReward();
    setSyncNotice(
      strategy === 'keep_local'
        ? 'Conflicto resuelto: se conservó el progreso local.'
        : strategy === 'keep_online'
          ? 'Conflicto resuelto: se aplicó el progreso de la cuenta online.'
          : 'Conflicto resuelto: progresos local y online combinados sin duplicar recompensas.',
    );
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    if (authMode === 'recover') {
      const res = await recoverOnlinePassword(
        identifier.trim(),
        recoveryCodeInput.trim(),
        password,
      );
      setAuthLoading(false);
      if (!res.ok) {
        setAuthError(res.error || 'No se pudo restablecer la contraseña.');
        return;
      }
      audioEngine.playClaimReward();
      setAuthSuccess(res.message || 'Contraseña actualizada. Ya puedes iniciar sesión.');
      setAuthMode('login');
      setPassword('');
      setRecoveryCodeInput('');
      return;
    }

    if (authMode === 'register') {
      const res = await registerOnlineUser(
        identifier.trim(),
        email.trim(),
        password,
        confirmPassword,
        avatarId,
      );
      setAuthLoading(false);
      if (!res.ok || !res.user) {
        setAuthError(res.error || 'No se pudo crear la cuenta.');
        return;
      }
      audioEngine.playClaimReward();
      onOnlineUserChange(res.user);
      if (res.recoveryCode) {
        setIssuedRecoveryCode(res.recoveryCode);
      }
      setPassword('');
      setConfirmPassword('');
      const syncedSave = { ...save, playerName: res.user.username, avatarId: res.user.avatarId };
      await syncSaveToSqlite(syncedSave);
      if (activeLocalProfileId) {
        await linkAccountApi({
          localProfileId: activeLocalProfileId,
          strategy: 'keep_local',
          mergedSave: syncedSave,
          summary: { origin: 'register' },
          txId: `reg_${Date.now()}`,
        });
      }
      mpClient.connect({ guestName: res.user.username });
      void loadDbAndRooms();
      void loadRankings();
      return;
    }

    const res = await loginOnlineUser(identifier.trim(), password);
    setAuthLoading(false);
    if (!res.ok || !res.user) {
      setAuthError(res.error || 'Credenciales incorrectas.');
      return;
    }
    audioEngine.playUiClick(true);
    onOnlineUserChange(res.user);
    setPassword('');

    const cloudRes = await loadSaveFromSqlite();
    if (cloudRes.ok && cloudRes.hasSave && cloudRes.save) {
      const conflict = buildAccountConflict({
        localProfileId: activeLocalProfileId || 'local_default',
        localSave: save,
        onlineUser: res.user,
        onlineSave: cloudRes.save,
      });
      if (conflict.hasConflict) {
        setLocalConflict(conflict);
        setLocalConflictOnlineSave(cloudRes.save);
        setSyncNotice('Detectado progreso tanto local como online. Elige cómo sincronizar abajo.');
      } else if ((save.stats?.totalRuns ?? 0) === 0) {
        onReplaceSave(cloudRes.save);
        setSyncNotice('Progreso recuperado automáticamente desde tu cuenta online.');
      }
    }
    mpClient.connect({ guestName: res.user.username });
    void loadDbAndRooms();
    void loadRankings();
  };

  const handleManualSync = async () => {
    setSyncNotice('Sincronizando con cuenta online...');
    const res = await syncSaveToSqlite(save);
    if (res.ok) {
      audioEngine.playClaimReward();
      setSyncNotice(
        `Progreso sincronizado (${new Date(res.updatedAt || Date.now()).toLocaleTimeString()}).`,
      );
      void loadDbAndRooms();
    } else {
      setSyncNotice(res.error || 'Error al sincronizar.');
    }
  };

  const handleLoadFromSqlite = async () => {
    const res = await loadSaveFromSqlite();
    if (res.ok && res.hasSave && res.save) {
      audioEngine.playClaimReward();
      onReplaceSave(res.save);
      setSyncNotice('Partida cargada desde la cuenta online.');
    } else if (res.ok && !res.hasSave) {
      setSyncNotice('Esta cuenta online aún no tiene progreso guardado.');
    } else {
      setSyncNotice(res.error || 'No se pudo leer desde el servidor.');
    }
  };

  const handleExportAccountJson = async () => {
    const res = await exportAccountBackupJson();
    if (!res.ok || !res.content) {
      setSyncNotice(res.error || 'Error al exportar.');
      return;
    }
    if (window.metroDesktop?.exportBackupFile) {
      const nativeRes = await window.metroDesktop.exportBackupFile(
        res.filename || 'metro-rush-online-backup.json',
        res.content,
      );
      if (nativeRes.ok) {
        audioEngine.playClaimReward();
        setSyncNotice(`Respaldo guardado en ${nativeRes.filePath}`);
      } else if (!nativeRes.canceled) {
        setSyncNotice(nativeRes.error || 'No se pudo guardar el respaldo.');
      }
      return;
    }
    const blob = new Blob([res.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename || 'metro-rush-sqlite-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    audioEngine.playClaimReward();
    setSyncNotice('Respaldo JSON descargado.');
  };

  const handleCleanTestReset = async () => {
    const res = await resetServerTestRankings();
    const cleaned = resetLocalProgressionClean(save);
    onReplaceSave(cleaned);
    setRankings([]);
    setHistory([]);
    setConfirmCleanReset(false);
    audioEngine.playUiClick(true);
    setSyncNotice(
      res.ok
        ? `Datos de prueba limpiados (${res.backupCreated}). Ranking y progreso listos.`
        : 'Progreso local limpiado.',
    );
    void loadDbAndRooms();
    void loadRankings();
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    setFriendMsg(null);
    const res = await addOnlineFriend(friendInput.trim());
    if (!res.ok || !res.data?.user) {
      setFriendMsg(res.error || 'Jugador no encontrado');
      return;
    }
    onOnlineUserChange(res.data.user);
    setFriendInput('');
    setFriendMsg('Amigo añadido correctamente.');
    if (scope === 'friends') void loadRankings();
  };

  const bossOfWeek = eventsInfo
    ? getBossById(eventsInfo.bossOfWeek.bossId as BossId)
    : null;

  const selfPlayerInRoom = mpRoom?.players.find((p) => p.userId === mpSelfId);
  const isHost = Boolean(mpRoom && mpSelfId && mpRoom.hostId === mpSelfId);
  const allReady = Boolean(
    mpRoom && mpRoom.players.length >= 1 && mpRoom.players.every((p) => p.ready),
  );
  const nonInternalIps = (lanState?.interfaces ?? []).filter((i) => !i.internal);
  const lanOnlyIps = nonInternalIps.filter((i) => i.kind !== 'vpn');
  const vpnOnlyIps = nonInternalIps.filter((i) => i.kind === 'vpn');

  return (
    <div className="space-y-5">
      {/* Header Status Row (Clean unboxed metadata, tabular numbers) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="font-display text-xl font-bold text-white">
            {t(lang, 'online.title')}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono-num">
            Versión v{GAME_VERSION} · Perfil Local Offline + Cuentas Online + Multijugador LAN e Internet
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num">
          <span
            className={`flex items-center gap-1.5 font-semibold ${
              serverOnline ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {serverOnline ? (
              <>
                <ShieldCheck className="w-4 h-4" /> SQLite Local Activo
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" /> Solo Navegador
              </>
            )}
          </span>
          <span className="text-slate-600">·</span>
          <span className={mpConnected ? 'text-cyan-300 font-semibold' : 'text-slate-400'}>
            Sala WS: {mpConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Urgent Notice / Kick / Host Closed / Version Mismatch */}
      {(mpNotice || localMpMsg) && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            mpNotice?.isError
              ? 'bg-rose-950/50 border-rose-400/60 text-rose-200'
              : 'bg-[#0b182e] border-cyan-400/50 text-cyan-200'
          }`}
        >
          <span>{mpNotice?.text || localMpMsg}</span>
          <button
            onClick={() => {
              setLocalMpMsg(null);
              onClearNotice?.();
            }}
            className="text-slate-300 hover:text-white font-semibold shrink-0 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Conflict Resolution Panel (visible anywhere in hub if triggered on boot/login) */}
      {effectiveConflict && (
        <div className="p-4 rounded-xl bg-[#0e172c] border border-amber-400/60 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-sm text-white">
                  Conflicto de Progreso al Vincular Cuenta
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Tienes progreso avanzado tanto en tu perfil local (<strong className="text-white">{effectiveConflict.localName}</strong>) como en tu cuenta online (<strong className="text-cyan-300">{effectiveConflict.onlineUsername}</strong>). Ningún dato se sobrescribirá sin tu elección.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setLocalConflict(null);
                setLocalConflictOnlineSave(null);
                onDismissConflict();
              }}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Decidir luego
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono-num">
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-1">
              <div className="font-bold text-amber-300 font-sans">
                Perfil Local: {effectiveConflict.localName}
              </div>
              <div className="text-slate-300">
                Nivel {effectiveConflict.localSummary.level} · {effectiveConflict.localSummary.coins.toLocaleString('es-ES')} Monedas · {effectiveConflict.localSummary.gems} Gemas
              </div>
              <div className="text-slate-400">
                {effectiveConflict.localSummary.totalRuns} carreras · Mejor: {effectiveConflict.localSummary.bestScore.toLocaleString('es-ES')} pts · {effectiveConflict.localSummary.unlockedCount} desbloqueados
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#070b17] border border-cyan-500/30 space-y-1">
              <div className="font-bold text-cyan-300 font-sans">
                Cuenta Online: {effectiveConflict.onlineUsername}
              </div>
              <div className="text-slate-300">
                Nivel {effectiveConflict.onlineSummary.level} · {effectiveConflict.onlineSummary.coins.toLocaleString('es-ES')} Monedas · {effectiveConflict.onlineSummary.gems} Gemas
              </div>
              <div className="text-slate-400">
                {effectiveConflict.onlineSummary.totalRuns} carreras · Mejor: {effectiveConflict.onlineSummary.bestScore.toLocaleString('es-ES')} pts · {effectiveConflict.onlineSummary.unlockedCount} desbloqueados
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleResolveConflictAction('merge')}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
            >
              Combinar sin Duplicar (Recomendado)
            </button>
            <button
              onClick={() => void handleResolveConflictAction('keep_local')}
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs cursor-pointer whitespace-nowrap"
            >
              Conservar Progreso Local
            </button>
            <button
              onClick={() => void handleResolveConflictAction('keep_online')}
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs cursor-pointer whitespace-nowrap"
            >
              Conservar Progreso Online
            </button>
          </div>
        </div>
      )}

      {/* Incoming Invite Notice */}
      {mpInvite && (
        <div className="p-3.5 rounded-xl bg-[#0d1c33] border border-cyan-400/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-cyan-300">
              Invitación de {mpInvite.fromUsername}
            </span>
            <span className="text-slate-200">
              {' '}
              para correr en {getCityLabel(lang, mpInvite.districtId).name} ({getModeLabel(lang, mpInvite.mode).label}) · Sala{' '}
              <span className="font-mono-num font-bold text-white">{mpInvite.code}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await handleJoinRoomAction(mpInvite.code);
                onDismissInvite();
                setSection('multiplayer');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
            >
              Unirse a Sala
            </button>
            <button
              onClick={onDismissInvite}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-slate-300 hover:text-white cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['multiplayer', 'Multijugador LAN / Internet', Users],
            ['account', 'Cuenta Online y Sesión', Database],
            ['rankings', 'Clasificaciones y Retos', Globe],
            ['network_info', 'Arquitectura de Red PC', Network],
          ] as [HubSection, string, React.ComponentType<{ className?: string }>][]
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => {
              audioEngine.playUiClick();
              setSection(id);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              section === id
                ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                : 'bg-[#0b1224] text-slate-300 border-white/10 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* SECTION 1: MULTIPLAYER (4 MODES: LAN / VPN / TUNNEL / WEBRTC + AUTHORITATIVE LOBBY + REAL INVITES) */}
      {section === 'multiplayer' && (
        <div className="space-y-4">
          {!mpRoom ? (
            <>
              {/* 4 Connection Mode Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5 bg-[#070b17] p-1 rounded-lg border border-white/10">
                  {(
                    [
                      ['lan', 'Red Local (LAN)', Wifi],
                      ['vpn', 'VPN Virtual (Radmin/ZeroTier)', Shield],
                      ['tunnel', 'Túnel Gratuito (cloudflared/playit)', Terminal],
                      ['webrtc', 'WebRTC P2P Directo', Radio],
                    ] as [NetTabMode, string, React.ComponentType<{ className?: string }>][]
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setNetTab(id);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        netTab === id
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] font-mono-num text-slate-400 truncate max-w-md">
                  Destino activo: <span className="text-cyan-300">{mpTargetUrl}</span>
                </div>
              </div>

              {/* MODE 1: RED LOCAL (LAN) */}
              {netTab === 'lan' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/35 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-display font-bold text-base text-white flex items-center gap-2">
                        <Server className="w-4 h-4 text-cyan-400" /> Alojar Partida LAN en este PC
                      </div>
                      <span
                        className={`text-[11px] font-mono-num font-bold ${
                          lanState?.running ? 'text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        {lanState?.running ? `Activo :${lanState.port}` : 'Detenido'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Abre un servidor autoritativo en tu Wi‑Fi o cable local. Tú te conectas automáticamente por loopback local y tus amigos introducen tu IP LAN + código de sala.
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <select
                        value={lanBindIp}
                        onChange={(e) => setLanBindIp(e.target.value)}
                        disabled={Boolean(lanState?.running)}
                        className="bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white disabled:opacity-50"
                      >
                        <option value="0.0.0.0">Todas las interfaces (0.0.0.0)</option>
                        {(lanState?.interfaces ?? []).map((iface) => (
                          <option key={`${iface.name}-${iface.address}`} value={iface.address}>
                            {iface.label || iface.name}: {iface.address}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1024}
                        max={65535}
                        value={lanPort}
                        disabled={Boolean(lanState?.running)}
                        onChange={(e) => setLanPort(e.target.value)}
                        placeholder="Puerto (ej. 3077)"
                        className="bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num text-white disabled:opacity-50"
                      />
                    </div>

                    {lanError && <div className="text-xs text-rose-300">{lanError}</div>}

                    <div className="flex flex-wrap gap-2">
                      {!lanState?.running ? (
                        <button
                          disabled={lanBusy}
                          onClick={() => void handleStartLanHost()}
                          className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          {lanBusy ? 'Abriendo puerto...' : 'Iniciar Servidor LAN'}
                        </button>
                      ) : (
                        <button
                          disabled={lanBusy}
                          onClick={() => void handleStopLanHost()}
                          className="px-4 py-2 rounded-lg bg-rose-500/20 border border-rose-400/50 hover:bg-rose-500/30 text-rose-200 font-bold text-xs cursor-pointer"
                        >
                          Cerrar Servidor LAN
                        </button>
                      )}
                      <button
                        onClick={() => void refreshLanState()}
                        className="px-3 py-2 rounded-lg bg-[#070b17] border border-white/10 text-slate-300 hover:text-white text-xs cursor-pointer"
                      >
                        Detectar IPs
                      </button>
                      {isElectron && firewallStatus?.supported && (
                        <button
                          disabled={firewallStatus.busy}
                          onClick={() => void handleAllowFirewallPort()}
                          className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                            firewallStatus.allowed
                              ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-200'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          }`}
                        >
                          {firewallStatus.busy
                            ? 'Abriendo Firewall...'
                            : firewallStatus.allowed
                              ? `Firewall TCP ${lanPort} OK`
                              : `Abrir Puerto ${lanPort} en Firewall`}
                        </button>
                      )}
                    </div>

                    {lanState?.running && (
                      <div className="p-2.5 rounded-lg bg-[#070b17] border border-emerald-400/40 text-[11px] font-mono-num text-emerald-200 space-y-1">
                        <div>IPs LAN para compartir con amigos en el mismo router:</div>
                        {(lanOnlyIps.length > 0 ? lanOnlyIps : nonInternalIps).map((i) => (
                          <div key={i.address} className="flex items-center justify-between gap-2 text-white font-bold">
                            <span>
                              {i.address}:{lanState.port} ({i.label || i.name})
                            </span>
                            <button
                              onClick={() => {
                                void navigator.clipboard?.writeText(`${i.address}:${lanState.port}`);
                                setLocalMpMsg(`Copiado ${i.address}:${lanState.port}`);
                              }}
                              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-cyan-300 cursor-pointer"
                            >
                              Copiar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Join by Direct LAN IP:Port */}
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                    <div className="font-display font-bold text-base text-white">
                      Unirse a Anfitrión LAN (IP:Puerto)
                    </div>
                    <p className="text-xs text-slate-400">
                      Pega la IP local (el puerto <span className="font-mono-num text-slate-200">:3077</span> es automático) o la invitación completa <span className="font-mono-num text-cyan-300">192.168.1.45:3077#CODIGO</span>.
                    </p>
                    <input
                      type="text"
                      value={directJoinAddr}
                      onChange={(e) => setDirectJoinAddr(e.target.value)}
                      placeholder="192.168.1.45 o 192.168.1.45:3077#CODIGO"
                      className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num text-white outline-none focus:border-cyan-400"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        maxLength={8}
                        placeholder="Código de sala (opcional al conectar)"
                        className="flex-1 bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num uppercase text-white outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() =>
                          void handleConnectCustomEndpoint(
                            directJoinAddr || `${window.location.host}`,
                            joinCodeInput.trim() || undefined,
                          )
                        }
                        className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        Conectar LAN
                      </button>
                    </div>
                    {joinCodeInput.trim() && mpConnected && (
                      <button
                        onClick={() => void handleJoinRoomAction(joinCodeInput)}
                        className="w-full py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Entrar a Sala {joinCodeInput.trim()}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* MODE 2: VPN VIRTUAL (RADMIN VPN / ZEROTIER / TAILSCALE / HAMACHI) */}
              {netTab === 'vpn' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-emerald-500/35 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-display font-bold text-base text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" /> Red VPN Virtual (Sin abrir puertos)
                      </div>
                      <button
                        onClick={() => void refreshLanState()}
                        className="text-xs text-cyan-300 hover:underline cursor-pointer"
                      >
                        Refrescar VPN
                      </button>
                    </div>
                    <p className="text-xs text-slate-300">
                      Si tú y tus amigos estáis en la misma red virtual de <strong className="text-white">Radmin VPN</strong>, <strong className="text-white">ZeroTier</strong>, <strong className="text-white">Tailscale</strong> o <strong className="text-white">Hamachi</strong>, inicia el servidor LAN (0.0.0.0) y comparte la IP virtual detectada abajo.
                    </p>

                    <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-2 text-xs">
                      <div className="font-semibold text-emerald-300">
                        Interfaces VPN detectadas en este equipo ({vpnOnlyIps.length}):
                      </div>
                      {vpnOnlyIps.length === 0 ? (
                        <div className="text-slate-400">
                          No se detectó ningún adaptador Radmin/ZeroTier/Tailscale/Hamachi activo en este PC. Abre tu VPN y pulsa «Refrescar VPN».
                        </div>
                      ) : (
                        vpnOnlyIps.map((v) => (
                          <div
                            key={v.address}
                            className="flex items-center justify-between gap-2 font-mono-num text-white"
                          >
                            <span>
                              {v.address}:{lanState?.port || lanPort} · {v.label || v.name}
                            </span>
                            <button
                              onClick={() => {
                                void navigator.clipboard?.writeText(
                                  `${v.address}:${lanState?.port || lanPort}`,
                                );
                                setLocalMpMsg(`IP VPN copiada: ${v.address}:${lanState?.port || lanPort}`);
                              }}
                              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-cyan-300 cursor-pointer"
                            >
                              Copiar IP VPN
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!lanState?.running ? (
                        <button
                          disabled={lanBusy}
                          onClick={() => void handleStartLanHost('0.0.0.0')}
                          className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Alojar Partida para VPN (Puerto {lanPort})
                        </button>
                      ) : (
                        <button
                          disabled={lanBusy}
                          onClick={() => void handleStopLanHost()}
                          className="px-4 py-2 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 font-bold text-xs cursor-pointer"
                        >
                          Cerrar Servidor ({lanState.port})
                        </button>
                      )}
                      {isElectron && firewallStatus?.supported && (
                        <button
                          disabled={firewallStatus.busy}
                          onClick={() => void handleAllowFirewallPort()}
                          className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                            firewallStatus.allowed
                              ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-200'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          }`}
                        >
                          {firewallStatus.busy
                            ? 'Abriendo Firewall...'
                            : firewallStatus.allowed
                              ? `Firewall TCP ${lanState?.port || lanPort} OK`
                              : `Abrir Puerto ${lanState?.port || lanPort} en Firewall`}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                    <div className="font-display font-bold text-base text-white">
                      Unirse a Amigo por VPN Virtual
                    </div>
                    <p className="text-xs text-slate-400">
                      Pega la IP de Radmin/ZeroTier/Tailscale de tu amigo (sin puerto usa <span className="font-mono-num text-slate-200">:3077</span>) o su invitación <span className="font-mono-num text-emerald-300">26.35.27.51:3077#CODIGO</span>.
                    </p>
                    <input
                      type="text"
                      value={vpnJoinAddr}
                      onChange={(e) => setVpnJoinAddr(e.target.value)}
                      placeholder="26.35.27.51 o 26.35.27.51:3077#CODIGO"
                      className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num text-white outline-none focus:border-cyan-400"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        maxLength={8}
                        placeholder="Código de sala (opcional)"
                        className="flex-1 bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num uppercase text-white outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() =>
                          void handleConnectCustomEndpoint(
                            vpnJoinAddr,
                            joinCodeInput.trim() || undefined,
                          )
                        }
                        className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                      >
                        Conectar VPN
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: TÚNEL GRATUITO INTERNET (CLOUDFLARED AUTO + PLAYIT.GG GUIDE) */}
              {netTab === 'tunnel' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/35 space-y-3">
                    <div className="font-display font-bold text-base text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" /> Alojar por Internet con Túnel Gratuito
                    </div>
                    <p className="text-xs text-slate-300">
                      Si tus amigos no están en tu casa ni en VPN, puedes exponer tu partida por Internet sin abrir puertos del router usando <strong className="text-white">cloudflared</strong> (automático en Windows si está instalado) o <strong className="text-white">playit.gg</strong>.
                    </p>

                    <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          Cloudflare Quick Tunnel (cloudflared)
                        </span>
                        <span
                          className={`font-mono-num text-[11px] font-bold ${
                            tunnelState?.running
                              ? 'text-emerald-300'
                              : tunnelState?.available
                                ? 'text-cyan-300'
                                : 'text-amber-300'
                          }`}
                        >
                          {tunnelState?.running
                            ? 'Túnel Activo'
                            : tunnelState?.available
                              ? 'Detectado en sistema'
                              : 'No detectado / Solo Desktop'}
                        </span>
                      </div>
                      {tunnelState?.wssUrl && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded bg-emerald-950/40 border border-emerald-400/40 font-mono-num text-emerald-200">
                          <span className="truncate">{tunnelState.wssUrl}</span>
                          <button
                            onClick={() => {
                              void navigator.clipboard?.writeText(tunnelState.wssUrl || '');
                              setLocalMpMsg('URL pública WSS del túnel copiada.');
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-bold text-[10px] shrink-0 cursor-pointer"
                          >
                            Copiar WSS
                          </button>
                        </div>
                      )}
                      {tunnelState?.error && (
                        <div className="text-[11px] text-amber-300">{tunnelState.error}</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {!tunnelState?.running ? (
                          <button
                            disabled={tunnelBusy || !isElectron}
                            onClick={() => void handleStartTunnel()}
                            className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-slate-950 font-bold cursor-pointer"
                          >
                            {tunnelBusy
                              ? 'Abriendo túnel...'
                              : 'Iniciar Túnel Público (cloudflared)'}
                          </button>
                        ) : (
                          <button
                            disabled={tunnelBusy}
                            onClick={() => void handleStopTunnel()}
                            className="px-3.5 py-2 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 font-bold cursor-pointer"
                          >
                            Detener Túnel
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 text-[11px] text-slate-300 space-y-1">
                      <div className="font-bold text-white">Alternativa manual gratuita con playit.gg:</div>
                      <div>1. Inicia tu Servidor LAN arriba (puerto {lanPort}).</div>
                      <div>2. En playit.gg crea un túnel TCP apuntando a <span className="font-mono-num text-cyan-300">127.0.0.1:{lanPort}</span>.</div>
                      <div>3. Comparte la dirección generada junto con tu código de 6 letras.</div>
                    </div>
                  </div>

                  {/* Client Connect to Internet Tunnel */}
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                    <div className="font-display font-bold text-base text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" /> Conectar a Túnel o Servidor Internet
                    </div>
                    <p className="text-xs text-slate-300">
                      Pega aquí la URL <span className="font-mono-num text-cyan-300">wss://...</span> de cloudflared, playit.gg o invitación completa (<span className="font-mono-num text-emerald-300">wss://...#CODIGO</span>).
                    </p>
                    <input
                      type="text"
                      value={internetWsInput}
                      onChange={(e) => setInternetWsInput(e.target.value)}
                      placeholder="wss://subdominio.trycloudflare.com o wss://...#CODIGO"
                      className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num text-white outline-none focus:border-cyan-400"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        maxLength={8}
                        placeholder="Código de sala (opcional)"
                        className="flex-1 bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num uppercase text-white outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() =>
                          void handleConnectCustomEndpoint(
                            internetWsInput,
                            joinCodeInput.trim() || undefined,
                          )
                        }
                        className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                      >
                        Conectar Túnel
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        void mpClient.connectAsync({
                          targetUrl: '',
                          guestName: onlineUser?.username || save.playerName,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#070b17] border border-white/15 text-slate-300 hover:text-white text-xs cursor-pointer"
                    >
                      Volver a Servidor Local
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 4: WEBRTC P2P DIRECTO (STUN/TURN + DATACHANNEL) */}
              {netTab === 'webrtc' && (
                <div className="p-4 rounded-xl bg-[#0b1224] border border-fuchsia-500/35 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-display font-bold text-base text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-fuchsia-400" /> WebRTC P2P Directo (STUN/TURN + DataChannel)
                    </div>
                    <button
                      onClick={() => setShowManualRtc((v) => !v)}
                      className="text-xs text-cyan-300 hover:underline cursor-pointer"
                    >
                      {showManualRtc ? 'Ocultar SDP Manual' : 'Intercambio Manual Offer/Answer'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300">
                    {rtcSummary.turnInfo} ({rtcSummary.serverCount} servidores ICE configurados). Cuando estableces un canal DataChannel abierto con otro corredor, la telemetría de carrera también se envía P2P con latencia reducida manteniendo validación del anfitrión.
                  </p>

                  {showManualRtc && (
                    <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const offer = await rtcClient.createManualOffer();
                              setManualOfferOut(offer);
                              setManualRtcMsg('Oferta WebRTC generada. Envíala al otro jugador.');
                            } catch (e) {
                              setManualRtcMsg(e instanceof Error ? e.message : 'Error WebRTC');
                            }
                          }}
                          className="px-3 py-1.5 rounded bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                        >
                          1. Generar Offer
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const answer = await rtcClient.acceptManualOfferAndCreateAnswer(
                                manualRemoteIn,
                              );
                              setManualOfferOut(answer);
                              setManualRtcMsg('Answer generado. Devuélvelo al anfitrión.');
                            } catch (e) {
                              setManualRtcMsg(e instanceof Error ? e.message : 'Offer inválido');
                            }
                          }}
                          className="px-3 py-1.5 rounded bg-fuchsia-400 text-slate-950 font-bold cursor-pointer"
                        >
                          2. Aceptar Offer y Crear Answer
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await rtcClient.applyManualAnswer(manualRemoteIn);
                              setManualRtcMsg('Answer aplicado. Esperando canal DataChannel...');
                            } catch (e) {
                              setManualRtcMsg(e instanceof Error ? e.message : 'Answer inválido');
                            }
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                        >
                          3. Aplicar Answer
                        </button>
                      </div>
                      {manualOfferOut && (
                        <textarea
                          readOnly
                          rows={2}
                          value={manualOfferOut}
                          className="w-full bg-[#070b17] border border-white/15 rounded p-2 text-[10px] font-mono-num text-cyan-200"
                        />
                      )}
                      <textarea
                        rows={2}
                        value={manualRemoteIn}
                        onChange={(e) => setManualRemoteIn(e.target.value)}
                        placeholder="Pega aquí el Offer o Answer JSON recibido..."
                        className="w-full bg-[#070b17] border border-white/15 rounded p-2 text-[10px] font-mono-num text-white"
                      />
                      {manualRtcMsg && <div className="text-[11px] text-cyan-300">{manualRtcMsg}</div>}
                    </div>
                  )}

                  {rtcPeers.length > 0 && (
                    <div className="space-y-1 text-[11px] font-mono-num">
                      {rtcPeers.map((rp) => (
                        <div key={rp.peerId} className="text-emerald-300">
                          Peer {rp.peerId.slice(0, 8)}: {rp.state} · ICE {rp.iceState} · Canal{' '}
                          {rp.channelOpen ? 'Abierto' : 'Cerrando'}
                          {rp.rttMs ? ` · ${rp.rttMs}ms` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create Room & Public/Code Join Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-display font-bold text-base text-white">
                      Crear Sala Autoritativa (v{GAME_VERSION})
                    </div>
                    <button
                      onClick={() =>
                        void mpClient.connectAsync({
                          guestName: onlineUser?.username || save.playerName,
                        })
                      }
                      className="text-xs text-cyan-300 hover:underline cursor-pointer"
                    >
                      {mpConnected ? 'Conectado' : 'Reconectar'}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Nombre de la sala (opcional)"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  />

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <select
                      value={roomDistrict}
                      onChange={(e) => setRoomDistrict(e.target.value as DistrictId)}
                      className="bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {getCityLabel(lang, d.id).name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={roomMode}
                      onChange={(e) => setRoomMode(e.target.value as GameMode)}
                      className="bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                    >
                      {MP_MODES.map((m) => (
                        <option key={m} value={m}>
                          {getModeLabel(lang, m).label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={roomMaxPlayers}
                      onChange={(e) => setRoomMaxPlayers(Number(e.target.value))}
                      className="bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white font-mono-num"
                    >
                      {[2, 3, 4, 6, 8].map((n) => (
                        <option key={n} value={n}>
                          Máx {n} jug.
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-200">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roomIsPublic}
                        onChange={(e) => setRoomIsPublic(e.target.checked)}
                        className="accent-cyan-400"
                      />
                      Pública
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowVehicles}
                        onChange={(e) => setAllowVehicles(e.target.checked)}
                        className="accent-cyan-400"
                      />
                      Vehículos
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowAbilities}
                        onChange={(e) => setAllowAbilities(e.target.checked)}
                        className="accent-cyan-400"
                      />
                      Habilidades
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() =>
                        void handleCreateRoomAction(
                          netTab === 'lan' || netTab === 'vpn'
                            ? 'lan'
                            : netTab === 'webrtc'
                              ? 'internet_webrtc'
                              : 'internet_ws',
                        )
                      }
                      className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Crear Sala{' '}
                      {netTab === 'lan'
                        ? 'LAN'
                        : netTab === 'vpn'
                          ? 'VPN'
                          : netTab === 'webrtc'
                            ? 'WebRTC'
                            : 'Internet'}
                    </button>
                  </div>
                </div>

                {/* Join by Code + Public Rooms */}
                <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-display font-bold text-base text-white">
                      Unirse por Código o Sala Abierta
                    </div>
                    <button
                      onClick={() => void loadDbAndRooms()}
                      className="p-1.5 rounded bg-[#070b17] border border-white/10 text-slate-300 hover:text-cyan-300 cursor-pointer"
                      title="Refrescar salas"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Código de sala (ej. A4K9P2)"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      maxLength={8}
                      className="flex-1 bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num uppercase text-white outline-none focus:border-cyan-400"
                    />
                    <button
                      disabled={!joinCodeInput.trim()}
                      onClick={() => void handleJoinRoomAction(joinCodeInput)}
                      className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Entrar
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {publicRooms.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-white/10 rounded-lg">
                        No hay salas públicas listadas en el servidor actual.
                      </div>
                    ) : (
                      publicRooms.map((r) => (
                        <div
                          key={r.code}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#070b17] border border-white/10 text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">
                              {r.name} · <span className="font-mono-num text-cyan-300">{r.code}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-num">
                              Anfitrión: {r.hostName} · {getCityLabel(lang, r.districtId).name} ·{' '}
                              {r.playerCount}/{r.maxPlayers} · v{r.gameVersion || GAME_VERSION}
                            </div>
                          </div>
                          <button
                            onClick={() => void handleJoinRoomAction(r.code)}
                            className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
                          >
                            Unirse
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Active Room Lobby / Live Standings */
            <div className="p-5 rounded-xl bg-[#0b1224] border border-cyan-400/50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-xs text-cyan-300 font-mono-num font-semibold">
                    Sala Activa · {mpRoom.isPublic ? 'Pública' : 'Privada'} ·{' '}
                    {mpRoom.connectionMode === 'lan' ? 'LAN/VPN' : 'Internet'} · v{mpRoom.gameVersion || GAME_VERSION} ·{' '}
                    {mpRoom.status === 'lobby'
                      ? 'En Lobby'
                      : mpRoom.status === 'racing'
                        ? 'En Carrera'
                        : 'Finalizada'}
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <h4 className="font-display text-xl font-bold text-white">
                      {mpRoom.name}
                    </h4>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(mpRoom.code);
                        setLocalMpMsg(`Código ${mpRoom.code} copiado al portapapeles.`);
                      }}
                      className="px-2.5 py-1 rounded bg-[#070b17] border border-cyan-400/40 font-mono-num text-xs font-bold text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {mpRoom.code} <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      audioEngine.playUiClick();
                      mpClient.setReady(!selfPlayerInRoom?.ready, save.selectedCharacterId);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                      selfPlayerInRoom?.ready
                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {selfPlayerInRoom?.ready ? 'Listo' : 'Marcar Listo'}
                  </button>

                  {isHost && mpRoom.status !== 'racing' && (
                    <button
                      disabled={!allReady}
                      onClick={() => {
                        audioEngine.playUiClick(true);
                        mpClient.startRoomRace();
                      }}
                      className="px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4 fill-current" /> Iniciar Carrera
                    </button>
                  )}

                  <button
                    onClick={() => {
                      audioEngine.playUiClick();
                      mpClient.leaveRoom();
                      rtcClient.closeAll();
                    }}
                    className="px-3.5 py-2 rounded-lg border border-rose-400/40 text-rose-200 hover:bg-rose-500/20 text-xs font-semibold cursor-pointer"
                  >
                    Salir de Sala
                  </button>
                </div>
              </div>

              {/* Host Share Box inside Lobby (1-Click Quick Invite + Windows Firewall + Cloudflare Tunnel) */}
              {isHost && (
                <div className="p-3.5 rounded-lg bg-[#070b17] border border-emerald-500/35 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Wifi className="w-4 h-4" />
                      Cómo entra tu amigo a esta sala ({mpRoom.code}):
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isElectron && firewallStatus?.supported && (
                        <button
                          disabled={firewallStatus.busy}
                          onClick={() => void handleAllowFirewallPort()}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                            firewallStatus.allowed
                              ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-200'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {firewallStatus.busy
                            ? 'Abriendo Firewall...'
                            : firewallStatus.allowed
                              ? `Firewall TCP ${lanState?.port || lanPort} OK`
                              : `Abrir Puerto ${lanState?.port || lanPort} en Firewall`}
                        </button>
                      )}
                      {isElectron && !tunnelState?.running && (
                        <button
                          disabled={tunnelBusy}
                          onClick={() => void handleStartTunnel()}
                          className="px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-400/50 hover:bg-cyan-500/30 text-cyan-200 text-[11px] font-bold cursor-pointer"
                        >
                          {tunnelBusy ? 'Iniciando túnel...' : 'Crear Enlace Internet (cloudflared)'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono-num text-[11px]">
                    {vpnOnlyIps.slice(0, 2).map((v) => {
                      const quick = `${v.address}:${lanState?.port || lanPort}#${mpRoom.code}`;
                      return (
                        <div
                          key={v.address}
                          className="p-2 rounded bg-[#0b1224] border border-emerald-400/35 flex items-center justify-between gap-2"
                        >
                          <div className="truncate">
                            <span className="text-emerald-300 font-sans font-bold">VPN ({v.label || 'Radmin'}): </span>
                            <span className="text-white">{quick}</span>
                          </div>
                          <button
                            onClick={() => {
                              void navigator.clipboard?.writeText(quick);
                              setLocalMpMsg(`Invitación VPN rápida copiada: ${quick}`);
                            }}
                            className="px-2 py-1 rounded bg-emerald-400 text-slate-950 font-sans font-bold text-[10px] shrink-0 cursor-pointer"
                          >
                            Copiar Invitación
                          </button>
                        </div>
                      );
                    })}

                    {lanOnlyIps.slice(0, 2).map((l) => {
                      const quick = `${l.address}:${lanState?.port || lanPort}#${mpRoom.code}`;
                      return (
                        <div
                          key={l.address}
                          className="p-2 rounded bg-[#0b1224] border border-white/10 flex items-center justify-between gap-2"
                        >
                          <div className="truncate">
                            <span className="text-cyan-300 font-sans font-bold">LAN: </span>
                            <span className="text-white">{quick}</span>
                          </div>
                          <button
                            onClick={() => {
                              void navigator.clipboard?.writeText(quick);
                              setLocalMpMsg(`Invitación LAN rápida copiada: ${quick}`);
                            }}
                            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-cyan-200 font-sans font-bold text-[10px] shrink-0 cursor-pointer"
                          >
                            Copiar
                          </button>
                        </div>
                      );
                    })}

                    {tunnelState?.running && tunnelState.wssUrl && (
                      <div className="md:col-span-2 p-2 rounded bg-cyan-950/30 border border-cyan-400/40 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="text-cyan-300 font-sans font-bold">Túnel Internet: </span>
                          <span className="text-white">{`${tunnelState.wssUrl}#${mpRoom.code}`}</span>
                        </div>
                        <button
                          onClick={() => {
                            const quick = `${tunnelState.wssUrl}#${mpRoom.code}`;
                            void navigator.clipboard?.writeText(quick);
                            setLocalMpMsg(`Enlace rápido del túnel copiado: ${quick}`);
                          }}
                          className="px-2.5 py-1 rounded bg-cyan-400 text-slate-950 font-sans font-bold text-[10px] shrink-0 cursor-pointer"
                        >
                          Copiar Enlace + Código
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tu amigo solo pega esa línea completa (<span className="font-mono-num text-slate-200">IP:Puerto#CODIGO</span>) en su casilla de conexión y entra directo sin pasos extra.
                  </div>
                </div>
              )}

              {/* Host Configuration + Rules + Invite */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400">Configuración:</span>
                  {isHost && mpRoom.status === 'lobby' ? (
                    <>
                      <select
                        value={mpRoom.districtId}
                        onChange={(e) =>
                          mpClient.updateRoomConfig({ districtId: e.target.value as DistrictId })
                        }
                        className="bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-white"
                      >
                        {DISTRICTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {getCityLabel(lang, d.id).name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={mpRoom.mode}
                        onChange={(e) =>
                          mpClient.updateRoomConfig({ mode: e.target.value as GameMode })
                        }
                        className="bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-white"
                      >
                        {MP_MODES.map((m) => (
                          <option key={m} value={m}>
                            {getModeLabel(lang, m).label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mpRoom.rules?.allowVehicles ?? true}
                          onChange={(e) =>
                            mpClient.updateRoomConfig({
                              rules: { allowVehicles: e.target.checked },
                            })
                          }
                          className="accent-cyan-400"
                        />
                        Vehículos
                      </label>
                    </>
                  ) : (
                    <span className="text-white font-semibold">
                      {getCityLabel(lang, mpRoom.districtId).name} ·{' '}
                      {getModeLabel(lang, mpRoom.mode).label} · Máx {mpRoom.maxPlayers}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Invitar amigo (usuario registrado)"
                    value={inviteUserInput}
                    onChange={(e) => setInviteUserInput(e.target.value)}
                    className="flex-1 bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-white"
                  />
                  <button
                    onClick={() => {
                      if (!inviteUserInput.trim()) return;
                      void handleSendPersistentInvite({ username: inviteUserInput.trim() });
                      setInviteUserInput('');
                    }}
                    className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Invitar
                  </button>
                </div>
              </div>

              {/* Room Players List with Ping, Quality, Reconnect & Kick */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {mpRoom.players.map((p) => {
                  const ch = getCharacterById(p.characterId);
                  const qual = formatQualityLabel(p.connectionQuality);
                  return (
                    <div
                      key={p.userId}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                        p.userId === mpSelfId
                          ? 'bg-cyan-500/15 border-cyan-400/60'
                          : 'bg-[#070b17] border-white/10'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">
                          {p.username} {p.isHost ? '(Anfitrión)' : ''}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {ch.name} ·{' '}
                          {p.reconnecting
                            ? 'Reconectando (45s)...'
                            : p.finished
                              ? `Meta #${p.placement ?? '-'} · ${p.score} pts`
                              : p.paused
                                ? 'En Pausa'
                                : p.ready
                                  ? 'Listo'
                                  : 'Esperando'}
                        </div>
                        <div className="text-[10px] font-mono-num flex items-center gap-1.5 mt-0.5">
                          <span className={qual.cls}>{qual.label}</span>
                          {typeof p.pingMs === 'number' && (
                            <span className="text-slate-400">· {p.pingMs} ms</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`font-mono-num font-bold ${
                            p.ready ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {p.distance > 0 ? `${p.distance}m` : p.ready ? 'OK' : '...'}
                        </span>
                        {isHost && p.userId !== mpSelfId && (
                          <button
                            onClick={() => mpClient.kickPlayer(p.userId)}
                            title={`Expulsar a ${p.username}`}
                            className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Real User Search + Persistent Room Invitations Inbox/Outbox */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Search Registered Users */}
            <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-sm text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  Buscar Jugadores Registrados
                </div>
                <span className="text-[11px] text-slate-400">
                  {onlineUser ? `Conectado como ${onlineUser.username}` : 'Sin sesión online'}
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                Para buscar e invitar amigos entre distintas computadoras por Internet, ambas copias deben apuntar el «Servidor de Cuentas Online» (en Cuentas) a la misma URL de servidor compartida.
              </p>

              <form onSubmit={handleSearchUsers} className="flex gap-2">
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Buscar por usuario o apodo..."
                  className="flex-1 bg-[#070b17] border border-white/15 rounded-lg px-3 py-1.5 text-white outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={!serverOnline || userSearchBusy}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-slate-950 font-bold cursor-pointer"
                >
                  {userSearchBusy ? '...' : 'Buscar'}
                </button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {userSearchResults.length === 0 ? (
                  <div className="text-slate-400 py-2 text-center border border-dashed border-white/10 rounded-lg">
                    Escribe un nombre y pulsa Buscar para ver corredores registrados.
                  </div>
                ) : (
                  userSearchResults.map((u) => (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">
                          {u.displayName || u.username}{' '}
                          <span className="text-slate-400 font-normal">@{u.username}</span>
                        </div>
                        <div className="text-[11px] font-mono-num text-slate-400">
                          {u.isOnline ? (
                            <span className="text-emerald-300 font-semibold">En línea</span>
                          ) : (
                            <span>Desconectado</span>
                          )}{' '}
                          · Mejor: {u.bestScore.toLocaleString('es-ES')} pts
                        </div>
                      </div>
                      <button
                        disabled={!mpRoom}
                        onClick={() => void handleSendPersistentInvite({ id: u.id, username: u.username })}
                        title={mpRoom ? 'Invitar a la sala actual' : 'Crea una sala primero'}
                        className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-bold shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Invitar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Persistent Invitations Inbox & Outbox */}
            <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-sm text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-fuchsia-400" />
                  Invitaciones Persistentes ({incomingInvites.length + outgoingInvites.length})
                </div>
                <button
                  onClick={() => void refreshInvitesList()}
                  className="text-slate-400 hover:text-cyan-300 cursor-pointer"
                  title="Actualizar invitaciones"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {!onlineUser ? (
                <div className="text-slate-400 py-4 text-center border border-dashed border-white/10 rounded-lg">
                  Inicia sesión en una Cuenta Online para recibir y rastrear invitaciones persistentes.
                </div>
              ) : incomingInvites.length === 0 && outgoingInvites.length === 0 ? (
                <div className="text-slate-400 py-4 text-center border border-dashed border-white/10 rounded-lg">
                  No tienes invitaciones recibidas ni enviadas todavía.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {incomingInvites.map((inv) => {
                    const meta = INVITE_STATUS_META[inv.status] ?? {
                      label: inv.status,
                      cls: 'text-slate-300',
                    };
                    const actionable = inv.status === 'sent' || inv.status === 'pending';
                    return (
                      <div
                        key={inv.id}
                        className="p-2.5 rounded-lg bg-[#070b17] border border-cyan-500/30 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white">
                            De {inv.fromUsername} · Sala {inv.roomCode}
                          </span>
                          <span className={`font-semibold ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {getCityLabel(lang, inv.districtId).name} · {getModeLabel(lang, inv.mode).label}
                        </div>
                        {actionable && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={async () => {
                                await respondToInvite(inv.id, 'accept');
                                await handleConnectCustomEndpoint(inv.targetWsUrl || '', inv.roomCode);
                                void refreshInvitesList();
                              }}
                              className="px-3 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
                            >
                              Aceptar y Unirse
                            </button>
                            <button
                              onClick={async () => {
                                await respondToInvite(inv.id, 'reject');
                                void refreshInvitesList();
                              }}
                              className="px-2.5 py-1 rounded border border-white/15 text-slate-300 hover:text-rose-200 cursor-pointer flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" /> Rechazar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {outgoingInvites.map((inv) => {
                    const meta = INVITE_STATUS_META[inv.status] ?? {
                      label: inv.status,
                      cls: 'text-slate-300',
                    };
                    const canCancel = inv.status === 'sent' || inv.status === 'pending';
                    return (
                      <div
                        key={inv.id}
                        className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            Para {inv.toUsername} · Sala {inv.roomCode}
                          </div>
                          <div className={`text-[11px] font-semibold flex items-center gap-1 ${meta.cls}`}>
                            <Clock className="w-3 h-3" /> {meta.label}
                          </div>
                        </div>
                        {canCancel && (
                          <button
                            onClick={async () => {
                              await respondToInvite(inv.id, 'cancel');
                              void refreshInvitesList();
                            }}
                            className="px-2.5 py-1 rounded border border-white/15 text-slate-300 hover:text-rose-200 shrink-0 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ONLINE ACCOUNTS, BACKEND SERVER & CLOUD SYNC (Local Profiles live exclusively in Perfil §20.1) */}
      {section === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Column 1: Online Diagnostics, Account Export & Separation Info */}
          <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-display font-bold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Centro de Cuenta Online y Diagnóstico
              </div>
              <span className="text-[11px] font-mono-num text-emerald-300">
                {onlineUser ? 'Autenticado' : 'Sin Sesión'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Las cuentas online permiten guardar tu progreso en servidor remoto, recuperar contraseña, participar en rankings e invitar amigos. Los perfiles offline locales se administran únicamente desde la pantalla <strong>Perfil</strong>.
            </p>

            {onlineUser ? (
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-1 font-mono-num">
                  <div className="text-white font-sans font-bold">
                    Usuario: {onlineUser.username}
                  </div>
                  <div className="text-slate-400">Correo: {onlineUser.email}</div>
                  <div className="text-slate-400">
                    ID: {onlineUser.id.slice(0, 14)} · Récord: {onlineUser.bestScore.toLocaleString('es-ES')}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await logoutAllOnlineSessions();
                      if (res.ok) {
                        onOnlineUserChange(null);
                        setSyncNotice(`Sesiones cerradas (${res.revokedCount ?? 0}).`);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/50 hover:bg-rose-500/25 text-rose-200 font-semibold cursor-pointer"
                  >
                    Cerrar Todas las Sesiones
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportAccountJson()}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-300" /> Exportar Cuenta Online
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-[#070b17] border border-white/10 text-xs text-slate-400 space-y-1.5">
                <div className="font-semibold text-white">Sin cuenta online activa</div>
                <p>
                  Usa el formulario de la derecha para iniciar sesión o registrar una cuenta online nueva sin afectar tus perfiles locales.
                </p>
              </div>
            )}

            {dbInfo && (
              <div className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 text-[11px] font-mono-num text-slate-300 space-y-1 break-all">
                <div>Motor SQLite: {dbInfo.engine || 'sqlite'} (esquema v{dbInfo.schemaVersion ?? 2})</div>
                <div>Archivo BD: {dbInfo.dbPath} ({Math.round(dbInfo.sizeBytes / 1024)} KB)</div>
              </div>
            )}
          </div>

          {/* Column 2: Online Account + Configurable Central Backend + Linking */}
          <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
            {/* Optional Central Online Server URL */}
            <div className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Servidor de Cuentas Online (opcional, vacío = servidor local)</span>
                {backendPingResult && <span className="text-cyan-300">{backendPingResult}</span>}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={backendUrlInput}
                  onChange={(e) => setBackendUrlInput(e.target.value)}
                  placeholder="https://tu-servidor-online.com (o vacío para usar este PC)"
                  className="flex-1 bg-[#0b1224] border border-white/15 rounded px-2.5 py-1 text-xs font-mono-num text-white"
                />
                <button
                  onClick={async () => {
                    const saved = setOnlineBackendUrl(backendUrlInput);
                    setBackendUrlInput(saved);
                    const up = await checkServerOnline(true);
                    setBackendPingResult(up ? 'Conectado' : 'Sin respuesta');
                  }}
                  className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold text-cyan-300 cursor-pointer"
                >
                  Guardar y Probar
                </button>
              </div>
            </div>

            {!onlineUser ? (
              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-white text-sm">
                    {authMode === 'login'
                      ? t(lang, 'online.login')
                      : authMode === 'register'
                        ? t(lang, 'online.register')
                        : 'Recuperar Contraseña'}
                  </span>
                  <div className="flex gap-1 bg-[#070b17] p-1 rounded-lg border border-white/10">
                    {(
                      [
                        ['login', 'Entrar'],
                        ['register', 'Crear'],
                        ['recover', 'Recuperar'],
                      ] as const
                    ).map(([m, lbl]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setAuthMode(m);
                          setAuthError(null);
                          setAuthSuccess(null);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          authMode === m ? 'bg-cyan-500/25 text-white' : 'text-slate-400'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={
                      authMode === 'register'
                        ? 'Nombre de usuario (3-18 caracteres)'
                        : 'Usuario o correo electrónico'
                    }
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    minLength={3}
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  />

                  {authMode === 'register' && (
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    />
                  )}

                  {authMode === 'recover' && (
                    <input
                      type="text"
                      placeholder="Código de recuperación (ej. MR-XXXX-XXXX)"
                      value={recoveryCodeInput}
                      onChange={(e) => setRecoveryCodeInput(e.target.value.toUpperCase())}
                      required
                      className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-num text-white outline-none focus:border-cyan-400"
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="password"
                      placeholder={
                        authMode === 'recover' ? 'Nueva contraseña (mín. 6)' : 'Contraseña (mín. 6)'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={authMode === 'login' ? 4 : 6}
                      className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    />
                    {authMode === 'register' && (
                      <input
                        type="password"
                        placeholder="Confirmar contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                      />
                    )}
                  </div>
                </div>

                {authMode === 'register' && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400">Corredor inicial:</span>
                    <select
                      value={avatarId}
                      onChange={(e) => setAvatarId(e.target.value)}
                      className="bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      {CHARACTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {authError && <div className="text-xs text-rose-300 font-medium">{authError}</div>}
                {authSuccess && (
                  <div className="text-xs text-emerald-300 font-medium">{authSuccess}</div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-display font-bold text-xs cursor-pointer"
                >
                  {authLoading
                    ? 'Conectando...'
                    : authMode === 'login'
                      ? 'Iniciar Sesión Online'
                      : authMode === 'register'
                        ? 'Registrar Cuenta Online'
                        : 'Restablecer Contraseña'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-bold text-white flex items-center gap-2">
                      {onlineUser.username}
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-xs text-slate-400 font-mono-num">
                      {onlineUser.email} · {onlineUser.totalRuns} carreras · Mejor:{' '}
                      {onlineUser.bestScore.toLocaleString('es-ES')} pts
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await logoutOnlineUser();
                      onOnlineUserChange(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-white/15 hover:border-rose-400 text-xs text-slate-300 hover:text-rose-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t(lang, 'online.logout')}
                  </button>
                </div>

                {issuedRecoveryCode && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-400/50 text-xs space-y-1">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" /> Guarda tu código de recuperación:
                    </div>
                    <div className="font-mono-num text-sm font-bold text-white">
                      {issuedRecoveryCode}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleTriggerAccountLink()}
                    className="px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Vincular / Sincronizar Perfil Local
                  </button>
                  <button
                    onClick={() => void handleManualSync()}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Subir Progreso
                  </button>
                  <button
                    onClick={() => void handleLoadFromSqlite()}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </button>
                  <button
                    onClick={() => void handleExportAccountJson()}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Exportar Cuenta
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400">Avatar:</span>
                    <select
                      value={onlineUser.avatarId}
                      onChange={async (e) => {
                        const res = await updateOnlineAvatar(e.target.value);
                        if (res.ok && res.data?.user) {
                          onOnlineUserChange(res.data.user);
                        }
                      }}
                      className="bg-[#070b17] border border-white/15 rounded px-2 py-1 text-xs text-white"
                    >
                      {CHARACTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <form onSubmit={handleAddFriend} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Añadir amigo..."
                      value={friendInput}
                      onChange={(e) => setFriendInput(e.target.value)}
                      className="flex-1 min-w-0 bg-[#070b17] border border-white/15 rounded px-2.5 py-1 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-cyan-300 cursor-pointer"
                      title="Añadir amigo"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                {friendMsg && <div className="text-[11px] text-cyan-300">{friendMsg}</div>}
                {onlineUser.friends.length > 0 && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    Amigos: {onlineUser.friends.join(' · ')}
                  </div>
                )}
              </div>
            )}

            {syncNotice && <div className="text-xs text-cyan-300">{syncNotice}</div>}

            {/* Clean Test Reset */}
            <div className="pt-2 border-t border-white/10">
              {!confirmCleanReset ? (
                <button
                  onClick={() => setConfirmCleanReset(true)}
                  className="text-[11px] text-rose-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Reiniciar Datos de Prueba / Ranking
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-rose-950/35 border border-rose-400/40 text-xs space-y-2">
                  <div className="text-rose-200">
                    Creará un respaldo automático previo y limpiará las partidas y rankings de prueba.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCleanTestReset()}
                      className="px-3 py-1.5 rounded bg-rose-500 text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Confirmar Limpieza
                    </button>
                    <button
                      onClick={() => setConfirmCleanReset(false)}
                      className="px-3 py-1.5 rounded border border-white/15 text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: RANKINGS & WEEKLY CHALLENGES */}
      {section === 'rankings' && (
        <div className="space-y-4">
          {eventsInfo && (
            <div className="p-4 rounded-xl bg-[#0b1224] border border-fuchsia-500/30 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-fuchsia-300 font-mono-num">
                  {t(lang, 'online.challenges')} · +{eventsInfo.weeklyChallenge.rewardCoins} M · +
                  {eventsInfo.weeklyChallenge.rewardGems} G
                </div>
                <div className="font-display text-base font-bold text-white">
                  {eventsInfo.weeklyChallenge.title}
                </div>
                <div className="text-xs text-slate-300">
                  {eventsInfo.weeklyChallenge.description}
                </div>
              </div>
              {bossOfWeek && (
                <button
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onStartChallenge(
                      eventsInfo.bossOfWeek.districtId,
                      eventsInfo.bossOfWeek.bossId as BossId,
                    );
                  }}
                  className="px-4 py-2 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5" /> Jefe Semanal: {bossOfWeek.name}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['global', t(lang, 'online.global')],
                  ['city', t(lang, 'online.city')],
                  ['weekly', t(lang, 'online.weekly')],
                  ['monthly', t(lang, 'online.monthly')],
                  ['friends', t(lang, 'online.friends')],
                  ['character', t(lang, 'online.character')],
                ] as [RankingScope, string][]
              ).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => {
                    audioEngine.playUiClick();
                    setScope(s);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                    scope === s
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'bg-[#0b1224] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {scope === 'city' && (
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value as DistrictId)}
                  className="bg-[#0b1224] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {getCityLabel(lang, d.id).name}
                    </option>
                  ))}
                </select>
              )}
              {scope === 'character' && (
                <select
                  value={filterChar}
                  onChange={(e) => setFilterChar(e.target.value)}
                  className="bg-[#0b1224] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {CHARACTERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => void loadRankings()}
                className="p-2 rounded-lg bg-[#0b1224] border border-white/10 text-slate-300 hover:text-cyan-300 cursor-pointer"
                title="Actualizar"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${rankingsLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#0b1224] border border-white/10 overflow-hidden">
            {serverOnline ? (
              rankings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#070b17] text-slate-400 border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">#</th>
                        <th className="py-2.5 px-3 font-semibold">Corredor</th>
                        <th className="py-2.5 px-3 font-semibold">Ciudad</th>
                        <th className="py-2.5 px-3 font-semibold">Personaje</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Distancia</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Combo</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Puntuación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rankings.map((entry, idx) => {
                        const char = getCharacterById(entry.characterId);
                        const dist = getDistrictById(entry.districtId);
                        const isSelf =
                          onlineUser && entry.playerName === onlineUser.username;
                        return (
                          <tr
                            key={entry.id}
                            className={isSelf ? 'bg-cyan-500/10' : 'hover:bg-white/5'}
                          >
                            <td className="py-2.5 px-3 font-mono-num font-bold text-slate-300">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-white">
                              <span className="inline-flex items-center gap-1.5">
                                {entry.playerName}
                                {entry.verified && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{dist.name}</td>
                            <td className="py-2.5 px-3 text-slate-300">{char.name}</td>
                            <td className="py-2.5 px-3 text-right font-mono-num text-slate-200">
                              {entry.distance.toLocaleString('es-ES')} m
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-num text-fuchsia-300">
                              x{entry.maxCombo}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-num font-bold text-cyan-300">
                              {entry.score.toLocaleString('es-ES')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  No hay registros todavía. Completa una carrera con tu cuenta online para registrar tu marca.
                </div>
              )
            ) : (
              <div className="p-4 text-xs text-amber-300">
                Conecta con un servidor para consultar la clasificación global.
              </div>
            )}
          </div>

          {onlineUser && history.length > 0 && (
            <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
              <div className="text-xs font-bold text-slate-200">
                {t(lang, 'online.history')} ({onlineUser.username})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {history.slice(0, 6).map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {getDistrictById(h.districtId).name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-num">
                        {h.distance}m · {h.durationSec}s · x{h.maxCombo}
                      </div>
                    </div>
                    <div className="font-mono-num font-bold text-cyan-300">
                      {h.score.toLocaleString('es-ES')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: HONEST PC & MULTIPLAYER ARCHITECTURE */}
      {section === 'network_info' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-2">
            <div className="font-display font-bold text-sm text-cyan-300">
              1. Guardado Persistente en Windows
            </div>
            <p className="text-slate-300 leading-relaxed">
              Tus perfiles locales y base SQLite (<code className="text-cyan-200">userdata.db</code>) se almacenan en la carpeta de datos del usuario (<code className="text-white">%APPDATA%\Metro Rush Neon City\data</code>), separada del directorio de instalación.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Así, desinstalar o actualizar el instalador <code className="text-white">.exe</code> no borra tus partidas ni tu progreso.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0b1224] border border-emerald-500/30 space-y-2">
            <div className="font-display font-bold text-sm text-emerald-300">
              2. Partidas Alojadas por Jugadores (LAN/Túnel)
            </div>
            <p className="text-slate-300 leading-relaxed">
              El jugador anfitrión ejecuta el servidor autoritativo en su PC (valida velocidades máximas, puntuaciones, premios y desconexiones de 45s). Para jugar fuera de casa sin abrir puertos del router, basta exponer el puerto con un túnel como <strong className="text-white">playit.gg</strong>.
            </p>
            <p className="text-amber-300/90 leading-relaxed">
              Limitación real: cuando un jugador aloja la partida en su propio PC, tiene control físico sobre ese proceso. Aunque validamos a todos los clientes conectados, un anfitrión malicioso que modifique su propio binario podría alterar sus recompensas locales.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0b1224] border border-fuchsia-500/30 space-y-2">
            <div className="font-display font-bold text-sm text-fuchsia-300">
              3. Cuentas Online y Servidores TURN
            </div>
            <p className="text-slate-300 leading-relaxed">
              Sin un servidor central público desplegado aparte, las cuentas online viven en el servidor SQLite al que te conectes (local o tu servidor propio configurado arriba).
            </p>
            <p className="text-slate-400 leading-relaxed">
              WebRTC incluye STUN público gratuito; sin embargo, si dos jugadores están tras routers NAT simétricos estrictos y no usan túnel TCP, la conexión P2P directa requeriría un servidor <strong className="text-white">TURN</strong> externo (infraestructura dedicada con coste de ancho de banda).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
