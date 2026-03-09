import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { AgentProvider, TerminalSession } from "../../entities";
import { createAgentSessionLabel } from "../../entities";

interface UseReviewAgentSessionParams {
  sessionsRef: MutableRefObject<Map<string, TerminalSession>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  createAgentSession: (input: {
    provider: AgentProvider;
    targetType: "project" | "divergence" | "workspace" | "workspace_divergence";
    targetId: number;
    projectId: number;
    workspaceOwnerId?: number;
    workspaceKey: string;
    sessionRole?: "default" | "review-agent" | "manual";
    name: string;
    path: string;
  }) => Promise<{ id: string }>;
  startAgentTurn: (sessionId: string, prompt: string) => Promise<void>;
}

interface UseReviewAgentSessionResult {
  handleRunReviewAgent: (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: AgentProvider;
    briefMarkdown: string;
  }) => Promise<void>;
}

export function useReviewAgentSession({
  sessionsRef,
  setActiveSessionId,
  createAgentSession,
  startAgentTurn,
}: UseReviewAgentSessionParams): UseReviewAgentSessionResult {
  const handleRunReviewAgent = useCallback(async (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: AgentProvider;
    briefMarkdown: string;
  }) => {
    const sourceSession = sessionsRef.current.get(input.sourceSessionId);
    if (!sourceSession) {
      throw new Error("Source session not found.");
    }

    const reviewSession = await createAgentSession({
      provider: input.agent,
      targetType: sourceSession.type,
      targetId: sourceSession.targetId,
      projectId: sourceSession.projectId,
      workspaceOwnerId: sourceSession.workspaceOwnerId,
      workspaceKey: sourceSession.workspaceKey,
      sessionRole: "review-agent",
      name: createAgentSessionLabel(sourceSession.name, input.agent, "review-agent"),
      path: input.workspacePath,
    });

    setActiveSessionId(reviewSession.id);
    await startAgentTurn(reviewSession.id, input.briefMarkdown);
  }, [createAgentSession, sessionsRef, setActiveSessionId, startAgentTurn]);

  return {
    handleRunReviewAgent,
  };
}
