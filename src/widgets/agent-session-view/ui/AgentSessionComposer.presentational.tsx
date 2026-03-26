import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, RefObject, ReactNode } from "react";
import { Paperclip } from "lucide-react";
import {
  Button,
  ErrorBanner,
  SegmentedControl,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../shared";
import AttachmentChip from "./AttachmentChip.presentational";
import AgentSessionComposerFooter from "./AgentSessionComposerFooter.presentational";
import type {
  AgentSessionComposerDraft,
} from "./AgentSessionView.types";

interface AgentSessionComposerPresentationalProps {
  sessionPath: string;
  provider: string;
  pendingRequestKind: string | null;
  runtimeStatus: string;
  draft: AgentSessionComposerDraft;
  supportsPlanMode: boolean;
  supportsAttachments: boolean;
  attachmentButtonLabel: string;
  attachmentInputAccept: string | null;
  attachmentSupportMessage: string;
  isSubmitting: boolean;
  isStagingAttachment: boolean;
  attachmentInputRef: RefObject<HTMLInputElement>;
  onAttachmentInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInteractionModeChange: (value: "default" | "plan") => void;
  onOpenAttachmentPicker: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onTextChange: (value: string) => void;
  onBlur: () => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop: (event: DragEvent<HTMLTextAreaElement>) => void;
  onDragOver: (event: DragEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  formatAttachmentSize: (sizeBytes: number) => string;
  getAttachmentKindLabel: (kind: "image" | "pdf") => string;
  autocomplete: ReactNode;
}

function AgentSessionComposerPresentational({
  sessionPath,
  provider,
  pendingRequestKind,
  runtimeStatus,
  draft,
  supportsPlanMode,
  supportsAttachments,
  attachmentButtonLabel,
  attachmentInputAccept,
  attachmentSupportMessage,
  isSubmitting,
  isStagingAttachment,
  attachmentInputRef,
  onAttachmentInputChange,
  onInteractionModeChange,
  onOpenAttachmentPicker,
  onRemoveAttachment,
  onTextChange,
  onBlur,
  onPaste,
  onDrop,
  onDragOver,
  onKeyDown,
  onSubmit,
  formatAttachmentSize,
  getAttachmentKindLabel,
  autocomplete,
}: AgentSessionComposerPresentationalProps) {
  const isRunning = runtimeStatus === "running";
  const interactionModeLabel =
    draft.interactionMode === "plan" ? "Plan turn enabled." : "Chat turn enabled.";

  return (
    <div className="border-t border-surface bg-sidebar/70 px-3 py-3 sm:px-5 sm:py-4">
      <div className="mx-auto w-full max-w-5xl space-y-3">
        {!pendingRequestKind ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className={!supportsPlanMode || isSubmitting || isRunning ? "pointer-events-none opacity-60" : undefined}
              >
                <SegmentedControl
                  items={[
                    { id: "default" as const, label: "Chat" },
                    { id: "plan" as const, label: "Plan" },
                  ]}
                  value={draft.interactionMode}
                  onChange={onInteractionModeChange}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept={attachmentInputAccept ?? undefined}
                  multiple
                  className="hidden"
                  onChange={onAttachmentInputChange}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenAttachmentPicker}
                  disabled={!supportsAttachments || isSubmitting || isStagingAttachment}
                  title={attachmentSupportMessage}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  {isStagingAttachment ? "Staging..." : attachmentButtonLabel}
                </Button>
              </div>
            </div>
            {draft.attachments.length > 0 ? (
              <TooltipProvider delayDuration={120}>
                <div className="flex flex-wrap gap-2">
                  {draft.attachments.map((attachment) => (
                    <Tooltip key={attachment.id}>
                      <TooltipTrigger asChild>
                        <div>
                          <AttachmentChip
                            attachment={attachment}
                            secondaryLabel={formatAttachmentSize(attachment.sizeBytes)}
                            kindLabel={getAttachmentKindLabel(attachment.kind)}
                            onRemove={() => onRemoveAttachment(attachment.id)}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="start"
                        className="w-[18rem] rounded-xl border border-surface/80 bg-sidebar/95 p-3 text-left"
                      >
                        <div className="space-y-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">
                              {getAttachmentKindLabel(attachment.kind)} Attachment
                            </p>
                            <p className="mt-1 truncate text-sm text-text">{attachment.name}</p>
                          </div>
                          {attachment.kind === "image" && attachment.previewUrl ? (
                            <img
                              src={attachment.previewUrl}
                              alt={attachment.name}
                              className="max-h-[16rem] w-full rounded-lg border border-surface/80 object-contain"
                            />
                          ) : (
                            <div className="rounded-lg border border-surface/80 bg-main/70 px-3 py-3 text-xs text-subtext">
                              <p>Type: {attachment.mimeType}</p>
                              <p className="mt-1">Size: {formatAttachmentSize(attachment.sizeBytes)}</p>
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            ) : null}
            {draft.attachmentError ? <ErrorBanner>{draft.attachmentError}</ErrorBanner> : null}
            {!supportsAttachments ? <p className="text-xs text-subtext">{attachmentSupportMessage}</p> : null}
            <div className="relative">
              {autocomplete}
              <Textarea
                value={draft.text}
                onChange={(event) => onTextChange(event.target.value)}
                onBlur={onBlur}
                onPaste={onPaste}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onKeyDown={onKeyDown}
                placeholder={
                  draft.interactionMode === "plan"
                    ? `Ask ${provider} to investigate and plan work in ${sessionPath}`
                    : `Ask ${provider} to work in ${sessionPath}`
                }
                className="min-h-[112px] resize-y rounded-2xl bg-main/80"
              />
            </div>
          </>
        ) : null}
        <AgentSessionComposerFooter
          pendingRequestLabel={pendingRequestKind}
          interactionModeLabel={interactionModeLabel}
          isSubmitting={isSubmitting}
          isStagingAttachment={isStagingAttachment}
          isRunning={isRunning}
          canSubmit={Boolean(draft.text.trim())}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

export default AgentSessionComposerPresentational;
