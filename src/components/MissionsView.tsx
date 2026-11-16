import React, { useEffect, useState } from 'react';
import { Award, Check, Clock, Gift, Target } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { ACHIEVEMENTS, getDistrictById, MISSIONS } from '../game/data';
import {
  claimAllMissions,
  claimMissionReward,
  getPendingRewardCount,
} from '../game/economy';
import { MissionCategory, PlayerSaveData } from '../game/types';

interface MissionsViewProps {
  save: PlayerSaveData;
  onUpdateSave: (next: PlayerSaveData) => void;
}

const CATEGORY_TABS: { id: MissionCategory | 'achievements'; label: string }[] = [
  { id: 'daily', label: 'Diarias' },
  { id: 'weekly', label: 'Semanales' },
  { id: 'story', label: 'Historia' },
  { id: 'combat', label: 'Combate' },
  { id: 'exploration', label: 'Exploración' },
  { id: 'survival', label: 'Supervivencia' },
  { id: 'character', label: 'Corredores' },
  { id: 'vehicle', label: 'Vehículos' },
  { id: 'boss', label: 'Jefes' },
  { id: 'special', label: 'Especiales' },
  { id: 'season', label: 'Temporada' },
  { id: 'achievements', label: 'Logros' },
];

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

export const MissionsView: React.FC<MissionsViewProps> = ({
  save,
  onUpdateSave,
}) => {
  const [activeTab, setActiveTab] = useState<MissionCategory | 'achievements'>(
    'daily',
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const pendingMissions = getPendingRewardCount(save).missions;

  const filteredMissions =
    activeTab === 'achievements'
      ? []
      : MISSIONS.filter((m) => m.category === activeTab);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
            Centro de Operaciones · Cap. {save.storyChapter}/5
          </div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Misiones y Logros ({save.completedMissions.length}/{MISSIONS.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-[#0b1224] border border-white/15 rounded-lg px-3 py-1.5 text-[11px] font-mono-num text-slate-300">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" /> Diarias:{' '}
              {formatCountdown(save.dailyResetAt, nowMs)}
            </span>
            <span className="text-slate-600">·</span>
            <span>Semanales: {formatCountdown(save.weeklyResetAt, nowMs)}</span>
          </div>

          {pendingMissions > 0 && (
            <button
              onClick={() => {
                const res = claimAllMissions(save);
                if (res.ok) {
                  audioEngine.playClaimReward();
                  onUpdateSave(res.nextSave);
                }
              }}
              className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Gift className="w-4 h-4" /> Reclamar Todo ({pendingMissions})
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs with Pending Counters */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_TABS.map((tItem) => {
          const active = activeTab === tItem.id;
          const catPending =
            tItem.id === 'achievements'
              ? 0
              : MISSIONS.filter(
                  (m) =>
                    m.category === tItem.id &&
                    !save.completedMissions.includes(m.id) &&
                    (save.claimableMissions.includes(m.id) ||
                      (save.missionProgress[m.id] ?? 0) >= m.target),
                ).length;

          return (
            <button
              key={tItem.id}
              onClick={() => {
                audioEngine.playUiClick();
                setActiveTab(tItem.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                  : 'bg-[#0b1224] text-slate-300 border-white/10 hover:text-white'
              }`}
            >
              <span>{tItem.label}</span>
              {catPending > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 font-mono-num text-[10px] font-bold">
                  {catPending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'achievements' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = save.unlockedAchievements.includes(a.id);
            return (
              <div
                key={a.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                  unlocked
                    ? 'bg-amber-950/20 border-amber-400/45'
                    : 'bg-[#0b1224] border-white/10'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-display font-bold text-sm text-white flex items-center gap-2">
                    <Award
                      className={`w-4 h-4 ${
                        unlocked ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    />
                    {a.title}
                  </div>
                  <p className="text-xs text-slate-300">{a.description}</p>
                  <div className="text-[11px] text-slate-400">
                    Requisito: {a.conditionText}
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-fuchsia-300 shrink-0">
                  {unlocked ? 'Desbloqueado' : `+${a.rewardGems} G`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredMissions.map((m) => {
            const prog = Math.min(m.target, save.missionProgress[m.id] ?? 0);
            const claimed = save.completedMissions.includes(m.id);
            const ready =
              !claimed &&
              (save.claimableMissions.includes(m.id) || prog >= m.target);
            const pct = Math.min(100, Math.round((prog / m.target) * 100));

            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  claimed
                    ? 'bg-emerald-950/20 border-emerald-500/35'
                    : ready
                      ? 'bg-[#0d1c2e] border-emerald-400/70'
                      : 'bg-[#0b1224] border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold text-cyan-300 uppercase">
                      {m.difficulty ?? 'Media'}
                      {m.districtReq
                        ? ` · ${getDistrictById(m.districtReq).name}`
                        : ''}
                    </div>
                    <div className="font-display font-bold text-base text-white">
                      {m.title}
                    </div>
                  </div>

                  {claimed ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 shrink-0">
                      <Check className="w-4 h-4" /> Reclamada
                    </span>
                  ) : ready ? (
                    <button
                      onClick={() => {
                        const res = claimMissionReward(save, m.id);
                        if (res.ok) {
                          audioEngine.playClaimReward();
                          onUpdateSave(res.nextSave);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold cursor-pointer shrink-0"
                    >
                      Reclamar Recompensa
                    </button>
                  ) : null}
                </div>

                <p className="text-xs text-slate-300">{m.description}</p>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap justify-between gap-2 text-[11px] font-mono-num">
                    <span className="text-slate-300">
                      {prog.toLocaleString('es-ES')} /{' '}
                      {m.target.toLocaleString('es-ES')} ({pct}%)
                    </span>
                    <span className="text-amber-300 font-bold">
                      +{m.rewardCoins} M · +{m.rewardGems} G · +{m.rewardXp} XP
                      {m.rewardTickets ? ` · +${m.rewardTickets} Tiques` : ''}
                      {m.rewardReviveTokens
                        ? ` · +${m.rewardReviveTokens} Revivir`
                        : ''}
                      {m.rewardTalismans ? ` · +${m.rewardTalismans} Talismán` : ''}
                      {m.rewardBpXp ? ` · +${m.rewardBpXp} BP` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        claimed || ready ? 'bg-emerald-400' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
