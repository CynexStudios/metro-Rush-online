import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Globe, Power, RotateCcw } from 'lucide-react';
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
import { restorePersistedCustomBosses } from './game/gltfAssets';
import { detectHardwareProfile } from './game/hardware';
import {
  applyRunToSave,
  loadSaveData,
  persistSaveData,
  RunTelemetry,
} from './game/storage';
import {
  AccountSyncConflict,
  ActiveRunContext,
  BossId,
  ConflictResolutionStrategy,
  DistrictId,
  GameMode,
  HardwareDiagnostics,
  HudSnapshot,
  LiveEventDef,
  MultiplayerPlayerTelemetry,
  MultiplayerRoomState,
  PCSettings,
  PlayerSaveData,
  ReleaseUpdateInfo,
  RunSummary,
  TimeOfDay,
  UpdateProgressState,
} from './game/types';
import { t } from './i18n';
import {
  ActiveRunSession,
  bootstrapDesktopSession,
  buildAccountConflict,
  checkReleaseUpdatesApi,
  checkServerOnline,
  createLocalProfileApi,
  fetchMeOnline,
  getActiveLocalProfileId,
  getLocalProfileApi,
  linkAccountApi,
  listLocalProfilesApi,
  loadSaveFromSqlite,
  mpClient,
  OnlineUser,
  RoomInviteNotice,
  saveLocalProfileApi,
  setActiveLocalProfileId,
  startServerRun,
  stopCloudflaredTunnel,
  stopLanHost,
  submitServerRun,
  syncSaveToSqlite,
} from './services/onlineClient';
import { rtcClient } from './services/rtcClient';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  mode: 'endless',
  districtId: 'downtown',
  districtName: DISTRICTS[0].name,
  laneCount: 3,
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
  boostCooldown: 0,
  boostMaxCooldown: 5,
  boostActive: false,
  slowMoEnergy: 100,
  isSlowMo: false,
  vehicleAbilityLocked: false,
  abilityCharge: 100,
  abilityActive: false,
  hasShield: false,
  shieldCooldown: 0,
  shieldMaxCooldown: 16,
  doubleJumpCharges: 2,
  maxDoubleJumpCharges: 2,
  doubleJumpCooldown: 0,
  doubleJumpBlockedReason: null,
  hasMagnet: false,
  magnetTimer: 0,
  isRidingVehicle: false,
  vehicleIsShip: false,
  vehicleTimer: 0,
  selectedVehicleId: 'hover_bike',
  talismansHeld: 0,
  reviveTokensHeld: 0,
  talismanUsedRun: false,
  revivePrompt: null,
  pursuerDistance: null,
  pursuerThreat: 0,
  randomBossActive: false,
  storyChapter: null,
  storyObjectiveText: null,
  parkourFloor: 1,
  parkourChain: 0,
  action: 'idle',
  contextPrompt: null,
  tutorialHint: null,
  subtitleText: null,
  activeEventBanner: null,
  activeDynamicEvent: null,
  sectorTransitionLabel: null,
  objectiveCelebrationText: null,
  bossId: null,
  bossName: null,
  bossHp: 0,
  bossMaxHp: 0,
  bossPhase: 1,
  bossPhaseName: null,
  bossPhaseHp: 0,
  bossPhaseMaxHp: 0,
  bossIntroActive: false,
  bossIntroTitle: null,
  bossIntroSubtitle: null,
  bossTransitionActive: false,
  bossDistance: null,
  timeRemaining: null,
  targetDistance: null,
  activeBanner: null,
  lastStuntText: null,
  weather: 'rain',
  gravityScale: 1,
  secretsFoundRun: 0,
  dronesEvadedRun: 0,
  enemiesEliminatedRun: 0,
  obstaclesDodgedRun: 0,
  trainsPassedRun: 0,
  shieldBreaksRun: 0,
  doubleJumpsRun: 0,
  activeRunContext: {
    mode: 'endless',
    districtId: 'downtown',
    eventId: null,
    bossId: null,
    storyChapter: null,
  },
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
  const lastRunContextRef = useRef<ActiveRunContext>({
    mode: 'endless',
    districtId: 'downtown',
    eventId: null,
    bossId: null,
    storyChapter: null,
  });
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
  const [activeLocalProfileId, setActiveLocalProfileState] = useState<string | null>(
    () => getActiveLocalProfileId(),
  );
  const activeLocalProfileIdRef = useRef<string | null>(activeLocalProfileId);
  const [previewBossId, setPreviewBossId] = useState<BossId>('titan_drone');

  // Official GitHub Releases Auto-Updater State
  const [updateInfo, setUpdateInfo] = useState<ReleaseUpdateInfo | null>(null);
  const [updateState, setUpdateState] = useState<UpdateProgressState>({
    status: 'idle',
    progressPercent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    downloadedPath: null,
    message: '',
    error: null,
  });
  const [dismissedUpdateBanner, setDismissedUpdateBanner] = useState(false);

  // Electron local server error/restart banner
  const [desktopServerBanner, setDesktopServerBanner] = useState<{
    status: string;
    message: string;
  } | null>(null);

  // Account sync conflict state
  const [pendingConflict, setPendingConflict] = useState<AccountSyncConflict | null>(null);
  const [pendingOnlineSave, setPendingOnlineSave] = useState<PlayerSaveData | null>(null);

  // Multiplayer WebSocket state
  const [mpConnected, setMpConnected] = useState<boolean>(false);
  const [mpSelfId, setMpSelfId] = useState<string | null>(null);
  const mpSelfIdRef = useRef<string | null>(null);
  const [mpTargetUrl, setMpTargetUrl] = useState<string>(() => mpClient.getTargetUrl());
  const [mpRoom, setMpRoom] = useState<MultiplayerRoomState | null>(null);
  const [mpInvite, setMpInvite] = useState<RoomInviteNotice | null>(null);
  const [mpNotice, setMpNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const mpPlayersRef = useRef<MultiplayerPlayerTelemetry[]>([]);
  const isMpRunRef = useRef<boolean>(false);
  const appliedMpTxRef = useRef<Set<string>>(new Set());

  // 15s Video Confirmation State
  const [pendingVideoRevert, setPendingVideoRevert] = useState<{
    prevSettings: PCSettings;
    secondsLeft: number;
  } | null>(null);

  // Clean Exit Confirmation State
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [exitingApp, setExitingApp] = useState(false);
  const [browserExitNotice, setBrowserExitNotice] = useState<string | null>(null);

  useEffect(() => {
    onlineUserRef.current = onlineUser;
    if (serverOnline && mpClient.isConnected()) {
      mpClient.authenticate();
    }
  }, [onlineUser, serverOnline]);

  useEffect(() => {
    if (!window.metroDesktop?.onServerStatus) return;
    return window.metroDesktop.onServerStatus((evt) => {
      if (evt.status === 'ready') {
        setDesktopServerBanner(null);
        setServerOnline(true);
      } else if (evt.status === 'crashed' || evt.status === 'error' || evt.status === 'restarting') {
        setDesktopServerBanner({ status: evt.status, message: evt.message });
      }
    });
  }, []);

  // Subscribe to Electron updater progress & restore custom Blender bosses on boot
  useEffect(() => {
    void restorePersistedCustomBosses();
    if (window.metroDesktop?.getUpdateState) {
      void window.metroDesktop.getUpdateState().then((st) => {
        if (st) setUpdateState(st);
      });
    }
    const unsubProgress = window.metroDesktop?.onUpdateProgress?.((st) => {
      setUpdateState(st);
    });
    const timer = window.setTimeout(() => {
      void checkReleaseUpdatesApi().then((info) => {
        setUpdateInfo(info);
        if (info.hasUpdate) {
          setUpdateState((prev) =>
            prev.status === 'idle' || prev.status === 'up_to_date'
              ? {
                  ...prev,
                  status: 'available',
                  message: `Nueva versión oficial v${info.latestVersion} disponible.`,
                }
              : prev,
          );
        }
      });
    }, 2200);
    return () => {
      window.clearTimeout(timer);
      if (unsubProgress) unsubProgress();
    };
  }, []);

  const updateSave = useCallback((next: PlayerSaveData) => {
    saveRef.current = next;
    setSave(next);
    persistSaveData(next);
    engineRef.current?.syncSaveData(next);
    if (next.settings.muted || !next.settings.lobbyMusicEnabled) {
      audioEngine.startLobbyMusicIfAllowed(false);
    }
    if (activeLocalProfileIdRef.current) {
      void saveLocalProfileApi(activeLocalProfileIdRef.current, next);
    }
    if (onlineUserRef.current) {
      void syncSaveToSqlite(next);
    }
  }, []);

  const handleSwitchLocalProfile = useCallback(
    (profileId: string, nextSave: PlayerSaveData) => {
      setActiveLocalProfileId(profileId);
      setActiveLocalProfileState(profileId);
      activeLocalProfileIdRef.current = profileId;
      saveRef.current = nextSave;
      setSave(nextSave);
      persistSaveData(nextSave);
      engineRef.current?.syncSaveData(nextSave);
    },
    [],
  );

  const handleResolveConflict = useCallback(
    async (strategy: ConflictResolutionStrategy, chosenSave: PlayerSaveData) => {
      const localId = activeLocalProfileIdRef.current || 'local_default';
      const txId = `boot_lnk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await linkAccountApi({
        localProfileId: localId,
        strategy,
        mergedSave: chosenSave,
        summary: pendingConflict
          ? {
              local: pendingConflict.localSummary,
              online: pendingConflict.onlineSummary,
            }
          : {},
        txId,
      });
      updateSave(chosenSave);
      setPendingConflict(null);
      setPendingOnlineSave(null);
    },
    [pendingConflict, updateSave],
  );

  // Check server, desktop safeStorage session, offline local SQLite profiles, optional online sync & WebSocket on boot
  useEffect(() => {
    let active = true;
    void (async () => {
      await bootstrapDesktopSession();
      if (!active) return;
      const resolvedActiveId = getActiveLocalProfileId();
      if (resolvedActiveId && resolvedActiveId !== activeLocalProfileIdRef.current) {
        activeLocalProfileIdRef.current = resolvedActiveId;
        setActiveLocalProfileState(resolvedActiveId);
      }

      const isUp = await checkServerOnline();
      if (!active) return;
      setServerOnline(isUp);
      if (!isUp) return;

      // 1. Ensure offline local profile exists in SQLite
      let resolvedProfileId = activeLocalProfileIdRef.current;
      const localList = await listLocalProfilesApi();
      if (!active) return;

      if (localList.ok) {
        if (
          resolvedProfileId &&
          localList.profiles.some((p) => p.id === resolvedProfileId)
        ) {
          const loaded = await getLocalProfileApi(resolvedProfileId);
          if (active && loaded.ok && loaded.save) {
            const sqliteRuns = loaded.save.stats?.totalRuns ?? 0;
            const localRuns = saveRef.current.stats?.totalRuns ?? 0;
            if (sqliteRuns > localRuns) {
              saveRef.current = loaded.save;
              setSave(loaded.save);
              persistSaveData(loaded.save);
              engineRef.current?.syncSaveData(loaded.save);
            }
          }
        } else if (localList.profiles.length > 0) {
          resolvedProfileId = localList.profiles[0].id;
          setActiveLocalProfileId(resolvedProfileId);
          setActiveLocalProfileState(resolvedProfileId);
          activeLocalProfileIdRef.current = resolvedProfileId;
          const loaded = await getLocalProfileApi(resolvedProfileId);
          if (active && loaded.ok && loaded.save) {
            const sqliteRuns = loaded.save.stats?.totalRuns ?? 0;
            const localRuns = saveRef.current.stats?.totalRuns ?? 0;
            if (localRuns === 0 && sqliteRuns > 0) {
              saveRef.current = loaded.save;
              setSave(loaded.save);
              persistSaveData(loaded.save);
              engineRef.current?.syncSaveData(loaded.save);
            }
          }
        } else {
          const created = await createLocalProfileApi({
            name: saveRef.current.playerName || 'RUNNER_01',
            avatarId: saveRef.current.avatarId || 'kai',
            save: saveRef.current,
          });
          if (active && created.ok && created.profile) {
            resolvedProfileId = created.profile.id;
            setActiveLocalProfileId(resolvedProfileId);
            setActiveLocalProfileState(resolvedProfileId);
            activeLocalProfileIdRef.current = resolvedProfileId;
          }
        }
      }

      // 2. Check optional online account & detect sync conflicts safely (never silent overwrite)
      const me = await fetchMeOnline();
      if (!active) return;

      if (me.ok && me.user) {
        setOnlineUser(me.user);
        onlineUserRef.current = me.user;
        mpClient.connect({ guestName: me.user.username });

        const cloudRes = await loadSaveFromSqlite();
        if (active && cloudRes.ok && cloudRes.hasSave && cloudRes.save) {
          const conflict = buildAccountConflict({
            localProfileId: resolvedProfileId || 'local_default',
            localSave: saveRef.current,
            onlineUser: me.user,
            onlineSave: cloudRes.save,
          });
          if (conflict.hasConflict) {
            setPendingConflict(conflict);
            setPendingOnlineSave(cloudRes.save);
          } else if ((saveRef.current.stats.totalRuns ?? 0) === 0) {
            saveRef.current = cloudRes.save;
            setSave(cloudRes.save);
            persistSaveData(cloudRes.save);
            engineRef.current?.syncSaveData(cloudRes.save);
          }
        }
      } else {
        mpClient.connect({ guestName: saveRef.current.playerName || 'RUNNER_PC' });
      }
    })();
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
    persistSaveData(nextSave);
    engineRef.current?.syncSaveData(nextSave);
    setRunSummary(summary);
    if (activeLocalProfileIdRef.current) {
      void saveLocalProfileApi(activeLocalProfileIdRef.current, nextSave);
    }
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

      lastRunContextRef.current = {
        mode: targetMode,
        districtId: targetDistrict,
        eventId: eventId ?? null,
        bossId: bossOverride ?? null,
        storyChapter:
          targetMode === 'story'
            ? (storyChapterOverride ?? saveRef.current.storyChapter ?? 1)
            : null,
      };

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

  const handleRestartCurrentRun = useCallback(() => {
    const ctx = lastRunContextRef.current;
    handleStartGame(
      ctx.districtId,
      ctx.mode,
      ctx.eventId,
      ctx.bossId ?? undefined,
      ctx.storyChapter ?? undefined,
    );
  }, [handleStartGame]);

  const handleCheckForUpdates = useCallback(async (repo?: string) => {
    setUpdateState((prev) => ({
      ...prev,
      status: 'checking',
      message: 'Comprobando última versión oficial en GitHub Releases...',
      error: null,
    }));
    const info = await checkReleaseUpdatesApi(repo);
    setUpdateInfo(info);
    if (info.hasUpdate) {
      setDismissedUpdateBanner(false);
      setUpdateState((prev) => ({
        ...prev,
        status: 'available',
        message: `Nueva actualización v${info.latestVersion} lista para descargar.`,
        error: null,
      }));
    } else if (info.error && info.source === 'offline') {
      setUpdateState((prev) => ({
        ...prev,
        status: 'error',
        message: info.error || 'No se pudo comprobar actualizaciones.',
        error: info.error || 'Offline',
      }));
    } else {
      setUpdateState((prev) => ({
        ...prev,
        status: 'up_to_date',
        message: `Ya tienes la última versión oficial (v${info.currentVersion}).`,
        error: null,
      }));
    }
    return info;
  }, []);

  const handleDownloadUpdate = useCallback(async (infoOverride?: ReleaseUpdateInfo) => {
    const targetInfo = infoOverride ?? updateInfo;
    if (!targetInfo || !targetInfo.downloadUrl) return;
    if (window.metroDesktop?.downloadUpdate) {
      const res = await window.metroDesktop.downloadUpdate(targetInfo);
      if (!res.ok && res.error) {
        setUpdateState((prev) => ({
          ...prev,
          status: 'error',
          error: res.error ?? 'Error al descargar actualización.',
          message: res.error ?? 'Error al descargar actualización.',
        }));
      }
    } else if (window.metroDesktop?.openExternalUrl) {
      await window.metroDesktop.openExternalUrl(targetInfo.downloadUrl);
    } else {
      window.location.href = targetInfo.downloadUrl;
    }
  }, [updateInfo]);

  const handleInstallUpdate = useCallback(async () => {
    if (!window.metroDesktop?.installUpdate || !updateState.downloadedPath) return;
    persistSaveData(saveRef.current);
    if (activeLocalProfileIdRef.current) {
      await saveLocalProfileApi(activeLocalProfileIdRef.current, saveRef.current).catch(() => {});
    }
    if (onlineUserRef.current) {
      await syncSaveToSqlite(saveRef.current).catch(() => {});
    }
    const res = await window.metroDesktop.installUpdate(
      updateState.downloadedPath,
      updateInfo?.latestVersion,
    );
    if (!res.ok && res.error) {
      setUpdateState((prev) => ({
        ...prev,
        status: 'error',
        error: res.error || 'Error al lanzar el instalador.',
        message: res.error || 'Error al lanzar el instalador.',
      }));
    }
  }, [updateState.downloadedPath]);

  // Subscribe to real-time WebSocket multiplayer + WebRTC signaling events
  useEffect(() => {
    const unsub = mpClient.subscribe({
      onConnection: (connected, selfUserId, targetUrl) => {
        setMpConnected(connected);
        if (targetUrl) setMpTargetUrl(targetUrl);
        if (selfUserId) {
          setMpSelfId(selfUserId);
          mpSelfIdRef.current = selfUserId;
        }
      },
      onRoomState: (room) => {
        setMpRoom(room);
        if (room) setMpNotice(null);
      },
      onRoomStarted: (room) => {
        setMpNotice(null);
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
      onNotice: (text, isError) => {
        if (text) setMpNotice({ text, isError });
      },
      onHostClosed: (reason) => {
        setMpRoom(null);
        setMpNotice({ text: reason, isError: true });
        rtcClient.closeAll();
        if (isMpRunRef.current) {
          isMpRunRef.current = false;
          engineRef.current?.enableMultiplayer(null);
          engineRef.current?.returnToTitle();
          setMenuTab('online');
        }
      },
      onKicked: (reason) => {
        setMpRoom(null);
        setMpNotice({ text: reason, isError: true });
        rtcClient.closeAll();
        if (isMpRunRef.current) {
          isMpRunRef.current = false;
          engineRef.current?.enableMultiplayer(null);
          engineRef.current?.returnToTitle();
          setMenuTab('online');
        }
      },
      onFinishAck: (ack) => {
        if (!ack?.txId || appliedMpTxRef.current.has(ack.txId)) return;
        appliedMpTxRef.current.add(ack.txId);
        const cur = saveRef.current;
        const prevBest = cur.stats.mpBestPlacement ?? 0;
        const nextBest =
          prevBest === 0 ? ack.placement : Math.min(prevBest, ack.placement);
        const rewarded: PlayerSaveData = {
          ...cur,
          coins: cur.coins + (ack.rewardCoins || 0),
          gems: cur.gems + (ack.rewardGems || 0),
          stats: {
            ...cur.stats,
            mpBestPlacement: nextBest,
          },
        };
        updateSave(rewarded);
        setMpNotice({
          text: `Meta #${ack.placement} validada por el anfitrión: +${ack.rewardCoins} Monedas y +${ack.rewardGems} Gemas.`,
          isError: false,
        });
      },
      onRtcSignal: (sig) => {
        void rtcClient.handleIncomingSignal(sig);
      },
    });
    return unsub;
  }, [handleStartGame, updateSave]);

  // 20Hz live multiplayer telemetry relay (WS authoritative + WebRTC DataChannel P2P)
  useEffect(() => {
    if (
      !hud.isMultiplayer ||
      (hud.phase !== 'playing' && hud.phase !== 'paused')
    ) {
      return;
    }
    const unsubRtcTelemetry = rtcClient.subscribeTelemetry((peerId, rawPayload) => {
      const payload = rawPayload as Partial<MultiplayerPlayerTelemetry> | undefined;
      if (!payload || typeof payload.distance !== 'number') return;
      const idx = mpPlayersRef.current.findIndex((p) => p.userId === peerId);
      if (idx >= 0) {
        const next = [...mpPlayersRef.current];
        next[idx] = { ...next[idx], ...payload };
        mpPlayersRef.current = next;
        engineRef.current?.updateRemotePlayers(next);
      }
    });
    const timer = window.setInterval(() => {
      if (!engineRef.current) return;
      const telemetry = engineRef.current.getLiveTelemetry();
      mpClient.sendTelemetry(telemetry);
      if (rtcClient.hasOpenDataChannels()) {
        rtcClient.broadcastTelemetry({
          ...telemetry,
          userId: mpSelfIdRef.current || mpClient.getSelfUserId() || 'p2p',
        });
      }
    }, 50);
    return () => {
      unsubRtcTelemetry();
      window.clearInterval(timer);
    };
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

  // Enter / Space launches & Escape opens Exit confirmation on Title Screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hud.phase === 'title' && menuTab === null && !pendingVideoRevert) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowExitConfirm((v) => !v);
          return;
        }
        if ((e.code === 'Enter' || e.code === 'Space') && !showExitConfirm) {
          e.preventDefault();
          handleStartGame();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase, menuTab, pendingVideoRevert, showExitConfirm, handleStartGame]);

  const handleConfirmExitGame = useCallback(async () => {
    if (exitingApp) return;
    setExitingApp(true);
    try {
      persistSaveData(saveRef.current);
      if (activeLocalProfileIdRef.current) {
        await saveLocalProfileApi(activeLocalProfileIdRef.current, saveRef.current);
      }
      if (onlineUserRef.current) {
        await syncSaveToSqlite(saveRef.current);
      }
      mpClient.leaveRoom();
      mpClient.disconnect();
      rtcClient.closeAll();
      await stopCloudflaredTunnel().catch(() => {});
      await stopLanHost().catch(() => {});
    } finally {
      if (window.metroDesktop?.quitApp) {
        await window.metroDesktop.quitApp();
      } else {
        setExitingApp(false);
        setShowExitConfirm(false);
        setBrowserExitNotice(
          'Progreso guardado de forma segura. En escritorio (.exe) esto cierra la aplicación automáticamente; en navegador puedes cerrar la pestaña.',
        );
      }
    }
  }, [exitingApp]);

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
          hasSyncConflict={Boolean(pendingConflict)}
          updateInfo={!dismissedUpdateBanner ? updateInfo : null}
          updateState={updateState}
          onDismissUpdateBanner={() => setDismissedUpdateBanner(true)}
          onOpenUpdatesSettings={() => {
            setSettingsCategory('system_backup');
            setMenuTab('settings');
          }}
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
          onRequestExit={() => setShowExitConfirm(true)}
        />
      )}

      {/* Electron Local Server Crash / Restart Notification Banner */}
      {desktopServerBanner && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md bg-[#0a0f1f] border border-rose-400/70 rounded-xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Servicio Local del Juego</div>
              <div className="text-rose-200 mt-0.5">{desktopServerBanner.message}</div>
            </div>
          </div>
          {desktopServerBanner.status !== 'restarting' && (
            <button
              onClick={() => void window.metroDesktop?.restartLocalServer()}
              className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold whitespace-nowrap cursor-pointer"
            >
              Reintentar
            </button>
          )}
        </div>
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
          onRestart={handleRestartCurrentRun}
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
            onReplay={handleRestartCurrentRun}
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
          activeLocalProfileId={activeLocalProfileId}
          mpConnected={mpConnected}
          mpSelfId={mpSelfId}
          mpTargetUrl={mpTargetUrl}
          mpRoom={mpRoom}
          mpInvite={mpInvite}
          mpNotice={mpNotice}
          pendingConflict={pendingConflict}
          pendingOnlineSave={pendingOnlineSave}
          onResolveConflict={handleResolveConflict}
          onDismissConflict={() => {
            setPendingConflict(null);
            setPendingOnlineSave(null);
          }}
          onDismissInvite={() => setMpInvite(null)}
          onClearNotice={() => setMpNotice(null)}
          previewBossId={previewBossId}
          onSelectBossPreview={(bossId) => setPreviewBossId(bossId)}
          onOnlineUserChange={(u) => setOnlineUser(u)}
          onSwitchLocalProfile={handleSwitchLocalProfile}
          onUpdateSave={updateSave}
          onVideoChangeWithConfirm={handleVideoChangeWithConfirm}
          onRunBenchmark={handleRunBenchmark}
          onReloadCustomGlb={() => engineRef.current?.rebuildPlayerCharacter()}
          updateInfo={updateInfo}
          updateState={updateState}
          onCheckForUpdates={handleCheckForUpdates}
          onDownloadUpdate={handleDownloadUpdate}
          onInstallUpdate={handleInstallUpdate}
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

      {/* Clean Exit Confirmation Modal (saves progress + stops LAN/Tunnel/WS + quits Electron) */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040712]/80 p-4">
          <div className="w-full max-w-md bg-[#0a1020] border border-rose-400/50 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <Power className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-white">
                  ¿Salir de METRO RUSH: NEON CITY?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Se guardará tu progreso local y online, se cerrará tu sala multijugador / servidor LAN o túnel activo y se detendrán los servicios de forma segura.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={exitingApp}
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 rounded-lg border border-white/15 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer disabled:opacity-50"
              >
                Volver al Juego
              </button>
              <button
                type="button"
                disabled={exitingApp}
                onClick={() => void handleConfirmExitGame()}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" />
                {exitingApp ? 'Guardando y cerrando...' : 'Guardar y Salir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {browserExitNotice && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-lg bg-[#091224] border border-cyan-400/60 rounded-xl px-4 py-3 text-xs text-cyan-200 shadow-2xl flex items-center justify-between gap-3">
          <span>{browserExitNotice}</span>
          <button
            onClick={() => setBrowserExitNotice(null)}
            className="text-slate-300 hover:text-white font-bold cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
