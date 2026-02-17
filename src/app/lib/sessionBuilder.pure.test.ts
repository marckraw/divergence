import { describe, expect, it } from "vitest";
import type { Divergence, Project } from "../../types";
import type { ProjectSettings } from "../../entities/project";
import {
  buildTerminalSession,
  buildWorkspaceKey,
  generateSessionEntropy,
} from "./sessionBuilder.pure";

const project: Project = {
  id: 1,
  name: "Alpha",
  path: "/alpha",
  createdAt: "2026-01-01",
};

const divergence: Divergence = {
  id: 9,
  projectId: 1,
  name: "Alpha Div",
  branch: "feat/search",
  path: "/alpha/div",
  createdAt: "2026-01-01",
  hasDiverged: false,
};

describe("session builder utils", () => {
  it("builds workspace keys", () => {
    expect(buildWorkspaceKey("project", 3)).toBe("project:3");
    expect(buildWorkspaceKey("divergence", 9)).toBe("divergence:9");
  });

  it("builds project session with defaults", () => {
    const session = buildTerminalSession({
      type: "project",
      target: project,
      settingsByProjectId: new Map(),
      projectsById: new Map([[1, { name: "Alpha" }]]),
      globalTmuxHistoryLimit: 50000,
    });

    expect(session.id).toBe("project-1");
    expect(session.projectId).toBe(1);
    expect(session.workspaceKey).toBe("project:1");
    expect(session.sessionRole).toBe("default");
    expect(session.tmuxHistoryLimit).toBe(50000);
    expect(session.useTmux).toBe(true);
  });

  it("builds divergence session with project overrides", () => {
    const settings = new Map<number, ProjectSettings>([[1, {
      projectId: 1,
      copyIgnoredSkip: [],
      useTmux: false,
      useWebgl: false,
      tmuxHistoryLimit: 12345,
    }]]);

    const session = buildTerminalSession({
      type: "divergence",
      target: divergence,
      settingsByProjectId: settings,
      projectsById: new Map([[1, { name: "Alpha" }]]),
      globalTmuxHistoryLimit: 50000,
    });

    expect(session.id).toBe("divergence-9");
    expect(session.projectId).toBe(1);
    expect(session.workspaceKey).toBe("divergence:9");
    expect(session.sessionRole).toBe("default");
    expect(session.useTmux).toBe(false);
    expect(session.tmuxHistoryLimit).toBe(12345);
    expect(session.tmuxSessionName).toContain("divergence-branch-alpha-feat-search-9");
  });
});

describe("generateSessionEntropy", () => {
  it("returns a string containing a timestamp and random number", () => {
    const entropy = generateSessionEntropy();
    expect(entropy).toMatch(/^\d+-\d+$/);
  });

  it("returns different values on successive calls", () => {
    const a = generateSessionEntropy();
    const b = generateSessionEntropy();
    expect(a).not.toBe(b);
  });
});
