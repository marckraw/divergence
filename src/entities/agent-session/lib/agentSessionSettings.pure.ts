import {
  normalizeAgentRuntimeEffort,
  type AgentRuntimeEffort,
} from "../../../shared";
import type { AgentSession } from "../model/agentSession.types";

interface AgentSessionSettingsPatchInput {
  model?: string;
  effort?: AgentRuntimeEffort;
}

interface AgentSessionSettingsPatch {
  model?: string;
  effort?: AgentRuntimeEffort;
}

export function buildAgentSessionSettingsPatch(
  session: Pick<AgentSession, "provider" | "model" | "effort">,
  input: AgentSessionSettingsPatchInput,
): AgentSessionSettingsPatch {
  const nextModel = input.model?.trim() || session.model;
  const nextEffort = normalizeAgentRuntimeEffort(
    session.provider,
    nextModel,
    input.effort ?? session.effort,
  );

  return {
    ...(input.model?.trim() && nextModel !== session.model ? { model: nextModel } : {}),
    ...(nextEffort !== session.effort ? { effort: nextEffort } : {}),
  };
}
