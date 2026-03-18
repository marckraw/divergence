import { useCallback, useEffect, useMemo, useState } from "react";
import AgentSessionViewPresentational from "./AgentSessionView.presentational";
import type { AgentSessionViewProps } from "./AgentSessionView.types";
import { buildAgentTimeline } from "../lib/agentTimeline.pure";
import { useAgentRuntimeSession } from "../../../features/agent-runtime";
import AgentSessionChangeDrawer from "./AgentSessionChangeDrawer.container";
import { DEFAULT_EDITOR_THEME_DARK, DEFAULT_EDITOR_THEME_LIGHT } from "../../../shared";
import { useAppSettings, useFileEditor, type ChangesMode, type GitChangeEntry } from "../../../shared";
import { buildAgentSessionSettingsPatch } from "../../../entities";

function AgentSessionViewContainer(props: AgentSessionViewProps) {
  const session = useAgentRuntimeSession(props.sessionId);
  const { settings: appSettings } = useAppSettings();
  const [isUpdatingSessionSettings, setIsUpdatingSessionSettings] = useState(false);
  const [requestAnswers, setRequestAnswers] = useState<string[]>([]);
  const [isResolvingRequest, setIsResolvingRequest] = useState(false);
  const [changesSidebarVisible, setChangesSidebarVisible] = useState(false);
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

  useEffect(() => {
    setIsUpdatingSessionSettings(false);
    setIsResolvingRequest(false);
    setChangesSidebarVisible(false);
    resetFileEditor();
  }, [props.sessionId, resetFileEditor]);

  useEffect(() => {
    const questions = session?.pendingRequest?.questions ?? [];
    setRequestAnswers(questions.map(() => ""));
    setIsResolvingRequest(false);
  }, [session?.pendingRequest?.id, session?.pendingRequest?.questions]);

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
      onOpenChangedFile={handleOpenChangedFile}
      onSendPrompt={props.onSendPrompt}
      onStageAttachment={props.onStageAttachment}
      onDiscardAttachment={props.onDiscardAttachment}
      onStopSession={props.onStopSession}
    />
  );
}

export default AgentSessionViewContainer;
