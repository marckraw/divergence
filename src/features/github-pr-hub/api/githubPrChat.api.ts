import { invoke } from "@tauri-apps/api/core";
import type { LocalAgentPromptResult } from "../model/githubPrChat.types";

interface WriteReviewBriefResponse {
  path: string;
}

export async function writeGithubPrChatBrief(
  workspacePath: string,
  markdown: string,
): Promise<WriteReviewBriefResponse> {
  return invoke<WriteReviewBriefResponse>("write_review_brief_file", {
    workspacePath,
    markdown,
  });
}

export async function runLocalGithubPrAgentPrompt(input: {
  command: string;
  cwd: string;
  timeoutMs?: number;
  envVars?: [string, string][];
}): Promise<LocalAgentPromptResult> {
  return invoke<LocalAgentPromptResult>("run_local_agent_prompt", {
    command: input.command,
    cwd: input.cwd,
    timeoutMs: input.timeoutMs,
    envVars: input.envVars ?? [],
  });
}
