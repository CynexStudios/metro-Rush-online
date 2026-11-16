import React from 'react';
import {
  AlertTriangle,
  Clock,
  CloudRain,
  Flame,
  GraduationCap,
  Magnet,
  Pause,
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
import { getVehicleById } from '../game/data';
import { HudSnapshot, PCSettings } from '../game/types';
import { getTimeLabel, t } from '../i18n';

interface GameHudProps {
  hud: HudSnapshot;
  settings: PCSettings;
  onToggleMute: () => void;
  onPause: () => void;
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

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  settings,
  onToggleMute,
  onPause,
}) => {
  const lang = settings.language;
  const activeVehicleName = getVehicleById(hud.selectedVehicleId).name;

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

        {/* Top-Center: Story Objective, Boss Bar, Dynamic Event, Time Trial, Stunt Callout */}
        <div
          className={`flex flex-col items-center gap-2 max-w-md text-center ${
            settings.hudScale === 'compact'
              ? 'scale-90 origin-top'
              : settings.hudScale === 'large'
                ? 'scale-105 origin-top'
                : ''
          }`}
        >
          {/* Interactive 6-Step Tutorial Progress Card */}
          {hud.mode === 'tutorial' && hud.tutorialStep && (
            <div className="bg-[#071828]/96 border-2 border-cyan-400/75 rounded-xl px-5 py-2.5 min-w-[310px] space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  TUTORIAL INTERACTIVO
                </span>
                {hud.tutorialProgress && (
                  <span className="font-mono-num text-emerald-300">
                    {hud.tutorialProgress}
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-white">
                {hud.tutorialStep}
              </div>
            </div>
          )}

          {/* Story Chapter Objective */}
          {hud.mode === 'story' && hud.storyObjectiveText && (
            <div className="bg-[#120b24]/94 border border-fuchsia-400/50 rounded-lg px-4 py-1.5 text-xs">
              <span className="font-bold text-fuchsia-300 mr-1.5">
                CAP. {hud.storyChapter ?? 1}:
              </span>
              <span className="text-white font-medium">{hud.storyObjectiveText}</span>
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

          {/* Boss Telegraphed Attack Warning Banner */}
          {hud.bossWarningText && (
            <div className="bg-[#2a0714]/96 border-2 border-rose-500 rounded-xl px-5 py-2 flex items-center gap-2 text-xs font-bold text-amber-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="tracking-wide uppercase">{hud.bossWarningText}</span>
            </div>
          )}

          {/* Active 3D 4-Phase Boss Health Bar */}
          {hud.bossId && hud.bossName && (
            <div className="bg-[#160813]/95 border border-rose-500/65 rounded-xl px-5 py-2.5 min-w-[330px] space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-rose-300 truncate">
                  <Swords className="w-3.5 h-3.5 shrink-0" />
                  {hud.randomBossActive ? 'EMBOSCADA: ' : `${t(lang, 'hud.boss')}: `}
                  {hud.bossName}
                </span>
                <span className="font-mono-num text-amber-300 whitespace-nowrap">
                  Fase {hud.bossPhase}/4 · {hud.bossPhaseHp}/{Math.max(1, hud.bossPhaseMaxHp)} EMP
                </span>
              </div>
              {hud.bossPhaseName && (
                <div className="text-[11px] font-semibold text-slate-200 tracking-wide">
                  {hud.bossPhaseName}
                </div>
              )}
              {/* 4-Phase Indicator */}
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((pNum) => {
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

          {hud.timeRemaining !== null && (
            <div className="bg-[#080b16]/94 border border-amber-400/45 rounded-lg px-5 py-2">
              <div className="text-[11px] text-amber-300 font-semibold tracking-wider">
                {t(lang, 'mode.timetrial')} · {hud.targetDistance}m
              </div>
              <div className="font-mono-num text-2xl font-bold text-white">
                {hud.timeRemaining.toFixed(1)}s
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

        {(hud.hasShield ||
          hud.shieldCooldown > 0 ||
          hud.hasMagnet ||
          hud.isRidingVehicle ||
          hud.vehicleAbilityLocked) && (
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
            {hud.isRidingVehicle && (
              <span className="flex items-center gap-1.5 text-amber-300 font-mono-num">
                <Flame className="w-3.5 h-3.5" /> {activeVehicleName}{' '}
                {hud.vehicleTimer.toFixed(1)}s
                {hud.vehicleIsShip ? ' (NAVE · 2x SALTO)' : ' (TERRESTRE)'}
              </span>
            )}
            {hud.vehicleAbilityLocked && (
              <span className="text-[11px] font-bold text-rose-300">
                IMPULSO / SLOW-MO BLOQUEADOS EN VEHÍCULO
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

          {/* Signature Ability */}
          <div className="w-32">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span className="flex items-center gap-1 font-semibold">
                <Zap className="w-3 h-3 text-fuchsia-400" /> {t(lang, 'hud.ability')}
              </span>
              <span className="font-mono-num">
                {hud.abilityActive
                  ? t(lang, 'hud.active')
                  : hud.abilityCharge >= 99
                    ? t(lang, 'hud.ready')
                    : `${hud.abilityCharge}%`}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.abilityCharge >= 99 ? 'bg-fuchsia-400' : 'bg-fuchsia-700'
                }`}
                style={{ width: `${hud.abilityCharge}%` }}
              />
            </div>
          </div>
        </div>

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
