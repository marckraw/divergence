import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import Sidebar from "../widgets/sidebar";
import MainArea, { type TerminalContextSelectionRequest } from "../widgets/main-area";
import AgentSessionView from "../widgets/agent-session-view";
import { InboxPanel } from "../features/inbox";
import { AutomationsPanel } from "../features/automations";
import { useAgentRuntime } from "../features/agent-runtime";
import QuickSwitcher from "../features/quick-switcher";
import { onMobileHandshake } from "./api/mobileHandshake.api";
import Settings from "../widgets/settings-modal";
import type { SettingsCategoryId } from "../widgets/settings-modal";
import { MergeNotification, useMergeDetection, type MergeNotificationData } from "../features/merge-detection";
import {
  CreateWorkspaceModal,
  CreateWorkspaceDivergenceModal,
} from "../features/workspace-management";
import { WorkspaceSettings } from "../features/workspace-settings";
import { TaskCenterPage, TaskToasts, useTaskCenter } from "../features/task-center";
import { hydrateTasksFromAutomationRuns } from "../entities/task";
import { useAllDivergences } from "../entities/divergence";
import { useProjectSettingsMap, useProjects } from "../entities/project";
import { useWorkspaces } from "../entities/workspace";
import { usePortAllocations, type PortAllocation } from "../entities/port-management";
import { useAutomations } from "../entities/automation";
import {
  useInboxEvents,
} from "../entities/inbox-event";
import {
  AGENT_PROVIDER_ORDER,
  Button,
  DEFAULT_EDITOR_THEME_DARK,
  DEFAULT_EDITOR_THEME_LIGHT,
  getAvailableAgentProviders,
  getAgentRuntimeProviderDefaultModel,
  IconButton,
  ModalFooter,
  ModalShell,
  ProgressBar,
  TextInput,
  useAppSettings,
  useUpdater,
} from "../shared";
import type {
  AgentProvider,
  Project,
  Divergence,
  TerminalSession,
  Workspace,
  WorkspaceDivergence,
  WorkspaceSession,
} from "../entities";
import {
  getWorkspaceSessionAttentionKey,
  isAgentSession,
  suggestAgentSessionTitle,
} from "../entities";
import { useSplitPaneManagement } from "./model/useSplitPaneManagement";
import { useGithubInboxPolling } from "./model/useGithubInboxPolling";
import { useSidebarLayout } from "./model/useSidebarLayout";
import { useIdleNotification } from "./model/useIdleNotification";
import { useGlobalErrorTracking } from "./model/useGlobalErrorTracking";
import { useSessionPersistence } from "./model/useSessionPersistence";
import { useSessionManagement, type SessionNotificationCallbacks } from "./model/useSessionManagement";
import { useAutomationOrchestration } from "./model/useAutomationOrchestration";
import { useEntityOperations } from "./model/useEntityOperations";
import { useAppKeyboardShortcuts } from "./model/useAppKeyboardShortcuts";
import { useReviewAgentSession } from "./model/useReviewAgentSession";
import { useTaskCenterAttachment } from "./model/useTaskCenterAttachment";
import { DebugConsolePanel } from "../features/debug-console";
import { PortDashboard } from "../features/port-dashboard";
import {
  GithubPrHub,
  openPrConflictResolutionDivergence,
  openPrReviewDivergence,
  type GithubPullRequestDetail,
  type GithubPullRequestSummary,
} from "../features/github-pr-hub";
import { buildWorkspaceKey } from "./lib/sessionBuilder.pure";

interface PendingTerminalContextInjection {
  targetSessionId: string;
  context: {
    id: string;
    sourceSessionId: string;
    sourceSessionName: string;
    lineStart?: number | null;
    lineEnd?: number | null;
    text: string;
    createdAtMs: number;
  };
}

interface TerminalContextPickerState {
  selection: TerminalContextSelectionRequest;
  candidateSessionIds: string[];
}

function buildPendingTerminalContext(
  selection: TerminalContextSelectionRequest,
): PendingTerminalContextInjection["context"] {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `terminal-context-${selection.sourceSessionId}-${selection.createdAtMs}`,
    sourceSessionId: selection.sourceSessionId,
    sourceSessionName: selection.sourceSessionName,
    lineStart: selection.lineStart ?? null,
    lineEnd: selection.lineEnd ?? null,
    text: selection.text,
    createdAtMs: selection.createdAtMs,
  };
}

function App() {
  const updater = useUpdater(true);
  const { projects, addProject, removeProject, loading: projectsLoading } = useProjects();
  const {
    divergencesByProject,
    refresh: refreshDivergences,
    loading: divergencesLoading,
  } = useAllDivergences();
  const { settingsByProjectId, updateProjectSettings } = useProjectSettingsMap(projects);
  const { settings: appSettings } = useAppSettings();
  const {
    workspaces: workspaceList,
    membersByWorkspaceId,
    workspaceDivergencesByWorkspaceId,
    refresh: refreshWorkspaces,
  } = useWorkspaces();
  const { allocations: portAllocations, refresh: refreshPortAllocations } = usePortAllocations();
  const {
    splitBySessionId,
    setSplitBySessionId,
    handleSplitSession,
    handleFocusSplitPane,
    handleResizeSplitPanes,
    handleResetSplitSession,
  } = useSplitPaneManagement();
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showFileQuickSwitcher, setShowFileQuickSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [renameAgentSessionState, setRenameAgentSessionState] = useState<{
    sessionId: string;
    value: string;
  } | null>(null);
  const [settingsInitialCategory, setSettingsInitialCategory] = useState<SettingsCategoryId>("general");
  const [createDivergenceFor, setCreateDivergenceFor] = useState<Project | null>(null);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createWorkspaceDivergenceFor, setCreateWorkspaceDivergenceFor] = useState<import("../entities").Workspace | null>(null);
  const [mergeNotification, setMergeNotification] = useState<MergeNotificationData | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    isRightPanelOpen,
    sidebarWidth,
    isDraggingSidebar,
    sidebarMode,
    setSidebarMode,
    workTab,
    setWorkTab,
    toggleSidebar,
    toggleRightPanel,
    handleSidebarDragStart,
    handleSidebarDragDoubleClick,
    handleSidebarModeChange,
    handleWorkTabChange,
  } = useSidebarLayout({
    onModeChange: () => {
      setShowQuickSwitcher(false);
      setShowSettings(false);
    },
  });
  const {
    automations,
    runs: automationRuns,
    latestRunByAutomationId,
    loading: automationsLoading,
    error: automationsError,
    refresh: refreshAutomations,
    createAutomation,
    updateAutomation: saveAutomation,
    removeAutomation,
  } = useAutomations();

  // Port allocation lookup by entity key
  const portAllocationByEntityKey = useMemo(() => {
    const map = new Map<string, PortAllocation>();
    for (const alloc of portAllocations) {
      map.set(`${alloc.entityType}:${alloc.entityId}`, alloc);
    }
    return map;
  }, [portAllocations]);

  // Build projects by ID maps
  const projectsById = useMemo(() => {
    const map = new Map<number, { name: string }>();
    projects.forEach(p => map.set(p.id, { name: p.name }));
    return map;
  }, [projects]);

  const projectById = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((project) => map.set(project.id, project));
    return map;
  }, [projects]);

  // ── Session Management ──
  // Use a ref to break the circular dependency between useSessionManagement
  // and useIdleNotification (each needs outputs from the other).
  const notificationCallbacksRef = useRef<SessionNotificationCallbacks>({
    clearNotificationTracking: () => {},
    onSessionBecameBusy: () => {},
    onSessionBecameActive: () => {},
    onSessionBecameIdle: () => {},
  });

  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    sessionsRef,
    statusBySessionRef,
    reconnectBySessionId,
    handleSelectProject: handleSelectProjectRaw,
    handleSelectDivergence: handleSelectDivergenceRaw,
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
  } = useSessionManagement({
    settingsByProjectId,
    projectsById,
    appSettings,
    portAllocationByEntityKey,
    splitBySessionId,
    setSplitBySessionId,
    notificationCallbacksRef,
  });

  const {
    idleAttentionSessionIds,
    setIdleAttentionSessionIds,
    clearNotificationTracking,
    onSessionBecameIdle,
    onSessionBecameBusy,
    onSessionBecameActive,
  } = useIdleNotification({
    activeSessionId,
    projectsById,
    sessionsRef,
    statusBySessionRef,
  });

  // Wire idle notification callbacks into session management via the ref
  notificationCallbacksRef.current = {
    clearNotificationTracking,
    onSessionBecameBusy,
    onSessionBecameActive,
    onSessionBecameIdle,
  };

  // Clean up idle attention tracking for removed sessions
  useEffect(() => {
    setIdleAttentionSessionIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const sessionId of prev) {
        if (sessions.has(sessionId)) {
          next.add(sessionId);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sessions, setIdleAttentionSessionIds]);

  // ── Session Persistence ──
  const { restoredTabsToastMessage, setRestoredTabsToastMessage } = useSessionPersistence({
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    restoreTabsOnRestart: appSettings.restoreTabsOnRestart,
  });

  const {
    capabilities: agentRuntimeCapabilities,
    agentSessions,
    openAgentSessions,
    getSession: getAgentSession,
    createSession: createAgentSession,
    startTurn: startAgentTurn,
    stageAttachment: stageAgentAttachment,
    discardAttachment: discardAgentAttachment,
    respondToRequest: respondToAgentRequest,
    updateSession: updateAgentSession,
    openSession: openAgentSession,
    closeSession: closeAgentSession,
    stopSession: stopAgentSession,
    deleteSession: deleteAgentSession,
  } = useAgentRuntime({
    claudeOAuthToken: appSettings.claudeOAuthToken ?? "",
  });

  const closeSessionsForProjectAndAgents = (projectId: number) => {
    closeSessionsForProject(projectId);
    agentSessions.forEach((session) => {
      if (session.projectId === projectId) {
        void deleteAgentSession(session.id).catch((error) => {
          console.warn("Failed to delete project agent session:", error);
        });
      }
    });
  };

  const closeSessionsForDivergenceAndAgents = (divergenceId: number) => {
    closeSessionsForDivergence(divergenceId);
    agentSessions.forEach((session) => {
      if (session.targetType === "divergence" && session.targetId === divergenceId) {
        void deleteAgentSession(session.id).catch((error) => {
          console.warn("Failed to delete divergence agent session:", error);
        });
      }
    });
  };

  const closeSessionsForWorkspaceDivergenceAndAgents = (workspaceDivergenceId: number) => {
    closeSessionsForWorkspaceDivergence(workspaceDivergenceId);
    agentSessions.forEach((session) => {
      if (session.targetType === "workspace_divergence" && session.targetId === workspaceDivergenceId) {
        void deleteAgentSession(session.id).catch((error) => {
          console.warn("Failed to delete workspace divergence agent session:", error);
        });
      }
    });
  };

  // ── Global Error Tracking ──
  useGlobalErrorTracking();

  // ── Inbox ──
  const {
    events: inboxEvents,
    filter: inboxFilter,
    unreadCount: inboxUnreadCount,
    loading: inboxLoading,
    error: inboxError,
    setFilter: setInboxFilter,
    refresh: refreshInbox,
    markRead: markInboxRead,
    markAllRead: markAllInboxRead,
  } = useInboxEvents("all");

  useGithubInboxPolling({
    projects,
    appSettings,
    onRefreshInbox: refreshInbox,
  });

  // ── Hydrated Tasks + Task Center ──
  const automationLookupById = useMemo(() => {
    const map = new Map<number, { name: string; projectId: number }>();
    for (const a of automations) {
      map.set(a.id, { name: a.name, projectId: a.projectId });
    }
    return map;
  }, [automations]);

  const projectLookupById = useMemo(() => {
    const map = new Map<number, { name: string; path: string }>();
    for (const p of projects) {
      map.set(p.id, { name: p.name, path: p.path });
    }
    return map;
  }, [projects]);

  const hydratedTasks = useMemo(() => {
    return hydrateTasksFromAutomationRuns(automationRuns, automationLookupById, projectLookupById);
  }, [automationRuns, automationLookupById, projectLookupById]);

  const {
    runningTasks,
    recentTasks,
    toasts,
    runningCount,
    focusedTaskId,
    dismissToast,
    dismissTask,
    dismissAllRecentTasks,
    viewTask,
    retryTask,
    runTask,
  } = useTaskCenter(2, hydratedTasks);

  // ── Automation Orchestration ──
  const {
    queuedCloudCountByAutomationId,
    handleRunAutomationNow,
    handleCreateAutomation,
    handleUpdateAutomation,
    handleDeleteAutomation,
  } = useAutomationOrchestration({
    automations,
    automationRuns,
    projects,
    appSettings,
    runTask,
    createAgentSession,
    startAgentTurn,
    getAgentSession,
    refreshAutomations,
    refreshDivergences,
    refreshWorkspaces,
    refreshInbox,
    refreshPortAllocations,
    createAutomation,
    saveAutomation,
    removeAutomation,
    latestRunByAutomationId,
  });

  // ── Entity Operations ──
  const {
    handleAddProject,
    handleRemoveProject,
    handleCreateDivergence,
    handleDeleteDivergence,
    handleSelectWorkspace,
    handleCreateWorkspace,
    handleDeleteWorkspace,
    handleSelectWorkspaceDivergence,
    handleDeleteWorkspaceDivergence,
    handleOpenWorkspaceSettings,
    handleCreateWorkspaceDivergences,
    activeWorkspaceSettingsId,
    setActiveWorkspaceSettingsId,
  } = useEntityOperations({
    projects,
    projectsById,
    divergencesByProject,
    appSettings,
    portAllocationByEntityKey,
    runTask,
    addProject,
    removeProject,
    refreshDivergences,
    refreshWorkspaces,
    refreshPortAllocations,
    closeSessionsForProject: closeSessionsForProjectAndAgents,
    closeSessionsForDivergence: closeSessionsForDivergenceAndAgents,
    closeSessionsForWorkspaceDivergence: closeSessionsForWorkspaceDivergenceAndAgents,
    handleCloseSession,
    sessionsRef,
    setSessions,
    setActiveSessionId,
  });

  // ── Review Agent Session ──
  const { handleRunReviewAgent } = useReviewAgentSession({
    sessionsRef,
    setActiveSessionId,
    createAgentSession,
    startAgentTurn,
  });

  // ── Task Center Attachment ──
  const { handleViewTaskCenterTask, handleAttachToAutomationSession } = useTaskCenterAttachment({
    viewTask,
    setIsSidebarOpen,
    setSidebarMode,
    setWorkTab,
    projectById,
    settingsByProjectId,
    projectsById,
    appSettings,
    portAllocationByEntityKey,
    agentSessions,
    setSessions,
    setActiveSessionId,
    sendCommandToSession,
  });

  // Wrap handleSelectProject / handleSelectDivergence to also set sidebar mode
  const handleSelectProject = useCallback((project: Project) => {
    handleSelectProjectRaw(project);
    setSidebarMode("projects");
  }, [handleSelectProjectRaw, setSidebarMode]);

  const handleSelectDivergence = useCallback((divergence: Divergence) => {
    handleSelectDivergenceRaw(divergence);
    setSidebarMode("projects");
  }, [handleSelectDivergenceRaw, setSidebarMode]);

  const handleOpenGithubPrDivergence = useCallback(async (
    mode: "review" | "conflict-resolution",
    input: {
      pullRequest: GithubPullRequestSummary;
      detail: GithubPullRequestDetail;
    },
  ) => {
    const openPrDivergence = mode === "conflict-resolution"
      ? openPrConflictResolutionDivergence
      : openPrReviewDivergence;

    await openPrDivergence({
      pullRequest: input.pullRequest,
      detail: input.detail,
      githubToken: appSettings.githubToken ?? "",
      runTask,
      refreshDivergences,
      refreshPortAllocations,
      onSelectDivergence: handleSelectDivergence,
      setActiveSessionId,
      createAgentSession,
      startAgentTurn,
      agentRuntimeCapabilities,
    });
    setSidebarMode("projects");
  }, [
    agentRuntimeCapabilities,
    appSettings.githubToken,
    createAgentSession,
    handleSelectDivergence,
    refreshDivergences,
    refreshPortAllocations,
    runTask,
    setSidebarMode,
    setActiveSessionId,
    startAgentTurn,
  ]);

  const handleOpenPrReviewDivergence = useCallback(async (input: {
    pullRequest: GithubPullRequestSummary;
    detail: GithubPullRequestDetail;
  }) => {
    await handleOpenGithubPrDivergence("review", input);
  }, [handleOpenGithubPrDivergence]);

  const handleOpenPrConflictResolutionDivergence = useCallback(async (input: {
    pullRequest: GithubPullRequestSummary;
    detail: GithubPullRequestDetail;
  }) => {
    await handleOpenGithubPrDivergence("conflict-resolution", input);
  }, [handleOpenGithubPrDivergence]);

  const workspaceSessions = useMemo(() => {
    const next = new Map<string, WorkspaceSession>();
    sessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    openAgentSessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    return next;
  }, [openAgentSessions, sessions]);

  const sidebarSessions = useMemo(() => {
    const next = new Map<string, WorkspaceSession>();
    sessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    agentSessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    return next;
  }, [agentSessions, sessions]);

  const allDivergences = useMemo(() => {
    const all: Divergence[] = [];
    divergencesByProject.forEach((divergences) => all.push(...divergences));
    return all;
  }, [divergencesByProject]);

  const divergenceById = useMemo(() => {
    const map = new Map<number, Divergence>();
    allDivergences.forEach((divergence) => {
      map.set(divergence.id, divergence);
    });
    return map;
  }, [allDivergences]);

  const workspaceById = useMemo(() => {
    const map = new Map<number, Workspace>();
    workspaceList.forEach((workspace) => {
      map.set(workspace.id, workspace);
    });
    return map;
  }, [workspaceList]);

  const workspaceDivergenceById = useMemo(() => {
    const map = new Map<number, WorkspaceDivergence>();
    workspaceDivergencesByWorkspaceId.forEach((workspaceDivergences) => {
      workspaceDivergences.forEach((workspaceDivergence) => {
        map.set(workspaceDivergence.id, workspaceDivergence);
      });
    });
    return map;
  }, [workspaceDivergencesByWorkspaceId]);

  const agentProviders = useMemo(() => {
    const available = getAvailableAgentProviders(agentRuntimeCapabilities);
    return available.length > 0 ? available : AGENT_PROVIDER_ORDER;
  }, [agentRuntimeCapabilities]);

  const [pendingTerminalContextInjection, setPendingTerminalContextInjection] = useState<PendingTerminalContextInjection | null>(null);
  const [terminalContextPickerState, setTerminalContextPickerState] = useState<TerminalContextPickerState | null>(null);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    if (workspaceSessions.has(activeSessionId)) {
      return;
    }
    const nextActiveSessionId = workspaceSessions.keys().next().value ?? null;
    setActiveSessionId(nextActiveSessionId);
  }, [activeSessionId, setActiveSessionId, workspaceSessions]);

  useEffect(() => {
    if (activeSessionId || !appSettings.restoreTabsOnRestart || sessions.size > 0 || openAgentSessions.size === 0) {
      return;
    }
    const nextActiveSessionId = openAgentSessions.keys().next().value ?? null;
    if (nextActiveSessionId) {
      setActiveSessionId(nextActiveSessionId);
    }
  }, [activeSessionId, openAgentSessions, appSettings.restoreTabsOnRestart, sessions.size, setActiveSessionId]);

  const handleCreateAgentSession = useCallback(async (input: {
    provider: AgentProvider;
    type: "project" | "divergence" | "workspace" | "workspace_divergence";
    item: Project | Divergence | Workspace | WorkspaceDivergence;
  }) => {
    const path = "folderPath" in input.item ? input.item.folderPath : input.item.path;
    const projectId = input.type === "project"
      ? input.item.id
      : input.type === "divergence"
        ? (input.item as Divergence).projectId
        : 0;
    const workspaceOwnerId = input.type === "workspace"
      ? input.item.id
      : input.type === "workspace_divergence"
        ? (input.item as WorkspaceDivergence).workspaceId
        : undefined;
    const existingConversationCount = Array.from(agentSessions.values()).filter((session) => (
      session.provider === input.provider
      && session.targetType === input.type
      && session.targetId === input.item.id
      && session.sessionRole === "default"
    )).length;
    const conversationSuffix = existingConversationCount > 0 ? ` ${existingConversationCount + 1}` : "";
    const session = await createAgentSession({
      provider: input.provider,
      targetType: input.type,
      targetId: input.item.id,
      projectId,
      workspaceOwnerId,
      workspaceKey: buildWorkspaceKey(input.type, input.item.id),
      sessionRole: "default",
      nameMode: "default",
      model: getAgentRuntimeProviderDefaultModel(agentRuntimeCapabilities, input.provider) ?? undefined,
      name: `${input.item.name} • ${input.provider}${conversationSuffix}`,
      path,
    });
    setActiveSessionId(session.id);
    return session;
  }, [
    agentRuntimeCapabilities,
    agentSessions,
    createAgentSession,
    setActiveSessionId,
  ]);

  const handleCreateAgentSessionForSidebar = useCallback(
    async (input: Parameters<typeof handleCreateAgentSession>[0]) => {
      await handleCreateAgentSession(input);
    },
    [handleCreateAgentSession],
  );

  const defaultTerminalContextProvider = useMemo(
    () => (
      agentProviders.includes("codex")
        ? "codex"
        : agentProviders[0]
    ),
    [agentProviders],
  );

  const findSuitableAgentSessionsForTerminal = useCallback((sourceSession: TerminalSession) => {
    const defaultAgentSessions = Array.from(agentSessions.values()).filter(
      (session) => session.sessionRole === "default",
    );
    const exactWorkspaceMatches = defaultAgentSessions.filter(
      (session) => session.workspaceKey === sourceSession.workspaceKey,
    );
    if (exactWorkspaceMatches.length > 0) {
      return exactWorkspaceMatches;
    }

    if (sourceSession.type === "project" || sourceSession.type === "divergence") {
      return defaultAgentSessions.filter((session) => (
        session.projectId === sourceSession.projectId
        && (session.targetType === "project" || session.targetType === "divergence")
      ));
    }

    const workspaceScopeId = sourceSession.workspaceOwnerId ?? sourceSession.targetId;
    return defaultAgentSessions.filter((session) => {
      if (session.targetType !== "workspace" && session.targetType !== "workspace_divergence") {
        return false;
      }

      const sessionWorkspaceScopeId = session.workspaceOwnerId ?? session.targetId;
      return sessionWorkspaceScopeId === workspaceScopeId;
    });
  }, [agentSessions]);

  const resolveTerminalContextCreateTarget = useCallback((sourceSession: TerminalSession) => {
    switch (sourceSession.type) {
      case "project": {
        const project = projectById.get(sourceSession.targetId);
        return project
          ? { provider: defaultTerminalContextProvider, type: "project" as const, item: project }
          : null;
      }
      case "divergence": {
        const divergence = divergenceById.get(sourceSession.targetId);
        return divergence
          ? { provider: defaultTerminalContextProvider, type: "divergence" as const, item: divergence }
          : null;
      }
      case "workspace": {
        const workspace = workspaceById.get(sourceSession.targetId);
        return workspace
          ? { provider: defaultTerminalContextProvider, type: "workspace" as const, item: workspace }
          : null;
      }
      case "workspace_divergence": {
        const workspaceDivergence = workspaceDivergenceById.get(sourceSession.targetId);
        return workspaceDivergence
          ? {
            provider: defaultTerminalContextProvider,
            type: "workspace_divergence" as const,
            item: workspaceDivergence,
          }
          : null;
      }
      default:
        return null;
    }
  }, [
    defaultTerminalContextProvider,
    divergenceById,
    projectById,
    workspaceById,
    workspaceDivergenceById,
  ]);

  const routeTerminalContextToAgentSession = useCallback(async (
    sessionId: string,
    selection: TerminalContextSelectionRequest,
  ) => {
    const existingSession = agentSessions.get(sessionId);
    if (existingSession && !existingSession.isOpen) {
      try {
        await openAgentSession(sessionId);
      } catch (error) {
        console.warn("Failed to open target agent session for terminal context:", error);
        return;
      }
    }

    setPendingTerminalContextInjection({
      targetSessionId: sessionId,
      context: buildPendingTerminalContext(selection),
    });
    setActiveSessionId(sessionId);
  }, [agentSessions, openAgentSession, setActiveSessionId]);

  const handleAddTerminalContextRequest = useCallback(async (selection: TerminalContextSelectionRequest) => {
    const sourceSession = sessions.get(selection.sourceSessionId);
    if (!sourceSession) {
      return;
    }

    const candidateSessions = findSuitableAgentSessionsForTerminal(sourceSession);
    if (candidateSessions.length === 1) {
      await routeTerminalContextToAgentSession(candidateSessions[0].id, selection);
      return;
    }

    setTerminalContextPickerState({
      selection,
      candidateSessionIds: candidateSessions.map((session) => session.id),
    });
  }, [findSuitableAgentSessionsForTerminal, routeTerminalContextToAgentSession, sessions]);

  const handleSelectWorkspaceSession = async (sessionId: string) => {
    if (workspaceSessions.has(sessionId)) {
      setActiveSessionId(sessionId);
      return;
    }

    const agentSession = agentSessions.get(sessionId);
    if (!agentSession) {
      return;
    }

    if (!agentSession.isOpen) {
      try {
        await openAgentSession(sessionId);
      } catch (error) {
        console.warn("Failed to reopen agent session:", error);
        return;
      }
    }
    setActiveSessionId(sessionId);
  };

  const handleConsumePendingTerminalContext = useCallback((contextId: string) => {
    setPendingTerminalContextInjection((previous) => {
      if (!previous || previous.context.id !== contextId) {
        return previous;
      }
      return null;
    });
  }, []);

  const terminalContextCandidateSessions = useMemo(
    () => (
      terminalContextPickerState
        ? terminalContextPickerState.candidateSessionIds
          .map((sessionId) => agentSessions.get(sessionId) ?? null)
          .filter((session): session is NonNullable<typeof session> => session !== null)
        : []
    ),
    [agentSessions, terminalContextPickerState],
  );

  const canCreateTerminalContextSession = useMemo(() => {
    if (!terminalContextPickerState) {
      return false;
    }

    const sourceSession = sessions.get(terminalContextPickerState.selection.sourceSessionId);
    return sourceSession ? resolveTerminalContextCreateTarget(sourceSession) !== null : false;
  }, [resolveTerminalContextCreateTarget, sessions, terminalContextPickerState]);

  const handleSelectTerminalContextTarget = useCallback(async (targetSessionId: string) => {
    if (!terminalContextPickerState) {
      return;
    }

    setTerminalContextPickerState(null);
    await routeTerminalContextToAgentSession(
      targetSessionId,
      terminalContextPickerState.selection,
    );
  }, [routeTerminalContextToAgentSession, terminalContextPickerState]);

  const handleCreateTerminalContextSession = useCallback(async () => {
    if (!terminalContextPickerState) {
      return;
    }

    const sourceSession = sessions.get(terminalContextPickerState.selection.sourceSessionId);
    if (!sourceSession) {
      setTerminalContextPickerState(null);
      return;
    }

    const createTarget = resolveTerminalContextCreateTarget(sourceSession);
    if (!createTarget) {
      setTerminalContextPickerState(null);
      return;
    }

    setTerminalContextPickerState(null);
    const createdSession = await handleCreateAgentSession(createTarget);
    await routeTerminalContextToAgentSession(
      createdSession.id,
      terminalContextPickerState.selection,
    );
  }, [
    handleCreateAgentSession,
    resolveTerminalContextCreateTarget,
    routeTerminalContextToAgentSession,
    sessions,
    terminalContextPickerState,
  ]);

  const handleCloseWorkspaceSession = (sessionId: string) => {
    if (sessionsRef.current.has(sessionId)) {
      handleCloseSession(sessionId);
      return;
    }

    const nextActiveSessionId = Array.from(workspaceSessions.keys()).find((id) => id !== sessionId) ?? null;
    void closeAgentSession(sessionId).catch((error) => {
      console.warn("Failed to close agent session:", error);
    });
    setActiveSessionId((current) => current === sessionId ? nextActiveSessionId : current);
  };

  const handleDeleteAgentConversation = (sessionId: string) => {
    const nextActiveSessionId = Array.from(workspaceSessions.keys()).find((id) => id !== sessionId) ?? null;
    void deleteAgentSession(sessionId).catch((error) => {
      console.warn("Failed to delete agent session:", error);
    });
    setActiveSessionId((current) => current === sessionId ? nextActiveSessionId : current);
  };

  const handleRenameAgentConversation = (sessionId: string) => {
    const session = agentSessions.get(sessionId);
    if (!session) {
      return;
    }

    setRenameAgentSessionState({
      sessionId,
      value: session.name,
    });
  };

  const handleRenameAgentConversationSubmit = () => {
    if (!renameAgentSessionState) {
      return;
    }

    const session = agentSessions.get(renameAgentSessionState.sessionId);
    if (!session) {
      setRenameAgentSessionState(null);
      return;
    }

    const trimmedName = renameAgentSessionState.value.trim();
    if (!trimmedName || trimmedName === session.name) {
      setRenameAgentSessionState(null);
      return;
    }

    void updateAgentSession({
      sessionId: renameAgentSessionState.sessionId,
      name: trimmedName,
      nameMode: "manual",
    }).catch((error) => {
      console.warn("Failed to rename agent session:", error);
    }).finally(() => {
      setRenameAgentSessionState(null);
    });
  };

  useEffect(() => {
    if (!renameAgentSessionState) {
      return;
    }

    if (!agentSessions.has(renameAgentSessionState.sessionId)) {
      setRenameAgentSessionState(null);
    }
  }, [agentSessions, renameAgentSessionState]);

  useEffect(() => {
    agentSessions.forEach((session) => {
      if (session.nameMode === "manual" || session.sessionRole !== "default") {
        return;
      }

      const suggestedTitle = suggestAgentSessionTitle(session);
      if (!suggestedTitle || suggestedTitle === session.name) {
        return;
      }

      if (renamingAgentSessionIdsRef.current.has(session.id)) {
        return;
      }

      renamingAgentSessionIdsRef.current.add(session.id);
      void updateAgentSession({
        sessionId: session.id,
        name: suggestedTitle,
        nameMode: "auto",
      }).catch((error) => {
        console.warn("Failed to auto-rename agent session:", error);
      }).finally(() => {
        renamingAgentSessionIdsRef.current.delete(session.id);
      });
    });
  }, [agentSessions, updateAgentSession]);

  // ── Keyboard Shortcuts ──
  useAppKeyboardShortcuts({
    sessions: workspaceSessions,
    activeSessionId,
    splitBySessionId,
    setSplitBySessionId,
    projects,
    createDivergenceFor,
    handleCloseSession: handleCloseWorkspaceSession,
    handleSplitSession,
    handleReconnectSession,
    toggleSidebar,
    toggleRightPanel,
    setIsSidebarOpen,
    setSidebarMode,
    setWorkTab,
    setActiveSessionId,
    setShowQuickSwitcher,
    setShowFileQuickSwitcher,
    setShowSettings,
    setCreateDivergenceFor,
  });

  // Listen for mobile handshake events — auto-open Settings to Remote Access tab
  useEffect(() => {
    const unlisten = onMobileHandshake(() => {
      setSettingsInitialCategory("remote-access");
      setShowSettings(true);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Reset banner dismiss when a new update or error arrives
  useEffect(() => {
    if (updater.status === "available" || updater.status === "error") {
      setBannerDismissed(false);
    }
  }, [updater.status]);

  // Merge detection
  useMergeDetection(allDivergences, projectsById, (notification) => {
    setMergeNotification(notification);
  });

  useEffect(() => {
    const theme = appSettings.theme ?? "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [appSettings.theme]);

  const editorTheme =
    appSettings.theme === "light"
      ? DEFAULT_EDITOR_THEME_LIGHT
      : DEFAULT_EDITOR_THEME_DARK;
  const activeWorkspaceSession = activeSessionId ? workspaceSessions.get(activeSessionId) ?? null : null;
  const activeSession = activeWorkspaceSession && !isAgentSession(activeWorkspaceSession)
    ? activeWorkspaceSession
    : null;
  const activeAgentSession = activeWorkspaceSession && isAgentSession(activeWorkspaceSession)
    ? activeWorkspaceSession
    : null;
  const workspaceSessionList = useMemo(
    () => Array.from(workspaceSessions.values()),
    [workspaceSessions],
  );
  const [lastViewedRuntimeEventAtMsBySessionId, setLastViewedRuntimeEventAtMsBySessionId] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [dismissedAttentionKeyBySessionId, setDismissedAttentionKeyBySessionId] = useState<Map<string, string>>(
    () => new Map(),
  );
  const renamingAgentSessionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLastViewedRuntimeEventAtMsBySessionId((previous) => {
      let changed = false;
      const next = new Map<string, number>();
      previous.forEach((timestamp, sessionId) => {
        if (workspaceSessions.has(sessionId)) {
          next.set(sessionId, timestamp);
          return;
        }
        changed = true;
      });
      return changed ? next : previous;
    });
  }, [workspaceSessions]);

  useEffect(() => {
    setDismissedAttentionKeyBySessionId((previous) => {
      let changed = false;
      const next = new Map<string, string>();
      previous.forEach((key, sessionId) => {
        if (sidebarSessions.has(sessionId)) {
          next.set(sessionId, key);
          return;
        }
        changed = true;
      });
      return changed ? next : previous;
    });
  }, [sidebarSessions]);

  const handleDismissSessionAttention = (sessionId: string) => {
    const session = sidebarSessions.get(sessionId);
    if (!session) {
      return;
    }

    const attentionOptions = {
      hasIdleAttention: idleAttentionSessionIds.has(sessionId),
      lastViewedRuntimeEventAtMs: lastViewedRuntimeEventAtMsBySessionId.get(sessionId) ?? null,
    };
    const attentionKey = getWorkspaceSessionAttentionKey(session, attentionOptions);
    if (!attentionKey) {
      return;
    }

    if (isAgentSession(session)) {
      const lastRuntimeEventAtMs = session.lastRuntimeEventAtMs ?? session.updatedAtMs;
      if (lastRuntimeEventAtMs) {
        setLastViewedRuntimeEventAtMsBySessionId((previous) => {
          if (previous.get(sessionId) === lastRuntimeEventAtMs) {
            return previous;
          }
          const next = new Map(previous);
          next.set(sessionId, lastRuntimeEventAtMs);
          return next;
        });
      }
    }

    setDismissedAttentionKeyBySessionId((previous) => {
      if (previous.get(sessionId) === attentionKey) {
        return previous;
      }
      const next = new Map(previous);
      next.set(sessionId, attentionKey);
      return next;
    });

    if (!isAgentSession(session)) {
      setIdleAttentionSessionIds((previous) => {
        if (!previous.has(sessionId)) {
          return previous;
        }
        const next = new Set(previous);
        next.delete(sessionId);
        return next;
      });
    }
  };

  return (
    <div className="flex h-full w-full">
      <div
        className={`h-full shrink-0 overflow-hidden${
          isDraggingSidebar ? "" : " transition-[width] duration-200 ease-out"
        }`}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
      >
        <Sidebar
          mode={sidebarMode}
          workTab={workTab}
          onModeChange={handleSidebarModeChange}
          onWorkTabChange={handleWorkTabChange}
          inboxUnreadCount={inboxUnreadCount}
          taskRunningCount={runningCount}
          projects={projects}
          divergencesByProject={divergencesByProject}
          sessions={sidebarSessions}
          activeSessionId={activeSessionId}
          idleAttentionSessionIds={idleAttentionSessionIds}
          lastViewedRuntimeEventAtMsBySessionId={lastViewedRuntimeEventAtMsBySessionId}
          dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
          createDivergenceFor={createDivergenceFor}
          onCreateDivergenceForChange={setCreateDivergenceFor}
          onSelectProject={handleSelectProject}
          onSelectDivergence={handleSelectDivergence}
          onSelectSession={(sessionId) => {
            void handleSelectWorkspaceSession(sessionId);
          }}
          onDismissSessionAttention={handleDismissSessionAttention}
          onCloseSession={handleCloseWorkspaceSession}
          onDeleteAgentSession={handleDeleteAgentConversation}
          onRenameAgentSession={handleRenameAgentConversation}
          onCloseSessionAndKillTmux={handleCloseSessionAndKillTmux}
          onAddProject={handleAddProject}
          onRemoveProject={handleRemoveProject}
          onCreateDivergence={handleCreateDivergence}
          onCreateAdditionalSession={handleCreateAdditionalSession}
          onCreateAgentSession={handleCreateAgentSessionForSidebar}
          onDeleteDivergence={handleDeleteDivergence}
          agentProviders={agentProviders}
          isCollapsed={!isSidebarOpen}
          workspaces={workspaceList}
          membersByWorkspaceId={membersByWorkspaceId}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
          onDeleteWorkspace={handleDeleteWorkspace}
          onOpenWorkspaceSettings={handleOpenWorkspaceSettings}
          onCreateWorkspaceDivergence={setCreateWorkspaceDivergenceFor}
          workspaceDivergencesByWorkspaceId={workspaceDivergencesByWorkspaceId}
          onSelectWorkspaceDivergence={handleSelectWorkspaceDivergence}
          onDeleteWorkspaceDivergence={handleDeleteWorkspaceDivergence}
        />
      </div>
      {isSidebarOpen && (
        <div
          className="h-full w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
          onMouseDown={handleSidebarDragStart}
          onDoubleClick={handleSidebarDragDoubleClick}
        />
      )}
      {activeWorkspaceSettingsId !== null ? (
        <WorkspaceSettings
          workspaceId={activeWorkspaceSettingsId}
          projects={projects}
          onClose={() => setActiveWorkspaceSettingsId(null)}
          onWorkspaceDeleted={() => setActiveWorkspaceSettingsId(null)}
          onDeleteWorkspace={handleDeleteWorkspace}
          refreshWorkspaces={refreshWorkspaces}
        />
      ) : sidebarMode === "work" ? (
        <div className="flex-1 min-w-0 h-full">
          {workTab === "inbox" && (
            <InboxPanel
              events={inboxEvents}
              filter={inboxFilter}
              loading={inboxLoading}
              error={inboxError}
              onFilterChange={setInboxFilter}
              onRefresh={refreshInbox}
              onMarkRead={markInboxRead}
              onMarkAllRead={markAllInboxRead}
            />
          )}
          {workTab === "pull_requests" && (
            <GithubPrHub
              projects={projects}
              githubToken={appSettings.githubToken ?? ""}
              agentSessions={agentSessions}
              createAgentSession={createAgentSession}
              startAgentTurn={startAgentTurn}
              deleteAgentSession={deleteAgentSession}
              onOpenReviewDivergence={handleOpenPrReviewDivergence}
              onOpenConflictResolutionDivergence={handleOpenPrConflictResolutionDivergence}
            />
          )}
          {workTab === "task_center" && (
            <TaskCenterPage
              runningTasks={runningTasks}
              recentTasks={recentTasks}
              focusedTaskId={focusedTaskId}
              onRetryTask={retryTask}
              onViewTask={handleViewTaskCenterTask}
              onDismissTask={dismissTask}
              onDismissAllRecentTasks={dismissAllRecentTasks}
              onAttachToAutomationSession={handleAttachToAutomationSession}
            />
          )}
          {workTab === "automations" && (
            <AutomationsPanel
              projects={projects}
              automations={automations}
              latestRunByAutomationId={latestRunByAutomationId}
              queuedCloudCountByAutomationId={queuedCloudCountByAutomationId}
              loading={automationsLoading}
              error={automationsError}
              onRefresh={refreshAutomations}
              onCreateAutomation={handleCreateAutomation}
              onUpdateAutomation={handleUpdateAutomation}
              onDeleteAutomation={handleDeleteAutomation}
              onRunAutomationNow={handleRunAutomationNow}
            />
          )}
          {workTab === "ports" && (
            <PortDashboard
              projects={projects}
              divergencesByProject={divergencesByProject}
              workspaceDivergences={Array.from(workspaceDivergencesByWorkspaceId.values()).flat()}
            />
          )}
          {workTab === "debug" && <DebugConsolePanel />}
        </div>
      ) : activeAgentSession ? (
        <AgentSessionView
          sessionId={activeAgentSession.id}
          sessionList={workspaceSessionList}
          activeSessionId={activeSessionId}
          idleAttentionSessionIds={idleAttentionSessionIds}
          lastViewedRuntimeEventAtMsBySessionId={lastViewedRuntimeEventAtMsBySessionId}
          dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
          capabilities={agentRuntimeCapabilities}
          projects={projects}
          workspaceMembersByWorkspaceId={membersByWorkspaceId}
          pendingTerminalContext={pendingTerminalContextInjection?.targetSessionId === activeAgentSession.id
            ? pendingTerminalContextInjection.context
            : null}
          onConsumePendingTerminalContext={handleConsumePendingTerminalContext}
          onSelectSession={(sessionId) => {
            void handleSelectWorkspaceSession(sessionId);
          }}
          onDismissSessionAttention={handleDismissSessionAttention}
          onCloseSession={handleCloseWorkspaceSession}
          onUpdateSessionSettings={(sessionId, input) => updateAgentSession({ sessionId, ...input })}
          onSendPrompt={startAgentTurn}
          onStageAttachment={stageAgentAttachment}
          onDiscardAttachment={discardAgentAttachment}
          onRespondToRequest={respondToAgentRequest}
          onStopSession={stopAgentSession}
        />
      ) : (
        <MainArea
          projects={projects}
          sessions={workspaceSessions}
          idleAttentionSessionIds={idleAttentionSessionIds}
          lastViewedRuntimeEventAtMsBySessionId={lastViewedRuntimeEventAtMsBySessionId}
          dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
          activeSession={activeSession}
          onDismissSessionAttention={handleDismissSessionAttention}
          onCloseSession={handleCloseWorkspaceSession}
          onCloseSessionAndKillTmux={handleCloseSessionAndKillTmux}
          onSelectSession={(sessionId) => {
            void handleSelectWorkspaceSession(sessionId);
          }}
          onStatusChange={handleSessionStatusChange}
          onRegisterTerminalCommand={handleRegisterTerminalCommand}
          onUnregisterTerminalCommand={handleUnregisterTerminalCommand}
          onRunReviewAgentRequest={handleRunReviewAgent}
          onProjectSettingsSaved={updateProjectSettings}
          splitBySessionId={splitBySessionId}
          onSplitSession={handleSplitSession}
          onFocusSplitPane={handleFocusSplitPane}
          onResizeSplitPanes={handleResizeSplitPanes}
          onResetSplitSession={handleResetSplitSession}
          reconnectBySessionId={reconnectBySessionId}
          onReconnectSession={handleReconnectSession}
          globalTmuxHistoryLimit={appSettings.tmuxHistoryLimit}
          editorTheme={editorTheme}
          divergencesByProject={divergencesByProject}
          projectsLoading={projectsLoading}
          divergencesLoading={divergencesLoading}
          showFileQuickSwitcher={showFileQuickSwitcher}
          onCloseFileQuickSwitcher={() => setShowFileQuickSwitcher(false)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={toggleRightPanel}
          onSendPromptToSession={handleSendPromptToSession}
          onAddTerminalContextRequest={(selection) => {
            void handleAddTerminalContextRequest(selection);
          }}
          workspaceMembersByWorkspaceId={membersByWorkspaceId}
        />
      )}

      {/* Quick Switcher */}
      <AnimatePresence>
        {showQuickSwitcher && (
          <QuickSwitcher
            projects={projects}
            divergencesByProject={divergencesByProject}
            sessions={workspaceSessions}
            workspaces={workspaceList}
            workspaceDivergences={Array.from(workspaceDivergencesByWorkspaceId.values()).flat()}
            onSelect={(type, item) => {
              if (type === "project") {
                handleSelectProject(item as Project);
              } else if (type === "divergence") {
                handleSelectDivergence(item as Divergence);
              } else if (type === "workspace") {
                handleSelectWorkspace(item as Workspace);
              } else if (type === "workspace_divergence") {
                handleSelectWorkspaceDivergence(item as WorkspaceDivergence);
              } else {
                setSidebarMode("projects");
                void handleSelectWorkspaceSession((item as WorkspaceSession).id);
              }
              setShowQuickSwitcher(false);
            }}
            onClose={() => setShowQuickSwitcher(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <Settings
            onClose={() => {
              setShowSettings(false);
              setSettingsInitialCategory("general");
            }}
            updater={updater}
            initialCategory={settingsInitialCategory}
          />
        )}
      </AnimatePresence>

      {/* Merge Notification */}
      <AnimatePresence>
        {mergeNotification && (
          <MergeNotification
            divergence={mergeNotification.divergence}
            projectName={mergeNotification.projectName}
            onClose={() => setMergeNotification(null)}
            onDeleteDivergence={handleDeleteDivergence}
          />
        )}
      </AnimatePresence>

      {/* Create Workspace Modal */}
      <AnimatePresence>
        {createWorkspaceOpen && (
          <CreateWorkspaceModal
            projects={projects}
            onClose={() => setCreateWorkspaceOpen(false)}
            onCreate={handleCreateWorkspace}
          />
        )}
      </AnimatePresence>

      {/* Create Workspace Divergence Modal */}
      <AnimatePresence>
        {createWorkspaceDivergenceFor && (() => {
          const wsMembers = membersByWorkspaceId.get(createWorkspaceDivergenceFor.id) ?? [];
          const memberProjectIds = new Set(wsMembers.map((m) => m.projectId));
          const memberProjects = projects.filter((p) => memberProjectIds.has(p.id));
          return (
            <CreateWorkspaceDivergenceModal
              workspace={createWorkspaceDivergenceFor}
              memberProjects={memberProjects}
              onClose={() => setCreateWorkspaceDivergenceFor(null)}
              onCreateDivergences={handleCreateWorkspaceDivergences}
            />
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {terminalContextPickerState && (
          <ModalShell
            onRequestClose={() => setTerminalContextPickerState(null)}
            size="md"
            surface="main"
            panelClassName="w-full max-w-lg mx-4"
          >
            <div className="p-4 border-b border-surface">
              <h2 className="text-lg font-semibold text-text">Send Terminal Context</h2>
              <p className="mt-1 text-xs text-subtext">
                Choose an agent session for the selected terminal output.
              </p>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-xl border border-surface bg-sidebar/40 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">Selection</p>
                <p className="mt-1 text-sm text-text">{terminalContextPickerState.selection.sourceSessionName}</p>
                <p className="mt-2 text-xs leading-5 text-subtext whitespace-pre-wrap break-words">
                  {terminalContextPickerState.selection.text}
                </p>
              </div>

              {terminalContextCandidateSessions.length > 0 ? (
                <div className="space-y-2">
                  {terminalContextCandidateSessions.map((session) => (
                    <Button
                      key={session.id}
                      type="button"
                      variant="ghost"
                      size="md"
                      className="h-auto w-full rounded-xl border border-surface bg-sidebar/40 px-3 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/10"
                      onClick={() => {
                        void handleSelectTerminalContextTarget(session.id);
                      }}
                    >
                      <p className="text-sm font-medium text-text">{session.name}</p>
                      <p className="mt-1 text-xs text-subtext">
                        {session.provider} • {session.targetType.replace(/_/g, " ")} • {session.isOpen ? "Open" : "Closed"}
                      </p>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-surface bg-sidebar/25 px-3 py-4">
                  <p className="text-sm text-text">No matching agent sessions are open for this workspace yet.</p>
                  <p className="mt-1 text-xs text-subtext">
                    Create a new {defaultTerminalContextProvider} session and seed its composer with this terminal context.
                  </p>
                </div>
              )}
            </div>

            <ModalFooter className="p-4">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setTerminalContextPickerState(null)}
              >
                Cancel
              </Button>
              {canCreateTerminalContextSession && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    void handleCreateTerminalContextSession();
                  }}
                >
                  Create {defaultTerminalContextProvider}
                </Button>
              )}
            </ModalFooter>
          </ModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renameAgentSessionState && (
          <ModalShell
            onRequestClose={() => setRenameAgentSessionState(null)}
            size="md"
            surface="main"
            panelClassName="w-full max-w-md mx-4"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleRenameAgentConversationSubmit();
              }}
            >
              <div className="p-4 border-b border-surface">
                <h2 className="text-lg font-semibold text-text">Rename Conversation</h2>
                <p className="text-xs text-subtext mt-1">
                  Give this conversation a custom name. Manual names stay fixed and will not be auto-renamed.
                </p>
              </div>

              <div className="p-4">
                <TextInput
                  value={renameAgentSessionState.value}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRenameAgentSessionState((current) => {
                      if (!current) {
                        return current;
                      }
                      return {
                        ...current,
                        value,
                      };
                    });
                  }}
                  placeholder="Conversation name"
                  tone="surface"
                  autoFocus
                />
              </div>

              <ModalFooter className="p-4">
                <Button
                  type="button"
                  onClick={() => setRenameAgentSessionState(null)}
                  variant="ghost"
                  size="md"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={renameAgentSessionState.value.trim().length === 0}
                  variant="primary"
                  size="md"
                >
                  Save
                </Button>
              </ModalFooter>
            </form>
          </ModalShell>
        )}
      </AnimatePresence>

      <TaskToasts
        toasts={toasts}
        onDismiss={dismissToast}
        onViewTask={handleViewTaskCenterTask}
      />

      {restoredTabsToastMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div className="rounded-md border border-surface bg-sidebar px-3 py-2 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-text">{restoredTabsToastMessage}</p>
              <IconButton
                onClick={() => setRestoredTabsToastMessage(null)}
                variant="subtle"
                size="xs"
                className="text-subtext hover:text-text"
                label="Dismiss restored tabs notification"
                icon={(
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {!bannerDismissed && (updater.status === "available" || updater.status === "downloading" || updater.status === "error") && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
          updater.status === "error" ? "bg-red-600" : "bg-blue-600"
        }`}>
          <div className="flex items-center gap-3">
            {updater.status === "available" && (
              <>
                <span>Update {updater.version} available</span>
                <Button
                  onClick={updater.downloadAndInstall}
                  variant="secondary"
                  size="xs"
                  className="rounded bg-white px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Install & Restart
                </Button>
              </>
            )}
            {updater.status === "downloading" && (
              <>
                <span>Downloading update... {updater.progress}%</span>
                <ProgressBar value={updater.progress} className="w-24 bg-blue-400" barClassName="bg-white" />
              </>
            )}
            {updater.status === "error" && (
              <span>{updater.error ?? "Update check failed"}</span>
            )}
            <IconButton
              onClick={() => setBannerDismissed(true)}
              variant="ghost"
              size="xs"
              className="ml-1 rounded p-0.5 hover:bg-white/20"
              label="Dismiss"
              icon={(
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
