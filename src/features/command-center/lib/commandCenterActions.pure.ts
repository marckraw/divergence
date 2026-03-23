import type { CreateAction } from "../ui/CommandCenter.types";

export function buildCommandCenterCreateActions(): CreateAction[] {
  return [
    {
      id: "create-terminal",
      label: "New Terminal Session",
      description: "Open a terminal in this project",
      sessionKind: "terminal",
    },
    {
      id: "create-agent-claude",
      label: "Open Claude Agent",
      description: "Start a Claude agent session",
      sessionKind: "agent",
      provider: "claude",
    },
    {
      id: "create-agent-codex",
      label: "Open Codex Agent",
      description: "Start a Codex agent session",
      sessionKind: "agent",
      provider: "codex",
    },
    {
      id: "create-agent-gemini",
      label: "Open Gemini Agent",
      description: "Start a Gemini agent session",
      sessionKind: "agent",
      provider: "gemini",
    },
  ];
}
