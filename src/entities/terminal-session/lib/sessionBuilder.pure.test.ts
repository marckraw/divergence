import { describe, expect, it } from "vitest";
import type {
  Divergence,
  Project,
  Workspace,
  WorkspaceDivergence,
} from "../../index";
import type { ProjectSettings } from "../../project";
import {
  buildTerminalSession,
  buildManualWorkspaceDivergenceTerminalSession,
  buildManualWorkspaceTerminalSession,
  buildWorkspaceDivergenceTerminalSession,
  buildWorkspaceKey,
  buildWorkspaceTerminalSession,
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

const workspace: Workspace = {
  id: 5,
  name: "My Workspace",
  slug: "my-workspace",
  description: null,
  folderPath: "/home/.divergence/workspaces/my-workspace",
  createdAtMs: 1000,
  updatedAtMs: 1000,
};

const workspaceDivergence: WorkspaceDivergence = {
  id: 7,
  workspaceId: 5,
  name: "my-workspace--feat-xyz",
  branch: "feat/xyz",
  folderPath: "/home/.divergence/workspaces/my-workspace--feat-xyz",
  createdAtMs: 2000,
};

describe("session builder utils", () => {
  it("builds workspace keys", () => {
    expect(buildWorkspaceKey("project", 3)).toBe("project:3");
    expect(buildWorkspaceKey("divergence", 9)).toBe("divergence:9");
    expect(buildWorkspaceKey("workspace", 5)).toBe("workspace:5");
    expect(buildWorkspaceKey("workspace_divergence", 7)).toBe(
      "workspace_divergence:7"
    );
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
    const settings = new Map<number, ProjectSettings>([
      [
        1,
        {
          projectId: 1,
          copyIgnoredSkip: [],
          useTmux: false,
          useWebgl: false,
          tmuxHistoryLimit: 12345,
          defaultPort: null,
          framework: null,
        },
      ],
    ]);

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
    expect(session.tmuxSessionName).toContain(
      "divergence-branch-alpha-feat-search-9"
    );
  });
});

describe("buildWorkspaceTerminalSession", () => {
  it("builds a workspace session with correct defaults", () => {
    const session = buildWorkspaceTerminalSession({
      workspace,
      globalTmuxHistoryLimit: 50000,
    });

    expect(session.id).toBe("workspace-5");
    expect(session.type).toBe("workspace");
    expect(session.targetId).toBe(5);
    expect(session.projectId).toBe(0);
    expect(session.workspaceOwnerId).toBe(5);
    expect(session.workspaceKey).toBe("workspace:5");
    expect(session.sessionRole).toBe("default");
    expect(session.path).toBe(workspace.folderPath);
    expect(session.useTmux).toBe(true);
    expect(session.tmuxHistoryLimit).toBe(50000);
    expect(session.name).toBe(workspace.name);
  });

  it("builds a manual workspace session with a unique id and label", () => {
    const session = buildManualWorkspaceTerminalSession({
      workspace,
      globalTmuxHistoryLimit: 50000,
      existingSessions: [
        buildWorkspaceTerminalSession({
          workspace,
          globalTmuxHistoryLimit: 50000,
        }),
      ],
    });

    expect(session.id).toMatch(/^workspace-5#manual-\d+-\d+$/);
    expect(session.sessionRole).toBe("manual");
    expect(session.name).toBe("My Workspace • session #1");
    expect(session.tmuxSessionName).toMatch(
      /^divergence-workspace-my-workspace-5-manual-\d+-\d+$/
    );
  });
});

describe("buildWorkspaceDivergenceTerminalSession", () => {
  it("builds a workspace divergence session with correct defaults", () => {
    const session = buildWorkspaceDivergenceTerminalSession({
      workspaceDivergence,
      globalTmuxHistoryLimit: 50000,
    });

    expect(session.id).toBe("workspace_divergence-7");
    expect(session.type).toBe("workspace_divergence");
    expect(session.targetId).toBe(7);
    expect(session.projectId).toBe(0);
    expect(session.workspaceOwnerId).toBe(5);
    expect(session.workspaceKey).toBe("workspace_divergence:7");
    expect(session.sessionRole).toBe("default");
    expect(session.path).toBe(workspaceDivergence.folderPath);
    expect(session.useTmux).toBe(true);
    expect(session.tmuxHistoryLimit).toBe(50000);
    expect(session.name).toBe(workspaceDivergence.name);
  });

  it("builds a manual workspace divergence session with a unique id and label", () => {
    const session = buildManualWorkspaceDivergenceTerminalSession({
      workspaceDivergence,
      globalTmuxHistoryLimit: 50000,
      existingSessions: [
        buildWorkspaceDivergenceTerminalSession({
          workspaceDivergence,
          globalTmuxHistoryLimit: 50000,
        }),
      ],
    });

    expect(session.id).toMatch(/^workspace_divergence-7#manual-\d+-\d+$/);
    expect(session.sessionRole).toBe("manual");
    expect(session.name).toBe("my-workspace--feat-xyz • session #1");
    expect(session.tmuxSessionName).toMatch(
      /^divergence-ws-div-my-workspace-feat-xyz-7-manual-\d+-\d+$/
    );
  });
});

describe("generateSessionEntropy", () => {
  it("returns a string containing a timestamp and counter", () => {
    const entropy = generateSessionEntropy();
    expect(entropy).toMatch(/^\d+-\d+$/);
  });

  it("returns different values on successive calls", () => {
    const a = generateSessionEntropy();
    const b = generateSessionEntropy();
    expect(a).not.toBe(b);
  });
});
