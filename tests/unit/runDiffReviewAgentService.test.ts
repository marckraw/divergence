import { describe, expect, it } from "vitest";
import {
  canRunReviewDraft,
  createReviewBriefForDraft,
  renderReviewAgentCommand,
} from "../../src/features/diff-review/service/runDiffReviewAgent.service";

describe("run diff review agent service", () => {
  it("renders command template tokens", () => {
    const command = renderReviewAgentCommand("cat {briefPath} | claude --cwd {workspacePath}", {
      briefPath: "/repo/.divergence/review.md",
      workspacePath: "/repo",
    });

    expect(command).toBe("cat /repo/.divergence/review.md | claude --cwd /repo");
  });

  it("checks if review draft can run", () => {
    expect(canRunReviewDraft(null)).toBe(false);

    expect(canRunReviewDraft({
      workspacePath: "/repo",
      mode: "working",
      comments: [],
      finalComment: "  ",
      agent: "claude",
    })).toBe(false);

    expect(canRunReviewDraft({
      workspacePath: "/repo",
      mode: "working",
      comments: [],
      finalComment: "Do this",
      agent: "claude",
    })).toBe(true);
  });

  it("creates review brief markdown from draft", () => {
    const markdown = createReviewBriefForDraft({
      workspacePath: "/repo",
      mode: "branch",
      comments: [],
      finalComment: "Summary",
      agent: "codex",
    });

    expect(markdown).toContain("Mode: branch");
    expect(markdown).toContain("Summary");
  });
});
