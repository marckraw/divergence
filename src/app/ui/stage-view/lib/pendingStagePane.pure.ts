import type { AgentProvider, WorkspaceSession } from "../../../../entities";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
} from "../../../../entities";
import { getAgentProviderLabel } from "../../../../shared";

export interface PendingStagePaneCreateAction {
  id: string;
  label: string;
  description: string;
  targetType: "project" | "divergence" | "workspace" | "workspace_divergence";
  targetId: number;
  sessionKind: "terminal" | "agent";
  provider?: AgentProvider;
}

export interface PendingStagePaneCreateContext {
  title: string;
  description: string;
  actions: PendingStagePaneCreateAction[];
}

function getTargetCopy(targetType: PendingStagePaneCreateAction["targetType"]): {
  title: string;
  description: string;
  terminalLabel: string;
  terminalDescription: string;
} {
  switch (targetType) {
    case "divergence":
      return {
        title: "Create from this divergence",
        description: "Open another session for the same divergence in this pane.",
        terminalLabel: "New Session",
        terminalDescription: "Create another terminal session for this divergence.",
      };
    case "workspace":
      return {
        title: "Create from this workspace",
        description: "Open another session for the same workspace in this pane.",
        terminalLabel: "Open Terminal",
        terminalDescription: "Open the workspace terminal in this pane.",
      };
    case "workspace_divergence":
      return {
        title: "Create from this workspace divergence",
        description: "Open another session for the same workspace divergence in this pane.",
        terminalLabel: "Open Terminal",
        terminalDescription: "Open the workspace divergence terminal in this pane.",
      };
    case "project":
    default:
      return {
        title: "Create from this project",
        description: "Open another session for the same project in this pane.",
        terminalLabel: "New Session",
        terminalDescription: "Create another terminal session for this project.",
      };
  }
}

export function buildPendingStagePaneCreateContext(
  sourceSession: WorkspaceSession | null,
  agentProviders: AgentProvider[],
): PendingStagePaneCreateContext | null {
  if (!sourceSession) {
    return null;
  }

  const targetType = getWorkspaceSessionTargetType(sourceSession);
  const targetId = getWorkspaceSessionTargetId(sourceSession);
  const copy = getTargetCopy(targetType);
  const actions: PendingStagePaneCreateAction[] = [
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

  return {
    title: copy.title,
    description: copy.description,
    actions,
  };
}
