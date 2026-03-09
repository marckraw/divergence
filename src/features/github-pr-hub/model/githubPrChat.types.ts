import type { AgentRuntimeProvider } from "../../../shared";
import type {
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestSummary,
} from "./githubPrHub.types";

export type GithubPrChatAgent = AgentRuntimeProvider;

export type GithubPrChatMessageRole = "user" | "assistant" | "system";

export type GithubPrChatMessageStatus = "pending" | "done" | "error";

export interface GithubPrChatMessage {
  id: string;
  prKey: string;
  role: GithubPrChatMessageRole;
  content: string;
  createdAtMs: number;
  status: GithubPrChatMessageStatus;
  error: string | null;
}

export interface GithubPrChatThreadState {
  draft: string;
  messages: GithubPrChatMessage[];
  selectedAgent: GithubPrChatAgent;
  includeAllPatches: boolean;
  sending: boolean;
  error: string | null;
}

export interface GithubPrChatContextInput {
  pullRequest: GithubPullRequestSummary;
  detail: GithubPullRequestDetail;
  files: GithubPullRequestFile[];
  selectedFilePath: string | null;
  includeAllPatches: boolean;
}

export interface GithubPrChatPromptInput {
  contextMarkdown: string;
  recentMessages: GithubPrChatMessage[];
  userQuestion: string;
}

export interface LocalAgentPromptResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}
