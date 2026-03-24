import { useCallback, useEffect, useMemo } from "react";
import type { AgentSessionSnapshot } from "../../../entities";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeCapabilities,
  AgentRuntimeInteractionMode,
  AgentRuntimeProviderTurnOptions,
  CreateAgentSessionInput,
} from "../../../shared";
import {
  createAgentRuntimeSessionState,
  deleteAgentRuntimeSessionState,
  discardAgentRuntimeAttachmentState,
  getAgentRuntimeSessionState,
  respondAgentRuntimeRequestState,
  stageAgentRuntimeAttachmentState,
  startAgentRuntimeTurnState,
  stopAgentRuntimeSessionState,
  updateAgentRuntimeSessionState,
  useAgentRuntimeCapabilitiesState,
  useAgentRuntimeSessionState,
  useOrderedAgentRuntimeSessions,
  useOrderedOpenAgentRuntimeSessions,
} from "./agentRuntimeStore";

interface UseAgentRuntimeInput {
  claudeOAuthToken: string;
}

interface UseAgentRuntimeResult {
  capabilities: AgentRuntimeCapabilities | null;
  agentSessions: Map<string, AgentSessionSnapshot>;
  openAgentSessions: Map<string, AgentSessionSnapshot>;
  getSession: (sessionId: string) => Promise<AgentSessionSnapshot | null>;
  createSession: (input: CreateAgentSessionInput) => Promise<AgentSessionSnapshot>;
  startTurn: (
    sessionId: string,
    prompt: string,
    options?: {
      automationMode?: boolean;
      interactionMode?: AgentRuntimeInteractionMode;
      attachments?: AgentRuntimeAttachment[];
      sourceProposedPlanId?: string;
      providerTurnOptions?: AgentRuntimeProviderTurnOptions;
    }
  ) => Promise<void>;
  stageAttachment: (input: {
    sessionId: string;
    name: string;
    mimeType: string;
    base64Content: string;
  }) => Promise<AgentRuntimeAttachment>;
  discardAttachment: (sessionId: string, attachmentId: string) => Promise<void>;
  respondToRequest: (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ) => Promise<void>;
  updateSession: (input: {
    sessionId: string;
    isOpen?: boolean;
    model?: string;
    effort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
    name?: string;
    nameMode?: "default" | "auto" | "manual";
  }) => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useAgentRuntimeSession(sessionId: string | null): AgentSessionSnapshot | null {
  const session = useAgentRuntimeSessionState(sessionId);

  useEffect(() => {
    if (!sessionId || session?.hydrationState === "full") {
      return;
    }

    void getAgentRuntimeSessionState(sessionId).catch((error) => {
      console.warn(`Failed to hydrate agent session ${sessionId}:`, error);
    });
  }, [session?.hydrationState, sessionId]);

  return session;
}

export function useAgentRuntime({
  claudeOAuthToken,
}: UseAgentRuntimeInput): UseAgentRuntimeResult {
  const capabilities = useAgentRuntimeCapabilitiesState();
  const orderedAgentSessions = useOrderedAgentRuntimeSessions();
  const orderedOpenAgentSessions = useOrderedOpenAgentRuntimeSessions();

  const agentSessions = useMemo(
    () => new Map(orderedAgentSessions.map((session) => [session.id, session])),
    [orderedAgentSessions],
  );
  const openAgentSessions = useMemo(
    () => new Map(orderedOpenAgentSessions.map((session) => [session.id, session])),
    [orderedOpenAgentSessions],
  );

  const createSession = useCallback(async (
    input: CreateAgentSessionInput
  ): Promise<AgentSessionSnapshot> => {
    return createAgentRuntimeSessionState(input);
  }, []);

  const getSession = useCallback(async (sessionId: string): Promise<AgentSessionSnapshot | null> => {
    return getAgentRuntimeSessionState(sessionId);
  }, []);

  const startTurn = useCallback(async (
    sessionId: string,
    prompt: string,
    options?: {
      automationMode?: boolean;
      interactionMode?: AgentRuntimeInteractionMode;
      attachments?: AgentRuntimeAttachment[];
      sourceProposedPlanId?: string;
      providerTurnOptions?: AgentRuntimeProviderTurnOptions;
    }
  ): Promise<void> => {
    if (!prompt.trim()) {
      return;
    }

    await startAgentRuntimeTurnState({
      sessionId,
      prompt,
      interactionMode: options?.interactionMode,
      attachments: options?.attachments,
      sourceProposedPlanId: options?.sourceProposedPlanId,
      providerTurnOptions: options?.providerTurnOptions,
      claudeOAuthToken,
      automationMode: options?.automationMode,
    });
  }, [claudeOAuthToken]);

  const stageAttachment = useCallback(async (input: {
    sessionId: string;
    name: string;
    mimeType: string;
    base64Content: string;
  }): Promise<AgentRuntimeAttachment> => {
    return stageAgentRuntimeAttachmentState(input);
  }, []);

  const discardAttachment = useCallback(async (
    sessionId: string,
    attachmentId: string,
  ): Promise<void> => {
    await discardAgentRuntimeAttachmentState(sessionId, attachmentId);
  }, []);

  const respondToRequest = useCallback(async (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ): Promise<void> => {
    await respondAgentRuntimeRequestState({
      sessionId,
      requestId,
      decision: input.decision,
      answers: input.answers,
    });
  }, []);

  const updateSession = useCallback(async (
    input: {
      sessionId: string;
      isOpen?: boolean;
      model?: string;
      effort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
      name?: string;
      nameMode?: "default" | "auto" | "manual";
    }
  ): Promise<void> => {
    await updateAgentRuntimeSessionState(input);
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

  const stopSession = useCallback(async (sessionId: string): Promise<void> => {
    await stopAgentRuntimeSessionState(sessionId);
  }, []);

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    await deleteAgentRuntimeSessionState(sessionId);
  }, []);

  return {
    capabilities,
    agentSessions,
    openAgentSessions,
    getSession,
    createSession,
    startTurn,
    stageAttachment,
    discardAttachment,
    respondToRequest,
    updateSession,
    openSession,
    closeSession,
    stopSession,
    deleteSession,
  };
}
