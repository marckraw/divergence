import { describe, expect, it } from "vitest";
import type { AgentSessionSnapshot } from "../../agent-session";
import type { TerminalSession } from "../../terminal-session";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  getWorkspaceSessionKind,
  isAgentSession,
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
  name: "Claude",
  path: "/tmp/project",
  status: "idle",
  runtimeStatus: "idle",
  isOpen: true,
  createdAtMs: 1,
  updatedAtMs: 1,
  messages: [],
  activities: [],
  pendingRequest: null,
};

describe("workspaceSession.pure", () => {
  it("detects agent sessions", () => {
    expect(isAgentSession(agentSession)).toBe(true);
    expect(isAgentSession(terminalSession)).toBe(false);
  });

  it("detects terminal sessions", () => {
    expect(isTerminalSession(terminalSession)).toBe(true);
    expect(isTerminalSession(agentSession)).toBe(false);
  });

  it("returns the correct workspace session kind", () => {
    expect(getWorkspaceSessionKind(terminalSession)).toBe("terminal");
    expect(getWorkspaceSessionKind(agentSession)).toBe("agent");
  });

  it("returns the normalized target type", () => {
    expect(getWorkspaceSessionTargetType(terminalSession)).toBe("project");
    expect(getWorkspaceSessionTargetType(agentSession)).toBe("project");
  });

  it("returns the normalized target id", () => {
    expect(getWorkspaceSessionTargetId(terminalSession)).toBe(1);
    expect(getWorkspaceSessionTargetId(agentSession)).toBe(1);
  });
});
