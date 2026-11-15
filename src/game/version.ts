export const GAME_VERSION = '2.4.0';
export const PROTOCOL_VERSION = 2;

export function isVersionCompatible(remoteVersion: string | undefined | null): boolean {
  if (!remoteVersion) return false;
  const [majA, minA] = GAME_VERSION.split('.').map(Number);
  const [majB, minB] = String(remoteVersion).split('.').map(Number);
  return majA === majB && minA === minB;
}
