import type { Project, TerminalSession } from "../../../entities";
import type { WorkspaceMember } from "../../../entities/workspace";
import type { LinearProjectIssue } from "../../../shared";

const DEFAULT_DESCRIPTION_MAX_CHARS = 320;
const COMPLETED_LINEAR_STATE_TYPES = new Set(["completed", "canceled"]);

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
  const normalizedStateType = issue.stateType?.trim().toLowerCase();
  if (!normalizedStateType) {
    return true;
  }
  return !COMPLETED_LINEAR_STATE_TYPES.has(normalizedStateType);
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
