export interface RemoteAccessState {
  enabled: boolean;
  port: number;
  pairingCode: string | null;
  pairingCodeExpiresMs: number | null;
  sessions: RemoteSessionDisplay[];
  loading: boolean;
}

export interface RemoteSessionDisplay {
  id: number;
  deviceName: string;
  pairedAt: string;
  lastSeen: string;
  lastSeenMs: number;
  revoked: boolean;
  isActive: boolean;
}

export const DEFAULT_WS_PORT = 9347;
export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
export const MAX_ACTIVE_SESSIONS = 3;
