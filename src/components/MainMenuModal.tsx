import React, { useState } from 'react';
import {
  Award,
  Backpack,
  BarChart3,
  Car,
  Check,
  Cpu,
  Download,
  FileBox,
  Globe,
  Layers,
  Lock,
  Map as MapIcon,
  Play,
  Settings,
  ShoppingBag,
  Sun,
  Swords,
  Trash2,
  Upload,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BOSSES,
  CHARACTERS,
  DISTRICTS,
  DRONE_CODEX,
  getBossUnlockRequirement,
  getCharacterById,
  getDistrictById,
  isBossUnlocked,
  LIVE_EVENTS,
} from '../game/data';
import {
  checkUnlockRequirement,
  getPendingRewardCount,
  purchaseCharacter,
  unlockOrSelectDistrict,
} from '../game/economy';
import {
  buildBossBlenderTemplateJson,
  getCustomBossEntry,
  getCustomGlbInfo,
  parseCustomGlbFile,
  removeCustomBossGlb,
  setCustomBossEnabledState,
  validateAndStoreCustomBossGlb,
} from '../game/gltfAssets';
import {
  AccountSyncConflict,
  BossId,
  ConflictResolutionStrategy,
  CustomBossValidationResult,
  DistrictId,
  HardwareDiagnostics,
  HudSnapshot,
  LiveEventDef,
  MultiplayerRoomState,
  PCSettings,
  PlayerModelStyle,
  PlayerSaveData,
  ReleaseUpdateInfo,
  TimeOfDay,
  UpdateProgressState,
} from '../game/types';
import { getCityLabel, getTimeLabel, t } from '../i18n';
import { OnlineUser, RoomInviteNotice } from '../services/onlineClient';
import { BattlePassView } from './BattlePassView';
import { CreditsContent } from './CreditsModal';
import { GarageView } from './GarageView';
import { InventoryView } from './InventoryView';
import { OnlineHubView } from './OnlineHubView';
import { SettingsCategory, SettingsView } from './SettingsView';
import { ShopView } from './ShopView';
import { StatsView } from './StatsView';
import { UserProfileView } from './UserProfileView';

export type MenuTab =
  | 'characters'
  | 'garage'
  | 'districts'
  | 'missions'
  | 'battlepass'
  | 'events'
  | 'shop'
  | 'inventory'
  | 'stats'
  | 'online'
  | 'profile'
  | 'settings'
  | 'credits';

interface MainMenuModalProps {
  initialTab: MenuTab;
  initialSettingsCategory?: SettingsCategory;
  save: PlayerSaveData;
  diagnostics: HardwareDiagnostics;
  liveHud: HudSnapshot;
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
  previewBossId: BossId;
  onSelectBossPreview: (bossId: BossId) => void;
  onOnlineUserChange: (user: OnlineUser | null) => void;
  onSwitchLocalProfile: (profileId: string, nextSave: PlayerSaveData) => void;
  onUpdateSave: (next: PlayerSaveData) => void;
  onVideoChangeWithConfirm: (next: PCSettings, prev: PCSettings) => void;
  onRunBenchmark: () => Promise<number>;
  onReloadCustomGlb?: () => void;
  updateInfo?: ReleaseUpdateInfo | null;
  updateState?: UpdateProgressState;
  onCheckForUpdates?: (repo?: string) => Promise<ReleaseUpdateInfo>;
  onDownloadUpdate?: (info?: ReleaseUpdateInfo) => Promise<void>;
  onInstallUpdate?: () => Promise<void>;
  onTabChange: (tab: MenuTab) => void;
  onClose: () => void;
  onDeployDistrict: (districtId: DistrictId) => void;
  onStartEvent: (evt: LiveEventDef) => void;
  onStartBossBattle: (bossId: BossId, districtId: DistrictId) => void;
  onStartTutorial: () => void;
  onOpenCredits?: () => void;
}

const TIME_OPTIONS: TimeOfDay[] = [
  'dynamic',
  'dawn',
  'morning',
  'noon',
  'afternoon',
  'dusk',
  'night',
  'midnight',
];

export const MainMenuModal: React.FC<MainMenuModalProps> = ({
  initialTab,
  initialSettingsCategory = 'video',
  save,
  diagnostics,
  liveHud,
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
  previewBossId,
  onSelectBossPreview,
  onOnlineUserChange,
  onSwitchLocalProfile,
  onUpdateSave,
  onVideoChangeWithConfirm,
  onRunBenchmark,
  onReloadCustomGlb,
  updateInfo,
  updateState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onTabChange,
  onClose,
  onDeployDistrict,
  onStartEvent,
  onStartBossBattle,
  onStartTutorial,
  onOpenCredits,
}) => {
  const [tab, setTab] = useState<MenuTab>(initialTab);
  const [eventsSub, setEventsSub] = useState<'bosses' | 'events'>('bosses');
  const [glbUploadMsg, setGlbUploadMsg] = useState<string | null>(null);
  const [bossValidation, setBossValidation] =
    useState<CustomBossValidationResult | null>(null);
  const [charNotice, setCharNotice] = useState<string | null>(null);

  const lang = save.settings.language;
  const pending = getPendingRewardCount(save);

  const switchTab = (next: MenuTab) => {
    audioEngine.playUiClick();
    setTab(next);
    onTabChange(next);
  };

  // Is this tab docked over the live 3D viewport?
  const isLiveShowcaseDocked =
    tab === 'garage' ||
    tab === 'characters' ||
    tab === 'districts' ||
    (tab === 'events' && eventsSub === 'bosses');

  const handleCharacterAction = (charId: string) => {
    const res = purchaseCharacter(save, charId);
    if (res.ok) {
      audioEngine.playUiClick(true);
      onUpdateSave(res.nextSave);
      setCharNotice(null);
    } else {
      audioEngine.playUiClick();
      setCharNotice(res.reason ?? 'No se pudo equipar/desbloquear este corredor.');
    }
  };

  const handleDistrictAction = (districtId: DistrictId) => {
    const res = unlockOrSelectDistrict(save, districtId);
    if (res.ok) {
      audioEngine.playUiClick(true);
      onUpdateSave(res.nextSave);
    }
  };

  const activeChar = getCharacterById(save.selectedCharacterId);
  const activeDistrict = getDistrictById(save.selectedDistrictId);
  const activeBoss = BOSSES.find((b) => b.id === previewBossId) ?? BOSSES[0];

  const tabsNav: {
    id: MenuTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'characters', label: t(lang, 'nav.characters'), Icon: User },
    { id: 'garage', label: t(lang, 'nav.garage'), Icon: Car },
    { id: 'districts', label: t(lang, 'nav.city'), Icon: MapIcon },
    {
      id: 'battlepass',
      label: t(lang, 'nav.battlepass'),
      Icon: Award,
      badge: pending.missions + pending.battlePass,
    },
    { id: 'shop', label: t(lang, 'nav.shop'), Icon: ShoppingBag },
    { id: 'inventory', label: t(lang, 'nav.inventory'), Icon: Backpack },
    { id: 'online', label: t(lang, 'nav.online'), Icon: Globe },
    { id: 'profile', label: 'Perfil', Icon: UserCheck },
    { id: 'settings', label: t(lang, 'nav.settings'), Icon: Settings },
  ];

  return (
    <div
      className={`fixed inset-0 z-30 flex flex-col p-4 lg:p-6 ${
        isLiveShowcaseDocked ? 'bg-transparent pointer-events-none' : 'bg-[#040712]/90'
      }`}
    >
      {/* Top Unified Header Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 bg-[#080d1c]/95 border border-white/15 rounded-xl px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
          {tabsNav.map(({ id, label, Icon, badge }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-[#0e152b] text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {badge && badge > 0 ? (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-mono-num text-[10px] font-bold">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="font-mono-num flex flex-wrap items-center gap-2">
            <span className="text-cyan-300 font-bold">
              {t(lang, 'common.level')} {save.level}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400 font-bold" title="Monedas">
              {save.coins.toLocaleString('es-ES')} M
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-fuchsia-400 font-bold" title="Gemas">
              {save.gems} G
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-sky-300 font-bold" title="Tiques de Mejora">
              {save.tickets} TQ
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-300 font-bold" title="Fichas de Revivir">
              {save.reviveTokens} REV
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-violet-300 font-bold" title="Talismanes de Auto-Revivir">
              {save.talismans} TAL
            </span>
          </div>
          <button
            onClick={() => {
              audioEngine.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-500/30 text-slate-200 cursor-pointer"
            title={t(lang, 'common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div
        className={`flex-1 min-h-0 mt-4 ${
          isLiveShowcaseDocked
            ? 'flex flex-col lg:flex-row justify-between gap-4 pointer-events-none'
            : 'bg-[#070c1a]/95 border border-white/15 rounded-xl p-5 overflow-y-auto pointer-events-auto animate-menu-enter'
        }`}
      >
        {/* 1. CHARACTER SELECTION (3D Live Showcase Dock) */}
        {tab === 'characters' && (
          <>
            <div className="pointer-events-auto w-full lg:w-[440px] bg-[#070b17]/95 border border-white/15 rounded-xl p-4 flex flex-col gap-3 max-h-full overflow-y-auto">
              <div>
                <h2 className="font-display text-xl font-bold text-white">
                  {t(lang, 'nav.characters')}
                </h2>
                <p className="text-xs text-slate-400">
                  {CHARACTERS.length} corredores con habilidades activas únicas, requisitos de progreso y estadísticas diferenciadas.
                </p>
              </div>
              {charNotice && (
                <div className="px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-400/50 text-[11px] font-semibold text-amber-200">
                  {charNotice}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CHARACTERS.map((ch) => {
                  const unlocked = save.unlockedCharacters.includes(ch.id);
                  const selected = save.selectedCharacterId === ch.id;
                  const reqCheck = checkUnlockRequirement(save, ch.unlockRequirement);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => handleCharacterAction(ch.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-[#0c1324] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display font-bold text-sm text-white">
                          {ch.name}
                        </span>
                        {selected ? (
                          <Check className="w-4 h-4 text-cyan-300" />
                        ) : !unlocked ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        ) : null}
                      </div>
                      <div className="text-[11px] text-cyan-300 truncate">
                        {ch.title}
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-400 font-mono-num">
                        {unlocked
                          ? selected
                            ? t(lang, 'common.selected')
                            : t(lang, 'common.select')
                          : !reqCheck.met && ch.unlockRequirement
                            ? `Req: ${Math.min(reqCheck.current, reqCheck.target)}/${reqCheck.target}`
                            : `${ch.unlockCostCoins.toLocaleString('es-ES')} M / ${ch.unlockCostGems} G`}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 3D Character Rig Selector */}
              <div className="mt-1 pt-3 border-t border-white/10 space-y-2.5">
                <div>
                  <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    Motor 3D del Personaje (.GLB / Procedural)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Alterna entre el rig esculpido personalizable o modelos esqueléticos .GLB reales.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      ['procedural', 'Cyber Rig 3D', 'Personalizable'],
                      ['xbot', 'X-Bot (.GLB)', 'Esqueleto Pro'],
                      ['robot', 'Mech Bot (.GLB)', 'Animaciones Mix'],
                      ['soldier', 'Soldier (.GLB)', 'Animaciones Tácticas'],
                      [
                        'custom',
                        'Tu .GLB Propio',
                        getCustomGlbInfo().loaded
                          ? getCustomGlbInfo().name || 'Cargado'
                          : 'Importar archivo',
                      ],
                    ] as [PlayerModelStyle, string, string][]
                  ).map(([styleId, label, sub]) => {
                    const activeStyle = (save.modelStyle ?? 'procedural') === styleId;
                    const disabledCustom =
                      styleId === 'custom' && !getCustomGlbInfo().loaded;
                    return (
                      <button
                        key={styleId}
                        disabled={disabledCustom}
                        onClick={() => {
                          audioEngine.playUiClick(true);
                          onUpdateSave({ ...save, modelStyle: styleId });
                          onReloadCustomGlb?.();
                        }}
                        className={`p-2 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          activeStyle
                            ? 'bg-fuchsia-500/20 border-fuchsia-400 text-white'
                            : 'bg-[#0c1324] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{label}</div>
                        <div className="text-[10px] text-slate-400 truncate">{sub}</div>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-[#0d162c] hover:bg-[#13203f] border border-cyan-400/35 text-xs font-semibold text-cyan-200 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar tu propio modelo .GLB / .GLTF</span>
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setGlbUploadMsg('Cargando modelo 3D...');
                        const info = await parseCustomGlbFile(file);
                        audioEngine.playUiClick(true);
                        onUpdateSave({ ...save, modelStyle: 'custom' });
                        onReloadCustomGlb?.();
                        setGlbUploadMsg(
                          `Modelo "${info.name}" activo (${info.clipCount} animaciones).`,
                        );
                      } catch {
                        setGlbUploadMsg(
                          'No se pudo leer el archivo .glb/.gltf. Verifica que sea válido.',
                        );
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                {glbUploadMsg && (
                  <div className="text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 rounded px-2.5 py-1.5">
                    {glbUploadMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Right Bottom Character Details Card */}
            <div className="pointer-events-auto lg:self-end w-full lg:w-[360px] bg-[#070b17]/95 border border-cyan-500/35 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] text-cyan-400 font-semibold">
                    {activeChar.origin}
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white">
                    {activeChar.name}
                  </h3>
                  <div className="text-xs text-slate-300">{activeChar.title}</div>
                </div>
                <span
                  className="w-5 h-5 rounded-full border border-white/30"
                  style={{ backgroundColor: activeChar.colors.jacket }}
                />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeChar.bio}
              </p>
              <div className="p-2.5 rounded-lg bg-[#0d162c] border border-fuchsia-400/30 text-xs">
                <div className="font-bold text-fuchsia-300">
                  Activa: {activeChar.abilityName} (CD {activeChar.abilityCooldown}s)
                </div>
                <div className="text-slate-300 mt-0.5">{activeChar.abilityDesc}</div>
              </div>
              {activeChar.passiveName && (
                <div className="p-2.5 rounded-lg bg-[#0b1826] border border-cyan-400/25 text-xs">
                  <div className="font-bold text-cyan-300">
                    Pasiva: {activeChar.passiveName}
                  </div>
                  <div className="text-slate-300 mt-0.5">{activeChar.passiveDesc}</div>
                </div>
              )}
              {activeChar.secondaryAbilityName && (
                <div className="p-2.5 rounded-lg bg-[#14142b] border border-amber-400/25 text-xs">
                  <div className="font-bold text-amber-300">
                    Secundaria: {activeChar.secondaryAbilityName}
                  </div>
                  <div className="text-slate-300 mt-0.5">
                    {activeChar.secondaryAbilityDesc}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {(
                  [
                    ['Velocidad', activeChar.stats.speed],
                    ['Agilidad', activeChar.stats.agility],
                    ['Salto', activeChar.stats.jump],
                    ['Tecnología', activeChar.stats.tech],
                  ] as [string, number][]
                ).map(([lbl, val]) => (
                  <div key={lbl} className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>{lbl}</span>
                      <span className="font-mono-num font-bold text-cyan-300">
                        {val}/10
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: `${val * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 2. 3D VEHICLE GARAGE */}
        {tab === 'garage' && <GarageView save={save} onUpdateSave={onUpdateSave} />}

        {/* 3. CITIES EXPLORER */}
        {tab === 'districts' && (
          <>
            <div className="pointer-events-auto w-full lg:w-[430px] bg-[#070b17]/95 border border-white/15 rounded-xl p-4 flex flex-col gap-3 max-h-full overflow-y-auto">
              <div>
                <h2 className="font-display text-xl font-bold text-white">
                  {t(lang, 'nav.city')} ({DISTRICTS.length})
                </h2>
                <p className="text-xs text-slate-400">
                  10 distritos globales (3 y 5 carriles) con física, arquitectura, enemigos y ciclo horario propio en vivo.
                </p>
              </div>

              <div className="space-y-2">
                {DISTRICTS.map((d) => {
                  const unlocked = save.unlockedDistricts.includes(d.id);
                  const selected = save.selectedDistrictId === d.id;
                  const cLabel = getCityLabel(lang, d.id);
                  const lanes = d.laneCount ?? 3;
                  return (
                    <button
                      key={d.id}
                      onClick={() => handleDistrictAction(d.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-[#0c1324] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-sm text-white flex items-center gap-2">
                          <span>{cLabel.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono-num text-[10px] font-bold border ${
                              lanes === 5
                                ? 'bg-fuchsia-500/20 border-fuchsia-400/50 text-fuchsia-200'
                                : 'bg-cyan-500/15 border-cyan-400/35 text-cyan-200'
                            }`}
                          >
                            {lanes}C
                          </span>
                        </span>
                        <span className="font-mono-num text-[11px] text-cyan-300">
                          {d.gravityMultiplier.toFixed(2)}G · x{d.speedBonus.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {cLabel.sub} ·{' '}
                        {unlocked
                          ? selected
                            ? t(lang, 'common.selected')
                            : 'Desbloqueada'
                          : `Desbloquear: ${d.unlockCostCoins.toLocaleString('es-ES')} M`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pointer-events-auto lg:self-end w-full lg:w-[400px] bg-[#070b17]/95 border border-cyan-500/35 rounded-xl p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-cyan-300 font-semibold">
                    {getCityLabel(lang, activeDistrict.id).sub}
                  </div>
                  <span className="font-mono-num text-[11px] font-bold text-fuchsia-300">
                    {activeDistrict.laneCount ?? 3} Carriles
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold text-white">
                  {getCityLabel(lang, activeDistrict.id).name}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {activeDistrict.description}
                </p>
              </div>

              <div className="text-xs text-slate-300 space-y-1 border-t border-white/10 pt-2">
                <div>
                  <span className="text-slate-400">Mecánica distintiva:</span>{' '}
                  {activeDistrict.specialFeature}
                </div>
                <div>
                  <span className="text-slate-400">Enemigos habituales:</span>{' '}
                  {activeDistrict.signatureEnemies
                    .map((e) => DRONE_CODEX[e]?.name ?? e)
                    .join(' · ')}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-white/10 pt-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Iluminación / Hora del Día
                </div>
                <div className="flex flex-wrap gap-1">
                  {TIME_OPTIONS.map((tp) => (
                    <button
                      key={tp}
                      onClick={() => {
                        audioEngine.playUiClick();
                        onUpdateSave({
                          ...save,
                          settings: { ...save.settings, timeOfDay: tp },
                        });
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                        save.settings.timeOfDay === tp
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-[#0c1324] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {getTimeLabel(lang, tp)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={!save.unlockedDistricts.includes(activeDistrict.id)}
                onClick={() => {
                  audioEngine.playUiClick(true);
                  onDeployDistrict(activeDistrict.id);
                }}
                className="w-full py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />{' '}
                {t(lang, 'common.deploy')}
              </button>
            </div>
          </>
        )}

        {/* 4. MISSIONS (Unified inside Runner Pass §17) */}
        {tab === 'missions' && (
          <BattlePassView
            save={save}
            onUpdateSave={onUpdateSave}
            initialSubTab="missions"
          />
        )}

        {/* 5. RUNNER PASS (50 Tiers + Missions) */}
        {tab === 'battlepass' && (
          <BattlePassView save={save} onUpdateSave={onUpdateSave} />
        )}

        {/* 6. EVENTS & 8-BOSS SEQUENTIAL ARENA */}
        {tab === 'events' &&
          (eventsSub === 'bosses' ? (
            <>
              <div className="pointer-events-auto w-full lg:w-[430px] bg-[#070b17]/95 border border-white/15 rounded-xl p-4 flex flex-col gap-3 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div>
                    <h2 className="font-display text-xl font-bold text-white">
                      {BOSSES.length} Jefes de Neon City
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Progresión lineal 1–8 · 4 Fases Elden-Ring + Modelos Blender .GLB.
                    </p>
                  </div>
                  <div className="flex gap-1 bg-[#0b1224] p-1 rounded-lg border border-white/10">
                    <button
                      onClick={() => setEventsSub('bosses')}
                      className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500 text-white cursor-pointer whitespace-nowrap"
                    >
                      Jefes ({BOSSES.length})
                    </button>
                    <button
                      onClick={() => setEventsSub('events')}
                      className="px-2.5 py-1 rounded text-xs font-bold text-slate-300 cursor-pointer whitespace-nowrap"
                    >
                      Eventos
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {BOSSES.map((b, idx) => {
                    const selected = b.id === previewBossId;
                    const defeated = save.defeatedBosses.includes(b.id);
                    const unlocked = isBossUnlocked(b.id, save.defeatedBosses);
                    const hasCustomGlb = Boolean(
                      save.customBossMeta?.[b.id] || getCustomBossEntry(b.id),
                    );
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          audioEngine.playUiClick();
                          setBossValidation(null);
                          onSelectBossPreview(b.id);
                        }}
                        className={`w-full p-3 rounded-xl border text-left cursor-pointer ${
                          selected
                            ? 'bg-rose-500/20 border-rose-400 text-white'
                            : unlocked
                              ? 'bg-[#0c1324] border-white/10 text-slate-300 hover:border-white/25'
                              : 'bg-[#090e1c] border-white/5 text-slate-400 opacity-75 hover:opacity-95'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                            <span className="font-mono-num text-xs text-slate-400">
                              #{idx + 1}
                            </span>
                            {b.name}
                            {!unlocked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                            {hasCustomGlb && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-[9px] font-mono-num text-cyan-200">
                                GLB
                              </span>
                            )}
                          </span>
                          {defeated ? (
                            <span className="text-[11px] text-emerald-300 font-bold">
                              Derrotado
                            </span>
                          ) : !unlocked ? (
                            <span className="text-[11px] text-amber-300 font-semibold">
                              Bloqueado
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono-num text-rose-300">
                              4 Fases · {b.hpSegments} EMP
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {b.title} · {getCityLabel(lang, b.cityId).name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const activeBossUnlocked = isBossUnlocked(
                  activeBoss.id,
                  save.defeatedBosses,
                );
                const unlockReq = getBossUnlockRequirement(activeBoss.id);
                const customEntry = getCustomBossEntry(activeBoss.id);
                const customMeta =
                  customEntry?.meta ?? save.customBossMeta?.[activeBoss.id] ?? null;
                const customModelsGlobal = save.useCustomBossModels ?? true;

                return (
                  <div className="pointer-events-auto lg:self-end w-full lg:w-[420px] max-h-full overflow-y-auto bg-[#070b17]/95 border border-rose-500/45 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-rose-300 font-bold">
                          {activeBoss.title}
                        </span>
                        <span className="font-mono-num text-[10px] font-bold text-amber-300 flex items-center gap-1">
                          <Layers className="w-3 h-3" /> 4 FASES ESCALADAS
                        </span>
                      </div>
                      <h3 className="font-display text-2xl font-bold text-white">
                        {activeBoss.name}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1">
                        {activeBoss.description}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-300 space-y-1 border-t border-white/10 pt-2">
                      {activeBoss.phasesConfig && activeBoss.phasesConfig.length > 0
                        ? activeBoss.phasesConfig.map((pc) => (
                            <div key={pc.phase} className="flex items-center justify-between gap-2">
                              <span className="truncate">
                                <strong className="text-rose-300 font-mono-num">
                                  F{pc.phase}:
                                </strong>{' '}
                                {pc.name}
                              </span>
                              <span className="font-mono-num text-[10px] text-slate-400 shrink-0">
                                CD {pc.attackCooldownSec.toFixed(1)}s · EMP {pc.empSpawnSec.toFixed(1)}s
                              </span>
                            </div>
                          ))
                        : activeBoss.phases.map((p) => <div key={p}>· {p}</div>)}
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#10182b] border border-cyan-400/30 text-xs text-cyan-200">
                      {activeBoss.counterHint}
                    </div>

                    {/* Blender Custom Boss .GLB Studio */}
                    <div className="p-3 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <FileBox className="w-3.5 h-3.5" />
                          Studio Blender (.GLB / .GLTF)
                        </div>
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customModelsGlobal}
                            onChange={(e) => {
                              audioEngine.playUiClick();
                              onUpdateSave({
                                ...save,
                                useCustomBossModels: e.target.checked,
                              });
                              onReloadCustomGlb?.();
                            }}
                            className="accent-cyan-400"
                          />
                          Activo global
                        </label>
                      </div>

                      {customMeta ? (
                        <div className="p-2 rounded-lg bg-[#070b17] border border-white/10 text-[11px] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white truncate">
                              {customMeta.fileName}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await removeCustomBossGlb(activeBoss.id);
                                const nextMap = { ...(save.customBossMeta ?? {}) };
                                delete nextMap[activeBoss.id];
                                onUpdateSave({ ...save, customBossMeta: nextMap });
                                setBossValidation(null);
                                onReloadCustomGlb?.();
                              }}
                              className="text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer shrink-0"
                              title="Eliminar modelo personalizado"
                            >
                              <Trash2 className="w-3 h-3" /> Quitar
                            </button>
                          </div>
                          <div className="font-mono-num text-slate-400">
                            {customMeta.triangles.toLocaleString('es-ES')} tris ·{' '}
                            {customMeta.vertices.toLocaleString('es-ES')} verts ·{' '}
                            {customMeta.clips.length} clips
                          </div>
                          <label className="flex items-center justify-between pt-1 border-t border-white/10 text-slate-300 cursor-pointer">
                            <span>Usar este .GLB en combate</span>
                            <input
                              type="checkbox"
                              checked={customMeta.enabled}
                              onChange={(e) => {
                                const updated = setCustomBossEnabledState(
                                  activeBoss.id,
                                  e.target.checked,
                                );
                                onUpdateSave({
                                  ...save,
                                  customBossMeta: {
                                    ...(save.customBossMeta ?? {}),
                                    [activeBoss.id]: updated ?? {
                                      ...customMeta,
                                      enabled: e.target.checked,
                                    },
                                  },
                                });
                                onReloadCustomGlb?.();
                              }}
                              className="accent-cyan-400"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">
                          Modelo procedural 3D activo. Importa un .glb de Blender validado para personalizar a {activeBoss.name}.
                        </div>
                      )}

                      <div className="flex gap-2">
                        <label className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/45 text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" /> Importar .GLB
                          <input
                            type="file"
                            accept=".glb,.gltf"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              const res = await validateAndStoreCustomBossGlb(
                                file,
                                activeBoss,
                              );
                              setBossValidation(res);
                              if (res.ok && res.meta) {
                                audioEngine.playPurchaseConfirm();
                                onUpdateSave({
                                  ...save,
                                  useCustomBossModels: true,
                                  customBossMeta: {
                                    ...(save.customBossMeta ?? {}),
                                    [activeBoss.id]: res.meta,
                                  },
                                });
                                onReloadCustomGlb?.();
                              } else {
                                audioEngine.playUiClick();
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const json = buildBossBlenderTemplateJson(activeBoss);
                            const blob = new Blob([json], { type: 'model/gltf+json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${activeBoss.id}-blender-template.gltf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-[#070b17] hover:bg-white/10 border border-white/15 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          title="Descargar plantilla base glTF 2.0 para Blender"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-400" /> Plantilla .gltf
                        </button>
                      </div>

                      {bossValidation && (
                        <div className="text-[11px] space-y-0.5">
                          {bossValidation.errors.map((err, i) => (
                            <div key={i} className="text-rose-300 font-semibold">
                              · {err}
                            </div>
                          ))}
                          {bossValidation.warnings.map((w, i) => (
                            <div key={i} className="text-amber-300">
                              · {w}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {!activeBossUnlocked && unlockReq && (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-400/50 text-xs text-amber-200 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          Derrota primero a <strong className="text-white">{unlockReq.name}</strong> ({unlockReq.title}) para desbloquear este jefe.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs font-mono-num text-amber-300">
                      <span>Recompensa de Asalto:</span>
                      <span>
                        +{activeBoss.rewardCoins.toLocaleString('es-ES')} M · +{activeBoss.rewardGems} G
                      </span>
                    </div>

                    <button
                      disabled={!activeBossUnlocked}
                      onClick={() => {
                        if (!activeBossUnlocked) return;
                        audioEngine.playUiClick(true);
                        onStartBossBattle(activeBoss.id, activeBoss.cityId);
                      }}
                      className="w-full py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-400 text-white font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {activeBossUnlocked ? (
                        <>
                          <Swords className="w-4 h-4" /> Enfrentar a {activeBoss.name}
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" /> Jefe Bloqueado (Progresión Lineal)
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    Eventos Especiales de Ciudad
                  </h2>
                  <p className="text-xs text-slate-400">
                    Modificadores climáticos, baja gravedad y recompensas multiplicadas.
                  </p>
                </div>
                <div className="flex gap-1 bg-[#0b1224] p-1 rounded-lg border border-white/10">
                  <button
                    onClick={() => setEventsSub('bosses')}
                    className="px-3 py-1.5 rounded text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Jefes 3D (8)
                  </button>
                  <button
                    onClick={() => setEventsSub('events')}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-cyan-400 text-slate-950 cursor-pointer"
                  >
                    Eventos ({LIVE_EVENTS.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIVE_EVENTS.map((evt) => {
                  const done = save.completedEvents.includes(evt.id);
                  return (
                    <div
                      key={evt.id}
                      className="p-4 rounded-xl bg-[#0b1224] border border-white/15 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-fuchsia-300">
                          <span>{evt.subtitle}</span>
                          <span>{evt.modifierTag}</span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-white">
                          {evt.title}
                        </h3>
                        <p className="text-xs text-slate-300">{evt.description}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="font-mono-num text-xs text-amber-300 font-bold">
                          +{evt.rewardCoins} M · +{evt.rewardGems} G
                        </span>
                        <button
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onStartEvent(evt);
                          }}
                          className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold cursor-pointer"
                        >
                          {done ? 'Rejugar Evento' : 'Iniciar Evento'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {/* 7. STANDALONE STORE */}
        {tab === 'shop' && <ShopView save={save} onUpdateSave={onUpdateSave} />}

        {/* 8. STANDALONE INVENTORY */}
        {tab === 'inventory' && (
          <InventoryView
            save={save}
            onUpdateSave={onUpdateSave}
            onGoToShop={() => switchTab('shop')}
          />
        )}

        {/* 9. EXPANDED STATS, HISTORY, CODEX & BENCHMARKS */}
        {tab === 'stats' && (
          <StatsView save={save} diagnostics={diagnostics} liveHud={liveHud} />
        )}

        {/* 10. ONLINE HUB */}
        {tab === 'online' && (
          <OnlineHubView
            save={save}
            serverOnline={serverOnline}
            onlineUser={onlineUser}
            activeLocalProfileId={activeLocalProfileId}
            mpConnected={mpConnected}
            mpSelfId={mpSelfId}
            mpTargetUrl={mpTargetUrl}
            mpRoom={mpRoom}
            mpInvite={mpInvite}
            mpNotice={mpNotice}
            pendingConflict={pendingConflict}
            pendingOnlineSave={pendingOnlineSave}
            onResolveConflict={onResolveConflict}
            onDismissConflict={onDismissConflict}
            onDismissInvite={onDismissInvite}
            onClearNotice={onClearNotice}
            onOnlineUserChange={onOnlineUserChange}
            onSwitchLocalProfile={onSwitchLocalProfile}
            onReplaceSave={onUpdateSave}
            onStartChallenge={(districtId, bossId) => {
              if (bossId) {
                onStartBossBattle(bossId, districtId);
              } else {
                onDeployDistrict(districtId);
              }
            }}
          />
        )}

        {/* 10B. LOCAL USER PROFILE (Includes Stats Sub-Tab) */}
        {tab === 'profile' && (
          <UserProfileView
            save={save}
            serverOnline={serverOnline}
            onlineUser={onlineUser}
            activeLocalProfileId={activeLocalProfileId}
            diagnostics={diagnostics}
            liveHud={liveHud}
            onUpdateSave={onUpdateSave}
            onSwitchLocalProfile={onSwitchLocalProfile}
            onOpenOnlineTab={() => switchTab('online')}
          />
        )}

        {/* 11. SETTINGS (4 Clean Groups + JSON Backup + Official GitHub Updater + Credits) */}
        {tab === 'settings' && (
          <SettingsView
            settings={save.settings}
            save={save}
            diagnostics={diagnostics}
            liveHud={liveHud}
            initialCategory={initialSettingsCategory}
            updateInfo={updateInfo}
            updateState={updateState}
            onCheckForUpdates={onCheckForUpdates}
            onDownloadUpdate={onDownloadUpdate}
            onInstallUpdate={onInstallUpdate}
            onChangeSettings={(nextSettings) =>
              onUpdateSave({ ...save, settings: nextSettings })
            }
            onReplaceSave={onUpdateSave}
            onVideoChangeWithConfirm={onVideoChangeWithConfirm}
            onRunBenchmark={onRunBenchmark}
            onStartTutorial={onStartTutorial}
            onOpenCredits={onOpenCredits}
          />
        )}

        {/* 12. CREDITS & ASSET LICENSES */}
        {tab === 'credits' && <CreditsContent />}
      </div>
    </div>
  );
};
