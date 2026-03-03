import { useCallback } from "react";
import type { TerminalSession } from "../../entities";
import { buildSplitTmuxSessionName } from "../../entities/terminal-session";
import {
  renderReviewAgentCommand,
  writeReviewBriefFile,
  type DiffReviewAgent,
} from "../../features/diff-review";
import { generateSessionEntropy } from "../lib/sessionBuilder.pure";

interface UseReviewAgentSessionParams {
  sessionsRef: React.MutableRefObject<Map<string, TerminalSession>>;
  setSessions: React.Dispatch<React.SetStateAction<Map<string, TerminalSession>>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  sendCommandToSession: (sessionId: string, command: string, options?: { timeoutMs?: number; activateIfNeeded?: boolean }) => Promise<void>;
  appSettings: {
    agentCommandClaude: string;
    agentCommandCodex: string;
  };
}

interface UseReviewAgentSessionResult {
  handleRunReviewAgent: (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: DiffReviewAgent;
    briefMarkdown: string;
  }) => Promise<void>;
}

export function useReviewAgentSession({
  sessionsRef,
  setSessions,
  setActiveSessionId,
  sendCommandToSession,
  appSettings,
}: UseReviewAgentSessionParams): UseReviewAgentSessionResult {
  const createReviewAgentSession = useCallback((sourceSession: TerminalSession, agent: DiffReviewAgent): TerminalSession => {
    const entropy = generateSessionEntropy();
    const shortRunId = entropy.split("-")[1]?.padStart(3, "0") ?? "000";
    const sessionId = `${sourceSession.type}-${sourceSession.targetId}#review-${entropy}`;
    const tmuxSessionName = sourceSession.useTmux
      ? buildSplitTmuxSessionName(sourceSession.tmuxSessionName, `review-${entropy}`)
      : sourceSession.tmuxSessionName;
    const session: TerminalSession = {
      ...sourceSession,
      id: sessionId,
      sessionRole: "review-agent",
      name: `${sourceSession.name} • ${agent} #${shortRunId}`,
      tmuxSessionName,
      status: "idle",
      lastActivity: new Date(),
    };

    setSessions((previous) => {
      const next = new Map(previous);
      next.set(session.id, session);
      return next;
    });
    return session;
  }, [setSessions]);

  const handleRunReviewAgent = useCallback(async (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: DiffReviewAgent;
    briefMarkdown: string;
  }) => {
    const sourceSession = sessionsRef.current.get(input.sourceSessionId);
    if (!sourceSession) {
      throw new Error("Source session not found.");
    }

    const { path: briefPath } = await writeReviewBriefFile(input.workspacePath, input.briefMarkdown);
    const template = input.agent === "claude"
      ? appSettings.agentCommandClaude
      : appSettings.agentCommandCodex;
    if (!template.trim()) {
      throw new Error(`No ${input.agent} command template configured in settings.`);
    }

    const command = renderReviewAgentCommand(template, {
      workspacePath: input.workspacePath,
      briefPath,
    });
    const reviewSession = createReviewAgentSession(sourceSession, input.agent);
    setActiveSessionId(reviewSession.id);

    await sendCommandToSession(reviewSession.id, command, { activateIfNeeded: false });
  }, [
    appSettings.agentCommandClaude,
    appSettings.agentCommandCodex,
    createReviewAgentSession,
    sendCommandToSession,
    sessionsRef,
    setActiveSessionId,
  ]);

  return {
    handleRunReviewAgent,
  };
}
