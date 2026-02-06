import { describe, expect, it } from "vitest";
import {
  formatProviderLabel,
  formatRalphyClaudeSummary,
  formatRalphyGithubSummary,
  formatRalphyLabelsSummary,
  formatRalphyProjectSummary,
  parseSkipListInput,
} from "../../src/widgets/main-area/lib/projectSettingsPanel.pure";

describe("project settings panel utils", () => {
  it("parses skip list input", () => {
    expect(parseSkipListInput(" node_modules \n\n dist \n")).toEqual(["node_modules", "dist"]);
  });

  it("formats provider", () => {
    expect(formatProviderLabel("openai")).toBe("Openai");
    expect(formatProviderLabel(undefined)).toBe("Unknown");
  });

  it("formats ralphy summaries", () => {
    const summary = {
      project_name: "My Project",
      project_key: "my-project",
      project_id: "proj_1",
      team_id: "team_1",
      labels: {
        candidate: "candidate",
        ready: "ready",
      },
      claude: {
        model: "claude-sonnet",
        max_iterations: 6,
      },
      integrations: {
        github: {
          owner: "org",
          repo: "repo",
        },
      },
    };

    expect(formatRalphyProjectSummary(summary)).toBe("My Project · my-project · proj_1 · team team_1");
    expect(formatRalphyLabelsSummary(summary)).toBe("candidate: candidate · ready: ready");
    expect(formatRalphyClaudeSummary(summary)).toBe("claude-sonnet · 6 iterations");
    expect(formatRalphyGithubSummary(summary)).toBe("org/repo");
  });
});
