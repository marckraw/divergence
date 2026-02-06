import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Sidebar from "../widgets/sidebar";
import MainArea from "../widgets/main-area";
import QuickSwitcher from "../features/quick-switcher";
import Settings from "../widgets/settings-modal";
import { executeCreateDivergence } from "../features/create-divergence";
import { MergeNotification, useMergeDetection, type MergeNotificationData } from "../features/merge-detection";
import { executeDeleteDivergence } from "../features/delete-divergence";
import { executeRemoveProject } from "../features/remove-project";
import { TaskCenterDrawer, TaskToasts, useTaskCenter } from "../features/task-center";
import { useAllDivergences } from "../entities/divergence";
import { useProjectSettingsMap, useProjects } from "../entities/project";
import { useAppSettings } from "../shared/hooks/useAppSettings";
import { useUpdater } from "../shared/hooks/useUpdater";
import type { Project, Divergence, TerminalSession, SplitOrientation } from "../entities";
import { notifyCommandFinished } from "../shared/lib/notifications";
import { resolveProjectForNewDivergence } from "./lib/appSelection.pure";
import { buildTerminalSession } from "./lib/sessionBuilder.pure";
import {
  buildIdleNotificationTargetLabel,
  shouldNotifyIdle,
} from "./lib/idleNotification.pure";
import { resolveAppShortcut } from "./lib/appShortcuts.pure";

const NOTIFY_MIN_BUSY_MS = 5000;
const NOTIFY_IDLE_DELAY_MS = 1500;
const NOTIFY_COOLDOWN_MS = 3000;

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
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [splitBySessionId, setSplitBySessionId] = useState<Map<string, { orientation: SplitOrientation }>>(new Map());
  const [reconnectBySessionId, setReconnectBySessionId] = useState<Map<string, number>>(new Map());
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showFileQuickSwitcher, setShowFileQuickSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createDivergenceFor, setCreateDivergenceFor] = useState<Project | null>(null);
  const [mergeNotification, setMergeNotification] = useState<MergeNotificationData | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const sessionsRef = useRef<Map<string, TerminalSession>>(sessions);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const statusBySessionRef = useRef<Map<string, TerminalSession["status"]>>(new Map());
  const busySinceRef = useRef<Map<string, number>>(new Map());
  const idleNotifyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastNotifiedAtRef = useRef<Map<string, number>>(new Map());
  const {
    runningTasks,
    recentTasks,
    toasts,
    runningCount,
    isDrawerOpen,
    focusedTaskId,
    closeDrawer,
    toggleDrawer,
    dismissToast,
    viewTask,
    retryTask,
    runTask,
  } = useTaskCenter(2);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Build projects by ID map for merge detection
  const projectsById = useMemo(() => {
    const map = new Map<number, { name: string }>();
    projects.forEach(p => map.set(p.id, { name: p.name }));
    return map;
  }, [projects]);

  // Flatten divergences for merge detection
  const allDivergences = useMemo(() => {
    const all: Divergence[] = [];
    divergencesByProject.forEach(divs => all.push(...divs));
    return all;
  }, [divergencesByProject]);

  const clearIdleNotifyTimer = useCallback((sessionId: string) => {
    const existing = idleNotifyTimersRef.current.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      idleNotifyTimersRef.current.delete(sessionId);
    }
  }, []);

  const clearNotificationTracking = useCallback((sessionId: string) => {
    clearIdleNotifyTimer(sessionId);
    busySinceRef.current.delete(sessionId);
    statusBySessionRef.current.delete(sessionId);
    lastNotifiedAtRef.current.delete(sessionId);
  }, [clearIdleNotifyTimer]);

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
  }, [clearIdleNotifyTimer, projectsById]);

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

  const createSession = useCallback((
    type: "project" | "divergence",
    target: Project | Divergence
  ): TerminalSession => {
    const id = `${type}-${target.id}`;
    const existing = sessions.get(id);
    if (existing) {
      return existing;
    }

    const session = buildTerminalSession({
      type,
      target,
      settingsByProjectId,
      projectsById,
      globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
    });

    setSessions(prev => new Map(prev).set(id, session));
    return session;
  }, [sessions, settingsByProjectId, projectsById, appSettings.tmuxHistoryLimit]);

  const handleSelectProject = useCallback((project: Project) => {
    const session = createSession("project", project);
    setActiveSessionId(session.id);
  }, [createSession]);

  const handleSelectDivergence = useCallback((divergence: Divergence) => {
    const session = createSession("divergence", divergence);
    setActiveSessionId(session.id);
  }, [createSession]);

  const handleCloseSession = useCallback((sessionId: string) => {
    clearNotificationTracking(sessionId);
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
    if (activeSessionId === sessionId) {
      const remainingSessions = Array.from(sessions.keys()).filter(id => id !== sessionId);
      setActiveSessionId(remainingSessions[0] || null);
    }
  }, [activeSessionId, sessions, clearNotificationTracking]);

  const handleSplitSession = useCallback((sessionId: string, orientation: SplitOrientation) => {
    setSplitBySessionId(prev => {
      const next = new Map(prev);
      next.set(sessionId, { orientation });
      return next;
    });
  }, []);

  const handleResetSplitSession = useCallback((sessionId: string) => {
    setSplitBySessionId(prev => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const handleReconnectSession = useCallback((sessionId: string) => {
    setReconnectBySessionId(prev => {
      const next = new Map(prev);
      const current = next.get(sessionId) ?? 0;
      next.set(sessionId, current + 1);
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setIsRightPanelOpen(prev => !prev);
  }, []);

  const handleSessionStatusChange = useCallback((sessionId: string, status: TerminalSession["status"]) => {
    const previousStatus = statusBySessionRef.current.get(sessionId) ?? "idle";
    statusBySessionRef.current.set(sessionId, status);

    if (status === "busy") {
      busySinceRef.current.set(sessionId, Date.now());
      clearIdleNotifyTimer(sessionId);
    } else if (status === "active") {
      clearIdleNotifyTimer(sessionId);
    } else if (status === "idle" && previousStatus !== "idle") {
      const startedAt = busySinceRef.current.get(sessionId);
      if (startedAt) {
        scheduleIdleNotification(sessionId, startedAt);
      }
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
  }, [clearIdleNotifyTimer, scheduleIdleNotification]);

  const handleSessionRendererChange = useCallback((sessionId: string, renderer: "webgl" | "canvas") => {
    setSessions(prev => {
      const newSessions = new Map(prev);
      const session = newSessions.get(sessionId);
      if (session) {
        if (session.rendererType === renderer) {
          return prev;
        }
        newSessions.set(sessionId, { ...session, rendererType: renderer });
      }
      return newSessions;
    });
  }, []);

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

  const handleAddProject = useCallback(async (name: string, path: string) => {
    await addProject(name, path);
  }, [addProject]);

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

  const handleCreateDivergence = useCallback(async (
    project: Project,
    branchName: string,
    useExistingBranch: boolean
  ): Promise<Divergence> => {
    return executeCreateDivergence({
      project,
      branchName,
      useExistingBranch,
      runTask,
      refreshDivergences,
    });
  }, [refreshDivergences, runTask]);

  const handleDeleteDivergence = useCallback(async (
    divergence: Divergence,
    origin: string
  ): Promise<void> => {
    const projectName = projectsById.get(divergence.project_id)?.name ?? "project";
    await executeDeleteDivergence({
      divergence,
      origin,
      projectName,
      runTask,
      closeSessionsForDivergence,
      refreshDivergences,
    });
  }, [closeSessionsForDivergence, projectsById, refreshDivergences, runTask]);

  const handleRemoveProject = useCallback(async (id: number): Promise<void> => {
    const projectName = projectsById.get(id)?.name ?? "project";
    const divergences = divergencesByProject.get(id) ?? [];

    await executeRemoveProject({
      projectId: id,
      projectName,
      divergences,
      runTask,
      removeProject,
      closeSessionsForProject,
      refreshDivergences,
    });
  }, [
    closeSessionsForProject,
    divergencesByProject,
    projectsById,
    refreshDivergences,
    removeProject,
    runTask,
  ]);

  const resolveProjectForNewDivergenceCallback = useCallback((): Project | null => {
    return resolveProjectForNewDivergence({
      activeSessionId,
      sessions,
      projects,
    });
  }, [activeSessionId, sessions, projects]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isFromEditor = e.target instanceof HTMLElement
      ? Boolean(e.target.closest("[data-editor-root='true'], .cm-editor"))
      : false;
    const action = resolveAppShortcut(e, {
      isFromEditor,
      hasActiveSession: Boolean(activeSessionId),
      activeSessionId,
      sessionCount: sessions.size,
      hasCreateDivergenceModalOpen: Boolean(createDivergenceFor),
      canResolveProjectForNewDivergence: Boolean(resolveProjectForNewDivergenceCallback()),
    });
    if (!action) {
      return;
    }

    e.preventDefault();
    const sessionIds = Array.from(sessions.keys());

    switch (action.type) {
      case "toggle_quick_switcher":
        setShowQuickSwitcher(prev => !prev);
        return;
      case "toggle_file_quick_switcher":
        setShowFileQuickSwitcher(prev => !prev);
        return;
      case "toggle_settings":
        setShowSettings(prev => !prev);
        return;
      case "toggle_right_panel":
        toggleRightPanel();
        return;
      case "toggle_sidebar":
        toggleSidebar();
        return;
      case "close_overlays":
        setShowQuickSwitcher(false);
        setShowFileQuickSwitcher(false);
        setShowSettings(false);
        return;
      case "close_active_session":
        if (activeSessionId) {
          handleCloseSession(activeSessionId);
        }
        return;
      case "new_divergence": {
        const project = resolveProjectForNewDivergenceCallback();
        if (project) {
          setShowQuickSwitcher(false);
          setShowSettings(false);
          setCreateDivergenceFor(project);
        }
        return;
      }
      case "split_terminal":
        if (activeSessionId) {
          handleSplitSession(activeSessionId, action.orientation);
        }
        return;
      case "reconnect_terminal":
        if (activeSessionId) {
          handleReconnectSession(activeSessionId);
        }
        return;
      case "select_tab":
        if (action.index < sessionIds.length) {
          setActiveSessionId(sessionIds[action.index]);
        }
        return;
      case "select_previous_tab":
        if (activeSessionId && sessionIds.length > 1) {
          const currentIndex = sessionIds.indexOf(activeSessionId);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : sessionIds.length - 1;
          setActiveSessionId(sessionIds[prevIndex]);
        }
        return;
      case "select_next_tab":
        if (activeSessionId && sessionIds.length > 1) {
          const currentIndex = sessionIds.indexOf(activeSessionId);
          const nextIndex = currentIndex < sessionIds.length - 1 ? currentIndex + 1 : 0;
          setActiveSessionId(sessionIds[nextIndex]);
        }
        return;
      default:
        return;
    }
  }, [
    sessions,
    activeSessionId,
    createDivergenceFor,
    resolveProjectForNewDivergenceCallback,
    handleCloseSession,
    handleSplitSession,
    handleReconnectSession,
    toggleSidebar,
    toggleRightPanel,
  ]);

  // Set up keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const theme = appSettings.theme ?? "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [appSettings.theme]);

  const editorTheme =
    appSettings.theme === "light"
      ? appSettings.editorThemeForLightMode
      : appSettings.editorThemeForDarkMode;
  const activeSession = activeSessionId ? sessions.get(activeSessionId) ?? null : null;

  return (
    <div className="flex h-full w-full">
      <div
        className={`h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${
          isSidebarOpen ? "w-64" : "w-0"
        }`}
      >
        <Sidebar
          projects={projects}
          divergencesByProject={divergencesByProject}
          sessions={sessions}
          activeSessionId={activeSessionId}
          createDivergenceFor={createDivergenceFor}
          onCreateDivergenceForChange={setCreateDivergenceFor}
          onSelectProject={handleSelectProject}
          onSelectDivergence={handleSelectDivergence}
          onAddProject={handleAddProject}
          onRemoveProject={handleRemoveProject}
          onCreateDivergence={handleCreateDivergence}
          onDeleteDivergence={handleDeleteDivergence}
          isCollapsed={!isSidebarOpen}
        />
      </div>
      <MainArea
        projects={projects}
        sessions={sessions}
        activeSession={activeSession}
        onCloseSession={handleCloseSession}
        onSelectSession={setActiveSessionId}
        onStatusChange={handleSessionStatusChange}
        onRendererChange={handleSessionRendererChange}
        onProjectSettingsSaved={updateProjectSettings}
        splitBySessionId={splitBySessionId}
        onSplitSession={handleSplitSession}
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
        taskRunningCount={runningCount}
        onToggleTaskCenter={toggleDrawer}
      />

      {/* Quick Switcher */}
      <AnimatePresence>
        {showQuickSwitcher && (
          <QuickSwitcher
            projects={projects}
            divergencesByProject={divergencesByProject}
            onSelect={(type, item) => {
              if (type === "project") {
                handleSelectProject(item as Project);
              } else {
                handleSelectDivergence(item as Divergence);
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
          <Settings onClose={() => {
            setShowSettings(false);
          }} updater={updater} />
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

      <TaskToasts
        toasts={toasts}
        onDismiss={dismissToast}
        onViewTask={viewTask}
      />

      <TaskCenterDrawer
        isOpen={isDrawerOpen}
        runningCount={runningCount}
        runningTasks={runningTasks}
        recentTasks={recentTasks}
        focusedTaskId={focusedTaskId}
        onClose={closeDrawer}
        onRetryTask={retryTask}
      />

      {/* Update Banner */}
      {!bannerDismissed && (updater.status === "available" || updater.status === "downloading" || updater.status === "error") && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
          updater.status === "error" ? "bg-red-600" : "bg-blue-600"
        }`}>
          <div className="flex items-center gap-3">
            {updater.status === "available" && (
              <>
                <span>Update {updater.version} available</span>
                <button
                  onClick={updater.downloadAndInstall}
                  className="rounded bg-white px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Install & Restart
                </button>
              </>
            )}
            {updater.status === "downloading" && (
              <>
                <span>Downloading update... {updater.progress}%</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-blue-400">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${updater.progress}%` }}
                  />
                </div>
              </>
            )}
            {updater.status === "error" && (
              <span>{updater.error ?? "Update check failed"}</span>
            )}
            <button
              onClick={() => setBannerDismissed(true)}
              className="ml-1 rounded p-0.5 hover:bg-white/20"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
