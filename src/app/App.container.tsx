import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Sidebar from "../widgets/sidebar";
import { InboxPanel, useGithubInboxPolling } from "../features/inbox";
import { AutomationsPanel } from "../features/automations";
import { useAgentRuntime } from "../features/agent-runtime";
import CommandCenter, {
  type CommandCenterMode,
  type CommandCenterSearchResult,
  type CreateAction,
  getFileAbsolutePath,
} from "../features/command-center";
import { onMobileHandshake } from "./api/mobileHandshake.api";
import Settings from "../widgets/settings-modal";
import type { SettingsCategoryId } from "../widgets/settings-modal";
import {
  MergeNotification,
  useMergeDetection,
  type MergeNotificationData,
} from "../features/merge-detection";
import {
  CreateWorkspaceModal,
  CreateWorkspaceDivergenceModal,
} from "../features/workspace-management";
import { WorkspaceSettings } from "../features/workspace-settings";
import {
  TaskCenterPage,
  TaskToasts,
  useTaskCenterAttachment,
  useTaskCenter,
} from "../features/task-center";
import { useReviewAgentSession } from "../features/review-agent";
import { hydrateTasksFromAutomationRuns } from "../entities/task";
import { useAllDivergences } from "../entities/divergence";
import { useProjectSettingsMap, useProjects } from "../entities/project";
import { useWorkspaces } from "../entities/workspace";
import {
  usePortAllocations,
  type PortAllocation,
} from "../entities/port-management";
import { useAutomations } from "../entities/automation";
import { useInboxEvents } from "../entities/inbox-event";
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
  joinPath,
  Toaster,
  useAppSettings,
  useUpdater,
} from "../shared";
import type {
  AgentProvider,
  ChangesMode,
  Project,
  Divergence,
  GitChangeEntry,
  StagePaneId,
  StagePaneRef,
  StageTab,
  StageTabId,
  Workspace,
  WorkspaceDivergence,
  WorkspaceSession,
} from "../entities";
import {
  buildWorkspaceDivergenceTerminalSession,
  buildWorkspaceKey,
  buildWorkspaceTerminalSession,
  getWorkspaceSessionAttentionKey,
  getWorkspaceSessionAttentionState,
  isAgentSession,
  isEditorSession,
  getWorkspaceSessionTargetType,
  suggestAgentSessionTitle,
} from "../entities";
import { useSplitPaneManagement } from "./model/useSplitPaneManagement";
import { useStageTabGroup } from "./model/useStageTabGroup";
import { useSidebarLayout } from "./model/useSidebarLayout";
import { useIdleNotification } from "./model/useIdleNotification";
import { useGlobalErrorTracking } from "./model/useGlobalErrorTracking";
import { useSessionPersistence } from "./model/useSessionPersistence";
import { useEditorSessionRegistry } from "./model/useEditorSessionRegistry";
import {
  useWorkspaceSessionRegistry,
  type SessionNotificationCallbacks,
} from "./model/useWorkspaceSessionRegistry";
import { useAutomationShellIntegration } from "./model/useAutomationShellIntegration";
import { useAppKeyboardShortcuts } from "./model/useAppKeyboardShortcuts";
import { useProjectOperations } from "./model/useProjectOperations";
import { useWorkspaceOperations } from "./model/useWorkspaceOperations";
import { DebugConsolePanel } from "../features/debug-console";
import { PortDashboard } from "../features/port-dashboard";
import {
  GithubPrHub,
  openPrConflictResolutionDivergence,
  openPrReviewDivergence,
  type GithubPullRequestDetail,
  type GithubPullRequestSummary,
} from "../features/github-pr-hub";
import StageView from "./ui/stage-view/StageView.container";

function App() {
  const updater = useUpdater(true);
  const {
    projects,
    addProject,
    removeProject,
    loading: projectsLoading,
  } = useProjects();
  const {
    divergencesByProject,
    refresh: refreshDivergences,
    loading: divergencesLoading,
  } = useAllDivergences();
  const { settingsByProjectId, updateProjectSettings } =
    useProjectSettingsMap(projects);
  const { settings: appSettings } = useAppSettings();
  const {
    workspaces: workspaceList,
    membersByWorkspaceId,
    workspaceDivergencesByWorkspaceId,
    refresh: refreshWorkspaces,
  } = useWorkspaces();
  const { allocations: portAllocations, refresh: refreshPortAllocations } =
    usePortAllocations();
  const {
    splitBySessionId,
    setSplitBySessionId,
    handleFocusSplitPane,
    handleResizeSplitPanes,
  } = useSplitPaneManagement();
  const [commandCenterMode, setCommandCenterMode] =
    useState<CommandCenterMode | null>(null);
  const showCommandCenter = commandCenterMode !== null;
  const [showSettings, setShowSettings] = useState(false);
  const [renameAgentSessionState, setRenameAgentSessionState] = useState<{
    sessionId: string;
    value: string;
  } | null>(null);
  const [settingsInitialCategory, setSettingsInitialCategory] =
    useState<SettingsCategoryId>("general");
  const [createDivergenceFor, setCreateDivergenceFor] =
    useState<Project | null>(null);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createWorkspaceDivergenceFor, setCreateWorkspaceDivergenceFor] =
    useState<import("../entities").Workspace | null>(null);
  const [mergeNotification, setMergeNotification] =
    useState<MergeNotificationData | null>(null);
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
    projects.forEach((p) => map.set(p.id, { name: p.name }));
    return map;
  }, [projects]);

  const projectById = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((project) => map.set(project.id, project));
    return map;
  }, [projects]);
  const divergenceById = useMemo(() => {
    const map = new Map<number, Divergence>();
    divergencesByProject.forEach((divergences) => {
      divergences.forEach((divergence) => {
        map.set(divergence.id, divergence);
      });
    });
    return map;
  }, [divergencesByProject]);
  const workspaceById = useMemo(() => {
    const map = new Map<number, Workspace>();
    workspaceList.forEach((workspace) => map.set(workspace.id, workspace));
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

  // ── Session Management ──
  // Use a ref to break the circular dependency between useWorkspaceSessionRegistry
  // and useIdleNotification (each needs outputs from the other).
  const notificationCallbacksRef = useRef<SessionNotificationCallbacks>({
    clearNotificationTracking: () => { },
    onSessionBecameBusy: () => { },
    onSessionBecameActive: () => { },
    onSessionBecameIdle: () => { },
  });

  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    sessionsRef,
    statusBySessionRef,
    reconnectBySessionId,
    createSession,
    createManualSession,
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
  } = useWorkspaceSessionRegistry({
    settingsByProjectId,
    projectsById,
    appSettings,
    portAllocationByEntityKey,
    splitBySessionId,
    setSplitBySessionId,
    notificationCallbacksRef,
  });

  const {
    editorSessions,
    setEditorSessions,
    editorViewStateBySessionId,
    editorRuntimeStateBySessionId,
    openOrReuseEditorSession,
    ensureEditorSessionLoaded,
    applyEditorSessionViewState,
    setEditorSessionActiveTab,
    changeEditorSessionContent,
    saveEditorSession,
    closeEditorSession,
    closeSessionsForProject: closeEditorSessionsForProject,
    closeSessionsForDivergence: closeEditorSessionsForDivergence,
    closeSessionsForWorkspace: closeEditorSessionsForWorkspace,
    closeSessionsForWorkspaceDivergence:
    closeEditorSessionsForWorkspaceDivergence,
  } = useEditorSessionRegistry();

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
  const {
    hasRestoredTabs,
    restoredTabsToastMessage,
    setRestoredTabsToastMessage,
  } = useSessionPersistence({
    sessions,
    setSessions,
    editorSessions,
    setEditorSessions,
    activeSessionId,
    setActiveSessionId,
    restoreTabsOnRestart: appSettings.restoreTabsOnRestart,
  });

  const {
    capabilities: agentRuntimeCapabilities,
    hasLoadedInitialSessions,
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
    closeEditorSessionsForProject(projectId);
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
    closeEditorSessionsForDivergence(divergenceId);
    agentSessions.forEach((session) => {
      if (
        session.targetType === "divergence" &&
        session.targetId === divergenceId
      ) {
        void deleteAgentSession(session.id).catch((error) => {
          console.warn("Failed to delete divergence agent session:", error);
        });
      }
    });
  };

  const closeSessionsForWorkspaceDivergenceAndAgents = (
    workspaceDivergenceId: number
  ) => {
    closeSessionsForWorkspaceDivergence(workspaceDivergenceId);
    closeEditorSessionsForWorkspaceDivergence(workspaceDivergenceId);
    agentSessions.forEach((session) => {
      if (
        session.targetType === "workspace_divergence" &&
        session.targetId === workspaceDivergenceId
      ) {
        void deleteAgentSession(session.id).catch((error) => {
          console.warn(
            "Failed to delete workspace divergence agent session:",
            error
          );
        });
      }
    });
  };

  const closeSessionsForWorkspaceAndAgents = (workspaceId: number) => {
    closeEditorSessionsForWorkspace(workspaceId);
    agentSessions.forEach((session) => {
      if (
        session.targetType === "workspace" &&
        session.targetId === workspaceId
      ) {
        void deleteAgentSession(session.id).catch((error) => {
          console.warn("Failed to delete workspace agent session:", error);
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
    return hydrateTasksFromAutomationRuns(
      automationRuns,
      automationLookupById,
      projectLookupById
    );
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
  } = useAutomationShellIntegration({
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
    createAutomation,
    saveAutomation,
    removeAutomation,
  });

  // ── Project Operations ──
  const {
    handleAddProject,
    handleRemoveProject,
    handleCreateDivergence,
    handleDeleteDivergence,
  } = useProjectOperations({
    projectsById,
    divergencesByProject,
    runTask,
    addProject,
    removeProject,
    refreshDivergences,
    refreshPortAllocations,
    closeSessionsForProject: closeSessionsForProjectAndAgents,
    closeSessionsForDivergence: closeSessionsForDivergenceAndAgents,
  });

  // ── Workspace Operations ──
  const {
    handleSelectWorkspace,
    handleCreateWorkspace,
    handleDeleteWorkspace,
    handleSelectWorkspaceDivergence,
    handleDeleteWorkspaceDivergence,
    handleOpenWorkspaceSettings,
    handleCreateWorkspaceDivergences,
    activeWorkspaceSettingsId,
    setActiveWorkspaceSettingsId,
  } = useWorkspaceOperations({
    projects,
    appSettings,
    portAllocationByEntityKey,
    runTask,
    refreshDivergences,
    refreshWorkspaces,
    refreshPortAllocations,
    closeSessionsForWorkspace: closeSessionsForWorkspaceAndAgents,
    closeSessionsForWorkspaceDivergence:
      closeSessionsForWorkspaceDivergenceAndAgents,
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
  const { handleViewTaskCenterTask, handleAttachToAutomationSession } =
    useTaskCenterAttachment({
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
  const handleSelectProject = useCallback(
    (project: Project) => {
      handleSelectProjectRaw(project);
      setSidebarMode("projects");
    },
    [handleSelectProjectRaw, setSidebarMode]
  );

  const handleSelectDivergence = useCallback(
    (divergence: Divergence) => {
      handleSelectDivergenceRaw(divergence);
      setSidebarMode("projects");
    },
    [handleSelectDivergenceRaw, setSidebarMode]
  );

  const handleOpenGithubPrDivergence = useCallback(
    async (
      mode: "review" | "conflict-resolution",
      input: {
        pullRequest: GithubPullRequestSummary;
        detail: GithubPullRequestDetail;
      }
    ) => {
      const openPrDivergence =
        mode === "conflict-resolution"
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
    },
    [
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
    ]
  );

  const handleOpenPrReviewDivergence = useCallback(
    async (input: {
      pullRequest: GithubPullRequestSummary;
      detail: GithubPullRequestDetail;
    }) => {
      await handleOpenGithubPrDivergence("review", input);
    },
    [handleOpenGithubPrDivergence]
  );

  const handleOpenPrConflictResolutionDivergence = useCallback(
    async (input: {
      pullRequest: GithubPullRequestSummary;
      detail: GithubPullRequestDetail;
    }) => {
      await handleOpenGithubPrDivergence("conflict-resolution", input);
    },
    [handleOpenGithubPrDivergence]
  );

  const workspaceSessions = useMemo(() => {
    const next = new Map<string, WorkspaceSession>();
    sessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    editorSessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    openAgentSessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    return next;
  }, [editorSessions, openAgentSessions, sessions]);

  const sidebarSessions = useMemo(() => {
    const next = new Map<string, WorkspaceSession>();
    sessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    editorSessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    agentSessions.forEach((session, sessionId) => {
      next.set(sessionId, session);
    });
    return next;
  }, [agentSessions, editorSessions, sessions]);

  const {
    tabGroup,
    activeTab,
    layout: stageLayout,
    handleCreateTab: handleCreateStageTab,
    handleCreateTabWithRef: handleCreateStageTabWithRef,
    handleCloseTab: handleCloseStageTab,
    handleCloseOtherTabs: handleCloseOtherStageTabs,
    handleFocusTab: handleFocusStageTab,
    handleRenameTab: handleRenameStageTab,
    handleFocusNextTab: handleFocusNextStageTab,
    handleFocusPreviousTab: handleFocusPreviousStageTab,
    handleRevealSession: handleRevealStageSession,
    handleFocusPane: handleFocusStagePane,
    handleSplitPane: handleSplitStagePane,
    handleReplacePaneRef: handleReplaceStagePaneRef,
    handleResizeAdjacentPanes: handleResizeStageAdjacentPanes,
    handleClosePane: handleCloseStagePane,
    handleCloseFocusedPane: handleCloseFocusedStagePane,
    handleResetToSinglePane: handleResetStageToSinglePane,
    focusNextPane: focusNextStagePane,
    focusPreviousPane: focusPreviousStagePane,
  } = useStageTabGroup({
    workspaceSessions,
    activeSessionId,
    setActiveSessionId,
    isRestoreReady: hasRestoredTabs && hasLoadedInitialSessions,
    restoreTabsOnRestart: appSettings.restoreTabsOnRestart,
    maxStageTabs: appSettings.maxStageTabs,
  });
  const stageTabIds = useMemo(
    () => tabGroup?.tabs.map((tab) => tab.id) ?? [],
    [tabGroup]
  );
  const notifyMaxStageTabsReached = useCallback(() => {
    toast.info(
      `Layout tabs are limited to ${appSettings.maxStageTabs}. Adjust the limit in Settings > General.`
    );
  }, [appSettings.maxStageTabs]);

  const buildEditorOpenInputFromSession = useCallback(
    (
      session: WorkspaceSession,
      filePath: string,
      options?: {
        preferredTab?: "edit" | "diff";
        diffMode?: ChangesMode | null;
        changeEntry?: GitChangeEntry | null;
        focusLine?: number | null;
        focusColumn?: number | null;
      }
    ) => ({
      targetType: getWorkspaceSessionTargetType(session),
      targetId: session.targetId,
      projectId: session.projectId,
      workspaceOwnerId: session.workspaceOwnerId,
      workspaceKey: session.workspaceKey,
      path: session.path,
      filePath,
      preferredTab: options?.preferredTab,
      diffMode: options?.diffMode ?? null,
      changeEntry: options?.changeEntry ?? null,
      focusLine: options?.focusLine ?? null,
      focusColumn: options?.focusColumn ?? null,
    }),
    []
  );

  const showEditorSessionInStage = useCallback(
    (sessionId: string, options?: { targetPaneId?: StagePaneId | null }) => {
      if (handleRevealStageSession(sessionId)) {
        setActiveSessionId(sessionId);
        return;
      }

      const ref: StagePaneRef = { kind: "editor", sessionId };
      const targetPaneId =
        options?.targetPaneId ?? stageLayout?.focusedPaneId ?? null;
      if (stageLayout && targetPaneId) {
        handleReplaceStagePaneRef(targetPaneId, ref);
        setActiveSessionId(sessionId);
        return;
      }

      handleCreateStageTabWithRef(ref);
    },
    [
      handleCreateStageTabWithRef,
      handleRevealStageSession,
      handleReplaceStagePaneRef,
      setActiveSessionId,
      stageLayout,
    ]
  );

  const handleOpenOrFocusEditorFile = useCallback(
    (
      filePath: string,
      sourceSession: WorkspaceSession | null,
      options?: { targetPaneId?: StagePaneId | null }
    ) => {
      if (!sourceSession) {
        return;
      }

      const { session } = openOrReuseEditorSession(
        buildEditorOpenInputFromSession(sourceSession, filePath, {
          preferredTab: "edit",
        })
      );

      setSidebarMode("projects");
      showEditorSessionInStage(session.id, options);
    },
    [
      buildEditorOpenInputFromSession,
      openOrReuseEditorSession,
      setSidebarMode,
      showEditorSessionInStage,
    ]
  );

  const handleOpenOrFocusEditorChange = useCallback(
    (
      entry: GitChangeEntry,
      mode: ChangesMode,
      sourceSession: WorkspaceSession | null
    ) => {
      if (!sourceSession) {
        return;
      }

      const filePath = joinPath(sourceSession.path, entry.path);
      const { session } = openOrReuseEditorSession(
        buildEditorOpenInputFromSession(sourceSession, filePath, {
          preferredTab: "diff",
          diffMode: mode,
          changeEntry: entry,
        })
      );

      setSidebarMode("projects");
      showEditorSessionInStage(session.id);
    },
    [
      buildEditorOpenInputFromSession,
      openOrReuseEditorSession,
      setSidebarMode,
      showEditorSessionInStage,
    ]
  );

  const handleOpenOrFocusEditorSearchMatch = useCallback(
    (
      filePath: string,
      lineNumber: number,
      columnStart: number,
      sourceSession: WorkspaceSession | null
    ) => {
      if (!sourceSession) {
        return;
      }

      const { session } = openOrReuseEditorSession(
        buildEditorOpenInputFromSession(sourceSession, filePath, {
          preferredTab: "edit",
          focusLine: lineNumber,
          focusColumn: columnStart,
        })
      );

      setSidebarMode("projects");
      showEditorSessionInStage(session.id);
    },
    [
      buildEditorOpenInputFromSession,
      openOrReuseEditorSession,
      setSidebarMode,
      showEditorSessionInStage,
    ]
  );

  const createTargetedAgentSession = useCallback(
    async (input: {
      provider: AgentProvider;
      type: "project" | "divergence" | "workspace" | "workspace_divergence";
      item: Project | Divergence | Workspace | WorkspaceDivergence;
    }) => {
      const path =
        "folderPath" in input.item ? input.item.folderPath : input.item.path;
      const projectId =
        input.type === "project"
          ? input.item.id
          : input.type === "divergence"
            ? (input.item as Divergence).projectId
            : 0;
      const workspaceOwnerId =
        input.type === "workspace"
          ? input.item.id
          : input.type === "workspace_divergence"
            ? (input.item as WorkspaceDivergence).workspaceId
            : undefined;
      const existingConversationCount = Array.from(
        agentSessions.values()
      ).filter(
        (session) =>
          session.provider === input.provider &&
          session.targetType === input.type &&
          session.targetId === input.item.id &&
          session.sessionRole === "default"
      ).length;
      const conversationSuffix =
        existingConversationCount > 0
          ? ` ${existingConversationCount + 1}`
          : "";
      const session = await createAgentSession({
        provider: input.provider,
        targetType: input.type,
        targetId: input.item.id,
        projectId,
        workspaceOwnerId,
        workspaceKey: buildWorkspaceKey(input.type, input.item.id),
        sessionRole: "default",
        nameMode: "default",
        model:
          getAgentRuntimeProviderDefaultModel(
            agentRuntimeCapabilities,
            input.provider
          ) ?? undefined,
        name: `${input.item.name} • ${input.provider}${conversationSuffix}`,
        path,
      });
      return session;
    },
    [agentRuntimeCapabilities, agentSessions, createAgentSession]
  );

  const handleCreateAgentSession = useCallback(
    async (input: {
      provider: AgentProvider;
      type: "project" | "divergence" | "workspace" | "workspace_divergence";
      item: Project | Divergence | Workspace | WorkspaceDivergence;
    }) => {
      const session = await createTargetedAgentSession(input);
      setActiveSessionId(session.id);
    },
    [createTargetedAgentSession, setActiveSessionId]
  );

  const handleSelectWorkspaceSession = useCallback(
    async (sessionId: string) => {
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
    },
    [agentSessions, openAgentSession, setActiveSessionId, workspaceSessions]
  );

  const ensureWorkspaceSessionId = useCallback(
    (workspace: Workspace): string => {
      const sessionId = `workspace-${workspace.id}`;
      if (sessionsRef.current.has(sessionId)) {
        return sessionId;
      }

      const session = buildWorkspaceTerminalSession({
        workspace,
        globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
      });

      setSessions((previous) => {
        if (previous.has(sessionId)) {
          return previous;
        }
        const next = new Map(previous);
        next.set(sessionId, session);
        return next;
      });

      return session.id;
    },
    [appSettings.tmuxHistoryLimit, sessionsRef, setSessions]
  );

  const ensureWorkspaceDivergenceSessionId = useCallback(
    (workspaceDivergence: WorkspaceDivergence): string => {
      const sessionId = `workspace_divergence-${workspaceDivergence.id}`;
      if (sessionsRef.current.has(sessionId)) {
        return sessionId;
      }

      const session = buildWorkspaceDivergenceTerminalSession({
        workspaceDivergence,
        globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
        portAllocation:
          portAllocationByEntityKey.get(
            `workspace_divergence:${workspaceDivergence.id}`
          ) ?? null,
      });

      setSessions((previous) => {
        if (previous.has(sessionId)) {
          return previous;
        }
        const next = new Map(previous);
        next.set(sessionId, session);
        return next;
      });

      return session.id;
    },
    [
      appSettings.tmuxHistoryLimit,
      portAllocationByEntityKey,
      sessionsRef,
      setSessions,
    ]
  );

  const resolveQuickSwitcherSelectionRef = useCallback(
    async (
      type:
        | "project"
        | "divergence"
        | "session"
        | "workspace"
        | "workspace_divergence",
      item:
        | Project
        | Divergence
        | WorkspaceSession
        | Workspace
        | WorkspaceDivergence
    ): Promise<StagePaneRef | null> => {
      if (type === "project") {
        const session = createSession("project", item as Project);
        return { kind: "terminal", sessionId: session.id };
      }

      if (type === "divergence") {
        const session = createSession("divergence", item as Divergence);
        return { kind: "terminal", sessionId: session.id };
      }

      if (type === "workspace") {
        return {
          kind: "terminal",
          sessionId: ensureWorkspaceSessionId(item as Workspace),
        };
      }

      if (type === "workspace_divergence") {
        return {
          kind: "terminal",
          sessionId: ensureWorkspaceDivergenceSessionId(
            item as WorkspaceDivergence
          ),
        };
      }

      const session = item as WorkspaceSession;
      if (isAgentSession(session) && !workspaceSessions.has(session.id)) {
        try {
          await openAgentSession(session.id);
        } catch (error) {
          console.warn(
            "Failed to reopen agent session from quick switcher:",
            error
          );
          return null;
        }
      }

      if (isAgentSession(session)) {
        return { kind: "agent", sessionId: session.id };
      }

      if (isEditorSession(session)) {
        return { kind: "editor", sessionId: session.id };
      }

      return { kind: "terminal", sessionId: session.id };
    },
    [
      createSession,
      ensureWorkspaceDivergenceSessionId,
      ensureWorkspaceSessionId,
      openAgentSession,
      workspaceSessions,
    ]
  );

  const handleOpenQuickSwitcherSelectionInNewTab = useCallback(
    async (
      type:
        | "project"
        | "divergence"
        | "session"
        | "workspace"
        | "workspace_divergence",
      item:
        | Project
        | Divergence
        | WorkspaceSession
        | Workspace
        | WorkspaceDivergence
    ) => {
      const ref = await resolveQuickSwitcherSelectionRef(type, item);
      if (!ref || ref.kind === "pending") {
        return;
      }

      setSidebarMode("projects");
      if (!handleCreateStageTabWithRef(ref)) {
        notifyMaxStageTabsReached();
        return;
      }
      setCommandCenterMode(null);
    },
    [
      handleCreateStageTabWithRef,
      notifyMaxStageTabsReached,
      resolveQuickSwitcherSelectionRef,
      setSidebarMode,
    ]
  );

  const handleRevealWorkspaceSession = useCallback(
    async (sessionId: string) => {
      const session = sidebarSessions.get(sessionId);
      if (!session) {
        return;
      }

      const ref = await resolveQuickSwitcherSelectionRef("session", session);
      if (!ref || ref.kind === "pending") {
        return;
      }

      setSidebarMode("projects");
      if (!handleRevealStageSession(ref.sessionId)) {
        if (!handleCreateStageTabWithRef(ref)) {
          notifyMaxStageTabsReached();
        }
      }
    },
    [
      handleCreateStageTabWithRef,
      handleRevealStageSession,
      notifyMaxStageTabsReached,
      resolveQuickSwitcherSelectionRef,
      setSidebarMode,
      sidebarSessions,
    ]
  );

  const handleRevealQuickSwitcherSelection = useCallback(
    async (
      type:
        | "project"
        | "divergence"
        | "session"
        | "workspace"
        | "workspace_divergence"
        | "stage_tab",
      item:
        | Project
        | Divergence
        | WorkspaceSession
        | Workspace
        | WorkspaceDivergence
        | StageTab
    ) => {
      if (type === "stage_tab") {
        setSidebarMode("projects");
        handleFocusStageTab((item as StageTab).id);
        setCommandCenterMode(null);
        return;
      }

      const revealItem = item as
        | Project
        | Divergence
        | WorkspaceSession
        | Workspace
        | WorkspaceDivergence;
      const ref = await resolveQuickSwitcherSelectionRef(type, revealItem);
      if (!ref || ref.kind === "pending") {
        return;
      }

      setSidebarMode("projects");
      if (!handleRevealStageSession(ref.sessionId)) {
        await handleOpenQuickSwitcherSelectionInNewTab(type, revealItem);
        return;
      }
      setCommandCenterMode(null);
    },
    [
      handleOpenQuickSwitcherSelectionInNewTab,
      handleFocusStageTab,
      handleRevealStageSession,
      resolveQuickSwitcherSelectionRef,
      setSidebarMode,
    ]
  );

  const handleRevealProjectFromSidebar = useCallback(
    (project: Project) => {
      void handleRevealQuickSwitcherSelection("project", project);
    },
    [handleRevealQuickSwitcherSelection]
  );

  const handleRevealDivergenceFromSidebar = useCallback(
    (divergence: Divergence) => {
      void handleRevealQuickSwitcherSelection("divergence", divergence);
    },
    [handleRevealQuickSwitcherSelection]
  );

  const handleCreatePendingPaneSession = useCallback(
    async (paneId: StagePaneId, action: CreateAction) => {
      let ref: StagePaneRef | null = null;

      if (action.sessionKind === "terminal") {
        switch (action.targetType) {
          case "project": {
            const project = projectById.get(action.targetId);
            if (!project) {
              return;
            }
            const session = createManualSession("project", project);
            ref = { kind: "terminal", sessionId: session.id };
            break;
          }
          case "divergence": {
            const divergence = divergenceById.get(action.targetId);
            if (!divergence) {
              return;
            }
            const session = createManualSession("divergence", divergence);
            ref = { kind: "terminal", sessionId: session.id };
            break;
          }
          case "workspace": {
            const workspace = workspaceById.get(action.targetId);
            if (!workspace) {
              return;
            }
            ref = {
              kind: "terminal",
              sessionId: ensureWorkspaceSessionId(workspace),
            };
            break;
          }
          case "workspace_divergence": {
            const workspaceDivergence = workspaceDivergenceById.get(
              action.targetId
            );
            if (!workspaceDivergence) {
              return;
            }
            ref = {
              kind: "terminal",
              sessionId:
                ensureWorkspaceDivergenceSessionId(workspaceDivergence),
            };
            break;
          }
        }
      } else {
        if (!action.provider) {
          return;
        }

        switch (action.targetType) {
          case "project": {
            const project = projectById.get(action.targetId);
            if (!project) {
              return;
            }
            const session = await createTargetedAgentSession({
              provider: action.provider,
              type: "project",
              item: project,
            });
            ref = { kind: "agent", sessionId: session.id };
            break;
          }
          case "divergence": {
            const divergence = divergenceById.get(action.targetId);
            if (!divergence) {
              return;
            }
            const session = await createTargetedAgentSession({
              provider: action.provider,
              type: "divergence",
              item: divergence,
            });
            ref = { kind: "agent", sessionId: session.id };
            break;
          }
          case "workspace": {
            const workspace = workspaceById.get(action.targetId);
            if (!workspace) {
              return;
            }
            const session = await createTargetedAgentSession({
              provider: action.provider,
              type: "workspace",
              item: workspace,
            });
            ref = { kind: "agent", sessionId: session.id };
            break;
          }
          case "workspace_divergence": {
            const workspaceDivergence = workspaceDivergenceById.get(
              action.targetId
            );
            if (!workspaceDivergence) {
              return;
            }
            const session = await createTargetedAgentSession({
              provider: action.provider,
              type: "workspace_divergence",
              item: workspaceDivergence,
            });
            ref = { kind: "agent", sessionId: session.id };
            break;
          }
        }
      }

      if (!ref) {
        return;
      }

      setSidebarMode("projects");
      handleReplaceStagePaneRef(paneId, ref);
    },
    [
      createManualSession,
      createTargetedAgentSession,
      divergenceById,
      ensureWorkspaceDivergenceSessionId,
      ensureWorkspaceSessionId,
      handleReplaceStagePaneRef,
      projectById,
      setSidebarMode,
      workspaceById,
      workspaceDivergenceById,
    ]
  );

  const sourceSessionForCommandCenter = useMemo(() => {
    // Explicit source for open-in-pane
    if (
      commandCenterMode?.kind === "open-in-pane" &&
      commandCenterMode.sourceSessionId
    ) {
      return workspaceSessions.get(commandCenterMode.sourceSessionId) ?? null;
    }

    // Active session (focused pane has a session)
    if (activeSessionId) {
      const session = workspaceSessions.get(activeSessionId);
      if (session) return session;
    }

    // Target pane's session (e.g. replace mode when focused pane is pending)
    if (
      commandCenterMode &&
      "targetPaneId" in commandCenterMode &&
      stageLayout
    ) {
      const targetPane = stageLayout.panes.find(
        (p) => p.id === commandCenterMode.targetPaneId
      );
      if (targetPane && targetPane.ref.kind !== "pending") {
        const session = workspaceSessions.get(targetPane.ref.sessionId);
        if (session) return session;
      }
    }

    // Fall back to any session in any visible pane
    if (stageLayout) {
      for (const pane of stageLayout.panes) {
        if (pane.ref.kind !== "pending") {
          const session = workspaceSessions.get(pane.ref.sessionId);
          if (session) return session;
        }
      }
    }

    return null;
  }, [commandCenterMode, activeSessionId, workspaceSessions, stageLayout]);

  const handleCommandCenterSelect = useCallback(
    async (result: CommandCenterSearchResult) => {
      if (!commandCenterMode) return;

      const mode = commandCenterMode;
      const targetPaneId =
        "targetPaneId" in mode
          ? mode.targetPaneId
          : stageLayout?.focusedPaneId ?? null;

      if (mode.kind === "reveal") {
        void handleRevealQuickSwitcherSelection(
          result.type as
          | "project"
          | "divergence"
          | "session"
          | "workspace"
          | "workspace_divergence"
          | "stage_tab",
          result.item as
          | Project
          | Divergence
          | WorkspaceSession
          | Workspace
          | WorkspaceDivergence
          | StageTab
        );
        return;
      }

      if (result.type === "file") {
        const file = result.item as { relativePath: string };
        const rootPath =
          mode.kind === "open-file"
            ? mode.rootPath
            : sourceSessionForCommandCenter?.path ?? "";
        const absolutePath = getFileAbsolutePath(rootPath, file.relativePath);
        handleOpenOrFocusEditorFile(
          absolutePath,
          sourceSessionForCommandCenter,
          { targetPaneId }
        );
        setCommandCenterMode(null);
        return;
      }

      if (result.type === "create_action") {
        const action = result.item as CreateAction;
        if (targetPaneId) {
          await handleCreatePendingPaneSession(
            targetPaneId as StagePaneId,
            action
          );
        }
        setCommandCenterMode(null);
        return;
      }

      if (result.type === "project") {
        handleSelectProject(result.item as Project);
        setCommandCenterMode(null);
        return;
      }

      if (result.type === "divergence") {
        handleSelectDivergence(result.item as Divergence);
        setCommandCenterMode(null);
        return;
      }

      if (result.type === "workspace") {
        handleSelectWorkspace(result.item as Workspace);
        setCommandCenterMode(null);
        return;
      }

      if (result.type === "workspace_divergence") {
        handleSelectWorkspaceDivergence(result.item as WorkspaceDivergence);
        setCommandCenterMode(null);
        return;
      }

      if (result.type === "session") {
        setSidebarMode("projects");
        void handleSelectWorkspaceSession((result.item as WorkspaceSession).id);
        setCommandCenterMode(null);
        return;
      }

      if (result.type === "stage_tab") {
        setSidebarMode("projects");
        handleFocusStageTab((result.item as StageTab).id);
        setCommandCenterMode(null);
        return;
      }
    },
    [
      commandCenterMode,
      handleCreatePendingPaneSession,
      handleFocusStageTab,
      handleOpenOrFocusEditorFile,
      handleRevealQuickSwitcherSelection,
      handleSelectDivergence,
      handleSelectProject,
      handleSelectWorkspace,
      handleSelectWorkspaceDivergence,
      handleSelectWorkspaceSession,
      setSidebarMode,
      sourceSessionForCommandCenter,
      stageLayout,
    ]
  );

  const handleCloseWorkspaceSession = (sessionId: string) => {
    if (editorSessions.has(sessionId)) {
      const closed = closeEditorSession(sessionId);
      if (closed) {
        setActiveSessionId((current) =>
          current === sessionId ? null : current
        );
      }
      return;
    }

    if (sessionsRef.current.has(sessionId)) {
      handleCloseSession(sessionId);
      return;
    }

    void closeAgentSession(sessionId).catch((error) => {
      console.warn("Failed to close agent session:", error);
    });
    setActiveSessionId((current) => (current === sessionId ? null : current));
  };

  const handleDeleteAgentConversation = (sessionId: string) => {
    void deleteAgentSession(sessionId).catch((error) => {
      console.warn("Failed to delete agent session:", error);
    });
    setActiveSessionId((current) => (current === sessionId ? null : current));
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
    })
      .catch((error) => {
        console.warn("Failed to rename agent session:", error);
      })
      .finally(() => {
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
      })
        .catch((error) => {
          console.warn("Failed to auto-rename agent session:", error);
        })
        .finally(() => {
          renamingAgentSessionIdsRef.current.delete(session.id);
        });
    });
  }, [agentSessions, updateAgentSession]);

  // ── Keyboard Shortcuts ──
  useAppKeyboardShortcuts({
    sessions: workspaceSessions,
    activeSessionId,
    stageLayout,
    stageTabIds,
    handleCreateTab: () => {
      setSidebarMode("projects");
      if (!handleCreateStageTab()) {
        notifyMaxStageTabsReached();
      }
    },
    handleFocusStageTab: (tabId) => {
      setSidebarMode("projects");
      handleFocusStageTab(tabId);
    },
    handleFocusNextStageTab: () => {
      setSidebarMode("projects");
      handleFocusNextStageTab();
    },
    handleFocusPreviousStageTab: () => {
      setSidebarMode("projects");
      handleFocusPreviousStageTab();
    },
    handleSplitStage: handleSplitStagePane,
    handleCloseFocusedStagePane,
    handleReconnectSession,
    focusPreviousStagePane,
    focusNextStagePane,
    toggleSidebar,
    toggleRightPanel,
    setIsSidebarOpen,
    setSidebarMode,
    setWorkTab,
    setCommandCenterMode,
    focusedPaneId: stageLayout?.focusedPaneId ?? "stage-pane-1",
    activeSessionPath: sourceSessionForCommandCenter?.path ?? "",
    setShowSettings,
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
    divergencesByProject.forEach((divs) => all.push(...divs));
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
    document.documentElement.style.colorScheme =
      theme === "light" ? "light" : "dark";
  }, [appSettings.theme]);

  const editorTheme =
    appSettings.theme === "light"
      ? DEFAULT_EDITOR_THEME_LIGHT
      : DEFAULT_EDITOR_THEME_DARK;
  const workspaceSessionList = useMemo(
    () => Array.from(workspaceSessions.values()),
    [workspaceSessions]
  );
  const [
    lastViewedRuntimeEventAtMsBySessionId,
    setLastViewedRuntimeEventAtMsBySessionId,
  ] = useState<Map<string, number>>(() => new Map());
  const [
    dismissedAttentionKeyBySessionId,
    setDismissedAttentionKeyBySessionId,
  ] = useState<Map<string, string>>(() => new Map());
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
      lastViewedRuntimeEventAtMs:
        lastViewedRuntimeEventAtMsBySessionId.get(sessionId) ?? null,
    };
    const attentionKey = getWorkspaceSessionAttentionKey(
      session,
      attentionOptions
    );
    if (!attentionKey) {
      return;
    }

    if (isAgentSession(session)) {
      const lastRuntimeEventAtMs =
        session.lastRuntimeEventAtMs ?? session.updatedAtMs;
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

    handleCloseWorkspaceSession(sessionId);
  };

  const stageTabAttentionIds = useMemo(() => {
    const next = new Set<StageTabId>();
    if (!tabGroup) {
      return next;
    }

    for (const tab of tabGroup.tabs) {
      const hasAttention = tab.layout.panes.some((pane) => {
        if (pane.ref.kind === "pending") {
          return false;
        }

        const session = workspaceSessions.get(pane.ref.sessionId);
        if (!session) {
          return false;
        }

        const attentionState = getWorkspaceSessionAttentionState(session, {
          isActive: session.id === activeSessionId,
          hasIdleAttention: idleAttentionSessionIds.has(session.id),
          lastViewedRuntimeEventAtMs:
            lastViewedRuntimeEventAtMsBySessionId.get(session.id) ?? null,
          dismissedAttentionKey:
            dismissedAttentionKeyBySessionId.get(session.id) ?? null,
        });

        return Boolean(attentionState) || session.status === "busy";
      });

      if (hasAttention) {
        next.add(tab.id);
      }
    }

    return next;
  }, [
    activeSessionId,
    dismissedAttentionKeyBySessionId,
    idleAttentionSessionIds,
    lastViewedRuntimeEventAtMsBySessionId,
    tabGroup,
    workspaceSessions,
  ]);

  return (
    <div className="flex h-full w-full">
      <div
        className={`h-full shrink-0 overflow-hidden${isDraggingSidebar ? "" : " transition-[width] duration-200 ease-out"
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
          lastViewedRuntimeEventAtMsBySessionId={
            lastViewedRuntimeEventAtMsBySessionId
          }
          dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
          createDivergenceFor={createDivergenceFor}
          onCreateDivergenceForChange={setCreateDivergenceFor}
          onSelectProject={handleRevealProjectFromSidebar}
          onSelectDivergence={handleRevealDivergenceFromSidebar}
          onSelectSession={(sessionId) => {
            void handleSelectWorkspaceSession(sessionId);
          }}
          onRevealSession={(sessionId) => {
            void handleRevealWorkspaceSession(sessionId);
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
              onOpenConflictResolutionDivergence={
                handleOpenPrConflictResolutionDivergence
              }
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
              workspaceDivergences={Array.from(
                workspaceDivergencesByWorkspaceId.values()
              ).flat()}
            />
          )}
          {workTab === "debug" && <DebugConsolePanel />}
        </div>
      ) : (
        <StageView
          tabs={tabGroup?.tabs ?? []}
          activeTabId={activeTab?.id ?? null}
          attentionTabIds={stageTabAttentionIds}
          maxStageTabs={appSettings.maxStageTabs}
          layout={stageLayout}
          workspaceSessions={workspaceSessions}
          sessionList={workspaceSessionList}
          activeSessionId={activeSessionId}
          idleAttentionSessionIds={idleAttentionSessionIds}
          lastViewedRuntimeEventAtMsBySessionId={
            lastViewedRuntimeEventAtMsBySessionId
          }
          dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
          projects={projects}
          agentProviders={agentProviders}
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
          editorRuntimeStateBySessionId={editorRuntimeStateBySessionId}
          editorViewStateBySessionId={editorViewStateBySessionId}
          isSidebarOpen={isSidebarOpen}
          isRightPanelOpen={isRightPanelOpen}
          onToggleSidebar={toggleSidebar}
          onToggleRightPanel={toggleRightPanel}
          onCreateTab={() => {
            if (!handleCreateStageTab()) {
              notifyMaxStageTabsReached();
            }
          }}
          onCloseTab={handleCloseStageTab}
          onCloseOtherTabs={handleCloseOtherStageTabs}
          onFocusTab={handleFocusStageTab}
          onRenameTab={handleRenameStageTab}
          onSelectSession={(sessionId) => {
            void handleSelectWorkspaceSession(sessionId);
          }}
          onDismissSessionAttention={handleDismissSessionAttention}
          onCloseSession={handleCloseWorkspaceSession}
          onCloseSessionAndKillTmux={handleCloseSessionAndKillTmux}
          onSplitStage={handleSplitStagePane}
          onResetToSinglePane={handleResetStageToSinglePane}
          onFocusPane={handleFocusStagePane}
          onOpenCommandCenter={(paneId, sourceSessionId) => {
            setCommandCenterMode({
              kind: "open-in-pane",
              targetPaneId: paneId,
              sourceSessionId,
            });
          }}
          onClosePane={handleCloseStagePane}
          onResizeStageAdjacentPanes={handleResizeStageAdjacentPanes}
          onOpenOrFocusEditorFile={handleOpenOrFocusEditorFile}
          onOpenOrFocusEditorChange={handleOpenOrFocusEditorChange}
          onOpenOrFocusEditorSearchMatch={handleOpenOrFocusEditorSearchMatch}
          onEnsureEditorSessionLoaded={ensureEditorSessionLoaded}
          onApplyEditorSessionViewState={applyEditorSessionViewState}
          onSetEditorSessionActiveTab={setEditorSessionActiveTab}
          onChangeEditorSessionContent={changeEditorSessionContent}
          onSaveEditorSession={saveEditorSession}
          onStatusChange={handleSessionStatusChange}
          onRegisterTerminalCommand={handleRegisterTerminalCommand}
          onUnregisterTerminalCommand={handleUnregisterTerminalCommand}
          onFocusSplitPane={handleFocusSplitPane}
          onResizeSplitPanes={handleResizeSplitPanes}
          onReconnectSession={handleReconnectSession}
          onRunReviewAgentRequest={handleRunReviewAgent}
          onProjectSettingsSaved={updateProjectSettings}
          onSendPromptToSession={handleSendPromptToSession}
          onUpdateSessionSettings={(sessionId, input) =>
            updateAgentSession({ sessionId, ...input })
          }
          onSendPrompt={startAgentTurn}
          onStageAttachment={stageAgentAttachment}
          onDiscardAttachment={discardAgentAttachment}
          onRespondToRequest={respondToAgentRequest}
          onStopSession={stopAgentSession}
        />
      )}

      {/* Command Center */}
      <AnimatePresence>
        {showCommandCenter && commandCenterMode && (
          <CommandCenter
            mode={commandCenterMode}
            projects={projects}
            divergencesByProject={divergencesByProject}
            sessions={workspaceSessions}
            stageTabs={tabGroup?.tabs ?? []}
            workspaces={workspaceList}
            workspaceDivergences={Array.from(
              workspaceDivergencesByWorkspaceId.values()
            ).flat()}
            agentProviders={agentProviders}
            excludePatterns={appSettings.commandCenterExcludePatterns}
            respectGitignore={appSettings.commandCenterRespectGitignore}
            sourceSession={sourceSessionForCommandCenter}
            onSelect={(result) => {
              void handleCommandCenterSelect(result);
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
        {createWorkspaceDivergenceFor &&
          (() => {
            const wsMembers =
              membersByWorkspaceId.get(createWorkspaceDivergenceFor.id) ?? [];
            const memberProjectIds = new Set(wsMembers.map((m) => m.projectId));
            const memberProjects = projects.filter((p) =>
              memberProjectIds.has(p.id)
            );
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
                <h2 className="text-lg font-semibold text-text">
                  Rename Conversation
                </h2>
                <p className="text-xs text-subtext mt-1">
                  Give this conversation a custom name. Manual names stay fixed
                  and will not be auto-renamed.
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
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {!bannerDismissed &&
        (updater.status === "available" ||
          updater.status === "downloading" ||
          updater.status === "error") && (
          <div
            className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${updater.status === "error" ? "bg-red-600" : "bg-blue-600"
              }`}
          >
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
                  <ProgressBar
                    value={updater.progress}
                    className="w-24 bg-blue-400"
                    barClassName="bg-white"
                  />
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
                icon={
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        )}
      <Toaster />
    </div>
  );
}

export default App;
