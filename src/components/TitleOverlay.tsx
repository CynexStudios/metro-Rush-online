import React, { useState } from 'react';
import {
  Award,
  Backpack,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Car,
  Compass,
  FastForward,
  Globe,
  GraduationCap,
  Infinity as InfinityIcon,
  Info,
  Map as MapIcon,
  Music,
  Play,
  Power,
  Settings,
  ShoppingBag,
  Shuffle,
  Sun,
  Swords,
  Target,
  Timer,
  User,
  UserCheck,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BATTLE_PASS_XP_PER_TIER,
  DISTRICTS,
  getCharacterById,
  getVehicleById,
  LIVE_EVENTS,
  STORY_CHAPTERS,
} from '../game/data';
import { getPendingRewardCount } from '../game/economy';
import { xpRequiredForLevel } from '../game/storage';
import { DistrictId, GameMode, PlayerSaveData, TimeOfDay } from '../game/types';
import { getCityLabel, getModeLabel, getTimeLabel, t } from '../i18n';
import { OnlineUser } from '../services/onlineClient';
import { MenuTab } from './MainMenuModal';

interface TitleOverlayProps {
  save: PlayerSaveData;
  serverOnline: boolean;
  onlineUser: OnlineUser | null;
  mpRoomCode?: string | null;
  hasSyncConflict?: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectDistrict: (districtId: DistrictId) => void;
  onSelectTimeOfDay: (time: TimeOfDay) => void;
  onToggleRandomMap: () => void;
  onToggleRandomWeather: () => void;
  onStartGame: (storyChapterOverride?: number) => void;
  onStartTutorial: () => void;
  onContinueStory: (storyChapterOverride?: number) => void;
  onOpenTab: (tab: MenuTab) => void;
  onToggleMute: () => void;
  onToggleLobbyMusic: () => void;
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
  { Icon: React.ComponentType<{ className?: string }>; accentText: string; activeBorder: string }
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

const QUICK_TIMES: TimeOfDay[] = ['dynamic', 'dawn', 'noon', 'dusk', 'night'];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  serverOnline,
  onlineUser,
  mpRoomCode,
  hasSyncConflict,
  onSelectMode,
  onSelectDistrict,
  onSelectTimeOfDay,
  onToggleRandomMap,
  onToggleRandomWeather,
  onStartGame,
  onStartTutorial,
  onContinueStory,
  onOpenTab,
  onToggleMute,
  onToggleLobbyMusic,
  onRequestExit,
}) => {
  const [selectedStoryChapter, setSelectedStoryChapter] = useState<number>(
    () => Math.min(5, Math.max(1, save.storyChapter || 1)),
  );

  const lang = save.settings.language;
  const activeChar = getCharacterById(save.selectedCharacterId);
  const activeVehicle = getVehicleById(save.selectedVehicleId ?? 'hover_bike');
  const cityLabel = getCityLabel(lang, save.selectedDistrictId);
  const pending = getPendingRewardCount(save);
  const totalNotifications = pending.missions + pending.battlePass;
  const xpReq = Math.max(1, xpRequiredForLevel(save.level));
  const xpPct = Math.min(100, Math.round((save.xp / xpReq) * 100));
  const bpPct = Math.min(
    100,
    Math.round((save.battlePass.xp / BATTLE_PASS_XP_PER_TIER) * 100),
  );
  const chapterDef =
    STORY_CHAPTERS.find((c) => c.chapter === selectedStoryChapter) ??
    STORY_CHAPTERS[0];
  const featuredEvent = LIVE_EVENTS[0];

  const navClick = (tab: MenuTab) => {
    audioEngine.playUiClick();
    onOpenTab(tab);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 lg:p-6">
      {/* Top Bar: Profile + Level/XP + Currencies + Audio/Online/Settings/Exit */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 bg-[#070b17]/95 border border-white/15 rounded-xl px-4 py-2 text-xs">
          <button
            onClick={() => navClick('profile')}
            title="Abrir Perfil de Usuario"
            className="flex items-center gap-2 text-left hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-display font-bold text-white text-sm">
              {onlineUser ? onlineUser.displayName || onlineUser.username : save.playerName}
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
            <span className="text-amber-400">{save.coins.toLocaleString('es-ES')} M</span>
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
              onClick={() => navClick(pending.missions > 0 ? 'missions' : 'battlepass')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0c1a2e]/95 border border-emerald-400/50 text-xs font-bold text-emerald-200 hover:border-emerald-300 cursor-pointer whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-400" />
              {totalNotifications} Recompensas
            </button>
          )}

          <button
            onClick={() => navClick('profile')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-cyan-400/40 text-xs font-semibold text-cyan-200 hover:border-cyan-300 cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="w-4 h-4 text-cyan-400" />
            Perfil
          </button>

          <button
            onClick={() => navClick('online')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-white/15 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Globe
              className={`w-4 h-4 ${
                serverOnline ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            {mpRoomCode ? `Sala ${mpRoomCode}` : t(lang, 'nav.online')}
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onToggleLobbyMusic();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-white/15 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Music
              className={`w-4 h-4 ${
                save.settings.lobbyMusicEnabled ? 'text-cyan-400' : 'text-slate-500'
              }`}
            />
            Lobby
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onToggleMute();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-white/15 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
          >
            {save.settings.muted ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-400" />
                {t(lang, 'common.muted')}
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-cyan-400" />
                {t(lang, 'common.audioOn')}
              </>
            )}
          </button>

          <button
            onClick={() => navClick('settings')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-white/15 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
            {t(lang, 'nav.settings')}
          </button>

          <button
            onClick={() => navClick('credits')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#070b17]/95 border border-white/15 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Info className="w-4 h-4 text-slate-300" />
            {t(lang, 'nav.credits')}
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onRequestExit();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#160b14]/95 border border-rose-400/55 text-xs font-bold text-rose-200 hover:bg-rose-500/20 cursor-pointer whitespace-nowrap"
          >
            <Power className="w-4 h-4 text-rose-400" />
            Salir del Juego
          </button>
        </div>
      </div>

      {/* Middle Row: Left Narrow Corner Launch Console (leaves central 3D hero & fox completely unobstructed!) + Right Lobby Intel */}
      <div className="my-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-[390px] w-full pointer-events-auto">
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
            <path d="M4 16 L18 4 L450 4 L438 16 Z" fill="#22d3ee" opacity="0.85" />
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

          <div className="bg-[#070b17]/96 border border-white/15 rounded-xl p-4 space-y-3">
            {/* Active Loadout Strip */}
            <div className="grid grid-cols-3 gap-2 text-xs border-b border-white/10 pb-2.5">
              <button
                onClick={() => navClick('characters')}
                className="text-left hover:opacity-85 cursor-pointer min-w-0"
              >
                <div className="text-[11px] text-slate-400">Corredor</div>
                <div className="font-display font-bold text-white truncate">
                  {activeChar.name}
                </div>
              </button>
              <button
                onClick={() => navClick('garage')}
                className="text-left hover:opacity-85 cursor-pointer min-w-0"
              >
                <div className="text-[11px] text-slate-400">Vehículo</div>
                <div className="font-display font-bold text-amber-300 truncate">
                  {activeVehicle.name}
                </div>
              </button>
              <button
                onClick={() => navClick('districts')}
                className="text-right hover:opacity-85 cursor-pointer min-w-0"
              >
                <div className="text-[11px] text-slate-400">Distrito</div>
                <div className="font-display font-bold text-cyan-300 truncate">
                  {save.settings.randomMap ? 'Aleatorio' : cityLabel.name}
                </div>
              </button>
            </div>

            {/* Vertical Corner Mode Selector with Icons & Accents */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                {GAME_MODE_IDS.map((mId) => {
                  const active = save.selectedMode === mId;
                  const mLabel = getModeLabel(lang, mId);
                  const { Icon, accentText, activeBorder } = MODE_META[mId];
                  return (
                    <button
                      key={mId}
                      onClick={() => {
                        audioEngine.playUiClick();
                        onSelectMode(mId);
                      }}
                      className={`px-2.5 py-2 rounded-lg text-left border flex items-center gap-2 transition-colors cursor-pointer ${
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

            {/* 5-Chapter Story Selector */}
            {save.selectedMode === 'story' && (
              <div className="p-2.5 rounded-lg bg-[#0d162c] border border-fuchsia-400/35 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-fuchsia-300">
                    Campaña Narrativa
                  </span>
                  <div className="flex gap-1">
                    {STORY_CHAPTERS.map((ch) => {
                      const unlocked = ch.chapter <= Math.max(1, save.storyChapter);
                      const active = selectedStoryChapter === ch.chapter;
                      return (
                        <button
                          key={ch.chapter}
                          disabled={!unlocked}
                          onClick={() => {
                            audioEngine.playUiClick();
                            setSelectedStoryChapter(ch.chapter);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono-num font-bold border cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                            active
                              ? 'bg-fuchsia-500 border-fuchsia-300 text-white'
                              : 'bg-[#070b17] border-white/10 text-slate-300'
                          }`}
                        >
                          C{ch.chapter}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="text-xs font-bold text-white">{chapterDef.title}</div>
                <div className="text-[11px] text-slate-300">{chapterDef.objectiveLabel}</div>
              </div>
            )}

            {/* Quick District & Random Map / Weather Selectors */}
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={save.selectedDistrictId}
                  disabled={Boolean(save.settings.randomMap)}
                  onChange={(e) => {
                    audioEngine.playUiClick();
                    onSelectDistrict(e.target.value as DistrictId);
                  }}
                  className="flex-1 min-w-0 bg-[#0c1324] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-50 outline-none focus:border-cyan-400"
                >
                  {DISTRICTS.map((d) => {
                    const unlocked = save.unlockedDistricts.includes(d.id);
                    return (
                      <option key={d.id} value={d.id} disabled={!unlocked}>
                        {getCityLabel(lang, d.id).name} {unlocked ? '' : '(Bloqueada)'}
                      </option>
                    );
                  })}
                </select>

                <button
                  onClick={() => {
                    audioEngine.playUiClick();
                    onToggleRandomMap();
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    save.settings.randomMap
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-[#0c1324] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Mapa Aleatorio
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {QUICK_TIMES.map((tp) => {
                    const active = save.settings.timeOfDay === tp && !save.settings.randomWeather;
                    return (
                      <button
                        key={tp}
                        onClick={() => {
                          audioEngine.playUiClick();
                          onSelectTimeOfDay(tp);
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-[#0c1324] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {tp === 'dynamic' ? 'Ciclo' : getTimeLabel(lang, tp)}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    audioEngine.playUiClick();
                    onToggleRandomWeather();
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    save.settings.randomWeather
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-[#0c1324] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  Clima Aleatorio
                </button>
              </div>
            </div>

            {/* Primary Play + Continue + Tutorial CTA */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onStartGame(
                      save.selectedMode === 'story' ? selectedStoryChapter : undefined,
                    );
                  }}
                  className="flex-1 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-current" />
                  {t(lang, 'nav.play')}
                </button>
                <button
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onContinueStory(selectedStoryChapter);
                  }}
                  className="px-3.5 py-3 rounded-lg bg-[#0f1930] hover:bg-[#172544] border border-cyan-400/40 text-cyan-200 font-display font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FastForward className="w-4 h-4 text-cyan-400" />
                  {t(lang, 'nav.continue')} (C{save.storyChapter})
                </button>
              </div>

              <button
                onClick={() => {
                  audioEngine.playUiClick(true);
                  onStartTutorial();
                }}
                className="w-full py-2 rounded-lg bg-[#0d172b] hover:bg-[#152340] border border-emerald-400/40 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                {save.tutorialCompleted
                  ? 'Repetir Tutorial Interactivo (6 pasos)'
                  : 'Tutorial Interactivo Guiado (Recomendado)'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Battle Pass + News/Challenge + Personal Record */}
        <div className="hidden lg:flex flex-col gap-3 w-[285px] pointer-events-auto">
          <button
            onClick={() => navClick('battlepass')}
            className="p-4 rounded-xl bg-[#070b17]/95 border border-fuchsia-400/40 hover:border-fuchsia-300 text-left space-y-2 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-fuchsia-300 flex items-center gap-1.5">
                <Award className="w-4 h-4" /> Pase Temporada {save.battlePass.season}
              </span>
              {pending.battlePass > 0 && (
                <span className="font-mono-num text-[11px] font-bold text-emerald-300">
                  {pending.battlePass} Listo
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-display font-bold text-lg text-white">
                Nivel {save.battlePass.level}/20
              </span>
              <span className="font-mono-num text-[11px] text-slate-300">
                {save.battlePass.xp}/{BATTLE_PASS_XP_PER_TIER} XP
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div className="h-full bg-fuchsia-400" style={{ width: `${bpPct}%` }} />
            </div>
          </button>

          {featuredEvent && (
            <button
              onClick={() => navClick('events')}
              className="p-3.5 rounded-xl bg-[#070b17]/95 border border-white/15 hover:border-amber-400/60 text-left space-y-1 transition-colors cursor-pointer"
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
              onClick={() => navClick('stats')}
              className="p-3.5 rounded-xl bg-[#070b17]/95 border border-white/15 hover:border-cyan-400 text-left space-y-1 transition-colors cursor-pointer"
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

      {/* Bottom Navigation Dock */}
      <div className="flex flex-col items-center gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 bg-[#070b17]/95 border border-white/15 rounded-xl px-3 py-2">
          {(
            [
              ['characters', t(lang, 'nav.characters'), User, 0],
              ['garage', t(lang, 'nav.garage'), Car, 0],
              ['districts', t(lang, 'nav.city'), MapIcon, 0],
              ['missions', t(lang, 'nav.missions'), Target, pending.missions],
              ['battlepass', t(lang, 'nav.battlepass'), Award, pending.battlePass],
              ['events', t(lang, 'nav.events'), Calendar, 0],
              ['shop', t(lang, 'nav.shop'), ShoppingBag, 0],
              ['inventory', t(lang, 'nav.inventory'), Backpack, 0],
              ['stats', t(lang, 'nav.stats'), BarChart3, 0],
              ['online', t(lang, 'nav.online'), Globe, 0],
              ['profile', 'Perfil de Usuario', UserCheck, 0],
            ] as [MenuTab, string, React.ComponentType<{ className?: string }>, number][]
          ).map(([tab, label, Icon, badgeCount]) => (
            <button
              key={tab}
              onClick={() => navClick(tab)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
          <button
            onClick={() => {
              audioEngine.playUiClick();
              onRequestExit();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-rose-200 bg-rose-500/15 border border-rose-400/40 hover:bg-rose-500/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Power className="w-3.5 h-3.5 text-rose-400" />
            <span>Salir del Juego</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-300 font-mono-num tracking-tight text-center bg-[#06080f]/92 px-4 py-1 rounded">
          WASD Mover · Espacio Doble Salto · S Deslizar · Shift Impulso · C Slow-Mo · E Gancho · F Habilidad · Esc Pausa / Salir
        </div>
      </div>
    </div>
  );
};
