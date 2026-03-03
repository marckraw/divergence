import { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalSession } from "../../entities";
import {
  buildIdleNotificationTargetLabel,
  shouldNotifyIdle,
} from "../lib/idleNotification.pure";
import { notifyCommandFinished } from "../../shared";

const NOTIFY_MIN_BUSY_MS = 5000;
const NOTIFY_IDLE_DELAY_MS = 1500;
const NOTIFY_COOLDOWN_MS = 3000;

interface UseIdleNotificationParams {
  activeSessionId: string | null;
  projectsById: Map<number, { name: string }>;
  sessionsRef: React.MutableRefObject<Map<string, TerminalSession>>;
  statusBySessionRef: React.MutableRefObject<Map<string, TerminalSession["status"]>>;
}

export function useIdleNotification({
  activeSessionId,
  projectsById,
  sessionsRef,
  statusBySessionRef,
}: UseIdleNotificationParams) {
  const [idleAttentionSessionIds, setIdleAttentionSessionIds] = useState<Set<string>>(new Set());
  const idleNotifyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastNotifiedAtRef = useRef<Map<string, number>>(new Map());
  const busySinceRef = useRef<Map<string, number>>(new Map());
  const activeSessionIdRef = useRef<string | null>(activeSessionId);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const clearIdleNotifyTimer = useCallback((sessionId: string) => {
    const existing = idleNotifyTimersRef.current.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      idleNotifyTimersRef.current.delete(sessionId);
    }
  }, []);

  const clearIdleAttention = useCallback((sessionId: string) => {
    setIdleAttentionSessionIds((prev) => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const markIdleAttention = useCallback((sessionId: string) => {
    setIdleAttentionSessionIds((prev) => {
      if (prev.has(sessionId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
  }, []);

  const clearNotificationTracking = useCallback((sessionId: string) => {
    clearIdleNotifyTimer(sessionId);
    clearIdleAttention(sessionId);
    busySinceRef.current.delete(sessionId);
    statusBySessionRef.current.delete(sessionId);
    lastNotifiedAtRef.current.delete(sessionId);
  }, [clearIdleNotifyTimer, clearIdleAttention, statusBySessionRef]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    clearIdleAttention(activeSessionId);
  }, [activeSessionId, clearIdleAttention]);

  const scheduleIdleNotification = useCallback((sessionId: string, startedAt: number) => {
    clearIdleNotifyTimer(sessionId);

    const timeoutId = setTimeout(async () => {
      const currentSession = sessionsRef.current.get(sessionId);
      const now = Date.now();
      const duration = now - startedAt;
      const lastNotifiedAt = lastNotifiedAtRef.current.get(sessionId) ?? 0;
      const activeId = activeSessionIdRef.current;
      const shouldNotify = shouldNotifyIdle({
        sessionExists: Boolean(currentSession),
        sessionStatus: currentSession?.status ?? null,
        durationMs: duration,
        notifyMinBusyMs: NOTIFY_MIN_BUSY_MS,
        nowMs: now,
        lastNotifiedAtMs: lastNotifiedAt,
        notifyCooldownMs: NOTIFY_COOLDOWN_MS,
        isWindowFocused: document.hasFocus(),
        isSessionActive: activeId === sessionId,
      });
      if (!shouldNotify || !currentSession) {
        return;
      }

      const projectName = projectsById.get(currentSession.projectId)?.name ?? currentSession.name;
      const targetLabel = buildIdleNotificationTargetLabel(currentSession, projectName);

      await notifyCommandFinished("Command finished", `${targetLabel} is idle`);
      lastNotifiedAtRef.current.set(sessionId, now);
      busySinceRef.current.delete(sessionId);
    }, NOTIFY_IDLE_DELAY_MS);

    idleNotifyTimersRef.current.set(sessionId, timeoutId);
  }, [clearIdleNotifyTimer, projectsById, sessionsRef]);

  const onSessionBecameIdle = useCallback((sessionId: string) => {
    const previousStatus = statusBySessionRef.current.get(sessionId) ?? "idle";
    const startedAt = busySinceRef.current.get(sessionId);
    if (previousStatus === "busy" && activeSessionIdRef.current !== sessionId) {
      markIdleAttention(sessionId);
    }
    if (startedAt) {
      scheduleIdleNotification(sessionId, startedAt);
    }
  }, [markIdleAttention, scheduleIdleNotification, statusBySessionRef]);

  const onSessionBecameBusy = useCallback((sessionId: string) => {
    clearIdleAttention(sessionId);
    busySinceRef.current.set(sessionId, Date.now());
    clearIdleNotifyTimer(sessionId);
  }, [clearIdleAttention, clearIdleNotifyTimer]);

  const onSessionBecameActive = useCallback((sessionId: string) => {
    clearIdleAttention(sessionId);
    clearIdleNotifyTimer(sessionId);
  }, [clearIdleAttention, clearIdleNotifyTimer]);

  return {
    idleAttentionSessionIds,
    setIdleAttentionSessionIds,
    clearNotificationTracking,
    onSessionBecameIdle,
    onSessionBecameBusy,
    onSessionBecameActive,
  };
}
