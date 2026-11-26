import React, { useState } from 'react';
import { BarChart3, Cpu, History, Trophy } from 'lucide-react';
import { BATTLE_PASS_TIERS, DRONE_CODEX, getDistrictById } from '../game/data';
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

type StatsPeriod = '7d' | '30d' | '90d' | 'all';

const MODE_LABELS: Record<string, string> = {
  endless: 'Sin Fin',
  story: 'Historia',
  timetrial: 'Contrarreloj',
  parkour: 'Parkour',
  bosschase: 'Jefes',
  freerun: 'Libre',
  tutorial: 'Tutorial',
};

export const StatsView: React.FC<StatsViewProps> = ({
  save,
  diagnostics,
  liveHud,
}) => {
  const [sub, setSub] = useState<'overview' | 'history' | 'codex' | 'benchmarks'>(
    'overview',
  );
  const [period, setPeriod] = useState<StatsPeriod>('all');

  const benchRows = getPerformanceProfiles(
    diagnostics,
    liveHud.fps,
    liveHud.frameTimeMs,
  );

  const nowMs = Date.now();
  const windowDays =
    period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null;

  const filteredRuns = save.matchHistory.filter((r) => {
    if (windowDays === null) return true;
    if (typeof r.timestampMs !== 'number') return false;
    return nowMs - r.timestampMs <= windowDays * 86_400_000;
  });

  const hasLegacyWithoutTimestamp =
    period !== 'all' &&
    filteredRuns.length === 0 &&
    save.matchHistory.length > 0;

  const winsCount =
    period === 'all'
      ? save.stats.wins
      : filteredRuns.filter((r) => r.victory).length;
  const lossesCount =
    period === 'all'
      ? save.stats.losses
      : filteredRuns.filter((r) => !r.victory).length;
  const totalRunsCount =
    period === 'all' ? save.stats.totalRuns : filteredRuns.length;

  const winRate =
    totalRunsCount > 0 ? Math.round((winsCount / totalRunsCount) * 100) : 0;

  const periodBestScore =
    period === 'all'
      ? save.stats.bestScore
      : filteredRuns.reduce((m, r) => Math.max(m, r.score), 0);
  const periodBestDistance =
    period === 'all'
      ? save.stats.bestDistance
      : filteredRuns.reduce((m, r) => Math.max(m, r.distance), 0);
  const periodTotalDistance =
    period === 'all'
      ? save.stats.totalDistance
      : filteredRuns.reduce((sum, r) => sum + r.distance, 0);
  const periodTotalSeconds =
    period === 'all'
      ? save.stats.totalTimeSeconds
      : filteredRuns.reduce((sum, r) => sum + r.durationSec, 0);
  const periodCoinsEarned =
    period === 'all'
      ? save.stats.totalCoinsCollected
      : filteredRuns.reduce((sum, r) => sum + r.coinsEarned, 0);

  const chartRuns = [...filteredRuns].slice(0, 14).reverse();
  const maxChartScore = Math.max(1, ...chartRuns.map((r) => r.score));
  const maxChartCoins = Math.max(1, ...chartRuns.map((r) => r.coinsEarned));

  // Mode distribution for bar chart
  const modeBuckets = Array.from(
    filteredRuns.reduce((map, r) => {
      const prev = map.get(r.mode) || { count: 0, wins: 0 };
      map.set(r.mode, {
        count: prev.count + 1,
        wins: prev.wins + (r.victory ? 1 : 0),
      });
      return map;
    }, new Map<string, { count: number; wins: number }>()),
  );
  const maxModeCount = Math.max(
    1,
    winsCount,
    lossesCount,
    ...modeBuckets.map(([, v]) => v.count),
  );

  const chartW = 580;
  const chartH = 148;
  const padL = 38;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const scorePoints = chartRuns
    .map((r, i) => {
      const x =
        chartRuns.length === 1
          ? padL + plotW / 2
          : padL + (i / (chartRuns.length - 1)) * plotW;
      const y = padT + plotH - (r.score / maxChartScore) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const coinsPoints = chartRuns
    .map((r, i) => {
      const x =
        chartRuns.length === 1
          ? padL + plotW / 2
          : padL + (i / (chartRuns.length - 1)) * plotW;
      const y = padT + plotH - (r.coinsEarned / maxChartCoins) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-xs font-semibold text-cyan-400">
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
              ['overview', 'Resumen y Gráficas'],
              ['history', `Historial (${filteredRuns.length})`],
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

      {/* Period Filter Strip (for overview & history) */}
      {(sub === 'overview' || sub === 'history') && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300 font-mono-num">
            Mostrando{' '}
            <strong className="text-white">{filteredRuns.length}</strong> partida(s) en
            ventana seleccionada
          </div>
          <div className="flex flex-wrap gap-1 bg-[#0b1224] p-1 rounded-lg border border-white/10">
            {(
              [
                ['7d', '7 días'],
                ['30d', '30 días'],
                ['90d', '90 días'],
                ['all', 'Todo el historial'],
              ] as [StatsPeriod, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={`px-3 py-1 rounded text-xs font-bold cursor-pointer whitespace-nowrap ${
                  period === id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* OVERVIEW + DUAL SVG CHARTS */}
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
                  Pase de Corredor · Temporada {save.battlePass.season}
                </div>
                <div className="text-slate-300 mt-0.5">
                  Nivel {save.battlePass.level}/{BATTLE_PASS_TIERS.length} ·{' '}
                  {save.battlePass.premiumUnlocked ? 'Premium' : 'Estándar'}
                </div>
              </div>
              <div className="text-right font-mono-num">
                <div className="text-emerald-300 font-bold">
                  {winsCount}V / {lossesCount}D
                </div>
                <div className="text-slate-400">Winrate {winRate}%</div>
              </div>
            </div>
          </div>

          {/* Core KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ['Partidas Jugadas', totalRunsCount],
                ['Victorias / Derrotas', `${winsCount} / ${lossesCount}`],
                ['Mejor Puntuación', periodBestScore.toLocaleString('es-ES')],
                ['Mejor Distancia', `${periodBestDistance.toLocaleString('es-ES')} m`],
                ['Distancia Acumulada', `${periodTotalDistance.toLocaleString('es-ES')} m`],
                ['Mayor Supervivencia', `${save.stats.bestSurvivalTimeSec}s`],
                [
                  'Tiempo Jugado',
                  `${Math.floor(periodTotalSeconds / 60)}m ${periodTotalSeconds % 60}s`,
                ],
                ['Velocidad Punta', `${save.stats.maxSpeedKmh} KM/H`],
                ['Combo Máximo', `x${save.stats.maxCombo}`],
                ['Monedas Obtenidas', periodCoinsEarned.toLocaleString('es-ES')],
                ['Monedas Gastadas', save.stats.coinsSpent.toLocaleString('es-ES')],
                ['Enemigos Eliminados', save.stats.enemiesEliminated],
                ['Revivires Usados', save.stats.revivesUsed],
                ['Misiones Completadas', save.stats.missionsCompleted],
                ['Desafíos Completados', save.stats.challengesCompleted],
                ['Jefes Derrotados', `${save.defeatedBosses.length}/8 (${save.stats.bossesDefeated})`],
                ['Carreras Multijugador', `${save.stats.mpMatchesPlayed ?? 0} (${save.stats.mpWins ?? 0}V)`],
                [
                  'Mejor Puesto Online',
                  save.stats.mpBestPlacement > 0 ? `#${save.stats.mpBestPlacement}` : '-',
                ],
                ['Rupturas de Escudo', save.stats.shieldBreaks ?? 0],
                ['Dobles Saltos', save.stats.doubleJumps ?? 0],
                ['Cadenas Parkour P2', save.stats.parkourChains ?? 0],
                ['Fases de Jefe', save.stats.bossPhasesCleared ?? 0],
                ['Dist. 5 Carriles', `${(save.stats.fiveLaneDistance ?? 0).toLocaleString('es-ES')} m`],
                ['Obstáculos Esquivados', (save.stats.obstaclesDodged ?? 0).toLocaleString('es-ES')],
                ['Trenes Superados', (save.stats.trainsPassed ?? 0).toLocaleString('es-ES')],
                ['Victorias sin Revivir', save.stats.noReviveWins ?? 0],
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

          {/* Honest Empty State vs Dual Charts */}
          {chartRuns.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#0b1224] border border-dashed border-white/15 text-center space-y-1.5">
              <div className="font-display font-bold text-sm text-white">
                {hasLegacyWithoutTimestamp
                  ? 'Sin partidas recientes con fecha exacta en este período'
                  : 'Aún no hay partidas registradas para graficar'}
              </div>
              <p className="text-xs text-slate-400 max-w-xl mx-auto">
                {hasLegacyWithoutTimestamp
                  ? 'Las carreras guardadas en versiones anteriores no tenían marca temporal exacta. Selecciona "Todo el historial" o juega una carrera nueva para ver su gráfica aquí.'
                  : 'Completa una carrera en cualquier modo para desbloquear tu gráfica de trayectoria y comparativa de victorias.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. SVG LINE CHART: Puntuación & Monedas */}
              <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white">
                    Trayectoria de Puntuación y Monedas
                  </span>
                  <div className="flex items-center gap-3 font-mono-num text-[11px]">
                    <span className="text-cyan-300">● Puntos (máx {maxChartScore.toLocaleString('es-ES')})</span>
                    <span className="text-amber-300">● Monedas (máx {maxChartCoins})</span>
                  </div>
                </div>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-40">
                  {[0.25, 0.5, 0.75, 1].map((frac) => {
                    const gy = padT + plotH * (1 - frac);
                    return (
                      <g key={frac}>
                        <line
                          x1={padL}
                          y1={gy}
                          x2={chartW - padR}
                          y2={gy}
                          stroke="#1e293b"
                          strokeWidth="1"
                        />
                        <text
                          x={padL - 5}
                          y={gy + 3}
                          textAnchor="end"
                          fill="#64748b"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {Math.round(maxChartScore * frac)}
                        </text>
                      </g>
                    );
                  })}
                  <line
                    x1={padL}
                    y1={padT + plotH}
                    x2={chartW - padR}
                    y2={padT + plotH}
                    stroke="#334155"
                    strokeWidth="1"
                  />
                  {chartRuns.length > 1 && (
                    <>
                      <polyline
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={scorePoints}
                      />
                      <polyline
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={coinsPoints}
                      />
                    </>
                  )}
                  {chartRuns.map((r, i) => {
                    const x =
                      chartRuns.length === 1
                        ? padL + plotW / 2
                        : padL + (i / (chartRuns.length - 1)) * plotW;
                    const yS = padT + plotH - (r.score / maxChartScore) * plotH;
                    const yC = padT + plotH - (r.coinsEarned / maxChartCoins) * plotH;
                    return (
                      <g key={r.id}>
                        <circle
                          cx={x}
                          cy={yS}
                          r={3.5}
                          fill={r.victory ? '#34d399' : '#22d3ee'}
                        >
                          <title>{`${r.date} · ${r.score} pts · ${r.distance}m`}</title>
                        </circle>
                        <circle cx={x} cy={yC} r={2.5} fill="#f59e0b">
                          <title>{`+${r.coinsEarned} monedas`}</title>
                        </circle>
                        {(chartRuns.length <= 8 || i % 2 === 0 || i === chartRuns.length - 1) && (
                          <text
                            x={x}
                            y={chartH - 7}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {r.distance}m
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 2. SVG BAR CHART: Victorias vs Derrotas + Modos */}
              <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    Balance Victorias/Derrotas y Modos Jugados
                  </span>
                  <span className="font-mono-num text-[11px] text-emerald-300">
                    Winrate {winRate}%
                  </span>
                </div>
                {(() => {
                  const bars: { label: string; value: number; color: string }[] = [
                    { label: 'Victorias', value: winsCount, color: '#34d399' },
                    { label: 'Derrotas', value: lossesCount, color: '#fb7185' },
                    ...modeBuckets.slice(0, 4).map(([m, v]) => ({
                      label: MODE_LABELS[m] || m,
                      value: v.count,
                      color: '#22d3ee',
                    })),
                  ];
                  const barSlotW = plotW / Math.max(1, bars.length);
                  const barW = Math.min(44, barSlotW * 0.56);
                  return (
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-40">
                      <line
                        x1={padL}
                        y1={padT + plotH}
                        x2={chartW - padR}
                        y2={padT + plotH}
                        stroke="#334155"
                        strokeWidth="1"
                      />
                      {bars.map((b, idx) => {
                        const bh = Math.max(4, (b.value / maxModeCount) * (plotH - 14));
                        const bx = padL + idx * barSlotW + (barSlotW - barW) / 2;
                        const by = padT + plotH - bh;
                        return (
                          <g key={b.label}>
                            <rect
                              x={bx}
                              y={by}
                              width={barW}
                              height={bh}
                              rx={4}
                              fill={b.color}
                              opacity={0.9}
                            />
                            <text
                              x={bx + barW / 2}
                              y={by - 4}
                              textAnchor="middle"
                              fill="#e2e8f0"
                              fontSize="10"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              {b.value}
                            </text>
                            <text
                              x={bx + barW / 2}
                              y={chartH - 7}
                              textAnchor="middle"
                              fill="#94a3b8"
                              fontSize="9.5"
                              fontFamily="Plus Jakarta Sans, sans-serif"
                            >
                              {b.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
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
