import type { RemoteSessionDisplay } from "./remoteAccess.types";

export function generateRandomToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function derivePairingCode(tokenHash: string): string {
  let sum = 0;
  for (let i = 0; i < tokenHash.length; i++) {
    sum = (sum * 31 + tokenHash.charCodeAt(i)) >>> 0;
  }
  const now = Date.now();
  const mixed = (sum * 31 + (now & 0xffffffff)) >>> 0;
  const code = mixed % 1_000_000;
  return String(code).padStart(6, "0");
}

export function formatLastSeen(lastSeenMs: number): string {
  const diffMs = Date.now() - lastSeenMs;
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

export function formatPairedAt(pairedAtMs: number): string {
  return new Date(pairedAtMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

export function isSessionActive(lastSeenMs: number): boolean {
  return Date.now() - lastSeenMs < ACTIVE_THRESHOLD_MS;
}

export function mapSessionToDisplay(session: {
  id: number;
  deviceName: string;
  pairedAtMs: number;
  lastSeenMs: number;
  revoked: boolean;
}): RemoteSessionDisplay {
  return {
    id: session.id,
    deviceName: session.deviceName,
    pairedAt: formatPairedAt(session.pairedAtMs),
    lastSeen: formatLastSeen(session.lastSeenMs),
    lastSeenMs: session.lastSeenMs,
    revoked: session.revoked,
    isActive: !session.revoked && isSessionActive(session.lastSeenMs),
  };
}

export function getRemainingSeconds(expiresMs: number | null): number {
  if (!expiresMs) return 0;
  return Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000));
}
