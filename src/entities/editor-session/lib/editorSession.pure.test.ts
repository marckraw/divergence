import { describe, expect, it } from "vitest";
import type { WorkspaceSession } from "../../workspace-session";
import { buildEditorSession, findEditorSessionByFilePath, getEditorSessionDisplayName, isEditorSession } from "./editorSession.pure";

describe("editorSession.pure", () => {
  it("builds an editor session with a filename display name", () => {
    const session = buildEditorSession({
      targetType: "project",
      targetId: 7,
      projectId: 7,
      workspaceKey: "project:7",
      path: "/tmp/project",
      filePath: "/tmp/project/src/App.container.tsx",
      sessionId: "editor-1",
      createdAtMs: 123,
    });

    expect(session).toEqual({
      id: "editor-1",
      kind: "editor",
      targetType: "project",
      targetId: 7,
      projectId: 7,
      workspaceKey: "project:7",
      name: "App.container.tsx",
      path: "/tmp/project",
      filePath: "/tmp/project/src/App.container.tsx",
      status: "idle",
      createdAtMs: 123,
    });
  });

  it("detects editor sessions", () => {
    const session = buildEditorSession({
      targetType: "project",
      targetId: 1,
      projectId: 1,
      workspaceKey: "project:1",
      path: "/tmp/project",
      filePath: "/tmp/project/README.md",
      sessionId: "editor-1",
    });

    expect(isEditorSession(session as WorkspaceSession)).toBe(true);
  });

  it("derives display names from file paths", () => {
    expect(getEditorSessionDisplayName({ filePath: "/tmp/project/docs/spec.md" })).toBe("spec.md");
  });

  it("finds an editor session by absolute file path", () => {
    const editorSession = buildEditorSession({
      targetType: "project",
      targetId: 1,
      projectId: 1,
      workspaceKey: "project:1",
      path: "/tmp/project",
      filePath: "/tmp/project/src/main.ts",
      sessionId: "editor-1",
    });
    const terminalSession: WorkspaceSession = {
      id: "terminal-1",
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
    const sessions = new Map<string, WorkspaceSession>([
      [terminalSession.id, terminalSession],
      [editorSession.id, editorSession],
    ]);

    expect(findEditorSessionByFilePath(sessions, "/tmp/project/src/main.ts")).toEqual(editorSession);
    expect(findEditorSessionByFilePath(sessions, "/tmp/project/src/missing.ts")).toBeNull();
  });
});
