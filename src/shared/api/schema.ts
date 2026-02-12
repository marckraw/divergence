import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  createdAt: text("created_at").notNull().default("datetime('now')"),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ── Divergences ─────────────────────────────────────────────────────────────

export const divergences = sqliteTable(
  "divergences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    branch: text("branch").notNull(),
    path: text("path").notNull().unique(),
    createdAt: text("created_at").notNull().default("datetime('now')"),
    hasDiverged: integer("has_diverged", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("idx_divergences_project_id").on(table.projectId),
  ],
);

export type Divergence = typeof divergences.$inferSelect;
export type InsertDivergence = typeof divergences.$inferInsert;

// ── Project Settings ────────────────────────────────────────────────────────

export const projectSettings = sqliteTable("project_settings", {
  projectId: integer("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  copyIgnoredSkip: text("copy_ignored_skip").notNull(),
  useTmux: integer("use_tmux", { mode: "boolean" }).notNull().default(true),
  useWebgl: integer("use_webgl", { mode: "boolean" }).notNull().default(true),
  tmuxHistoryLimit: integer("tmux_history_limit"),
});

export type ProjectSettingsRow = typeof projectSettings.$inferSelect;
export type InsertProjectSettingsRow = typeof projectSettings.$inferInsert;

// ── Automations ─────────────────────────────────────────────────────────────

export const automations = sqliteTable(
  "automations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agent: text("agent", { enum: ["claude", "codex"] }).notNull(),
    prompt: text("prompt").notNull(),
    intervalHours: integer("interval_hours").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    keepSessionAlive: integer("keep_session_alive", { mode: "boolean" }).notNull().default(false),
    lastRunAtMs: integer("last_run_at_ms"),
    nextRunAtMs: integer("next_run_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("idx_automations_project_id").on(table.projectId),
  ],
);

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = typeof automations.$inferInsert;

// ── Automation Runs ─────────────────────────────────────────────────────────

export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    automationId: integer("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    triggerSource: text("trigger_source", { enum: ["schedule", "manual", "startup_catchup"] }).notNull(),
    status: text("status", { enum: ["queued", "running", "success", "error", "skipped", "cancelled"] }).notNull(),
    startedAtMs: integer("started_at_ms"),
    endedAtMs: integer("ended_at_ms"),
    error: text("error"),
    detailsJson: text("details_json"),
    keepSessionAlive: integer("keep_session_alive", { mode: "boolean" }).notNull().default(false),
    tmuxSessionName: text("tmux_session_name"),
    logFilePath: text("log_file_path"),
    resultFilePath: text("result_file_path"),
  },
  (table) => [
    index("idx_automation_runs_automation_id").on(table.automationId, table.id),
  ],
);

export type AutomationRun = typeof automationRuns.$inferSelect;
export type InsertAutomationRun = typeof automationRuns.$inferInsert;

// ── Inbox Events ────────────────────────────────────────────────────────────

export const inboxEvents = sqliteTable(
  "inbox_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["automation_run", "github_pr_opened", "github_pr_updated", "system"] }).notNull(),
    source: text("source", { enum: ["automation", "github", "app"] }).notNull(),
    projectId: integer("project_id"),
    automationId: integer("automation_id"),
    automationRunId: integer("automation_run_id"),
    externalId: text("external_id"),
    title: text("title").notNull(),
    body: text("body"),
    payloadJson: text("payload_json"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("idx_inbox_events_external_id").on(table.externalId).where(sql`external_id IS NOT NULL`),
    index("idx_inbox_events_created_at").on(table.createdAtMs),
  ],
);

export type InboxEvent = typeof inboxEvents.$inferSelect;
export type InsertInboxEvent = typeof inboxEvents.$inferInsert;

// ── GitHub Poll State ───────────────────────────────────────────────────────

export const githubPollState = sqliteTable("github_poll_state", {
  repoKey: text("repo_key").primaryKey(),
  lastPolledAtMs: integer("last_polled_at_ms").notNull(),
});

export type GithubPollState = typeof githubPollState.$inferSelect;
