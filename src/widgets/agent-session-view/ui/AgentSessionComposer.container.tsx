import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, RefObject } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  getAgentProviderLabel,
  getAgentRuntimeProviderAttachmentKinds,
  supportsAgentRuntimePlanMode,
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
import { useAgentSkillDiscovery } from "../model/useAgentSkillDiscovery";
import AgentSessionComposerPresentational from "./AgentSessionComposer.presentational";
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
    attachmentError: null,
  };
}

function isAgentSessionComposerDraft(value: unknown): value is AgentSessionComposerDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AgentSessionComposerDraft>;
  return typeof candidate.text === "string"
    && (candidate.interactionMode === "default" || candidate.interactionMode === "plan")
    && Array.isArray(candidate.attachments)
    && (candidate.attachmentError === null || typeof candidate.attachmentError === "string");
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
        .filter(([, value]) => isAgentSessionComposerDraft(value))
        .map(([key, value]) => [key, value]),
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
    const prompt = draft.text.trim();
    if (!prompt || isSubmitting || session.pendingRequest || session.runtimeStatus === "running") {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSendPrompt(session.id, prompt, {
        interactionMode: draft.interactionMode,
        attachments: draft.attachments.map(stripDraftAttachmentPreview),
      });
      draft.attachments.forEach(revokeDraftAttachmentPreview);
      const nextDraft = {
        ...draft,
        text: "",
        attachments: [],
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
  }, [draft, isSubmitting, onSendPrompt, session.id, session.pendingRequest, session.runtimeStatus]);

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

  return (
    <AgentSessionComposerPresentational
      sessionPath={session.path}
      provider={session.provider}
      pendingRequestKind={session.pendingRequest?.kind ?? null}
      runtimeStatus={session.runtimeStatus}
      draft={draft}
      supportsPlanMode={supportsPlanMode}
      supportsAttachments={supportsAttachments}
      attachmentButtonLabel={attachmentButtonLabel}
      attachmentInputAccept={attachmentInputAccept}
      attachmentSupportMessage={attachmentSupportMessage}
      isSubmitting={isSubmitting}
      isStagingAttachment={isStagingAttachment}
      attachmentInputRef={attachmentInputRef as RefObject<HTMLInputElement>}
      onAttachmentInputChange={(event) => {
        void handleAttachmentInputChange(event);
      }}
      onInteractionModeChange={(value) => {
        if (!supportsPlanMode || isSubmitting || session.runtimeStatus === "running") {
          return;
        }
        updateDraft((previous) => ({
          ...previous,
          interactionMode: value,
        }));
      }}
      onOpenAttachmentPicker={() => attachmentInputRef.current?.click()}
      onRemoveAttachment={(attachmentId) => {
        void handleRemoveAttachment(attachmentId);
      }}
      onTextChange={(value) => {
        setDraft((previous) => ({
          ...previous,
          text: value,
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
              previous < skillDiscovery.matchingSkills.length - 1 ? previous + 1 : 0
            );
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSkillSelectedIndex((previous) =>
              previous > 0 ? previous - 1 : skillDiscovery.matchingSkills.length - 1
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
          isInteractionModeShortcut(event) &&
          supportsPlanMode &&
          !isSubmitting &&
          session.runtimeStatus !== "running"
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
      onSubmit={() => {
        void handleSubmit();
      }}
      formatAttachmentSize={formatAttachmentSize}
      getAttachmentKindLabel={getAttachmentKindLabel}
      autocomplete={
        skillAutocompleteOpen ? (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-full max-w-xl rounded-xl border border-surface bg-sidebar shadow-lg">
            <AgentSkillAutocompletePresentational
              skills={skillDiscovery.matchingSkills}
              selectedIndex={skillSelectedIndex}
              onSelect={handleSkillSelect}
            />
          </div>
        ) : null
      }
    />
  );
});

export default AgentSessionComposerContainer;
