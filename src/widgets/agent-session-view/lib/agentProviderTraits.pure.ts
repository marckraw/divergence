import type {
  AgentRuntimeProvider,
  AgentRuntimeProviderTurnOptions,
} from "../../../shared";

export interface AgentProviderTraitDescriptor {
  id: "fast-mode";
  label: string;
  description: string;
}

const CODEX_FAST_MODE_TRAIT: AgentProviderTraitDescriptor = {
  id: "fast-mode",
  label: "Fast mode",
  description: "Use Codex's fast service tier for this turn.",
};

export function getAgentProviderTraitDescriptors(
  provider: AgentRuntimeProvider,
  model: string,
): AgentProviderTraitDescriptor[] {
  void model;
  if (provider !== "codex") {
    return [];
  }

  return [CODEX_FAST_MODE_TRAIT];
}

export function normalizeAgentProviderTurnOptions(
  provider: AgentRuntimeProvider,
  model: string,
  options?: AgentRuntimeProviderTurnOptions,
): AgentRuntimeProviderTurnOptions {
  const supportedTraits = getAgentProviderTraitDescriptors(provider, model);
  if (supportedTraits.length === 0) {
    return {};
  }

  return options?.codex?.fastMode ? { codex: { fastMode: true } } : {};
}

export function hasAgentProviderTurnOptions(
  provider: AgentRuntimeProvider,
  model: string,
  options?: AgentRuntimeProviderTurnOptions,
): boolean {
  const normalized = normalizeAgentProviderTurnOptions(provider, model, options);
  return Boolean(normalized.codex?.fastMode);
}
