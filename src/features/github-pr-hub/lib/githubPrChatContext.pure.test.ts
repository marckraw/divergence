import { describe, expect, it } from "vitest";
import type { GithubPrChatContextInput } from "../model/githubPrChat.types";
import { buildGithubPrChatContextMarkdown } from "./githubPrChatContext.pure";

function makeInput(partial?: Partial<GithubPrChatContextInput>): GithubPrChatContextInput {
  return {
    pullRequest: {
      id: 1,
      projectId: 10,
      projectName: "Divergence",
      projectPath: "/tmp/divergence",
      owner: "openai",
      repo: "divergence",
      repoKey: "openai/divergence",
      number: 42,
      title: "Improve PR hub",
      htmlUrl: "https://github.com/openai/divergence/pull/42",
      userLogin: "marckraw",
      createdAtMs: 1,
      updatedAtMs: 2,
      baseRef: "master",
      headRef: "feature/pr-hub",
      headSha: "abc123",
      draft: false,
      mergeable: true,
      mergeableState: "clean",
    },
    detail: {
      id: 1,
      number: 42,
      title: "Improve PR hub",
      body: "This PR improves review UX.",
      state: "open",
      htmlUrl: "https://github.com/openai/divergence/pull/42",
      userLogin: "marckraw",
      createdAtMs: 1,
      updatedAtMs: 2,
      baseRef: "master",
      headRef: "feature/pr-hub",
      headSha: "abc123",
      draft: false,
      mergeable: true,
      mergeableState: "clean",
      additions: 20,
      deletions: 5,
      changedFiles: 2,
      commits: 1,
      checksState: "success",
    },
    files: [
      {
        sha: "aaa",
        filename: "src/a.ts",
        status: "modified",
        patch: "@@ -1 +1 @@\n-old\n+new",
        previousFilename: null,
        additions: 1,
        deletions: 1,
        changes: 2,
      },
      {
        sha: "bbb",
        filename: "src/b.ts",
        status: "added",
        patch: "@@ -0,0 +1,2 @@\n+line1\n+line2",
        previousFilename: null,
        additions: 2,
        deletions: 0,
        changes: 2,
      },
    ],
    selectedFilePath: "src/a.ts",
    includeAllPatches: false,
    ...partial,
  };
}

describe("githubPrChatContext.pure", () => {
  it("builds focused context with selected file patch", () => {
    const markdown = buildGithubPrChatContextMarkdown(makeInput());
    expect(markdown).toContain("Focused (selected file patch only)");
    expect(markdown).toContain("### src/a.ts");
    expect(markdown).not.toContain("### src/b.ts");
  });

  it("builds expanded context with multiple patches", () => {
    const markdown = buildGithubPrChatContextMarkdown(makeInput({
      includeAllPatches: true,
    }));
    expect(markdown).toContain("Expanded (include multiple changed file patches)");
    expect(markdown).toContain("### src/a.ts");
    expect(markdown).toContain("### src/b.ts");
  });

  it("shows no patch message when selection has no patch", () => {
    const markdown = buildGithubPrChatContextMarkdown(makeInput({
      selectedFilePath: "src/missing.ts",
      includeAllPatches: false,
    }));
    expect(markdown).toContain("No patch context included");
  });
});
