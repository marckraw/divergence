import type { KeyboardEvent, RefObject } from "react";
import { Paperclip, X } from "lucide-react";
import WorkspaceSessionTabsPresentational from "../../workspace-session-tabs";
import {
  Button,
  EmptyState,
  getAgentProviderLabel,
  getAgentRuntimeProviderModelOptions,
  IconButton,
  Markdown,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  supportsAgentRuntimeImageAttachments,
  supportsAgentRuntimePlanMode,
  Textarea,
} from "../../../shared";
import { buildAgentTimeline } from "../lib/agentTimeline.pure";
import type { AgentSessionViewPresentationalProps } from "./AgentSessionView.types";

function getActivityToneClass(status: "running" | "completed" | "error") {
  switch (status) {
    case "running":
      return "border-yellow/30 bg-yellow/10 text-yellow";
    case "error":
      return "border-red/30 bg-red/10 text-red";
    case "completed":
    default:
      return "border-surface bg-surface/50 text-subtext";
  }
}

function getModelLabel(
  provider: AgentSessionViewPresentationalProps["session"]["provider"],
  model: string,
  capabilities: AgentSessionViewPresentationalProps["capabilities"]
): string {
  const options = getAgentRuntimeProviderModelOptions(capabilities, provider);
  return options.find((option) => option.slug === model)?.label ?? model;
}

function isSubmitShortcut(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

function isInteractionModeShortcut(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.key === "Tab"
    && event.shiftKey
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey;
}

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 102.4) / 10)} KB`;
  }
  return `${Math.round(sizeBytes / (1024 * 102.4)) / 10} MB`;
}

function AgentSessionViewPresentational({
  session,
  sessionList,
  activeSessionId,
  idleAttentionSessionIds,
  capabilities,
  draft,
  isSubmitting,
  isStagingAttachment,
  isUpdatingModel,
  requestAnswers,
  isResolvingRequest,
  attachmentInputRef,
  onSelectSession,
  onCloseSession,
  onDraftChange,
  onInteractionModeChange,
  onModelChange,
  onAttachmentInputChange,
  onComposerPaste,
  onComposerDrop,
  onComposerDragOver,
  onRemoveAttachment,
  onTriggerAttachmentPicker,
  onRequestAnswerChange,
  onSubmit,
  onSubmitRequest,
  onResolveApproval,
  onStopSession,
}: AgentSessionViewPresentationalProps) {
  const pendingRequest = session.pendingRequest;
  const modelOptions = getAgentRuntimeProviderModelOptions(capabilities, session.provider);
  const selectedModelLabel = getModelLabel(session.provider, session.model, capabilities);
  const supportsPlanMode = supportsAgentRuntimePlanMode(capabilities, session.provider);
  const supportsImageAttachments = supportsAgentRuntimeImageAttachments(capabilities, session.provider);
  const canSubmitPendingRequest = pendingRequest?.kind === "user-input"
    && (pendingRequest.questions ?? []).every((_, index) => Boolean(requestAnswers[index]?.trim()));
  const timelineItems = buildAgentTimeline(session.messages, session.activities);

  return (
    <main className="flex-1 min-w-0 h-full bg-main flex flex-col relative">
      <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            <WorkspaceSessionTabsPresentational
              sessionList={sessionList}
              activeSessionId={activeSessionId}
              idleAttentionSessionIds={idleAttentionSessionIds}
              onSelectSession={onSelectSession}
              onCloseSession={onCloseSession}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-subtext uppercase tracking-wide">
            {getAgentProviderLabel(session.provider)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { void onStopSession(session.id); }}
            disabled={session.runtimeStatus !== "running" && session.runtimeStatus !== "waiting"}
          >
            Stop
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="border-b border-surface bg-sidebar/70 px-5 py-4">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-text">{session.name}</h2>
                  <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-subtext">
                    {getAgentProviderLabel(session.provider)}
                  </span>
                  <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] text-subtext">
                    {selectedModelLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-subtext truncate">{session.path}</p>
              </div>
              <div className="flex items-center gap-2">
                {modelOptions.length > 0 ? (
                  <Select
                    value={session.model}
                    onValueChange={(value) => {
                      void onModelChange(value);
                    }}
                    disabled={
                      isUpdatingModel
                      || session.runtimeStatus === "running"
                      || session.runtimeStatus === "waiting"
                    }
                  >
                    <SelectTrigger className="h-8 min-w-[11rem] bg-main/60 text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((option) => (
                        <SelectItem key={option.slug} value={option.slug}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <div className="rounded-full border border-surface bg-main/60 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-subtext">
                  {session.runtimeStatus}
                </div>
              </div>
            </div>
            {session.errorMessage && (
              <div className="mx-auto mt-3 w-full max-w-5xl rounded-xl border border-red/30 bg-red/10 px-3 py-2">
                <p className="text-xs text-red">{session.errorMessage}</p>
              </div>
            )}
            {pendingRequest && (
              <div className="mx-auto mt-4 w-full max-w-5xl rounded-2xl border border-accent/30 bg-accent/10 px-4 py-4 shadow-[0_18px_60px_-42px_rgba(99,102,241,0.65)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">
                      {pendingRequest.kind === "approval" ? "Approval Required" : "Input Requested"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-text">{pendingRequest.title}</p>
                  </div>
                  <span className="text-[11px] text-subtext">{pendingRequest.status}</span>
                </div>
                {pendingRequest.description && (
                  <Markdown
                    content={pendingRequest.description}
                    size="sm"
                    className="mt-3 text-subtext"
                  />
                )}
                {pendingRequest.kind === "approval" && pendingRequest.options && (
                  <div className="mt-3 flex flex-wrap gap-2">
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
                )}
                {pendingRequest.kind === "user-input" && pendingRequest.questions && (
                  <div className="mt-3 space-y-3">
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
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
            <div className="mx-auto w-full max-w-5xl space-y-4">
              {timelineItems.length === 0 ? (
                <EmptyState className="rounded-2xl border border-dashed border-surface bg-sidebar/30 p-10">
                  <p>No agent turns yet</p>
                  <p className="mt-2 text-xs">Send a prompt to start an agent runtime turn.</p>
                </EmptyState>
              ) : (
                timelineItems.map((item) => {
                  if (item.kind === "activity") {
                    const activity = item.activity;

                    return (
                      <div key={activity.id} className="mr-auto flex w-full max-w-4xl gap-4 pl-2">
                        <div className="relative flex w-6 shrink-0 justify-center">
                          <div className="absolute inset-y-0 w-px bg-surface/70" />
                          <div className={`relative mt-4 h-2.5 w-2.5 rounded-full ${
                            activity.status === "error"
                              ? "bg-red"
                              : activity.status === "running"
                                ? "bg-yellow"
                                : "bg-accent"
                          }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1 rounded-2xl border border-surface/80 bg-sidebar/45 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">
                                Thought Process
                              </p>
                              <p className="mt-2 text-sm leading-6 text-text">{activity.title}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${getActivityToneClass(activity.status)}`}>
                              {activity.status}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-[11px] text-subtext">
                            <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
                              {activity.kind}
                            </span>
                            {activity.completedAtMs ? (
                              <span>Completed</span>
                            ) : (
                              <span>In progress</span>
                            )}
                          </div>

                          {activity.details && (
                            <details className="mt-3 group">
                              <summary className="cursor-pointer list-none text-[11px] text-subtext transition-colors hover:text-text">
                                <span className="inline-flex items-center gap-2">
                                  <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
                                    Runtime Output
                                  </span>
                                  <span>Expand details</span>
                                </span>
                              </summary>
                              <pre className="mt-3 overflow-x-auto rounded-xl border border-surface/80 bg-main/80 p-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-subtext">
                                {activity.details}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const message = item.message;
                  const isUser = message.role === "user";
                  const displayContent = message.content || (message.status === "streaming" ? "Working..." : "");

                  return (
                    <div
                      key={message.id}
                      className={`rounded-2xl border px-4 py-4 shadow-[0_24px_70px_-58px_rgba(0,0,0,0.95)] ${
                        isUser
                          ? "ml-auto w-full max-w-3xl border-accent/25 bg-accent/10"
                          : "mr-auto w-full max-w-[70rem] border-surface/80 bg-sidebar/85"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-subtext">
                            {message.role}
                          </span>
                          {message.interactionMode === "plan" && (
                            <span className="rounded-full border border-yellow/30 bg-yellow/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-yellow">
                              Plan
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-subtext">{message.status}</span>
                      </div>

                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <span
                              key={attachment.id}
                              className="inline-flex items-center gap-2 rounded-full border border-surface/80 bg-main/60 px-3 py-1 text-[11px] text-subtext"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              <span className="max-w-[18rem] truncate">{attachment.name}</span>
                              <span>{formatAttachmentSize(attachment.sizeBytes)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-text">
                          {displayContent}
                        </div>
                      ) : (
                        <Markdown content={displayContent} className="text-text" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-surface bg-sidebar/70 px-5 py-4">
            <div className="mx-auto w-full max-w-5xl space-y-3">
              {!pendingRequest && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                      className={!supportsPlanMode || isSubmitting || session.runtimeStatus === "running"
                        ? "pointer-events-none opacity-60"
                        : undefined}
                    >
                      <SegmentedControl
                        items={[
                          { id: "default" as const, label: "Chat" },
                          { id: "plan" as const, label: "Plan" },
                        ]}
                        value={draft.interactionMode}
                        onChange={(value) => {
                          if (!supportsPlanMode || isSubmitting || session.runtimeStatus === "running") {
                            return;
                          }
                          onInteractionModeChange(value);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={attachmentInputRef as RefObject<HTMLInputElement>}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={onAttachmentInputChange}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onTriggerAttachmentPicker}
                        disabled={!supportsImageAttachments || isSubmitting || isStagingAttachment}
                        title={
                          supportsImageAttachments
                            ? "Attach image files"
                            : `${getAgentProviderLabel(session.provider)} image attachments are not supported yet`
                        }
                      >
                        <Paperclip className="mr-2 h-4 w-4" />
                        {isStagingAttachment ? "Staging..." : "Add image"}
                      </Button>
                    </div>
                  </div>
                  {draft.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {draft.attachments.map((attachment) => (
                        <span
                          key={attachment.id}
                          className="inline-flex items-center gap-2 rounded-full border border-surface/80 bg-main/60 px-3 py-1 text-[11px] text-subtext"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="max-w-[18rem] truncate">{attachment.name}</span>
                          <span>{formatAttachmentSize(attachment.sizeBytes)}</span>
                          <IconButton
                            type="button"
                            variant="ghost"
                            size="xs"
                            icon={<X className="h-3.5 w-3.5" />}
                            label={`Remove ${attachment.name}`}
                            onClick={() => { void onRemoveAttachment(attachment.id); }}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                  {draft.attachmentError && (
                    <div className="rounded-xl border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
                      {draft.attachmentError}
                    </div>
                  )}
                  {!supportsImageAttachments && (
                    <p className="text-xs text-subtext">
                      {getAgentProviderLabel(session.provider)} does not support image attachments in
                      Divergence yet.
                    </p>
                  )}
                  <Textarea
                    value={draft.text}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onPaste={(event) => {
                      void onComposerPaste(event);
                    }}
                    onDrop={(event) => {
                      void onComposerDrop(event);
                    }}
                    onDragOver={onComposerDragOver}
                    onKeyDown={(event) => {
                      if (
                        isInteractionModeShortcut(event)
                        && supportsPlanMode
                        && !isSubmitting
                        && session.runtimeStatus !== "running"
                      ) {
                        event.preventDefault();
                        onInteractionModeChange(
                          draft.interactionMode === "plan" ? "default" : "plan",
                        );
                        return;
                      }
                      if (!isSubmitShortcut(event)) {
                        return;
                      }
                      event.preventDefault();
                      void onSubmit();
                    }}
                    placeholder={
                      draft.interactionMode === "plan"
                        ? `Ask ${session.provider} to investigate and plan work in ${session.path}`
                        : `Ask ${session.provider} to work in ${session.path}`
                    }
                    className="min-h-[112px] resize-y rounded-2xl bg-main/80"
                  />
                </>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-subtext">
                  {pendingRequest
                    ? `Waiting on ${pendingRequest.kind}`
                    : `Runtime prompt input. ${
                      draft.interactionMode === "plan" ? "Plan turn enabled." : "Chat turn enabled."
                    } Shift+Tab toggles mode. Cmd/Ctrl+Enter to send`}
                </p>
                {!pendingRequest && (
                  <Button
                    type="button"
                    onClick={() => { void onSubmit(); }}
                    disabled={
                      isSubmitting
                      || isStagingAttachment
                      || session.runtimeStatus === "running"
                      || !draft.text.trim()
                    }
                  >
                    {session.runtimeStatus === "running"
                      ? "Running..."
                      : draft.interactionMode === "plan"
                        ? "Plan"
                        : "Send"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default AgentSessionViewPresentational;
