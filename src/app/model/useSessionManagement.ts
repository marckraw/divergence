import { useState, useCallback, useEffect, useRef } from "react";
import type {
  Project,
  Divergence,
  TerminalSession,
  SplitSessionState,
} from "../../entities";
import type { PortAllocation } from "../../entities/port-management";
import type { ProjectSettings } from "../../entities/project";
import { buildSplitTmuxSessionName } from "../../entities/terminal-session";
import { killTmuxSession } from "../../shared/api/tmuxSessions.api";
import {
  buildTerminalSession,
  buildWorkspaceKey,
  generateSessionEntropy,
} from "../lib/sessionBuilder.pure";

interface SessionNotificationCallbacks {
  clearNotificationTracking: (sessionId: string) => void;
  onSessionBecameBusy: (sessionId: string) => void;
  onSessionBecameActive: (sessionId: string) => void;
  onSessionBecameIdle: (sessionId: string) => void;
}

interface UseSessionManagementParams {
  settingsByProjectId: Map<number, ProjectSettings>;
  projectsById: Map<number, { name: string }>;
  appSettings: {
    tmuxHistoryLimit: number;
  };
  portAllocationByEntityKey: Map<string, PortAllocation>;
  splitBySessionId: Map<string, SplitSessionState>;
  setSplitBySessionId: React.Dispatch<React.SetStateAction<Map<string, SplitSessionState>>>;
  notificationCallbacksRef: React.MutableRefObject<SessionNotificationCallbacks>;
}

interface UseSessionManagementResult {
  sessions: Map<string, TerminalSession>;
  setSessions: React.Dispatch<React.SetStateAction<Map<string, TerminalSession>>>;
  activeSessionId: string | null;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  sessionsRef: React.MutableRefObject<Map<string, TerminalSession>>;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  statusBySessionRef: React.MutableRefObject<Map<string, TerminalSession["status"]>>;
  commandBySessionIdRef: React.MutableRefObject<Map<string, (command: string) => void>>;
  reconnectBySessionId: Map<string, number>;
  createSession: (type: "project" | "divergence", target: Project | Divergence) => TerminalSession;
  createManualSession: (type: "project" | "divergence", target: Project | Divergence) => TerminalSession;
  handleSelectProject: (project: Project) => void;
  handleSelectDivergence: (divergence: Divergence) => void;
  handleCreateAdditionalSession: (type: "project" | "divergence", item: Project | Divergence) => void;
  handleCloseSession: (sessionId: string) => void;
  handleCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
  handleRegisterTerminalCommand: (sessionId: string, sendCommand: (command: string) => void) => void;
  handleUnregisterTerminalCommand: (sessionId: string) => void;
  sendCommandToSession: (sessionId: string, command: string, options?: { timeoutMs?: number; activateIfNeeded?: boolean }) => Promise<void>;
  handleSendPromptToSession: (sessionId: string, prompt: string) => Promise<void>;
  handleReconnectSession: (sessionId: string) => void;
  handleSessionStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  closeSessionsForProject: (projectId: number) => void;
  closeSessionsForDivergence: (divergenceId: number) => void;
  closeSessionsForWorkspaceDivergence: (wdId: number) => void;
}

export type { SessionNotificationCallbacks };

export function useSessionManagement({
  settingsByProjectId,
  projectsById,
  appSettings,
  portAllocationByEntityKey,
  splitBySessionId,
  setSplitBySessionId,
  notificationCallbacksRef,
}: UseSessionManagementParams): UseSessionManagementResult {
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [reconnectBySessionId, setReconnectBySessionId] = useState<Map<string, number>>(new Map());

  const sessionsRef = useRef<Map<string, TerminalSession>>(sessions);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const statusBySessionRef = useRef<Map<string, TerminalSession["status"]>>(new Map());
  const commandBySessionIdRef = useRef<Map<string, (command: string) => void>>(new Map());

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Sync tmux history limit when settings change
  useEffect(() => {
    setSessions(prev => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, session] of next) {
        const projectSettings = settingsByProjectId.get(session.projectId);
        const projectHistoryLimit = projectSettings?.tmuxHistoryLimit ?? null;
        const effectiveHistoryLimit = projectHistoryLimit ?? appSettings.tmuxHistoryLimit;
        if (session.tmuxHistoryLimit !== effectiveHistoryLimit) {
          next.set(id, { ...session, tmuxHistoryLimit: effectiveHistoryLimit });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [appSettings.tmuxHistoryLimit, settingsByProjectId]);

  const createSession = useCallback((
    type: "project" | "divergence",
    target: Project | Divergence
  ): TerminalSession => {
    const id = `${type}-${target.id}`;
    const existing = sessionsRef.current.get(id);
    if (existing) {
      return existing;
    }

    const portAllocation = portAllocationByEntityKey.get(`${type}:${target.id}`) ?? null;
    const session = buildTerminalSession({
      type,
      target,
      settingsByProjectId,
      projectsById,
      globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
      portAllocation,
    });

    setSessions((previous) => {
      const next = new Map(previous);
      next.set(id, session);
      return next;
    });
    return session;
  }, [settingsByProjectId, projectsById, appSettings.tmuxHistoryLimit, portAllocationByEntityKey]);

  const createManualSession = useCallback((
    type: "project" | "divergence",
    target: Project | Divergence
  ): TerminalSession => {
    const entropy = generateSessionEntropy();
    const sessionId = `${type}-${target.id}#manual-${entropy}`;
    const workspaceSessions = Array.from(sessionsRef.current.values())
      .filter((session) => session.type === type && session.targetId === target.id);
    const manualIndex = workspaceSessions.filter((session) => session.sessionRole === "manual").length + 1;

    const portAllocation = portAllocationByEntityKey.get(`${type}:${target.id}`) ?? null;
    const base = buildTerminalSession({
      type,
      target,
      settingsByProjectId,
      projectsById,
      globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
      portAllocation,
    });
    const session: TerminalSession = {
      ...base,
      id: sessionId,
      workspaceKey: buildWorkspaceKey(type, target.id),
      sessionRole: "manual",
      name: `${base.name} • session #${manualIndex}`,
      tmuxSessionName: base.useTmux
        ? buildSplitTmuxSessionName(base.tmuxSessionName, `manual-${entropy}`)
        : base.tmuxSessionName,
      status: "idle",
      lastActivity: new Date(),
    };

    setSessions((previous) => {
      const next = new Map(previous);
      next.set(session.id, session);
      return next;
    });
    return session;
  }, [settingsByProjectId, projectsById, appSettings.tmuxHistoryLimit, portAllocationByEntityKey]);

  const handleSelectProject = useCallback((project: Project) => {
    const session = createSession("project", project);
    setActiveSessionId(session.id);
  }, [createSession]);

  const handleSelectDivergence = useCallback((divergence: Divergence) => {
    const session = createSession("divergence", divergence);
    setActiveSessionId(session.id);
  }, [createSession]);

  const handleCreateAdditionalSession = useCallback((
    type: "project" | "divergence",
    item: Project | Divergence
  ) => {
    const session = createManualSession(type, item);
    setActiveSessionId(session.id);
  }, [createManualSession]);

  const handleCloseSession = useCallback((sessionId: string) => {
    notificationCallbacksRef.current.clearNotificationTracking(sessionId);
    setSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.delete(sessionId);
      return newSessions;
    });
    setSplitBySessionId(prev => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    setReconnectBySessionId(prev => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    commandBySessionIdRef.current.delete(sessionId);
    setActiveSessionId(prev => (prev === sessionId ? null : prev));
  }, [notificationCallbacksRef, setSplitBySessionId]);

  const handleCloseSessionAndKillTmux = useCallback(async (sessionId: string) => {
    const session = sessionsRef.current.get(sessionId);
    const splitState = splitBySessionId.get(sessionId) ?? null;
    handleCloseSession(sessionId);

    if (!session?.useTmux) {
      return;
    }

    const paneIds = splitState?.paneIds ?? ["pane-1"];
    const tmuxNames = Array.from(new Set(paneIds.map((paneId) => (
      paneId === "pane-1"
        ? session.tmuxSessionName
        : buildSplitTmuxSessionName(session.tmuxSessionName, paneId)
    ))));
    for (const tmuxName of tmuxNames) {
      try {
        await killTmuxSession(tmuxName);
      } catch (error) {
        console.warn(`Failed to kill tmux session ${tmuxName}:`, error);
      }
    }
  }, [handleCloseSession, splitBySessionId]);

  const handleRegisterTerminalCommand = useCallback((sessionId: string, sendCommand: (command: string) => void) => {
    commandBySessionIdRef.current.set(sessionId, sendCommand);
  }, []);

  const handleUnregisterTerminalCommand = useCallback((sessionId: string) => {
    commandBySessionIdRef.current.delete(sessionId);
  }, []);

  const waitForSessionCommand = useCallback((sessionId: string, timeoutMs = 8000): Promise<((command: string) => void)> => {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const poll = () => {
        const command = commandBySessionIdRef.current.get(sessionId);
        if (command) {
          resolve(command);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Terminal is not ready — the session may still be loading or its shell failed to start. Try clicking the session tab or reconnecting."));
          return;
        }
        window.setTimeout(poll, 50);
      };
      poll();
    });
  }, []);

  const sendCommandToSession = useCallback(async (
    sessionId: string,
    command: string,
    options?: {
      timeoutMs?: number;
      activateIfNeeded?: boolean;
    }
  ): Promise<void> => {
    const existingSendCommand = commandBySessionIdRef.current.get(sessionId);
    if (existingSendCommand) {
      existingSendCommand(command);
      return;
    }

    const activateIfNeeded = options?.activateIfNeeded ?? true;
    const timeoutMs = options?.timeoutMs ?? (activateIfNeeded ? 15_000 : 2_000);
    const previousActiveSessionId = activeSessionIdRef.current;
    const shouldActivate = activateIfNeeded && previousActiveSessionId !== sessionId;

    if (shouldActivate) {
      setActiveSessionId(sessionId);
    }

    try {
      const sendCommand = await waitForSessionCommand(sessionId, timeoutMs);
      sendCommand(command);
    } finally {
      if (shouldActivate && activeSessionIdRef.current === sessionId) {
        setActiveSessionId(previousActiveSessionId);
      }
    }
  }, [waitForSessionCommand]);

  const handleSendPromptToSession = useCallback(async (sessionId: string, prompt: string): Promise<void> => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      return;
    }
    await sendCommandToSession(sessionId, normalizedPrompt, {
      activateIfNeeded: false,
    });
  }, [sendCommandToSession]);

  const handleReconnectSession = useCallback((sessionId: string) => {
    setReconnectBySessionId(prev => {
      const next = new Map(prev);
      const current = next.get(sessionId) ?? 0;
      next.set(sessionId, current + 1);
      return next;
    });
  }, []);

  const handleSessionStatusChange = useCallback((sessionId: string, status: TerminalSession["status"]) => {
    const previousStatus = statusBySessionRef.current.get(sessionId) ?? "idle";
    statusBySessionRef.current.set(sessionId, status);

    if (status === "busy") {
      notificationCallbacksRef.current.onSessionBecameBusy(sessionId);
    } else if (status === "active") {
      notificationCallbacksRef.current.onSessionBecameActive(sessionId);
    } else if (status === "idle" && previousStatus !== "idle") {
      notificationCallbacksRef.current.onSessionBecameIdle(sessionId);
    }

    setSessions(prev => {
      const newSessions = new Map(prev);
      const session = newSessions.get(sessionId);
      if (session) {
        if (session.status === status) {
          return prev;
        }
        newSessions.set(sessionId, { ...session, status, lastActivity: new Date() });
      }
      return newSessions;
    });
  }, [notificationCallbacksRef]);

  const closeSessionsForProject = useCallback((projectId: number) => {
    const sessionsToClose = Array.from(sessionsRef.current.entries())
      .filter(([, session]) => session.projectId === projectId)
      .map(([sessionId]) => sessionId);
    sessionsToClose.forEach(handleCloseSession);
  }, [handleCloseSession]);

  const closeSessionsForDivergence = useCallback((divergenceId: number) => {
    const sessionsToClose = Array.from(sessionsRef.current.entries())
      .filter(([, session]) => session.type === "divergence" && session.targetId === divergenceId)
      .map(([sessionId]) => sessionId);
    sessionsToClose.forEach(handleCloseSession);
  }, [handleCloseSession]);

  const closeSessionsForWorkspaceDivergence = useCallback((wdId: number) => {
    const sessionsToClose = Array.from(sessionsRef.current.entries())
      .filter(([, s]) => s.type === "workspace_divergence" && s.targetId === wdId)
      .map(([sessionId]) => sessionId);
    sessionsToClose.forEach(handleCloseSession);
  }, [handleCloseSession]);

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    sessionsRef,
    activeSessionIdRef,
    statusBySessionRef,
    commandBySessionIdRef,
    reconnectBySessionId,
    createSession,
    createManualSession,
    handleSelectProject,
    handleSelectDivergence,
    handleCreateAdditionalSession,
    handleCloseSession,
    handleCloseSessionAndKillTmux,
    handleRegisterTerminalCommand,
    handleUnregisterTerminalCommand,
    sendCommandToSession,
    handleSendPromptToSession,
    handleReconnectSession,
    handleSessionStatusChange,
    closeSessionsForProject,
    closeSessionsForDivergence,
    closeSessionsForWorkspaceDivergence,
  };
}
