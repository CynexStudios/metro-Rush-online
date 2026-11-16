import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Globe,
  Home,
  Keyboard,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { getBossById, getDistrictById } from '../game/data';
import { HudSnapshot, LanguageCode, RunSummary } from '../game/types';
import { getCityLabel, getModeLabel, t } from '../i18n';

interface PauseModalProps {
  language: LanguageCode;
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onQuitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  language,
  hud,
  muted,
  onToggleMute,
  onResume,
  onRestart,
  onOpenSettings,
  onQuitToTitle,
}) => {
  const modeLabel = getModeLabel(language, hud.mode).label;
  const activeObjective =
    hud.tutorialStep ||
    (hud.bossName ? `Enfrentamiento: ${hud.bossName} (Fase ${hud.bossPhase})` : null) ||
    hud.storyObjectiveText ||
    (hud.targetDistance
      ? `Meta de recorrido: ${hud.distance} / ${hud.targetDistance} m`
      : `Sobrevivir y acumular puntuación máxima`);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040712]/90 p-5 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0a0f1f] border border-cyan-500/35 rounded-xl p-6 space-y-5 my-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div>
            <div className="text-xs font-semibold tracking-wider text-cyan-400">
              {t(language, 'pause.title')} · {modeLabel}
            </div>
            <h2 className="font-display text-2xl font-bold text-white mt-0.5">
              {hud.districtName}
            </h2>
          </div>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onToggleMute();
            }}
            className="px-3 py-2 rounded-lg bg-[#0f172a] border border-white/15 hover:border-cyan-400 text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer"
          >
            {muted ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-400" />
                {t(language, 'common.muted')}
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-cyan-400" />
                {t(language, 'common.audioOn')}
              </>
            )}
          </button>
        </div>

        {/* Non-blocking Multiplayer Pause Notice */}
        {hud.isMultiplayer && (
          <div className="p-3 rounded-lg bg-[#101c33] border border-amber-400/50 flex items-start gap-2.5 text-xs text-amber-200">
            <Globe className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Pausa Individual en Multijugador</div>
              <div className="text-slate-300 mt-0.5">
                Tu corredor permanece detenido mientras el resto de jugadores y el reloj de carrera continúan activos en la sala.
              </div>
            </div>
          </div>
        )}

        {/* Live Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          {[
            ['Distancia', `${hud.distance} m`],
            ['Puntuación', hud.score.toLocaleString('es-ES')],
            ['Velocidad', `${hud.speedKmh} KM/H`],
            ['Combo', `x${hud.combo}`],
            ['Carriles / Piso', `${hud.laneCount}C · P${hud.parkourFloor}`],
            ['Etapa', `Nivel ${hud.difficultyStage}/4`],
          ].map(([lbl, val]) => (
            <div
              key={lbl}
              className="p-3 rounded-lg bg-[#0e1529] border border-white/10"
            >
              <div className="text-[11px] text-slate-400">{lbl}</div>
              <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* Active Objective */}
        <div className="p-3.5 rounded-lg bg-[#0e162c] border border-cyan-500/25 flex items-start gap-2.5 text-xs">
          <Target className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-cyan-300">Objetivo Activo</div>
            <div className="text-slate-200 mt-0.5">{activeObjective}</div>
            {hud.tutorialProgress && (
              <div className="font-mono-num text-emerald-300 mt-1">
                {hud.tutorialProgress}
              </div>
            )}
          </div>
        </div>

        {/* Quick Controls Reference */}
        <div className="p-3.5 rounded-lg bg-[#0b1122] border border-white/10 space-y-2">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            Controles Rápidos
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
            <div><span className="font-mono-num font-bold text-cyan-300">A / D</span> Carriles</div>
            <div><span className="font-mono-num font-bold text-cyan-300">Espacio / W</span> Doble Salto</div>
            <div><span className="font-mono-num font-bold text-cyan-300">S / Abajo</span> Deslizar / Caer</div>
            <div><span className="font-mono-num font-bold text-cyan-300">Shift</span> Impulso</div>
            <div><span className="font-mono-num font-bold text-cyan-300">C</span> Slow-Mo</div>
            <div><span className="font-mono-num font-bold text-cyan-300">E</span> Gancho / Vehículo</div>
            <div><span className="font-mono-num font-bold text-cyan-300">F</span> Habilidad</div>
            <div><span className="font-mono-num font-bold text-cyan-300">Esc</span> Pausa</div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={() => {
              audioEngine.playUiClick(true);
              onResume();
            }}
            className="sm:col-span-2 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> {t(language, 'pause.resume')}
          </button>

          {!hud.isMultiplayer && (
            <button
              onClick={() => {
                audioEngine.playUiClick();
                onRestart();
              }}
              className="py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> {t(language, 'pause.restart')}
            </button>
          )}

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onOpenSettings();
            }}
            className="py-2.5 rounded-lg bg-[#0f1930] hover:bg-[#172544] border border-cyan-400/30 text-cyan-200 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
            {t(language, 'pause.settings')}
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onQuitToTitle();
            }}
            className={`${hud.isMultiplayer ? 'sm:col-span-1' : 'sm:col-span-2'} py-2.5 rounded-lg border border-white/15 hover:border-rose-400/60 text-slate-300 hover:text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer`}
          >
            <Home className="w-4 h-4" /> {t(language, 'pause.quit')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ResultsModalProps {
  language: LanguageCode;
  summary: RunSummary;
  onlineStatus?: 'verified' | 'offline' | 'rejected';
  onReplay: () => void;
  onOpenGarage: () => void;
  onOpenMissions: () => void;
  onOpenStats: () => void;
  onOpenShop: () => void;
  onQuitToTitle: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  language,
  summary,
  onlineStatus,
  onReplay,
  onOpenGarage,
  onOpenMissions,
  onOpenStats,
  onOpenShop,
  onQuitToTitle,
}) => {
  const district = getDistrictById(summary.districtId);
  const cityLabel = getCityLabel(language, district.id);
  const defeatedBoss = summary.bossDefeatedId
    ? getBossById(summary.bossDefeatedId)
    : null;

  const [animProgress, setAnimProgress] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setAnimProgress(1);
      return;
    }
    setAnimProgress(0);
    const start = performance.now();
    const durationMs = 1150;
    let lastTickAt = 0;
    let rafId = 0;

    const step = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimProgress(eased);
      if (p < 1) {
        if (now - lastTickAt > 90) {
          lastTickAt = now;
          audioEngine.playStatTick();
        }
        rafId = window.requestAnimationFrame(step);
      } else {
        audioEngine.playStatTotal();
      }
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [summary]);

  const lerpVal = (target: number) => Math.round(target * animProgress);

  const isNewScoreRecord = summary.score > summary.previousBestScore;
  const isNewDistRecord = summary.distance > summary.previousBestDistance;
  const deltaVsLastScore = summary.previousLastRun
    ? summary.score - summary.previousLastRun.score
    : null;

  const borderTheme = summary.victory
    ? 'border-emerald-400/55'
    : 'border-rose-500/45';

  const animScore = lerpVal(summary.score);
  const animDist = lerpVal(summary.distance);
  const animCoins = lerpVal(summary.coins);
  const animGems = lerpVal(summary.gems);
  const animXp = lerpVal(summary.xpEarned);
  const animBpXp = lerpVal(summary.battlePassXpEarned);
  const animObstacles = lerpVal(summary.obstaclesDodged ?? 0);
  const animTrains = lerpVal(summary.trainsPassed ?? 0);
  const animShieldBreaks = lerpVal(summary.shieldBreaks ?? 0);
  const animDoubleJumps = lerpVal(summary.doubleJumps ?? 0);
  const animParkourChains = lerpVal(summary.parkourChains ?? 0);

  return (
    <div
      className={`fixed inset-0 z-30 flex p-5 overflow-y-auto ${
        summary.victory
          ? 'items-center justify-center bg-[#040712]/90'
          : 'items-center justify-end bg-transparent pointer-events-none'
      }`}
    >
      <div
        className={`w-full bg-[#0a0f1f]/96 border ${borderTheme} rounded-xl p-6 space-y-4 my-auto pointer-events-auto shadow-2xl ${
          summary.victory ? 'max-w-3xl' : 'max-w-[660px]'
        }`}
      >
        {/* Victory vs Defeat Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-xl border ${
                summary.victory
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
              }`}
            >
              {summary.victory ? (
                <Trophy className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>
            <div>
              <div
                className={`text-xs font-bold tracking-wider ${
                  summary.victory ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.victory
                  ? t(language, 'results.victory')
                  : t(language, 'results.defeat')}
              </div>
              <h2 className="font-display text-3xl font-bold text-white mt-0.5">
                {cityLabel.name}
              </h2>
              {!summary.victory && summary.defeatCause && (
                <div className="text-xs text-rose-200 mt-1 font-medium">
                  Causa de derrota: {summary.defeatCause}
                </div>
              )}
              {onlineStatus === 'verified' && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Récord validado en servidor SQLite
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">
              {t(language, 'results.finalScore')}
            </div>
            <div className="font-mono-num text-3xl font-bold text-cyan-300">
              {animScore.toLocaleString('es-ES')}
            </div>
            <div className="flex items-center justify-end gap-2 mt-1 text-[11px] font-mono-num">
              {isNewScoreRecord && (
                <span className="text-amber-300 font-bold">Nuevo Récord</span>
              )}
              {deltaVsLastScore !== null && (
                <span
                  className={`flex items-center gap-0.5 font-bold ${
                    deltaVsLastScore >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  {deltaVsLastScore >= 0 ? '+' : ''}
                  {deltaVsLastScore.toLocaleString('es-ES')} vs anterior
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Boss Banner */}
        {(defeatedBoss || summary.bossName) && (
          <div className="p-3.5 rounded-lg bg-fuchsia-950/35 border border-fuchsia-400/45 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-fuchsia-200">
              <Swords className="w-4 h-4 text-fuchsia-400" />
              {defeatedBoss
                ? `Jefe Derrotado: ${defeatedBoss.name} (4/4 Fases)`
                : `Combate vs ${summary.bossName} · Fase alcanzada ${summary.bossPhaseReached || 1}/4 (${summary.bossPhasesCleared || 0} superadas)`}
            </div>
            {defeatedBoss && (
              <span className="font-mono-num text-amber-300 font-bold">
                +{defeatedBoss.rewardCoins} M · +{defeatedBoss.rewardGems} G
              </span>
            )}
          </div>
        )}

        {/* Primary Metrics Grid (Sequential Animated) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            [
              t(language, 'results.distance'),
              `${animDist} m${isNewDistRecord ? ' ★' : ''}`,
            ],
            [t(language, 'results.maxSpeed'), `${summary.maxSpeedKmh} KM/H`],
            [t(language, 'results.maxCombo'), `x${summary.maxCombo}`],
            [t(language, 'results.duration'), `${summary.durationSec}s`],
            [t(language, 'common.coins'), `+${animCoins} M`],
            [t(language, 'common.gems'), `+${animGems} G`],
            ['XP / Pase Batalla', `+${animXp} / +${animBpXp}`],
            [
              'Enemigos / Revivir',
              `${summary.enemiesEliminated} / ${summary.revivesUsed}`,
            ],
          ].map(([label, val]) => (
            <div
              key={label}
              className="p-2.5 rounded-lg bg-[#0e1529] border border-white/10"
            >
              <div className="text-[11px] text-slate-400">{label}</div>
              <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* 3.0.1 Detailed Action Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
          {[
            ['Obstáculos', animObstacles],
            ['Trenes', animTrains],
            ['Rupt. Escudo', animShieldBreaks],
            ['Dobles Saltos', animDoubleJumps],
            ['Cadenas P2', animParkourChains],
          ].map(([lbl, v]) => (
            <div
              key={String(lbl)}
              className="px-2.5 py-2 rounded-lg bg-[#0c1224] border border-white/10 flex items-center justify-between font-mono-num"
            >
              <span className="text-slate-400">{lbl}</span>
              <span className="font-bold text-cyan-300">{v}</span>
            </div>
          ))}
        </div>

        {/* Highlights */}
        {summary.highlights.length > 0 && (
          <div className="p-3.5 rounded-lg bg-[#0d1428] border border-cyan-500/20">
            <div className="text-[11px] font-semibold text-cyan-300 mb-1.5 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" /> {t(language, 'results.highlights')}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
              {summary.highlights.map((h, i) => (
                <span key={`${h}-${i}`}>· {h}</span>
              ))}
            </div>
          </div>
        )}

        {/* Unlocks / Level / Battle Pass / Claimable Missions */}
        {(summary.leveledUp ||
          summary.bpLeveledUp ||
          summary.completedEventTitle ||
          summary.newlyClaimableMissions.length > 0 ||
          summary.newlyUnlockedAchievements.length > 0) && (
          <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/35 space-y-1.5 text-xs">
            {summary.completedEventTitle && (
              <div className="flex items-center gap-2 font-bold text-fuchsia-300">
                <Trophy className="w-4 h-4" /> Evento Completado:{' '}
                {summary.completedEventTitle}
              </div>
            )}
            {summary.leveledUp && (
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <Sparkles className="w-4 h-4" /> Subida de Nivel: Nivel{' '}
                {summary.newLevel} (+5 G, +200 M)
              </div>
            )}
            {summary.bpLeveledUp && (
              <div className="flex items-center gap-2 font-bold text-fuchsia-300">
                <Award className="w-4 h-4" /> Pase de Batalla: Nivel{' '}
                {summary.newBpLevel} alcanzado
              </div>
            )}
            {summary.newlyClaimableMissions.map((m) => (
              <div key={m} className="flex items-center gap-2 text-cyan-300 font-semibold">
                <Target className="w-3.5 h-3.5" /> Misión lista para reclamar: {m}
              </div>
            ))}
            {summary.newlyUnlockedAchievements.map((a) => (
              <div key={a} className="flex items-center gap-2 text-amber-300">
                <Sparkles className="w-3.5 h-3.5" /> Logro Desbloqueado: {a}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                audioEngine.playUiClick();
                onOpenMissions();
              }}
              className="px-3 py-2 rounded-lg bg-[#0f1930] hover:bg-[#172544] border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-cyan-400" /> Misiones
            </button>
            <button
              onClick={() => {
                audioEngine.playUiClick();
                onOpenStats();
              }}
              className="px-3 py-2 rounded-lg bg-[#0f1930] hover:bg-[#172544] border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Estadísticas
            </button>
            <button
              onClick={() => {
                audioEngine.playUiClick();
                onOpenShop();
              }}
              className="px-3 py-2 rounded-lg bg-[#0f1930] hover:bg-[#172544] border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" /> Tienda
            </button>
            <button
              onClick={() => {
                audioEngine.playUiClick();
                onOpenGarage();
              }}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
            >
              {t(language, 'results.garage')}
            </button>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={() => {
                audioEngine.playUiClick();
                onQuitToTitle();
              }}
              className="px-4 py-2.5 rounded-lg border border-white/15 hover:border-white/35 text-slate-200 text-sm font-semibold cursor-pointer"
            >
              {t(language, 'results.menu')}
            </button>
            <button
              onClick={() => {
                audioEngine.playUiClick(true);
                onReplay();
              }}
              className="px-6 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> {t(language, 'results.replay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
