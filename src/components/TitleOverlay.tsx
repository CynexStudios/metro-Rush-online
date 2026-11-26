import React from 'react';
import {
  Award,
  Backpack,
  BarChart3,
  Bell,
  BookOpen,
  Car,
  Compass,
  FastForward,
  Globe,
  GraduationCap,
  Infinity as InfinityIcon,
  Map as MapIcon,
  Play,
  Power,
  Settings,
  ShoppingBag,
  Sliders,
  Swords,
  Timer,
  User,
  UserCheck,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BATTLE_PASS_TIERS,
  getBattlePassXpForTier,
  getCharacterById,
  getDistrictById,
  getVehicleById,
  LIVE_EVENTS,
} from '../game/data';
import { getPendingRewardCount } from '../game/economy';
import { xpRequiredForLevel } from '../game/storage';
import {
  GameMode,
  PlayerSaveData,
  ReleaseUpdateInfo,
  UpdateProgressState,
} from '../game/types';
import { GAME_VERSION } from '../game/version';
import { getCityLabel, getModeLabel, t } from '../i18n';
import { OnlineUser } from '../services/onlineClient';
import { MenuTab } from './MainMenuModal';

interface TitleOverlayProps {
  save: PlayerSaveData;
  serverOnline: boolean;
  onlineUser: OnlineUser | null;
  mpRoomCode?: string | null;
  hasSyncConflict?: boolean;
  updateInfo?: ReleaseUpdateInfo | null;
  updateState?: UpdateProgressState;
  onDismissUpdateBanner?: () => void;
  onOpenUpdatesSettings?: () => void;
  onSelectMode: (mode: GameMode) => void;
  onOpenModeConfig: (
    mode: GameMode,
    subTab?: 'bosses' | 'events',
  ) => void;
  onStartTutorial: () => void;
  onOpenTab: (tab: MenuTab) => void;
  onRequestExit: () => void;
}

const GAME_MODE_IDS: GameMode[] = [
  'endless',
  'story',
  'timetrial',
  'parkour',
  'bosschase',
  'freerun',
];

const MODE_META: Record<
  GameMode,
  {
    Icon: React.ComponentType<{ className?: string }>;
    accentText: string;
    activeBorder: string;
  }
> = {
  endless: {
    Icon: InfinityIcon,
    accentText: 'text-cyan-300',
    activeBorder: 'bg-cyan-500/20 border-cyan-400 text-white',
  },
  story: {
    Icon: BookOpen,
    accentText: 'text-fuchsia-300',
    activeBorder: 'bg-fuchsia-500/20 border-fuchsia-400 text-white',
  },
  timetrial: {
    Icon: Timer,
    accentText: 'text-amber-300',
    activeBorder: 'bg-amber-500/20 border-amber-400 text-white',
  },
  parkour: {
    Icon: Zap,
    accentText: 'text-emerald-300',
    activeBorder: 'bg-emerald-500/20 border-emerald-400 text-white',
  },
  bosschase: {
    Icon: Swords,
    accentText: 'text-rose-300',
    activeBorder: 'bg-rose-500/20 border-rose-400 text-white',
  },
  freerun: {
    Icon: Compass,
    accentText: 'text-sky-300',
    activeBorder: 'bg-sky-500/20 border-sky-400 text-white',
  },
  tutorial: {
    Icon: GraduationCap,
    accentText: 'text-emerald-300',
    activeBorder: 'bg-emerald-500/20 border-emerald-400 text-white',
  },
};

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  serverOnline,
  onlineUser,
  mpRoomCode,
  hasSyncConflict,
  updateInfo,
  updateState,
  onDismissUpdateBanner,
  onOpenUpdatesSettings,
  onSelectMode,
  onOpenModeConfig,
  onStartTutorial,
  onOpenTab,
  onRequestExit,
}) => {
  const lang = save.settings.language;
  const activeChar = getCharacterById(save.selectedCharacterId);
  const activeVehicle = getVehicleById(save.selectedVehicleId ?? 'hover_bike');
  const activeDistrictDef = getDistrictById(save.selectedDistrictId);
  const cityLabel = getCityLabel(lang, save.selectedDistrictId);
  const pending = getPendingRewardCount(save);
  const totalNotifications = pending.missions + pending.battlePass;
  const xpReq = Math.max(1, xpRequiredForLevel(save.level));
  const xpPct = Math.min(100, Math.round((save.xp / xpReq) * 100));
  const bpXpReq = Math.max(1, getBattlePassXpForTier(save.battlePass.level));
  const bpPct = Math.min(100, Math.round((save.battlePass.xp / bpXpReq) * 100));
  const featuredEvent = LIVE_EVENTS[0];

  const navClick = (tab: MenuTab) => {
    audioEngine.playUiClick();
    onOpenTab(tab);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 lg:p-6">
      {/* Top Bar (§11): Username/Avatar opens Profile + Level/XP + Currencies + Online/Settings + 1 Single Exit */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 bg-[#070b17]/95 border border-white/15 rounded-xl px-4 py-2 text-xs">
          <button
            type="button"
            onClick={() => navClick('profile')}
            title="Abrir Perfil de Usuario"
            className="flex items-center gap-2 text-left hover:text-cyan-300 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 rounded"
          >
            <span
              className="w-6 h-6 rounded-md border border-white/25 flex items-center justify-center font-display font-bold text-[11px] text-white shrink-0"
              style={{ backgroundColor: activeChar.colors.jacket }}
            >
              {(onlineUser ? onlineUser.displayName || onlineUser.username : save.playerName)
                .trim()
                .slice(0, 2)
                .toUpperCase() || 'MR'}
            </span>
            <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-display font-bold text-white text-sm">
              {onlineUser
                ? onlineUser.displayName || onlineUser.username
                : save.playerName}
            </span>
            <span className="text-slate-500">·</span>
            <span
              className={
                hasSyncConflict
                  ? 'text-amber-300 font-semibold'
                  : onlineUser
                    ? 'text-emerald-300 font-semibold'
                    : 'text-slate-400'
              }
            >
              {hasSyncConflict
                ? 'Conflicto de Sincronización'
                : onlineUser
                  ? 'Cuenta Online'
                  : 'Perfil Local (Offline)'}
            </span>
          </button>

          <span className="text-slate-600">·</span>

          <div className="flex items-center gap-2">
            <span className="font-mono-num text-cyan-300 font-bold whitespace-nowrap">
              {t(lang, 'common.level')} {save.level}
            </span>
            <div className="w-16 h-1.5 bg-slate-800 rounded overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${xpPct}%` }} />
            </div>
          </div>

          <span className="text-slate-600">·</span>

          <div className="flex flex-wrap items-center gap-2 font-mono-num font-semibold">
            <span className="text-amber-400">
              {save.coins.toLocaleString('es-ES')} M
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-fuchsia-400">{save.gems} G</span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-200">{save.tickets} TQ</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-300">{save.reviveTokens} REV</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-200">{save.talismans} TAL</span>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {totalNotifications > 0 && (
            <button
              type="button"
              onClick={() => navClick('battlepass')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0c1a2e]/95 border border-emerald-400/50 text-xs font-bold text-emerald-200 hover:border-emerald-300 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-400" />
              {totalNotifications} Recompensas
            </button>
          )}

          <button
            type="button"
            onClick={() => navClick('online')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-white/15 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <Globe
              className={`w-4 h-4 ${
                serverOnline ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            {mpRoomCode ? `Sala ${mpRoomCode}` : t(lang, 'nav.online')}
          </button>

          <button
            type="button"
            onClick={() => navClick('settings')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-white/15 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
            {t(lang, 'nav.settings')}
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick();
              onRequestExit();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#160b14]/95 border border-rose-400/55 text-xs font-bold text-rose-200 hover:bg-rose-500/20 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            <Power className="w-4 h-4 text-rose-400" />
            Salir del Juego
          </button>
        </div>
      </div>

      {/* Middle Row: Left Mode Console + Right Runner Pass / Highlight Event / Record */}
      <div className="my-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-[385px] w-full pointer-events-auto">
          <svg
            viewBox="0 0 460 112"
            className="w-full max-w-[375px] mb-2"
            aria-label="METRO RUSH: NEON CITY"
          >
            <defs>
              <linearGradient id="mrGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="55%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <path
              d="M4 16 L18 4 L450 4 L438 16 Z"
              fill="#22d3ee"
              opacity="0.85"
            />
            <text
              x="6"
              y="68"
              fill="url(#mrGrad)"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="56"
              fontStyle="italic"
              letterSpacing="2"
            >
              METRO RUSH
            </text>
            <text
              x="10"
              y="100"
              fill="#e2e8f0"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="23"
              letterSpacing="9"
            >
              NEON CITY
            </text>
            <rect x="236" y="88" width="206" height="4" fill="#ec4899" />
          </svg>
          <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[11px] font-mono-num">
            <span className="text-cyan-300 font-bold tracking-wider">
              v{GAME_VERSION} · NEON OVERDRIVE
            </span>
            {activeDistrictDef.laneCount === 5 && (
              <span className="text-amber-300 font-bold">5 CARRILES</span>
            )}
          </div>

          {updateInfo?.hasUpdate && (
            <div className="mb-2.5 bg-[#0a1729]/96 border border-emerald-400/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-emerald-300 truncate">
                  Actualización v{updateInfo.latestVersion} disponible
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  {updateState?.status === 'downloading'
                    ? `Descargando ${updateState.progressPercent}%...`
                    : updateState?.status === 'ready_to_install'
                      ? 'Instalador verificado y listo.'
                      : 'Lanzamiento oficial en GitHub Releases.'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onOpenUpdatesSettings?.();
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Actualizar
                </button>
                {onDismissUpdateBanner && (
                  <button
                    type="button"
                    onClick={onDismissUpdateBanner}
                    className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] cursor-pointer"
                    title="Ocultar aviso"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-[#070b17]/96 border border-white/15 rounded-xl p-4 space-y-3">
            {/* Active Loadout Summary */}
            <div className="grid grid-cols-3 gap-2 text-xs border-b border-white/10 pb-2.5">
              <button
                type="button"
                onClick={() => navClick('characters')}
                className="text-left hover:opacity-85 cursor-pointer min-w-0 focus-visible:outline-2 focus-visible:outline-cyan-400 rounded"
              >
                <div className="text-[11px] text-slate-400">Corredor</div>
                <div className="font-display font-bold text-white truncate">
                  {activeChar.name}
                </div>
              </button>
              <button
                type="button"
                onClick={() => navClick('garage')}
                className="text-left hover:opacity-85 cursor-pointer min-w-0 focus-visible:outline-2 focus-visible:outline-cyan-400 rounded"
              >
                <div className="text-[11px] text-slate-400">Vehículo</div>
                <div className="font-display font-bold text-amber-300 truncate">
                  {activeVehicle.name}
                </div>
              </button>
              <button
                type="button"
                onClick={() => navClick('districts')}
                className="text-right hover:opacity-85 cursor-pointer min-w-0 focus-visible:outline-2 focus-visible:outline-cyan-400 rounded"
              >
                <div className="text-[11px] text-slate-400">
                  Distrito ({activeDistrictDef.laneCount}C)
                </div>
                <div className="font-display font-bold text-cyan-300 truncate">
                  {cityLabel.name}
                </div>
              </button>
            </div>

            {/* Game Modes Grid: Clicking opens Mode Config Screen (§9) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-cyan-300">
                  Seleccionar Modo de Juego
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <Sliders className="w-3 h-3" /> Abre configuración
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {GAME_MODE_IDS.map((mId) => {
                  const active = save.selectedMode === mId;
                  const mLabel = getModeLabel(lang, mId);
                  const { Icon, accentText, activeBorder } = MODE_META[mId];
                  return (
                    <button
                      type="button"
                      key={mId}
                      onClick={() => {
                        audioEngine.playUiClick(true);
                        onSelectMode(mId);
                        onOpenModeConfig(mId);
                      }}
                      className={`px-2.5 py-2 rounded-lg text-left border flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                        active
                          ? activeBorder
                          : 'bg-[#0c1324] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${accentText}`} />
                      <span className="text-[11px] font-bold whitespace-nowrap truncate">
                        {mLabel.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-slate-400">
                {getModeLabel(lang, save.selectedMode).desc}
              </div>
            </div>

            {/* Primary Mode Setup + Story Chapter + Interactive Tutorial CTA */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onOpenModeConfig(save.selectedMode);
                  }}
                  className="flex-1 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {t(lang, 'nav.play')} · {getModeLabel(lang, save.selectedMode).label}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onSelectMode('story');
                    onOpenModeConfig('story');
                  }}
                  className="px-3.5 py-3 rounded-lg bg-[#0f1930] hover:bg-[#172544] border border-cyan-400/40 text-cyan-200 font-display font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <FastForward className="w-4 h-4 text-cyan-400" />
                  {t(lang, 'nav.continue')} (C{save.storyChapter})
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(true);
                  onStartTutorial();
                }}
                className="w-full py-2 rounded-lg bg-[#0d172b] hover:bg-[#152340] border border-emerald-400/40 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                {save.tutorialCompleted
                  ? t(lang, 'settings.replayTutorial')
                  : 'Iniciar Entrenamiento Interactivo (23 Temas)'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side (§11.4): Runner Pass + Featured Event + Personal Record */}
        <div className="hidden lg:flex flex-col gap-3 w-[285px] pointer-events-auto">
          <button
            type="button"
            onClick={() => navClick('battlepass')}
            className="p-4 rounded-xl bg-[#070b17]/95 border border-fuchsia-400/40 hover:border-fuchsia-300 text-left space-y-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-fuchsia-400"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-fuchsia-300 flex items-center gap-1.5">
                <Award className="w-4 h-4" /> {t(lang, 'nav.battlepass')} T{save.battlePass.season}
              </span>
              {totalNotifications > 0 && (
                <span className="font-mono-num text-[11px] font-bold text-emerald-300">
                  {totalNotifications} Listo
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-display font-bold text-lg text-white">
                Nivel {save.battlePass.level}/{BATTLE_PASS_TIERS.length}
              </span>
              <span className="font-mono-num text-[11px] text-slate-300">
                {save.battlePass.xp}/{bpXpReq} XP
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-fuchsia-400"
                style={{ width: `${bpPct}%` }}
              />
            </div>
          </button>

          {featuredEvent && (
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                onOpenModeConfig('bosschase', 'events');
              }}
              className="p-3.5 rounded-xl bg-[#070b17]/95 border border-white/15 hover:border-amber-400/60 text-left space-y-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> Evento Destacado
                </span>
                <span className="font-mono-num">+{featuredEvent.rewardGems} G</span>
              </div>
              <div className="font-display font-bold text-sm text-white">
                {featuredEvent.title}
              </div>
              <div className="text-[11px] text-slate-400 line-clamp-2">
                {featuredEvent.subtitle} · {featuredEvent.modifierTag}
              </div>
            </button>
          )}

          {save.bestRun && (
            <button
              type="button"
              onClick={() => navClick('stats')}
              className="p-3.5 rounded-xl bg-[#070b17]/95 border border-white/15 hover:border-cyan-400 text-left space-y-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <div className="text-[11px] text-slate-400 font-semibold">
                Récord Personal
              </div>
              <div className="font-mono-num text-lg font-bold text-cyan-300">
                {save.bestRun.score.toLocaleString('es-ES')} pts
              </div>
              <div className="font-mono-num text-[11px] text-slate-300">
                {save.bestRun.distance}m · Combo x{save.bestRun.maxCombo} ·{' '}
                {save.stats.wins}V/{save.stats.losses}D
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Clean Bottom Navigation Dock (no Missions/Events/Profile/Exit duplicates or keyboard cheat-sheet) */}
      <div className="flex flex-col items-center">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 bg-[#070b17]/95 border border-white/15 rounded-xl px-3 py-2">
          {(
            [
              ['characters', t(lang, 'nav.characters'), User, 0],
              ['garage', t(lang, 'nav.garage'), Car, 0],
              ['districts', t(lang, 'nav.city'), MapIcon, 0],
              [
                'battlepass',
                t(lang, 'nav.battlepass'),
                Award,
                pending.missions + pending.battlePass,
              ],
              ['shop', t(lang, 'nav.shop'), ShoppingBag, 0],
              ['inventory', t(lang, 'nav.inventory'), Backpack, 0],
              ['stats', t(lang, 'nav.stats'), BarChart3, 0],
              ['online', t(lang, 'nav.online'), Globe, 0],
            ] as [
              MenuTab,
              string,
              React.ComponentType<{ className?: string }>,
              number,
            ][]
          ).map(([tab, label, Icon, badgeCount]) => (
            <button
              type="button"
              key={tab}
              onClick={() => navClick(tab)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <Icon className="w-3.5 h-3.5 text-cyan-400" />
              <span>{label}</span>
              {badgeCount > 0 && (
                <span className="font-mono-num text-[10px] font-bold text-emerald-300">
                  ({badgeCount})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
