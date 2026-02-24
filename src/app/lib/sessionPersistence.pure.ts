import type { TerminalSession } from "../../entities";
import { normalizeTmuxHistoryLimit } from "../../shared";

export const TERMINAL_TABS_PERSISTENCE_VERSION = 1;

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

export interface PersistedTerminalTabsSnapshot {
  version: number;
  activeSessionId: string | null;
  sessions: PersistedTerminalSession[];
}

export interface RestoredTerminalTabsState {
  sessions: Map<string, TerminalSession>;
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

function serializeSession(session: TerminalSession): PersistedTerminalSession {
  return {
    id: session.id,
    type: session.type,
    targetId: session.targetId,
    projectId: session.projectId,
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

export function normalizePersistedTerminalTabsState(input: unknown): RestoredTerminalTabsState {
  if (!isRecord(input)) {
    return {
      sessions: new Map(),
      activeSessionId: null,
    };
  }

  const sessions = new Map<string, TerminalSession>();
  const rawSessions = Array.isArray(input.sessions) ? input.sessions : [];
  for (const rawSession of rawSessions) {
    const parsed = parseSession(rawSession);
    if (!parsed) {
      continue;
    }
    sessions.set(parsed.id, parsed);
  }

  const activeCandidate = typeof input.activeSessionId === "string" ? input.activeSessionId : null;
  const firstSessionId = sessions.keys().next().value ?? null;
  const activeSessionId = activeCandidate && sessions.has(activeCandidate)
    ? activeCandidate
    : firstSessionId;

  return {
    sessions,
    activeSessionId,
  };
}

export function buildPersistedTerminalTabsSnapshot(input: {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
}): PersistedTerminalTabsSnapshot {
  const sessions = Array.from(input.sessions.values()).map(serializeSession);
  const firstSessionId = sessions[0]?.id ?? null;
  const activeSessionId = input.activeSessionId && input.sessions.has(input.activeSessionId)
    ? input.activeSessionId
    : firstSessionId;

  return {
    version: TERMINAL_TABS_PERSISTENCE_VERSION,
    activeSessionId,
    sessions,
  };
}
