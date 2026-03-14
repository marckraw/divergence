import { useCallback, useEffect, useMemo, useState } from "react";
import AgentSessionViewPresentational from "./AgentSessionView.presentational";
import type { AgentSessionViewProps } from "./AgentSessionView.types";
import { buildAgentTimeline } from "../lib/agentTimeline.pure";
import { useAgentRuntimeSession } from "../../../features/agent-runtime";

function AgentSessionViewContainer(props: AgentSessionViewProps) {
  const session = useAgentRuntimeSession(props.sessionId);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const [requestAnswers, setRequestAnswers] = useState<string[]>([]);
  const [isResolvingRequest, setIsResolvingRequest] = useState(false);
  const sessionMessages = session?.messages ?? null;
  const sessionActivities = session?.activities ?? null;
  const timelineItems = useMemo(
    () => sessionMessages && sessionActivities ? buildAgentTimeline(sessionMessages, sessionActivities) : [],
    [sessionActivities, sessionMessages],
  );

  useEffect(() => {
    setIsUpdatingModel(false);
    setIsResolvingRequest(false);
  }, [props.sessionId]);

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
    if (!session || !model.trim() || isUpdatingModel || model === session.model) {
      return;
    }

    setIsUpdatingModel(true);
    try {
      await props.onUpdateModel(session.id, model);
    } finally {
      setIsUpdatingModel(false);
    }
  }, [isUpdatingModel, props, session]);

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
      isUpdatingModel={isUpdatingModel}
      requestAnswers={requestAnswers}
      isResolvingRequest={isResolvingRequest}
      onSelectSession={props.onSelectSession}
      onDismissSessionAttention={props.onDismissSessionAttention}
      onCloseSession={props.onCloseSession}
      onModelChange={handleModelChange}
      onSubmitRequest={handleSubmitRequest}
      onResolveApproval={handleResolveApproval}
      onRequestAnswerChange={handleRequestAnswerChange}
      onSendPrompt={props.onSendPrompt}
      onStageAttachment={props.onStageAttachment}
      onDiscardAttachment={props.onDiscardAttachment}
      onStopSession={props.onStopSession}
    />
  );
}

export default AgentSessionViewContainer;
