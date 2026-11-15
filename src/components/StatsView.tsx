import React, { useState } from 'react';
import { BarChart3, Cpu, History, Trophy } from 'lucide-react';
import { DRONE_CODEX, getDistrictById } from '../game/data';
import { getPerformanceProfiles, SYSTEM_REQUIREMENTS } from '../game/hardware';
import { xpRequiredForLevel } from '../game/storage';
import {
  EnemyClass,
  HardwareDiagnostics,
  HudSnapshot,
  PlayerSaveData,
} from '../game/types';

interface StatsViewProps {
  save: PlayerSaveData;
  diagnostics: HardwareDiagnostics;
  liveHud: HudSnapshot;
}

export const StatsView: React.FC<StatsViewProps> = ({
  save,
  diagnostics,
  liveHud,
}) => {
  const [sub, setSub] = useState<'overview' | 'history' | 'codex' | 'benchmarks'>(
    'overview',
  );

  const benchRows = getPerformanceProfiles(
    diagnostics,
    liveHud.fps,
    liveHud.frameTimeMs,
  );

  const winRate =
    save.stats.totalRuns > 0
      ? Math.round((save.stats.wins / save.stats.totalRuns) * 100)
      : 0;

  const recent10 = [...save.matchHistory].slice(0, 10).reverse();
  const maxRecentScore = Math.max(
    1,
    ...recent10.map((r) => r.score),
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
            Telemetría y Rendimiento del Corredor
          </div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Estadísticas, Historial y Benchmarks
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-[#0b1224] p-1 rounded-lg border border-white/10">
          {(
            [
              ['overview', 'Resumen Global'],
              ['history', `Historial (${save.matchHistory.length})`],
              ['codex', 'Códice (10 Enemigos)'],
              ['benchmarks', 'Requisitos y PC'],
            ] as ['overview' | 'history' | 'codex' | 'benchmarks', string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                sub === id ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW + SVG TREND CHART */}
      {sub === 'overview' && (
        <div className="space-y-5">
          {/* Level + Battle Pass Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300">
                  Nivel de Corredor {save.level}
                </span>
                <span className="font-mono-num text-white">
                  {save.xp} / {xpRequiredForLevel(save.level)} XP
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-cyan-400"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((save.xp / xpRequiredForLevel(save.level)) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0b1224] border border-fuchsia-500/30 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-fuchsia-300">
                  Pase de Batalla Temporada {save.battlePass.season}
                </div>
                <div className="text-slate-300 mt-0.5">
                  Nivel {save.battlePass.level}/20 ·{' '}
                  {save.battlePass.premiumUnlocked ? 'Premium' : 'Estándar'}
                </div>
              </div>
              <div className="text-right font-mono-num">
                <div className="text-emerald-300 font-bold">
                  {save.stats.wins}V / {save.stats.losses}D
                </div>
                <div className="text-slate-400">Winrate {winRate}%</div>
              </div>
            </div>
          </div>

          {/* 16 Core KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ['Partidas Jugadas', save.stats.totalRuns],
                ['Victorias / Derrotas', `${save.stats.wins} / ${save.stats.losses}`],
                ['Mejor Puntuación', save.stats.bestScore.toLocaleString('es-ES')],
                ['Mejor Distancia', `${save.stats.bestDistance.toLocaleString('es-ES')} m`],
                ['Distancia Total', `${save.stats.totalDistance.toLocaleString('es-ES')} m`],
                ['Mayor Supervivencia', `${save.stats.bestSurvivalTimeSec}s`],
                [
                  'Tiempo Total Jugado',
                  `${Math.floor(save.stats.totalTimeSeconds / 60)}m ${save.stats.totalTimeSeconds % 60}s`,
                ],
                ['Velocidad Punta', `${save.stats.maxSpeedKmh} KM/H`],
                ['Combo Máximo', `x${save.stats.maxCombo}`],
                ['Monedas Obtenidas', save.stats.totalCoinsCollected.toLocaleString('es-ES')],
                ['Monedas Gastadas', save.stats.coinsSpent.toLocaleString('es-ES')],
                ['Enemigos Eliminados', save.stats.enemiesEliminated],
                ['Revivires Usados', save.stats.revivesUsed],
                ['Misiones Completadas', save.stats.missionsCompleted],
                ['Desafíos Completados', save.stats.challengesCompleted],
                ['Jefes Derrotados', `${save.defeatedBosses.length}/5 (${save.stats.bossesDefeated})`],
                ['Carreras Multijugador', `${save.stats.mpMatchesPlayed ?? 0} (${save.stats.mpWins ?? 0}V)`],
                [
                  'Mejor Puesto Online',
                  save.stats.mpBestPlacement > 0 ? `#${save.stats.mpBestPlacement}` : '-',
                ],
              ] as [string, string | number][]
            ).map(([lbl, val]) => (
              <div
                key={lbl}
                className="p-3 rounded-xl bg-[#0b1224] border border-white/10"
              >
                <div className="text-[11px] text-slate-400">{lbl}</div>
                <div className="font-mono-num text-base font-bold text-white mt-0.5">
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Interactive SVG Score Trend */}
          {recent10.length > 0 && (
            <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  Tendencia de Puntuación (Últimas {recent10.length} Carreras)
                </span>
                <span className="font-mono-num text-cyan-300">
                  Máx reciente: {maxRecentScore.toLocaleString('es-ES')} pts
                </span>
              </div>
              <svg viewBox="0 0 600 110" className="w-full h-28 overflow-visible">
                {recent10.map((r, i) => {
                  const bw = 44;
                  const gap = (600 - bw * recent10.length) / Math.max(1, recent10.length);
                  const x = i * (bw + gap) + gap * 0.5;
                  const h = Math.max(8, (r.score / maxRecentScore) * 86);
                  const y = 92 - h;
                  return (
                    <g key={r.id}>
                      <rect
                        x={x}
                        y={y}
                        width={bw}
                        height={h}
                        rx={4}
                        fill={r.victory ? '#34d399' : '#22d3ee'}
                        opacity={0.85}
                      />
                      <text
                        x={x + bw / 2}
                        y={107}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {r.distance}m
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {save.bestRun && (
            <div className="p-4 rounded-xl bg-[#0b1224] border border-amber-400/35 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Trophy className="w-4 h-4" /> Mejor Carrera Histórica ({save.bestRun.date})
              </div>
              <div className="text-xs text-slate-200 font-mono-num">
                {save.bestRun.score.toLocaleString('es-ES')} pts ·{' '}
                {save.bestRun.distance}m · {save.bestRun.maxSpeedKmh} KM/H · Combo x
                {save.bestRun.maxCombo} · {getDistrictById(save.bestRun.districtId).name}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MATCH HISTORY TABLE */}
      {sub === 'history' && (
        <div className="rounded-xl bg-[#0b1224] border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-[#070b17] border-b border-white/10 flex items-center justify-between text-xs font-bold text-white">
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" /> Últimas 30 Partidas
            </span>
          </div>
          {save.matchHistory.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Completa tu primera carrera para ver el historial detallado aquí.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Resultado</th>
                    <th className="py-2.5 px-3">Modo / Distrito</th>
                    <th className="py-2.5 px-3">Puntuación</th>
                    <th className="py-2.5 px-3">Distancia</th>
                    <th className="py-2.5 px-3">Duración</th>
                    <th className="py-2.5 px-3">Monedas</th>
                    <th className="py-2.5 px-3">Revivires</th>
                    <th className="py-2.5 px-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono-num">
                  {save.matchHistory.map((m) => (
                    <tr key={m.id} className="hover:bg-white/5">
                      <td
                        className={`py-2 px-3 font-sans font-bold ${
                          m.victory ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {m.victory ? 'Victoria' : 'Derrota'}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-200">
                        {getDistrictById(m.districtId).name} · {m.mode}
                      </td>
                      <td className="py-2 px-3 text-cyan-300 font-bold">
                        {m.score.toLocaleString('es-ES')}
                      </td>
                      <td className="py-2 px-3 text-white">{m.distance}m</td>
                      <td className="py-2 px-3 text-slate-300">{m.durationSec}s</td>
                      <td className="py-2 px-3 text-amber-300">+{m.coinsEarned}</td>
                      <td className="py-2 px-3 text-slate-300">{m.revivesUsed}</td>
                      <td className="py-2 px-3 text-slate-400">{m.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 10-ENEMY CODEX */}
      {sub === 'codex' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(DRONE_CODEX) as EnemyClass[]).map((ec) => {
            const entry = DRONE_CODEX[ec];
            return (
              <div
                key={ec}
                className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm text-white flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.name}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-300">
                    Peligro: {entry.danger}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{entry.role}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* HARDWARE & BENCHMARKS */}
      {sub === 'benchmarks' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2 text-xs">
              <div className="font-display font-bold text-sm text-cyan-300">
                Requisitos Mínimos (PC)
              </div>
              {Object.entries(SYSTEM_REQUIREMENTS.minimum).map(([k, v]) => (
                <div key={k} className="text-slate-300">
                  <span className="text-slate-400 uppercase font-semibold">
                    {k}:
                  </span>{' '}
                  {v}
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl bg-[#0b1224] border border-emerald-400/35 space-y-2 text-xs">
              <div className="font-display font-bold text-sm text-emerald-300">
                Requisitos Recomendados (PC)
              </div>
              {Object.entries(SYSTEM_REQUIREMENTS.recommended).map(([k, v]) => (
                <div key={k} className="text-slate-300">
                  <span className="text-slate-400 uppercase font-semibold">
                    {k}:
                  </span>{' '}
                  {v}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#0b1224] border border-white/10 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#070b17] border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" /> Benchmarks de
                Rendimiento (Medido vs Estimado)
              </span>
              <span className="text-[11px] font-mono-num text-cyan-300">
                {liveHud.fps} FPS actuales
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="py-2 px-3">Perfil</th>
                    <th className="py-2 px-3">Resolución</th>
                    <th className="py-2 px-3">Calidad</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Rendimiento</th>
                    <th className="py-2 px-3">Notas de Hardware</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {benchRows.map((row) => (
                    <tr key={row.profile}>
                      <td className="py-2 px-3 font-semibold text-white">
                        {row.profile}
                      </td>
                      <td className="py-2 px-3 font-mono-num text-slate-300">
                        {row.resolution}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{row.quality}</td>
                      <td
                        className={`py-2 px-3 font-bold ${
                          row.measuredOrEstimated === 'Medido'
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {row.measuredOrEstimated}
                      </td>
                      <td className="py-2 px-3 font-mono-num font-bold text-cyan-300">
                        {row.targetFps}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
