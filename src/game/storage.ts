import {
  ACHIEVEMENTS,
  BATTLE_PASS_MAX_TIER,
  COSMETICS,
  DEFAULT_FREE_RUN_CONFIG,
  DEFAULT_LEADERBOARD,
  getAllActiveMissions,
  getBossById,
  LIVE_EVENTS,
  MISSIONS,
  normalizeDistrictId,
  SKILL_TREE,
  VEHICLES,
} from './data';
import { addBattlePassXp, getSkillCoinCost } from './economy';
import {
  ActiveRunContext,
  BossId,
  ControlProfile,
  DistrictId,
  FriendEntry,
  GameMode,
  GraphicsQuality,
  KeyBindings,
  MatchRecord,
  PCSettings,
  PlayerSaveData,
  RunSummary,
  SavedLanRoom,
  VehicleId,
} from './types';

export const SAVE_VERSION = 6;
const SAVE_KEY = 'metro_rush_neon_city_save_v6';
const BACKUP_SAVE_KEY = 'metro_rush_neon_city_save_backup_v6';
const V5_SAVE_KEY = 'metro_rush_neon_city_save_v5';
const V4_SAVE_KEY = 'metro_rush_neon_city_save_v4';
const V3_SAVE_KEY = 'metro_rush_neon_city_save_v3';
const V2_SAVE_KEY = 'metro_rush_neon_city_save_v2';
const LEGACY_SAVE_KEY = 'metro_rush_neon_city_save_v1';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
export const NAME_CHANGE_COOLDOWN_MS = 3 * DAY_MS;

export const CONTROL_PROFILES: Record<ControlProfile, KeyBindings> = {
  default: {
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    slide: 'KeyS',
    sprint: 'ShiftLeft',
    interact: 'KeyE',
    ability: 'KeyF',
    activateVehicle: 'KeyV',
    callDrone: 'KeyG',
    slowMo: 'KeyC',
    pause: 'Escape',
  },
  competitive: {
    left: 'KeyA',
    right: 'KeyD',
    jump: 'KeyW',
    slide: 'KeyS',
    sprint: 'ShiftLeft',
    interact: 'Space',
    ability: 'KeyE',
    activateVehicle: 'KeyR',
    callDrone: 'KeyG',
    slowMo: 'KeyQ',
    pause: 'Escape',
  },
  one_hand: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    jump: 'ArrowUp',
    slide: 'ArrowDown',
    sprint: 'ShiftRight',
    interact: 'Enter',
    ability: 'KeyK',
    activateVehicle: 'KeyJ',
    callDrone: 'KeyH',
    slowMo: 'KeyL',
    pause: 'Escape',
  },
  custom: {
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    slide: 'KeyS',
    sprint: 'ShiftLeft',
    interact: 'KeyE',
    ability: 'KeyF',
    activateVehicle: 'KeyV',
    callDrone: 'KeyG',
    slowMo: 'KeyC',
    pause: 'Escape',
  },
};

export function findConflictingKeyBinding(
  bindings: KeyBindings,
  action: keyof KeyBindings,
  code: string,
): keyof KeyBindings | null {
  for (const [k, v] of Object.entries(bindings) as Array<[keyof KeyBindings, string]>) {
    if (k !== action && v === code) return k;
  }
  return null;
}

export const DEFAULT_SETTINGS: PCSettings = {
  language: 'es',

  // A. Video
  resolutionPreset: 'native',
  customWidth: 1920,
  customHeight: 1080,
  displayMode: 'windowed',
  refreshRate: 60,
  vsync: true,
  fpsLimit: 0,
  resolutionScale: 1.0,
  upscaler: 'none',
  antialiasing: true,
  sharpness: 0.4,

  // B. Graphics
  graphicsQuality: 'high',
  textureQuality: 'high',
  shadows: true,
  lightingQuality: 'cinematic',
  reflections: true,
  ambientOcclusion: true,
  volumetrics: true,
  drawDistance: 'far',
  lodBias: 'balanced',
  vegetationQuality: 'high',
  visualEffects: 'high',
  modelQuality: 'high',
  objectDensity: 'high',
  materialQuality: 'pbr',
  bloom: true,

  // C. Controls
  controlProfile: 'default',
  mouseSensitivity: 1.0,
  cameraSensitivity: 1.0,
  invertY: false,
  invertX: false,
  gamepadEnabled: true,
  keybindings: { ...CONTROL_PROFILES.default },

  // D. Sound (9 channels + lobby toggle)
  masterVolume: 0.75,
  musicVolume: 0.55,
  sfxVolume: 0.85,
  ambientVolume: 0.45,
  voiceVolume: 0.7,
  uiVolume: 0.75,
  droneVolume: 0.8,
  vehicleVolume: 0.8,
  chaseVolume: 0.85,
  lobbyMusicEnabled: true,
  muted: false,

  // E. Gameplay
  difficulty: 'normal',
  movementSensitivity: 1.0,
  parkourAssist: true,
  cameraAssist: true,
  vibrationIntensity: 0.7,
  cameraDistance: 1.0,
  cameraSpeed: 1.0,
  fovBase: 68,
  showIndicators: true,
  showOnScreenControls: true,
  showTutorialHints: true,
  subtitles: true,
  visualHelpers: true,
  reduceCameraMotion: false,
  dynamicWeather: true,
  randomMap: false,
  randomWeather: false,
  timeOfDay: 'dynamic',
  showPerfOverlay: false,

  // F. Accessibility
  colorblindMode: 'none',
  textSize: 'normal',
  hudScale: 'normal',
  highContrast: false,
  subtitleScale: 'normal',
  reduceFlashes: false,
  reduceVisualEffects: false,
  legibleFont: false,

  preferredAdapter: 'auto',
};

export function getPresetSettings(
  preset: Exclude<GraphicsQuality, 'custom'>,
): Partial<PCSettings> {
  switch (preset) {
    case 'very_low':
      return {
        graphicsQuality: 'very_low',
        resolutionScale: 0.65,
        textureQuality: 'low',
        shadows: false,
        lightingQuality: 'standard',
        reflections: false,
        ambientOcclusion: false,
        volumetrics: false,
        drawDistance: 'near',
        lodBias: 'performance',
        vegetationQuality: 'low',
        visualEffects: 'low',
        modelQuality: 'low',
        objectDensity: 'low',
        materialQuality: 'standard',
        bloom: false,
        antialiasing: false,
      };
    case 'low':
      return {
        graphicsQuality: 'low',
        resolutionScale: 0.82,
        textureQuality: 'low',
        shadows: false,
        lightingQuality: 'standard',
        reflections: false,
        ambientOcclusion: false,
        volumetrics: false,
        drawDistance: 'near',
        lodBias: 'performance',
        vegetationQuality: 'low',
        visualEffects: 'low',
        modelQuality: 'medium',
        objectDensity: 'low',
        materialQuality: 'standard',
        bloom: false,
        antialiasing: true,
      };
    case 'medium':
      return {
        graphicsQuality: 'medium',
        resolutionScale: 1.0,
        textureQuality: 'medium',
        shadows: true,
        lightingQuality: 'standard',
        reflections: false,
        ambientOcclusion: true,
        volumetrics: false,
        drawDistance: 'medium',
        lodBias: 'balanced',
        vegetationQuality: 'medium',
        visualEffects: 'medium',
        modelQuality: 'medium',
        objectDensity: 'medium',
        materialQuality: 'pbr',
        bloom: false,
        antialiasing: true,
      };
    case 'high':
      return {
        graphicsQuality: 'high',
        resolutionScale: 1.0,
        textureQuality: 'high',
        shadows: true,
        lightingQuality: 'cinematic',
        reflections: true,
        ambientOcclusion: true,
        volumetrics: true,
        drawDistance: 'far',
        lodBias: 'balanced',
        vegetationQuality: 'high',
        visualEffects: 'high',
        modelQuality: 'high',
        objectDensity: 'high',
        materialQuality: 'pbr',
        bloom: true,
        antialiasing: true,
      };
    case 'ultra':
      return {
        graphicsQuality: 'ultra',
        resolutionScale: 1.25,
        textureQuality: 'high',
        shadows: true,
        lightingQuality: 'cinematic',
        reflections: true,
        ambientOcclusion: true,
        volumetrics: true,
        drawDistance: 'far',
        lodBias: 'quality',
        vegetationQuality: 'high',
        visualEffects: 'high',
        modelQuality: 'high',
        objectDensity: 'high',
        materialQuality: 'pbr',
        bloom: true,
        antialiasing: true,
      };
  }
}

export function createInitialSave(): PlayerSaveData {
  const now = Date.now();
  return {
    saveVersion: SAVE_VERSION,
    playerName: 'RUNNER_01',
    lastNameChangeAt: 0,
    onboardingCompleted: false,
    playerAgeGroup: undefined,
    runnerExperience: undefined,
    avatarId: 'av_runner_core',
    ownedAvatars: ['av_runner_core'],
    equippedAvatarId: 'av_runner_core',
    modelStyle: 'cesium_man',
    level: 1,
    xp: 0,
    coins: 450,
    gems: 15,
    tickets: 1,
    reviveTokens: 2,
    talismans: 0,
    selectedCharacterId: 'kai',
    selectedDistrictId: 'downtown',
    selectedMode: 'endless',
    activeEventId: null,
    unlockedCharacters: ['kai', 'nova'],
    unlockedDistricts: ['downtown', 'oldcity'],
    ownedCosmetics: [
      'jacket_default',
      'visor_default',
      'sneakers_default',
      'backpack_none',
      'hair_default',
      'trail_cyan',
    ],
    equippedCosmetics: {
      jacket: 'jacket_default',
      visor: 'visor_default',
      sneakers: 'sneakers_default',
      backpack: 'backpack_none',
      hair: 'hair_default',
      trail: 'trail_cyan',
    },
    ownedDrones: ['drone_aegis_mk1'],
    equippedDroneId: 'drone_aegis_mk1',
    ownedBoosters: [],
    equippedBoosterId: null,
    ownedVehicles: ['hover_bike'],
    selectedVehicleId: 'hover_bike',
    vehicleUpgrades: {
      hover_bike: 0,
      cyber_coupe: 0,
      quantum_glider: 0,
      titan_rammer: 0,
      star_viper: 0,
      plasma_bomber: 0,
    },
    vehiclePaints: {
      hover_bike: VEHICLES[0].defaultPaint,
      cyber_coupe: VEHICLES[1].defaultPaint,
      quantum_glider: VEHICLES[2].defaultPaint,
      titan_rammer: VEHICLES[3].defaultPaint,
      star_viper: VEHICLES[4].defaultPaint,
      plasma_bomber: VEHICLES[5]?.defaultPaint ?? '#f43f5e',
    },
    skillLevels: {
      momentum_mastery: 0,
      aerial_thrusters: 0,
      chrono_capacitor: 0,
      mag_collector: 0,
      combo_multiplier: 0,
      shield_matrix: 0,
    },
    missionProgress: {},
    claimableMissions: [],
    completedMissions: [],
    dailyResetAt: now + DAY_MS,
    weeklyResetAt: now + WEEK_MS,
    seasonStartAtMs: now,
    completedEvents: [],
    defeatedBosses: [],
    customBossMeta: {},
    unlockedAchievements: [],
    storyChapter: 1,
    tutorialCompleted: false,
    tutorialStepSaved: 0,
    timeTrialBestByCity: {},
    freeRunConfig: { ...DEFAULT_FREE_RUN_CONFIG },
    lastLaunchedModeConfig: null,
    savedLanRooms: [],
    friends: [],
    battlePass: {
      season: 8,
      level: 1,
      xp: 0,
      premiumUnlocked: false,
      claimedFreeTiers: [],
      claimedPremiumTiers: [],
    },
    transactions: [],
    upgradeHistory: [],
    matchHistory: [],
    bestRun: null,
    stats: {
      totalRuns: 0,
      wins: 0,
      losses: 0,
      totalDistance: 0,
      bestDistance: 0,
      totalTimeSeconds: 0,
      bestSurvivalTimeSec: 0,
      bestScore: 0,
      maxSpeedKmh: 0,
      maxCombo: 0,
      totalCoinsCollected: 0,
      coinsSpent: 0,
      totalWallRuns: 0,
      totalGrapples: 0,
      totalVehiclesHijacked: 0,
      dronesEvaded: 0,
      enemiesEliminated: 0,
      bossesDefeated: 0,
      secretsFound: 0,
      revivesUsed: 0,
      missionsCompleted: 0,
      challengesCompleted: 0,
      abilitiesUsed: 0,
      eventsCompleted: 0,
      mpMatchesPlayed: 0,
      mpWins: 0,
      mpBestPlacement: 0,
      shieldBreaks: 0,
      doubleJumps: 0,
      parkourChains: 0,
      bossPhasesCleared: 0,
      fiveLaneDistance: 0,
      obstaclesDodged: 0,
      trainsPassed: 0,
      noReviveWins: 0,
    },
    leaderboard: [...DEFAULT_LEADERBOARD],
    settings: {
      ...DEFAULT_SETTINGS,
      keybindings: { ...DEFAULT_SETTINGS.keybindings },
    },
  };
}

export function sanitizeAndMigrateSave(parsed: Partial<PlayerSaveData>): PlayerSaveData {
  const base = createInitialSave();

  // Clean v8.0.0 seasonal progression reset when upgrading from legacy v1..v5 saves
  if (typeof parsed.saveVersion === 'number' && parsed.saveVersion < SAVE_VERSION) {
    return {
      ...base,
      playerName:
        typeof parsed.playerName === 'string' && parsed.playerName.trim().length > 0
          ? parsed.playerName.trim().slice(0, 18)
          : base.playerName,
      settings: {
        ...base.settings,
        ...(parsed.settings ?? {}),
        showOnScreenControls: parsed.settings?.showOnScreenControls ?? true,
        keybindings: {
          ...base.settings.keybindings,
          ...(parsed.settings?.keybindings ?? {}),
          callDrone: parsed.settings?.keybindings?.callDrone || base.settings.keybindings.callDrone,
          activateVehicle:
            parsed.settings?.keybindings?.activateVehicle ||
            base.settings.keybindings.activateVehicle,
        },
      },
      savedLanRooms: Array.isArray(parsed.savedLanRooms) ? parsed.savedLanRooms : [],
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
    };
  }

  const migratedDistricts = Array.from(
    new Set([
      'downtown',
      'oldcity',
      ...(parsed.unlockedDistricts ?? []).map(normalizeDistrictId),
    ]),
  ) as DistrictId[];

  const validTimes = new Set([
    'dawn',
    'morning',
    'noon',
    'afternoon',
    'dusk',
    'night',
    'midnight',
    'dynamic',
  ]);
  const rawTime = (parsed.settings as { timeOfDay?: string } | undefined)?.timeOfDay;
  const normalizedTime =
    rawTime === 'day'
      ? 'noon'
      : rawTime && validTimes.has(rawTime)
        ? (rawTime as PCSettings['timeOfDay'])
        : base.settings.timeOfDay;

  const normalizedBestRun = parsed.bestRun
    ? {
        ...parsed.bestRun,
        districtId: normalizeDistrictId(parsed.bestRun.districtId),
      }
    : null;

  const SEEDED_TEST_NAMES = new Set(['VEX_99', 'KITSUNE_RUN', 'TURBO_REYES', 'CYBER_VAL', 'SHADOW_KAI']);
  const normalizedLeaderboard =
    parsed.leaderboard && parsed.leaderboard.length > 0
      ? parsed.leaderboard
          .filter((entry) => !SEEDED_TEST_NAMES.has(entry.playerName))
          .map((entry) => ({
            ...entry,
            districtId: normalizeDistrictId(entry.districtId),
          }))
      : base.leaderboard;

  const validVehicles = new Set<VehicleId>(VEHICLES.map((v) => v.id));
  const ownedVehicles = Array.from(
    new Set([
      'hover_bike',
      ...(parsed.ownedVehicles ?? []).filter((id) => validVehicles.has(id as VehicleId)),
    ]),
  ) as VehicleId[];

  const selectedVehicleId: VehicleId = ownedVehicles.includes(
    parsed.selectedVehicleId as VehicleId,
  )
    ? (parsed.selectedVehicleId as VehicleId)
    : 'hover_bike';

  const now = Date.now();
  let dailyResetAt =
    typeof parsed.dailyResetAt === 'number' && parsed.dailyResetAt > 0
      ? parsed.dailyResetAt
      : now + DAY_MS;
  const weeklyResetAt =
    typeof parsed.weeklyResetAt === 'number' && parsed.weeklyResetAt > 0
      ? parsed.weeklyResetAt
      : now + WEEK_MS;
  const seasonStartAtMs =
    typeof parsed.seasonStartAtMs === 'number' && parsed.seasonStartAtMs > 0
      ? parsed.seasonStartAtMs
      : now;

  const missionProgress: Record<string, number> = {
    ...(parsed.missionProgress ?? {}),
  };
  let completedMissions = [...(parsed.completedMissions ?? [])];
  let claimableMissions = [...(parsed.claimableMissions ?? [])];

  // Daily missions reset each day across the 42-day cycle; weekly missions ACCUMULATE over 6 weeks
  if (now >= dailyResetAt) {
    dailyResetAt = now + DAY_MS;
    for (const m of MISSIONS) {
      if (m.category === 'daily') {
        missionProgress[m.id] = 0;
        completedMissions = completedMissions.filter((id) => id !== m.id);
        claimableMissions = claimableMissions.filter((id) => id !== m.id);
      }
    }
  }

  const ownedDrones = Array.from(
    new Set(['drone_aegis_mk1', ...(parsed.ownedDrones ?? [])]),
  );
  const ownedAvatars = Array.from(
    new Set(['av_runner_core', ...(parsed.ownedAvatars ?? [])]),
  );
  const ownedBoosters = Array.from(new Set(parsed.ownedBoosters ?? []));

  const cleanSave: PlayerSaveData = {
    ...base,
    ...parsed,
    saveVersion: SAVE_VERSION,
    coins: Math.max(0, Math.floor(parsed.coins ?? base.coins)),
    gems: Math.max(0, Math.floor(parsed.gems ?? base.gems)),
    tickets: Math.max(0, Math.floor(parsed.tickets ?? base.tickets)),
    reviveTokens: Math.max(0, Math.floor(parsed.reviveTokens ?? base.reviveTokens)),
    talismans: Math.max(0, Math.floor(parsed.talismans ?? base.talismans)),
    selectedDistrictId: normalizeDistrictId(
      parsed.selectedDistrictId ?? 'downtown',
    ),
    unlockedDistricts: migratedDistricts,
    defeatedBosses: parsed.defeatedBosses ?? [],
    customBossMeta: parsed.customBossMeta ?? {},
    ownedDrones,
    equippedDroneId:
      parsed.equippedDroneId === null
        ? null
        : parsed.equippedDroneId && ownedDrones.includes(parsed.equippedDroneId)
          ? parsed.equippedDroneId
          : 'drone_aegis_mk1',
    ownedBoosters,
    equippedBoosterId:
      parsed.equippedBoosterId && ownedBoosters.includes(parsed.equippedBoosterId)
        ? parsed.equippedBoosterId
        : null,
    ownedAvatars,
    equippedAvatarId:
      parsed.equippedAvatarId && ownedAvatars.includes(parsed.equippedAvatarId)
        ? parsed.equippedAvatarId
        : 'av_runner_core',
    avatarId:
      parsed.equippedAvatarId && ownedAvatars.includes(parsed.equippedAvatarId)
        ? parsed.equippedAvatarId
        : parsed.avatarId || 'av_runner_core',
    ownedVehicles,
    selectedVehicleId,
    vehicleUpgrades: {
      ...base.vehicleUpgrades,
      ...(parsed.vehicleUpgrades ?? {}),
    },
    vehiclePaints: {
      ...base.vehiclePaints,
      ...(parsed.vehiclePaints ?? {}),
    },
    equippedCosmetics: {
      ...base.equippedCosmetics,
      ...(parsed.equippedCosmetics ?? {}),
    },
    skillLevels: { ...base.skillLevels, ...(parsed.skillLevels ?? {}) },
    missionProgress,
    claimableMissions,
    completedMissions,
    dailyResetAt,
    weeklyResetAt,
    seasonStartAtMs,
    savedLanRooms: Array.isArray(parsed.savedLanRooms) ? parsed.savedLanRooms.slice(0, 12) : [],
    friends: Array.isArray(parsed.friends) ? parsed.friends.slice(0, 40) : [],
    battlePass: {
      ...base.battlePass,
      ...(parsed.battlePass ?? {}),
      season: 8,
      level: Math.max(1, Math.min(BATTLE_PASS_MAX_TIER, parsed.battlePass?.level ?? 1)),
      claimedFreeTiers: parsed.battlePass?.claimedFreeTiers ?? [],
      claimedPremiumTiers: parsed.battlePass?.claimedPremiumTiers ?? [],
    },
    timeTrialBestByCity: { ...(parsed.timeTrialBestByCity ?? {}) },
    freeRunConfig: {
      ...DEFAULT_FREE_RUN_CONFIG,
      ...(parsed.freeRunConfig ?? {}),
      districtId: normalizeDistrictId(parsed.freeRunConfig?.districtId ?? 'downtown'),
    },
    tutorialStepSaved: Math.max(0, Math.min(8, Math.floor(parsed.tutorialStepSaved ?? 0))),
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions.slice(0, 40) : [],
    upgradeHistory: Array.isArray(parsed.upgradeHistory)
      ? parsed.upgradeHistory.slice(0, 40)
      : [],
    matchHistory: Array.isArray(parsed.matchHistory)
      ? parsed.matchHistory.slice(0, 30)
      : [],
    bestRun: normalizedBestRun,
    stats: {
      ...base.stats,
      ...(parsed.stats ?? {}),
      bestDistance: Math.max(
        parsed.stats?.bestDistance ?? 0,
        normalizedBestRun?.distance ?? 0,
      ),
    },
    settings: {
      ...base.settings,
      ...(parsed.settings ?? {}),
      showOnScreenControls: parsed.settings?.showOnScreenControls ?? true,
      timeOfDay: normalizedTime,
      keybindings: {
        ...base.settings.keybindings,
        ...(parsed.settings?.keybindings ?? {}),
        callDrone:
          parsed.settings?.keybindings?.callDrone || base.settings.keybindings.callDrone,
        activateVehicle:
          parsed.settings?.keybindings?.activateVehicle ||
          base.settings.keybindings.activateVehicle,
      },
    },
    completedEvents: parsed.completedEvents ?? [],
    leaderboard: normalizedLeaderboard,
  };
  return cleanSave;
}

export function loadSaveData(): PlayerSaveData {
  const v6Candidates = [SAVE_KEY, BACKUP_SAVE_KEY];
  for (const key of v6Candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<PlayerSaveData>;
      if (!parsed || typeof parsed !== 'object') continue;
      const clean = sanitizeAndMigrateSave(parsed);
      persistSaveData(clean);
      return clean;
    } catch {
      // fall through
    }
  }

  // Upgrade from older save slot: preserve settings/name only, reset economy & pass cleanly for v8.0.0
  const legacyKeys = [V5_SAVE_KEY, V4_SAVE_KEY, V3_SAVE_KEY, V2_SAVE_KEY, LEGACY_SAVE_KEY];
  for (const key of legacyKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<PlayerSaveData>;
      if (!parsed || typeof parsed !== 'object') continue;
      const resetClean = sanitizeAndMigrateSave({ ...parsed, saveVersion: 5 });
      persistSaveData(resetClean);
      return resetClean;
    } catch {
      // ignore
    }
  }
  const initial = createInitialSave();
  persistSaveData(initial);
  return initial;
}

export function persistSaveData(save: PlayerSaveData): void {
  try {
    const serialized = JSON.stringify({
      ...save,
      saveVersion: SAVE_VERSION,
    });
    localStorage.setItem(SAVE_KEY, serialized);
    localStorage.setItem(BACKUP_SAVE_KEY, serialized);
  } catch {
    // Ignore storage quota errors
  }
}

export function exportSaveBackupJson(save: PlayerSaveData): string {
  return JSON.stringify(
    {
      ...save,
      saveVersion: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export function importSaveBackupJson(jsonText: string): {
  ok: boolean;
  save?: PlayerSaveData;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText) as Partial<PlayerSaveData>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.playerName !== 'string'
    ) {
      return { ok: false, error: 'El archivo no corresponde a un respaldo válido de Metro Rush.' };
    }
    const clean = sanitizeAndMigrateSave(parsed);
    persistSaveData(clean);
    return { ok: true, save: clean };
  } catch {
    return { ok: false, error: 'JSON inválido o corrupto.' };
  }
}

export function resetSettingsToDefault(save: PlayerSaveData): PlayerSaveData {
  const next: PlayerSaveData = {
    ...save,
    settings: {
      ...DEFAULT_SETTINGS,
      language: save.settings.language,
      keybindings: { ...DEFAULT_SETTINGS.keybindings },
    },
  };
  persistSaveData(next);
  return next;
}

export function resetLocalProgressionClean(save: PlayerSaveData): PlayerSaveData {
  const fresh = createInitialSave();
  const next: PlayerSaveData = {
    ...fresh,
    playerName: save.playerName,
    lastNameChangeAt: save.lastNameChangeAt ?? 0,
    onboardingCompleted: save.onboardingCompleted ?? false,
    playerAgeGroup: save.playerAgeGroup,
    runnerExperience: save.runnerExperience,
    modelStyle: save.modelStyle ?? 'cesium_man',
    customBossMeta: save.customBossMeta ?? {},
    savedLanRooms: save.savedLanRooms ?? [],
    friends: save.friends ?? [],
    settings: {
      ...save.settings,
      keybindings: { ...save.settings.keybindings },
    },
  };
  persistSaveData(next);
  return next;
}

export function getNameChangeCooldownInfo(save: PlayerSaveData, nowMs = Date.now()): {
  canChange: boolean;
  remainingMs: number;
  remainingHours: number;
} {
  const last = save.lastNameChangeAt ?? 0;
  if (!last) return { canChange: true, remainingMs: 0, remainingHours: 0 };
  const elapsed = nowMs - last;
  const remainingMs = Math.max(0, NAME_CHANGE_COOLDOWN_MS - elapsed);
  return {
    canChange: remainingMs <= 0,
    remainingMs,
    remainingHours: Math.ceil(remainingMs / (60 * 60 * 1000)),
  };
}

export function changeOfflineUsername(
  save: PlayerSaveData,
  newNameRaw: string,
  nowMs = Date.now(),
): { ok: boolean; reason?: string; nextSave: PlayerSaveData } {
  const cleaned = newNameRaw.trim().replace(/[^\w\- áéíóúÁÉÍÓÚñÑ]/g, '').slice(0, 18);
  if (cleaned.length < 3) {
    return { ok: false, reason: 'El nombre debe tener al menos 3 caracteres.', nextSave: save };
  }
  if (cleaned === save.playerName) {
    return { ok: false, reason: 'Ese ya es tu nombre actual.', nextSave: save };
  }
  const cd = getNameChangeCooldownInfo(save, nowMs);
  if (!cd.canChange) {
    const days = Math.floor(cd.remainingHours / 24);
    const hrs = cd.remainingHours % 24;
    return {
      ok: false,
      reason: `Debes esperar ${days}d ${hrs}h para volver a cambiar tu nombre.`,
      nextSave: save,
    };
  }
  const next: PlayerSaveData = {
    ...save,
    playerName: cleaned,
    lastNameChangeAt: nowMs,
  };
  persistSaveData(next);
  return { ok: true, nextSave: next };
}

export function saveLanRoomPreset(save: PlayerSaveData, room: SavedLanRoom): PlayerSaveData {
  const existing = (save.savedLanRooms ?? []).filter((r) => r.id !== room.id && r.hostAddress !== room.hostAddress);
  const next: PlayerSaveData = {
    ...save,
    savedLanRooms: [room, ...existing].slice(0, 12),
  };
  persistSaveData(next);
  return next;
}

export function deleteLanRoomPreset(save: PlayerSaveData, roomId: string): PlayerSaveData {
  const next: PlayerSaveData = {
    ...save,
    savedLanRooms: (save.savedLanRooms ?? []).filter((r) => r.id !== roomId),
  };
  persistSaveData(next);
  return next;
}

export function upsertLocalFriend(save: PlayerSaveData, friend: FriendEntry): PlayerSaveData {
  const existing = (save.friends ?? []).filter((f) => f.userId !== friend.userId);
  const next: PlayerSaveData = {
    ...save,
    friends: [friend, ...existing].slice(0, 40),
  };
  persistSaveData(next);
  return next;
}

export function xpRequiredForLevel(level: number): number {
  return Math.floor(350 * Math.pow(level, 1.32));
}

export function getSkillCost(skillId: string, currentLevel: number): number {
  const node = SKILL_TREE.find((s) => s.id === skillId);
  if (!node) return 9999;
  return getSkillCoinCost(skillId, currentLevel);
}

export interface RunTelemetry {
  victory: boolean;
  defeatCause: string;
  mode: GameMode;
  districtId: DistrictId;
  characterId: string;
  eventId: string | null;
  activeRunContext?: ActiveRunContext;
  score: number;
  distance: number;
  durationSec: number;
  coins: number;
  gems: number;
  maxSpeedKmh: number;
  maxCombo: number;
  wallRuns: number;
  grapples: number;
  vehicles: number;
  dronesEvaded: number;
  enemiesEliminated: number;
  obstaclesDodged?: number;
  trainsPassed?: number;
  shieldBreaks?: number;
  doubleJumps?: number;
  parkourChains?: number;
  bossPhasesCleared?: number;
  bossPhaseReached?: number;
  bossEncounteredId?: BossId | null;
  bossDefeatedId: BossId | null;
  abilitiesUsed: number;
  slowMoUsed: number;
  fiveLaneDistance?: number;
  secrets: number;
  revivesUsed: number;
  talismanAutoRevives: number;
  storyChapterPlayed: number | null;
  highlights: string[];
}

export function applyRunToSave(
  prev: PlayerSaveData,
  run: RunTelemetry,
): { nextSave: PlayerSaveData; summary: RunSummary } {
  const previousBestScore = prev.stats.bestScore;
  const previousBestDistance = prev.stats.bestDistance;
  const previousLastRun = prev.matchHistory[0] ?? null;

  const next: PlayerSaveData = structuredClone(prev);

  const obstaclesDodged = run.obstaclesDodged ?? 0;
  const trainsPassed = run.trainsPassed ?? 0;
  const shieldBreaks = run.shieldBreaks ?? 0;
  const doubleJumps = run.doubleJumps ?? 0;
  const parkourChains = run.parkourChains ?? 0;
  const bossPhasesCleared = run.bossPhasesCleared ?? 0;
  const bossPhaseReached = run.bossPhaseReached ?? 0;

  const xpEarned =
    Math.floor(run.distance * 0.28) +
    Math.floor(run.score * 0.015) +
    run.coins * 2 +
    run.dronesEvaded * 12 +
    run.enemiesEliminated * 15 +
    bossPhasesCleared * 80 +
    (run.bossDefeatedId ? 520 : 0) +
    (run.victory ? 320 : 65);

  const bpXpEarned =
    Math.floor(run.distance * 0.16) +
    run.coins +
    run.enemiesEliminated * 10 +
    bossPhasesCleared * 60 +
    (run.bossDefeatedId ? 300 : 0) +
    (run.victory ? 200 : 50);

  next.coins += run.coins;
  next.gems += run.gems;
  next.xp += xpEarned;

  const bpResult = addBattlePassXp(next.battlePass, bpXpEarned);
  next.battlePass = bpResult.nextBp;

  if (run.mode === 'tutorial' && (run.victory || run.distance >= 400)) {
    next.tutorialCompleted = true;
    next.tutorialStepSaved = 8;
  }

  const cleanDist = Math.floor(run.distance);
  const cleanDur = Math.floor(run.durationSec);
  const cleanScore = Math.floor(run.score);

  if (run.mode === 'timetrial' && cleanDur > 0) {
    const prevBestCity = next.timeTrialBestByCity?.[run.districtId] ?? 0;
    next.timeTrialBestByCity = {
      ...(next.timeTrialBestByCity ?? {}),
      [run.districtId]: Math.max(prevBestCity, cleanDur),
    };
  }

  next.stats.totalRuns += 1;
  if (run.victory) next.stats.wins += 1;
  else next.stats.losses += 1;

  next.stats.totalDistance += cleanDist;
  next.stats.bestDistance = Math.max(next.stats.bestDistance, cleanDist);
  next.stats.totalTimeSeconds += cleanDur;
  next.stats.bestSurvivalTimeSec = Math.max(
    next.stats.bestSurvivalTimeSec,
    cleanDur,
  );
  next.stats.bestScore = Math.max(next.stats.bestScore, cleanScore);
  next.stats.maxSpeedKmh = Math.max(
    next.stats.maxSpeedKmh,
    Math.floor(run.maxSpeedKmh),
  );
  next.stats.maxCombo = Math.max(next.stats.maxCombo, run.maxCombo);
  next.stats.totalCoinsCollected += run.coins;
  next.stats.totalWallRuns += run.wallRuns;
  next.stats.totalGrapples += run.grapples;
  next.stats.totalVehiclesHijacked += run.vehicles;
  next.stats.dronesEvaded += run.dronesEvaded;
  next.stats.enemiesEliminated += run.enemiesEliminated;
  next.stats.secretsFound += run.secrets;
  next.stats.revivesUsed += run.revivesUsed;
  next.stats.abilitiesUsed += run.abilitiesUsed;
  next.stats.shieldBreaks = (next.stats.shieldBreaks ?? 0) + shieldBreaks;
  next.stats.doubleJumps = (next.stats.doubleJumps ?? 0) + doubleJumps;
  next.stats.parkourChains = (next.stats.parkourChains ?? 0) + parkourChains;
  next.stats.bossPhasesCleared = (next.stats.bossPhasesCleared ?? 0) + bossPhasesCleared;
  next.stats.obstaclesDodged = (next.stats.obstaclesDodged ?? 0) + obstaclesDodged;
  next.stats.trainsPassed = (next.stats.trainsPassed ?? 0) + trainsPassed;
  if (run.victory && run.revivesUsed === 0 && run.talismanAutoRevives === 0) {
    next.stats.noReviveWins = (next.stats.noReviveWins ?? 0) + 1;
  }

  const fiveLaneDistRun = Math.floor(run.fiveLaneDistance ?? 0);
  if (fiveLaneDistRun > 0) {
    next.stats.fiveLaneDistance = (next.stats.fiveLaneDistance ?? 0) + fiveLaneDistRun;
  }

  if (run.bossDefeatedId) {
    next.stats.bossesDefeated += 1;
    if (!next.defeatedBosses.includes(run.bossDefeatedId)) {
      next.defeatedBosses.push(run.bossDefeatedId);
    }
  }

  if (
    run.mode === 'story' &&
    run.victory &&
    run.storyChapterPlayed &&
    run.storyChapterPlayed >= next.storyChapter
  ) {
    next.storyChapter = Math.min(5, run.storyChapterPlayed + 1);
  }

  const matchRec: MatchRecord = {
    id: `run_${Date.now()}`,
    date: new Date().toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    timestampMs: Date.now(),
    mode: run.mode,
    districtId: run.districtId,
    characterId: run.characterId,
    victory: run.victory,
    score: cleanScore,
    distance: cleanDist,
    durationSec: cleanDur,
    coinsEarned: run.coins,
    enemiesEliminated: run.enemiesEliminated,
    revivesUsed: run.revivesUsed,
    defeatCause: run.defeatCause,
  };
  next.matchHistory = [matchRec, ...next.matchHistory].slice(0, 30);

  if (!next.bestRun || cleanScore >= next.bestRun.score) {
    next.bestRun = {
      score: cleanScore,
      distance: cleanDist,
      maxSpeedKmh: Math.floor(run.maxSpeedKmh),
      maxCombo: run.maxCombo,
      districtId: run.districtId,
      characterId: run.characterId,
      mode: run.mode,
      date: new Date().toLocaleDateString('es-ES'),
      highlights: run.highlights.slice(0, 6),
    };
  }

  let completedEventTitle: string | null = null;
  if (run.eventId && run.victory) {
    const evt = LIVE_EVENTS.find((e) => e.id === run.eventId);
    if (evt) {
      next.stats.eventsCompleted += 1;
      if (!next.completedEvents.includes(evt.id)) {
        next.completedEvents.push(evt.id);
        next.coins += evt.rewardCoins;
        next.gems += evt.rewardGems;
        completedEventTitle = evt.title;
      }
    }
  }
  next.activeEventId = null;

  const newlyCompletedMissions: string[] = [];
  const newlyClaimableMissions: string[] = [];

  const activeMissions = getAllActiveMissions(next.seasonStartAtMs);
  for (const m of activeMissions) {
    if (next.completedMissions.includes(m.id)) continue;
    if (m.districtReq && m.districtReq !== run.districtId) continue;
    if (m.characterReq && m.characterReq !== run.characterId) continue;

    let delta = 0;
    switch (m.type) {
      case 'distance':
        if (m.category === 'story') {
          next.missionProgress[m.id] = Math.max(
            next.missionProgress[m.id] ?? 0,
            cleanDist,
          );
        } else {
          delta = cleanDist;
        }
        break;
      case 'coins':
        delta = run.coins;
        break;
      case 'combos':
        next.missionProgress[m.id] = Math.max(
          next.missionProgress[m.id] ?? 0,
          run.maxCombo,
        );
        break;
      case 'wallrun':
        delta = run.wallRuns;
        break;
      case 'zipline':
        delta = run.grapples;
        break;
      case 'slowmo':
        delta = run.slowMoUsed;
        break;
      case 'ability':
        delta = run.abilitiesUsed;
        break;
      case 'vehicle':
        delta = run.vehicles;
        break;
      case 'boss':
        delta = run.bossDefeatedId ? 1 : 0;
        break;
      case 'survivalTime':
        delta = cleanDur;
        break;
      case 'enemies':
        delta = run.dronesEvaded + run.enemiesEliminated;
        break;
      case 'secrets':
        delta = run.secrets;
        break;
      case 'revives':
        delta = run.revivesUsed;
        break;
      case 'shieldBreak':
        delta = shieldBreaks;
        break;
      case 'doubleJump':
        delta = doubleJumps;
        break;
      case 'parkourChain':
        delta = parkourChains;
        break;
      case 'fiveLaneDist':
        delta = fiveLaneDistRun;
        break;
      case 'bossPhase':
        delta = bossPhasesCleared;
        break;
      case 'noReviveWin':
        if (run.victory && run.revivesUsed === 0 && run.talismanAutoRevives === 0) {
          delta = 1;
        }
        break;
    }

    if (delta > 0) {
      next.missionProgress[m.id] = (next.missionProgress[m.id] ?? 0) + delta;
    }

    if (
      (next.missionProgress[m.id] ?? 0) >= m.target &&
      !next.claimableMissions.includes(m.id)
    ) {
      next.claimableMissions.push(m.id);
      newlyClaimableMissions.push(m.title);
      newlyCompletedMissions.push(m.title);
    }
  }

  const newlyUnlockedAchievements: string[] = [];
  const checkAch = (id: string, condition: boolean) => {
    if (condition && !next.unlockedAchievements.includes(id)) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) {
        next.unlockedAchievements.push(id);
        next.gems += def.rewardGems;
        newlyUnlockedAchievements.push(def.title);
      }
    }
  };
  checkAch('ach_first_run', next.stats.totalRuns >= 1);
  checkAch('ach_speed_demon', next.stats.maxSpeedKmh >= 160);
  checkAch('ach_combo_master', next.stats.maxCombo >= 10);
  checkAch('ach_collector', next.stats.totalCoinsCollected >= 2500);
  checkAch('ach_explorer', next.stats.secretsFound >= 5);
  checkAch('ach_skywalker', next.stats.totalGrapples >= 25);
  checkAch('ach_shield_nova', next.stats.shieldBreaks >= 10);
  checkAch('ach_parkour_king', next.stats.parkourChains >= 15);
  checkAch('ach_drone_dodger', next.stats.dronesEvaded >= 35);
  checkAch('ach_boss_slayer', next.defeatedBosses.length >= 3);

  let leveledUp = false;
  while (next.xp >= xpRequiredForLevel(next.level)) {
    next.xp -= xpRequiredForLevel(next.level);
    next.level += 1;
    next.gems += 3;
    next.coins += 250;
    leveledUp = true;
  }

  if (cleanScore > 0) {
    next.leaderboard.push({
      id: `run_${Date.now()}`,
      playerName: next.playerName,
      avatar: next.avatarId,
      characterId: run.characterId,
      districtId: run.districtId,
      mode: run.mode,
      score: cleanScore,
      distance: cleanDist,
      maxCombo: run.maxCombo,
      date: 'Ahora',
      isPlayer: true,
    });
    next.leaderboard.sort((a, b) => b.score - a.score);
    next.leaderboard = next.leaderboard.slice(0, 15);
  }

  persistSaveData(next);

  const bossIdRef = run.bossDefeatedId ?? run.bossEncounteredId ?? null;
  const bossName = bossIdRef ? getBossById(bossIdRef).name : null;

  const activeRunContext: ActiveRunContext = run.activeRunContext ?? {
    mode: run.mode,
    districtId: run.districtId,
    eventId: run.eventId,
    bossId: run.bossEncounteredId ?? null,
    storyChapter: run.storyChapterPlayed,
  };

  return {
    nextSave: next,
    summary: {
      victory: run.victory,
      defeatCause: run.defeatCause,
      mode: run.mode,
      districtId: run.districtId,
      characterId: run.characterId,
      activeRunContext,
      score: cleanScore,
      distance: cleanDist,
      durationSec: cleanDur,
      coins: run.coins,
      gems: run.gems,
      xpEarned,
      battlePassXpEarned: bpXpEarned,
      bpLeveledUp: bpResult.leveledUp,
      newBpLevel: next.battlePass.level,
      maxSpeedKmh: Math.floor(run.maxSpeedKmh),
      maxCombo: run.maxCombo,
      wallRuns: run.wallRuns,
      grapples: run.grapples,
      vehicles: run.vehicles,
      dronesEvaded: run.dronesEvaded,
      enemiesEliminated: run.enemiesEliminated,
      obstaclesDodged,
      trainsPassed,
      shieldBreaks,
      doubleJumps,
      parkourChains,
      bossPhasesCleared,
      bossPhaseReached,
      bossName,
      bossDefeatedId: run.bossDefeatedId,
      secrets: run.secrets,
      revivesUsed: run.revivesUsed,
      talismanAutoRevives: run.talismanAutoRevives,
      highlights: run.highlights,
      newlyCompletedMissions,
      newlyClaimableMissions,
      newlyUnlockedAchievements,
      completedEventTitle,
      leveledUp,
      newLevel: next.level,
      previousBestScore,
      previousBestDistance,
      previousLastRun,
    },
  };
}

export function getEquippedCosmeticColor(
  save: PlayerSaveData,
  slot: keyof PlayerSaveData['equippedCosmetics'],
  fallback: string,
): string {
  const id = save.equippedCosmetics[slot];
  if (!id || id.endsWith('_default')) return fallback;
  const item = COSMETICS.find((c) => c.id === id);
  return item ? item.color : fallback;
}
