import { describe, expect, it } from "vitest";
import type { TerminalSession } from "../../entities";
import {
  buildPersistedTerminalTabsSnapshot,
  normalizePersistedTerminalTabsState,
  TERMINAL_TABS_PERSISTENCE_VERSION,
} from "./sessionPersistence.pure";

function makeSession(partial: Partial<TerminalSession> = {}): TerminalSession {
  return {
    id: partial.id ?? "project-1",
    type: partial.type ?? "project",
    targetId: partial.targetId ?? 1,
    projectId: partial.projectId ?? 1,
    workspaceOwnerId: partial.workspaceOwnerId,
    workspaceKey: partial.workspaceKey ?? "project:1",
    sessionRole: partial.sessionRole ?? "default",
    name: partial.name ?? "Project One",
    path: partial.path ?? "/tmp/project-one",
    useTmux: partial.useTmux ?? true,
    tmuxSessionName: partial.tmuxSessionName ?? "divergence-project-one-1",
    tmuxHistoryLimit: partial.tmuxHistoryLimit ?? 50000,
    status: partial.status ?? "idle",
    lastActivity: partial.lastActivity,
    portEnv: partial.portEnv,
  };
}

describe("buildPersistedTerminalTabsSnapshot", () => {
  it("builds a serializable snapshot and keeps valid active session id", () => {
    const session = makeSession({
      lastActivity: new Date(1700000000000),
      status: "busy",
    });
    const sessions = new Map<string, TerminalSession>([[session.id, session]]);

    const snapshot = buildPersistedTerminalTabsSnapshot({
      sessions,
      activeSessionId: session.id,
    });

    expect(snapshot.version).toBe(TERMINAL_TABS_PERSISTENCE_VERSION);
    expect(snapshot.activeSessionId).toBe(session.id);
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0].lastActivityMs).toBe(1700000000000);
    expect(snapshot.sessions[0].status).toBe("busy");
  });

  it("falls back to first session when active session id is missing", () => {
    const session = makeSession();
    const snapshot = buildPersistedTerminalTabsSnapshot({
      sessions: new Map([[session.id, session]]),
      activeSessionId: "missing",
    });

    expect(snapshot.activeSessionId).toBe(session.id);
  });
});

describe("normalizePersistedTerminalTabsState", () => {
  it("drops invalid sessions and normalizes active session id", () => {
    const restored = normalizePersistedTerminalTabsState({
      version: 1,
      activeSessionId: "missing",
      sessions: [
        {
          id: "project-1",
          type: "project",
          targetId: 1,
          projectId: 1,
          workspaceOwnerId: 7,
          workspaceKey: "project:1",
          sessionRole: "manual",
          name: "Project One",
          path: "/tmp/project-one",
          useTmux: true,
          tmuxSessionName: "divergence-project-one-1",
          tmuxHistoryLimit: 999999,
          status: "active",
          lastActivityMs: 1700000000000,
          portEnv: { PORT: "3000", BAD: 123 },
        },
        {
          id: "",
          type: "project",
        },
      ],
    });

    expect(restored.sessions.size).toBe(1);
    expect(restored.activeSessionId).toBe("project-1");
    const session = restored.sessions.get("project-1");
    expect(session).toBeDefined();
    expect(session?.tmuxHistoryLimit).toBe(500000);
    expect(session?.status).toBe("active");
    expect(session?.lastActivity?.getTime()).toBe(1700000000000);
    expect(session?.portEnv).toEqual({ PORT: "3000" });
    expect(session?.workspaceOwnerId).toBe(7);
  });
});
