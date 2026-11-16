import { ChildProcess, execFile, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  shell,
  utilityProcess,
  UtilityProcess,
} from 'electron';
import { GAME_VERSION } from '../src/game/version';
import type { ReleaseUpdateInfo, UpdateProgressState } from '../src/game/types';
import {
  checkForReleaseUpdate,
  createPreUpdateRollbackSnapshot,
  downloadAndVerifyRelease,
} from './updater';

const IS_DEV = !app.isPackaged && Boolean(process.env.METRO_RUSH_DEV_URL);
const DEV_SERVER_URL = process.env.METRO_RUSH_DEV_URL || 'http://127.0.0.1:3000';

const userDataDataDir = path.join(app.getPath('userData'), 'data');
const backupDir = path.join(userDataDataDir, 'backups');
const sessionStorePath = path.join(userDataDataDir, 'session.enc');

let mainWindow: BrowserWindow | null = null;
let serverWorker: UtilityProcess | null = null;
let tunnelProc: ChildProcess | null = null;
let tunnelPublicUrl: string | null = null;
let tunnelError: string | null = null;
let localServerPort = IS_DEV ? 3000 : 0;
let serverHealthy = false;
let serverError: string | null = null;
let isQuitting = false;
let restartAttempts = 0;

const updatesDir = path.join(userDataDataDir, 'updates');
let currentUpdateState: UpdateProgressState = {
  status: 'idle',
  progressPercent: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  downloadedPath: null,
  message: 'Listo para comprobar actualizaciones.',
  error: null,
};
let activeDownloadAbort: AbortController | null = null;

function broadcastUpdateProgress(state: UpdateProgressState): void {
  currentUpdateState = state;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mr:update-progress', state);
  }
}

function detectCloudflaredBinary(): string | null {
  const candidates: string[] = [];
  if (typeof process.resourcesPath === 'string') {
    candidates.push(
      path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'),
    );
  }
  candidates.push(
    path.join(userDataDataDir, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'),
  );
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
      'C:\\Program Files\\cloudflared\\cloudflared.exe',
    );
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(cmd, ['cloudflared'], { encoding: 'utf8', timeout: 2500 }).trim();
    const first = out.split(/\r?\n/)[0]?.trim();
    if (first) return first;
  } catch {
    // cloudflared not on PATH
  }
  return null;
}

function stopCloudflaredProcess(): void {
  if (tunnelProc) {
    try {
      tunnelProc.kill();
    } catch {
      // Ignore kill error
    }
    tunnelProc = null;
  }
  tunnelPublicUrl = null;
  tunnelError = null;
}

function getTunnelStatePayload() {
  const binaryPath = detectCloudflaredBinary();
  return {
    running: Boolean(tunnelProc && !tunnelProc.killed),
    available: Boolean(binaryPath),
    binaryPath,
    publicUrl: tunnelPublicUrl,
    wssUrl: tunnelPublicUrl ? `${tunnelPublicUrl.replace(/^https:/, 'wss:')}/ws` : null,
    provider: binaryPath ? ('cloudflared' as const) : ('none' as const),
    error: tunnelError,
  };
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function broadcastServerStatus(
  status: 'starting' | 'ready' | 'crashed' | 'restarting' | 'error',
  message: string,
  port?: number,
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mr:server-status', { status, message, port });
  }
}

function getWorkerScriptPath(): string {
  return path.resolve(__dirname, 'serverWorker.cjs');
}

function getDistDirPath(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'dist');
  }
  return path.resolve(__dirname, '..', 'dist');
}

async function stopServerWorker(): Promise<void> {
  const proc = serverWorker;
  if (!proc) return;
  serverWorker = null;
  serverHealthy = false;
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timeout = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        // Ignore
      }
      done();
    }, 2200);
    proc.once('exit', () => {
      clearTimeout(timeout);
      done();
    });
    try {
      proc.postMessage({ type: 'shutdown' });
    } catch {
      clearTimeout(timeout);
      try {
        proc.kill();
      } catch {
        // Ignore
      }
      done();
    }
  });
}

function startPackagedServerWorker(): Promise<number> {
  if (IS_DEV) {
    localServerPort = 3000;
    serverHealthy = true;
    serverError = null;
    return Promise.resolve(3000);
  }

  fs.mkdirSync(userDataDataDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const workerPath = getWorkerScriptPath();
    if (!fs.existsSync(workerPath)) {
      const errMsg = `Falta el módulo local del servidor: ${workerPath}`;
      serverError = errMsg;
      reject(new Error(errMsg));
      return;
    }

    broadcastServerStatus('starting', 'Iniciando servicios locales del juego...');

    const worker = utilityProcess.fork(workerPath, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '0',
        METRO_RUSH_EMBEDDED: '1',
        METRO_RUSH_FORCE_STATIC: '1',
        METRO_RUSH_DATA_DIR: userDataDataDir,
        METRO_RUSH_DIST_DIR: getDistDirPath(),
      },
      stdio: 'pipe',
    });

    serverWorker = worker;
    let resolved = false;

    worker.stdout?.on('data', (chunk) => {
      console.log(`[MetroServer] ${String(chunk).trim()}`);
    });
    worker.stderr?.on('data', (chunk) => {
      console.error(`[MetroServer ERR] ${String(chunk).trim()}`);
    });

    worker.on('message', (raw) => {
      const msg = raw as { type?: string; port?: number; error?: string };
      if (msg.type === 'ready' && msg.port) {
        localServerPort = msg.port;
        serverHealthy = true;
        serverError = null;
        restartAttempts = 0;
        broadcastServerStatus(
          'ready',
          `Servicios locales listos en el puerto ${msg.port}.`,
          msg.port,
        );
        if (!resolved) {
          resolved = true;
          resolve(msg.port);
        }
      } else if (msg.type === 'error') {
        serverHealthy = false;
        serverError = msg.error || 'Error interno al iniciar el servidor local.';
        broadcastServerStatus('error', serverError);
        if (!resolved) {
          resolved = true;
          reject(new Error(serverError));
        }
      }
    });

    worker.on('exit', (code) => {
      if (serverWorker === worker) {
        serverWorker = null;
      }
      serverHealthy = false;
      if (isQuitting) return;

      const reason = `El servidor local se detuvo inesperadamente (código ${code}).`;
      serverError = reason;
      broadcastServerStatus('crashed', reason);

      if (!resolved) {
        resolved = true;
        reject(new Error(reason));
        return;
      }

      if (restartAttempts < 3) {
        restartAttempts += 1;
        broadcastServerStatus(
          'restarting',
          `Reiniciando servicios locales (intento ${restartAttempts}/3)...`,
        );
        setTimeout(() => {
          if (isQuitting) return;
          void startPackagedServerWorker()
            .then((newPort) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                void mainWindow.loadURL(`http://127.0.0.1:${newPort}/`);
              }
            })
            .catch((err) => {
              broadcastServerStatus(
                'error',
                err instanceof Error ? err.message : 'No se pudo recuperar el servidor local.',
              );
            });
        }, 900);
      }
    });
  });
}

async function createMainWindow(port: number): Promise<void> {
  const preloadPath = path.resolve(__dirname, 'preload.cjs');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: `METRO RUSH: NEON CITY v${GAME_VERSION}`,
    backgroundColor: '#050811',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Security: deny unexpected popups and external navigations
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, targetUrl) => {
    const allowedOrigin = IS_DEV
      ? new URL(DEV_SERVER_URL).origin
      : `http://127.0.0.1:${localServerPort}`;
    try {
      if (new URL(targetUrl).origin !== allowedOrigin) {
        e.preventDefault();
      }
    } catch {
      e.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const targetUrl = IS_DEV ? DEV_SERVER_URL : `http://127.0.0.1:${port}/`;
  await mainWindow.loadURL(targetUrl);
}

/* ---------------- STRICT ALLOWLISTED IPC HANDLERS ---------------- */

function registerIpcHandlers(): void {
  ipcMain.handle('mr:get-desktop-info', () => ({
    isElectron: true,
    gameVersion: GAME_VERSION,
    platform: process.platform,
    userDataDir: userDataDataDir,
    backupDir,
    localServerPort,
    serverHealthy,
    serverError,
  }));

  ipcMain.handle('mr:get-lan-status', async () => {
    const base = IS_DEV ? DEV_SERVER_URL : `http://127.0.0.1:${localServerPort}`;
    const res = await fetch(`${base}/api/lan/status`);
    return res.json();
  });

  ipcMain.handle('mr:start-lan-host', async (_evt, rawPayload: unknown) => {
    const p = (rawPayload as { bindAddress?: unknown; port?: unknown }) ?? {};
    const bindAddress = typeof p.bindAddress === 'string' ? p.bindAddress.trim() : '0.0.0.0';
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(bindAddress)) {
      return { ok: false, error: 'Dirección IP LAN inválida.' };
    }
    const port = Math.floor(Number(p.port ?? 3077));
    if (!Number.isFinite(port) || port < 1024 || port > 65535) {
      return { ok: false, error: 'El puerto debe estar entre 1024 y 65535.' };
    }
    const base = IS_DEV ? DEV_SERVER_URL : `http://127.0.0.1:${localServerPort}`;
    const res = await fetch(`${base}/api/lan/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bindAddress, port }),
    });
    return res.json();
  });

  ipcMain.handle('mr:stop-lan-host', async () => {
    const base = IS_DEV ? DEV_SERVER_URL : `http://127.0.0.1:${localServerPort}`;
    const res = await fetch(`${base}/api/lan/stop`, { method: 'POST' });
    return res.json();
  });

  ipcMain.handle('mr:export-backup', async (_evt, rawPayload: unknown) => {
    if (!mainWindow) return { ok: false, error: 'Ventana principal no disponible.' };
    const p = (rawPayload as { defaultFilename?: unknown; jsonContent?: unknown }) ?? {};
    const jsonContent = typeof p.jsonContent === 'string' ? p.jsonContent : '';
    if (!jsonContent || jsonContent.length > 5 * 1024 * 1024) {
      return { ok: false, error: 'Contenido de respaldo inválido o demasiado grande.' };
    }
    try {
      JSON.parse(jsonContent);
    } catch {
      return { ok: false, error: 'El respaldo no tiene formato JSON válido.' };
    }

    const safeName = String(p.defaultFilename || 'metro-rush-backup.json').replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar Copia de Seguridad — Metro Rush',
      defaultPath: path.join(backupDir, safeName),
      filters: [{ name: 'Respaldo JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }
    fs.writeFileSync(result.filePath, jsonContent, 'utf8');
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle('mr:import-backup', async () => {
    if (!mainWindow) return { ok: false, error: 'Ventana principal no disponible.' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar Copia de Seguridad — Metro Rush',
      defaultPath: backupDir,
      properties: ['openFile'],
      filters: [{ name: 'Respaldo JSON', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    const chosen = result.filePaths[0];
    const stat = fs.statSync(chosen);
    if (stat.size > 5 * 1024 * 1024) {
      return { ok: false, error: 'Archivo demasiado grande (máximo 5 MB).' };
    }
    const content = fs.readFileSync(chosen, 'utf8');
    return { ok: true, content, fileName: path.basename(chosen) };
  });

  ipcMain.handle('mr:open-backups-folder', async () => {
    fs.mkdirSync(backupDir, { recursive: true });
    await shell.openPath(backupDir);
    return { ok: true };
  });

  ipcMain.handle('mr:load-secure-session', () => {
    try {
      if (!fs.existsSync(sessionStorePath)) {
        return { ok: true, data: null };
      }
      const raw = fs.readFileSync(sessionStorePath);
      if (safeStorage.isEncryptionAvailable()) {
        const jsonStr = safeStorage.decryptString(raw);
        return { ok: true, data: JSON.parse(jsonStr) };
      }
      const jsonStr = raw.toString('utf8');
      return { ok: true, data: JSON.parse(jsonStr) };
    } catch {
      return { ok: true, data: null };
    }
  });

  ipcMain.handle('mr:save-secure-session', (_evt, rawPayload: unknown) => {
    try {
      fs.mkdirSync(userDataDataDir, { recursive: true });
      const payload = (rawPayload && typeof rawPayload === 'object' ? rawPayload : {}) as Record<
        string,
        unknown
      >;
      const serialized = JSON.stringify(payload);
      if (serialized.length > 65536) {
        return { ok: false, error: 'Sesión demasiado grande.' };
      }
      const buf = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(serialized)
        : Buffer.from(serialized, 'utf8');
      fs.writeFileSync(sessionStorePath, buf);
      return { ok: true, encrypted: safeStorage.isEncryptionAvailable() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('mr:clear-secure-session', () => {
    try {
      if (fs.existsSync(sessionStorePath)) {
        fs.unlinkSync(sessionStorePath);
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('mr:get-tunnel-status', () => getTunnelStatePayload());

  ipcMain.handle('mr:check-firewall-port', (_evt, rawPort: unknown) => {
    const port = Math.min(65535, Math.max(1024, Math.floor(Number(rawPort || 3077))));
    if (process.platform !== 'win32') {
      return { ok: true, supported: false, allowed: true };
    }
    return new Promise((resolve) => {
      const ruleName = `Metro Rush Neon City TCP ${port}`;
      execFile(
        'netsh',
        ['advfirewall', 'firewall', 'show', 'rule', `name=${ruleName}`],
        { encoding: 'utf8', timeout: 3500 },
        (err, stdout) => {
          const allowed = !err && typeof stdout === 'string' && stdout.includes(ruleName);
          resolve({ ok: true, supported: true, allowed, ruleName });
        },
      );
    });
  });

  ipcMain.handle('mr:allow-firewall-port', async (_evt, rawPort: unknown) => {
    const port = Math.min(65535, Math.max(1024, Math.floor(Number(rawPort || 3077))));
    if (process.platform !== 'win32') {
      return {
        ok: true,
        allowed: true,
        message: 'El asistente de Firewall automático solo aplica a Windows.',
      };
    }
    const ruleName = `Metro Rush Neon City TCP ${port}`;
    const cmdLine = `/c netsh advfirewall firewall delete rule name="${ruleName}" >nul 2>&1 & netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${port} profile=any`;
    const psScript = `Start-Process -FilePath "cmd.exe" -ArgumentList '${cmdLine.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Hidden -Wait`;
    return new Promise((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psScript],
        { encoding: 'utf8', timeout: 30_000 },
        (err) => {
          if (!err) {
            resolve({
              ok: true,
              allowed: true,
              message: `Regla de Firewall añadida para TCP ${port} (LAN y Radmin VPN/Públicas habilitadas).`,
            });
          } else {
            resolve({
              ok: false,
              allowed: false,
              error: `No se concedió permiso de administrador para abrir el puerto TCP ${port}.`,
            });
          }
        },
      );
    });
  });

  ipcMain.handle('mr:start-cloudflared-tunnel', async (_evt, rawPayload: unknown) => {
    const binaryPath = detectCloudflaredBinary();
    if (!binaryPath) {
      return {
        ok: false,
        state: getTunnelStatePayload(),
        error:
          'No se encontró cloudflared en el sistema. Instálalo o usa Radmin VPN / ZeroTier / playit.gg.',
      };
    }
    const p = (rawPayload as { targetPort?: unknown }) ?? {};
    const targetPort = Math.min(
      65535,
      Math.max(1024, Math.floor(Number(p.targetPort || localServerPort || 3077))),
    );
    stopCloudflaredProcess();

    return new Promise((resolve) => {
      let settled = false;
      let discoveredUrl: string | null = null;
      let edgeRegistered = false;
      let verifyingHealth = false;

      // Force HTTP/2 over TCP 443 so home routers / Windows firewalls blocking UDP QUIC 7844 don't stall the tunnel
      const child = spawn(
        binaryPath,
        [
          'tunnel',
          '--protocol',
          'http2',
          '--url',
          `http://127.0.0.1:${targetPort}`,
          '--no-autoupdate',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      tunnelProc = child;
      tunnelError = null;
      tunnelPublicUrl = null;

      const tryFinalizeWhenHealthy = async () => {
        if (settled || !discoveredUrl || verifyingHealth) return;
        verifyingHealth = true;
        const deadline = Date.now() + 14_000;
        while (!settled && Date.now() < deadline && tunnelProc === child) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 2500);
            const resp = await fetch(`${discoveredUrl}/api/health`, {
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (resp.ok) {
              settled = true;
              tunnelPublicUrl = discoveredUrl;
              resolve({ ok: true, state: getTunnelStatePayload() });
              return;
            }
          } catch {
            // DNS or edge route still warming up
          }
          await new Promise((r) => setTimeout(r, 900));
        }
        // Fallback if edge registered even if local ISP DNS lags resolving trycloudflare.com from host
        if (!settled && edgeRegistered && discoveredUrl && tunnelProc === child) {
          settled = true;
          tunnelPublicUrl = discoveredUrl;
          resolve({ ok: true, state: getTunnelStatePayload() });
        }
      };

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && !discoveredUrl) {
          discoveredUrl = match[0];
          tunnelPublicUrl = discoveredUrl;
        }
        if (/Registered tunnel connection/i.test(text)) {
          edgeRegistered = true;
          void tryFinalizeWhenHealthy();
        }
      };

      child.stdout?.on('data', handleOutput);
      child.stderr?.on('data', handleOutput);
      child.on('exit', (code) => {
        if (tunnelProc === child) {
          tunnelProc = null;
          tunnelPublicUrl = null;
        }
        if (!settled) {
          settled = true;
          tunnelError = `cloudflared finalizó antes de establecer túnel operativo (código ${code ?? 0}).`;
          resolve({ ok: false, state: getTunnelStatePayload(), error: tunnelError });
        }
      });

      setTimeout(() => {
        if (!settled) {
          settled = true;
          if (discoveredUrl && edgeRegistered) {
            tunnelPublicUrl = discoveredUrl;
            resolve({ ok: true, state: getTunnelStatePayload() });
            return;
          }
          stopCloudflaredProcess();
          tunnelError =
            'cloudflared no logró registrar el túnel con Cloudflare (revisa tu red o usa Radmin VPN / playit.gg).';
          resolve({ ok: false, state: getTunnelStatePayload(), error: tunnelError });
        }
      }, 24_000);
    });
  });

  ipcMain.handle('mr:stop-cloudflared-tunnel', () => {
    stopCloudflaredProcess();
    return { ok: true, state: getTunnelStatePayload() };
  });

  ipcMain.handle('mr:quit-app', async () => {
    isQuitting = true;
    stopCloudflaredProcess();
    try {
      const base = IS_DEV ? DEV_SERVER_URL : `http://127.0.0.1:${localServerPort}`;
      await fetch(`${base}/api/lan/stop`, { method: 'POST' }).catch(() => {});
    } catch {
      // Ignore
    }
    await stopServerWorker();
    app.quit();
    return { ok: true };
  });

  ipcMain.handle('mr:restart-local-server', async () => {
    if (IS_DEV) return { ok: true, port: 3000 };
    await stopServerWorker();
    const port = await startPackagedServerWorker();
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    }
    return { ok: true, port };
  });

  ipcMain.handle('mr:get-update-state', () => currentUpdateState);

  ipcMain.handle('mr:check-for-updates', async (_evt, rawPayload: unknown) => {
    const p = (rawPayload && typeof rawPayload === 'object' ? rawPayload : {}) as {
      repo?: unknown;
    };
    const repo = typeof p.repo === 'string' && p.repo.trim() ? p.repo.trim() : undefined;
    broadcastUpdateProgress({
      ...currentUpdateState,
      status: 'checking',
      message: 'Comprobando lanzamientos en GitHub Releases...',
      error: null,
    });
    const info = await checkForReleaseUpdate(GAME_VERSION, repo);
    if (info.error) {
      broadcastUpdateProgress({
        ...currentUpdateState,
        status: 'error',
        message: info.error,
        error: info.error,
      });
    } else if (info.hasUpdate) {
      broadcastUpdateProgress({
        status: 'available',
        progressPercent: 0,
        downloadedBytes: 0,
        totalBytes: info.sizeBytes ?? 0,
        downloadedPath: null,
        message: `Nueva versión v${info.latestVersion} disponible.`,
        error: null,
      });
    } else {
      broadcastUpdateProgress({
        status: 'up_to_date',
        progressPercent: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        downloadedPath: null,
        message: `Estás en la versión más reciente (v${GAME_VERSION}).`,
        error: null,
      });
    }
    return info;
  });

  ipcMain.handle('mr:download-update', async (_evt, rawInfo: unknown) => {
    const info = rawInfo as ReleaseUpdateInfo | null;
    if (!info || typeof info !== 'object' || typeof info.downloadUrl !== 'string') {
      return { ok: false, error: 'Información de actualización inválida.' };
    }
    if (!/^https:\/\//i.test(info.downloadUrl)) {
      return { ok: false, error: 'Solo se permiten descargas seguras por HTTPS.' };
    }
    if (activeDownloadAbort) {
      activeDownloadAbort.abort();
      activeDownloadAbort = null;
    }
    activeDownloadAbort = new AbortController();
    const result = await downloadAndVerifyRelease(
      info,
      updatesDir,
      broadcastUpdateProgress,
      activeDownloadAbort.signal,
    );
    activeDownloadAbort = null;
    return result;
  });

  ipcMain.handle('mr:install-update', async (_evt, rawPayload: unknown) => {
    const p = (rawPayload && typeof rawPayload === 'object' ? rawPayload : {}) as {
      installerPath?: unknown;
      targetVersion?: unknown;
    };
    const requestedPath =
      typeof p.installerPath === 'string' && p.installerPath.trim()
        ? path.resolve(p.installerPath.trim())
        : currentUpdateState.downloadedPath
          ? path.resolve(currentUpdateState.downloadedPath)
          : '';
    const resolvedUpdatesRoot = path.resolve(updatesDir);
    if (
      !requestedPath ||
      !requestedPath.startsWith(resolvedUpdatesRoot + path.sep) ||
      !/\.exe$/i.test(requestedPath) ||
      !fs.existsSync(requestedPath)
    ) {
      return {
        ok: false,
        error: 'El archivo instalador verificado no existe dentro de la carpeta de actualizaciones.',
      };
    }

    const targetVersion =
      typeof p.targetVersion === 'string' && p.targetVersion.trim()
        ? p.targetVersion.trim()
        : GAME_VERSION;

    try {
      const snapshot = createPreUpdateRollbackSnapshot(userDataDataDir, backupDir, targetVersion);
      broadcastUpdateProgress({
        ...currentUpdateState,
        status: 'installing',
        message: `Respaldo SQLite creado (${snapshot.copiedFiles.length} archivos). Iniciando instalador...`,
        error: null,
      });

      isQuitting = true;
      stopCloudflaredProcess();
      try {
        const base = IS_DEV ? DEV_SERVER_URL : `http://127.0.0.1:${localServerPort}`;
        await fetch(`${base}/api/lan/stop`, { method: 'POST' }).catch(() => {});
      } catch {
        // ignore stop lan failure
      }
      await stopServerWorker();

      const openErr = await shell.openPath(requestedPath);
      if (openErr) {
        isQuitting = false;
        const errMsg = `No se pudo abrir el instalador: ${openErr}`;
        broadcastUpdateProgress({
          ...currentUpdateState,
          status: 'error',
          message: errMsg,
          error: errMsg,
        });
        return { ok: false, error: errMsg };
      }

      setTimeout(() => app.quit(), 450);
      return { ok: true, snapshotDir: snapshot.snapshotDir };
    } catch (err) {
      isQuitting = false;
      const errMsg = err instanceof Error ? err.message : String(err);
      broadcastUpdateProgress({
        ...currentUpdateState,
        status: 'error',
        message: 'Error al preparar la instalación. Tus datos permanecen intactos.',
        error: errMsg,
      });
      return { ok: false, error: errMsg };
    }
  });

  ipcMain.handle('mr:open-external-url', async (_evt, rawUrl: unknown) => {
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!/^https:\/\//i.test(url)) {
      return { ok: false, error: 'Solo se permiten enlaces HTTPS externos.' };
    }
    await shell.openExternal(url);
    return { ok: true };
  });
}

/* ---------------- APP LIFECYCLE ---------------- */

app.whenReady().then(async () => {
  if (!gotLock) return;
  registerIpcHandlers();

  try {
    const port = await startPackagedServerWorker();
    await createMainWindow(port);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      'Error al iniciar METRO RUSH: NEON CITY',
      `No se pudo iniciar el servidor local del videojuego.\n\nDetalle: ${msg}\n\nComprueba que ningún antivirus esté bloqueando la aplicación e inténtalo de nuevo.`,
    );
    app.quit();
  }
});

app.on('before-quit', async (e) => {
  stopCloudflaredProcess();
  if (isQuitting) return;
  isQuitting = true;
  if (serverWorker) {
    e.preventDefault();
    await stopServerWorker();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopCloudflaredProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
