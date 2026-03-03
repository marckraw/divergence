import { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Sidebar from "../widgets/sidebar";
import MainArea from "../widgets/main-area";
import { InboxPanel } from "../features/inbox";
import { AutomationsPanel } from "../features/automations";
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
  Button,
  DEFAULT_EDITOR_THEME_DARK,
  DEFAULT_EDITOR_THEME_LIGHT,
  IconButton,
  ProgressBar,
  useAppSettings,
  useUpdater,
} from "../shared";
import type {
  Project,
  Divergence,
  TerminalSession,
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
import { GithubPrHub } from "../features/github-pr-hub";

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
    closeSessionsForProject,
    closeSessionsForDivergence,
    closeSessionsForWorkspaceDivergence,
    handleCloseSession,
    sessionsRef,
    setSessions,
    setActiveSessionId,
  });

  // ── Review Agent Session ──
  const { handleRunReviewAgent } = useReviewAgentSession({
    sessionsRef,
    setSessions,
    setActiveSessionId,
    sendCommandToSession,
    appSettings,
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
    setSessions,
    setActiveSessionId,
    sendCommandToSession,
  });

  // ── Keyboard Shortcuts ──
  useAppKeyboardShortcuts({
    sessions,
    activeSessionId,
    splitBySessionId,
    setSplitBySessionId,
    projects,
    createDivergenceFor,
    handleCloseSession,
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

  // Wrap handleSelectProject / handleSelectDivergence to also set sidebar mode
  const handleSelectProject = (project: Project) => {
    handleSelectProjectRaw(project);
    setSidebarMode("projects");
  };

  const handleSelectDivergence = (divergence: Divergence) => {
    handleSelectDivergenceRaw(divergence);
    setSidebarMode("projects");
  };

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
  const activeSession = activeSessionId ? sessions.get(activeSessionId) ?? null : null;

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
          sessions={sessions}
          activeSessionId={activeSessionId}
          createDivergenceFor={createDivergenceFor}
          onCreateDivergenceForChange={setCreateDivergenceFor}
          onSelectProject={handleSelectProject}
          onSelectDivergence={handleSelectDivergence}
          onSelectSession={setActiveSessionId}
          onCloseSession={handleCloseSession}
          onCloseSessionAndKillTmux={handleCloseSessionAndKillTmux}
          onAddProject={handleAddProject}
          onRemoveProject={handleRemoveProject}
          onCreateDivergence={handleCreateDivergence}
          onCreateAdditionalSession={handleCreateAdditionalSession}
          onDeleteDivergence={handleDeleteDivergence}
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
              agentCommandClaude={appSettings.agentCommandClaude}
              agentCommandCodex={appSettings.agentCommandCodex}
              claudeOAuthToken={appSettings.claudeOAuthToken ?? ""}
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
        <MainArea
          projects={projects}
          sessions={sessions}
          idleAttentionSessionIds={idleAttentionSessionIds}
          activeSession={activeSession}
          onCloseSession={handleCloseSession}
          onCloseSessionAndKillTmux={handleCloseSessionAndKillTmux}
          onSelectSession={setActiveSessionId}
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
          workspaceMembersByWorkspaceId={membersByWorkspaceId}
        />
      )}

      {/* Quick Switcher */}
      <AnimatePresence>
        {showQuickSwitcher && (
          <QuickSwitcher
            projects={projects}
            divergencesByProject={divergencesByProject}
            sessions={sessions}
            workspaces={workspaceList}
            workspaceDivergences={Array.from(workspaceDivergencesByWorkspaceId.values()).flat()}
            onSelect={(type, item) => {
              if (type === "project") {
                handleSelectProject(item as Project);
              } else if (type === "divergence") {
                handleSelectDivergence(item as Divergence);
              } else if (type === "workspace") {
                handleSelectWorkspace(item as import("../entities").Workspace);
              } else if (type === "workspace_divergence") {
                handleSelectWorkspaceDivergence(item as import("../entities").WorkspaceDivergence);
              } else {
                setSidebarMode("projects");
                setActiveSessionId((item as TerminalSession).id);
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
