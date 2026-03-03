import type {
  GithubPrChatMessage,
  GithubPrChatPromptInput,
} from "../model/githubPrChat.types";

const MAX_HISTORY_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 2000;

function normalizeHistoryMessages(messages: GithubPrChatMessage[]): GithubPrChatMessage[] {
  return messages
    .filter((message) => (
      (message.role === "user" || message.role === "assistant")
      && message.status === "done"
    ))
    .slice(-MAX_HISTORY_MESSAGES);
}

function truncateMessageContent(content: string): string {
  if (content.length <= MAX_MESSAGE_CHARS) {
    return content;
  }
  return `${content.slice(0, MAX_MESSAGE_CHARS)}\n...[truncated]`;
}

export function buildGithubPrChatPromptMarkdown(input: GithubPrChatPromptInput): string {
  const history = normalizeHistoryMessages(input.recentMessages);
  const lines: string[] = [];

  lines.push("# Task");
  lines.push("You are assisting with pull request review and comprehension.");
  lines.push("Answer using only the provided PR context and conversation.");
  lines.push("If context is insufficient, clearly say what is missing.");
  lines.push("Use concise, practical language and include concrete file names when relevant.");
  lines.push("");
  lines.push(input.contextMarkdown.trim());
  lines.push("");
  lines.push("## Recent Conversation");

  if (history.length === 0) {
    lines.push("(none)");
  } else {
    for (const message of history) {
      lines.push(`### ${message.role === "assistant" ? "Assistant" : "User"}`);
      lines.push(truncateMessageContent(message.content));
      lines.push("");
    }
  }

  lines.push("## User Question");
  lines.push(input.userQuestion.trim());
  lines.push("");
  lines.push("## Response Format");
  lines.push("Reply in markdown. Prefer short sections and bullet points.");

  return lines.join("\n");
}
