import React, { useEffect, useState } from 'react';
import { Award, Check, Crown, Gem, Gift, Lock, Sparkles, Target, X } from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BATTLE_PASS_PREMIUM_COST_GEMS,
  BATTLE_PASS_TIERS,
  getBattlePassXpForTier,
} from '../game/data';
import {
  claimAllBattlePassRewards,
  claimBattlePassReward,
  getPendingRewardCount,
  unlockPremiumBattlePass,
} from '../game/economy';
import { PlayerSaveData } from '../game/types';
import { MissionsView } from './MissionsView';
import { ModelPreview3D } from './ModelPreview3D';

interface BattlePassViewProps {
  save: PlayerSaveData;
  initialSubTab?: 'pass' | 'missions';
  onUpdateSave: (next: PlayerSaveData) => void;
}

export const BattlePassView: React.FC<BattlePassViewProps> = ({
  save,
  initialSubTab = 'pass',
  onUpdateSave,
}) => {
  const [subTab, setSubTab] = useState<'pass' | 'missions'>(initialSubTab);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const bp = save.battlePass;
  const pending = getPendingRewardCount(save);
  const maxTiers = BATTLE_PASS_TIERS.length;
  const xpRequired = getBattlePassXpForTier(bp.level);
  const pct = Math.min(100, Math.round((bp.xp / xpRequired) * 100));
  const hasEnoughGems = save.gems >= BATTLE_PASS_PREMIUM_COST_GEMS;

  return (
    <div className="space-y-5">
      {/* Header Banner + Unified Runner Pass / Missions Toggle */}
      <div className="p-5 rounded-xl bg-[#0b1224] border border-fuchsia-500/40 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-300 uppercase tracking-widest">
            <Award className="w-4 h-4" /> Temporada {bp.season} · Neon Overdrive ({maxTiers} Niveles)
          </div>
          <h2 className="font-display text-2xl font-bold text-white">
            Pase de Corredor — Nivel {bp.level}/{maxTiers}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-num">
            <span>
              {bp.xp} / {xpRequired} XP ({pct}%)
            </span>
            <div className="w-44 h-2 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-fuchsia-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sub-navigation: Pase de Corredor / Misiones Integradas */}
          <div className="flex gap-1 bg-[#070b17] p-1 rounded-lg border border-white/15">
            <button
              onClick={() => {
                audioEngine.playUiClick();
                setSubTab('pass');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                subTab === 'pass'
                  ? 'bg-fuchsia-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" /> Niveles (50)
              {pending.battlePass > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 font-mono-num text-[10px]">
                  {pending.battlePass}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                audioEngine.playUiClick();
                setSubTab('missions');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                subTab === 'missions'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" /> Misiones y Logros
              {pending.missions > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-mono-num text-[10px]">
                  {pending.missions}
                </span>
              )}
            </button>
          </div>

          {subTab === 'pass' && pending.battlePass > 0 && (
            <button
              onClick={() => {
                const res = claimAllBattlePassRewards(save);
                if (res.ok) {
                  audioEngine.playClaimReward();
                  onUpdateSave(res.nextSave);
                }
              }}
              className="px-4 py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Gift className="w-4 h-4" /> Reclamar Todo ({pending.battlePass})
            </button>
          )}

          {!bp.premiumUnlocked ? (
            <button
              disabled={!hasEnoughGems}
              onClick={() => {
                audioEngine.playUiClick();
                setConfirmOpen(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-display font-bold text-xs font-mono-num flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Gem className="w-4 h-4" /> Premium Solo Gemas · {BATTLE_PASS_PREMIUM_COST_GEMS} G
            </button>
          ) : (
            <div className="px-4 py-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400 text-fuchsia-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles className="w-4 h-4" /> PASE PREMIUM ACTIVO (SOLO GEMAS)
            </div>
          )}
        </div>
      </div>

      {subTab === 'missions' ? (
        <MissionsView save={save} onUpdateSave={onUpdateSave} />
      ) : (
        <>
          {/* Exclusive Tier 25 & Tier 50 3D Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ModelPreview3D
              kind="vehicle"
              itemId="plasma_bomber"
              save={save}
              title="Nivel 25 Premium · Nova Detonator X-25"
              subtitle="Vehículo Explosivo exclusivo del Pase: detonación radial al desplegar"
              accentColor="#f43f5e"
              heightClass="h-44"
            />
            <ModelPreview3D
              kind="character"
              itemId="valkor"
              characterId="valkor"
              save={save}
              title="Nivel 50 Premium · VALKOR (Soberano Overdrive)"
              subtitle="Corredor Apex legendario · Alas gravitatorias y Sobrecarga total"
              accentColor="#f59e0b"
              heightClass="h-44"
            />
          </div>

          {/* Gems-Only Confirmation Modal */}
          {confirmOpen && !bp.premiumUnlocked && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-[#070b17] border border-fuchsia-400/50 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold tracking-widest text-fuchsia-300 uppercase">
                      Confirmar Pase Premium (Exclusivo Moneda G)
                    </div>
                    <h3 className="font-display text-xl font-bold text-white mt-0.5">
                      Temporada {bp.season} · Pase de Corredor (50 Niveles)
                    </h3>
                  </div>
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="p-1.5 rounded-lg bg-[#0b1224] border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ModelPreview3D
                  kind="vehicle"
                  itemId="plasma_bomber"
                  save={save}
                  title="Incluye Nova Detonator X-25 (N25) + VALKOR (N50)"
                  subtitle="50 niveles · Talismanes, Revivires, Tiques y Cosméticos"
                  accentColor="#f43f5e"
                  heightClass="h-40"
                />

                <div className="p-3 rounded-xl bg-[#0b1224] border border-white/10 text-xs text-slate-300 space-y-1.5">
                  <div className="flex justify-between font-mono-num">
                    <span>Saldo actual de Gemas (G):</span>
                    <span className="font-bold text-fuchsia-300">{save.gems} G</span>
                  </div>
                  <div className="flex justify-between font-mono-num">
                    <span>Costo único del Pase Premium:</span>
                    <span className="font-bold text-white">-{BATTLE_PASS_PREMIUM_COST_GEMS} G</span>
                  </div>
                  <div className="flex justify-between font-mono-num pt-1 border-t border-white/10">
                    <span>Saldo restante tras activar:</span>
                    <span className="font-bold text-emerald-300">
                      {Math.max(0, save.gems - BATTLE_PASS_PREMIUM_COST_GEMS)} G
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => {
                      audioEngine.playUiClick();
                      setConfirmOpen(false);
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-[#0b1224] hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!hasEnoughGems}
                    onClick={() => {
                      const res = unlockPremiumBattlePass(save, 'gems');
                      if (res.ok) {
                        audioEngine.playPurchaseConfirm();
                        onUpdateSave(res.nextSave);
                        setConfirmOpen(false);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Crown className="w-4 h-4" /> Confirmar ({BATTLE_PASS_PREMIUM_COST_GEMS} G)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tiers Grid (Free Track + Premium Track - 50 Tiers) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {BATTLE_PASS_TIERS.map((tierDef) => {
              const unlocked = bp.level >= tierDef.tier;
              const freeClaimed = bp.claimedFreeTiers.includes(tierDef.tier);
              const premClaimed = bp.claimedPremiumTiers.includes(tierDef.tier);
              const isMilestone = tierDef.tier === 25 || tierDef.tier === 50;

              return (
                <div
                  key={tierDef.tier}
                  className={`p-3.5 rounded-xl border space-y-2.5 ${
                    isMilestone
                      ? 'bg-[#190c2b] border-amber-400/60'
                      : unlocked
                        ? 'bg-[#0b1328] border-cyan-400/40'
                        : 'bg-[#080d1b] border-white/10 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="font-mono-num text-cyan-300">
                      NIVEL {tierDef.tier}
                    </span>
                    {unlocked ? (
                      <span className="text-emerald-300">Desbloqueado</span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Bloqueado
                      </span>
                    )}
                  </div>

                  {/* Free Reward */}
                  <div className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Gratis
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        {tierDef.freeReward.label}
                      </div>
                    </div>
                    {freeClaimed ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : unlocked ? (
                      <button
                        onClick={() => {
                          const res = claimBattlePassReward(save, tierDef.tier, 'free');
                          if (res.ok) {
                            audioEngine.playClaimReward();
                            onUpdateSave(res.nextSave);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Reclamar
                      </button>
                    ) : null}
                  </div>

                  {/* Premium Reward */}
                  <div className="p-2.5 rounded-lg bg-[#160b24] border border-fuchsia-400/30 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-fuchsia-300 uppercase font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Premium
                      </div>
                      <div className="text-xs font-semibold text-white truncate">
                        {tierDef.premiumReward.label}
                      </div>
                    </div>
                    {premClaimed ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : unlocked && bp.premiumUnlocked ? (
                      <button
                        onClick={() => {
                          const res = claimBattlePassReward(
                            save,
                            tierDef.tier,
                            'premium',
                          );
                          if (res.ok) {
                            audioEngine.playClaimReward();
                            onUpdateSave(res.nextSave);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-fuchsia-400 hover:bg-fuchsia-300 text-slate-950 text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Reclamar
                      </button>
                    ) : !bp.premiumUnlocked ? (
                      <Lock className="w-3.5 h-3.5 text-fuchsia-400/60 shrink-0" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
