import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import Sidebar from "./components/Sidebar";
import MainArea from "./components/MainArea";
import QuickSwitcher from "./components/QuickSwitcher";
import Settings from "./components/Settings";
import MergeNotification from "./components/MergeNotification";
import { useProjects, useAllDivergences } from "./hooks/useDatabase";
import { useMergeDetection } from "./hooks/useMergeDetection";
import { useProjectSettingsMap } from "./hooks/useProjectSettingsMap";
import type { Project, Divergence, TerminalSession, SplitOrientation } from "./types";
import { DEFAULT_USE_TMUX, DEFAULT_USE_WEBGL } from "./lib/projectSettings";
import { buildTmuxSessionName, buildLegacyTmuxSessionName, buildSplitTmuxSessionName } from "./lib/tmux";

interface MergeNotificationData {
  divergence: Divergence;
  projectName: string;
}

function App() {
  const { projects, addProject, removeProject } = useProjects();
  const { divergencesByProject, refresh: refreshDivergences } = useAllDivergences();
  const { settingsByProjectId, updateProjectSettings } = useProjectSettingsMap(projects);
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [splitBySessionId, setSplitBySessionId] = useState<Map<string, { orientation: SplitOrientation }>>(new Map());
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mergeNotification, setMergeNotification] = useState<MergeNotificationData | null>(null);

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
      useWebgl,
      status: "idle",
    };

    setSessions(prev => new Map(prev).set(id, session));
    return session;
  }, [sessions, settingsByProjectId, projectsById]);

  const handleSelectProject = useCallback((project: Project) => {
    const session = createSession("project", project);
    setActiveSessionId(session.id);
  }, [createSession]);

  const handleSelectDivergence = useCallback((divergence: Divergence) => {
    const session = createSession("divergence", divergence);
    setActiveSessionId(session.id);
  }, [createSession]);

  const handleCloseSession = useCallback((sessionId: string) => {
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
    if (activeSessionId === sessionId) {
      const remainingSessions = Array.from(sessions.keys()).filter(id => id !== sessionId);
      setActiveSessionId(remainingSessions[0] || null);
    }
  }, [activeSessionId, sessions]);

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

  const handleSessionStatusChange = useCallback((sessionId: string, status: TerminalSession["status"]) => {
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
  }, []);

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

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;

    // Quick Switcher - Cmd+K
    if (isMeta && e.key === "k") {
      e.preventDefault();
      setShowQuickSwitcher(prev => !prev);
      return;
    }

    // Settings - Cmd+,
    if (isMeta && e.key === ",") {
      e.preventDefault();
      setShowSettings(prev => !prev);
      return;
    }

    // Close modal on Escape
    if (e.key === "Escape") {
      setShowQuickSwitcher(false);
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

    // Split terminal - Cmd+D (vertical) / Cmd+Shift+D (horizontal)
    if (isMeta && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (activeSessionId) {
        const orientation: SplitOrientation = e.shiftKey ? "horizontal" : "vertical";
        handleSplitSession(activeSessionId, orientation);
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
  }, [sessions, activeSessionId, handleCloseSession, handleSplitSession]);

  // Set up keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeSession = activeSessionId ? sessions.get(activeSessionId) ?? null : null;

  return (
    <div className="flex h-full w-full">
      <Sidebar
        projects={projects}
        divergencesByProject={divergencesByProject}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectProject={handleSelectProject}
        onSelectDivergence={handleSelectDivergence}
        onAddProject={handleAddProject}
        onRemoveProject={handleRemoveProject}
        onDivergenceCreated={handleDivergenceCreated}
        onDeleteDivergence={handleDeleteDivergence}
      />
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
      />

      {/* Quick Switcher */}
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

      {/* Settings */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}

      {/* Merge Notification */}
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
    </div>
  );
}

export default App;
