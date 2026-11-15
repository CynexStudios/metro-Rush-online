import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CharacterDef, ParkourAction, PlayerModelStyle } from './types';

export interface GlbAnimationState {
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<'idle' | 'run' | 'jump' | 'slide' | 'celebrate' | 'stumble', THREE.AnimationAction>>;
  currentKey: string | null;
  lastPlayedTime: number;
}

const gltfLoader = new GLTFLoader();
const cachedGlb = new Map<string, GLTF>();
const pendingLoads = new Map<string, Promise<GLTF>>();
let customGlbData: GLTF | null = null;
let customGlbName: string | null = null;

export function getCustomGlbInfo(): { loaded: boolean; name: string | null } {
  return { loaded: customGlbData !== null, name: customGlbName };
}

export type ExtraGlbId = 'fox' | 'helmet' | 'ion_drive' | 'milk_truck';

const EXTRA_GLB_URLS: Record<ExtraGlbId, string> = {
  fox: '/models/Fox.glb',
  helmet: '/models/DamagedHelmet.glb',
  ion_drive: '/models/PrimaryIonDrive.glb',
  milk_truck: '/models/CesiumMilkTruck.glb',
};

function loadGlbByUrl(url: string): Promise<GLTF> {
  const existing = cachedGlb.get(url);
  if (existing) return Promise.resolve(existing);

  const inflight = pendingLoads.get(url);
  if (inflight) return inflight;

  const promise = new Promise<GLTF>((resolve, reject) => {
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
  pendingLoads.set(url, promise);
  return promise;
}

export async function preloadGlbModel(style: 'xbot' | 'robot' | 'soldier'): Promise<GLTF> {
  const url =
    style === 'xbot'
      ? '/models/Xbot.glb'
      : style === 'soldier'
        ? '/models/Soldier.glb'
        : '/models/RobotExpressive.glb';
  return loadGlbByUrl(url);
}

export async function preloadExtraGlbModel(id: ExtraGlbId): Promise<GLTF> {
  return loadGlbByUrl(EXTRA_GLB_URLS[id]);
}

export async function preloadAllExtraGlbModels(): Promise<void> {
  await Promise.allSettled([
    preloadGlbModel('xbot'),
    preloadGlbModel('robot'),
    preloadGlbModel('soldier'),
    preloadExtraGlbModel('fox'),
    preloadExtraGlbModel('helmet'),
    preloadExtraGlbModel('ion_drive'),
    preloadExtraGlbModel('milk_truck'),
  ]);
}

export function getCachedExtraGlb(id: ExtraGlbId): GLTF | null {
  return cachedGlb.get(EXTRA_GLB_URLS[id]) ?? null;
}

export async function parseCustomGlbFile(file: File): Promise<{ name: string; clipCount: number }> {
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
  if (style === 'xbot') return cachedGlb.get('/models/Xbot.glb') ?? null;
  if (style === 'robot') return cachedGlb.get('/models/RobotExpressive.glb') ?? null;
  if (style === 'soldier') return cachedGlb.get('/models/Soldier.glb') ?? null;
  if (style === 'custom') return customGlbData;
  return null;
}

export function instantiateStaticOrAnimatedGlb(
  gltf: GLTF,
  options: {
    targetHeight?: number;
    rotateY?: number;
    accentHex?: string;
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
            m.envMapIntensity = 0.9;
            if (accentColor && /emissive|glow|visor|trim|light/i.test(m.name || '')) {
              m.emissive.copy(accentColor);
              m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.5);
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

export function instantiateGlbRunner(
  gltf: GLTF,
  char: CharacterDef,
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
              m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.55);
            } else if (/alpha|primary|body|armor|torso|vanguard/i.test(matName)) {
              m.color.lerp(jacketColor, 0.25);
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

  // Compute normalized bounding box -> height 1.82m, feet grounded at y = 0, facing -Z
  const wrapper = new THREE.Group();
  clone.rotation.y = Math.PI; // glTF forward +Z -> game runner forward -Z
  clone.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

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
    const runClip = findClip(clips, [/^running$/i, /^run$/i, /sprint/i, /walk/i]);
    const jumpClip = findClip(clips, [/^jump$/i, /walkjump/i, /jump/i, /^running$/i, /^run$/i]);
    const slideClip = findClip(clips, [/sitting/i, /sneak/i, /crouch/i, /slide/i, /^walk$/i]);
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
  } else if (action === 'stumble') {
    targetKey = animState.actions.stumble ? 'stumble' : 'idle';
  } else if (action === 'slide' || action === 'vehicle') {
    targetKey = animState.actions.slide ? 'slide' : 'idle';
  } else if (
    action === 'jump' ||
    action === 'doubleJump' ||
    action === 'vault' ||
    action === 'dive' ||
    action === 'zipline' ||
    action === 'grapple'
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
