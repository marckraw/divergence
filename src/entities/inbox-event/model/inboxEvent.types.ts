export type { InboxEvent } from "../../../shared/api/schema.types";

export type InboxEventKind = "automation_run" | "github_pr_opened" | "github_pr_updated" | "system";

export type InboxFilter = "all" | "unread" | "automation" | "github";

export interface CreateInboxEventInput {
  kind: InboxEventKind;
  source: "automation" | "github" | "app";
  projectId?: number | null;
  automationId?: number | null;
  automationRunId?: number | null;
  externalId?: string | null;
  title: string;
  body?: string | null;
  payloadJson?: string | null;
  createdAtMs?: number;
}
