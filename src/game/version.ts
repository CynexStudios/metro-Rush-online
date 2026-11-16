export const GAME_VERSION = '3.0.1';
export const PROTOCOL_VERSION = 3;

export function isVersionCompatible(remoteVersion: string | undefined | null): boolean {
  if (!remoteVersion) return false;
  const [majA, minA] = GAME_VERSION.split('.').map(Number);
  const [majB, minB] = String(remoteVersion).split('.').map(Number);
  return majA === majB && minA === minB;
}

export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const cleanB = b.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(cleanA.length, cleanB.length, 3);
  for (let i = 0; i < len; i++) {
    const na = cleanA[i] ?? 0;
    const nb = cleanB[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
