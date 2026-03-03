import { describe, expect, it } from "vitest";
import type { GithubPrChatMessage } from "../model/githubPrChat.types";
import { buildGithubPrChatPromptMarkdown } from "./githubPrChatPrompt.pure";

function makeMessage(partial: Partial<GithubPrChatMessage>): GithubPrChatMessage {
  return {
    id: partial.id ?? "m1",
    prKey: partial.prKey ?? "openai/divergence#1",
    role: partial.role ?? "user",
    content: partial.content ?? "hello",
    createdAtMs: partial.createdAtMs ?? 1,
    status: partial.status ?? "done",
    error: partial.error ?? null,
  };
}

describe("githubPrChatPrompt.pure", () => {
  it("includes context and user question", () => {
    const markdown = buildGithubPrChatPromptMarkdown({
      contextMarkdown: "# Pull Request Context\nsome context",
      recentMessages: [],
      userQuestion: "What should I review first?",
    });

    expect(markdown).toContain("# Pull Request Context");
    expect(markdown).toContain("## User Question");
    expect(markdown).toContain("What should I review first?");
  });

  it("includes only done user/assistant history", () => {
    const markdown = buildGithubPrChatPromptMarkdown({
      contextMarkdown: "ctx",
      recentMessages: [
        makeMessage({ id: "1", role: "user", content: "Q1", status: "done" }),
        makeMessage({ id: "2", role: "assistant", content: "A1", status: "done" }),
        makeMessage({ id: "3", role: "assistant", content: "pending", status: "pending" }),
        makeMessage({ id: "4", role: "system", content: "sys", status: "done" }),
      ],
      userQuestion: "Q2",
    });

    expect(markdown).toContain("### User");
    expect(markdown).toContain("Q1");
    expect(markdown).toContain("### Assistant");
    expect(markdown).toContain("A1");
    expect(markdown).not.toContain("pending");
    expect(markdown).not.toContain("sys");
  });
});
