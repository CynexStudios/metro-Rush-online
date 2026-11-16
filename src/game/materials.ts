import * as THREE from 'three';
import { DistrictId } from './types';

export interface ProceduralTexturePack {
  roadTexture: THREE.CanvasTexture;
  roadNormalTexture: THREE.CanvasTexture;
  roadRoughnessTexture: THREE.CanvasTexture;
  buildingTexture: THREE.CanvasTexture;
  buildingEmissiveTexture: THREE.CanvasTexture;
  buildingNormalTexture: THREE.CanvasTexture;
  magWallTexture: THREE.CanvasTexture;
  contactShadowTexture: THREE.CanvasTexture;
  billboardTextures: THREE.CanvasTexture[];
  // Shared reusable PBR materials (eliminates per-chunk material allocations)
  roadMat: THREE.MeshStandardMaterial;
  railBedMat: THREE.MeshStandardMaterial;
  walkMat: THREE.MeshStandardMaterial;
  buildingMat: THREE.MeshStandardMaterial;
  magWallMat: THREE.MeshStandardMaterial;
  neonTrimMat: THREE.MeshStandardMaterial;
  secTrimMat: THREE.MeshStandardMaterial;
  darkMetalMat: THREE.MeshStandardMaterial;
  hazardMat: THREE.MeshStandardMaterial;
  waterMat: THREE.MeshStandardMaterial | null;
  waterTimeUniform: { value: number };
  billboardMats: THREE.MeshBasicMaterial[];
  dispose: () => void;
}

function heightCanvasToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength = 2.2,
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext('2d')!;
  const src = hCtx.getImageData(0, 0, w, h).data;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = w;
  nCanvas.height = h;
  const nCtx = nCanvas.getContext('2d')!;
  const out = nCtx.createImageData(w, h);
  const dst = out.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1 / len;
      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  nCtx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(nCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createProceduralTextures(
  renderer: THREE.WebGLRenderer,
  districtId: DistrictId,
  primaryHex: string,
  secondaryHex: string,
  buildingBaseHex: string,
  textureQuality: 'low' | 'medium' | 'high' = 'high',
  reflectionsEnabled = true,
  materialQuality: 'standard' | 'pbr' = 'pbr',
  ambientOcclusion = true,
  laneCount: 3 | 5 = 3,
): ProceduralTexturePack {
  const maxAniso = Math.min(
    textureQuality === 'high' ? 8 : textureQuality === 'medium' ? 4 : 1,
    renderer.capabilities.getMaxAnisotropy() || 1,
  );
  const res =
    textureQuality === 'high' ? 512 : textureQuality === 'medium' ? 384 : 256;
  const s = res / 512;

  // 1. District-Differentiated Road Surface + Height Canvas
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = res;
  roadCanvas.height = res;
  const rCtx = roadCanvas.getContext('2d')!;

  const rHeight = document.createElement('canvas');
  rHeight.width = 256;
  rHeight.height = 256;
  const rhCtx = rHeight.getContext('2d')!;
  rhCtx.fillStyle = '#707070';
  rhCtx.fillRect(0, 0, 256, 256);

  const laneCenters =
    laneCount === 5
      ? [74 * s, 165 * s, 256 * s, 347 * s, 438 * s]
      : [110 * s, 256 * s, 402 * s];
  const dividerXs =
    laneCount === 5
      ? [119 * s, 210 * s, 301 * s, 392 * s]
      : [181 * s, 327 * s];

  if (districtId === 'oldcity') {
    // Cobblestone historical street (no train tracks!)
    rCtx.fillStyle = '#231b1f';
    rCtx.fillRect(0, 0, res, res);
    for (let y = 0; y < res; y += Math.round(24 * s)) {
      const rowOffset = (Math.floor(y / (24 * s)) % 2) * 18 * s;
      for (let x = -20; x < res + 20; x += Math.round(36 * s)) {
        const shade = 34 + Math.floor(Math.random() * 18);
        rCtx.fillStyle = `rgb(${shade + 8},${shade},${shade + 4})`;
        rCtx.fillRect(x + rowOffset, y + 2 * s, 32 * s, 20 * s);
      }
    }
    for (let y = 0; y < 256; y += 12) {
      const off = (Math.floor(y / 12) % 2) * 9;
      for (let x = 0; x < 256; x += 18) {
        rhCtx.fillStyle = '#c4c4c4';
        rhCtx.fillRect(x + off, y + 1, 15, 10);
      }
    }
    // Warm inlaid stone gutter lines
    rCtx.fillStyle = '#6b4f3a';
    rCtx.fillRect(179 * s, 0, 4 * s, res);
    rCtx.fillRect(325 * s, 0, 4 * s, res);
  } else if (districtId === 'industrial') {
    // Riveted steel foundry deck
    rCtx.fillStyle = '#1b1815';
    rCtx.fillRect(0, 0, res, res);
    rCtx.strokeStyle = '#362d26';
    rCtx.lineWidth = 3 * s;
    for (let y = 0; y < res; y += Math.round(64 * s)) {
      rCtx.strokeRect(14 * s, y, res - 28 * s, 60 * s);
    }
    // Diamond grip embossing on height map
    rhCtx.fillStyle = '#a0a0a0';
    for (let y = 8; y < 256; y += 16) {
      for (let x = 8; x < 256; x += 16) {
        rhCtx.fillRect(x, y, 6, 3);
      }
    }
    // Hazard stripes along outer deck
    rCtx.fillStyle = '#eab308';
    for (let y = 0; y < res; y += Math.round(32 * s)) {
      rCtx.fillRect(8 * s, y, 10 * s, 16 * s);
      rCtx.fillRect(res - 18 * s, y, 10 * s, 16 * s);
    }
  } else if (districtId === 'beach') {
    // Wooden boardwalk / coastal promenade
    rCtx.fillStyle = '#1d273b';
    rCtx.fillRect(0, 0, res, res);
    for (let y = 0; y < res; y += Math.round(20 * s)) {
      const v = 30 + Math.floor(Math.random() * 14);
      rCtx.fillStyle = `rgb(${v},${v + 12},${v + 28})`;
      rCtx.fillRect(0, y, res, 17 * s);
    }
    for (let y = 0; y < 256; y += 10) {
      rhCtx.fillStyle = '#9c9c9c';
      rhCtx.fillRect(0, y, 256, 8);
    }
  } else if (districtId === 'future') {
    // Clean high-tech silver/ceramic maglev highway
    rCtx.fillStyle = '#182438';
    rCtx.fillRect(0, 0, res, res);
    rCtx.strokeStyle = '#38bdf8';
    rCtx.globalAlpha = 0.25;
    rCtx.lineWidth = 2 * s;
    for (let y = 0; y < res; y += Math.round(64 * s)) {
      rCtx.beginPath();
      rCtx.moveTo(0, y);
      rCtx.lineTo(res, y);
      rCtx.stroke();
    }
    rCtx.globalAlpha = 1;
    laneCenters.forEach((cx) => {
      rCtx.fillStyle = primaryHex;
      rCtx.globalAlpha = 0.35;
      rCtx.fillRect(cx - 2 * s, 0, 4 * s, res);
      rCtx.globalAlpha = 1;
    });
  } else if (districtId === 'underground') {
    // Dedicated Twin-Rail Metro Subterranean Bed
    rCtx.fillStyle = '#090e1a';
    rCtx.fillRect(0, 0, res, res);
    laneCenters.forEach((cx, idx) => {
      const hCx = laneCount === 5 ? [37, 82, 128, 174, 219][idx] : [55, 128, 201][idx];
      rCtx.fillStyle = '#182238';
      rhCtx.fillStyle = '#a8a8a8';
      for (let y = 0; y < res; y += Math.round(32 * s)) {
        rCtx.fillRect(cx - 32 * s, y, 64 * s, 9 * s);
      }
      for (let y = 0; y < 256; y += 16) {
        rhCtx.fillRect(hCx - 16, y, 32, 4);
      }
      rCtx.fillStyle = '#64748b';
      rCtx.fillRect(cx - 26 * s, 0, 5 * s, res);
      rCtx.fillRect(cx + 21 * s, 0, 5 * s, res);
      rhCtx.fillStyle = '#ffffff';
      rhCtx.fillRect(hCx - 13, 0, 3, 256);
      rhCtx.fillRect(hCx + 10, 0, 3, 256);
    });
  } else {
    // Urban Asphalt Highway for Downtown, Skyline, and 5-lane Megacities
    rCtx.fillStyle =
      districtId === 'skyline'
        ? '#171f36'
        : districtId === 'cyber_port'
          ? '#0f1c2b'
          : districtId === 'obsidian_citadel'
            ? '#0c1216'
            : districtId === 'crimson_metropolis'
              ? '#160b10'
              : '#0c111e';
    rCtx.fillRect(0, 0, res, res);
    const grainCount = textureQuality === 'high' ? 3200 : 1200;
    for (let i = 0; i < grainCount; i++) {
      const x = Math.random() * res;
      const y = Math.random() * res;
      const v = 13 + Math.floor(Math.random() * 16);
      rCtx.fillStyle = `rgb(${v},${v + 4},${v + 12})`;
      rCtx.fillRect(x, y, 2, 2);
    }
    // Crosswalk zebra bands near tile seam
    rCtx.fillStyle = 'rgba(226, 232, 240, 0.2)';
    for (let x = Math.round(28 * s); x < res - 28 * s; x += Math.round(40 * s)) {
      rCtx.fillRect(x, 12 * s, 20 * s, 40 * s);
    }
  }

  // Subtle neon lane guide dots / centerlines for non-underground districts
  if (districtId !== 'underground') {
    laneCenters.forEach((cx) => {
      rCtx.fillStyle = primaryHex;
      rCtx.globalAlpha = 0.24;
      for (let y = 0; y < res; y += Math.round(64 * s)) {
        rCtx.fillRect(cx - 2 * s, y + 14 * s, 4 * s, 24 * s);
      }
      rCtx.globalAlpha = 1;
    });
  }

  // Lane dividers + edge trims
  rCtx.fillStyle = districtId === 'oldcity' ? '#78716c' : '#475569';
  for (let y = 0; y < res; y += Math.round(64 * s)) {
    for (const dx of dividerXs) {
      rCtx.fillRect(dx, y + 8 * s, 4 * s, 32 * s);
    }
  }
  rCtx.fillStyle = secondaryHex;
  rCtx.globalAlpha = 0.65;
  rCtx.fillRect(10 * s, 0, 5 * s, res);
  rCtx.fillRect(497 * s, 0, 5 * s, res);
  rCtx.globalAlpha = 1;

  const roadTexture = new THREE.CanvasTexture(roadCanvas);
  roadTexture.colorSpace = THREE.SRGBColorSpace;
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.repeat.set(1, 2);
  roadTexture.anisotropy = maxAniso;

  const roadNormalTexture = heightCanvasToNormalTexture(rHeight, 2.0);
  roadNormalTexture.repeat.set(1, 2);

  // 2. Road Roughness Map (puddles or brick AO)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rgCtx = roughCanvas.getContext('2d')!;
  rgCtx.fillStyle = ambientOcclusion ? '#9e9e9e' : '#b8b8b8';
  rgCtx.fillRect(0, 0, 256, 256);
  if (reflectionsEnabled && districtId !== 'industrial') {
    for (let i = 0; i < 14; i++) {
      const px = Math.random() * 256;
      const py = Math.random() * 256;
      const rad = 16 + Math.random() * 30;
      const grad = rgCtx.createRadialGradient(px, py, 2, px, py, rad);
      grad.addColorStop(0, '#2a2a2a');
      grad.addColorStop(1, 'rgba(168,168,168,0)');
      rgCtx.fillStyle = grad;
      rgCtx.beginPath();
      rgCtx.arc(px, py, rad, 0, Math.PI * 2);
      rgCtx.fill();
    }
  }
  const roadRoughnessTexture = new THREE.CanvasTexture(roughCanvas);
  roadRoughnessTexture.wrapS = THREE.RepeatWrapping;
  roadRoughnessTexture.wrapT = THREE.RepeatWrapping;
  roadRoughnessTexture.repeat.set(1, 2);

  // 3. City-Specific Building Facade (Albedo + Emissive + Normal)
  const bCanvas = document.createElement('canvas');
  bCanvas.width = 256;
  bCanvas.height = 512;
  const bCtx = bCanvas.getContext('2d')!;
  bCtx.fillStyle =
    districtId === 'oldcity'
      ? '#342024'
      : districtId === 'future'
        ? '#cbd5e1'
        : districtId === 'industrial'
          ? '#261e1a'
          : '#0d1424';
  bCtx.fillRect(0, 0, 256, 512);

  const eCanvas = document.createElement('canvas');
  eCanvas.width = 256;
  eCanvas.height = 512;
  const eCtx = eCanvas.getContext('2d')!;
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 512);

  const bHeight = document.createElement('canvas');
  bHeight.width = 256;
  bHeight.height = 512;
  const bhCtx = bHeight.getContext('2d')!;
  bhCtx.fillStyle = '#d0d0d0';
  bhCtx.fillRect(0, 0, 256, 512);

  const cols = districtId === 'oldcity' ? 6 : 8;
  const rows = districtId === 'oldcity' ? 16 : 24;
  const cellW = 256 / cols;
  const cellH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const rowLit = Math.random() > 0.3;
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + 5;
      const y = r * cellH + 5;
      const w = cellW - 10;
      const h = cellH - 9;
      bCtx.fillStyle =
        districtId === 'future'
          ? '#1e3a5f'
          : districtId === 'oldcity'
            ? '#241518'
            : '#162238';
      bCtx.fillRect(x, y, w, h);
      bhCtx.fillStyle = '#505050';
      bhCtx.fillRect(x, y, w, h);

      if (rowLit && Math.random() > 0.44) {
        const pick = Math.random();
        const col =
          districtId === 'oldcity'
            ? '#fbbf24'
            : pick < 0.4
              ? primaryHex
              : pick < 0.65
                ? secondaryHex
                : '#93c5fd';
        eCtx.globalAlpha = districtId === 'future' ? 0.55 : 0.68;
        eCtx.fillStyle = col;
        eCtx.fillRect(x, y, w, h);
        eCtx.globalAlpha = 1;
        bCtx.fillStyle = col;
        bCtx.fillRect(x, y, w, h);
      }
    }
  }

  const buildingTexture = new THREE.CanvasTexture(bCanvas);
  buildingTexture.colorSpace = THREE.SRGBColorSpace;
  buildingTexture.wrapS = THREE.RepeatWrapping;
  buildingTexture.wrapT = THREE.RepeatWrapping;
  buildingTexture.anisotropy = maxAniso;

  const buildingEmissiveTexture = new THREE.CanvasTexture(eCanvas);
  buildingEmissiveTexture.colorSpace = THREE.SRGBColorSpace;
  buildingEmissiveTexture.wrapS = THREE.RepeatWrapping;
  buildingEmissiveTexture.wrapT = THREE.RepeatWrapping;

  const buildingNormalTexture = heightCanvasToNormalTexture(bHeight, 1.8);

  // 4. Magnetic Wall-Run Chevron Texture
  const mCanvas = document.createElement('canvas');
  mCanvas.width = 256;
  mCanvas.height = 128;
  const mCtx = mCanvas.getContext('2d')!;
  mCtx.fillStyle = '#0f172a';
  mCtx.fillRect(0, 0, 256, 128);
  mCtx.strokeStyle = primaryHex;
  mCtx.lineWidth = 7;
  for (let x = -40; x < 300; x += 44) {
    mCtx.beginPath();
    mCtx.moveTo(x, 108);
    mCtx.lineTo(x + 24, 64);
    mCtx.lineTo(x, 20);
    mCtx.stroke();
  }
  mCtx.fillStyle = secondaryHex;
  mCtx.fillRect(0, 0, 256, 7);
  mCtx.fillRect(0, 121, 256, 7);

  const magWallTexture = new THREE.CanvasTexture(mCanvas);
  magWallTexture.colorSpace = THREE.SRGBColorSpace;
  magWallTexture.wrapS = THREE.RepeatWrapping;
  magWallTexture.wrapT = THREE.ClampToEdgeWrapping;
  magWallTexture.repeat.set(3, 1);
  magWallTexture.anisotropy = maxAniso;

  // 5. Contact Shadow
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 128;
  sCanvas.height = 128;
  const sCtx = sCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadowTexture = new THREE.CanvasTexture(sCanvas);

  // 6. City-Themed Billboards
  const citySlogans: Record<DistrictId, { top: string; sub: string }[]> = {
    downtown: [
      { top: 'METRO RUSH', sub: 'NEON DOWNTOWN' },
      { top: 'CYBER KINETICS', sub: 'MONORAIL EXPRESS' },
    ],
    oldcity: [
      { top: 'MERCADO VIEJO', sub: 'DISTRITO HISTÓRICO' },
      { top: 'PLAZA DEL RELOJ', sub: 'RUTA ANTIGUA' },
    ],
    industrial: [
      { top: 'SECTOR FUNDICIÓN', sub: 'PRECAUCIÓN GRÚAS' },
      { top: 'TURBINAS HEAVY', sub: 'VAPOR ACTIVO' },
    ],
    skyline: [
      { top: 'SKYLINE ZERO', sub: 'NIVEL +380M' },
      { top: 'HELIPUERTO 04', sub: 'PUENTES AÉREOS' },
    ],
    beach: [
      { top: 'NEON BEACH', sub: 'PASEO MARÍTIMO' },
      { top: 'BAY RESORT', sub: 'MAREA LUMINOSA' },
    ],
    underground: [
      { top: 'SECTOR SUB-09', sub: 'LABORATORIO BETA' },
      { top: 'LÍNEA EXPRESS', sub: 'ACCESO RESTRINGIDO' },
    ],
    future: [
      { top: 'FUTURE LABS', sub: 'GRAVEDAD 0.82G' },
      { top: 'QUANTUM CORE', sub: 'SENTINEL GRID' },
    ],
    cyber_port: [
      { top: 'PUERTO CIBER', sub: 'AUTOPISTA 5 CARRILES' },
      { top: 'TERMINAL DELTA', sub: 'CARGA SUPERSÓNICA' },
    ],
    obsidian_citadel: [
      { top: 'CIUDADELA OBSIDIANA', sub: 'SECTOR 5 CARRILES' },
      { top: 'EJE MONOLITO', sub: 'ACCESO BLINDADO' },
    ],
    crimson_metropolis: [
      { top: 'METRÓPOLIS CARMESÍ', sub: 'REACTOR CENTRAL' },
      { top: 'APOCALIPSIS 3.0', sub: 'ZONA OMEGA CORE' },
    ],
  };

  const billboardTextures = (citySlogans[districtId] ?? citySlogans.downtown).map(
    (sl, idx) => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      const bgGrad = ctx.createLinearGradient(0, 0, 512, 256);
      bgGrad.addColorStop(0, '#070b18');
      bgGrad.addColorStop(1, idx % 2 === 0 ? '#111d38' : '#240f30');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 256);
      ctx.strokeStyle = idx % 2 === 0 ? primaryHex : secondaryHex;
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, 492, 236);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 46px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sl.top, 256, 118);
      ctx.fillStyle = idx % 2 === 0 ? primaryHex : secondaryHex;
      ctx.font = 'bold 25px monospace';
      ctx.fillText(sl.sub, 256, 174);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      return tex;
    },
  );

  const usePbr = materialQuality === 'pbr';

  // Dedicated twin-rail bed texture for contextual railway crossing corridors
  const railCanvas = document.createElement('canvas');
  railCanvas.width = 256;
  railCanvas.height = 256;
  const rlCtx = railCanvas.getContext('2d')!;
  rlCtx.fillStyle = '#111623';
  rlCtx.fillRect(0, 0, 256, 256);
  rlCtx.fillStyle = '#292524';
  for (let y = 0; y < 256; y += 20) {
    rlCtx.fillRect(28, y, 200, 9);
  }
  rlCtx.fillStyle = '#94a3b8';
  rlCtx.fillRect(48, 0, 10, 256);
  rlCtx.fillRect(198, 0, 10, 256);
  rlCtx.fillStyle = primaryHex;
  rlCtx.globalAlpha = 0.45;
  rlCtx.fillRect(126, 0, 4, 256);
  rlCtx.globalAlpha = 1;
  const railBedTexture = new THREE.CanvasTexture(railCanvas);
  railBedTexture.colorSpace = THREE.SRGBColorSpace;
  railBedTexture.wrapS = THREE.RepeatWrapping;
  railBedTexture.wrapT = THREE.RepeatWrapping;
  railBedTexture.repeat.set(1, 3);

  const railBedMat = new THREE.MeshStandardMaterial({
    map: railBedTexture,
    roughness: 0.52,
    metalness: 0.48,
  });

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTexture,
    normalMap: usePbr ? roadNormalTexture : null,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: usePbr ? roadRoughnessTexture : null,
    roughness: reflectionsEnabled ? 0.56 : 0.86,
    metalness: reflectionsEnabled ? 0.24 : 0.08,
    envMapIntensity: reflectionsEnabled ? 0.72 : 0.25,
  });

  const walkMat = new THREE.MeshStandardMaterial({
    color: buildingBaseHex,
    roughness: districtId === 'future' ? 0.35 : 0.72,
    metalness: districtId === 'future' ? 0.3 : 0.2,
  });

  const buildingMat = new THREE.MeshStandardMaterial({
    map: buildingTexture,
    normalMap: usePbr ? buildingNormalTexture : null,
    normalScale: new THREE.Vector2(0.55, 0.55),
    emissiveMap: buildingEmissiveTexture,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.44,
    roughness: districtId === 'future' ? 0.35 : 0.54,
    metalness: districtId === 'future' ? 0.35 : 0.45,
  });

  const magWallMat = new THREE.MeshStandardMaterial({
    map: magWallTexture,
    emissiveMap: magWallTexture,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.46,
    roughness: 0.36,
  });

  const neonTrimMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    emissive: primaryHex,
    emissiveIntensity: 0.62,
    roughness: 0.28,
  });

  const secTrimMat = new THREE.MeshStandardMaterial({
    color: secondaryHex,
    emissive: secondaryHex,
    emissiveIntensity: 0.62,
    roughness: 0.28,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.68,
    roughness: 0.42,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.42,
    roughness: 0.35,
    metalness: 0.5,
  });

  const billboardMats = billboardTextures.map(
    (tex) =>
      new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide,
      }),
  );

  // Animated Ocean Material for Neon Beach (GPU vertex waves via onBeforeCompile!)
  const waterTimeUniform = { value: 0 };
  let waterMat: THREE.MeshStandardMaterial | null = null;
  if (districtId === 'beach') {
    waterMat = new THREE.MeshStandardMaterial({
      color: '#0d4f6b',
      emissive: '#0c3b52',
      emissiveIntensity: 0.35,
      roughness: 0.16,
      metalness: 0.72,
      transparent: true,
      opacity: 0.88,
    });
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = waterTimeUniform;
      shader.vertexShader =
        'uniform float uTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           transformed.y += sin(transformed.x * 0.45 + uTime * 2.2) * 0.28 + cos(transformed.z * 0.35 + uTime * 1.7) * 0.22;`,
        );
    };
  }

  return {
    roadTexture,
    roadNormalTexture,
    roadRoughnessTexture,
    buildingTexture,
    buildingEmissiveTexture,
    buildingNormalTexture,
    magWallTexture,
    contactShadowTexture,
    billboardTextures,
    roadMat,
    railBedMat,
    walkMat,
    buildingMat,
    magWallMat,
    neonTrimMat,
    secTrimMat,
    darkMetalMat,
    hazardMat,
    waterMat,
    waterTimeUniform,
    billboardMats,
    dispose: () => {
      roadTexture.dispose();
      roadNormalTexture.dispose();
      roadRoughnessTexture.dispose();
      railBedTexture.dispose();
      buildingTexture.dispose();
      buildingEmissiveTexture.dispose();
      buildingNormalTexture.dispose();
      magWallTexture.dispose();
      contactShadowTexture.dispose();
      billboardTextures.forEach((t) => t.dispose());
      roadMat.dispose();
      railBedMat.dispose();
      walkMat.dispose();
      buildingMat.dispose();
      magWallMat.dispose();
      neonTrimMat.dispose();
      secTrimMat.dispose();
      darkMetalMat.dispose();
      hazardMat.dispose();
      waterMat?.dispose();
      billboardMats.forEach((m) => m.dispose());
    },
  };
}
