export type AgentRuntimeProvider = "claude" | "codex" | "cursor" | "gemini";

export type AgentRuntimeSessionRole = "default" | "review-agent" | "manual";
export type AgentRuntimeSessionNameMode = "default" | "auto" | "manual";

export type AgentRuntimeTargetType =
  | "project"
  | "divergence"
  | "workspace"
  | "workspace_divergence";

export type AgentRuntimeSessionStatus = "idle" | "active" | "busy";

export type AgentRuntimeStatus = "idle" | "running" | "waiting" | "error" | "stopped";

export type AgentRuntimeInteractionMode = "default" | "plan";
export type AgentRuntimeAttachmentKind = "image" | "pdf";
export type AgentRuntimeConversationContextStatus = "available" | "unavailable";
export type AgentRuntimeConversationContextSource = "codex" | "unavailable";

export type AgentRuntimeMessageRole = "user" | "assistant" | "system";

export type AgentRuntimeMessageStatus = "streaming" | "done" | "error";

export type AgentRuntimeActivityStatus = "running" | "completed" | "error";

export type AgentRuntimeEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export type AgentRuntimeRequestKind = "approval" | "user-input";

export type AgentRuntimeRequestStatus = "open" | "resolved";

export interface AgentRuntimeRequestOption {
  id: string;
  label: string;
  description?: string;
}

export interface AgentRuntimeRequestQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options?: AgentRuntimeRequestOption[];
}

export interface AgentRuntimeModelOption {
  slug: string;
  label: string;
}

export type AgentRuntimeProviderTransport = "cli-headless" | "app-server";

export type AgentRuntimeProviderReadinessStatus = "ready" | "partial" | "setup-required";

export interface AgentRuntimeProviderFeatures {
  streaming: boolean;
  resume: boolean;
  structuredRequests: boolean;
  planMode: boolean;
  attachmentKinds: AgentRuntimeAttachmentKind[];
  structuredPlanUi: boolean;
  usageInspection: boolean;
  providerExtras: boolean;
}

export interface AgentRuntimeProviderReadiness {
  status: AgentRuntimeProviderReadinessStatus;
  summary: string;
  details: string[];
  binaryCandidates: string[];
  detectedCommand?: string | null;
  detectedVersion?: string | null;
  authStatus: "authenticated" | "missing" | "unknown";
}

export interface AgentRuntimeProviderDescriptor {
  id: AgentRuntimeProvider;
  label: string;
  transport: AgentRuntimeProviderTransport;
  defaultModel: string;
  modelOptions: AgentRuntimeModelOption[];
  readiness: AgentRuntimeProviderReadiness;
  features: AgentRuntimeProviderFeatures;
}

export interface AgentRuntimeCapabilities {
  placeholderSessionsSupported: boolean;
  liveStreamingSupported: boolean;
  persistentSnapshotsSupported: boolean;
  providers: AgentRuntimeProviderDescriptor[];
}

export interface AgentRuntimeMessage {
  id: string;
  role: AgentRuntimeMessageRole;
  content: string;
  status: AgentRuntimeMessageStatus;
  createdAtMs: number;
  interactionMode?: AgentRuntimeInteractionMode;
  attachments?: AgentRuntimeAttachment[];
}

export interface AgentRuntimeActivity {
  id: string;
  kind: string;
  title: string;
  summary?: string;
  subject?: string | null;
  groupKey?: string | null;
  status: AgentRuntimeActivityStatus;
  details?: string;
  startedAtMs: number;
  completedAtMs?: number;
}

export interface AgentRuntimeDebugEvent {
  id: string;
  atMs: number;
  phase: string;
  message: string;
  details?: string;
}

export interface AgentRuntimeConversationContext {
  status: AgentRuntimeConversationContextStatus;
  label: string;
  fractionUsed?: number | null;
  fractionRemaining?: number | null;
  detail?: string | null;
  source: AgentRuntimeConversationContextSource;
}

export interface AgentRuntimeRequest {
  id: string;
  kind: AgentRuntimeRequestKind;
  title: string;
  description?: string;
  options?: AgentRuntimeRequestOption[];
  questions?: AgentRuntimeRequestQuestion[];
  status: AgentRuntimeRequestStatus;
  openedAtMs: number;
  resolvedAtMs?: number;
}

export interface AgentRuntimeAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: AgentRuntimeAttachmentKind;
}

export interface AgentRuntimeSessionSnapshot {
  id: string;
  provider: AgentRuntimeProvider;
  model: string;
  effort?: AgentRuntimeEffort;
  targetType: AgentRuntimeTargetType;
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  sessionRole: AgentRuntimeSessionRole;
  nameMode: AgentRuntimeSessionNameMode;
  name: string;
  path: string;
  status: AgentRuntimeSessionStatus;
  runtimeStatus: AgentRuntimeStatus;
  isOpen: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  threadId?: string;
  currentTurnStartedAtMs?: number | null;
  lastRuntimeEventAtMs?: number | null;
  runtimePhase?: string | null;
  conversationContext?: AgentRuntimeConversationContext | null;
  runtimeEvents: AgentRuntimeDebugEvent[];
  messages: AgentRuntimeMessage[];
  activities: AgentRuntimeActivity[];
  pendingRequest: AgentRuntimeRequest | null;
  errorMessage?: string | null;
}

export interface AgentRuntimeSessionSummary {
  id: string;
  provider: AgentRuntimeProvider;
  model: string;
  effort?: AgentRuntimeEffort;
  targetType: AgentRuntimeTargetType;
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  sessionRole: AgentRuntimeSessionRole;
  nameMode: AgentRuntimeSessionNameMode;
  name: string;
  path: string;
  status: AgentRuntimeSessionStatus;
  runtimeStatus: AgentRuntimeStatus;
  isOpen: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  threadId?: string;
  currentTurnStartedAtMs?: number | null;
  lastRuntimeEventAtMs?: number | null;
  runtimePhase?: string | null;
  pendingRequest: AgentRuntimeRequest | null;
  errorMessage?: string | null;
  latestAssistantMessageInteractionMode?: AgentRuntimeInteractionMode;
  latestAssistantMessageStatus?: AgentRuntimeMessageStatus;
}

export interface CreateAgentSessionInput {
  provider: AgentRuntimeProvider;
  targetType: AgentRuntimeTargetType;
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  sessionRole?: AgentRuntimeSessionRole;
  nameMode?: AgentRuntimeSessionNameMode;
  model?: string;
  effort?: AgentRuntimeEffort;
  name: string;
  path: string;
}

export interface StartAgentTurnInput {
  sessionId: string;
  prompt: string;
  interactionMode?: AgentRuntimeInteractionMode;
  attachments?: AgentRuntimeAttachment[];
  claudeOAuthToken?: string;
  automationMode?: boolean;
}

export interface StageAgentRuntimeAttachmentInput {
  sessionId: string;
  name: string;
  mimeType: string;
  base64Content: string;
}

export interface RespondAgentRequestInput {
  sessionId: string;
  requestId: string;
  decision?: string;
  answers?: string[];
}

export interface UpdateAgentSessionInput {
  sessionId: string;
  isOpen?: boolean;
  model?: string;
  effort?: AgentRuntimeEffort;
  name?: string;
  nameMode?: AgentRuntimeSessionNameMode;
}

export interface AgentRuntimeSessionUpdatedEvent {
  sessionId: string;
  snapshot: AgentRuntimeSessionSnapshot;
}
