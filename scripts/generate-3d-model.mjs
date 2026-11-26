import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@gradio/client';

/**
 * Offline 3D AI Generator Pipeline (Zero-Cost Hugging Face Spaces)
 * Evaluates Microsoft TRELLIS (MIT) or Tencent Hunyuan3D-2 and downloads raw .glb
 * drafts into public/models/raw/ for optimization via scripts/optimize-models.mjs.
 *
 * Usage:
 *   node scripts/generate-3d-model.mjs --provider trellis --image path/to/ref.png --out boss_sentinel
 *   node scripts/generate-3d-model.mjs --provider hunyuan --prompt "futuristic cyber drone" --out cyber_drone
 */
async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag, fallback = '') => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  const provider = getArg('--provider', 'trellis').toLowerCase();
  const prompt = getArg('--prompt', '');
  const imagePath = getArg('--image', '');
  const outName = getArg('--out', `ai_asset_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');

  const rawDir = path.resolve(process.cwd(), 'public', 'models', 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const targetPath = path.join(rawDir, `${outName}.glb`);

  const spaceId = provider === 'hunyuan' ? 'tencent/Hunyuan3D-2' : 'JeffreyXiang/TRELLIS';
  console.log(`Connecting to Hugging Face Space: ${spaceId} (zero-cost best-effort queue)...`);

  const hfToken = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : undefined;
  const client = await Client.connect(spaceId, hfToken);

  if (provider === 'trellis') {
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.error('TRELLIS requires --image <path/to/reference.png|jpg>');
      process.exit(1);
    }
    const imgBuf = fs.readFileSync(imagePath);
    const blob = new Blob([imgBuf]);
    const glbRes = await client.predict('/extract_glb', { image: blob });
    console.log('TRELLIS result received:', glbRes.data);
    const url = findGlbUrl(glbRes.data);
    if (!url) throw new Error('No GLB output URL returned by TRELLIS Space.');
    await downloadFile(url, targetPath);
  } else {
    if (!prompt && (!imagePath || !fs.existsSync(imagePath))) {
      console.error('Hunyuan3D requires --prompt "..." or --image <path>');
      process.exit(1);
    }
    const payload = { caption: prompt || 'futuristic cyberpunk vehicle' };
    if (imagePath && fs.existsSync(imagePath)) {
      payload.image = new Blob([fs.readFileSync(imagePath)]);
    }
    const res = await client.predict('/generation_all', payload);
    const url = findGlbUrl(res.data);
    if (!url) throw new Error('No GLB output URL returned by Hunyuan3D Space.');
    await downloadFile(url, targetPath);
  }

  console.log(`Downloaded draft GLB to ${targetPath}. Now run: node scripts/optimize-models.mjs`);
}

function findGlbUrl(data) {
  const stack = Array.isArray(data) ? [...data] : [data];
  while (stack.length > 0) {
    const item = stack.shift();
    if (!item) continue;
    if (typeof item === 'string' && /\.glb(\?|$)/i.test(item)) return item;
    if (typeof item === 'object') {
      if (typeof item.url === 'string' && /\.glb(\?|$)/i.test(item.url)) return item.url;
      for (const v of Object.values(item)) {
        if (v && (typeof v === 'object' || typeof v === 'string')) stack.push(v);
      }
    }
  }
  return null;
}

async function downloadFile(url, dest) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} downloading ${url}`);
  const arr = new Uint8Array(await resp.arrayBuffer());
  fs.writeFileSync(dest, arr);
}

main().catch((err) => {
  console.error('3D AI pipeline note:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
