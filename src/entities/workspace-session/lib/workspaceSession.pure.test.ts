import { describe, expect, it } from "vitest";
import type { AgentSessionSnapshot } from "../../agent-session";
import type { EditorSession } from "../../editor-session";
import type { TerminalSession } from "../../terminal-session";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  getWorkspaceSessionKind,
  isAgentSession,
  isEditorSession,
  isTerminalSession,
} from "./workspaceSession.pure";

const terminalSession: TerminalSession = {
  id: "project-1",
  type: "project",
  targetId: 1,
  projectId: 1,
  workspaceKey: "project:1",
  sessionRole: "default",
  name: "Project",
  path: "/tmp/project",
  useTmux: true,
  tmuxSessionName: "project-1",
  tmuxHistoryLimit: 50000,
  status: "idle",
};

const agentSession: AgentSessionSnapshot = {
  kind: "agent",
  id: "agent-1",
  provider: "claude",
  model: "sonnet",
  targetType: "project",
  targetId: 1,
  projectId: 1,
  workspaceKey: "project:1",
  sessionRole: "default",
  nameMode: "default",
  name: "Claude",
  path: "/tmp/project",
  status: "idle",
  runtimeStatus: "idle",
  isOpen: true,
  createdAtMs: 1,
  updatedAtMs: 1,
  currentTurnStartedAtMs: null,
  lastRuntimeEventAtMs: null,
  runtimePhase: null,
  runtimeEvents: [],
  messages: [],
  activities: [],
  proposedPlans: [],
  pendingRequest: null,
};

const editorSession: EditorSession = {
  id: "editor-1",
  kind: "editor",
  targetType: "project",
  targetId: 1,
  projectId: 1,
  workspaceKey: "project:1",
  name: "App.container.tsx",
  path: "/tmp/project",
  filePath: "/tmp/project/src/App.container.tsx",
  status: "idle",
  createdAtMs: 1,
};

describe("workspaceSession.pure", () => {
  it("detects agent sessions", () => {
    expect(isAgentSession(agentSession)).toBe(true);
    expect(isAgentSession(terminalSession)).toBe(false);
    expect(isAgentSession(editorSession)).toBe(false);
  });

  it("detects editor sessions", () => {
    expect(isEditorSession(editorSession)).toBe(true);
    expect(isEditorSession(agentSession)).toBe(false);
    expect(isEditorSession(terminalSession)).toBe(false);
  });

  it("detects terminal sessions", () => {
    expect(isTerminalSession(terminalSession)).toBe(true);
    expect(isTerminalSession(agentSession)).toBe(false);
    expect(isTerminalSession(editorSession)).toBe(false);
  });

  it("returns the correct workspace session kind", () => {
    expect(getWorkspaceSessionKind(terminalSession)).toBe("terminal");
    expect(getWorkspaceSessionKind(agentSession)).toBe("agent");
    expect(getWorkspaceSessionKind(editorSession)).toBe("editor");
  });

  it("returns the normalized target type", () => {
    expect(getWorkspaceSessionTargetType(terminalSession)).toBe("project");
    expect(getWorkspaceSessionTargetType(agentSession)).toBe("project");
    expect(getWorkspaceSessionTargetType(editorSession)).toBe("project");
  });

  it("returns the normalized target id", () => {
    expect(getWorkspaceSessionTargetId(terminalSession)).toBe(1);
    expect(getWorkspaceSessionTargetId(agentSession)).toBe(1);
    expect(getWorkspaceSessionTargetId(editorSession)).toBe(1);
  });
});
