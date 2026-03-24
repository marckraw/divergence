import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgentSessionViewPresentational from "./AgentSessionView.presentational";
import type { AgentSessionComposerHandle, AgentSessionViewProps, AgentSidebarTab } from "./AgentSessionView.types";
import { buildAgentTimeline } from "../lib/agentTimeline.pure";
import { useAgentRuntimeSession } from "../../../features/agent-runtime";
import AgentSessionChangeDrawer from "./AgentSessionChangeDrawer.container";
import { DEFAULT_EDITOR_THEME_DARK, DEFAULT_EDITOR_THEME_LIGHT } from "../../../shared";
import { useAppSettings, useFileEditor, type ChangesMode, type GitChangeEntry } from "../../../shared";
import { buildAgentSessionSettingsPatch, type AgentProposedPlan } from "../../../entities";
import { LinearTaskQueuePanel } from "../../../features/linear-task-queue";
import { PromptQueuePanel } from "../../../features/prompt-queue";
import { useAgentLinearTaskQueue } from "../model/useAgentLinearTaskQueue";
import { useAgentPromptQueue } from "../model/useAgentPromptQueue";

function resolveAgentQueueScope(
  session: { targetType: string; projectId: number; targetId: number; workspaceOwnerId?: number } | null,
): { scopeType: "project" | "workspace"; scopeId: number } | null {
  if (!session) {
    return null;
  }

  if (session.targetType === "project" || session.targetType === "divergence") {
    if (session.projectId <= 0) return null;
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

function AgentSessionViewContainer(props: AgentSessionViewProps) {
  const session = useAgentRuntimeSession(props.sessionId);
  const { onConsumePendingTerminalContext, pendingTerminalContext } = props;
  const { settings: appSettings } = useAppSettings();
  const [isUpdatingSessionSettings, setIsUpdatingSessionSettings] = useState(false);
  const [requestAnswers, setRequestAnswers] = useState<string[]>([]);
  const [isResolvingRequest, setIsResolvingRequest] = useState(false);
  const [changesSidebarVisible, setChangesSidebarVisible] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<AgentSidebarTab>("changes");
  const composerRef = useRef<AgentSessionComposerHandle>(null);
  const sessionMessages = session?.messages ?? null;
  const sessionActivities = session?.activities ?? null;
  const timelineItems = useMemo(
    () => sessionMessages && sessionActivities ? buildAgentTimeline(sessionMessages, sessionActivities) : [],
    [sessionActivities, sessionMessages],
  );
  const editorTheme = appSettings.theme === "light"
    ? appSettings.editorThemeForLightMode ?? DEFAULT_EDITOR_THEME_LIGHT
    : appSettings.editorThemeForDarkMode ?? DEFAULT_EDITOR_THEME_DARK;
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
    handleOpenChange,
    handleCloseDrawer,
    handleSaveFile,
    handleChangeContent,
    resetFileEditor,
  } = useFileEditor({
    activeRootPath: session?.path ?? null,
  });

  const handleSetComposerText = useCallback((text: string) => {
    composerRef.current?.setText(text);
  }, []);

  const handleImplementProposedPlan = useCallback((plan: AgentProposedPlan) => {
    composerRef.current?.queueProposedPlan(plan);
  }, []);

  const queueScope = useMemo(
    () => resolveAgentQueueScope(session),
    [session],
  );

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
  } = useAgentLinearTaskQueue({
    session,
    appSettings,
    projects: props.projects,
    workspaceMembersByWorkspaceId: props.workspaceMembersByWorkspaceId,
    sidebarTab,
    onSetComposerText: handleSetComposerText,
  });

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
  } = useAgentPromptQueue({
    queueScope,
    onSetComposerText: handleSetComposerText,
  });

  useEffect(() => {
    setIsUpdatingSessionSettings(false);
    setIsResolvingRequest(false);
    setChangesSidebarVisible(false);
    setSidebarTab("changes");
    resetFileEditor();
    resetLinearState();
  }, [props.sessionId, resetFileEditor, resetLinearState]);

  useEffect(() => {
    const questions = session?.pendingRequest?.questions ?? [];
    setRequestAnswers(questions.map(() => ""));
    setIsResolvingRequest(false);
  }, [session?.pendingRequest?.id, session?.pendingRequest?.questions]);

  useEffect(() => {
    if (!session || !pendingTerminalContext) {
      return;
    }

    composerRef.current?.addTerminalContext(pendingTerminalContext);
    onConsumePendingTerminalContext?.(pendingTerminalContext.id);
  }, [onConsumePendingTerminalContext, pendingTerminalContext, session]);

  const handleRequestAnswerChange = useCallback((index: number, value: string) => {
    setRequestAnswers((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }, []);

  const handleModelChange = useCallback(async (model: string) => {
    if (!session || !model.trim() || isUpdatingSessionSettings || model === session.model) {
      return;
    }

    const patch = buildAgentSessionSettingsPatch(session, { model });
    if (Object.keys(patch).length === 0) {
      return;
    }

    setIsUpdatingSessionSettings(true);
    try {
      await props.onUpdateSessionSettings(session.id, patch);
    } finally {
      setIsUpdatingSessionSettings(false);
    }
  }, [isUpdatingSessionSettings, props, session]);

  const handleEffortChange = useCallback(async (effort: "none" | "low" | "medium" | "high" | "xhigh" | "max") => {
    if (!session || isUpdatingSessionSettings) {
      return;
    }

    const patch = buildAgentSessionSettingsPatch(session, { effort });
    if (Object.keys(patch).length === 0) {
      return;
    }

    setIsUpdatingSessionSettings(true);
    try {
      await props.onUpdateSessionSettings(session.id, patch);
    } finally {
      setIsUpdatingSessionSettings(false);
    }
  }, [isUpdatingSessionSettings, props, session]);

  const handleSubmitRequest = useCallback(async () => {
    if (!session) {
      return;
    }

    const request = session.pendingRequest;
    if (!request || request.kind !== "user-input" || isResolvingRequest) {
      return;
    }

    setIsResolvingRequest(true);
    try {
      await props.onRespondToRequest(session.id, request.id, {
        answers: requestAnswers,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, props, requestAnswers, session]);

  const handleResolveApproval = useCallback(async (decisionId: string) => {
    if (!session) {
      return;
    }

    const request = session.pendingRequest;
    if (!request || request.kind !== "approval" || isResolvingRequest) {
      return;
    }

    setIsResolvingRequest(true);
    try {
      await props.onRespondToRequest(session.id, request.id, {
        decision: decisionId,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, props, session]);

  const handleOpenChangedFile = useCallback(async (entry: GitChangeEntry, mode: ChangesMode) => {
    await handleOpenChange(entry, mode);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      setChangesSidebarVisible(false);
    }
  }, [handleOpenChange]);

  if (!session) {
    return null;
  }

  const linearPanel = (
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

  const queuePanel = (
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

  return (
    <AgentSessionViewPresentational
      session={session}
      sessionList={props.sessionList}
      activeSessionId={props.activeSessionId}
      idleAttentionSessionIds={props.idleAttentionSessionIds}
      lastViewedRuntimeEventAtMsBySessionId={props.lastViewedRuntimeEventAtMsBySessionId}
      dismissedAttentionKeyBySessionId={props.dismissedAttentionKeyBySessionId}
      capabilities={props.capabilities}
      timelineItems={timelineItems}
      isUpdatingSessionSettings={isUpdatingSessionSettings}
      requestAnswers={requestAnswers}
      isResolvingRequest={isResolvingRequest}
      changesSidebarVisible={changesSidebarVisible}
      activeChangedFilePath={openFilePath}
      sidebarTab={sidebarTab}
      linearPanel={linearPanel}
      queuePanel={queuePanel}
      changeDrawer={(
        <AgentSessionChangeDrawer
          isOpen={isDrawerOpen}
          filePath={openFilePath}
          projectRootPath={session.path}
          content={openFileContent}
          editorTheme={editorTheme}
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
      composerRef={composerRef}
      onSelectSession={props.onSelectSession}
      onDismissSessionAttention={props.onDismissSessionAttention}
      onCloseSession={props.onCloseSession}
      onModelChange={handleModelChange}
      onEffortChange={handleEffortChange}
      onSubmitRequest={handleSubmitRequest}
      onResolveApproval={handleResolveApproval}
      onRequestAnswerChange={handleRequestAnswerChange}
      onToggleChangesSidebar={() => setChangesSidebarVisible((previous) => !previous)}
      onCloseChangesSidebar={() => setChangesSidebarVisible(false)}
      onSidebarTabChange={setSidebarTab}
      onOpenChangedFile={handleOpenChangedFile}
      onImplementProposedPlan={handleImplementProposedPlan}
      onSendPrompt={props.onSendPrompt}
      onStageAttachment={props.onStageAttachment}
      onDiscardAttachment={props.onDiscardAttachment}
      onStopSession={props.onStopSession}
    />
  );
}

export default AgentSessionViewContainer;
