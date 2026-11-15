import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as esbuild from 'esbuild';

const ROOT = process.cwd();
const DIST_ELECTRON = path.join(ROOT, 'dist-electron');
const BUILD_RES = path.join(ROOT, 'build');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateNeonRushIconPng(size = 256) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  for (let y = 0; y < size; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const nx = Math.abs(dx) / maxR;
      const ny = Math.abs(dy) / maxR;
      // Rounded square mask
      const corner = Math.max(nx - 0.72, 0) ** 2 + Math.max(ny - 0.72, 0) ** 2;
      if (nx > 1 || ny > 1 || corner > 0.28 ** 2) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Base deep cyber obsidian gradient
      let r = Math.round(7 + (y / size) * 14);
      let g = Math.round(11 + (x / size) * 18);
      let b = Math.round(28 + (y / size) * 30);

      // Outer neon cyan border glow
      const edge = Math.max(nx, ny);
      if (edge > 0.9 || corner > 0.22 ** 2) {
        r = 34;
        g = 211;
        b = 238;
      }

      // Diagonal futuristic "M" / Speed chevron motif
      const px = (x - cx) / maxR;
      const py = (y - cy) / maxR;
      const inLeftLeg = Math.abs(px + 0.42) < 0.11 && Math.abs(py) < 0.5;
      const inRightLeg = Math.abs(px - 0.42) < 0.11 && Math.abs(py) < 0.5;
      const inLeftDiag =
        px >= -0.45 && px <= 0.02 && Math.abs(py - (px * 1.15 - 0.05)) < 0.12 && Math.abs(py) < 0.5;
      const inRightDiag =
        px >= -0.02 && px <= 0.45 && Math.abs(py - (-px * 1.15 - 0.05)) < 0.12 && Math.abs(py) < 0.5;
      const inAccentStripe = Math.abs(py - 0.62) < 0.06 && Math.abs(px) < 0.6;

      if (inLeftLeg || inRightLeg || inLeftDiag || inRightDiag) {
        r = 34;
        g = 211;
        b = 238;
      }
      if (inAccentStripe) {
        r = 236;
        g = 72;
        b = 153;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function wrapPngAsIco(pngBuf, size = 256) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO
  header.writeUInt16LE(1, 4); // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // offset = 6 + 16

  return Buffer.concat([header, entry, pngBuf]);
}

function ensureIcons() {
  fs.mkdirSync(BUILD_RES, { recursive: true });
  const pngPath = path.join(BUILD_RES, 'icon.png');
  const icoPath = path.join(BUILD_RES, 'icon.ico');
  if (!fs.existsSync(pngPath) || !fs.existsSync(icoPath)) {
    const png = generateNeonRushIconPng(256);
    fs.writeFileSync(pngPath, png);
    fs.writeFileSync(icoPath, wrapPngAsIco(png, 256));
  }
}

async function buildElectron() {
  fs.mkdirSync(DIST_ELECTRON, { recursive: true });
  ensureIcons();

  await Promise.all([
    esbuild.build({
      entryPoints: [path.join(ROOT, 'electron', 'main.ts')],
      outfile: path.join(DIST_ELECTRON, 'main.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron'],
      sourcemap: false,
      minify: false,
    }),
    esbuild.build({
      entryPoints: [path.join(ROOT, 'electron', 'preload.ts')],
      outfile: path.join(DIST_ELECTRON, 'preload.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron'],
      sourcemap: false,
      minify: false,
    }),
    esbuild.build({
      entryPoints: [path.join(ROOT, 'electron', 'serverWorker.ts')],
      outfile: path.join(DIST_ELECTRON, 'serverWorker.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron', 'vite'],
      sourcemap: false,
      minify: false,
    }),
  ]);

  const wasmSrc = path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmDst = path.join(DIST_ELECTRON, 'sql-wasm.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDst);
  } else {
    throw new Error(`Missing sql-wasm.wasm at ${wasmSrc}`);
  }

  console.log('Electron main, preload, serverWorker and sql-wasm.wasm built into dist-electron/.');
}

buildElectron().catch((err) => {
  console.error(err);
  process.exit(1);
});
