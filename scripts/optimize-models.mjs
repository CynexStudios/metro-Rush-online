import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, reorder, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const MODELS_DIR = path.resolve(process.cwd(), 'public', 'models');
const RAW_DIR = path.join(MODELS_DIR, 'raw');

async function optimizeDirectory() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });

  if (!fs.existsSync(RAW_DIR)) {
    console.log('No public/models/raw directory found; nothing to optimize.');
    return;
  }

  const files = fs.readdirSync(RAW_DIR).filter((f) => f.toLowerCase().endsWith('.glb'));
  if (files.length === 0) {
    console.log('No raw .glb files found inside public/models/raw.');
    return;
  }

  let totalRawBytes = 0;
  let totalOptBytes = 0;

  for (const file of files) {
    const srcPath = path.join(RAW_DIR, file);
    const outPath = path.join(MODELS_DIR, file);
    const rawSize = fs.statSync(srcPath).size;
    totalRawBytes += rawSize;

    try {
      const doc = await io.read(srcPath);
      const hasSkins = doc.getRoot().listSkins().length > 0;
      const hasAnims = doc.getRoot().listAnimations().length > 0;

      const transforms = [
        weld({ tolerance: 0.0001 }),
        dedup(),
      ];

      // Only simplify rigid props/buildings/vehicles; preserve exact skinning weights on animated characters
      if (!hasSkins && !hasAnims) {
        transforms.push(
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: 0.72,
            error: 0.015,
          }),
        );
      }

      transforms.push(
        reorder({ encoder: MeshoptEncoder }),
        prune(),
      );

      await doc.transform(...transforms);
      doc
        .createExtension(EXTMeshoptCompression)
        .setRequired(true)
        .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });

      await io.write(outPath, doc);
      const outSize = fs.statSync(outPath).size;
      totalOptBytes += outSize;
      const pct = (((rawSize - outSize) / Math.max(1, rawSize)) * 100).toFixed(1);
      console.log(`Optimized ${file}: ${(rawSize / 1024).toFixed(1)} KB -> ${(outSize / 1024).toFixed(1)} KB (${pct}% saved)`);
    } catch (err) {
      console.warn(`Fallback copy for ${file}:`, err instanceof Error ? err.message : String(err));
      fs.copyFileSync(srcPath, outPath);
      totalOptBytes += rawSize;
    }
  }

  console.log(
    `Total GLB pipeline: ${(totalRawBytes / 1024).toFixed(1)} KB -> ${(totalOptBytes / 1024).toFixed(1)} KB`,
  );
}

optimizeDirectory().catch((err) => {
  console.error(err);
  process.exit(1);
});
