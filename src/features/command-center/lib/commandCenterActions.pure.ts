import type {
  AgentProvider,
  WorkspaceSession,
} from "../../../entities";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
} from "../../../entities";
import type { CommandCenterCreateAction } from "../ui/CommandCenter.types";

export function buildCommandCenterCreateActions(
  sourceSession: WorkspaceSession | null,
  agentProviders: AgentProvider[],
): CommandCenterCreateAction[] {
  if (!sourceSession) {
    return [];
  }

  const targetType = getWorkspaceSessionTargetType(sourceSession);
  const targetId = getWorkspaceSessionTargetId(sourceSession);
  const targetName = sourceSession.name;

  const actions: CommandCenterCreateAction[] = [
    {
      id: `terminal:${targetType}:${targetId}`,
      label: "New terminal session",
      description: `Open a terminal for ${targetName}`,
      targetType,
      targetId,
      sessionKind: "terminal",
    },
  ];

  for (const provider of agentProviders) {
    actions.push({
      id: `agent:${provider}:${targetType}:${targetId}`,
      label: `Open ${provider} agent`,
      description: `Start a new ${provider} agent for ${targetName}`,
      targetType,
      targetId,
      sessionKind: "agent",
      provider,
    });
  }

  return actions;
}
