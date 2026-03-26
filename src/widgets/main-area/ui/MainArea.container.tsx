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
import type { MainAreaProps, RightPanelTab } from "./MainArea.types";
import {
  buildEqualSplitPaneSizes,
  buildWorkspaceSessionAttentionStateMap,
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
import { buildSplitTmuxSessionName } from "../../../entities/terminal-session";
import {
  createReviewBriefForDraft,
  useDiffReviewDraft,
  type DiffReviewAnchor,
  type DiffReviewComment,
} from "../../../features/diff-review";
import {
  getAggregatedTerminalStatus,
} from "../lib/mainArea.pure";
import { resolveActivePaneSessionId } from "../lib/activePaneSession.pure";
import {
  useAppSettings,
} from "../../../shared";
import { resolvePromptQueueScope } from "../lib/promptQueueScope.pure";
import { usePromptQueue } from "../model/usePromptQueue";
import { useFileEditor } from "../model/useFileEditor";
import { useLinearTaskQueue } from "../model/useLinearTaskQueue";

const EMPTY_REVIEW_COMMENTS: DiffReviewComment[] = [];

function MainAreaContainer({
  projects,
  sessions,
  idleAttentionSessionIds,
  lastViewedRuntimeEventAtMsBySessionId,
  dismissedAttentionKeyBySessionId,
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
  workspaceMembersByWorkspaceId,
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
  const [changesMode, setChangesMode] = useState<ChangesMode>("working");
  const [reviewRunError, setReviewRunError] = useState<string | null>(null);
  const [reviewRunning, setReviewRunning] = useState(false);
  const [isDraggingSplitPane, setIsDraggingSplitPane] = useState(false);
  const { settings: appSettings } = useAppSettings();
  const {
    activeDraft,
    addComment,
    removeComment,
    setFinalComment,
    setAgent,
    clearActiveDraft,
    clearAllDrafts,
  } = useDiffReviewDraft({ workspacePath: activeRootPath, mode: changesMode });

  const reviewComments = activeDraft?.comments ?? EMPTY_REVIEW_COMMENTS;
  const reviewFinalComment = activeDraft?.finalComment ?? "";
  const reviewAgent = activeDraft?.agent ?? "claude";
  const queueScope = useMemo(
    () => resolvePromptQueueScope(activeSession),
    [activeSession],
  );
  const activeSessionId = activeSession?.id ?? null;
  const activePaneSessionId = useMemo(
    () => resolveActivePaneSessionId(activeSessionId, activeSplit),
    [activeSessionId, activeSplit],
  );
  const attentionStateBySessionId = useMemo(
    () => buildWorkspaceSessionAttentionStateMap(sessionList, {
      activeSessionId,
      idleAttentionSessionIds,
      lastViewedRuntimeEventAtMsBySessionId,
      dismissedAttentionKeyBySessionId,
    }),
    [
      activeSessionId,
      dismissedAttentionKeyBySessionId,
      idleAttentionSessionIds,
      lastViewedRuntimeEventAtMsBySessionId,
      sessionList,
    ],
  );
  const activePaneSessionIdRef = useRef(activePaneSessionId);
  activePaneSessionIdRef.current = activePaneSessionId;

  // File editor hook
  const {
    openFilePath,
    openFileContent,
    openDiff,
    openDiffMode,
    diffLoading,
    diffError,
    drawerTab,
    allowEdit,
    isDrawerOpen,
    isDirty,
    isSavingFile,
    isLoadingFile,
    isReadOnly,
    fileLoadError,
    fileSaveError,
    largeFileWarning,
    handleOpenFile,
    handleRemoveFile,
    handleOpenChange,
    handleCloseDrawer,
    handleSaveFile,
    handleChangeContent,
    resetFileEditor,
  } = useFileEditor({ activeRootPath });

  const openFileReviewComments = useMemo(() => {
    if (!openFilePath) {
      return [];
    }
    return reviewComments.filter((comment) => comment.anchor.filePath === openFilePath);
  }, [openFilePath, reviewComments]);

  // Prompt queue hook
  const {
    queueItems,
    queueDraft,
    queueLoading,
    queueError,
    queueingPrompt,
    queueActionItemId,
    queueSendingItemId,
    setQueueDraft,
    handleQueuePrompt,
    handleQueueRemoveItem,
    handleQueueClear,
    handleQueueSendItem,
  } = usePromptQueue({
    queueScope,
    activePaneSessionIdRef,
    onSendPromptToSession: onSendPromptToSession,
  });

  // Linear task queue hook
  const {
    linearProjectName,
    linearTotalIssueCount,
    visibleLinearIssues,
    linearLoading,
    linearRefreshing,
    linearError,
    linearInfoMessage,
    linearSendingIssueId,
    linearStatusFilter,
    linearSearchQuery,
    linearWorkflowStates,
    linearUpdatingIssueId,
    linearStatePickerOpenIssueId,
    setLinearStatusFilter,
    setLinearSearchQuery,
    setLinearStatePickerOpenIssueId,
    handleLinearRefresh,
    handleLinearSendIssue,
    handleLinearUpdateIssueState,
    resetLinearState,
  } = useLinearTaskQueue({
    activeSession,
    appSettings,
    projects,
    workspaceMembersByWorkspaceId,
    rightPanelTab,
    activePaneSessionIdRef,
    onSendPromptToSession: onSendPromptToSession,
  });

  useEffect(() => {
    resetFileEditor();
    setReviewRunError(null);
    setReviewRunning(false);
    clearAllDrafts();
    resetLinearState();
  }, [activeSession?.id, clearAllDrafts, resetFileEditor, resetLinearState]);

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

  const handleOpenPanelChange = useCallback(async (entry: GitChangeEntry) => {
    await handleOpenChange(entry, changesMode);
  }, [changesMode, handleOpenChange]);

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
    let frameId: number | null = null;
    let latestDeltaRatio = 0;

    const flushResize = () => {
      frameId = null;
      const nextSizes = resizeSplitPaneSizes(startSizes, dividerIndex, latestDeltaRatio);
      onResizeSplitPanes(sessionId, nextSizes);
    };

    setIsDraggingSplitPane(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointer = orientation === "vertical" ? moveEvent.clientX : moveEvent.clientY;
      latestDeltaRatio = (pointer - startPointer) / containerSize;
      if (frameId === null) {
        frameId = window.requestAnimationFrame(flushResize);
      }
    };

    const handleMouseUp = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        flushResize();
      }
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
                  onRegisterCommand={onRegisterTerminalCommand}
                  onUnregisterCommand={onUnregisterTerminalCommand}
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
      idleAttentionSessionIds={idleAttentionSessionIds}
      lastViewedRuntimeEventAtMsBySessionId={lastViewedRuntimeEventAtMsBySessionId}
      dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
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
      workspaceMembersByWorkspaceId={workspaceMembersByWorkspaceId}
      attentionStateBySessionId={attentionStateBySessionId}
      sessionList={sessionList}
      activeProject={activeProject}
      activeSplit={activeSplit}
      activeRootPath={activeRootPath}
      rightPanelTab={rightPanelTab}
      openFilePath={openFilePath}
      openFileContent={openFileContent}
      openDiff={openDiff}
      openDiffMode={openDiffMode}
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
      onOpenChange={handleOpenPanelChange}
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
      linearProjectName={linearProjectName}
      linearIssues={visibleLinearIssues}
      linearTotalIssueCount={linearTotalIssueCount}
      linearLoading={linearLoading}
      linearRefreshing={linearRefreshing}
      linearError={linearError}
      linearInfoMessage={linearInfoMessage}
      linearSendingIssueId={linearSendingIssueId}
      linearStatusFilter={linearStatusFilter}
      linearSearchQuery={linearSearchQuery}
      onLinearRefresh={handleLinearRefresh}
      onLinearStatusFilterChange={setLinearStatusFilter}
      onLinearSearchQueryChange={setLinearSearchQuery}
      onLinearSendIssue={handleLinearSendIssue}
      linearWorkflowStates={linearWorkflowStates}
      linearUpdatingIssueId={linearUpdatingIssueId}
      linearStatePickerOpenIssueId={linearStatePickerOpenIssueId}
      onLinearToggleStatePicker={setLinearStatePickerOpenIssueId}
      onLinearUpdateIssueState={handleLinearUpdateIssueState}
      renderSession={renderSession}
    />
  );
}

export default MainAreaContainer;
