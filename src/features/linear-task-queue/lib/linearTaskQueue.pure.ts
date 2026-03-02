import type { Project, TerminalSession } from "../../../entities";
import type { WorkspaceMember } from "../../../entities/workspace";
import type { LinearProjectIssue } from "../../../shared";

const DEFAULT_DESCRIPTION_MAX_CHARS = 320;
const TODO_LINEAR_STATE_TYPES = new Set(["unstarted", "backlog", "triage"]);
const IN_PROGRESS_LINEAR_STATE_TYPES = new Set(["started"]);
const COMPLETED_LINEAR_STATE_TYPES = new Set(["completed"]);
const CANCELED_LINEAR_STATE_TYPES = new Set(["canceled", "cancelled"]);

export type LinearTaskQueueSession = Pick<
  TerminalSession,
  "type" | "projectId" | "targetId" | "workspaceOwnerId"
>;

export type LinearTaskQueueProject = Pick<Project, "id" | "name" | "path">;

export interface LinearTaskQueueIssue extends LinearProjectIssue {
  sourceProjectId: number | null;
  sourceProjectName: string | null;
  sourceProjectPath: string | null;
}

export interface LinearTaskProjectLoadFailure {
  projectName: string;
  message: string;
}

export type LinearIssueStatusFilter =
  | "open"
  | "all"
  | "todo_in_progress"
  | "todo"
  | "in_progress"
  | "completed"
  | "canceled";

export function truncateLinearIssueDescription(
  description: string | null,
  maxChars: number = DEFAULT_DESCRIPTION_MAX_CHARS,
): string | null {
  const trimmed = description?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxChars).trimEnd()}...`;
}

export function resolveLinearIssueProjects(
  session: LinearTaskQueueSession | null,
  projects: LinearTaskQueueProject[],
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>,
): LinearTaskQueueProject[] {
  if (!session) {
    return [];
  }

  const projectById = new Map<number, LinearTaskQueueProject>();
  for (const project of projects) {
    projectById.set(project.id, project);
  }

  if (session.type === "project" || session.type === "divergence") {
    const project = projectById.get(session.projectId);
    return project ? [project] : [];
  }

  const workspaceId = session.workspaceOwnerId ?? session.targetId;
  if (workspaceId <= 0) {
    return [];
  }

  const members = workspaceMembersByWorkspaceId.get(workspaceId) ?? [];
  const seenProjectIds = new Set<number>();
  const resolvedProjects: LinearTaskQueueProject[] = [];

  for (const member of members) {
    if (seenProjectIds.has(member.projectId)) {
      continue;
    }
    seenProjectIds.add(member.projectId);

    const project = projectById.get(member.projectId);
    if (project) {
      resolvedProjects.push(project);
    }
  }

  return resolvedProjects;
}

export function enrichLinearIssuesWithProject(
  issues: LinearProjectIssue[],
  project: LinearTaskQueueProject,
): LinearTaskQueueIssue[] {
  return issues.map((issue) => ({
    ...issue,
    sourceProjectId: project.id,
    sourceProjectName: project.name,
    sourceProjectPath: project.path,
  }));
}

function compareLinearTaskQueueIssues(
  left: Pick<LinearProjectIssue, "identifier" | "updatedAtMs">,
  right: Pick<LinearProjectIssue, "identifier" | "updatedAtMs">,
): number {
  return (
    (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0)
    || left.identifier.localeCompare(right.identifier)
  );
}

export function mergeLinearTaskQueueIssues(
  issueLists: LinearTaskQueueIssue[][],
): LinearTaskQueueIssue[] {
  const byIssueId = new Map<string, LinearTaskQueueIssue>();

  for (const issueList of issueLists) {
    for (const issue of issueList) {
      const existing = byIssueId.get(issue.id);
      if (!existing || compareLinearTaskQueueIssues(issue, existing) < 0) {
        byIssueId.set(issue.id, issue);
      }
    }
  }

  return Array.from(byIssueId.values()).sort(compareLinearTaskQueueIssues);
}

export function isLinearIssueOpen(
  issue: Pick<LinearProjectIssue, "stateType">,
): boolean {
  const normalizedStateType = normalizeLinearIssueStateType(issue.stateType);
  if (!normalizedStateType) {
    return true;
  }
  return !COMPLETED_LINEAR_STATE_TYPES.has(normalizedStateType)
    && !CANCELED_LINEAR_STATE_TYPES.has(normalizedStateType);
}

export function matchesLinearIssueStatusFilter(
  issue: Pick<LinearProjectIssue, "stateType">,
  filter: LinearIssueStatusFilter,
): boolean {
  const normalizedStateType = normalizeLinearIssueStateType(issue.stateType);

  if (filter === "all") {
    return true;
  }

  if (filter === "open") {
    return isLinearIssueOpen(issue);
  }

  if (!normalizedStateType) {
    return false;
  }

  if (filter === "todo_in_progress") {
    return TODO_LINEAR_STATE_TYPES.has(normalizedStateType)
      || IN_PROGRESS_LINEAR_STATE_TYPES.has(normalizedStateType);
  }

  if (filter === "todo") {
    return TODO_LINEAR_STATE_TYPES.has(normalizedStateType);
  }

  if (filter === "in_progress") {
    return IN_PROGRESS_LINEAR_STATE_TYPES.has(normalizedStateType);
  }

  if (filter === "completed") {
    return COMPLETED_LINEAR_STATE_TYPES.has(normalizedStateType);
  }

  return CANCELED_LINEAR_STATE_TYPES.has(normalizedStateType);
}

export function matchesLinearIssueSearch(
  issue: Pick<
    LinearTaskQueueIssue,
    "identifier" | "title" | "description" | "assigneeName" | "stateName"
  >,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const searchableFields = [
    issue.identifier,
    issue.title,
    issue.description,
    issue.assigneeName,
    issue.stateName,
  ];

  return searchableFields.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export function filterLinearTaskQueueIssues(
  issues: LinearTaskQueueIssue[],
  statusFilter: LinearIssueStatusFilter,
  query: string,
): LinearTaskQueueIssue[] {
  return issues.filter((issue) => (
    matchesLinearIssueStatusFilter(issue, statusFilter)
    && matchesLinearIssueSearch(issue, query)
  ));
}

export function getLinearIssueStatusToneClass(
  issue: Pick<LinearProjectIssue, "stateType">,
): string {
  const normalizedStateType = normalizeLinearIssueStateType(issue.stateType);
  if (!normalizedStateType) {
    return "border-surface text-subtext bg-main/30";
  }

  if (CANCELED_LINEAR_STATE_TYPES.has(normalizedStateType)) {
    return "border-red/30 bg-red/10 text-red";
  }

  if (COMPLETED_LINEAR_STATE_TYPES.has(normalizedStateType)) {
    return "border-green/30 bg-green/10 text-green";
  }

  if (IN_PROGRESS_LINEAR_STATE_TYPES.has(normalizedStateType)) {
    return "border-accent/30 bg-accent/10 text-accent";
  }

  if (TODO_LINEAR_STATE_TYPES.has(normalizedStateType)) {
    return "border-yellow/40 bg-yellow/15 text-yellow";
  }

  return "border-surface text-subtext bg-main/30";
}

export function buildLinearIssuePrompt(
  issue: Pick<
    LinearTaskQueueIssue,
    | "identifier"
    | "title"
    | "description"
    | "stateName"
    | "url"
    | "sourceProjectName"
    | "sourceProjectPath"
  >,
): string {
  const sections: string[] = [
    `Please work on Linear issue ${issue.identifier}: ${issue.title}`,
  ];

  if (issue.sourceProjectName?.trim()) {
    sections.push(`Source project: ${issue.sourceProjectName.trim()}`);
  }

  if (issue.sourceProjectPath?.trim()) {
    sections.push(`Source path: ${issue.sourceProjectPath.trim()}`);
  }

  if (issue.stateName?.trim()) {
    sections.push(`Current state: ${issue.stateName.trim()}`);
  }

  if (issue.url?.trim()) {
    sections.push(`Issue URL: ${issue.url.trim()}`);
  }

  const description = issue.description?.trim();
  if (description) {
    sections.push(`Issue description:\n${description}`);
  }

  return sections.join("\n\n");
}

function truncateSingleLine(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

export function formatLinearLoadFailureDetails(
  failures: LinearTaskProjectLoadFailure[],
  maxEntries: number = 3,
): string {
  if (failures.length === 0) {
    return "";
  }

  const details = failures.slice(0, maxEntries).map((failure) => (
    `${failure.projectName}: ${truncateSingleLine(failure.message, 180)}`
  ));

  if (failures.length > maxEntries) {
    details.push(`+${failures.length - maxEntries} more`);
  }

  return details.join(" | ");
}

export function getLinearWorkflowStateToneClass(stateType: string): string {
  const normalized = stateType.trim().toLowerCase() || null;
  if (!normalized) {
    return "border-surface text-subtext bg-main/30";
  }

  if (CANCELED_LINEAR_STATE_TYPES.has(normalized)) {
    return "border-red/30 bg-red/10 text-red";
  }

  if (COMPLETED_LINEAR_STATE_TYPES.has(normalized)) {
    return "border-green/30 bg-green/10 text-green";
  }

  if (IN_PROGRESS_LINEAR_STATE_TYPES.has(normalized)) {
    return "border-accent/30 bg-accent/10 text-accent";
  }

  if (TODO_LINEAR_STATE_TYPES.has(normalized)) {
    return "border-yellow/40 bg-yellow/15 text-yellow";
  }

  return "border-surface text-subtext bg-main/30";
}

function normalizeLinearIssueStateType(stateType: string | null | undefined): string | null {
  const normalized = stateType?.trim().toLowerCase();
  return normalized || null;
}
