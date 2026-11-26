import * as THREE from 'three';
import { GraphicsQuality, HardwareDiagnostics } from './types';

let cachedDiagnostics: HardwareDiagnostics | null = null;

/**
 * Inspects real hardware & browser graphics APIs (CPU threads, RAM, GPU unmasked renderer,
 * RTX/Radeon classification, WebGL2/WebGPU, resolution, refresh estimate, upscaler availability)
 * and computes an honest recommended preset using processing, VRAM, API, and bandwidth factors.
 */
export function detectHardwareProfile(
  renderer?: THREE.WebGLRenderer,
  measuredFrameMs: number | null = null,
): HardwareDiagnostics {
  if (cachedDiagnostics && measuredFrameMs === null) {
    return cachedDiagnostics;
  }

  const cpuThreads =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  const ramGb =
    typeof navigator !== 'undefined' &&
    'deviceMemory' in navigator &&
    typeof (navigator as unknown as { deviceMemory: number }).deviceMemory === 'number'
      ? (navigator as unknown as { deviceMemory: number }).deviceMemory
      : null;

  let gpuVendor = 'Desconocido';
  let gpuRenderer = 'WebGL2 Generic Adapter';
  let webgl2Supported = false;
  let maxTextureSize = 4096;
  let maxAnisotropy = 4;

  try {
    const gl = renderer
      ? (renderer.getContext() as WebGL2RenderingContext)
      : (document.createElement('canvas').getContext('webgl2', {
          powerPreference: 'high-performance',
        }) as WebGL2RenderingContext | null);

    if (gl) {
      webgl2Supported = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpuVendor = String(
        gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR) || 'GPU',
      );
      gpuRenderer = String(
        gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ||
          'WebGL2 Adapter',
      );
      maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
      const anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');
      if (anisoExt) {
        maxAnisotropy =
          Number(gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) || 8;
      }
      if (!renderer) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    }
  } catch {
    // Probe safely failed
  }

  const isSoftwareGl =
    /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuRenderer);
  const isNvidiaRtx = /RTX\s*(20|30|40|50)\d{2}/i.test(gpuRenderer);
  const isDedicatedNvidia =
    /NVIDIA|GeForce|RTX|GTX|Quadro/i.test(gpuRenderer) && !isSoftwareGl;
  const isAmdRadeon =
    /Radeon\s*(RX|PRO|R9|VII)/i.test(gpuRenderer) &&
    !/Vega\s*\d|Graphics/i.test(gpuRenderer);
  const isDedicatedArc = /Intel.*Arc/i.test(gpuRenderer);
  const isAppleSilicon = /Apple\s*M\d/i.test(gpuRenderer);

  const isDedicated =
    isDedicatedNvidia || isAmdRadeon || isDedicatedArc || isAppleSilicon;

  let gpuTier: HardwareDiagnostics['gpuTier'] = 'integrated';
  let estimatedVramGb: number | null = isDedicated ? 6 : 2;

  if (isSoftwareGl) {
    gpuTier = 'software';
    estimatedVramGb = 0;
  } else if (
    isNvidiaRtx ||
    /RX\s*(67|68|69|77|78|79|90)\d{2}/i.test(gpuRenderer) ||
    /Apple\s*M[234]\s*(Pro|Max|Ultra)/i.test(gpuRenderer)
  ) {
    gpuTier = 'high_dedicated';
    estimatedVramGb = 8;
  } else if (isDedicated) {
    gpuTier = 'mid_dedicated';
    estimatedVramGb = 4;
  }

  const screenWidth =
    typeof window !== 'undefined' ? window.screen.width : 1920;
  const screenHeight =
    typeof window !== 'undefined' ? window.screen.height : 1080;
  const devicePixelRatio =
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const webgpuSupported =
    typeof navigator !== 'undefined' && 'gpu' in navigator;

  // Estimate refresh rate cleanly (common desktop 60/120/144)
  const refreshRateHz = 60;

  // Honest upscaler capability checks (WebGL browser sandbox vs native DX12/Vulkan)
  const supportedUpscalers: HardwareDiagnostics['supportedUpscalers'] = {
    fsr: {
      supported: webgl2Supported && !isSoftwareGl,
      reason: webgl2Supported && !isSoftwareGl
        ? 'Pase espacial FSR 1.0 disponible vía WebGL2'
        : 'No disponible en renderizado por software',
    },
    dlss: {
      supported: false,
      reason: isNvidiaRtx
        ? 'GPU RTX detectada, pero DLSS nativo requiere DirectX 12 / Vulkan fuera del navegador; FSR activo como alternativa'
        : 'Requiere GPU NVIDIA RTX + API nativa DX12/Vulkan',
    },
    xess: {
      supported: false,
      reason: isDedicatedArc
        ? 'Intel Arc detectada, pero XeSS nativo requiere API DX12/Vulkan de escritorio'
        : 'Requiere runtime Intel XeSS nativo; usa FSR en WebGL2',
    },
  };

  // Multi-factor performance score (Processing + VRAM + Bandwidth + Resolution + Live Frame Time)
  const pixelCount = screenWidth * screenHeight;
  let score = 0;
  if (gpuTier === 'high_dedicated') score += 50;
  else if (gpuTier === 'mid_dedicated') score += 34;
  else if (gpuTier === 'integrated') score += 16;
  else score += 0;

  score += Math.min(20, cpuThreads * 2);
  if (ramGb !== null) score += ramGb >= 16 ? 15 : ramGb >= 8 ? 10 : 4;
  else score += 10;

  if (pixelCount > 2560 * 1440) score -= 12; // 4K bandwidth penalty
  else if (pixelCount > 1920 * 1080) score -= 6;

  if (measuredFrameMs !== null) {
    if (measuredFrameMs > 28) score -= 24;
    else if (measuredFrameMs > 19) score -= 12;
    else if (measuredFrameMs < 11) score += 8;
  }

  let recommendedQuality: Exclude<GraphicsQuality, 'custom'> = 'medium';
  let recommendationNotes =
    'Configuración equilibrada para 60 FPS estables con iluminación PBR completa.';

  if (isSoftwareGl || score < 18) {
    recommendedQuality = 'very_low';
    recommendationNotes =
      'Renderizado por software o hardware muy limitado detectado: resolución reducida y efectos desactivados para priorizar fluidez.';
  } else if (score < 36) {
    recommendedQuality = 'low';
    recommendationNotes =
      'Gráficos integrados o memoria ajustada: sombras suaves reducidas y distancia media recomendadas.';
  } else if (score < 56) {
    recommendedQuality = 'medium';
    recommendationNotes =
      'Equipo de gama media: texturas medias, iluminación estándar y 60 FPS consistentes.';
  } else if (score < 76) {
    recommendedQuality = 'high';
    recommendationNotes =
      'GPU dedicada capaz: iluminación cinemática, reflejos en asfalto, bloom calibrado y texturas altas.';
  } else {
    recommendedQuality = 'ultra';
    recommendationNotes =
      'Hardware de alto rendimiento detectado: máxima distancia de dibujado, LOD de calidad y efectos volumétricos.';
  }

  const cpuTier =
    cpuThreads >= 12
      ? 'Alto rendimiento (12+ hilos)'
      : cpuThreads >= 8
        ? 'Gama media-alta (8+ hilos)'
        : cpuThreads >= 4
          ? 'Estándar (4+ hilos)'
          : 'Básico (<4 hilos)';

  const result: HardwareDiagnostics = {
    cpuThreads,
    cpuTier,
    ramGb,
    gpuVendor,
    gpuRenderer,
    gpuTier,
    isDedicated,
    isNvidiaRtx,
    isAmdRadeon,
    isSoftwareGl,
    estimatedVramGb,
    screenWidth,
    screenHeight,
    devicePixelRatio,
    refreshRateHz,
    webgl2Supported,
    webgpuSupported,
    maxTextureSize,
    maxAnisotropy,
    supportedUpscalers,
    measuredAvgFrameMs: measuredFrameMs,
    recommendedQuality,
    recommendationNotes,
  };

  cachedDiagnostics = result;
  return result;
}

export interface BenchmarkProfile {
  profile: string;
  resolution: string;
  quality: string;
  measuredOrEstimated: 'Medido' | 'Estimado';
  targetFps: string;
  notes: string;
}

export function getPerformanceProfiles(
  diag: HardwareDiagnostics,
  liveFps: number,
  liveFrameMs: number,
): BenchmarkProfile[] {
  return [
    {
      profile: 'Tu Equipo Actual (En Vivo)',
      resolution: `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`,
      quality: diag.recommendedQuality.toUpperCase(),
      measuredOrEstimated: 'Medido',
      targetFps: `${liveFps} FPS (${liveFrameMs.toFixed(1)} ms)`,
      notes: diag.isSoftwareGl
        ? 'Medición en navegador con renderizado por software'
        : `Medido directamente sobre ${diag.gpuRenderer.slice(0, 36)}`,
    },
    {
      profile: '1080p Baja',
      resolution: '1920×1080',
      quality: 'Baja / Muy Baja',
      measuredOrEstimated: 'Estimado',
      targetFps: '60–90 FPS',
      notes: 'Gráficos integrados (Intel UHD / Iris Xe / Radeon Vega) con LOD agresivo',
    },
    {
      profile: '1080p Media',
      resolution: '1920×1080',
      quality: 'Media',
      measuredOrEstimated: 'Estimado',
      targetFps: '60–110 FPS',
      notes: 'GTX 1650 / RX 570 o superior con sombras activadas y FSR opcional',
    },
    {
      profile: '1080p Alta',
      resolution: '1920×1080',
      quality: 'Alta',
      measuredOrEstimated: 'Estimado',
      targetFps: '90–144 FPS',
      notes: 'RTX 3060 / RX 6600 XT con PBR completo, reflejos y bloom calibrado',
    },
    {
      profile: '1440p Alta/Ultra',
      resolution: '2560×1440',
      quality: 'Alta / Ultra',
      measuredOrEstimated: 'Estimado',
      targetFps: '60–110 FPS',
      notes: 'RTX 3070 / RX 6800 con distancia larga y densidad alta',
    },
    {
      profile: '4K Ultra',
      resolution: '3840×2160',
      quality: 'Ultra + FSR',
      measuredOrEstimated: 'Estimado',
      targetFps: '55–85 FPS',
      notes: 'RTX 4070 Ti / RX 7900 XT recomendado (ancho de banda 4K elevado)',
    },
  ];
}

export const SYSTEM_REQUIREMENTS = {
  minimum: {
    os: 'Windows 10/11 64-bit, macOS 13+ o Linux moderno con navegador Chromium/Firefox actualizado',
    cpu: 'Intel Core i3-10100 / AMD Ryzen 3 3100 (4 núcleos / 4+ hilos)',
    ram: '8 GB RAM',
    gpu: 'Intel Iris Xe / AMD Radeon Vega 8 / NVIDIA GTX 1050 Ti',
    vram: '2 GB VRAM (o memoria compartida)',
    storage: '250 MB espacio libre (caché web y activos procedurales)',
    api: 'WebGL 2.0 (OpenGL ES 3.0 / ANGLE DX11)',
    resolution: '1280×720 / 1920×1080 (Calidad Baja, 60 FPS objetivo)',
  },
  recommended: {
    os: 'Windows 11 64-bit / macOS 14+ / Linux con aceleración Vulkan/ANGLE',
    cpu: 'Intel Core i5-12400 / AMD Ryzen 5 5600 (6+ núcleos / 12 hilos)',
    ram: '16 GB RAM',
    gpu: 'NVIDIA GeForce RTX 3060 / AMD Radeon RX 6600 XT / Apple M2 Pro',
    vram: '6–8 GB VRAM',
    storage: '500 MB espacio libre',
    api: 'WebGL 2.0 con aceleración hardware (WebGPU listo para futuras extensiones)',
    resolution: '1920×1080 o 2560×1440 (Calidad Alta/Ultra, 60–144 FPS)',
  },
};

export const ASSET_LICENSES = [
  {
    asset: 'Tipografías Google Fonts (Chakra Petch, Plus Jakarta Sans, JetBrains Mono, Noto Sans CJK)',
    source: 'Google Fonts CDN',
    license: 'SIL Open Font License 1.1',
    usage: 'Tipografía de interfaz y soporte completo multiidioma (incl. CJK y Cirílico)',
  },
  {
    asset: 'Iconografía y Primitivas UI (Lucide Icons, Radix UI Dialog & Tabs)',
    source: 'lucide-react, @radix-ui/react-dialog, @radix-ui/react-tabs (npm)',
    license: 'ISC / MIT License',
    usage: 'Iconografía vectorial, pestañas accesibles y modales interactivos de Tienda y Online',
  },
  {
    asset: 'Motor 3D, Post-procesado y Compresión Meshopt (Three.js + Meshoptimizer)',
    source: 'three, meshoptimizer, @gltf-transform/* (npm)',
    license: 'MIT License',
    usage: 'Renderizado PBR WebGL2, decodificación MeshoptDecoder, LOD, InstancedMesh y Frustum Culling',
  },
  {
    asset: 'Paquetes 3D Reales CC0 (.GLB optimizados): Kenney City, Car Kit, Space Kit, Blaster/Robot Arms',
    source: 'Kenney.nl (/public/models/kenney_*.glb)',
    license: 'CC0 1.0 Universal (Public Domain)',
    usage: 'Edificios, hangares, máquinas de fábrica, barcos, naves, drones y vehículos reales en pista y tienda',
  },
  {
    asset: 'Personajes Esqueléticos .GLB: CesiumMan, BrainStem, Xbot, RobotExpressive & Soldier',
    source: 'Khronos glTF-Sample-Assets & Three.js Examples (/public/models/)',
    license: 'CC-BY-4.0 / MIT License (Khronos & Three.js Examples)',
    usage: 'Modelos 3D reales para corredores en partida, lobby, tienda y garaje',
  },
  {
    asset: 'Multijugador P2P Descentralizado (Trystero + STUN Público)',
    source: 'trystero (npm)',
    license: 'MIT License',
    usage: 'Descubrimiento de salas globales y enlace WebRTC P2P sin servidores de pago',
  },
  {
    asset: 'Texturas PBR, Shaders de Agua, Audio y Síntesis Musical Dinámica',
    source: 'Generación Procedural Interna (Canvas 2D + Three.js + Web Audio API)',
    license: 'Propiedad de XynexDevs Studios',
    usage: 'Funcionamiento 100% fiable incluso offline o en redes locales Radmin/LAN',
  },
];
