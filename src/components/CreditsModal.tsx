import React, { useEffect } from 'react';
import { Award, Cpu, Music, Shield, Sparkles, X } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { ASSET_LICENSES } from '../game/hardware';
import { GAME_VERSION } from '../game/version';

interface CreditsContentProps {
  onClose?: () => void;
}

export const CreditsContent: React.FC<CreditsContentProps> = ({ onClose }) => {
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="border-b border-white/10 pb-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold text-white">
            METRO RUSH: NEON CITY
          </h2>
          <span className="font-mono-num text-xs font-semibold text-cyan-300">
            v{GAME_VERSION} · NEON OVERDRIVE
          </span>
        </div>
        <p className="text-xs text-slate-300">
          Creado, diseñado y dirigido por{' '}
          <strong className="text-white">Jaderson Liriano</strong>, líder de{' '}
          <strong className="text-cyan-300">XynexDevs</strong>.
        </p>
      </div>

      {/* 1. Desarrollo & 2. Diseño & 3. Programación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/35 space-y-1.5">
          <div className="font-bold text-cyan-300 flex items-center gap-1.5">
            <Award className="w-4 h-4" /> Desarrollo y Dirección
          </div>
          <div className="font-semibold text-white">Jaderson Liriano</div>
          <div className="text-slate-300">
            Dirección general, arquitectura de producto y liderazgo técnico en XynexDevs.
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-1.5">
          <div className="font-bold text-fuchsia-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Diseño de Juego y Arte 3D
          </div>
          <div className="font-semibold text-white">XynexDevs Studio</div>
          <div className="text-slate-300">
            10 distritos urbanos, 9 corredores con siluetas propias, 6 vehículos y 8 jefes de 4 fases.
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-1.5">
          <div className="font-bold text-emerald-300 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" /> Programación y Motor
          </div>
          <div className="font-semibold text-white">TypeScript · Three.js · React · Electron</div>
          <div className="text-slate-300">
            Motor WebGL2 ACES Filmic, física de parkour, SQLite persistente y multijugador WebSocket/WebRTC.
          </div>
        </div>
      </div>

      {/* 4. Audio & 6. Agradecimientos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-1.5">
          <div className="font-bold text-cyan-300 flex items-center gap-1.5">
            <Music className="w-4 h-4" /> Música y Audio Procedural
          </div>
          <p className="text-slate-300 leading-relaxed">
            Sintetizador y secuenciador Web Audio API sin muestras con copyright: temas adaptativos para Lobby, carrera, persecución, jefes, clima, baterías y rupturas de escudo en 9 canales independientes.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-1.5">
          <div className="font-bold text-emerald-300 flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> Agradecimientos e Información del Proyecto
          </div>
          <p className="text-slate-300 leading-relaxed">
            Gracias a la comunidad que prueba cada versión en LAN, túneles y escritorio. Proyecto mantenido bajo el repositorio público{' '}
            <span className="font-mono-num text-cyan-300">CynexStudios/metro-Rush-online</span> · © 2026 Jaderson Liriano · XynexDevs.
          </p>
        </div>
      </div>

      {/* 5. Recursos y Licencias OSS */}
      <div className="rounded-xl bg-[#0b1224] border border-white/10 p-4 space-y-3">
        <div className="font-display font-bold text-sm text-white">
          Recursos, Librerías y Licencias de Código Abierto
        </div>
        <div className="divide-y divide-white/10 text-xs">
          {ASSET_LICENSES.map((lic) => (
            <div key={lic.asset} className="py-2.5 space-y-0.5">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold text-white">{lic.asset}</span>
                <span className="text-cyan-300 font-semibold">{lic.license}</span>
              </div>
              <div className="text-slate-400">
                {lic.source} · {lic.usage}
              </div>
            </div>
          ))}
        </div>
      </div>

      {onClose && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              audioEngine.playUiClick();
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs cursor-pointer"
          >
            Cerrar Créditos
          </button>
        </div>
      )}
    </div>
  );
};

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        audioEngine.playUiClick();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#040712]/92 p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Créditos"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#080d1c] border border-cyan-400/45 rounded-2xl overflow-hidden animate-menu-enter">
        <div className="px-5 py-3.5 bg-[#0b1224] border-b border-white/10 flex items-center justify-between">
          <span className="font-display font-bold text-sm text-cyan-300 tracking-wider">
            CRÉDITOS OFICIALES · NEON OVERDRIVE v{GAME_VERSION}
          </span>
          <button
            onClick={() => {
              audioEngine.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-[#070b17] border border-white/15 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Cerrar Créditos"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <CreditsContent onClose={onClose} />
        </div>
      </div>
    </div>
  );
};
