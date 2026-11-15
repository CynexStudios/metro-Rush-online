import { contextBridge, ipcRenderer } from 'electron';

export interface DesktopInfoPayload {
  isElectron: boolean;
  gameVersion: string;
  platform: string;
  userDataDir: string;
  backupDir: string;
  localServerPort: number;
  serverHealthy: boolean;
  serverError: string | null;
}

export interface DesktopServerStatusEvent {
  status: 'starting' | 'ready' | 'crashed' | 'restarting' | 'error';
  message: string;
  port?: number;
}

const VALID_SERVER_EVENTS = new Set([
  'starting',
  'ready',
  'crashed',
  'restarting',
  'error',
]);

contextBridge.exposeInMainWorld('metroDesktop', {
  isElectron: true,
  getDesktopInfo: (): Promise<DesktopInfoPayload> =>
    ipcRenderer.invoke('mr:get-desktop-info'),
  getLanStatus: () => ipcRenderer.invoke('mr:get-lan-status'),
  startLanHost: (bindAddress: string, port: number) =>
    ipcRenderer.invoke('mr:start-lan-host', {
      bindAddress: String(bindAddress || '0.0.0.0'),
      port: Number(port || 3077),
    }),
  stopLanHost: () => ipcRenderer.invoke('mr:stop-lan-host'),
  exportBackupFile: (defaultFilename: string, jsonContent: string) =>
    ipcRenderer.invoke('mr:export-backup', {
      defaultFilename: String(defaultFilename || 'metro-rush-backup.json'),
      jsonContent: String(jsonContent || ''),
    }),
  importBackupFile: () => ipcRenderer.invoke('mr:import-backup'),
  openBackupsFolder: () => ipcRenderer.invoke('mr:open-backups-folder'),
  loadSecureSession: () => ipcRenderer.invoke('mr:load-secure-session'),
  saveSecureSession: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('mr:save-secure-session', data),
  clearSecureSession: () => ipcRenderer.invoke('mr:clear-secure-session'),
  getTunnelStatus: () => ipcRenderer.invoke('mr:get-tunnel-status'),
  startCloudflaredTunnel: (targetPort: number) =>
    ipcRenderer.invoke('mr:start-cloudflared-tunnel', { targetPort: Number(targetPort || 3077) }),
  stopCloudflaredTunnel: () => ipcRenderer.invoke('mr:stop-cloudflared-tunnel'),
  quitApp: () => ipcRenderer.invoke('mr:quit-app'),
  restartLocalServer: () => ipcRenderer.invoke('mr:restart-local-server'),
  onServerStatus: (callback: (evt: DesktopServerStatusEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DesktopServerStatusEvent) => {
      if (!data || typeof data !== 'object' || !VALID_SERVER_EVENTS.has(data.status)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('mr:server-status', handler);
    return () => {
      ipcRenderer.removeListener('mr:server-status', handler);
    };
  },
});
