import { useEffect, useSyncExternalStore } from "react";
import type { AgentSessionSnapshot } from "../../../entities";
import {
  createAgentRuntimeSession,
  deleteAgentRuntimeSession,
  discardAgentRuntimeAttachment,
  getAgentRuntimeSession,
  listAgentRuntimeSessionSummaries,
  onAgentRuntimeSessionUpdated,
  refreshAgentRuntimeCapabilities,
  respondAgentRuntimeRequest,
  startAgentRuntimeTurn,
  stageAgentRuntimeAttachment,
  stopAgentRuntimeSession,
  updateAgentRuntimeSession,
  type AgentRuntimeAttachment,
  type AgentRuntimeCapabilities,
  type AgentRuntimeInteractionMode,
  type CreateAgentSessionInput,
  createFrameTask,
} from "../../../shared";
import {
  mapAgentRuntimeSessionSummary,
  mapAgentRuntimeSnapshot,
} from "../lib/agentRuntimeSnapshot.pure";

interface AgentRuntimeStoreState {
  capabilities: AgentRuntimeCapabilities | null;
  sessions: Map<string, AgentSessionSnapshot>;
  orderedSessions: AgentSessionSnapshot[];
  orderedOpenSessions: AgentSessionSnapshot[];
}

const INITIAL_STATE: AgentRuntimeStoreState = {
  capabilities: null,
  sessions: new Map(),
  orderedSessions: [],
  orderedOpenSessions: [],
};

let state = INITIAL_STATE;
let initialized = false;
let removeListener: (() => void) | null = null;
const listeners = new Set<() => void>();
let pendingSessionUpdates = new Map<string, AgentSessionSnapshot>();
const pendingSessionHydrations = new Map<string, Promise<AgentSessionSnapshot | null>>();
const sessionUpdateScheduler = createFrameTask(() => {
  if (pendingSessionUpdates.size === 0) {
    return;
  }

  const queuedUpdates = pendingSessionUpdates;
  pendingSessionUpdates = new Map();
  updateSessionsMap((previous) => {
    const next = new Map(previous);
    queuedUpdates.forEach((snapshot, sessionId) => {
      next.set(sessionId, snapshot);
    });
    return next;
  });
});

function sortSessionsByUpdatedAt(sessions: Iterable<AgentSessionSnapshot>): AgentSessionSnapshot[] {
  return [...sessions].sort((left, right) => right.updatedAtMs - left.updatedAtMs);
}

function deriveOrderedOpenSessions(sessions: AgentSessionSnapshot[]): AgentSessionSnapshot[] {
  return sessions.filter((session) => session.isOpen);
}

function emitStoreChange(): void {
  listeners.forEach((listener) => listener());
}

function replaceState(nextState: AgentRuntimeStoreState): void {
  state = nextState;
  emitStoreChange();
}

function updateSessionsMap(mutator: (previous: Map<string, AgentSessionSnapshot>) => Map<string, AgentSessionSnapshot>): void {
  const nextSessions = mutator(state.sessions);
  const orderedSessions = sortSessionsByUpdatedAt(nextSessions.values());
  replaceState({
    ...state,
    sessions: nextSessions,
    orderedSessions,
    orderedOpenSessions: deriveOrderedOpenSessions(orderedSessions),
  });
}

function upsertSession(snapshot: AgentSessionSnapshot): void {
  updateSessionsMap((previous) => {
    const next = new Map(previous);
    next.set(snapshot.id, snapshot);
    return next;
  });
}

function queueSessionUpdate(snapshot: AgentSessionSnapshot): void {
  pendingSessionUpdates.set(snapshot.id, snapshot);
  sessionUpdateScheduler.schedule();
}

function hydrateSessionSnapshot(sessionId: string): Promise<AgentSessionSnapshot | null> {
  const pendingHydration = pendingSessionHydrations.get(sessionId);
  if (pendingHydration) {
    return pendingHydration;
  }

  const hydration = getAgentRuntimeSession(sessionId)
    .then((snapshot) => {
      if (!snapshot) {
        return null;
      }

      const mapped = mapAgentRuntimeSnapshot(snapshot);
      upsertSession(mapped);
      return mapped;
    })
    .finally(() => {
      pendingSessionHydrations.delete(sessionId);
    });

  pendingSessionHydrations.set(sessionId, hydration);
  return hydration;
}

function removeSession(sessionId: string): void {
  pendingSessionUpdates.delete(sessionId);
  updateSessionsMap((previous) => {
    if (!previous.has(sessionId)) {
      return previous;
    }

    const next = new Map(previous);
    next.delete(sessionId);
    return next;
  });
}

async function initializeAgentRuntimeStore(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  const [capabilitiesResult, sessionsResult] = await Promise.allSettled([
    refreshAgentRuntimeCapabilities(),
    listAgentRuntimeSessionSummaries(),
  ]);

  let nextCapabilities = state.capabilities;
  let nextSessions = state.sessions;

  if (capabilitiesResult.status === "fulfilled") {
    nextCapabilities = capabilitiesResult.value;
  } else {
    console.warn("Failed to initialize agent runtime capabilities:", capabilitiesResult.reason);
  }

  if (sessionsResult.status === "fulfilled") {
    nextSessions = new Map(
      sessionsResult.value
        .map((summary) => mapAgentRuntimeSessionSummary(summary))
        .map((snapshot) => [snapshot.id, snapshot] as const),
    );
  } else {
    console.warn("Failed to initialize agent runtime sessions:", sessionsResult.reason);
  }

  const orderedSessions = sortSessionsByUpdatedAt(nextSessions.values());
  replaceState({
    ...state,
    capabilities: nextCapabilities,
    sessions: nextSessions,
    orderedSessions,
    orderedOpenSessions: deriveOrderedOpenSessions(orderedSessions),
  });

  try {
    removeListener = await onAgentRuntimeSessionUpdated((event) => {
      queueSessionUpdate(mapAgentRuntimeSnapshot(event.snapshot));
    });
  } catch (error) {
    console.warn("Failed to subscribe to agent runtime updates:", error);
  }

  orderedSessions
    .filter((session) => session.isOpen)
    .forEach((session) => {
      void hydrateSessionSnapshot(session.id).catch((error) => {
        console.warn(`Failed to hydrate open agent session ${session.id}:`, error);
      });
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getCapabilitiesSnapshot(): AgentRuntimeCapabilities | null {
  return state.capabilities;
}

function getSessionsSnapshot(): Map<string, AgentSessionSnapshot> {
  return state.sessions;
}

function getOrderedSessionsSnapshot(): AgentSessionSnapshot[] {
  return state.orderedSessions;
}

function getOrderedOpenSessionsSnapshot(): AgentSessionSnapshot[] {
  return state.orderedOpenSessions;
}

function getSessionSnapshot(sessionId: string | null): AgentSessionSnapshot | null {
  if (!sessionId) {
    return null;
  }

  return state.sessions.get(sessionId) ?? null;
}

export function useInitializeAgentRuntimeStore(): void {
  useEffect(() => {
    void initializeAgentRuntimeStore();
  }, []);
}

export function useAgentRuntimeCapabilitiesState(): AgentRuntimeCapabilities | null {
  useInitializeAgentRuntimeStore();
  return useSyncExternalStore(subscribe, getCapabilitiesSnapshot, getCapabilitiesSnapshot);
}

export function useAgentRuntimeSessionsState(): Map<string, AgentSessionSnapshot> {
  useInitializeAgentRuntimeStore();
  return useSyncExternalStore(subscribe, getSessionsSnapshot, getSessionsSnapshot);
}

export function useOrderedAgentRuntimeSessions(): AgentSessionSnapshot[] {
  useInitializeAgentRuntimeStore();
  return useSyncExternalStore(subscribe, getOrderedSessionsSnapshot, getOrderedSessionsSnapshot);
}

export function useOrderedOpenAgentRuntimeSessions(): AgentSessionSnapshot[] {
  useInitializeAgentRuntimeStore();
  return useSyncExternalStore(subscribe, getOrderedOpenSessionsSnapshot, getOrderedOpenSessionsSnapshot);
}

export function useAgentRuntimeSessionState(sessionId: string | null): AgentSessionSnapshot | null {
  useInitializeAgentRuntimeStore();
  return useSyncExternalStore(
    subscribe,
    () => getSessionSnapshot(sessionId),
    () => getSessionSnapshot(sessionId),
  );
}

export async function getAgentRuntimeSessionState(
  sessionId: string
): Promise<AgentSessionSnapshot | null> {
  const cached = state.sessions.get(sessionId);
  if (cached?.hydrationState === "full") {
    return cached;
  }
  return hydrateSessionSnapshot(sessionId);
}

export async function createAgentRuntimeSessionState(
  input: CreateAgentSessionInput
): Promise<AgentSessionSnapshot> {
  const snapshot = mapAgentRuntimeSnapshot(await createAgentRuntimeSession(input));
  upsertSession(snapshot);
  return snapshot;
}

export async function startAgentRuntimeTurnState(
  input: {
    sessionId: string;
    prompt: string;
    interactionMode?: AgentRuntimeInteractionMode;
    attachments?: AgentRuntimeAttachment[];
    claudeOAuthToken?: string;
    automationMode?: boolean;
  }
): Promise<AgentSessionSnapshot> {
  const snapshot = mapAgentRuntimeSnapshot(await startAgentRuntimeTurn(input));
  upsertSession(snapshot);
  return snapshot;
}

export async function stageAgentRuntimeAttachmentState(input: {
  sessionId: string;
  name: string;
  mimeType: string;
  base64Content: string;
}): Promise<AgentRuntimeAttachment> {
  return stageAgentRuntimeAttachment(input);
}

export async function discardAgentRuntimeAttachmentState(
  sessionId: string,
  attachmentId: string
): Promise<void> {
  await discardAgentRuntimeAttachment(sessionId, attachmentId);
}

export async function stopAgentRuntimeSessionState(sessionId: string): Promise<void> {
  await stopAgentRuntimeSession(sessionId);
}

export async function respondAgentRuntimeRequestState(input: {
  sessionId: string;
  requestId: string;
  decision?: string;
  answers?: string[];
}): Promise<AgentSessionSnapshot> {
  const snapshot = mapAgentRuntimeSnapshot(await respondAgentRuntimeRequest(input));
  upsertSession(snapshot);
  return snapshot;
}

export async function updateAgentRuntimeSessionState(input: {
  sessionId: string;
  isOpen?: boolean;
  model?: string;
  name?: string;
  nameMode?: "default" | "auto" | "manual";
}): Promise<AgentSessionSnapshot> {
  const snapshot = mapAgentRuntimeSnapshot(await updateAgentRuntimeSession(input));
  upsertSession(snapshot);
  return snapshot;
}

export async function deleteAgentRuntimeSessionState(sessionId: string): Promise<void> {
  await deleteAgentRuntimeSession(sessionId);
  removeSession(sessionId);
}

export async function refreshAgentRuntimeCapabilitiesState(): Promise<AgentRuntimeCapabilities> {
  const capabilities = await refreshAgentRuntimeCapabilities();
  replaceState({
    ...state,
    capabilities,
  });
  return capabilities;
}

export async function disposeAgentRuntimeStore(): Promise<void> {
  if (removeListener) {
    removeListener();
    removeListener = null;
  }
  initialized = false;
  replaceState(INITIAL_STATE);
}
