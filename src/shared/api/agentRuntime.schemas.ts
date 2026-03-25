import { z } from "zod";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeCapabilities,
  AgentRuntimeSessionSnapshot,
  AgentRuntimeSessionSummary,
  AgentRuntimeSessionUpdatedEvent,
  AgentSkillDescriptor,
} from "./agentRuntime.types";

const providerSchema = z.enum(["claude", "codex", "cursor", "gemini"]);
const sessionRoleSchema = z.enum(["default", "review-agent", "manual"]);
const nameModeSchema = z.enum(["default", "auto", "manual"]);
const targetTypeSchema = z.enum(["project", "divergence", "workspace", "workspace_divergence"]);
const sessionStatusSchema = z.enum(["idle", "active", "busy"]);
const runtimeStatusSchema = z.enum(["idle", "running", "waiting", "error", "stopped"]);
const interactionModeSchema = z.enum(["default", "plan"]);
const attachmentKindSchema = z.enum(["image", "pdf"]);
const conversationContextStatusSchema = z.enum(["available", "unavailable"]);
const conversationContextSourceSchema = z.enum(["codex", "unavailable"]);
const messageRoleSchema = z.enum(["user", "assistant", "system"]);
const messageStatusSchema = z.enum(["streaming", "done", "error"]);
const activityStatusSchema = z.enum(["running", "completed", "error"]);
const effortSchema = z.enum(["none", "low", "medium", "high", "xhigh", "max"]);
const requestKindSchema = z.enum(["approval", "user-input"]);
const requestStatusSchema = z.enum(["open", "resolved"]);
const proposedPlanStatusSchema = z.enum(["proposed", "implemented", "dismissed"]);
const providerTransportSchema = z
  .enum(["cli-headless", "app-server", "cliHeadless", "appServer"])
  .transform((value) => {
    if (value === "cliHeadless") {
      return "cli-headless" as const;
    }
    if (value === "appServer") {
      return "app-server" as const;
    }
    return value;
  });
const providerReadinessStatusSchema = z.enum(["ready", "partial", "setup-required"]);
const authStatusSchema = z.enum(["authenticated", "missing", "unknown"]);

function optionalNullToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((value) => value ?? undefined);
}

const agentRuntimeRequestOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: optionalNullToUndefined(z.string()),
});

const agentRuntimeRequestQuestionSchema = z.object({
  id: z.string(),
  header: z.string(),
  question: z.string(),
  isOther: z.boolean(),
  isSecret: z.boolean(),
  options: optionalNullToUndefined(z.array(agentRuntimeRequestOptionSchema)),
});

const agentRuntimeModelOptionSchema = z.object({
  slug: z.string(),
  label: z.string(),
});

const agentRuntimeProviderFeaturesSchema = z.object({
  streaming: z.boolean(),
  resume: z.boolean(),
  structuredRequests: z.boolean(),
  planMode: z.boolean(),
  attachmentKinds: z.array(attachmentKindSchema),
  structuredPlanUi: z.boolean(),
  usageInspection: z.boolean(),
  providerExtras: z.boolean(),
});

const agentRuntimeProviderReadinessSchema = z.object({
  status: providerReadinessStatusSchema,
  summary: z.string(),
  details: z.array(z.string()),
  binaryCandidates: z.array(z.string()),
  detectedCommand: z.string().nullable().optional(),
  detectedVersion: z.string().nullable().optional(),
  authStatus: authStatusSchema,
});

const agentRuntimeProviderDescriptorSchema = z.object({
  id: providerSchema,
  label: z.string(),
  transport: providerTransportSchema,
  defaultModel: z.string(),
  modelOptions: z.array(agentRuntimeModelOptionSchema),
  readiness: agentRuntimeProviderReadinessSchema,
  features: agentRuntimeProviderFeaturesSchema,
});

export const agentRuntimeCapabilitiesSchema = z.object({
  placeholderSessionsSupported: z.boolean(),
  liveStreamingSupported: z.boolean(),
  persistentSnapshotsSupported: z.boolean(),
  providers: z.array(agentRuntimeProviderDescriptorSchema),
});

const agentRuntimeAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  kind: attachmentKindSchema,
});

const agentRuntimeProposedPlanSchema = z.object({
  id: z.string(),
  sourceMessageId: z.string().nullable().optional(),
  sourceTurnInteractionMode: z.literal("plan"),
  title: z.string().nullable().optional(),
  planMarkdown: z.string(),
  status: proposedPlanStatusSchema,
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  implementedAtMs: z.number().nullable().optional(),
  implementationSessionId: z.string().nullable().optional(),
});

const agentRuntimeMessageSchema = z.object({
  id: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  status: messageStatusSchema,
  createdAtMs: z.number(),
  interactionMode: optionalNullToUndefined(interactionModeSchema),
  attachments: optionalNullToUndefined(z.array(agentRuntimeAttachmentSchema)),
});

const agentRuntimeActivitySchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  summary: optionalNullToUndefined(z.string()),
  subject: z.string().nullable().optional(),
  groupKey: z.string().nullable().optional(),
  status: activityStatusSchema,
  details: optionalNullToUndefined(z.string()),
  startedAtMs: z.number(),
  completedAtMs: optionalNullToUndefined(z.number()),
});

const agentRuntimeDebugEventSchema = z.object({
  id: z.string(),
  atMs: z.number(),
  phase: z.string(),
  message: z.string(),
  details: optionalNullToUndefined(z.string()),
});

const agentRuntimeConversationContextSchema = z.object({
  status: conversationContextStatusSchema,
  label: z.string(),
  fractionUsed: z.number().nullable().optional(),
  fractionRemaining: z.number().nullable().optional(),
  detail: z.string().nullable().optional(),
  source: conversationContextSourceSchema,
});

const agentRuntimeRequestSchema = z.object({
  id: z.string(),
  kind: requestKindSchema,
  title: z.string(),
  description: optionalNullToUndefined(z.string()),
  options: optionalNullToUndefined(z.array(agentRuntimeRequestOptionSchema)),
  questions: optionalNullToUndefined(z.array(agentRuntimeRequestQuestionSchema)),
  status: requestStatusSchema,
  openedAtMs: z.number(),
  resolvedAtMs: optionalNullToUndefined(z.number()),
});

export const agentRuntimeSessionSnapshotSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  model: z.string(),
  effort: optionalNullToUndefined(effortSchema),
  targetType: targetTypeSchema,
  targetId: z.number(),
  projectId: z.number(),
  workspaceOwnerId: optionalNullToUndefined(z.number()),
  workspaceKey: z.string(),
  sessionRole: sessionRoleSchema,
  nameMode: nameModeSchema,
  name: z.string(),
  path: z.string(),
  status: sessionStatusSchema,
  runtimeStatus: runtimeStatusSchema,
  isOpen: z.boolean(),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  threadId: optionalNullToUndefined(z.string()),
  currentTurnStartedAtMs: z.number().nullable().optional(),
  lastRuntimeEventAtMs: z.number().nullable().optional(),
  runtimePhase: z.string().nullable().optional(),
  conversationContext: agentRuntimeConversationContextSchema.nullable().optional(),
  runtimeEvents: z.array(agentRuntimeDebugEventSchema),
  messages: z.array(agentRuntimeMessageSchema),
  activities: z.array(agentRuntimeActivitySchema),
  proposedPlans: z.array(agentRuntimeProposedPlanSchema).default([]),
  pendingRequest: agentRuntimeRequestSchema.nullable(),
  errorMessage: z.string().nullable().optional(),
});

export const agentRuntimeSessionSummarySchema = z.object({
  id: z.string(),
  provider: providerSchema,
  model: z.string(),
  effort: optionalNullToUndefined(effortSchema),
  targetType: targetTypeSchema,
  targetId: z.number(),
  projectId: z.number(),
  workspaceOwnerId: optionalNullToUndefined(z.number()),
  workspaceKey: z.string(),
  sessionRole: sessionRoleSchema,
  nameMode: nameModeSchema,
  name: z.string(),
  path: z.string(),
  status: sessionStatusSchema,
  runtimeStatus: runtimeStatusSchema,
  isOpen: z.boolean(),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  threadId: optionalNullToUndefined(z.string()),
  currentTurnStartedAtMs: z.number().nullable().optional(),
  lastRuntimeEventAtMs: z.number().nullable().optional(),
  runtimePhase: z.string().nullable().optional(),
  proposedPlans: z.array(agentRuntimeProposedPlanSchema).default([]),
  pendingRequest: agentRuntimeRequestSchema.nullable(),
  errorMessage: z.string().nullable().optional(),
  latestAssistantMessageInteractionMode: optionalNullToUndefined(interactionModeSchema),
  latestAssistantMessageStatus: optionalNullToUndefined(messageStatusSchema),
});

export const agentRuntimeSessionUpdatedEventSchema = z.object({
  sessionId: z.string(),
  snapshot: agentRuntimeSessionSnapshotSchema,
});

function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  throw new Error(`Invalid ${label}: ${formatSchemaError(result.error)}`);
}

export function parseAgentRuntimeCapabilities(value: unknown): AgentRuntimeCapabilities {
  return parseWithSchema(agentRuntimeCapabilitiesSchema, value, "agent runtime capabilities");
}

export function parseAgentRuntimeSessionSnapshot(value: unknown): AgentRuntimeSessionSnapshot {
  return parseWithSchema(agentRuntimeSessionSnapshotSchema, value, "agent runtime session snapshot");
}

export function parseAgentRuntimeSessionSummary(value: unknown): AgentRuntimeSessionSummary {
  return parseWithSchema(agentRuntimeSessionSummarySchema, value, "agent runtime session summary");
}

export function parseAgentRuntimeSessionSnapshots(value: unknown): AgentRuntimeSessionSnapshot[] {
  return parseWithSchema(
    z.array(agentRuntimeSessionSnapshotSchema),
    value,
    "agent runtime session snapshots",
  );
}

export function parseAgentRuntimeSessionSummaries(value: unknown): AgentRuntimeSessionSummary[] {
  return parseWithSchema(
    z.array(agentRuntimeSessionSummarySchema),
    value,
    "agent runtime session summaries",
  );
}

export function parseAgentRuntimeSessionUpdatedEvent(value: unknown): AgentRuntimeSessionUpdatedEvent {
  return parseWithSchema(
    agentRuntimeSessionUpdatedEventSchema,
    value,
    "agent runtime session update event",
  );
}

export function parseAgentRuntimeAttachment(value: unknown): AgentRuntimeAttachment {
  return parseWithSchema(agentRuntimeAttachmentSchema, value, "agent runtime attachment");
}

const agentSkillSourceSchema = z.enum(["bundled", "user", "system"]);
const agentSkillScopeSchema = z.enum(["global", "project"]);

const agentSkillDescriptorSchema = z.object({
  name: z.string(),
  description: z.string(),
  source: agentSkillSourceSchema,
  scope: agentSkillScopeSchema,
  providerHint: z.string().nullable().optional(),
});

export function parseAgentSkillDescriptors(value: unknown): AgentSkillDescriptor[] {
  return parseWithSchema(
    z.array(agentSkillDescriptorSchema),
    value,
    "agent skill descriptors",
  );
}
