import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type RefObject } from "react";
import { useAgentRuntimeSession } from "../../../features/agent-runtime";
import { buildAgentSessionSettingsPatch, type AgentProposedPlan } from "../../../entities";
import { buildAgentTimeline } from "../../../widgets/agent-session-view/lib/agentTimeline.pure";
import AgentSessionComposerContainer from "../../../widgets/agent-session-view/ui/AgentSessionComposer.container";
import AgentSessionHeaderContainer from "../../../widgets/agent-session-view/ui/AgentSessionHeader.container";
import AgentSessionTimelineContainer from "../../../widgets/agent-session-view/ui/AgentSessionTimeline.container";
import type {
  AgentSessionComposerHandle,
  AgentSessionTerminalContext,
  AgentSessionViewProps,
} from "../../../widgets/agent-session-view/ui/AgentSessionView.types";
import type { AgentRuntimeCapabilities, AgentRuntimeEffort } from "../../../shared";
import { Button, Textarea } from "../../../shared";

interface AgentStagePaneProps {
  sessionId: string;
  composerRef: RefObject<AgentSessionComposerHandle>;
  capabilities: AgentRuntimeCapabilities | null;
  pendingTerminalContext?: AgentSessionTerminalContext | null;
  onConsumePendingTerminalContext?: (contextId: string) => void;
  onUpdateSessionSettings: AgentSessionViewProps["onUpdateSessionSettings"];
  onSendPrompt: AgentSessionViewProps["onSendPrompt"];
  onStageAttachment: AgentSessionViewProps["onStageAttachment"];
  onDiscardAttachment: AgentSessionViewProps["onDiscardAttachment"];
  onRespondToRequest: AgentSessionViewProps["onRespondToRequest"];
  onStopSession: (sessionId: string) => Promise<void>;
}

function AgentStagePane({
  sessionId,
  composerRef,
  capabilities,
  pendingTerminalContext,
  onConsumePendingTerminalContext,
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

  const handleImplementProposedPlan = useCallback((plan: AgentProposedPlan) => {
    composerRef.current?.queueProposedPlan(plan);
  }, [composerRef]);

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
  }, [composerRef, onConsumePendingTerminalContext, pendingTerminalContext, session]);

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

      {pendingRequest?.kind === "approval" && pendingRequest.options && (
        <div className="border-b border-surface bg-sidebar/40 px-5 py-4">
          <div className="mx-auto mt-0 flex w-full max-w-5xl flex-wrap gap-2">
            {pendingRequest.options.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant={option.id.includes("decline") || option.id.includes("cancel") ? "ghost" : "secondary"}
                size="sm"
                onClick={() => { void handleResolveApproval(option.id); }}
                disabled={isResolvingRequest}
                title={option.description}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {pendingRequest?.kind === "user-input" && pendingRequest.questions && (
        <div className="border-b border-surface bg-sidebar/40 px-5 py-4">
          <div className="mx-auto mt-0 w-full max-w-5xl space-y-3">
            {pendingRequest.questions.map((question, index) => (
              <div key={question.id} className="rounded-xl border border-surface bg-main/60 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">{question.header}</p>
                <p className="mt-1 text-sm text-text">{question.question}</p>
                {question.options && question.options.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {question.options.map((option) => {
                      const isSelected = requestAnswers[index] === option.label;
                      return (
                        <Button
                          key={option.id}
                          type="button"
                          variant={isSelected ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => handleRequestAnswerChange(index, option.label)}
                          disabled={isResolvingRequest}
                          title={option.description}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
                <Textarea
                  value={requestAnswers[index] ?? ""}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handleRequestAnswerChange(index, event.target.value)}
                  placeholder={question.isSecret ? "Enter hidden value" : "Enter response"}
                  className="mt-3 min-h-[88px]"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => { void handleSubmitRequest(); }}
                disabled={isResolvingRequest || !canSubmitPendingRequest}
              >
                {isResolvingRequest ? "Submitting..." : "Submit Answers"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AgentSessionTimelineContainer
        session={session}
        timelineItems={timelineItems}
        onImplementProposedPlan={handleImplementProposedPlan}
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
