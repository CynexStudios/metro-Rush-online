import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  Gamepad2,
  Globe,
  Monitor,
  Music,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { detectHardwareProfile } from '../game/hardware';
import {
  CONTROL_PROFILES,
  exportSaveBackupJson,
  findConflictingKeyBinding,
  getPresetSettings,
  importSaveBackupJson,
  resetSettingsToDefault,
} from '../game/storage';
import {
  ControlProfile,
  DifficultyLevel,
  DisplayMode,
  GraphicsQuality,
  HardwareDiagnostics,
  HudSnapshot,
  KeyBindings,
  PCSettings,
  PlayerSaveData,
  ReleaseUpdateInfo,
  TimeOfDay,
  UpdateProgressState,
  UpscalerType,
} from '../game/types';
import { GAME_VERSION } from '../game/version';
import {
  getLanguageCoveragePercent,
  getTimeLabel,
  SELECTABLE_LANGUAGES,
  t,
} from '../i18n';

export type SettingsCategory =
  | 'video'
  | 'graphics'
  | 'controls'
  | 'sound'
  | 'gameplay'
  | 'accessibility'
  | 'language'
  | 'diagnostics'
  | 'graphics_video'
  | 'audio_lobby'
  | 'gameplay_controls'
  | 'system_backup';

type SettingsGroup =
  | 'graphics_video'
  | 'audio_lobby'
  | 'gameplay_controls'
  | 'system_backup';

function mapCategoryToGroup(cat: SettingsCategory): SettingsGroup {
  if (cat === 'sound' || cat === 'audio_lobby') return 'audio_lobby';
  if (cat === 'controls' || cat === 'gameplay' || cat === 'gameplay_controls') {
    return 'gameplay_controls';
  }
  if (
    cat === 'language' ||
    cat === 'accessibility' ||
    cat === 'diagnostics' ||
    cat === 'system_backup'
  ) {
    return 'system_backup';
  }
  return 'graphics_video';
}

interface SettingsViewProps {
  settings: PCSettings;
  save?: PlayerSaveData;
  diagnostics: HardwareDiagnostics;
  liveHud: HudSnapshot;
  updateInfo?: ReleaseUpdateInfo | null;
  updateState?: UpdateProgressState;
  onCheckForUpdates?: (repo?: string) => Promise<ReleaseUpdateInfo>;
  onDownloadUpdate?: (info?: ReleaseUpdateInfo) => Promise<void>;
  onInstallUpdate?: () => Promise<void>;
  onChangeSettings: (next: PCSettings) => void;
  onReplaceSave?: (next: PlayerSaveData) => void;
  onVideoChangeWithConfirm: (next: PCSettings, prev: PCSettings) => void;
  onRunBenchmark: () => Promise<number>;
  onStartTutorial?: () => void;
  onOpenCredits?: () => void;
  initialCategory?: SettingsCategory;
}

const KEY_LABELS: Record<keyof KeyBindings, string> = {
  left: 'Carril Izquierdo',
  right: 'Carril Derecho',
  jump: 'Salto / Doble Salto',
  slide: 'Deslizar / Caída Rápida',
  sprint: 'Sprint / Impulso',
  interact: 'Gancho / Tirolina',
  ability: 'Habilidad Especial',
  activateVehicle: 'Activar Vehículo (Batería)',
  callDrone: 'Llamar Dron Compañero',
  slowMo: 'Slow-Motion',
  pause: 'Pausa',
};

function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code === 'Space') return 'Espacio';
  if (code === 'ShiftLeft') return 'Shift Izq.';
  if (code === 'ShiftRight') return 'Shift Der.';
  if (code === 'ArrowLeft') return 'Flecha Izq.';
  if (code === 'ArrowRight') return 'Flecha Der.';
  if (code === 'ArrowUp') return 'Flecha Arriba';
  if (code === 'ArrowDown') return 'Flecha Abajo';
  return code;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  save,
  diagnostics,
  liveHud,
  updateInfo,
  updateState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onChangeSettings,
  onReplaceSave,
  onVideoChangeWithConfirm,
  onRunBenchmark,
  onStartTutorial,
  onOpenCredits,
  initialCategory = 'graphics_video',
}) => {
  const [group, setGroup] = useState<SettingsGroup>(() =>
    mapCategoryToGroup(initialCategory),
  );
  const [rebindingKey, setRebindingKey] = useState<keyof KeyBindings | null>(
    null,
  );
  const [rebindConflictMsg, setRebindConflictMsg] = useState<string | null>(null);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResultMs, setBenchResultMs] = useState<number | null>(
    diagnostics.measuredAvgFrameMs,
  );
  const [backupNotice, setBackupNotice] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  const lang = settings.language;

  useEffect(() => {
    setGroup(mapCategoryToGroup(initialCategory));
  }, [initialCategory]);

  useEffect(() => {
    if (!rebindingKey) return;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setRebindingKey(null);
        setRebindConflictMsg(null);
        return;
      }
      const conflictingAction = findConflictingKeyBinding(
        settings.keybindings,
        rebindingKey,
        e.code,
      );
      if (conflictingAction) {
        audioEngine.playUiClick();
        setRebindConflictMsg(
          `${t(lang, 'settings.keyConflictBlocked')} (${formatKeyCode(e.code)} → ${KEY_LABELS[conflictingAction]})`,
        );
        return;
      }
      setRebindConflictMsg(null);
      const next: PCSettings = {
        ...settings,
        controlProfile: 'custom',
        keybindings: {
          ...settings.keybindings,
          [rebindingKey]: e.code,
        },
      };
      audioEngine.playUiClick(true);
      onChangeSettings(next);
      setRebindingKey(null);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [rebindingKey, settings, onChangeSettings, lang]);

  const keyConflicts = useMemo(() => {
    const map = new Map<string, (keyof KeyBindings)[]>();
    (Object.keys(settings.keybindings) as (keyof KeyBindings)[]).forEach(
      (action) => {
        const code = settings.keybindings[action];
        const list = map.get(code) ?? [];
        list.push(action);
        map.set(code, list);
      },
    );
    const conflicts: string[] = [];
    map.forEach((actions, code) => {
      if (actions.length > 1) {
        conflicts.push(
          `${formatKeyCode(code)} (${actions.map((a) => KEY_LABELS[a]).join(' + ')})`,
        );
      }
    });
    return conflicts;
  }, [settings.keybindings]);

  const setPatch = (patch: Partial<PCSettings>) => {
    onChangeSettings({ ...settings, ...patch });
  };

  const setGraphicsControl = <K extends keyof PCSettings>(
    key: K,
    value: PCSettings[K],
  ) => {
    onChangeSettings({
      ...settings,
      graphicsQuality: 'custom',
      [key]: value,
    });
  };

  const handleAutoDetect = () => {
    const fresh = detectHardwareProfile(undefined, benchResultMs);
    const preset = getPresetSettings(fresh.recommendedQuality);
    audioEngine.playUiClick(true);
    onChangeSettings({
      ...settings,
      ...preset,
      upscaler: fresh.supportedUpscalers.fsr.supported ? 'fsr' : 'none',
    });
  };

  const triggerBenchmark = async () => {
    setBenchRunning(true);
    try {
      const avgMs = await onRunBenchmark();
      setBenchResultMs(avgMs);
    } finally {
      setBenchRunning(false);
    }
  };

  const handleExportBackup = () => {
    if (!save) return;
    const json = exportSaveBackupJson(save);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metro-rush-save-v3-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    audioEngine.playClaimReward();
    setBackupNotice({ ok: true, msg: 'Respaldo JSON descargado correctamente.' });
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const res = importSaveBackupJson(text);
      if (res.ok && res.save) {
        audioEngine.playClaimReward();
        onReplaceSave?.(res.save);
        setBackupNotice({
          ok: true,
          msg: `Perfil "${res.save.playerName}" restaurado correctamente.`,
        });
      } else {
        setBackupNotice({
          ok: false,
          msg: res.error ?? 'Archivo JSON inválido.',
        });
      }
    } catch {
      setBackupNotice({ ok: false, msg: 'Error al leer el archivo.' });
    }
  };

  const navGroups: {
    id: SettingsGroup;
    label: string;
    sub: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'graphics_video',
      label: 'Gráficos y Vídeo',
      sub: 'Resolución, FPS, PBR y Shader',
      Icon: Monitor,
    },
    {
      id: 'audio_lobby',
      label: 'Audio y Lobby',
      sub: '9 Canales y Música de Menú',
      Icon: Volume2,
    },
    {
      id: 'gameplay_controls',
      label: 'Jugabilidad y Controles',
      sub: 'Teclado, Cámara y Dificultad',
      Icon: Gamepad2,
    },
    {
      id: 'system_backup',
      label: 'Sistema, Idioma y Respaldo',
      sub: 'Accesibilidad, PC y JSON',
      Icon: Globe,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 h-full">
      {/* Left 4-Group Sidebar */}
      <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:border-r lg:border-white/10 lg:pr-4">
        {navGroups.map(({ id, label, sub, Icon }) => {
          const active = group === id;
          return (
            <button
              key={id}
              onClick={() => {
                audioEngine.playUiClick();
                setGroup(id);
              }}
              className={`flex items-start gap-3 px-3.5 py-3 rounded-xl text-left border transition-colors cursor-pointer shrink-0 ${
                active
                  ? 'bg-cyan-500/20 border-cyan-400 text-white'
                  : 'bg-[#0b1224] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  active ? 'text-cyan-300' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-xs font-bold whitespace-nowrap">{label}</div>
                <div className="text-[10px] text-slate-400 hidden lg:block">
                  {sub}
                </div>
              </div>
            </button>
          );
        })}

        <div className="hidden lg:block mt-auto pt-4 border-t border-white/10 text-[11px] text-slate-400 space-y-2">
          <div className="font-mono-num text-cyan-300 font-bold">
            METRO RUSH v{GAME_VERSION} · NEON OVERDRIVE
          </div>
          <div>Guardado v5 compatible + SQLite</div>
          {onOpenCredits && (
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                onOpenCredits();
              }}
              className="w-full py-1.5 px-2.5 rounded-lg bg-[#0b1224] hover:bg-[#13203d] border border-cyan-400/35 text-cyan-200 font-semibold text-left flex items-center gap-1.5 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{t(lang, 'settings.openCredits')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="space-y-6 pr-1">
        {/* 1. GRAPHICS & VIDEO */}
        {group === 'graphics_video' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Gráficos y Vídeo (PC)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Resolución de renderizado, escalado, tasas de refresco y parámetros PBR completos.
                </p>
              </div>
              <button
                onClick={handleAutoDetect}
                className="px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                {t(lang, 'settings.autoDetect')} ({diagnostics.recommendedQuality.toUpperCase()})
              </button>
            </div>

            {/* Video Display Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2.5">
                <label className="text-xs font-semibold text-slate-200 block">
                  Resolución de Renderizado
                </label>
                <select
                  value={settings.resolutionPreset}
                  onChange={(e) => {
                    const next = { ...settings, resolutionPreset: e.target.value };
                    onVideoChangeWithConfirm(next, settings);
                  }}
                  className="w-full bg-[#070b17] border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 outline-none"
                >
                  <option value="native">
                    Nativa ({diagnostics.screenWidth}×{diagnostics.screenHeight})
                  </option>
                  <option value="1280x720">1280×720 (HD 720p)</option>
                  <option value="1920x1080">1920×1080 (Full HD 1080p)</option>
                  <option value="2560x1440">2560×1440 (QHD 1440p)</option>
                  <option value="3840x2160">3840×2160 (4K UHD)</option>
                  <option value="custom">Personalizada</option>
                </select>
                {settings.resolutionPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="number"
                      min={640}
                      max={7680}
                      value={settings.customWidth}
                      onChange={(e) =>
                        onVideoChangeWithConfirm(
                          { ...settings, customWidth: Number(e.target.value) || 1920 },
                          settings,
                        )
                      }
                      className="w-full bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-xs font-mono-num text-white"
                    />
                    <input
                      type="number"
                      min={480}
                      max={4320}
                      value={settings.customHeight}
                      onChange={(e) =>
                        onVideoChangeWithConfirm(
                          { ...settings, customHeight: Number(e.target.value) || 1080 },
                          settings,
                        )
                      }
                      className="w-full bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-xs font-mono-num text-white"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2.5">
                <label className="text-xs font-semibold text-slate-200 block">
                  Modo de Pantalla
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['fullscreen', 'Completa'],
                      ['borderless', 'Sin Bordes'],
                      ['windowed', 'Ventana'],
                    ] as [DisplayMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => {
                        audioEngine.playUiClick();
                        onVideoChangeWithConfirm(
                          { ...settings, displayMode: mode },
                          settings,
                        );
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                        settings.displayMode === mode
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-[#070b17] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Los cambios de vídeo piden confirmación antes de 15s.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Refresco / Límite de FPS
                  </span>
                  <div className="flex gap-2">
                    <select
                      value={settings.refreshRate}
                      onChange={(e) =>
                        setPatch({ refreshRate: Number(e.target.value) })
                      }
                      className="bg-[#070b17] border border-white/15 rounded px-2 py-1 text-xs font-mono-num text-white"
                    >
                      {[60, 75, 120, 144, 165, 240].map((hz) => (
                        <option key={hz} value={hz}>
                          {hz} Hz
                        </option>
                      ))}
                    </select>
                    <select
                      value={settings.fpsLimit}
                      onChange={(e) =>
                        setPatch({
                          fpsLimit: Number(e.target.value) as PCSettings['fpsLimit'],
                        })
                      }
                      className="bg-[#070b17] border border-white/15 rounded px-2 py-1 text-xs font-mono-num text-white"
                    >
                      <option value={0}>Sin límite</option>
                      <option value={30}>30 FPS</option>
                      <option value={60}>60 FPS</option>
                      <option value={120}>120 FPS</option>
                      <option value={144}>144 FPS</option>
                      <option value={240}>240 FPS</option>
                    </select>
                  </div>
                </div>
                <ToggleRow
                  label="Sincronización Vertical (V-Sync)"
                  checked={settings.vsync}
                  onChange={(v) => setPatch({ vsync: v })}
                />
                <ToggleRow
                  label="Suavizado de Bordes (Antialiasing)"
                  checked={settings.antialiasing}
                  onChange={(v) => setPatch({ antialiasing: v })}
                />
              </div>

              <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                <SliderRow
                  label="Escala de Resolución"
                  value={settings.resolutionScale}
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  display={`${Math.round(settings.resolutionScale * 100)}%`}
                  onChange={(v) =>
                    onVideoChangeWithConfirm(
                      { ...settings, resolutionScale: v },
                      settings,
                    )
                  }
                />
                <SliderRow
                  label="Nitidez de Imagen"
                  value={settings.sharpness}
                  min={0}
                  max={1}
                  step={0.05}
                  display={`${Math.round(settings.sharpness * 100)}%`}
                  onChange={(v) => setPatch({ sharpness: v })}
                />
              </div>
            </div>

            {/* Upscaler */}
            <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Reescalado Espacial / Upscaler
                </div>
                <div className="text-[11px] text-slate-400">
                  FSR / DLSS / XeSS según soporte real WebGL2
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['none', 'fsr', 'dlss', 'xess'] as UpscalerType[]).map((u) => {
                  const cap =
                    u === 'none'
                      ? { supported: true, reason: 'Nativo' }
                      : diagnostics.supportedUpscalers[u];
                  return (
                    <button
                      key={u}
                      disabled={!cap.supported}
                      title={cap.reason}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setPatch({ upscaler: u });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        settings.upscaler === u
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : cap.supported
                            ? 'bg-[#070b17] border-white/10 text-slate-300'
                            : 'bg-[#070b17]/50 border-white/5 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {u === 'none' ? 'Desactivado' : u.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Presets + 14 Graphics Toggles */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-cyan-300 uppercase">
                Perfiles de Calidad Gráfica
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(
                  [
                    ['very_low', 'Muy Baja'],
                    ['low', 'Baja'],
                    ['medium', 'Media'],
                    ['high', 'Alta'],
                    ['ultra', 'Ultra'],
                    ['custom', 'Custom'],
                  ] as [GraphicsQuality, string][]
                ).map(([q, label]) => (
                  <button
                    key={q}
                    onClick={() => {
                      audioEngine.playUiClick();
                      if (q === 'custom') setPatch({ graphicsQuality: 'custom' });
                      else
                        onChangeSettings({
                          ...settings,
                          ...getPresetSettings(q),
                        });
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border cursor-pointer ${
                      settings.graphicsQuality === q
                        ? 'bg-cyan-500/25 border-cyan-400 text-white'
                        : 'bg-[#0b1224] border-white/10 text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <SelectRow
                  label="Texturas PBR"
                  value={settings.textureQuality}
                  options={[
                    ['low', 'Baja (256px)'],
                    ['medium', 'Media (512px)'],
                    ['high', 'Alta (1024px)'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'textureQuality',
                      v as PCSettings['textureQuality'],
                    )
                  }
                />
                <SelectRow
                  label="Iluminación"
                  value={settings.lightingQuality}
                  options={[
                    ['standard', 'Estándar'],
                    ['cinematic', 'Cinemática (PBR + IBL)'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'lightingQuality',
                      v as PCSettings['lightingQuality'],
                    )
                  }
                />
                <SelectRow
                  label="Distancia de Dibujado"
                  value={settings.drawDistance}
                  options={[
                    ['near', 'Cercana'],
                    ['medium', 'Media'],
                    ['far', 'Lejana'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'drawDistance',
                      v as PCSettings['drawDistance'],
                    )
                  }
                />
                <SelectRow
                  label="LOD Bias"
                  value={settings.lodBias}
                  options={[
                    ['performance', 'Rendimiento'],
                    ['balanced', 'Equilibrado'],
                    ['quality', 'Calidad Máxima'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl('lodBias', v as PCSettings['lodBias'])
                  }
                />
                <SelectRow
                  label="Calidad de Vegetación"
                  value={settings.vegetationQuality}
                  options={[
                    ['low', 'Baja'],
                    ['medium', 'Media'],
                    ['high', 'Alta'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'vegetationQuality',
                      v as PCSettings['vegetationQuality'],
                    )
                  }
                />
                <SelectRow
                  label="Efectos y Partículas"
                  value={settings.visualEffects}
                  options={[
                    ['low', 'Baja'],
                    ['medium', 'Media'],
                    ['high', 'Alta'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'visualEffects',
                      v as PCSettings['visualEffects'],
                    )
                  }
                />
                <SelectRow
                  label="Detalle de Modelos 3D"
                  value={settings.modelQuality}
                  options={[
                    ['low', 'Baja'],
                    ['medium', 'Media'],
                    ['high', 'Alta'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'modelQuality',
                      v as PCSettings['modelQuality'],
                    )
                  }
                />
                <SelectRow
                  label="Densidad Urbana"
                  value={settings.objectDensity}
                  options={[
                    ['low', 'Baja'],
                    ['medium', 'Media'],
                    ['high', 'Alta'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'objectDensity',
                      v as PCSettings['objectDensity'],
                    )
                  }
                />
                <SelectRow
                  label="Materiales"
                  value={settings.materialQuality}
                  options={[
                    ['standard', 'Estándar'],
                    ['pbr', 'PBR Completo'],
                  ]}
                  onChange={(v) =>
                    setGraphicsControl(
                      'materialQuality',
                      v as PCSettings['materialQuality'],
                    )
                  }
                />
                <ToggleRow
                  label="Sombras Dinámicas"
                  checked={settings.shadows}
                  onChange={(v) => setGraphicsControl('shadows', v)}
                />
                <ToggleRow
                  label="Reflejos"
                  checked={settings.reflections}
                  onChange={(v) => setGraphicsControl('reflections', v)}
                />
                <ToggleRow
                  label="Oclusión Ambiental"
                  checked={settings.ambientOcclusion}
                  onChange={(v) => setGraphicsControl('ambientOcclusion', v)}
                />
                <ToggleRow
                  label="Niebla Volumétrica"
                  checked={settings.volumetrics}
                  onChange={(v) => setGraphicsControl('volumetrics', v)}
                />
                <ToggleRow
                  label="Post-procesado Bloom"
                  checked={settings.bloom}
                  onChange={(v) => setGraphicsControl('bloom', v)}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. AUDIO & LOBBY */}
        {group === 'audio_lobby' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Audio Procedural y Música de Lobby
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mezclador Web Audio de 9 canales independientes, acústica de túneles y música ambiental del menú principal.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    audioEngine.unlock();
                    audioEngine.playSoundTest();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {t(lang, 'settings.testSound')}
                </button>
                <button
                  onClick={() => setPatch({ muted: !settings.muted })}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    settings.muted
                      ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                      : 'bg-[#0b1224] border-white/15 text-slate-200'
                  }`}
                >
                  {settings.muted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" /> Silenciado
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> Activo
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Lobby Music Toggle */}
            <div className="p-4 rounded-xl bg-[#0d162c] border border-cyan-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">
                    Música Ambiental en Menú y Lobby
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Reproduce synthwave futurista suave mientras navegas por el Garaje, Tienda y Ciudad.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.lobbyMusicEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setPatch({ lobbyMusicEnabled: enabled });
                  audioEngine.startLobbyMusicIfAllowed(enabled);
                }}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* 9 Independent Channels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(
                [
                  ['masterVolume', 'Volumen Maestro'],
                  ['musicVolume', 'Música Dinámica'],
                  ['sfxVolume', 'Efectos Parkour (SFX)'],
                  ['ambientVolume', 'Ambiente Urbano y Clima'],
                  ['voiceVolume', 'Voces y Radio'],
                  ['uiVolume', 'Interfaz y Menús'],
                  ['droneVolume', 'Drones y Robots'],
                  ['vehicleVolume', 'Vehículos y Trenes'],
                  ['chaseVolume', 'Persecución y Jefes'],
                ] as [keyof PCSettings, string][]
              ).map(([field, label]) => (
                <SliderRow
                  key={field}
                  label={label}
                  value={Number(settings[field])}
                  min={0}
                  max={1}
                  step={0.05}
                  display={`${Math.round(Number(settings[field]) * 100)}%`}
                  onChange={(v) => setPatch({ [field]: v } as Partial<PCSettings>)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 3. GAMEPLAY & CONTROLS */}
        {group === 'gameplay_controls' && (
          <div className="space-y-6">
            {/* Gameplay Subsection */}
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2.5">
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" /> Jugabilidad y Cámara
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SelectRow
                  label="Dificultad de Carrera"
                  value={settings.difficulty}
                  options={[
                    ['easy', 'Fácil (Escudo inicial y menor densidad)'],
                    ['normal', 'Normal (Equilibrada)'],
                    ['hard', 'Difícil (Alta velocidad y amenazas)'],
                  ]}
                  onChange={(v) =>
                    setPatch({ difficulty: v as DifficultyLevel })
                  }
                />
                <SelectRow
                  label="Hora del Día en Ciudades"
                  value={settings.timeOfDay}
                  options={(
                    [
                      'dynamic',
                      'dawn',
                      'morning',
                      'noon',
                      'afternoon',
                      'dusk',
                      'night',
                      'midnight',
                    ] as TimeOfDay[]
                  ).map((period) => [period, getTimeLabel(lang, period)])}
                  onChange={(v) => setPatch({ timeOfDay: v as TimeOfDay })}
                />
                <SliderRow
                  label="Campo de Visión Base (FOV)"
                  value={settings.fovBase}
                  min={55}
                  max={95}
                  step={1}
                  display={`${settings.fovBase}°`}
                  onChange={(v) => setPatch({ fovBase: v })}
                />
                <SliderRow
                  label="Distancia de Cámara"
                  value={settings.cameraDistance}
                  min={0.75}
                  max={1.35}
                  step={0.05}
                  display={`${Math.round(settings.cameraDistance * 100)}%`}
                  onChange={(v) => setPatch({ cameraDistance: v })}
                />
                <SliderRow
                  label="Respuesta de Cámara"
                  value={settings.cameraSpeed}
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  display={`${Math.round(settings.cameraSpeed * 100)}%`}
                  onChange={(v) => setPatch({ cameraSpeed: v })}
                />
                <SliderRow
                  label="Sensibilidad Lateral"
                  value={settings.movementSensitivity}
                  min={0.6}
                  max={1.5}
                  step={0.05}
                  display={`${Math.round(settings.movementSensitivity * 100)}%`}
                  onChange={(v) => setPatch({ movementSensitivity: v })}
                />
                <ToggleRow
                  label="Asistencia de Parkour"
                  checked={settings.parkourAssist}
                  onChange={(v) => setPatch({ parkourAssist: v })}
                />
                <ToggleRow
                  label="Asistencia Automática de Cámara"
                  checked={settings.cameraAssist}
                  onChange={(v) => setPatch({ cameraAssist: v })}
                />
                <ToggleRow
                  label="Clima Dinámico"
                  checked={settings.dynamicWeather}
                  onChange={(v) => setPatch({ dynamicWeather: v })}
                />
                <ToggleRow
                  label="Mapa Aleatorio (Sin Repetición)"
                  checked={Boolean(settings.randomMap)}
                  onChange={(v) => setPatch({ randomMap: v })}
                />
                <ToggleRow
                  label="Clima Aleatorio"
                  checked={Boolean(settings.randomWeather)}
                  onChange={(v) => setPatch({ randomWeather: v })}
                />
                <ToggleRow
                  label="Indicadores de Gancho / Obstáculo"
                  checked={settings.showIndicators}
                  onChange={(v) => setPatch({ showIndicators: v })}
                />
                <ToggleRow
                  label="Controles en pantalla"
                  checked={settings.showOnScreenControls !== false}
                  onChange={(v) => setPatch({ showOnScreenControls: v })}
                />
                <ToggleRow
                  label="Consejos Tutoriales"
                  checked={settings.showTutorialHints}
                  onChange={(v) => setPatch({ showTutorialHints: v })}
                />
                <ToggleRow
                  label="Subtítulos de Radio e Historia"
                  checked={settings.subtitles}
                  onChange={(v) => setPatch({ subtitles: v })}
                />
                <ToggleRow
                  label="Reducir Movimiento de Cámara"
                  checked={settings.reduceCameraMotion}
                  onChange={(v) => setPatch({ reduceCameraMotion: v })}
                />
                <ToggleRow
                  label="Telemetría FPS / Latencia en HUD"
                  checked={settings.showPerfOverlay}
                  onChange={(v) => setPatch({ showPerfOverlay: v })}
                />
                {save && onReplaceSave && (
                  <ToggleRow
                    label="Modelos Blender (.GLB) para Jefes"
                    checked={save.useCustomBossModels ?? true}
                    onChange={(v) =>
                      onReplaceSave({ ...save, useCustomBossModels: v })
                    }
                  />
                )}
              </div>

              {onStartTutorial && (
                <div className="p-3.5 rounded-xl bg-[#0d162c] border border-emerald-400/35 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-300">
                      {t(lang, 'settings.replayTutorial')}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      8 módulos interactivos esenciales: movimiento, doble salto, escudo explosivo, habilidades, dron compañero [G] y práctica infinita fácil.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      onStartTutorial();
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-xs cursor-pointer whitespace-nowrap"
                  >
                    {t(lang, 'settings.replayTutorial')}
                  </button>
                </div>
              )}
            </div>

            {/* Controls Subsection */}
            <div className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-white">
                  Controles y Teclado
                </h3>
                <button
                  onClick={() => {
                    audioEngine.playUiClick();
                    onChangeSettings({
                      ...settings,
                      controlProfile: 'default',
                      keybindings: { ...CONTROL_PROFILES.default },
                      mouseSensitivity: 1.0,
                      cameraSensitivity: 1.0,
                      invertX: false,
                      invertY: false,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t(lang, 'settings.resetControls')}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    ['default', 'Estándar (WASD)'],
                    ['competitive', 'Competitivo'],
                    ['one_hand', 'Una Mano (Flechas)'],
                    ['custom', 'Personalizado'],
                  ] as [ControlProfile, string][]
                ).map(([prof, label]) => (
                  <button
                    key={prof}
                    onClick={() => {
                      audioEngine.playUiClick();
                      setPatch({
                        controlProfile: prof,
                        keybindings: { ...CONTROL_PROFILES[prof] },
                      });
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                      settings.controlProfile === prof
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-[#0b1224] border-white/10 text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {rebindConflictMsg && (
                <div className="p-3 rounded-lg bg-rose-950/55 border border-rose-400/70 flex items-center gap-2.5 text-xs text-rose-200 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{rebindConflictMsg}</span>
                </div>
              )}

              {keyConflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-400/60 flex items-center gap-2.5 text-xs text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Conflicto de teclas: {keyConflicts.join(' · ')}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {(Object.keys(KEY_LABELS) as (keyof KeyBindings)[]).map(
                  (action) => {
                    const isListening = rebindingKey === action;
                    return (
                      <div
                        key={action}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0b1224] border border-white/10"
                      >
                        <span className="text-xs font-medium text-slate-200">
                          {KEY_LABELS[action]}
                        </span>
                        <button
                          onClick={() => {
                            audioEngine.playUiClick();
                            setRebindingKey(isListening ? null : action);
                          }}
                          className={`px-3 py-1 rounded text-xs font-mono-num font-bold border cursor-pointer min-w-[100px] text-center ${
                            isListening
                              ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                              : 'bg-[#070b17] border-white/15 text-cyan-300 hover:border-cyan-400'
                          }`}
                        >
                          {isListening
                            ? 'Pulsa tecla...'
                            : formatKeyCode(settings.keybindings[action])}
                        </button>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SliderRow
                  label="Sensibilidad de Ratón"
                  value={settings.mouseSensitivity}
                  min={0.3}
                  max={2.0}
                  step={0.05}
                  display={`${Math.round(settings.mouseSensitivity * 100)}%`}
                  onChange={(v) => setPatch({ mouseSensitivity: v })}
                />
                <SliderRow
                  label="Sensibilidad de Cámara"
                  value={settings.cameraSensitivity}
                  min={0.3}
                  max={2.0}
                  step={0.05}
                  display={`${Math.round(settings.cameraSensitivity * 100)}%`}
                  onChange={(v) => setPatch({ cameraSensitivity: v })}
                />
                <ToggleRow
                  label="Invertir Eje Y"
                  checked={settings.invertY}
                  onChange={(v) => setPatch({ invertY: v })}
                />
                <ToggleRow
                  label="Invertir Eje X"
                  checked={settings.invertX}
                  onChange={(v) => setPatch({ invertX: v })}
                />
                <ToggleRow
                  label="Soporte de Mando (Gamepad)"
                  checked={settings.gamepadEnabled}
                  onChange={(v) => setPatch({ gamepadEnabled: v })}
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. SYSTEM, LANGUAGE, ACCESSIBILITY, DIAGNOSTICS & BACKUP */}
        {group === 'system_backup' && (
          <div className="space-y-6">
            {/* Language (Only 100%-complete languages per §22.5) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <h3 className="font-display text-xl font-bold text-white">
                  Idioma y Accesibilidad
                </h3>
                <span className="text-[11px] text-slate-400">
                  Selector filtrado únicamente a idiomas con cobertura al 100%
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {SELECTABLE_LANGUAGES.map((l) => {
                  const active = settings.language === l.code;
                  const coveragePct = getLanguageCoveragePercent(l.code);
                  return (
                    <button
                      key={l.code}
                      onClick={() => {
                        audioEngine.playUiClick(true);
                        setPatch({ language: l.code });
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-[#0b1224] border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {l.nativeName}
                        </div>
                        <div className="text-[10px] text-cyan-300 font-mono-num">
                          {l.code.toUpperCase()} · {coveragePct}% traducido
                        </div>
                      </div>
                      {active && <Check className="w-3.5 h-3.5 text-cyan-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accessibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelectRow
                label="Filtro de Daltonismo"
                value={settings.colorblindMode}
                options={[
                  ['none', 'Desactivado'],
                  ['deuteranopia', 'Deuteranopia'],
                  ['protanopia', 'Protanopia'],
                  ['tritanopia', 'Tritanopia'],
                ]}
                onChange={(v) =>
                  setPatch({ colorblindMode: v as PCSettings['colorblindMode'] })
                }
              />
              <SelectRow
                label="Tamaño de HUD"
                value={settings.hudScale}
                options={[
                  ['compact', 'Compacto'],
                  ['normal', 'Estándar'],
                  ['large', 'Grande'],
                ]}
                onChange={(v) =>
                  setPatch({ hudScale: v as PCSettings['hudScale'] })
                }
              />
              <SelectRow
                label="Tamaño de Texto"
                value={settings.textSize}
                options={[
                  ['small', 'Pequeño'],
                  ['normal', 'Normal'],
                  ['large', 'Grande'],
                ]}
                onChange={(v) =>
                  setPatch({ textSize: v as PCSettings['textSize'] })
                }
              />
              <SelectRow
                label="Subtítulos"
                value={settings.subtitleScale}
                options={[
                  ['normal', 'Normal'],
                  ['large', 'Grande'],
                ]}
                onChange={(v) =>
                  setPatch({ subtitleScale: v as PCSettings['subtitleScale'] })
                }
              />
              <ToggleRow
                label="Modo Alto Contraste"
                checked={settings.highContrast}
                onChange={(v) => setPatch({ highContrast: v })}
              />
              <ToggleRow
                label="Tipografía de Alta Legibilidad"
                checked={settings.legibleFont}
                onChange={(v) => setPatch({ legibleFont: v })}
              />
              <ToggleRow
                label="Reducir Destellos Luminosos"
                checked={settings.reduceFlashes}
                onChange={(v) => setPatch({ reduceFlashes: v })}
              />
              <ToggleRow
                label="Reducir Efectos en HUD"
                checked={settings.reduceVisualEffects}
                onChange={(v) => setPatch({ reduceVisualEffects: v })}
              />
            </div>

            {/* PC Diagnostics & Benchmark */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-display text-lg font-bold text-white">
                    Diagnóstico de Hardware PC
                  </h4>
                  <p className="text-xs text-slate-400">
                    {diagnostics.gpuRenderer} · {diagnostics.cpuThreads} hilos ·{' '}
                    {liveHud.fps} FPS ({liveHud.frameTimeMs.toFixed(1)} ms)
                  </p>
                </div>
                <button
                  disabled={benchRunning}
                  onClick={triggerBenchmark}
                  className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  {benchRunning
                    ? 'Midendo 90 fotogramas...'
                    : 'Ejecutar Benchmark en Vivo'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                <DiagRow
                  label="GPU / VRAM Est."
                  value={`${diagnostics.gpuTier.toUpperCase()} · ${
                    diagnostics.estimatedVramGb !== null
                      ? `${diagnostics.estimatedVramGb} GB VRAM est.`
                      : 'Compartida'
                  }`}
                />
                <DiagRow
                  label="Resolución y WebGL"
                  value={`${diagnostics.screenWidth}×${diagnostics.screenHeight} · WebGL2 ${
                    diagnostics.webgl2Supported ? 'OK' : 'No'
                  } · Pres. ${diagnostics.recommendedQuality.toUpperCase()}`}
                />
              </div>
            </div>

            {/* Official GitHub Releases Auto-Updater */}
            <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/35 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Actualizador Oficial (GitHub Releases)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Repositorio público: CynexStudios/metro-Rush-online · Conserva tus perfiles y base SQLite en %APPDATA%.
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-white">
                  Instalada v{GAME_VERSION}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {onCheckForUpdates && (
                  <button
                    disabled={updateState?.status === 'checking' || updateState?.status === 'downloading'}
                    onClick={() => {
                      audioEngine.playUiClick();
                      void onCheckForUpdates();
                    }}
                    className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        updateState?.status === 'checking' ? 'animate-spin' : ''
                      }`}
                    />
                    {updateState?.status === 'checking'
                      ? 'Comprobando...'
                      : 'Buscar Actualizaciones'}
                  </button>
                )}

                {updateInfo?.hasUpdate &&
                  updateInfo.downloadUrl &&
                  onDownloadUpdate &&
                  updateState?.status !== 'ready_to_install' && (
                    <button
                      disabled={
                        updateState?.status === 'downloading' ||
                        updateState?.status === 'verifying'
                      }
                      onClick={() => {
                        audioEngine.playUiClick(true);
                        void onDownloadUpdate(updateInfo);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar v{updateInfo.latestVersion}
                    </button>
                  )}

                {updateState?.status === 'ready_to_install' && onInstallUpdate && (
                  <button
                    onClick={() => {
                      audioEngine.playPurchaseConfirm();
                      void onInstallUpdate();
                    }}
                    className="px-3.5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Instalar y Reiniciar (Conserva SQLite)
                  </button>
                )}

                <a
                  href={
                    updateInfo?.releaseUrl ||
                    'https://github.com/CynexStudios/metro-Rush-online/releases'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    const target =
                      updateInfo?.releaseUrl ||
                      'https://github.com/CynexStudios/metro-Rush-online/releases';
                    if (window.metroDesktop?.openExternalUrl) {
                      e.preventDefault();
                      void window.metroDesktop.openExternalUrl(target);
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-[#070b17] hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" /> Abrir GitHub Releases
                </a>
              </div>

              {(updateState?.status === 'downloading' ||
                updateState?.status === 'verifying' ||
                updateState?.status === 'ready_to_install') && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono-num text-slate-300">
                    <span>{updateState.message}</span>
                    <span>
                      {updateState.progressPercent.toFixed(0)}% (
                      {(updateState.downloadedBytes / 1048576).toFixed(1)} /{' '}
                      {(updateState.totalBytes / 1048576).toFixed(1)} MB)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{ width: `${Math.min(100, updateState.progressPercent)}%` }}
                    />
                  </div>
                </div>
              )}

              {updateInfo && (
                <div className="p-2.5 rounded-lg bg-[#070b17] border border-white/10 text-[11px] text-slate-300 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-white">
                      {updateInfo.hasUpdate
                        ? `Nueva versión disponible: v${updateInfo.latestVersion}`
                        : `Estás al día (última versión conocida: v${updateInfo.latestVersion})`}
                    </span>
                    {updateInfo.sha256 && (
                      <span className="font-mono-num text-[10px] text-emerald-300">
                        SHA-256: {updateInfo.sha256.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                  {updateInfo.releaseNotes && (
                    <div className="text-slate-400 line-clamp-2">
                      {updateInfo.releaseNotes}
                    </div>
                  )}
                </div>
              )}

              {updateState?.message && updateState.status !== 'downloading' && (
                <div
                  className={`text-xs font-semibold ${
                    updateState.status === 'error' ? 'text-rose-300' : 'text-cyan-200'
                  }`}
                >
                  {updateState.message}
                </div>
              )}
            </div>

            {/* Save Backup & Reset Settings */}
            <div className="p-4 rounded-xl bg-[#0b1224] border border-white/15 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">
                    Copia de Seguridad y Restablecimiento (Save v5)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Exporta o restaura tu perfil en JSON con retrocompatibilidad v3–v5, o restablece ajustes gráficos/sonido por defecto.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenCredits && (
                    <button
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        onOpenCredits();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0d1830] hover:bg-[#152548] border border-cyan-400/45 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Award className="w-3.5 h-3.5 text-cyan-400" />
                      {t(lang, 'settings.openCredits')}
                    </button>
                  )}
                  <span className="font-mono-num text-[11px] text-cyan-300 font-bold">
                    v{GAME_VERSION}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {save && (
                  <button
                    onClick={handleExportBackup}
                    className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar Respaldo JSON
                  </button>
                )}

                {save && onReplaceSave && (
                  <label className="px-3.5 py-2 rounded-lg bg-[#070b17] hover:bg-white/10 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" /> Importar JSON
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImportBackup(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}

                {save && onReplaceSave && (
                  <button
                    onClick={() => {
                      audioEngine.playUiClick();
                      const clean = resetSettingsToDefault(save);
                      onReplaceSave(clean);
                      setBackupNotice({
                        ok: true,
                        msg: 'Ajustes gráficos, audio y controles restablecidos a fábrica.',
                      });
                    }}
                    className="px-3.5 py-2 rounded-lg border border-rose-400/50 hover:bg-rose-500/20 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restablecer Ajustes
                  </button>
                )}
              </div>

              {backupNotice && (
                <div
                  className={`text-xs font-semibold ${
                    backupNotice.ok ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {backupNotice.msg}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0b1224] border border-white/10 cursor-pointer hover:border-white/25">
    <span className="text-xs font-medium text-slate-200 pr-3">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        audioEngine.playUiClick();
        onChange(e.target.checked);
      }}
      className="accent-cyan-400 w-4 h-4 shrink-0"
    />
  </label>
);

const SelectRow: React.FC<{
  label: string;
  value: string;
  options: [string, string][];
  onChange: (val: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-[#0b1224] border border-white/10">
    <span className="text-xs font-medium text-slate-200">{label}</span>
    <select
      value={value}
      onChange={(e) => {
        audioEngine.playUiClick();
        onChange(e.target.value);
      }}
      className="bg-[#070b17] border border-white/15 rounded px-2.5 py-1.5 text-xs text-white max-w-[190px] outline-none focus:border-cyan-400"
    >
      {options.map(([val, lbl]) => (
        <option key={val} value={val}>
          {lbl}
        </option>
      ))}
    </select>
  </div>
);

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step, display, onChange }) => (
  <div className="px-3.5 py-2.5 rounded-lg bg-[#0b1224] border border-white/10 space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-slate-200">{label}</span>
      <span className="font-mono-num text-cyan-300 font-bold">{display}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-cyan-400"
    />
  </div>
);

const DiagRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="p-3 rounded-lg bg-[#0b1224] border border-white/10">
    <div className="text-[11px] text-slate-400">{label}</div>
    <div className="font-mono-num text-xs font-semibold text-white mt-0.5 break-words">
      {value}
    </div>
  </div>
);
