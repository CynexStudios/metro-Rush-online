import {
  LanHostState,
  ReleaseUpdateInfo,
  TunnelState,
  UpdateProgressState,
} from '../game/types';

export interface DesktopInfo {
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

export interface PersistedDesktopSession {
  accessToken?: string;
  refreshToken?: string;
  onlineBackendUrl?: string;
  activeLocalProfileId?: string;
  lastUserId?: string;
}

export interface MetroDesktopBridge {
  isElectron: boolean;
  getDesktopInfo: () => Promise<DesktopInfo>;
  getLanStatus: () => Promise<LanHostState & { gameVersion?: string }>;
  startLanHost: (
    bindAddress: string,
    port: number,
  ) => Promise<{ ok: boolean; state?: LanHostState; error?: string }>;
  stopLanHost: () => Promise<{ ok: boolean; state?: LanHostState }>;
  exportBackupFile: (
    defaultFilename: string,
    jsonContent: string,
  ) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  importBackupFile: () => Promise<{
    ok: boolean;
    content?: string;
    fileName?: string;
    canceled?: boolean;
    error?: string;
  }>;
  openBackupsFolder: () => Promise<{ ok: boolean }>;
  loadSecureSession: () => Promise<{ ok: boolean; data: PersistedDesktopSession | null }>;
  saveSecureSession: (
    data: PersistedDesktopSession,
  ) => Promise<{ ok: boolean; encrypted?: boolean; error?: string }>;
  clearSecureSession: () => Promise<{ ok: boolean }>;
  getTunnelStatus: () => Promise<TunnelState>;
  startCloudflaredTunnel: (
    targetPort: number,
  ) => Promise<{ ok: boolean; state: TunnelState; error?: string }>;
  stopCloudflaredTunnel: () => Promise<{ ok: boolean; state: TunnelState }>;
  checkFirewallPort: (
    port: number,
  ) => Promise<{ ok: boolean; supported: boolean; allowed: boolean; ruleName?: string }>;
  allowFirewallPort: (
    port: number,
  ) => Promise<{ ok: boolean; allowed?: boolean; message?: string; error?: string }>;
  quitApp: () => Promise<{ ok: boolean }>;
  restartLocalServer: () => Promise<{ ok: boolean; port?: number }>;
  checkForUpdates: (repo?: string) => Promise<ReleaseUpdateInfo>;
  downloadUpdate: (
    info: ReleaseUpdateInfo,
  ) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  installUpdate: (
    installerPath: string,
    targetVersion?: string,
  ) => Promise<{ ok: boolean; snapshotDir?: string; error?: string }>;
  getUpdateState: () => Promise<UpdateProgressState>;
  openExternalUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
  onServerStatus: (callback: (evt: DesktopServerStatusEvent) => void) => () => void;
  onUpdateProgress: (callback: (evt: UpdateProgressState) => void) => () => void;
}

declare global {
  interface Window {
    metroDesktop?: MetroDesktopBridge;
  }
}

export {};
