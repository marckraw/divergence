import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../model/agentSession.types";
import { suggestAgentSessionTitle } from "./agentSessionTitle.pure";

function makeUserMessage(content: string): AgentMessage {
  return {
    id: "message-1",
    role: "user",
    content,
    status: "done",
    createdAtMs: 1,
  };
}

describe("suggestAgentSessionTitle", () => {
  it("returns a concise title from the first meaningful user prompt", () => {
    expect(suggestAgentSessionTitle({
      messages: [
        makeUserMessage("Can you take a look at this repository and bring me back what it does?"),
      ],
    })).toBe("Look at this repository and bring me back what it does");
  });

  it("skips generic greetings and uses the next useful clause", () => {
    expect(suggestAgentSessionTitle({
      messages: [
        makeUserMessage("hey, whats up?\nwhat do you know about this family sync project?"),
      ],
    })).toBe("What do you know about this family sync project");
  });

  it("returns null when conversation has no meaningful prompt yet", () => {
    expect(suggestAgentSessionTitle({
      messages: [makeUserMessage("hey")],
    })).toBeNull();
  });
});
