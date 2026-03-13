import { afterEach, describe, expect, it, vi } from "vitest";
import type { GithubPullRequestSummary } from "../model/githubPrHub.types";
import {
  filterGithubPullRequests,
  formatRelativeTime,
  getChecksToneClass,
  getDiffLineClass,
  getDiffTreeRowToneClass,
  getGithubFileStatusToneClass,
  hasGithubMergeConflicts,
  parseUnifiedDiffLines,
} from "./githubPrHub.pure";

function makePullRequest(partial: Partial<GithubPullRequestSummary>): GithubPullRequestSummary {
  return {
    id: partial.id ?? 1,
    projectId: partial.projectId ?? 1,
    projectName: partial.projectName ?? "Project",
    projectPath: partial.projectPath ?? "/tmp/project",
    owner: partial.owner ?? "openai",
    repo: partial.repo ?? "divergence",
    repoKey: partial.repoKey ?? "openai/divergence",
    number: partial.number ?? 1,
    title: partial.title ?? "Update landing",
    htmlUrl: partial.htmlUrl ?? "https://github.com/openai/divergence/pull/1",
    userLogin: partial.userLogin ?? "marckraw",
    createdAtMs: partial.createdAtMs ?? 1,
    updatedAtMs: partial.updatedAtMs ?? 1,
    baseRef: partial.baseRef ?? "master",
    headRef: partial.headRef ?? "feature/pr-hub",
    headSha: partial.headSha ?? "abc123",
    draft: partial.draft ?? false,
    mergeable: partial.mergeable ?? null,
    mergeableState: partial.mergeableState ?? null,
  };
}

describe("githubPrHub.pure", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters by project and query and sorts by update timestamp", () => {
    const pullRequests: GithubPullRequestSummary[] = [
      makePullRequest({
        id: 1,
        projectId: 1,
        repoKey: "org/repo-a",
        number: 12,
        title: "Improve docs",
        updatedAtMs: 3_000,
      }),
      makePullRequest({
        id: 2,
        projectId: 2,
        repoKey: "org/repo-b",
        number: 8,
        title: "Fix tabs",
        updatedAtMs: 5_000,
        userLogin: "octocat",
      }),
      makePullRequest({
        id: 3,
        projectId: 2,
        repoKey: "org/repo-b",
        number: 9,
        title: "Refactor queue",
        updatedAtMs: 4_000,
        userLogin: "bot",
      }),
    ];

    const filtered = filterGithubPullRequests(pullRequests, 2, "tabs");
    expect(filtered.map((item) => item.id)).toEqual([2]);

    const allSorted = filterGithubPullRequests(pullRequests, "all", "");
    expect(allSorted.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("formats relative time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T12:00:00.000Z"));

    expect(formatRelativeTime(Date.parse("2026-03-03T11:59:45.000Z"))).toBe("just now");
    expect(formatRelativeTime(Date.parse("2026-03-03T11:58:00.000Z"))).toBe("2m ago");
    expect(formatRelativeTime(Date.parse("2026-03-03T10:00:00.000Z"))).toBe("2h ago");
    expect(formatRelativeTime(Date.parse("2026-03-01T12:00:00.000Z"))).toBe("2d ago");
  });

  it("returns tone classes for checks and file statuses", () => {
    expect(getChecksToneClass("success")).toContain("text-green");
    expect(getChecksToneClass("pending")).toContain("text-yellow");
    expect(getChecksToneClass("failure")).toContain("text-red");
    expect(getChecksToneClass(null)).toContain("text-subtext");

    expect(getGithubFileStatusToneClass("added")).toContain("text-green");
    expect(getGithubFileStatusToneClass("modified")).toContain("text-yellow");
    expect(getGithubFileStatusToneClass("removed")).toContain("text-red");
    expect(getGithubFileStatusToneClass("renamed")).toContain("text-accent");
    expect(getGithubFileStatusToneClass("copied")).toContain("text-subtext");
    expect(getDiffTreeRowToneClass(3, 0)).toContain("text-green");
    expect(getDiffTreeRowToneClass(0, 2)).toContain("text-red");
    expect(getDiffTreeRowToneClass(4, 1)).toContain("text-yellow");
  });

  it("detects merge conflicts from mergeable metadata", () => {
    expect(hasGithubMergeConflicts(true, "clean")).toBe(false);
    expect(hasGithubMergeConflicts(false, "blocked")).toBe(false);
    expect(hasGithubMergeConflicts(false, "dirty")).toBe(true);
    expect(hasGithubMergeConflicts(false, "has_conflicts")).toBe(true);
    expect(hasGithubMergeConflicts(false, null)).toBe(true);
  });

  it("parses unified diff lines and maps line classes", () => {
    const lines = parseUnifiedDiffLines([
      "diff --git a/file.ts b/file.ts",
      "index 123..456 100644",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,2 +1,3 @@",
      " unchanged",
      "-old",
      "+new",
      "\\ No newline at end of file",
    ].join("\n"));

    expect(lines[0]?.kind).toBe("meta");
    expect(lines[4]?.kind).toBe("hunk");
    expect(lines[6]?.kind).toBe("removed");
    expect(lines[7]?.kind).toBe("added");
    expect(getDiffLineClass("context")).toContain("text-text");
    expect(getDiffLineClass("meta")).toContain("text-subtext");
  });
});
