import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Car,
  Check,
  Clock,
  Download,
  FolderOpen,
  HardDrive,
  Link2,
  Plus,
  Save,
  Shield,
  Trash2,
  Trophy,
  Upload,
  User,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BATTLE_PASS_TIERS,
  CHARACTERS,
  DISTRICTS,
  getCharacterById,
  PROFILE_AVATARS,
  VEHICLES,
} from '../game/data';
import { createInitialSave, xpRequiredForLevel } from '../game/storage';
import {
  HardwareDiagnostics,
  HudSnapshot,
  LocalProfileSummary,
  PlayerSaveData,
} from '../game/types';
import { StatsView } from './StatsView';
import {
  createLocalProfileApi,
  deleteLocalProfileApi,
  exportLocalBackupJson,
  getLocalProfileApi,
  importLocalBackupNative,
  listLocalProfilesApi,
  OnlineUser,
  saveLocalProfileApi,
} from '../services/onlineClient';

interface UserProfileViewProps {
  save: PlayerSaveData;
  serverOnline: boolean;
  onlineUser: OnlineUser | null;
  activeLocalProfileId: string | null;
  diagnostics?: HardwareDiagnostics;
  liveHud?: HudSnapshot;
  onUpdateSave: (next: PlayerSaveData) => void;
  onSwitchLocalProfile: (profileId: string, nextSave: PlayerSaveData) => void;
  onOpenOnlineTab: () => void;
}

const NAME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  save,
  serverOnline,
  onlineUser,
  activeLocalProfileId,
  diagnostics,
  liveHud,
  onUpdateSave,
  onSwitchLocalProfile,
  onOpenOnlineTab,
}) => {
  const isElectron = Boolean(window.metroDesktop?.isElectron);
  const [profileSubTab, setProfileSubTab] = useState<'identity' | 'stats'>('identity');

  const [displayName, setDisplayName] = useState<string>(
    save.playerName || 'RUNNER_01',
  );
  const [avatarId, setAvatarId] = useState<string>(
    save.equippedAvatarId || save.avatarId || 'avatar_kai_default',
  );
  const [identityMsg, setIdentityMsg] = useState<string | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);

  const [localProfiles, setLocalProfiles] = useState<LocalProfileSummary[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const loadLocalProfiles = useCallback(async () => {
    if (!serverOnline) return;
    const pRes = await listLocalProfilesApi();
    if (pRes.ok) setLocalProfiles(pRes.profiles);
  }, [serverOnline]);

  useEffect(() => {
    void loadLocalProfiles();
  }, [loadLocalProfiles]);

  useEffect(() => {
    setDisplayName(save.playerName || 'RUNNER_01');
    setAvatarId(save.equippedAvatarId || save.avatarId || 'avatar_kai_default');
  }, [save.playerName, save.equippedAvatarId, save.avatarId]);

  const nameChanged = displayName.trim() !== (save.playerName || 'RUNNER_01');
  const cooldownRemainingMs =
    save.lastNameChangeAt && Date.now() - save.lastNameChangeAt < NAME_COOLDOWN_MS
      ? NAME_COOLDOWN_MS - (Date.now() - save.lastNameChangeAt)
      : 0;
  const cooldownHoursLeft = Math.ceil(cooldownRemainingMs / (60 * 60 * 1000));

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = displayName.trim();
    if (clean.length < 2 || clean.length > 24) {
      setIdentityMsg('El nombre del perfil local debe tener entre 2 y 24 caracteres.');
      return;
    }
    if (nameChanged && cooldownRemainingMs > 0) {
      setIdentityMsg(
        `Debes esperar ${cooldownHoursLeft}h (enfriamiento de 3 días) para volver a cambiar tu nombre offline.`,
      );
      return;
    }
    setIdentitySaving(true);
    setIdentityMsg(null);
    const nextSave: PlayerSaveData = {
      ...save,
      playerName: clean,
      avatarId,
      equippedAvatarId: avatarId,
      lastNameChangeAt: nameChanged ? Date.now() : save.lastNameChangeAt,
    };
    onUpdateSave(nextSave);
    setIdentityMsg(
      nameChanged
        ? 'Nombre y avatar actualizados. Próximo cambio de nombre disponible en 3 días.'
        : 'Avatar de perfil actualizado correctamente.',
    );
    audioEngine.playUiClick(true);
    setIdentitySaving(false);
    void loadLocalProfiles();
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
      tutorialCompleted: save.tutorialCompleted,
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
    void loadLocalProfiles();
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
    void loadLocalProfiles();
  };

  const activeAvatar =
    PROFILE_AVATARS.find((a) => a.id === avatarId) ?? PROFILE_AVATARS[0];
  const xpReq = Math.max(1, xpRequiredForLevel(save.level));
  const totalPlayMinutes = Math.floor(save.stats.totalTimeSeconds / 60);
  const recentHistory = (save.matchHistory ?? []).slice(0, 6);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-xs font-semibold text-cyan-400">
            Cuentas Locales, Avatares, Récords y Estadísticas
          </div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            Perfil de Jugador
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick();
              setProfileSubTab('identity');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold border cursor-pointer ${
              profileSubTab === 'identity'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-slate-900/70 border-white/10 text-slate-300'
            }`}
          >
            Perfil e Identidad
          </button>
          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick();
              setProfileSubTab('stats');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold border cursor-pointer ${
              profileSubTab === 'stats'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-900/70 border-white/10 text-slate-300'
            }`}
          >
            Estadísticas y Récords
          </button>
          <button
            type="button"
            onClick={onOpenOnlineTab}
            className="px-3 py-1.5 rounded-lg bg-[#0b1224] border border-cyan-400/40 hover:border-cyan-300 text-cyan-200 font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5 text-cyan-400" />
            {onlineUser ? `Online: ${onlineUser.username}` : 'Centro Online'}
          </button>
        </div>
      </div>

      {profileSubTab === 'stats' && diagnostics && liveHud ? (
        <StatsView save={save} diagnostics={diagnostics} liveHud={liveHud} />
      ) : (
        <>
      {/* Top Grid: Local Identity + Progression KPIs & Records */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
        {/* Local Identity & Avatar Form */}
        <form
          onSubmit={handleSaveIdentity}
          className="p-5 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl border border-white/25 flex items-center justify-center font-display font-bold text-base text-white shrink-0"
                style={{ background: activeAvatar.badgeGradient }}
              >
                {activeAvatar.glyph}
              </div>
              <div>
                <div className="font-display font-bold text-base text-white">
                  {displayName || save.playerName}
                </div>
                <div className="text-xs text-slate-400">
                  Avatar: {activeAvatar.name} · Nivel {save.level} ({save.xp}/{xpReq} XP) · Pase Nv.{' '}
                  {save.battlePass.level}/{BATTLE_PASS_TIERS.length}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <label className="space-y-1.5 block">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">
                  Apodo del Perfil Local (Offline)
                </span>
                {cooldownRemainingMs > 0 ? (
                  <span className="text-[11px] text-amber-300">
                    Próximo cambio en {cooldownHoursLeft}h
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Enfriamiento: 3 días tras cambiar</span>
                )}
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                minLength={2}
                maxLength={24}
                className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-slate-300 font-semibold block">
                Avatares Desbloqueados ({save.ownedAvatars.length}/{PROFILE_AVATARS.length})
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                {PROFILE_AVATARS.map((av) => {
                  const owned = save.ownedAvatars.includes(av.id);
                  const selected = avatarId === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      disabled={!owned}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setAvatarId(av.id);
                      }}
                      title={owned ? av.name : `${av.name} — ${av.description}`}
                      className={`p-2 rounded-lg border text-left transition flex items-center gap-2 ${
                        selected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : owned
                            ? 'bg-[#070b17] border-white/10 hover:border-white/30 text-slate-200 cursor-pointer'
                            : 'bg-[#070b17]/50 border-white/5 text-slate-500 opacity-55 cursor-not-allowed'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black text-white shrink-0"
                        style={{ background: av.badgeGradient }}
                      >
                        {av.glyph}
                      </span>
                      <span className="text-[11px] font-semibold truncate">{av.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {identityMsg && <div className="text-xs text-cyan-300">{identityMsg}</div>}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="submit"
              disabled={identitySaving}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {identitySaving ? 'Guardando...' : 'Guardar Perfil Local'}
            </button>
            <span className="text-[11px] text-slate-400">
              {save.tutorialCompleted ? 'Tutorial 23/23 completado' : 'Entrenamiento pendiente'}
            </span>
          </div>
        </form>

        {/* General Statistics & Personal Records */}
        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
          <div className="font-display font-bold text-sm text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Estadísticas y Récords Personales
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
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
              <div className="text-slate-400">Mejor Distancia</div>
              <div className="font-mono-num font-bold text-emerald-300 text-sm mt-0.5">
                {save.stats.bestDistance.toLocaleString('es-ES')} m
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10">
              <div className="text-slate-400">Jefes Derrotados</div>
              <div className="font-mono-num font-bold text-amber-300 text-sm mt-0.5">
                {save.defeatedBosses.length}/8
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10">
              <div className="text-slate-400">Contrarreloj (Max)</div>
              <div className="font-mono-num font-bold text-fuchsia-300 text-sm mt-0.5">
                {save.stats.bestSurvivalTimeSec}s
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#070b17] border border-white/10">
              <div className="text-slate-400">Tiempo Total</div>
              <div className="font-mono-num font-bold text-slate-200 text-sm mt-0.5">
                {totalPlayMinutes} min
              </div>
            </div>
          </div>
          <div className="text-xs font-mono-num text-slate-400 pt-1">
            {save.unlockedCharacters.length}/{CHARACTERS.length} corredores ·{' '}
            {save.unlockedDistricts.length}/{DISTRICTS.length} distritos ·{' '}
            {save.ownedVehicles.length}/{VEHICLES.length} vehículos · Historia Cap.{' '}
            {save.storyChapter}/5
          </div>
        </div>
      </div>

      {/* Middle Grid: Unlocked Characters & Unlocked Vehicles (§20.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-fuchsia-400" />
              Personajes Desbloqueados ({save.unlockedCharacters.length}/{CHARACTERS.length})
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {CHARACTERS.map((c) => {
              const unlocked = save.unlockedCharacters.includes(c.id);
              const selected = save.selectedCharacterId === c.id;
              return (
                <div
                  key={c.id}
                  className={`p-2.5 rounded-lg border ${
                    selected
                      ? 'bg-cyan-500/15 border-cyan-400 text-white'
                      : unlocked
                        ? 'bg-[#070b17] border-emerald-400/35 text-slate-200'
                        : 'bg-[#070b17]/60 border-white/10 text-slate-500'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between gap-1">
                    <span className="truncate">{c.name}</span>
                    {unlocked && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {selected ? 'Equipado' : unlocked ? 'Disponible' : 'Bloqueado'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Car className="w-4 h-4 text-amber-400" />
              Vehículos Desbloqueados ({save.ownedVehicles.length}/{VEHICLES.length})
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {VEHICLES.map((v) => {
              const owned = save.ownedVehicles.includes(v.id);
              const selected = save.selectedVehicleId === v.id;
              const lv = (save.vehicleUpgrades?.[v.id] ?? 0) + 1;
              return (
                <div
                  key={v.id}
                  className={`p-2.5 rounded-lg border ${
                    selected
                      ? 'bg-amber-500/15 border-amber-400 text-white'
                      : owned
                        ? 'bg-[#070b17] border-emerald-400/35 text-slate-200'
                        : 'bg-[#070b17]/60 border-white/10 text-slate-500'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between gap-1">
                    <span className="truncate">{v.name}</span>
                    {owned && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono-num">
                    {owned ? `Nv. ${lv} · ${selected ? 'Activo' : 'Garaje'}` : 'Bloqueado'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Local Profiles + Offline Backups vs Recent Match History (§20.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Local Profiles + Backups (100% Offline, separated from Online auth/forms) */}
        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-sm text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              Perfiles Locales y Respaldos (100% Offline)
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
                  : 'Servidor SQLite local desconectado; tu progreso sigue guardado localmente en este navegador.'}
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
                          <span className="text-emerald-300 font-semibold">
                            · Activo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        Nv {prof.level} · {prof.coins.toLocaleString('es-ES')} M ·{' '}
                        {prof.totalRuns} carreras
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => void handleSelectLocalProfile(prof.id)}
                          className="px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
                        >
                          Activar
                        </button>
                      )}
                      {localProfiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteLocalProfile(prof.id, prof.name)
                          }
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
              placeholder="Nuevo perfil local offline..."
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
              type="button"
              onClick={async () => {
                const res = await exportLocalBackupJson(save);
                setLocalMsg(
                  res.ok ? res.message || 'Respaldo exportado.' : res.error || null,
                );
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-300" /> Exportar JSON
            </button>
            {isElectron && (
              <>
                <button
                  type="button"
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
                  type="button"
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

        {/* Recent Match History & Online Separation Card (§20.1 & §20.2) */}
        <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Historial Reciente de Partidas
            </div>
            <span className="text-xs font-mono-num text-slate-400">
              {recentHistory.length} últimas
            </span>
          </div>

          {recentHistory.length === 0 ? (
            <div className="p-4 rounded-lg bg-[#070b17] border border-white/10 text-xs text-slate-400">
              Aún no hay partidas registradas en este perfil. Completa una carrera para ver tu historial aquí.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {recentHistory.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">
                      {m.mode.toUpperCase()} · {m.districtId}
                    </div>
                    <div className="text-[11px] font-mono-num text-slate-400">
                      {m.distance}m · {m.durationSec}s · +{m.coinsEarned} M
                    </div>
                  </div>
                  <div className="text-right font-mono-num shrink-0">
                    <div className="font-bold text-cyan-300">
                      {m.score.toLocaleString('es-ES')} pts
                    </div>
                    <div
                      className={`text-[10px] font-bold ${
                        m.victory ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {m.victory ? 'VICTORIA' : 'DERROTA'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 rounded-lg bg-[#070b17] border border-cyan-500/25 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-slate-300 truncate">
                {onlineUser
                  ? `Cuenta online activa: ${onlineUser.username}`
                  : 'Cuentas online, salas y P2P están en el Centro Online'}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenOnlineTab}
              className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              Centro Online
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
