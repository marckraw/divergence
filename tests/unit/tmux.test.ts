import { describe, expect, it } from "vitest";
import {
  buildLegacyTmuxSessionName,
  buildSplitTmuxSessionName,
  buildTmuxSessionName,
  sanitizeTmuxLabel,
} from "../../src/entities/terminal-session";

describe("tmux helpers", () => {
  it("sanitizes labels", () => {
    expect(sanitizeTmuxLabel("Feature/New Thing!!")).toBe("feature-new-thing");
    expect(sanitizeTmuxLabel("___Mixed---")).toBe("mixed");
  });

  it("builds project and divergence session names", () => {
    expect(
      buildTmuxSessionName({
        type: "project",
        projectName: "My App",
        projectId: 42,
      })
    ).toBe("divergence-project-my-app-42");

    expect(
      buildTmuxSessionName({
        type: "divergence",
        projectName: "My App",
        projectId: 42,
        divergenceId: 99,
        branch: "feat/test",
      })
    ).toBe("divergence-branch-my-app-feat-test-99");
  });

  it("trims long names but keeps id suffix", () => {
    const longName = buildTmuxSessionName({
      type: "project",
      projectName: "x".repeat(300),
      projectId: 123,
    });

    expect(longName.length).toBeLessThanOrEqual(120);
    expect(longName.endsWith("-123")).toBe(true);
  });

  it("builds legacy and split names", () => {
    expect(buildLegacyTmuxSessionName("project-2")).toBe("divergence-project-2");
    expect(buildSplitTmuxSessionName("base", "pane 2")).toBe("base-pane-2");

    const split = buildSplitTmuxSessionName("a".repeat(120), "suffix");
    expect(split.length).toBeLessThanOrEqual(120);
    expect(split.endsWith("-suffix")).toBe(true);
  });
});
