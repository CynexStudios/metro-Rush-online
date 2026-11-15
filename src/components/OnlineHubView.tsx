import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  Globe,
  KeyRound,
  LogOut,
  Network,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Swords,
  Trash2,
  Upload,
  UserPlus,
  Users,
  WifiOff,
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
  BossId,
  DistrictId,
  GameMode,
  LanguageCode,
  MultiplayerRoomState,
  PlayerSaveData,
} from '../game/types';
import { getCityLabel, getModeLabel, t } from '../i18n';
import {
  addOnlineFriend,
  DatabaseDiagnosticsInfo,
  exportAccountBackupJson,
  fetchDatabaseInfo,
  fetchMeOnline,
  fetchOnlineEvents,
  fetchPublicRooms,
  fetchRankings,
  loadSaveFromSqlite,
  loginOnlineUser,
  logoutOnlineUser,
  mpClient,
  OnlineRankingEntry,
  OnlineUser,
  PublicRoomListing,
  RankingScope,
  recoverOnlinePassword,
  registerOnlineUser,
  resetServerTestRankings,
  RoomInviteNotice,
  syncSaveToSqlite,
  updateOnlineAvatar,
  WeeklyChallengeInfo,
} from '../services/onlineClient';

interface OnlineHubViewProps {
  save: PlayerSaveData;
  serverOnline: boolean;
  onlineUser: OnlineUser | null;
  mpConnected: boolean;
  mpSelfId: string | null;
  mpRoom: MultiplayerRoomState | null;
  mpInvite: RoomInviteNotice | null;
  onDismissInvite: () => void;
  onOnlineUserChange: (user: OnlineUser | null) => void;
  onReplaceSave: (next: PlayerSaveData) => void;
  onStartChallenge: (districtId: DistrictId, bossId?: BossId) => void;
}

type HubSection = 'multiplayer' | 'account' | 'rankings' | 'network_info';

const MP_MODES: GameMode[] = ['endless', 'timetrial', 'parkour', 'freerun'];

export const OnlineHubView: React.FC<OnlineHubViewProps> = ({
  save,
  serverOnline,
  onlineUser,
  mpConnected,
  mpSelfId,
  mpRoom,
  mpInvite,
  onDismissInvite,
  onOnlineUserChange,
  onReplaceSave,
  onStartChallenge,
}) => {
  const lang: LanguageCode = save.settings.language;

  const [section, setSection] = useState<HubSection>('multiplayer');

  // Auth & Recovery state
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

  // SQLite Sync & Diagnostics state
  const [dbInfo, setDbInfo] = useState<DatabaseDiagnosticsInfo | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [confirmCleanReset, setConfirmCleanReset] = useState(false);

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
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [inviteUserInput, setInviteUserInput] = useState('');
  const [mpNotice, setMpNotice] = useState<string | null>(null);

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
    const [info, rooms] = await Promise.all([fetchDatabaseInfo(), fetchPublicRooms()]);
    if (info) setDbInfo(info);
    setPublicRooms(rooms);
  }, [serverOnline]);

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
      await syncSaveToSqlite({ ...save, playerName: res.user.username, avatarId: res.user.avatarId });
      mpClient.connect(res.user.username);
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
      onReplaceSave(cloudRes.save);
      setSyncNotice('Progreso recuperado automáticamente desde SQLite.');
    }
    mpClient.connect(res.user.username);
    void loadDbAndRooms();
    void loadRankings();
  };

  const handleManualSync = async () => {
    setSyncNotice('Sincronizando con SQLite...');
    const res = await syncSaveToSqlite(save);
    if (res.ok) {
      audioEngine.playClaimReward();
      setSyncNotice(`Progreso guardado en SQLite (${new Date(res.updatedAt || Date.now()).toLocaleTimeString()}).`);
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
      setSyncNotice('Partida cargada desde SQLite correctamente.');
    } else if (res.ok && !res.hasSave) {
      setSyncNotice('Esta cuenta aún no tiene un guardado sincronizado en SQLite.');
    } else {
      setSyncNotice(res.error || 'No se pudo leer desde SQLite.');
    }
  };

  const handleExportAccountJson = async () => {
    const res = await exportAccountBackupJson();
    if (!res.ok || !res.content) {
      setSyncNotice(res.error || 'Error al exportar.');
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
    setSyncNotice('Respaldo JSON de cuenta SQLite descargado.');
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
        ? `Datos de prueba limpiados (${res.backupCreated}). Ranking y progreso listos para partida real.`
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

  return (
    <div className="space-y-5">
      {/* Header Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="font-display text-xl font-bold text-white">
            {t(lang, 'online.title')}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Salas multijugador en tiempo real por WebSocket, cuentas SQLite locales en PC y clasificaciones verificadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className={`flex items-center gap-1.5 font-semibold ${
              serverOnline ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {serverOnline ? (
              <>
                <ShieldCheck className="w-4 h-4" /> Servidor Express/SQLite Activo
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" /> {t(lang, 'common.offline')}
              </>
            )}
          </span>
          <span className="text-slate-600">·</span>
          <span className={mpConnected ? 'text-cyan-300 font-semibold' : 'text-slate-400'}>
            WebSocket: {mpConnected ? 'Conectado' : 'En espera'}
          </span>
        </div>
      </div>

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
              onClick={() => {
                mpClient.connect(onlineUser?.username || save.playerName);
                mpClient.joinRoom(mpInvite.code, save.selectedCharacterId);
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
            ['multiplayer', 'Multijugador en Vivo', Users],
            ['account', 'Cuenta y SQLite PC', Database],
            ['rankings', 'Clasificaciones y Retos', Globe],
            ['network_info', 'Red y Servidores PC', Network],
          ] as [HubSection, string, React.ComponentType<{ className?: string }>][]
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => {
              audioEngine.playUiClick();
              setSection(id);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
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

      {/* SECTION 1: REAL WEBSOCKET MULTIPLAYER ROOMS */}
      {section === 'multiplayer' && (
        <div className="space-y-4">
          {!mpRoom ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Create Room */}
              <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-display font-bold text-base text-white">
                    Crear Sala Multijugador
                  </div>
                  <button
                    onClick={() => mpClient.connect(onlineUser?.username || save.playerName)}
                    className="text-xs text-cyan-300 hover:underline cursor-pointer"
                  >
                    {mpConnected ? 'WS Listo' : 'Conectar WS'}
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Nombre de la sala (opcional)"
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value)}
                  className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />

                <div className="grid grid-cols-2 gap-2 text-xs">
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
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roomIsPublic}
                      onChange={(e) => setRoomIsPublic(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    Sala Pública (visible en lista)
                  </label>
                  <button
                    disabled={!serverOnline}
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      if (!mpClient.isConnected()) {
                        mpClient.connect(onlineUser?.username || save.playerName);
                        setTimeout(() => {
                          mpClient.createRoom({
                            name: roomNameInput.trim() || undefined,
                            isPublic: roomIsPublic,
                            districtId: roomDistrict,
                            mode: roomMode,
                            characterId: save.selectedCharacterId,
                            maxPlayers: 6,
                          });
                        }, 250);
                      } else {
                        mpClient.createRoom({
                          name: roomNameInput.trim() || undefined,
                          isPublic: roomIsPublic,
                          districtId: roomDistrict,
                          mode: roomMode,
                          characterId: save.selectedCharacterId,
                          maxPlayers: 6,
                        });
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-display font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Crear Sala
                  </button>
                </div>
              </div>

              {/* Join by Code + Public Rooms */}
              <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-display font-bold text-base text-white">
                    Unirse por Código o Sala Pública
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
                    disabled={!joinCodeInput.trim() || !serverOnline}
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      if (!mpClient.isConnected()) {
                        mpClient.connect(onlineUser?.username || save.playerName);
                        setTimeout(
                          () => mpClient.joinRoom(joinCodeInput.trim(), save.selectedCharacterId),
                          250,
                        );
                      } else {
                        mpClient.joinRoom(joinCodeInput.trim(), save.selectedCharacterId);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Entrar
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {publicRooms.length === 0 ? (
                    <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-white/10 rounded-lg">
                      No hay salas públicas abiertas ahora mismo. Crea una para correr con otros jugadores.
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
                          <div className="text-[11px] text-slate-400">
                            Anfitrión: {r.hostName} · {getCityLabel(lang, r.districtId).name} ·{' '}
                            {r.playerCount}/{r.maxPlayers}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            mpClient.connect(onlineUser?.username || save.playerName);
                            setTimeout(
                              () => mpClient.joinRoom(r.code, save.selectedCharacterId),
                              200,
                            );
                          }}
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
          ) : (
            /* Active Room Lobby / Live Standings */
            <div className="p-5 rounded-xl bg-[#0b1224] border border-cyan-400/50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-xs text-cyan-300 font-semibold">
                    Sala Activa · {mpRoom.isPublic ? 'Pública' : 'Privada'} ·{' '}
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
                        setMpNotice(`Código ${mpRoom.code} copiado.`);
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
                    {selfPlayerInRoom?.ready ? 'Listo ✓' : 'Marcar Listo'}
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
                    }}
                    className="px-3.5 py-2 rounded-lg border border-rose-400/40 text-rose-200 hover:bg-rose-500/20 text-xs font-semibold cursor-pointer"
                  >
                    Salir de Sala
                  </button>
                </div>
              </div>

              {/* Host Configuration + Friend Invite */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400">Mapa / Modo:</span>
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
                    </>
                  ) : (
                    <span className="text-white font-semibold">
                      {getCityLabel(lang, mpRoom.districtId).name} ·{' '}
                      {getModeLabel(lang, mpRoom.mode).label}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Invitar jugador conectado (usuario)"
                    value={inviteUserInput}
                    onChange={(e) => setInviteUserInput(e.target.value)}
                    className="flex-1 bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-white"
                  />
                  <button
                    onClick={() => {
                      if (!inviteUserInput.trim()) return;
                      mpClient.inviteFriend(inviteUserInput.trim());
                      setMpNotice(`Invitación enviada a ${inviteUserInput.trim()}.`);
                      setInviteUserInput('');
                    }}
                    className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Invitar
                  </button>
                </div>
              </div>

              {mpNotice && <div className="text-xs text-cyan-300">{mpNotice}</div>}

              {/* Room Players List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {mpRoom.players.map((p) => {
                  const ch = getCharacterById(p.characterId);
                  return (
                    <div
                      key={p.userId}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        p.userId === mpSelfId
                          ? 'bg-cyan-500/15 border-cyan-400/60'
                          : 'bg-[#070b17] border-white/10'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-white">
                          {p.username} {p.isHost ? '(Anfitrión)' : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {ch.name} ·{' '}
                          {p.finished
                            ? `Meta #${p.placement ?? '-'} · ${p.score} pts`
                            : p.paused
                              ? 'En Pausa'
                              : p.ready
                                ? 'Listo'
                                : 'Esperando'}
                        </div>
                      </div>
                      <span
                        className={`font-mono-num font-bold ${
                          p.ready ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {p.distance > 0 ? `${p.distance}m` : p.ready ? 'OK' : '...'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: SQLITE ACCOUNT, RECOVERY, SYNC & CLEAN RESET */}
      {section === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Account Auth / Profile */}
          <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
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
                        ? 'Nombre de usuario (3-20 caracteres)'
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
                      placeholder="Correo electrónico (ej. corredor@pc.local)"
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

                {authError && (
                  <div className="text-xs text-rose-300 font-medium">{authError}</div>
                )}
                {authSuccess && (
                  <div className="text-xs text-emerald-300 font-medium">{authSuccess}</div>
                )}

                <button
                  type="submit"
                  disabled={authLoading || !serverOnline}
                  className="w-full py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-display font-bold text-xs cursor-pointer"
                >
                  {authLoading
                    ? 'Procesando en SQLite...'
                    : authMode === 'login'
                      ? 'Iniciar Sesión'
                      : authMode === 'register'
                        ? 'Registrar Cuenta en SQLite'
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
                    onClick={() => {
                      logoutOnlineUser();
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
          </div>

          {/* SQLite Save Sync + Export + Clean Test Reset */}
          <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-display font-bold text-sm text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Almacenamiento Persistente SQLite
              </div>
              {dbInfo && (
                <span className="font-mono-num text-[11px] text-cyan-300">
                  {dbInfo.userCount} cuentas · {dbInfo.runCount} partidas
                </span>
              )}
            </div>

            {dbInfo && (
              <div className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 text-[11px] font-mono-num text-slate-300 space-y-1 break-all">
                <div>BD SQLite: {dbInfo.dbPath}</div>
                <div>Respaldos: {dbInfo.backupDir} ({Math.round(dbInfo.sizeBytes / 1024)} KB)</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                disabled={!onlineUser}
                onClick={() => void handleManualSync()}
                className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" /> Guardar Progreso en SQLite
              </button>
              <button
                disabled={!onlineUser}
                onClick={() => void handleLoadFromSqlite()}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" /> Cargar desde SQLite
              </button>
              <button
                disabled={!onlineUser}
                onClick={() => void handleExportAccountJson()}
                className="px-3.5 py-2 rounded-lg border border-white/15 hover:border-cyan-400 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                Exportar Cuenta JSON
              </button>
            </div>

            {syncNotice && (
              <div className="text-xs text-cyan-300 font-medium">{syncNotice}</div>
            )}

            {/* Clean Test Data Reset */}
            <div className="pt-2.5 border-t border-white/10 space-y-2">
              {!confirmCleanReset ? (
                <button
                  onClick={() => setConfirmCleanReset(true)}
                  className="px-3.5 py-2 rounded-lg border border-rose-400/40 hover:bg-rose-500/15 text-rose-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar Datos de Prueba / Reiniciar Rankings
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-rose-950/35 border border-rose-500/45 space-y-2 text-xs">
                  <div className="text-rose-200 font-semibold">
                    Esto respalda los datos actuales y deja las tablas de récords e historial local limpias (con un usuario nuevo en Nv.1 y 0 carreras). ¿Confirmar?
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCleanTestReset()}
                      className="px-3.5 py-1.5 rounded bg-rose-500 hover:bg-rose-400 text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Confirmar Limpieza
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
                <div className="text-[11px] font-bold text-fuchsia-300">
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
                  No hay registros todavía. Completa una carrera conectado para registrar tu marca real.
                </div>
              )
            ) : (
              <div className="p-4 text-xs text-amber-300">
                Conecta con el servidor local/dedicado para ver las tablas reales de SQLite.
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

      {/* SECTION 4: HONEST PC NETWORKING & SQLITE ARCHITECTURE GUIDE */}
      {section === 'network_info' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-2">
            <div className="font-display font-bold text-sm text-cyan-300">
              1. SQLite Local en tu PC
            </div>
            <p className="text-slate-300 leading-relaxed">
              Las cuentas, contraseñas cifradas, recuperación y progresos se guardan de forma persistente en un archivo SQLite real fuera de los temporales del código (<code className="text-cyan-200">~/.metro-rush-neon-city/userdata.db</code>).
            </p>
            <p className="text-slate-400 leading-relaxed">
              Importante: SQLite local por sí sola guarda los datos en la computadora donde corre el servidor; no replica automáticamente entre PCs aisladas sin un servidor común.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0b1224] border border-emerald-500/30 space-y-2">
            <div className="font-display font-bold text-sm text-emerald-300">
              2. Servidor Dedicado y LAN
            </div>
            <p className="text-slate-300 leading-relaxed">
              Este mismo servidor Express + WebSocket (<code className="text-emerald-200">/ws</code>) gestiona salas, telemetría de corredores en tiempo real a 20Hz y rankings compartidos para todos los clientes conectados a la misma instancia.
            </p>
            <p className="text-slate-400 leading-relaxed">
              En red local (LAN), tus amigos pueden conectarse directamente desde su navegador apuntando a <code className="text-white">http://TU_IP_LOCAL:3000</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0b1224] border border-fuchsia-500/30 space-y-2">
            <div className="font-display font-bold text-sm text-fuchsia-300">
              3. Acceso Externo con Túnel (playit.gg)
            </div>
            <p className="text-slate-300 leading-relaxed">
              Si quieres jugar con amigos fuera de tu red sin contratar hosting ni abrir puertos del router, ejecuta el servidor en tu PC y expón el puerto <code className="text-white">3000</code> mediante un túnel TCP/HTTP como <strong className="text-white">playit.gg</strong>.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Quienes entren a tu URL de playit.gg compartirán salas WebSocket, cuentas y tablas SQLite alojadas en tu propia computadora.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
