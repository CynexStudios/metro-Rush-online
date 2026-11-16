import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKG_PATH = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const version = process.env.RELEASE_VERSION || pkg.version || '3.0.1';
const repo = process.env.METRO_RUSH_UPDATE_REPO || 'CynexStudios/metro-Rush-online';
const releaseDir = path.join(ROOT, 'release');
const expectedExeName = `Metro-Rush-Neon-City-Setup-${version}.exe`;
const exePath = path.join(releaseDir, expectedExeName);
const outPath = path.join(releaseDir, 'latest-release.json');

let sha256 = '';
let sizeBytes = 0;
let fileFound = false;

if (fs.existsSync(exePath)) {
  const hash = crypto.createHash('sha256');
  const buf = fs.readFileSync(exePath);
  hash.update(buf);
  sha256 = hash.digest('hex').toLowerCase();
  sizeBytes = buf.byteLength;
  fileFound = true;
}

const manifest = {
  version,
  releaseDate: new Date().toISOString(),
  repo,
  assetName: expectedExeName,
  downloadUrl: `https://github.com/${repo}/releases/download/v${version}/${expectedExeName}`,
  sha256: sha256 || null,
  sizeBytes: sizeBytes || null,
  minCompatibleVersion: '3.0.0',
  releaseNotes:
    'Metro Rush: Neon City 3.0.1 — Escudo con explosión en cadena, Doble Salto rediseñado, 3 mapas de 5 carriles, Parkour Extremo de 2 pisos, Jefes de 4 fases estilo Elden Ring, Modelos Custom GLB de Blender, Hangar 3D, Captura por Dron en Derrota, Pase de Batalla de 40 niveles (solo Gemas) y Auto-Updater público.',
};

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  fileFound
    ? `Manifest generated with SHA-256 (${sha256.slice(0, 12)}..., ${sizeBytes} bytes) -> ${outPath}`
    : `Manifest template generated (installer .exe not present yet at ${exePath}) -> ${outPath}`,
);
