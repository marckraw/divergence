import { describe, expect, it } from "vitest";
import {
  buildGithubInboxBody,
  buildGithubInboxExternalId,
  buildGithubInboxTitle,
  buildGithubRepoKey,
  buildGithubRepoTarget,
  classifyGithubPullRequestEvent,
} from "./githubInbox.pure";

describe("github inbox utils", () => {
  it("builds repo keys and titles", () => {
    expect(buildGithubRepoKey("OpenAI", "Divergence")).toBe(
      "openai/divergence"
    );
    expect(
      buildGithubRepoTarget({
        projectId: 9,
        projectName: "divergence",
        owner: "OpenAI",
        repo: "Divergence",
      })
    ).toEqual({
      projectId: 9,
      projectName: "divergence",
      owner: "OpenAI",
      repo: "Divergence",
      repoKey: "openai/divergence",
    });
    expect(buildGithubInboxTitle("openai/divergence", 42, "github_pr_opened"))
      .toBe("openai/divergence PR #42 opened");
  });

  it("classifies pull request events", () => {
    const pullRequest = {
      id: 1,
      number: 9,
      title: "Test",
      htmlUrl: "https://example.com",
      userLogin: "marckraw",
      createdAtMs: 2_000,
      updatedAtMs: 4_000,
    };

    expect(classifyGithubPullRequestEvent(pullRequest, 1_000)).toBe(
      "github_pr_opened"
    );
    expect(classifyGithubPullRequestEvent(pullRequest, 3_000)).toBe(
      "github_pr_updated"
    );
    expect(classifyGithubPullRequestEvent(pullRequest, 5_000)).toBeNull();
  });

  it("builds external ids and bodies", () => {
    expect(
      buildGithubInboxExternalId(
        "openai/divergence",
        99,
        "github_pr_updated",
        123
      )
    ).toBe("github:openai/divergence:pr:99:github_pr_updated:123");

    const body = buildGithubInboxBody({
      id: 1,
      number: 11,
      title: "Fix scheduling",
      htmlUrl: "https://github.com/openai/divergence/pull/11",
      userLogin: "octocat",
      createdAtMs: 0,
      updatedAtMs: 0,
    });
    expect(body).toContain("Fix scheduling");
    expect(body).toContain("@octocat");
  });
});
