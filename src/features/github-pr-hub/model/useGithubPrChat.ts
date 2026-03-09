import { useCallback, useMemo, useState } from "react";
import type { AgentSessionSnapshot } from "../../../entities";
import { getDefaultAgentProvider, type CreateAgentSessionInput } from "../../../shared";
import { buildGithubPrChatContextMarkdown } from "../lib/githubPrChatContext.pure";
import { buildGithubPrChatPromptMarkdown } from "../lib/githubPrChatPrompt.pure";
import type {
  GithubPrChatAgent,
  GithubPrChatMessage,
  GithubPrChatThreadState,
} from "./githubPrChat.types";
import type {
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestSummary,
} from "./githubPrHub.types";

const DEFAULT_AGENT: GithubPrChatAgent = getDefaultAgentProvider();

function createDefaultThreadState(): GithubPrChatThreadState {
  return {
    draft: "",
    messages: [],
    selectedAgent: DEFAULT_AGENT,
    includeAllPatches: false,
    sending: false,
    error: null,
  };
}

function buildPrKey(pullRequest: GithubPullRequestSummary): string {
  return `${pullRequest.repoKey}#${pullRequest.number}`;
}

function mapRuntimeMessages(
  prKey: string,
  snapshot: AgentSessionSnapshot | null
): GithubPrChatMessage[] {
  if (!snapshot) {
    return [];
  }

  return snapshot.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      id: message.id,
      prKey,
      role: message.role,
      content: message.content,
      createdAtMs: message.createdAtMs,
      status: message.status === "streaming"
        ? "pending"
        : message.status === "error"
          ? "error"
          : "done",
      error: message.status === "error"
        ? (snapshot.errorMessage ?? message.content)
        : null,
    }));
}

interface UseGithubPrChatInput {
  selectedPullRequest: GithubPullRequestSummary | null;
  detail: GithubPullRequestDetail | null;
  detailFiles: GithubPullRequestFile[];
  selectedFilePath: string | null;
  agentSessions: Map<string, AgentSessionSnapshot>;
  createAgentSession: (input: CreateAgentSessionInput) => Promise<{ id: string }>;
  startAgentTurn: (sessionId: string, prompt: string) => Promise<void>;
  deleteAgentSession: (sessionId: string) => Promise<void>;
}

export function useGithubPrChat({
  selectedPullRequest,
  detail,
  detailFiles,
  selectedFilePath,
  agentSessions,
  createAgentSession,
  startAgentTurn,
  deleteAgentSession,
}: UseGithubPrChatInput) {
  const [threadByPrKey, setThreadByPrKey] = useState<Record<string, GithubPrChatThreadState>>({});
  const [sessionIdByPrKey, setSessionIdByPrKey] = useState<Record<string, string>>({});

  const activePrKey = useMemo(() => (
    selectedPullRequest ? buildPrKey(selectedPullRequest) : null
  ), [selectedPullRequest]);

  const activeThread = useMemo(() => {
    if (!activePrKey) {
      return createDefaultThreadState();
    }
    return threadByPrKey[activePrKey] ?? createDefaultThreadState();
  }, [activePrKey, threadByPrKey]);

  const activeRuntimeSession = useMemo(() => {
    if (!activePrKey) {
      return null;
    }
    const sessionId = sessionIdByPrKey[activePrKey];
    return sessionId ? agentSessions.get(sessionId) ?? null : null;
  }, [activePrKey, agentSessions, sessionIdByPrKey]);

  const updateThread = useCallback((prKey: string, updater: (current: GithubPrChatThreadState) => GithubPrChatThreadState) => {
    setThreadByPrKey((previous) => {
      const current = previous[prKey] ?? createDefaultThreadState();
      const next = updater(current);
      return {
        ...previous,
        [prKey]: next,
      };
    });
  }, []);

  const setDraft = useCallback((value: string) => {
    if (!activePrKey) {
      return;
    }
    updateThread(activePrKey, (current) => ({
      ...current,
      draft: value,
    }));
  }, [activePrKey, updateThread]);

  const setSelectedAgent = useCallback((agent: GithubPrChatAgent) => {
    if (!activePrKey) {
      return;
    }
    updateThread(activePrKey, (current) => ({
      ...current,
      selectedAgent: agent,
    }));
  }, [activePrKey, updateThread]);

  const setIncludeAllPatches = useCallback((value: boolean) => {
    if (!activePrKey) {
      return;
    }
    updateThread(activePrKey, (current) => ({
      ...current,
      includeAllPatches: value,
    }));
  }, [activePrKey, updateThread]);

  const clearActiveThread = useCallback(() => {
    if (!activePrKey) {
      return;
    }

    const sessionId = sessionIdByPrKey[activePrKey];
    if (sessionId) {
      void deleteAgentSession(sessionId).catch((error) => {
        console.warn("Failed to delete PR chat agent session:", error);
      });
      setSessionIdByPrKey((previous) => {
        const next = { ...previous };
        delete next[activePrKey];
        return next;
      });
    }

    updateThread(activePrKey, () => createDefaultThreadState());
  }, [activePrKey, deleteAgentSession, sessionIdByPrKey, updateThread]);

  const sendMessage = useCallback(async (): Promise<boolean> => {
    if (!activePrKey || !selectedPullRequest || !detail) {
      return false;
    }

    const thread = threadByPrKey[activePrKey] ?? createDefaultThreadState();
    const question = thread.draft.trim();
    if (!question) {
      return false;
    }

    if (!selectedPullRequest.projectPath.trim()) {
      updateThread(activePrKey, (current) => ({
        ...current,
        error: "Project path is missing for this pull request.",
      }));
      return false;
    }

    try {
      const contextMarkdown = buildGithubPrChatContextMarkdown({
        pullRequest: selectedPullRequest,
        detail,
        files: detailFiles,
        selectedFilePath,
        includeAllPatches: thread.includeAllPatches,
      });
      const promptMarkdown = buildGithubPrChatPromptMarkdown({
        contextMarkdown,
        recentMessages: mapRuntimeMessages(
          activePrKey,
          activeRuntimeSession,
        ),
        userQuestion: question,
      });

      let sessionId = sessionIdByPrKey[activePrKey] ?? null;
      if (!sessionId) {
        const createdSession = await createAgentSession({
          provider: thread.selectedAgent,
          targetType: "project",
          targetId: selectedPullRequest.projectId,
          projectId: selectedPullRequest.projectId,
          workspaceKey: `project:${selectedPullRequest.projectId}`,
          sessionRole: "default",
          name: `PR #${selectedPullRequest.number} • ${thread.selectedAgent}`,
          path: selectedPullRequest.projectPath,
        });
        sessionId = createdSession.id;
        setSessionIdByPrKey((previous) => ({
          ...previous,
          [activePrKey]: createdSession.id,
        }));
      }

      updateThread(activePrKey, (current) => ({
        ...current,
        draft: "",
        error: null,
      }));
      await startAgentTurn(sessionId, promptMarkdown);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run PR chat.";
      updateThread(activePrKey, (current) => ({
        ...current,
        error: message,
      }));
      return false;
    }
  }, [
    activePrKey,
    activeRuntimeSession,
    createAgentSession,
    detail,
    detailFiles,
    selectedFilePath,
    selectedPullRequest,
    sessionIdByPrKey,
    startAgentTurn,
    threadByPrKey,
    updateThread,
  ]);

  return {
    activePrKey,
    messages: activePrKey ? mapRuntimeMessages(activePrKey, activeRuntimeSession) : [],
    draft: activeThread.draft,
    selectedAgent: activeThread.selectedAgent,
    includeAllPatches: activeThread.includeAllPatches,
    sending: activeRuntimeSession?.runtimeStatus === "running",
    error: activeRuntimeSession?.errorMessage ?? activeThread.error,
    setDraft,
    setSelectedAgent,
    setIncludeAllPatches,
    clearActiveThread,
    sendMessage,
  };
}
