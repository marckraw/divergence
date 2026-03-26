import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { useAgentRuntimeSession } from "../../../features/agent-runtime";
import { buildAgentSessionSettingsPatch } from "../../../entities";
import { buildAgentTimeline } from "../../../widgets/agent-session-view/lib/agentTimeline.pure";
import AgentSessionComposerContainer from "../../../widgets/agent-session-view/ui/AgentSessionComposer.container";
import AgentSessionHeaderContainer from "../../../widgets/agent-session-view/ui/AgentSessionHeader.container";
import AgentSessionTimelineContainer from "../../../widgets/agent-session-view/ui/AgentSessionTimeline.container";
import type {
  AgentSessionComposerHandle,
} from "../../../widgets/agent-session-view/ui/AgentSessionView.types";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeCapabilities,
  AgentRuntimeEffort,
  AgentRuntimeInteractionMode,
} from "../../../shared";
import AgentPendingApprovalBar from "./AgentPendingApprovalBar.presentational";
import AgentPendingQuestionForm from "./AgentPendingQuestionForm.presentational";

interface AgentStagePaneProps {
  sessionId: string;
  composerRef: RefObject<AgentSessionComposerHandle>;
  capabilities: AgentRuntimeCapabilities | null;
  onUpdateSessionSettings: (sessionId: string, input: {
    model?: string;
    effort?: AgentRuntimeEffort;
  }) => Promise<void>;
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
  onRespondToRequest: (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ) => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
}

function AgentStagePane({
  sessionId,
  composerRef,
  capabilities,
  onUpdateSessionSettings,
  onSendPrompt,
  onStageAttachment,
  onDiscardAttachment,
  onRespondToRequest,
  onStopSession,
}: AgentStagePaneProps) {
  const session = useAgentRuntimeSession(sessionId);
  const [isUpdatingSessionSettings, setIsUpdatingSessionSettings] = useState(false);
  const [requestAnswers, setRequestAnswers] = useState<string[]>([]);
  const [isResolvingRequest, setIsResolvingRequest] = useState(false);
  const timelineItems = useMemo(
    () => (session?.messages && session?.activities
      ? buildAgentTimeline(session.messages, session.activities)
      : []),
    [session?.activities, session?.messages],
  );

  useEffect(() => {
    const questions = session?.pendingRequest?.questions ?? [];
    setRequestAnswers(questions.map(() => ""));
    setIsResolvingRequest(false);
  }, [session?.pendingRequest?.id, session?.pendingRequest?.questions]);

  const handleRequestAnswerChange = useCallback((index: number, value: string) => {
    setRequestAnswers((previous: string[]) => {
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
      await onUpdateSessionSettings(session.id, patch);
    } finally {
      setIsUpdatingSessionSettings(false);
    }
  }, [isUpdatingSessionSettings, onUpdateSessionSettings, session]);

  const handleEffortChange = useCallback(async (effort: AgentRuntimeEffort) => {
    if (!session || isUpdatingSessionSettings) {
      return;
    }

    const patch = buildAgentSessionSettingsPatch(session, { effort });
    if (Object.keys(patch).length === 0) {
      return;
    }

    setIsUpdatingSessionSettings(true);
    try {
      await onUpdateSessionSettings(session.id, patch);
    } finally {
      setIsUpdatingSessionSettings(false);
    }
  }, [isUpdatingSessionSettings, onUpdateSessionSettings, session]);

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
      await onRespondToRequest(session.id, request.id, {
        answers: requestAnswers,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, onRespondToRequest, requestAnswers, session]);

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
      await onRespondToRequest(session.id, request.id, {
        decision: decisionId,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, onRespondToRequest, session]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-subtext">
        Agent session is no longer available.
      </div>
    );
  }

  const pendingRequest = session.pendingRequest;
  const canSubmitPendingRequest = pendingRequest?.kind === "user-input"
    && (pendingRequest.questions ?? []).every((_, index) => Boolean(requestAnswers[index]?.trim()));

  return (
    <div className="flex h-full min-h-0 flex-col bg-main">
      <AgentSessionHeaderContainer
        session={session}
        capabilities={capabilities}
        isUpdatingSessionSettings={isUpdatingSessionSettings}
        onModelChange={handleModelChange}
        onEffortChange={handleEffortChange}
        onStopSession={onStopSession}
      />

      {pendingRequest?.kind === "approval" && pendingRequest.options ? (
        <AgentPendingApprovalBar
          request={pendingRequest}
          isResolving={isResolvingRequest}
          onResolve={(decisionId) => {
            void handleResolveApproval(decisionId);
          }}
        />
      ) : null}

      {pendingRequest?.kind === "user-input" && pendingRequest.questions ? (
        <AgentPendingQuestionForm
          request={pendingRequest}
          answers={requestAnswers}
          isResolving={isResolvingRequest}
          canSubmit={canSubmitPendingRequest}
          onAnswerChange={handleRequestAnswerChange}
          onSubmit={() => {
            void handleSubmitRequest();
          }}
        />
      ) : null}

      <AgentSessionTimelineContainer
        session={session}
        timelineItems={timelineItems}
      />

      <AgentSessionComposerContainer
        ref={composerRef}
        key={session.id}
        session={session}
        capabilities={capabilities}
        onSendPrompt={onSendPrompt}
        onStageAttachment={onStageAttachment}
        onDiscardAttachment={onDiscardAttachment}
      />
    </div>
  );
}

export default AgentStagePane;
