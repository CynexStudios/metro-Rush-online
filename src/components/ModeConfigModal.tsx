import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  Flame,
  Layers,
  Lock,
  Play,
  Shuffle,
  Sliders,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BOSSES,
  DEFAULT_FREE_RUN_CONFIG,
  DISTRICTS,
  getBossUnlockRequirement,
  getDistrictById,
  getStoryChapterByNum,
  isBossUnlocked,
  LIVE_EVENTS,
  STORY_CHAPTERS,
} from '../game/data';
import {
  BossId,
  DifficultyLevel,
  DistrictId,
  FreeRunConfig,
  GameMode,
  LiveEventDef,
  ModeLaunchConfig,
  PlayerSaveData,
  WeatherType,
} from '../game/types';
import { getCityLabel, getModeLabel, t } from '../i18n';

interface ModeConfigModalProps {
  mode: GameMode;
  save: PlayerSaveData;
  initialBossId?: BossId;
  initialSubTab?: 'bosses' | 'events';
  onClose: () => void;
  onUpdateSave: (next: PlayerSaveData) => void;
  onLaunchMode: (config: ModeLaunchConfig) => void;
  onLaunchEvent: (evt: LiveEventDef) => void;
}

const TIME_TRIAL_MILESTONES = [45, 60, 75, 90, 120, 150, 180];

export const ModeConfigModal: React.FC<ModeConfigModalProps> = ({
  mode,
  save,
  initialBossId,
  initialSubTab = 'bosses',
  onClose,
  onUpdateSave,
  onLaunchMode,
  onLaunchEvent,
}) => {
  const lang = save.settings.language;
  const unlockedCities = DISTRICTS.filter((d) =>
    save.unlockedDistricts.includes(d.id),
  );

  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    save.settings.difficulty,
  );
  const [selectedCity, setSelectedCity] = useState<DistrictId>(
    save.selectedDistrictId,
  );
  const [randomCityWeighted, setRandomCityWeighted] = useState<boolean>(
    Boolean(save.settings.randomMap),
  );
  const [selectedChapter, setSelectedChapter] = useState<number>(
    Math.min(5, Math.max(1, save.storyChapter)),
  );
  const [bossSubTab, setBossSubTab] = useState<'bosses' | 'events'>(
    initialSubTab,
  );
  const [selectedBossId, setSelectedBossId] = useState<BossId>(
    initialBossId ?? 'titan_drone',
  );
  const [freeRun, setFreeRun] = useState<FreeRunConfig>(
    save.freeRunConfig ?? {
      ...DEFAULT_FREE_RUN_CONFIG,
      districtId: save.selectedDistrictId,
      difficulty: save.settings.difficulty,
    },
  );

  useEffect(() => {
    setBossSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (initialBossId) {
      setSelectedBossId(initialBossId);
    }
  }, [initialBossId]);

  const modeMeta = getModeLabel(lang, mode);
  const chapterDef = getStoryChapterByNum(selectedChapter);
  const activeBoss =
    BOSSES.find((b) => b.id === selectedBossId) ?? BOSSES[0];
  const activeBossUnlocked = isBossUnlocked(
    activeBoss.id,
    save.defeatedBosses,
  );
  const bossReq = getBossUnlockRequirement(activeBoss.id);

  const timeTrialBestSec = Math.floor(
    save.timeTrialBestByCity?.[selectedCity] ?? 0,
  );
  const nextMilestoneSec = useMemo(() => {
    return (
      TIME_TRIAL_MILESTONES.find((m) => m > timeTrialBestSec) ??
      Math.ceil((timeTrialBestSec + 30) / 30) * 30
    );
  }, [timeTrialBestSec]);

  const handleLaunch = () => {
    audioEngine.playUiClick(true);
    if (mode === 'freerun') {
      onUpdateSave({
        ...save,
        freeRunConfig: freeRun,
        selectedMode: 'freerun',
        selectedDistrictId: freeRun.districtId,
      });
      onLaunchMode({
        mode: 'freerun',
        districtId: freeRun.districtId,
        randomCity: freeRun.randomCity,
        difficulty: freeRun.difficulty,
        freeRunConfig: freeRun,
      });
      return;
    }
    if (mode === 'story') {
      onLaunchMode({
        mode: 'story',
        districtId: chapterDef.districtId,
        storyChapter: chapterDef.chapter,
        difficulty,
        bossId: chapterDef.bossId ?? null,
      });
      return;
    }
    if (mode === 'bosschase') {
      if (bossSubTab === 'bosses') {
        if (!activeBossUnlocked) return;
        onLaunchMode({
          mode: 'bosschase',
          districtId: activeBoss.cityId,
          bossId: activeBoss.id,
          difficulty,
        });
      }
      return;
    }
    if (mode === 'timetrial') {
      onLaunchMode({
        mode: 'timetrial',
        districtId: selectedCity,
        difficulty,
      });
      return;
    }
    if (mode === 'parkour') {
      onLaunchMode({
        mode: 'parkour',
        districtId: selectedCity,
        randomCity: randomCityWeighted,
        difficulty,
      });
      return;
    }
    onLaunchMode({
      mode: 'endless',
      districtId: selectedCity,
      randomCity: randomCityWeighted,
      difficulty,
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        audioEngine.playUiClick();
        onClose();
      } else if (e.key === 'Enter' && !(mode === 'bosschase' && bossSubTab === 'events')) {
        const activeTag = (document.activeElement?.tagName ?? '').toLowerCase();
        if (activeTag === 'button' || activeTag === 'select' || activeTag === 'input') {
          return;
        }
        e.preventDefault();
        handleLaunch();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const ModeIcon =
    mode === 'story'
      ? BookOpen
      : mode === 'timetrial'
        ? Timer
        : mode === 'bosschase'
          ? Swords
          : mode === 'parkour'
            ? Layers
            : mode === 'freerun'
              ? Compass
              : Flame;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#040712]/90 p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={modeMeta.label}
    >
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#080d1c] border border-cyan-400/45 rounded-2xl overflow-hidden animate-menu-enter">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0b1224] border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 shrink-0">
              <ModeIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-widest text-cyan-300 uppercase">
                NEON OVERDRIVE v7.0.1 · {mode.toUpperCase()}
              </div>
              <h2 className="font-display text-2xl font-bold text-white truncate">
                {modeMeta.label}
              </h2>
              <p className="text-xs text-slate-300 truncate">{modeMeta.desc}</p>
            </div>
          </div>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onClose();
            }}
            className="p-2 rounded-lg bg-[#070b17] border border-white/15 hover:border-cyan-400 text-slate-300 hover:text-white cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
            aria-label={t(lang, 'common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ENDLESS OR EXTREME PARKOUR */}
          {(mode === 'endless' || mode === 'parkour') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      {t(lang, 'modeCfg.city')}
                    </span>
                    <button
                      onClick={() => {
                        audioEngine.playUiClick();
                        setRandomCityWeighted((v) => !v);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        randomCityWeighted
                          ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200'
                          : 'bg-[#070b17] border-white/15 text-slate-300'
                      }`}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      {randomCityWeighted
                        ? t(lang, 'modeCfg.randomWeighted')
                        : t(lang, 'modeCfg.specificCity')}
                    </button>
                  </div>

                  {!randomCityWeighted ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                      {unlockedCities.map((c) => {
                        const lbl = getCityLabel(lang, c.id);
                        const active = selectedCity === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              audioEngine.playUiClick();
                              setSelectedCity(c.id);
                            }}
                            className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-cyan-500/15 border-cyan-400 text-white'
                                : 'bg-[#070b17] border-white/10 text-slate-300 hover:border-white/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display font-bold text-sm truncate">
                                {lbl.name}
                              </span>
                              <span className="font-mono-num text-[10px] text-cyan-300 shrink-0">
                                {c.laneCount} carriles
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {lbl.sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#070b17] border border-fuchsia-500/35 text-xs text-slate-200 space-y-1.5">
                      <div className="font-bold text-fuchsia-300 flex items-center gap-1.5">
                        <Shuffle className="w-4 h-4" /> Selección Aleatoria Ponderada Activa
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        El sistema sorteará una de tus {unlockedCities.length} ciudades desbloqueadas favoreciendo el regreso frecuente de <strong className="text-cyan-300">Cyber Underground</strong> y evitando repeticiones inmediatas.
                      </p>
                    </div>
                  )}
                </div>

                {/* Difficulty */}
                <div className="p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-2.5">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {t(lang, 'modeCfg.difficulty')}
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        ['easy', 'Fácil', 'Menor densidad, reflejos relajados'],
                        ['normal', 'Normal', 'Equilibrio estándar Overdrive'],
                        ['hard', 'Difícil', 'Alta velocidad + recompensas x1.25'],
                      ] as [DifficultyLevel, string, string][]
                    ).map(([id, title, sub]) => (
                      <button
                        key={id}
                        onClick={() => {
                          audioEngine.playUiClick();
                          setDifficulty(id);
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          difficulty === id
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-[#070b17] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="font-display font-bold text-sm">{title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Summary Column */}
              <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-4 flex flex-col justify-between">
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-[11px] font-bold text-cyan-300 uppercase">
                      {t(lang, 'modeCfg.objective')}
                    </div>
                    <p className="text-slate-200 mt-1 leading-relaxed">
                      {mode === 'parkour'
                        ? 'Encadena wall-runs, barras de giro, saltadores y doble planta aérea multiplicando tu combo.'
                        : 'Sobrevive indefinidamente mientras la velocidad escala cada 300m y cambias de distrito.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-1">
                    <div className="text-slate-400">{t(lang, 'modeCfg.record')}</div>
                    <div className="font-mono-num text-lg font-bold text-white">
                      {save.stats.bestScore.toLocaleString('es-ES')} pts ·{' '}
                      {save.stats.bestDistance.toLocaleString('es-ES')} m
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase">
                      {t(lang, 'modeCfg.specialRules')}
                    </div>
                    <p className="text-slate-300 mt-1">
                      {mode === 'parkour'
                        ? 'Pasarelas elevadas de 2ª planta activas + asistencia de agarre y doble salto reconstruido.'
                        : 'Eventos dinámicos en tiempo real, escudos con onda expansiva y aparición ocasional de Jefes.'}
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-amber-300 uppercase">
                      {t(lang, 'modeCfg.rewards')}
                    </div>
                    <p className="text-slate-300 mt-1">
                      Monedas, Gemas en cofres y robots élite, XP de Cuenta y XP del Pase de Corredor.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLaunch}
                  className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {t(lang, 'modeCfg.launchRun')}
                </button>
              </div>
            </div>
          )}

          {/* STORY MODE */}
          {mode === 'story' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  {t(lang, 'modeCfg.chapters')} (5)
                </div>
                {STORY_CHAPTERS.map((ch) => {
                  const unlocked = ch.chapter <= Math.max(1, save.storyChapter);
                  const active = selectedChapter === ch.chapter;
                  return (
                    <button
                      key={ch.chapter}
                      disabled={!unlocked}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setSelectedChapter(ch.chapter);
                      }}
                      className={`w-full p-3 rounded-xl border text-left cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-[#0b1224] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{ch.title}</span>
                        {!unlocked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {getCityLabel(lang, ch.districtId).name} · Meta {ch.targetDistance}m
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-2 p-5 rounded-xl bg-[#0b1224] border border-cyan-500/35 flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="text-xs font-bold text-fuchsia-300">
                        Capítulo {chapterDef.chapter} · {getDistrictById(chapterDef.districtId).name}
                      </div>
                      <h3 className="font-display text-xl font-bold text-white">
                        {chapterDef.title}
                      </h3>
                    </div>
                    {chapterDef.bossId && (
                      <span className="text-xs font-bold text-rose-300 font-mono-num">
                        Jefe Final: {BOSSES.find((b) => b.id === chapterDef.bossId)?.name}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-200 leading-relaxed">
                    {chapterDef.briefing}
                  </p>

                  <div className="p-3.5 rounded-xl bg-[#070b17] border border-white/10 text-xs space-y-1.5">
                    <div className="font-bold text-cyan-300">
                      {t(lang, 'modeCfg.chapterObjective')}: {chapterDef.objectiveLabel}
                    </div>
                    <div className="text-slate-400">
                      Recompensas: +{chapterDef.rewardCoins} M · +{chapterDef.rewardGems} G · +{chapterDef.rewardTickets} Tiques
                    </div>
                  </div>

                  {chapterDef.dialogueBeats.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#070b17] border border-fuchsia-400/30 text-xs space-y-1">
                      <div className="text-[11px] font-bold text-fuchsia-300 uppercase">
                        {t(lang, 'modeCfg.dialoguePreview')}
                      </div>
                      <div className="text-slate-200">
                        <strong className="text-cyan-300">
                          {chapterDef.dialogueBeats[0].speaker}:
                        </strong>{' '}
                        “{chapterDef.dialogueBeats[0].text}”
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLaunch}
                  className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" /> Desplegar Capítulo {chapterDef.chapter}
                </button>
              </div>
            </div>
          )}

          {/* TIME TRIAL (45s SURVIVAL + ORBS) */}
          {mode === 'timetrial' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 p-4 rounded-xl bg-[#0b1224] border border-white/10 space-y-3">
                <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Selecciona Ciudad para Contrarreloj
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {unlockedCities.map((c) => {
                    const pb = Math.floor(save.timeTrialBestByCity?.[c.id] ?? 0);
                    const active = selectedCity === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          audioEngine.playUiClick();
                          setSelectedCity(c.id);
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-[#070b17] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-sm truncate">
                            {getCityLabel(lang, c.id).name}
                          </span>
                          <span className="font-mono-num text-[11px] text-amber-300 font-bold shrink-0">
                            {pb > 0 ? `${pb}s PB` : 'Sin marca'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {c.laneCount} carriles · Dificultad {c.difficulty}/10
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/35 flex flex-col justify-between gap-4">
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#070b17] border border-cyan-400/30 space-y-1">
                    <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Timer className="w-4 h-4" /> Supervivencia de 45 Segundos
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Inicias con <strong className="text-white">45.0s</strong>. Captura <strong className="text-emerald-300">Orbes Temporales (+4.5s)</strong> en los carriles para extender tu supervivencia sin límite fijo.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-1 font-mono-num">
                    <div className="text-slate-400">{t(lang, 'modeCfg.cityPb')}</div>
                    <div className="text-xl font-bold text-white">
                      {timeTrialBestSec > 0 ? `${timeTrialBestSec}s` : '0s'}
                    </div>
                    <div className="text-[11px] text-amber-300">
                      {t(lang, 'modeCfg.nextMilestone')}: {nextMilestoneSec}s (+Monedas y Gemas)
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLaunch}
                  className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Zap className="w-4 h-4" /> Iniciar Contrarreloj (45s)
                </button>
              </div>
            </div>
          )}

          {/* BOSS ASSAULT + INTEGRATED EVENTS (§9.4) */}
          {mode === 'bosschase' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex gap-1.5 bg-[#070b17] p-1 rounded-lg border border-white/10">
                  <button
                    onClick={() => {
                      audioEngine.playUiClick();
                      setBossSubTab('bosses');
                    }}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      bossSubTab === 'bosses'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" /> {t(lang, 'modeCfg.bossSubTab')} (8)
                  </button>
                  <button
                    onClick={() => {
                      audioEngine.playUiClick();
                      setBossSubTab('events');
                    }}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      bossSubTab === 'events'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" /> {t(lang, 'modeCfg.eventsSubTab')} ({LIVE_EVENTS.length})
                  </button>
                </div>

                <div className="text-xs font-mono-num text-slate-400">
                  Jefes Derrotados: <strong className="text-emerald-300">{save.defeatedBosses.length}/8</strong>
                </div>
              </div>

              {bossSubTab === 'bosses' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {BOSSES.map((b) => {
                      const unlocked = isBossUnlocked(b.id, save.defeatedBosses);
                      const defeated = save.defeatedBosses.includes(b.id);
                      const active = selectedBossId === b.id;
                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            audioEngine.playUiClick();
                            setSelectedBossId(b.id);
                          }}
                          className={`w-full p-3 rounded-xl border text-left cursor-pointer ${
                            active
                              ? 'bg-rose-500/15 border-rose-400 text-white'
                              : 'bg-[#0b1224] border-white/10 text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="truncate">{b.name}</span>
                            {defeated ? (
                              <span className="text-emerald-300 shrink-0">Derrotado</span>
                            ) : !unlocked ? (
                              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <span className="text-cyan-300 shrink-0">Disponible</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {b.title} · {getDistrictById(b.cityId).name}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="lg:col-span-2 p-5 rounded-xl bg-[#0b1224] border border-rose-500/35 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-rose-300">{activeBoss.title}</div>
                          <h3 className="font-display text-2xl font-bold text-white">
                            {activeBoss.name}
                          </h3>
                        </div>
                        <div className="font-mono-num text-xs text-amber-300 font-bold">
                          +{activeBoss.rewardCoins.toLocaleString('es-ES')} M · +{activeBoss.rewardGems} G
                        </div>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed">{activeBoss.description}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {activeBoss.phasesConfig.map((p) => (
                          <div
                            key={p.phase}
                            className="p-2.5 rounded-lg bg-[#070b17] border border-white/10"
                          >
                            <div className="font-bold text-cyan-300">
                              {p.name} ({p.supportDroneCount} drones)
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{p.description}</div>
                          </div>
                        ))}
                      </div>

                      {!activeBossUnlocked && bossReq && (
                        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-400/50 text-xs text-amber-200 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            Derrota primero a <strong className="text-white">{bossReq.name}</strong> para desbloquear este asalto.
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      disabled={!activeBossUnlocked}
                      onClick={handleLaunch}
                      className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Swords className="w-4 h-4" />
                      {activeBossUnlocked
                        ? `Enfrentar a ${activeBoss.name} (4 Fases)`
                        : 'Jefe Bloqueado'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {LIVE_EVENTS.map((evt) => {
                    const done = save.completedEvents.includes(evt.id);
                    return (
                      <div
                        key={evt.id}
                        className="p-4 rounded-xl bg-[#0b1224] border border-white/15 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-fuchsia-300">
                            <span>{evt.subtitle}</span>
                            <span>{evt.modifierTag}</span>
                          </div>
                          <h3 className="font-display text-lg font-bold text-white">{evt.title}</h3>
                          <p className="text-xs text-slate-300">{evt.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <span className="font-mono-num text-xs text-amber-300 font-bold">
                            +{evt.rewardCoins} M · +{evt.rewardGems} G
                          </span>
                          <button
                            onClick={() => {
                              audioEngine.playUiClick(true);
                              onLaunchEvent(evt);
                            }}
                            className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
                          >
                            {done ? 'Rejugar Evento' : 'Iniciar Evento'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FREE RUN SANDBOX (§9.5) */}
          {mode === 'freerun' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-white">{t(lang, 'modeCfg.freerunCityMode')}</span>
                    <button
                      onClick={() =>
                        setFreeRun((prev) => ({ ...prev, randomCity: !prev.randomCity }))
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                        freeRun.randomCity
                          ? 'bg-fuchsia-500/25 text-fuchsia-200'
                          : 'bg-cyan-500/20 text-cyan-200'
                      }`}
                    >
                      {freeRun.randomCity ? 'Aleatoria (Subway Bias)' : 'Fija'}
                    </button>
                  </label>
                  <select
                    disabled={freeRun.randomCity}
                    value={freeRun.districtId}
                    onChange={(e) =>
                      setFreeRun((prev) => ({
                        ...prev,
                        districtId: e.target.value as DistrictId,
                      }))
                    }
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white disabled:opacity-45"
                  >
                    {unlockedCities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {getCityLabel(lang, c.id).name} ({c.laneCount}c)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-white">{t(lang, 'modeCfg.freerunWeather')}</span>
                    <button
                      onClick={() =>
                        setFreeRun((prev) => ({ ...prev, randomWeather: !prev.randomWeather }))
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                        freeRun.randomWeather
                          ? 'bg-fuchsia-500/25 text-fuchsia-200'
                          : 'bg-cyan-500/20 text-cyan-200'
                      }`}
                    >
                      {freeRun.randomWeather ? t(lang, 'modeCfg.freerunRandomWeather') : 'Manual'}
                    </button>
                  </label>
                  <select
                    disabled={freeRun.randomWeather}
                    value={freeRun.weather}
                    onChange={(e) =>
                      setFreeRun((prev) => ({
                        ...prev,
                        weather: e.target.value as WeatherType,
                      }))
                    }
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white disabled:opacity-45"
                  >
                    <option value="clear">Despejado Neón</option>
                    <option value="rain">Lluvia Eléctrica</option>
                    <option value="cyberfog">Niebla Ciber</option>
                    <option value="storm">Tormenta</option>
                    <option value="sunset">Atardecer Dorado</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
                  <div className="font-bold text-white">{t(lang, 'modeCfg.difficulty')}</div>
                  <select
                    value={freeRun.difficulty}
                    onChange={(e) =>
                      setFreeRun((prev) => ({
                        ...prev,
                        difficulty: e.target.value as DifficultyLevel,
                      }))
                    }
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="easy">Fácil</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Difícil</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
                  <div className="font-bold text-white">{t(lang, 'modeCfg.freerunObstacleDensity')}</div>
                  <select
                    value={freeRun.obstacleDensity}
                    onChange={(e) =>
                      setFreeRun((prev) => ({
                        ...prev,
                        obstacleDensity: e.target.value as FreeRunConfig['obstacleDensity'],
                      }))
                    }
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="low">Baja (Entrenamiento)</option>
                    <option value="normal">Estándar</option>
                    <option value="high">Alta Densidad</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
                  <div className="font-bold text-white">{t(lang, 'modeCfg.freerunEventFreq')}</div>
                  <select
                    value={freeRun.eventFrequency}
                    onChange={(e) =>
                      setFreeRun((prev) => ({
                        ...prev,
                        eventFrequency: e.target.value as FreeRunConfig['eventFrequency'],
                      }))
                    }
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="off">Desactivados</option>
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Intensa</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
                  <div className="font-bold text-white">{t(lang, 'modeCfg.freerunPowerupFreq')}</div>
                  <select
                    value={freeRun.powerupFrequency}
                    onChange={(e) =>
                      setFreeRun((prev) => ({
                        ...prev,
                        powerupFrequency: e.target.value as FreeRunConfig['powerupFrequency'],
                      }))
                    }
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="scarce">Escasa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Abundante</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
                  <div className="font-bold text-white">{t(lang, 'modeCfg.freerunSpecialRule')}</div>
                  <select
                    value={freeRun.specialRule}
                    onChange={(e) =>
                      setFreeRun((prev) => ({
                        ...prev,
                        specialRule: e.target.value as FreeRunConfig['specialRule'],
                      }))
                    }
                    className="w-full bg-[#070b17] border border-white/15 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="none">Ninguna (Reglas Base)</option>
                    <option value="low_gravity">Gravedad Lunar (Saltos Altos)</option>
                    <option value="hyper_parkour">Parkour Hiper-Veloz</option>
                    <option value="shield_blitz">Blitz de Escudos Reactivos</option>
                    <option value="underground_focus">Enfoque Túneles Subterráneos</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{t(lang, 'modeCfg.freerunBosses')}</div>
                    <div className="text-[11px] text-slate-400">
                      Permitir emboscadas aleatorias de Jefes
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={freeRun.bossesEnabled}
                    onChange={(e) =>
                      setFreeRun((prev) => ({ ...prev, bossesEnabled: e.target.checked }))
                    }
                    className="accent-cyan-400 w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/35 flex flex-col justify-between gap-4 text-xs">
                <div className="space-y-3">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5 uppercase">
                    <Sliders className="w-4 h-4" /> Resumen Sandbox
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Tu configuración personalizada se guarda automáticamente en tu perfil y se aplica al instante al pulsar Iniciar.
                  </p>
                  <div className="p-3 rounded-lg bg-[#070b17] border border-white/10 space-y-1 font-mono-num text-[11px] text-slate-200">
                    <div>
                      Mapa:{' '}
                      {freeRun.randomCity
                        ? 'Aleatorio (Bias Underground)'
                        : getCityLabel(lang, freeRun.districtId).name}
                    </div>
                    <div>Clima: {freeRun.randomWeather ? 'Aleatorio' : freeRun.weather}</div>
                    <div>Jefes: {freeRun.bossesEnabled ? 'Activados' : 'Desactivados'}</div>
                    <div>Regla: {freeRun.specialRule}</div>
                  </div>
                </div>

                <button
                  onClick={handleLaunch}
                  className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" /> Iniciar Modo Libre
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
