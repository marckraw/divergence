import type {
  AgentRuntimeAttachment,
  AgentRuntimeConversationContext,
  AgentRuntimeDebugEvent,
  AgentRuntimeEffort,
  AgentRuntimeInteractionMode,
  AgentRuntimeProposedPlan,
  AgentRuntimeProvider,
  AgentRuntimeSessionNameMode,
} from "../../../shared";

export type AgentProvider = AgentRuntimeProvider;

export type AgentSessionRole = "default" | "review-agent" | "manual";

export type AgentSessionTargetType =
  | "project"
  | "divergence"
  | "workspace"
  | "workspace_divergence";

export type AgentSessionStatus = "idle" | "active" | "busy";

export type AgentRuntimeStatus = "idle" | "running" | "waiting" | "error" | "stopped";

export type AgentRequestKind = "approval" | "user-input";

export type AgentRequestStatus = "open" | "resolved";

export type AgentMessageRole = "user" | "assistant" | "system";

export type AgentMessageStatus = "streaming" | "done" | "error";

export type AgentActivityStatus = "running" | "completed" | "error";
export type AgentProposedPlan = AgentRuntimeProposedPlan;

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  status: AgentMessageStatus;
  createdAtMs: number;
  interactionMode?: AgentRuntimeInteractionMode;
  attachments?: AgentRuntimeAttachment[];
}

export interface AgentActivity {
  id: string;
  kind: string;
  title: string;
  summary?: string;
  subject?: string | null;
  groupKey?: string | null;
  status: AgentActivityStatus;
  details?: string;
  startedAtMs: number;
  completedAtMs?: number;
}

export interface AgentRequestOption {
  id: string;
  label: string;
  description?: string;
}

export interface AgentRequestQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options?: AgentRequestOption[];
}

export interface AgentRequest {
  id: string;
  kind: AgentRequestKind;
  title: string;
  description?: string;
  options?: AgentRequestOption[];
  questions?: AgentRequestQuestion[];
  status: AgentRequestStatus;
  openedAtMs: number;
  resolvedAtMs?: number;
}

export interface AgentSession {
  kind: "agent";
  id: string;
  provider: AgentProvider;
  model: string;
  effort?: AgentRuntimeEffort;
  targetType: AgentSessionTargetType;
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  sessionRole: AgentSessionRole;
  nameMode: AgentRuntimeSessionNameMode;
  name: string;
  path: string;
  status: AgentSessionStatus;
  runtimeStatus: AgentRuntimeStatus;
  isOpen: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  lastActivity?: Date;
  threadId?: string;
}

export interface AgentSessionSnapshot extends AgentSession {
  hydrationState?: "summary" | "full";
  currentTurnStartedAtMs?: number | null;
  lastRuntimeEventAtMs?: number | null;
  runtimePhase?: string | null;
  latestAssistantMessageInteractionMode?: AgentRuntimeInteractionMode | null;
  latestAssistantMessageStatus?: AgentMessageStatus | null;
  conversationContext?: AgentRuntimeConversationContext | null;
  runtimeEvents: AgentRuntimeDebugEvent[];
  messages: AgentMessage[];
  activities: AgentActivity[];
  proposedPlans: AgentProposedPlan[];
  pendingRequest: AgentRequest | null;
  errorMessage?: string | null;
}
