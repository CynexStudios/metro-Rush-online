import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = process.cwd();
const DIST_ELECTRON = path.join(ROOT, 'dist-electron');

async function waitForServerReady(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // Wait and retry
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}

async function run() {
  fs.mkdirSync(DIST_ELECTRON, { recursive: true });
  await Promise.all([
    esbuild.build({
      entryPoints: [path.join(ROOT, 'electron', 'main.ts')],
      outfile: path.join(DIST_ELECTRON, 'main.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron'],
    }),
    esbuild.build({
      entryPoints: [path.join(ROOT, 'electron', 'preload.ts')],
      outfile: path.join(DIST_ELECTRON, 'preload.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron'],
    }),
  ]);

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const serverProc = spawn(npxCmd, ['tsx', 'server.ts'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PORT: '3000' },
  });

  const devUrl = 'http://127.0.0.1:3000';
  const ready = await waitForServerReady(devUrl);
  if (!ready) {
    console.error('El servidor de desarrollo no respondió a tiempo en http://127.0.0.1:3000.');
    serverProc.kill();
    process.exit(1);
  }

  const electronBin = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron',
  );
  const electronProc = spawn(electronBin, ['.'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      METRO_RUSH_DEV_URL: devUrl,
    },
  });

  const cleanup = () => {
    try {
      serverProc.kill();
    } catch {
      // Ignore
    }
  };

  electronProc.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
