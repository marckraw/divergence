import { useCallback, useEffect, useState } from "react";
import {
  getRemoteAccessSettings,
  enableRemoteAccess,
  disableRemoteAccess,
  storePairingCode,
  clearPairingCode,
  listRemoteSessions,
  revokeSession,
  revokeAllSessions,
} from "../api/remoteAccess.api";
import {
  generateRandomToken,
  derivePairingCode,
  mapSessionToDisplay,
  getRemainingSeconds,
} from "../model/remoteAccess.pure";
import {
  DEFAULT_WS_PORT,
  PAIRING_CODE_TTL_MS,
  type RemoteSessionDisplay,
} from "../model/remoteAccess.types";
import RemoteAccessSettingsPresentational from "./RemoteAccessSettings.presentational";

interface RemoteAccessSettingsContainerProps {
  autoGenerateCode?: boolean;
}

export default function RemoteAccessSettingsContainer({ autoGenerateCode }: RemoteAccessSettingsContainerProps) {
  const [enabled, setEnabled] = useState(false);
  const [port, setPort] = useState(DEFAULT_WS_PORT);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresMs, setPairingExpiresMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [sessions, setSessions] = useState<RemoteSessionDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async () => {
    try {
      const settings = await getRemoteAccessSettings();
      if (settings) {
        setEnabled(settings.enabled);
        setPort(settings.port);
        setPairingCode(settings.pairingCode);
        setPairingExpiresMs(settings.pairingCodeExpiresMs);
        setRemainingSeconds(getRemainingSeconds(settings.pairingCodeExpiresMs));
      }

      const sessionRows = await listRemoteSessions();
      setSessions(sessionRows.map(mapSessionToDisplay));
    } catch (err) {
      console.error("[remote-access] Failed to load state:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Countdown timer for pairing code
  useEffect(() => {
    if (!pairingExpiresMs) return;

    setRemainingSeconds(getRemainingSeconds(pairingExpiresMs));
    const interval = setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(pairingExpiresMs));
    }, 1000);

    return () => clearInterval(interval);
  }, [pairingExpiresMs]);

  const handleToggle = useCallback(async (newEnabled: boolean) => {
    try {
      if (newEnabled) {
        const token = generateRandomToken();
        await enableRemoteAccess(DEFAULT_WS_PORT, token);
      } else {
        await disableRemoteAccess();
        await clearPairingCode();
        setPairingCode(null);
        setPairingExpiresMs(null);
      }
      setEnabled(newEnabled);
    } catch (err) {
      console.error("[remote-access] Failed to toggle:", err);
    }
  }, []);

  const handleGenerateCode = useCallback(async () => {
    try {
      let settings = await getRemoteAccessSettings();

      // If no master token exists, generate one and persist it
      if (!settings?.masterTokenHash) {
        const token = generateRandomToken();
        await enableRemoteAccess(settings?.port ?? DEFAULT_WS_PORT, token);
        settings = await getRemoteAccessSettings();
        if (!settings?.masterTokenHash) return;
      }

      const code = derivePairingCode(settings.masterTokenHash);
      const expiresMs = Date.now() + PAIRING_CODE_TTL_MS;
      await storePairingCode(code, expiresMs);
      setPairingCode(code);
      setPairingExpiresMs(expiresMs);
    } catch (err) {
      console.error("[remote-access] Failed to generate code:", err);
    }
  }, []);

  // Auto-generate pairing code when opened from a mobile handshake event
  useEffect(() => {
    if (!autoGenerateCode || loading || !enabled || pairingCode) return;
    void handleGenerateCode();
  }, [autoGenerateCode, loading, enabled, pairingCode, handleGenerateCode]);

  const handleRevokeSession = useCallback(async (sessionId: number) => {
    try {
      await revokeSession(sessionId);
      await loadState();
    } catch (err) {
      console.error("[remote-access] Failed to revoke session:", err);
    }
  }, [loadState]);

  const handleRevokeAll = useCallback(async () => {
    try {
      await revokeAllSessions();
      await loadState();
    } catch (err) {
      console.error("[remote-access] Failed to revoke all:", err);
    }
  }, [loadState]);

  if (loading) return null;

  return (
    <RemoteAccessSettingsPresentational
      enabled={enabled}
      port={port}
      pairingCode={pairingCode}
      remainingSeconds={remainingSeconds}
      sessions={sessions}
      onToggle={handleToggle}
      onGenerateCode={handleGenerateCode}
      onRevokeSession={handleRevokeSession}
      onRevokeAll={handleRevokeAll}
    />
  );
}
