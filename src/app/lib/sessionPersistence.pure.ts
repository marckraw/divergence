import type { EditorSession, TerminalSession } from "../../entities";
import { normalizeTmuxHistoryLimit } from "../../shared";

export const WORKSPACE_TABS_PERSISTENCE_VERSION = 2;

type PersistedSessionType =
  | "project"
  | "divergence"
  | "workspace"
  | "workspace_divergence";
type PersistedSessionRole = "default" | "review-agent" | "manual";
type PersistedSessionStatus = "idle" | "active" | "busy";

interface PersistedTerminalSession {
  id: string;
  type: PersistedSessionType;
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  sessionRole: PersistedSessionRole;
  name: string;
  path: string;
  useTmux: boolean;
  tmuxSessionName: string;
  tmuxHistoryLimit: number;
  status: PersistedSessionStatus;
  lastActivityMs: number | null;
  portEnv?: Record<string, string>;
}

interface PersistedEditorSession {
  id: string;
  kind: "editor";
  targetType: PersistedSessionType;
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  name: string;
  path: string;
  filePath: string;
  status: "idle" | "active";
  createdAtMs: number;
}

export interface PersistedWorkspaceTabsSnapshot {
  version: number;
  activeSessionId: string | null;
  terminalSessions: PersistedTerminalSession[];
  editorSessions: PersistedEditorSession[];
}

export interface RestoredWorkspaceTabsState {
  sessions: Map<string, TerminalSession>;
  editorSessions: Map<string, EditorSession>;
  activeSessionId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePortEnv(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => typeof entryValue === "string");
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

function parseSessionType(value: unknown): PersistedSessionType | null {
  if (
    value === "project"
    || value === "divergence"
    || value === "workspace"
    || value === "workspace_divergence"
  ) {
    return value;
  }
  return null;
}

function parseSessionRole(value: unknown): PersistedSessionRole {
  if (value === "review-agent" || value === "manual") {
    return value;
  }
  return "default";
}

function parseSessionStatus(value: unknown): PersistedSessionStatus {
  if (value === "active" || value === "busy") {
    return value;
  }
  return "idle";
}

function parseSession(input: unknown): TerminalSession | null {
  if (!isRecord(input)) {
    return null;
  }

  const id = parseString(input.id);
  const type = parseSessionType(input.type);
  const name = parseString(input.name);
  const path = parseString(input.path);
  const workspaceKey = parseString(input.workspaceKey);
  const tmuxSessionName = parseString(input.tmuxSessionName);
  const targetId = parseNumber(input.targetId);
  const projectId = parseNumber(input.projectId);
  const workspaceOwnerId = parseNumber(input.workspaceOwnerId);

  if (
    !id
    || !type
    || !name
    || !path
    || !workspaceKey
    || !tmuxSessionName
    || targetId === null
    || projectId === null
    || typeof input.useTmux !== "boolean"
  ) {
    return null;
  }

  const lastActivityMs = parseNumber(input.lastActivityMs);

  return {
    id,
    type,
    targetId,
    projectId,
    workspaceOwnerId: workspaceOwnerId ?? undefined,
    workspaceKey,
    sessionRole: parseSessionRole(input.sessionRole),
    name,
    path,
    useTmux: input.useTmux,
    tmuxSessionName,
    tmuxHistoryLimit: normalizeTmuxHistoryLimit(input.tmuxHistoryLimit),
    status: parseSessionStatus(input.status),
    lastActivity: lastActivityMs !== null ? new Date(lastActivityMs) : undefined,
    portEnv: parsePortEnv(input.portEnv),
  };
}

function parseEditorSession(input: unknown): EditorSession | null {
  if (!isRecord(input)) {
    return null;
  }

  const id = parseString(input.id);
  const targetType = parseSessionType(input.targetType);
  const name = parseString(input.name);
  const path = parseString(input.path);
  const filePath = parseString(input.filePath);
  const workspaceKey = parseString(input.workspaceKey);
  const targetId = parseNumber(input.targetId);
  const projectId = parseNumber(input.projectId);
  const workspaceOwnerId = parseNumber(input.workspaceOwnerId);
  const createdAtMs = parseNumber(input.createdAtMs);

  if (
    input.kind !== "editor"
    || !id
    || !targetType
    || !name
    || !path
    || !filePath
    || !workspaceKey
    || targetId === null
    || projectId === null
    || createdAtMs === null
  ) {
    return null;
  }

  return {
    id,
    kind: "editor",
    targetType,
    targetId,
    projectId,
    workspaceOwnerId: workspaceOwnerId ?? undefined,
    workspaceKey,
    name,
    path,
    filePath,
    status: input.status === "active" ? "active" : "idle",
    createdAtMs,
  };
}

function serializeSession(session: TerminalSession): PersistedTerminalSession {
  return {
    id: session.id,
    type: session.type,
    targetId: session.targetId,
    projectId: session.projectId,
    workspaceOwnerId: session.workspaceOwnerId,
    workspaceKey: session.workspaceKey,
    sessionRole: session.sessionRole,
    name: session.name,
    path: session.path,
    useTmux: session.useTmux,
    tmuxSessionName: session.tmuxSessionName,
    tmuxHistoryLimit: normalizeTmuxHistoryLimit(session.tmuxHistoryLimit),
    status: session.status,
    lastActivityMs: session.lastActivity?.getTime() ?? null,
    portEnv: session.portEnv,
  };
}

function serializeEditorSession(session: EditorSession): PersistedEditorSession {
  return {
    id: session.id,
    kind: "editor",
    targetType: session.targetType,
    targetId: session.targetId,
    projectId: session.projectId,
    workspaceOwnerId: session.workspaceOwnerId,
    workspaceKey: session.workspaceKey,
    name: session.name,
    path: session.path,
    filePath: session.filePath,
    status: session.status,
    createdAtMs: session.createdAtMs,
  };
}

export function normalizePersistedWorkspaceTabsState(input: unknown): RestoredWorkspaceTabsState {
  if (!isRecord(input)) {
    return {
      sessions: new Map(),
      editorSessions: new Map(),
      activeSessionId: null,
    };
  }

  const sessions = new Map<string, TerminalSession>();
  const editorSessions = new Map<string, EditorSession>();
  const rawTerminalSessions = Array.isArray(input.terminalSessions)
    ? input.terminalSessions
    : Array.isArray(input.sessions)
      ? input.sessions
      : [];
  const rawEditorSessions = Array.isArray(input.editorSessions) ? input.editorSessions : [];

  for (const rawSession of rawTerminalSessions) {
    const parsed = parseSession(rawSession);
    if (!parsed) {
      continue;
    }
    sessions.set(parsed.id, parsed);
  }

  for (const rawSession of rawEditorSessions) {
    const parsed = parseEditorSession(rawSession);
    if (!parsed) {
      continue;
    }
    editorSessions.set(parsed.id, parsed);
  }

  const activeCandidate = typeof input.activeSessionId === "string" ? input.activeSessionId : null;
  const firstSessionId = sessions.keys().next().value ?? editorSessions.keys().next().value ?? null;
  const activeSessionId = activeCandidate && (sessions.has(activeCandidate) || editorSessions.has(activeCandidate))
    ? activeCandidate
    : firstSessionId;

  return {
    sessions,
    editorSessions,
    activeSessionId,
  };
}

export function buildPersistedWorkspaceTabsSnapshot(input: {
  sessions: Map<string, TerminalSession>;
  editorSessions: Map<string, EditorSession>;
  activeSessionId: string | null;
}): PersistedWorkspaceTabsSnapshot {
  const terminalSessions = Array.from(input.sessions.values()).map(serializeSession);
  const editorSessions = Array.from(input.editorSessions.values()).map(serializeEditorSession);
  const firstSessionId = terminalSessions[0]?.id ?? editorSessions[0]?.id ?? null;
  const activeSessionId = input.activeSessionId && (input.sessions.has(input.activeSessionId) || input.editorSessions.has(input.activeSessionId))
    ? input.activeSessionId
    : firstSessionId;

  return {
    version: WORKSPACE_TABS_PERSISTENCE_VERSION,
    activeSessionId,
    terminalSessions,
    editorSessions,
  };
}
