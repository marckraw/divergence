import { describe, expect, it } from "vitest";
import {
  buildLinearIssuePrompt,
  enrichLinearIssuesWithProject,
  formatLinearLoadFailureDetails,
  isLinearIssueOpen,
  mergeLinearTaskQueueIssues,
  resolveLinearIssueProjects,
  truncateLinearIssueDescription,
  type LinearTaskQueueIssue,
  type LinearTaskQueueProject,
  type LinearTaskQueueSession,
} from "./linearTaskQueue.pure";

describe("truncateLinearIssueDescription", () => {
  it("returns null for empty input", () => {
    expect(truncateLinearIssueDescription(null)).toBeNull();
    expect(truncateLinearIssueDescription("   ")).toBeNull();
  });

  it("returns trimmed description when below limit", () => {
    expect(truncateLinearIssueDescription("  short text  ", 20)).toBe("short text");
  });

  it("truncates and appends suffix when above limit", () => {
    expect(truncateLinearIssueDescription("abcdefghij", 5)).toBe("abcde...");
  });
});

describe("resolveLinearIssueProjects", () => {
  const projects: LinearTaskQueueProject[] = [
    { id: 11, name: "alpha-web", path: "/tmp/alpha-web" },
    { id: 12, name: "alpha-api", path: "/tmp/alpha-api" },
    { id: 13, name: "alpha-jobs", path: "/tmp/alpha-jobs" },
  ];

  const workspaceMembersByWorkspaceId = new Map<number, Array<{
    id: number;
    workspaceId: number;
    projectId: number;
    addedAtMs: number;
  }>>([
    [7, [
      { id: 1, workspaceId: 7, projectId: 12, addedAtMs: 1 },
      { id: 2, workspaceId: 7, projectId: 11, addedAtMs: 2 },
      { id: 3, workspaceId: 7, projectId: 12, addedAtMs: 3 },
      { id: 4, workspaceId: 7, projectId: 999, addedAtMs: 4 },
    ]],
  ]);

  it("resolves project sessions by project id", () => {
    const session: LinearTaskQueueSession = {
      type: "project",
      projectId: 11,
      targetId: 11,
      workspaceOwnerId: undefined,
    };

    expect(resolveLinearIssueProjects(session, projects, workspaceMembersByWorkspaceId))
      .toEqual([projects[0]]);
  });

  it("resolves divergence sessions by project id", () => {
    const session: LinearTaskQueueSession = {
      type: "divergence",
      projectId: 12,
      targetId: 99,
      workspaceOwnerId: undefined,
    };

    expect(resolveLinearIssueProjects(session, projects, workspaceMembersByWorkspaceId))
      .toEqual([projects[1]]);
  });

  it("resolves workspace sessions from members and deduplicates by project", () => {
    const session: LinearTaskQueueSession = {
      type: "workspace",
      projectId: 0,
      targetId: 7,
      workspaceOwnerId: 7,
    };

    expect(resolveLinearIssueProjects(session, projects, workspaceMembersByWorkspaceId))
      .toEqual([projects[1], projects[0]]);
  });

  it("falls back to target id when workspace owner id is missing", () => {
    const session: LinearTaskQueueSession = {
      type: "workspace_divergence",
      projectId: 0,
      targetId: 7,
      workspaceOwnerId: undefined,
    };

    expect(resolveLinearIssueProjects(session, projects, workspaceMembersByWorkspaceId))
      .toEqual([projects[1], projects[0]]);
  });
});

function makeIssue(
  input: Partial<LinearTaskQueueIssue> & Pick<LinearTaskQueueIssue, "id" | "identifier" | "title">,
): LinearTaskQueueIssue {
  return {
    id: input.id,
    identifier: input.identifier,
    title: input.title,
    description: input.description ?? null,
    stateName: input.stateName ?? null,
    stateType: input.stateType ?? null,
    assigneeName: input.assigneeName ?? null,
    url: input.url ?? null,
    updatedAtMs: input.updatedAtMs ?? null,
    sourceProjectId: input.sourceProjectId ?? null,
    sourceProjectName: input.sourceProjectName ?? null,
    sourceProjectPath: input.sourceProjectPath ?? null,
  };
}

describe("mergeLinearTaskQueueIssues", () => {
  it("enriches issues with source project metadata", () => {
    const enriched = enrichLinearIssuesWithProject([
      {
        id: "issue-1",
        identifier: "ABC-1",
        title: "Fix parser",
        description: null,
        stateName: null,
        stateType: null,
        assigneeName: null,
        url: null,
        updatedAtMs: 100,
      },
    ], {
      id: 11,
      name: "alpha-web",
      path: "/tmp/alpha-web",
    });

    expect(enriched[0]?.sourceProjectId).toBe(11);
    expect(enriched[0]?.sourceProjectName).toBe("alpha-web");
    expect(enriched[0]?.sourceProjectPath).toBe("/tmp/alpha-web");
  });

  it("deduplicates by issue id and keeps the newest copy", () => {
    const older = makeIssue({
      id: "issue-1",
      identifier: "ABC-1",
      title: "Fix parser",
      updatedAtMs: 100,
      sourceProjectName: "alpha-web",
    });
    const newer = makeIssue({
      id: "issue-1",
      identifier: "ABC-1",
      title: "Fix parser",
      updatedAtMs: 500,
      sourceProjectName: "alpha-api",
    });
    const second = makeIssue({
      id: "issue-2",
      identifier: "ABC-2",
      title: "Upgrade deps",
      updatedAtMs: 300,
      sourceProjectName: "alpha-jobs",
    });

    const merged = mergeLinearTaskQueueIssues([[older, second], [newer]]);
    expect(merged.map((issue) => issue.id)).toEqual(["issue-1", "issue-2"]);
    expect(merged[0]?.sourceProjectName).toBe("alpha-api");
  });
});

describe("isLinearIssueOpen", () => {
  it("filters out completed and canceled states", () => {
    expect(isLinearIssueOpen({ stateType: "completed" })).toBe(false);
    expect(isLinearIssueOpen({ stateType: "canceled" })).toBe(false);
  });

  it("keeps active or unknown states", () => {
    expect(isLinearIssueOpen({ stateType: "started" })).toBe(true);
    expect(isLinearIssueOpen({ stateType: null })).toBe(true);
  });
});

describe("buildLinearIssuePrompt", () => {
  it("includes title and identifier", () => {
    const prompt = buildLinearIssuePrompt({
      identifier: "ABC-123",
      title: "Fix flaky tests",
      description: null,
      stateName: null,
      url: null,
      sourceProjectName: null,
      sourceProjectPath: null,
    });

    expect(prompt).toContain("ABC-123");
    expect(prompt).toContain("Fix flaky tests");
  });

  it("includes optional fields when available", () => {
    const prompt = buildLinearIssuePrompt({
      identifier: "ABC-123",
      title: "Fix flaky tests",
      description: "Investigate CI failures.",
      stateName: "In Progress",
      url: "https://linear.app/example/issue/ABC-123",
      sourceProjectName: "alpha-api",
      sourceProjectPath: "/tmp/alpha-api",
    });

    expect(prompt).toContain("Source project: alpha-api");
    expect(prompt).toContain("Source path: /tmp/alpha-api");
    expect(prompt).toContain("Current state: In Progress");
    expect(prompt).toContain("Issue URL: https://linear.app/example/issue/ABC-123");
    expect(prompt).toContain("Issue description:\nInvestigate CI failures.");
  });
});

describe("formatLinearLoadFailureDetails", () => {
  it("normalizes whitespace and truncates long summaries", () => {
    const details = formatLinearLoadFailureDetails([
      { projectName: "alpha-web", message: "  request\nfailed\tfor auth token  " },
    ]);
    expect(details).toBe("alpha-web: request failed for auth token");
  });

  it("caps entries and appends remaining count", () => {
    const details = formatLinearLoadFailureDetails([
      { projectName: "one", message: "err-1" },
      { projectName: "two", message: "err-2" },
      { projectName: "three", message: "err-3" },
      { projectName: "four", message: "err-4" },
    ], 2);

    expect(details).toContain("one: err-1");
    expect(details).toContain("two: err-2");
    expect(details).toContain("+2 more");
  });
});
