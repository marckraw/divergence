import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { AgentSessionSnapshot } from "../../../entities";
import {
  createAgentRuntimeSession,
  deleteAgentRuntimeSession,
  getAgentRuntimeSession,
  listAgentRuntimeSessions,
  onAgentRuntimeSessionUpdated,
  refreshAgentRuntimeCapabilities,
  respondAgentRuntimeRequest,
  startAgentRuntimeTurn,
  stopAgentRuntimeSession,
  updateAgentRuntimeSession,
  type AgentRuntimeCapabilities,
  type CreateAgentSessionInput,
} from "../../../shared";
import { mapAgentRuntimeSnapshot } from "../lib/agentRuntimeSnapshot.pure";

interface UseAgentRuntimeInput {
  claudeOAuthToken: string;
}

interface UseAgentRuntimeResult {
  capabilities: AgentRuntimeCapabilities | null;
  agentSessions: Map<string, AgentSessionSnapshot>;
  openAgentSessions: Map<string, AgentSessionSnapshot>;
  agentSessionsRef: MutableRefObject<Map<string, AgentSessionSnapshot>>;
  getSession: (sessionId: string) => Promise<AgentSessionSnapshot | null>;
  createSession: (input: CreateAgentSessionInput) => Promise<AgentSessionSnapshot>;
  startTurn: (
    sessionId: string,
    prompt: string,
    options?: { automationMode?: boolean }
  ) => Promise<void>;
  respondToRequest: (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ) => Promise<void>;
  updateSession: (input: { sessionId: string; isOpen?: boolean; model?: string }) => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useAgentRuntime({
  claudeOAuthToken,
}: UseAgentRuntimeInput): UseAgentRuntimeResult {
  const [capabilities, setCapabilities] = useState<AgentRuntimeCapabilities | null>(null);
  const [agentSessions, setAgentSessions] = useState<Map<string, AgentSessionSnapshot>>(new Map());
  const agentSessionsRef = useRef(agentSessions);

  useEffect(() => {
    agentSessionsRef.current = agentSessions;
  }, [agentSessions]);

  useEffect(() => {
    let cancelled = false;

    void refreshAgentRuntimeCapabilities()
      .then((nextCapabilities) => {
        if (!cancelled) {
          setCapabilities(nextCapabilities);
        }
      })
      .catch((error) => {
        console.warn("Failed to load agent runtime capabilities:", error);
      });

    void listAgentRuntimeSessions()
      .then((snapshots) => {
        if (cancelled) {
          return;
        }
        setAgentSessions(new Map(
          snapshots.map((snapshot) => [snapshot.id, mapAgentRuntimeSnapshot(snapshot)])
        ));
      })
      .catch((error) => {
        console.warn("Failed to load agent runtime sessions:", error);
      });

    let removeListener: (() => void) | null = null;
    void onAgentRuntimeSessionUpdated((event) => {
      if (cancelled) {
        return;
      }
      const snapshot = mapAgentRuntimeSnapshot(event.snapshot);
      setAgentSessions((previous) => {
        const next = new Map(previous);
        next.set(snapshot.id, snapshot);
        return next;
      });
    }).then((unlisten) => {
      if (cancelled) {
        void unlisten();
        return;
      }
      removeListener = unlisten;
    });

    return () => {
      cancelled = true;
      if (removeListener) {
        void removeListener();
      }
    };
  }, []);

  const createSession = useCallback(async (
    input: CreateAgentSessionInput
  ): Promise<AgentSessionSnapshot> => {
    const snapshot = mapAgentRuntimeSnapshot(await createAgentRuntimeSession(input));
    setAgentSessions((previous) => {
      const next = new Map(previous);
      next.set(snapshot.id, snapshot);
      return next;
    });
    return snapshot;
  }, []);

  const getSession = useCallback(async (sessionId: string): Promise<AgentSessionSnapshot | null> => {
    const cached = agentSessionsRef.current.get(sessionId);
    if (cached) {
      return cached;
    }

    const snapshot = await getAgentRuntimeSession(sessionId);
    return snapshot ? mapAgentRuntimeSnapshot(snapshot) : null;
  }, []);

  const startTurn = useCallback(async (
    sessionId: string,
    prompt: string,
    options?: { automationMode?: boolean }
  ): Promise<void> => {
    if (!prompt.trim()) {
      return;
    }
    const snapshot = mapAgentRuntimeSnapshot(await startAgentRuntimeTurn({
      sessionId,
      prompt,
      claudeOAuthToken,
      automationMode: options?.automationMode,
    }));
    setAgentSessions((previous) => {
      const next = new Map(previous);
      next.set(snapshot.id, snapshot);
      return next;
    });
  }, [claudeOAuthToken]);

  const stopSession = useCallback(async (sessionId: string): Promise<void> => {
    await stopAgentRuntimeSession(sessionId);
  }, []);

  const respondToRequest = useCallback(async (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ): Promise<void> => {
    const snapshot = mapAgentRuntimeSnapshot(await respondAgentRuntimeRequest({
      sessionId,
      requestId,
      decision: input.decision,
      answers: input.answers,
    }));
    setAgentSessions((previous) => {
      const next = new Map(previous);
      next.set(snapshot.id, snapshot);
      return next;
    });
  }, []);

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    await deleteAgentRuntimeSession(sessionId);
    setAgentSessions((previous) => {
      if (!previous.has(sessionId)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const updateSession = useCallback(async (
    input: { sessionId: string; isOpen?: boolean; model?: string }
  ): Promise<void> => {
    const snapshot = mapAgentRuntimeSnapshot(await updateAgentRuntimeSession(input));
    setAgentSessions((previous) => {
      const next = new Map(previous);
      next.set(snapshot.id, snapshot);
      return next;
    });
  }, []);

  const openSession = useCallback(async (sessionId: string): Promise<void> => {
    await updateSession({
      sessionId,
      isOpen: true,
    });
  }, [updateSession]);

  const closeSession = useCallback(async (sessionId: string): Promise<void> => {
    await updateSession({
      sessionId,
      isOpen: false,
    });
  }, [updateSession]);

  const orderedAgentSessions = useMemo(() => {
    const items = Array.from(agentSessions.values());
    items.sort((left, right) => right.updatedAtMs - left.updatedAtMs);
    return new Map(items.map((item) => [item.id, item]));
  }, [agentSessions]);

  const orderedOpenAgentSessions = useMemo(() => {
    const items = Array.from(agentSessions.values())
      .filter((session) => session.isOpen)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
    return new Map(items.map((item) => [item.id, item]));
  }, [agentSessions]);

  return {
    capabilities,
    agentSessions: orderedAgentSessions,
    openAgentSessions: orderedOpenAgentSessions,
    agentSessionsRef,
    getSession,
    createSession,
    startTurn,
    respondToRequest,
    updateSession,
    openSession,
    closeSession,
    stopSession,
    deleteSession,
  };
}
