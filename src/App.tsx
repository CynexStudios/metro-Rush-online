import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Globe, RotateCcw } from 'lucide-react';
import { GameHud } from './components/GameHud';
import { MainMenuModal, MenuTab } from './components/MainMenuModal';
import { PauseModal, ResultsModal } from './components/PauseResultsModal';
import { ReviveModal } from './components/ReviveModal';
import { SettingsCategory } from './components/SettingsView';
import { TitleOverlay } from './components/TitleOverlay';
import { audioEngine } from './game/audio';
import { DISTRICTS, getDistrictById, STORY_CHAPTERS } from './game/data';
import { consumeReviveTokens, consumeTalisman } from './game/economy';
import {
  ConsumableEventKind,
  MetroRushEngine,
  ShowcaseMode,
} from './game/engine';
import { detectHardwareProfile } from './game/hardware';
import {
  applyRunToSave,
  loadSaveData,
  persistSaveData,
  RunTelemetry,
} from './game/storage';
import {
  BossId,
  DistrictId,
  GameMode,
  HardwareDiagnostics,
  HudSnapshot,
  LiveEventDef,
  MultiplayerPlayerTelemetry,
  MultiplayerRoomState,
  PCSettings,
  PlayerSaveData,
  RunSummary,
  TimeOfDay,
} from './game/types';
import { t } from './i18n';
import {
  ActiveRunSession,
  checkServerOnline,
  fetchMeOnline,
  loadSaveFromSqlite,
  mpClient,
  OnlineUser,
  RoomInviteNotice,
  startServerRun,
  submitServerRun,
  syncSaveToSqlite,
} from './services/onlineClient';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  mode: 'endless',
  districtId: 'downtown',
  districtName: DISTRICTS[0].name,
  timePeriod: 'night',
  score: 0,
  distance: 0,
  runDurationSec: 0,
  coinsRun: 0,
  gemsRun: 0,
  speedKmh: 0,
  combo: 1,
  comboTimer: 0,
  momentum: 0,
  slowMoEnergy: 100,
  isSlowMo: false,
  abilityCharge: 100,
  abilityActive: false,
  hasShield: false,
  hasMagnet: false,
  magnetTimer: 0,
  isRidingVehicle: false,
  vehicleTimer: 0,
  selectedVehicleId: 'hover_bike',
  talismansHeld: 0,
  reviveTokensHeld: 0,
  talismanUsedRun: false,
  revivePrompt: null,
  pursuerDistance: null,
  pursuerThreat: 0,
  action: 'idle',
  contextPrompt: null,
  tutorialHint: null,
  subtitleText: null,
  activeEventBanner: null,
  activeDynamicEvent: null,
  bossId: null,
  bossName: null,
  bossHp: 0,
  bossMaxHp: 0,
  bossPhase: 1,
  bossDistance: null,
  randomBossActive: false,
  storyChapter: null,
  storyObjectiveText: null,
  timeRemaining: null,
  targetDistance: null,
  activeBanner: null,
  lastStuntText: null,
  weather: 'rain',
  gravityScale: 1,
  secretsFoundRun: 0,
  dronesEvadedRun: 0,
  enemiesEliminatedRun: 0,
  fps: 60,
  frameTimeMs: 16.6,
  drawCalls: 0,
  triangles: 0,
  memoryMb: null,
  perfWarning: null,
  tutorialStep: null,
  tutorialProgress: null,
  bossWarningText: null,
  rainEventActive: false,
  difficultyStage: 1,
  isMultiplayer: false,
  mpPlayers: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MetroRushEngine | null>(null);
  const activeRunSessionRef = useRef<ActiveRunSession | null>(null);
  const lastRandomDistrictRef = useRef<DistrictId | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const [save, setSave] = useState<PlayerSaveData>(() => loadSaveData());
  const saveRef = useRef<PlayerSaveData>(save);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [menuTab, setMenuTab] = useState<MenuTab | null>(null);
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategory>('graphics_video');
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<
    'verified' | 'offline' | 'rejected' | undefined
  >(undefined);
  const [transitionText, setTransitionText] = useState<string | null>(null);

  const [diagnostics, setDiagnostics] = useState<HardwareDiagnostics>(() =>
    detectHardwareProfile(),
  );
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [onlineUser, setOnlineUser] = useState<OnlineUser | null>(null);
  const onlineUserRef = useRef<OnlineUser | null>(null);
  const [previewBossId, setPreviewBossId] = useState<BossId>('titan_drone');

  // Multiplayer WebSocket state
  const [mpConnected, setMpConnected] = useState<boolean>(false);
  const [mpSelfId, setMpSelfId] = useState<string | null>(null);
  const mpSelfIdRef = useRef<string | null>(null);
  const [mpRoom, setMpRoom] = useState<MultiplayerRoomState | null>(null);
  const [mpInvite, setMpInvite] = useState<RoomInviteNotice | null>(null);
  const mpPlayersRef = useRef<MultiplayerPlayerTelemetry[]>([]);
  const isMpRunRef = useRef<boolean>(false);

  // 15s Video Confirmation State
  const [pendingVideoRevert, setPendingVideoRevert] = useState<{
    prevSettings: PCSettings;
    secondsLeft: number;
  } | null>(null);

  useEffect(() => {
    onlineUserRef.current = onlineUser;
    if (serverOnline) {
      mpClient.authenticate();
    }
  }, [onlineUser, serverOnline]);

  const updateSave = useCallback((next: PlayerSaveData) => {
    saveRef.current = next;
    setSave(next);
    persistSaveData(next);
    engineRef.current?.syncSaveData(next);
    if (next.settings.muted || !next.settings.lobbyMusicEnabled) {
      audioEngine.startLobbyMusicIfAllowed(false);
    }
    if (onlineUserRef.current) {
      void syncSaveToSqlite(next);
    }
  }, []);

  // Check server, SQLite profile sync & WebSocket connection on boot
  useEffect(() => {
    let active = true;
    void checkServerOnline().then(async (isUp) => {
      if (!active) return;
      setServerOnline(isUp);
      if (!isUp) return;

      const me = await fetchMeOnline();
      if (!active) return;

      if (me.ok && me.user) {
        setOnlineUser(me.user);
        onlineUserRef.current = me.user;
        mpClient.connect(me.user.username);

        const cloudRes = await loadSaveFromSqlite();
        if (active && cloudRes.ok && cloudRes.hasSave && cloudRes.save) {
          const cloudRuns = cloudRes.save.stats?.totalRuns ?? 0;
          const localRuns = saveRef.current.stats.totalRuns ?? 0;
          if (localRuns === 0 || cloudRuns > localRuns) {
            saveRef.current = cloudRes.save;
            setSave(cloudRes.save);
            persistSaveData(cloudRes.save);
            engineRef.current?.syncSaveData(cloudRes.save);
          }
        }
      } else {
        mpClient.connect('RUNNER_PC');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Unlock & start adaptive Lobby music on first user gesture while in Title/Menu
  useEffect(() => {
    if (hud.phase !== 'title') return;
    const handleFirstGesture = () => {
      audioEngine.unlock();
      audioEngine.startLobbyMusicIfAllowed(
        saveRef.current.settings.lobbyMusicEnabled &&
          !saveRef.current.settings.muted,
      );
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [hud.phase]);

  // Browser Fullscreen sync when displayMode changes
  useEffect(() => {
    const mode = save.settings.displayMode;
    try {
      if (mode === 'fullscreen' || mode === 'borderless') {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => {});
        }
      } else if (mode === 'windowed' && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Fullscreen restricted in embedded preview iframes — safely ignore
    }
  }, [save.settings.displayMode]);

  // 15s Display Settings Confirmation Timer
  useEffect(() => {
    if (!pendingVideoRevert) return;
    const timer = window.setInterval(() => {
      setPendingVideoRevert((cur) => {
        if (!cur) return null;
        if (cur.secondsLeft <= 1) {
          const reverted: PlayerSaveData = {
            ...saveRef.current,
            settings: cur.prevSettings,
          };
          updateSave(reverted);
          return null;
        }
        return { ...cur, secondsLeft: cur.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pendingVideoRevert, updateSave]);

  const handleVideoChangeWithConfirm = useCallback(
    (nextSettings: PCSettings, prevSettings: PCSettings) => {
      const basePrev = pendingVideoRevert
        ? pendingVideoRevert.prevSettings
        : prevSettings;
      updateSave({ ...saveRef.current, settings: nextSettings });
      setPendingVideoRevert({ prevSettings: basePrev, secondsLeft: 15 });
    },
    [pendingVideoRevert, updateSave],
  );

  const handleConsumableEvent = useCallback(
    (kind: ConsumableEventKind, amount: number) => {
      const cur = saveRef.current;
      let nextSave = cur;
      if (kind === 'talisman_pickup') {
        nextSave = {
          ...cur,
          talismans: Math.max(0, cur.talismans + amount),
        };
      } else if (kind === 'talisman_use') {
        const res = consumeTalisman(cur);
        nextSave = res.nextSave;
      } else if (kind === 'revive_use') {
        const res = consumeReviveTokens(cur, amount);
        nextSave = res.nextSave;
      }
      if (nextSave !== cur) {
        saveRef.current = nextSave;
        setSave(nextSave);
        persistSaveData(nextSave);
      }
    },
    [],
  );

  const handleRunComplete = useCallback(async (telemetry: RunTelemetry) => {
    const wasMp = isMpRunRef.current;
    let { nextSave, summary } = applyRunToSave(saveRef.current, telemetry);

    if (wasMp) {
      mpClient.sendFinish(telemetry.distance, telemetry.score);
      const myId = mpSelfIdRef.current || mpClient.getSelfUserId();
      const others = mpPlayersRef.current.filter((p) => p.userId !== myId);
      const beatEveryone =
        others.length > 0 &&
        others.every(
          (p) =>
            telemetry.distance > p.distance ||
            (telemetry.distance === p.distance && telemetry.score >= p.score),
        );
      nextSave = {
        ...nextSave,
        stats: {
          ...nextSave.stats,
          mpMatchesPlayed: (nextSave.stats.mpMatchesPlayed ?? 0) + 1,
          mpWins: (nextSave.stats.mpWins ?? 0) + (beatEveryone ? 1 : 0),
        },
      };
      persistSaveData(nextSave);
      isMpRunRef.current = false;
    }

    saveRef.current = nextSave;
    setSave(nextSave);
    engineRef.current?.syncSaveData(nextSave);
    setRunSummary(summary);
    if (onlineUserRef.current) {
      void syncSaveToSqlite(nextSave);
    }

    const session = activeRunSessionRef.current;
    activeRunSessionRef.current = null;
    if (session) {
      const res = await submitServerRun(session, {
        score: telemetry.score,
        distance: telemetry.distance,
        durationSec: telemetry.durationSec,
        maxSpeedKmh: telemetry.maxSpeedKmh,
        maxCombo: telemetry.maxCombo,
        characterId: telemetry.characterId,
        districtId: telemetry.districtId,
        mode: telemetry.mode,
        bossDefeatedId: telemetry.bossDefeatedId,
        victory: telemetry.victory,
      });
      setOnlineStatus(res.verified ? 'verified' : 'rejected');
    } else {
      setOnlineStatus('offline');
    }
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new MetroRushEngine(
      mount,
      saveRef.current,
      (snapshot) => setHud(snapshot),
      (telemetry) => void handleRunComplete(telemetry),
      handleConsumableEvent,
    );
    engineRef.current = engine;
    setDiagnostics(detectHardwareProfile());

    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleRunComplete, handleConsumableEvent]);

  // Sync 3D Showcase Camera based on active menu tab
  useEffect(() => {
    if (!engineRef.current) return;
    let mode: ShowcaseMode = 'title';
    if (menuTab === 'garage') mode = 'garage';
    else if (menuTab === 'characters') mode = 'characters';
    else if (menuTab === 'districts') mode = 'city';
    else if (menuTab === 'events') mode = 'boss';
    engineRef.current.setShowcaseMode(mode, previewBossId);
  }, [menuTab, previewBossId]);

  const handleStartGame = useCallback(
    (
      districtOverride?: DistrictId,
      modeOverride?: GameMode,
      eventId: string | null = null,
      bossOverride?: BossId,
      storyChapterOverride?: number,
      isMpLaunch = false,
    ) => {
      const targetMode = modeOverride ?? saveRef.current.selectedMode;
      const chapterDef =
        STORY_CHAPTERS.find(
          (ch) =>
            ch.chapter ===
            (storyChapterOverride ?? saveRef.current.storyChapter ?? 1),
        ) ?? STORY_CHAPTERS[0];

      let targetDistrict: DistrictId;
      if (districtOverride) {
        targetDistrict = districtOverride;
      } else if (targetMode === 'story') {
        targetDistrict = chapterDef.districtId;
      } else if (targetMode === 'tutorial') {
        targetDistrict = 'downtown';
      } else if (!bossOverride && saveRef.current.settings.randomMap) {
        const unlocked =
          saveRef.current.unlockedDistricts.length > 0
            ? saveRef.current.unlockedDistricts
            : (['downtown'] as DistrictId[]);
        const pool =
          unlocked.length > 1
            ? unlocked.filter((d) => d !== lastRandomDistrictRef.current)
            : unlocked;
        targetDistrict = pool[Math.floor(Math.random() * pool.length)];
        lastRandomDistrictRef.current = targetDistrict;
      } else {
        targetDistrict = saveRef.current.selectedDistrictId;
      }

      if (!isMpLaunch) {
        isMpRunRef.current = false;
        engineRef.current?.enableMultiplayer(null);
      } else {
        isMpRunRef.current = true;
      }

      const distLabel = getDistrictById(targetDistrict).name;
      setTransitionText(
        targetMode === 'tutorial'
          ? 'Iniciando Tutorial Interactivo...'
          : isMpLaunch
            ? `Sincronizando Carrera Online · ${distLabel}`
            : `Desplegando en ${distLabel}...`,
      );
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = window.setTimeout(() => {
        setTransitionText(null);
      }, 360);

      setMenuTab(null);
      setRunSummary(null);
      setOnlineStatus(undefined);

      // Start signed online run token in background if authenticated
      activeRunSessionRef.current = null;
      void startServerRun(targetDistrict, targetMode).then((sess) => {
        if (sess) activeRunSessionRef.current = sess;
      });

      engineRef.current?.startRun(
        targetMode,
        targetDistrict,
        eventId,
        bossOverride,
        storyChapterOverride,
      );
    },
    [],
  );

  // Subscribe to real-time WebSocket multiplayer events
  useEffect(() => {
    const unsub = mpClient.subscribe({
      onConnection: (connected, selfUserId) => {
        setMpConnected(connected);
        if (selfUserId) {
          setMpSelfId(selfUserId);
          mpSelfIdRef.current = selfUserId;
        }
      },
      onRoomState: (room) => {
        setMpRoom(room);
      },
      onRoomStarted: (room) => {
        setMpRoom(room);
        const uid = mpSelfIdRef.current || mpClient.getSelfUserId() || 'mp_local';
        mpPlayersRef.current = [];
        engineRef.current?.enableMultiplayer(uid);
        handleStartGame(
          room.districtId,
          room.mode,
          null,
          undefined,
          undefined,
          true,
        );
      },
      onTelemetry: (players) => {
        mpPlayersRef.current = players;
        engineRef.current?.updateRemotePlayers(players);
      },
      onInvited: (invite) => {
        setMpInvite(invite);
      },
    });
    return unsub;
  }, [handleStartGame]);

  // 20Hz live multiplayer telemetry relay
  useEffect(() => {
    if (
      !hud.isMultiplayer ||
      (hud.phase !== 'playing' && hud.phase !== 'paused')
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!engineRef.current) return;
      mpClient.sendTelemetry(engineRef.current.getLiveTelemetry());
    }, 50);
    return () => window.clearInterval(timer);
  }, [hud.isMultiplayer, hud.phase]);

  // Sync non-blocking multiplayer pause state over WebSocket
  useEffect(() => {
    if (!hud.isMultiplayer) return;
    if (hud.phase === 'paused') {
      mpClient.sendPauseState(true);
    } else if (hud.phase === 'playing') {
      mpClient.sendPauseState(false);
    }
  }, [hud.isMultiplayer, hud.phase]);

  const handleContinueStory = useCallback(
    (storyChapterOverride?: number) => {
      const chNum = storyChapterOverride ?? saveRef.current.storyChapter ?? 1;
      const chapterDef =
        STORY_CHAPTERS.find((c) => c.chapter === chNum) ?? STORY_CHAPTERS[0];
      const chapterDistrict = chapterDef.districtId;
      const unlocked = saveRef.current.unlockedDistricts.includes(chapterDistrict)
        ? chapterDistrict
        : saveRef.current.selectedDistrictId;
      handleStartGame(unlocked, 'story', null, undefined, chNum);
    },
    [handleStartGame],
  );

  const handleStartEvent = useCallback(
    (evt: LiveEventDef) => {
      handleStartGame(evt.districtId, evt.mode, evt.id, evt.bossId);
    },
    [handleStartGame],
  );

  const handleStartBossBattle = useCallback(
    (bossId: BossId, districtId: DistrictId) => {
      handleStartGame(districtId, 'bosschase', null, bossId);
    },
    [handleStartGame],
  );

  const handleRunBenchmark = useCallback(async () => {
    if (!engineRef.current) return 16.6;
    const avgMs = await engineRef.current.runHardwareBenchmark();
    setDiagnostics(detectHardwareProfile(undefined, avgMs));
    return avgMs;
  }, []);

  // Enter / Space on Title Screen launches immediately when no modal is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hud.phase === 'title' && menuTab === null) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase, menuTab, handleStartGame]);

  const handleToggleMute = useCallback(() => {
    const cur = saveRef.current;
    const nextMuted = !cur.settings.muted;
    updateSave({
      ...cur,
      settings: {
        ...cur.settings,
        muted: nextMuted,
      },
    });
    if (!nextMuted && hud.phase === 'title') {
      audioEngine.unlock();
      audioEngine.startLobbyMusicIfAllowed(cur.settings.lobbyMusicEnabled);
    }
  }, [updateSave, hud.phase]);

  const handleToggleLobbyMusic = useCallback(() => {
    const cur = saveRef.current;
    const nextEnabled = !cur.settings.lobbyMusicEnabled;
    updateSave({
      ...cur,
      settings: {
        ...cur.settings,
        lobbyMusicEnabled: nextEnabled,
      },
    });
    audioEngine.unlock();
    audioEngine.startLobbyMusicIfAllowed(nextEnabled && !cur.settings.muted);
  }, [updateSave]);

  const handleSelectMode = useCallback(
    (mode: GameMode) => {
      updateSave({ ...saveRef.current, selectedMode: mode });
    },
    [updateSave],
  );

  const handleSelectDistrict = useCallback(
    (districtId: DistrictId) => {
      if (!saveRef.current.unlockedDistricts.includes(districtId)) return;
      updateSave({ ...saveRef.current, selectedDistrictId: districtId });
    },
    [updateSave],
  );

  const handleSelectTimeOfDay = useCallback(
    (timeOfDay: TimeOfDay) => {
      updateSave({
        ...saveRef.current,
        settings: {
          ...saveRef.current.settings,
          timeOfDay,
          randomWeather: false,
        },
      });
    },
    [updateSave],
  );

  const handleToggleRandomMap = useCallback(() => {
    updateSave({
      ...saveRef.current,
      settings: {
        ...saveRef.current.settings,
        randomMap: !saveRef.current.settings.randomMap,
      },
    });
  }, [updateSave]);

  const handleToggleRandomWeather = useCallback(() => {
    updateSave({
      ...saveRef.current,
      settings: {
        ...saveRef.current.settings,
        randomWeather: !saveRef.current.settings.randomWeather,
      },
    });
  }, [updateSave]);

  const colorblindFilterClass =
    save.settings.colorblindMode === 'deuteranopia'
      ? 'hue-rotate-[-12deg] saturate-110'
      : save.settings.colorblindMode === 'protanopia'
        ? 'hue-rotate-[14deg] saturate-110'
        : save.settings.colorblindMode === 'tritanopia'
          ? 'hue-rotate-[38deg] contrast-105'
          : '';

  const textSizeClass =
    save.settings.textSize === 'large'
      ? 'text-[17px]'
      : save.settings.textSize === 'small'
        ? 'text-[13px]'
        : '';

  const fontClass = save.settings.legibleFont ? 'tracking-wide' : '';

  const handleQuitToTitle = useCallback(() => {
    setRunSummary(null);
    if (isMpRunRef.current) {
      isMpRunRef.current = false;
      mpClient.leaveRoom();
    }
    engineRef.current?.enableMultiplayer(null);
    engineRef.current?.returnToTitle();
  }, []);

  const openMenuFromResults = (targetTab: MenuTab) => {
    handleQuitToTitle();
    setMenuTab(targetTab);
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-[#06080f] ${colorblindFilterClass} ${textSizeClass} ${fontClass}`}
    >
      {/* Isolated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen */}
      {hud.phase === 'title' && menuTab === null && (
        <TitleOverlay
          save={save}
          serverOnline={serverOnline}
          onlineUser={onlineUser}
          mpRoomCode={mpRoom?.code ?? null}
          onSelectMode={handleSelectMode}
          onSelectDistrict={handleSelectDistrict}
          onSelectTimeOfDay={handleSelectTimeOfDay}
          onToggleRandomMap={handleToggleRandomMap}
          onToggleRandomWeather={handleToggleRandomWeather}
          onStartGame={(storyCh) =>
            handleStartGame(undefined, undefined, null, undefined, storyCh)
          }
          onStartTutorial={() => handleStartGame('downtown', 'tutorial')}
          onContinueStory={handleContinueStory}
          onOpenTab={(tab) => {
            setSettingsCategory('graphics_video');
            setMenuTab(tab);
          }}
          onToggleMute={handleToggleMute}
          onToggleLobbyMusic={handleToggleLobbyMusic}
        />
      )}

      {/* Room Invite Toast while in Title Screen */}
      {hud.phase === 'title' && mpInvite && menuTab !== 'online' && (
        <div className="fixed top-20 right-6 z-40 w-80 bg-[#081224] border-2 border-cyan-400/75 rounded-xl p-3.5 shadow-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4" /> INVITACIÓN A SALA
            </span>
            <span className="font-mono-num text-white">{mpInvite.code}</span>
          </div>
          <div className="text-xs text-slate-200">
            <strong>{mpInvite.fromUsername}</strong> te invitó a correr en{' '}
            {getDistrictById(mpInvite.districtId).name}.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                audioEngine.playUiClick(true);
                mpClient.joinRoom(mpInvite.code, save.selectedCharacterId);
                setMpInvite(null);
                setMenuTab('online');
              }}
              className="flex-1 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Unirse ahora
            </button>
            <button
              onClick={() => setMpInvite(null)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Active Gameplay HUD */}
      {(hud.phase === 'playing' ||
        hud.phase === 'paused' ||
        hud.phase === 'reviving') && (
        <GameHud
          hud={hud}
          settings={save.settings}
          onToggleMute={handleToggleMute}
          onPause={() => engineRef.current?.setPaused(true)}
        />
      )}

      {/* Mid-Run Progressive Revive Prompt */}
      {hud.phase === 'reviving' && hud.revivePrompt && menuTab === null && (
        <ReviveModal
          prompt={hud.revivePrompt}
          distance={hud.distance}
          score={hud.score}
          onConfirmRevive={() => engineRef.current?.confirmRevive()}
          onDeclineRevive={() => engineRef.current?.declineRevive()}
        />
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && menuTab === null && (
        <PauseModal
          language={save.settings.language}
          hud={hud}
          muted={save.settings.muted}
          onToggleMute={handleToggleMute}
          onResume={() => engineRef.current?.setPaused(false)}
          onRestart={() => handleStartGame()}
          onOpenSettings={() => {
            setSettingsCategory('graphics_video');
            setMenuTab('settings');
          }}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {/* Post-Run Results Modal */}
      {(hud.phase === 'gameover' || hud.phase === 'victory') &&
        runSummary &&
        menuTab === null && (
          <ResultsModal
            language={save.settings.language}
            summary={runSummary}
            onlineStatus={onlineStatus}
            onReplay={() => handleStartGame()}
            onOpenGarage={() => openMenuFromResults('garage')}
            onOpenMissions={() => openMenuFromResults('missions')}
            onOpenStats={() => openMenuFromResults('stats')}
            onOpenShop={() => openMenuFromResults('shop')}
            onQuitToTitle={handleQuitToTitle}
          />
        )}

      {/* PC Progression / Customization / Vehicles / Cities / Bosses / Online / Settings Hub */}
      {menuTab !== null && (
        <MainMenuModal
          initialTab={menuTab}
          initialSettingsCategory={settingsCategory}
          save={save}
          diagnostics={diagnostics}
          liveHud={hud}
          serverOnline={serverOnline}
          onlineUser={onlineUser}
          mpConnected={mpConnected}
          mpSelfId={mpSelfId}
          mpRoom={mpRoom}
          mpInvite={mpInvite}
          onDismissInvite={() => setMpInvite(null)}
          previewBossId={previewBossId}
          onSelectBossPreview={(bossId) => setPreviewBossId(bossId)}
          onOnlineUserChange={(u) => setOnlineUser(u)}
          onUpdateSave={updateSave}
          onVideoChangeWithConfirm={handleVideoChangeWithConfirm}
          onRunBenchmark={handleRunBenchmark}
          onReloadCustomGlb={() => engineRef.current?.rebuildPlayerCharacter()}
          onTabChange={(next) => setMenuTab(next)}
          onClose={() => setMenuTab(null)}
          onDeployDistrict={(districtId) => {
            updateSave({ ...saveRef.current, selectedDistrictId: districtId });
            handleStartGame(districtId);
          }}
          onStartEvent={handleStartEvent}
          onStartBossBattle={handleStartBossBattle}
          onStartTutorial={() => handleStartGame('downtown', 'tutorial')}
        />
      )}

      {/* Smooth Run Launch Transition Overlay */}
      {transitionText && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#040712]/80 transition-opacity duration-200">
          <div className="bg-[#091224] border border-cyan-400/55 rounded-xl px-7 py-4 text-center space-y-1 shadow-2xl">
            <div className="text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
              METRO RUSH: NEON CITY
            </div>
            <div className="font-display text-lg font-bold text-white">
              {transitionText}
            </div>
          </div>
        </div>
      )}

      {/* 15s Display Settings Confirmation Banner */}
      {pendingVideoRevert && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md bg-[#0a0f1f] border border-amber-400/70 rounded-xl p-4 shadow-2xl space-y-3">
          <div className="flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">
                {t(save.settings.language, 'settings.confirmDisplay')}
              </div>
              <div className="text-amber-200 font-mono-num mt-0.5">
                {t(save.settings.language, 'settings.revertCountdown', {
                  sec: pendingVideoRevert.secondsLeft,
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                updateSave({
                  ...saveRef.current,
                  settings: pendingVideoRevert.prevSettings,
                });
                setPendingVideoRevert(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-xs font-semibold text-slate-200 hover:bg-white/10 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />{' '}
              {t(save.settings.language, 'common.cancel')}
            </button>
            <button
              onClick={() => setPendingVideoRevert(null)}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />{' '}
              {t(save.settings.language, 'common.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
