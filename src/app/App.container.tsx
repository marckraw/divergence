import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import Sidebar from "../widgets/sidebar";
import { InboxPanel } from "../features/inbox";
import { AutomationsPanel } from "../features/automations";
import { useAgentRuntime } from "../features/agent-runtime";
import { CommandCenter, type CommandCenterMode } from "../features/command-center";
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
import { useStageLayout } from "./model/useStageLayout";
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
import StageView from "./ui/stage-view/StageView.container";

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
    handleFocusSplitPane,
    handleResizeSplitPanes,
  } = useSplitPaneManagement();
  const [commandCenterMode, setCommandCenterMode] = useState<CommandCenterMode | null>(null);
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
      setCommandCenterMode(null);
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

  const {
    layout: stageLayout,
    focusedPane: focusedStagePane,
    handleFocusPane: handleFocusStagePane,
    handleSplitPane: handleSplitStagePane,
    handleResizeAdjacentPanes: handleResizeStageAdjacentPanes,
    handleClosePane: handleCloseStagePane,
    handleResetToSinglePane: handleResetStageToSinglePane,
    focusNextPane: focusNextStagePane,
    focusPreviousPane: focusPreviousStagePane,
  } = useStageLayout({
    workspaceSessions,
    activeSessionId,
    setActiveSessionId,
    restoreTabsOnRestart: appSettings.restoreTabsOnRestart,
  });

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

  const handleCreateAgentSession = async (input: {
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
  };

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
    stageLayout,
    focusedStagePane,
    projects,
    createDivergenceFor,
    handleCloseSession: handleCloseWorkspaceSession,
    handleSplitStage: handleSplitStagePane,
    handleCloseStagePane,
    handleReconnectSession,
    focusPreviousStagePane,
    focusNextStagePane,
    toggleSidebar,
    toggleRightPanel,
    setIsSidebarOpen,
    setSidebarMode,
    setWorkTab,
    setActiveSessionId,
    setCommandCenterMode,
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

  // Flatten divergences for merge detection
  const allDivergences = useMemo(() => {
    const all: Divergence[] = [];
    divergencesByProject.forEach(divs => all.push(...divs));
    return all;
  }, [divergencesByProject]);

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
  const agentProviders = useMemo(() => {
    const available = getAvailableAgentProviders(agentRuntimeCapabilities);
    return available.length > 0 ? available : AGENT_PROVIDER_ORDER;
  }, [agentRuntimeCapabilities]);
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
          onCreateAgentSession={handleCreateAgentSession}
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
      ) : (
        <StageView
          layout={stageLayout}
          workspaceSessions={workspaceSessions}
          sessionList={workspaceSessionList}
          activeSessionId={activeSessionId}
          idleAttentionSessionIds={idleAttentionSessionIds}
          lastViewedRuntimeEventAtMsBySessionId={lastViewedRuntimeEventAtMsBySessionId}
          dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
          projects={projects}
          terminalSessions={Array.from(sessions.values())}
          divergencesByProject={divergencesByProject}
          workspaceMembersByWorkspaceId={membersByWorkspaceId}
          splitBySessionId={splitBySessionId}
          reconnectBySessionId={reconnectBySessionId}
          globalTmuxHistoryLimit={appSettings.tmuxHistoryLimit}
          appSettings={appSettings}
          editorTheme={editorTheme}
          capabilities={agentRuntimeCapabilities}
          projectsLoading={projectsLoading}
          divergencesLoading={divergencesLoading}
          isSidebarOpen={isSidebarOpen}
          isRightPanelOpen={isRightPanelOpen}
          onToggleSidebar={toggleSidebar}
          onToggleRightPanel={toggleRightPanel}
          onSelectSession={(sessionId) => {
            void handleSelectWorkspaceSession(sessionId);
          }}
          onDismissSessionAttention={handleDismissSessionAttention}
          onCloseSession={handleCloseWorkspaceSession}
          onCloseSessionAndKillTmux={handleCloseSessionAndKillTmux}
          onOpenCommandCenter={(mode) => setCommandCenterMode(mode)}
          onSplitStage={handleSplitStagePane}
          onResetToSinglePane={handleResetStageToSinglePane}
          onFocusPane={handleFocusStagePane}
          onClosePane={handleCloseStagePane}
          onResizeStageAdjacentPanes={handleResizeStageAdjacentPanes}
          onStatusChange={handleSessionStatusChange}
          onRegisterTerminalCommand={handleRegisterTerminalCommand}
          onUnregisterTerminalCommand={handleUnregisterTerminalCommand}
          onFocusSplitPane={handleFocusSplitPane}
          onResizeSplitPanes={handleResizeSplitPanes}
          onReconnectSession={handleReconnectSession}
          onRunReviewAgentRequest={handleRunReviewAgent}
          onProjectSettingsSaved={updateProjectSettings}
          onSendPromptToSession={handleSendPromptToSession}
          onUpdateSessionSettings={(sessionId, input) => updateAgentSession({ sessionId, ...input })}
          onSendPrompt={startAgentTurn}
          onStageAttachment={stageAgentAttachment}
          onDiscardAttachment={discardAgentAttachment}
          onRespondToRequest={respondToAgentRequest}
          onStopSession={stopAgentSession}
        />
      )}

      {/* Command Center */}
      <AnimatePresence>
        {commandCenterMode && (
          <CommandCenter
            mode={commandCenterMode}
            projects={projects}
            divergencesByProject={divergencesByProject}
            sessions={workspaceSessions}
            workspaces={workspaceList}
            workspaceDivergences={Array.from(workspaceDivergencesByWorkspaceId.values()).flat()}
            sourceSession={activeSessionId ? workspaceSessions.get(activeSessionId) ?? null : null}
            onSelectProject={(project) => {
              handleSelectProject(project);
            }}
            onSelectDivergence={(divergence) => {
              handleSelectDivergence(divergence);
            }}
            onSelectSession={(sessionId) => {
              setSidebarMode("projects");
              void handleSelectWorkspaceSession(sessionId);
            }}
            onSelectWorkspace={(workspace) => {
              handleSelectWorkspace(workspace);
            }}
            onSelectWorkspaceDivergence={(wd) => {
              handleSelectWorkspaceDivergence(wd);
            }}
            onSelectFile={(absolutePath) => {
              // File opening is handled through the stage sidebar's file editor
              // For now we broadcast an event the StageSidebar can pick up
              void absolutePath;
            }}
            onCreateTerminal={() => {
              // Terminal creation delegates to existing new divergence flow
              void 0;
            }}
            onCreateAgent={(provider) => {
              void provider;
            }}
            onClose={() => setCommandCenterMode(null)}
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
