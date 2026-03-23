import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type {
  Divergence,
  Project,
  TerminalSession,
  WorkspaceMember,
  WorkspaceSession,
} from "../../../entities";
import {
  isAgentSession,
  isEditorSession,
  isTerminalSession,
} from "../../../entities";
import { DEFAULT_EDITOR_THEME_DARK, DEFAULT_EDITOR_THEME_LIGHT, TabButton, useFileEditor, type AppSettings, type ChangesMode, type EditorThemeId, type GitChangeEntry, type LinearWorkflowState } from "../../../shared";
import FileQuickSwitcher from "../../../features/file-quick-switcher";
import { ProjectSearchPanel } from "../../../features/project-search";
import { ChangesTree } from "../../../features/changes-tree";
import { LinearTaskQueuePanel } from "../../../features/linear-task-queue";
import type {
  LinearIssueStatusFilter,
} from "../../../features/linear-task-queue";
import { PromptQueuePanel } from "../../../features/prompt-queue";
import {
  createReviewBriefForDraft,
  ReviewDraftPanel,
  useDiffReviewDraft,
  type DiffReviewAgent,
  type DiffReviewAnchor,
  type DiffReviewComment,
} from "../../../features/diff-review";
import type { AgentRuntimeAttachment, AgentRuntimeInteractionMode } from "../../../shared";
import type { AgentSessionComposerHandle } from "../../../widgets/agent-session-view/ui/AgentSessionView.types";
import AgentSessionChangeDrawer from "../../../widgets/agent-session-view/ui/AgentSessionChangeDrawer.container";
import { useAgentLinearTaskQueue } from "../../../widgets/agent-session-view/model/useAgentLinearTaskQueue";
import { useAgentPromptQueue } from "../../../widgets/agent-session-view/model/useAgentPromptQueue";
import ChangesPanel from "../../../widgets/main-area/ui/ChangesPanel.container";
import FileExplorer from "../../../widgets/main-area/ui/FileExplorer.container";
import ProjectSettingsPanel from "../../../widgets/main-area/ui/ProjectSettingsPanel.container";
import QuickEditDrawer from "../../../widgets/main-area/ui/QuickEditDrawer.container";
import TmuxPanel from "../../../widgets/main-area/ui/TmuxPanel.container";
import { resolveActivePaneSessionId } from "../../../widgets/main-area/lib/activePaneSession.pure";
import { resolvePromptQueueScope } from "../../../widgets/main-area/lib/promptQueueScope.pure";
import { useLinearTaskQueue } from "../../../widgets/main-area/model/useLinearTaskQueue";
import { usePromptQueue } from "../../../widgets/main-area/model/usePromptQueue";

type TerminalSidebarTab = "settings" | "files" | "changes" | "search" | "queue" | "linear" | "review" | "tmux";
type EditorSidebarTab = "files" | "changes" | "search";
type AgentSidebarTab = "files" | "changes" | "linear" | "queue";
const EMPTY_REVIEW_COMMENTS: DiffReviewComment[] = [];

function resolveAgentQueueScope(
  session: { targetType: string; projectId: number; targetId: number; workspaceOwnerId?: number } | null,
): { scopeType: "project" | "workspace"; scopeId: number } | null {
  if (!session) {
    return null;
  }

  if (session.targetType === "project" || session.targetType === "divergence") {
    if (session.projectId <= 0) {
      return null;
    }
    return {
      scopeType: "project",
      scopeId: session.projectId,
    };
  }

  const workspaceScopeId = session.workspaceOwnerId ?? session.targetId;
  if (workspaceScopeId <= 0) {
    return null;
  }

  return {
    scopeType: "workspace",
    scopeId: workspaceScopeId,
  };
}

interface StageSidebarProps {
  focusedSession: WorkspaceSession | null;
  terminalSessions: TerminalSession[];
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>;
  splitBySessionId: Map<string, import("../../../entities").SplitSessionState>;
  globalTmuxHistoryLimit: number;
  appSettings: AppSettings;
  editorTheme: EditorThemeId;
  focusedAgentComposerRef: RefObject<AgentSessionComposerHandle> | null;
  projectsLoading: boolean;
  divergencesLoading: boolean;
  showFileQuickSwitcher: boolean;
  onOpenOrFocusEditorFile: (filePath: string, sourceSession: WorkspaceSession | null) => void;
  onOpenOrFocusEditorChange: (
    entry: GitChangeEntry,
    mode: ChangesMode,
    sourceSession: WorkspaceSession | null,
  ) => void;
  onOpenOrFocusEditorSearchMatch: (
    filePath: string,
    lineNumber: number,
    columnStart: number,
    sourceSession: WorkspaceSession | null,
  ) => void;
  onCloseFileQuickSwitcher: () => void;
  onSendPromptToSession: (sessionId: string, prompt: string) => Promise<void>;
  onCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
  onProjectSettingsSaved: (settings: import("../../../entities/project").ProjectSettings) => void;
  onRunReviewAgentRequest: (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: DiffReviewAgent;
    briefMarkdown: string;
  }) => Promise<void>;
  onUpdateSessionSettings: (sessionId: string, input: {
    model?: string;
    effort?: import("../../../shared").AgentRuntimeEffort;
  }) => Promise<void>;
  onRespondToRequest: (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ) => Promise<void>;
  onSendPrompt: (
    sessionId: string,
    prompt: string,
    options?: {
      interactionMode?: AgentRuntimeInteractionMode;
      attachments?: AgentRuntimeAttachment[];
    }
  ) => Promise<void>;
  onStageAttachment: (input: {
    sessionId: string;
    name: string;
    mimeType: string;
    base64Content: string;
  }) => Promise<AgentRuntimeAttachment>;
  onDiscardAttachment: (sessionId: string, attachmentId: string) => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
}

function StageSidebar({
  focusedSession,
  terminalSessions,
  projects,
  divergencesByProject,
  workspaceMembersByWorkspaceId,
  splitBySessionId,
  globalTmuxHistoryLimit,
  appSettings,
  editorTheme,
  focusedAgentComposerRef,
  projectsLoading,
  divergencesLoading,
  showFileQuickSwitcher,
  onOpenOrFocusEditorFile,
  onOpenOrFocusEditorChange,
  onOpenOrFocusEditorSearchMatch,
  onCloseFileQuickSwitcher,
  onSendPromptToSession,
  onCloseSessionAndKillTmux,
  onProjectSettingsSaved,
  onRunReviewAgentRequest,
}: StageSidebarProps) {
  const [terminalTab, setTerminalTab] = useState<TerminalSidebarTab>("settings");
  const [editorTab, setEditorTab] = useState<EditorSidebarTab>("files");
  const [agentTab, setAgentTab] = useState<AgentSidebarTab>("files");
  const [changesMode, setChangesMode] = useState<ChangesMode>("working");
  const [reviewRunError, setReviewRunError] = useState<string | null>(null);
  const [reviewRunning, setReviewRunning] = useState(false);
  const [editorThemeForAgent, setEditorThemeForAgent] = useState(editorTheme);
  const activeTerminalSession = focusedSession && isTerminalSession(focusedSession) ? focusedSession : null;
  const activeEditorSession = focusedSession && isEditorSession(focusedSession) ? focusedSession : null;
  const activeAgentSession = focusedSession && isAgentSession(focusedSession) ? focusedSession : null;
  const activeRootPath = focusedSession?.path ?? null;
  const queueScope = useMemo(
    () => resolvePromptQueueScope(activeTerminalSession),
    [activeTerminalSession],
  );
  const activeSplit = activeTerminalSession ? splitBySessionId.get(activeTerminalSession.id) ?? null : null;
  const activePaneSessionId = useMemo(
    () => resolveActivePaneSessionId(activeTerminalSession?.id ?? null, activeSplit),
    [activeSplit, activeTerminalSession?.id],
  );
  const activePaneSessionIdRef = useRef(activePaneSessionId);
  activePaneSessionIdRef.current = activePaneSessionId;
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
    handleRemoveFile,
    handleOpenChange,
    handleCloseDrawer,
    handleSaveFile,
    handleChangeContent,
    resetFileEditor,
  } = useFileEditor({ activeRootPath });

  const {
    activeDraft,
    addComment,
    removeComment,
    setFinalComment,
    setAgent,
    clearActiveDraft,
    clearAllDrafts,
  } = useDiffReviewDraft({
    workspacePath: activeTerminalSession?.path ?? null,
    mode: changesMode,
  });

  const reviewComments = activeDraft?.comments ?? EMPTY_REVIEW_COMMENTS;
  const reviewFinalComment = activeDraft?.finalComment ?? "";
  const reviewAgent = activeDraft?.agent ?? "claude";
  const openFileReviewComments = useMemo(() => {
    if (!openFilePath) {
      return [];
    }
    return reviewComments.filter((comment: DiffReviewComment) => comment.anchor.filePath === openFilePath);
  }, [openFilePath, reviewComments]);

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
    onSendPromptToSession,
  });

  const {
    linearProjectName,
    visibleLinearIssues,
    linearTotalIssueCount,
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
    activeSession: activeTerminalSession,
    appSettings,
    projects,
    workspaceMembersByWorkspaceId,
    rightPanelTab: terminalTab === "search" ? "files" : terminalTab,
    activePaneSessionIdRef,
    onSendPromptToSession,
  });

  const handleSetComposerText = useCallback((text: string) => {
    focusedAgentComposerRef?.current?.setText(text);
  }, [focusedAgentComposerRef]);

  const agentQueueScope = useMemo(
    () => resolveAgentQueueScope(activeAgentSession),
    [activeAgentSession],
  );

  const {
    queueItems: agentQueueItems,
    queueDraft: agentQueueDraft,
    queueLoading: agentQueueLoading,
    queueError: agentQueueError,
    queueingPrompt: agentQueueingPrompt,
    queueActionItemId: agentQueueActionItemId,
    queueSendingItemId: agentQueueSendingItemId,
    setQueueDraft: setAgentQueueDraft,
    handleQueuePrompt: handleAgentQueuePrompt,
    handleQueueRemoveItem: handleAgentQueueRemoveItem,
    handleQueueClear: handleAgentQueueClear,
    handleQueueSendItem: handleAgentQueueSendItem,
  } = useAgentPromptQueue({
    queueScope: agentQueueScope,
    onSetComposerText: handleSetComposerText,
  });

  const {
    linearProjectName: agentLinearProjectName,
    visibleLinearIssues: agentVisibleLinearIssues,
    linearTotalIssueCount: agentLinearTotalIssueCount,
    linearLoading: agentLinearLoading,
    linearRefreshing: agentLinearRefreshing,
    linearError: agentLinearError,
    linearInfoMessage: agentLinearInfoMessage,
    linearSendingIssueId: agentLinearSendingIssueId,
    linearStatusFilter: agentLinearStatusFilter,
    linearSearchQuery: agentLinearSearchQuery,
    linearWorkflowStates: agentLinearWorkflowStates,
    linearUpdatingIssueId: agentLinearUpdatingIssueId,
    linearStatePickerOpenIssueId: agentLinearStatePickerOpenIssueId,
    setLinearStatusFilter: setAgentLinearStatusFilter,
    setLinearSearchQuery: setAgentLinearSearchQuery,
    setLinearStatePickerOpenIssueId: setAgentLinearStatePickerOpenIssueId,
    handleLinearRefresh: handleAgentLinearRefresh,
    handleLinearSendIssue: handleAgentLinearSendIssue,
    handleLinearUpdateIssueState: handleAgentLinearUpdateIssueState,
    resetLinearState: resetAgentLinearState,
  } = useAgentLinearTaskQueue({
    session: activeAgentSession,
    appSettings,
    projects,
    workspaceMembersByWorkspaceId,
    sidebarTab: agentTab === "files" ? "changes" : agentTab,
    onSetComposerText: handleSetComposerText,
  });

  useEffect(() => {
    setEditorThemeForAgent(
      appSettings.theme === "light"
        ? appSettings.editorThemeForLightMode ?? DEFAULT_EDITOR_THEME_LIGHT
        : appSettings.editorThemeForDarkMode ?? DEFAULT_EDITOR_THEME_DARK,
    );
  }, [appSettings.editorThemeForDarkMode, appSettings.editorThemeForLightMode, appSettings.theme]);

  useEffect(() => {
    resetFileEditor();
    setReviewRunError(null);
    setReviewRunning(false);
    clearAllDrafts();
    resetLinearState();
  }, [activeTerminalSession?.id, clearAllDrafts, resetFileEditor, resetLinearState]);

  useEffect(() => {
    resetFileEditor();
    resetAgentLinearState();
  }, [activeAgentSession?.id, resetAgentLinearState, resetFileEditor]);

  useEffect(() => {
    resetFileEditor();
  }, [activeEditorSession?.id, resetFileEditor]);

  const handleAddDiffComment = useCallback((anchor: DiffReviewAnchor, message: string) => {
    addComment(anchor, message);
    setTerminalTab("review");
  }, [addComment]);

  const handleRunReviewAgent = useCallback(async () => {
    if (!activeTerminalSession || !activeRootPath || !activeDraft) {
      return;
    }

    setReviewRunError(null);
    setReviewRunning(true);
    try {
      await onRunReviewAgentRequest({
        sourceSessionId: activeTerminalSession.id,
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
  }, [activeDraft, activeRootPath, activeTerminalSession, clearActiveDraft, onRunReviewAgentRequest]);

  const renderTerminalTab = useCallback((
    tab: TerminalSidebarTab,
  ) => {
    if (!activeTerminalSession) {
      return null;
    }

    switch (tab) {
      case "settings": {
        const activeProject = projects.find((project) => project.id === activeTerminalSession.projectId) ?? null;
        return activeTerminalSession.type === "workspace" || activeTerminalSession.type === "workspace_divergence" ? (
          <div className="h-full p-4 text-sm text-subtext">
            Workspace sessions use workspace-level settings. Open workspace settings from the sidebar context menu
            to manage port defaults and metadata.
          </div>
        ) : (
          <ProjectSettingsPanel
            project={activeProject}
            globalTmuxHistoryLimit={globalTmuxHistoryLimit}
            onSaved={onProjectSettingsSaved}
            contextPath={activeRootPath}
            contextLabel={activeTerminalSession.type === "divergence" ? "Divergence" : "Project"}
          />
        );
      }
      case "files":
        return (
          <FileExplorer
            rootPath={activeRootPath}
            activeFilePath={null}
            onOpenFile={(path) => onOpenOrFocusEditorFile(path, activeTerminalSession)}
            onRemoveFile={handleRemoveFile}
          />
        );
      case "changes":
        return (
          <ChangesPanel
            rootPath={activeRootPath}
            activeFilePath={null}
            mode={changesMode}
            onModeChange={setChangesMode}
            onOpenChange={(entry) => onOpenOrFocusEditorChange(entry, changesMode, activeTerminalSession)}
          />
        );
      case "search":
        return (
          <ProjectSearchPanel
            rootPath={activeRootPath}
            onOpenMatch={(filePath, lineNumber, columnStart) => {
              onOpenOrFocusEditorSearchMatch(filePath, lineNumber, columnStart, activeTerminalSession);
            }}
          />
        );
      case "queue":
        return (
          <PromptQueuePanel
            items={queueItems}
            draft={queueDraft}
            loading={queueLoading}
            error={queueError}
            queueing={queueingPrompt}
            actionItemId={queueActionItemId}
            sendingItemId={queueSendingItemId}
            onDraftChange={setQueueDraft}
            onQueuePrompt={handleQueuePrompt}
            onSendItem={handleQueueSendItem}
            onRemoveItem={handleQueueRemoveItem}
            onClear={handleQueueClear}
          />
        );
      case "linear":
        return (
          <LinearTaskQueuePanel
            projectName={linearProjectName}
            items={visibleLinearIssues}
            totalCount={linearTotalIssueCount}
            loading={linearLoading}
            refreshing={linearRefreshing}
            error={linearError}
            infoMessage={linearInfoMessage}
            sendingItemId={linearSendingIssueId}
            statusFilter={linearStatusFilter}
            searchQuery={linearSearchQuery}
            workflowStates={linearWorkflowStates}
            updatingIssueId={linearUpdatingIssueId}
            statePickerOpenIssueId={linearStatePickerOpenIssueId}
            onToggleStatePicker={setLinearStatePickerOpenIssueId}
            onRefresh={handleLinearRefresh}
            onStatusFilterChange={setLinearStatusFilter}
            onSearchQueryChange={setLinearSearchQuery}
            onSendItem={handleLinearSendIssue}
            onUpdateIssueState={handleLinearUpdateIssueState}
          />
        );
      case "review":
        return (
          <ReviewDraftPanel
            workspacePath={activeRootPath}
            comments={reviewComments}
            finalComment={reviewFinalComment}
            selectedAgent={reviewAgent}
            isRunning={reviewRunning}
            error={reviewRunError}
            onRemoveComment={removeComment}
            onFinalCommentChange={setFinalComment}
            onAgentChange={setAgent}
            onRun={() => { void handleRunReviewAgent(); }}
            onClear={clearActiveDraft}
          />
        );
      case "tmux":
        return (
          <TmuxPanel
            projects={projects}
            divergencesByProject={divergencesByProject}
            projectsLoading={projectsLoading}
            divergencesLoading={divergencesLoading}
            appSessions={terminalSessions}
            onCloseSessionAndKillTmux={onCloseSessionAndKillTmux}
          />
        );
      default:
        return null;
    }
  }, [
    activeRootPath,
    activeTerminalSession,
    changesMode,
    clearActiveDraft,
    divergencesByProject,
    globalTmuxHistoryLimit,
    handleQueueClear,
    handleQueuePrompt,
    handleQueueRemoveItem,
    handleQueueSendItem,
    handleRemoveFile,
    handleRunReviewAgent,
    handleLinearRefresh,
    handleLinearSendIssue,
    handleLinearUpdateIssueState,
    linearError,
    linearInfoMessage,
    linearLoading,
    linearProjectName,
    linearRefreshing,
    linearSearchQuery,
    linearSendingIssueId,
    linearStatePickerOpenIssueId,
    linearStatusFilter,
    linearTotalIssueCount,
    linearUpdatingIssueId,
    linearWorkflowStates,
    onCloseSessionAndKillTmux,
    onProjectSettingsSaved,
    projects,
    projectsLoading,
    queueActionItemId,
    queueDraft,
    queueError,
    queueItems,
    queueLoading,
    queueSendingItemId,
    queueingPrompt,
    removeComment,
    reviewAgent,
    reviewComments,
    reviewFinalComment,
    reviewRunError,
    reviewRunning,
    setAgent,
    setFinalComment,
    setChangesMode,
    setQueueDraft,
    setLinearSearchQuery,
    setLinearStatePickerOpenIssueId,
    setLinearStatusFilter,
    terminalSessions,
    divergencesLoading,
    onOpenOrFocusEditorChange,
    onOpenOrFocusEditorFile,
    onOpenOrFocusEditorSearchMatch,
    visibleLinearIssues,
  ]);

  const renderEditorTab = useCallback((tab: EditorSidebarTab) => {
    if (!activeEditorSession) {
      return null;
    }

    switch (tab) {
      case "files":
        return (
          <FileExplorer
            rootPath={activeEditorSession.path}
            activeFilePath={activeEditorSession.filePath}
            onOpenFile={(path) => onOpenOrFocusEditorFile(path, activeEditorSession)}
            onRemoveFile={handleRemoveFile}
          />
        );
      case "changes":
        return (
          <ChangesPanel
            rootPath={activeEditorSession.path}
            activeFilePath={activeEditorSession.filePath}
            mode={changesMode}
            onModeChange={setChangesMode}
            onOpenChange={(entry) => onOpenOrFocusEditorChange(entry, changesMode, activeEditorSession)}
          />
        );
      case "search":
        return (
          <ProjectSearchPanel
            rootPath={activeEditorSession.path}
            onOpenMatch={(filePath, lineNumber, columnStart) => {
              onOpenOrFocusEditorSearchMatch(filePath, lineNumber, columnStart, activeEditorSession);
            }}
          />
        );
      default:
        return null;
    }
  }, [
    activeEditorSession,
    changesMode,
    handleRemoveFile,
    onOpenOrFocusEditorChange,
    onOpenOrFocusEditorFile,
    onOpenOrFocusEditorSearchMatch,
  ]);

  const renderAgentTab = useCallback((tab: AgentSidebarTab) => {
    if (!activeAgentSession) {
      return null;
    }

    switch (tab) {
      case "files":
        return (
          <FileExplorer
            rootPath={activeAgentSession.path}
            activeFilePath={null}
            onOpenFile={(path) => onOpenOrFocusEditorFile(path, activeAgentSession)}
            onRemoveFile={handleRemoveFile}
          />
        );
      case "changes":
        return (
          <ChangesTree
            rootPath={activeAgentSession.path}
            activeFilePath={openFilePath}
            pollWhileActive={activeAgentSession.runtimeStatus === "running"}
            onOpenChange={(entry, mode) => { void handleOpenChange(entry, mode); }}
          />
        );
      case "linear":
        return (
          <LinearTaskQueuePanel
            projectName={agentLinearProjectName}
            items={agentVisibleLinearIssues}
            totalCount={agentLinearTotalIssueCount}
            loading={agentLinearLoading}
            refreshing={agentLinearRefreshing}
            error={agentLinearError}
            infoMessage={agentLinearInfoMessage}
            sendingItemId={agentLinearSendingIssueId}
            statusFilter={agentLinearStatusFilter}
            searchQuery={agentLinearSearchQuery}
            workflowStates={agentLinearWorkflowStates as LinearWorkflowState[]}
            updatingIssueId={agentLinearUpdatingIssueId}
            statePickerOpenIssueId={agentLinearStatePickerOpenIssueId}
            onToggleStatePicker={setAgentLinearStatePickerOpenIssueId}
            onRefresh={handleAgentLinearRefresh}
            onStatusFilterChange={setAgentLinearStatusFilter as (filter: LinearIssueStatusFilter) => void}
            onSearchQueryChange={setAgentLinearSearchQuery}
            onSendItem={handleAgentLinearSendIssue}
            onUpdateIssueState={handleAgentLinearUpdateIssueState}
          />
        );
      case "queue":
        return (
          <PromptQueuePanel
            items={agentQueueItems}
            draft={agentQueueDraft}
            loading={agentQueueLoading}
            error={agentQueueError}
            queueing={agentQueueingPrompt}
            actionItemId={agentQueueActionItemId}
            sendingItemId={agentQueueSendingItemId}
            onDraftChange={setAgentQueueDraft}
            onQueuePrompt={handleAgentQueuePrompt}
            onSendItem={handleAgentQueueSendItem}
            onRemoveItem={handleAgentQueueRemoveItem}
            onClear={handleAgentQueueClear}
          />
        );
      default:
        return null;
    }
  }, [
    activeAgentSession,
    handleRemoveFile,
    agentLinearError,
    agentLinearInfoMessage,
    agentLinearLoading,
    agentLinearProjectName,
    agentLinearRefreshing,
    agentLinearSearchQuery,
    agentLinearSendingIssueId,
    agentLinearStatePickerOpenIssueId,
    agentLinearStatusFilter,
    agentLinearTotalIssueCount,
    agentLinearUpdatingIssueId,
    agentLinearWorkflowStates,
    agentQueueActionItemId,
    agentQueueDraft,
    agentQueueError,
    agentQueueItems,
    agentQueueLoading,
    agentQueueSendingItemId,
    agentQueueingPrompt,
    agentVisibleLinearIssues,
    handleAgentLinearRefresh,
    handleAgentLinearSendIssue,
    handleAgentLinearUpdateIssueState,
    handleAgentQueueClear,
    handleAgentQueuePrompt,
    handleAgentQueueRemoveItem,
    handleAgentQueueSendItem,
    handleOpenChange,
    onOpenOrFocusEditorFile,
    openFilePath,
    setAgentLinearSearchQuery,
    setAgentLinearStatePickerOpenIssueId,
    setAgentLinearStatusFilter,
    setAgentQueueDraft,
  ]);

  if (!focusedSession) {
    return (
      <aside className="flex h-full w-96 shrink-0 items-center justify-center border-l border-surface bg-sidebar px-6">
        <p className="text-sm text-subtext">Select a pane to inspect files, changes, queues, and session tools.</p>
      </aside>
    );
  }

  return (
    <>
      <aside className="flex h-full w-96 shrink-0 flex-col border-l border-surface bg-sidebar">
        <div className="flex items-center justify-between border-b border-surface px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-[0.16em] text-subtext">Focused pane</p>
            <p className="truncate text-sm text-text">{focusedSession.name}</p>
          </div>
          <span className="rounded-full border border-surface px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-subtext">
            {isAgentSession(focusedSession) ? "Agent" : isEditorSession(focusedSession) ? "Editor" : "Terminal"}
          </span>
        </div>

        {activeTerminalSession ? (
          <div className="flex items-center border-b border-surface">
            {(["settings", "files", "changes", "search", "queue", "linear", "tmux", "review"] as const).map((tab) => (
              <TabButton key={tab} active={terminalTab === tab} onClick={() => setTerminalTab(tab)}>
                {tab === "tmux" ? "Tmux" : tab[0].toUpperCase() + tab.slice(1)}
              </TabButton>
            ))}
          </div>
        ) : activeEditorSession ? (
          <div className="flex items-center border-b border-surface">
            {(["files", "changes", "search"] as const).map((tab) => (
              <TabButton key={tab} active={editorTab === tab} onClick={() => setEditorTab(tab)}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </TabButton>
            ))}
          </div>
        ) : (
          <div className="flex items-center border-b border-surface">
            {(["files", "changes", "linear", "queue"] as const).map((tab) => (
              <TabButton key={tab} active={agentTab === tab} onClick={() => setAgentTab(tab)}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </TabButton>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTerminalSession
            ? renderTerminalTab(terminalTab)
            : activeEditorSession
              ? renderEditorTab(editorTab)
              : renderAgentTab(agentTab)}
        </div>
      </aside>

      {activeTerminalSession && (
        <>
          <QuickEditDrawer
            isOpen={isDrawerOpen}
            filePath={openFilePath}
            projectRootPath={activeRootPath}
            content={openFileContent}
            editorTheme={editorTheme}
            diff={openDiff}
            diffLoading={diffLoading}
            diffError={diffError}
            diffMode={openDiffMode ?? undefined}
            reviewComments={openFileReviewComments}
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
            onSave={() => { void handleSaveFile(); }}
            onClose={handleCloseDrawer}
            onAddDiffComment={handleAddDiffComment}
          />

          {showFileQuickSwitcher && (activeTerminalSession || activeEditorSession) && activeRootPath && (
            <FileQuickSwitcher
              rootPath={activeRootPath}
              onSelect={(path) => {
                onOpenOrFocusEditorFile(path, activeEditorSession ?? activeTerminalSession);
                onCloseFileQuickSwitcher();
              }}
              onClose={onCloseFileQuickSwitcher}
            />
          )}
        </>
      )}

      {activeAgentSession && (
        <AgentSessionChangeDrawer
          isOpen={isDrawerOpen}
          filePath={openFilePath}
          projectRootPath={activeAgentSession.path}
          content={openFileContent}
          editorTheme={editorThemeForAgent}
          diff={openDiff}
          diffLoading={diffLoading}
          diffError={diffError}
          diffMode={openDiffMode}
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
          onSave={() => { void handleSaveFile(); }}
          onClose={handleCloseDrawer}
        />
      )}
    </>
  );
}

export default StageSidebar;
