import type { ChangeEvent, ClipboardEvent, DragEvent, RefObject } from "react";
import type { AgentSessionSnapshot, WorkspaceSession } from "../../../entities";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeCapabilities,
  AgentRuntimeInteractionMode,
} from "../../../shared";

export interface AgentSessionComposerDraft {
  text: string;
  interactionMode: AgentRuntimeInteractionMode;
  attachments: AgentRuntimeAttachment[];
  attachmentError: string | null;
}

export interface AgentSessionViewProps {
  session: AgentSessionSnapshot;
  sessionList: WorkspaceSession[];
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  capabilities: AgentRuntimeCapabilities | null;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onUpdateModel: (sessionId: string, model: string) => Promise<void>;
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

export interface AgentSessionViewPresentationalProps extends AgentSessionViewProps {
  draft: AgentSessionComposerDraft;
  isSubmitting: boolean;
  isStagingAttachment: boolean;
  isUpdatingModel: boolean;
  requestAnswers: string[];
  isResolvingRequest: boolean;
  attachmentInputRef: RefObject<HTMLInputElement | null>;
  onDraftChange: (value: string) => void;
  onInteractionModeChange: (value: AgentRuntimeInteractionMode) => void;
  onModelChange: (model: string) => Promise<void>;
  onAttachmentInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onComposerDrop: (event: DragEvent<HTMLTextAreaElement>) => void;
  onComposerDragOver: (event: DragEvent<HTMLTextAreaElement>) => void;
  onRemoveAttachment: (attachmentId: string) => Promise<void>;
  onTriggerAttachmentPicker: () => void;
  onRequestAnswerChange: (index: number, value: string) => void;
  onSubmit: () => Promise<void>;
  onSubmitRequest: () => Promise<void>;
  onResolveApproval: (decisionId: string) => Promise<void>;
}
