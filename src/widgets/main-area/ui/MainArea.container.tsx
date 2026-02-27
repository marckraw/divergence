import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Terminal from "./Terminal.container";
import MainAreaPresentational from "./MainArea.presentational";
import type { MainAreaOpenDiff, MainAreaProps, RightPanelTab } from "./MainArea.types";
import {
  buildEqualSplitPaneSizes,
  normalizeSplitPaneSizes,
  resizeSplitPaneSizes,
} from "../../../entities";
import type {
  ChangesMode,
  GitChangeEntry,
  SplitPaneId,
  SplitSessionState,
  TerminalSession,
} from "../../../entities";
import {
  clearPromptQueueItems,
  deletePromptQueueItem,
  enqueuePromptQueueItem,
  listPromptQueueItems,
  type PromptQueueItemRow,
} from "../../../entities/prompt-queue";
import { buildSplitTmuxSessionName } from "../../../entities/terminal-session";
import {
  createReviewBriefForDraft,
  useDiffReviewDraft,
  type DiffReviewAnchor,
  type DiffReviewComment,
} from "../../../features/diff-review";
import {
  formatBytes,
  getAggregatedTerminalStatus,
  joinSessionPath,
} from "../lib/mainArea.pure";
import { resolvePromptQueueScope } from "../lib/promptQueueScope.pure";
import { readTextFile, writeTextFile } from "../../../shared/api/fs.api";
import {
  getBranchDiff,
  getWorkingDiff,
} from "../api/mainArea.api";

const EMPTY_REVIEW_COMMENTS: DiffReviewComment[] = [];

function MainAreaContainer({
  projects,
  sessions,
  activeSession,
  onCloseSession,
  onSelectSession,
  onStatusChange,
  onRegisterTerminalCommand,
  onUnregisterTerminalCommand,
  onRunReviewAgentRequest,
  splitBySessionId,
  reconnectBySessionId,
  onFocusSplitPane,
  onResizeSplitPanes,
  onReconnectSession,
  onSendPromptToSession,
  ...props
}: MainAreaProps) {
  const sessionList = Array.from(sessions.values());
  const paneStatusRef = useRef<
    Map<string, Map<SplitPaneId, TerminalSession["status"]>>
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
  const [reviewRunError, setReviewRunError] = useState<string | null>(null);
  const [reviewRunning, setReviewRunning] = useState(false);
  const [isDraggingSplitPane, setIsDraggingSplitPane] = useState(false);
  const [queueItems, setQueueItems] = useState<PromptQueueItemRow[]>([]);
  const [queueDraft, setQueueDraft] = useState("");
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueingPrompt, setQueueingPrompt] = useState(false);
  const [queueActionItemId, setQueueActionItemId] = useState<number | null>(null);
  const [queueSendingItemId, setQueueSendingItemId] = useState<number | null>(null);
  const {
    activeDraft,
    addComment,
    removeComment,
    setFinalComment,
    setAgent,
    clearActiveDraft,
    clearAllDrafts,
  } = useDiffReviewDraft({ workspacePath: activeRootPath, mode: changesMode });

  const isDrawerOpen = Boolean(openFilePath);
  const isDirty = openFileContent !== openFileInitial;
  const reviewComments = activeDraft?.comments ?? EMPTY_REVIEW_COMMENTS;
  const reviewFinalComment = activeDraft?.finalComment ?? "";
  const reviewAgent = activeDraft?.agent ?? "claude";
  const openFileReviewComments = useMemo(() => {
    if (!openFilePath) {
      return [];
    }
    return reviewComments.filter((comment) => comment.anchor.filePath === openFilePath);
  }, [openFilePath, reviewComments]);
  const queueScope = useMemo(
    () => resolvePromptQueueScope(activeSession),
    [activeSession],
  );

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
    setReviewRunError(null);
    setReviewRunning(false);
    clearAllDrafts();
  }, [activeSession?.id, clearAllDrafts]);

  useEffect(() => {
    if (!queueScope) {
      setQueueItems([]);
      setQueueDraft("");
      setQueueLoading(false);
      setQueueError(null);
      setQueueingPrompt(false);
      setQueueActionItemId(null);
      setQueueSendingItemId(null);
      return;
    }

    let cancelled = false;

    const loadQueue = async () => {
      setQueueLoading(true);
      try {
        const items = await listPromptQueueItems(queueScope.scopeType, queueScope.scopeId);
        if (!cancelled) {
          setQueueItems(items);
          setQueueError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setQueueError(error instanceof Error ? error.message : "Failed to load prompt queue.");
        }
      } finally {
        if (!cancelled) {
          setQueueLoading(false);
        }
      }
    };

    void loadQueue();
    return () => {
      cancelled = true;
    };
  }, [queueScope]);

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

  const handleRemoveFile = useCallback((path: string) => {
    if (openFilePath !== path) {
      return;
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
  }, [openFilePath]);

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

  const handleAddDiffComment = useCallback((anchor: DiffReviewAnchor, message: string) => {
    addComment(anchor, message);
    setRightPanelTab("review");
  }, [addComment]);

  const handleRunReviewAgent = useCallback(async () => {
    if (!activeSession || !activeRootPath || !activeDraft) {
      return;
    }

    setReviewRunError(null);
    setReviewRunning(true);
    try {
      await onRunReviewAgentRequest({
        sourceSessionId: activeSession.id,
        workspacePath: activeRootPath,
        agent: activeDraft.agent,
        briefMarkdown: createReviewBriefForDraft(activeDraft),
      });
      clearActiveDraft();
    } catch (error) {
      setReviewRunError(error instanceof Error ? error.message : "Failed to run agent.");
    } finally {
      setReviewRunning(false);
    }
  }, [activeDraft, activeRootPath, activeSession, clearActiveDraft, onRunReviewAgentRequest]);

  const handleQueuePrompt = useCallback(async () => {
    if (!queueScope) {
      return;
    }
    const prompt = queueDraft.trim();
    if (!prompt) {
      return;
    }

    setQueueingPrompt(true);
    try {
      await enqueuePromptQueueItem({
        scopeType: queueScope.scopeType,
        scopeId: queueScope.scopeId,
        prompt,
      });
      const items = await listPromptQueueItems(queueScope.scopeType, queueScope.scopeId);
      setQueueItems(items);
      setQueueDraft("");
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to queue prompt.");
    } finally {
      setQueueingPrompt(false);
    }
  }, [queueDraft, queueScope]);

  const handleQueueRemoveItem = useCallback(async (itemId: number) => {
    setQueueActionItemId(itemId);
    try {
      await deletePromptQueueItem(itemId);
      setQueueItems((prev) => prev.filter((item) => item.id !== itemId));
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to remove queued prompt.");
    } finally {
      setQueueActionItemId((prev) => (prev === itemId ? null : prev));
    }
  }, []);

  const handleQueueClear = useCallback(async () => {
    if (!queueScope) {
      return;
    }
    setQueueLoading(true);
    try {
      await clearPromptQueueItems(queueScope.scopeType, queueScope.scopeId);
      setQueueItems([]);
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to clear prompt queue.");
    } finally {
      setQueueLoading(false);
    }
  }, [queueScope]);

  const handleQueueSendItem = useCallback(async (itemId: number) => {
    const activeSessionId = activeSession?.id;
    const item = queueItems.find((current) => current.id === itemId);
    if (!activeSessionId || !item) {
      return;
    }

    setQueueSendingItemId(itemId);
    try {
      await onSendPromptToSession(activeSessionId, item.prompt);
      await deletePromptQueueItem(itemId);
      setQueueItems((prev) => prev.filter((current) => current.id !== itemId));
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to send queued prompt.");
    } finally {
      setQueueSendingItemId((prev) => (prev === itemId ? null : prev));
    }
  }, [activeSession?.id, onSendPromptToSession, queueItems]);

  const handleStatusChange = useCallback(
    (sessionId: string) => (status: TerminalSession["status"]) => {
      onStatusChange(sessionId, status);
    },
    [onStatusChange]
  );

  const handleSplitStatusChange = useCallback(
    (sessionId: string, paneId: SplitPaneId) => (status: TerminalSession["status"]) => {
      const allowedPaneIds = splitBySessionId.get(sessionId)?.paneIds ?? ["pane-1"];
      const existing = paneStatusRef.current.get(sessionId) ?? new Map<SplitPaneId, TerminalSession["status"]>();
      const next = new Map<SplitPaneId, TerminalSession["status"]>();
      for (const allowedPaneId of allowedPaneIds) {
        if (allowedPaneId === paneId) {
          continue;
        }
        const existingStatus = existing.get(allowedPaneId);
        if (existingStatus) {
          next.set(allowedPaneId, existingStatus);
        }
      }
      next.set(paneId, status);
      paneStatusRef.current.set(sessionId, next);
      onStatusChange(sessionId, getAggregatedTerminalStatus(Array.from(next.values())));
    },
    [onStatusChange, splitBySessionId]
  );

  const handleSplitPaneResizeDragStart = useCallback((
    event: ReactMouseEvent<HTMLDivElement>,
    sessionId: string,
    orientation: SplitSessionState["orientation"],
    dividerIndex: number,
    paneSizes: number[],
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const containerSize = orientation === "vertical" ? containerRect.width : containerRect.height;
    if (containerSize <= 0) {
      return;
    }

    const startPointer = orientation === "vertical" ? event.clientX : event.clientY;
    const startSizes = [...paneSizes];
    setIsDraggingSplitPane(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointer = orientation === "vertical" ? moveEvent.clientX : moveEvent.clientY;
      const deltaRatio = (pointer - startPointer) / containerSize;
      const nextSizes = resizeSplitPaneSizes(startSizes, dividerIndex, deltaRatio);
      onResizeSplitPanes(sessionId, nextSizes);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitPane(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [onResizeSplitPanes]);

  const handleSplitPaneResizeReset = useCallback((sessionId: string, paneCount: number) => {
    onResizeSplitPanes(sessionId, buildEqualSplitPaneSizes(paneCount));
  }, [onResizeSplitPanes]);

  const renderSession = useCallback((session: TerminalSession) => {
    const splitState = splitBySessionId.get(session.id) ?? null;
    const paneIds = splitState?.paneIds.length ? splitState.paneIds : (["pane-1"] as SplitPaneId[]);
    const isSplit = paneIds.length > 1;
    const orientation: SplitSessionState["orientation"] = splitState?.orientation ?? "vertical";
    const layoutClass = orientation === "vertical" ? "flex-row" : "flex-col";
    const paneSizes = isSplit
      ? normalizeSplitPaneSizes(paneIds.length, splitState?.paneSizes)
      : [1];
    const reconnectToken = reconnectBySessionId.get(session.id) ?? 0;

    return (
      <div className={`flex h-full w-full ${layoutClass}`}>
        {paneIds.map((paneId, index) => {
          const isPrimaryPane = paneId === (splitState?.primaryPaneId ?? "pane-1");
          const paneSessionId = isPrimaryPane ? session.id : `${session.id}-${paneId}`;
          const paneTmuxName = paneId === "pane-1" || !session.useTmux
            ? session.tmuxSessionName
            : buildSplitTmuxSessionName(session.tmuxSessionName, paneId);
          const withDivider = index < paneIds.length - 1;
          const isFocusedPane = isSplit && paneId === (splitState?.focusedPaneId ?? "pane-1");
          const paneSize = paneSizes[index] ?? 1 / paneIds.length;

          return (
            <Fragment key={`${session.id}-${paneId}-wrapper`}>
              <div
                className={`relative overflow-hidden min-w-0 min-h-0 ${
                  isSplit ? "" : "flex-1"
                } ${
                  isSplit && !isDraggingSplitPane
                    ? "transition-[flex-grow] duration-150 ease-out"
                    : ""
                } ${
                  isSplit
                    ? isFocusedPane
                      ? "border border-accent/70 ring-1 ring-inset ring-accent/30 shadow-lg shadow-accent/10 transition-[border-color,box-shadow,opacity] duration-150"
                      : "border border-surface/80 opacity-85 transition-[border-color,box-shadow,opacity] duration-150"
                    : ""
                }`}
                style={isSplit ? {
                  flexBasis: 0,
                  flexGrow: paneSize,
                  flexShrink: 1,
                } : undefined}
                onMouseDown={() => onFocusSplitPane(session.id, paneId)}
              >
                <Terminal
                  key={`${paneSessionId}-${paneTmuxName}-${reconnectToken}`}
                  cwd={session.path}
                  sessionId={paneSessionId}
                  useTmux={session.useTmux}
                  tmuxSessionName={paneTmuxName}
                  tmuxHistoryLimit={session.tmuxHistoryLimit}
                  portEnv={session.portEnv}
                  isFocused={isFocusedPane}
                  onStatusChange={isSplit ? handleSplitStatusChange(session.id, paneId) : handleStatusChange(session.id)}
                  onReconnect={() => onReconnectSession(session.id)}
                  onRegisterCommand={isPrimaryPane ? onRegisterTerminalCommand : undefined}
                  onUnregisterCommand={isPrimaryPane ? onUnregisterTerminalCommand : undefined}
                  onClose={() => onCloseSession(session.id)}
                />
              </div>
              {withDivider && (
                <div
                  className={orientation === "vertical"
                    ? "h-full w-1 shrink-0 cursor-col-resize border-l border-surface bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
                    : "w-full h-1 shrink-0 cursor-row-resize border-t border-surface bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
                  }
                  onMouseDown={(event) => handleSplitPaneResizeDragStart(
                    event,
                    session.id,
                    orientation,
                    index,
                    paneSizes,
                  )}
                  onDoubleClick={() => handleSplitPaneResizeReset(session.id, paneIds.length)}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    );
  }, [
    handleSplitPaneResizeDragStart,
    handleSplitPaneResizeReset,
    handleSplitStatusChange,
    handleStatusChange,
    isDraggingSplitPane,
    onCloseSession,
    onReconnectSession,
    onRegisterTerminalCommand,
    onUnregisterTerminalCommand,
    onFocusSplitPane,
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
      onRegisterTerminalCommand={onRegisterTerminalCommand}
      onUnregisterTerminalCommand={onUnregisterTerminalCommand}
      onRunReviewAgentRequest={onRunReviewAgentRequest}
      splitBySessionId={splitBySessionId}
      onFocusSplitPane={onFocusSplitPane}
      onResizeSplitPanes={onResizeSplitPanes}
      reconnectBySessionId={reconnectBySessionId}
      onReconnectSession={onReconnectSession}
      onSendPromptToSession={onSendPromptToSession}
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
      reviewComments={reviewComments}
      reviewFinalComment={reviewFinalComment}
      reviewAgent={reviewAgent}
      reviewRunning={reviewRunning}
      reviewError={reviewRunError}
      onOpenFile={handleOpenFile}
      onRemoveFile={handleRemoveFile}
      onOpenChange={handleOpenChange}
      onCloseDrawer={handleCloseDrawer}
      onSaveFile={handleSaveFile}
      onChangeFileContent={handleChangeContent}
      onRightPanelTabChange={setRightPanelTab}
      onChangesModeChange={setChangesMode}
      onReviewRemoveComment={removeComment}
      onReviewFinalCommentChange={setFinalComment}
      onReviewAgentChange={setAgent}
      onRunReviewAgent={handleRunReviewAgent}
      onClearReviewDraft={clearActiveDraft}
      onAddDiffComment={handleAddDiffComment}
      openFileReviewComments={openFileReviewComments}
      queueItems={queueItems}
      queueDraft={queueDraft}
      queueLoading={queueLoading}
      queueError={queueError}
      queueingPrompt={queueingPrompt}
      queueActionItemId={queueActionItemId}
      queueSendingItemId={queueSendingItemId}
      onQueueDraftChange={setQueueDraft}
      onQueuePrompt={handleQueuePrompt}
      onQueueSendItem={handleQueueSendItem}
      onQueueRemoveItem={handleQueueRemoveItem}
      onQueueClear={handleQueueClear}
      renderSession={renderSession}
    />
  );
}

export default MainAreaContainer;
