import type { ReactNode, Ref } from "react";
import type {
  AgentProposedPlan,
  AgentSessionSnapshot,
  Project,
  WorkspaceMember,
  WorkspaceSession,
} from "../../../entities";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeAttachmentKind,
  AgentRuntimeCapabilities,
  AgentRuntimeEffort,
  AgentRuntimeInteractionMode,
  AgentRuntimeProviderTurnOptions,
  ChangesMode,
  GitChangeEntry,
} from "../../../shared";
import type { AgentTimelineItem } from "../lib/agentTimeline.pure";

export type AgentSidebarTab = "changes" | "linear" | "queue";

export interface AgentSessionTerminalContext {
  id: string;
  sourceSessionId: string;
  sourceSessionName: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  text: string;
  createdAtMs: number;
}

export interface AgentSessionComposerHandle {
  setText: (text: string) => void;
  addTerminalContext: (context: AgentSessionTerminalContext) => void;
  queueProposedPlan: (plan: AgentProposedPlan) => void;
}

export interface AgentSessionComposerAttachment extends AgentRuntimeAttachment {
  previewUrl?: string | null;
}

export interface AgentSessionComposerDraft {
  text: string;
  interactionMode: AgentRuntimeInteractionMode;
  attachments: AgentSessionComposerAttachment[];
  terminalContexts: AgentSessionTerminalContext[];
  sourceProposedPlanId: string | null;
  providerTurnOptions: AgentRuntimeProviderTurnOptions;
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
  pendingTerminalContext?: AgentSessionTerminalContext | null;
  onConsumePendingTerminalContext?: (contextId: string) => void;
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
      sourceProposedPlanId?: string;
      providerTurnOptions?: AgentRuntimeProviderTurnOptions;
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
  onImplementProposedPlan: (plan: AgentProposedPlan) => void;
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
  onImplementProposedPlan: (plan: AgentProposedPlan) => void;
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
