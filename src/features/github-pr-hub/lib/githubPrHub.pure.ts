import type { GithubPullRequestSummary } from "../model/githubPrHub.types";

export interface ParsedDiffLine {
  index: number;
  text: string;
  kind: "meta" | "hunk" | "context" | "added" | "removed";
}

const HUNK_HEADER_REGEX = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/;

export function filterGithubPullRequests(
  pullRequests: GithubPullRequestSummary[],
  projectFilter: "all" | number,
  query: string,
): GithubPullRequestSummary[] {
  const normalizedQuery = query.trim().toLowerCase();

  return pullRequests
    .filter((pullRequest) => (
      projectFilter === "all" || pullRequest.projectId === projectFilter
    ))
    .filter((pullRequest) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchable = [
        pullRequest.repoKey,
        `#${pullRequest.number}`,
        pullRequest.title,
        pullRequest.userLogin ?? "",
        pullRequest.baseRef,
        pullRequest.headRef,
      ];

      return searchable.some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((left, right) => (
      right.updatedAtMs - left.updatedAtMs
      || left.repoKey.localeCompare(right.repoKey)
      || right.number - left.number
    ));
}

export function formatRelativeTime(timestampMs: number): string {
  const deltaMs = Date.now() - timestampMs;
  if (deltaMs < 60_000) return "just now";
  if (deltaMs < 3_600_000) return `${Math.floor(deltaMs / 60_000)}m ago`;
  if (deltaMs < 86_400_000) return `${Math.floor(deltaMs / 3_600_000)}h ago`;
  return `${Math.floor(deltaMs / 86_400_000)}d ago`;
}

export function getChecksToneClass(checksState: string | null): string {
  const normalized = checksState?.trim().toLowerCase() ?? "";
  if (normalized === "success") {
    return "border-green/30 bg-green/10 text-green";
  }
  if (normalized === "pending") {
    return "border-yellow/40 bg-yellow/15 text-yellow";
  }
  if (normalized === "failure" || normalized === "error") {
    return "border-red/30 bg-red/10 text-red";
  }
  return "border-surface text-subtext bg-main/30";
}

export function hasGithubMergeConflicts(
  mergeable: boolean | null,
  mergeableState: string | null,
): boolean {
  const normalized = mergeableState?.trim().toLowerCase() ?? "";
  if (normalized === "dirty" || normalized.includes("conflict")) {
    return true;
  }

  if (mergeable === false && normalized.length === 0) {
    return true;
  }

  return false;
}

export function getGithubFileStatusToneClass(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "added") return "bg-green/20 text-green";
  if (normalized === "modified") return "bg-yellow/20 text-yellow";
  if (normalized === "removed") return "bg-red/20 text-red";
  if (normalized === "renamed") return "bg-accent/20 text-accent";
  return "bg-surface text-subtext";
}

export function getDiffTreeRowToneClass(additions: number, deletions: number): string {
  if (additions > 0 && deletions > 0) {
    return "text-yellow";
  }
  if (additions > 0) {
    return "text-green";
  }
  if (deletions > 0) {
    return "text-red";
  }
  return "text-subtext";
}

function isDiffHeaderLine(line: string): boolean {
  return line.startsWith("diff ")
    || line.startsWith("index ")
    || line.startsWith("--- ")
    || line.startsWith("+++ ");
}

export function parseUnifiedDiffLines(patch: string | null): ParsedDiffLine[] {
  if (!patch) {
    return [];
  }

  return patch.split("\n").map((line, index) => {
    if (isDiffHeaderLine(line)) {
      return { index, text: line, kind: "meta" } satisfies ParsedDiffLine;
    }

    if (HUNK_HEADER_REGEX.test(line)) {
      return { index, text: line, kind: "hunk" } satisfies ParsedDiffLine;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      return { index, text: line, kind: "added" } satisfies ParsedDiffLine;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      return { index, text: line, kind: "removed" } satisfies ParsedDiffLine;
    }

    if (line.startsWith("\\ No newline")) {
      return { index, text: line, kind: "meta" } satisfies ParsedDiffLine;
    }

    return { index, text: line, kind: "context" } satisfies ParsedDiffLine;
  });
}

export function getDiffLineClass(kind: ParsedDiffLine["kind"]): string {
  switch (kind) {
    case "added":
      return "text-green bg-green/10";
    case "removed":
      return "text-red bg-red/10";
    case "hunk":
      return "text-accent bg-accent/10";
    case "meta":
      return "text-subtext";
    case "context":
    default:
      return "text-text";
  }
}
