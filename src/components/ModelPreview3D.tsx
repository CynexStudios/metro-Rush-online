import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COSMETICS, getCharacterById, VEHICLES } from '../game/data';
import {
  ExtraGlbId,
  getCachedGlbForStyle,
  instantiateGlbRunner,
  preloadAllExtraGlbModels,
  updateGlbRunnerAnimation,
} from '../game/gltfAssets';
import {
  animateCharacterRig,
  buildCharacterRig,
  buildRelicGlbModel,
  buildSpecialItemShowcase,
  buildVehicleShowcaseModel,
  CharacterRig,
} from '../game/models';
import { createInitialSave } from '../game/storage';
import {
  CosmeticSlot,
  PlayerModelStyle,
  PlayerSaveData,
  VehicleId,
} from '../game/types';

export type CameraPreset = 'front' | 'side' | 'top' | 'orbit360';

export interface ModelPreview3DProps {
  kind: 'character' | 'vehicle' | 'cosmetic' | 'relic' | 'special' | 'skill';
  itemId: string;
  title?: string;
  subtitle?: string;
  characterId?: string;
  vehiclePaint?: string;
  modelStyle?: PlayerModelStyle;
  save?: PlayerSaveData;
  extraGlbId?: ExtraGlbId;
  specialKind?: 'talisman' | 'revive' | 'tickets' | 'shield' | 'skill';
  accentColor?: string;
  heightClass?: string;
}

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

const PRESET_ANGLES: Record<
  CameraPreset,
  { yaw: number; pitch: number; dist: number; targetY: number }
> = {
  front: { yaw: 0, pitch: 0.22, dist: 3.6, targetY: 0.95 },
  side: { yaw: Math.PI * 0.5, pitch: 0.18, dist: 3.7, targetY: 0.95 },
  top: { yaw: 0.35, pitch: 1.05, dist: 4.1, targetY: 0.65 },
  orbit360: { yaw: 0.55, pitch: 0.26, dist: 3.8, targetY: 0.95 },
};

export const ModelPreview3D: React.FC<ModelPreview3DProps> = ({
  kind,
  itemId,
  title,
  subtitle,
  characterId,
  vehiclePaint,
  modelStyle,
  save,
  extraGlbId,
  specialKind,
  accentColor = '#22d3ee',
  heightClass = 'h-64',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [preset, setPreset] = useState<CameraPreset>('orbit360');
  const [contextLost, setContextLost] = useState(false);
  const [glbReadyTick, setGlbReadyTick] = useState(0);

  const presetRef = useRef<CameraPreset>('orbit360');
  const dragRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    dist: number;
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    yaw: PRESET_ANGLES.orbit360.yaw,
    pitch: PRESET_ANGLES.orbit360.pitch,
    dist: PRESET_ANGLES.orbit360.dist,
  });

  useEffect(() => {
    presetRef.current = preset;
    const cfg = PRESET_ANGLES[preset];
    dragRef.current.yaw = cfg.yaw;
    dragRef.current.pitch = cfg.pitch;
    dragRef.current.dist = cfg.dist;
  }, [preset]);

  // Preload GLB files once so relic / soldier / xbot / robot previews render actual GLBs
  useEffect(() => {
    let alive = true;
    void preloadAllExtraGlbModels().then(() => {
      if (alive) setGlbReadyTick((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(240, mount.clientWidth || 340);
    const height = Math.max(180, mount.clientHeight || 256);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);

    // Three-point studio lighting
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.85);
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    keyLight.position.set(3.5, 5.5, 4.5);
    const rimLight = new THREE.DirectionalLight(accentColor, 1.45);
    rimLight.position.set(-3.5, 3.0, -4.0);
    scene.add(hemi, keyLight, rimLight);

    // Studio Pedestal Ring + Ground Disc
    const pedestalGroup = new THREE.Group();
    const baseDiscGeo = new THREE.CylinderGeometry(1.38, 1.5, 0.1, 36);
    const baseDiscMat = new THREE.MeshStandardMaterial({
      color: 0x0b1224,
      metalness: 0.78,
      roughness: 0.3,
    });
    const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
    baseDisc.position.y = -0.05;

    const ringGeo = new THREE.TorusGeometry(1.42, 0.025, 8, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.9,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.01;
    pedestalGroup.add(baseDisc, ringMesh);
    scene.add(pedestalGroup);

    // Build subject group
    const subjectHolder = new THREE.Group();
    scene.add(subjectHolder);

    const disposers: (() => void)[] = [];
    let activeRig: CharacterRig | null = null;
    let activeGlbAnim: ReturnType<typeof instantiateGlbRunner>['animState'] | null = null;
    let activeMixer: THREE.AnimationMixer | null = null;

    if (kind === 'character' || kind === 'cosmetic') {
      const charId = characterId || save?.selectedCharacterId || 'kai';
      const charDef = getCharacterById(charId);
      const effectiveEquipped: Record<CosmeticSlot, string | null> = {
        jacket: save?.equippedCosmetics?.jacket ?? null,
        hair: save?.equippedCosmetics?.hair ?? null,
        visor: save?.equippedCosmetics?.visor ?? null,
        sneakers: save?.equippedCosmetics?.sneakers ?? null,
        backpack: save?.equippedCosmetics?.backpack ?? null,
        trail: save?.equippedCosmetics?.trail ?? null,
      };
      if (kind === 'cosmetic') {
        const cos = COSMETICS.find((c) => c.id === itemId);
        if (cos) {
          effectiveEquipped[cos.slot] = cos.id;
        }
      }

      const style = modelStyle ?? save?.modelStyle ?? 'procedural';
      const cachedGlb = style !== 'procedural' && kind === 'character'
        ? getCachedGlbForStyle(style)
        : null;

      if (cachedGlb) {
        const inst = instantiateGlbRunner(cachedGlb, charDef);
        inst.modelGroup.rotation.y = Math.PI;
        subjectHolder.add(inst.modelGroup);
        activeGlbAnim = inst.animState;
        disposers.push(inst.disposeGlb);
      } else {
        const effectiveSave: PlayerSaveData = {
          ...(save ?? createInitialSave()),
          equippedCosmetics: effectiveEquipped,
          modelStyle: 'procedural',
        };
        const rig = buildCharacterRig(charDef, effectiveSave);
        rig.root.rotation.y = Math.PI;
        subjectHolder.add(rig.root);
        activeRig = rig;
      }
    } else if (kind === 'vehicle') {
      const vDef = VEHICLES.find((v) => v.id === itemId) ?? VEHICLES[0];
      const vRes = buildVehicleShowcaseModel(
        vDef.id as VehicleId,
        vehiclePaint || save?.vehiclePaints?.[vDef.id as VehicleId] || vDef.defaultPaint,
      );
      vRes.group.scale.setScalar(0.86);
      vRes.group.position.y = 0.08;
      subjectHolder.add(vRes.group);
      disposers.push(vRes.dispose);
    } else if (kind === 'relic') {
      const relicId: ExtraGlbId =
        extraGlbId ??
        (['fox', 'helmet', 'ion_drive', 'milk_truck'].includes(itemId)
          ? (itemId as ExtraGlbId)
          : 'helmet');
      const res = buildRelicGlbModel(
        relicId,
        relicId === 'milk_truck' ? 1.35 : 1.55,
        accentColor,
      );
      subjectHolder.add(res.group);
      activeMixer = res.mixer;
      disposers.push(res.dispose);
    } else {
      const spKind =
        specialKind ??
        (kind === 'skill'
          ? 'skill'
          : itemId.includes('talisman')
            ? 'talisman'
            : itemId.includes('revive')
              ? 'revive'
              : itemId.includes('ticket')
                ? 'tickets'
                : 'shield');
      const res = buildSpecialItemShowcase(spKind, accentColor);
      subjectHolder.add(res.group);
      disposers.push(res.dispose);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!mount) return;
      const w = Math.max(240, mount.clientWidth);
      const h = Math.max(180, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(mount);

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let curYaw = dragRef.current.yaw;
    let curPitch = dragRef.current.pitch;
    let curDist = dragRef.current.dist;

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
          return;
        }
      } catch {
        // Fallback timeout below
      }
      frameId = window.setTimeout(cb, 80);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      if (presetRef.current === 'orbit360' && !dragRef.current.active) {
        dragRef.current.yaw += dt * 0.65;
      }

      curYaw = THREE.MathUtils.damp(curYaw, dragRef.current.yaw, 9, dt);
      curPitch = THREE.MathUtils.damp(curPitch, dragRef.current.pitch, 9, dt);
      curDist = THREE.MathUtils.damp(curDist, dragRef.current.dist, 9, dt);

      const targetY = PRESET_ANGLES[presetRef.current].targetY;
      const cosP = Math.cos(curPitch);
      camera.position.set(
        Math.sin(curYaw) * cosP * curDist,
        targetY + Math.sin(curPitch) * curDist,
        Math.cos(curYaw) * cosP * curDist,
      );
      camera.lookAt(0, targetY, 0);

      if (activeRig) {
        animateCharacterRig(activeRig, 'idle', elapsed, 0, 0, dt);
      }
      if (activeGlbAnim) {
        updateGlbRunnerAnimation(activeGlbAnim, 'idle', dt, 0);
      }
      if (activeMixer) {
        activeMixer.update(dt);
      }
      if (kind === 'special' || kind === 'skill') {
        subjectHolder.rotation.y = Math.sin(elapsed * 0.9) * 0.25;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      disposers.forEach((d) => d());
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      envTarget.dispose();
      renderer.dispose();
      mount.innerHTML = '';
    };
  }, [
    kind,
    itemId,
    characterId,
    vehiclePaint,
    modelStyle,
    save?.selectedCharacterId,
    save?.equippedCosmetics,
    save?.modelStyle,
    save?.vehiclePaints,
    extraGlbId,
    specialKind,
    accentColor,
    glbReadyTick,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    dragRef.current.yaw -= dx * 0.012;
    dragRef.current.pitch = Math.max(-0.2, Math.min(1.25, dragRef.current.pitch + dy * 0.008));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    dragRef.current.dist = Math.max(2.1, Math.min(6.0, dragRef.current.dist + e.deltaY * 0.002));
  };

  return (
    <div className="rounded-xl bg-[#070b17] border border-cyan-500/30 overflow-hidden flex flex-col">
      <div
        className={`relative w-full ${heightClass} cursor-grab active:cursor-grabbing select-none bg-[#050812]`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div ref={mountRef} className="w-full h-full" />

        {contextLost && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060914] text-center p-4">
            <div className="text-xs font-bold text-cyan-300">Vista previa 3D en pausa</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {title || itemId}
            </div>
          </div>
        )}

        {(title || subtitle) && (
          <div className="pointer-events-none absolute top-2.5 left-3 right-3 flex items-start justify-between gap-2">
            <div className="bg-[#060913]/90 border border-white/15 rounded-lg px-2.5 py-1.5">
              {title && (
                <div className="font-display font-bold text-xs text-white leading-tight">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-[10px] text-cyan-300 leading-tight mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
            <div className="bg-[#060913]/90 border border-white/15 rounded-lg px-2 py-1 text-[10px] text-slate-300">
              Arrastra para rotar 360°
            </div>
          </div>
        )}
      </div>

      {/* Camera Angle Presets Bar */}
      <div className="flex items-center justify-between gap-1.5 p-2 bg-[#0b1224] border-t border-white/10">
        <span className="text-[11px] text-slate-400 pl-1">Ángulo 3D</span>
        <div className="flex items-center gap-1">
          {(
            [
              ['front', 'Frontal'],
              ['side', 'Lateral'],
              ['top', 'Superior'],
              ['orbit360', '360°'],
            ] as [CameraPreset, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                preset === id
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-[#070b17] text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
