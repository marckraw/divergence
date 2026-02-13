export const MAX_AUTO_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

export function shouldAutoReconnect(exitCode: number, useTmux: boolean, attempt: number): boolean {
  if (attempt >= MAX_AUTO_RECONNECT_ATTEMPTS) return false;
  if (useTmux) return true;
  return exitCode !== 0;
}

export function getReconnectDelayMs(attempt: number): number {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}
