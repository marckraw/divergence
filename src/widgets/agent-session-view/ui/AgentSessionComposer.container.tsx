import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, RefObject } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import {
  Button,
  getAgentProviderLabel,
  getAgentRuntimeProviderAttachmentKinds,
  IconButton,
  SegmentedControl,
  supportsAgentRuntimePlanMode,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../shared";
import type { AgentRuntimeAttachment, AgentSkillDescriptor } from "../../../shared";
import {
  getErrorMessage,
} from "../../../shared";
import {
  buildAttachmentInputAccept,
  getAttachmentButtonLabel,
  supportsAttachmentMimeType,
} from "../lib/attachmentComposer.pure";
import { buildProposedPlanImplementationPrompt } from "../lib/agentProposedPlan.pure";
import { normalizeAgentProviderTurnOptions } from "../lib/agentProviderTraits.pure";
import {
  appendTerminalContextToPrompt,
  formatTerminalContextLineRange,
  sanitizeTerminalContexts,
} from "../lib/terminalContext.pure";
import { useAgentSkillDiscovery } from "../model/useAgentSkillDiscovery";
import AgentProviderTraitsMenuContainer from "./AgentProviderTraitsMenu.container";
import AgentSkillAutocompletePresentational from "./AgentSkillAutocomplete.presentational";
import type {
  AgentSessionComposerAttachment,
  AgentSessionComposerDraft,
  AgentSessionComposerHandle,
  AgentSessionComposerProps,
} from "./AgentSessionView.types";

const DRAFT_STORAGE_KEY = "divergence-agent-session-drafts-v2";
const DRAFT_PERSIST_DEBOUNCE_MS = 300;

function createDefaultDraft(): AgentSessionComposerDraft {
  return {
    text: "",
    interactionMode: "default",
    attachments: [],
    terminalContexts: [],
    sourceProposedPlanId: null,
    providerTurnOptions: {},
    attachmentError: null,
  };
}

function normalizeProviderTurnOptions(value: unknown): AgentSessionComposerDraft["providerTurnOptions"] {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as { codex?: { fastMode?: unknown } };
  if (candidate.codex?.fastMode === true) {
    return {
      codex: {
        fastMode: true,
      },
    };
  }

  return {};
}

function normalizeTerminalContexts(
  value: unknown,
): AgentSessionComposerDraft["terminalContexts"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return sanitizeTerminalContexts(
    value
      .filter((context): context is AgentSessionComposerDraft["terminalContexts"][number] => {
        if (!context || typeof context !== "object") {
          return false;
        }

        const candidate = context as Partial<AgentSessionComposerDraft["terminalContexts"][number]>;
        return typeof candidate.id === "string"
          && typeof candidate.sourceSessionId === "string"
          && typeof candidate.sourceSessionName === "string"
          && typeof candidate.text === "string"
          && typeof candidate.createdAtMs === "number";
      }),
  );
}

function normalizeAgentSessionComposerDraft(value: unknown): AgentSessionComposerDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AgentSessionComposerDraft>;
  if (
    typeof candidate.text !== "string"
    || (candidate.interactionMode !== "default" && candidate.interactionMode !== "plan")
    || !Array.isArray(candidate.attachments)
    || (candidate.attachmentError !== null && typeof candidate.attachmentError !== "string" && candidate.attachmentError !== undefined)
  ) {
    return null;
  }

  return {
    text: candidate.text,
    interactionMode: candidate.interactionMode,
    attachments: candidate.attachments as AgentSessionComposerAttachment[],
    terminalContexts: normalizeTerminalContexts(candidate.terminalContexts),
    sourceProposedPlanId: typeof candidate.sourceProposedPlanId === "string"
      ? candidate.sourceProposedPlanId
      : null,
    providerTurnOptions: normalizeProviderTurnOptions(candidate.providerTurnOptions),
    attachmentError: candidate.attachmentError ?? null,
  };
}

function areProviderTurnOptionsEqual(
  left: AgentSessionComposerDraft["providerTurnOptions"],
  right: AgentSessionComposerDraft["providerTurnOptions"],
): boolean {
  return left.codex?.fastMode === right.codex?.fastMode;
}

function areTerminalContextsEqual(
  left: AgentSessionComposerDraft["terminalContexts"],
  right: AgentSessionComposerDraft["terminalContexts"],
): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }

  return left.every((context, index) => {
    const next = right[index];
    return next
      && context.id === next.id
      && context.sourceSessionId === next.sourceSessionId
      && context.sourceSessionName === next.sourceSessionName
      && context.lineStart === next.lineStart
      && context.lineEnd === next.lineEnd
      && context.text === next.text
      && context.createdAtMs === next.createdAtMs;
  });
}

function stripDraftAttachmentPreview(
  attachment: AgentSessionComposerAttachment,
): AgentRuntimeAttachment {
  const runtimeAttachment = { ...attachment };
  delete runtimeAttachment.previewUrl;
  return runtimeAttachment;
}

function revokeDraftAttachmentPreview(attachment: AgentSessionComposerAttachment): void {
  if (!attachment.previewUrl?.startsWith("blob:")) {
    return;
  }
  URL.revokeObjectURL(attachment.previewUrl);
}

function readStoredDrafts(): Record<string, AgentSessionComposerDraft> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, normalizeAgentSessionComposerDraft(value)])
        .filter(([, value]) => value !== null),
    ) as Record<string, AgentSessionComposerDraft>;
  } catch {
    return {};
  }
}

function writeStoredDraft(sessionId: string, draft: AgentSessionComposerDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  const drafts = readStoredDrafts();
  drafts[sessionId] = {
    ...draft,
    attachments: draft.attachments.map(stripDraftAttachmentPreview),
  };
  window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
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

function getAttachmentKindLabel(kind: "image" | "pdf"): string {
  return kind === "pdf" ? "PDF" : "Image";
}

function getAttachmentSupportMessage(
  providerLabel: string,
  supportedAttachmentKinds: ReturnType<typeof getAgentRuntimeProviderAttachmentKinds>,
): string {
  if (supportedAttachmentKinds.length === 0) {
    return `${providerLabel} attachments are not supported in Divergence yet.`;
  }
  if (supportedAttachmentKinds.length === 1 && supportedAttachmentKinds[0] === "image") {
    return `${providerLabel} currently supports image attachments only.`;
  }
  if (supportedAttachmentKinds.length === 1 && supportedAttachmentKinds[0] === "pdf") {
    return `${providerLabel} currently supports PDF attachments only.`;
  }
  return `${providerLabel} currently supports image and PDF attachments.`;
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

const AgentSessionComposerContainer = forwardRef<AgentSessionComposerHandle, AgentSessionComposerProps>(function AgentSessionComposerContainer({
  session,
  capabilities,
  onSendPrompt,
  onStageAttachment,
  onDiscardAttachment,
}, ref) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<AgentSessionComposerDraft>(() => {
    const storedDraft = readStoredDrafts()[session.id];
    return storedDraft ?? createDefaultDraft();
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStagingAttachment, setIsStagingAttachment] = useState(false);
  const draftRef = useRef(draft);

  const skillDiscovery = useAgentSkillDiscovery(session.path);
  const [skillAutocompleteOpen, setSkillAutocompleteOpen] = useState(false);
  const [skillSelectedIndex, setSkillSelectedIndex] = useState(0);

  const slashQuery = useMemo(() => {
    const text = draft.text;
    if (!text.startsWith("/")) {
      return null;
    }
    const spaceIndex = text.indexOf(" ");
    if (spaceIndex === -1) {
      return text.slice(1);
    }
    return null;
  }, [draft.text]);

  const { skills: discoveredSkills, updateFilter: updateSkillFilter } = skillDiscovery;

  useEffect(() => {
    if (slashQuery !== null && discoveredSkills.length > 0) {
      updateSkillFilter(slashQuery);
      setSkillAutocompleteOpen(true);
      setSkillSelectedIndex(0);
    } else {
      setSkillAutocompleteOpen(false);
    }
  }, [slashQuery, discoveredSkills.length, updateSkillFilter]);

  const handleSkillSelect = useCallback((skill: AgentSkillDescriptor) => {
    setDraft((previous) => ({
      ...previous,
      text: `/${skill.name} `,
    }));
    setSkillAutocompleteOpen(false);
  }, []);

  useImperativeHandle(ref, () => ({
    setText(text: string) {
      setDraft((prev) => ({ ...prev, text }));
    },
    addTerminalContext(context) {
      setDraft((previous) => ({
        ...previous,
        terminalContexts: sanitizeTerminalContexts([
          ...previous.terminalContexts.filter((existing) => existing.id !== context.id),
          context,
        ]),
      }));
    },
    queueProposedPlan(plan) {
      setDraft((previous) => ({
        ...previous,
        text: previous.text.trim() ? previous.text : buildProposedPlanImplementationPrompt(plan),
        interactionMode: "default",
        sourceProposedPlanId: plan.id,
      }));
    },
  }), []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    return () => {
      draftRef.current.attachments.forEach(revokeDraftAttachmentPreview);
      writeStoredDraft(session.id, draftRef.current);
    };
  }, [session.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      writeStoredDraft(session.id, draft);
    }, DRAFT_PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [draft, session.id]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      writeStoredDraft(session.id, draftRef.current);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [session.id]);

  const supportedAttachmentKinds = useMemo(
    () => getAgentRuntimeProviderAttachmentKinds(capabilities, session.provider),
    [capabilities, session.provider],
  );
  const attachmentInputAccept = useMemo(
    () => buildAttachmentInputAccept(supportedAttachmentKinds),
    [supportedAttachmentKinds],
  );
  const attachmentButtonLabel = useMemo(
    () => getAttachmentButtonLabel(supportedAttachmentKinds),
    [supportedAttachmentKinds],
  );
  const supportsPlanMode = supportsAgentRuntimePlanMode(capabilities, session.provider);
  const supportsAttachments = supportedAttachmentKinds.length > 0;
  const attachmentSupportMessage = getAttachmentSupportMessage(
    getAgentProviderLabel(session.provider),
    supportedAttachmentKinds,
  );

  const updateDraft = useCallback((updater: (previous: AgentSessionComposerDraft) => AgentSessionComposerDraft) => {
    setDraft((previous) => updater(previous));
  }, []);

  useEffect(() => {
    updateDraft((previous) => {
      const terminalContexts = sanitizeTerminalContexts(previous.terminalContexts);
      const providerTurnOptions = normalizeAgentProviderTurnOptions(
        session.provider,
        session.model,
        previous.providerTurnOptions,
      );
      const sourcePlanIsStillActive = previous.sourceProposedPlanId
        ? session.proposedPlans.some((plan) => (
          plan.id === previous.sourceProposedPlanId && plan.status === "proposed"
        ))
        : false;
      const nextInteractionMode = supportsPlanMode ? previous.interactionMode : "default";
      const nextDraft: AgentSessionComposerDraft = {
        ...previous,
        interactionMode: nextInteractionMode,
        terminalContexts,
        sourceProposedPlanId: sourcePlanIsStillActive ? previous.sourceProposedPlanId : null,
        providerTurnOptions,
      };

      if (
        nextDraft.interactionMode === previous.interactionMode
        && nextDraft.sourceProposedPlanId === previous.sourceProposedPlanId
        && areTerminalContextsEqual(nextDraft.terminalContexts, previous.terminalContexts)
        && areProviderTurnOptionsEqual(nextDraft.providerTurnOptions, previous.providerTurnOptions)
      ) {
        return previous;
      }

      return nextDraft;
    });
  }, [session.model, session.proposedPlans, session.provider, supportsPlanMode, updateDraft]);

  const setAttachmentError = useCallback((message: string | null) => {
    updateDraft((previous) => ({
      ...previous,
      attachmentError: message,
    }));
  }, [updateDraft]);

  const stageFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }
    if (supportedAttachmentKinds.length === 0) {
      setAttachmentError(
        `${session.provider} attachments are not supported in Divergence yet.`,
      );
      return;
    }

    setIsStagingAttachment(true);
    setAttachmentError(null);
    const createdPreviewUrls: string[] = [];
    try {
      const stagedAttachments: AgentSessionComposerAttachment[] = [];
      for (const file of files) {
        if (!supportsAttachmentMimeType(file.type, supportedAttachmentKinds)) {
          continue;
        }
        const attachment = await onStageAttachment({
          sessionId: session.id,
          name: file.name || "attachment",
          mimeType: file.type,
          base64Content: await fileToBase64(file),
        });
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        if (previewUrl) {
          createdPreviewUrls.push(previewUrl);
        }
        stagedAttachments.push({
          ...attachment,
          previewUrl,
        });
      }

      if (stagedAttachments.length === 0) {
        setAttachmentError("Only supported attachment types can be added for this provider.");
        return;
      }

      updateDraft((previous) => ({
        ...previous,
        attachments: [...previous.attachments, ...stagedAttachments],
        attachmentError: null,
      }));
      createdPreviewUrls.length = 0;
    } catch (error) {
      createdPreviewUrls.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
      });
      setAttachmentError(getErrorMessage(error, "Failed to stage attachment."));
    } finally {
      setIsStagingAttachment(false);
    }
  }, [onStageAttachment, session.id, session.provider, setAttachmentError, supportedAttachmentKinds, updateDraft]);

  const handleSubmit = useCallback(async () => {
    const prompt = appendTerminalContextToPrompt(draft.text, draft.terminalContexts);
    if (!prompt || isSubmitting || session.pendingRequest || session.runtimeStatus === "running") {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSendPrompt(session.id, prompt, {
        interactionMode: draft.interactionMode,
        attachments: draft.attachments.map(stripDraftAttachmentPreview),
        sourceProposedPlanId: draft.interactionMode === "plan"
          ? undefined
          : draft.sourceProposedPlanId ?? undefined,
        providerTurnOptions: normalizeAgentProviderTurnOptions(
          session.provider,
          session.model,
          draft.providerTurnOptions,
        ),
      });
      draft.attachments.forEach(revokeDraftAttachmentPreview);
      const nextDraft = {
        ...draft,
        text: "",
        attachments: [],
        terminalContexts: [],
        sourceProposedPlanId: null,
        providerTurnOptions: {},
        attachmentError: null,
      };
      setDraft(nextDraft);
      writeStoredDraft(session.id, nextDraft);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, isSubmitting, onSendPrompt, session.id, session.model, session.pendingRequest, session.provider, session.runtimeStatus]);

  const handleAttachmentInputChange = useCallback(async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    await stageFiles(files);
    event.target.value = "";
  }, [stageFiles]);

  const handleComposerPaste = useCallback(async (
    event: ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(
        (file): file is File => file !== null
          && supportsAttachmentMimeType(file.type, supportedAttachmentKinds),
      );
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    await stageFiles(files);
  }, [stageFiles, supportedAttachmentKinds]);

  const handleComposerDrop = useCallback(async (
    event: DragEvent<HTMLTextAreaElement>,
  ) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter(
      (file) => supportsAttachmentMimeType(file.type, supportedAttachmentKinds),
    );
    await stageFiles(files);
  }, [stageFiles, supportedAttachmentKinds]);

  const handleComposerDragOver = useCallback((event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
  }, []);

  const handleRemoveAttachment = useCallback(async (attachmentId: string) => {
    try {
      const attachmentToRemove = draft.attachments.find((attachment) => attachment.id === attachmentId);
      await onDiscardAttachment(session.id, attachmentId);
      if (attachmentToRemove) {
        revokeDraftAttachmentPreview(attachmentToRemove);
      }
      updateDraft((previous) => ({
        ...previous,
        attachments: previous.attachments.filter((attachment) => attachment.id !== attachmentId),
        attachmentError: null,
      }));
      if (attachmentInputRef.current && draft.attachments.length <= 1) {
        attachmentInputRef.current.value = "";
      }
    } catch (error) {
      setAttachmentError(getErrorMessage(error, "Failed to remove attachment."));
    }
  }, [draft.attachments, onDiscardAttachment, session.id, setAttachmentError, updateDraft]);

  const handleRemoveTerminalContext = useCallback((contextId: string) => {
    updateDraft((previous) => ({
      ...previous,
      terminalContexts: previous.terminalContexts.filter((context) => context.id !== contextId),
    }));
  }, [updateDraft]);

  const handleClearSourceProposedPlan = useCallback(() => {
    updateDraft((previous) => ({
      ...previous,
      sourceProposedPlanId: null,
    }));
  }, [updateDraft]);

  const sourceProposedPlan = useMemo(
    () => (
      draft.sourceProposedPlanId
        ? session.proposedPlans.find((plan) => plan.id === draft.sourceProposedPlanId) ?? null
        : null
    ),
    [draft.sourceProposedPlanId, session.proposedPlans],
  );

  return (
    <div className="border-t border-surface bg-sidebar/70 px-3 py-3 sm:px-5 sm:py-4">
      <div className="mx-auto w-full max-w-5xl space-y-3">
        {!session.pendingRequest && (
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
                    updateDraft((previous) => ({
                      ...previous,
                      interactionMode: value,
                    }));
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <AgentProviderTraitsMenuContainer
                  session={session}
                  draftOptions={draft.providerTurnOptions}
                  onChange={(nextOptions) => {
                    updateDraft((previous) => ({
                      ...previous,
                      providerTurnOptions: nextOptions,
                    }));
                  }}
                />
                <input
                  ref={attachmentInputRef as RefObject<HTMLInputElement>}
                  type="file"
                  accept={attachmentInputAccept ?? undefined}
                  multiple
                  className="hidden"
                  onChange={handleAttachmentInputChange}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={!supportsAttachments || isSubmitting || isStagingAttachment}
                  title={attachmentSupportMessage}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  {isStagingAttachment ? "Staging..." : attachmentButtonLabel}
                </Button>
              </div>
            </div>
            {(sourceProposedPlan || draft.terminalContexts.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {sourceProposedPlan && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] text-text">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-accent">
                      Plan
                    </span>
                    <span className="max-w-[18rem] truncate">
                      {sourceProposedPlan.title?.trim() || "Implement proposed plan"}
                    </span>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      icon={<X className="h-3.5 w-3.5" />}
                      label="Clear selected plan"
                      onClick={handleClearSourceProposedPlan}
                    />
                  </div>
                )}
                {draft.terminalContexts.map((context) => {
                  const lineRange = formatTerminalContextLineRange(context);
                  const label = lineRange
                    ? `${context.sourceSessionName} ${lineRange}`
                    : context.sourceSessionName;
                  return (
                    <div
                      key={context.id}
                      className="inline-flex items-center gap-2 rounded-full border border-surface/80 bg-main/60 px-3 py-1 text-[11px] text-subtext"
                    >
                      <span className="max-w-[20rem] truncate">{label}</span>
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        icon={<X className="h-3.5 w-3.5" />}
                        label={`Remove ${label}`}
                        onClick={() => {
                          handleRemoveTerminalContext(context.id);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {draft.attachments.length > 0 && (
              <TooltipProvider delayDuration={120}>
                <div className="flex flex-wrap gap-2">
                  {draft.attachments.map((attachment) => (
                    <Tooltip key={attachment.id}>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2 rounded-full border border-surface/80 bg-main/60 px-3 py-1 text-[11px] text-subtext">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="max-w-[18rem] truncate">{attachment.name}</span>
                          <span>{formatAttachmentSize(attachment.sizeBytes)}</span>
                          <span className="rounded-full border border-surface/80 bg-sidebar/70 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-subtext">
                            {getAttachmentKindLabel(attachment.kind)}
                          </span>
                          <IconButton
                            type="button"
                            variant="ghost"
                            size="xs"
                            icon={<X className="h-3.5 w-3.5" />}
                            label={`Remove ${attachment.name}`}
                            onClick={() => { void handleRemoveAttachment(attachment.id); }}
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
            )}
            {draft.attachmentError && (
              <div className="rounded-xl border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
                {draft.attachmentError}
              </div>
            )}
            {!supportsAttachments && (
              <p className="text-xs text-subtext">
                {attachmentSupportMessage}
              </p>
            )}
            <div className="relative">
              {skillAutocompleteOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1 w-full max-w-xl rounded-xl border border-surface bg-sidebar shadow-lg">
                  <AgentSkillAutocompletePresentational
                    skills={skillDiscovery.matchingSkills}
                    selectedIndex={skillSelectedIndex}
                    onSelect={handleSkillSelect}
                  />
                </div>
              )}
              <Textarea
                value={draft.text}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    text: event.target.value,
                  }));
                }}
                onBlur={() => {
                  writeStoredDraft(session.id, draftRef.current);
                }}
                onPaste={(event) => {
                  void handleComposerPaste(event);
                }}
                onDrop={(event) => {
                  void handleComposerDrop(event);
                }}
                onDragOver={handleComposerDragOver}
                onKeyDown={(event) => {
                  if (skillAutocompleteOpen && skillDiscovery.matchingSkills.length > 0) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setSkillSelectedIndex((previous) =>
                        previous < skillDiscovery.matchingSkills.length - 1 ? previous + 1 : 0,
                      );
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setSkillSelectedIndex((previous) =>
                        previous > 0 ? previous - 1 : skillDiscovery.matchingSkills.length - 1,
                      );
                      return;
                    }
                    if (event.key === "Enter" || event.key === "Tab") {
                      event.preventDefault();
                      handleSkillSelect(skillDiscovery.matchingSkills[skillSelectedIndex]);
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setSkillAutocompleteOpen(false);
                      return;
                    }
                  }
                  if (
                    isInteractionModeShortcut(event)
                    && supportsPlanMode
                    && !isSubmitting
                    && session.runtimeStatus !== "running"
                  ) {
                    event.preventDefault();
                    updateDraft((previous) => ({
                      ...previous,
                      interactionMode: previous.interactionMode === "plan" ? "default" : "plan",
                    }));
                    return;
                  }
                  if (!isSubmitShortcut(event)) {
                    return;
                  }
                  event.preventDefault();
                  void handleSubmit();
                }}
                placeholder={
                  draft.interactionMode === "plan"
                    ? `Ask ${session.provider} to investigate and plan work in ${session.path}`
                    : `Ask ${session.provider} to work in ${session.path}`
                }
                className="min-h-[112px] resize-y rounded-2xl bg-main/80"
              />
            </div>
          </>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-subtext">
            {session.pendingRequest
              ? `Waiting on ${session.pendingRequest.kind}`
              : `Runtime prompt input. ${
                draft.interactionMode === "plan" ? "Plan turn enabled." : "Chat turn enabled."
              } Shift+Tab toggles mode. Cmd/Ctrl+Enter to send`}
          </p>
          {!session.pendingRequest && (
            <Button
              type="button"
              onClick={() => { void handleSubmit(); }}
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
  );
});

export default AgentSessionComposerContainer;
