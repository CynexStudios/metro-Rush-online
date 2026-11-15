import * as THREE from 'three';
import { COSMETICS, getVehicleById } from './data';
import {
  ExtraGlbId,
  getCachedExtraGlb,
  getCachedGlbForStyle,
  GlbAnimationState,
  instantiateGlbRunner,
  instantiateStaticOrAnimatedGlb,
  updateGlbRunnerAnimation,
} from './gltfAssets';
import { ProceduralTexturePack } from './materials';
import {
  BossId,
  CharacterDef,
  DistrictDef,
  EnemyClass,
  ParkourAction,
  PlayerModelStyle,
  PlayerSaveData,
  VehicleId,
} from './types';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  backpackGroup: THREE.Group;
  shieldMesh: THREE.Mesh;
  hoverBikeGroup: THREE.Group;
  glbAnim: GlbAnimationState | null;
  isGlb: boolean;
  dispose: () => void;
}

export interface CollectibleAssetPool {
  coinRimGeo: THREE.CylinderGeometry;
  coinCoreGeo: THREE.CylinderGeometry;
  coinRingGeo: THREE.TorusGeometry;
  gemGeo: THREE.OctahedronGeometry;
  gemRingGeo: THREE.TorusGeometry;
  secretCoreGeo: THREE.OctahedronGeometry;
  secretFrameGeo: THREE.BoxGeometry;
  empCoreGeo: THREE.CylinderGeometry;
  empCapGeo: THREE.CylinderGeometry;
  empRingGeo: THREE.TorusGeometry;
  shieldDiscGeo: THREE.CylinderGeometry;
  shieldRingGeo: THREE.TorusGeometry;
  magnetArcGeo: THREE.ExtrudeGeometry;
  magnetTipGeo: THREE.BoxGeometry;
  slowmoConeGeo: THREE.ConeGeometry;
  slowmoRingGeo: THREE.TorusGeometry;
  talismanCoreGeo: THREE.OctahedronGeometry;
  talismanWingGeo: THREE.ConeGeometry;
  talismanRingGeo: THREE.TorusGeometry;

  coinMat: THREE.MeshStandardMaterial;
  coinGlowMat: THREE.MeshStandardMaterial;
  gemMat: THREE.MeshPhysicalMaterial;
  secretMat: THREE.MeshStandardMaterial;
  secretCageMat: THREE.MeshStandardMaterial;
  empMat: THREE.MeshStandardMaterial;
  empCapMat: THREE.MeshStandardMaterial;
  shieldMat: THREE.MeshPhysicalMaterial;
  magnetMat: THREE.MeshStandardMaterial;
  magnetTipMat: THREE.MeshStandardMaterial;
  slowmoMat: THREE.MeshPhysicalMaterial;
  talismanMat: THREE.MeshPhysicalMaterial;
  talismanRingMat: THREE.MeshStandardMaterial;

  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  dispose: () => void;
}

function getCosmeticColor(
  save: PlayerSaveData,
  slot: keyof PlayerSaveData['equippedCosmetics'],
  fallback: string,
): string {
  const id = save.equippedCosmetics[slot];
  if (!id || id.endsWith('_default')) return fallback;
  const item = COSMETICS.find((c) => c.id === id);
  return item ? item.color : fallback;
}

/**
 * Shared Sculpted 4-Vehicle Factory (Used in Gameplay & 3D Garage Turntable)
 */
export function createVehicleGroup(
  vehicleId: VehicleId,
  paintHex: string,
  accentHex: string,
  visorMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: paintHex,
    metalness: 0.84,
    roughness: 0.2,
    clearcoat: 0.92,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.78,
    roughness: 0.36,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.74,
    roughness: 0.34,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.95,
    roughness: 0.2,
  });

  if (vehicleId === 'cyber_coupe') {
    const carShape = new THREE.Shape();
    carShape.moveTo(-1.5, 0.24);
    carShape.lineTo(-1.62, 0.56);
    carShape.lineTo(-0.85, 0.74);
    carShape.lineTo(-0.25, 1.05);
    carShape.lineTo(0.65, 1.05);
    carShape.lineTo(1.35, 0.72);
    carShape.lineTo(1.58, 0.52);
    carShape.lineTo(1.48, 0.24);
    carShape.closePath();

    const carGeo = new THREE.ExtrudeGeometry(carShape, {
      depth: 1.32,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    carGeo.center();
    carGeo.rotateY(Math.PI / 2);
    const chassis = new THREE.Mesh(carGeo, hullMat);
    chassis.position.set(0, 0.56, 0);
    chassis.castShadow = true;
    g.add(chassis);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.28, 1.2), visorMat);
    canopy.position.set(0, 0.88, -0.05);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.08, 0.28), darkMat);
    spoiler.position.set(0, 1.02, 1.34);
    const spoilerStrip = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.05, 0.08), glowMat);
    spoilerStrip.position.set(0, 1.04, 1.46);
    g.add(canopy, spoiler, spoilerStrip);

    for (const sx of [-0.68, 0.68]) {
      for (const sz of [-1.02, 1.02]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 14), darkMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx, 0.26, sz);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), glowMat);
        rim.rotation.y = Math.PI / 2;
        rim.position.set(sx + Math.sign(sx) * 0.08, 0.26, sz);
        g.add(wheel, rim);
      }
    }

    const headBar = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.09, 0.1), glowMat);
    headBar.position.set(0, 0.44, -1.58);
    g.add(headBar);
    return g;
  }

  if (vehicleId === 'quantum_glider') {
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 1.55);
    wingShape.lineTo(1.38, -0.75);
    wingShape.lineTo(0.45, -1.25);
    wingShape.lineTo(0, -0.95);
    wingShape.lineTo(-0.45, -1.25);
    wingShape.lineTo(-1.38, -0.75);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);
    const wing = new THREE.Mesh(wingGeo, hullMat);
    wing.position.set(0, 0.45, 0);
    wing.castShadow = true;
    g.add(wing);

    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.35, 10), darkMat);
    fuselage.rotation.x = -Math.PI / 2;
    fuselage.position.set(0, 0.56, -0.15);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.85), visorMat);
    cockpit.position.set(0, 0.72, -0.25);
    const haloCore = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 22), glowMat);
    haloCore.position.set(0, 0.62, 0.88);
    g.add(fuselage, cockpit, haloCore);

    for (const sx of [-1.25, 1.25]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.65), trimMat);
      fin.position.set(sx, 0.6, 0.72);
      fin.rotation.z = sx * -0.22;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.72), glowMat);
      tip.position.set(sx, 0.78, 0.72);
      g.add(fin, tip);
    }
    return g;
  }

  if (vehicleId === 'titan_rammer') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.68, 2.65), hullMat);
    hull.position.set(0, 0.62, 0.05);
    hull.castShadow = true;
    const prow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.92, 0.95, 4), trimMat);
    prow.rotation.y = Math.PI / 4;
    prow.rotation.x = -Math.PI / 2;
    prow.scale.set(1.2, 0.65, 1.0);
    prow.position.set(0, 0.5, -1.42);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 0.68), visorMat);
    visor.position.set(0, 0.98, -0.35);
    const ramStrip = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.14, 0.18), glowMat);
    ramStrip.position.set(0, 0.42, -1.82);
    g.add(hull, prow, visor, ramStrip);

    for (const sx of [-0.88, 0.88]) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 2.35), darkMat);
      tread.position.set(sx, 0.34, 0);
      const glowTrack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 2.2), glowMat);
      glowTrack.position.set(sx, 0.34, 0);
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 12), glowMat);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(sx * 0.52, 0.64, 1.48);
      g.add(tread, glowTrack, thruster);
    }
    return g;
  }

  // Default: 'hover_bike'
  const hullProfile = new THREE.Shape();
  hullProfile.moveTo(-1.15, 0.25);
  hullProfile.lineTo(-1.55, 0.36);
  hullProfile.lineTo(-1.35, 0.56);
  hullProfile.lineTo(-0.55, 0.68);
  hullProfile.lineTo(0.25, 0.52);
  hullProfile.lineTo(0.95, 0.72);
  hullProfile.lineTo(1.25, 0.62);
  hullProfile.lineTo(1.18, 0.32);
  hullProfile.lineTo(0.45, 0.22);
  hullProfile.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullProfile, {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  hullGeo.center();
  hullGeo.rotateY(Math.PI / 2);
  const fuselage = new THREE.Mesh(hullGeo, hullMat);
  fuselage.position.set(0, 0.46, -0.05);
  fuselage.castShadow = true;
  g.add(fuselage);

  for (const sx of [-0.26, 0.26]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.85), trimMat);
    fork.position.set(sx, 0.4, -1.18);
    fork.rotation.x = 0.15;
    const intakeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.55), glowMat);
    intakeGlow.position.set(sx * 1.38, 0.44, -0.2);
    g.add(fork, intakeGlow);
  }

  for (const rz of [-0.92, 0.78]) {
    const repRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 8, 18), trimMat);
    repRing.rotation.x = Math.PI / 2;
    repRing.position.set(0, 0.16, rz);
    const repCore = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), glowMat);
    repCore.position.set(0, 0.15, rz);
    g.add(repRing, repCore);
  }

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.62), visorMat);
  canopy.position.set(0, 0.78, -0.72);
  canopy.rotation.x = 0.45;
  g.add(canopy);

  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.78, 8), trimMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 0.78, -0.45);
  g.add(handlebar);

  for (const sx of [-0.17, 0.17]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.28, 12), trimMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(sx, 0.48, 1.24);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.34, 10), glowMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(sx, 0.48, 1.48);
    g.add(nozzle, flame);
  }

  return g;
}

/**
 * 3D Garage Turntable Showcase Builder
 */
export function buildVehicleShowcaseModel(
  vehicleId: VehicleId,
  paintHex: string,
): { group: THREE.Group; dispose: () => void } {
  const def = getVehicleById(vehicleId);
  const root = new THREE.Group();

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: def.accentColor,
    emissive: def.accentColor,
    emissiveIntensity: 0.75,
    roughness: 0.1,
    metalness: 0.8,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85,
  });

  const padMat = new THREE.MeshStandardMaterial({
    color: 0x0b1224,
    metalness: 0.85,
    roughness: 0.25,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: def.accentColor,
    emissive: def.accentColor,
    emissiveIntensity: 0.95,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.92, 0.14, 32), padMat);
  plinth.position.y = 0.07;
  const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.04, 8, 36), rimMat);
  plinthRing.rotation.x = Math.PI / 2;
  plinthRing.position.y = 0.15;
  root.add(plinth, plinthRing);

  const vehicleMesh = createVehicleGroup(vehicleId, paintHex, def.accentColor, visorMat);
  vehicleMesh.position.y = 0.22;
  root.add(vehicleMesh);

  return {
    group: root,
    dispose: () => {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
    },
  };
}

/**
 * 3D Pursuer Enforcer Rig (Chases dynamically behind player!)
 */
export function buildPursuerModel(accentHex = '#ef4444'): THREE.Group {
  const g = new THREE.Group();
  const armorMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.86,
    roughness: 0.22,
    clearcoat: 0.85,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.72,
    roughness: 0.35,
  });
  const sirenRedMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.0,
  });
  const sirenBlueMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#38bdf8',
    emissiveIntensity: 1.0,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 0.42), armorMat);
  torso.position.y = 1.24;
  torso.castShadow = true;

  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), sirenRedMat);
  chestCore.position.set(0, 1.3, -0.22);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), armorMat);
  head.position.y = 1.84;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.2), sirenRedMat);
  visor.position.set(0, 1.85, -0.16);

  const sirenL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), sirenRedMat);
  sirenL.position.set(-0.36, 1.72, 0);
  sirenL.name = 'sirenL';
  const sirenR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), sirenBlueMat);
  sirenR.position.set(0.36, 1.72, 0);
  sirenR.name = 'sirenR';

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.2), trimMat);
  pack.position.set(0, 1.28, 0.26);

  const legL = new THREE.Group();
  legL.position.set(-0.18, 0.85, 0);
  legL.name = 'legL';
  const lMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.65, 5, 8), armorMat);
  lMesh.position.y = -0.38;
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.34), sirenRedMat);
  lBoot.position.set(0, -0.78, -0.06);
  legL.add(lMesh, lBoot);

  const legR = new THREE.Group();
  legR.position.set(0.18, 0.85, 0);
  legR.name = 'legR';
  const rMesh = lMesh.clone();
  const rBoot = lBoot.clone();
  legR.add(rMesh, rBoot);

  const armL = new THREE.Group();
  armL.position.set(-0.44, 1.54, 0);
  armL.name = 'armL';
  const aMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.48, 5, 8), trimMat);
  aMeshL.position.y = -0.26;
  armL.add(aMeshL);

  const armR = new THREE.Group();
  armR.position.set(0.44, 1.54, 0);
  armR.name = 'armR';
  const aMeshR = aMeshL.clone();
  armR.add(aMeshR);

  g.add(torso, chestCore, head, visor, sirenL, sirenR, pack, legL, legR, armL, armR);
  return g;
}

/**
 * 24+ Part Sculpted Composite 3D Character Rig OR Real Loaded .GLB Skeletal Rig
 */
export function buildCharacterRig(
  char: CharacterDef,
  save: PlayerSaveData,
): CharacterRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const visorColor = getCosmeticColor(save, 'visor', char.colors.visor);
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 0.8,
    roughness: 0.12,
    metalness: 0.75,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85,
  });

  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 20, 14),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    }),
  );
  shieldMesh.position.set(0, 1.05, 0);
  shieldMesh.visible = false;
  root.add(shieldMesh);

  const vehicleId: VehicleId = save.selectedVehicleId ?? 'hover_bike';
  const vehicleDef = getVehicleById(vehicleId);
  const vehiclePaint = save.vehiclePaints?.[vehicleId] || vehicleDef.defaultPaint;
  const hoverBikeGroup = createVehicleGroup(
    vehicleId,
    vehiclePaint,
    char.colors.accent || vehicleDef.accentColor,
    visorMat,
  );
  hoverBikeGroup.visible = false;
  root.add(hoverBikeGroup);

  // Check if user selected a real .GLB skeletal character model and it is loaded
  const modelStyle: PlayerModelStyle = save.modelStyle ?? 'procedural';
  if (modelStyle !== 'procedural') {
    const gltf = getCachedGlbForStyle(modelStyle);
    if (gltf) {
      const { modelGroup, animState, disposeGlb } = instantiateGlbRunner(gltf, char);
      bodyPivot.add(modelGroup);

      const emptyGrp = () => new THREE.Group();
      return {
        root,
        bodyPivot,
        torso: emptyGrp(),
        headGroup: emptyGrp(),
        leftArm: emptyGrp(),
        rightArm: emptyGrp(),
        leftLeg: emptyGrp(),
        rightLeg: emptyGrp(),
        leftForearm: emptyGrp(),
        rightForearm: emptyGrp(),
        leftShin: emptyGrp(),
        rightShin: emptyGrp(),
        backpackGroup: emptyGrp(),
        shieldMesh,
        hoverBikeGroup,
        glbAnim: animState,
        isGlb: true,
        dispose: () => {
          disposeGlb();
          shieldMesh.geometry.dispose();
          (shieldMesh.material as THREE.Material).dispose();
          hoverBikeGroup.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              m.geometry.dispose();
              if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
              else m.material.dispose();
            }
          });
        },
      };
    }
  }

  // ---- Sculpted Composite Procedural Cyber-Runner (Full Cosmetics Support) ----
  const jacketColor = getCosmeticColor(save, 'jacket', char.colors.jacket);
  const sneakersColor = getCosmeticColor(save, 'sneakers', char.colors.sneakers);
  const hairCosmetic = COSMETICS.find((c) => c.id === save.equippedCosmetics.hair);
  const hairColor =
    hairCosmetic && !hairCosmetic.id.endsWith('_default')
      ? hairCosmetic.color
      : char.colors.hair;
  const hairStyle =
    hairCosmetic?.styleVariant && hairCosmetic.styleVariant !== 'default'
      ? hairCosmetic.styleVariant
      : char.hairStyle;

  const skinMat = new THREE.MeshStandardMaterial({
    color: char.colors.skin,
    roughness: 0.58,
    metalness: 0.05,
  });
  const jacketMat = new THREE.MeshPhysicalMaterial({
    color: jacketColor,
    roughness: 0.32,
    metalness: 0.28,
    clearcoat: 0.55,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: char.colors.accent,
    emissive: char.colors.accent,
    emissiveIntensity: 0.88,
    roughness: 0.22,
    metalness: 0.55,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: char.colors.pants,
    roughness: 0.68,
    metalness: 0.16,
  });
  const sneakerMat = new THREE.MeshStandardMaterial({
    color: sneakersColor,
    roughness: 0.28,
    metalness: 0.35,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.45,
    metalness: 0.26,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.42,
    metalness: 0.68,
  });

  const torso = new THREE.Group();
  torso.position.set(0, 0.88, 0);
  bodyPivot.add(torso);

  const pelvis = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.155, 0.16, 6, 12),
    pantsMat,
  );
  pelvis.rotation.z = Math.PI / 2;
  pelvis.castShadow = true;
  torso.add(pelvis);

  // Sculpted Torso Jacket
  const chestShape = new THREE.Shape();
  chestShape.moveTo(-0.21, 0.04);
  chestShape.lineTo(0.21, 0.04);
  chestShape.lineTo(0.28, 0.46);
  chestShape.lineTo(0.15, 0.55);
  chestShape.lineTo(-0.15, 0.55);
  chestShape.lineTo(-0.28, 0.46);
  chestShape.closePath();

  const chestGeo = new THREE.ExtrudeGeometry(chestShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.032,
    bevelSegments: 2,
  });
  chestGeo.center();
  const chest = new THREE.Mesh(chestGeo, jacketMat);
  chest.position.set(0, 0.31, 0);
  chest.castShadow = true;
  torso.add(chest);

  // Tactical Chest Plate + Core Emblem
  const chestArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.24, 0.32),
    jointMat,
  );
  chestArmor.position.set(0, 0.37, -0.01);
  torso.add(chestArmor);

  const chestCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.065, 0),
    accentMat,
  );
  chestCore.position.set(0, 0.39, -0.175);
  torso.add(chestCore);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.075, 0.3), jointMat);
  belt.position.set(0, 0.08, 0);
  const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.32), accentMat);
  beltBuckle.position.set(0, 0.08, -0.01);
  torso.add(belt, beltBuckle);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.22, 0.13, 14),
    jacketMat,
  );
  collar.position.set(0, 0.58, 0.01);
  torso.add(collar);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.67, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.092, 0.1, 10),
    skinMat,
  );
  neck.position.set(0, 0.02, 0);
  headGroup.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.172, 18, 16),
    skinMat,
  );
  head.scale.set(0.95, 1.07, 1.0);
  head.position.set(0, 0.19, 0);
  head.castShadow = true;
  headGroup.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: char.colors.accent,
    emissiveIntensity: 0.78,
  });
  const eyeGeo = new THREE.BoxGeometry(0.052, 0.026, 0.03);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.064, 0.21, -0.155);
  const eyeR = eyeL.clone();
  eyeR.position.set(0.064, 0.21, -0.155);
  headGroup.add(eyeL, eyeR);

  // Framed Cyber-Visor + Ear Comms
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.186,
      0.186,
      0.09,
      18,
      1,
      false,
      -Math.PI * 0.36,
      Math.PI * 0.72,
    ),
    visorMat,
  );
  visor.rotation.y = Math.PI;
  visor.position.set(0, 0.21, -0.01);
  headGroup.add(visor);

  for (const sx of [-0.17, 0.17]) {
    const earPod = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.035, 10), jointMat);
    earPod.rotation.z = Math.PI / 2;
    earPod.position.set(sx, 0.21, 0);
    const earGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 10), accentMat);
    earGlow.rotation.z = Math.PI / 2;
    earGlow.position.set(sx, 0.21, 0);
    headGroup.add(earPod, earGlow);
  }

  if (hairStyle === 'cyberhelm') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.208, 18, 16), hairMat);
    helm.position.set(0, 0.2, 0.01);
    const helmCrest = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.38), accentMat);
    helmCrest.position.set(0, 0.385, 0.02);
    headGroup.add(helm, helmCrest);
  } else if (hairStyle === 'mohawk') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.184, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      pantsMat,
    );
    cap.position.set(0, 0.21, 0);
    headGroup.add(cap);
    for (let s = 0; s < 4; s++) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), hairMat);
      fin.position.set(0, 0.39 - s * 0.025, -0.07 + s * 0.075);
      fin.rotation.x = 0.22 * s;
      headGroup.add(fin);
    }
  } else if (hairStyle === 'ponytail') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.188, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat,
    );
    dome.position.set(0, 0.21, 0.01);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 12), accentMat);
    band.position.set(0, 0.25, 0.17);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.38, 10), hairMat);
    tail.rotation.x = Math.PI * 0.72;
    tail.position.set(0, 0.21, 0.25);
    headGroup.add(dome, band, tail);
  } else if (hairStyle === 'hood') {
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.224, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.75),
      jacketMat,
    );
    hood.rotation.x = -0.35;
    hood.position.set(0, 0.2, 0.04);
    headGroup.add(hood);
  } else {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.188, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat,
    );
    dome.position.set(0, 0.21, 0.01);
    headGroup.add(dome);
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.17, 6), hairMat);
      spike.position.set(i * 0.075, 0.38, -0.03);
      spike.rotation.x = -0.35;
      spike.rotation.z = -i * 0.25;
      headGroup.add(spike);
    }
  }

  // Backpack Cosmetics
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.34, 0.17);
  torso.add(backpackGroup);

  const packId = save.equippedCosmetics.backpack;
  if (packId === 'backpack_wings') {
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.1), jointMat);
    backpackGroup.add(core);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.05);
    wingShape.lineTo(0.62, 0.14);
    wingShape.lineTo(0.48, -0.04);
    wingShape.lineTo(0.1, -0.11);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
    });
    const rightWing = new THREE.Mesh(wingGeo, accentMat);
    rightWing.position.set(0.08, 0.05, 0.03);
    const leftWing = rightWing.clone();
    leftWing.scale.x = -1;
    leftWing.position.set(-0.08, 0.05, 0.03);
    backpackGroup.add(leftWing, rightWing);
  } else if (packId === 'backpack_halo') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.032, 10, 28), accentMat);
    halo.position.set(0, 0.12, 0.08);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), jointMat);
    core.position.set(0, 0.12, 0.06);
    backpackGroup.add(halo, core);
  } else if (packId === 'backpack_thruster') {
    const thrusterPts = [
      new THREE.Vector2(0.01, -0.17),
      new THREE.Vector2(0.082, -0.17),
      new THREE.Vector2(0.058, -0.06),
      new THREE.Vector2(0.078, 0.15),
      new THREE.Vector2(0.01, 0.17),
    ];
    const jetGeo = new THREE.LatheGeometry(thrusterPts, 14);
    const jetL = new THREE.Mesh(jetGeo, jacketMat);
    jetL.position.set(-0.115, 0, 0.05);
    const jetR = jetL.clone();
    jetR.position.set(0.115, 0, 0.05);
    const glowL = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 10), accentMat);
    glowL.rotation.x = Math.PI;
    glowL.position.set(-0.115, -0.22, 0.05);
    const glowR = glowL.clone();
    glowR.position.set(0.115, -0.22, 0.05);
    backpackGroup.add(jetL, jetR, glowL, glowR);
  } else {
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.08), jointMat);
    const spineGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.095), accentMat);
    backpackGroup.add(spine, spineGlow);
  }

  // Sculpted Arms + Pauldrons + Gauntlets
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.31, 0.48, 0);

    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.098, 12, 10), jacketMat);
    pauldron.scale.set(1.05, 0.88, 1.05);
    const shoulderRim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.016, 6, 14), accentMat);
    shoulderRim.rotation.x = Math.PI / 2;
    shoulderRim.position.y = -0.02;
    shoulder.add(pauldron, shoulderRim);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.18, 6, 10), jacketMat);
    upper.position.set(0, -0.14, 0);
    upper.castShadow = true;
    shoulder.add(upper);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.28, 0);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), jointMat);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.15, 6, 10), skinMat);
    lower.position.set(0, -0.11, 0);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.11, 10), jointMat);
    cuff.position.set(0, -0.15, 0);
    const glove = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.05, 4, 8), accentMat);
    glove.position.set(0, -0.24, -0.01);
    forearm.add(elbow, lower, cuff, glove);

    shoulder.add(forearm);
    torso.add(shoulder);
    return { shoulder, forearm };
  };

  const leftA = buildArm(-1);
  const rightA = buildArm(1);

  // Sculpted Legs + Armor Pads + Contoured Cyber Sneakers
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.135, 0, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.084, 0.27, 6, 10), pantsMat);
    thigh.position.set(0, -0.21, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.42, 0);

    const kneePad = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.05, 4, 8), jointMat);
    kneePad.position.set(0, 0, -0.035);
    const kneeAccent = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.028, 0.04), accentMat);
    kneeAccent.position.set(0, 0.02, -0.088);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.23, 6, 10), pantsMat);
    calf.position.set(0, -0.18, 0);
    calf.castShadow = true;

    // Sculpted Sneaker (Heel cuff + sleek upper + toe-cap + glowing outsole)
    const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.1, 0.23), sneakerMat);
    shoeUpper.position.set(0, -0.39, -0.02);
    shoeUpper.castShadow = true;
    const toeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 10), sneakerMat);
    toeCap.rotation.x = Math.PI / 2;
    toeCap.scale.set(1.25, 1, 0.72);
    toeCap.position.set(0, -0.405, -0.145);
    const soleGlow = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.032, 0.32), accentMat);
    soleGlow.position.set(0, -0.445, -0.05);

    shin.add(kneePad, kneeAccent, calf, shoeUpper, toeCap, soleGlow);
    hip.add(shin);
    torso.add(hip);
    return { hip, shin };
  };

  const leftL = buildLeg(-1);
  const rightL = buildLeg(1);

  return {
    root,
    bodyPivot,
    torso,
    headGroup,
    leftArm: leftA.shoulder,
    rightArm: rightA.shoulder,
    leftForearm: leftA.forearm,
    rightForearm: rightA.forearm,
    leftLeg: leftL.hip,
    rightLeg: rightL.hip,
    leftShin: leftL.shin,
    rightShin: rightL.shin,
    backpackGroup,
    shieldMesh,
    hoverBikeGroup,
    glbAnim: null,
    isGlb: false,
    dispose: () => {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
    },
  };
}

export function animateCharacterRig(
  rig: CharacterRig,
  action: ParkourAction,
  time: number,
  speedRatio: number,
  laneTilt: number,
  dt: number,
  flipProgress = 0,
): void {
  const k = Math.min(1, dt * 16);
  const damp = (cur: number, target: number) => THREE.MathUtils.lerp(cur, target, k);

  rig.hoverBikeGroup.visible = action === 'vehicle';

  if (rig.isGlb) {
    let targetPivotY = 0;
    let targetPivotRotX = 0;
    const targetPivotRotZ =
      action === 'wallRunLeft'
        ? 0.55
        : action === 'wallRunRight'
          ? -0.55
          : laneTilt * (action === 'vehicle' ? -0.35 : -0.2);

    if (action === 'vehicle') targetPivotY = 0.34 + Math.sin(time * 8) * 0.03;
    else if (action === 'slide') targetPivotY = -0.32;
    else if (action === 'doubleJump') targetPivotRotX = -flipProgress * Math.PI * 2;
    else if (action === 'dive') targetPivotRotX = 0.85;
    else if (action === 'vault') targetPivotRotX = 0.45;

    rig.bodyPivot.position.y = damp(rig.bodyPivot.position.y, targetPivotY);
    rig.bodyPivot.rotation.x =
      action === 'doubleJump'
        ? targetPivotRotX
        : damp(rig.bodyPivot.rotation.x, targetPivotRotX);
    rig.bodyPivot.rotation.z = damp(rig.bodyPivot.rotation.z, targetPivotRotZ);

    if (rig.glbAnim) {
      updateGlbRunnerAnimation(rig.glbAnim, action, dt, speedRatio);
    }
    return;
  }

  let targetPivotY = 0;
  let targetPivotRotX = 0;
  let targetPivotRotZ = laneTilt * -0.22;
  let targetTorsoRotX = 0.12;
  let targetHeadRotY = 0;
  let targetLShoulderX = 0;
  let targetRShoulderX = 0;
  let targetLShoulderZ = 0.1;
  let targetRShoulderZ = -0.1;
  let targetLForearmX = -0.6;
  let targetRForearmX = -0.6;
  let targetLHipX = 0;
  let targetRHipX = 0;
  let targetLShinX = 0;
  let targetRShinX = 0;

  if (action === 'idle') {
    targetPivotY = Math.sin(time * 2.2) * 0.025;
    targetTorsoRotX = 0.04;
    targetHeadRotY = Math.sin(time * 0.9) * 0.22;
    targetLShoulderX = Math.sin(time * 1.4) * 0.06;
    targetRShoulderX = -Math.sin(time * 1.4) * 0.06;
    targetLForearmX = -0.35;
    targetRForearmX = -0.35;
  } else if (action === 'celebrate') {
    targetPivotY = Math.abs(Math.sin(time * 6)) * 0.18;
    targetLShoulderX = -2.6;
    targetRShoulderX = -2.6;
    targetLShoulderZ = 0.4;
    targetRShoulderZ = -0.4;
  } else if (action === 'run' || action === 'sprint') {
    const freq = (action === 'sprint' ? 16 : 12.5) * (0.85 + speedRatio * 0.35);
    const phase = time * freq;
    const stride = action === 'sprint' ? 1.05 : 0.85;
    targetPivotY = Math.abs(Math.sin(phase)) * 0.12;
    targetTorsoRotX = action === 'sprint' ? 0.32 : 0.2;
    targetLHipX = Math.sin(phase) * stride;
    targetRHipX = -Math.sin(phase) * stride;
    targetLShinX = Math.max(0, -Math.cos(phase)) * 1.15;
    targetRShinX = Math.max(0, Math.cos(phase)) * 1.15;
    targetLShoulderX = -Math.sin(phase) * stride * 0.85;
    targetRShoulderX = Math.sin(phase) * stride * 0.85;
    targetLForearmX = -1.1;
    targetRForearmX = -1.1;
  } else if (action === 'jump') {
    targetTorsoRotX = 0.18;
    targetLShoulderX = -1.8;
    targetRShoulderX = 0.45;
    targetLHipX = 0.65;
    targetRHipX = -0.45;
    targetLShinX = 0.9;
    targetRShinX = 0.35;
  } else if (action === 'doubleJump') {
    targetPivotRotX = -flipProgress * Math.PI * 2;
    targetLHipX = 1.1;
    targetRHipX = 1.1;
    targetLShinX = 1.4;
    targetRShinX = 1.4;
    targetLShoulderX = 0.8;
    targetRShoulderX = 0.8;
  } else if (action === 'vault') {
    targetTorsoRotX = 0.85;
    targetLShoulderX = -1.4;
    targetRShoulderX = 0.5;
    targetLHipX = 1.1;
    targetRHipX = 0.2;
    targetLShinX = 1.2;
    targetRShinX = 0.5;
  } else if (action === 'slide') {
    targetPivotY = -0.46;
    targetTorsoRotX = -0.95;
    targetLHipX = 1.15;
    targetRHipX = 0.35;
    targetLShinX = 0.1;
    targetRShinX = 1.35;
    targetLShoulderX = -0.8;
    targetRShoulderX = 0.7;
  } else if (action === 'wallRunLeft' || action === 'wallRunRight') {
    const dir = action === 'wallRunLeft' ? 1 : -1;
    const phase = time * 15;
    targetPivotRotZ = dir * 0.62;
    targetTorsoRotX = 0.26;
    targetLHipX = Math.sin(phase) * 0.9;
    targetRHipX = -Math.sin(phase) * 0.9;
    targetLShinX = 0.65;
    targetRShinX = 0.65;
    targetLShoulderX = dir > 0 ? -1.2 : -Math.sin(phase) * 0.7;
    targetRShoulderX = dir < 0 ? -1.2 : Math.sin(phase) * 0.7;
  } else if (action === 'wallClimb') {
    const phase = time * 16;
    targetTorsoRotX = -0.1;
    targetLShoulderX = -2.2 + Math.sin(phase) * 0.7;
    targetRShoulderX = -2.2 - Math.sin(phase) * 0.7;
    targetLHipX = 0.7 + Math.sin(phase) * 0.5;
    targetRHipX = 0.7 - Math.sin(phase) * 0.5;
  } else if (action === 'zipline' || action === 'grapple') {
    targetTorsoRotX = 0.28;
    targetPivotRotZ = Math.sin(time * 6) * 0.08 + laneTilt * -0.2;
    targetLShoulderX = -2.85;
    targetRShoulderX = -2.6;
    targetLForearmX = -0.2;
    targetRForearmX = -0.35;
    targetLHipX = -0.25;
    targetRHipX = 0.15;
    targetLShinX = 0.7;
    targetRShinX = 0.4;
  } else if (action === 'dive') {
    targetTorsoRotX = 1.25;
    targetLShoulderX = 0.6;
    targetRShoulderX = 0.6;
    targetLShoulderZ = 0.55;
    targetRShoulderZ = -0.55;
    targetLHipX = -0.3;
    targetRHipX = -0.3;
  } else if (action === 'vehicle') {
    targetPivotY = 0.26 + Math.sin(time * 8) * 0.03;
    targetTorsoRotX = 0.45;
    targetPivotRotZ = laneTilt * -0.38;
    targetLShoulderX = -1.1;
    targetRShoulderX = -1.1;
    targetLForearmX = -0.45;
    targetRForearmX = -0.45;
    targetLHipX = 0.85;
    targetRHipX = 0.85;
    targetLShinX = 1.15;
    targetRShinX = 1.15;
  } else if (action === 'stumble') {
    targetTorsoRotX = -0.45;
    targetPivotRotZ = Math.sin(time * 24) * 0.25;
  }

  rig.bodyPivot.position.y = damp(rig.bodyPivot.position.y, targetPivotY);
  rig.bodyPivot.rotation.x =
    action === 'doubleJump'
      ? targetPivotRotX
      : damp(rig.bodyPivot.rotation.x, targetPivotRotX);
  rig.bodyPivot.rotation.z = damp(rig.bodyPivot.rotation.z, targetPivotRotZ);
  rig.torso.rotation.x = damp(rig.torso.rotation.x, targetTorsoRotX);
  rig.headGroup.rotation.y = damp(rig.headGroup.rotation.y, targetHeadRotY);

  rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, targetLShoulderX);
  rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, targetRShoulderX);
  rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, targetLShoulderZ);
  rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, targetRShoulderZ);
  rig.leftForearm.rotation.x = damp(rig.leftForearm.rotation.x, targetLForearmX);
  rig.rightForearm.rotation.x = damp(rig.rightForearm.rotation.x, targetRForearmX);

  rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, targetLHipX);
  rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, targetRHipX);
  rig.leftShin.rotation.x = damp(rig.leftShin.rotation.x, targetLShinX);
  rig.rightShin.rotation.x = damp(rig.rightShin.rotation.x, targetRShinX);
}

/**
 * Shared Sculpted Collectible Geometry & Material Pool
 */
export function createCollectibleAssetPool(): CollectibleAssetPool {
  const coinRimGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16);
  coinRimGeo.rotateX(Math.PI / 2);
  const coinCoreGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.13, 6);
  coinCoreGeo.rotateX(Math.PI / 2);
  const coinRingGeo = new THREE.TorusGeometry(0.39, 0.04, 8, 18);

  const gemGeo = new THREE.OctahedronGeometry(0.44, 0);
  const gemRingGeo = new THREE.TorusGeometry(0.56, 0.035, 8, 20);

  const secretCoreGeo = new THREE.OctahedronGeometry(0.42, 0);
  const secretFrameGeo = new THREE.BoxGeometry(0.74, 0.74, 0.74);

  const empCoreGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.78, 12);
  const empCapGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.14, 12);
  const empRingGeo = new THREE.TorusGeometry(0.52, 0.045, 8, 18);

  const shieldDiscGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.12, 6);
  shieldDiscGeo.rotateX(Math.PI / 2);
  const shieldRingGeo = new THREE.TorusGeometry(0.62, 0.055, 8, 22);

  // U-shaped Horseshoe Magnet Shape
  const magShape = new THREE.Shape();
  magShape.absarc(0, 0.05, 0.48, 0, Math.PI, false);
  magShape.lineTo(-0.48, -0.35);
  magShape.lineTo(-0.26, -0.35);
  magShape.lineTo(-0.26, 0.05);
  magShape.absarc(0, 0.05, 0.26, Math.PI, 0, true);
  magShape.lineTo(0.26, -0.35);
  magShape.lineTo(0.48, -0.35);
  magShape.closePath();
  const magnetArcGeo = new THREE.ExtrudeGeometry(magShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  magnetArcGeo.center();
  const magnetTipGeo = new THREE.BoxGeometry(0.23, 0.18, 0.21);

  const slowmoConeGeo = new THREE.ConeGeometry(0.38, 0.52, 8);
  const slowmoRingGeo = new THREE.TorusGeometry(0.58, 0.04, 8, 22);

  const talismanCoreGeo = new THREE.OctahedronGeometry(0.4, 0);
  const talismanWingGeo = new THREE.ConeGeometry(0.16, 0.62, 4);
  const talismanRingGeo = new THREE.TorusGeometry(0.62, 0.045, 8, 24);

  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.88,
    roughness: 0.18,
  });
  const coinGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    metalness: 0.5,
    roughness: 0.2,
  });
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: 0xe879f9,
    emissive: 0xc026d3,
    emissiveIntensity: 0.72,
    metalness: 0.3,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const secretMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.95,
    metalness: 0.75,
    roughness: 0.16,
  });
  const secretCageMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.35,
    wireframe: true,
  });
  const empMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.05,
    roughness: 0.2,
  });
  const empCapMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25,
  });
  const shieldMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
    roughness: 0.14,
    metalness: 0.45,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.9,
  });
  const magnetMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xe11d48,
    emissiveIntensity: 0.78,
    metalness: 0.55,
    roughness: 0.24,
  });
  const magnetTipMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.55,
    metalness: 0.9,
    roughness: 0.16,
  });
  const slowmoMat = new THREE.MeshPhysicalMaterial({
    color: 0xa855f7,
    emissive: 0x9333ea,
    emissiveIntensity: 0.85,
    roughness: 0.14,
    metalness: 0.4,
    clearcoat: 1.0,
  });
  const talismanMat = new THREE.MeshPhysicalMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.05,
    metalness: 0.85,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const talismanRingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.95,
    metalness: 0.65,
    roughness: 0.2,
  });

  const geometries: THREE.BufferGeometry[] = [
    coinRimGeo,
    coinCoreGeo,
    coinRingGeo,
    gemGeo,
    gemRingGeo,
    secretCoreGeo,
    secretFrameGeo,
    empCoreGeo,
    empCapGeo,
    empRingGeo,
    shieldDiscGeo,
    shieldRingGeo,
    magnetArcGeo,
    magnetTipGeo,
    slowmoConeGeo,
    slowmoRingGeo,
    talismanCoreGeo,
    talismanWingGeo,
    talismanRingGeo,
  ];
  const materials: THREE.Material[] = [
    coinMat,
    coinGlowMat,
    gemMat,
    secretMat,
    secretCageMat,
    empMat,
    empCapMat,
    shieldMat,
    magnetMat,
    magnetTipMat,
    slowmoMat,
    talismanMat,
    talismanRingMat,
  ];

  return {
    coinRimGeo,
    coinCoreGeo,
    coinRingGeo,
    gemGeo,
    gemRingGeo,
    secretCoreGeo,
    secretFrameGeo,
    empCoreGeo,
    empCapGeo,
    empRingGeo,
    shieldDiscGeo,
    shieldRingGeo,
    magnetArcGeo,
    magnetTipGeo,
    slowmoConeGeo,
    slowmoRingGeo,
    talismanCoreGeo,
    talismanWingGeo,
    talismanRingGeo,
    coinMat,
    coinGlowMat,
    gemMat,
    secretMat,
    secretCageMat,
    empMat,
    empCapMat,
    shieldMat,
    magnetMat,
    magnetTipMat,
    slowmoMat,
    talismanMat,
    talismanRingMat,
    geometries,
    materials,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export function buildCollectibleModel(
  kind: 'coin' | 'gem' | 'shield' | 'magnet' | 'slowmo' | 'secret' | 'empCell' | 'talisman',
  pool: CollectibleAssetPool,
): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'coin') {
    const rim = new THREE.Mesh(pool.coinRimGeo, pool.coinMat);
    const core = new THREE.Mesh(pool.coinCoreGeo, pool.coinGlowMat);
    const ring = new THREE.Mesh(pool.coinRingGeo, pool.coinMat);
    g.add(rim, core, ring);
  } else if (kind === 'gem') {
    const shard = new THREE.Mesh(pool.gemGeo, pool.gemMat);
    const ring = new THREE.Mesh(pool.gemRingGeo, pool.gemMat);
    ring.rotation.x = Math.PI * 0.35;
    ring.rotation.z = 0.4;
    g.add(shard, ring);
  } else if (kind === 'secret') {
    const core = new THREE.Mesh(pool.secretCoreGeo, pool.secretMat);
    const cage = new THREE.Mesh(pool.secretFrameGeo, pool.secretCageMat);
    cage.rotation.y = Math.PI / 4;
    cage.rotation.x = Math.PI / 6;
    g.add(core, cage);
  } else if (kind === 'talisman') {
    const core = new THREE.Mesh(pool.talismanCoreGeo, pool.talismanMat);
    const wingL = new THREE.Mesh(pool.talismanWingGeo, pool.talismanMat);
    wingL.position.set(-0.36, 0.14, 0);
    wingL.rotation.z = 0.72;
    const wingR = new THREE.Mesh(pool.talismanWingGeo, pool.talismanMat);
    wingR.position.set(0.36, 0.14, 0);
    wingR.rotation.z = -0.72;
    const halo = new THREE.Mesh(pool.talismanRingGeo, pool.talismanRingMat);
    halo.rotation.x = Math.PI / 3;
    g.add(core, wingL, wingR, halo);
  } else if (kind === 'empCell') {
    const core = new THREE.Mesh(pool.empCoreGeo, pool.empMat);
    const capT = new THREE.Mesh(pool.empCapGeo, pool.empCapMat);
    capT.position.y = 0.42;
    const capB = new THREE.Mesh(pool.empCapGeo, pool.empCapMat);
    capB.position.y = -0.42;
    const ring1 = new THREE.Mesh(pool.empRingGeo, pool.empMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.15;
    const ring2 = ring1.clone();
    ring2.position.y = -0.15;
    g.add(core, capT, capB, ring1, ring2);
  } else if (kind === 'shield') {
    const disc = new THREE.Mesh(pool.shieldDiscGeo, pool.shieldMat);
    const ring = new THREE.Mesh(pool.shieldRingGeo, pool.shieldMat);
    g.add(disc, ring);
  } else if (kind === 'magnet') {
    const arc = new THREE.Mesh(pool.magnetArcGeo, pool.magnetMat);
    arc.position.y = 0.08;
    const tipL = new THREE.Mesh(pool.magnetTipGeo, pool.magnetTipMat);
    tipL.position.set(-0.37, -0.36, 0);
    const tipR = new THREE.Mesh(pool.magnetTipGeo, pool.magnetTipMat);
    tipR.position.set(0.37, -0.36, 0);
    const aura = new THREE.Mesh(pool.gemRingGeo, pool.magnetMat);
    aura.rotation.x = Math.PI / 2;
    aura.position.y = -0.25;
    g.add(arc, tipL, tipR, aura);
  } else {
    // Slow-Mo Chrono Hourglass
    const topCone = new THREE.Mesh(pool.slowmoConeGeo, pool.slowmoMat);
    topCone.rotation.x = Math.PI;
    topCone.position.y = 0.25;
    const botCone = new THREE.Mesh(pool.slowmoConeGeo, pool.slowmoMat);
    botCone.position.y = -0.25;
    const gyro = new THREE.Mesh(pool.slowmoRingGeo, pool.slowmoMat);
    gyro.rotation.x = 0.55;
    gyro.rotation.y = 0.4;
    g.add(topCone, botCone, gyro);
  }

  return g;
}

export function buildHoverBikePickupModel(
  accentHex: string,
  vehicleId: VehicleId = 'hover_bike',
  paintHex = '#162136',
): THREE.Group {
  const g = new THREE.Group();
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.9,
  });
  const miniVehicle = createVehicleGroup(vehicleId, paintHex, accentHex, visorMat);
  miniVehicle.scale.setScalar(0.54);
  miniVehicle.position.y = 0.05;
  miniVehicle.rotation.y = 0.55;

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.055, 8, 24),
    visorMat,
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.32;
  g.add(miniVehicle, halo);
  return g;
}

/**
 * Multi-Tier Architectural Building LOD Builder (Reuses shared unitBoxGeo!)
 */
export function buildBuildingLOD(
  unitBoxGeo: THREE.BoxGeometry,
  bw: number,
  bh: number,
  bd: number,
  mats: ProceduralTexturePack,
  side: -1 | 1,
  switchDist = 68,
): THREE.LOD {
  const lod = new THREE.LOD();

  const highGroup = new THREE.Group();

  // 1. Ground Podium Base
  const podiumH = Math.min(4.0, bh * 0.22);
  const podium = new THREE.Mesh(unitBoxGeo, mats.darkMetalMat);
  podium.scale.set(bw * 1.06, podiumH, bd * 1.03);
  podium.position.y = podiumH * 0.5;
  highGroup.add(podium);

  // 2. Main Glass/Facade Tower Shaft
  const main = new THREE.Mesh(unitBoxGeo, mats.buildingMat);
  main.scale.set(bw, bh, bd);
  main.position.y = bh * 0.5;
  highGroup.add(main);

  // 3. Structural Corner Pilasters on Track-Facing Edge
  const faceX = side * -(bw * 0.5);
  for (const pz of [-bd * 0.45, bd * 0.45]) {
    const pilaster = new THREE.Mesh(unitBoxGeo, mats.darkMetalMat);
    pilaster.scale.set(0.45, bh * 0.96, 0.55);
    pilaster.position.set(faceX, bh * 0.48, pz);
    highGroup.add(pilaster);
  }

  // 4. Stepped Upper Setback Crown & Spire
  const crownH = Math.max(2.2, bh * 0.16);
  const crown = new THREE.Mesh(unitBoxGeo, mats.walkMat);
  crown.scale.set(bw * 0.72, crownH, bd * 0.72);
  crown.position.y = bh + crownH * 0.5;
  highGroup.add(crown);

  const roofTrim = new THREE.Mesh(unitBoxGeo, mats.neonTrimMat);
  roofTrim.scale.set(bw * 1.02, 0.34, bd * 1.02);
  roofTrim.position.y = bh + 0.15;
  highGroup.add(roofTrim);

  const crownTrim = new THREE.Mesh(unitBoxGeo, mats.secTrimMat);
  crownTrim.scale.set(bw * 0.75, 0.25, bd * 0.75);
  crownTrim.position.y = bh + crownH + 0.1;
  highGroup.add(crownTrim);

  const spire = new THREE.Mesh(unitBoxGeo, mats.neonTrimMat);
  spire.scale.set(0.24, Math.min(6.5, bh * 0.25), 0.24);
  spire.position.set(side * -0.8, bh + crownH + 1.8, 0);
  highGroup.add(spire);

  const vertTrim = new THREE.Mesh(unitBoxGeo, mats.secTrimMat);
  vertTrim.scale.set(0.24, bh * 0.88, 0.34);
  vertTrim.position.set(faceX, bh * 0.46, bd * 0.38);
  highGroup.add(vertTrim);

  // Far LOD single mesh
  const lowMesh = new THREE.Mesh(unitBoxGeo, mats.buildingMat);
  lowMesh.scale.set(bw, bh, bd);
  lowMesh.position.y = bh * 0.5;

  lod.addLevel(highGroup, 0);
  lod.addLevel(lowMesh, switchDist);
  return lod;
}

/**
 * Sculpted Cyber Metro & Cargo Trains (with Bogies, Sloped Bullet Nose & Roof Pods)
 */
export function buildCyberTrainModel(
  primaryNeon: string,
  secondaryNeon: string,
  length = 16,
  isCargo = false,
): THREE.Group {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: isCargo ? 0x2b231d : 0x131d33,
    metalness: 0.78,
    roughness: 0.28,
    clearcoat: isCargo ? 0.2 : 0.72,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.42,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x26344f,
    metalness: 0.62,
    roughness: 0.42,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: primaryNeon,
    emissive: primaryNeon,
    emissiveIntensity: 0.92,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    emissive: secondaryNeon,
    emissiveIntensity: 0.95,
  });

  // Undercarriage chassis & 2 Rail Bogies
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.32, length - 0.6), trimMat);
  chassis.position.set(0, 0.32, 0);
  g.add(chassis);

  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 2.38, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const bz of [-length * 0.34, length * 0.34]) {
    for (const wz of [-0.65, 0.65]) {
      const wheel = new THREE.Mesh(wheelGeo, trimMat);
      wheel.position.set(0, 0.24, bz + wz);
      g.add(wheel);
    }
  }

  // Main body hull sitting cleanly on undercarriage
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.55, length - 1.2), bodyMat);
  hull.position.set(0, 1.72, isCargo ? 0 : -0.45);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  if (!isCargo) {
    // Sculpted sloped bullet-train nose facing +Z (toward oncoming player)
    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, 0.45);
    noseShape.lineTo(1.75, 0.45);
    noseShape.lineTo(1.45, 1.35);
    noseShape.lineTo(0.45, 2.95);
    noseShape.lineTo(0, 2.95);
    noseShape.closePath();
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
      depth: 2.32,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    noseGeo.center();
    noseGeo.rotateY(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 1.72, length * 0.5 - 0.3);
    nose.castShadow = true;
    g.add(nose);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.72, 0.22), headlightMat);
    windshield.position.set(0, 2.15, length * 0.5 + 0.12);
    windshield.rotation.x = -0.46;
    g.add(windshield);

    // Side glowing passenger window strips
    for (const sx of [-1.27, 1.27]) {
      const winBand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, length - 3.2), headlightMat);
      winBand.position.set(sx, 2.15, -0.45);
      g.add(winBand);
    }
  } else {
    for (let r = -2; r <= 2; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(2.58, 2.52, 0.34), roofMat);
      rib.position.set(0, 1.72, r * 3.1);
      g.add(rib);
    }
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.42, 0.45), glowMat);
    bumper.position.set(0, 0.7, length * 0.5 - 0.5);
    g.add(bumper);
  }

  // Stepped Roof + HVAC Pods
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.16, length - 1.4), roofMat);
  roof.position.set(0, 3.06, isCargo ? 0 : -0.45);
  roof.receiveShadow = true;
  g.add(roof);

  for (const hz of [-4.2, 2.4]) {
    const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 2.1), trimMat);
    hvac.position.set(0, 3.14, hz);
    g.add(hvac);
  }

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.14, length - 1.5), glowMat);
  stripe.position.set(0, 1.52, isCargo ? 0 : -0.45);
  g.add(stripe);

  const hlGeo = new THREE.BoxGeometry(0.46, 0.22, 0.16);
  const hlZ = length * 0.5 + (isCargo ? -0.3 : 0.62);
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-0.75, 0.82, hlZ);
  const hlR = hlL.clone();
  hlR.position.set(0.75, 0.82, hlZ);
  g.add(hlL, hlR);

  return g;
}

/**
 * All 10 Distinct Enemy Classes (Upgraded Composite Silhouettes)
 */
export function buildEnemyModel(enemyClass: EnemyClass): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    metalness: 0.85,
    roughness: 0.22,
    clearcoat: 0.78,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.75,
    roughness: 0.35,
  });

  const colorMap: Record<EnemyClass, number> = {
    scout: 0x38bdf8,
    pursuit: 0xf97316,
    armored: 0xef4444,
    surveillance: 0x0ea5e9,
    swarm: 0xfacc15,
    ground_bot: 0xfb923c,
    security_bot: 0xf43f5e,
    intervention: 0xec4899,
    tactical: 0xa855f7,
    elite: 0xe879f9,
  };
  const glowColor = colorMap[enemyClass];
  const glowMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 0.95,
  });

  if (enemyClass === 'scout' || enemyClass === 'surveillance') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), hullMat);
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.42, 0.36, 12), trimMat);
    cowl.position.y = 0.16;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), glowMat);
    eye.position.set(0, 0, 0.42);
    const rotorRing = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.055, 8, 22), glowMat);
    rotorRing.rotation.x = Math.PI / 2;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 2.2, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    cone.position.set(0, -1.25, 0);
    g.add(core, cowl, eye, rotorRing, cone);
  } else if (enemyClass === 'pursuit') {
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.95);
    wingShape.lineTo(1.25, -0.45);
    wingShape.lineTo(0.45, -0.75);
    wingShape.lineTo(0, -0.5);
    wingShape.lineTo(-0.45, -0.75);
    wingShape.lineTo(-1.25, -0.45);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);
    const wing = new THREE.Mesh(wingGeo, hullMat);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.85, 8), trimMat);
    body.rotation.x = Math.PI / 2;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.28), glowMat);
    visor.position.set(0, 0.08, 0.55);
    g.add(wing, body, visor);
  } else if (enemyClass === 'armored') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.25, 2.2), hullMat);
    const shieldBar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.38, 0.35), trimMat);
    shieldBar.position.set(0, -0.25, 1.05);
    const engineGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.72, 12);
    for (const sx of [-1.75, 1.75]) {
      const pod = new THREE.Mesh(engineGeo, hullMat);
      pod.position.set(sx, 0.15, 0);
      const podRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 16), glowMat);
      podRing.rotation.x = Math.PI / 2;
      podRing.position.set(sx, -0.18, 0);
      g.add(pod, podRing);
    }
    const coreEye = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.2), glowMat);
    coreEye.position.set(0, 0.12, 1.16);
    g.add(hull, shieldBar, coreEye);
  } else if (enemyClass === 'swarm') {
    for (let i = -1; i <= 1; i++) {
      const micro = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), hullMat);
      micro.position.set(i * 0.74, Math.abs(i) * 0.34, Math.abs(i) * -0.4);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 6, 14), glowMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(micro.position);
      g.add(micro, ring);
    }
  } else if (enemyClass === 'ground_bot' || enemyClass === 'security_bot') {
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.25, 0.65), trimMat);
    pelvis.position.y = 0.62;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.85, 0.88), hullMat);
    chassis.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.32, 8), trimMat);
    head.position.y = 1.68;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.14), glowMat);
    visor.position.set(0, 1.68, 0.32);
    for (const sx of [-0.36, 0.36]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.65, 0.36), hullMat);
      leg.position.set(sx, 0.32, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.52), trimMat);
      foot.position.set(sx, 0.07, 0.06);
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.42), trimMat);
      shoulder.position.set(sx * 1.9, 1.25, 0);
      g.add(leg, foot, shoulder);
    }
    if (enemyClass === 'security_bot') {
      const shield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 0.12), glowMat);
      shield.position.set(0, 0.95, 0.62);
      g.add(shield);
    }
    g.add(pelvis, chassis, head, visor);
  } else if (enemyClass === 'intervention') {
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.26, 1.25, 8), hullMat);
    torso.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), hullMat);
    head.position.y = 1.02;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.22), glowMat);
    visor.position.set(0, 1.02, 0.24);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.08), glowMat);
      wing.position.set(sx * 0.88, 0.45, -0.1);
      wing.rotation.z = sx * -0.28;
      g.add(wing);
    }
    g.add(torso, head, visor);
  } else if (enemyClass === 'tactical') {
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.52, 6), hullMat);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.16, 0.26), glowMat);
    arm.position.set(0, 0, 0.25);
    const scanner = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 8, 18), glowMat);
    scanner.position.set(0, 0.36, 0);
    scanner.rotation.x = Math.PI / 2;
    g.add(hex, arm, scanner);
  } else {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 1), hullMat);
    const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glowMat);
    const gyro1 = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.065, 8, 24), glowMat);
    const gyro2 = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.055, 8, 24), glowMat);
    gyro2.rotation.y = Math.PI / 2;
    g.add(core, inner, gyro1, gyro2);
  }

  return g;
}

/**
 * 5 Distinct Composite 3D Boss Models
 */
export function buildBossModel(bossId: BossId): THREE.Group {
  const g = new THREE.Group();
  const armorMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.88,
    roughness: 0.2,
    clearcoat: 0.85,
  });

  const palette: Record<BossId, { p: string; s: string }> = {
    titan_drone: { p: '#22d3ee', s: '#ef4444' },
    overseer: { p: '#a855f7', s: '#38bdf8' },
    iron_hunter: { p: '#f97316', s: '#facc15' },
    neon_wraith: { p: '#2dd4bf', s: '#fb7185' },
    the_sentinel: { p: '#e879f9', s: '#60a5fa' },
  };
  const colors = palette[bossId];
  const priMat = new THREE.MeshStandardMaterial({
    color: colors.p,
    emissive: colors.p,
    emissiveIntensity: 1.0,
  });
  const secMat = new THREE.MeshStandardMaterial({
    color: colors.s,
    emissive: colors.s,
    emissiveIntensity: 1.0,
  });

  if (bossId === 'titan_drone') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.9, 3.6), armorMat);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.95, 2.2), armorMat);
    bridge.position.y = 1.25;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 0.3), secMat);
    eye.position.set(0, 0.1, 1.85);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 2.6), priMat);
    vent.position.set(0, 1.75, 0);
    g.add(hull, bridge, eye, vent);
    for (const sx of [-3.4, 3.4]) {
      for (const sz of [-1.2, 1.2]) {
        const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 1.25, 14), armorMat);
        nac.position.set(sx, 0.3, sz);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.11, 8, 20), priMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(sx, 0.3, sz);
        g.add(nac, ring);
      }
    }
  } else if (bossId === 'overseer') {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.75, 20, 16), armorMat);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12), secMat);
    pupil.position.set(0, 0, 1.32);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.14, 10, 30), priMat);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.11, 10, 30), secMat);
    ring2.rotation.y = Math.PI / 3;
    ring2.rotation.x = Math.PI / 4;
    g.add(orb, pupil, ring1, ring2);
  } else if (bossId === 'iron_hunter') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 4.4), armorMat);
    body.position.y = 0.2;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.75, 1.2), secMat);
    jaw.position.set(0, -0.3, 2.3);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 3.6), priMat);
    spine.position.set(0, 1.15, 0);
    g.add(body, jaw, spine);
    for (const sx of [-2.0, 2.0]) {
      for (const sz of [-1.4, 1.4]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.2, 0.7), armorMat);
        leg.position.set(sx, -1.1, sz);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.25, 0.9), priMat);
        pad.position.set(sx, -2.15, sz);
        g.add(leg, pad);
      }
    }
  } else if (bossId === 'neon_wraith') {
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.65, 4.2, 8), armorMat);
    cloak.rotation.x = Math.PI;
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 1), armorMat);
    head.position.y = 2.15;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.45), priMat);
    visor.position.set(0, 2.15, 0.65);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 0.15), secMat);
    wingL.position.set(-2.2, 1.2, -0.3);
    wingL.rotation.z = 0.38;
    const wingR = wingL.clone();
    wingR.position.x = 2.2;
    wingR.rotation.z = -0.38;
    g.add(cloak, head, visor, wingL, wingR);
  } else {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 1), priMat);
    const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.22, 10, 32), armorMat);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.12, 8, 32), secMat);
    halo.rotation.x = Math.PI / 2;
    g.add(core, shieldRing, halo);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const pylon = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), armorMat);
      pylon.position.set(Math.cos(ang) * 3.1, Math.sin(ang) * 2.2, 0);
      g.add(pylon);
    }
  }

  return g;
}

/**
 * Sculpted Aerodynamic Hover-Car Model
 */
export function buildHoverCarModel(accentHex: string): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x162136,
    metalness: 0.84,
    roughness: 0.2,
    clearcoat: 0.85,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.9,
  });

  // Side profile sports coupe body
  const carShape = new THREE.Shape();
  carShape.moveTo(-2.1, 0.26);
  carShape.lineTo(-2.15, 0.62);
  carShape.lineTo(-1.05, 0.85);
  carShape.lineTo(-0.35, 1.32);
  carShape.lineTo(0.85, 1.32);
  carShape.lineTo(1.75, 0.92);
  carShape.lineTo(2.12, 0.74);
  carShape.lineTo(2.05, 0.28);
  carShape.closePath();

  const carGeo = new THREE.ExtrudeGeometry(carShape, {
    depth: 1.95,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  carGeo.center();
  carGeo.rotateY(Math.PI / 2);
  const chassis = new THREE.Mesh(carGeo, bodyMat);
  chassis.position.y = 0.78;
  chassis.castShadow = true;
  g.add(chassis);

  // Sloped tinted cockpit canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.34, 1.7), glassMat);
  canopy.position.set(0, 1.15, 0.15);
  g.add(canopy);

  // Rear carbon spoiler wing
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.08, 0.36), bodyMat);
  spoiler.position.set(0, 1.24, -1.85);
  g.add(spoiler);

  // 4 Glowing hover-wheel thrusters
  for (const sx of [-0.95, 0.95]) {
    for (const sz of [-1.35, 1.35]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12), glowMat);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(sx, 0.34, sz);
      g.add(pod);
    }
  }

  // Front LED Headlight Bar & Rear Taillight Bar
  const frontBar = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.12, 0.14), glowMat);
  frontBar.position.set(0, 0.56, 2.12);
  const rearBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.14), glowMat);
  rearBar.position.set(0, 0.68, -2.08);
  g.add(frontBar, rearBar);

  return g;
}

/**
 * Rich Composite Obstacle Factory covering 20+ city-specific obstacle classes
 */
export function buildCityObstacleModel(
  kind:
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
    | 'turbineHazard',
  mats: ProceduralTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'laserGrid': {
      for (const sx of [-1.15, 1.15]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.85, 0.34), mats.darkMetalMat);
        post.position.set(sx, 1.42, 0);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 10), mats.secTrimMat);
        cap.position.set(sx, 2.9, 0);
        g.add(post, cap);
      }
      for (let i = 0; i < 3; i++) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.2, 8), mats.secTrimMat);
        beam.rotation.z = Math.PI / 2;
        beam.position.set(0, 0.58 + i * 0.68, 0);
        beam.name = 'laserBeam';
        g.add(beam);
      }
      break;
    }
    case 'blastDoor': {
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3.55, 0.62), mats.darkMetalMat);
      frameL.position.set(-1.26, 1.77, 0);
      const frameR = frameL.clone();
      frameR.position.x = 1.26;
      const topHousing = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.55, 0.7), mats.darkMetalMat);
      topHousing.position.set(0, 3.65, 0);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.28, 2.55, 0.36), mats.hazardMat);
      leaf.position.set(0, 1.3, 0);
      leaf.name = 'doorLeaf';
      g.add(frameL, frameR, topHousing, leaf);
      break;
    }
    case 'movingBarrier': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.92, 0.58), mats.darkMetalMat);
      base.position.y = 0.46;
      base.castShadow = true;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.22, 0.64), mats.hazardMat);
      strip.position.y = 0.96;
      for (const sx of [-0.9, 0.9]) {
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 8), mats.secTrimMat);
        beacon.position.set(sx, 1.14, 0);
        g.add(beacon);
      }
      g.add(base, strip);
      break;
    }
    case 'containerStack': {
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(2.48, 2.25, 5.2), mats.hazardMat);
      c1.position.y = 1.125;
      c1.castShadow = true;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.22, 5.26), mats.darkMetalMat);
      trim.position.y = 2.22;
      g.add(c1, trim);
      for (let rz = -2.1; rz <= 2.1; rz += 1.05) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(2.56, 2.0, 0.18), mats.darkMetalMat);
        rib.position.set(0, 1.1, rz);
        g.add(rib);
      }
      break;
    }
    case 'steamPipe': {
      for (const sx of [-1.2, 1.2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.65, 0.3), mats.darkMetalMat);
        post.position.set(sx, 1.32, 0);
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 12), mats.darkMetalMat);
        flange.rotation.z = Math.PI / 2;
        flange.position.set(sx * 0.85, 1.85, 0);
        g.add(post, flange);
      }
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.75, 14), mats.hazardMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.y = 1.85;
      g.add(pipe);
      break;
    }
    case 'scaffolding': {
      for (const sx of [-1.08, 1.08]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.22), mats.darkMetalMat);
        leg.position.set(sx, 1.4, 0);
        g.add(leg);
      }
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.24, 1.2), mats.hazardMat);
      plank.position.set(0, 1.82, 0);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.1, 0.1), mats.neonTrimMat);
      rail.position.set(0, 2.6, 0.5);
      g.add(plank, rail);
      break;
    }
    case 'electricFloor': {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 3.8), mats.darkMetalMat);
      pad.position.y = 0.07;
      const core = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 3.4), mats.neonTrimMat);
      core.position.y = 0.08;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 18), mats.secTrimMat);
      arc.rotation.x = Math.PI / 2;
      arc.position.y = 0.22;
      g.add(pad, core, arc);
      break;
    }
    case 'floodZone': {
      const pool = new THREE.Mesh(
        new THREE.BoxGeometry(3.0, 0.14, 5.5),
        mats.waterMat ?? mats.neonTrimMat,
      );
      pool.position.y = 0.06;
      const curbL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 5.6), mats.hazardMat);
      curbL.position.set(-1.5, 0.09, 0);
      const curbR = curbL.clone();
      curbR.position.x = 1.5;
      g.add(pool, curbL, curbR);
      break;
    }
    case 'rubble': {
      const b1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), mats.darkMetalMat);
      b1.position.set(-0.38, 0.44, 0);
      const b2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mats.walkMat);
      b2.position.set(0.42, 0.34, 0.18);
      const warnBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.16, 0.2), mats.hazardMat);
      warnBar.position.set(0, 0.72, 0.35);
      warnBar.rotation.z = -0.14;
      g.add(b1, b2, warnBar);
      break;
    }
    case 'maintBot': {
      const treads = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 1.05), mats.darkMetalMat);
      treads.position.y = 0.14;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.75, 12), mats.walkMat);
      body.position.y = 0.64;
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), mats.hazardMat);
      beacon.position.y = 1.18;
      g.add(treads, body, beacon);
      break;
    }
    case 'turbineHazard': {
      // Elevated portal turbine (slide-under clearance 1.12m!)
      for (const sx of [-1.18, 1.18]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.85, 0.34), mats.darkMetalMat);
        leg.position.set(sx, 1.42, 0);
        g.add(leg);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.13, 8, 22), mats.darkMetalMat);
      ring.position.y = 2.08;
      const spinner = new THREE.Group();
      spinner.position.y = 2.08;
      spinner.name = 'spinner';
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 0.09), mats.secTrimMat);
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.55, 0.09), mats.secTrimMat);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 10), mats.hazardMat);
      hub.rotation.x = Math.PI / 2;
      spinner.add(blade1, blade2, hub);
      g.add(ring, spinner);
      break;
    }
  }
  return g;
}

/**
 * Distinct City Architectural Landmarks (uses shared TexturePack materials!)
 */
export function buildDistrictLandmark(
  district: DistrictDef,
  side: -1 | 1,
  mats: ProceduralTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  switch (district.landmarkType) {
    case 'palms': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 7, 8), mats.darkMetalMat);
      trunk.position.y = 3.5;
      trunk.rotation.z = side * 0.12;
      g.add(trunk);
      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 0.12, 0.55),
          i % 2 === 0 ? mats.neonTrimMat : mats.secTrimMat,
        );
        frond.position.set(side * -0.6, 7.0, 0);
        frond.rotation.y = (i / 6) * Math.PI * 2;
        frond.rotation.z = -0.35;
        g.add(frond);
      }
      break;
    }
    case 'crane': {
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.9, 16, 0.9), mats.darkMetalMat);
      mast.position.y = 8;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 0.7), mats.hazardMat);
      arm.position.set(side * -3.5, 15.5, 0);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 4.0), mats.darkMetalMat);
      crate.position.set(side * -6.5, 11.5, 0);
      g.add(mast, arm, crate);
      break;
    }
    case 'lanterns': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 8), mats.darkMetalMat);
      post.position.y = 3.25;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.2), mats.darkMetalMat);
      beam.position.set(side * -1.4, 6.4, 0);
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 10), mats.neonTrimMat);
      lantern.position.set(side * -2.4, 5.5, 0);
      g.add(post, beam, lantern);
      break;
    }
    case 'skybridge': {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 15, 1.4), mats.darkMetalMat);
      tower.position.y = 7.5;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.65, 4.5, 6), mats.neonTrimMat);
      spire.position.y = 17.2;
      g.add(tower, spire);
      break;
    }
    case 'tunnel': {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 5.5, 10), mats.darkMetalMat);
      pod.position.y = 2.75;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 4.2, 10), mats.neonTrimMat);
      tube.position.y = 2.75;
      g.add(pod, tube);
      break;
    }
    case 'reactor': {
      const cage = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.3, 9, 8, 1, true),
        mats.darkMetalMat,
      );
      cage.position.y = 4.5;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 1), mats.neonTrimMat);
      core.position.y = 4.5;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 8, 18), mats.secTrimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 4.5;
      g.add(cage, core, ring);
      break;
    }
    default: {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 10, 1.1), mats.darkMetalMat);
      pillar.position.y = 5;
      const holoRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 8, 18), mats.neonTrimMat);
      holoRing.rotation.x = Math.PI / 2;
      holoRing.position.y = 8.5;
      g.add(pillar, holoRing);
      break;
    }
  }
  return g;
}

export function buildBossDroneModel(): THREE.Group {
  return buildBossModel('titan_drone');
}

/**
 * Cyber-Companion Fox Builder (Uses Fox.glb when cached, else procedural cyber-fox)
 */
export function buildCompanionFoxModel(accentHex = '#22d3ee'): {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  dispose: () => void;
} {
  const cached = getCachedExtraGlb('fox');
  if (cached) {
    const inst = instantiateStaticOrAnimatedGlb(cached, {
      targetHeight: 0.95,
      rotateY: Math.PI,
      accentHex,
      playClipRegex: /run|walk|survey/i,
    });
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 6, 16),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.9,
      }),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.42, -0.25);
    inst.modelGroup.add(collar);
    return {
      group: inst.modelGroup,
      mixer: inst.mixer,
      dispose: () => {
        collar.geometry.dispose();
        (collar.material as THREE.Material).dispose();
        inst.dispose();
      },
    };
  }

  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.65), furMat);
  body.position.y = 0.32;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.28), furMat);
  head.position.set(0, 0.48, -0.34);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.1), glowMat);
  visor.position.set(0, 0.5, -0.46);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 6), glowMat);
  tail.rotation.x = -Math.PI * 0.35;
  tail.position.set(0, 0.4, 0.42);
  g.add(body, head, visor, tail);
  return {
    group: g,
    mixer: null,
    dispose: () => {
      g.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
    },
  };
}

/**
 * Relic / Showcase GLB Wrapper (DamagedHelmet, PrimaryIonDrive, CesiumMilkTruck, Fox)
 */
export function buildRelicGlbModel(
  id: ExtraGlbId,
  targetSize = 2.0,
  accentHex = '#22d3ee',
): { group: THREE.Group; mixer: THREE.AnimationMixer | null; dispose: () => void } {
  const cached = getCachedExtraGlb(id);
  if (cached) {
    const inst = instantiateStaticOrAnimatedGlb(cached, {
      targetHeight: targetSize,
      rotateY: id === 'milk_truck' ? Math.PI / 2 : 0,
      accentHex,
    });
    return {
      group: inst.modelGroup,
      mixer: inst.mixer,
      dispose: inst.dispose,
    };
  }
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.45,
    metalness: 0.8,
    roughness: 0.2,
  });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(targetSize * 0.38, 1), mat);
  mesh.position.y = targetSize * 0.45;
  g.add(mesh);
  return {
    group: g,
    mixer: null,
    dispose: () => {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

/**
 * Urban Traffic Truck Obstacle (Uses CesiumMilkTruck.glb when cached, else procedural urban truck)
 */
export function buildTrafficTruckObstacle(
  primaryHex: string,
  secondaryHex: string,
): THREE.Group {
  const cached = getCachedExtraGlb('milk_truck');
  if (cached) {
    const inst = instantiateStaticOrAnimatedGlb(cached, {
      targetHeight: 2.35,
      rotateY: Math.PI / 2,
      accentHex: primaryHex,
    });
    return inst.modelGroup;
  }

  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.35,
    roughness: 0.32,
  });
  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.72,
    roughness: 0.3,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    emissive: secondaryHex,
    emissiveIntensity: 0.85,
  });
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.85, 3.1), bodyMat);
  cargo.position.set(0, 1.32, -0.55);
  cargo.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.38, 1.25), cabMat);
  cab.position.set(0, 1.08, 1.55);
  cab.castShadow = true;
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 0.14), glowMat);
  windshield.position.set(0, 1.32, 2.18);
  const hlBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.14), glowMat);
  hlBar.position.set(0, 0.62, 2.2);
  g.add(cargo, cab, windshield, hlBar);
  for (const sx of [-0.98, 0.98]) {
    for (const sz of [-1.45, 1.45]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12), cabMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.36, sz);
      g.add(wheel);
    }
  }
  return g;
}

/**
 * 3D Supersonic Interceptor Fighter Jet (Aerial Threat / Flyby)
 */
export function buildFighterJetModel(
  primaryHex = '#38bdf8',
  secondaryHex = '#ef4444',
): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    metalness: 0.86,
    roughness: 0.22,
    clearcoat: 0.75,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.78,
    roughness: 0.34,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    emissive: secondaryHex,
    emissiveIntensity: 1.15,
  });

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.45, 4.4, 8), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 1.15), glowMat);
  canopy.position.set(0, 0.32, 0.55);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 1.2);
  wingShape.lineTo(2.4, -0.9);
  wingShape.lineTo(2.2, -1.4);
  wingShape.lineTo(0, -0.75);
  wingShape.lineTo(-2.2, -1.4);
  wingShape.lineTo(-2.4, -0.9);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2);
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.y = 0.04;

  for (const sx of [-0.42, 0.42]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.9), hullMat);
    fin.position.set(sx, 0.42, -1.55);
    fin.rotation.z = sx > 0 ? -0.32 : 0.32;
    const afterburner = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.06, 0.85, 10), glowMat);
    afterburner.rotation.x = Math.PI / 2;
    afterburner.position.set(sx * 0.7, 0.02, -2.35);
    g.add(fin, afterburner);
  }
  g.add(fuselage, canopy, wings);
  return g;
}

/**
 * 3D Tactical Patrol Helicopter (with animated mainRotor & tailRotor)
 */
export function buildHelicopterModel(
  primaryHex = '#f97316',
  secondaryHex = '#22d3ee',
): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.82,
    roughness: 0.25,
    clearcoat: 0.65,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: secondaryHex,
    emissive: secondaryHex,
    emissiveIntensity: 0.75,
    roughness: 0.15,
  });
  const warnMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    emissive: primaryHex,
    emissiveIntensity: 0.95,
  });

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.25, 2.6), hullMat);
  cabin.position.set(0, 0.65, 0);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.75, 0.9), glassMat);
  cockpit.position.set(0, 0.72, 1.25);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 2.7), hullMat);
  boom.position.set(0, 0.85, -2.35);

  const mainRotor = new THREE.Group();
  mainRotor.name = 'mainRotor';
  mainRotor.position.set(0, 1.42, 0);
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.05, 0.24), warnMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 5.2), warnMat);
  mainRotor.add(b1, b2);

  const tailRotor = new THREE.Group();
  tailRotor.name = 'tailRotor';
  tailRotor.position.set(0.28, 0.95, -3.55);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.16), warnMat);
  tailRotor.add(tb);

  const searchCone = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 3.8, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: primaryHex,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  searchCone.position.set(0, -1.65, 1.1);

  g.add(cabin, cockpit, boom, mainRotor, tailRotor, searchCone);
  return g;
}

/**
 * Enclosed Subterranean Metro Tunnel Vault Segment (Ribs, Ceiling Lights, Conduits)
 */
export function buildUndergroundTunnelSegment(
  length: number,
  mats: ProceduralTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x161d2b,
    roughness: 0.82,
    metalness: 0.18,
    side: THREE.BackSide,
  });

  // Semi-cylindrical tunnel vault shell spanning the street + sidewalks
  const vaultGeo = new THREE.CylinderGeometry(
    11.5,
    11.5,
    length,
    16,
    1,
    true,
    -Math.PI * 0.5,
    Math.PI,
  );
  vaultGeo.rotateZ(Math.PI / 2);
  vaultGeo.rotateY(Math.PI / 2);
  const vault = new THREE.Mesh(vaultGeo, concreteMat);
  vault.position.set(0, 0.2, -length * 0.5);
  g.add(vault);

  // Structural steel ribs + overhead industrial lights
  const ribGeo = new THREE.TorusGeometry(11.1, 0.38, 6, 16, Math.PI);
  const lightGeo = new THREE.BoxGeometry(1.8, 0.14, 2.2);
  for (let z = -7; z > -length; z -= 14) {
    const rib = new THREE.Mesh(ribGeo, mats.darkMetalMat);
    rib.position.set(0, 0.2, z);
    const lamp = new THREE.Mesh(lightGeo, mats.neonTrimMat);
    lamp.position.set(0, 10.6, z);
    g.add(rib, lamp);
  }

  // Side pressurized pipes & signal cables along tunnel walls
  const pipeGeo = new THREE.CylinderGeometry(0.24, 0.24, length, 8);
  pipeGeo.rotateX(Math.PI / 2);
  const pipeL = new THREE.Mesh(pipeGeo, mats.hazardMat);
  pipeL.position.set(-10.4, 3.1, -length * 0.5);
  const pipeR = new THREE.Mesh(pipeGeo, mats.secTrimMat);
  pipeR.position.set(10.4, 3.6, -length * 0.5);
  g.add(pipeL, pipeR);

  return g;
}

/**
 * Contextual Railway Crossing Warning Barrier Post
 */
export function buildRailCrossingBarrier(
  side: -1 | 1,
  mats: ProceduralTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.4, 0.28), mats.darkMetalMat);
  post.position.set(side * 5.3, 1.2, 0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mats.hazardMat);
  beacon.position.set(side * 5.3, 2.52, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.14), mats.hazardMat);
  arm.position.set(side * 3.1, 1.65, 0);
  arm.rotation.z = side * -0.35;
  g.add(post, beacon, arm);
  return g;
}

/**
 * Boss Projectiles, Telegraph Beams & Shockwaves
 */
export function buildBossProjectile(colorHex = '#ef4444'): THREE.Group {
  const g = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.25,
  });
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 1), coreMat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 8, 18), coreMat);
  g.add(orb, ring);
  return g;
}

export function buildBossLaserBeam(colorHex = '#f43f5e'): THREE.Group {
  const g = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.78,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 34, 10), beamMat);
  beam.rotation.x = Math.PI / 2;
  const floorWarn = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 34),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  floorWarn.rotation.x = -Math.PI / 2;
  floorWarn.position.y = 0.08;
  g.add(beam, floorWarn);
  return g;
}

export function buildBossShockwave(colorHex = '#f97316'): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.1,
  });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.42, 0.55), mat);
  bar.position.y = 0.38;
  g.add(bar);
  return g;
}

/**
 * Remote Multiplayer Runner Avatar + Floating Name Tag Sprite
 */
export function buildRemoteRunnerGhost(
  username: string,
  accentHex = '#22d3ee',
): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: accentHex,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.85,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.1,
  });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 6, 12), bodyMat);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
  head.position.y = 1.72;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.18), visorMat);
  visor.position.set(0, 1.74, -0.15);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 20), visorMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  g.add(torso, head, visor, ring);

  // Floating Name Canvas Sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
    ctx.fillRect(16, 10, 224, 44);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 10, 224, 44);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.slice(0, 14), 128, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(0, 2.38, 0);
  sprite.scale.set(2.2, 0.55, 1);
  g.add(sprite);

  return g;
}

/**
 * 3D Shop / Inventory Showcase Builder for Special Items & Upgrades
 */
export function buildSpecialItemShowcase(
  kind: 'talisman' | 'revive' | 'tickets' | 'shield' | 'skill',
  accentHex = '#22d3ee',
): { group: THREE.Group; dispose: () => void } {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.25,
  });
  const glowMat = new THREE.MeshPhysicalMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.9,
    metalness: 0.55,
    roughness: 0.15,
    clearcoat: 1.0,
  });

  if (kind === 'talisman') {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), glowMat);
    core.position.y = 1.0;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 10, 28), baseMat);
    halo.position.y = 1.0;
    halo.rotation.x = Math.PI / 3;
    g.add(core, halo);
  } else if (kind === 'revive') {
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.25, 0.36), glowMat);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 0.36), glowMat);
    crossV.position.y = 1.0;
    crossH.position.y = 1.0;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.06, 8, 24), baseMat);
    ring.position.y = 1.0;
    g.add(crossV, crossH, ring);
  } else if (kind === 'tickets') {
    for (let i = 0; i < 3; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.78, 0.08), i === 1 ? glowMat : baseMat);
      card.position.set((i - 1) * 0.18, 0.95 + i * 0.06, (i - 1) * 0.18);
      card.rotation.y = (i - 1) * 0.22;
      g.add(card);
    }
  } else {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), glowMat);
    core.position.y = 1.0;
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.06, 8, 24), baseMat);
    cage.position.y = 1.0;
    g.add(core, cage);
  }

  return {
    group: g,
    dispose: () => {
      g.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material.dispose();
        }
      });
    },
  };
}
