import React, { useEffect, useRef } from 'react';
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
  const actedRef = useRef(false);

  const handleConfirm = () => {
    if (!prompt.canAfford || actedRef.current) return;
    actedRef.current = true;
    audioEngine.playUiClick(true);
    onConfirmRevive();
  };

  const handleDecline = () => {
    if (actedRef.current) return;
    actedRef.current = true;
    audioEngine.playUiClick();
    onDeclineRevive();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Explicit rule §13.3: Escape does not close revive countdown unexpectedly
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter' && prompt.canAfford) {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const progressPct = Math.max(
    0,
    Math.min(100, (prompt.remainingSeconds / 20) * 100),
  );

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

        {/* Progressive Token Cost Card + 20s Auto-Decline Countdown */}
        <div className="p-4 rounded-xl bg-[#0d192b] border border-emerald-400/35 space-y-2.5 text-xs">
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
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono-num">
              <span className="text-slate-300">Cuenta regresiva (20s):</span>
              <span
                className={`font-bold ${
                  prompt.remainingSeconds <= 5
                    ? 'text-rose-400'
                    : prompt.remainingSeconds <= 10
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                }`}
              >
                {Math.max(0, prompt.remainingSeconds).toFixed(1)}s
              </span>
            </div>
            <div className="h-2 bg-slate-900 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  prompt.remainingSeconds <= 5
                    ? 'bg-rose-500'
                    : prompt.remainingSeconds <= 10
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{
                  width: `${progressPct}%`,
                }}
              />
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Reanuda en el punto exacto (conservando Jefe y Fase actual), despeja obstáculos y otorga invulnerabilidad breve. Enter confirma si tienes saldo.
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={handleDecline}
            className="flex-1 py-2.5 rounded-lg border border-white/15 hover:border-rose-400/60 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" /> Aceptar Derrota
          </button>

          <button
            disabled={!prompt.canAfford}
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
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
