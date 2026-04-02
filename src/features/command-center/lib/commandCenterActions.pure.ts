import type { AgentProvider, WorkspaceSession } from "../../../entities";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
} from "../../../entities";
import { getAgentProviderLabel } from "../../../shared";
import type { CreateAction } from "../ui/CommandCenter.types";

function getTargetCopy(targetType: CreateAction["targetType"]): {
  terminalLabel: string;
  terminalDescription: string;
} {
  switch (targetType) {
    case "divergence":
      return {
        terminalLabel: "New Session",
        terminalDescription: "Create another terminal session for this divergence.",
      };
    case "workspace":
      return {
        terminalLabel: "New Session",
        terminalDescription: "Create another terminal session for this workspace.",
      };
    case "workspace_divergence":
      return {
        terminalLabel: "New Session",
        terminalDescription:
          "Create another terminal session for this workspace divergence.",
      };
    case "project":
    default:
      return {
        terminalLabel: "New Session",
        terminalDescription: "Create another terminal session for this project.",
      };
  }
}

export function buildCommandCenterCreateActions(
  sourceSession: WorkspaceSession | null,
  agentProviders: AgentProvider[],
): CreateAction[] {
  if (!sourceSession) {
    return [];
  }

  const targetType = getWorkspaceSessionTargetType(sourceSession);
  const targetId = getWorkspaceSessionTargetId(sourceSession);
  const copy = getTargetCopy(targetType);

  return [
    {
      id: `terminal:${targetType}:${targetId}`,
      label: copy.terminalLabel,
      description: copy.terminalDescription,
      targetType,
      targetId,
      sessionKind: "terminal",
    },
    ...agentProviders.map((provider) => ({
      id: `agent:${provider}:${targetType}:${targetId}`,
      label: `Open ${getAgentProviderLabel(provider)} Agent`,
      description: `Start a new ${getAgentProviderLabel(provider)} agent for this ${targetType.replace(/_/g, " ")}.`,
      targetType,
      targetId,
      sessionKind: "agent" as const,
      provider,
    })),
  ];
}
