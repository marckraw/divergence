import type { ReactNode, Ref } from "react";
import type { AgentSessionSnapshot, Project, WorkspaceMember, WorkspaceSession } from "../../../entities";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeAttachmentKind,
  AgentRuntimeCapabilities,
  AgentRuntimeEffort,
  AgentRuntimeInteractionMode,
  ChangesMode,
  GitChangeEntry,
} from "../../../shared";
import type { AgentTimelineItem } from "../lib/agentTimeline.pure";

export type AgentSidebarTab = "changes" | "linear" | "queue";

export interface AgentSessionComposerHandle {
  setText: (text: string) => void;
}

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
  dismissedAttentionKeyBySessionId: Map<string, string>;
  capabilities: AgentRuntimeCapabilities | null;
  projects: Project[];
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>;
  onSelectSession: (sessionId: string) => void;
  onDismissSessionAttention: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onUpdateSessionSettings: (sessionId: string, input: {
    model?: string;
    effort?: AgentRuntimeEffort;
  }) => Promise<void>;
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
  isUpdatingSessionSettings: boolean;
  onModelChange: (model: string) => Promise<void>;
  onEffortChange: (effort: AgentRuntimeEffort) => Promise<void>;
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
  dismissedAttentionKeyBySessionId: Map<string, string>;
  capabilities: AgentRuntimeCapabilities | null;
  timelineItems: AgentTimelineItem[];
  isUpdatingSessionSettings: boolean;
  requestAnswers: string[];
  isResolvingRequest: boolean;
  changesSidebarVisible: boolean;
  activeChangedFilePath: string | null;
  changeDrawer: ReactNode;
  sidebarTab: AgentSidebarTab;
  linearPanel: ReactNode;
  queuePanel: ReactNode;
  composerRef: Ref<AgentSessionComposerHandle>;
  onSelectSession: (sessionId: string) => void;
  onDismissSessionAttention: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onModelChange: (model: string) => Promise<void>;
  onEffortChange: (effort: AgentRuntimeEffort) => Promise<void>;
  onSubmitRequest: () => Promise<void>;
  onResolveApproval: (decisionId: string) => Promise<void>;
  onRequestAnswerChange: (index: number, value: string) => void;
  onToggleChangesSidebar: () => void;
  onCloseChangesSidebar: () => void;
  onSidebarTabChange: (tab: AgentSidebarTab) => void;
  onOpenChangedFile: (entry: GitChangeEntry, mode: ChangesMode) => Promise<void>;
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
