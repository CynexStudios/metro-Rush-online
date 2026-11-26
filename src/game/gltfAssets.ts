import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  BossDef,
  BossId,
  CharacterDef,
  CustomBossMeta,
  CustomBossValidationResult,
  ParkourAction,
  PlayerModelStyle,
} from './types';

export interface GlbAnimationState {
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<'idle' | 'run' | 'jump' | 'slide' | 'celebrate' | 'stumble', THREE.AnimationAction>>;
  currentKey: string | null;
  lastPlayedTime: number;
  hasNativeSlideClip: boolean;
}

const gltfLoader = new GLTFLoader();
let meshoptConfigured = false;
async function ensureMeshoptReady(): Promise<void> {
  if (!meshoptConfigured) {
    try {
      await MeshoptDecoder.ready;
      gltfLoader.setMeshoptDecoder(MeshoptDecoder);
      meshoptConfigured = true;
    } catch {
      // Fallback if MeshoptDecoder WASM fails in constrained context
      gltfLoader.setMeshoptDecoder(MeshoptDecoder);
      meshoptConfigured = true;
    }
  }
}

const cachedGlb = new Map<string, GLTF>();
const pendingLoads = new Map<string, Promise<GLTF>>();
let customGlbData: GLTF | null = null;
let customGlbName: string | null = null;

// Per-Boss Custom Blender Models (strictly validated, procedural fallback always preserved)
const customBossGlbMap = new Map<BossId, { gltf: GLTF; meta: CustomBossMeta }>();
const BOSS_IDB_NAME = 'metro_rush_custom_boss_db_v1';
const BOSS_IDB_STORE = 'boss_models';

export function getCustomGlbInfo(): { loaded: boolean; name: string | null } {
  return { loaded: customGlbData !== null, name: customGlbName };
}

export type ExtraGlbId =
  | 'helmet'
  | 'ion_drive'
  | 'milk_truck'
  | 'cesium_man'
  | 'brain_stem'
  | 'astronaut_a'
  | 'astronaut_b'
  | 'kenney_skyscraper_a'
  | 'kenney_skyscraper_b'
  | 'kenney_building_commercial'
  | 'kenney_building_industrial'
  | 'kenney_hangar'
  | 'kenney_cog'
  | 'kenney_factory_machine'
  | 'kenney_robot_arm'
  | 'kenney_monorail'
  | 'kenney_police'
  | 'kenney_race_future'
  | 'kenney_rover'
  | 'kenney_truck'
  | 'kenney_glider'
  | 'kenney_viper'
  | 'kenney_speeder'
  | 'kenney_bomber'
  | 'kenney_turret'
  | 'kenney_speedboat'
  | 'kenney_boat_fan';

const EXTRA_GLB_URLS: Record<ExtraGlbId, string> = {
  helmet: '/models/DamagedHelmet.glb',
  ion_drive: '/models/PrimaryIonDrive.glb',
  milk_truck: '/models/CesiumMilkTruck.glb',
  cesium_man: '/models/CesiumMan.glb',
  brain_stem: '/models/BrainStem.glb',
  astronaut_a: '/models/kenney_astronaut_a.glb',
  astronaut_b: '/models/kenney_astronaut_b.glb',
  kenney_skyscraper_a: '/models/kenney_skyscraper_a.glb',
  kenney_skyscraper_b: '/models/kenney_skyscraper_b.glb',
  kenney_building_commercial: '/models/kenney_building_commercial.glb',
  kenney_building_industrial: '/models/kenney_building_industrial.glb',
  kenney_hangar: '/models/kenney_hangar.glb',
  kenney_cog: '/models/kenney_cog.glb',
  kenney_factory_machine: '/models/kenney_factory_machine.glb',
  kenney_robot_arm: '/models/kenney_robot_arm.glb',
  kenney_monorail: '/models/kenney_monorail.glb',
  kenney_police: '/models/kenney_police.glb',
  kenney_race_future: '/models/kenney_race_future.glb',
  kenney_rover: '/models/kenney_rover.glb',
  kenney_truck: '/models/kenney_truck.glb',
  kenney_glider: '/models/kenney_glider.glb',
  kenney_viper: '/models/kenney_viper.glb',
  kenney_speeder: '/models/kenney_speeder.glb',
  kenney_bomber: '/models/kenney_bomber.glb',
  kenney_turret: '/models/kenney_turret.glb',
  kenney_speedboat: '/models/kenney_speedboat.glb',
  kenney_boat_fan: '/models/kenney_boat_fan.glb',
};

const RUNNER_MODEL_URLS: Record<
  'cesium_man' | 'brain_stem' | 'astronaut_a' | 'astronaut_b' | 'xbot' | 'robot' | 'soldier',
  string
> = {
  cesium_man: '/models/CesiumMan.glb',
  brain_stem: '/models/BrainStem.glb',
  astronaut_a: '/models/kenney_astronaut_a.glb',
  astronaut_b: '/models/kenney_astronaut_b.glb',
  xbot: '/models/Xbot.glb',
  robot: '/models/RobotExpressive.glb',
  soldier: '/models/Soldier.glb',
};

function loadGlbByUrl(url: string): Promise<GLTF> {
  const existing = cachedGlb.get(url);
  if (existing) return Promise.resolve(existing);

  const inflight = pendingLoads.get(url);
  if (inflight) return inflight;

  const promise = (async () => {
    await ensureMeshoptReady();
    return new Promise<GLTF>((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          cachedGlb.set(url, gltf);
          pendingLoads.delete(url);
          resolve(gltf);
        },
        undefined,
        (err) => {
          pendingLoads.delete(url);
          reject(err);
        },
      );
    });
  })();
  pendingLoads.set(url, promise);
  return promise;
}

export async function preloadGlbModel(
  style: 'cesium_man' | 'brain_stem' | 'astronaut_a' | 'astronaut_b' | 'xbot' | 'robot' | 'soldier',
): Promise<GLTF> {
  return loadGlbByUrl(RUNNER_MODEL_URLS[style]);
}

export async function preloadExtraGlbModel(id: ExtraGlbId): Promise<GLTF> {
  return loadGlbByUrl(EXTRA_GLB_URLS[id]);
}

export async function preloadAllExtraGlbModels(): Promise<void> {
  await ensureMeshoptReady();
  const ids = Object.keys(EXTRA_GLB_URLS) as ExtraGlbId[];
  await Promise.allSettled([
    preloadGlbModel('xbot'),
    preloadGlbModel('robot'),
    preloadGlbModel('soldier'),
    ...ids.map((id) => preloadExtraGlbModel(id)),
    restorePersistedCustomBosses(),
  ]);
}

export function getCachedExtraGlb(id: ExtraGlbId): GLTF | null {
  return cachedGlb.get(EXTRA_GLB_URLS[id]) ?? null;
}

export async function parseCustomGlbFile(file: File): Promise<{ name: string; clipCount: number }> {
  await ensureMeshoptReady();
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    gltfLoader.parse(
      buffer,
      '',
      (gltf) => {
        customGlbData = gltf;
        customGlbName = file.name;
        resolve({ name: file.name, clipCount: gltf.animations?.length ?? 0 });
      },
      (err) => {
        reject(err);
      },
    );
  });
}

export function getCachedGlbForStyle(style: PlayerModelStyle): GLTF | null {
  if (style === 'custom') return customGlbData;
  if (style === 'procedural') return null;
  const url = RUNNER_MODEL_URLS[style];
  return url ? (cachedGlb.get(url) ?? null) : null;
}

/**
 * Generates a Blender-ready base GLTF reference file + strict specification JSON
 * for creating custom 3D bosses compatible with Metro Rush 3.0.1.
 */
export function buildBossBlenderTemplateJson(boss: BossDef): string {
  // Valid minimal glTF 2.0 scene defining exact orientation (+Z facing player / -Z forward),
  // scale (approx 5m bounding box), named nodes (BossRoot, Core, Ring_Outer, Wing_L, Wing_R), and documentation extras.
  const template = {
    asset: {
      version: '2.0',
      generator: 'Metro Rush 3.0.1 Blender Boss Template',
      extras: {
        bossId: boss.id,
        bossName: boss.name,
        targetHeightMeters: 5.0,
        targetMaxWidthMeters: 7.5,
        recommendedMaxTriangles: 120000,
        recommendedMaxMeshes: 180,
        forwardAxis: '+Z hacia jugador (escena de arena frontal)',
        pivotOrigin: 'Centro del cuerpo en (0, 0, 0)',
        requiredNodeNames: ['BossRoot', 'Core'],
        optionalNodeNames: ['Ring_Outer', 'Wing_L', 'Wing_R'],
        recommendedAnimationClips: [
          'Idle',
          'Intro',
          'Attack',
          'PhaseTransition',
          'Defeat',
        ],
        blenderExportChecklist: [
          '1. Importar este archivo .gltf en Blender (File -> Import -> glTF 2.0).',
          '2. Mantener la escala en metros (altura objetivo ~5.0m, ancho max ~7.5m).',
          '3. Aplicar transformaciones (Ctrl+A -> All Transforms) antes de exportar.',
          '4. Usar materiales Principled BSDF PBR estándar (Base Color, Metallic, Roughness, Emission).',
          '5. Exportar como glTF Binary (.glb) con +Y Arriba activado.',
        ],
      },
    },
    scene: 0,
    scenes: [{ name: `${boss.id}_Template`, nodes: [0] }],
    nodes: [
      { name: 'BossRoot', children: [1, 2, 3, 4] },
      { name: 'Core', translation: [0, 0, 0], scale: [1.4, 1.4, 1.4] },
      { name: 'Ring_Outer', translation: [0, 0, 0], scale: [2.5, 2.5, 2.5] },
      { name: 'Wing_L', translation: [-2.4, 0.2, 0] },
      { name: 'Wing_R', translation: [2.4, 0.2, 0] },
    ],
  };
  return JSON.stringify(template, null, 2);
}

function openBossIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(BOSS_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(BOSS_IDB_STORE)) {
          db.createObjectStore(BOSS_IDB_STORE, { keyPath: 'bossId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveCustomBossBufferToIdb(
  bossId: BossId,
  buffer: ArrayBuffer,
  meta: CustomBossMeta,
): Promise<void> {
  const db = await openBossIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(BOSS_IDB_STORE, 'readwrite');
      tx.objectStore(BOSS_IDB_STORE).put({ bossId, buffer, meta });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteCustomBossFromIdb(bossId: BossId): Promise<void> {
  const db = await openBossIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(BOSS_IDB_STORE, 'readwrite');
      tx.objectStore(BOSS_IDB_STORE).delete(bossId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function restorePersistedCustomBosses(): Promise<void> {
  const db = await openBossIdb();
  if (!db) return;
  const rows = await new Promise<Array<{ bossId: BossId; buffer: ArrayBuffer; meta: CustomBossMeta }>>(
    (resolve) => {
      try {
        const tx = db.transaction(BOSS_IDB_STORE, 'readonly');
        const req = tx.objectStore(BOSS_IDB_STORE).getAll();
        req.onsuccess = () => resolve((req.result as Array<{ bossId: BossId; buffer: ArrayBuffer; meta: CustomBossMeta }>) ?? []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    },
  );
  for (const row of rows) {
    if (!row?.buffer || !row?.bossId) continue;
    try {
      const gltf = await new Promise<GLTF>((res, rej) =>
        gltfLoader.parse(row.buffer, '', res, rej),
      );
      customBossGlbMap.set(row.bossId, { gltf, meta: row.meta });
    } catch {
      // Ignore damaged entry
    }
  }
}

export function validateGlbOrGltfBinary(
  buffer: ArrayBuffer,
  fileName: string,
): { ok: boolean; error?: string; isBinaryGlb: boolean } {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
    return {
      ok: false,
      isBinaryGlb: false,
      error: 'Formato inválido: solo se admiten archivos .glb o .gltf exportados desde Blender.',
    };
  }
  if (buffer.byteLength < 20) {
    return { ok: false, isBinaryGlb: false, error: 'El archivo está vacío o incompleto.' };
  }
  if (buffer.byteLength > 25 * 1024 * 1024) {
    return {
      ok: false,
      isBinaryGlb: false,
      error: 'El archivo excede el límite máximo permitido de 25 MB.',
    };
  }
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  // 0x46546c67 == "glTF"
  if (lower.endsWith('.glb')) {
    if (magic !== 0x46546c67) {
      return {
        ok: false,
        isBinaryGlb: true,
        error: 'Cabecera GLB corrupta: el archivo no contiene firma binaria glTF 2.0 válida.',
      };
    }
    const gltfVersion = view.getUint32(4, true);
    if (gltfVersion !== 2) {
      return {
        ok: false,
        isBinaryGlb: true,
        error: `Versión glTF no compatible (${gltfVersion}). Exporta como glTF 2.0.`,
      };
    }
    return { ok: true, isBinaryGlb: true };
  }

  // JSON .gltf validation (strict non-executing parse)
  try {
    const text = new TextDecoder().decode(buffer);
    const json = JSON.parse(text) as { asset?: { version?: string }; meshes?: unknown[] };
    if (!json || typeof json !== 'object' || !json.asset?.version) {
      return {
        ok: false,
        isBinaryGlb: false,
        error: 'Estructura .gltf inválida: falta el bloque asset.version.',
      };
    }
    return { ok: true, isBinaryGlb: false };
  } catch {
    return {
      ok: false,
      isBinaryGlb: false,
      error: 'El archivo .gltf no contiene JSON válido.',
    };
  }
}

export async function validateAndStoreCustomBossGlb(
  file: File,
  boss: BossDef,
): Promise<CustomBossValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const buffer = await file.arrayBuffer();
  const headerCheck = validateGlbOrGltfBinary(buffer, file.name);
  if (!headerCheck.ok) {
    return { ok: false, errors: [headerCheck.error ?? 'Archivo inválido.'], warnings };
  }

  let gltf: GLTF;
  try {
    gltf = await new Promise<GLTF>((resolve, reject) => {
      gltfLoader.parse(buffer, '', resolve, reject);
    });
  } catch (err) {
    return {
      ok: false,
      errors: [
        `No se pudo analizar la geometría del modelo (${err instanceof Error ? err.message : 'formato dañado'}). Si usas .gltf, asegúrate de incrustar texturas o exportar en .glb binario.`,
      ],
      warnings,
    };
  }

  let meshCount = 0;
  let totalVertices = 0;
  let totalTriangles = 0;
  let hasSkeleton = false;
  let pbrMaterials = 0;

  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((obj) => {
    if ((obj as THREE.Bone).isBone || (obj as THREE.SkinnedMesh).isSkinnedMesh) {
      hasSkeleton = true;
    }
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      meshCount += 1;
      const pos = mesh.geometry.attributes.position;
      if (pos) totalVertices += pos.count;
      if (mesh.geometry.index) {
        totalTriangles += Math.floor(mesh.geometry.index.count / 3);
      } else if (pos) {
        totalTriangles += Math.floor(pos.count / 3);
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
          pbrMaterials += 1;
        }
      }
    }
  });

  if (meshCount === 0) {
    errors.push('El modelo no contiene ninguna malla 3D visible.');
  }
  if (meshCount > 180) {
    errors.push(`Demasiados sub-objetos (${meshCount}/180 máx). Une mallas en Blender antes de exportar.`);
  }
  if (totalTriangles > 120000) {
    errors.push(`Presupuesto de polígonos excedido (${totalTriangles.toLocaleString()} / 120.000 triángulos máx). Usa Decimate en Blender.`);
  }

  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (
    !Number.isFinite(size.x) ||
    !Number.isFinite(size.y) ||
    !Number.isFinite(size.z) ||
    Math.max(size.x, size.y, size.z) < 0.05
  ) {
    errors.push('Dimensiones degeneradas: el modelo es demasiado pequeño o vacío.');
  } else if (Math.max(size.x, size.y, size.z) > 500) {
    errors.push('Escala fuera de rango (>500m). Aplica escalas en Blender (Ctrl+A) antes de exportar.');
  }

  if (pbrMaterials === 0) {
    warnings.push('No se detectaron materiales PBR estándar; se aplicará iluminación adaptativa.');
  }
  const clips = (gltf.animations ?? []).map((c) => c.name || 'Clip');
  if (clips.length === 0) {
    warnings.push('Sin clips de animación: el motor aplicará flotación y rotación procedural automática.');
  }
  if (!hasSkeleton) {
    warnings.push('Modelo rígido (sin esqueleto/huesos); compatible como nave o núcleo.');
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const meta: CustomBossMeta = {
    bossId: boss.id,
    name: `${boss.name} (Blender)`,
    fileName: file.name,
    fileSizeBytes: file.size,
    vertices: totalVertices,
    triangles: totalTriangles,
    meshes: meshCount,
    clips,
    hasSkeleton,
    enabled: true,
    uploadedAt: new Date().toLocaleString('es-ES'),
  };

  customBossGlbMap.set(boss.id, { gltf, meta });
  await saveCustomBossBufferToIdb(boss.id, buffer, meta);

  return { ok: true, errors: [], warnings, meta };
}

export function getCustomBossEntry(bossId: BossId): { gltf: GLTF; meta: CustomBossMeta } | null {
  return customBossGlbMap.get(bossId) ?? null;
}

export function setCustomBossEnabledState(bossId: BossId, enabled: boolean): CustomBossMeta | null {
  const entry = customBossGlbMap.get(bossId);
  if (!entry) return null;
  entry.meta = { ...entry.meta, enabled };
  return entry.meta;
}

export async function removeCustomBossGlb(bossId: BossId): Promise<void> {
  customBossGlbMap.delete(bossId);
  await deleteCustomBossFromIdb(bossId);
}

export function instantiateCustomBossGlb(
  bossId: BossId,
  bossDef: BossDef,
): { group: THREE.Group; mixer: THREE.AnimationMixer | null } | null {
  const entry = customBossGlbMap.get(bossId);
  if (!entry || !entry.meta.enabled) return null;

  const res = instantiateStaticOrAnimatedGlb(entry.gltf, {
    targetHeight: 4.8,
    rotateY: 0,
    accentHex: bossDef.primaryColor,
    playClipRegex: /idle|loop|hover|fly/i,
  });
  const root = new THREE.Group();
  // Center vertically around y = 0 for aerial boss rig alignment
  const b = new THREE.Box3().setFromObject(res.modelGroup);
  const center = new THREE.Vector3();
  b.getCenter(center);
  res.modelGroup.position.y -= center.y;
  root.add(res.modelGroup);
  root.userData.bossId = bossId;
  root.userData.isCustomBoss = true;
  root.userData.customMixer = res.mixer;
  root.userData.rings = [];
  root.userData.wings = [];
  root.userData.segments = [];
  root.userData.core = res.modelGroup;
  return { group: root, mixer: res.mixer };
}

export function instantiateStaticOrAnimatedGlb(
  gltf: GLTF,
  options: {
    targetHeight?: number;
    rotateY?: number;
    accentHex?: string;
    tintHex?: string;
    playClipRegex?: RegExp;
  } = {},
): {
  modelGroup: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  dispose: () => void;
} {
  const clone = SkeletonUtils.clone(gltf.scene) as THREE.Group;
  const clonedMaterials: THREE.Material[] = [];
  const accentColor = options.accentHex ? new THREE.Color(options.accentHex) : null;
  const tintColor = options.tintHex ? new THREE.Color(options.tintHex) : null;

  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      if (mesh.material) {
        const cloneMat = (mat: THREE.Material): THREE.Material => {
          const m = mat.clone();
          clonedMaterials.push(m);
          if (m instanceof THREE.MeshStandardMaterial) {
            m.envMapIntensity = 0.85;
            if (accentColor && /emissive|glow|visor|trim|light|window/i.test(m.name || '')) {
              m.emissive.copy(accentColor);
              m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.52);
            } else if (tintColor && /paint|body|hull|main|car/i.test(m.name || '')) {
              m.color.lerp(tintColor, 0.35);
            }
          }
          return m;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(cloneMat)
          : cloneMat(mesh.material);
      }
    }
  });

  const wrapper = new THREE.Group();
  clone.rotation.y = options.rotateY ?? Math.PI;
  clone.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const targetH = options.targetHeight ?? 1.4;
  const scaleFactor = targetH / Math.max(0.01, size.y);
  clone.scale.multiplyScalar(scaleFactor);
  clone.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(clone);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  clone.position.x -= scaledCenter.x;
  clone.position.z -= scaledCenter.z;
  clone.position.y -= scaledBox.min.y;
  wrapper.add(clone);

  let mixer: THREE.AnimationMixer | null = null;
  const clips = gltf.animations ?? [];
  if (clips.length > 0) {
    mixer = new THREE.AnimationMixer(clone);
    const clip = options.playClipRegex
      ? clips.find((c) => options.playClipRegex!.test(c.name)) ?? clips[0]
      : clips[0];
    if (clip) {
      mixer.clipAction(clip).play();
    }
  }

  return {
    modelGroup: wrapper,
    mixer,
    dispose: () => {
      mixer?.stopAllAction();
      clonedMaterials.forEach((m) => m.dispose());
    },
  };
}

function findClip(clips: THREE.AnimationClip[], candidates: RegExp[]): THREE.AnimationClip | null {
  for (const rx of candidates) {
    const found = clips.find((c) => rx.test(c.name));
    if (found) return found;
  }
  return null;
}

function detectCustomGlbFacingMinusZ(root: THREE.Object3D): boolean {
  let headZ: number | null = null;
  let footZ: number | null = null;
  let toeZ: number | null = null;
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  root.traverse((obj) => {
    const name = (obj.name || '').toLowerCase();
    if (/head|visor|nose|face/.test(name) && headZ === null) {
      obj.getWorldPosition(v);
      headZ = v.z;
    } else if (/toe|footfront/.test(name) && toeZ === null) {
      obj.getWorldPosition(v);
      toeZ = v.z;
    } else if (/foot|ankle|heel/.test(name) && footZ === null) {
      obj.getWorldPosition(v);
      footZ = v.z;
    }
  });
  if (toeZ !== null && footZ !== null && Math.abs(toeZ - footZ) > 0.02) {
    return toeZ < footZ;
  }
  return false;
}

export function instantiateGlbRunner(
  gltf: GLTF,
  char: CharacterDef,
  style: PlayerModelStyle = 'xbot',
): {
  modelGroup: THREE.Group;
  animState: GlbAnimationState | null;
  disposeGlb: () => void;
} {
  const clone = SkeletonUtils.clone(gltf.scene) as THREE.Group;
  const clonedMaterials: THREE.Material[] = [];

  const accentColor = new THREE.Color(char.colors.accent);
  const jacketColor = new THREE.Color(char.colors.jacket);

  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.material) {
        const cloneMat = (mat: THREE.Material): THREE.Material => {
          const m = mat.clone();
          clonedMaterials.push(m);
          if (m instanceof THREE.MeshStandardMaterial) {
            m.envMapIntensity = 0.85;
            const matName = (m.name || '').toLowerCase();
            if (/joint|accent|glow|visor|eye|emissive|light|trim/i.test(matName)) {
              m.emissive.copy(accentColor);
              m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.52);
            } else if (/alpha|primary|body|armor|torso|vanguard|suit|cloth/i.test(matName)) {
              m.color.lerp(jacketColor, 0.3);
            }
          }
          return m;
        };
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(cloneMat);
        } else {
          mesh.material = cloneMat(mesh.material);
        }
      }
    }
  });

  const wrapper = new THREE.Group();
  // Soldier.glb root skeleton faces -Z natively; CesiumMan, BrainStem, Xbot, RobotExpressive, Astronaut face +Z.
  let rotY = Math.PI;
  if (style === 'soldier') {
    rotY = 0;
  } else if (style === 'custom') {
    rotY = detectCustomGlbFacingMinusZ(clone) ? 0 : Math.PI;
  }
  clone.rotation.y = rotY;
  clone.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);

  const safeH = Math.max(0.01, size.y);
  const scaleFactor = 1.82 / safeH;
  clone.scale.multiplyScalar(scaleFactor);
  clone.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(clone);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  clone.position.x -= scaledCenter.x;
  clone.position.z -= scaledCenter.z;
  clone.position.y -= scaledBox.min.y;
  wrapper.add(clone);

  let animState: GlbAnimationState | null = null;
  const clips = gltf.animations ?? [];
  if (clips.length > 0) {
    const mixer = new THREE.AnimationMixer(clone);
    const actions: GlbAnimationState['actions'] = {};

    const idleClip = findClip(clips, [/^idle$/i, /idle/i, /^standing$/i, /stand/i]);
    const runClip = findClip(clips, [/^running$/i, /^run$/i, /sprint/i, /walk/i]) ?? clips[0];
    const jumpClip = findClip(clips, [/^jump$/i, /walkjump/i, /jump/i, /^running$/i, /^run$/i]);
    const nativeSlideClip = findClip(clips, [/sitting/i, /sneak/i, /crouch/i, /slide/i, /roll/i]);
    const hasNativeSlideClip = Boolean(nativeSlideClip);
    const slideClip = nativeSlideClip ?? idleClip ?? runClip;
    const celebrateClip = findClip(clips, [/dance/i, /thumbsup/i, /wave/i, /agree/i, /^idle$/i]);
    const stumbleClip = findClip(clips, [/death/i, /sad/i, /punch/i, /no/i, /^idle$/i]);

    if (idleClip) actions.idle = mixer.clipAction(idleClip);
    if (runClip) actions.run = mixer.clipAction(runClip);
    if (jumpClip) actions.jump = mixer.clipAction(jumpClip);
    if (slideClip) actions.slide = mixer.clipAction(slideClip);
    if (celebrateClip) actions.celebrate = mixer.clipAction(celebrateClip);
    if (stumbleClip) actions.stumble = mixer.clipAction(stumbleClip);

    if (!actions.idle && clips[0]) {
      actions.idle = mixer.clipAction(clips[0]);
    }
    if (!actions.run) {
      actions.run = actions.idle;
    }

    if (actions.idle) {
      actions.idle.play();
    }
    animState = {
      mixer,
      actions,
      currentKey: 'idle',
      lastPlayedTime: 0,
      hasNativeSlideClip,
    };
  }

  return {
    modelGroup: wrapper,
    animState,
    disposeGlb: () => {
      animState?.mixer.stopAllAction();
      clonedMaterials.forEach((m) => m.dispose());
    },
  };
}

export function updateGlbRunnerAnimation(
  animState: GlbAnimationState,
  action: ParkourAction,
  dt: number,
  speedRatio: number,
): void {
  let targetKey: keyof GlbAnimationState['actions'] = 'run';
  let timeScale = 1.0;

  if (action === 'idle') {
    targetKey = 'idle';
  } else if (action === 'celebrate') {
    targetKey = animState.actions.celebrate ? 'celebrate' : 'idle';
  } else if (action === 'stumble' || action === 'captureStruggle') {
    targetKey = animState.actions.stumble ? 'stumble' : 'idle';
    timeScale = action === 'captureStruggle' ? 1.3 : 1.0;
  } else if (action === 'slide' || action === 'vehicle') {
    targetKey = animState.actions.slide ? 'slide' : 'idle';
    timeScale = action === 'slide' && !animState.hasNativeSlideClip ? 0.45 : 1.0;
  } else if (
    action === 'jump' ||
    action === 'doubleJump' ||
    action === 'vault' ||
    action === 'dive' ||
    action === 'zipline' ||
    action === 'grapple' ||
    action === 'swingBar'
  ) {
    targetKey = animState.actions.jump ? 'jump' : 'run';
    timeScale = 1.1;
  } else {
    targetKey = 'run';
    timeScale = action === 'sprint' ? 1.45 : 1.05 + speedRatio * 0.35;
  }

  if (animState.currentKey !== targetKey) {
    const prev = animState.currentKey
      ? animState.actions[animState.currentKey as keyof GlbAnimationState['actions']]
      : undefined;
    const next = animState.actions[targetKey];
    if (next && next !== prev) {
      next.reset();
      next.setEffectiveTimeScale(timeScale);
      next.setEffectiveWeight(1);
      next.play();
      if (prev) {
        prev.crossFadeTo(next, 0.14, true);
      }
    }
    animState.currentKey = targetKey;
  } else {
    const active = animState.actions[targetKey];
    if (active) {
      active.setEffectiveTimeScale(timeScale);
    }
  }

  animState.mixer.update(dt);
}
