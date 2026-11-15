import React from 'react';
import { Award, Check, Crown, Gift, Lock, Sparkles } from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BATTLE_PASS_PREMIUM_COST_COINS,
  BATTLE_PASS_PREMIUM_COST_GEMS,
  BATTLE_PASS_TIERS,
  BATTLE_PASS_XP_PER_TIER,
} from '../game/data';
import {
  claimAllBattlePassRewards,
  claimBattlePassReward,
  getPendingRewardCount,
  unlockPremiumBattlePass,
} from '../game/economy';
import { PlayerSaveData } from '../game/types';

interface BattlePassViewProps {
  save: PlayerSaveData;
  onUpdateSave: (next: PlayerSaveData) => void;
}

export const BattlePassView: React.FC<BattlePassViewProps> = ({
  save,
  onUpdateSave,
}) => {
  const bp = save.battlePass;
  const pending = getPendingRewardCount(save).battlePass;
  const pct = Math.min(
    100,
    Math.round((bp.xp / BATTLE_PASS_XP_PER_TIER) * 100),
  );

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-[#0b1224] border border-fuchsia-500/40 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-300 uppercase tracking-widest">
            <Award className="w-4 h-4" /> Temporada {bp.season} · Protocolo Neón
          </div>
          <h2 className="font-display text-2xl font-bold text-white">
            Pase de Batalla — Nivel {bp.level}/20
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-num">
            <span>
              {bp.xp} / {BATTLE_PASS_XP_PER_TIER} XP ({pct}%)
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
          {pending > 0 && (
            <button
              onClick={() => {
                const res = claimAllBattlePassRewards(save);
                if (res.ok) {
                  audioEngine.playClaimReward();
                  onUpdateSave(res.nextSave);
                }
              }}
              className="px-4 py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Gift className="w-4 h-4" /> Reclamar Todo ({pending})
            </button>
          )}

          {!bp.premiumUnlocked ? (
            <div className="flex items-center gap-2">
              <button
                disabled={save.coins < BATTLE_PASS_PREMIUM_COST_COINS}
                onClick={() => {
                  const res = unlockPremiumBattlePass(save, 'coins');
                  if (res.ok) {
                    audioEngine.playPurchaseConfirm();
                    onUpdateSave(res.nextSave);
                  }
                }}
                className="px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-xs font-mono-num flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Crown className="w-4 h-4" /> Premium ·{' '}
                {BATTLE_PASS_PREMIUM_COST_COINS} M
              </button>
              <button
                disabled={save.gems < BATTLE_PASS_PREMIUM_COST_GEMS}
                onClick={() => {
                  const res = unlockPremiumBattlePass(save, 'gems');
                  if (res.ok) {
                    audioEngine.playPurchaseConfirm();
                    onUpdateSave(res.nextSave);
                  }
                }}
                className="px-4 py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-display font-bold text-xs font-mono-num cursor-pointer disabled:cursor-not-allowed"
              >
                {BATTLE_PASS_PREMIUM_COST_GEMS} G
              </button>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400 text-fuchsia-200 text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> PASE PREMIUM ACTIVO
            </div>
          )}
        </div>
      </div>

      {/* Tiers Grid (Free Track + Premium Track) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {BATTLE_PASS_TIERS.map((tierDef) => {
          const unlocked = bp.level >= tierDef.tier;
          const freeClaimed = bp.claimedFreeTiers.includes(tierDef.tier);
          const premClaimed = bp.claimedPremiumTiers.includes(tierDef.tier);

          return (
            <div
              key={tierDef.tier}
              className={`p-3.5 rounded-xl border space-y-2.5 ${
                unlocked
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
    </div>
  );
};
