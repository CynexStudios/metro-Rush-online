import React from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudRain,
  Flame,
  GraduationCap,
  Magnet,
  MessageSquare,
  Pause,
  Play,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { getVehicleById, TUTORIAL_TOPICS } from '../game/data';
import { HudSnapshot, PCSettings } from '../game/types';
import { getTimeLabel, t } from '../i18n';

interface GameHudProps {
  hud: HudSnapshot;
  settings: PCSettings;
  onToggleMute: () => void;
  onPause: () => void;
  onTutorialPrev?: () => void;
  onTutorialNext?: () => void;
  onTutorialTogglePause?: () => void;
  onTutorialFinish?: () => void;
}

function formatKeyHint(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'Space') return 'Espacio';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  return code;
}

const DYNAMIC_EVENT_LABELS: Record<string, string> = {
  power_outage: 'APAGÓN PARCIAL',
  drone_pursuit: 'ESCUADRÓN DE DRONES',
  express_train: 'TRENES EXPRESO',
  construction: 'OBRAS EN EL CARRIL',
  sky_bridge: 'PUENTES AÉREOS',
  storm_surge: 'TORMENTA ELÉCTRICA',
  coin_surge: 'LLUVIA DE MONEDAS x2',
  pursuer_frenzy: 'PERSECUCIÓN ENFRURECIDA',
  talisman_signal: 'SEÑAL DE TALISMÁN CERCANA',
};

const TELEGRAPH_STAGE_META: Record<
  string,
  { label: string; cls: string }
> = {
  charging: { label: 'CARGANDO ATAQUE', cls: 'bg-amber-500/20 border-amber-400 text-amber-200' },
  locked: { label: 'CARRIL FIJADO', cls: 'bg-rose-500/25 border-rose-400 text-rose-200' },
  strike: { label: 'IMPACTO ACTIVO', cls: 'bg-rose-600/35 border-rose-300 text-white' },
  recover: { label: 'VENTANA DE CONTRAATAQUE', cls: 'bg-cyan-500/20 border-cyan-400 text-cyan-200' },
};

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  settings,
  onToggleMute,
  onPause,
  onTutorialPrev,
  onTutorialNext,
  onTutorialTogglePause,
  onTutorialFinish,
}) => {
  const lang = settings.language;
  const activeVehicleName = getVehicleById(hud.selectedVehicleId).name;
  const jumpKeyHint = formatKeyHint(settings.keybindings.jump || 'Space');
  const abilityKeyHint = formatKeyHint(settings.keybindings.ability || 'KeyF');
  const slowMoKeyHint = formatKeyHint(settings.keybindings.slowMo || 'KeyQ');
  const vehicleKeyHint = formatKeyHint(settings.keybindings.activateVehicle || 'KeyV');
  const droneKeyHint = formatKeyHint(settings.keybindings.callDrone || 'KeyG');
  const activeTutTopic =
    TUTORIAL_TOPICS[hud.tutorialTopicIndex] ?? TUTORIAL_TOPICS[0];

  const scaleClass =
    settings.hudScale === 'compact'
      ? 'scale-90 origin-center'
      : settings.hudScale === 'large'
        ? 'scale-105'
        : '';

  const cardSurface = settings.highContrast
    ? 'bg-black border-2 border-white'
    : 'bg-[#080b16]/92 border border-cyan-500/25';

  const cardSubSurface = settings.highContrast
    ? 'bg-black border-2 border-white'
    : 'bg-[#080b16]/92 border border-white/15';

  const dangerThreat = hud.pursuerThreat >= 0.6;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 ${
        settings.highContrast ? 'text-white' : ''
      }`}
    >
      {/* Subtle Slow-Mo edge frame */}
      {hud.isSlowMo && !settings.reduceVisualEffects && (
        <div className="pointer-events-none fixed inset-0 border-4 border-cyan-400/55 transition-opacity duration-150" />
      )}

      {/* TOP PERIMETER CLUSTER */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Score, Distance, Coins, Talismans/Revives, District + Perf */}
        <div
          className={`flex flex-col gap-2 ${
            settings.hudScale === 'compact'
              ? 'scale-90 origin-top-left'
              : settings.hudScale === 'large'
                ? 'scale-105 origin-top-left'
                : ''
          }`}
        >
          <div className={`${cardSurface} rounded-lg px-4 py-3 min-w-[275px]`}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-semibold tracking-wider text-cyan-400">
                {t(lang, 'hud.score')}
              </span>
              <span className="font-mono-num text-2xl font-bold text-white">
                {hud.score.toLocaleString('es-ES')}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-300 font-mono-num">
              <span>{hud.distance} m</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400">{hud.coinsRun} M</span>
              <span className="text-slate-600">·</span>
              <span className="text-fuchsia-400">{hud.gemsRun} G</span>
              {hud.dronesEvadedRun > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400">
                    {hud.dronesEvadedRun} Elim.
                  </span>
                </>
              )}
            </div>

            {/* Held Consumables Row (Talismans & Revive Tokens) */}
            <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] font-mono-num">
              <span className="flex items-center gap-1 text-amber-200">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Talismán: {hud.talismansHeld}
                {hud.talismanUsedRun ? ' (Usado)' : ''}
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <ShieldAlert className="w-3 h-3" />
                Revivir: {hud.reviveTokensHeld}
              </span>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-200 truncate max-w-[135px]">
                {hud.districtName}
              </span>
              <span className="font-mono-num whitespace-nowrap">
                {hud.laneCount}C · Etapa {hud.difficultyStage}/4 · {getTimeLabel(lang, hud.timePeriod)} · {hud.gravityScale.toFixed(2)}G · {hud.fps} FPS
              </span>
            </div>

            {(hud.laneCount === 5 || hud.parkourFloor === 2 || hud.parkourChain > 0) && (
              <div className="mt-1.5 pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-[10px] font-mono-num font-bold">
                {hud.laneCount === 5 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200">
                    AUTOPISTA 5 CARRILES
                  </span>
                )}
                {hud.parkourFloor === 2 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-200">
                    PISO 2 · ALTURA
                  </span>
                )}
                {hud.parkourChain > 0 && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200">
                    CADENA PARKOUR x{hud.parkourChain}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Pursuer Threat Proximity Bar */}
          {hud.pursuerDistance !== null && hud.mode !== 'freerun' && (
            <div
              className={`rounded-lg px-3.5 py-2 border max-w-[275px] ${
                dangerThreat
                  ? 'bg-[#260912]/94 border-rose-500/75'
                  : 'bg-[#080b16]/92 border-white/15'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className={dangerThreat ? 'text-rose-300' : 'text-slate-300'}>
                  PERSEGUIDOR ENFORCER
                </span>
                <span className="font-mono-num text-white">
                  {hud.pursuerDistance}m
                </span>
              </div>
              <div className="mt-1 h-1.5 bg-slate-800 rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    dangerThreat ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.round(hud.pursuerThreat * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Live PC Telemetry Overlay */}
          {settings.showPerfOverlay && (
            <div className="bg-[#060913]/94 border border-emerald-400/35 rounded-lg px-3.5 py-2 text-[11px] font-mono-num text-slate-200 space-y-1 max-w-[275px]">
              <div className="flex justify-between">
                <span className="text-emerald-300 font-bold">PC TELEMETRÍA</span>
                <span>
                  {hud.fps} FPS ({hud.frameTimeMs.toFixed(1)} ms)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Draw Calls: {hud.drawCalls}</span>
                <span>Tris: {hud.triangles.toLocaleString('es-ES')}</span>
              </div>
              {hud.memoryMb !== null && (
                <div className="text-slate-400">Heap JS: {hud.memoryMb} MB</div>
              )}
              {hud.perfWarning && (
                <div className="text-amber-300 font-semibold pt-0.5">
                  {hud.perfWarning}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Center: Story Dialogue, Boss Bar, Dynamic Event, Time Trial */}
        <div
          className={`flex flex-col items-center gap-2 max-w-md text-center ${
            settings.hudScale === 'compact'
              ? 'scale-90 origin-top'
              : settings.hudScale === 'large'
                ? 'scale-105 origin-top'
                : ''
          }`}
        >

          {/* Story Chapter Objective & Narrative Comms */}
          {hud.mode === 'story' && hud.storyObjectiveText && (
            <div className="bg-[#120b24]/94 border border-fuchsia-400/50 rounded-lg px-4 py-1.5 text-xs">
              <span className="font-bold text-fuchsia-300 mr-1.5">
                CAP. {hud.storyChapter ?? 1}:
              </span>
              <span className="text-white font-medium">{hud.storyObjectiveText}</span>
            </div>
          )}

          {hud.storyDialogueText && (
            <div className="bg-[#0e1026]/95 border border-fuchsia-400/65 rounded-xl px-4 py-2 max-w-md text-left shadow-xl">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-fuchsia-300">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{hud.storyDialogueSpeaker || 'COMMS'}</span>
              </div>
              <div className="text-xs text-slate-100 mt-0.5 leading-snug">
                {hud.storyDialogueText}
              </div>
            </div>
          )}

          {/* Elden-Ring Style 4-Phase Boss Intro Banner */}
          {hud.bossIntroActive && hud.bossName && (
            <div className="bg-[#14050c]/96 border-2 border-amber-400/80 rounded-xl px-7 py-3.5 min-w-[340px] space-y-1 shadow-2xl">
              <div className="text-[11px] font-bold tracking-[0.22em] text-amber-300 uppercase">
                {hud.bossIntroTitle || 'SEÑOR DEL SECTOR'}
              </div>
              <div className="font-display text-2xl font-bold tracking-wide text-white">
                {hud.bossName}
              </div>
              {hud.bossIntroSubtitle && (
                <div className="text-xs italic text-rose-200">
                  “{hud.bossIntroSubtitle}”
                </div>
              )}
            </div>
          )}

          {/* Phase Transition Callout */}
          {hud.bossTransitionActive && hud.bossPhaseName && (
            <div className="bg-[#240611]/96 border-2 border-amber-400 rounded-xl px-6 py-2 text-xs font-bold tracking-widest text-amber-200 uppercase">
              CAMBIO DE FASE · {hud.bossPhaseName}
            </div>
          )}

          {/* Boss Telegraphed Attack Warning Banner + Radar Countdown */}
          {(hud.bossWarningText || hud.bossRadarWarningLanes.length > 0) && (
            <div className="bg-[#2a0714]/96 border-2 border-rose-500 rounded-xl px-5 py-2 flex items-center gap-2 text-xs font-bold text-amber-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="tracking-wide uppercase">
                {hud.bossWarningText || '¡ALERTA DE RADAR EN PISTA!'}
              </span>
              {hud.bossRadarWarningLanes.length > 0 && (
                <span className="font-mono-num px-2 py-0.5 rounded bg-rose-500/30 border border-rose-300/60 text-white">
                  C{hud.bossRadarWarningLanes.map((l) => l + 1).join(',C')} · {hud.bossRadarCountdownSec.toFixed(1)}s
                </span>
              )}
            </div>
          )}

          {/* Active 3D Variable-Phase Boss Health Bar */}
          {hud.bossId && hud.bossName && (
            <div className="bg-[#160813]/95 border border-rose-500/65 rounded-xl px-5 py-2.5 min-w-[335px] space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-rose-300 truncate">
                  <Swords className="w-3.5 h-3.5 shrink-0" />
                  {hud.randomBossActive ? 'EMBOSCADA: ' : `${t(lang, 'hud.boss')}: `}
                  {hud.bossName}
                </span>
                <span className="font-mono-num text-amber-300 whitespace-nowrap">
                  Fase {hud.bossPhase}/{Math.max(1, hud.bossTotalPhases)} · {hud.bossPhaseHp}/{Math.max(1, hud.bossPhaseMaxHp)} EMP
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-slate-200 tracking-wide truncate">
                  {hud.bossPhaseName || ''}
                </span>
                {hud.bossSupportDronesCount > 0 && (
                  <span className="font-mono-num text-amber-300 font-bold shrink-0">
                    {t(lang, 'hud.supportDrones')}: {hud.bossSupportDronesCount}
                  </span>
                )}
              </div>
              {hud.bossHasShieldGate && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono-num font-bold">
                    <span className={hud.bossShieldHp > 0 ? 'text-cyan-300' : 'text-emerald-300'}>
                      {hud.bossShieldHp > 0
                        ? `ESCUDO OMEGA ACTIVO (${hud.bossShieldHp}/${hud.bossShieldMaxHp})`
                        : `VENTANA VULNERABLE · ${hud.bossVulnerableSec.toFixed(1)}s`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        hud.bossShieldHp > 0 ? 'bg-cyan-400' : 'bg-emerald-400'
                      }`}
                      style={{
                        width: `${
                          hud.bossShieldHp > 0
                            ? Math.round((hud.bossShieldHp / Math.max(1, hud.bossShieldMaxHp)) * 100)
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {hud.bossTelegraphStage && TELEGRAPH_STAGE_META[hud.bossTelegraphStage] && (
                <div
                  className={`px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider uppercase ${TELEGRAPH_STAGE_META[hud.bossTelegraphStage].cls}`}
                >
                  {TELEGRAPH_STAGE_META[hud.bossTelegraphStage].label}
                </div>
              )}
              {/* Dynamic Phase Indicator */}
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, hud.bossTotalPhases)}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: Math.max(1, hud.bossTotalPhases) }).map((_, idx) => {
                  const pNum = idx + 1;
                  const active = pNum === hud.bossPhase;
                  const cleared = pNum < hud.bossPhase;
                  return (
                    <div
                      key={pNum}
                      className={`h-1 rounded ${
                        cleared
                          ? 'bg-emerald-400'
                          : active
                            ? 'bg-amber-400'
                            : 'bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>
              {/* Current Phase EMP HP Segments */}
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, hud.bossPhaseMaxHp || hud.bossMaxHp)}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({
                  length: Math.max(1, hud.bossPhaseMaxHp || hud.bossMaxHp),
                }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded ${
                      i < (hud.bossPhaseMaxHp ? hud.bossPhaseHp : hud.bossHp)
                        ? 'bg-rose-500'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[11px] text-cyan-300 font-medium">
                {t(lang, 'hud.empPrompt')}
              </div>
            </div>
          )}

          {/* Sector Transition & Objective Celebration Banners */}
          {hud.sectorTransitionLabel && (
            <div className="bg-[#091529]/95 border border-cyan-400/65 rounded-lg px-5 py-1.5 text-xs font-bold tracking-wider text-cyan-200 uppercase">
              SECTOR: {hud.sectorTransitionLabel}
            </div>
          )}

          {hud.objectiveCelebrationText && (
            <div className="bg-[#1b1405]/96 border-2 border-amber-400 rounded-xl px-5 py-2 text-xs font-bold tracking-wide text-amber-200 uppercase">
              ★ {hud.objectiveCelebrationText}
            </div>
          )}

          {/* Rare Coin & Gem Rain Event Banner */}
          {hud.rainEventActive && (
            <div className="bg-[#1d1404]/95 border-2 border-amber-400/80 rounded-lg px-4 py-1.5 flex items-center gap-2 text-xs font-bold text-amber-300">
              <CloudRain className="w-4 h-4 text-amber-300" />
              LLUVIA DE MONEDAS Y GEMAS
            </div>
          )}

          {hud.activeEventBanner && (
            <div className="bg-[#090d1c]/95 border border-fuchsia-400/50 rounded-lg px-4 py-1 text-[11px] font-semibold tracking-wider text-fuchsia-300">
              {hud.activeEventBanner}
            </div>
          )}

          {hud.activeDynamicEvent && (
            <div className="bg-[#1a0b1e]/95 border border-amber-400/55 rounded-lg px-4 py-1.5 flex items-center gap-2 text-xs font-bold text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              {DYNAMIC_EVENT_LABELS[hud.activeDynamicEvent] ?? hud.activeDynamicEvent}
            </div>
          )}

          {/* Time Trial Survival Clock + Orbs + PB + Next Milestone (§5) */}
          {hud.timeRemaining !== null && (
            <div
              className={`bg-[#080b16]/95 border rounded-xl px-5 py-2 min-w-[240px] ${
                hud.timeRemaining <= 8
                  ? 'border-rose-500/80'
                  : 'border-amber-400/55'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] text-amber-300 font-semibold tracking-wider">
                <span>
                  {t(lang, 'mode.timetrial')} · {t(lang, 'hud.timeTrialSurvival')}
                </span>
                <span className="text-slate-300 font-mono-num">
                  {t(lang, 'hud.timeTrialOrbs')}
                </span>
              </div>
              <div className="flex items-baseline justify-center gap-2 mt-0.5">
                <span
                  className={`font-mono-num text-2xl font-bold ${
                    hud.timeRemaining <= 8 ? 'text-rose-300' : 'text-white'
                  }`}
                >
                  {hud.timeRemaining.toFixed(1)}s
                </span>
                {hud.timeTrialBonusGain > 0 && (
                  <span
                    key={hud.timeTrialGainNonce}
                    className="font-mono-num text-sm font-bold text-emerald-300 animate-bounce"
                  >
                    +{hud.timeTrialBonusGain.toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] font-mono-num text-slate-300">
                <span>PB: {hud.timeTrialPersonalBestSec}s</span>
                <span className="text-cyan-300">
                  Meta: {hud.timeTrialMilestoneNextSec}s
                </span>
              </div>
            </div>
          )}

          {hud.targetDistance !== null && hud.timeRemaining === null && (
            <div className="bg-[#080b16]/92 border border-white/15 rounded-lg px-4 py-1.5 text-xs text-slate-200 font-mono-num">
              {t(lang, 'hud.goal')}: {hud.distance} / {hud.targetDistance} m
            </div>
          )}

          {hud.activeBanner && (
            <div className="bg-[#090d1c]/95 border border-cyan-400/55 rounded-lg px-6 py-2">
              <div className="font-display text-lg font-bold tracking-wide text-cyan-300">
                {hud.activeBanner}
              </div>
            </div>
          )}

          {hud.lastStuntText && (
            <div className="font-display text-xl font-bold text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              {hud.lastStuntText}
            </div>
          )}
        </div>

        {/* Top-Right: Speedometer, Combo, Quick Controls & Live Multiplayer Standings */}
        <div
          className={`flex flex-col items-end gap-2 ${
            settings.hudScale === 'compact'
              ? 'scale-90 origin-top-right'
              : settings.hudScale === 'large'
                ? 'scale-105 origin-top-right'
                : ''
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className={`${cardSubSurface} rounded-lg px-4 py-3 text-right min-w-[180px]`}>
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="font-mono-num text-2xl font-bold text-white">
                  {hud.speedKmh}
                </span>
                <span className="text-xs font-semibold text-cyan-400">KM/H</span>
              </div>

              <div className="mt-1 flex items-center justify-end gap-2">
                <span className="text-xs text-slate-400">{t(lang, 'hud.combo')}</span>
                <span className="font-display text-lg font-bold text-fuchsia-400 font-mono-num">
                  x{hud.combo}
                </span>
              </div>
              <div className="mt-1 h-1 w-full bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-fuchsia-400 transition-all duration-100"
                  style={{ width: `${hud.comboTimer * 100}%` }}
                />
              </div>
            </div>

            <div className="pointer-events-auto flex flex-col gap-2">
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  onPause();
                }}
                title="Pausa"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#080b16]/92 border border-white/15 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  onToggleMute();
                }}
                title={settings.muted ? t(lang, 'common.audioOn') : t(lang, 'common.muted')}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#080b16]/92 border border-white/15 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {settings.muted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Live Multiplayer Standings Panel */}
          {hud.isMultiplayer && hud.mpPlayers.length > 0 && (
            <div className="bg-[#080b16]/94 border border-cyan-500/35 rounded-lg px-3.5 py-2.5 min-w-[235px] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300 border-b border-white/10 pb-1">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> CARRERA EN VIVO
                </span>
                <span className="font-mono-num text-slate-300">
                  {hud.mpPlayers.length} JUG.
                </span>
              </div>
              <div className="space-y-1">
                {[...hud.mpPlayers]
                  .sort((a, b) => b.distance - a.distance || b.score - a.score)
                  .map((p, idx) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between gap-2 text-[11px] font-mono-num"
                    >
                      <span className="truncate max-w-[115px] text-slate-100 font-semibold">
                        #{idx + 1} {p.username}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {p.paused && (
                          <span className="text-amber-300 font-bold">PAUSA</span>
                        )}
                        {p.finished && (
                          <span className="text-emerald-300 font-bold">META</span>
                        )}
                        <span className="text-cyan-300">{Math.floor(p.distance)}m</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM PERIMETER CLUSTER */}
      <div
        className={`flex flex-col items-center gap-2 ${scaleClass} ${
          settings.hudScale === 'compact'
            ? 'origin-bottom'
            : settings.hudScale === 'large'
              ? 'origin-bottom'
              : ''
        }`}
      >
        {settings.showTutorialHints && hud.tutorialHint && (
          <div className="bg-[#091224]/95 border border-cyan-400/50 rounded-lg px-4 py-1.5 text-xs font-medium text-cyan-200">
            {hud.tutorialHint}
          </div>
        )}

        {settings.showIndicators && hud.contextPrompt && (
          <div className="bg-[#090d1c]/95 border border-amber-400/60 rounded-lg px-4 py-1.5 text-sm font-semibold text-amber-300">
            {hud.contextPrompt}
          </div>
        )}

        {hud.gamepadToastText && (
          <div
            key={hud.gamepadToastNonce}
            className={`rounded-lg px-4 py-1 text-xs font-bold border ${
              hud.gamepadToastType === 'connected'
                ? 'bg-[#082419]/95 border-emerald-400/70 text-emerald-200'
                : 'bg-[#281014]/95 border-rose-400/70 text-rose-200'
            }`}
          >
            {hud.gamepadToastText}
          </div>
        )}

        {hud.abilityToastText && (
          <div
            key={hud.abilityToastNonce}
            className="bg-[#1b0b29]/95 border border-fuchsia-400/70 rounded-lg px-4 py-1 text-xs font-bold text-fuchsia-200"
          >
            {hud.abilityToastText}
          </div>
        )}

        {(hud.hasShield ||
          hud.shieldCooldown > 0 ||
          hud.hasMagnet ||
          hud.isRidingVehicle ||
          hud.vehicleAbilityLocked ||
          hud.companionDroneId ||
          hud.abilityRestrictedReason) && (
          <div className="flex flex-wrap items-center justify-center gap-4 bg-[#080b16]/94 border border-white/15 rounded-lg px-4 py-1.5 text-xs font-medium">
            {hud.hasShield ? (
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Shield className="w-3.5 h-3.5" /> {t(lang, 'hud.shield')} Activo
              </span>
            ) : hud.shieldCooldown > 0 ? (
              <span className="flex items-center gap-1.5 text-amber-300 font-mono-num">
                <ShieldAlert className="w-3.5 h-3.5" /> Escudo CD {hud.shieldCooldown.toFixed(1)}s
              </span>
            ) : null}
            {hud.hasMagnet && (
              <span className="flex items-center gap-1.5 text-rose-300 font-mono-num">
                <Magnet className="w-3.5 h-3.5" /> {t(lang, 'hud.magnet')}{' '}
                {hud.magnetTimer.toFixed(1)}s
              </span>
            )}
            {hud.companionDroneId && (
              <span
                className={`flex items-center gap-1.5 font-mono-num ${
                  hud.companionDroneActive
                    ? 'text-emerald-300 font-bold'
                    : hud.companionDroneCooldown > 0
                      ? 'text-slate-400'
                      : 'text-cyan-300 font-bold'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />{' '}
                {hud.companionDroneActive
                  ? `${hud.companionDroneName} ${hud.companionDroneTimeLeft.toFixed(1)}s`
                  : hud.companionDroneCooldown > 0
                    ? `Dron CD ${hud.companionDroneCooldown.toFixed(1)}s`
                    : `[${droneKeyHint}] ${hud.companionDroneName}`}
              </span>
            )}
            {hud.isRidingVehicle && (
              <span className="flex items-center gap-1.5 text-amber-300 font-mono-num">
                <Flame className="w-3.5 h-3.5" /> {activeVehicleName}{' '}
                {hud.vehicleTimer.toFixed(1)}s
                {hud.vehicleIsShip
                  ? ` (NAVE · ALT ${hud.vehicleFlightHeight.toFixed(1)}m)`
                  : ' (TERRESTRE)'}
              </span>
            )}
            {hud.vehicleAbilityLocked && (
              <span className="text-[11px] font-bold text-rose-300">
                IMPULSO / SLOW-MO BLOQUEADOS EN VEHÍCULO
              </span>
            )}
            {hud.abilityRestrictedReason && hud.mode === 'parkour' && (
              <span className="text-[11px] font-bold text-amber-300">
                {hud.abilityRestrictedReason}
              </span>
            )}
          </div>
        )}

        {/* Bottom Gauges */}
        <div className={`${cardSubSurface} rounded-lg px-5 py-2.5 flex flex-wrap items-center justify-center gap-5`}>
          {/* Boost / Momentum */}
          <div className="w-32">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span className="flex items-center gap-1 font-semibold">
                <Flame className="w-3 h-3 text-amber-400" />{' '}
                {hud.vehicleAbilityLocked ? 'Impulso (Bloq.)' : t(lang, 'hud.momentum')}
              </span>
              <span className="font-mono-num">
                {hud.vehicleAbilityLocked
                  ? 'BLOQ'
                  : hud.boostActive
                    ? 'ACTIVO'
                    : hud.boostCooldown > 0
                      ? `${hud.boostCooldown.toFixed(1)}s`
                      : `${hud.momentum}%`}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.vehicleAbilityLocked
                    ? 'bg-slate-600'
                    : hud.boostActive
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                }`}
                style={{ width: `${hud.vehicleAbilityLocked ? 0 : hud.momentum}%` }}
              />
            </div>
          </div>

          {/* Slow-Mo */}
          <div className="w-32">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span className="flex items-center gap-1 font-semibold">
                <Clock className="w-3 h-3 text-cyan-400" /> {t(lang, 'hud.slowmo')}
              </span>
              <span className="font-mono-num">
                {hud.vehicleAbilityLocked ? 'BLOQ' : `${hud.slowMoEnergy}%`}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.vehicleAbilityLocked ? 'bg-slate-600' : 'bg-cyan-400'
                }`}
                style={{ width: `${hud.vehicleAbilityLocked ? 0 : hud.slowMoEnergy}%` }}
              />
            </div>
          </div>

          {/* Double Jump Charges */}
          <div className="w-36">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span className="font-semibold">Doble Salto</span>
              <span className="font-mono-num">
                {hud.doubleJumpBlockedReason
                  ? 'BLOQ'
                  : hud.doubleJumpCooldown > 0
                    ? `${hud.doubleJumpCooldown.toFixed(1)}s`
                    : `${hud.doubleJumpCharges}/${hud.maxDoubleJumpCharges}`}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.doubleJumpBlockedReason
                    ? 'bg-rose-500/50'
                    : hud.doubleJumpCooldown > 0
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{
                  width: `${
                    hud.doubleJumpBlockedReason
                      ? 100
                      : Math.round(
                          (hud.doubleJumpCharges /
                            Math.max(1, hud.maxDoubleJumpCharges)) *
                            100,
                        )
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Shield Cooldown */}
          <div className="w-32">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span className="flex items-center gap-1 font-semibold">
                <Shield className="w-3 h-3 text-cyan-300" /> Escudo
              </span>
              <span className="font-mono-num">
                {hud.hasShield
                  ? 'ACTIVO'
                  : hud.shieldCooldown > 0
                    ? `${hud.shieldCooldown.toFixed(1)}s`
                    : 'LISTO'}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.hasShield ? 'bg-cyan-300' : 'bg-sky-500'
                }`}
                style={{
                  width: `${
                    hud.hasShield
                      ? 100
                      : Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              (1 -
                                hud.shieldCooldown /
                                  Math.max(1, hud.shieldMaxCooldown)) *
                                100,
                            ),
                          ),
                        )
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Vehicle Battery Energy Gauge (§14.1) */}
          <div className="w-36">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span className="flex items-center gap-1 font-semibold truncate">
                <Flame className="w-3 h-3 text-cyan-300 shrink-0" /> Vehículo
              </span>
              <span
                className={`font-mono-num font-bold ${
                  hud.isRidingVehicle
                    ? 'text-amber-300'
                    : hud.vehicleReady
                      ? 'text-emerald-300'
                      : 'text-slate-300'
                }`}
              >
                {hud.isRidingVehicle
                  ? `${hud.vehicleTimer.toFixed(0)}s`
                  : hud.vehicleReady
                    ? `[${vehicleKeyHint}] LISTO`
                    : `${Math.round(hud.vehicleEnergy)}/${Math.max(1, hud.vehicleMaxEnergy)}`}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.isRidingVehicle
                    ? 'bg-amber-400'
                    : hud.vehicleReady
                      ? 'bg-emerald-400'
                      : 'bg-cyan-500'
                }`}
                style={{
                  width: `${
                    hud.isRidingVehicle
                      ? 100
                      : Math.min(
                          100,
                          Math.round(
                            (hud.vehicleEnergy / Math.max(1, hud.vehicleMaxEnergy)) *
                              100,
                          ),
                        )
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Signature Ability bar removed from bottom HUD; abilities notify dynamically via toast */}
        </div>

        {/* Dynamic Corner Tutorial HUD (Top-Left/Side, non-blocking) */}
        {hud.mode === 'tutorial' && !hud.tutorialEndlessMode && (
          <div className="pointer-events-auto fixed left-4 bottom-24 z-30 bg-[#071828]/92 backdrop-blur-md border border-cyan-400/70 rounded-xl px-3.5 py-2.5 w-[290px] space-y-1.5 shadow-2xl animate-[fadeIn_0.25s_ease-out]">
            <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-cyan-300">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {t(lang, 'tut.panelTitle')}
              </span>
              <span className="font-mono-num text-emerald-300">
                {hud.tutorialTopicIndex + 1}/{hud.tutorialTotalTopics}{' '}
                {hud.tutorialProgress ? `(${hud.tutorialProgress})` : ''}
              </span>
            </div>
            <div className="text-xs font-display font-bold text-white">
              {t(lang, activeTutTopic.titleKey)}
            </div>
            <div className="text-[11px] text-slate-200 leading-snug">
              {t(lang, activeTutTopic.descKey)}
            </div>
            <div className="text-[11px] text-amber-300 font-semibold">
              {hud.tutorialStep || t(lang, activeTutTopic.practiceHintKey)}
            </div>
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
              <button
                type="button"
                disabled={hud.tutorialTopicIndex <= 0}
                onClick={() => {
                  audioEngine.playUiClick();
                  onTutorialPrev?.();
                }}
                className="px-2 py-1 rounded bg-[#0c233a] hover:bg-[#123352] disabled:opacity-40 text-[10px] font-semibold text-slate-200 flex items-center gap-0.5 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" /> {t(lang, 'tut.prev')}
              </button>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick();
                  onTutorialTogglePause?.();
                }}
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                  hud.tutorialPaused
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-amber-400/20 border border-amber-400/50 text-amber-200'
                }`}
              >
                {hud.tutorialPaused ? (
                  <>
                    <Play className="w-3 h-3 fill-current" /> {t(lang, 'tut.resume')}
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" /> {t(lang, 'tut.pause')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(true);
                  onTutorialNext?.();
                }}
                className="px-2 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              >
                {hud.tutorialTopicIndex + 1 >= hud.tutorialTotalTopics
                  ? 'Práctica'
                  : t(lang, 'tut.next')}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {hud.mode === 'tutorial' && hud.tutorialEndlessMode && (
          <div className="pointer-events-auto fixed left-4 bottom-24 z-30 bg-[#071e1a]/95 border border-emerald-400/70 rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs shadow-xl">
            <span className="font-bold text-emerald-300">PRÁCTICA FÁCIL</span>
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick(true);
                onTutorialFinish?.();
              }}
              className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-[11px] cursor-pointer"
            >
              {t(lang, 'tut.finish')}
            </button>
          </div>
        )}

        {/* On-Screen Controls Hint Bar (Adapts to Keyboard vs Xbox / PlayStation / Nintendo) */}
        {settings.showOnScreenControls !== false && (
          <div className="flex flex-wrap items-center justify-center gap-2 bg-black/75 border border-white/15 rounded-lg px-3 py-1 text-[10px] text-slate-200 font-mono-num">
            {hud.gamepadBrand === 'xbox' ? (
              <>
                <span className="text-emerald-300 font-bold">[XBOX]</span>
                <span>[A] Saltar</span>
                <span>[B] Deslizar</span>
                <span>[X] Habilidad</span>
                <span>[Y] Vehículo</span>
                <span>[RB] Dron</span>
                <span>[LB] Slow-Mo</span>
              </>
            ) : hud.gamepadBrand === 'playstation' ? (
              <>
                <span className="text-sky-300 font-bold">[PLAYSTATION]</span>
                <span>[✕] Saltar</span>
                <span>[○] Deslizar</span>
                <span>[□] Habilidad</span>
                <span>[△] Vehículo</span>
                <span>[R1] Dron</span>
                <span>[L1] Slow-Mo</span>
              </>
            ) : hud.gamepadBrand === 'nintendo' ? (
              <>
                <span className="text-rose-300 font-bold">[NINTENDO]</span>
                <span>[B] Saltar</span>
                <span>[A] Deslizar</span>
                <span>[Y] Habilidad</span>
                <span>[X] Vehículo</span>
                <span>[R] Dron</span>
                <span>[L] Slow-Mo</span>
              </>
            ) : (
              <>
                <span className="text-cyan-300 font-bold">[TECLADO]</span>
                <span>[A/D] Carril</span>
                <span>[{jumpKeyHint}] Saltar</span>
                <span>[S/↓] Deslizar</span>
                <span>[{abilityKeyHint}] Habilidad</span>
                <span>[{vehicleKeyHint}] Vehículo</span>
                <span>[G] Dron</span>
                <span>[{slowMoKeyHint}] Slow-Mo</span>
              </>
            )}
          </div>
        )}

        {/* Accessibility Subtitles / Closed Captions */}
        {settings.subtitles && hud.subtitleText && (
          <div
            className={`bg-black/92 border border-white/20 rounded px-4 py-1 text-slate-100 font-medium ${
              settings.subtitleScale === 'large' ? 'text-sm' : 'text-xs'
            }`}
          >
            [RADIO] {hud.subtitleText}
          </div>
        )}
      </div>
    </div>
  );
};
