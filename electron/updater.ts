import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ReleaseUpdateInfo, UpdateProgressState } from '../src/game/types';
import { compareSemver, GAME_VERSION } from '../src/game/version';

export const DEFAULT_UPDATE_REPO =
  process.env.METRO_RUSH_UPDATE_REPO || 'CynexStudios/metro-Rush-online';

interface ReleaseManifestShape {
  version?: unknown;
  releaseDate?: unknown;
  downloadUrl?: unknown;
  assetName?: unknown;
  sha256?: unknown;
  sizeBytes?: unknown;
  releaseNotes?: unknown;
  minCompatibleVersion?: unknown;
}

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
  digest?: string;
}

interface GitHubReleaseApiShape {
  tag_name?: string;
  name?: string;
  html_url?: string;
  published_at?: string;
  body?: string;
  assets?: GitHubReleaseAsset[];
}

export function normalizeRepoSlug(repo?: string): string {
  const cleaned = String(repo || DEFAULT_UPDATE_REPO)
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleaned)
    ? cleaned
    : DEFAULT_UPDATE_REPO;
}

export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
  });
}

export async function verifyFileSha256(
  filePath: string,
  expectedSha256: string,
): Promise<{ valid: boolean; actual: string; expected: string }> {
  const cleanExpected = expectedSha256.trim().toLowerCase().replace(/^sha256:/, '');
  const actual = await computeFileSha256(filePath);
  return {
    valid: cleanExpected.length === 64 && actual === cleanExpected,
    actual,
    expected: cleanExpected,
  };
}

function extractSha256FromReleaseBody(body: string | undefined): string | null {
  if (!body) return null;
  const match = body.match(/(?:sha256[:\s`*]*)([a-f0-9]{64})/i);
  return match ? match[1].toLowerCase() : null;
}

export async function checkForReleaseUpdate(
  currentVersion = GAME_VERSION,
  repoInput?: string,
): Promise<ReleaseUpdateInfo> {
  const repo = normalizeRepoSlug(repoInput);
  const releasePageUrl = `https://github.com/${repo}/releases/latest`;
  const manifestUrl = `https://github.com/${repo}/releases/latest/download/latest-release.json`;

  // 1. Try public latest-release.json manifest from GitHub Releases (no tokens required)
  try {
    const res = await fetch(manifestUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `MetroRushNeonCity/${currentVersion}`,
      },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = (await res.json()) as ReleaseManifestShape;
      const latestVer = typeof json.version === 'string' ? json.version.replace(/^v/i, '').trim() : '';
      if (latestVer) {
        const hasUpdate = compareSemver(latestVer, currentVersion) > 0;
        const downloadUrl =
          typeof json.downloadUrl === 'string' && /^https:\/\//i.test(json.downloadUrl)
            ? json.downloadUrl
            : null;
        return {
          currentVersion,
          latestVersion: latestVer,
          hasUpdate,
          repo,
          releaseUrl: releasePageUrl,
          downloadUrl,
          assetName:
            typeof json.assetName === 'string'
              ? json.assetName
              : `Metro-Rush-Neon-City-Setup-${latestVer}.exe`,
          sizeBytes: typeof json.sizeBytes === 'number' ? json.sizeBytes : null,
          sha256:
            typeof json.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(json.sha256.trim())
              ? json.sha256.trim().toLowerCase()
              : null,
          releaseDate: typeof json.releaseDate === 'string' ? json.releaseDate : null,
          releaseNotes:
            typeof json.releaseNotes === 'string'
              ? json.releaseNotes
              : `Actualización v${latestVer} disponible en GitHub Releases.`,
          minCompatibleVersion:
            typeof json.minCompatibleVersion === 'string' ? json.minCompatibleVersion : undefined,
          source: 'manifest',
          error: null,
        };
      }
    }
  } catch {
    // Fall back to public GitHub Releases REST API
  }

  // 2. Public GitHub Releases API fallback (public repo, zero private tokens)
  try {
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `MetroRushNeonCity/${currentVersion}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!apiRes.ok) {
      return {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        repo,
        releaseUrl: releasePageUrl,
        downloadUrl: null,
        assetName: null,
        sizeBytes: null,
        sha256: null,
        releaseDate: null,
        releaseNotes: '',
        source: 'offline',
        error:
          apiRes.status === 404
            ? `No hay versiones publicadas todavía en github.com/${repo}/releases.`
            : `GitHub Releases respondió con estado HTTP ${apiRes.status}.`,
      };
    }

    const rel = (await apiRes.json()) as GitHubReleaseApiShape;
    const latestVer = String(rel.tag_name || rel.name || currentVersion)
      .replace(/^v/i, '')
      .trim();
    const assets = Array.isArray(rel.assets) ? rel.assets : [];
    const exeAsset =
      assets.find((a) => typeof a.name === 'string' && /Setup.*\.exe$/i.test(a.name)) ||
      assets.find((a) => typeof a.name === 'string' && /\.exe$/i.test(a.name));

    const digestRaw = exeAsset?.digest?.replace(/^sha256:/i, '').trim() ?? '';
    const sha256 =
      /^[a-f0-9]{64}$/i.test(digestRaw)
        ? digestRaw.toLowerCase()
        : extractSha256FromReleaseBody(rel.body);

    return {
      currentVersion,
      latestVersion: latestVer,
      hasUpdate: compareSemver(latestVer, currentVersion) > 0,
      repo,
      releaseUrl: rel.html_url || releasePageUrl,
      downloadUrl: exeAsset?.browser_download_url || null,
      assetName: exeAsset?.name || null,
      sizeBytes: typeof exeAsset?.size === 'number' ? exeAsset.size : null,
      sha256,
      releaseDate: rel.published_at || null,
      releaseNotes: rel.body || `Lanzamiento oficial v${latestVer}.`,
      source: 'github_release',
      error: null,
    };
  } catch (err) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      repo,
      releaseUrl: releasePageUrl,
      downloadUrl: null,
      assetName: null,
      sizeBytes: null,
      sha256: null,
      releaseDate: null,
      releaseNotes: '',
      source: 'offline',
      error: `Sin conexión con GitHub Releases: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function downloadAndVerifyRelease(
  info: ReleaseUpdateInfo,
  updatesDir: string,
  onProgress: (state: UpdateProgressState) => void,
  signal?: AbortSignal,
): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  if (!info.downloadUrl || !/^https:\/\//i.test(info.downloadUrl)) {
    return {
      ok: false,
      error: 'Este lanzamiento no incluye un instalador HTTPS válido (.exe).',
    };
  }

  fs.mkdirSync(updatesDir, { recursive: true });
  const safeAsset = String(info.assetName || `Metro-Rush-Neon-City-Setup-${info.latestVersion}.exe`).replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  );
  const partPath = path.join(updatesDir, `${safeAsset}.part`);
  const finalPath = path.join(updatesDir, safeAsset);

  if (fs.existsSync(partPath)) {
    try {
      fs.unlinkSync(partPath);
    } catch {
      // ignore stale partial cleanup error
    }
  }

  onProgress({
    status: 'downloading',
    progressPercent: 0,
    downloadedBytes: 0,
    totalBytes: info.sizeBytes ?? 0,
    downloadedPath: null,
    message: `Descargando ${safeAsset}...`,
    error: null,
  });

  try {
    const res = await fetch(info.downloadUrl, {
      headers: { 'User-Agent': `MetroRushNeonCity/${info.currentVersion}` },
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Fallo de descarga HTTPS (HTTP ${res.status}).`);
    }

    const headerLen = Number(res.headers.get('content-length') || 0);
    const totalBytes = headerLen > 0 ? headerLen : (info.sizeBytes ?? 0);
    const writer = fs.createWriteStream(partPath);
    const reader = res.body.getReader();
    let downloadedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          writer.write(Buffer.from(value));
          downloadedBytes += value.byteLength;
          const pct =
            totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 50;
          onProgress({
            status: 'downloading',
            progressPercent: pct,
            downloadedBytes,
            totalBytes,
            downloadedPath: null,
            message: `Descargando actualización v${info.latestVersion} (${pct}%)...`,
            error: null,
          });
        }
      }
      await new Promise<void>((resolve, reject) => {
        writer.once('error', reject);
        writer.end(() => resolve());
      });
    } catch (streamErr) {
      writer.destroy();
      throw streamErr;
    }

    onProgress({
      status: 'verifying',
      progressPercent: 100,
      downloadedBytes,
      totalBytes: totalBytes || downloadedBytes,
      downloadedPath: null,
      message: 'Verificando firma SHA-256 del instalador...',
      error: null,
    });

    if (info.sha256) {
      const verification = await verifyFileSha256(partPath, info.sha256);
      if (!verification.valid) {
        try {
          fs.unlinkSync(partPath);
        } catch {
          // ignore
        }
        const errMsg = `Checksum SHA-256 inválido. Se abortó la actualización y tus datos SQLite permanecen intactos.`;
        onProgress({
          status: 'error',
          progressPercent: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          downloadedPath: null,
          message: 'Error de integridad SHA-256 (rollback seguro aplicado).',
          error: errMsg,
        });
        return { ok: false, error: errMsg };
      }
    }

    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    fs.renameSync(partPath, finalPath);

    onProgress({
      status: 'ready_to_install',
      progressPercent: 100,
      downloadedBytes,
      totalBytes: totalBytes || downloadedBytes,
      downloadedPath: finalPath,
      message: `Instalador v${info.latestVersion} verificado y listo para instalar.`,
      error: null,
    });

    return { ok: true, filePath: finalPath };
  } catch (err) {
    if (fs.existsSync(partPath)) {
      try {
        fs.unlinkSync(partPath);
      } catch {
        // ignore
      }
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    onProgress({
      status: 'error',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      downloadedPath: null,
      message: 'No se pudo completar la descarga.',
      error: errMsg,
    });
    return { ok: false, error: errMsg };
  }
}

/**
 * Creates a non-destructive backup snapshot of the SQLite database & session before launching installer.
 * Guarantees `%APPDATA%` saves & accounts survive updates or rollback cleanly if aborted.
 */
export function createPreUpdateRollbackSnapshot(
  userDataDataDir: string,
  backupRootDir: string,
  targetVersion: string,
): { ok: boolean; snapshotDir: string; copiedFiles: string[] } {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotDir = path.join(backupRootDir, `pre-update-v${targetVersion}-${stamp}`);
  fs.mkdirSync(snapshotDir, { recursive: true });
  const copiedFiles: string[] = [];

  if (fs.existsSync(userDataDataDir)) {
    const entries = fs.readdirSync(userDataDataDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (/\.(sqlite|db|enc|json)$/i.test(ent.name)) {
        const src = path.join(userDataDataDir, ent.name);
        const dst = path.join(snapshotDir, ent.name);
        fs.copyFileSync(src, dst);
        copiedFiles.push(ent.name);
      }
    }
  }

  fs.writeFileSync(
    path.join(snapshotDir, 'rollback-manifest.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        currentVersion: GAME_VERSION,
        targetVersion,
        sourceDir: userDataDataDir,
        copiedFiles,
      },
      null,
      2,
    ),
    'utf8',
  );

  return { ok: true, snapshotDir, copiedFiles };
}
