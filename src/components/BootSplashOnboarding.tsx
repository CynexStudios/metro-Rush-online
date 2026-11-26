import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Globe,
  HardDrive,
  Monitor,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import xynexLogo from '../assets/images/xynexdevs_logo_1795724926103.jpg';
import skylineBanner from '../assets/images/skyline_protocol_banner_1795724927064.jpg';
import { detectHardwareProfile } from '../game/hardware';
import {
  GraphicsQuality,
  HardwareDiagnostics,
  PlayerSaveData,
} from '../game/types';
import { GAME_VERSION, UPDATE_CODENAME } from '../game/version';
import { audioEngine } from '../game/audio';

interface BootSplashOnboardingProps {
  save: PlayerSaveData;
  onFinish: (updates: {
    onboardingCompleted: boolean;
    playerAgeGroup?: PlayerSaveData['playerAgeGroup'];
    runnerExperience?: PlayerSaveData['runnerExperience'];
    recommendedQuality?: Exclude<GraphicsQuality, 'custom'>;
    openOnlineAccount?: boolean;
  }) => void;
}

export const BootSplashOnboarding: React.FC<BootSplashOnboardingProps> = ({
  save,
  onFinish,
}) => {
  const [stage, setStage] = useState<'splash' | 'onboarding'>('splash');
  const [progress, setProgress] = useState(12);
  const [statusLine, setStatusLine] = useState('Inicializando motor 3D y recursos .GLB...');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [ageGroup, setAgeGroup] = useState<NonNullable<PlayerSaveData['playerAgeGroup']>>(
    save.playerAgeGroup ?? 'adult_18_plus',
  );
  const [experience, setExperience] = useState<NonNullable<PlayerSaveData['runnerExperience']>>(
    save.runnerExperience ?? 'casual',
  );
  const [diagnostics, setDiagnostics] = useState<HardwareDiagnostics | null>(null);
  const [applyAutoQuality, setApplyAutoQuality] = useState(true);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setProgress(48);
      setStatusLine('Escaneando GPU, CPU y memoria del equipo...');
      setDiagnostics(detectHardwareProfile());
    }, 450);

    const t2 = window.setTimeout(() => {
      setProgress(86);
      setStatusLine('Verificando perfil local y protocolos de red...');
    }, 950);

    const t3 = window.setTimeout(() => {
      setProgress(100);
      setStatusLine('Listo.');
      if (save.onboardingCompleted) {
        onFinish({ onboardingCompleted: true });
      } else {
        setStage('onboarding');
      }
    }, 1550);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishOnboarding = (openOnlineAccount: boolean) => {
    audioEngine.playUiClick();
    onFinish({
      onboardingCompleted: true,
      playerAgeGroup: ageGroup,
      runnerExperience: experience,
      recommendedQuality:
        applyAutoQuality && diagnostics ? diagnostics.recommendedQuality : undefined,
      openOnlineAccount,
    });
  };

  if (stage === 'splash') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#050814] text-white overflow-hidden select-none">
        <img
          src={skylineBanner}
          alt="Metro Rush Neon City Banner"
          className="absolute inset-0 w-full h-full object-cover opacity-35 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-[#050814]/75 to-[#050814]/60" />

        {/* Top Studio Badge */}
        <div className="relative z-10 flex items-center justify-between px-8 pt-6">
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2">
            <img
              src={xynexLogo}
              alt="XynexDevs Studios"
              className="w-9 h-9 rounded-lg object-cover border border-cyan-400/40"
            />
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-cyan-300">
                XynexDevs Studios
              </div>
              <div className="text-[11px] text-slate-400">Presenta</div>
            </div>
          </div>

          <div className="text-xs font-mono-num bg-cyan-500/15 border border-cyan-400/35 text-cyan-200 px-3 py-1.5 rounded-lg">
            v{GAME_VERSION} · {UPDATE_CODENAME}
          </div>
        </div>

        {/* Center Game Title & Loading Bar */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/35 text-fuchsia-200 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Actualización Mayor · {UPDATE_CODENAME}
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-black tracking-tight text-white drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]">
            METRO RUSH
          </h1>
          <div className="text-lg sm:text-xl font-display tracking-[0.35em] text-cyan-300 mt-1 mb-8">
            NEON CITY ONLINE
          </div>

          <div className="w-full max-w-md space-y-2">
            <div className="h-2.5 w-full rounded-full bg-slate-900/90 border border-white/15 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300 font-mono-num">
              <span>{statusLine}</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 text-center pb-6 px-4 text-xs text-slate-400">
          © {new Date().getFullYear()} <strong className="text-slate-200">XynexDevs Studios</strong> ·
          Todos los derechos de autor reservados.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050814]/95 backdrop-blur-md p-4 text-white">
      <div className="w-full max-w-xl bg-[#0b1224] border border-cyan-400/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-cyan-950/60 to-fuchsia-950/40 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={xynexLogo}
              alt="XynexDevs Studios"
              className="w-9 h-9 rounded-lg object-cover border border-cyan-400/40"
            />
            <div>
              <div className="text-[11px] uppercase tracking-wider text-cyan-300 font-bold">
                Configuración Inicial · Paso {step} de 3
              </div>
              <h2 className="font-display text-lg font-bold">
                Bienvenido a Metro Rush: {UPDATE_CODENAME}
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                  1. ¿Cuál es tu rango de edad?
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'under_13', label: 'Menor de 13' },
                    { id: 'teen_13_17', label: '13 - 17 años' },
                    { id: 'adult_18_plus', label: '18+ años' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        setAgeGroup(opt.id as NonNullable<PlayerSaveData['playerAgeGroup']>);
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition ${
                        ageGroup === opt.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                  2. ¿Has jugado antes juegos de carrera infinita / parkour?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'beginner', label: 'Primera vez', sub: 'Guía paso a paso' },
                    { id: 'casual', label: 'Algo de experiencia', sub: 'Ritmo equilibrado' },
                    { id: 'veteran', label: 'Veterano', sub: 'Dominio rápido' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        setExperience(opt.id as NonNullable<PlayerSaveData['runnerExperience']>);
                      }}
                      className={`p-3 rounded-xl border text-left transition ${
                        experience === opt.id
                          ? 'bg-fuchsia-500/20 border-fuchsia-400 text-white'
                          : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    if (!diagnostics) setDiagnostics(detectHardwareProfile());
                    setStep(2);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition"
                >
                  Siguiente: Analizar Equipo
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="text-xs text-slate-300">
                Hemos analizado los recursos de tu computadora para ajustar el rendimiento gráfico automáticamente:
              </div>

              {diagnostics && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-semibold mb-1">
                      <Cpu className="w-3.5 h-3.5" /> Procesador
                    </div>
                    <div className="text-sm font-bold font-mono-num">
                      {diagnostics.cpuThreads} hilos
                    </div>
                    <div className="text-[11px] text-slate-400">{diagnostics.cpuTier}</div>
                  </div>
                  <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-fuchsia-300 font-semibold mb-1">
                      <HardDrive className="w-3.5 h-3.5" /> Memoria RAM
                    </div>
                    <div className="text-sm font-bold font-mono-num">
                      {diagnostics.ramGb ? `${diagnostics.ramGb} GB` : 'Detectada (Estándar)'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {diagnostics.screenWidth}×{diagnostics.screenHeight}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold mb-1">
                      <Monitor className="w-3.5 h-3.5" /> Tarjeta Gráfica
                    </div>
                    <div className="text-xs font-bold truncate" title={diagnostics.gpuRenderer}>
                      {diagnostics.gpuRenderer}
                    </div>
                    <div className="text-[11px] text-emerald-300 mt-0.5">
                      Sugerido: {diagnostics.recommendedQuality.toUpperCase()}
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyAutoQuality}
                  onChange={(e) => setApplyAutoQuality(e.target.checked)}
                  className="accent-emerald-400 w-4 h-4"
                />
                <span className="text-xs text-emerald-100">
                  Aplicar ajuste gráfico óptimo según mi equipo (
                  <strong>{diagnostics?.recommendedQuality.toUpperCase() ?? 'MEDIUM'}</strong>)
                </span>
              </label>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    setStep(3);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition"
                >
                  Siguiente: Cuenta Online
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-cyan-500/10 border border-cyan-400/30 rounded-xl p-4">
                <Globe className="w-6 h-6 text-cyan-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-white">
                    ¿Quieres crear o vincular una Cuenta Online ahora?
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Con una cuenta online podrás guardar tu progreso en la nube, añadir amigos por
                    servidor/Radmin y recibir invitaciones a salas. También puedes jugar offline y
                    crearla más tarde desde el menú Online.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => finishOnboarding(false)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs font-bold transition"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-300" />
                  Dejar para después (Jugar)
                </button>
                <button
                  type="button"
                  onClick={() => finishOnboarding(true)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:brightness-110 text-slate-950 text-xs font-black transition"
                >
                  <UserCheck className="w-4 h-4" />
                  Crear / Vincular Cuenta Online
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <button type="button" onClick={() => setStep(2)} className="hover:text-white">
                  ← Volver al escaneo
                </button>
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> XynexDevs Studios
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
