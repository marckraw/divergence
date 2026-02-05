import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { AnimatePresence } from "framer-motion";
import Sidebar from "./components/Sidebar";
import MainArea from "./components/MainArea";
import QuickSwitcher from "./components/QuickSwitcher";
import Settings from "./components/Settings";
import MergeNotification from "./components/MergeNotification";
import { useProjects, useAllDivergences } from "./hooks/useDatabase";
import { useMergeDetection } from "./hooks/useMergeDetection";
import { useProjectSettingsMap } from "./hooks/useProjectSettingsMap";
import { useAppSettings } from "./hooks/useAppSettings";
import { useUpdater } from "./hooks/useUpdater";
import type { Project, Divergence, TerminalSession, SplitOrientation } from "./types";
import { DEFAULT_USE_TMUX, DEFAULT_USE_WEBGL } from "./lib/projectSettings";
import { buildTmuxSessionName, buildLegacyTmuxSessionName, buildSplitTmuxSessionName } from "./lib/tmux";
import { notifyCommandFinished } from "./lib/notifications";

interface MergeNotificationData {
  divergence: Divergence;
  projectName: string;
}

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
  const sessionsRef = useRef<Map<string, TerminalSession>>(sessions);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const statusBySessionRef = useRef<Map<string, TerminalSession["status"]>>(new Map());
  const busySinceRef = useRef<Map<string, number>>(new Map());
  const idleNotifyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastNotifiedAtRef = useRef<Map<string, number>>(new Map());

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
      if (!currentSession || currentSession.status !== "idle") {
        return;
      }

      const now = Date.now();
      const duration = now - startedAt;
      if (duration < NOTIFY_MIN_BUSY_MS) {
        return;
      }

      const lastNotifiedAt = lastNotifiedAtRef.current.get(sessionId) ?? 0;
      if (now - lastNotifiedAt < NOTIFY_COOLDOWN_MS) {
        return;
      }

      const isFocused = document.hasFocus();
      const activeId = activeSessionIdRef.current;
      if (isFocused && activeId === sessionId) {
        return;
      }

      const projectName = projectsById.get(currentSession.projectId)?.name ?? currentSession.name;
      const targetLabel = currentSession.type === "divergence"
        ? `${projectName} / ${currentSession.name}`
        : projectName;

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

    const projectId = type === "project" ? target.id : (target as Divergence).project_id;
    const useTmux = settingsByProjectId.get(projectId)?.useTmux ?? DEFAULT_USE_TMUX;
    const useWebgl = settingsByProjectId.get(projectId)?.useWebgl ?? DEFAULT_USE_WEBGL;
    const projectHistoryLimit = settingsByProjectId.get(projectId)?.tmuxHistoryLimit ?? null;
    const tmuxHistoryLimit = projectHistoryLimit ?? appSettings.tmuxHistoryLimit;
    const projectName = type === "project"
      ? (target as Project).name
      : projectsById.get(projectId)?.name ?? "project";
    const branchName = type === "divergence" ? (target as Divergence).branch : undefined;
    const tmuxSessionName = buildTmuxSessionName({
      type,
      projectName,
      projectId,
      divergenceId: type === "divergence" ? target.id : undefined,
      branch: branchName,
    });

    const session: TerminalSession = {
      id,
      type,
      targetId: target.id,
      projectId,
      name: target.name,
      path: target.path,
      useTmux,
      tmuxSessionName,
      tmuxHistoryLimit,
      useWebgl,
      status: "idle",
    };

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

  const handleRemoveProject = useCallback(async (id: number) => {
    await removeProject(id);
    // Close any sessions for this project
    const sessionsToClose = Array.from(sessions.entries())
      .filter(([, s]) => s.type === "project" && s.targetId === id)
      .map(([sessionId]) => sessionId);
    sessionsToClose.forEach(handleCloseSession);

    // Kill tmux sessions for this project and its divergences
    try {
      const projectSessionName = buildTmuxSessionName({
        type: "project",
        projectName: projectsById.get(id)?.name ?? "project",
        projectId: id,
      });
      await invoke("kill_tmux_session", { sessionName: projectSessionName });
      await invoke("kill_tmux_session", {
        sessionName: buildSplitTmuxSessionName(projectSessionName, "pane-2"),
      });
      await invoke("kill_tmux_session", {
        sessionName: buildLegacyTmuxSessionName(`project-${id}`),
      });
      const divergences = divergencesByProject.get(id) || [];
      for (const divergence of divergences) {
        const divergenceSessionName = buildTmuxSessionName({
          type: "divergence",
          projectName: projectsById.get(id)?.name ?? "project",
          projectId: id,
          divergenceId: divergence.id,
          branch: divergence.branch,
        });
        await invoke("kill_tmux_session", { sessionName: divergenceSessionName });
        await invoke("kill_tmux_session", {
          sessionName: buildSplitTmuxSessionName(divergenceSessionName, "pane-2"),
        });
        await invoke("kill_tmux_session", {
          sessionName: buildLegacyTmuxSessionName(`divergence-${divergence.id}`),
        });
      }
    } catch (err) {
      console.warn("Failed to kill tmux sessions:", err);
    }
  }, [removeProject, sessions, handleCloseSession, divergencesByProject, projectsById]);

  const handleDivergenceCreated = useCallback(() => {
    refreshDivergences();
  }, [refreshDivergences]);

  const handleDeleteDivergence = useCallback(async (id: number) => {
    // Close any sessions for this divergence
    const sessionsToClose = Array.from(sessions.entries())
      .filter(([, s]) => s.type === "divergence" && s.targetId === id)
      .map(([sessionId]) => sessionId);
    sessionsToClose.forEach(handleCloseSession);
    try {
      const db = await Database.load("sqlite:divergence.db");
      await db.execute("DELETE FROM divergences WHERE id = ?", [id]);
    } catch (err) {
      console.warn("Failed to delete divergence from database:", err);
    }
    await refreshDivergences();
  }, [sessions, handleCloseSession, refreshDivergences]);

  const resolveProjectForNewDivergence = useCallback((): Project | null => {
    if (activeSessionId) {
      const session = sessions.get(activeSessionId);
      if (session) {
        const project = projects.find((item) => item.id === session.projectId);
        if (project) {
          return project;
        }
      }
    }

    if (projects.length === 1) {
      return projects[0];
    }

    return null;
  }, [activeSessionId, sessions, projects]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.defaultPrevented) {
      return;
    }
    if (e.target instanceof HTMLElement) {
      const editorHost = e.target.closest("[data-editor-root='true'], .cm-editor");
      if (editorHost) {
        return;
      }
    }
    const isMeta = e.metaKey || e.ctrlKey;

    // Quick Switcher - Cmd+K
    if (isMeta && e.key === "k") {
      e.preventDefault();
      setShowQuickSwitcher(prev => !prev);
      return;
    }

    // File Quick Switcher - Cmd+Shift+O
    if (isMeta && e.shiftKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      if (activeSessionId) {
        setShowFileQuickSwitcher(prev => !prev);
      }
      return;
    }

    // Settings - Cmd+,
    if (isMeta && e.key === ",") {
      e.preventDefault();
      setShowSettings(prev => !prev);
      return;
    }

    // Toggle sidebar - Cmd+B
    if (isMeta && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    // Close modal on Escape
    if (e.key === "Escape") {
      setShowQuickSwitcher(false);
      setShowFileQuickSwitcher(false);
      setShowSettings(false);
      return;
    }

    // Close current session - Cmd+W
    if (isMeta && e.key === "w") {
      e.preventDefault();
      if (activeSessionId) {
        handleCloseSession(activeSessionId);
      }
      return;
    }

    // New divergence - Cmd+T
    if (isMeta && e.key.toLowerCase() === "t") {
      e.preventDefault();
      if (createDivergenceFor) {
        return;
      }
      const project = resolveProjectForNewDivergence();
      if (project) {
        setShowQuickSwitcher(false);
        setShowSettings(false);
        setCreateDivergenceFor(project);
      }
      return;
    }

    // Split terminal - Cmd+D (vertical) / Cmd+Shift+D (horizontal)
    if (isMeta && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (activeSessionId) {
        const orientation: SplitOrientation = e.shiftKey ? "horizontal" : "vertical";
        handleSplitSession(activeSessionId, orientation);
      }
      return;
    }

    // Reconnect terminal - Cmd+Shift+R
    if (isMeta && e.shiftKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      if (activeSessionId) {
        handleReconnectSession(activeSessionId);
      }
      return;
    }

    // Switch tabs - Cmd+1-9
    if (isMeta && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      const sessionIds = Array.from(sessions.keys());
      if (index < sessionIds.length) {
        setActiveSessionId(sessionIds[index]);
      }
      return;
    }

    // Previous tab - Cmd+[
    if (isMeta && e.key === "[") {
      e.preventDefault();
      const sessionIds = Array.from(sessions.keys());
      if (activeSessionId && sessionIds.length > 1) {
        const currentIndex = sessionIds.indexOf(activeSessionId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : sessionIds.length - 1;
        setActiveSessionId(sessionIds[prevIndex]);
      }
      return;
    }

    // Next tab - Cmd+]
    if (isMeta && e.key === "]") {
      e.preventDefault();
      const sessionIds = Array.from(sessions.keys());
      if (activeSessionId && sessionIds.length > 1) {
        const currentIndex = sessionIds.indexOf(activeSessionId);
        const nextIndex = currentIndex < sessionIds.length - 1 ? currentIndex + 1 : 0;
        setActiveSessionId(sessionIds[nextIndex]);
      }
      return;
    }
  }, [
    sessions,
    activeSessionId,
    createDivergenceFor,
    resolveProjectForNewDivergence,
    handleCloseSession,
    handleSplitSession,
    handleReconnectSession,
    toggleSidebar,
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
          onDivergenceCreated={handleDivergenceCreated}
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
            onDeleted={() => {
              handleDeleteDivergence(mergeNotification.divergence.id);
              setMergeNotification(null);
            }}
          />
        )}
      </AnimatePresence>

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
