import { useCallback, useEffect, useRef, useState } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import Terminal from "./Terminal.container";
import MainAreaPresentational from "./MainArea.presentational";
import type { MainAreaOpenDiff, MainAreaProps, RightPanelTab } from "./MainArea.types";
import type {
  ChangesMode,
  GitChangeEntry,
  SplitOrientation,
  TerminalSession,
} from "../../../entities";
import { buildSplitTmuxSessionName } from "../../../lib/tmux";
import {
  formatBytes,
  getAggregatedTerminalStatus,
  joinSessionPath,
} from "../../../lib/utils/mainArea";
import {
  getBranchDiff,
  getWorkingDiff,
} from "../api/mainArea.api";

function MainAreaContainer({
  projects,
  sessions,
  activeSession,
  onCloseSession,
  onSelectSession,
  onStatusChange,
  onRendererChange,
  splitBySessionId,
  reconnectBySessionId,
  ...props
}: MainAreaProps) {
  const sessionList = Array.from(sessions.values());
  const paneStatusRef = useRef<
    Map<string, { pane1: TerminalSession["status"]; pane2: TerminalSession["status"] }>
  >(new Map());
  const activeProject = activeSession
    ? projects.find((project) => project.id === activeSession.projectId) ?? null
    : null;
  const activeSplit = activeSession ? splitBySessionId.get(activeSession.id) ?? null : null;
  const activeRootPath = activeSession?.path ?? null;
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("settings");
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [openFileContent, setOpenFileContent] = useState("");
  const [openFileInitial, setOpenFileInitial] = useState("");
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null);
  const [openDiff, setOpenDiff] = useState<MainAreaOpenDiff | null>(null);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read file.";
      setFileLoadError(message);
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const handleOpenChange = useCallback(async (entry: GitChangeEntry) => {
    if (!activeRootPath) {
      return;
    }

    const absolutePath = joinSessionPath(activeRootPath, entry.path);
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
        const diff = await getBranchDiff(activeRootPath, absolutePath);
        setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
      } else {
        const diff = await getWorkingDiff(activeRootPath, absolutePath);
        setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
      }
    } catch (error) {
      setDiffError(error instanceof Error ? error.message : "Failed to load diff.");
    } finally {
      setDiffLoading(false);
    }
  }, [activeRootPath, changesMode, handleOpenFile]);

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
          const diff = await getWorkingDiff(activeRootPath, openFilePath);
          setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
        } catch (error) {
          setDiffError(error instanceof Error ? error.message : "Failed to refresh diff.");
          console.warn("Failed to refresh diff:", error);
        } finally {
          setDiffLoading(false);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save file.";
      setFileSaveError(message);
    } finally {
      setIsSavingFile(false);
    }
  }, [activeRootPath, isReadOnly, isSavingFile, openDiff, openFileContent, openFilePath]);

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

  const handleSplitStatusChange = useCallback(
    (sessionId: string, paneIndex: 0 | 1) => (status: TerminalSession["status"]) => {
      const existing = paneStatusRef.current.get(sessionId) ?? { pane1: "idle", pane2: "idle" };
      const next = { ...existing, [paneIndex === 0 ? "pane1" : "pane2"]: status };
      paneStatusRef.current.set(sessionId, next);
      onStatusChange(sessionId, getAggregatedTerminalStatus(next));
    },
    [onStatusChange]
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
    splitBySessionId,
  ]);

  return (
    <MainAreaPresentational
      {...props}
      projects={projects}
      sessions={sessions}
      activeSession={activeSession}
      onCloseSession={onCloseSession}
      onSelectSession={onSelectSession}
      onStatusChange={onStatusChange}
      onRendererChange={onRendererChange}
      splitBySessionId={splitBySessionId}
      reconnectBySessionId={reconnectBySessionId}
      sessionList={sessionList}
      activeProject={activeProject}
      activeSplit={activeSplit}
      activeRootPath={activeRootPath}
      rightPanelTab={rightPanelTab}
      openFilePath={openFilePath}
      openFileContent={openFileContent}
      openDiff={openDiff}
      diffLoading={diffLoading}
      diffError={diffError}
      drawerTab={drawerTab}
      allowEdit={allowEdit}
      isDrawerOpen={isDrawerOpen}
      isDirty={isDirty}
      isSavingFile={isSavingFile}
      isLoadingFile={isLoadingFile}
      isReadOnly={isReadOnly}
      fileLoadError={fileLoadError}
      fileSaveError={fileSaveError}
      largeFileWarning={largeFileWarning}
      changesMode={changesMode}
      onOpenFile={handleOpenFile}
      onOpenChange={handleOpenChange}
      onCloseDrawer={handleCloseDrawer}
      onSaveFile={handleSaveFile}
      onChangeFileContent={handleChangeContent}
      onRightPanelTabChange={setRightPanelTab}
      onChangesModeChange={setChangesMode}
      renderSession={renderSession}
    />
  );
}

export default MainAreaContainer;
