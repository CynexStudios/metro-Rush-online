process.env.METRO_RUSH_EMBEDDED = '1';

import { startAppServer, RunningAppServer } from '../server';

let activeServer: RunningAppServer | null = null;

async function boot() {
  try {
    const port = Number(process.env.PORT || 0);
    const forceProdStatic = process.env.METRO_RUSH_FORCE_STATIC === '1';
    const distDir = process.env.METRO_RUSH_DIST_DIR || undefined;
    activeServer = await startAppServer({
      port,
      host: '127.0.0.1',
      distDir,
      forceProdStatic,
    });
    process.parentPort?.postMessage({
      type: 'ready',
      port: activeServer.port,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.parentPort?.postMessage({
      type: 'error',
      error: message,
    });
    process.exit(1);
  }
}

process.parentPort?.on('message', async (evt) => {
  const data = evt.data as { type?: string } | undefined;
  if (data?.type === 'shutdown') {
    if (activeServer) {
      try {
        await activeServer.close();
      } catch {
        // Ignore shutdown errors
      }
      activeServer = null;
    }
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
  if (activeServer) {
    try {
      await activeServer.close();
    } catch {
      // Ignore
    }
  }
  process.exit(0);
});

void boot();
