export type LanguageCode =
  | 'es'
  | 'en'
  | 'fr'
  | 'pt'
  | 'de'
  | 'it'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'ru';

export type DistrictId =
  | 'downtown'
  | 'oldcity'
  | 'industrial'
  | 'skyline'
  | 'beach'
  | 'underground'
  | 'future'
  | 'cyber_port'
  | 'obsidian_citadel'
  | 'crimson_metropolis';

export type GameMode =
  | 'endless'
  | 'story'
  | 'timetrial'
  | 'parkour'
  | 'bosschase'
  | 'freerun'
  | 'tutorial';

export type WeatherType = 'clear' | 'rain' | 'cyberfog' | 'storm' | 'sunset';

export type TimeOfDay =
  | 'dawn'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'dusk'
  | 'night'
  | 'midnight'
  | 'dynamic';

export type GraphicsQuality =
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'ultra'
  | 'custom';

export type DisplayMode = 'fullscreen' | 'borderless' | 'windowed';
export type UpscalerType = 'none' | 'fsr' | 'dlss' | 'xess';
export type DifficultyLevel = 'easy' | 'normal' | 'hard';
export type ColorblindMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
export type ControlProfile = 'default' | 'competitive' | 'one_hand' | 'custom';
export type HudScale = 'compact' | 'normal' | 'large';
export type TextSizeScale = 'small' | 'normal' | 'large';

export type EnemyClass =
  | 'scout'
  | 'pursuit'
  | 'armored'
  | 'surveillance'
  | 'swarm'
  | 'ground_bot'
  | 'security_bot'
  | 'intervention'
  | 'tactical'
  | 'elite';

export type BossId =
  | 'titan_drone'
  | 'iron_hunter'
  | 'overseer'
  | 'neon_wraith'
  | 'cryo_leviathan'
  | 'volt_archon'
  | 'the_sentinel'
  | 'omega_core';

export type DynamicEventType =
  | 'power_outage'
  | 'drone_pursuit'
  | 'express_train'
  | 'construction'
  | 'sky_bridge'
  | 'storm_surge'
  | 'coin_surge'
  | 'pursuer_frenzy'
  | 'talisman_signal';

export type ParkourAction =
  | 'idle'
  | 'run'
  | 'sprint'
  | 'jump'
  | 'doubleJump'
  | 'slide'
  | 'wallRunLeft'
  | 'wallRunRight'
  | 'wallClimb'
  | 'zipline'
  | 'grapple'
  | 'swingBar'
  | 'balanceBeam'
  | 'vehicle'
  | 'dive'
  | 'vault'
  | 'celebrate'
  | 'stumble'
  | 'captureStruggle';

export type VehicleId =
  | 'hover_bike'
  | 'cyber_coupe'
  | 'quantum_glider'
  | 'titan_rammer'
  | 'star_viper';

export interface UnlockRequirement {
  type: 'missions' | 'bosses' | 'distance' | 'level' | 'achievement' | 'parkourChains';
  target: number;
  achievementId?: string;
  label: string;
}

export interface VehicleStats {
  speed: number;
  handling: number;
  shield: number;
  boostDuration: number;
}

export interface VehicleDef {
  id: VehicleId;
  name: string;
  category: string;
  description: string;
  isShip: boolean;
  unlockCostCoins: number;
  unlockCostGems: number;
  unlockRequirement?: UnlockRequirement;
  defaultPaint: string;
  accentColor: string;
  baseStats: VehicleStats;
  maxUpgradeLevel: number;
}

export type SpecialItemId =
  | 'revive_token_1'
  | 'revive_token_3'
  | 'talisman_1'
  | 'ticket_pack_3'
  | 'ticket_pack_10'
  | 'shield_charge_pack';

export interface SpecialShopItem {
  id: SpecialItemId;
  name: string;
  description: string;
  category: 'revive' | 'talisman' | 'tickets' | 'booster';
  costCoins: number;
  costGems: number;
  grantCoins?: number;
  grantTickets?: number;
  grantReviveTokens?: number;
  grantTalismans?: number;
  rarity: 'Común' | 'Raro' | 'Épico' | 'Legendario';
}

export interface BattlePassReward {
  type: 'coins' | 'gems' | 'tickets' | 'reviveTokens' | 'talismans' | 'cosmetic' | 'vehicle';
  amount?: number;
  itemId?: string;
  label: string;
}

export interface BattlePassTierDef {
  tier: number;
  xpRequired: number;
  freeReward: BattlePassReward;
  premiumReward: BattlePassReward;
}

export interface BattlePassState {
  season: number;
  level: number;
  xp: number;
  premiumUnlocked: boolean;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
}

export interface StoryDialogueBeat {
  progressRatio: number; // 0..1
  speaker: string;
  text: string;
}

export interface StoryChapterDef {
  chapter: number;
  title: string;
  districtId: DistrictId;
  targetDistance: number;
  objectiveType: 'distance' | 'combos' | 'zipline' | 'boss';
  objectiveTarget: number;
  objectiveLabel: string;
  briefing: string;
  bossId?: BossId;
  pursuerAggressive: boolean;
  rewardCoins: number;
  rewardGems: number;
  rewardTickets: number;
  dialogueBeats: StoryDialogueBeat[];
}

export interface TransactionRecord {
  id: string;
  date: string;
  item: string;
  category: string;
  costText: string;
}

export interface UpgradeRecord {
  id: string;
  date: string;
  targetName: string;
  newLevel: number;
  costText: string;
}

export interface MatchRecord {
  id: string;
  date: string;
  timestampMs?: number;
  mode: GameMode;
  districtId: DistrictId;
  characterId: string;
  victory: boolean;
  score: number;
  distance: number;
  durationSec: number;
  coinsEarned: number;
  enemiesEliminated: number;
  revivesUsed: number;
  defeatCause: string;
}

export interface CharacterStats {
  speed: number;
  agility: number;
  jump: number;
  tech: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  origin: string;
  bio: string;
  abilityName: string;
  abilityDesc: string;
  abilityCooldown: number;
  passiveName?: string;
  passiveDesc?: string;
  secondaryAbilityName?: string;
  secondaryAbilityDesc?: string;
  unlockCostCoins: number;
  unlockCostGems: number;
  unlockRequirement?: UnlockRequirement;
  stats: CharacterStats;
  colors: {
    skin: string;
    jacket: string;
    accent: string;
    pants: string;
    hair: string;
    visor: string;
    sneakers: string;
  };
  hairStyle: 'spiky' | 'hood' | 'ponytail' | 'cyberhelm' | 'mohawk' | 'visorcap';
  voicePitch: number;
  quote: string;
}

export interface DistrictDef {
  id: DistrictId;
  name: string;
  subtitle: string;
  description: string;
  laneCount: 3 | 5;
  unlockCostCoins: number;
  unlockLevel: number;
  difficulty: number;
  gravityMultiplier: number;
  speedBonus: number;
  colors: {
    skyTop: string;
    skyHorizon: string;
    fog: string;
    ground: string;
    railGlow: string;
    primaryNeon: string;
    secondaryNeon: string;
    buildingBase: string;
    sunLight: string;
  };
  isUnderground: boolean;
  defaultWeather: WeatherType;
  defaultTimeOfDay: Exclude<TimeOfDay, 'dynamic'>;
  musicBpm: number;
  musicRootHz: number;
  specialFeature: string;
  signatureEnemies: EnemyClass[];
  signatureBoss: BossId;
  landmarkType:
    | 'holotower'
    | 'lanterns'
    | 'crane'
    | 'skybridge'
    | 'palms'
    | 'tunnel'
    | 'reactor'
    | 'harbor'
    | 'citadel'
    | 'monolith';
}

export interface BossPhaseDef {
  phase: 1 | 2 | 3 | 4;
  name: string;
  subtitle: string;
  description: string;
  hpUnits: number;
  attackCooldownSec: number;
  empSpawnSec: number;
  auraColor: string;
  envTint: string;
  scaleBoost: number;
  patterns: ('lane_sweep' | 'dual_projectile' | 'shockwave' | 'orbital_cross' | 'homing_burst' | 'rail_overload')[];
}

export interface BossDef {
  id: BossId;
  name: string;
  title: string;
  introTitle: string;
  introQuote: string;
  cityId: DistrictId;
  description: string;
  hpSegments: number;
  phases: string[];
  phaseDetails?: string[];
  phasesConfig: BossPhaseDef[];
  counterHint: string;
  rewardCoins: number;
  rewardGems: number;
  primaryColor: string;
  secondaryColor: string;
}

export interface CustomBossMeta {
  bossId: BossId;
  name: string;
  fileName: string;
  fileSizeBytes: number;
  vertices: number;
  triangles: number;
  meshes: number;
  clips: string[];
  hasSkeleton: boolean;
  enabled: boolean;
  uploadedAt: string;
}

export interface CustomBossValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  meta?: CustomBossMeta;
}

export type CosmeticSlot =
  | 'jacket'
  | 'hair'
  | 'visor'
  | 'sneakers'
  | 'backpack'
  | 'trail';

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  color: string;
  secondaryColor?: string;
  styleVariant?: string;
  costCoins: number;
  costGems: number;
  rarity: 'Común' | 'Raro' | 'Épico' | 'Legendario';
}

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  ticketCostPerLevel: number;
  effectPerLevel: string;
}

export type MissionCategory =
  | 'daily'
  | 'weekly'
  | 'special'
  | 'season'
  | 'combat'
  | 'exploration'
  | 'survival'
  | 'character'
  | 'vehicle'
  | 'boss'
  | 'story';

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  type:
    | 'distance'
    | 'coins'
    | 'combos'
    | 'wallrun'
    | 'zipline'
    | 'slowmo'
    | 'ability'
    | 'vehicle'
    | 'boss'
    | 'survivalTime'
    | 'enemies'
    | 'secrets'
    | 'revives'
    | 'shieldBreak'
    | 'doubleJump'
    | 'parkourChain'
    | 'fiveLaneDist'
    | 'bossPhase'
    | 'noReviveWin';
  target: number;
  rewardCoins: number;
  rewardGems: number;
  rewardXp: number;
  rewardTickets?: number;
  rewardReviveTokens?: number;
  rewardTalismans?: number;
  rewardBpXp?: number;
  unlockContentLabel?: string;
  difficulty?: 'Fácil' | 'Media' | 'Alta' | 'Extrema';
  category: MissionCategory;
  districtReq?: DistrictId;
  characterReq?: string;
  vehicleReq?: VehicleId;
  chapter?: number;
}

export interface LiveEventDef {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  districtId: DistrictId;
  mode: GameMode;
  bossId?: BossId;
  modifierTag: string;
  rewardCoins: number;
  rewardGems: number;
  targetDistance: number;
  gravityScale: number;
  droneIntensity: number;
  gemMultiplier: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardGems: number;
  conditionText: string;
}

export interface KeyBindings {
  left: string;
  right: string;
  jump: string;
  slide: string;
  sprint: string;
  interact: string;
  ability: string;
  slowMo: string;
  pause: string;
}

export interface PCSettings {
  language: LanguageCode;

  // A. Video
  resolutionPreset: string;
  customWidth: number;
  customHeight: number;
  displayMode: DisplayMode;
  refreshRate: number;
  vsync: boolean;
  fpsLimit: 0 | 30 | 60 | 120 | 144 | 240;
  resolutionScale: number;
  upscaler: UpscalerType;
  antialiasing: boolean;
  sharpness: number;

  // B. Graphics
  graphicsQuality: GraphicsQuality;
  textureQuality: 'low' | 'medium' | 'high';
  shadows: boolean;
  lightingQuality: 'standard' | 'cinematic';
  reflections: boolean;
  ambientOcclusion: boolean;
  volumetrics: boolean;
  drawDistance: 'near' | 'medium' | 'far';
  lodBias: 'performance' | 'balanced' | 'quality';
  vegetationQuality: 'low' | 'medium' | 'high';
  visualEffects: 'low' | 'medium' | 'high';
  modelQuality: 'low' | 'medium' | 'high';
  objectDensity: 'low' | 'medium' | 'high';
  materialQuality: 'standard' | 'pbr';
  bloom: boolean;

  // C. Controls
  controlProfile: ControlProfile;
  mouseSensitivity: number;
  cameraSensitivity: number;
  invertY: boolean;
  invertX: boolean;
  gamepadEnabled: boolean;
  keybindings: KeyBindings;

  // D. Sound (9 channels + lobby music toggle)
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  voiceVolume: number;
  uiVolume: number;
  droneVolume: number;
  vehicleVolume: number;
  chaseVolume: number;
  lobbyMusicEnabled: boolean;
  muted: boolean;

  // E. Gameplay
  difficulty: DifficultyLevel;
  movementSensitivity: number;
  parkourAssist: boolean;
  cameraAssist: boolean;
  vibrationIntensity: number;
  cameraDistance: number;
  cameraSpeed: number;
  fovBase: number;
  showIndicators: boolean;
  showTutorialHints: boolean;
  subtitles: boolean;
  visualHelpers: boolean;
  reduceCameraMotion: boolean;
  dynamicWeather: boolean;
  randomMap?: boolean;
  randomWeather?: boolean;
  timeOfDay: TimeOfDay;
  showPerfOverlay: boolean;

  // F. Accessibility
  colorblindMode: ColorblindMode;
  textSize: TextSizeScale;
  hudScale: HudScale;
  highContrast: boolean;
  subtitleScale: 'normal' | 'large';
  reduceFlashes: boolean;
  reduceVisualEffects: boolean;
  legibleFont: boolean;

  // Hardware Adapter Preference
  preferredAdapter: 'auto' | 'dedicated' | 'integrated';
}

export interface HardwareDiagnostics {
  cpuThreads: number;
  cpuTier: string;
  ramGb: number | null;
  gpuVendor: string;
  gpuRenderer: string;
  gpuTier: 'software' | 'integrated' | 'mid_dedicated' | 'high_dedicated';
  isDedicated: boolean;
  isNvidiaRtx: boolean;
  isAmdRadeon: boolean;
  isSoftwareGl: boolean;
  estimatedVramGb: number | null;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  refreshRateHz: number;
  webgl2Supported: boolean;
  webgpuSupported: boolean;
  maxTextureSize: number;
  maxAnisotropy: number;
  supportedUpscalers: {
    fsr: { supported: boolean; reason: string };
    dlss: { supported: boolean; reason: string };
    xess: { supported: boolean; reason: string };
  };
  measuredAvgFrameMs: number | null;
  recommendedQuality: Exclude<GraphicsQuality, 'custom'>;
  recommendationNotes: string;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  avatar?: string;
  characterId: string;
  districtId: DistrictId;
  mode: GameMode;
  score: number;
  distance: number;
  maxCombo: number;
  date: string;
  verified?: boolean;
  isPlayer?: boolean;
}

export interface BestRunRecord {
  score: number;
  distance: number;
  maxSpeedKmh: number;
  maxCombo: number;
  districtId: DistrictId;
  characterId: string;
  mode: GameMode;
  date: string;
  highlights: string[];
}

export type PlayerModelStyle = 'procedural' | 'xbot' | 'robot' | 'soldier' | 'custom';

export type NetworkConnectionMode = 'lan' | 'internet_ws' | 'internet_webrtc';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface RoomRulesConfig {
  allowVehicles: boolean;
  allowAbilities: boolean;
  difficulty: DifficultyLevel;
  targetDistance: number | null;
}

export interface MultiplayerPlayerTelemetry {
  userId: string;
  username: string;
  avatarId: string;
  characterId: string;
  x: number;
  y: number;
  z: number;
  lane: number;
  distance: number;
  score: number;
  action: ParkourAction;
  paused: boolean;
  finished: boolean;
  placement?: number;
  pingMs?: number;
  validated?: boolean;
}

export interface MultiplayerRoomPlayer {
  userId: string;
  username: string;
  avatarId: string;
  characterId: string;
  ready: boolean;
  isHost: boolean;
  paused: boolean;
  finished: boolean;
  connected?: boolean;
  reconnecting?: boolean;
  pingMs?: number;
  connectionQuality?: ConnectionQuality;
  distance: number;
  score: number;
  placement: number | null;
  rewardCoins?: number;
  rewardGems?: number;
}

export interface MultiplayerRoomState {
  id?: string;
  code: string;
  name: string;
  hostId: string;
  isPublic: boolean;
  districtId: DistrictId;
  mode: GameMode;
  status: 'lobby' | 'racing' | 'finished';
  maxPlayers: number;
  gameVersion?: string;
  connectionMode?: NetworkConnectionMode;
  rules?: RoomRulesConfig;
  startedAtMs: number | null;
  players: MultiplayerRoomPlayer[];
}

export interface LanInterfaceInfo {
  name: string;
  address: string;
  family: string;
  internal: boolean;
  kind?: 'lan' | 'vpn' | 'virtual' | 'loopback';
  label?: string;
}

export interface LanHostState {
  running: boolean;
  port: number;
  bindAddress: string;
  interfaces: LanInterfaceInfo[];
  roomCode: string | null;
  playerCount: number;
  error: string | null;
}

export interface TunnelState {
  running: boolean;
  available: boolean;
  binaryPath: string | null;
  publicUrl: string | null;
  wssUrl: string | null;
  provider: 'cloudflared' | 'none';
  error: string | null;
}

export type InviteStatus =
  | 'sent'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'room_full'
  | 'host_offline'
  | 'room_closed'
  | 'cancelled';

export interface PersistentInviteRecord {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  roomCode: string;
  districtId: DistrictId;
  mode: GameMode;
  targetWsUrl: string;
  status: InviteStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  expiresAtMs: number;
}

export interface LocalProfileSummary {
  id: string;
  name: string;
  avatarId: string;
  level: number;
  coins: number;
  gems: number;
  totalRuns: number;
  bestScore: number;
  linkedOnlineUserId: string | null;
  linkedOnlineUsername: string | null;
  lastLinkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConflictResolutionStrategy = 'keep_local' | 'keep_online' | 'merge';

export interface AccountSyncConflict {
  localProfileId: string;
  localName: string;
  onlineUserId: string;
  onlineUsername: string;
  localSummary: {
    level: number;
    coins: number;
    gems: number;
    totalRuns: number;
    bestScore: number;
    unlockedCount: number;
  };
  onlineSummary: {
    level: number;
    coins: number;
    gems: number;
    totalRuns: number;
    bestScore: number;
    unlockedCount: number;
  };
  hasConflict: boolean;
}

export interface ActiveRunContext {
  mode: GameMode;
  districtId: DistrictId;
  eventId: string | null;
  bossId: BossId | null;
  storyChapter: number | null;
}

export interface ReleaseUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  repo: string;
  releaseUrl: string;
  downloadUrl: string | null;
  assetName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  releaseDate: string | null;
  releaseNotes: string;
  minCompatibleVersion?: string;
  source: 'manifest' | 'github_release' | 'offline';
  error?: string | null;
}

export interface UpdateProgressState {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'up_to_date'
    | 'downloading'
    | 'verifying'
    | 'ready_to_install'
    | 'installing'
    | 'error';
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  downloadedPath: string | null;
  message: string;
  error: string | null;
}

export interface PlayerSaveData {
  saveVersion: number;
  playerName: string;
  avatarId: string;
  modelStyle?: PlayerModelStyle;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  tickets: number;
  reviveTokens: number;
  talismans: number;
  selectedCharacterId: string;
  selectedDistrictId: DistrictId;
  selectedMode: GameMode;
  activeEventId: string | null;
  unlockedCharacters: string[];
  unlockedDistricts: DistrictId[];
  ownedCosmetics: string[];
  equippedCosmetics: Record<CosmeticSlot, string | null>;
  ownedVehicles: VehicleId[];
  selectedVehicleId: VehicleId;
  vehicleUpgrades: Record<VehicleId, number>;
  vehiclePaints: Record<VehicleId, string>;
  skillLevels: Record<string, number>;
  missionProgress: Record<string, number>;
  claimableMissions: string[];
  completedMissions: string[];
  dailyResetAt: number;
  weeklyResetAt: number;
  completedEvents: string[];
  defeatedBosses: BossId[];
  customBossMeta?: Partial<Record<BossId, CustomBossMeta>>;
  useCustomBossModels?: boolean;
  ownedPets?: string[];
  equippedPetId?: string | null;
  unlockedAchievements: string[];
  storyChapter: number;
  tutorialCompleted: boolean;
  battlePass: BattlePassState;
  transactions: TransactionRecord[];
  upgradeHistory: UpgradeRecord[];
  matchHistory: MatchRecord[];
  bestRun: BestRunRecord | null;
  stats: {
    totalRuns: number;
    wins: number;
    losses: number;
    totalDistance: number;
    bestDistance: number;
    totalTimeSeconds: number;
    bestSurvivalTimeSec: number;
    bestScore: number;
    maxSpeedKmh: number;
    maxCombo: number;
    totalCoinsCollected: number;
    coinsSpent: number;
    totalWallRuns: number;
    totalGrapples: number;
    totalVehiclesHijacked: number;
    dronesEvaded: number;
    enemiesEliminated: number;
    bossesDefeated: number;
    secretsFound: number;
    revivesUsed: number;
    missionsCompleted: number;
    challengesCompleted: number;
    abilitiesUsed: number;
    eventsCompleted: number;
    mpMatchesPlayed: number;
    mpWins: number;
    mpBestPlacement: number;
    shieldBreaks: number;
    doubleJumps: number;
    parkourChains: number;
    bossPhasesCleared: number;
    fiveLaneDistance: number;
    obstaclesDodged: number;
    trainsPassed: number;
    noReviveWins: number;
  };
  leaderboard: LeaderboardEntry[];
  settings: PCSettings;
}

export interface RevivePromptState {
  defeatCause: string;
  costTokens: number;
  attemptNumber: number;
  availableTokens: number;
  canAfford: boolean;
  remainingSeconds: number;
}

export interface HudSnapshot {
  phase: 'title' | 'playing' | 'paused' | 'reviving' | 'gameover' | 'victory';
  mode: GameMode;
  districtId: DistrictId;
  districtName: string;
  laneCount: 3 | 5;
  timePeriod: Exclude<TimeOfDay, 'dynamic'>;
  score: number;
  distance: number;
  runDurationSec: number;
  coinsRun: number;
  gemsRun: number;
  speedKmh: number;
  combo: number;
  comboTimer: number;
  momentum: number;
  boostCooldown: number;
  boostMaxCooldown: number;
  boostActive: boolean;
  slowMoEnergy: number;
  isSlowMo: boolean;
  vehicleAbilityLocked: boolean;
  abilityCharge: number;
  abilityActive: boolean;
  hasShield: boolean;
  shieldCooldown: number;
  shieldMaxCooldown: number;
  doubleJumpCharges: number;
  maxDoubleJumpCharges: number;
  doubleJumpCooldown: number;
  doubleJumpBlockedReason: string | null;
  hasMagnet: boolean;
  magnetTimer: number;
  isRidingVehicle: boolean;
  vehicleIsShip: boolean;
  vehicleTimer: number;
  selectedVehicleId: VehicleId;
  talismansHeld: number;
  reviveTokensHeld: number;
  talismanUsedRun: boolean;
  revivePrompt: RevivePromptState | null;
  pursuerDistance: number | null;
  pursuerThreat: number; // 0..1
  randomBossActive: boolean;
  storyChapter: number | null;
  storyObjectiveText: string | null;
  parkourFloor: 1 | 2;
  parkourChain: number;
  action: ParkourAction;
  contextPrompt: string | null;
  tutorialHint: string | null;
  subtitleText: string | null;
  activeEventBanner: string | null;
  activeDynamicEvent: DynamicEventType | null;
  sectorTransitionLabel: string | null;
  objectiveCelebrationText: string | null;
  bossId: BossId | null;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
  bossPhaseName: string | null;
  bossPhaseHp: number;
  bossPhaseMaxHp: number;
  bossIntroActive: boolean;
  bossIntroTitle: string | null;
  bossIntroSubtitle: string | null;
  bossTransitionActive: boolean;
  bossDistance: number | null;
  timeRemaining: number | null;
  targetDistance: number | null;
  activeBanner: string | null;
  lastStuntText: string | null;
  weather: WeatherType;
  gravityScale: number;
  secretsFoundRun: number;
  dronesEvadedRun: number;
  enemiesEliminatedRun: number;
  obstaclesDodgedRun: number;
  trainsPassedRun: number;
  shieldBreaksRun: number;
  doubleJumpsRun: number;
  activeRunContext: ActiveRunContext;
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  memoryMb: number | null;
  perfWarning: string | null;
  tutorialStep: string | null;
  tutorialProgress: string | null;
  bossWarningText: string | null;
  rainEventActive: boolean;
  difficultyStage: number;
  isMultiplayer: boolean;
  mpPlayers: MultiplayerPlayerTelemetry[];
}

export interface RunSummary {
  victory: boolean;
  defeatCause: string;
  mode: GameMode;
  districtId: DistrictId;
  characterId: string;
  activeRunContext: ActiveRunContext;
  score: number;
  distance: number;
  durationSec: number;
  coins: number;
  gems: number;
  xpEarned: number;
  battlePassXpEarned: number;
  bpLeveledUp: boolean;
  newBpLevel: number;
  maxSpeedKmh: number;
  maxCombo: number;
  wallRuns: number;
  grapples: number;
  vehicles: number;
  dronesEvaded: number;
  enemiesEliminated: number;
  obstaclesDodged: number;
  trainsPassed: number;
  shieldBreaks: number;
  doubleJumps: number;
  parkourChains: number;
  bossPhasesCleared: number;
  bossPhaseReached: number;
  bossName: string | null;
  bossDefeatedId: BossId | null;
  secrets: number;
  revivesUsed: number;
  talismanAutoRevives: number;
  highlights: string[];
  newlyCompletedMissions: string[];
  newlyClaimableMissions: string[];
  newlyUnlockedAchievements: string[];
  completedEventTitle: string | null;
  leveledUp: boolean;
  newLevel: number;
  previousBestScore: number;
  previousBestDistance: number;
  previousLastRun: MatchRecord | null;
}
