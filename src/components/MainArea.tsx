import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import Terminal from "./Terminal";
import ProjectSettingsPanel from "./ProjectSettingsPanel";
import FileExplorer from "./FileExplorer";
import ChangesPanel from "./ChangesPanel";
import TmuxPanel from "./TmuxPanel";
import QuickEditDrawer from "./QuickEditDrawer";
import type { TerminalSession, SplitOrientation, Project, Divergence, GitChangeEntry, ChangesMode } from "../types";
import type { ProjectSettings } from "../lib/projectSettings";
import { buildSplitTmuxSessionName } from "../lib/tmux";
import type { EditorThemeId } from "../lib/editorThemes";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FAST_EASE_OUT, SOFT_SPRING, getContentSwapVariants } from "../lib/motion";

interface MainAreaProps {
  projects: Project[];
  sessions: Map<string, TerminalSession>;
  activeSession: TerminalSession | null;
  onCloseSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  onRendererChange: (sessionId: string, renderer: "webgl" | "canvas") => void;
  onProjectSettingsSaved: (settings: ProjectSettings) => void;
  splitBySessionId: Map<string, { orientation: SplitOrientation }>;
  onSplitSession: (sessionId: string, orientation: SplitOrientation) => void;
  onResetSplitSession: (sessionId: string) => void;
  selectToCopy: boolean;
  reconnectBySessionId: Map<string, number>;
  onReconnectSession: (sessionId: string) => void;
  globalTmuxHistoryLimit: number;
  editorTheme: EditorThemeId;
  divergencesByProject: Map<number, Divergence[]>;
  projectsLoading: boolean;
  divergencesLoading: boolean;
}

function MainArea({
  projects,
  sessions,
  activeSession,
  onCloseSession,
  onSelectSession,
  onStatusChange,
  onRendererChange,
  onProjectSettingsSaved,
  splitBySessionId,
  onSplitSession,
  onResetSplitSession,
  selectToCopy,
  reconnectBySessionId,
  onReconnectSession,
  globalTmuxHistoryLimit,
  editorTheme,
  divergencesByProject,
  projectsLoading,
  divergencesLoading,
}: MainAreaProps) {
  const sessionList = Array.from(sessions.values());
  const paneStatusRef = useRef<
    Map<string, { pane1: TerminalSession["status"]; pane2: TerminalSession["status"] }>
  >(new Map());
  const shouldReduceMotion = useReducedMotion();
  const tabTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const panelVariants = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 240, damping: 28, mass: 0.9 };
  const activeProject = activeSession
    ? projects.find(project => project.id === activeSession.projectId) ?? null
    : null;
  const activeSplit = activeSession ? splitBySessionId.get(activeSession.id) ?? null : null;
  const activeRootPath = activeSession?.path ?? null;
  const [rightPanelTab, setRightPanelTab] = useState<"settings" | "files" | "changes" | "tmux">("settings");
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [openFileContent, setOpenFileContent] = useState("");
  const [openFileInitial, setOpenFileInitial] = useState("");
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null);
  const [openDiff, setOpenDiff] = useState<{ text: string; isBinary: boolean } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"diff" | "edit">("edit");
  const [allowEdit, setAllowEdit] = useState(true);
  const [changesMode, setChangesMode] = useState<ChangesMode>("working");

  const isDrawerOpen = Boolean(openFilePath);
  const isDirty = openFileContent !== openFileInitial;

  useEffect(() => {
    setOpenFilePath(null);
    setOpenFileContent("");
    setOpenFileInitial("");
    setFileLoadError(null);
    setFileSaveError(null);
    setIsLoadingFile(false);
    setIsSavingFile(false);
    setIsReadOnly(false);
    setLargeFileWarning(null);
    setOpenDiff(null);
    setDiffLoading(false);
    setDiffError(null);
    setDrawerTab("edit");
    setAllowEdit(true);
  }, [activeSession?.id]);

  const joinPath = useCallback((parent: string, child: string) => {
    if (child.startsWith("/") || child.startsWith("\\")) {
      return child;
    }
    if (parent.endsWith("/") || parent.endsWith("\\")) {
      return `${parent}${child}`;
    }
    const separator = parent.includes("\\") ? "\\" : "/";
    return `${parent}${separator}${child}`;
  }, []);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }, []);

  const handleOpenFile = useCallback(async (
    path: string,
    options?: { resetDiff?: boolean }
  ) => {
    const resetDiff = options?.resetDiff ?? true;
    if (resetDiff) {
      setOpenDiff(null);
      setDiffLoading(false);
      setDiffError(null);
      setDrawerTab("edit");
      setAllowEdit(true);
    }
    setOpenFilePath(path);
    setOpenFileContent("");
    setOpenFileInitial("");
    setFileLoadError(null);
    setFileSaveError(null);
    setIsReadOnly(false);
    setLargeFileWarning(null);
    setIsLoadingFile(true);

    try {
      const content = await readTextFile(path);
      setOpenFileContent(content);
      setOpenFileInitial(content);

      if (content.includes("\0")) {
        setIsReadOnly(true);
      }

      const contentBytes = content.length;
      if (contentBytes > 2_000_000) {
        setLargeFileWarning(
          `Large file (${formatBytes(contentBytes)}). Editing may be slow.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read file.";
      setFileLoadError(message);
    } finally {
      setIsLoadingFile(false);
    }
  }, [formatBytes]);

  const handleOpenChange = useCallback(async (entry: GitChangeEntry) => {
    if (!activeRootPath) {
      return;
    }

    const absolutePath = joinPath(activeRootPath, entry.path);
    const isDeleted = entry.status === "D";

    setDrawerTab("diff");
    setAllowEdit(!isDeleted && changesMode === "working");
    setOpenDiff(null);
    setDiffLoading(true);
    setDiffError(null);

    if (isDeleted || changesMode === "branch") {
      if (isDeleted) {
        setOpenFilePath(absolutePath);
        setOpenFileContent("");
        setOpenFileInitial("");
        setFileLoadError(null);
        setFileSaveError(null);
        setIsReadOnly(true);
        setLargeFileWarning(null);
        setIsLoadingFile(false);
      } else {
        await handleOpenFile(absolutePath, { resetDiff: false });
      }
    } else {
      await handleOpenFile(absolutePath, { resetDiff: false });
    }

    try {
      if (changesMode === "branch") {
        const diff = await invoke<{ diff: string; isBinary: boolean }>("get_branch_diff", {
          path: activeRootPath,
          filePath: absolutePath,
        });
        setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
      } else {
        const diff = await invoke<{ diff: string; isBinary: boolean }>("get_git_diff", {
          path: activeRootPath,
          filePath: absolutePath,
          mode: "working",
        });
        setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
      }
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : "Failed to load diff.");
    } finally {
      setDiffLoading(false);
    }
  }, [activeRootPath, handleOpenFile, joinPath, changesMode]);

  const handleCloseDrawer = useCallback(() => {
    if (isDirty) {
      const confirmClose = window.confirm("Discard unsaved changes?");
      if (!confirmClose) {
        return;
      }
    }
    setOpenFilePath(null);
    setOpenFileContent("");
    setOpenFileInitial("");
    setFileLoadError(null);
    setFileSaveError(null);
    setIsReadOnly(false);
    setLargeFileWarning(null);
    setOpenDiff(null);
    setDiffLoading(false);
    setDiffError(null);
    setDrawerTab("edit");
    setAllowEdit(true);
  }, [isDirty]);

  const handleSaveFile = useCallback(async () => {
    if (!openFilePath || isReadOnly || isSavingFile) {
      return;
    }
    setIsSavingFile(true);
    setFileSaveError(null);
    try {
      await writeTextFile(openFilePath, openFileContent);
      setOpenFileInitial(openFileContent);
      if (openDiff && activeRootPath) {
        setDiffLoading(true);
        setDiffError(null);
        try {
          const diff = await invoke<{ diff: string; isBinary: boolean }>("get_git_diff", {
            path: activeRootPath,
            filePath: openFilePath,
            mode: "working",
          });
          setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
        } catch (err) {
          setDiffError(err instanceof Error ? err.message : "Failed to refresh diff.");
          console.warn("Failed to refresh diff:", err);
        } finally {
          setDiffLoading(false);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save file.";
      setFileSaveError(message);
    } finally {
      setIsSavingFile(false);
    }
  }, [isReadOnly, isSavingFile, openFileContent, openFilePath, openDiff, activeRootPath]);

  const handleChangeContent = useCallback((next: string) => {
    setOpenFileContent(next);
    if (fileSaveError) {
      setFileSaveError(null);
    }
  }, [fileSaveError]);

  const handleStatusChange = useCallback(
    (sessionId: string) => (status: TerminalSession["status"]) => {
      onStatusChange(sessionId, status);
    },
    [onStatusChange]
  );

  const getAggregatedStatus = useCallback((entry: { pane1: TerminalSession["status"]; pane2: TerminalSession["status"] }) => {
    if (entry.pane1 === "busy" || entry.pane2 === "busy") {
      return "busy";
    }
    if (entry.pane1 === "active" || entry.pane2 === "active") {
      return "active";
    }
    return "idle";
  }, []);

  const handleSplitStatusChange = useCallback(
    (sessionId: string, paneIndex: 0 | 1) => (status: TerminalSession["status"]) => {
      const existing = paneStatusRef.current.get(sessionId) ?? { pane1: "idle", pane2: "idle" };
      const next = { ...existing, [paneIndex === 0 ? "pane1" : "pane2"]: status };
      paneStatusRef.current.set(sessionId, next);
      onStatusChange(sessionId, getAggregatedStatus(next));
    },
    [getAggregatedStatus, onStatusChange]
  );

  const handleRendererChange = useCallback(
    (sessionId: string) => (renderer: "webgl" | "canvas") => {
      onRendererChange(sessionId, renderer);
    },
    [onRendererChange]
  );

  const renderSession = useCallback((session: TerminalSession) => {
    const splitState = splitBySessionId.get(session.id) ?? null;
    const isSplit = Boolean(splitState);
    const orientation: SplitOrientation = splitState?.orientation ?? "vertical";
    const layoutClass = orientation === "vertical" ? "flex-row" : "flex-col";
    const dividerClass = orientation === "vertical" ? "border-r border-surface" : "border-b border-surface";
    const effectiveUseWebgl = false;
    const reconnectToken = reconnectBySessionId.get(session.id) ?? 0;
    const paneTwoTmuxName = session.useTmux
      ? buildSplitTmuxSessionName(session.tmuxSessionName, "pane-2")
      : session.tmuxSessionName;

    return (
      <div className={`flex h-full w-full ${layoutClass}`}>
        <div className={`flex-1 relative overflow-hidden min-w-0 min-h-0 ${isSplit ? dividerClass : ""}`}>
          <Terminal
            key={`${session.id}-${effectiveUseWebgl ? "webgl" : "canvas"}-${reconnectToken}`}
            cwd={session.path}
            sessionId={session.id}
            useTmux={session.useTmux}
            tmuxSessionName={session.tmuxSessionName}
            tmuxHistoryLimit={session.tmuxHistoryLimit}
            useWebgl={effectiveUseWebgl}
            selectToCopy={selectToCopy}
            onRendererChange={handleRendererChange(session.id)}
            onStatusChange={isSplit ? handleSplitStatusChange(session.id, 0) : handleStatusChange(session.id)}
            onClose={() => onCloseSession(session.id)}
          />
        </div>
        {isSplit && (
          <div className="flex-1 relative overflow-hidden min-w-0 min-h-0">
            <Terminal
              key={`${session.id}-pane-2-${effectiveUseWebgl ? "webgl" : "canvas"}-${reconnectToken}`}
              cwd={session.path}
              sessionId={`${session.id}-pane-2`}
              useTmux={session.useTmux}
              tmuxSessionName={paneTwoTmuxName}
              tmuxHistoryLimit={session.tmuxHistoryLimit}
              useWebgl={effectiveUseWebgl}
              selectToCopy={selectToCopy}
              onRendererChange={handleRendererChange(session.id)}
              onStatusChange={handleSplitStatusChange(session.id, 1)}
              onClose={() => onCloseSession(session.id)}
            />
          </div>
        )}
      </div>
    );
  }, [
    handleRendererChange,
    handleSplitStatusChange,
    handleStatusChange,
    onCloseSession,
    reconnectBySessionId,
    selectToCopy,
    splitBySessionId,
  ]);

  return (
    <main className="flex-1 min-w-0 h-full bg-main flex flex-col relative">
      {/* Tab bar */}
      <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
          {sessionList.length === 0 ? (
            <span className="text-xs text-subtext">No terminal open</span>
          ) : (
            sessionList.map((session, index) => (
              <motion.div
                key={session.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                  session.id === activeSession?.id
                    ? "bg-main text-text"
                    : "text-subtext hover:text-text hover:bg-surface/50"
                }`}
                onClick={() => onSelectSession(session.id)}
                layout={shouldReduceMotion ? undefined : "position"}
                transition={tabTransition}
              >
                {/* Tab number */}
                <span className="text-xs text-subtext">{index + 1}</span>

                {/* Status dot */}
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    session.status === "busy"
                      ? "bg-yellow animate-pulse"
                      : session.status === "active"
                      ? "bg-accent"
                      : "bg-subtext/50"
                  }`}
                />

                {/* Session type icon */}
                {session.type === "divergence" ? (
                  <svg
                    className="w-3 h-3 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                )}

                {/* Name */}
                <span className="truncate max-w-32">{session.name}</span>

                {/* tmux badge */}
                {session.useTmux && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface text-subtext">
                    tmux
                  </span>
                )}

                {session.rendererType && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface text-subtext">
                    {session.rendererType}
                  </span>
                )}

                {/* Close button */}
                <button
                  className="w-4 h-4 flex items-center justify-center text-subtext hover:text-red rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(session.id);
                  }}
                >
                  <svg
                    className="w-3 h-3"
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
                </button>
              </motion.div>
            ))
          )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <button
            className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40 transition-colors"
            onClick={() => activeSession && onSplitSession(activeSession.id, "vertical")}
            disabled={!activeSession}
            title="Split side-by-side (Cmd+D)"
          >
            Split V
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40 transition-colors"
            onClick={() => activeSession && onSplitSession(activeSession.id, "horizontal")}
            disabled={!activeSession}
            title="Split top/bottom (Cmd+Shift+D)"
          >
            Split H
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40 transition-colors"
            onClick={() => activeSession && onResetSplitSession(activeSession.id)}
            disabled={!activeSession || !activeSplit}
            title="Close split"
          >
            Single
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40 transition-colors"
            onClick={() => activeSession && onReconnectSession(activeSession.id)}
            disabled={!activeSession}
            title="Reconnect tmux session (Cmd+Shift+R)"
          >
            Reconnect
          </button>
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {activeSession ? (
          <div className="flex h-full w-full min-h-0">
            <div className="flex-1 relative overflow-hidden min-h-0">
              {renderSession(activeSession)}
            </div>
            <div className="w-96 border-l border-surface bg-sidebar flex flex-col">
              <div className="flex items-center border-b border-surface">
                <button
                  type="button"
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanelTab === "settings"
                      ? "text-text border-b-2 border-accent"
                      : "text-subtext hover:text-text"
                  }`}
                  onClick={() => setRightPanelTab("settings")}
                >
                  Settings
                </button>
                <button
                  type="button"
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanelTab === "files"
                      ? "text-text border-b-2 border-accent"
                      : "text-subtext hover:text-text"
                  }`}
                  onClick={() => setRightPanelTab("files")}
                >
                  Files
                </button>
                <button
                  type="button"
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanelTab === "changes"
                      ? "text-text border-b-2 border-accent"
                      : "text-subtext hover:text-text"
                  }`}
                  onClick={() => setRightPanelTab("changes")}
                >
                  Changes
                </button>
                <button
                  type="button"
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanelTab === "tmux"
                      ? "text-text border-b-2 border-accent"
                      : "text-subtext hover:text-text"
                  }`}
                  onClick={() => setRightPanelTab("tmux")}
                >
                  Tmux
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  {rightPanelTab === "settings" ? (
                    <motion.div
                      key="settings"
                      className="h-full"
                      variants={panelVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={panelTransition}
                    >
                      <ProjectSettingsPanel
                        project={activeProject}
                        globalTmuxHistoryLimit={globalTmuxHistoryLimit}
                        onSaved={onProjectSettingsSaved}
                        contextPath={activeRootPath}
                        contextLabel={activeSession.type === "divergence" ? "Divergence" : "Project"}
                      />
                    </motion.div>
                  ) : rightPanelTab === "files" ? (
                    <motion.div
                      key="files"
                      className="h-full"
                      variants={panelVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={panelTransition}
                    >
                      <FileExplorer
                        rootPath={activeRootPath}
                        activeFilePath={openFilePath}
                        onOpenFile={handleOpenFile}
                      />
                    </motion.div>
                  ) : rightPanelTab === "changes" ? (
                    <motion.div
                      key="changes"
                      className="h-full"
                      variants={panelVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={panelTransition}
                    >
                      <ChangesPanel
                        rootPath={activeRootPath}
                        activeFilePath={openFilePath}
                        mode={changesMode}
                        onModeChange={setChangesMode}
                        onOpenChange={handleOpenChange}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="tmux"
                      className="h-full"
                      variants={panelVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={panelTransition}
                    >
                      <TmuxPanel
                        projects={projects}
                        divergencesByProject={divergencesByProject}
                        projectsLoading={projectsLoading}
                        divergencesLoading={divergencesLoading}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 h-full flex items-center justify-center">
            <div className="text-center text-subtext">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg">Select a project to start</p>
              <p className="text-sm mt-2">
                Each project gets its own terminal running Claude Code
              </p>
              <p className="text-xs mt-4 text-subtext/70">
                Press <kbd className="px-1.5 py-0.5 bg-surface rounded text-xs">⌘K</kbd> to quick switch
              </p>
            </div>
          </div>
        )}
      </div>
      <QuickEditDrawer
        isOpen={isDrawerOpen}
        filePath={openFilePath}
        projectRootPath={activeRootPath}
        content={openFileContent}
        editorTheme={editorTheme}
        diff={openDiff}
        diffLoading={diffLoading}
        diffError={diffError}
        defaultTab={drawerTab}
        allowEdit={allowEdit}
        isDirty={isDirty}
        isSaving={isSavingFile}
        isLoading={isLoadingFile}
        isReadOnly={isReadOnly}
        loadError={fileLoadError}
        saveError={fileSaveError}
        largeFileWarning={largeFileWarning}
        onChange={handleChangeContent}
        onSave={handleSaveFile}
        onClose={handleCloseDrawer}
      />
    </main>
  );
}

export default MainArea;
