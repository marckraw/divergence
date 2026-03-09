import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgentSessionViewPresentational from "./AgentSessionView.presentational";
import type {
  AgentSessionComposerDraft,
  AgentSessionViewProps,
} from "./AgentSessionView.types";
import {
  getErrorMessage,
  supportsAgentRuntimeImageAttachments,
} from "../../../shared";

const DRAFT_STORAGE_KEY = "divergence-agent-session-drafts-v1";

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

function AgentSessionViewContainer(props: AgentSessionViewProps) {
  const [draftsBySessionId, setDraftsBySessionId] = useState<Record<string, AgentSessionComposerDraft>>(
    () => readStoredDrafts()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStagingAttachment, setIsStagingAttachment] = useState(false);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const [requestAnswers, setRequestAnswers] = useState<string[]>([]);
  const [isResolvingRequest, setIsResolvingRequest] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const sessionId = props.session.id;
  const currentDraft = useMemo(
    () => draftsBySessionId[sessionId] ?? createDefaultDraft(),
    [draftsBySessionId, sessionId]
  );
  const supportsImageAttachments = supportsAgentRuntimeImageAttachments(
    props.capabilities,
    props.session.provider,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftsBySessionId));
  }, [draftsBySessionId]);

  useEffect(() => {
    setIsSubmitting(false);
    setIsUpdatingModel(false);
    setIsResolvingRequest(false);
  }, [props.session.id]);

  useEffect(() => {
    const questions = props.session.pendingRequest?.questions ?? [];
    setRequestAnswers(questions.map(() => ""));
    setIsResolvingRequest(false);
  }, [props.session.pendingRequest?.id, props.session.pendingRequest?.questions]);

  const updateDraft = useCallback((
    updater: (draft: AgentSessionComposerDraft) => AgentSessionComposerDraft,
  ) => {
    setDraftsBySessionId((previous) => ({
      ...previous,
      [sessionId]: updater(previous[sessionId] ?? createDefaultDraft()),
    }));
  }, [sessionId]);

  const setAttachmentError = useCallback((message: string | null) => {
    updateDraft((draft) => ({
      ...draft,
      attachmentError: message,
    }));
  }, [updateDraft]);

  const stageFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }
    if (!supportsImageAttachments) {
      setAttachmentError(
        `${props.session.provider} image attachments are not supported in Divergence yet.`,
      );
      return;
    }

    setIsStagingAttachment(true);
    setAttachmentError(null);
    try {
      const stagedAttachments: AgentSessionComposerDraft["attachments"] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          continue;
        }
        const attachment = await props.onStageAttachment({
          sessionId,
          name: file.name || "image",
          mimeType: file.type,
          base64Content: await fileToBase64(file),
        });
        stagedAttachments.push(attachment);
      }

      if (stagedAttachments.length === 0) {
        setAttachmentError("Only image attachments are supported.");
        return;
      }

      updateDraft((draft) => ({
        ...draft,
        attachments: [...draft.attachments, ...stagedAttachments],
        attachmentError: null,
      }));
    } catch (error) {
      setAttachmentError(getErrorMessage(error, "Failed to stage image attachment."));
    } finally {
      setIsStagingAttachment(false);
    }
  }, [props, sessionId, setAttachmentError, supportsImageAttachments, updateDraft]);

  const handleSubmit = useCallback(async () => {
    const prompt = currentDraft.text.trim();
    if (!prompt || isSubmitting || props.session.pendingRequest) {
      return;
    }

    setIsSubmitting(true);
    try {
      await props.onSendPrompt(props.session.id, prompt, {
        interactionMode: currentDraft.interactionMode,
        attachments: currentDraft.attachments,
      });
      updateDraft((draft) => ({
        ...draft,
        text: "",
        attachments: [],
        attachmentError: null,
      }));
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [currentDraft, isSubmitting, props, updateDraft]);

  const handleDraftChange = useCallback((value: string) => {
    updateDraft((draft) => ({
      ...draft,
      text: value,
    }));
  }, [updateDraft]);

  const handleInteractionModeChange = useCallback((value: "default" | "plan") => {
    updateDraft((draft) => ({
      ...draft,
      interactionMode: value,
    }));
  }, [updateDraft]);

  const handleRequestAnswerChange = useCallback((index: number, value: string) => {
    setRequestAnswers((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }, []);

  const handleModelChange = useCallback(async (model: string) => {
    if (!model.trim() || isUpdatingModel || model === props.session.model) {
      return;
    }

    setIsUpdatingModel(true);
    try {
      await props.onUpdateModel(props.session.id, model);
    } finally {
      setIsUpdatingModel(false);
    }
  }, [isUpdatingModel, props]);

  const handleSubmitRequest = useCallback(async () => {
    const request = props.session.pendingRequest;
    if (!request || request.kind !== "user-input" || isResolvingRequest) {
      return;
    }

    setIsResolvingRequest(true);
    try {
      await props.onRespondToRequest(props.session.id, request.id, {
        answers: requestAnswers,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, props, requestAnswers]);

  const handleResolveApproval = useCallback(async (decisionId: string) => {
    const request = props.session.pendingRequest;
    if (!request || request.kind !== "approval" || isResolvingRequest) {
      return;
    }

    setIsResolvingRequest(true);
    try {
      await props.onRespondToRequest(props.session.id, request.id, {
        decision: decisionId,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, props]);

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
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    await stageFiles(files);
  }, [stageFiles]);

  const handleComposerDrop = useCallback(async (
    event: DragEvent<HTMLTextAreaElement>,
  ) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    await stageFiles(files);
  }, [stageFiles]);

  const handleComposerDragOver = useCallback((event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
  }, []);

  const handleRemoveAttachment = useCallback(async (attachmentId: string) => {
    try {
      await props.onDiscardAttachment(sessionId, attachmentId);
      updateDraft((draft) => ({
        ...draft,
        attachments: draft.attachments.filter((attachment) => attachment.id !== attachmentId),
        attachmentError: null,
      }));
      if (attachmentInputRef.current && currentDraft.attachments.length <= 1) {
        attachmentInputRef.current.value = "";
      }
    } catch (error) {
      setAttachmentError(getErrorMessage(error, "Failed to remove image attachment."));
    }
  }, [currentDraft.attachments.length, props, sessionId, setAttachmentError, updateDraft]);

  const handleTriggerAttachmentPicker = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);

  return (
    <AgentSessionViewPresentational
      {...props}
      draft={currentDraft}
      isSubmitting={isSubmitting}
      isStagingAttachment={isStagingAttachment}
      isUpdatingModel={isUpdatingModel}
      requestAnswers={requestAnswers}
      isResolvingRequest={isResolvingRequest}
      attachmentInputRef={attachmentInputRef}
      onDraftChange={handleDraftChange}
      onInteractionModeChange={handleInteractionModeChange}
      onModelChange={handleModelChange}
      onAttachmentInputChange={handleAttachmentInputChange}
      onComposerPaste={handleComposerPaste}
      onComposerDrop={handleComposerDrop}
      onComposerDragOver={handleComposerDragOver}
      onRemoveAttachment={handleRemoveAttachment}
      onTriggerAttachmentPicker={handleTriggerAttachmentPicker}
      onRequestAnswerChange={handleRequestAnswerChange}
      onSubmit={handleSubmit}
      onSubmitRequest={handleSubmitRequest}
      onResolveApproval={handleResolveApproval}
    />
  );
}

export default AgentSessionViewContainer;
