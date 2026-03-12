import { describe, expect, it } from "vitest";
import type { GithubPullRequestFile } from "../model/githubPrHub.types";
import { buildGithubPrDiffTreeRows } from "./githubPrDiffTree.pure";

function makeFile(partial: Partial<GithubPullRequestFile>): GithubPullRequestFile {
  return {
    sha: partial.sha ?? "sha",
    filename: partial.filename ?? "src/index.ts",
    status: partial.status ?? "modified",
    patch: partial.patch ?? null,
    previousFilename: partial.previousFilename ?? null,
    additions: partial.additions ?? 0,
    deletions: partial.deletions ?? 0,
    changes: partial.changes ?? 0,
  };
}

describe("githubPrDiffTree.pure", () => {
  it("builds compacted directory rows with aggregated stats", () => {
    const rows = buildGithubPrDiffTreeRows([
      makeFile({
        filename: "src/features/github-pr-hub/ui/GithubPrHub.presentational.tsx",
        additions: 12,
        deletions: 3,
      }),
      makeFile({
        filename: "src/features/github-pr-hub/model/useGithubPrHub.ts",
        additions: 5,
        deletions: 1,
      }),
      makeFile({
        filename: "README.md",
        additions: 2,
        deletions: 0,
      }),
    ]);

    expect(rows[0]).toMatchObject({
      kind: "directory",
      label: "src/features/github-pr-hub",
      additions: 17,
      deletions: 4,
    });
    expect(rows[rows.length - 1]).toMatchObject({
      kind: "file",
      path: "README.md",
    });
  });

  it("keeps directories before files and preserves file metadata", () => {
    const rows = buildGithubPrDiffTreeRows([
      makeFile({ filename: "zeta.ts", status: "added" }),
      makeFile({ filename: "src/alpha.ts", status: "removed" }),
    ]);

    expect(rows[0]?.kind).toBe("directory");
    expect(rows[1]).toMatchObject({
      kind: "file",
      label: "alpha.ts",
    });
    expect(rows[2]).toMatchObject({
      kind: "file",
      label: "zeta.ts",
    });
  });
});
