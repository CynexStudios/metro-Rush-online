import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  KeyRound,
  Link2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserCheck,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { CHARACTERS, DISTRICTS, getCharacterById, VEHICLES } from '../game/data';
import { createInitialSave, xpRequiredForLevel } from '../game/storage';
import { LocalProfileSummary, PlayerSaveData } from '../game/types';
import {
  AuthSessionInfo,
  changeOnlinePassword,
  createLocalProfileApi,
  deleteLocalProfileApi,
  exportAccountBackupJson,
  exportLocalBackupJson,
  getLocalProfileApi,
  importLocalBackupNative,
  listLocalProfilesApi,
  listOnlineSessions,
  loadSaveFromSqlite,
  logoutAllOnlineSessions,
  logoutOnlineUser,
  OnlineUser,
  saveLocalProfileApi,
  syncSaveToSqlite,
  updateOnlineProfile,
} from '../services/onlineClient';

interface UserProfileViewProps {
  save: PlayerSaveData;
  serverOnline: boolean;
  onlineUser: OnlineUser | null;
  activeLocalProfileId: string | null;
  onUpdateSave: (next: PlayerSaveData) => void;
  onOnlineUserChange: (user: OnlineUser | null) => void;
  onSwitchLocalProfile: (profileId: string, nextSave: PlayerSaveData) => void;
  onOpenOnlineTab: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  save,
  serverOnline,
  onlineUser,
  activeLocalProfileId,
  onUpdateSave,
  onOnlineUserChange,
  onSwitchLocalProfile,
  onOpenOnlineTab,
}) => {
  const isElectron = Boolean(window.metroDesktop?.isElectron);

  const [displayName, setDisplayName] = useState<string>(
    onlineUser?.displayName || save.playerName || 'RUNNER_01',
  );
  const [avatarId, setAvatarId] = useState<string>(
    onlineUser?.avatarId || save.avatarId || save.selectedCharacterId || 'kai',
  );
  const [identityMsg, setIdentityMsg] = useState<string | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);

  // Local Profiles & Backups
  const [localProfiles, setLocalProfiles] = useState<LocalProfileSummary[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  // Online Sessions & Password Management
  const [sessions, setSessions] = useState<AuthSessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');
  const [securityMsg, setSecurityMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  const loadProfilesAndSessions = useCallback(async () => {
    if (serverOnline) {
      const pRes = await listLocalProfilesApi();
      if (pRes.ok) setLocalProfiles(pRes.profiles);
      if (onlineUser) {
        setSessionsLoading(true);
        const sRes = await listOnlineSessions();
        if (sRes.ok) setSessions(sRes.sessions);
        setSessionsLoading(false);
      } else {
        setSessions([]);
      }
    }
  }, [serverOnline, onlineUser]);

  useEffect(() => {
    void loadProfilesAndSessions();
  }, [loadProfilesAndSessions]);

  useEffect(() => {
    setDisplayName(onlineUser?.displayName || save.playerName || 'RUNNER_01');
    setAvatarId(onlineUser?.avatarId || save.avatarId || save.selectedCharacterId || 'kai');
  }, [onlineUser, save.playerName, save.avatarId, save.selectedCharacterId]);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = displayName.trim();
    if (clean.length < 2 || clean.length > 24) {
      setIdentityMsg('El nombre visible debe tener entre 2 y 24 caracteres.');
      return;
    }
    setIdentitySaving(true);
    setIdentityMsg(null);
    const nextSave: PlayerSaveData = {
      ...save,
      playerName: clean,
      avatarId,
    };
    onUpdateSave(nextSave);

    if (onlineUser && serverOnline) {
      const res = await updateOnlineProfile({ displayName: clean, avatarId });
      if (res.ok && res.user) {
        onOnlineUserChange(res.user);
        setIdentityMsg('Identidad actualizada en tu perfil local y tu cuenta online.');
      } else {
        setIdentityMsg(
          `Guardado localmente. Nota cuenta online: ${res.error || 'sin respuesta'}.`,
        );
      }
    } else {
      setIdentityMsg('Perfil local actualizado correctamente.');
    }
    audioEngine.playUiClick(true);
    setIdentitySaving(false);
    void loadProfilesAndSessions();
  };

  const handleCreateLocalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newProfileName.trim();
    if (clean.length < 2) {
      setLocalMsg('El nombre del nuevo perfil debe tener al menos 2 caracteres.');
      return;
    }
    const freshSave: PlayerSaveData = {
      ...createInitialSave(),
      playerName: clean,
      avatarId: save.selectedCharacterId || 'kai',
      selectedCharacterId: save.selectedCharacterId || 'kai',
    };
    const res = await createLocalProfileApi({
      name: clean,
      avatarId: freshSave.avatarId,
      save: freshSave,
    });
    if (!res.ok || !res.profile) {
      setLocalMsg(res.error || 'No se pudo crear el perfil local.');
      return;
    }
    audioEngine.playClaimReward();
    setNewProfileName('');
    setLocalMsg(`Perfil "${clean}" creado y activado.`);
    onSwitchLocalProfile(res.profile.id, freshSave);
    void loadProfilesAndSessions();
  };

  const handleSelectLocalProfile = async (id: string) => {
    if (activeLocalProfileId) {
      await saveLocalProfileApi(activeLocalProfileId, save);
    }
    const res = await getLocalProfileApi(id);
    if (!res.ok || !res.save) {
      setLocalMsg(res.error || 'No se pudo cargar el perfil seleccionado.');
      return;
    }
    audioEngine.playUiClick(true);
    onSwitchLocalProfile(id, res.save);
    setLocalMsg(`Perfil "${res.profile?.name}" activado.`);
  };

  const handleDeleteLocalProfile = async (id: string, name: string) => {
    if (localProfiles.length <= 1) {
      setLocalMsg('Debe existir al menos un perfil local en el equipo.');
      return;
    }
    const res = await deleteLocalProfileApi(id);
    if (!res.ok) {
      setLocalMsg(res.error || 'No se pudo eliminar el perfil.');
      return;
    }
    setLocalMsg(`Perfil "${name}" eliminado.`);
    void loadProfilesAndSessions();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      setSecurityMsg({ text: 'La nueva contraseña debe tener al menos 6 caracteres.', isError: true });
      return;
    }
    if (newPw !== confirmNewPw) {
      setSecurityMsg({ text: 'La confirmación de contraseña no coincide.', isError: true });
      return;
    }
    setSecurityBusy(true);
    setSecurityMsg(null);
    const res = await changeOnlinePassword(currentPw, newPw);
    setSecurityBusy(false);
    if (!res.ok) {
      setSecurityMsg({ text: res.error || 'No se pudo cambiar la contraseña.', isError: true });
      return;
    }
    setCurrentPw('');
    setNewPw('');
    setConfirmNewPw('');
    audioEngine.playClaimReward();
    setSecurityMsg({
      text: res.message || 'Contraseña actualizada y resto de sesiones cerradas.',
    });
    void loadProfilesAndSessions();
  };

  const handleLogoutCurrent = async () => {
    setSecurityBusy(true);
    await logoutOnlineUser();
    onOnlineUserChange(null);
    setSessions([]);
    setSecurityBusy(false);
    setSecurityMsg({ text: 'Sesión online cerrada. Tu perfil local permanece activo.' });
  };

  const handleLogoutAll = async () => {
    setSecurityBusy(true);
    const res = await logoutAllOnlineSessions();
    setSecurityBusy(false);
    if (res.ok) {
      onOnlineUserChange(null);
      setSessions([]);
      setSecurityMsg({
        text: `Todas las sesiones (${res.revokedCount ?? 0}) fueron cerradas correctamente.`,
      });
    } else {
      setSecurityMsg({ text: res.error || 'No se pudieron cerrar las sesiones.', isError: true });
    }
  };

  const activeChar = getCharacterById(avatarId);
  const xpReq = Math.max(1, xpRequiredForLevel(save.level));
  const totalPlayMinutes = Math.floor(save.stats.totalTimeSeconds / 60);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-xs font-semibold text-cyan-400">
            Identidad, Progreso Dual y Sesiones
          </div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            Perfil de Usuario
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num">
          <span className={onlineUser ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>
            {onlineUser ? `Cuenta Online: ${onlineUser.username}` : 'Modo Offline Local Activo'}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-cyan-300 font-bold">
            Nivel {save.level} ({save.xp}/{xpReq} XP)
          </span>
        </div>
      </div>

      {/* Top Grid: Identity Editor + Progression Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4">
        {/* Identity & Avatar Form */}
        <form
          onSubmit={handleSaveIdentity}
          className="p-5 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl border border-white/25 flex items-center justify-center font-display font-bold text-lg text-white shrink-0"
                style={{ backgroundColor: activeChar.colors.jacket }}
              >
                {displayName.trim().slice(0, 2).toUpperCase() || 'MR'}
              </div>
              <div>
                <div className="font-display font-bold text-base text-white">
                  {displayName || save.playerName}
                </div>
                <div className="text-xs text-slate-400">
                  Avatar: {activeChar.name} ·{' '}
                  {onlineUser ? 'Sincronizable en línea' : 'Guardado local SQLite'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1.5">
              <span className="text-slate-300 font-semibold block">
                Nombre visible / Apodo
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                minLength={2}
                maxLength={24}
                className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-slate-300 font-semibold block">Avatar del perfil</span>
              <select
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
                className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400"
              >
                {CHARACTERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {identityMsg && <div className="text-xs text-cyan-300">{identityMsg}</div>}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="submit"
              disabled={identitySaving}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {identitySaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>

            {!onlineUser && (
              <button
                type="button"
                onClick={onOpenOnlineTab}
                className="px-3.5 py-2 rounded-lg bg-[#070b17] border border-white/15 hover:border-cyan-400 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" /> Conectar o Crear Cuenta Online
              </button>
            )}
          </div>
        </form>

        {/* Live Account KPIs */}
        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
          <div className="font-display font-bold text-sm text-white">
            Resumen del Corredor
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10">
              <div className="text-slate-400">Carreras / Victorias</div>
              <div className="font-mono-num font-bold text-white text-sm mt-0.5">
                {save.stats.totalRuns} / {save.stats.wins}V
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10">
              <div className="text-slate-400">Mejor Puntuación</div>
              <div className="font-mono-num font-bold text-cyan-300 text-sm mt-0.5">
                {save.stats.bestScore.toLocaleString('es-ES')}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10">
              <div className="text-slate-400">Jefes Derrotados</div>
              <div className="font-mono-num font-bold text-amber-300 text-sm mt-0.5">
                {save.defeatedBosses.length}/8
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10">
              <div className="text-slate-400">Tiempo / Mascota</div>
              <div className="font-mono-num font-bold text-emerald-300 text-sm mt-0.5 truncate">
                {totalPlayMinutes}m · {save.equippedPetId === 'fox_cyber' ? 'Zorro Cyber' : 'Sin mascota'}
              </div>
            </div>
          </div>
          <div className="text-xs font-mono-num text-slate-400 pt-1">
            {save.unlockedCharacters.length}/{CHARACTERS.length} corredores · {save.unlockedDistricts.length}/{DISTRICTS.length} distritos · {save.ownedVehicles.length}/{VEHICLES.length} vehículos
          </div>
        </div>
      </div>

      {/* Bottom Grid: Local Profiles & Backups vs Online Security & Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Local Profiles + Backups */}
        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-sm text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              Perfiles Locales y Respaldos (Offline)
            </div>
            <span className="text-xs font-mono-num text-slate-400">
              {localProfiles.length} en este PC
            </span>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {localProfiles.length === 0 ? (
              <div className="text-xs text-slate-400 py-3">
                {serverOnline
                  ? 'Sin perfiles adicionales registrados.'
                  : 'Servidor SQLite local desconectado; tu progreso sigue guardado en almacenamiento local del navegador.'}
              </div>
            ) : (
              localProfiles.map((prof) => {
                const isActive = prof.id === activeLocalProfileId;
                return (
                  <div
                    key={prof.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-emerald-500/15 border-emerald-400/60'
                        : 'bg-[#070b17] border-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">
                        {prof.name}{' '}
                        {isActive && (
                          <span className="text-emerald-300 font-semibold">· Activo</span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        Nv {prof.level} · {prof.coins.toLocaleString('es-ES')} M · {prof.totalRuns} carreras
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => void handleSelectLocalProfile(prof.id)}
                          className="px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
                        >
                          Activar
                        </button>
                      )}
                      {localProfiles.length > 1 && (
                        <button
                          onClick={() => void handleDeleteLocalProfile(prof.id, prof.name)}
                          className="p-1.5 rounded bg-white/5 hover:bg-rose-500/25 text-slate-300 hover:text-rose-200 cursor-pointer"
                          title="Eliminar perfil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleCreateLocalProfile} className="flex gap-2">
            <input
              type="text"
              placeholder="Nuevo perfil local..."
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              maxLength={22}
              className="flex-1 bg-[#070b17] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={!serverOnline}
              className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Crear
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            <button
              onClick={async () => {
                const res = await exportLocalBackupJson(save);
                setLocalMsg(res.ok ? res.message || 'Respaldo exportado.' : res.error || null);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-300" /> Exportar JSON
            </button>
            {isElectron && (
              <>
                <button
                  onClick={async () => {
                    const res = await importLocalBackupNative();
                    if (!res.ok || !res.save) {
                      setLocalMsg(res.error || 'No se pudo importar.');
                      return;
                    }
                    onUpdateSave(res.save);
                    setLocalMsg(`Respaldo "${res.fileName}" restaurado.`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-300" /> Importar JSON
                </button>
                <button
                  onClick={() => void window.metroDesktop?.openBackupsFolder()}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-300" /> Carpeta Datos
                </button>
              </>
            )}
          </div>

          {localMsg && <div className="text-xs text-cyan-300">{localMsg}</div>}
        </div>

        {/* Online Account Security & Persistent Sessions */}
        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Cuenta Online y Sesiones Guardadas
            </div>
            {onlineUser && (
              <span className="text-xs text-emerald-300 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Sesión Persistente
              </span>
            )}
          </div>

          {!onlineUser ? (
            <div className="p-4 rounded-lg bg-[#070b17] border border-white/10 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                No tienes ninguna sesión online iniciada en este momento. Puedes iniciar sesión o crear una cuenta en el centro Online para guardar respaldo en servidor y mantener tu sesión cifrada al reiniciar la app.
              </p>
              <button
                onClick={onOpenOnlineTab}
                className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
              >
                Ir a Iniciar Sesión / Registro Online
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-1 font-mono-num">
                <div className="text-white font-sans font-bold">
                  {onlineUser.username} · <span className="text-slate-400 font-normal">{onlineUser.email}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Miembro desde {new Date(onlineUser.createdAt).toLocaleDateString('es-ES')} · ID {onlineUser.id.slice(0, 12)}
                </div>
              </div>

              {/* Sync Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    const res = await syncSaveToSqlite(save);
                    setSecurityMsg({
                      text: res.ok
                        ? 'Progreso subido a tu cuenta online.'
                        : res.error || 'Error al sincronizar.',
                      isError: !res.ok,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-300" /> Subir Progreso
                </button>
                <button
                  onClick={async () => {
                    const res = await loadSaveFromSqlite();
                    if (res.ok && res.save) {
                      onUpdateSave(res.save);
                      setSecurityMsg({ text: 'Guardado de cuenta online aplicado.' });
                    } else {
                      setSecurityMsg({
                        text: res.error || 'No hay guardado en la cuenta.',
                        isError: true,
                      });
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-300" /> Restaurar Online
                </button>
                <button
                  onClick={async () => {
                    const res = await exportAccountBackupJson();
                    if (!res.ok || !res.content) {
                      setSecurityMsg({ text: res.error || 'Error al exportar.', isError: true });
                      return;
                    }
                    const blob = new Blob([res.content], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = res.filename || 'metro-rush-account.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    setSecurityMsg({ text: 'Cuenta SQLite exportada.' });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-amber-300" /> Exportar Cuenta
                </button>
              </div>

              {/* Change Password */}
              <form
                onSubmit={handleChangePassword}
                className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-2"
              >
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-300" /> Cambiar Contraseña
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="password"
                    placeholder="Actual"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    required
                    className="bg-[#0b1224] border border-white/15 rounded px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                  />
                  <input
                    type="password"
                    placeholder="Nueva (mín. 6)"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    minLength={6}
                    className="bg-[#0b1224] border border-white/15 rounded px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                  />
                  <input
                    type="password"
                    placeholder="Confirmar nueva"
                    value={confirmNewPw}
                    onChange={(e) => setConfirmNewPw(e.target.value)}
                    required
                    minLength={6}
                    className="bg-[#0b1224] border border-white/15 rounded px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={securityBusy}
                  className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold cursor-pointer"
                >
                  Actualizar Contraseña
                </button>
              </form>

              {/* Active Persistent Sessions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                    Sesiones Activas ({sessions.length})
                  </span>
                  <button
                    onClick={() => void loadProfilesAndSessions()}
                    className="text-slate-400 hover:text-cyan-300 cursor-pointer"
                    title="Actualizar sesiones"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="px-2.5 py-1.5 rounded bg-[#070b17] border border-white/10 flex items-center justify-between text-[11px] font-mono-num text-slate-300"
                    >
                      <span className="truncate pr-2">{s.deviceLabel}</span>
                      <span className="text-slate-400 shrink-0">
                        Último uso: {new Date(s.lastUsedAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {securityMsg && (
                <div
                  className={`text-xs font-medium ${
                    securityMsg.isError ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 inline mr-1" />
                  {securityMsg.text}
                </div>
              )}

              {/* Logout Controls */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                <button
                  disabled={securityBusy}
                  onClick={() => void handleLogoutCurrent()}
                  className="px-3.5 py-1.5 rounded-lg border border-white/15 hover:border-rose-400 text-slate-200 hover:text-rose-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión Actual
                </button>
                <button
                  disabled={securityBusy}
                  onClick={() => void handleLogoutAll()}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/50 hover:bg-rose-500/25 text-rose-200 font-semibold cursor-pointer"
                >
                  Cerrar Todas las Sesiones
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
