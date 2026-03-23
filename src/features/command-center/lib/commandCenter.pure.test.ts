import { describe, expect, it } from "vitest";
import type { AgentSessionSnapshot, Divergence, Project, Workspace, WorkspaceDivergence, WorkspaceSession } from "../../../entities";
import {
  buildCommandCenterSearchResults,
  filterCommandCenterSearchResults,
  groupCommandCenterResults,
} from "./commandCenter.pure";

const project: Project = {
  id: 1,
  name: "Alpha",
  path: "/work/alpha",
  createdAt: "2026-03-23T00:00:00Z",
};

const divergence: Divergence = {
  id: 10,
  projectId: 1,
  name: "Alpha feature",
  branch: "feat/search",
  path: "/work/alpha-feat",
  createdAt: "2026-03-23T00:00:00Z",
  hasDiverged: false,
};

const terminalSession: WorkspaceSession = {
  id: "project-1",
  type: "project",
  targetId: 1,
  projectId: 1,
  workspaceKey: "project:1",
  sessionRole: "default",
  name: "Alpha",
  path: "/work/alpha",
  useTmux: false,
  tmuxSessionName: "alpha",
  tmuxHistoryLimit: 1000,
  status: "idle",
};

const agentSession: AgentSessionSnapshot = {
  kind: "agent",
  id: "agent-1",
  projectId: 1,
  workspaceKey: "project:1",
  targetType: "project",
  targetId: 1,
  sessionRole: "default",
  name: "Alpha review",
  path: "/work/alpha",
  provider: "codex",
  model: "gpt-5.4",
  status: "idle",
  createdAtMs: 0,
  updatedAtMs: 0,
  isOpen: true,
  runtimeStatus: "idle",
  nameMode: "default",
  runtimeEvents: [],
  messages: [],
  activities: [],
  pendingRequest: null,
};

const workspace: Workspace = {
  id: 20,
  name: "Workspace Alpha",
  slug: "workspace-alpha",
  description: null,
  folderPath: "/work/ws-alpha",
  createdAtMs: 0,
  updatedAtMs: 0,
};

const workspaceDivergence: WorkspaceDivergence = {
  id: 21,
  workspaceId: 20,
  name: "Workspace feature",
  branch: "feat/ws-search",
  folderPath: "/work/ws-alpha/feat",
  createdAtMs: 0,
};

describe("commandCenter.pure", () => {
  it("builds replace-mode results across categories", () => {
    const results = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      {
        projects: [project],
        divergencesByProject: new Map([[1, [divergence]]]),
        sessions: new Map<string, WorkspaceSession>([
          [terminalSession.id, terminalSession],
          [agentSession.id, agentSession],
        ]),
        workspaces: [workspace],
        workspaceDivergences: [workspaceDivergence],
        files: ["src/app/App.container.tsx"],
        agentProviders: ["codex", "claude"],
        sourceSession: terminalSession,
      },
    );

    expect(results.some((result) => result.type === "project")).toBe(true);
    expect(results.some((result) => result.type === "divergence")).toBe(true);
    expect(results.some((result) => result.type === "workspace")).toBe(true);
    expect(results.some((result) => result.type === "workspace_divergence")).toBe(true);
    expect(results.some((result) => result.type === "file")).toBe(true);
    expect(results.some((result) => result.type === "create_action")).toBe(true);
  });

  it("limits reveal mode to sessions", () => {
    const results = buildCommandCenterSearchResults(
      { kind: "reveal" },
      {
        projects: [project],
        divergencesByProject: new Map([[1, [divergence]]]),
        sessions: new Map([[terminalSession.id, terminalSession]]),
        files: ["src/main.tsx"],
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe("session");
  });

  it("filters by category and query", () => {
    const results = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      {
        projects: [project],
        divergencesByProject: new Map([[1, [divergence]]]),
        sessions: new Map([[terminalSession.id, terminalSession]]),
        files: ["src/app/App.container.tsx", "README.md"],
        agentProviders: ["codex"],
        sourceSession: terminalSession,
      },
    );

    const filesOnly = filterCommandCenterSearchResults(results, "app.container", "files");
    const createOnly = filterCommandCenterSearchResults(results, "codex", "create");

    expect(filesOnly).toHaveLength(1);
    expect(filesOnly[0]?.type).toBe("file");
    expect(createOnly).toHaveLength(1);
    expect(createOnly[0]?.type).toBe("create_action");
  });

  it("groups results by semantic section", () => {
    const results = buildCommandCenterSearchResults(
      { kind: "open-in-pane", targetPaneId: "stage-pane-2", sourceSessionId: terminalSession.id },
      {
        projects: [project],
        divergencesByProject: new Map([[1, [divergence]]]),
        sessions: new Map([[terminalSession.id, terminalSession]]),
        files: ["src/main.tsx"],
        agentProviders: ["codex"],
        sourceSession: terminalSession,
      },
    );

    const groups = groupCommandCenterResults(results);
    expect(groups.map((group) => group.id)).toEqual(["recent", "files", "create"]);
  });
});
