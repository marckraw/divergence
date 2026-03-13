import type { AgentSessionSnapshot, WorkspaceSession } from "../../../entities";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeAttachmentKind,
  AgentRuntimeCapabilities,
  AgentRuntimeInteractionMode,
} from "../../../shared";
import type { AgentTimelineItem } from "../lib/agentTimeline.pure";

export interface AgentSessionComposerAttachment extends AgentRuntimeAttachment {
  previewUrl?: string | null;
}

export interface AgentSessionComposerDraft {
  text: string;
  interactionMode: AgentRuntimeInteractionMode;
  attachments: AgentSessionComposerAttachment[];
  attachmentError: string | null;
}

export interface AgentSessionViewProps {
  sessionId: string;
  sessionList: WorkspaceSession[];
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  lastViewedRuntimeEventAtMsBySessionId: Map<string, number>;
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

export interface AgentSessionHeaderProps {
  session: AgentSessionSnapshot;
  capabilities: AgentRuntimeCapabilities | null;
  isUpdatingModel: boolean;
  onModelChange: (model: string) => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
}

export interface AgentSessionTimelineProps {
  session: AgentSessionSnapshot;
  timelineItems: AgentTimelineItem[];
}

export interface AgentSessionComposerProps {
  session: AgentSessionSnapshot;
  capabilities: AgentRuntimeCapabilities | null;
  onSendPrompt: AgentSessionViewProps["onSendPrompt"];
  onStageAttachment: AgentSessionViewProps["onStageAttachment"];
  onDiscardAttachment: AgentSessionViewProps["onDiscardAttachment"];
}

export interface AgentSessionPendingRequestProps {
  session: AgentSessionSnapshot;
  requestAnswers: string[];
  isResolvingRequest: boolean;
  onRequestAnswerChange: (index: number, value: string) => void;
  onSubmitRequest: () => Promise<void>;
  onResolveApproval: (decisionId: string) => Promise<void>;
}

export interface AgentSessionViewPresentationalProps {
  session: AgentSessionSnapshot;
  sessionList: WorkspaceSession[];
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  lastViewedRuntimeEventAtMsBySessionId: Map<string, number>;
  capabilities: AgentRuntimeCapabilities | null;
  timelineItems: AgentTimelineItem[];
  isUpdatingModel: boolean;
  requestAnswers: string[];
  isResolvingRequest: boolean;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onModelChange: (model: string) => Promise<void>;
  onSubmitRequest: () => Promise<void>;
  onResolveApproval: (decisionId: string) => Promise<void>;
  onRequestAnswerChange: (index: number, value: string) => void;
  onSendPrompt: AgentSessionViewProps["onSendPrompt"];
  onStageAttachment: AgentSessionViewProps["onStageAttachment"];
  onDiscardAttachment: AgentSessionViewProps["onDiscardAttachment"];
  onStopSession: (sessionId: string) => Promise<void>;
}

export interface AgentComposerAttachmentUiState {
  supportedAttachmentKinds: AgentRuntimeAttachmentKind[];
  attachmentInputAccept: string | null;
  attachmentButtonLabel: string;
  supportsPlanMode: boolean;
  supportsAttachments: boolean;
  attachmentSupportMessage: string;
}
