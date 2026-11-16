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

const VALID_UPDATE_STATUSES = new Set([
  'idle',
  'checking',
  'available',
  'up_to_date',
  'downloading',
  'verifying',
  'ready_to_install',
  'installing',
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
  openFirewallPort: (port: number) =>
    ipcRenderer.invoke('mr:open-firewall-port', { port: Number(port || 3077) }),
  startCloudflaredTunnel: (targetPort: number) =>
    ipcRenderer.invoke('mr:start-cloudflared-tunnel', { targetPort: Number(targetPort || 3077) }),
  stopCloudflaredTunnel: () => ipcRenderer.invoke('mr:stop-cloudflared-tunnel'),
  checkFirewallPort: (port: number) =>
    ipcRenderer.invoke('mr:check-firewall-port', Number(port || 3077)),
  allowFirewallPort: (port: number) =>
    ipcRenderer.invoke('mr:allow-firewall-port', Number(port || 3077)),
  quitApp: () => ipcRenderer.invoke('mr:quit-app'),
  restartLocalServer: () => ipcRenderer.invoke('mr:restart-local-server'),
  checkForUpdates: (repo?: string) =>
    ipcRenderer.invoke('mr:check-for-updates', repo ? { repo: String(repo) } : {}),
  downloadUpdate: (info: Record<string, unknown>) =>
    ipcRenderer.invoke('mr:download-update', info),
  installUpdate: (installerPath: string, targetVersion?: string) =>
    ipcRenderer.invoke('mr:install-update', {
      installerPath: String(installerPath || ''),
      targetVersion: targetVersion ? String(targetVersion) : undefined,
    }),
  getUpdateState: () => ipcRenderer.invoke('mr:get-update-state'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('mr:open-external-url', String(url || '')),
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
  onUpdateProgress: (callback: (evt: Record<string, unknown>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Record<string, unknown>) => {
      if (
        !data ||
        typeof data !== 'object' ||
        typeof data.status !== 'string' ||
        !VALID_UPDATE_STATUSES.has(data.status)
      ) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('mr:update-progress', handler);
    return () => {
      ipcRenderer.removeListener('mr:update-progress', handler);
    };
  },
});
