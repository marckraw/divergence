import { useCallback, useMemo, useState } from "react";
import { getErrorMessage, renderTemplateCommand } from "../../../shared";
import {
  runLocalGithubPrAgentPrompt,
  writeGithubPrChatBrief,
} from "../api/githubPrChat.api";
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

const DEFAULT_AGENT: GithubPrChatAgent = "claude";
const DEFAULT_TIMEOUT_MS = 120_000;

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

function buildMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

interface UseGithubPrChatInput {
  selectedPullRequest: GithubPullRequestSummary | null;
  detail: GithubPullRequestDetail | null;
  detailFiles: GithubPullRequestFile[];
  selectedFilePath: string | null;
  agentCommandClaude: string;
  agentCommandCodex: string;
  claudeOAuthToken: string;
}

export function useGithubPrChat({
  selectedPullRequest,
  detail,
  detailFiles,
  selectedFilePath,
  agentCommandClaude,
  agentCommandCodex,
  claudeOAuthToken,
}: UseGithubPrChatInput) {
  const [threadByPrKey, setThreadByPrKey] = useState<Record<string, GithubPrChatThreadState>>({});

  const activePrKey = useMemo(() => (
    selectedPullRequest ? buildPrKey(selectedPullRequest) : null
  ), [selectedPullRequest]);

  const activeThread = useMemo(() => {
    if (!activePrKey) {
      return createDefaultThreadState();
    }
    return threadByPrKey[activePrKey] ?? createDefaultThreadState();
  }, [activePrKey, threadByPrKey]);

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
    updateThread(activePrKey, () => createDefaultThreadState());
  }, [activePrKey, updateThread]);

  const sendMessage = useCallback(async (): Promise<boolean> => {
    if (!activePrKey || !selectedPullRequest || !detail) {
      return false;
    }

    const thread = threadByPrKey[activePrKey] ?? createDefaultThreadState();
    const question = thread.draft.trim();
    if (!question || thread.sending) {
      return false;
    }

    if (!selectedPullRequest.projectPath.trim()) {
      updateThread(activePrKey, (current) => ({
        ...current,
        error: "Project path is missing for this pull request.",
      }));
      return false;
    }

    const userMessage: GithubPrChatMessage = {
      id: buildMessageId(),
      prKey: activePrKey,
      role: "user",
      content: question,
      createdAtMs: Date.now(),
      status: "done",
      error: null,
    };
    const pendingMessageId = buildMessageId();
    const pendingAssistant: GithubPrChatMessage = {
      id: pendingMessageId,
      prKey: activePrKey,
      role: "assistant",
      content: "Thinking...",
      createdAtMs: Date.now(),
      status: "pending",
      error: null,
    };

    updateThread(activePrKey, (current) => ({
      ...current,
      draft: "",
      sending: true,
      error: null,
      messages: [...current.messages, userMessage, pendingAssistant],
    }));

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
        recentMessages: thread.messages,
        userQuestion: question,
      });
      const { path: briefPath } = await writeGithubPrChatBrief(
        selectedPullRequest.projectPath,
        promptMarkdown,
      );

      const commandTemplate = thread.selectedAgent === "claude"
        ? agentCommandClaude
        : agentCommandCodex;
      if (!commandTemplate.trim()) {
        throw new Error(`No ${thread.selectedAgent} command template configured in settings.`);
      }

      const command = renderTemplateCommand(commandTemplate, {
        workspacePath: selectedPullRequest.projectPath,
        briefPath,
      });

      const envVars: [string, string][] = [];
      const oauthToken = claudeOAuthToken.trim();
      if (thread.selectedAgent === "claude" && oauthToken) {
        envVars.push(["CLAUDE_CODE_OAUTH_TOKEN", oauthToken]);
      }

      const result = await runLocalGithubPrAgentPrompt({
        command,
        cwd: selectedPullRequest.projectPath,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        envVars,
      });

      if (result.timedOut) {
        throw new Error(`Agent timed out after ${Math.round(result.durationMs / 1000)}s.`);
      }

      const stdout = result.stdout.trim();
      const stderr = result.stderr.trim();
      if ((result.exitCode ?? 0) !== 0 && !stdout) {
        throw new Error(stderr || `Agent exited with code ${result.exitCode}.`);
      }

      const content = stdout || stderr;
      if (!content) {
        throw new Error("Agent returned no output.");
      }

      const assistantMessage: GithubPrChatMessage = {
        id: pendingMessageId,
        prKey: activePrKey,
        role: "assistant",
        content,
        createdAtMs: Date.now(),
        status: "done",
        error: null,
      };

      updateThread(activePrKey, (current) => ({
        ...current,
        sending: false,
        error: null,
        messages: current.messages.map((message) => (
          message.id === pendingMessageId ? assistantMessage : message
        )),
      }));
      return true;
    } catch (error) {
      const message = getErrorMessage(error, "Failed to run PR chat.");
      const failedAssistant: GithubPrChatMessage = {
        id: pendingMessageId,
        prKey: activePrKey,
        role: "assistant",
        content: message,
        createdAtMs: Date.now(),
        status: "error",
        error: message,
      };
      updateThread(activePrKey, (current) => ({
        ...current,
        sending: false,
        error: message,
        messages: current.messages.map((item) => (
          item.id === pendingMessageId ? failedAssistant : item
        )),
      }));
      return false;
    }
  }, [
    activePrKey,
    agentCommandClaude,
    agentCommandCodex,
    claudeOAuthToken,
    detail,
    detailFiles,
    selectedFilePath,
    selectedPullRequest,
    threadByPrKey,
    updateThread,
  ]);

  return {
    activePrKey,
    messages: activeThread.messages,
    draft: activeThread.draft,
    selectedAgent: activeThread.selectedAgent,
    includeAllPatches: activeThread.includeAllPatches,
    sending: activeThread.sending,
    error: activeThread.error,
    setDraft,
    setSelectedAgent,
    setIncludeAllPatches,
    clearActiveThread,
    sendMessage,
  };
}
