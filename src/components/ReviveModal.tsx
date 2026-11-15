import React from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert, Zap } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { RevivePromptState } from '../game/types';

interface ReviveModalProps {
  prompt: RevivePromptState;
  distance: number;
  score: number;
  onConfirmRevive: () => void;
  onDeclineRevive: () => void;
}

export const ReviveModal: React.FC<ReviveModalProps> = ({
  prompt,
  distance,
  score,
  onConfirmRevive,
  onDeclineRevive,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040712]/88 p-6">
      <div className="w-full max-w-md bg-[#0a0f1f] border border-emerald-400/55 rounded-xl p-6 space-y-5 animate-menu-enter">
        <div className="flex items-start gap-3 border-b border-white/10 pb-4">
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest text-rose-400 uppercase">
              Impacto Crítico · Intento #{prompt.attemptNumber}
            </div>
            <h2 className="font-display text-2xl font-bold text-white mt-0.5">
              ¿Revivir y Continuar?
            </h2>
            <p className="text-xs text-slate-300 mt-1">{prompt.defeatCause}</p>
          </div>
        </div>

        {/* Run snapshot */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#0f172a] border border-white/10">
            <div className="text-slate-400">Distancia Actual</div>
            <div className="font-mono-num text-lg font-bold text-white">
              {distance.toLocaleString('es-ES')} m
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0f172a] border border-white/10">
            <div className="text-slate-400">Puntuación</div>
            <div className="font-mono-num text-lg font-bold text-cyan-300">
              {score.toLocaleString('es-ES')}
            </div>
          </div>
        </div>

        {/* Progressive Token Cost Card */}
        <div className="p-4 rounded-xl bg-[#0d192b] border border-emerald-400/35 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Coste Progresivo de Revivir
            </span>
            <span className="font-mono-num text-base font-bold text-white">
              {prompt.costTokens}{' '}
              {prompt.costTokens === 1 ? 'Token' : 'Tokens'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300 font-mono-num">
            <span>Tu saldo disponible:</span>
            <span
              className={`font-bold ${
                prompt.canAfford ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              {prompt.availableTokens}{' '}
              {prompt.availableTokens === 1 ? 'Token' : 'Tokens'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Despeja todos los obstáculos cercanos, aleja al Enforcer y otorga 3.0s de invulnerabilidad.
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => {
              audioEngine.playUiClick();
              onDeclineRevive();
            }}
            className="flex-1 py-2.5 rounded-lg border border-white/15 hover:border-rose-400/60 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Finalizar Carrera
          </button>

          <button
            disabled={!prompt.canAfford}
            onClick={() => {
              audioEngine.playUiClick(true);
              onConfirmRevive();
            }}
            className="flex-1 py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4" />
            {prompt.canAfford
              ? `Revivir (${prompt.costTokens} Token${
                  prompt.costTokens > 1 ? 's' : ''
                })`
              : 'Tokens Insuficientes'}
          </button>
        </div>
      </div>
    </div>
  );
};
