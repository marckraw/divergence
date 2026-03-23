import { getBaseName } from "../../../shared";
import type { WorkspaceSession } from "../../workspace-session";
import type { EditorSession } from "../model/editorSession.types";

export interface BuildEditorSessionInput {
  targetType: EditorSession["targetType"];
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  path: string;
  filePath: string;
  sessionId?: string;
  createdAtMs?: number;
}

export function isEditorSession(session: WorkspaceSession): session is EditorSession {
  return "kind" in session && session.kind === "editor";
}

export function getEditorSessionDisplayName(session: Pick<EditorSession, "filePath">): string {
  return getBaseName(session.filePath);
}

export function buildEditorSession(input: BuildEditorSessionInput): EditorSession {
  const createdAtMs = input.createdAtMs ?? Date.now();

  return {
    id: input.sessionId ?? crypto.randomUUID(),
    kind: "editor",
    targetType: input.targetType,
    targetId: input.targetId,
    projectId: input.projectId,
    workspaceOwnerId: input.workspaceOwnerId,
    workspaceKey: input.workspaceKey,
    name: getBaseName(input.filePath),
    path: input.path,
    filePath: input.filePath,
    status: "idle",
    createdAtMs,
  };
}

export function findEditorSessionByFilePath(
  sessions: Map<string, WorkspaceSession>,
  filePath: string,
): EditorSession | null {
  for (const session of sessions.values()) {
    if (isEditorSession(session) && session.filePath === filePath) {
      return session;
    }
  }

  return null;
}
