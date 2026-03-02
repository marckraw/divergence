import { eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import {
  remoteAccessSettings,
  remoteSessions,
  type RemoteAccessSettingsRow,
} from "../../../shared/api/schema.types";

// ── Settings ─────────────────────────────────────────────────────────────

export async function getRemoteAccessSettings(): Promise<RemoteAccessSettingsRow | null> {
  const rows = await db.select().from(remoteAccessSettings).limit(1);
  return rows[0] ?? null;
}

export async function enableRemoteAccess(port: number, masterTokenHash: string): Promise<void> {
  const existing = await getRemoteAccessSettings();
  if (existing) {
    await db
      .update(remoteAccessSettings)
      .set({ enabled: true, port, masterTokenHash })
      .where(eq(remoteAccessSettings.id, 1));
  } else {
    await db.insert(remoteAccessSettings).values({
      id: 1,
      enabled: true,
      port,
      masterTokenHash,
      createdAtMs: Date.now(),
    });
  }
}

export async function disableRemoteAccess(): Promise<void> {
  await db
    .update(remoteAccessSettings)
    .set({ enabled: false })
    .where(eq(remoteAccessSettings.id, 1));
}

export async function storePairingCode(code: string, expiresMs: number): Promise<void> {
  await db
    .update(remoteAccessSettings)
    .set({
      pairingCode: code,
      pairingCodeExpiresMs: expiresMs,
      pairingAttempts: 0,
    })
    .where(eq(remoteAccessSettings.id, 1));
}

export async function clearPairingCode(): Promise<void> {
  await db
    .update(remoteAccessSettings)
    .set({ pairingCode: null, pairingCodeExpiresMs: null, pairingAttempts: 0 })
    .where(eq(remoteAccessSettings.id, 1));
}

// ── Sessions ─────────────────────────────────────────────────────────────

export interface RemoteSessionInfo {
  id: number;
  deviceName: string;
  pairedAtMs: number;
  lastSeenMs: number;
  revoked: boolean;
}

export async function listRemoteSessions(): Promise<RemoteSessionInfo[]> {
  const rows = await db
    .select({
      id: remoteSessions.id,
      deviceName: remoteSessions.deviceName,
      pairedAtMs: remoteSessions.pairedAtMs,
      lastSeenMs: remoteSessions.lastSeenMs,
      revoked: remoteSessions.revoked,
    })
    .from(remoteSessions)
    .orderBy(remoteSessions.lastSeenMs);
  return rows;
}

export async function revokeSession(sessionId: number): Promise<void> {
  await db
    .update(remoteSessions)
    .set({ revoked: true })
    .where(eq(remoteSessions.id, sessionId));
}

export async function revokeAllSessions(): Promise<void> {
  await db.update(remoteSessions).set({ revoked: true });
}
