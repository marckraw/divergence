import WorkspaceSessionTabsPresentational from "../../workspace-session-tabs";
import { Button, Textarea } from "../../../shared";
import AgentSessionComposerContainer from "./AgentSessionComposer.container";
import AgentSessionHeaderContainer from "./AgentSessionHeader.container";
import AgentSessionTimelineContainer from "./AgentSessionTimeline.container";
import type { AgentSessionViewPresentationalProps } from "./AgentSessionView.types";

function AgentSessionViewPresentational({
  session,
  sessionList,
  activeSessionId,
  idleAttentionSessionIds,
  lastViewedRuntimeEventAtMsBySessionId,
  dismissedAttentionKeyBySessionId,
  capabilities,
  timelineItems,
  isUpdatingSessionSettings,
  requestAnswers,
  isResolvingRequest,
  onSelectSession,
  onDismissSessionAttention,
  onCloseSession,
  onModelChange,
  onEffortChange,
  onSubmitRequest,
  onResolveApproval,
  onRequestAnswerChange,
  onSendPrompt,
  onStageAttachment,
  onDiscardAttachment,
  onStopSession,
}: AgentSessionViewPresentationalProps) {
  const pendingRequest = session.pendingRequest;
  const canSubmitPendingRequest = pendingRequest?.kind === "user-input"
    && (pendingRequest.questions ?? []).every((_, index) => Boolean(requestAnswers[index]?.trim()));

  return (
    <main className="flex-1 min-w-0 h-full bg-main flex flex-col relative">
      <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            <WorkspaceSessionTabsPresentational
              sessionList={sessionList}
              activeSessionId={activeSessionId}
              idleAttentionSessionIds={idleAttentionSessionIds}
              lastViewedRuntimeEventAtMsBySessionId={lastViewedRuntimeEventAtMsBySessionId}
              dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
              onSelectSession={onSelectSession}
              onDismissSessionAttention={onDismissSessionAttention}
              onCloseSession={onCloseSession}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <AgentSessionHeaderContainer
            session={session}
            capabilities={capabilities}
            isUpdatingSessionSettings={isUpdatingSessionSettings}
            onModelChange={onModelChange}
            onEffortChange={onEffortChange}
            onStopSession={onStopSession}
          />

          {pendingRequest?.kind === "approval" && pendingRequest.options && (
            <div className="border-b border-surface bg-sidebar/40 px-5 py-4">
              <div className="mx-auto mt-0 w-full max-w-5xl">
                <div className="flex flex-wrap gap-2">
                  {pendingRequest.options.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={option.id.includes("decline") || option.id.includes("cancel") ? "ghost" : "secondary"}
                      size="sm"
                      onClick={() => { void onResolveApproval(option.id); }}
                      disabled={isResolvingRequest}
                      title={option.description}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
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
                              onClick={() => onRequestAnswerChange(index, option.label)}
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
                      onChange={(event) => onRequestAnswerChange(index, event.target.value)}
                      placeholder={question.isSecret ? "Enter hidden value" : "Enter response"}
                      className="mt-3 min-h-[88px]"
                    />
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => { void onSubmitRequest(); }}
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
          />

          <AgentSessionComposerContainer
            key={session.id}
            session={session}
            capabilities={capabilities}
            onSendPrompt={onSendPrompt}
            onStageAttachment={onStageAttachment}
            onDiscardAttachment={onDiscardAttachment}
          />
        </div>
      </div>
    </main>
  );
}

export default AgentSessionViewPresentational;
