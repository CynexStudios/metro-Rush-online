import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { audioEngine } from './audio';
import {
  BOSSES,
  DISTRICTS,
  DRONE_CODEX,
  getBossById,
  getCharacterById,
  getDistrictById,
  getStoryChapterByNum,
  getUnlockedBossIds,
  getVehicleById,
  isBossUnlocked,
  LIVE_EVENTS,
  ORDERED_BOSS_IDS,
} from './data';
import { getEffectiveVehicleStats, getReviveCostForAttempt } from './economy';
import {
  getCachedGlbForStyle,
  preloadAllExtraGlbModels,
  preloadGlbModel,
} from './gltfAssets';
import { createProceduralTextures, ProceduralTexturePack } from './materials';
import {
  animateCharacterRig,
  applyBossPhaseVisuals,
  buildBossLaserBeam,
  buildBossModel,
  buildBossProjectile,
  buildBossShockwave,
  buildBuildingLOD,
  buildCaptureDroneModel,
  buildCharacterRig,
  buildCityObstacleModel,
  buildCollectibleModel,
  buildCompanionFoxModel,
  buildCyberTrainModel,
  buildDistrictLandmark,
  buildEnemyModel,
  buildFighterJetModel,
  buildHangarLobbyGroup,
  buildHelicopterModel,
  buildHoverBikePickupModel,
  buildHoverCarModel,
  buildParkourModule,
  buildPursuerModel,
  buildRailCrossingBarrier,
  buildRemoteRunnerGhost,
  buildSectorTransitionGate,
  buildShieldShatterEffect,
  buildTrafficTruckObstacle,
  buildUndergroundTunnelSegment,
  buildVehicleShowcaseModel,
  CharacterRig,
  CollectibleAssetPool,
  createCollectibleAssetPool,
} from './models';
import { RunTelemetry } from './storage';
import {
  ActiveRunContext,
  BossId,
  DistrictDef,
  DistrictId,
  DynamicEventType,
  EnemyClass,
  GameMode,
  HudSnapshot,
  MultiplayerPlayerTelemetry,
  ParkourAction,
  PCSettings,
  PlayerSaveData,
  RevivePromptState,
  TimeOfDay,
  VehicleId,
  WeatherType,
} from './types';

const LANES_3 = [-3.2, 0, 3.2];
const LANES_5 = [-6.4, -3.2, 0, 3.2, 6.4];
const CHUNK_LEN = 56;

type TimePeriod = Exclude<TimeOfDay, 'dynamic'>;
const TIME_CYCLE_ORDER: TimePeriod[] = [
  'dawn',
  'morning',
  'noon',
  'afternoon',
  'dusk',
  'night',
  'midnight',
];

interface TimeLightingConfig {
  skyHex: string;
  fogHex: string;
  sunHex: string;
  sunIntensity: number;
  hemiIntensity: number;
  sunPos: [number, number, number];
  exposure: number;
  emissiveMult: number;
}

const TIME_CONFIGS: Record<TimePeriod, TimeLightingConfig> = {
  dawn: {
    skyHex: '#25173b',
    fogHex: '#40213d',
    sunHex: '#fda4af',
    sunIntensity: 0.98,
    hemiIntensity: 0.56,
    sunPos: [24, 11, -18],
    exposure: 0.94,
    emissiveMult: 0.72,
  },
  morning: {
    skyHex: '#1b3b68',
    fogHex: '#2b4f7e',
    sunHex: '#fef3c7',
    sunIntensity: 1.18,
    hemiIntensity: 0.65,
    sunPos: [22, 22, 10],
    exposure: 0.95,
    emissiveMult: 0.56,
  },
  noon: {
    skyHex: '#194578',
    fogHex: '#29578c',
    sunHex: '#f8fafc',
    sunIntensity: 1.28,
    hemiIntensity: 0.7,
    sunPos: [10, 36, 12],
    exposure: 0.94,
    emissiveMult: 0.48,
  },
  afternoon: {
    skyHex: '#243259',
    fogHex: '#3c3b64',
    sunHex: '#fed7aa',
    sunIntensity: 1.12,
    hemiIntensity: 0.62,
    sunPos: [-20, 20, 14],
    exposure: 0.95,
    emissiveMult: 0.62,
  },
  dusk: {
    skyHex: '#1d0f2e',
    fogHex: '#321438',
    sunHex: '#fb923c',
    sunIntensity: 1.02,
    hemiIntensity: 0.58,
    sunPos: [-24, 9, -12],
    exposure: 0.96,
    emissiveMult: 0.76,
  },
  night: {
    skyHex: '#060a18',
    fogHex: '#0f1730',
    sunHex: '#93c5fd',
    sunIntensity: 0.96,
    hemiIntensity: 0.54,
    sunPos: [16, 26, 12],
    exposure: 0.96,
    emissiveMult: 0.85,
  },
  midnight: {
    skyHex: '#03050d',
    fogHex: '#070b18',
    sunHex: '#64748b',
    sunIntensity: 0.82,
    hemiIntensity: 0.45,
    sunPos: [14, 24, 12],
    exposure: 0.94,
    emissiveMult: 0.92,
  },
};

type ObstacleKind =
  | 'lowBarrier'
  | 'highGate'
  | 'train'
  | 'cargoTrain'
  | 'movingTrain'
  | 'milkTruck'
  | 'hoverCar'
  | 'skyBridge'
  | 'retractBridge'
  | 'movingPlatform'
  | 'elevator'
  | 'wallLeft'
  | 'wallRight'
  | 'climbRamp'
  | 'zipline'
  | 'grappleAnchor'
  | 'hoverBikePickup'
  | 'laserGrid'
  | 'blastDoor'
  | 'movingBarrier'
  | 'containerStack'
  | 'steamPipe'
  | 'scaffolding'
  | 'electricFloor'
  | 'floodZone'
  | 'rubble'
  | 'maintBot'
  | 'turbineHazard'
  | 'floor2Deck'
  | 'jumpPad'
  | 'swingBar'
  | 'balanceBeam'
  | 'highConduit'
  | 'sectorGate';

interface ObstacleEntity {
  id: number;
  kind: ObstacleKind;
  mesh: THREE.Object3D;
  lane: number;
  baseX: number;
  prevX?: number;
  baseY: number;
  groundY: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  length: number;
  speedZ: number;
  phase: number;
  hit: boolean;
  interacted: boolean;
  hornPlayed?: boolean;
  passedCounted?: boolean;
  rampTopY?: number;
}

interface AbyssGap {
  zMin: number;
  zMax: number;
}

interface EnemyEntity {
  id: number;
  enemyClass: EnemyClass;
  mesh: THREE.Group;
  x: number;
  y: number;
  groundY: number;
  z: number;
  baseLane: number;
  speedZ: number;
  phase: number;
  shiftTimer: number;
  evaded: boolean;
  disabled: boolean;
}

interface CollectibleEntity {
  kind: 'coin' | 'gem' | 'shield' | 'magnet' | 'slowmo' | 'secret' | 'empCell' | 'talisman';
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  attracted?: boolean;
}

interface AerialThreatEntity {
  id: number;
  kind: 'jet' | 'helicopter';
  mesh: THREE.Group;
  lane: number;
  x: number;
  y: number;
  z: number;
  speedZ: number;
  warnPlayed: boolean;
  hit: boolean;
}

interface BossHazardEntity {
  id: number;
  kind: 'projectile' | 'laser' | 'shockwave' | 'laneStrike';
  mesh: THREE.Group;
  lane: number;
  x: number;
  y: number;
  z: number;
  speedZ: number;
  telegraphTimer: number;
  lifeTimer: number;
  hit: boolean;
}

interface RemoteRunnerEntity {
  userId: string;
  username: string;
  mesh: THREE.Group;
  targetX: number;
  targetY: number;
  targetZ: number;
  paused: boolean;
  finished: boolean;
}

interface TrackReservation {
  lane: number;
  zMin: number;
  zMax: number;
  topY: number;
  walkableRoof: boolean;
  slideUnder: boolean;
  impassableGround: boolean;
}

interface ChunkData {
  index: number;
  zStart: number;
  group: THREE.Group;
  obstacles: ObstacleEntity[];
  enemies: EnemyEntity[];
  collectibles: CollectibleEntity[];
  abyssGaps: AbyssGap[];
}

interface ParticleItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

const _vec3A = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();

export type ShowcaseMode = 'title' | 'garage' | 'characters' | 'city' | 'boss';

export type ConsumableEventKind = 'talisman_pickup' | 'talisman_use' | 'revive_use';

export class MetroRushEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onRunComplete: (telemetry: RunTelemetry) => void;
  private onConsumableEvent?: (kind: ConsumableEventKind, amount: number) => void;

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private textures!: ProceduralTexturePack;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private playerPointLight!: THREE.PointLight;

  private playerRig!: CharacterRig;
  private vehicleShowcase: { group: THREE.Group; dispose: () => void } | null = null;
  private vehicleShowcaseKey = '';
  private hangarGroup: THREE.Group | null = null;
  private hangarKey = '';
  private captureDroneMesh!: THREE.Group;
  private abilityAuraRing: THREE.Mesh | null = null;
  private shieldShatterVfx: { group: THREE.Group; timer: number; maxTimer: number }[] = [];
  private sectorGates: { group: THREE.Group; timer: number }[] = [];
  private recentDistrictIds: DistrictId[] = [];
  private pursuerMesh!: THREE.Group;
  private contactShadow!: THREE.Mesh;
  private grappleLine!: THREE.Line;
  private bossMesh!: THREE.Group;
  private activeBossId: BossId = 'titan_drone';

  private weatherPoints!: THREE.Points;
  private skyTrafficMesh!: THREE.InstancedMesh;
  private skyTrafficData: { x: number; y: number; z: number; speed: number }[] = [];
  private cloudsMesh!: THREE.InstancedMesh;
  private cloudData: { x: number; y: number; z: number; sx: number; speed: number }[] = [];

  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleItem[] = [];
  private readonly MAX_PARTICLES = 240;

  private chunks: ChunkData[] = [];
  private nextChunkIndex = 0;
  private obstacleSeq = 1;
  private aiFrameParity = 0;

  // Shared Geometry Pool (Eliminates chunk allocation churn)
  private unitBoxGeo!: THREE.BoxGeometry;
  private roadGeo!: THREE.PlaneGeometry;
  private roadHalfGeo!: THREE.PlaneGeometry;
  private walkGeo!: THREE.BoxGeometry;
  private billboardGeo!: THREE.PlaneGeometry;
  private magWallGeo!: THREE.BoxGeometry;
  private archGeo!: THREE.TorusGeometry;
  private archGlowGeo!: THREE.TorusGeometry;
  private oceanGeo!: THREE.PlaneGeometry;
  private empMat!: THREE.MeshStandardMaterial;
  private collectiblePool!: CollectibleAssetPool;

  private barrierFrameMat!: THREE.MeshStandardMaterial;
  private gantryMat!: THREE.MeshStandardMaterial;
  private sharedGeos = new Set<THREE.BufferGeometry>();

  private frameId = 0;
  private lastTime = 0;
  private lastRenderTime = 0;
  private elapsedTotal = 0;
  private disposed = false;

  private save: PlayerSaveData;
  private settings: PCSettings;
  private showcaseMode: ShowcaseMode = 'title';
  private previewBossId: BossId = 'titan_drone';

  // Run state
  private phase: HudSnapshot['phase'] = 'title';
  private mode: GameMode = 'endless';
  private activeEventId: string | null = null;
  private district: DistrictDef = DISTRICTS[0];
  private weather: WeatherType = 'rain';
  private currentPeriod: TimePeriod = 'night';
  private dynamicTimeAccum = 0;

  // Player Physics
  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private targetLane = 1;
  private velY = 0;
  private forwardSpeed = 24;
  private baseSpeed = 24;
  private maxSpeedKmh = 0;
  private grounded = true;
  private jumpsUsed = 0;
  private doubleJumpFlipTimer = 0;
  private vaultTimer = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private slideTimer = 0;
  private wallRunTimer = 0;
  private wallRunSide: -1 | 0 | 1 = 0;
  private climbTimer = 0;
  private ziplineTimer = 0;
  private grappleTimer = 0;
  private grappleTarget = new THREE.Vector3();
  private stumbleTimer = 0;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private stepSoundTimer = 0;
  private footstepInterval = 0.28;
  private floodSlowTimer = 0;

  // Mechanics & Gauges
  private momentum = 0;
  private sprintCooldown = 0;
  private readonly SPRINT_COOLDOWN_MAX = 3.4;
  private boostActive = false;
  private slowMoEnergy = 100;
  private isSlowMo = false;
  private vehicleLockNoticeTimer = 0;
  private abilityCharge = 100;
  private abilityActiveTimer = 0;
  private hasShield = false;
  private shieldCooldown = 0;
  private readonly SHIELD_COOLDOWN_MAX = 16.0;
  private magnetTimer = 0;
  private vehicleTimer = 0;
  private invulnTimer = 0;
  private phaseThroughTimer = 0;
  private lowGravTimer = 0;
  private combo = 1;
  private maxCombo = 1;
  private comboTimer = 0;
  private score = 0;
  private distance = 0;
  private runDurationSec = 0;
  private coinsRun = 0;
  private gemsRun = 0;
  private wallRunsCount = 0;
  private grapplesCount = 0;
  private vehiclesCount = 0;
  private dronesEvadedRun = 0;
  private abilitiesUsedCount = 0;
  private slowMoUsedCount = 0;
  private secretsFoundRun = 0;
  private obstaclesDodgedRun = 0;
  private trainsPassedRun = 0;
  private shieldBreaksRun = 0;
  private doubleJumpsRun = 0;
  private doubleJumpCooldown = 0;
  private readonly DOUBLE_JUMP_COOLDOWN_MAX = 1.6;
  private doubleJumpBlockedReason: string | null = null;
  private doubleJumpBlockedTimer = 0;
  private parkourChainsRun = 0;
  private bossPhasesClearedRun = 0;
  private fiveLaneDistanceRun = 0;
  private swingBarTimer = 0;
  private onFloor2 = false;
  private onBalanceBeam = false;
  private celebrateTimer = 0;
  private objectiveToastText: string | null = null;
  private objectiveToastTimer = 0;
  private sectorTransitionText: string | null = null;
  private sectorTransitionTimer = 0;
  private pendingSectorGate = false;
  private hudEmitReviveAccum = 0;
  private highlights: string[] = [];

  // Pursuer, Revive, Talisman, Vehicle & Story State
  private pursuerDistance = 24;
  private pursuerSirenCooldown = 0;
  private revivesUsedRun = 0;
  private talismanUsedRun = false;
  private liveTalismansHeld = 0;
  private liveReviveTokensHeld = 0;
  private revivePrompt: RevivePromptState | null = null;
  private reviveCountdownTimer = 10.0;
  private randomBossActive = false;
  private randomBossTimer = 0;
  private nextRandomBossDist = 1650;
  private inBossArena = false;
  private storyChapterNum = 1;
  private storyObjectiveText: string | null = null;
  private storyBeatIndex = 0;
  private activeVehicleStats = getEffectiveVehicleStats('hover_bike', 0);
  private activeRunContext: ActiveRunContext = {
    mode: 'endless',
    districtId: 'downtown',
    eventId: null,
    bossId: null,
    storyChapter: null,
  };

  // Dynamic Events & Bosses
  private nextEventDistance = 420;
  private activeDynamicEvent: DynamicEventType | null = null;
  private dynamicEventTimer = 0;
  private powerOutageActive = false;
  private timeRemaining: number | null = null;
  private targetDistance: number | null = null;
  private bossHp = 0;
  private bossMaxHp = 16;
  private bossPhase = 1;
  private bossPhaseIndex = 0;
  private bossPhaseHp = 0;
  private bossPhaseMaxHp = 4;
  private bossPhaseName = '';
  private bossIntroTitle = '';
  private bossIntroQuote = '';
  private bossIntroTimer = 0;
  private bossPhaseTransitionTimer = 0;
  private bossEntranceTimer = 0;
  private bossEmpSpawnTimer = 4.0;
  private bossDefeatedId: BossId | null = null;
  private bossDistance: number | null = null;
  private bossAttackTimer = 5.5;
  private bossWarningText: string | null = null;
  private bossHazards: BossHazardEntity[] = [];
  private aerialThreats: AerialThreatEntity[] = [];
  private nextAerialSpawnDist = 360;
  private difficultyStage = 1;
  private diveQueued = false;
  private lastAction: ParkourAction = 'idle';

  // Cyber Companion Fox & Rain Event (Limited, probability/cooldown gated)
  private companionFox: { group: THREE.Group; mixer: THREE.AnimationMixer | null; dispose: () => void } | null = null;
  private rainEventState: { active: boolean; timer: number; cooldownTimer: number; dropTimer: number } = {
    active: false,
    timer: 0,
    cooldownTimer: 35,
    dropTimer: 0,
  };

  // Interactive Tutorial Mode
  private tutorialStepIndex = 0;
  private tutorialStepCount = 0;
  private tutorialStepText: string | null = null;
  private tutorialStepProgress = 0;

  // Multiplayer Ghosts & Non-Blocking Pause
  private isMultiplayer = false;
  private localMpUserId: string | null = null;
  private mpPausedOverlay = false;
  private remoteRunners = new Map<string, RemoteRunnerEntity>();
  private latestMpPlayers: MultiplayerPlayerTelemetry[] = [];

  private activeBanner: string | null = null;
  private bannerTimer = 0;
  private lastStuntText: string | null = null;
  private stuntTimer = 0;
  private contextPrompt: string | null = null;
  private subtitleText: string | null = null;
  private subtitleTimer = 0;
  private tutorialHint: string | null = null;
  private hudEmitAccum = 0;

  // Telemetry & Benchmark
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private avgFrameTimeMs = 16.6;
  private perfWarning: string | null = null;
  private benchmarkResolver: ((avgMs: number) => void) | null = null;
  private benchmarkSamples: number[] = [];

  // Input
  private heldKeys = new Set<string>();
  private justPressed = new Set<string>();
  private mouseOffsetX = 0;
  private mouseOffsetY = 0;
  private prevGamepadButtons: boolean[] = [];

  constructor(
    container: HTMLElement,
    initialSave: PlayerSaveData,
    onHudUpdate: (hud: HudSnapshot) => void,
    onRunComplete: (telemetry: RunTelemetry) => void,
    onConsumableEvent?: (kind: ConsumableEventKind, amount: number) => void,
  ) {
    this.container = container;
    this.save = initialSave;
    this.settings = initialSave.settings;
    this.liveTalismansHeld = initialSave.talismans ?? 0;
    this.liveReviveTokensHeld = initialSave.reviveTokens ?? 0;
    this.onHudUpdate = onHudUpdate;
    this.onRunComplete = onRunComplete;
    this.onConsumableEvent = onConsumableEvent;

    this.district = getDistrictById(initialSave.selectedDistrictId);
    this.weather = this.district.defaultWeather;
    this.currentPeriod = this.resolveTimePeriod(
      this.settings.timeOfDay,
      this.district.defaultTimeOfDay,
    );

    this.initRendererAndScene();
    this.initSharedAssets();
    this.rebuildPlayerCharacter();
    this.rebuildCompanionFox();
    this.applyTimeOfDayVisuals(this.currentPeriod);
    this.resetWorldForTitle();
    this.bindInputs();

    // Background-preload extra GLBs (Fox, Helmet, IonDrive, CesiumMilkTruck) + Soldier runner
    preloadAllExtraGlbModels();
    void preloadGlbModel('soldier').catch(() => {});

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTime = performance.now();
    this.lastRenderTime = this.lastTime;
    this.tick();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private getVisibleChunksCount(): number {
    if (this.settings.drawDistance === 'near') return 4;
    if (this.settings.drawDistance === 'medium') return 5;
    return 6;
  }

  private getLodSwitchDistance(): number {
    if (this.settings.lodBias === 'performance') return 42;
    if (this.settings.lodBias === 'quality') return 92;
    return 66;
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.settings.antialiasing,
      powerPreference:
        this.settings.preferredAdapter === 'integrated'
          ? 'low-power'
          : 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.applyPixelRatioAndResolution();
    this.renderer.shadowMap.enabled =
      !this.isSoftwareGl && this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.district.colors.skyTop);
    this.scene.fog = new THREE.FogExp2(this.district.colors.fog, 0.01);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      this.settings.fovBase,
      w / h,
      0.1,
      280,
    );
    this.camera.position.set(0, 4.0, 8);

    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h),
        0.26,
        0.22,
        0.88,
      );
      this.bloomPass.enabled =
        this.settings.bloom && !this.settings.reduceVisualEffects;
      this.composer.addPass(this.bloomPass);
    }

    this.hemiLight = new THREE.HemisphereLight(
      this.district.colors.primaryNeon,
      0x0a0d1c,
      0.52,
    );
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(
      this.district.colors.sunLight,
      1.05,
    );
    this.dirLight.position.set(16, 28, 12);
    this.applyGraphicsQualitySettings();
    const d = 24;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 75;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.rimLight = new THREE.DirectionalLight(
      this.district.colors.secondaryNeon,
      0.48,
    );
    this.rimLight.position.set(-14, 12, -20);
    this.scene.add(this.rimLight);

    this.playerPointLight = new THREE.PointLight(
      this.district.colors.primaryNeon,
      0.95,
      12,
      1.7,
    );
    this.scene.add(this.playerPointLight);

    this.textures = createProceduralTextures(
      this.renderer,
      this.district.id,
      this.district.colors.primaryNeon,
      this.district.colors.secondaryNeon,
      this.district.colors.buildingBase,
      this.settings.textureQuality,
      this.settings.reflections,
      this.settings.materialQuality,
      this.settings.ambientOcclusion,
      this.getLaneCount(),
    );
  }

  private getShadowMapResolution(): number {
    if (this.isSoftwareGl || !this.settings.shadows) return 0;
    const preset = this.settings.graphicsQuality;
    if (preset === 'very_low' || preset === 'low') return 0;
    if (preset === 'medium') return 512;
    if (preset === 'high' || this.settings.lightingQuality === 'standard') return 1024;
    return 2048;
  }

  private applyGraphicsQualitySettings(): void {
    const shadowSize = this.getShadowMapResolution();
    const shadowsEnabled = shadowSize > 0;
    this.renderer.shadowMap.enabled = shadowsEnabled;
    if (this.dirLight) {
      this.dirLight.castShadow = shadowsEnabled;
      if (shadowsEnabled) {
        if (
          this.dirLight.shadow.mapSize.width !== shadowSize ||
          this.dirLight.shadow.mapSize.height !== shadowSize
        ) {
          this.dirLight.shadow.mapSize.set(shadowSize, shadowSize);
          this.dirLight.shadow.map?.dispose();
          this.dirLight.shadow.map = null;
        }
      }
    }
    if (this.bloomPass) {
      this.bloomPass.enabled =
        !this.isSoftwareGl &&
        this.settings.bloom &&
        !this.settings.reduceVisualEffects &&
        this.settings.graphicsQuality !== 'very_low';
      this.bloomPass.strength =
        this.settings.graphicsQuality === 'ultra' ? 0.32 : 0.24;
    }
  }

  private applyPixelRatioAndResolution(): void {
    let scale = this.settings.resolutionScale || 1.0;
    if (this.settings.upscaler === 'fsr') {
      scale = Math.min(scale, 0.85);
    }
    const baseDpr = this.isSoftwareGl
      ? 1
      : Math.min(window.devicePixelRatio * scale, 2.2);

    if (
      this.settings.resolutionPreset !== 'native' &&
      this.renderer
    ) {
      let targetW = this.settings.customWidth || 1920;
      let targetH = this.settings.customHeight || 1080;
      const parts = this.settings.resolutionPreset.split('x');
      if (parts.length === 2) {
        targetW = Number(parts[0]) || targetW;
        targetH = Number(parts[1]) || targetH;
      }
      const winW = this.container.clientWidth || window.innerWidth;
      const ratioCap = Math.min(
        2.0,
        Math.max(0.5, (targetW / Math.max(1, winW)) * scale),
      );
      this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : ratioCap);
      void targetH;
      return;
    }

    this.renderer.setPixelRatio(baseDpr);
  }

  private registerShared<T extends THREE.BufferGeometry>(geo: T): T {
    this.sharedGeos.add(geo);
    return geo;
  }

  private initSharedAssets(): void {
    this.unitBoxGeo = this.registerShared(new THREE.BoxGeometry(1, 1, 1));
    this.roadGeo = this.registerShared(new THREE.PlaneGeometry(11.6, CHUNK_LEN));
    this.roadGeo.rotateX(-Math.PI / 2);
    this.roadHalfGeo = this.registerShared(
      new THREE.PlaneGeometry(11.6, CHUNK_LEN * 0.42),
    );
    this.roadHalfGeo.rotateX(-Math.PI / 2);
    this.walkGeo = this.registerShared(new THREE.BoxGeometry(5, 0.35, CHUNK_LEN));
    this.billboardGeo = this.registerShared(new THREE.PlaneGeometry(5.5, 2.75));
    this.magWallGeo = this.registerShared(new THREE.BoxGeometry(0.45, 4.2, 22));
    this.archGeo = this.registerShared(
      new THREE.TorusGeometry(9.2, 0.55, 8, 18, Math.PI),
    );
    this.archGlowGeo = this.registerShared(
      new THREE.TorusGeometry(8.6, 0.1, 6, 18, Math.PI),
    );
    this.oceanGeo = this.registerShared(
      new THREE.PlaneGeometry(46, CHUNK_LEN, 16, 16),
    );
    this.oceanGeo.rotateX(-Math.PI / 2);

    this.collectiblePool = createCollectibleAssetPool();
    this.collectiblePool.geometries.forEach((g) => this.registerShared(g));
    this.empMat = this.collectiblePool.empMat;

    this.barrierFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.72,
      roughness: 0.32,
    });
    this.gantryMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.7,
      roughness: 0.35,
    });

    const shadowPlaneGeo = new THREE.PlaneGeometry(1.55, 1.55);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    this.contactShadow = new THREE.Mesh(shadowPlaneGeo, shadowMat);
    this.contactShadow.position.y = 0.03;
    this.scene.add(this.contactShadow);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 5, -5),
    ]);
    this.grappleLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x22d3ee }),
    );
    this.grappleLine.visible = false;
    this.scene.add(this.grappleLine);

    this.bossMesh = buildBossModel(this.activeBossId, this.save.useCustomBossModels ?? true);
    this.bossMesh.visible = false;
    this.scene.add(this.bossMesh);

    this.pursuerMesh = buildPursuerModel('#ef4444');
    this.pursuerMesh.visible = false;
    this.scene.add(this.pursuerMesh);

    this.captureDroneMesh = buildCaptureDroneModel('#ef4444');
    this.captureDroneMesh.visible = false;
    this.scene.add(this.captureDroneMesh);

    this.rebuildHangarLobby();
    this.rebuildVehicleShowcase();

    const pGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        color: new THREE.Color(0x22d3ee),
      });
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, new THREE.Color(0x22d3ee));
    }
    this.scene.add(this.particleMesh);

    // Volumetric / Rain weather points
    const wCount = 400;
    const wPos = new Float32Array(wCount * 3);
    for (let i = 0; i < wCount; i++) {
      wPos[i * 3] = (Math.random() - 0.5) * 34;
      wPos[i * 3 + 1] = Math.random() * 18;
      wPos[i * 3 + 2] = (Math.random() - 0.5) * 65;
    }
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    const wMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.14,
      transparent: true,
      opacity: 0.5,
    });
    this.weatherPoints = new THREE.Points(wGeo, wMat);
    this.scene.add(this.weatherPoints);

    // Instanced Sky Traffic
    const carGeo = new THREE.BoxGeometry(1.4, 0.42, 3.2);
    const carMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.8,
      roughness: 0.25,
    });
    const carCount = 22;
    this.skyTrafficMesh = new THREE.InstancedMesh(carGeo, carMat, carCount);
    this.skyTrafficMesh.frustumCulled = false;
    for (let i = 0; i < carCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.skyTrafficData.push({
        x: side * (16 + Math.random() * 24),
        y: 12 + Math.random() * 18,
        z: -Math.random() * 220,
        speed: (18 + Math.random() * 24) * (i % 3 === 0 ? -1 : 1),
      });
    }
    this.scene.add(this.skyTrafficMesh);

    // Instanced Drifting Clouds
    const cloudGeo = new THREE.BoxGeometry(10, 1.4, 7);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.22,
      roughness: 0.95,
    });
    const cloudCount = 16;
    this.cloudsMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
    this.cloudsMesh.frustumCulled = false;
    for (let i = 0; i < cloudCount; i++) {
      this.cloudData.push({
        x: (Math.random() - 0.5) * 90,
        y: 34 + Math.random() * 14,
        z: -Math.random() * 220,
        sx: 0.8 + Math.random() * 1.4,
        speed: 3 + Math.random() * 4,
      });
    }
    this.scene.add(this.cloudsMesh);
  }

  public runHardwareBenchmark(): Promise<number> {
    return new Promise((resolve) => {
      this.benchmarkSamples = [];
      this.benchmarkResolver = resolve;
    });
  }

  private rebuildHangarLobby(): void {
    const char = getCharacterById(this.save.selectedCharacterId);
    const owned = (this.save.ownedVehicles ?? ['hover_bike']).join(',');
    const paints = JSON.stringify(this.save.vehiclePaints ?? {});
    const key = `${char.id}:${owned}:${paints}`;
    if (this.hangarGroup && this.hangarKey === key) return;

    if (this.hangarGroup) {
      this.scene.remove(this.hangarGroup);
      this.hangarGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
      this.hangarGroup = null;
    }

    this.hangarGroup = buildHangarLobbyGroup(
      char.colors.accent,
      char.colors.jacket,
      this.save.ownedVehicles ?? ['hover_bike'],
      this.save.vehiclePaints ?? {},
    );
    this.hangarKey = key;
    this.hangarGroup.visible = this.phase === 'title' && this.showcaseMode !== 'city';
    this.scene.add(this.hangarGroup);
  }

  public setShowcaseMode(mode: ShowcaseMode, bossId?: BossId): void {
    this.showcaseMode = mode;
    if (bossId && bossId !== this.previewBossId) {
      this.previewBossId = bossId;
      this.swapBossModel(bossId);
    }
    if (this.phase === 'title') {
      this.bossMesh.visible = mode === 'boss';
      if (this.hangarGroup) {
        this.hangarGroup.visible = mode !== 'city';
      }
      if (this.vehicleShowcase) {
        this.vehicleShowcase.group.visible = mode === 'garage';
      }
      if (this.playerRig) {
        this.playerRig.root.visible = mode !== 'garage' && mode !== 'boss';
      }
      for (const c of this.chunks) {
        c.group.visible = mode === 'city';
      }
    }
  }

  private rebuildVehicleShowcase(): void {
    const vid: VehicleId = this.save.selectedVehicleId ?? 'hover_bike';
    const def = getVehicleById(vid);
    const paint = this.save.vehiclePaints?.[vid] || def.defaultPaint;
    const key = `${vid}:${paint}`;
    if (this.vehicleShowcase && this.vehicleShowcaseKey === key) return;

    if (this.vehicleShowcase) {
      this.scene.remove(this.vehicleShowcase.group);
      this.vehicleShowcase.dispose();
      this.vehicleShowcase = null;
    }

    this.vehicleShowcase = buildVehicleShowcaseModel(vid, paint);
    this.vehicleShowcaseKey = key;
    this.vehicleShowcase.group.position.set(0, 0, 0);
    this.vehicleShowcase.group.visible =
      this.phase === 'title' && this.showcaseMode === 'garage';
    this.scene.add(this.vehicleShowcase.group);
  }

  private swapBossModel(bossId: BossId): void {
    this.activeBossId = bossId;
    const wasVisible = this.bossMesh?.visible ?? false;
    if (this.bossMesh) {
      this.scene.remove(this.bossMesh);
      if (typeof this.bossMesh.userData.customDispose === 'function') {
        this.bossMesh.userData.customDispose();
      } else {
        this.bossMesh.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
            else m.material.dispose();
          }
        });
      }
    }
    this.bossMesh = buildBossModel(bossId, this.save.useCustomBossModels ?? true);
    this.bossMesh.visible = wasVisible;
    this.scene.add(this.bossMesh);
  }

  public refreshBossShowcaseModel(bossId: BossId): void {
    this.swapBossModel(bossId);
  }

  public syncSaveData(save: PlayerSaveData): void {
    const prevChar = this.save.selectedCharacterId;
    const prevModelStyle = this.save.modelStyle ?? 'procedural';
    const prevCosmetics = JSON.stringify(this.save.equippedCosmetics);
    const prevVehicle = this.save.selectedVehicleId ?? 'hover_bike';
    const prevPaints = JSON.stringify(this.save.vehiclePaints ?? {});
    const prevOwnedVeh = (this.save.ownedVehicles ?? []).join(',');
    const prevPet = this.save.equippedPetId ?? null;
    const prevDistrict = this.save.selectedDistrictId;
    const prevTexQuality = this.settings.textureQuality;
    const prevRefl = this.settings.reflections;
    const prevMat = this.settings.materialQuality;
    const prevAo = this.settings.ambientOcclusion;
    const prevTime = this.settings.timeOfDay;
    const prevDensity = this.settings.objectDensity;
    const prevDraw = this.settings.drawDistance;
    const prevPreset = this.settings.graphicsQuality;
    const prevUseCustomBoss = this.save.useCustomBossModels ?? true;

    this.save = save;
    this.settings = save.settings;
    if (this.phase === 'title') {
      this.liveTalismansHeld = save.talismans ?? 0;
      this.liveReviveTokensHeld = save.reviveTokens ?? 0;
    }
    audioEngine.updateSettings(this.settings);

    this.applyPixelRatioAndResolution();
    this.applyGraphicsQualitySettings();

    const nextModelStyle = save.modelStyle ?? 'procedural';
    const nextVehicle = save.selectedVehicleId ?? 'hover_bike';
    const nextPaints = JSON.stringify(save.vehiclePaints ?? {});
    const nextOwnedVeh = (save.ownedVehicles ?? []).join(',');
    if (
      prevChar !== save.selectedCharacterId ||
      prevModelStyle !== nextModelStyle ||
      prevCosmetics !== JSON.stringify(save.equippedCosmetics) ||
      prevVehicle !== nextVehicle ||
      prevPaints !== nextPaints ||
      prevOwnedVeh !== nextOwnedVeh
    ) {
      this.rebuildPlayerCharacter();
      this.rebuildVehicleShowcase();
      this.rebuildHangarLobby();
    } else if (prevPet !== (save.equippedPetId ?? null)) {
      this.rebuildCompanionFox();
    }

    if (prevUseCustomBoss !== (save.useCustomBossModels ?? true)) {
      this.swapBossModel(this.activeBossId);
    }

    if (prevTime !== this.settings.timeOfDay || prevPreset !== this.settings.graphicsQuality) {
      this.currentPeriod = this.resolveTimePeriod(
        this.settings.timeOfDay,
        this.district.defaultTimeOfDay,
      );
      this.applyTimeOfDayVisuals(this.currentPeriod);
    }

    if (
      this.phase === 'title' &&
      (prevDistrict !== save.selectedDistrictId ||
        prevTexQuality !== this.settings.textureQuality ||
        prevRefl !== this.settings.reflections ||
        prevMat !== this.settings.materialQuality ||
        prevAo !== this.settings.ambientOcclusion ||
        prevDensity !== this.settings.objectDensity ||
        prevDraw !== this.settings.drawDistance ||
        prevPreset !== this.settings.graphicsQuality)
    ) {
      this.applyDistrictTheme(getDistrictById(save.selectedDistrictId));
      this.resetWorldForTitle();
    }
  }

  public rebuildPlayerCharacter(): void {
    const style = this.save.modelStyle ?? 'procedural';
    if ((style === 'xbot' || style === 'robot' || style === 'soldier') && !getCachedGlbForStyle(style)) {
      void preloadGlbModel(style)
        .then(() => {
          if (!this.disposed && (this.save.modelStyle ?? 'procedural') === style) {
            this.rebuildPlayerCharacter();
          }
        })
        .catch(() => {});
    }

    const prevRotY = this.playerRig?.root.rotation.y ?? (this.phase === 'title' ? Math.PI : 0);
    if (this.playerRig) {
      this.scene.remove(this.playerRig.root);
      this.playerRig.dispose();
    }
    const char = getCharacterById(this.save.selectedCharacterId);
    this.playerRig = buildCharacterRig(char, this.save);
    this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.root.rotation.y = prevRotY;
    this.playerRig.root.visible =
      this.phase !== 'title' || (this.showcaseMode !== 'garage' && this.showcaseMode !== 'boss');
    this.scene.add(this.playerRig.root);
    this.rebuildCompanionFox();
  }

  private rebuildCompanionFox(): void {
    if (this.companionFox) {
      this.scene.remove(this.companionFox.group);
      this.companionFox.dispose();
      this.companionFox = null;
    }
    if (this.save.equippedPetId !== 'fox_cyber') {
      return;
    }
    const char = getCharacterById(this.save.selectedCharacterId);
    const fox = buildCompanionFoxModel(char.colors.accent);
    fox.group.position.set(-4.8, 0.35, 1.2);
    fox.group.visible =
      this.phase === 'playing' || (this.phase === 'title' && this.showcaseMode === 'title');
    this.scene.add(fox.group);
    this.companionFox = fox;
  }

  private getLaneCount(): 3 | 5 {
    return this.district?.laneCount === 5 ? 5 : 3;
  }

  private getLanes(): number[] {
    return this.getLaneCount() === 5 ? LANES_5 : LANES_3;
  }

  private getCenterLane(): number {
    return this.getLaneCount() === 5 ? 2 : 1;
  }

  private getLaneX(lane: number): number {
    const lanes = this.getLanes();
    return lanes[THREE.MathUtils.clamp(lane, 0, lanes.length - 1)] ?? 0;
  }

  private getRoadWidth(): number {
    return this.getLaneCount() === 5 ? 18.0 : 11.6;
  }

  private getWallOffset(): number {
    return this.getLaneCount() === 5 ? 8.35 : 5.05;
  }

  private getWalkCenter(): number {
    return this.getLaneCount() === 5 ? 11.5 : 8.2;
  }

  private getBuildingOffset(): number {
    return this.getLaneCount() === 5 ? 15.4 : 12.0;
  }

  private getTunnelRadius(): number {
    return this.getLaneCount() === 5 ? 15.2 : 11.5;
  }

  private getBossCombatDistance(bossId: BossId): number {
    switch (bossId) {
      case 'iron_hunter':
        return 30;
      case 'neon_wraith':
        return 32;
      case 'titan_drone':
      case 'overseer':
        return 33;
      case 'volt_archon':
        return 34;
      case 'cryo_leviathan':
        return 35;
      case 'the_sentinel':
        return 36;
      case 'omega_core':
        return 38;
    }
  }

  private animateBossMesh(dt: number, phase: number): void {
    if (!this.bossMesh) return;
    if (this.bossMesh.userData.isCustomGlb && this.bossMesh.userData.customMixer) {
      (this.bossMesh.userData.customMixer as THREE.AnimationMixer).update(dt);
    }
    const spd = 1 + (Math.max(1, phase) - 1) * 0.42;
    const rings = this.bossMesh.userData.rings as THREE.Object3D[] | undefined;
    if (rings) {
      rings.forEach((r, idx) => {
        if (this.activeBossId === 'titan_drone' || this.activeBossId === 'volt_archon') {
          r.rotation.z += dt * (2.6 + idx * 0.4) * spd;
        } else {
          r.rotation.z += dt * (idx % 2 === 0 ? 1.4 : -1.8) * spd;
          r.rotation.x += dt * 0.55 * spd;
        }
      });
    }
    const wings = this.bossMesh.userData.wings as THREE.Object3D[] | undefined;
    if (wings) {
      wings.forEach((w, idx) => {
        const sign = idx % 2 === 0 ? 1 : -1;
        w.rotation.z = sign * (0.36 + Math.sin(this.elapsedTotal * 4.5 * spd) * 0.16);
      });
    }
    const segments = this.bossMesh.userData.segments as THREE.Object3D[] | undefined;
    if (segments) {
      if (this.activeBossId === 'cryo_leviathan') {
        segments.forEach((seg, idx) => {
          seg.position.x = Math.sin(this.elapsedTotal * 4.2 * spd - idx * 0.65) * (0.45 + idx * 0.14);
          seg.position.y = 0.25 + Math.cos(this.elapsedTotal * 3.5 * spd - idx * 0.5) * 0.22;
        });
      } else if (this.activeBossId === 'omega_core' || this.activeBossId === 'the_sentinel') {
        segments.forEach((seg, idx) => {
          const baseAng = (idx * Math.PI * 2) / Math.max(1, segments.length) + this.elapsedTotal * 1.15 * spd;
          const rx = this.activeBossId === 'omega_core' ? 3.55 : 3.1;
          const ry = this.activeBossId === 'omega_core' ? 2.55 : 2.2;
          seg.position.set(Math.cos(baseAng) * rx, Math.sin(baseAng) * ry, Math.sin(baseAng * 2) * 0.55);
          seg.rotation.y += dt * 2.2 * spd;
        });
      } else if (this.activeBossId === 'iron_hunter') {
        segments.forEach((leg, idx) => {
          leg.rotation.x = Math.sin(this.elapsedTotal * 8 * spd + idx * Math.PI * 0.5) * 0.35;
        });
      }
    }
    const core = this.bossMesh.userData.core as THREE.Object3D | null | undefined;
    if (core && !this.bossMesh.userData.isCustomGlb) {
      const pulse = 1 + Math.sin(this.elapsedTotal * 6 * spd) * (0.06 + (phase - 1) * 0.03);
      core.scale.setScalar(pulse);
    }
  }

  private getRoadElevationY(worldZ: number): number {
    if (
      this.phase === 'title' ||
      this.mode === 'tutorial' ||
      this.mode === 'bosschase' ||
      this.district.id === 'skyline' ||
      worldZ > -112
    ) {
      return 0;
    }
    const dist = -worldZ - 112;
    const blend = Math.min(1, dist / 65);
    const wave =
      Math.sin(dist * 0.022) * 1.15 + Math.sin(dist * 0.009) * 0.65;
    return wave * blend;
  }

  private clearDynamicThreats(): void {
    for (const a of this.aerialThreats) {
      this.scene.remove(a.mesh);
      a.mesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
    }
    this.aerialThreats = [];

    for (const h of this.bossHazards) {
      this.scene.remove(h.mesh);
      h.mesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
    }
    this.bossHazards = [];
    this.bossWarningText = null;
  }

  public enableMultiplayer(localUserId: string | null): void {
    this.isMultiplayer = !!localUserId;
    this.localMpUserId = localUserId;
    this.mpPausedOverlay = false;
    if (!localUserId) {
      this.clearRemoteRunners();
    }
  }

  private clearRemoteRunners(): void {
    for (const rr of this.remoteRunners.values()) {
      this.scene.remove(rr.mesh);
      rr.mesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        } else if ((obj as THREE.Sprite).isSprite) {
          const s = obj as THREE.Sprite;
          s.material.map?.dispose();
          s.material.dispose();
        }
      });
    }
    this.remoteRunners.clear();
    this.latestMpPlayers = [];
  }

  public updateRemotePlayers(players: MultiplayerPlayerTelemetry[]): void {
    this.latestMpPlayers = players;
    const seen = new Set<string>();
    const palette = ['#22d3ee', '#f43f5e', '#facc15', '#a855f7', '#34d399'];
    let idx = 0;

    for (const p of players) {
      if (this.localMpUserId && p.userId === this.localMpUserId) continue;
      seen.add(p.userId);
      let rr = this.remoteRunners.get(p.userId);
      const targetWorldZ = -p.distance;
      const targetWorldY = this.getRoadElevationY(targetWorldZ) + p.y;
      if (!rr) {
        const mesh = buildRemoteRunnerGhost(p.username, palette[idx % palette.length]);
        mesh.position.set(p.x, targetWorldY, targetWorldZ);
        this.scene.add(mesh);
        rr = {
          userId: p.userId,
          username: p.username,
          mesh,
          targetX: p.x,
          targetY: targetWorldY,
          targetZ: targetWorldZ,
          paused: p.paused,
          finished: p.finished,
        };
        this.remoteRunners.set(p.userId, rr);
      } else {
        rr.targetX = p.x;
        rr.targetY = targetWorldY;
        rr.targetZ = targetWorldZ;
        rr.paused = p.paused;
        rr.finished = p.finished;
      }
      idx++;
    }

    for (const [uid, rr] of this.remoteRunners.entries()) {
      if (!seen.has(uid)) {
        this.scene.remove(rr.mesh);
        this.remoteRunners.delete(uid);
      }
    }
  }

  public setMultiplayerPausedOverlay(paused: boolean): void {
    if (!this.isMultiplayer) return;
    this.mpPausedOverlay = paused;
    if (paused) this.heldKeys.clear();
    this.emitHud(this.lastAction);
  }

  public getLiveTelemetry(): {
    x: number;
    y: number;
    z: number;
    lane: number;
    distance: number;
    score: number;
    action: ParkourAction;
    paused: boolean;
  } {
    return {
      x: Number(this.playerX.toFixed(2)),
      y: Number(Math.max(0, this.playerY - this.getRoadElevationY(this.playerZ)).toFixed(2)),
      z: Number(this.playerZ.toFixed(2)),
      lane: this.targetLane,
      distance: Math.floor(this.distance),
      score: Math.floor(this.score),
      action: this.lastAction,
      paused: this.mpPausedOverlay,
    };
  }

  private resolveTimePeriod(
    value: TimeOfDay | string | undefined,
    fallback: TimePeriod,
  ): TimePeriod {
    const safeFallback: TimePeriod =
      fallback in TIME_CONFIGS ? fallback : 'night';
    if (!value || value === 'dynamic') return safeFallback;
    if (value === 'day') return 'noon';
    if (value in TIME_CONFIGS) return value as TimePeriod;
    return safeFallback;
  }

  private applyTimeOfDayVisuals(period: TimePeriod): void {
    const safePeriod = this.resolveTimePeriod(period, 'night');
    this.currentPeriod = safePeriod;
    const cfg = TIME_CONFIGS[safePeriod];
    const d = this.district;
    const fogBase =
      this.settings.drawDistance === 'near'
        ? 0.016
        : this.settings.drawDistance === 'medium'
          ? 0.0115
          : 0.0085;
    const volMult = this.settings.volumetrics ? 1.0 : 0.78;
    const lightMult =
      this.settings.graphicsQuality === 'ultra' || this.settings.lightingQuality === 'cinematic'
        ? 1.0
        : this.settings.graphicsQuality === 'very_low' || this.settings.graphicsQuality === 'low'
          ? 0.78
          : 0.88;

    if (d.isUnderground) {
      this.scene.background = new THREE.Color(d.colors.skyTop);
      this.scene.fog = new THREE.FogExp2(d.colors.fog, fogBase * 1.18 * volMult);
      this.dirLight.intensity = 0.88 * lightMult;
      this.hemiLight.intensity = 0.48;
      this.renderer.toneMappingExposure = 0.9;
    } else {
      const skyCol = new THREE.Color(cfg.skyHex).lerp(
        new THREE.Color(d.colors.skyTop),
        0.38,
      );
      const fogCol = new THREE.Color(cfg.fogHex).lerp(
        new THREE.Color(d.colors.fog),
        0.4,
      );
      this.scene.background = skyCol;
      this.scene.fog = new THREE.FogExp2(fogCol, fogBase * volMult);
      this.dirLight.color.set(cfg.sunHex);
      this.dirLight.intensity = cfg.sunIntensity * lightMult;
      this.hemiLight.intensity = cfg.hemiIntensity;
      this.renderer.toneMappingExposure = cfg.exposure;
    }

    if (this.textures) {
      this.textures.buildingMat.emissiveIntensity = 0.46 * cfg.emissiveMult;
      this.textures.neonTrimMat.emissiveIntensity = 0.62 * cfg.emissiveMult;
      this.textures.secTrimMat.emissiveIntensity = 0.62 * cfg.emissiveMult;
    }
    this.cloudsMesh.visible = !d.isUnderground && this.settings.volumetrics;
  }

  private applyDistrictTheme(d: DistrictDef, spawnGate = false): void {
    const prevLaneCount = this.district?.laneCount ?? 3;
    this.district = d;
    const newLaneCount = d.laneCount === 5 ? 5 : 3;

    // Remap targetLane cleanly when transitioning between 3-lane and 5-lane maps (§19)
    if (prevLaneCount !== newLaneCount && this.phase === 'playing') {
      const prevMax = Math.max(1, prevLaneCount - 1);
      const newMax = Math.max(1, newLaneCount - 1);
      this.targetLane = THREE.MathUtils.clamp(
        Math.round((this.targetLane / prevMax) * newMax),
        0,
        newMax,
      );
    }

    if (this.settings.randomWeather) {
      const weathers: WeatherType[] = ['clear', 'rain', 'cyberfog', 'storm', 'sunset'];
      this.weather = d.isUnderground
        ? 'cyberfog'
        : weathers[Math.floor(Math.random() * weathers.length)];
    } else {
      this.weather = this.settings.dynamicWeather ? d.defaultWeather : 'clear';
    }
    const targetPeriod: TimePeriod = this.resolveTimePeriod(
      this.settings.timeOfDay,
      d.defaultTimeOfDay,
    );

    this.hemiLight.color.set(d.colors.primaryNeon);
    this.rimLight.color.set(d.colors.secondaryNeon);
    this.playerPointLight.color.set(d.colors.primaryNeon);

    this.textures.dispose();
    this.textures = createProceduralTextures(
      this.renderer,
      d.id,
      d.colors.primaryNeon,
      d.colors.secondaryNeon,
      d.colors.buildingBase,
      this.settings.textureQuality,
      this.settings.reflections,
      this.settings.materialQuality,
      this.settings.ambientOcclusion,
      newLaneCount,
    );

    if (spawnGate) {
      const gate = buildSectorTransitionGate(
        this.getRoadWidth(),
        d.colors.primaryNeon,
        d.colors.secondaryNeon,
      );
      const gateZ = this.playerZ - 26;
      gate.position.set(0, this.getRoadElevationY(gateZ), gateZ);
      this.scene.add(gate);
      this.sectorGates.push({ group: gate, timer: 2.8 });
    }

    this.applyTimeOfDayVisuals(targetPeriod);
    audioEngine.setCityAmbience(d.id, targetPeriod, this.weather);
    audioEngine.setMusicParams({
      bpm: d.musicBpm,
      rootHz: d.musicRootHz,
    });
  }

  private clearChunks(): void {
    for (const c of this.chunks) {
      this.scene.remove(c.group);
      c.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (!this.sharedGeos.has(m.geometry)) {
            m.geometry.dispose();
          }
        }
      });
    }
    this.chunks = [];
  }

  private clearTransientVfx(): void {
    for (const v of this.shieldShatterVfx) {
      this.scene.remove(v.group);
      v.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
    }
    this.shieldShatterVfx = [];

    for (const sg of this.sectorGates) {
      this.scene.remove(sg.group);
      sg.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
    }
    this.sectorGates = [];
  }

  private resetWorldForTitle(): void {
    this.clearChunks();
    this.clearTransientVfx();
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.targetLane = this.getCenterLane();
    this.velY = 0;
    this.nextChunkIndex = -1;
    const count = this.getVisibleChunksCount();
    for (let i = 0; i < count; i++) {
      this.spawnChunk(this.nextChunkIndex++, true);
    }
    for (const c of this.chunks) {
      c.group.visible = this.showcaseMode === 'city';
    }
    this.rebuildHangarLobby();
    if (this.hangarGroup) {
      this.hangarGroup.visible = this.showcaseMode !== 'city';
    }
    this.playerRig.root.position.set(0, 0.14, 0);
    this.playerRig.root.rotation.set(0, Math.PI, 0);
    this.playerRig.root.visible =
      this.showcaseMode !== 'garage' && this.showcaseMode !== 'boss';
    if (this.vehicleShowcase) {
      this.vehicleShowcase.group.visible = this.showcaseMode === 'garage';
    }
    this.pursuerMesh.visible = false;
    this.captureDroneMesh.visible = false;
    this.bossMesh.visible = this.showcaseMode === 'boss';
  }

  private beginBossEncounter(bossId: BossId, isAmbush: boolean): void {
    const bossDef = getBossById(bossId);
    this.swapBossModel(bossId);
    this.inBossArena = true;
    this.clearNearbyHazards(130);

    this.bossPhaseIndex = 0;
    this.bossPhase = 1;
    const phasesCfg = bossDef.phasesConfig;
    const totalHp = phasesCfg.reduce((acc, p) => acc + p.hpUnits, 0);
    const p1 = phasesCfg[0];

    this.bossMaxHp = totalHp;
    this.bossHp = totalHp;
    this.bossPhaseMaxHp = p1.hpUnits;
    this.bossPhaseHp = p1.hpUnits;
    this.bossPhaseName = p1.name;
    this.bossIntroTitle = `${bossDef.name} — ${bossDef.introTitle}`;
    this.bossIntroQuote = bossDef.introQuote;
    this.bossIntroTimer = 3.2;
    this.bossPhaseTransitionTimer = 0;
    this.bossEntranceTimer = 3.2;
    this.bossEmpSpawnTimer = p1.empSpawnSec;
    this.bossAttackTimer = p1.attackCooldownSec + 3.2;
    this.bossDistance = this.getBossCombatDistance(bossId);
    this.bossWarningText = null;
    this.bossMesh.position.set(0, this.getRoadElevationY(this.playerZ - 58) + 4.8, this.playerZ - 58);
    this.bossMesh.visible = true;
    applyBossPhaseVisuals(this.bossMesh, bossDef, 0);

    audioEngine.setBossPhase(1);
    audioEngine.setMusicMode('boss');
    audioEngine.playBossEntrance();

    this.showBanner(
      isAmbush
        ? `¡EMBOSCADA: ${bossDef.name.toUpperCase()}!`
        : `${bossDef.name.toUpperCase()} · ${bossDef.introTitle.toUpperCase()}`,
    );
    this.showSubtitle(bossDef.introQuote);
  }

  public getActiveRunContext(): ActiveRunContext {
    return { ...this.activeRunContext };
  }

  public restartRun(): void {
    const ctx = this.activeRunContext;
    this.startRun(
      ctx.mode,
      ctx.districtId,
      ctx.eventId,
      ctx.bossId ?? undefined,
      ctx.storyChapter ?? undefined,
    );
  }

  public startRun(
    mode: GameMode,
    districtId: DistrictId,
    eventId: string | null = null,
    bossOverride?: BossId,
    storyChapterOverride?: number,
  ): void {
    audioEngine.unlock();
    audioEngine.setBossPhase(1);
    audioEngine.setMusicMode(
      mode === 'bosschase' ? 'boss' : mode === 'tutorial' ? 'intro' : 'exploration',
    );
    audioEngine.startMusic();

    this.mode = mode;
    this.activeEventId = eventId;
    this.phase = 'playing';
    this.mpPausedOverlay = false;
    this.clearDynamicThreats();
    this.clearTransientVfx();
    if (this.hangarGroup) this.hangarGroup.visible = false;
    if (this.captureDroneMesh) this.captureDroneMesh.visible = false;

    const chapterNum = storyChapterOverride ?? this.save.storyChapter ?? 1;
    const chapterDef = getStoryChapterByNum(chapterNum);
    const effectiveDistrictId =
      mode === 'tutorial'
        ? 'downtown'
        : mode === 'story' && !districtId
          ? chapterDef.districtId
          : districtId;
    const distDef = getDistrictById(effectiveDistrictId);
    this.recentDistrictIds = [distDef.id];
    this.applyDistrictTheme(distDef, false);
    this.clearChunks();

    this.activeRunContext = {
      mode,
      districtId: distDef.id,
      eventId,
      bossId: bossOverride ?? null,
      storyChapter: mode === 'story' ? chapterNum : null,
    };

    const char = getCharacterById(this.save.selectedCharacterId);
    const speedSkill = this.save.skillLevels['momentum_mastery'] ?? 0;
    const diffMult =
      mode === 'tutorial'
        ? 0.82
        : this.settings.difficulty === 'easy'
          ? 0.88
          : this.settings.difficulty === 'hard'
            ? 1.15
            : 1.0;

    const vid = this.save.selectedVehicleId ?? 'hover_bike';
    const vLvl = this.save.vehicleUpgrades?.[vid] ?? 0;
    this.activeVehicleStats = getEffectiveVehicleStats(vid, vLvl);

    this.revivesUsedRun = 0;
    this.talismanUsedRun = false;
    this.revivePrompt = null;
    this.reviveCountdownTimer = 10.0;
    this.liveTalismansHeld = this.save.talismans ?? 0;
    this.liveReviveTokensHeld = this.save.reviveTokens ?? 0;

    this.playerRig.root.visible = true;
    if (this.vehicleShowcase) this.vehicleShowcase.group.visible = false;
    if (this.companionFox) {
      this.companionFox.group.visible = this.save.equippedPetId === 'fox_cyber';
    }

    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.targetLane = this.getCenterLane();
    this.velY = 0;
    this.grounded = true;
    this.jumpsUsed = 0;
    this.doubleJumpFlipTimer = 0;
    this.doubleJumpCooldown = 0;
    this.doubleJumpBlockedReason = null;
    this.doubleJumpBlockedTimer = 0;
    this.vaultTimer = 0;
    this.slideTimer = 0;
    this.wallRunTimer = 0;
    this.wallRunSide = 0;
    this.climbTimer = 0;
    this.ziplineTimer = 0;
    this.grappleTimer = 0;
    this.swingBarTimer = 0;
    this.onFloor2 = false;
    this.onBalanceBeam = false;
    this.celebrateTimer = 0;
    this.objectiveToastText = null;
    this.objectiveToastTimer = 0;
    this.sectorTransitionText = null;
    this.sectorTransitionTimer = 0;
    this.pendingSectorGate = false;
    this.stumbleTimer = 0;
    this.hitstopTimer = 0;
    this.cameraShake = 0;
    this.floodSlowTimer = 0;
    this.diveQueued = false;

    this.baseSpeed =
      (22.5 + char.stats.speed * 0.65 + speedSkill * 0.95) *
      this.district.speedBonus *
      diffMult;
    if (mode === 'freerun') this.baseSpeed *= 0.88;
    if (mode === 'timetrial' || mode === 'bosschase') this.baseSpeed *= 1.08;
    this.forwardSpeed = this.baseSpeed;
    this.maxSpeedKmh = 0;
    this.difficultyStage = 1;

    this.momentum = 28;
    this.sprintCooldown = 0;
    this.boostActive = false;
    this.slowMoEnergy = 100;
    this.isSlowMo = false;
    this.vehicleLockNoticeTimer = 0;
    this.abilityCharge = 100;
    this.abilityActiveTimer = 0;
    // Valkyrie Passive: Blindaje Reactivo (starts every run with active Shield!)
    this.hasShield = char.id === 'valkyrie';
    this.shieldCooldown = 0;
    this.magnetTimer = 0;
    this.vehicleTimer = 0;
    this.invulnTimer = 0;
    this.phaseThroughTimer = 0;
    this.lowGravTimer = 0;

    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.score = 0;
    this.distance = 0;
    this.runDurationSec = 0;
    this.coinsRun = 0;
    this.gemsRun = 0;
    this.wallRunsCount = 0;
    this.grapplesCount = 0;
    this.vehiclesCount = 0;
    this.dronesEvadedRun = 0;
    this.abilitiesUsedCount = 0;
    this.slowMoUsedCount = 0;
    this.secretsFoundRun = 0;
    this.obstaclesDodgedRun = 0;
    this.trainsPassedRun = 0;
    this.shieldBreaksRun = 0;
    this.doubleJumpsRun = 0;
    this.parkourChainsRun = 0;
    this.bossPhasesClearedRun = 0;
    this.fiveLaneDistanceRun = 0;
    this.highlights = [];

    this.nextEventDistance = 420;
    this.nextAerialSpawnDist = 420;
    this.activeDynamicEvent = null;
    this.dynamicEventTimer = 0;
    this.powerOutageActive = false;
    this.dynamicTimeAccum = 0;
    this.rainEventState = {
      active: false,
      timer: 0,
      cooldownTimer: 35,
      dropTimer: 0,
    };

    // Interactive Tutorial State
    this.tutorialStepIndex = 0;
    this.tutorialStepCount = 0;
    this.tutorialStepProgress = 0;
    this.tutorialStepText =
      mode === 'tutorial' ? 'Paso 1/6: Cambia de carril con [A] y [D] (0/2)' : null;

    // Pursuer Enforcer setup
    this.pursuerDistance = mode === 'freerun' || mode === 'tutorial' ? 99 : 25;
    this.pursuerSirenCooldown = 0;
    this.pursuerMesh.visible = mode !== 'freerun' && mode !== 'tutorial';
    this.pursuerMesh.position.set(0, 0, 10);

    // Random Boss Ambush setup for normal runs (§15: raised threshold >= 1650m)
    this.randomBossActive = false;
    this.randomBossTimer = 0;
    this.inBossArena = false;
    this.nextRandomBossDist = 1650 + Math.random() * 450;

    const evt = eventId ? LIVE_EVENTS.find((e) => e.id === eventId) : null;
    const candidateBossId =
      bossOverride ??
      evt?.bossId ??
      (mode === 'story' ? chapterDef.bossId : undefined) ??
      distDef.signatureBoss ??
      BOSSES[0].id;
    const unlockedBosses = getUnlockedBossIds(this.save.defeatedBosses ?? []);
    const chosenBossId =
      mode === 'bosschase' && !isBossUnlocked(candidateBossId, this.save.defeatedBosses ?? [])
        ? unlockedBosses[unlockedBosses.length - 1] ?? BOSSES[0].id
        : candidateBossId;

    this.activeRunContext.bossId = chosenBossId;
    this.bossDefeatedId = null;
    if (mode === 'bosschase') {
      this.beginBossEncounter(chosenBossId, false);
    } else {
      this.swapBossModel(chosenBossId);
      this.bossHp = 0;
      this.bossPhase = 1;
      this.bossPhaseIndex = 0;
      this.bossPhaseHp = 0;
      this.bossPhaseMaxHp = 3;
      this.bossPhaseName = '';
      this.bossIntroTitle = '';
      this.bossIntroQuote = '';
      this.bossIntroTimer = 0;
      this.bossPhaseTransitionTimer = 0;
      this.bossEntranceTimer = 0;
      this.bossDistance = null;
      this.bossMesh.visible = false;
    }

    this.storyChapterNum = chapterDef.chapter;
    this.storyObjectiveText = mode === 'story' ? chapterDef.objectiveLabel : null;
    this.storyBeatIndex = 0;

    this.timeRemaining = mode === 'timetrial' ? 68 : null;
    this.targetDistance = evt
      ? evt.targetDistance
      : mode === 'story'
        ? chapterDef.targetDistance
        : mode === 'timetrial'
          ? 1400
          : mode === 'parkour'
            ? 1400
            : null;

    if (mode !== 'bosschase') {
      this.showBanner(
        mode === 'tutorial'
          ? 'TUTORIAL INTERACTIVO — ENTRENAMIENTO PARKOUR'
          : mode === 'story'
            ? `CAPÍTULO ${chapterDef.chapter}: ${chapterDef.title.toUpperCase()}`
            : mode === 'parkour'
              ? `PARKOUR EXTREMO 2 PISOS · ${this.district.name.toUpperCase()}`
              : evt
                ? `${evt.title.toUpperCase()} · ${evt.modifierTag}`
                : `${this.district.name.toUpperCase()} · ${this.district.subtitle}`,
      );
      if (mode === 'tutorial') {
        this.showSubtitle('Sigue cada paso en pantalla para dominar el parkour en Neon City.');
      } else if (mode === 'story' && chapterDef.dialogueBeats[0]) {
        this.showSubtitle(
          `[${chapterDef.dialogueBeats[0].speaker}]: ${chapterDef.dialogueBeats[0].text}`,
        );
        this.storyBeatIndex = 1;
      } else {
        this.showSubtitle(
          mode === 'parkour'
            ? 'Sube al Piso 2 por rampas o plataformas de salto, usa barras y vigas!'
            : `Despliegue en ${this.district.name} (${this.getLaneCount()} carriles). ¡Suerte, ${char.name}!`,
        );
      }
    }

    this.playerRig.root.rotation.set(0, 0, 0);
    this.playerRig.root.position.set(0, 0, 0);

    this.nextChunkIndex = -1;
    const count = this.getVisibleChunksCount();
    for (let i = 0; i < count; i++) {
      this.spawnChunk(this.nextChunkIndex++, i <= 2 || mode === 'tutorial');
    }

    this.emitHud();
  }

  public setPaused(paused: boolean): void {
    if (this.isMultiplayer && this.phase === 'playing') {
      this.setMultiplayerPausedOverlay(paused);
      return;
    }
    if (this.phase === 'playing' && paused) {
      this.phase = 'paused';
      this.heldKeys.clear();
      this.emitHud();
    } else if (this.phase === 'paused' && !paused) {
      this.phase = 'playing';
      this.lastTime = performance.now();
      this.emitHud();
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.revivePrompt = null;
    this.randomBossActive = false;
    this.inBossArena = false;
    this.bossIntroTimer = 0;
    this.bossPhaseTransitionTimer = 0;
    this.mpPausedOverlay = false;
    this.clearDynamicThreats();
    this.clearTransientVfx();
    this.clearRemoteRunners();
    this.rainEventState.active = false;
    this.heldKeys.clear();
    this.isSlowMo = false;
    this.powerOutageActive = false;
    if (this.captureDroneMesh) this.captureDroneMesh.visible = false;
    audioEngine.setBossPhase(1);
    audioEngine.setMusicMode('lobby');
    audioEngine.setMusicParams({ slowMo: false, intensity: 0.28, danger: 0 });
    this.applyDistrictTheme(getDistrictById(this.save.selectedDistrictId), false);
    this.resetWorldForTitle();
    this.emitHud();
  }

  private showBanner(text: string): void {
    this.activeBanner = text;
    this.bannerTimer = 3.2;
  }

  private showSubtitle(text: string): void {
    if (!this.settings.subtitles) return;
    this.subtitleText = text;
    this.subtitleTimer = 3.2;
  }

  private showStunt(text: string, comboAdd = 1): void {
    this.lastStuntText = text;
    this.stuntTimer = 1.6;
    const comboBonusLvl = this.save.skillLevels['combo_multiplier'] ?? 0;
    const kageBonus = this.save.selectedCharacterId === 'kage' ? 1.0 : 0;
    this.combo = Math.min(20, this.combo + comboAdd);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = 4.2 + comboBonusLvl * 0.8 + kageBonus;
    const momLvl = this.save.skillLevels['momentum_mastery'] ?? 0;
    this.momentum = Math.min(100, this.momentum + 14 * (1 + momLvl * 0.15));
    this.score += 120 * this.combo;
  }

  // ---- City World, 7 District Architectures, LODs, 10 Enemies & 20+ Obstacles ----
  private buildElevatedRoadGeo(width: number, len: number, zCenterWorld: number): THREE.PlaneGeometry {
    const geo = new THREE.PlaneGeometry(width, len, 1, 14);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const localZ = pos.getZ(i);
      pos.setY(i, this.getRoadElevationY(zCenterWorld + localZ));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  private buildElevatedWalkGeo(width: number, height: number, len: number, zCenterWorld: number): THREE.BoxGeometry {
    const geo = new THREE.BoxGeometry(width, height, len, 1, 1, 14);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const localZ = pos.getZ(i);
      pos.setY(i, pos.getY(i) + this.getRoadElevationY(zCenterWorld + localZ));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  private spawnChunk(chunkIdx: number, safeMode: boolean): void {
    const zStart = -chunkIdx * CHUNK_LEN;
    const group = new THREE.Group();
    group.position.set(0, 0, zStart);

    const obstacles: ObstacleEntity[] = [];
    const enemies: EnemyEntity[] = [];
    const collectibles: CollectibleEntity[] = [];
    const abyssGaps: AbyssGap[] = [];

    const roadW = this.getRoadWidth();
    const walkCenter = this.getWalkCenter();
    const bOffset = this.getBuildingOffset();
    const wallOff = this.getWallOffset();
    const laneCount = this.getLaneCount();

    const hasAbyss =
      !safeMode &&
      this.mode !== 'tutorial' &&
      !this.inBossArena &&
      this.district.id === 'skyline' &&
      chunkIdx % 3 === 1;

    if (hasAbyss) {
      // RoadFront spans [0, -23.52], RoadBack spans [-32.48, -56] -> Gap [-32.48, -23.52]
      const halfRoadGeo = this.buildElevatedRoadGeo(
        roadW,
        CHUNK_LEN * 0.42,
        zStart - CHUNK_LEN * 0.21,
      );
      const roadFront = new THREE.Mesh(halfRoadGeo, this.textures.roadMat);
      roadFront.position.set(0, 0, -CHUNK_LEN * 0.21);
      roadFront.receiveShadow = true;
      const backRoadGeo = this.buildElevatedRoadGeo(
        roadW,
        CHUNK_LEN * 0.42,
        zStart - CHUNK_LEN * 0.79,
      );
      const roadBack = new THREE.Mesh(backRoadGeo, this.textures.roadMat);
      roadBack.position.set(0, 0, -CHUNK_LEN * 0.79);
      roadBack.receiveShadow = true;

      const ledgeFront = new THREE.Mesh(
        new THREE.BoxGeometry(roadW, 0.14, 0.35),
        this.textures.hazardMat,
      );
      ledgeFront.position.set(0, 0.05, -23.52);
      const ledgeBack = ledgeFront.clone();
      ledgeBack.position.set(0, 0.05, -32.48);

      group.add(roadFront, roadBack, ledgeFront, ledgeBack);
      abyssGaps.push({
        zMin: zStart - 32.35,
        zMax: zStart - 23.65,
      });
    } else {
      const roadGeo = this.buildElevatedRoadGeo(roadW, CHUNK_LEN, zStart - CHUNK_LEN / 2);
      const road = new THREE.Mesh(roadGeo, this.textures.roadMat);
      road.position.set(0, 0, -CHUNK_LEN / 2);
      road.receiveShadow = true;
      group.add(road);
    }

    const walkGeoL = this.buildElevatedWalkGeo(5, 0.35, CHUNK_LEN, zStart - CHUNK_LEN / 2);
    const walkL = new THREE.Mesh(walkGeoL, this.textures.walkMat);
    walkL.position.set(-walkCenter, 0.17, -CHUNK_LEN / 2);
    const walkR = new THREE.Mesh(walkGeoL, this.textures.walkMat);
    walkR.position.set(walkCenter, 0.17, -CHUNK_LEN / 2);
    group.add(walkL, walkR);

    // Animated Ocean / Harbor Strip
    if ((this.district.id === 'beach' || this.district.id === 'cyber_port') && this.textures.waterMat) {
      const oceanR = new THREE.Mesh(this.oceanGeo, this.textures.waterMat);
      oceanR.position.set(walkCenter + 26, -0.7 + this.getRoadElevationY(zStart - CHUNK_LEN / 2), -CHUNK_LEN / 2);
      group.add(oceanR);
    }

    // Enclosed Subterranean Metro Tunnel Vault for Underground district
    if (this.district.isUnderground) {
      const tunnelSeg = buildUndergroundTunnelSegment(
        CHUNK_LEN,
        this.textures,
        this.getTunnelRadius(),
      );
      tunnelSeg.position.set(0, this.getRoadElevationY(zStart - CHUNK_LEN / 2), 0);
      group.add(tunnelSeg);
    }

    // Object Density & LOD Scaling
    const densityMult =
      this.settings.objectDensity === 'low'
        ? 0.5
        : this.settings.objectDensity === 'medium'
          ? 0.75
          : 1.0;
    const buildingStep = densityMult < 0.7 ? 2 : 1;
    const lodSwitch = this.getLodSwitchDistance();

    for (let s = 0; s < 3; s += buildingStep) {
      const bz = -s * (CHUNK_LEN / 3) - 9;
      const bGroundY = this.getRoadElevationY(zStart + bz);
      for (const side of [-1, 1] as const) {
        if (this.district.id === 'beach' && side === 1 && s % 2 === 1) {
          const landmark = buildDistrictLandmark(this.district, side, this.textures);
          landmark.position.set(side * (walkCenter - 0.4), bGroundY + 0.35, bz);
          group.add(landmark);
          continue;
        }

        const bw = 7 + Math.random() * 4;
        const bh = this.district.isUnderground
          ? 12
          : this.district.id === 'oldcity'
            ? 12 + Math.random() * 10
            : 18 + Math.random() * 24;
        const bd = 14;
        const bx = side * (bOffset + bw * 0.5);

        const lod = buildBuildingLOD(
          this.unitBoxGeo,
          bw,
          bh,
          bd,
          this.textures,
          side,
          lodSwitch,
        );
        lod.position.set(bx, bGroundY, bz);
        group.add(lod);

        if (s === 1) {
          const landmark = buildDistrictLandmark(this.district, side, this.textures);
          landmark.position.set(side * (walkCenter - 0.4), bGroundY + 0.35, bz);
          group.add(landmark);
        }

        if (Math.random() < 0.36 * densityMult) {
          const bbMat =
            this.textures.billboardMats[
              Math.floor(Math.random() * this.textures.billboardMats.length)
            ];
          const bb = new THREE.Mesh(this.billboardGeo, bbMat);
          bb.position.set(side * (bOffset - 2.2), bGroundY + 8.2 + Math.random() * 4, bz);
          bb.rotation.y = side > 0 ? -Math.PI * 0.38 : Math.PI * 0.38;
          group.add(bb);
        }
      }
    }

    // Distinct City Overhead Arches / Viaducts scaled to 3 or 5 lanes
    const archScale = laneCount === 5 ? 1.48 : 1.0;
    if (
      this.district.id === 'future' ||
      this.district.id === 'oldcity' ||
      this.district.id === 'crimson_metropolis'
    ) {
      for (let a = 0; a < 2; a++) {
        const az = -a * 28 - 14;
        const ay = this.getRoadElevationY(zStart + az);
        const arch = new THREE.Mesh(this.archGeo, this.textures.walkMat);
        arch.scale.set(archScale, 1, 1);
        arch.position.set(0, ay + 6.2, az);
        group.add(arch);
        const archGlow = new THREE.Mesh(this.archGlowGeo, this.textures.neonTrimMat);
        archGlow.scale.set(archScale, 1, 1);
        archGlow.position.set(0, ay + 6.2, az);
        group.add(archGlow);
      }
    } else if ((this.district.id === 'downtown' || this.district.id === 'obsidian_citadel') && chunkIdx % 2 === 0) {
      const vy = this.getRoadElevationY(zStart - 26);
      const viaduct = new THREE.Mesh(this.unitBoxGeo, this.textures.darkMetalMat);
      viaduct.scale.set(roadW + 10.5, 1.3, 4.2);
      viaduct.position.set(0, vy + 9.2, -26);
      group.add(viaduct);
    }

    if (this.mode === 'tutorial' && !safeMode) {
      // Gentle tutorial practice layout with clear lanes, jump/slide barriers, and abundant coins
      const tutRes: TrackReservation[] = [];
      if (chunkIdx % 2 === 0) {
        this.spawnBarrier('lowBarrier', 1, -24, zStart, group, obstacles, tutRes);
        this.spawnBarrier('highGate', 0, -42, zStart, group, obstacles, tutRes);
      } else {
        this.spawnBarrier('highGate', 2, -26, zStart, group, obstacles, tutRes);
        this.spawnBarrier('lowBarrier', 0, -42, zStart, group, obstacles, tutRes);
      }
      for (let i = 0; i < 6; i++) {
        const cLane = i % 2 === 0 ? 1 : 2;
        const cz = -10 - i * 6.5;
        this.spawnCollectible(
          'coin',
          this.getLaneX(cLane),
          0.95,
          zStart + cz,
          group,
          collectibles,
          obstacles,
          enemies,
        );
      }
    } else if (!safeMode) {
      this.populateChunkGameplay(
        chunkIdx,
        zStart,
        group,
        obstacles,
        enemies,
        collectibles,
        hasAbyss,
        wallOff,
      );
    } else {
      for (let i = 0; i < 6; i++) {
        const cz = zStart - 12 - i * 4.5;
        this.spawnCollectible(
          'coin',
          0,
          this.getRoadElevationY(cz) + 0.95,
          cz,
          group,
          collectibles,
          obstacles,
          enemies,
        );
      }
    }

    this.scene.add(group);
    this.chunks.push({
      index: chunkIdx,
      zStart,
      group,
      obstacles,
      enemies,
      collectibles,
      abyssGaps,
    });
  }

  private buildFlushRampMesh(
    width: number,
    horizLen: number,
    heightRise: number,
  ): THREE.Group {
    const rampGroup = new THREE.Group();
    const slopeLen = Math.hypot(horizLen, heightRise);
    const angle = Math.atan2(heightRise, horizLen);
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.24, slopeLen),
      this.textures.darkMetalMat,
    );
    deck.rotation.x = angle;
    rampGroup.add(deck);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.86, 0.08, slopeLen),
      this.textures.neonTrimMat,
    );
    glow.position.y = 0.12;
    glow.rotation.x = angle;
    rampGroup.add(glow);

    for (const sx of [-width * 0.48, width * 0.48]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.34, slopeLen),
        this.textures.secTrimMat,
      );
      rail.position.set(sx, 0.16, 0);
      rail.rotation.x = angle;
      rampGroup.add(rail);
    }
    return rampGroup;
  }

  private isLaneZoneClear(
    reservations: TrackReservation[],
    lane: number,
    zCenter: number,
    halfLen: number,
    pad = 1.6,
  ): boolean {
    const qMin = zCenter - halfLen - pad;
    const qMax = zCenter + halfLen + pad;
    for (const r of reservations) {
      if (r.lane === lane && r.zMax >= qMin && r.zMin <= qMax) {
        return false;
      }
    }
    return true;
  }

  private findSurfaceAt(
    reservations: TrackReservation[],
    lane: number,
    zLocal: number,
  ): TrackReservation | null {
    for (const r of reservations) {
      if (r.lane === lane && zLocal >= r.zMin - 1.3 && zLocal <= r.zMax + 1.3) {
        return r;
      }
    }
    return null;
  }

  private hasOpenLaneInBand(
    reservations: TrackReservation[],
    zMin: number,
    zMax: number,
  ): boolean {
    const laneCount = this.getLaneCount();
    for (let l = 0; l < laneCount; l++) {
      let laneBlocked = false;
      for (const r of reservations) {
        if (
          r.lane === l &&
          r.impassableGround &&
          !r.slideUnder &&
          !r.walkableRoof &&
          r.zMax >= zMin &&
          r.zMin <= zMax
        ) {
          laneBlocked = true;
          break;
        }
      }
      if (!laneBlocked) return true;
    }
    return false;
  }

  private populateChunkGameplay(
    chunkIdx: number,
    zStart: number,
    group: THREE.Group,
    obstacles: ObstacleEntity[],
    enemies: EnemyEntity[],
    collectibles: CollectibleEntity[],
    hasAbyss: boolean,
    wallOff = 5.05,
  ): void {
    const laneCount = this.getLaneCount();
    const centerLane = this.getCenterLane();
    const roadW = this.getRoadWidth();
    const inBossArena = this.mode === 'bosschase' || this.randomBossActive || this.inBossArena;
    const pattern = (chunkIdx + Math.floor(Math.random() * 5)) % 9;
    const reservations: TrackReservation[] = [];
    const parkourTrail: { x: number; y: number; zLocal: number; kind: CollectibleEntity['kind'] }[] = [];

    // Boss Arena Mode (§2 & §15): 100% CLEAN HIGH-VISIBILITY ARENA — ZERO CLUTTER TRAPS OR TRAINS!
    if (inBossArena) {
      const empLane = (chunkIdx + 1) % laneCount;
      const empZ = zStart - 34;
      const empGy = this.getRoadElevationY(empZ);
      this.spawnCollectible('empCell', this.getLaneX(empLane), empGy + 1.15, empZ, group, collectibles, obstacles, enemies);

      const bonusLane = (empLane + 1) % laneCount;
      for (let i = 0; i < 4; i++) {
        const bz = -14 - i * 5.2;
        const gy = this.getRoadElevationY(zStart + bz);
        this.spawnCollectible(
          i === 3 ? 'gem' : 'coin',
          this.getLaneX(bonusLane),
          gy + 0.95,
          zStart + bz,
          group,
          collectibles,
          obstacles,
          enemies,
        );
      }
      return;
    }

    // Mode: 2-Floor Extreme Parkour Circuit (§20)
    if (this.mode === 'parkour' && !hasAbyss) {
      const pLane = (chunkIdx + 1) % laneCount;
      const altLane = (pLane + 1) % laneCount;
      const lowerLane = (pLane + laneCount - 1) % laneCount;
      const pX = this.getLaneX(pLane);
      const aX = this.getLaneX(altLane);

      // Floor 2 Entry A: Climb Ramp leading to 2nd floor deck (y = ground + 4.0m)
      const rampGy = this.getRoadElevationY(zStart - 11.5);
      const rampMesh = buildParkourModule('climb_ramp', 2.7, 7.5, this.textures);
      rampMesh.position.set(pX, rampGy, -11.5);
      group.add(rampMesh);
      obstacles.push({
        id: this.obstacleSeq++,
        kind: 'climbRamp',
        mesh: rampMesh,
        lane: pLane,
        baseX: pX,
        baseY: 2.0,
        groundY: rampGy,
        x: pX,
        y: rampGy + 2.0,
        z: zStart - 11.5,
        width: 2.7,
        height: 4.0,
        length: 7.5,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
        rampTopY: 4.0,
      });
      reservations.push({
        lane: pLane,
        zMin: -15.3,
        zMax: -7.7,
        topY: 4.0,
        walkableRoof: true,
        slideUnder: false,
        impassableGround: false,
      });

      // Floor 2 Main Deck
      const deckGy = this.getRoadElevationY(zStart - 24);
      const useBalanceBeam = chunkIdx % 3 === 1;
      if (useBalanceBeam) {
        const beamMesh = buildParkourModule('balance_beam', 2.4, 15, this.textures);
        beamMesh.position.set(pX, deckGy + 4.0, -23.5);
        group.add(beamMesh);
        obstacles.push({
          id: this.obstacleSeq++,
          kind: 'balanceBeam',
          mesh: beamMesh,
          lane: pLane,
          baseX: pX,
          baseY: 4.0,
          groundY: deckGy,
          x: pX,
          y: deckGy + 4.0,
          z: zStart - 23.5,
          width: 1.4,
          height: 4.0,
          length: 15,
          speedZ: 0,
          phase: 0,
          hit: false,
          interacted: false,
        });
      } else {
        const deckMesh = buildParkourModule('floor2_deck', 2.95, 16, this.textures);
        deckMesh.position.set(pX, deckGy + 4.0, -24);
        group.add(deckMesh);
        obstacles.push({
          id: this.obstacleSeq++,
          kind: 'floor2Deck',
          mesh: deckMesh,
          lane: pLane,
          baseX: pX,
          baseY: 4.0,
          groundY: deckGy,
          x: pX,
          y: deckGy + 4.0,
          z: zStart - 24,
          width: 2.95,
          height: 4.0,
          length: 16,
          speedZ: 0,
          phase: 0,
          hit: false,
          interacted: false,
        });
        if (chunkIdx % 2 === 0) {
          // Floor 2 High Conduit overhead beam requiring slide at Floor 2!
          const condMesh = buildParkourModule('high_conduit', 2.9, 1.0, this.textures);
          condMesh.position.set(pX, deckGy + 4.0, -24);
          group.add(condMesh);
          obstacles.push({
            id: this.obstacleSeq++,
            kind: 'highConduit',
            mesh: condMesh,
            lane: pLane,
            baseX: pX,
            baseY: 5.5,
            groundY: deckGy + 4.0,
            x: pX,
            y: deckGy + 5.9,
            z: zStart - 24,
            width: 2.7,
            height: 2.4,
            length: 0.9,
            speedZ: 0,
            phase: 0,
            hit: false,
            interacted: false,
          });
        }
      }
      reservations.push({
        lane: pLane,
        zMin: -32,
        zMax: -16,
        topY: 4.0,
        walkableRoof: true,
        slideUnder: true,
        impassableGround: false,
      });

      // Floor 2 Swing Bar spanning to Rear Deck (-36.5) + Rear Floor 2 Deck (-45)
      const swingGy = this.getRoadElevationY(zStart - 35.5);
      const swingMesh = buildParkourModule('swing_bar', 3.0, 2.0, this.textures);
      swingMesh.position.set(pX, swingGy + 4.0, -35.5);
      group.add(swingMesh);
      obstacles.push({
        id: this.obstacleSeq++,
        kind: 'swingBar',
        mesh: swingMesh,
        lane: pLane,
        baseX: pX,
        baseY: 6.75,
        groundY: swingGy,
        x: pX,
        y: swingGy + 6.75,
        z: zStart - 35.5,
        width: 3.1,
        height: 3.2,
        length: 6.5,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });

      const rearDeckGy = this.getRoadElevationY(zStart - 45);
      const rearDeck = buildParkourModule('floor2_deck', 2.95, 11, this.textures);
      rearDeck.position.set(pX, rearDeckGy + 4.0, -45);
      group.add(rearDeck);
      obstacles.push({
        id: this.obstacleSeq++,
        kind: 'floor2Deck',
        mesh: rearDeck,
        lane: pLane,
        baseX: pX,
        baseY: 4.0,
        groundY: rearDeckGy,
        x: pX,
        y: rearDeckGy + 4.0,
        z: zStart - 45,
        width: 2.95,
        height: 4.0,
        length: 11,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });

      // Alternate route: Jump Pad on Floor 1 launching up to upper route!
      const jpGy = this.getRoadElevationY(zStart - 13);
      const jpMesh = buildParkourModule('jump_pad', 2.4, 2.4, this.textures);
      jpMesh.position.set(aX, jpGy, -13);
      group.add(jpMesh);
      obstacles.push({
        id: this.obstacleSeq++,
        kind: 'jumpPad',
        mesh: jpMesh,
        lane: altLane,
        baseX: aX,
        baseY: 0.2,
        groundY: jpGy,
        x: aX,
        y: jpGy + 0.2,
        z: zStart - 13,
        width: 2.4,
        height: 0.6,
        length: 2.6,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });

      // Floor 2 gem + coin trail
      parkourTrail.push(
        { x: pX, y: 2.2, zLocal: -10.5, kind: 'coin' },
        { x: pX, y: 3.9, zLocal: -14.2, kind: 'coin' },
        { x: pX, y: 4.85, zLocal: -20.5, kind: 'coin' },
        { x: pX, y: 4.55, zLocal: -24.0, kind: 'gem' },
        { x: pX, y: 5.0, zLocal: -29.0, kind: 'coin' },
        { x: pX, y: 5.8, zLocal: -35.5, kind: 'gem' },
        { x: pX, y: 5.05, zLocal: -45.0, kind: 'secret' },
      );

      // Solvable Floor 1 ground option
      this.spawnBarrier('highGate', lowerLane, -26, zStart, group, obstacles, reservations);
      if (laneCount === 5) {
        this.spawnCityHazard((pLane + 2) % laneCount, -30, zStart, group, obstacles, reservations);
      }
    }

    // Skyline abyss bridging via retractBridge + zipline + wall-run
    if (hasAbyss) {
      const bridgeLane = (chunkIdx + 1) % laneCount;
      const bridgeX = this.getLaneX(bridgeLane);
      const bridgeGrp = new THREE.Group();
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(2.9, 0.28, 10.6),
        this.textures.darkMetalMat,
      );
      const glowCenter = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.32, 10.6),
        this.textures.neonTrimMat,
      );
      for (const sx of [-1.4, 1.4]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.55, 10.6),
          this.textures.secTrimMat,
        );
        rail.position.set(sx, 0.25, 0);
        bridgeGrp.add(rail);
      }
      bridgeGrp.add(deck, glowCenter);
      bridgeGrp.position.set(bridgeX, 0.08, -28);
      group.add(bridgeGrp);

      obstacles.push({
        id: this.obstacleSeq++,
        kind: 'retractBridge',
        mesh: bridgeGrp,
        lane: bridgeLane,
        baseX: bridgeX,
        baseY: 0.08,
        groundY: 0,
        x: bridgeX,
        y: 0.08,
        z: zStart - 28,
        width: 2.9,
        height: 0.32,
        length: 10.6,
        speedZ: 0,
        phase: chunkIdx,
        hit: false,
        interacted: false,
      });

      for (let l = 0; l < laneCount; l++) {
        if (l === bridgeLane) {
          reservations.push({
            lane: l,
            zMin: -33.3,
            zMax: -22.7,
            topY: 0.25,
            walkableRoof: true,
            slideUnder: false,
            impassableGround: false,
          });
        } else {
          reservations.push({
            lane: l,
            zMin: -33.0,
            zMax: -23.0,
            topY: -10,
            walkableRoof: false,
            slideUnder: false,
            impassableGround: true,
          });
        }
      }

      for (let i = 0; i < 3; i++) {
        parkourTrail.push({
          x: bridgeX,
          y: 1.1,
          zLocal: -25 - i * 3,
          kind: i === 2 ? 'gem' : 'coin',
        });
      }

      const poleX = wallOff - 0.05;
      for (const gz of [-17, -39]) {
        const archL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.5, 0.35), this.gantryMat);
        archL.position.set(-poleX, 2.75, gz);
        const archR = archL.clone();
        archR.position.x = poleX;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(poleX * 2 + 0.4, 0.3, 0.35), this.gantryMat);
        beam.position.set(0, 5.35, gz);
        group.add(archL, archR, beam);
      }

      const zipX = this.getLaneX(centerLane);
      const zipMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 22, 8),
        this.textures.secTrimMat,
      );
      zipMesh.rotation.x = Math.PI / 2;
      zipMesh.position.set(zipX, 5.1, -28);
      group.add(zipMesh);
      obstacles.push({
        id: this.obstacleSeq++,
        kind: 'zipline',
        mesh: zipMesh,
        lane: centerLane,
        baseX: zipX,
        baseY: 5.1,
        groundY: 0,
        x: zipX,
        y: 5.1,
        z: zStart - 28,
        width: 2.6,
        height: 1.5,
        length: 22,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });
    }

    // Magnetic Wall-Run Panels (sidewalk-mounted, never block lane ground)
    if (pattern === 1 || pattern === 4 || this.mode === 'parkour' || hasAbyss) {
      const side = pattern % 2 === 0 ? -1 : 1;
      const wallZ = -CHUNK_LEN * 0.5;
      const wallGy = this.getRoadElevationY(zStart + wallZ);
      const wallMesh = new THREE.Mesh(this.magWallGeo, this.textures.magWallMat);
      const wx = side * wallOff;
      wallMesh.position.set(wx, wallGy + 2.4, wallZ);
      group.add(wallMesh);

      obstacles.push({
        id: this.obstacleSeq++,
        kind: side < 0 ? 'wallLeft' : 'wallRight',
        mesh: wallMesh,
        lane: side < 0 ? 0 : laneCount - 1,
        baseX: wx,
        baseY: 2.4,
        groundY: wallGy,
        x: wx,
        y: wallGy + 2.4,
        z: zStart + wallZ,
        width: 0.6,
        height: 4.2,
        length: 22,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });

      for (let i = 0; i < 4; i++) {
        const cz = zStart - 19 - i * 4.2;
        this.spawnCollectible(
          i === 3 ? 'gem' : 'coin',
          side * (wallOff - 0.75),
          this.getRoadElevationY(cz) + 2.55,
          cz,
          group,
          collectibles,
          obstacles,
          enemies,
        );
      }
    }

    if (!hasAbyss && this.mode !== 'parkour') {
      if (pattern === 0 || pattern === 3) {
        // Contextual Railway Corridor + Train + Flush Climb Ramp
        const trainLane = Math.floor(Math.random() * laneCount);
        const isMoving =
          this.activeDynamicEvent === 'express_train' || Math.random() < 0.44;
        const isCargo =
          (this.district.id === 'industrial' || this.district.id === 'cyber_port') &&
          !isMoving;
        const tx = this.getLaneX(trainLane);
        const tzLocal = -30;
        const gy = this.getRoadElevationY(zStart + tzLocal);

        const railStrip = new THREE.Mesh(
          new THREE.PlaneGeometry(2.8, 34),
          this.textures.railBedMat,
        );
        railStrip.rotation.x = -Math.PI / 2;
        railStrip.position.set(tx, gy + 0.03, tzLocal);
        group.add(railStrip);

        const crossGate = buildRailCrossingBarrier(
          trainLane < centerLane ? -1 : 1,
          this.textures,
        );
        crossGate.position.set(tx > 0 ? wallOff - 1.2 : -(wallOff - 1.2), this.getRoadElevationY(zStart - 10), -10);
        group.add(crossGate);

        const train = buildCyberTrainModel(
          this.district.colors.primaryNeon,
          this.district.colors.secondaryNeon,
          16,
          isCargo,
        );
        train.position.set(tx, gy, tzLocal);
        group.add(train);

        obstacles.push({
          id: this.obstacleSeq++,
          kind: isMoving ? 'movingTrain' : isCargo ? 'cargoTrain' : 'train',
          mesh: train,
          lane: trainLane,
          baseX: tx,
          baseY: 1.55,
          groundY: gy,
          x: tx,
          y: gy + 1.55,
          z: zStart + tzLocal,
          width: 2.45,
          height: 3.1,
          length: 16,
          speedZ: isMoving ? (this.activeDynamicEvent === 'express_train' ? 20 : 14) : 0,
          phase: 0,
          hit: false,
          interacted: false,
        });

        reservations.push({
          lane: trainLane,
          zMin: isMoving ? -42 : -38,
          zMax: isMoving ? -8 : -22,
          topY: 3.15,
          walkableRoof: !isMoving,
          slideUnder: false,
          impassableGround: true,
        });

        if (!isMoving) {
          const rampGy = this.getRoadElevationY(zStart - 19.0);
          const ramp = this.buildFlushRampMesh(2.35, 6.0, 3.12);
          ramp.position.set(tx, rampGy + 1.56, -19.0);
          group.add(ramp);
          obstacles.push({
            id: this.obstacleSeq++,
            kind: 'climbRamp',
            mesh: ramp,
            lane: trainLane,
            baseX: tx,
            baseY: 1.56,
            groundY: rampGy,
            x: tx,
            y: rampGy + 1.56,
            z: zStart - 19.0,
            width: 2.35,
            height: 3.15,
            length: 6.0,
            speedZ: 0,
            phase: 0,
            hit: false,
            interacted: false,
          });

          reservations.push({
            lane: trainLane,
            zMin: -22.0,
            zMax: -16.0,
            topY: 3.15,
            walkableRoof: true,
            slideUnder: false,
            impassableGround: false,
          });

          parkourTrail.push(
            { x: tx, y: 1.35, zLocal: -16.8, kind: 'coin' },
            { x: tx, y: 2.65, zLocal: -19.5, kind: 'coin' },
            { x: tx, y: 3.95, zLocal: -23.0, kind: 'coin' },
            { x: tx, y: 4.05, zLocal: -27.5, kind: 'coin' },
            { x: tx, y: 4.05, zLocal: -32.0, kind: 'coin' },
            { x: tx, y: 4.15, zLocal: -36.0, kind: 'gem' },
          );
        }

        const otherLane = (trainLane + 1) % laneCount;
        this.spawnCityHazard(otherLane, -24, zStart, group, obstacles, reservations);
        if (laneCount === 5) {
          this.spawnCityHazard((trainLane + 3) % laneCount, -36, zStart, group, obstacles, reservations);
        }
      } else if (pattern === 2) {
        const zipLane = centerLane;
        const zipX = this.getLaneX(zipLane);
        const zipGy = this.getRoadElevationY(zStart - 28);
        const poleX = wallOff - 0.05;
        for (const gz of [-13, -43]) {
          const gzY = this.getRoadElevationY(zStart + gz);
          const poleL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 5.5, 0.36), this.gantryMat);
          poleL.position.set(-poleX, gzY + 2.75, gz);
          const poleR = poleL.clone();
          poleR.position.x = poleX;
          const topBeam = new THREE.Mesh(new THREE.BoxGeometry(poleX * 2 + 0.4, 0.32, 0.36), this.gantryMat);
          topBeam.position.set(0, gzY + 5.35, gz);
          group.add(poleL, poleR, topBeam);
        }
        const cable = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.065, 30, 8),
          this.textures.neonTrimMat,
        );
        cable.rotation.x = Math.PI / 2;
        cable.position.set(zipX, zipGy + 5.1, -28);
        group.add(cable);

        obstacles.push({
          id: this.obstacleSeq++,
          kind: 'zipline',
          mesh: cable,
          lane: zipLane,
          baseX: zipX,
          baseY: 5.1,
          groundY: zipGy,
          x: zipX,
          y: zipGy + 5.1,
          z: zStart - 28,
          width: 2.6,
          height: 1.5,
          length: 30,
          speedZ: 0,
          phase: 0,
          hit: false,
          interacted: false,
        });

        this.spawnCityHazard(0, -28, zStart, group, obstacles, reservations);
        this.spawnBarrier('highGate', centerLane, -28, zStart, group, obstacles, reservations);
        this.spawnCityHazard(laneCount - 1, -28, zStart, group, obstacles, reservations);
      } else if (pattern === 5) {
        const gGy = this.getRoadElevationY(zStart - 24);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.15, 0.14, 10, 22),
          this.textures.neonTrimMat,
        );
        ring.position.set(0, gGy + 5.6, -24);
        group.add(ring);

        obstacles.push({
          id: this.obstacleSeq++,
          kind: 'grappleAnchor',
          mesh: ring,
          lane: -1,
          baseX: 0,
          baseY: 5.6,
          groundY: gGy,
          x: 0,
          y: gGy + 5.6,
          z: zStart - 24,
          width: roadW,
          height: 4,
          length: 8,
          speedZ: 0,
          phase: 0,
          hit: false,
          interacted: false,
        });

        this.spawnCityHazard(0, -28, zStart, group, obstacles, reservations);
        this.spawnBarrier('lowBarrier', centerLane, -28, zStart, group, obstacles, reservations);

        if (Math.random() < 0.52) {
          const vid = this.save.selectedVehicleId ?? 'hover_bike';
          const vDef = getVehicleById(vid);
          const vPaint = this.save.vehiclePaints?.[vid] || vDef.defaultPaint;
          const bLane = laneCount - 1;
          const bX = this.getLaneX(bLane);
          const bGy = this.getRoadElevationY(zStart - 44);
          const bikePickup = buildHoverBikePickupModel(
            this.district.colors.primaryNeon,
            vid,
            vPaint,
          );
          bikePickup.position.set(bX, bGy + 1.15, -44);
          group.add(bikePickup);
          obstacles.push({
            id: this.obstacleSeq++,
            kind: 'hoverBikePickup',
            mesh: bikePickup,
            lane: bLane,
            baseX: bX,
            baseY: 1.15,
            groundY: bGy,
            x: bX,
            y: bGy + 1.15,
            z: zStart - 44,
            width: 1.8,
            height: 1.8,
            length: 2.0,
            speedZ: 0,
            phase: 0,
            hit: false,
            interacted: false,
          });
          reservations.push({
            lane: bLane,
            zMin: -46,
            zMax: -42,
            topY: 1.8,
            walkableRoof: false,
            slideUnder: false,
            impassableGround: false,
          });
        }
      } else if (pattern === 6 || this.activeDynamicEvent === 'sky_bridge') {
        const bridgeLane = centerLane;
        const bridgeX = this.getLaneX(bridgeLane);
        const deckGy = this.getRoadElevationY(zStart - 30);
        const deckGrp = new THREE.Group();
        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.3, 20),
          this.textures.walkMat,
        );
        const railL = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.36, 20),
          this.textures.neonTrimMat,
        );
        railL.position.set(-1.55, 0.18, 0);
        const railR = railL.clone();
        railR.position.x = 1.55;
        deckGrp.add(deck, railL, railR);
        deckGrp.position.set(bridgeX, deckGy + 3.1, -30);
        group.add(deckGrp);

        obstacles.push({
          id: this.obstacleSeq++,
          kind: 'skyBridge',
          mesh: deckGrp,
          lane: bridgeLane,
          baseX: bridgeX,
          baseY: 3.1,
          groundY: deckGy,
          x: bridgeX,
          y: deckGy + 3.1,
          z: zStart - 30,
          width: 3.2,
          height: 3.25,
          length: 20,
          speedZ: 0,
          phase: chunkIdx,
          hit: false,
          interacted: false,
        });

        reservations.push({
          lane: bridgeLane,
          zMin: -40,
          zMax: -20,
          topY: 3.25,
          walkableRoof: true,
          slideUnder: true,
          impassableGround: false,
        });

        const rampGy = this.getRoadElevationY(zStart - 17.0);
        const ramp = this.buildFlushRampMesh(2.6, 6.0, 3.15);
        ramp.position.set(bridgeX, rampGy + 1.57, -17.0);
        group.add(ramp);
        obstacles.push({
          id: this.obstacleSeq++,
          kind: 'climbRamp',
          mesh: ramp,
          lane: bridgeLane,
          baseX: bridgeX,
          baseY: 1.57,
          groundY: rampGy,
          x: bridgeX,
          y: rampGy + 1.57,
          z: zStart - 17.0,
          width: 2.6,
          height: 3.2,
          length: 6.0,
          speedZ: 0,
          phase: 0,
          hit: false,
          interacted: false,
        });

        reservations.push({
          lane: bridgeLane,
          zMin: -20.0,
          zMax: -14.0,
          topY: 3.25,
          walkableRoof: true,
          slideUnder: false,
          impassableGround: false,
        });

        const carLane = Math.random() < 0.5 ? 0 : laneCount - 1;
        const carX = this.getLaneX(carLane);
        const carGy = this.getRoadElevationY(zStart - 28);
        const useMilkTruck =
          (this.district.id === 'downtown' || this.district.id === 'oldcity' || this.district.id === 'beach' || this.district.id === 'cyber_port') &&
          Math.random() < 0.45;

        if (useMilkTruck) {
          const truck = buildTrafficTruckObstacle(
            this.district.colors.primaryNeon,
            this.district.colors.secondaryNeon,
          );
          truck.position.set(carX, carGy, -28);
          group.add(truck);
          obstacles.push({
            id: this.obstacleSeq++,
            kind: 'milkTruck',
            mesh: truck,
            lane: carLane,
            baseX: carX,
            baseY: 1.0,
            groundY: carGy,
            x: carX,
            y: carGy + 1.0,
            z: zStart - 28,
            width: 2.15,
            height: 2.05,
            length: 4.5,
            speedZ: 0,
            phase: 0,
            hit: false,
            interacted: false,
          });
          reservations.push({
            lane: carLane,
            zMin: -30.7,
            zMax: -25.3,
            topY: 2.05,
            walkableRoof: false,
            slideUnder: false,
            impassableGround: true,
          });
        } else {
          const car = buildHoverCarModel(this.district.colors.secondaryNeon);
          car.position.set(carX, carGy, -28);
          group.add(car);
          obstacles.push({
            id: this.obstacleSeq++,
            kind: 'hoverCar',
            mesh: car,
            lane: carLane,
            baseX: carX,
            baseY: 0.7,
            groundY: carGy,
            x: carX,
            y: carGy + 0.7,
            z: zStart - 28,
            width: 2.1,
            height: 1.5,
            length: 4.3,
            speedZ: 0,
            phase: 0,
            hit: false,
            interacted: false,
          });
          reservations.push({
            lane: carLane,
            zMin: -30.5,
            zMax: -25.5,
            topY: 1.5,
            walkableRoof: false,
            slideUnder: false,
            impassableGround: true,
          });
        }

        parkourTrail.push(
          { x: bridgeX, y: 1.45, zLocal: -15.0, kind: 'coin' },
          { x: bridgeX, y: 2.85, zLocal: -18.2, kind: 'coin' },
          { x: bridgeX, y: 4.1, zLocal: -22.5, kind: 'gem' },
          { x: bridgeX, y: 4.1, zLocal: -27.5, kind: 'gem' },
          { x: bridgeX, y: 4.1, zLocal: -32.5, kind: 'gem' },
          { x: bridgeX, y: 4.2, zLocal: -37.5, kind: 'secret' },
        );
      } else {
        // City-themed composite hazards & verified clear powerup (§17.4: halved shield drops!)
        const l1 = chunkIdx % laneCount;
        const l2 = (l1 + 1) % laneCount;
        this.spawnCityHazard(l1, -18, zStart, group, obstacles, reservations);
        this.spawnCityHazard(l2, -36, zStart, group, obstacles, reservations);
        if (laneCount === 5) {
          this.spawnCityHazard((l1 + 3) % laneCount, -24, zStart, group, obstacles, reservations);
        }

        const pLane = (l2 + 1) % laneCount;
        if (this.isLaneZoneClear(reservations, pLane, -28, 1.5, 2.0)) {
          const roll = Math.random();
          const talismanChance =
            this.activeDynamicEvent === 'talisman_signal' ? 0.34 : 0.07;
          // Reduce shield availability ~50%, and suppress while already shielded or on cooldown
          const shieldCutoff =
            this.hasShield || this.shieldCooldown > 0
              ? talismanChance + 0.04
              : talismanChance + 0.13;
          const kind =
            roll < talismanChance
              ? 'talisman'
              : roll < shieldCutoff
                ? 'shield'
                : roll < 0.56
                  ? 'magnet'
                  : roll < 0.82
                    ? 'slowmo'
                    : 'secret';
          const pWorldZ = zStart - 28;
          const pGy = this.getRoadElevationY(pWorldZ);
          this.spawnCollectible(
            kind,
            this.getLaneX(pLane),
            pGy + (kind === 'secret' ? 2.45 : 1.05),
            pWorldZ,
            group,
            collectibles,
            obstacles,
            enemies,
          );
          reservations.push({
            lane: pLane,
            zMin: -30,
            zMax: -26,
            topY: 2.0,
            walkableRoof: false,
            slideUnder: false,
            impassableGround: false,
          });
        }
      }
    }

    // Spawn District Signature Enemies ONLY in verified non-overlapping slots
    this.spawnChunkEnemies(chunkIdx, zStart, group, enemies, reservations, hasAbyss);

    // Spawn Parkour / Bridge Collectible Trails (strictly elevated above groundY)
    for (const pt of parkourTrail) {
      const wZ = zStart + pt.zLocal;
      const gy = this.getRoadElevationY(wZ);
      this.spawnCollectible(
        pt.kind,
        pt.x,
        gy + pt.y,
        wZ,
        group,
        collectibles,
        obstacles,
        enemies,
      );
    }

    // Smart Ground Coin Ribbon (Strict zero-overlap against traps, ramps, abyss & enemies!)
    const coinZCandidates = [
      [-6.5, -10.0, -13.5, -17.0],
      [-40.5, -44.0, -47.5, -51.0],
    ];
    let groundRibbonPlaced = false;
    const laneOrder = Array.from({ length: laneCount }, (_, i) => (chunkIdx + 2 + i) % laneCount);

    for (const zPts of coinZCandidates) {
      if (groundRibbonPlaced) break;
      for (const cLane of laneOrder) {
        const allClear = zPts.every((zl) => {
          const hitEnemy = enemies.some(
            (e) => e.baseLane === cLane && Math.abs(e.z - (zStart + zl)) < 4.5,
          );
          if (hitEnemy) return false;
          const surf = this.findSurfaceAt(reservations, cLane, zl);
          return surf === null;
        });
        if (allClear) {
          for (const zl of zPts) {
            const wZ = zStart + zl;
            this.spawnCollectible(
              'coin',
              this.getLaneX(cLane),
              this.getRoadElevationY(wZ) + 0.95,
              wZ,
              group,
              collectibles,
              obstacles,
              enemies,
            );
          }
          groundRibbonPlaced = true;
          break;
        }
      }
    }

    // Fallback: individual verified-safe coins in open spots
    if (!groundRibbonPlaced) {
      for (const zl of [-7, -11, -43, -47]) {
        for (const cLane of laneOrder) {
          const hitEnemy = enemies.some(
            (e) => e.baseLane === cLane && Math.abs(e.z - (zStart + zl)) < 4.5,
          );
          if (hitEnemy) continue;
          const surf = this.findSurfaceAt(reservations, cLane, zl);
          if (surf === null) {
            const wZ = zStart + zl;
            this.spawnCollectible(
              'coin',
              this.getLaneX(cLane),
              this.getRoadElevationY(wZ) + 0.95,
              wZ,
              group,
              collectibles,
              obstacles,
              enemies,
            );
            break;
          }
        }
      }
    }
  }

  private spawnCityHazard(
    lane: number,
    zLocal: number,
    zStart: number,
    group: THREE.Group,
    obstacles: ObstacleEntity[],
    reservations: TrackReservation[],
  ): void {
    const d = this.district.id;
    const roll = Math.random();
    let kind: ObstacleKind = 'lowBarrier';

    if (d === 'industrial' || d === 'cyber_port') {
      kind =
        roll < 0.28
          ? 'containerStack'
          : roll < 0.56
            ? 'steamPipe'
            : roll < 0.8
              ? 'turbineHazard'
              : 'maintBot';
    } else if (d === 'underground' || d === 'obsidian_citadel') {
      kind =
        roll < 0.34
          ? 'laserGrid'
          : roll < 0.66
            ? 'blastDoor'
            : 'maintBot';
    } else if (d === 'future' || d === 'crimson_metropolis') {
      kind =
        roll < 0.34
          ? 'laserGrid'
          : roll < 0.66
            ? 'electricFloor'
            : 'movingBarrier';
    } else if (d === 'beach') {
      kind =
        roll < 0.35
          ? 'floodZone'
          : roll < 0.6
            ? 'milkTruck'
            : roll < 0.82
              ? 'movingBarrier'
              : 'lowBarrier';
    } else if (d === 'oldcity') {
      kind =
        roll < 0.32
          ? 'scaffolding'
          : roll < 0.6
            ? 'rubble'
            : roll < 0.8
              ? 'milkTruck'
              : 'lowBarrier';
    } else {
      kind =
        roll < 0.32
          ? 'lowBarrier'
          : roll < 0.62
            ? 'highGate'
            : roll < 0.82
              ? 'milkTruck'
              : 'movingBarrier';
    }

    if (kind === 'lowBarrier' || kind === 'highGate') {
      this.spawnBarrier(kind, lane, zLocal, zStart, group, obstacles, reservations);
      return;
    }

    const gy = this.getRoadElevationY(zStart + zLocal);

    if (kind === 'milkTruck') {
      const tx = this.getLaneX(lane);
      const truck = buildTrafficTruckObstacle(
        this.district.colors.primaryNeon,
        this.district.colors.secondaryNeon,
      );
      truck.position.set(tx, gy, zLocal);
      group.add(truck);
      obstacles.push({
        id: this.obstacleSeq++,
        kind: 'milkTruck',
        mesh: truck,
        lane,
        baseX: tx,
        baseY: 1.0,
        groundY: gy,
        x: tx,
        y: gy + 1.0,
        z: zStart + zLocal,
        width: 2.15,
        height: 2.05,
        length: 4.5,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });
      reservations.push({
        lane,
        zMin: zLocal - 2.6,
        zMax: zLocal + 2.6,
        topY: 2.05,
        walkableRoof: false,
        slideUnder: false,
        impassableGround: true,
      });
      return;
    }

    const laneCount = this.getLaneCount();
    const effectiveLane = kind === 'movingBarrier' ? this.getCenterLane() : lane;
    const x = kind === 'movingBarrier' ? 0 : this.getLaneX(effectiveLane);

    const mesh = buildCityObstacleModel(kind as Parameters<typeof buildCityObstacleModel>[0], this.textures);
    mesh.position.set(x, gy, zLocal);
    group.add(mesh);

    const dims: Record<string, { w: number; h: number; l: number }> = {
      laserGrid: { w: 2.3, h: 2.5, l: 0.7 },
      blastDoor: { w: 2.3, h: 2.6, l: 0.7 },
      movingBarrier: { w: 2.4, h: 1.1, l: 0.7 },
      containerStack: { w: 2.5, h: 2.3, l: 5.2 },
      steamPipe: { w: 2.4, h: 2.2, l: 0.9 },
      scaffolding: { w: 2.3, h: 2.5, l: 1.2 },
      electricFloor: { w: 2.6, h: 0.45, l: 3.8 },
      floodZone: { w: 3.0, h: 0.35, l: 5.5 },
      rubble: { w: 1.9, h: 0.95, l: 1.4 },
      maintBot: { w: 1.3, h: 1.35, l: 1.2 },
      turbineHazard: { w: 2.3, h: 2.5, l: 0.7 },
    };
    const dim = dims[kind] ?? { w: 2.2, h: 1.2, l: 1.0 };

    obstacles.push({
      id: this.obstacleSeq++,
      kind,
      mesh,
      lane: effectiveLane,
      baseX: x,
      prevX: x,
      baseY: 0,
      groundY: gy,
      x,
      y: gy + dim.h * 0.5,
      z: zStart + zLocal,
      width: dim.w,
      height: dim.h,
      length: dim.l,
      speedZ: 0,
      phase: Math.random() * Math.PI * 2,
      hit: false,
      interacted: false,
    });

    const isSlideUnder =
      kind === 'steamPipe' || kind === 'scaffolding' || kind === 'turbineHazard';
    const isWalkRoof = kind === 'containerStack';
    if (kind === 'movingBarrier') {
      for (let l = 0; l < laneCount; l++) {
        reservations.push({
          lane: l,
          zMin: zLocal - dim.l * 0.5 - 0.5,
          zMax: zLocal + dim.l * 0.5 + 0.5,
          topY: dim.h,
          walkableRoof: false,
          slideUnder: false,
          impassableGround: false,
        });
      }
    } else {
      reservations.push({
        lane: effectiveLane,
        zMin: zLocal - dim.l * 0.5,
        zMax: zLocal + dim.l * 0.5,
        topY: dim.h,
        walkableRoof: isWalkRoof,
        slideUnder: isSlideUnder,
        impassableGround: !isSlideUnder && kind !== 'floodZone',
      });
    }
  }

  private spawnChunkEnemies(
    chunkIdx: number,
    zStart: number,
    group: THREE.Group,
    enemies: EnemyEntity[],
    reservations: TrackReservation[],
    hasAbyss: boolean,
  ): void {
    const laneCount = this.getLaneCount();
    const evt = this.activeEventId
      ? LIVE_EVENTS.find((e) => e.id === this.activeEventId)
      : null;
    const densityScale =
      this.settings.objectDensity === 'low'
        ? 0.7
        : this.settings.objectDensity === 'medium'
          ? 0.85
          : 1.0;
    const stageMult = 0.88 + this.difficultyStage * 0.08;
    const spawnChance =
      (this.activeDynamicEvent === 'drone_pursuit' ? 0.92 : 0.64) *
      stageMult *
      (evt ? evt.droneIntensity : 1.0) *
      densityScale;

    if (Math.random() > spawnChance) return;

    const pool = this.district.signatureEnemies;
    const allClasses: EnemyClass[] = [
      'scout',
      'pursuit',
      'armored',
      'surveillance',
      'swarm',
      'ground_bot',
      'security_bot',
      'intervention',
      'tactical',
      'elite',
    ];
    let pick =
      Math.random() < 0.72
        ? pool[chunkIdx % pool.length]
        : allClasses[chunkIdx % allClasses.length];
    if (pick === 'elite' && Math.random() > 0.38) pick = 'tactical';
    if (this.activeDynamicEvent === 'drone_pursuit' && Math.random() < 0.45) {
      pick = 'pursuit';
    }

    const isGround = pick === 'ground_bot' || pick === 'security_bot';
    const isMovingFwd = pick === 'pursuit' || pick === 'intervention';
    const candidateZs = isGround && hasAbyss ? [-44, -14] : [-42, -38, -14];
    const startLane = (chunkIdx + Math.floor(Math.random() * laneCount)) % laneCount;
    const laneOrder = Array.from({ length: laneCount }, (_, i) => (startLane + i) % laneCount);

    let chosenLane = -1;
    let chosenZ = -38;

    for (const cz of candidateZs) {
      if (chosenLane !== -1) break;
      for (const cl of laneOrder) {
        if (hasAbyss && cz > -35 && cz < -21) continue;
        if (!this.isLaneZoneClear(reservations, cl, cz, 2.2, 2.8)) continue;
        if (isMovingFwd && !this.isLaneZoneClear(reservations, cl, cz + 7, 7, 1.5)) {
          continue;
        }
        const testRes: TrackReservation[] = [
          ...reservations,
          {
            lane: cl,
            zMin: cz - 2.5,
            zMax: cz + (isMovingFwd ? 12 : 2.5),
            topY: 2.5,
            walkableRoof: false,
            slideUnder: false,
            impassableGround: true,
          },
        ];
        if (!this.hasOpenLaneInBand(testRes, cz - 3, cz + 3)) continue;
        chosenLane = cl;
        chosenZ = cz;
        break;
      }
    }

    if (chosenLane === -1) return;

    const gy = this.getRoadElevationY(zStart + chosenZ);
    const yPos = isGround
      ? 0.0
      : pick === 'armored'
        ? 2.45
        : pick === 'scout' || pick === 'surveillance'
          ? 2.1
          : 1.25;
    const mesh = buildEnemyModel(pick);
    const ex = this.getLaneX(chosenLane);
    mesh.position.set(ex, gy + yPos, chosenZ);
    group.add(mesh);

    // Balanced speed proportional to difficulty (§15.1)
    const balancedFwdSpeed = isMovingFwd
      ? Math.min(this.forwardSpeed * 0.34, 6.5 + this.difficultyStage * 0.7)
      : 0;

    enemies.push({
      id: this.obstacleSeq++,
      enemyClass: pick,
      mesh,
      x: ex,
      y: gy + yPos,
      groundY: gy,
      z: zStart + chosenZ,
      baseLane: chosenLane,
      speedZ: balancedFwdSpeed,
      phase: Math.random() * Math.PI * 2,
      shiftTimer: 1.4,
      evaded: false,
      disabled: false,
    });
  }

  private spawnBarrier(
    kind: 'lowBarrier' | 'highGate',
    lane: number,
    zLocal: number,
    zStart: number,
    group: THREE.Group,
    obstacles: ObstacleEntity[],
    reservations?: TrackReservation[],
  ): void {
    const x = this.getLaneX(lane);
    const gy = this.getRoadElevationY(zStart + zLocal);
    const barGroup = new THREE.Group();

    if (kind === 'lowBarrier') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.85, 0.55),
        this.barrierFrameMat,
      );
      base.position.y = 0.45;
      base.castShadow = true;
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 0.2, 0.6),
        this.textures.secTrimMat,
      );
      strip.position.y = 0.94;
      barGroup.add(base, strip);
      barGroup.position.set(x, gy, zLocal);
      group.add(barGroup);

      obstacles.push({
        id: this.obstacleSeq++,
        kind,
        mesh: barGroup,
        lane,
        baseX: x,
        baseY: 0.55,
        groundY: gy,
        x,
        y: gy + 0.55,
        z: zStart + zLocal,
        width: 2.3,
        height: 1.08,
        length: 0.8,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });

      reservations?.push({
        lane,
        zMin: zLocal - 0.6,
        zMax: zLocal + 0.6,
        topY: 1.08,
        walkableRoof: false,
        slideUnder: false,
        impassableGround: true,
      });
    } else {
      const legL = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 2.7, 0.35),
        this.barrierFrameMat,
      );
      legL.position.set(-1.15, 1.35, 0);
      const legR = legL.clone();
      legR.position.set(1.15, 1.35, 0);
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.1, 0.45),
        this.barrierFrameMat,
      );
      topBar.position.set(0, 2.15, 0);
      const laserBeam = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.16, 0.5),
        this.textures.secTrimMat,
      );
      laserBeam.position.set(0, 1.5, 0);
      barGroup.add(legL, legR, topBar, laserBeam);
      barGroup.position.set(x, gy, zLocal);
      group.add(barGroup);

      obstacles.push({
        id: this.obstacleSeq++,
        kind,
        mesh: barGroup,
        lane,
        baseX: x,
        baseY: 1.9,
        groundY: gy,
        x,
        y: gy + 1.9,
        z: zStart + zLocal,
        width: 2.3,
        height: 1.45,
        length: 0.8,
        speedZ: 0,
        phase: 0,
        hit: false,
        interacted: false,
      });

      reservations?.push({
        lane,
        zMin: zLocal - 0.6,
        zMax: zLocal + 0.6,
        topY: 2.7,
        walkableRoof: false,
        slideUnder: true,
        impassableGround: false,
      });
    }
  }

  private spawnCollectible(
    kind: CollectibleEntity['kind'],
    x: number,
    y: number,
    worldZ: number,
    group: THREE.Group,
    list: CollectibleEntity[],
    obstacles?: ObstacleEntity[],
    enemies?: EnemyEntity[],
  ): void {
    let finalY = y;

    // Zero-overlap safety check against solid obstacles/traps and enemies
    if (obstacles) {
      for (const ob of obstacles) {
        if (
          ob.kind === 'wallLeft' ||
          ob.kind === 'wallRight' ||
          ob.kind === 'climbRamp' ||
          ob.kind === 'skyBridge' ||
          ob.kind === 'retractBridge' ||
          ob.kind === 'zipline' ||
          ob.kind === 'grappleAnchor' ||
          ob.kind === 'floor2Deck' ||
          ob.kind === 'swingBar' ||
          ob.kind === 'jumpPad' ||
          ob.kind === 'balanceBeam' ||
          ob.kind === 'highConduit' ||
          ob.kind === 'sectorGate'
        ) {
          continue;
        }
        if (
          Math.abs(x - ob.x) < ob.width * 0.55 + 0.45 &&
          Math.abs(worldZ - ob.z) < ob.length * 0.55 + 0.5
        ) {
          const obTopWorld = ob.groundY + ob.height;
          if (finalY < obTopWorld + 0.6) {
            if (kind === 'coin' && obTopWorld > ob.groundY + 2.1) {
              return;
            }
            finalY = obTopWorld + 0.85;
          }
        }
      }
    }
    if (enemies) {
      for (const e of enemies) {
        if (Math.abs(x - e.x) < 1.3 && Math.abs(worldZ - e.z) < 1.6) {
          return;
        }
      }
    }

    const localZ = worldZ - group.position.z;
    const mesh = buildCollectibleModel(kind, this.collectiblePool);
    mesh.position.set(x, finalY, localZ);
    group.add(mesh);

    list.push({
      kind,
      mesh,
      x,
      y: finalY,
      z: worldZ,
      collected: false,
      attracted: false,
    });
  }

  // ---- Input ----
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    audioEngine.unlock();
    this.heldKeys.add(e.code);
    this.justPressed.add(e.code);

    if (e.code === this.settings.keybindings.pause) {
      if (this.phase === 'playing') this.setPaused(true);
      else if (this.phase === 'paused') this.setPaused(false);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onBlur = () => {
    this.heldKeys.clear();
    this.justPressed.clear();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.settings.reduceCameraMotion) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    const multX = this.settings.invertX ? -1 : 1;
    const multY = this.settings.invertY ? -1 : 1;
    this.mouseOffsetX = nx * 1.25 * this.settings.cameraSensitivity * multX;
    this.mouseOffsetY = ny * 0.55 * this.settings.cameraSensitivity * multY;
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloomPass) this.bloomPass.resolution.set(w, h);
    this.applyPixelRatioAndResolution();
  };

  private bindInputs(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('resize', this.onResize);
  }

  private pollGamepad(): void {
    if (!this.settings.gamepadEnabled) return;
    const pads = navigator.getGamepads?.();
    if (!pads || !pads[0]) return;
    const pad = pads[0];
    const btns = pad.buttons.map((b) => b.pressed);
    const justBtn = (idx: number) => btns[idx] && !this.prevGamepadButtons[idx];

    if (justBtn(0)) this.justPressed.add(this.settings.keybindings.jump);
    if (justBtn(1)) this.justPressed.add(this.settings.keybindings.slide);
    if (justBtn(2)) this.justPressed.add(this.settings.keybindings.interact);
    if (justBtn(3)) this.justPressed.add(this.settings.keybindings.ability);
    if (justBtn(14) || (pad.axes[0] < -0.65 && !this.prevGamepadButtons[98])) {
      this.justPressed.add(this.settings.keybindings.left);
    }
    if (justBtn(15) || (pad.axes[0] > 0.65 && !this.prevGamepadButtons[99])) {
      this.justPressed.add(this.settings.keybindings.right);
    }
    if (btns[5] || btns[7]) {
      this.heldKeys.add(this.settings.keybindings.sprint);
    }
    if (btns[4] || btns[6]) {
      this.heldKeys.add(this.settings.keybindings.slowMo);
    }

    this.prevGamepadButtons = btns;
    this.prevGamepadButtons[98] = pad.axes[0] < -0.65;
    this.prevGamepadButtons[99] = pad.axes[0] > 0.65;
  }

  private consumePress(code: string, altCodes: string[] = []): boolean {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    for (const alt of altCodes) {
      if (this.justPressed.has(alt)) {
        this.justPressed.delete(alt);
        return true;
      }
    }
    return false;
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    hexColor: number | string,
    spread = 4.5,
  ): void {
    const scale =
      this.settings.visualEffects === 'low'
        ? 0.4
        : this.settings.visualEffects === 'medium'
          ? 0.7
          : 1.0;
    let finalCount = Math.max(2, Math.round(count * scale));
    if (this.settings.reduceVisualEffects) finalCount = Math.min(finalCount, 3);
    let spawned = 0;
    for (let i = 0; i < this.MAX_PARTICLES && spawned < finalCount; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = (Math.random() - 0.5) * spread;
        p.vy = Math.random() * spread * 0.75 + 1.2;
        p.vz = (Math.random() - 0.5) * spread;
        p.maxLife = 0.35 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.color.set(hexColor);
        this.particleMesh.setColorAt(i, p.color);
        spawned++;
      }
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    if (this.settings.fpsLimit > 0 && !this.isSoftwareGl) {
      const minInterval = 1000 / this.settings.fpsLimit;
      if (now - this.lastRenderTime < minInterval - 1) {
        this.frameId = requestAnimationFrame(this.tick);
        return;
      }
    }
    const frameDeltaMs = now - this.lastRenderTime;
    this.lastRenderTime = now;

    if (this.benchmarkResolver) {
      if (frameDeltaMs > 0.5 && frameDeltaMs < 250) {
        this.benchmarkSamples.push(frameDeltaMs);
      }
      if (this.benchmarkSamples.length >= 45) {
        const avg =
          this.benchmarkSamples.reduce((a, b) => a + b, 0) /
          this.benchmarkSamples.length;
        const cb = this.benchmarkResolver;
        this.benchmarkResolver = null;
        cb(Number(avg.toFixed(2)));
      }
    }

    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.avgFrameTimeMs = Number((1000 / Math.max(1, this.currentFps)).toFixed(1));
      this.perfWarning =
        this.currentFps < 28
          ? 'Rendimiento bajo detectado: considera activar FSR o reducir preset gráfico.'
          : null;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.aiFrameParity = (this.aiFrameParity + 1) % 2;
    this.pollGamepad();

    if (this.phase === 'title') {
      this.updateTitleScene(dt);
    } else if (this.phase === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.updateGameplay(dt);
      }
    } else if (this.phase === 'reviving' && this.revivePrompt) {
      this.reviveCountdownTimer = Math.max(0, this.reviveCountdownTimer - dt);
      this.revivePrompt.remainingSeconds = Number(this.reviveCountdownTimer.toFixed(1));
      this.hudEmitReviveAccum += dt;
      if (this.reviveCountdownTimer <= 0) {
        this.declineRevive();
      } else if (this.hudEmitReviveAccum >= 0.1) {
        this.hudEmitReviveAccum = 0;
        this.emitHud('stumble');
      }
    } else if (this.phase === 'gameover') {
      this.updateDefeatScene(dt);
    }

    this.textures.waterTimeUniform.value += dt;
    this.updateParticles(dt);
    this.updateWeatherAndSkyTraffic(dt);

    if (
      this.composer &&
      !this.isSoftwareGl &&
      this.settings.bloom &&
      !this.settings.reduceVisualEffects
    ) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.justPressed.clear();

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateDefeatScene(dt: number): void {
    this.elapsedTotal += dt;
    const hoverY = this.playerY + 2.75 + Math.sin(this.elapsedTotal * 3.4) * 0.14;
    if (this.captureDroneMesh) {
      this.captureDroneMesh.visible = true;
      this.captureDroneMesh.position.set(
        THREE.MathUtils.damp(this.captureDroneMesh.position.x, this.playerX, 6, dt),
        THREE.MathUtils.damp(this.captureDroneMesh.position.y, hoverY, 6, dt),
        THREE.MathUtils.damp(this.captureDroneMesh.position.z, this.playerZ, 6, dt),
      );
      this.captureDroneMesh.rotation.y = Math.sin(this.elapsedTotal * 0.9) * 0.25;
      const rotors = this.captureDroneMesh.userData.rotors as THREE.Object3D[] | undefined;
      if (rotors) {
        for (const r of rotors) r.rotation.y += dt * 24;
      }
    }

    // Struggling suspended runner gripped beneath Capture Drone (§4)
    this.playerRig.root.position.set(
      this.playerX,
      hoverY - 2.15 + Math.sin(this.elapsedTotal * 6.5) * 0.05,
      this.playerZ,
    );
    this.playerRig.root.rotation.y = THREE.MathUtils.damp(
      this.playerRig.root.rotation.y,
      Math.PI * 0.15,
      4,
      dt,
    );
    animateCharacterRig(this.playerRig, 'captureStruggle', this.elapsedTotal, 0, 0, dt);

    // Smooth cinematic camera orbit framing the 3D Capture Drone on the left/center
    const orbitAngle = Math.sin(this.elapsedTotal * 0.45) * 0.45 + 0.35;
    const camX = this.playerX + Math.sin(orbitAngle) * 5.2 - 1.25;
    const camY = hoverY - 0.15 + Math.cos(this.elapsedTotal * 0.6) * 0.25;
    const camZ = this.playerZ + Math.cos(orbitAngle) * 5.2;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 4.5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camY, 4.5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camZ, 4.5, dt);
    this.camera.lookAt(this.playerX - 0.85, hoverY - 1.0, this.playerZ);
    this.playerPointLight.position.set(this.playerX, hoverY + 0.8, this.playerZ + 1.5);
  }

  private updateTitleScene(dt: number): void {
    this.elapsedTotal += dt;
    if (this.hangarGroup) {
      this.hangarGroup.visible = this.showcaseMode !== 'city';
      const turntable = this.hangarGroup.getObjectByName('hangarTurntable');
      if (turntable) turntable.rotation.y += dt * 0.28;
    }
    if (this.companionFox) {
      const petEquipped = this.save.equippedPetId === 'fox_cyber';
      this.companionFox.group.visible = petEquipped && this.showcaseMode === 'title';
      if (petEquipped) {
        this.companionFox.group.position.set(
          -1.85,
          0.02 + Math.abs(Math.sin(this.elapsedTotal * 3.5)) * 0.04,
          0.6,
        );
        this.companionFox.group.rotation.y = Math.PI * 0.85;
        this.companionFox.mixer?.update(dt * 0.5);
      }
    }
    if (this.showcaseMode === 'garage') {
      if (this.vehicleShowcase) {
        this.vehicleShowcase.group.visible = true;
        this.vehicleShowcase.group.rotation.y += dt * 0.65;
      }
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        Math.sin(this.elapsedTotal * 0.3) * 0.65 + 1.8,
        5,
        dt,
      );
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.75, 5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 3.6, 5, dt);
      this.camera.lookAt(0, 0.72, 0);
    } else if (this.showcaseMode === 'characters') {
      if (this.vehicleShowcase) this.vehicleShowcase.group.visible = false;
      const orbitAngle = Math.sin(this.elapsedTotal * 0.55) * 0.55;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        Math.sin(orbitAngle) * 2.5,
        6,
        dt,
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        1.55,
        6,
        dt,
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        2.7,
        6,
        dt,
      );
      this.camera.lookAt(0, 1.05, 0);
    } else if (this.showcaseMode === 'city') {
      if (this.vehicleShowcase) this.vehicleShowcase.group.visible = false;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        Math.sin(this.elapsedTotal * 0.35) * 3.5,
        4,
        dt,
      );
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 7.2, 4, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 9.0, 4, dt);
      this.camera.lookAt(0, 3.0, -32);
    } else if (this.showcaseMode === 'boss') {
      if (this.vehicleShowcase) this.vehicleShowcase.group.visible = false;
      this.bossMesh.visible = true;
      this.bossMesh.position.set(0, 2.5 + Math.sin(this.elapsedTotal * 2) * 0.25, -6.2);
      this.bossMesh.rotation.y = Math.sin(this.elapsedTotal * 0.8) * 0.45;
      this.animateBossMesh(dt, 2);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 1.9, 5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 2.7, 5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 3.1, 5, dt);
      this.camera.lookAt(0, 2.25, -6.2);
    } else {
      if (this.vehicleShowcase) this.vehicleShowcase.group.visible = false;
      const angle = Math.sin(this.elapsedTotal * 0.32) * 0.32;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        Math.sin(angle) * 3.6 - 0.55,
        4,
        dt,
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        2.35 + Math.sin(this.elapsedTotal * 0.55) * 0.14,
        4,
        dt,
      );
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 5.0, 4, dt);
      this.camera.lookAt(-0.4, 1.32, -3.5);
    }
    animateCharacterRig(this.playerRig, 'idle', this.elapsedTotal, 0, 0, dt);
    this.playerPointLight.position.set(0, 2.2, 1.5);
    this.dirLight.position.set(16, 28, 12);
    this.dirLight.target.position.set(0, 0, -10);
  }

  private updateRemoteRunners(dt: number): void {
    for (const rr of this.remoteRunners.values()) {
      rr.mesh.visible = !rr.finished;
      if (!rr.mesh.visible) continue;
      rr.mesh.position.x = THREE.MathUtils.damp(rr.mesh.position.x, rr.targetX, 12, dt);
      rr.mesh.position.y = THREE.MathUtils.damp(rr.mesh.position.y, rr.targetY, 12, dt);
      rr.mesh.position.z = THREE.MathUtils.damp(rr.mesh.position.z, rr.targetZ, 12, dt);
      if (!rr.paused) {
        rr.mesh.position.y += Math.abs(Math.sin(this.elapsedTotal * 12)) * 0.08;
      }
    }
  }

  private advanceTutorialStep(
    trigger: 'lane' | 'jump' | 'slide' | 'coin' | 'power' | 'distance',
  ): void {
    if (this.mode !== 'tutorial' || this.phase !== 'playing') return;

    const advanceTo = (nextStep: number, label: string, target: number) => {
      this.tutorialStepIndex = nextStep;
      this.tutorialStepCount = 0;
      this.tutorialStepProgress = 0;
      this.tutorialStepText = `${label} (0/${target})`;
      audioEngine.playTutorialChime();
      this.showStunt('PASO COMPLETADO!', 1);
    };

    if (this.tutorialStepIndex === 0 && trigger === 'lane') {
      this.tutorialStepCount++;
      this.tutorialStepProgress = Math.min(1, this.tutorialStepCount / 2);
      this.tutorialStepText = `Paso 1/6: Cambia de carril con [A] y [D] (${Math.min(2, this.tutorialStepCount)}/2)`;
      if (this.tutorialStepCount >= 2) {
        advanceTo(1, 'Paso 2/6: Salta o haz Doble Salto con [Espacio]', 2);
      }
    } else if (this.tutorialStepIndex === 1 && trigger === 'jump') {
      this.tutorialStepCount++;
      this.tutorialStepProgress = Math.min(1, this.tutorialStepCount / 2);
      this.tutorialStepText = `Paso 2/6: Salta o haz Doble Salto con [Espacio] (${Math.min(2, this.tutorialStepCount)}/2)`;
      if (this.tutorialStepCount >= 2) {
        advanceTo(2, 'Paso 3/6: Deslízate con [S] o [Ctrl]', 2);
      }
    } else if (this.tutorialStepIndex === 2 && trigger === 'slide') {
      this.tutorialStepCount++;
      this.tutorialStepProgress = Math.min(1, this.tutorialStepCount / 2);
      this.tutorialStepText = `Paso 3/6: Deslízate con [S] o [Ctrl] (${Math.min(2, this.tutorialStepCount)}/2)`;
      if (this.tutorialStepCount >= 2) {
        advanceTo(3, 'Paso 4/6: Recoge 5 monedas en la ruta', 5);
      }
    } else if (this.tutorialStepIndex === 3 && trigger === 'coin') {
      this.tutorialStepCount++;
      this.tutorialStepProgress = Math.min(1, this.tutorialStepCount / 5);
      this.tutorialStepText = `Paso 4/6: Recoge 5 monedas en la ruta (${Math.min(5, this.tutorialStepCount)}/5)`;
      if (this.tutorialStepCount >= 5) {
        advanceTo(4, 'Paso 5/6: Activa Slow-Mo [C] o Habilidad [F]', 1);
      }
    } else if (this.tutorialStepIndex === 4 && trigger === 'power') {
      this.tutorialStepCount = 1;
      this.tutorialStepIndex = 5;
      this.tutorialStepProgress = 0;
      this.targetDistance = Math.floor(this.distance + 120);
      this.tutorialStepText = 'Paso 6/6: ¡Llega a la meta de entrenamiento!';
      audioEngine.playTutorialChime();
      this.showStunt('¡RECTA FINAL!', 2);
    } else if (this.tutorialStepIndex === 5 && trigger === 'distance' && this.targetDistance) {
      const startDist = this.targetDistance - 120;
      this.tutorialStepProgress = THREE.MathUtils.clamp(
        (this.distance - startDist) / 120,
        0,
        1,
      );
    }
  }

  private updateGameplay(dt: number): void {
    this.elapsedTotal += dt;
    this.updateRemoteRunners(dt);

    // Non-blocking individual Multiplayer Pause: local runner freezes while world/opponents keep racing
    if (this.mpPausedOverlay) {
      this.lastAction = 'idle';
      animateCharacterRig(this.playerRig, 'idle', this.elapsedTotal, 0, 0, dt);
      if (this.companionFox) {
        this.companionFox.mixer?.update(dt * 0.4);
      }
      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.05) {
        this.hudEmitAccum = 0;
        this.emitHud('idle');
      }
      return;
    }

    this.runDurationSec += dt;
    const kb = this.settings.keybindings;
    const char = getCharacterById(this.save.selectedCharacterId);
    const vDef = getVehicleById(this.save.selectedVehicleId ?? 'hover_bike');
    const ridingVehicle = this.vehicleTimer > 0;
    const canDoubleJumpInForm = !ridingVehicle || Boolean(vDef.isShip);
    const jumpSkill = this.save.skillLevels['aerial_thrusters'] ?? 0;
    const chronoSkill = this.save.skillLevels['chrono_capacitor'] ?? 0;
    const magSkill = this.save.skillLevels['mag_collector'] ?? 0;
    const shieldSkill = this.save.skillLevels['shield_matrix'] ?? 0;

    // Dynamic 7-period Day/Night progression
    if (this.settings.timeOfDay === 'dynamic' && !this.district.isUnderground) {
      this.dynamicTimeAccum += dt;
      if (this.dynamicTimeAccum >= 26) {
        this.dynamicTimeAccum = 0;
        const idx = TIME_CYCLE_ORDER.indexOf(this.currentPeriod);
        const nextPeriod = TIME_CYCLE_ORDER[(idx + 1) % TIME_CYCLE_ORDER.length];
        this.applyTimeOfDayVisuals(nextPeriod);
      }
    }

    // 1. Slow Motion (Softened 0.58x + STRICTLY BLOCKED while driving vehicles §8)
    const slowMoRequested =
      this.heldKeys.has(kb.slowMo) ||
      this.heldKeys.has('Tab') ||
      (char.id === 'zero' && this.abilityActiveTimer > 0);
    if (ridingVehicle && (this.heldKeys.has(kb.slowMo) || this.heldKeys.has('Tab'))) {
      if (this.vehicleLockNoticeTimer <= 0) {
        this.showSubtitle('Impulso y Tiempo Lento bloqueados al conducir vehículos.');
      }
      this.vehicleLockNoticeTimer = 1.6;
    }

    if (
      !ridingVehicle &&
      slowMoRequested &&
      (this.slowMoEnergy > 3 || (char.id === 'zero' && this.abilityActiveTimer > 0))
    ) {
      if (!this.isSlowMo) {
        this.isSlowMo = true;
        this.slowMoUsedCount++;
        audioEngine.playSlowMo(true);
        this.advanceTutorialStep('power');
      }
      if (!(char.id === 'zero' && this.abilityActiveTimer > 0)) {
        const zeroFactor = char.id === 'zero' ? 0.78 : 1.0;
        const drainRate = (40 * zeroFactor) / (1 + chronoSkill * 0.14);
        this.slowMoEnergy = Math.max(0, this.slowMoEnergy - drainRate * dt);
      }
    } else {
      if (this.isSlowMo) {
        this.isSlowMo = false;
        audioEngine.playSlowMo(false);
      }
      const regenRate = 7.5 * (1 + chronoSkill * 0.1);
      this.slowMoEnergy = Math.min(100, this.slowMoEnergy + regenRate * dt);
    }

    const timeScale = this.isSlowMo ? 0.58 : 1.0;
    const simDt = dt * timeScale;

    // 2. Timers & Cooldowns
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.activeBanner = null;
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitleText = null;
    }
    if (this.stuntTimer > 0) {
      this.stuntTimer -= dt;
      if (this.stuntTimer <= 0) this.lastStuntText = null;
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.phaseThroughTimer > 0) this.phaseThroughTimer -= dt;
    if (this.lowGravTimer > 0) this.lowGravTimer -= dt;
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.floodSlowTimer > 0) this.floodSlowTimer -= dt;
    if (this.vehicleTimer > 0) this.vehicleTimer -= simDt;
    if (this.stumbleTimer > 0) this.stumbleTimer -= simDt;
    if (this.vaultTimer > 0) this.vaultTimer -= simDt;
    if (this.shieldCooldown > 0) this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    if (this.doubleJumpCooldown > 0) this.doubleJumpCooldown = Math.max(0, this.doubleJumpCooldown - dt);
    if (this.doubleJumpBlockedTimer > 0) {
      this.doubleJumpBlockedTimer = Math.max(0, this.doubleJumpBlockedTimer - dt);
      if (this.doubleJumpBlockedTimer <= 0) this.doubleJumpBlockedReason = null;
    }
    if (this.vehicleLockNoticeTimer > 0) {
      this.vehicleLockNoticeTimer = Math.max(0, this.vehicleLockNoticeTimer - dt);
    }
    if (this.celebrateTimer > 0) this.celebrateTimer = Math.max(0, this.celebrateTimer - dt);
    if (this.objectiveToastTimer > 0) {
      this.objectiveToastTimer = Math.max(0, this.objectiveToastTimer - dt);
      if (this.objectiveToastTimer <= 0) this.objectiveToastText = null;
    }
    if (this.sectorTransitionTimer > 0) {
      this.sectorTransitionTimer = Math.max(0, this.sectorTransitionTimer - dt);
      if (this.sectorTransitionTimer <= 0) this.sectorTransitionText = null;
    }
    if (this.doubleJumpFlipTimer > 0) {
      this.doubleJumpFlipTimer = Math.max(0, this.doubleJumpFlipTimer - simDt * 2.1);
    }
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 3.5);
    }

    // Update transient Shield Shatter & Sector Gate VFX
    for (let vi = this.shieldShatterVfx.length - 1; vi >= 0; vi--) {
      const vfx = this.shieldShatterVfx[vi];
      vfx.timer -= dt;
      const prog = 1 - Math.max(0, vfx.timer) / vfx.maxTimer;
      const ring = vfx.group.userData.ring as THREE.Mesh | undefined;
      if (ring) {
        ring.scale.setScalar(1 + prog * 11.5);
        const rMat = ring.material as THREE.Material & { opacity: number };
        rMat.opacity = Math.max(0, 0.9 * (1 - prog));
      }
      const shards = vfx.group.userData.shards as
        | { mesh: THREE.Mesh; vx: number; vy: number; vz: number }[]
        | undefined;
      if (shards) {
        for (const s of shards) {
          s.vy -= 14 * dt;
          s.mesh.position.x += s.vx * dt;
          s.mesh.position.y += s.vy * dt;
          s.mesh.position.z += s.vz * dt;
          s.mesh.rotation.x += dt * 9;
          s.mesh.rotation.y += dt * 7;
          s.mesh.scale.setScalar(Math.max(0.05, 1 - prog));
        }
      }
      if (vfx.timer <= 0) {
        this.scene.remove(vfx.group);
        vfx.group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
            else m.material.dispose();
          }
        });
        this.shieldShatterVfx.splice(vi, 1);
      }
    }
    for (let si = this.sectorGates.length - 1; si >= 0; si--) {
      const sg = this.sectorGates[si];
      sg.timer -= dt;
      if (sg.timer <= 0 || sg.group.position.z > this.playerZ + 18) {
        this.scene.remove(sg.group);
        sg.group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
            else m.material.dispose();
          }
        });
        this.sectorGates.splice(si, 1);
      }
    }

    if (this.abilityActiveTimer > 0) {
      this.abilityActiveTimer -= dt;
    } else {
      const cd = char.abilityCooldown * (1 - shieldSkill * 0.08);
      // Kai Passive: +22% faster recharge while airborne or wall-running
      const kaiAirBonus =
        char.id === 'kai' && (!this.grounded || this.wallRunTimer > 0) ? 1.22 : 1.0;
      this.abilityCharge = Math.min(
        100,
        this.abilityCharge + (100 / cd) * kaiAirBonus * dt,
      );
    }

    if (this.mode !== 'tutorial') {
      this.updateDynamicEvents(dt);
      this.updateRainRewardEvent(dt, simDt);
    }

    if (this.mode === 'tutorial') {
      this.tutorialHint = this.tutorialStepText;
    } else if (this.settings.showTutorialHints && !this.save.tutorialCompleted) {
      if (this.distance < 90) {
        this.tutorialHint = 'Usa [A / D] para cambiar de carril · [Espacio] para saltar';
      } else if (this.distance < 190) {
        this.tutorialHint = 'Pulsa [Espacio] en el aire para Doble Salto · [S] para Slide Boost';
      } else if (this.distance < 290) {
        this.tutorialHint = 'Mantén [C] para Slow-Mo · Pulsa [F] para tu Habilidad Especial';
      } else {
        this.tutorialHint = null;
      }
    } else {
      this.tutorialHint = null;
    }

    if (this.consumePress(kb.ability) && this.abilityCharge >= 99.5) {
      this.triggerCharacterAbility(char.id);
      this.advanceTutorialStep('power');
    }

    // 4. Speed, Progressive Difficulty Stage (1..4) & Rebalanced Sprint Boost (§8)
    const nextStage =
      this.distance >= 1800
        ? 4
        : this.distance >= 1000
          ? 3
          : this.distance >= 450
            ? 2
            : 1;
    if (nextStage > this.difficultyStage && this.mode !== 'tutorial') {
      this.difficultyStage = nextStage;
      this.showStunt(`INTENSIDAD FASE ${nextStage}`, 1);
    }

    const sprintKeyHeld =
      this.heldKeys.has(kb.sprint) || this.heldKeys.has('ShiftRight');
    if (this.sprintCooldown > 0) {
      this.sprintCooldown = Math.max(0, this.sprintCooldown - dt);
    }
    if (ridingVehicle && sprintKeyHeld) {
      if (this.vehicleLockNoticeTimer <= 0) {
        this.showSubtitle('Impulso y Tiempo Lento bloqueados al conducir vehículos.');
      }
      this.vehicleLockNoticeTimer = 1.6;
    }

    const canSprint = !ridingVehicle && this.sprintCooldown <= 0 && this.momentum > 8;
    const sprinting = sprintKeyHeld && canSprint;
    if (sprinting) {
      this.boostActive = true;
      this.momentum = Math.max(0, this.momentum - 34 * dt);
      if (this.momentum <= 1) {
        this.sprintCooldown = this.SPRINT_COOLDOWN_MAX;
      }
    } else {
      if (this.boostActive) {
        this.boostActive = false;
        this.sprintCooldown = this.SPRINT_COOLDOWN_MAX;
      }
      if (!ridingVehicle && this.sprintCooldown <= 0) {
        this.momentum = Math.min(100, this.momentum + 9 * dt);
      }
    }

    const difficultyRamp =
      this.mode === 'tutorial'
        ? 0
        : Math.min(18, this.distance / 210) + (this.difficultyStage - 1) * 1.65;
    let targetSpeed = this.baseSpeed + difficultyRamp;
    if (sprinting) targetSpeed *= 1.24;
    if (ridingVehicle) targetSpeed *= 1.2 + this.activeVehicleStats.speed * 0.032;
    // Blaze Passive: +15% faster slide boost
    if (this.slideTimer > 0) targetSpeed *= char.id === 'blaze' ? 1.3 : 1.15;
    // Mika Passive: +35% faster zipline & grapple traversal
    if (char.id === 'mika' && (this.ziplineTimer > 0 || this.grappleTimer > 0)) {
      targetSpeed *= 1.35;
    }
    if (char.id === 'blaze' && this.abilityActiveTimer > 0) targetSpeed *= 1.42;
    if (this.stumbleTimer > 0) targetSpeed *= 0.65;
    if (this.floodSlowTimer > 0 && !sprinting) targetSpeed *= 0.78;
    if (this.activeDynamicEvent === 'coin_surge') targetSpeed *= 1.06;

    this.forwardSpeed = THREE.MathUtils.damp(
      this.forwardSpeed,
      targetSpeed,
      6,
      simDt,
    );
    const speedKmh = this.forwardSpeed * 3.8;
    this.maxSpeedKmh = Math.max(this.maxSpeedKmh, speedKmh);

    const dz = this.forwardSpeed * simDt;
    this.playerZ -= dz;
    this.distance += dz;
    if (this.getLaneCount() === 5) {
      this.fiveLaneDistanceRun += dz;
    }
    this.score += dz * (1.25 * this.combo);
    this.advanceTutorialStep('distance');

    // 5. Lateral Movement & Wall-Running (Supports 3 & 5 lanes!)
    const goLeft = this.consumePress(kb.left, ['ArrowLeft', 'KeyQ']);
    const goRight = this.consumePress(kb.right, ['ArrowRight']);
    const maxLane = this.getLaneCount() - 1;

    if (this.wallRunTimer > 0) {
      this.wallRunTimer -= simDt;
      if ((this.wallRunSide === -1 && goRight) || (this.wallRunSide === 1 && goLeft)) {
        this.wallRunTimer = 0;
        this.wallRunSide = 0;
        this.velY = 12.5;
        this.targetLane = this.getCenterLane();
        this.showStunt('WALL JUMP +250', 2);
        audioEngine.playJump(true, char.voicePitch);
      } else if (this.wallRunTimer <= 0) {
        this.wallRunSide = 0;
      }
    } else if (this.ziplineTimer <= 0 && this.grappleTimer <= 0 && this.swingBarTimer <= 0) {
      if (goLeft) {
        if (this.targetLane > 0) {
          this.targetLane--;
          audioEngine.playLaneSwitch();
          this.advanceTutorialStep('lane');
        } else {
          this.tryEnterWallRun(-1);
        }
      }
      if (goRight) {
        if (this.targetLane < maxLane) {
          this.targetLane++;
          audioEngine.playLaneSwitch();
          this.advanceTutorialStep('lane');
        } else {
          this.tryEnterWallRun(1);
        }
      }
    }

    const desiredX =
      this.wallRunTimer > 0
        ? this.wallRunSide * (this.getWallOffset() - 0.8)
        : this.getLaneX(this.targetLane);
    const prevX = this.playerX;
    const latSpeed =
      16 *
      (this.settings.movementSensitivity || 1.0) *
      (char.id === 'kai' ? 1.15 : 1.0);
    this.playerX = THREE.MathUtils.damp(this.playerX, desiredX, latSpeed, simDt);
    // MovingPlatform lateral carry when grounded on a moving platform
    this.playerX += this.getMovingPlatformCarryX();
    const laneTilt = THREE.MathUtils.clamp((this.playerX - prevX) * 14, -1.5, 1.5);

    // 6. Jump, Rebuilt Double Jump (§18), Slide, Dive
    if (this.consumePress(kb.jump, ['ArrowUp', 'KeyW'])) {
      this.jumpBufferTimer = this.settings.parkourAssist ? 0.18 : 0.12;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= simDt;
    }

    if (this.grounded) {
      this.coyoteTimer = this.settings.parkourAssist ? 0.14 : 0.08;
      this.jumpsUsed = 0;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= simDt;
    }

    const jumpThrust =
      (13.2 + char.stats.jump * 0.25) * (1 + jumpSkill * 0.05);

    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0 || this.wallRunTimer > 0 || this.ziplineTimer > 0 || this.swingBarTimer > 0) {
        this.velY = jumpThrust;
        this.grounded = false;
        this.diveQueued = false;
        this.coyoteTimer = 0;
        this.wallRunTimer = 0;
        this.wallRunSide = 0;
        this.ziplineTimer = 0;
        this.swingBarTimer = 0;
        this.slideTimer = 0;
        this.jumpsUsed = 1;
        this.jumpBufferTimer = 0;
        audioEngine.playJump(false, char.voicePitch);
        this.advanceTutorialStep('jump');
        this.spawnParticles(this.playerX, this.playerY + 0.1, this.playerZ, 8, this.district.colors.primaryNeon);
      } else if (this.jumpsUsed < 2) {
        if (!canDoubleJumpInForm) {
          this.doubleJumpBlockedReason = 'Doble salto solo a pie o con nave aérea';
          this.doubleJumpBlockedTimer = 1.6;
          this.jumpBufferTimer = 0;
          this.showStunt('SOLO A PIE O NAVE', 0);
        } else if (this.doubleJumpCooldown <= 0) {
          this.velY = jumpThrust * 0.94;
          this.jumpsUsed = 2;
          this.doubleJumpsRun += 1;
          this.doubleJumpCooldown = this.DOUBLE_JUMP_COOLDOWN_MAX;
          this.diveQueued = false;
          this.doubleJumpFlipTimer = 1.0;
          this.jumpBufferTimer = 0;
          this.showStunt('DOBLE SALTO', 1);
          audioEngine.playJump(true, char.voicePitch);
          this.advanceTutorialStep('jump');
          this.spawnParticles(this.playerX, this.playerY, this.playerZ, 16, this.district.colors.secondaryNeon, 5.2);
        }
      }
    }

    if (this.consumePress(kb.slide, ['ArrowDown', 'ControlLeft', 'ControlRight'])) {
      const slideDur = char.id === 'blaze' ? 0.82 : 0.68;
      if (this.grounded || this.playerY < this.getRoadElevationY(this.playerZ) + 0.35) {
        this.slideTimer = slideDur;
        this.diveQueued = false;
        audioEngine.playSlide();
        this.advanceTutorialStep('slide');
        this.showStunt('SLIDE BOOST', 1);
        this.spawnParticles(this.playerX, this.playerY + 0.1, this.playerZ, 8, '#facc15', 3.5);
      } else {
        this.velY = -32;
        this.diveQueued = true;
        this.slideTimer = 0.45;
        this.advanceTutorialStep('slide');
        this.showStunt('ROOFTOP DIVE', 2);
      }
    }
    if (this.slideTimer > 0) this.slideTimer -= simDt;

    // 7. Contextual Parkour (Swing Bar, Jump Pad, Zipline, Grapple)
    const interactPressed = this.consumePress(kb.interact);
    this.updateContextualParkour(interactPressed);

    // 8. Gravity & Abyssal/Surface Support + Landing Audio (§18)
    const evt = this.activeEventId
      ? LIVE_EVENTS.find((e) => e.id === this.activeEventId)
      : null;
    const kageGrav = char.id === 'kage' ? 0.88 : 1.0;
    const gravScale =
      (evt ? evt.gravityScale : this.district.gravityMultiplier) *
      (this.lowGravTimer > 0 ? 0.55 : 1.0) *
      kageGrav;

    const wasGrounded = this.grounded;
    if (this.wallRunTimer > 0) {
      this.velY = 0;
      this.playerY = THREE.MathUtils.damp(
        this.playerY,
        this.getRoadElevationY(this.playerZ) + 2.3,
        10,
        simDt,
      );
    } else if (this.swingBarTimer > 0) {
      const prevSwing = this.swingBarTimer;
      this.swingBarTimer -= simDt;
      this.velY = 0;
      this.playerY = THREE.MathUtils.damp(
        this.playerY,
        this.getRoadElevationY(this.playerZ) + 4.45,
        14,
        simDt,
      );
      if (prevSwing > 0 && this.swingBarTimer <= 0) {
        this.velY = 9.0;
        this.jumpsUsed = 1;
      }
    } else if (this.ziplineTimer > 0) {
      const prevZip = this.ziplineTimer;
      this.ziplineTimer -= simDt;
      this.velY = 0;
      this.playerY = THREE.MathUtils.damp(
        this.playerY,
        this.getRoadElevationY(this.playerZ) + 3.3,
        12,
        simDt,
      );
      if (char.id === 'mika' && prevZip > 0 && this.ziplineTimer <= 0) {
        this.invulnTimer = Math.max(this.invulnTimer, 1.5);
      }
    } else if (this.grappleTimer > 0) {
      const prevGrap = this.grappleTimer;
      this.grappleTimer -= simDt;
      this.velY = 0;
      this.playerY = THREE.MathUtils.damp(
        this.playerY,
        this.getRoadElevationY(this.playerZ) + 4.1,
        10,
        simDt,
      );
      this.grappleLine.visible = true;
      const posAttr = this.grappleLine.geometry.attributes
        .position as THREE.BufferAttribute;
      posAttr.setXYZ(0, this.playerX, this.playerY + 1.4, this.playerZ);
      posAttr.setXYZ(
        1,
        this.grappleTarget.x,
        this.grappleTarget.y,
        this.grappleTarget.z,
      );
      posAttr.needsUpdate = true;
      if (char.id === 'mika' && prevGrap > 0 && this.grappleTimer <= 0) {
        this.invulnTimer = Math.max(this.invulnTimer, 1.5);
      }
    } else {
      this.grappleLine.visible = false;
      this.velY -= 36 * gravScale * simDt;
      this.playerY += this.velY * simDt;

      const floorY = this.getSupportSurfaceY();
      if (floorY > -5 && this.playerY <= floorY) {
        if (!wasGrounded && (this.diveQueued || this.velY < -20)) {
          this.slideTimer = char.id === 'blaze' ? 0.68 : 0.55;
          this.diveQueued = false;
          if (!this.settings.reduceCameraMotion) this.cameraShake = 0.28;
          this.spawnParticles(this.playerX, floorY + 0.1, this.playerZ, 16, this.district.colors.primaryNeon, 6.0);
          audioEngine.playSlide();
        } else if (!wasGrounded) {
          audioEngine.playLanding();
          this.spawnParticles(this.playerX, floorY + 0.08, this.playerZ, 7, this.district.colors.primaryNeon, 2.4);
        }
        this.diveQueued = false;
        this.playerY = floorY;
        this.velY = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
        if (this.playerY < -4.2) {
          this.playerY = 0.5;
          this.velY = 0;
          this.handleFatalOrStumbleCrash('Caída al abismo de Skyline');
          return;
        }
      }
    }

    // 9. Animate Character Rig & Cyber-Companion Fox
    let action: ParkourAction = 'run';
    if (this.stumbleTimer > 0) action = 'stumble';
    else if (ridingVehicle) action = 'vehicle';
    else if (this.swingBarTimer > 0) action = 'swingBar';
    else if (this.grappleTimer > 0) action = 'grapple';
    else if (this.ziplineTimer > 0) action = 'zipline';
    else if (this.wallRunSide === -1) action = 'wallRunLeft';
    else if (this.wallRunSide === 1) action = 'wallRunRight';
    else if (this.vaultTimer > 0) action = 'vault';
    else if (this.climbTimer > 0) action = 'wallClimb';
    else if (!this.grounded) {
      if (this.velY < -18) action = 'dive';
      else if (this.doubleJumpFlipTimer > 0) action = 'doubleJump';
      else action = 'jump';
    } else if (this.slideTimer > 0) action = 'slide';
    else if (this.celebrateTimer > 0) action = 'celebrate';
    else if (this.onBalanceBeam) action = 'balanceBeam';
    else if (sprinting) action = 'sprint';

    this.lastAction = action;
    if (this.climbTimer > 0) this.climbTimer -= simDt;

    this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.shieldMesh.visible =
      this.hasShield || this.invulnTimer > 0 || this.phaseThroughTimer > 0;
    this.playerRig.shieldMesh.rotation.y += dt * 2.4;

    animateCharacterRig(
      this.playerRig,
      action,
      this.elapsedTotal,
      THREE.MathUtils.clamp((this.forwardSpeed - 20) / 30, 0, 1),
      laneTilt,
      dt,
      1 - this.doubleJumpFlipTimer,
    );

    if (this.companionFox) {
      const petEquipped = this.save.equippedPetId === 'fox_cyber';
      this.companionFox.group.visible = petEquipped;
      if (petEquipped) {
        const foxZ = this.playerZ + 1.3;
        const foxGy = this.getRoadElevationY(foxZ);
        this.companionFox.group.position.set(
          -this.getWallOffset() + 0.35,
          foxGy + 0.35 + Math.abs(Math.sin(this.elapsedTotal * 7)) * 0.08,
          foxZ,
        );
        this.companionFox.group.rotation.y = Math.PI;
        this.companionFox.mixer?.update(simDt);
      }
    }

    if (this.grounded && (action === 'run' || action === 'sprint' || action === 'balanceBeam')) {
      this.stepSoundTimer -= simDt;
      if (this.stepSoundTimer <= 0) {
        this.stepSoundTimer =
          this.footstepInterval * (24 / Math.max(18, this.forwardSpeed));
        audioEngine.playFootstep();
      }
    }

    const floorBelow = Math.max(this.getRoadElevationY(this.playerZ), this.getSupportSurfaceY());
    this.contactShadow.position.set(this.playerX, floorBelow + 0.03, this.playerZ);
    const heightDiff = Math.max(0, this.playerY - floorBelow);
    this.contactShadow.scale.setScalar(Math.max(0.35, 1 - heightDiff * 0.12));

    this.playerPointLight.position.set(
      this.playerX,
      this.playerY + 2.2,
      this.playerZ - 1.5,
    );
    this.dirLight.position.set(this.playerX + 16, 28, this.playerZ + 12);
    this.dirLight.target.position.set(this.playerX, floorBelow, this.playerZ - 12);

    // 10. Camera Follow
    const speedFovBoost = this.settings.reduceCameraMotion
      ? 0
      : THREE.MathUtils.clamp((this.forwardSpeed - 22) * 0.45, 0, 14);
    const targetFov =
      this.settings.fovBase + speedFovBoost + (this.isSlowMo ? -5 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    const shakeScale = this.settings.reduceCameraMotion ? 0 : this.cameraShake;
    const shakeX = (Math.random() - 0.5) * shakeScale;
    const shakeY = (Math.random() - 0.5) * shakeScale;
    const camDist = 6.4 * (this.settings.cameraDistance || 1.0);
    const camSpeed = 10 * (this.settings.cameraSpeed || 1.0);

    const camTargetX = this.playerX * 0.72 + this.mouseOffsetX + shakeX;
    const camTargetY =
      this.playerY +
      (this.slideTimer > 0 ? 2.6 : 3.5) +
      this.mouseOffsetY +
      shakeY;
    const camTargetZ = this.playerZ + (ridingVehicle ? camDist + 1.2 : camDist);

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      camTargetX,
      camSpeed,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      camTargetY,
      camSpeed,
      dt,
    );
    this.camera.position.z = camTargetZ;
    this.camera.lookAt(
      this.playerX * 0.85,
      this.playerY + 1.35,
      this.playerZ - 12,
    );

    // 11. Entities, Dynamic Obstacles, Enemies & Collisions
    this.updateEntitiesAndCollisions(simDt, magSkill);
    if (this.phase !== 'playing') return;

    // 11b. Aerial Threats (Jets & Helicopters) + Boss Hazards
    if (this.mode !== 'tutorial') {
      this.updateAerialThreats(dt, simDt);
      if (this.phase !== 'playing') return;
      this.updateBossHazards(simDt);
      if (this.phase !== 'playing') return;
    }

    // 11c. Dynamic 3D Pursuer Enforcer Update
    this.updatePursuer(dt, simDt, sprinting);
    if (this.phase !== 'playing') return;

    // 12. Chunk Recycling & Dynamic Non-Repeating Map Transitions (§19)
    this.recycleChunks();

    if (this.mode === 'endless' || (this.settings.randomMap && this.mode === 'parkour')) {
      const swapDist = this.settings.randomMap ? 720 : 1200;
      const stageCheck = Math.floor(this.distance / swapDist);
      if (stageCheck > 0 && Math.floor((this.distance - dz) / swapDist) < stageCheck) {
        let nextDist: DistrictDef;
        if (this.settings.randomMap) {
          const recentSet = new Set(this.recentDistrictIds.slice(-3));
          const candidates = DISTRICTS.filter((d) => !recentSet.has(d.id));
          const pool = candidates.length > 0 ? candidates : DISTRICTS.filter((d) => d.id !== this.district.id);
          nextDist = pool[Math.floor(Math.random() * pool.length)] ?? DISTRICTS[0];
          this.recentDistrictIds.push(nextDist.id);
          if (this.recentDistrictIds.length > 6) this.recentDistrictIds.shift();
        } else {
          nextDist = DISTRICTS[stageCheck % DISTRICTS.length];
        }
        if (nextDist.id !== this.district.id) {
          this.applyDistrictTheme(nextDist, true);
          this.sectorTransitionText = `${nextDist.name.toUpperCase()} (${nextDist.laneCount} CARRILES)`;
          this.sectorTransitionTimer = 3.2;
          this.showBanner(`CAMBIO DE SECTOR · ${nextDist.name.toUpperCase()}`);
          this.showSubtitle(`Accediendo a ${nextDist.name} — Carriles activos: ${nextDist.laneCount}.`);
        }
      }
    }

    // 13. Mode, Story Dialogue & 4-Phase Telegraphed Boss Logic
    this.updateModeLogic(dt, simDt);
    if (this.phase !== 'playing') return;

    const threatRatio =
      this.mode === 'freerun' || this.mode === 'tutorial'
        ? 0
        : THREE.MathUtils.clamp(1 - this.pursuerDistance / 22, 0, 1);
    const bossDanger =
      this.bossDistance !== null
        ? THREE.MathUtils.clamp(1 - this.bossDistance / 20, 0, 1)
        : this.randomBossActive
          ? 0.85
          : 0;
    const totalDanger = Math.max(
      threatRatio,
      bossDanger,
      this.activeDynamicEvent === 'drone_pursuit' || this.activeDynamicEvent === 'pursuer_frenzy'
        ? 0.78
        : 0,
    );

    if (this.randomBossActive || this.mode === 'bosschase') {
      audioEngine.setMusicMode('boss');
    } else if (this.activeDynamicEvent || this.rainEventState.active) {
      audioEngine.setMusicMode('event');
    } else if (totalDanger > 0.55) {
      audioEngine.setMusicMode('pursuit');
    } else if (this.forwardSpeed > this.baseSpeed + 10 || this.difficultyStage >= 3) {
      audioEngine.setMusicMode('highspeed');
    } else if (this.forwardSpeed > this.baseSpeed + 5) {
      audioEngine.setMusicMode('tension');
    } else {
      audioEngine.setMusicMode(this.mode === 'tutorial' ? 'intro' : 'exploration');
    }

    audioEngine.setMusicParams({
      intensity: THREE.MathUtils.clamp((this.forwardSpeed - 20) / 28, 0.25, 1),
      slowMo: this.isSlowMo,
      danger: totalDanger,
    });

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud(action);
    }
  }

  private getMovingPlatformCarryX(): number {
    if (!this.grounded) return 0;
    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (
          ob.kind === 'movingPlatform' &&
          ob.prevX !== undefined &&
          Math.abs(this.playerX - ob.x) < ob.width * 0.58 &&
          Math.abs(this.playerZ - ob.z) < ob.length * 0.52 &&
          Math.abs(this.playerY - (ob.groundY + ob.height + 0.05)) < 0.35
        ) {
          return ob.x - ob.prevX;
        }
      }
    }
    return 0;
  }

  private updateRainRewardEvent(dt: number, simDt: number): void {
    if (this.rainEventState.active) {
      this.rainEventState.timer -= dt;
      this.rainEventState.dropTimer -= simDt;
      if (this.rainEventState.dropTimer <= 0 && this.chunks.length > 0) {
        this.rainEventState.dropTimer = 0.28;
        const dropZ = this.playerZ - (24 + Math.random() * 26);
        const targetChunk = this.chunks.find(
          (ch) => dropZ <= ch.zStart && dropZ >= ch.zStart - CHUNK_LEN,
        );
        if (targetChunk) {
          const lane = Math.floor(Math.random() * this.getLaneCount());
          const gy = this.getRoadElevationY(dropZ);
          const kind = Math.random() < 0.14 ? 'gem' : 'coin';
          this.spawnCollectible(
            kind,
            this.getLaneX(lane),
            gy + 1.05,
            dropZ,
            targetChunk.group,
            targetChunk.collectibles,
            targetChunk.obstacles,
            targetChunk.enemies,
          );
        }
      }
      if (this.rainEventState.timer <= 0) {
        this.rainEventState.active = false;
        this.rainEventState.cooldownTimer = 45;
      }
      return;
    }

    this.rainEventState.cooldownTimer -= dt;
    if (this.rainEventState.cooldownTimer <= 0) {
      this.rainEventState.cooldownTimer = 12;
      if (Math.random() < 0.14) {
        this.rainEventState.active = true;
        this.rainEventState.timer = 9.0;
        this.rainEventState.dropTimer = 0.1;
        audioEngine.playGem();
        this.showBanner('EVENTO RARO: LLUVIA DE MONEDAS Y GEMAS');
        this.showSubtitle('[Recoge los créditos antes de que termine el evento]');
      }
    }
  }

  private updateAerialThreats(dt: number, simDt: number): void {
    if (
      !this.inBossArena &&
      !this.district.isUnderground &&
      this.distance >= this.nextAerialSpawnDist &&
      this.aerialThreats.length < 2
    ) {
      this.nextAerialSpawnDist += 280 + Math.random() * 140;
      const isJet = Math.random() < 0.55;
      const lane = Math.floor(Math.random() * this.getLaneCount());
      const spawnX = this.getLaneX(lane);
      const spawnZ = this.playerZ - 110;
      const gy = this.getRoadElevationY(spawnZ);
      const y = isJet ? gy + 2.6 : gy + 2.15;
      const mesh = isJet
        ? buildFighterJetModel(this.district.colors.primaryNeon, '#ef4444')
        : buildHelicopterModel('#f97316', this.district.colors.primaryNeon);
      mesh.position.set(spawnX, y, spawnZ);
      this.scene.add(mesh);

      this.aerialThreats.push({
        id: this.obstacleSeq++,
        kind: isJet ? 'jet' : 'helicopter',
        mesh,
        lane,
        x: spawnX,
        y,
        z: spawnZ,
        speedZ: isJet
          ? Math.max(46, this.forwardSpeed * 1.95)
          : Math.max(18, this.forwardSpeed * 0.72),
        warnPlayed: false,
        hit: false,
      });

      this.showSubtitle(
        isJet
          ? '[ALERTA AÉREA: Caza interceptor en picada — cambia de carril]'
          : '[PATRULLA AÉREA: Helicóptero táctico — deslízate debajo]',
      );
    }

    for (let i = this.aerialThreats.length - 1; i >= 0; i--) {
      const a = this.aerialThreats[i];
      a.z += a.speedZ * simDt;
      const gy = this.getRoadElevationY(a.z);
      a.y = a.kind === 'jet' ? gy + 2.45 : gy + 2.1 + Math.sin(this.elapsedTotal * 3) * 0.25;
      a.mesh.position.set(a.x, a.y, a.z);

      if (a.kind === 'helicopter') {
        const mr = a.mesh.getObjectByName('mainRotor');
        const tr = a.mesh.getObjectByName('tailRotor');
        if (mr) mr.rotation.y += dt * 18;
        if (tr) tr.rotation.x += dt * 22;
      }

      const distToPlayer = this.playerZ - a.z;
      if (!a.warnPlayed && distToPlayer > 0 && distToPlayer < 65) {
        a.warnPlayed = true;
        if (a.kind === 'jet') audioEngine.playJetFlyby();
        else audioEngine.playHelicopterPulse();
      }

      if (
        !a.hit &&
        Math.abs(this.playerX - a.x) < 1.35 &&
        Math.abs(this.playerZ - a.z) < 2.2
      ) {
        const playerBottom = this.playerY;
        const playerTop = this.playerY + (this.slideTimer > 0 ? 0.72 : 1.72);
        const threatBot = a.y - 0.85;
        const threatTop = a.y + 0.85;
        if (playerTop > threatBot && playerBottom < threatTop) {
          a.hit = true;
          if (this.phaseThroughTimer > 0 || this.invulnTimer > 0 || this.vehicleTimer > 0) {
            this.showStunt('INTERCEPTOR EVADIDO!', 2);
          } else if (this.hasShield) {
            this.triggerShieldChainExplosion(a.x, a.y, a.z, a.id);
          } else {
            this.handleFatalOrStumbleCrash(
              a.kind === 'jet'
                ? 'Impacto contra caza interceptor'
                : 'Colisión con helicóptero táctico',
            );
            return;
          }
        }
      }

      if (a.z > this.playerZ + 22) {
        this.scene.remove(a.mesh);
        a.mesh.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
            else m.material.dispose();
          }
        });
        this.aerialThreats.splice(i, 1);
      }
    }
  }

  private spawnBossHazard(kind: BossHazardEntity['kind'], lane: number): void {
    const bossDef = getBossById(this.activeBossId);
    const spawnZ = this.bossMesh.position.z + 1.5;
    const gy = this.getRoadElevationY(spawnZ);
    const clampedLane = THREE.MathUtils.clamp(lane, 0, this.getLaneCount() - 1);
    const x = kind === 'shockwave' ? 0 : this.getLaneX(clampedLane);
    let mesh: THREE.Group;
    let y = gy + 1.1;

    if (kind === 'shockwave') {
      mesh = buildBossShockwave(bossDef.secondaryColor, this.getRoadWidth() - 0.8);
      y = gy + 0.15;
    } else if (kind === 'laser' || kind === 'laneStrike') {
      mesh = buildBossLaserBeam(bossDef.secondaryColor);
      y = gy + 1.15;
    } else {
      mesh = buildBossProjectile(bossDef.secondaryColor);
      y = gy + 1.1;
    }
    mesh.position.set(x, y, spawnZ);
    this.scene.add(mesh);

    this.bossHazards.push({
      id: this.obstacleSeq++,
      kind,
      mesh,
      lane: clampedLane,
      x,
      y,
      z: spawnZ,
      speedZ: kind === 'laser' ? 38 : kind === 'shockwave' ? 30 : 29 + this.bossPhase * 2.5,
      telegraphTimer: 0,
      lifeTimer: 6.2,
      hit: false,
    });
  }

  private updateBossHazards(simDt: number): void {
    for (let i = this.bossHazards.length - 1; i >= 0; i--) {
      const h = this.bossHazards[i];
      h.lifeTimer -= simDt;
      h.z += h.speedZ * simDt;
      const gy = this.getRoadElevationY(h.z);
      h.y = h.kind === 'shockwave' ? gy + 0.15 : gy + 1.1;
      h.mesh.position.set(h.x, h.y, h.z);
      if (h.kind === 'projectile') {
        h.mesh.rotation.z += simDt * 6;
      }

      if (!h.hit) {
        const hitX = h.kind === 'shockwave' ? true : Math.abs(this.playerX - h.x) < 1.25;
        const hitZ = Math.abs(this.playerZ - h.z) < (h.kind === 'laser' ? 3.5 : 1.15);
        if (hitX && hitZ) {
          const pBot = this.playerY;
          const pTop = this.playerY + (this.slideTimer > 0 ? 0.72 : 1.72);
          const hBot = h.kind === 'shockwave' ? gy : h.y - 0.6;
          const hTop = h.kind === 'shockwave' ? gy + 0.85 : h.y + 0.6;
          if (pTop > hBot && pBot < hTop) {
            h.hit = true;
            h.mesh.visible = false;
            if (this.phaseThroughTimer > 0 || this.invulnTimer > 0) {
              this.showStunt('ATAQUE DE JEFE EVADIDO!', 2);
            } else if (this.hasShield) {
              this.triggerShieldChainExplosion(h.x, h.y, h.z, h.id);
            } else {
              this.handleFatalOrStumbleCrash('Impacto por ataque especial del Jefe');
              return;
            }
          }
        }
      }

      if (h.lifeTimer <= 0 || h.z > this.playerZ + 12) {
        this.scene.remove(h.mesh);
        h.mesh.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
            else m.material.dispose();
          }
        });
        this.bossHazards.splice(i, 1);
      }
    }
  }

  private updatePursuer(dt: number, simDt: number, sprinting: boolean): void {
    if (this.mode === 'freerun' || this.mode === 'tutorial') {
      this.pursuerMesh.visible = false;
      return;
    }
    this.pursuerMesh.visible = true;

    let deltaGap = 0;
    if (this.stumbleTimer > 0) deltaGap -= 4.2 * simDt;
    if (this.floodSlowTimer > 0 && !sprinting) deltaGap -= 2.2 * simDt;
    if (this.activeDynamicEvent === 'pursuer_frenzy') deltaGap -= 1.65 * simDt;
    if (sprinting || this.vehicleTimer > 0 || this.ziplineTimer > 0 || this.grappleTimer > 0) {
      deltaGap += 2.6 * simDt;
    } else if (this.forwardSpeed > this.baseSpeed + 8) {
      deltaGap += 0.9 * simDt;
    } else {
      deltaGap -= 0.18 * simDt;
    }

    this.pursuerDistance = THREE.MathUtils.clamp(this.pursuerDistance + deltaGap, 0, 32);

    if (this.pursuerDistance < 9) {
      this.pursuerSirenCooldown -= dt;
      if (this.pursuerSirenCooldown <= 0) {
        this.pursuerSirenCooldown = 2.8;
        audioEngine.playPursuerSiren();
      }
    }

    const pY =
      Math.max(this.getRoadElevationY(this.playerZ + 2), this.getSupportSurfaceY()) +
      Math.abs(Math.sin(this.elapsedTotal * 14)) * 0.09;
    const pZ = this.playerZ + Math.max(1.75, this.pursuerDistance * 0.42);
    this.pursuerMesh.position.set(
      THREE.MathUtils.lerp(this.pursuerMesh.position.x, this.playerX * 0.92, dt * 6),
      pY,
      pZ,
    );

    const stride = Math.sin(this.elapsedTotal * 15) * 0.85;
    const legL = this.pursuerMesh.getObjectByName('legL');
    const legR = this.pursuerMesh.getObjectByName('legR');
    const armL = this.pursuerMesh.getObjectByName('armL');
    const armR = this.pursuerMesh.getObjectByName('armR');
    const sirenL = this.pursuerMesh.getObjectByName('sirenL');
    const sirenR = this.pursuerMesh.getObjectByName('sirenR');
    if (legL) legL.rotation.x = stride;
    if (legR) legR.rotation.x = -stride;
    if (armL) armL.rotation.x = -stride * 0.85;
    if (armR) armR.rotation.x = stride * 0.85;
    const flash = Math.sin(this.elapsedTotal * 16) > 0;
    if (sirenL) sirenL.scale.setScalar(flash ? 1.3 : 0.85);
    if (sirenR) sirenR.scale.setScalar(flash ? 0.85 : 1.3);

    if (this.pursuerDistance <= 0.1) {
      this.handleFatalOrStumbleCrash('Capturado por el Enforcer Perseguidor');
    }
  }

  private updateDynamicEvents(dt: number): void {
    if (this.dynamicEventTimer > 0) {
      this.dynamicEventTimer -= dt;
      if (this.dynamicEventTimer <= 0) {
        this.activeDynamicEvent = null;
        if (this.powerOutageActive) {
          this.powerOutageActive = false;
          this.applyTimeOfDayVisuals(this.currentPeriod);
        }
      }
    }

    if (this.distance >= this.nextEventDistance) {
      this.nextEventDistance += 400 + Math.random() * 200;
      const pool: DynamicEventType[] = [
        'power_outage',
        'drone_pursuit',
        'express_train',
        'sky_bridge',
        'storm_surge',
        'coin_surge',
        'pursuer_frenzy',
        'talisman_signal',
      ];
      const evt = pool[Math.floor(Math.random() * pool.length)];
      this.activeDynamicEvent = evt;
      this.dynamicEventTimer = 11;

      if (evt === 'power_outage') {
        this.powerOutageActive = true;
        this.dirLight.intensity = 0.45;
        this.hemiLight.intensity = 0.35;
        this.showBanner('EVENTO: CORTE ELÉCTRICO EN SECTOR');
        this.showSubtitle('[Energía urbana caída — luces de emergencia activas]');
      } else if (evt === 'drone_pursuit') {
        audioEngine.playDroneAlert();
        this.showBanner('EVENTO: ALERTA DE DRONES');
        this.showSubtitle('[Escuadrón de drones interceptores detectado]');
      } else if (evt === 'express_train') {
        audioEngine.playTrainHorn();
        this.showBanner('EVENTO: TRENES EXPRESO EN RUTA');
        this.showSubtitle('[Bocina de tren expreso acercándose]');
      } else if (evt === 'sky_bridge') {
        this.showBanner('EVENTO: PUENTES AÉREOS ACTIVOS');
        this.showSubtitle('[Rutas elevadas con gemas activadas]');
      } else if (evt === 'storm_surge') {
        this.weather = 'storm';
        this.showBanner('EVENTO: TORMENTA ELÉCTRICA');
        this.showSubtitle('[Tormenta sobre Neon City — visibilidad reducida]');
      } else if (evt === 'coin_surge') {
        this.coinsRun += 15;
        this.showBanner('EVENTO: LLUVIA DE CRÉDITOS +15M');
        this.showSubtitle('[Sobrecarga bancaria: multiplicador de monedas activo]');
      } else if (evt === 'pursuer_frenzy') {
        audioEngine.playPursuerSiren();
        this.showBanner('ALERTA: PERSECUTOR EN FRENESÍ');
        this.showSubtitle('[Usa Sprint o Vehículos para alejar al Enforcer]');
      } else if (evt === 'talisman_signal') {
        audioEngine.playGem();
        this.showBanner('SEÑAL RELICARIO: TALISMÁN DETECTADO');
        this.showSubtitle('[Probabilidad de Talismán de Autorrevivir aumentada]');
      }
    }
  }

  private tryEnterWallRun(side: -1 | 1): void {
    const skillLvl = this.save.skillLevels['aerial_thrusters'] ?? 0;
    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (
          (side === -1 && ob.kind === 'wallLeft') ||
          (side === 1 && ob.kind === 'wallRight')
        ) {
          if (Math.abs(this.playerZ - ob.z) < ob.length * 0.55) {
            this.wallRunSide = side;
            this.wallRunTimer = 1.45 + skillLvl * 0.35;
            this.wallRunsCount++;
            this.showStunt('WALL RUN!', 2);
            audioEngine.playGrapple();
            return;
          }
        }
      }
    }
  }

  private updateContextualParkour(interactPressed: boolean): void {
    this.contextPrompt = null;
    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (ob.kind === 'jumpPad' && !ob.interacted) {
          if (
            Math.abs(this.playerZ - ob.z) < 1.65 &&
            Math.abs(this.playerX - ob.x) < 1.55 &&
            this.playerY <= ob.groundY + 1.1
          ) {
            ob.interacted = true;
            this.velY = 18.4;
            this.grounded = false;
            this.jumpsUsed = 1;
            this.parkourChainsRun += 1;
            this.showStunt('IMPULSO AL PISO 2!', 2);
            audioEngine.playJump(true, 1.18);
            this.spawnParticles(ob.x, ob.groundY + 0.3, ob.z, 14, this.district.colors.primaryNeon, 5.5);
            return;
          }
        } else if (ob.kind === 'swingBar' && !ob.interacted) {
          if (
            Math.abs(this.playerZ - ob.z) < 2.2 &&
            Math.abs(this.playerX - ob.x) < 1.9 &&
            this.playerY >= ob.groundY + 1.2
          ) {
            if (this.playerY >= ob.groundY + 1.6 || interactPressed) {
              ob.interacted = true;
              this.swingBarTimer = 0.68;
              this.velY = 0;
              this.parkourChainsRun += 1;
              this.showStunt('BARRA DE IMPULSO!', 2);
              audioEngine.playGrapple();
              return;
            } else {
              this.contextPrompt = '[E] o SALTA — Barra de Impulso';
            }
          }
        } else if (ob.kind === 'zipline' && !ob.interacted) {
          const dz = this.playerZ - ob.z;
          if (
            Math.abs(dz) < ob.length * 0.5 &&
            Math.abs(this.playerX - ob.x) < 1.8
          ) {
            if (this.playerY > ob.groundY + 1.3 || interactPressed) {
              ob.interacted = true;
              this.ziplineTimer = 1.15;
              this.grapplesCount++;
              this.parkourChainsRun += 1;
              this.showStunt('TIROLINA EXTREMA', 2);
              audioEngine.playGrapple();
              return;
            } else {
              this.contextPrompt = '[E] o SALTA — Tirolina';
            }
          }
        } else if (ob.kind === 'grappleAnchor' && !ob.interacted) {
          const distZ = this.playerZ - ob.z;
          if (distZ > 1.5 && distZ < 17) {
            this.contextPrompt = '[E] Gancho Aéreo';
            if (interactPressed || this.justPressed.has(this.settings.keybindings.jump)) {
              ob.interacted = true;
              this.grappleTimer = 0.62;
              this.grappleTarget.set(ob.x, ob.y, ob.z);
              this.grapplesCount++;
              this.parkourChainsRun += 1;
              this.showStunt('GANCHO CYBER!', 2);
              audioEngine.playGrapple();
              return;
            }
          }
        }
      }
    }
  }

  private getSupportSurfaceY(): number {
    const roadY = this.getRoadElevationY(this.playerZ);
    let support = roadY;
    let overAbyss = false;
    this.onFloor2 = false;
    this.onBalanceBeam = false;

    for (const c of this.chunks) {
      for (const gap of c.abyssGaps) {
        if (this.playerZ >= gap.zMin && this.playerZ <= gap.zMax) {
          overAbyss = true;
        }
      }
      for (const ob of c.obstacles) {
        if (
          ob.kind === 'train' ||
          ob.kind === 'cargoTrain' ||
          ob.kind === 'movingTrain' ||
          ob.kind === 'skyBridge' ||
          ob.kind === 'movingPlatform' ||
          ob.kind === 'containerStack' ||
          ob.kind === 'floor2Deck'
        ) {
          const topWorldY = ob.groundY + ob.height;
          if (
            Math.abs(this.playerX - ob.x) < ob.width * 0.58 &&
            Math.abs(this.playerZ - ob.z) < ob.length * 0.52 &&
            this.playerY >= topWorldY - 0.85
          ) {
            support = Math.max(support, topWorldY + 0.05);
            if (topWorldY >= roadY + 3.4) {
              this.onFloor2 = true;
            }
          }
        } else if (ob.kind === 'balanceBeam') {
          const topWorldY = ob.groundY + ob.height;
          if (
            Math.abs(this.playerX - ob.x) < ob.width * 0.88 &&
            Math.abs(this.playerZ - ob.z) < ob.length * 0.52 &&
            this.playerY >= topWorldY - 0.85
          ) {
            support = Math.max(support, topWorldY + 0.05);
            this.onFloor2 = true;
            this.onBalanceBeam = true;
          }
        } else if (ob.kind === 'retractBridge') {
          if (
            Math.abs(this.playerX - ob.x) < ob.width * 0.58 &&
            Math.abs(this.playerZ - ob.z) < ob.length * 0.52
          ) {
            support = Math.max(support, ob.groundY + 0.25);
          }
        } else if (ob.kind === 'climbRamp') {
          if (
            Math.abs(this.playerX - ob.x) < ob.width * 0.58 &&
            Math.abs(this.playerZ - ob.z) < ob.length * 0.5
          ) {
            const t = THREE.MathUtils.clamp(
              (ob.z + ob.length * 0.5 - this.playerZ) / ob.length,
              0,
              1,
            );
            this.climbTimer = 0.1;
            const rampTop = ob.rampTopY ?? 3.15;
            support = Math.max(support, ob.groundY + t * rampTop);
            if (rampTop >= 3.8 && t > 0.72) {
              this.onFloor2 = true;
            }
          }
        }
      }
    }
    if (overAbyss && support <= roadY + 0.05) {
      return -10;
    }
    return support;
  }

  private triggerCharacterAbility(charId: string): void {
    const char = getCharacterById(charId);
    this.abilityCharge = 0;
    this.abilitiesUsedCount++;
    this.celebrateTimer = 0.45;
    audioEngine.playAbility(char.voicePitch);
    this.showSubtitle(`[${char.name}: ${char.abilityName}]`);
    this.spawnParticles(this.playerX, this.playerY + 1.2, this.playerZ, 26, char.colors.accent, 8.0);
    this.spawnParticles(this.playerX, this.playerY + 0.5, this.playerZ, 12, '#ffffff', 5.0);

    switch (charId) {
      case 'kai':
        this.abilityActiveTimer = 5.0;
        this.invulnTimer = 3.5;
        this.velY = 9;
        this.showStunt('SALTO FANTASMA!', 3);
        break;
      case 'nova':
        this.abilityActiveTimer = 4.0;
        this.invulnTimer = Math.max(this.invulnTimer, 1.2);
        this.slowMoEnergy = Math.min(100, this.slowMoEnergy + 50);
        for (const c of this.chunks) {
          for (const ob of c.obstacles) {
            if (
              Math.abs(ob.z - this.playerZ) < 38 &&
              (ob.kind === 'lowBarrier' || ob.kind === 'laserGrid' || ob.kind === 'electricFloor')
            ) {
              ob.hit = true;
              ob.mesh.visible = false;
              this.coinsRun += 12;
            }
          }
          for (const dr of c.enemies) {
            if (Math.abs(dr.z - this.playerZ) < 38 && !dr.disabled) {
              dr.disabled = true;
              dr.mesh.visible = false;
              this.dronesEvadedRun++;
              this.coinsRun += 15;
            }
          }
        }
        this.showStunt('HACKEO DE RED!', 3);
        break;
      case 'blaze':
        this.abilityActiveTimer = 5.5;
        this.hasShield = true;
        this.invulnTimer = 5.5;
        this.showStunt('SOBREMARCHA NITRO!', 3);
        break;
      case 'zero':
        this.abilityActiveTimer = 6.0;
        this.phaseThroughTimer = 6.0;
        this.showStunt('DESFASE TEMPORAL!', 3);
        break;
      case 'mika':
        this.abilityActiveTimer = 4.0;
        this.velY = 16;
        this.grounded = false;
        this.jumpsUsed = 0;
        this.showStunt('GANCHO CELESTE!', 3);
        break;
      case 'valkyrie':
        this.abilityActiveTimer = 3.0;
        this.hasShield = true;
        if (!this.settings.reduceCameraMotion) this.cameraShake = 0.45;
        for (const h of this.bossHazards) {
          h.hit = true;
          h.mesh.visible = false;
        }
        for (const c of this.chunks) {
          for (const ob of c.obstacles) {
            if (
              ob.z < this.playerZ &&
              ob.z > this.playerZ - 45 &&
              ob.kind !== 'wallLeft' &&
              ob.kind !== 'wallRight' &&
              ob.kind !== 'retractBridge' &&
              ob.kind !== 'skyBridge' &&
              ob.kind !== 'climbRamp' &&
              ob.kind !== 'floor2Deck' &&
              ob.kind !== 'swingBar' &&
              ob.kind !== 'jumpPad' &&
              ob.kind !== 'balanceBeam' &&
              ob.kind !== 'sectorGate'
            ) {
              ob.hit = true;
              ob.mesh.visible = false;
            }
          }
          for (const dr of c.enemies) {
            if (dr.z < this.playerZ && dr.z > this.playerZ - 45 && !dr.disabled) {
              dr.disabled = true;
              dr.mesh.visible = false;
              this.dronesEvadedRun++;
            }
          }
        }
        this.showStunt('ONDA SÍSMICA!', 3);
        break;
      case 'cipher':
        this.abilityActiveTimer = 8.0;
        this.magnetTimer = 8.0;
        this.showStunt('PULSO MAGNÉTICO!', 3);
        break;
      case 'kage':
        this.abilityActiveTimer = 7.0;
        this.lowGravTimer = 7.0;
        this.showStunt('INVERSIÓN LUNAR!', 3);
        break;
    }
  }

  private isStructuralParkourKind(kind: ObstacleKind): boolean {
    return (
      kind === 'wallLeft' ||
      kind === 'wallRight' ||
      kind === 'climbRamp' ||
      kind === 'retractBridge' ||
      kind === 'skyBridge' ||
      kind === 'zipline' ||
      kind === 'grappleAnchor' ||
      kind === 'movingPlatform' ||
      kind === 'floor2Deck' ||
      kind === 'swingBar' ||
      kind === 'jumpPad' ||
      kind === 'balanceBeam' ||
      kind === 'sectorGate' ||
      kind === 'hoverBikePickup'
    );
  }

  private triggerShieldChainExplosion(
    impactX: number,
    impactY: number,
    impactZ: number,
    primaryEntityId?: number,
  ): void {
    this.hasShield = false;
    this.shieldCooldown = this.SHIELD_COOLDOWN_MAX;
    this.invulnTimer = 1.6;
    this.shieldBreaksRun += 1;
    this.hitstopTimer = 0.055;
    if (!this.settings.reduceCameraMotion) this.cameraShake = 0.52;
    audioEngine.playShieldShatter();

    const shatterGroup = buildShieldShatterEffect('#38bdf8');
    shatterGroup.position.set(impactX, impactY, impactZ);
    this.scene.add(shatterGroup);
    this.shieldShatterVfx.push({ group: shatterGroup, timer: 0.72, maxTimer: 0.72 });

    const shieldSkill = this.save.skillLevels['shield_matrix'] ?? 0;
    const blastRadius = 14 + shieldSkill * 1.25;
    const radiusSq = blastRadius * blastRadius;
    const destroyedIds = new Set<number>();
    if (primaryEntityId !== undefined) destroyedIds.add(primaryEntityId);
    let brokenCount = 0;

    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (ob.hit || this.isStructuralParkourKind(ob.kind)) continue;
        const dx = ob.x - impactX;
        const dz = ob.z - impactZ;
        if (dx * dx + dz * dz <= radiusSq) {
          if (!destroyedIds.has(ob.id)) {
            destroyedIds.add(ob.id);
            brokenCount++;
          }
          ob.hit = true;
          ob.mesh.visible = false;
          this.spawnParticles(ob.x, ob.groundY + 1.0, ob.z, 10, '#38bdf8', 5.5);
        }
      }
      for (const dr of c.enemies) {
        if (dr.disabled) continue;
        const dx = dr.x - impactX;
        const dz = dr.z - impactZ;
        if (dx * dx + dz * dz <= radiusSq) {
          if (!destroyedIds.has(dr.id)) {
            destroyedIds.add(dr.id);
            brokenCount++;
          }
          dr.disabled = true;
          dr.mesh.visible = false;
          this.dronesEvadedRun++;
          this.spawnParticles(dr.x, dr.y + 0.5, dr.z, 12, '#22d3ee', 6.5);
        }
      }
    }

    for (const h of this.bossHazards) {
      if (h.hit) continue;
      const dz = h.z - impactZ;
      if (dz * dz <= radiusSq) {
        if (!destroyedIds.has(h.id)) {
          destroyedIds.add(h.id);
          brokenCount++;
        }
        h.hit = true;
        h.mesh.visible = false;
      }
    }

    for (const a of this.aerialThreats) {
      if (a.hit) continue;
      const dx = a.x - impactX;
      const dz = a.z - impactZ;
      if (dx * dx + dz * dz <= radiusSq) {
        if (!destroyedIds.has(a.id)) {
          destroyedIds.add(a.id);
          brokenCount++;
        }
        a.hit = true;
        a.mesh.visible = false;
        this.spawnParticles(a.x, a.y, a.z, 14, '#f97316', 7);
      }
    }

    this.score += 50 * Math.max(1, brokenCount);
    this.showStunt(
      brokenCount > 1
        ? `RUPTURA DE ESCUDO · ${brokenCount} TRAMPAS DESTRUIDAS!`
        : 'ESCUDO DESTRUIDO · ONDA EXPANSIVA!',
      2,
    );
  }

  private damageBossFromEmp(): void {
    const activeFight = this.randomBossActive || this.mode === 'bosschase';
    if (!activeFight || this.bossHp <= 0) return;

    const bossDef = getBossById(this.activeBossId);
    this.bossHp = Math.max(0, this.bossHp - 1);
    this.bossPhaseHp = Math.max(0, this.bossPhaseHp - 1);
    audioEngine.playEmpHit();
    if (!this.settings.reduceCameraMotion) this.cameraShake = 0.45;
    this.spawnParticles(
      this.bossMesh.position.x,
      this.bossMesh.position.y,
      this.bossMesh.position.z,
      28,
      '#22d3ee',
      8,
    );

    if (this.bossPhaseHp <= 0) {
      this.bossPhasesClearedRun += 1;

      if (this.bossPhaseIndex < 3) {
        this.bossPhaseIndex += 1;
        this.bossPhase = this.bossPhaseIndex + 1;
        const nextCfg = bossDef.phasesConfig[this.bossPhaseIndex];
        this.bossPhaseMaxHp = nextCfg.hpUnits;
        this.bossPhaseHp = nextCfg.hpUnits;
        this.bossPhaseName = nextCfg.name;
        this.bossPhaseTransitionTimer = 1.9;
        this.bossAttackTimer = nextCfg.attackCooldownSec + 1.9;
        this.bossEmpSpawnTimer = nextCfg.empSpawnSec;
        this.celebrateTimer = 0.65;
        this.objectiveToastText = `FASE ${this.bossPhase}/4: ${nextCfg.name}`;
        this.objectiveToastTimer = 2.6;

        for (const h of this.bossHazards) {
          h.hit = true;
          h.mesh.visible = false;
        }
        applyBossPhaseVisuals(this.bossMesh, bossDef, this.bossPhaseIndex);
        audioEngine.setBossPhase(this.bossPhase);
        audioEngine.playBossPhaseTransition(this.bossPhase);
        this.showBanner(`FASE ${this.bossPhase}/4 · ${nextCfg.name.toUpperCase()}`);
        this.showSubtitle(nextCfg.description);
        this.showStunt(`FASE ${this.bossPhase} DESBLOQUEADA!`, 3);
        return;
      }

      // Phase 4 HP reached 0 -> True Boss Defeat!
      this.bossHp = 0;
      this.bossPhaseHp = 0;
      this.inBossArena = false;
      this.bossWarningText = null;
      this.celebrateTimer = 0.9;
      this.spawnParticles(
        this.bossMesh.position.x,
        this.bossMesh.position.y,
        this.bossMesh.position.z,
        56,
        bossDef.primaryColor,
        12,
      );
      this.spawnParticles(
        this.bossMesh.position.x,
        this.bossMesh.position.y,
        this.bossMesh.position.z,
        36,
        bossDef.secondaryColor,
        9,
      );

      if (this.randomBossActive) {
        this.randomBossActive = false;
        this.bossMesh.visible = false;
        this.coinsRun += 340;
        this.gemsRun += 8;
        this.score += 2400;
        audioEngine.setBossPhase(1);
        this.highlights.unshift(`Emboscada de ${bossDef.name} (4 Fases) superada`);
        this.showBanner(`${bossDef.name.toUpperCase()} DERROTADO +340M +8G`);
        audioEngine.playVictory();
        return;
      }

      this.bossDefeatedId = bossDef.id;
      const bonusCoins = Math.round(bossDef.rewardCoins * 1.35);
      const bonusGems = Math.round(bossDef.rewardGems * 1.35);
      this.coinsRun += bonusCoins;
      this.gemsRun += bonusGems;
      this.highlights.unshift(`Jefe ${bossDef.name} derrotado en 4 fases`);
      this.showBanner(`${bossDef.name} DESTRUIDO +${bonusCoins} MONEDAS +${bonusGems} GEMAS`);
      audioEngine.playVictory();
      this.finishRun(true);
      return;
    }

    this.showBanner(`IMPACTO EMP · FASE ${this.bossPhase}/4 (${this.bossPhaseHp}/${this.bossPhaseMaxHp})`);
    this.showStunt('SOBRECARGA EMP +500', 3);
  }

  private updateEntitiesAndCollisions(simDt: number, magSkill: number): void {
    const char = getCharacterById(this.save.selectedCharacterId);
    const playerBottom = this.playerY;
    const playerTop = this.playerY + (this.slideTimer > 0 ? 0.72 : 1.72);
    // Cipher Passive: +1.4m base magnet radius
    const cipherBonus = char.id === 'cipher' ? 1.4 : 0;
    const magnetRadius =
      (this.magnetTimer > 0 ? 9.0 : 1.8) + cipherBonus + magSkill * 0.65;
    const evt = this.activeEventId
      ? LIVE_EVENTS.find((e) => e.id === this.activeEventId)
      : null;
    const gemMult = evt ? evt.gemMultiplier : 1;
    const bossArenaMult =
      this.mode === 'bosschase' || this.randomBossActive ? 1.35 : 1.0;

    for (const c of this.chunks) {
      // Collectibles (Latched homing magnet prevents coins from drifting behind player!)
      for (const col of c.collectibles) {
        if (col.collected) continue;
        col.mesh.rotation.y += simDt * 3.4;

        const dx = this.playerX - col.x;
        const dy = this.playerY + 0.9 - col.y;
        const dz = this.playerZ - col.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (col.kind === 'coin' && distSq < magnetRadius * magnetRadius) {
          col.attracted = true;
        }
        if (col.attracted) {
          col.x = THREE.MathUtils.lerp(col.x, this.playerX, Math.min(1, simDt * 16));
          col.y = THREE.MathUtils.lerp(col.y, this.playerY + 0.9, Math.min(1, simDt * 16));
          col.z = THREE.MathUtils.lerp(col.z, this.playerZ, Math.min(1, simDt * 16));
          col.mesh.position.set(col.x, col.y, col.z - c.group.position.z);
        }

        const pickupHit =
          distSq < 1.8 * 1.8 || (col.attracted && col.z > this.playerZ + 1.2);
        if (pickupHit) {
          col.collected = true;
          col.mesh.visible = false;
          if (col.kind === 'coin') {
            const coinBonus = Math.round(
              (this.activeDynamicEvent === 'coin_surge' ? 2 : 1) * bossArenaMult,
            );
            this.coinsRun += coinBonus;
            this.score += 25 * this.combo * coinBonus;
            if (char.id === 'cipher') {
              this.abilityCharge = Math.min(100, this.abilityCharge + 0.45);
            }
            this.advanceTutorialStep('coin');
            audioEngine.playCoin(this.combo);
            this.spawnParticles(col.x, col.y, col.z, 4, '#facc15', 2.5);
          } else if (col.kind === 'gem') {
            this.gemsRun += Math.max(1, Math.round(1 * gemMult * bossArenaMult));
            this.score += 180 * this.combo;
            audioEngine.playGem();
            this.spawnParticles(col.x, col.y, col.z, 10, '#e879f9', 4);
            this.showStunt('GEMA CUÁNTICA!', 1);
          } else if (col.kind === 'talisman') {
            this.liveTalismansHeld += 1;
            this.onConsumableEvent?.('talisman_pickup', 1);
            audioEngine.playTalismanPickup();
            this.spawnParticles(col.x, col.y, col.z, 20, '#fde047', 6);
            this.showStunt('TALISMÁN RELICARIO +1', 3);
          } else if (col.kind === 'secret') {
            this.secretsFoundRun += 1;
            this.gemsRun += Math.round(3 * gemMult);
            this.score += 600 * this.combo;
            this.highlights.push(`Secreto hallado a ${Math.floor(this.distance)}m`);
            audioEngine.playGem();
            this.spawnParticles(col.x, col.y, col.z, 18, '#38bdf8', 5);
            this.showStunt('SECRETO DESCUBIERTO +3 GEMAS', 3);
          } else if (col.kind === 'empCell') {
            audioEngine.playEmpCollect();
            this.damageBossFromEmp();
            if (this.phase !== 'playing') return;
          } else if (col.kind === 'shield') {
            if (this.shieldCooldown > 0 && !this.hasShield) {
              this.shieldCooldown = Math.max(0, this.shieldCooldown - 6);
            }
            this.hasShield = true;
            audioEngine.playGem();
            this.showStunt('ESCUDO ACTIVO', 1);
          } else if (col.kind === 'magnet') {
            this.magnetTimer = 9 + magSkill * 1.5;
            audioEngine.playGem();
            this.showStunt('IMÁN DE NEÓN', 1);
          } else if (col.kind === 'slowmo') {
            this.slowMoEnergy = 100;
            audioEngine.playGem();
            this.showStunt('CRONO-RECARGA 100%', 1);
          }
        }
      }

      // Enemies AI (supports 3 & 5 lanes!)
      const sweepBound = this.getWallOffset() * 0.68;
      const laneCount = this.getLaneCount();
      for (let ei = 0; ei < c.enemies.length; ei++) {
        const dr = c.enemies[ei];
        if (dr.disabled) continue;
        const distFromPlayer = Math.abs(dr.z - this.playerZ);
        if (distFromPlayer > 30 && ei % 2 !== this.aiFrameParity) {
          continue;
        }
        const aiDt = distFromPlayer > 30 ? simDt * 2 : simDt;
        dr.phase += aiDt * 3.2;

        if (dr.enemyClass === 'scout' || dr.enemyClass === 'surveillance') {
          dr.x = Math.sin(dr.phase * 0.7) * sweepBound;
          dr.mesh.position.x = dr.x;
        } else if (dr.enemyClass === 'pursuit' || dr.enemyClass === 'intervention') {
          dr.z += dr.speedZ * aiDt;
          dr.mesh.position.z += dr.speedZ * aiDt;
          dr.groundY = this.getRoadElevationY(dr.z);
          dr.y = dr.groundY + 1.25;
          dr.mesh.position.y = dr.y;
        } else if (dr.enemyClass === 'tactical') {
          dr.shiftTimer -= aiDt;
          if (dr.shiftTimer <= 0) {
            dr.shiftTimer = 1.3;
            dr.baseLane = (dr.baseLane + 1) % laneCount;
          }
          dr.x = THREE.MathUtils.lerp(dr.x, this.getLaneX(dr.baseLane), aiDt * 6);
          dr.mesh.position.x = dr.x;
        } else if (dr.enemyClass === 'elite') {
          dr.mesh.rotation.y += aiDt * 3.5;
          dr.x = Math.cos(dr.phase * 0.9) * sweepBound;
          dr.mesh.position.x = dr.x;
        } else if (dr.enemyClass === 'ground_bot' || dr.enemyClass === 'security_bot') {
          dr.mesh.position.y = dr.groundY + Math.abs(Math.sin(dr.phase * 2.5)) * 0.12;
        } else {
          dr.mesh.position.y = dr.y + Math.sin(dr.phase) * 0.22;
        }

        if (!dr.evaded && dr.z > this.playerZ + 1.8) {
          dr.evaded = true;
          this.dronesEvadedRun++;
          if (dr.enemyClass === 'elite') {
            this.gemsRun += 1;
            this.abilityCharge = 100;
            this.showStunt('ÉLITE EVADIDO +1 GEMA', 2);
          } else if (Math.abs(dr.x - this.playerX) < 3.6) {
            this.showStunt(`EVASIÓN ${DRONE_CODEX[dr.enemyClass].name.toUpperCase()}`, 1);
          }
        }

        const hitW = dr.enemyClass === 'armored' ? 1.8 : 0.95;
        const hitBot =
          dr.enemyClass === 'armored'
            ? dr.groundY + 1.35
            : dr.enemyClass === 'ground_bot' || dr.enemyClass === 'security_bot'
              ? dr.groundY
              : dr.y - 0.55;
        const hitTop =
          dr.enemyClass === 'ground_bot' || dr.enemyClass === 'security_bot'
            ? dr.groundY + 1.55
            : dr.y + 0.65;

        if (
          Math.abs(this.playerX - dr.x) < hitW &&
          Math.abs(this.playerZ - dr.z) < 1.15 &&
          playerTop > hitBot &&
          playerBottom < hitTop
        ) {
          if (this.phaseThroughTimer > 0) continue;
          if (this.hasShield && this.invulnTimer <= 0 && this.vehicleTimer <= 0) {
            this.triggerShieldChainExplosion(dr.x, dr.y + 0.5, dr.z, dr.id);
          } else if (this.invulnTimer > 0 || this.vehicleTimer > 0) {
            dr.disabled = true;
            dr.mesh.visible = false;
            this.dronesEvadedRun++;
            this.showStunt('ENEMIGO DESTRUIDO!', 2);
            audioEngine.playCrash(true);
            this.spawnParticles(dr.x, dr.y + 0.8, dr.z, 16, DRONE_CODEX[dr.enemyClass].color, 6);
          } else {
            dr.disabled = true;
            this.handleFatalOrStumbleCrash(
              `Colisión con ${DRONE_CODEX[dr.enemyClass].name}`,
            );
            return;
          }
        }
      }

      // Dynamic & Static Obstacles
      const barrierClamp = this.getRoadWidth() * 0.41;
      for (const ob of c.obstacles) {
        if (ob.hit) continue;

        if (!ob.passedCounted && ob.z > this.playerZ + 1.6) {
          ob.passedCounted = true;
          if (!this.isStructuralParkourKind(ob.kind)) {
            this.obstaclesDodgedRun += 1;
            if (
              ob.kind === 'train' ||
              ob.kind === 'cargoTrain' ||
              ob.kind === 'movingTrain'
            ) {
              this.trainsPassedRun += 1;
            }
          }
        }

        if (ob.kind === 'movingTrain') {
          ob.z += ob.speedZ * simDt;
          ob.mesh.position.z += ob.speedZ * simDt;
          ob.groundY = this.getRoadElevationY(ob.z);
          ob.mesh.position.y = ob.groundY;
          if (!ob.hornPlayed && Math.abs(ob.z - this.playerZ) < 38) {
            ob.hornPlayed = true;
            audioEngine.playTrainHorn();
          }
        } else if (ob.kind === 'movingBarrier') {
          ob.phase += simDt * 1.8;
          ob.x = THREE.MathUtils.clamp(
            ob.baseX + Math.sin(ob.phase) * 3.15,
            -barrierClamp,
            barrierClamp,
          );
          ob.mesh.position.x = ob.x;
        } else if (ob.kind === 'movingPlatform') {
          ob.prevX = ob.x;
          ob.phase += simDt * 1.5;
          ob.x = ob.baseX + Math.sin(ob.phase) * 2.2;
          ob.mesh.position.x = ob.x;
        } else if (ob.kind === 'blastDoor') {
          ob.phase += simDt * 2.2;
          const doorOpen = (Math.sin(ob.phase) + 1) * 0.5;
          const leaf = ob.mesh.getObjectByName('doorLeaf');
          if (leaf) leaf.position.y = 1.3 + doorOpen * 1.9;
          ob.y = ob.groundY + 1.3 + doorOpen * 1.9;
        } else if (ob.kind === 'turbineHazard') {
          const spin = ob.mesh.getObjectByName('spinner');
          if (spin) spin.rotation.z += simDt * 6.5;
        }

        if (ob.kind === 'hoverBikePickup') {
          ob.mesh.rotation.y += simDt * 2.5;
          if (
            Math.abs(this.playerX - ob.x) < 1.35 &&
            Math.abs(this.playerZ - ob.z) < 1.5 &&
            Math.abs(this.playerY - ob.y) < 1.8
          ) {
            ob.hit = true;
            ob.mesh.visible = false;
            const vDef = getVehicleById(this.save.selectedVehicleId ?? 'hover_bike');
            this.vehicleTimer = this.activeVehicleStats.boostDuration;
            this.vehiclesCount++;
            this.isSlowMo = false;
            this.boostActive = false;
            this.highlights.push(`${vDef.name} pilotado a ${Math.floor(this.distance)}m`);
            this.showStunt(`${vDef.name.toUpperCase()} ACTIVADO!`, 3);
            audioEngine.playAbility(1.1);
            this.spawnParticles(ob.x, ob.y, ob.z, 16, vDef.accentColor, 5.5);
          }
          continue;
        }

        if (this.isStructuralParkourKind(ob.kind)) {
          continue;
        }

        const overlapX = Math.abs(this.playerX - ob.x) < ob.width * 0.44 + 0.28;
        const overlapZ = Math.abs(this.playerZ - ob.z) < ob.length * 0.5 + 0.28;
        if (!overlapX || !overlapZ) continue;

        if (ob.kind === 'floodZone') {
          if (this.playerY < ob.groundY + 0.35) {
            this.floodSlowTimer = 0.65;
            this.spawnParticles(this.playerX, ob.groundY + 0.2, this.playerZ, 2, '#38bdf8', 3.5);
          }
          continue;
        }

        let obBottom = ob.groundY;
        let obTop = ob.groundY + ob.height;
        if (
          ob.kind === 'highGate' ||
          ob.kind === 'steamPipe' ||
          ob.kind === 'scaffolding' ||
          ob.kind === 'turbineHazard'
        ) {
          obBottom = ob.groundY + 1.12;
          obTop = ob.groundY + 2.8;
        } else if (ob.kind === 'highConduit') {
          obBottom = ob.groundY + 1.05;
          obTop = ob.groundY + 2.6;
        } else if (ob.kind === 'blastDoor') {
          obBottom = Math.max(ob.groundY, ob.y - 1.3);
          obTop = ob.y + 1.3;
        }

        const overlapY = playerTop > obBottom && playerBottom < obTop - 0.15;
        if (!overlapY) continue;

        if (
          (ob.kind === 'lowBarrier' || ob.kind === 'rubble' || ob.kind === 'electricFloor') &&
          this.jumpBufferTimer > 0 &&
          this.settings.parkourAssist
        ) {
          ob.hit = true;
          this.velY = 10.5;
          this.vaultTimer = 0.38;
          this.jumpBufferTimer = 0;
          this.showStunt('PARKOUR VAULT!', 2);
          audioEngine.playJump(true, 1.15);
          continue;
        }

        if (this.phaseThroughTimer > 0 || this.invulnTimer > 0) {
          if (this.invulnTimer > 0) {
            ob.hit = true;
            ob.mesh.visible = false;
            this.spawnParticles(ob.x, ob.groundY + 1.2, ob.z, 10, '#f97316', 5);
            this.showStunt('IMPACTO DESTRUCTOR!', 1);
          }
          continue;
        }

        if (this.vehicleTimer > 0) {
          ob.hit = true;
          ob.mesh.visible = false;
          this.hitstopTimer = 0.04;
          if (!this.settings.reduceCameraMotion) this.cameraShake = 0.3;
          audioEngine.playCrash(true);
          this.spawnParticles(ob.x, ob.groundY + 1.2, ob.z, 16, '#22d3ee', 6.5);
          this.showStunt('OBSTÁCULO PULVERIZADO', 2);
          continue;
        }

        if (this.hasShield) {
          ob.hit = true;
          ob.mesh.visible = false;
          this.triggerShieldChainExplosion(this.playerX, this.playerY + 1.0, this.playerZ, ob.id);
          continue;
        }

        ob.hit = true;
        const causeLabel =
          ob.kind === 'train' || ob.kind === 'cargoTrain' || ob.kind === 'movingTrain'
            ? 'Impacto contra tren de Neon Metro'
            : ob.kind === 'milkTruck' || ob.kind === 'hoverCar'
              ? 'Impacto contra tráfico urbano'
              : ob.kind === 'laserGrid' || ob.kind === 'electricFloor'
                ? 'Sobrecarga en trampa eléctrica'
                : ob.kind === 'blastDoor'
                  ? 'Compuerta blindada cerrada'
                  : 'Colisión con obstáculo urbano';
        this.handleFatalOrStumbleCrash(causeLabel);
        return;
      }
    }
  }

  private clearNearbyHazards(radius = 20): void {
    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (
          Math.abs(ob.z - this.playerZ) < radius &&
          !this.isStructuralParkourKind(ob.kind)
        ) {
          ob.hit = true;
          ob.mesh.visible = false;
        }
      }
      for (const dr of c.enemies) {
        if (Math.abs(dr.z - this.playerZ) < radius) {
          dr.disabled = true;
          dr.mesh.visible = false;
        }
      }
    }
  }

  private handleFatalOrStumbleCrash(cause = 'Colisión fatal en ruta'): void {
    this.hitstopTimer = 0.07;
    if (!this.settings.reduceCameraMotion) this.cameraShake = 0.65;
    audioEngine.playCrash(false);
    this.spawnParticles(
      this.playerX,
      this.playerY + 1,
      this.playerZ,
      26,
      '#ef4444',
      7.5,
    );

    if (this.mode === 'freerun' || this.mode === 'tutorial') {
      this.stumbleTimer = 0.7;
      this.invulnTimer = 1.6;
      this.combo = 1;
      this.showStunt(
        this.mode === 'tutorial' ? '¡INTÉNTALO DE NUEVO! (TUTORIAL)' : 'TROPIEZO (MODO LIBRE)',
        0,
      );
      return;
    }

    // 1. Auto-Revive Talisman Check (max 1 auto-trigger per run)
    if (this.liveTalismansHeld > 0 && !this.talismanUsedRun) {
      this.talismanUsedRun = true;
      this.liveTalismansHeld -= 1;
      this.onConsumableEvent?.('talisman_use', 1);
      this.clearNearbyHazards(20);
      this.playerY = Math.max(this.getRoadElevationY(this.playerZ) + 0.35, this.getSupportSurfaceY() + 0.25);
      this.velY = 6.5;
      this.invulnTimer = 3.0;
      this.pursuerDistance = Math.max(this.pursuerDistance, 22);
      audioEngine.playTalismanRevive();
      this.spawnParticles(this.playerX, this.playerY + 1.1, this.playerZ, 34, '#fde047', 8.5);
      this.showBanner('TALISMÁN ACTIVADO — AUTORREVIVIR +3.0s ESCUDO');
      this.highlights.unshift(`Talismán salvó la carrera a ${Math.floor(this.distance)}m`);
      return;
    }

    // 2. Progressive Revive Token Prompt with live 10.0s countdown (§5)
    const nextCost = getReviveCostForAttempt(this.revivesUsedRun);
    this.phase = 'reviving';
    this.heldKeys.clear();
    this.reviveCountdownTimer = 10.0;
    this.hudEmitReviveAccum = 0;
    this.revivePrompt = {
      defeatCause: cause,
      costTokens: nextCost,
      attemptNumber: this.revivesUsedRun + 1,
      availableTokens: this.liveReviveTokensHeld,
      canAfford: this.liveReviveTokensHeld >= nextCost,
      remainingSeconds: 10.0,
    };
    this.emitHud('stumble');
  }

  public confirmRevive(): boolean {
    if (this.phase !== 'reviving' || !this.revivePrompt) return false;
    const cost = this.revivePrompt.costTokens;
    if (this.liveReviveTokensHeld < cost) return false;

    this.liveReviveTokensHeld -= cost;
    this.revivesUsedRun += 1;
    this.onConsumableEvent?.('revive_use', cost);

    this.clearNearbyHazards(22);
    const safeY = this.getSupportSurfaceY();
    this.playerY = safeY > -5 ? safeY + 0.35 : this.getRoadElevationY(this.playerZ) + 0.45;
    this.velY = 0;
    this.stumbleTimer = 0;
    this.invulnTimer = 3.0;
    this.pursuerDistance = Math.max(this.pursuerDistance, 22);
    this.revivePrompt = null;
    this.phase = 'playing';
    this.lastTime = performance.now();

    audioEngine.playReviveSurge();
    this.spawnParticles(this.playerX, this.playerY + 1.0, this.playerZ, 28, '#22d3ee', 8);
    this.showBanner(`REVIVIDO (#${this.revivesUsedRun}) · 3.0s INVULNERABILIDAD`);
    this.highlights.unshift(`Revivido en ruta a ${Math.floor(this.distance)}m`);
    this.emitHud('run');
    return true;
  }

  public declineRevive(): void {
    const cause = this.revivePrompt?.defeatCause ?? 'Colisión fatal';
    this.revivePrompt = null;
    this.finishRun(false, cause);
  }

  private updateModeLogic(dt: number, simDt: number): void {
    if (this.mode === 'timetrial' && this.timeRemaining !== null) {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.finishRun(false, 'Tiempo agotado en Contrarreloj');
        return;
      }
    }

    // Story Chapter Dialogue Beats
    if (this.mode === 'story' && this.targetDistance) {
      const ch = getStoryChapterByNum(this.storyChapterNum);
      const progress = this.distance / Math.max(1, this.targetDistance);
      while (
        this.storyBeatIndex < ch.dialogueBeats.length &&
        progress >= ch.dialogueBeats[this.storyBeatIndex].progressRatio
      ) {
        const beat = ch.dialogueBeats[this.storyBeatIndex];
        this.showSubtitle(`[${beat.speaker}]: ${beat.text}`);
        this.storyBeatIndex++;
      }
      if (ch.bossId && !this.randomBossActive && progress >= 0.65) {
        this.randomBossActive = true;
        this.randomBossTimer = 46;
        this.beginBossEncounter(ch.bossId, true);
      }
    }

    // Surprise Random Boss Ambush during Normal Runs (§15: high distance >= 1650m)
    if (
      (this.mode === 'endless' || this.mode === 'parkour') &&
      !this.randomBossActive &&
      this.distance >= this.nextRandomBossDist
    ) {
      this.nextRandomBossDist += 1100 + Math.random() * 450;
      const unlockedPool = getUnlockedBossIds(this.save.defeatedBosses ?? []);
      const randId = unlockedPool[Math.floor(Math.random() * unlockedPool.length)] ?? ORDERED_BOSS_IDS[0];
      this.randomBossActive = true;
      this.randomBossTimer = 42;
      this.beginBossEncounter(randId, true);
    }

    const activeBossEncounter =
      this.randomBossActive || (this.mode === 'bosschase' && this.bossDistance !== null);

    if (activeBossEncounter && this.bossHp > 0) {
      const bossDef = getBossById(this.activeBossId);
      const phaseCfg = bossDef.phasesConfig[Math.max(0, Math.min(3, this.bossPhaseIndex))];
      const laneCount = this.getLaneCount();

      if (this.randomBossActive) {
        this.randomBossTimer -= simDt;
        if (this.randomBossTimer <= 0) {
          this.randomBossActive = false;
          this.inBossArena = false;
          this.bossMesh.visible = false;
          this.bossWarningText = null;
          audioEngine.setBossPhase(1);
          this.showBanner('JEFE RETIRADO — RUTA DESPEJADA');
          return;
        }
      }

      if (this.bossIntroTimer > 0) {
        this.bossIntroTimer = Math.max(0, this.bossIntroTimer - dt);
        if (!this.settings.reduceCameraMotion && this.bossIntroTimer > 2.2) {
          this.cameraShake = 0.18;
        }
      }
      if (this.bossPhaseTransitionTimer > 0) {
        this.bossPhaseTransitionTimer = Math.max(0, this.bossPhaseTransitionTimer - dt);
      }
      if (this.bossEntranceTimer > 0) {
        this.bossEntranceTimer = Math.max(0, this.bossEntranceTimer - simDt);
      }

      const targetDist = this.getBossCombatDistance(this.activeBossId);
      const introProgress = 1 - this.bossEntranceTimer / 3.2;
      const bossZOffset = THREE.MathUtils.lerp(56, targetDist, Math.min(1, introProgress));

      const targetX =
        this.activeBossId === 'neon_wraith'
          ? this.getLaneX(Math.floor(this.elapsedTotal * (1.2 + this.bossPhase * 0.28)) % laneCount)
          : this.activeBossId === 'cryo_leviathan'
            ? Math.sin(this.elapsedTotal * (1.4 + this.bossPhase * 0.2)) * (this.getWallOffset() * 0.65)
            : this.playerX;
      const bossGy = this.getRoadElevationY(this.playerZ - bossZOffset);
      const hoverY =
        this.activeBossId === 'iron_hunter'
          ? bossGy + 1.65 + Math.abs(Math.sin(this.elapsedTotal * 5)) * 0.35
          : bossGy + 4.35 + Math.sin(this.elapsedTotal * 3) * 0.45;
      this.bossMesh.position.set(
        THREE.MathUtils.lerp(this.bossMesh.position.x, targetX, dt * 3.5),
        hoverY,
        this.playerZ - bossZOffset,
      );
      this.bossMesh.rotation.y =
        this.bossPhaseTransitionTimer > 0
          ? this.bossMesh.rotation.y + dt * 5.2
          : Math.sin(this.elapsedTotal * 2) * 0.25;
      this.animateBossMesh(simDt, this.bossPhase);

      // Pause attacks during dramatic Intro or Phase Transition beats (§2 & §15)
      if (this.bossIntroTimer <= 0 && this.bossPhaseTransitionTimer <= 0) {
        // Guaranteed periodic EMP spawn inside clean Boss Arena
        this.bossEmpSpawnTimer -= simDt;
        if (this.bossEmpSpawnTimer <= 0 && this.chunks.length > 0) {
          this.bossEmpSpawnTimer = phaseCfg?.empSpawnSec ?? 4.2;
          const empZ = this.playerZ - (36 + Math.random() * 14);
          const targetChunk = this.chunks.find(
            (ch) => empZ <= ch.zStart && empZ >= ch.zStart - CHUNK_LEN,
          );
          if (targetChunk) {
            const empLane = Math.floor(Math.random() * laneCount);
            this.spawnCollectible(
              'empCell',
              this.getLaneX(empLane),
              this.getRoadElevationY(empZ) + 1.15,
              empZ,
              targetChunk.group,
              targetChunk.collectibles,
              targetChunk.obstacles,
              targetChunk.enemies,
            );
          }
        }

        const prevAtk = this.bossAttackTimer;
        this.bossAttackTimer -= simDt;
        if (this.bossAttackTimer <= 1.15 && this.bossAttackTimer > 0) {
          if (prevAtk > 1.15) {
            audioEngine.playBossTelegraph();
          }
          const warnMap: Record<BossId, string> = {
            titan_drone: '¡PROYECTILES Y BARRIDO LÁSER — CAMBIA DE CARRIL!',
            iron_hunter: '¡ONDA EXPANSIVA SÍSMICA — SALTA!',
            overseer: '¡RAYO DE BARRIDO EN CARRIL — ESQUIVA YA!',
            neon_wraith: '¡BOMBARDEO HOLOGRÁFICO EN CARRIL!',
            cryo_leviathan: '¡LANZAS DE ESCARCHA Y PULSO CRIOGÉNICO!',
            volt_archon: '¡DESCARGA VOLTAICA EN CADENA — CAMBIA DE CARRIL!',
            the_sentinel: '¡TORMENTA ORBITAL MULTIFASE — ESQUIVA!',
            omega_core: '¡SINGULARIDAD OMEGA — MÁXIMA ALERTA EN PISTA!',
          };
          this.bossWarningText = warnMap[this.activeBossId] ?? '¡JEFE ATACANDO!';
          this.contextPrompt = 'RECOGE CELDAS EMP CIAN PARA DAÑAR AL JEFE';
        }

        if (this.bossAttackTimer <= 0) {
          this.bossWarningText = null;
          this.bossAttackTimer = Math.max(
            1.75,
            (phaseCfg?.attackCooldownSec ?? 3.6) - this.bossPhase * 0.12,
          );
          if (this.bossDistance !== null) {
            this.bossDistance = Math.max(2, this.bossDistance - 2.6);
            if (this.forwardSpeed > 28 || this.vehicleTimer > 0) {
              this.bossDistance = Math.min(26, this.bossDistance + 3.4);
            }
          }

          // Boss-specific telegraphed 4-phase choreography using active phase patterns
          const nextLane = (this.targetLane + 1) % laneCount;
          const farLane = (this.targetLane + 2) % laneCount;
          const altLane = (this.targetLane + laneCount - 1) % laneCount;

          if (this.activeBossId === 'iron_hunter') {
            this.spawnBossHazard(this.bossPhase === 2 ? 'projectile' : 'shockwave', this.targetLane);
            if (this.bossPhase !== 2) audioEngine.playBossShockwave();
            if (this.bossPhase >= 3) this.spawnBossHazard('projectile', nextLane);
            if (this.bossPhase >= 4) this.spawnBossHazard('laneStrike', farLane);
          } else if (this.activeBossId === 'overseer') {
            this.spawnBossHazard('laser', this.targetLane);
            if (this.bossPhase >= 2) this.spawnBossHazard('projectile', nextLane);
            if (this.bossPhase >= 3) {
              this.spawnBossHazard('shockwave', this.getCenterLane());
              audioEngine.playBossShockwave();
            }
            if (this.bossPhase >= 4) this.spawnBossHazard('laser', altLane);
          } else if (this.activeBossId === 'neon_wraith') {
            this.spawnBossHazard('laneStrike', this.targetLane);
            if (this.bossPhase >= 2) this.spawnBossHazard('laneStrike', nextLane);
            if (this.bossPhase >= 3) {
              this.spawnBossHazard('shockwave', this.getCenterLane());
              audioEngine.playBossShockwave();
            }
            if (this.bossPhase >= 4) this.spawnBossHazard('projectile', altLane);
          } else if (this.activeBossId === 'cryo_leviathan') {
            this.spawnBossHazard('projectile', this.targetLane);
            if (this.bossPhase >= 2) this.spawnBossHazard('projectile', altLane);
            if (this.bossPhase >= 3) {
              this.spawnBossHazard('shockwave', this.getCenterLane());
              audioEngine.playBossShockwave();
            }
            if (this.bossPhase >= 4) this.spawnBossHazard('laser', this.targetLane);
          } else if (this.activeBossId === 'volt_archon') {
            this.spawnBossHazard('laser', this.targetLane);
            if (this.bossPhase >= 2) {
              this.spawnBossHazard('projectile', nextLane);
              this.spawnBossHazard('projectile', altLane);
            }
            if (this.bossPhase >= 3) {
              this.spawnBossHazard('shockwave', this.getCenterLane());
              audioEngine.playBossShockwave();
            }
          } else if (this.activeBossId === 'omega_core') {
            this.spawnBossHazard('laser', this.targetLane);
            this.spawnBossHazard('projectile', nextLane);
            if (this.bossPhase >= 2) {
              this.spawnBossHazard('shockwave', this.getCenterLane());
              audioEngine.playBossShockwave();
            }
            if (this.bossPhase >= 4) this.spawnBossHazard('laneStrike', farLane);
          } else {
            // titan_drone & the_sentinel
            this.spawnBossHazard('projectile', this.targetLane);
            if (this.bossPhase >= 2) {
              this.spawnBossHazard(this.bossPhase >= 4 ? 'shockwave' : 'laser', farLane);
              if (this.bossPhase >= 4) audioEngine.playBossShockwave();
            }
            if (this.bossPhase >= 3) {
              this.spawnBossHazard('laneStrike', nextLane);
            }
          }
        }
      }
    }

    if (this.targetDistance !== null && this.distance >= this.targetDistance) {
      if (this.mode === 'tutorial') {
        audioEngine.playTutorialChime();
      } else {
        audioEngine.playVictory();
      }
      this.finishRun(true);
      return;
    }
  }

  private finishRun(victory: boolean, defeatCause?: string): void {
    this.phase = victory ? 'victory' : 'gameover';
    this.revivePrompt = null;
    this.randomBossActive = false;
    this.inBossArena = false;
    this.bossIntroTimer = 0;
    this.bossPhaseTransitionTimer = 0;
    this.mpPausedOverlay = false;
    this.bossWarningText = null;
    this.rainEventState.active = false;
    this.clearDynamicThreats();
    this.heldKeys.clear();
    this.isSlowMo = false;
    this.boostActive = false;
    this.powerOutageActive = false;
    audioEngine.setBossPhase(1);
    audioEngine.setMusicMode(victory ? 'victory' : 'defeat');
    audioEngine.setMusicParams({ slowMo: false, intensity: 0.25, danger: 0 });

    if (!victory && this.captureDroneMesh) {
      this.captureDroneMesh.position.set(this.playerX, this.playerY + 2.8, this.playerZ);
      this.captureDroneMesh.visible = true;
      audioEngine.playCaptureDroneGrab();
    } else if (this.captureDroneMesh) {
      this.captureDroneMesh.visible = false;
    }

    this.emitHud(victory ? 'celebrate' : 'captureStruggle');

    if (this.maxCombo >= 5) {
      this.highlights.unshift(`Combo máximo x${this.maxCombo}`);
    }
    if (this.dronesEvadedRun >= 3) {
      this.highlights.push(`${this.dronesEvadedRun} enemigos evadidos`);
    }
    if (this.shieldBreaksRun > 0) {
      this.highlights.push(`${this.shieldBreaksRun} explosiones de escudo`);
    }

    const bossDef =
      this.mode === 'bosschase' || this.bossPhasesClearedRun > 0 || this.bossDefeatedId
        ? getBossById(this.activeBossId)
        : null;

    this.onRunComplete({
      victory,
      mode: this.mode,
      districtId: this.district.id,
      characterId: this.save.selectedCharacterId,
      eventId: this.activeEventId,
      activeRunContext: { ...this.activeRunContext },
      score: this.score,
      distance: this.distance,
      durationSec: this.runDurationSec,
      coins: this.coinsRun,
      gems: this.gemsRun,
      maxSpeedKmh: this.maxSpeedKmh,
      maxCombo: this.maxCombo,
      wallRuns: this.wallRunsCount,
      grapples: this.grapplesCount,
      vehicles: this.vehiclesCount,
      dronesEvaded: this.dronesEvadedRun,
      enemiesEliminated: this.dronesEvadedRun,
      obstaclesDodged: this.obstaclesDodgedRun,
      trainsPassed: this.trainsPassedRun,
      shieldBreaks: this.shieldBreaksRun,
      doubleJumps: this.doubleJumpsRun,
      parkourChains: this.parkourChainsRun,
      bossPhasesCleared: this.bossPhasesClearedRun,
      bossPhaseReached: bossDef ? this.bossPhase : 0,
      bossEncounteredId: bossDef ? bossDef.id : null,
      revivesUsed: this.revivesUsedRun,
      talismanAutoRevives: this.talismanUsedRun ? 1 : 0,
      storyChapterPlayed: this.mode === 'story' ? this.storyChapterNum : null,
      defeatCause: victory ? '' : (defeatCause ?? 'Colisión fatal en ruta'),
      bossDefeatedId: this.bossDefeatedId,
      abilitiesUsed: this.abilitiesUsedCount,
      slowMoUsed: this.slowMoUsedCount,
      secrets: this.secretsFoundRun,
      highlights: this.highlights,
    });
  }

  private recycleChunks(): void {
    const visibleCount = this.getVisibleChunksCount();
    const furthestAllowedZ = this.playerZ - (visibleCount - 1.5) * CHUNK_LEN;
    while (-this.nextChunkIndex * CHUNK_LEN > furthestAllowedZ) {
      this.spawnChunk(this.nextChunkIndex++, false);
    }

    while (
      this.chunks.length > 0 &&
      this.chunks[0].zStart - CHUNK_LEN > this.playerZ + 32
    ) {
      const old = this.chunks.shift()!;
      this.scene.remove(old.group);
      old.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (!this.sharedGeos.has(m.geometry)) {
            m.geometry.dispose();
          }
        }
      });
    }
  }

  private updateParticles(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const s = p.life / p.maxLife;
      _vec3A.set(p.x, p.y, p.z);
      _scaleVec.set(s, s, s);
      _quat.identity();
      _mat4.compose(_vec3A, _quat, _scaleVec);
      this.particleMesh.setMatrixAt(i, _mat4);
    }
    if (anyActive) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateWeatherAndSkyTraffic(dt: number): void {
    this.weatherPoints.visible =
      this.weather !== 'clear' && !this.settings.reduceVisualEffects;
    if (this.weatherPoints.visible) {
      this.weatherPoints.position.set(this.playerX, 0, this.playerZ - 18);
      const posAttr = this.weatherPoints.geometry.attributes
        .position as THREE.BufferAttribute;
      const fallSpeed =
        this.weather === 'rain' || this.weather === 'storm' ? 22 : 3.5;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - fallSpeed * dt;
        if (y < 0) y = 18;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }

    for (let i = 0; i < this.skyTrafficData.length; i++) {
      const car = this.skyTrafficData[i];
      car.z += car.speed * dt;
      if (car.z > this.playerZ + 40) car.z = this.playerZ - 190;
      if (car.z < this.playerZ - 210) car.z = this.playerZ + 30;
      _vec3A.set(car.x, car.y, car.z);
      _quat.identity();
      _scaleVec.set(1, 1, 1);
      _mat4.compose(_vec3A, _quat, _scaleVec);
      this.skyTrafficMesh.setMatrixAt(i, _mat4);
    }
    this.skyTrafficMesh.instanceMatrix.needsUpdate = true;

    if (this.cloudsMesh.visible) {
      for (let i = 0; i < this.cloudData.length; i++) {
        const cl = this.cloudData[i];
        cl.z += cl.speed * dt;
        if (cl.z > this.playerZ + 45) cl.z = this.playerZ - 200;
        _vec3A.set(cl.x, cl.y, cl.z);
        _quat.identity();
        _scaleVec.set(cl.sx, 1, cl.sx);
        _mat4.compose(_vec3A, _quat, _scaleVec);
        this.cloudsMesh.setMatrixAt(i, _mat4);
      }
      this.cloudsMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private emitHud(action: ParkourAction = 'idle'): void {
    const evt = this.activeEventId
      ? LIVE_EVENTS.find((e) => e.id === this.activeEventId)
      : null;
    const bossDef =
      this.mode === 'bosschase' || this.randomBossActive
        ? getBossById(this.activeBossId)
        : null;
    const vDef = getVehicleById(this.save.selectedVehicleId ?? 'hover_bike');
    const ridingVehicle = this.vehicleTimer > 0;
    const canDoubleJumpInForm = !ridingVehicle || Boolean(vDef.isShip);
    const memInfo = (
      performance as unknown as {
        memory?: { usedJSHeapSize: number };
      }
    ).memory;

    this.onHudUpdate({
      phase: this.mpPausedOverlay ? 'paused' : this.phase,
      mode: this.mode,
      districtId: this.district.id,
      districtName: this.district.name,
      laneCount: this.getLaneCount(),
      timePeriod: this.currentPeriod,
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      runDurationSec: Math.floor(this.runDurationSec),
      coinsRun: this.coinsRun,
      gemsRun: this.gemsRun,
      speedKmh: this.mpPausedOverlay ? 0 : Math.floor(this.forwardSpeed * 3.8),
      combo: this.combo,
      comboTimer: THREE.MathUtils.clamp(this.comboTimer / 4.2, 0, 1),
      momentum: Math.floor(this.momentum),
      boostCooldown: Number(this.sprintCooldown.toFixed(1)),
      boostMaxCooldown: this.SPRINT_COOLDOWN_MAX,
      boostActive: this.boostActive,
      slowMoEnergy: Math.floor(this.slowMoEnergy),
      isSlowMo: this.isSlowMo,
      vehicleAbilityLocked: ridingVehicle,
      abilityCharge: Math.floor(this.abilityCharge),
      abilityActive: this.abilityActiveTimer > 0,
      hasShield: this.hasShield,
      shieldCooldown: Number(this.shieldCooldown.toFixed(1)),
      shieldMaxCooldown: this.SHIELD_COOLDOWN_MAX,
      doubleJumpCharges: !canDoubleJumpInForm || this.doubleJumpCooldown > 0
        ? 0
        : this.jumpsUsed >= 2
          ? 0
          : 1,
      maxDoubleJumpCharges: 1,
      doubleJumpCooldown: Number(this.doubleJumpCooldown.toFixed(1)),
      doubleJumpBlockedReason: !canDoubleJumpInForm
        ? 'Bloqueado en vehículos terrestres'
        : this.doubleJumpBlockedReason,
      hasMagnet: this.magnetTimer > 0,
      magnetTimer: this.magnetTimer,
      isRidingVehicle: ridingVehicle,
      vehicleIsShip: Boolean(vDef.isShip),
      vehicleTimer: this.vehicleTimer,
      selectedVehicleId: this.save.selectedVehicleId ?? 'hover_bike',
      talismansHeld: this.liveTalismansHeld,
      reviveTokensHeld: this.liveReviveTokensHeld,
      talismanUsedRun: this.talismanUsedRun,
      revivePrompt: this.revivePrompt,
      pursuerDistance:
        this.mode === 'freerun' || this.mode === 'tutorial'
          ? null
          : Math.round(this.pursuerDistance),
      pursuerThreat:
        this.mode === 'freerun' || this.mode === 'tutorial'
          ? 0
          : THREE.MathUtils.clamp(1 - this.pursuerDistance / 22, 0, 1),
      randomBossActive: this.randomBossActive,
      storyChapter: this.storyChapterNum,
      storyObjectiveText: this.storyObjectiveText,
      parkourFloor: this.onFloor2 ? 2 : 1,
      parkourChain: this.parkourChainsRun,
      action,
      contextPrompt: this.contextPrompt,
      tutorialHint: this.tutorialHint,
      subtitleText: this.subtitleText,
      activeEventBanner: evt ? evt.title : null,
      activeDynamicEvent: this.activeDynamicEvent,
      sectorTransitionLabel: this.sectorTransitionText,
      objectiveCelebrationText: this.objectiveToastText,
      bossId: bossDef ? bossDef.id : null,
      bossName: bossDef ? bossDef.name : null,
      bossHp: this.bossHp,
      bossMaxHp: this.bossMaxHp,
      bossPhase: this.bossPhase,
      bossPhaseName: bossDef ? this.bossPhaseName : null,
      bossPhaseHp: this.bossPhaseHp,
      bossPhaseMaxHp: this.bossPhaseMaxHp,
      bossIntroActive: Boolean(bossDef && this.bossIntroTimer > 0),
      bossIntroTitle: bossDef && this.bossIntroTimer > 0 ? this.bossIntroTitle : null,
      bossIntroSubtitle: bossDef && this.bossIntroTimer > 0 ? this.bossIntroQuote : null,
      bossTransitionActive: Boolean(bossDef && this.bossPhaseTransitionTimer > 0),
      bossDistance: this.bossDistance,
      timeRemaining: this.timeRemaining,
      targetDistance: this.targetDistance,
      activeBanner: this.activeBanner,
      lastStuntText: this.lastStuntText,
      weather: this.weather,
      gravityScale:
        (evt ? evt.gravityScale : this.district.gravityMultiplier) *
        (this.lowGravTimer > 0 ? 0.55 : 1),
      secretsFoundRun: this.secretsFoundRun,
      dronesEvadedRun: this.dronesEvadedRun,
      enemiesEliminatedRun: this.dronesEvadedRun,
      obstaclesDodgedRun: this.obstaclesDodgedRun,
      trainsPassedRun: this.trainsPassedRun,
      shieldBreaksRun: this.shieldBreaksRun,
      doubleJumpsRun: this.doubleJumpsRun,
      activeRunContext: { ...this.activeRunContext },
      fps: this.currentFps,
      frameTimeMs: this.avgFrameTimeMs,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      memoryMb: memInfo ? Math.round(memInfo.usedJSHeapSize / 1048576) : null,
      perfWarning: this.perfWarning,
      tutorialStep: this.mode === 'tutorial' ? this.tutorialStepText : null,
      tutorialProgress:
        this.mode === 'tutorial'
          ? `${Math.round(this.tutorialStepProgress * 100)}%`
          : null,
      bossWarningText: this.bossWarningText,
      rainEventActive: this.rainEventState.active,
      difficultyStage: this.difficultyStage,
      isMultiplayer: this.isMultiplayer,
      mpPlayers: this.latestMpPlayers,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('resize', this.onResize);

    audioEngine.stopMusic();
    this.clearChunks();
    this.clearDynamicThreats();
    this.clearTransientVfx();
    this.clearRemoteRunners();
    this.companionFox?.dispose();
    this.playerRig?.dispose();
    this.vehicleShowcase?.dispose();
    if (this.hangarGroup) {
      this.scene.remove(this.hangarGroup);
      this.hangarGroup = null;
    }
    this.pursuerMesh?.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else m.material.dispose();
      }
    });
    this.captureDroneMesh?.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else m.material.dispose();
      }
    });
    this.textures?.dispose();
    this.sharedGeos.forEach((g) => g.dispose());
    this.collectiblePool.dispose();
    this.barrierFrameMat.dispose();
    this.gantryMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
