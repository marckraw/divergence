import type {
  AgentRuntimeCapabilities,
  AgentRuntimeProvider,
  AgentRuntimeProviderDescriptor,
} from "../api/agentRuntime.types";

export const AGENT_PROVIDER_ORDER: AgentRuntimeProvider[] = [
  "claude",
  "codex",
  "cursor",
  "gemini",
];

export const DEFAULT_AGENT_PROVIDER: AgentRuntimeProvider = AGENT_PROVIDER_ORDER[0];

const PROVIDER_LABELS: Record<AgentRuntimeProvider, string> = {
  claude: "Claude",
  codex: "Codex",
  cursor: "Cursor",
  gemini: "Gemini",
};

const PROVIDER_BADGE_CLASSES: Record<AgentRuntimeProvider, string> = {
  claude: "bg-yellow/20 text-yellow",
  codex: "bg-accent/20 text-accent",
  cursor: "bg-blue-400/20 text-blue-300",
  gemini: "bg-emerald-400/20 text-emerald-300",
};

const PROVIDER_ICON_CLASSES: Record<AgentRuntimeProvider, string> = {
  claude: "text-yellow",
  codex: "text-accent",
  cursor: "text-blue-300",
  gemini: "text-emerald-300",
};

export function getAgentProviderLabel(provider: AgentRuntimeProvider): string {
  return PROVIDER_LABELS[provider];
}

export function getAgentProviderBadgeClass(provider: AgentRuntimeProvider): string {
  return PROVIDER_BADGE_CLASSES[provider];
}

export function getAgentProviderIconClass(provider: AgentRuntimeProvider): string {
  return PROVIDER_ICON_CLASSES[provider];
}

export function getDefaultAgentProvider(): AgentRuntimeProvider {
  return DEFAULT_AGENT_PROVIDER;
}

export function indexAgentRuntimeProviders(
  capabilities: AgentRuntimeCapabilities | null
): Record<AgentRuntimeProvider, AgentRuntimeProviderDescriptor> | null {
  if (!capabilities) {
    return null;
  }

  return capabilities.providers.reduce<Record<AgentRuntimeProvider, AgentRuntimeProviderDescriptor>>(
    (accumulator, descriptor) => {
      accumulator[descriptor.id] = descriptor;
      return accumulator;
    },
    {} as Record<AgentRuntimeProvider, AgentRuntimeProviderDescriptor>
  );
}

export function getAgentRuntimeProviderDescriptor(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
): AgentRuntimeProviderDescriptor | null {
  const providers = indexAgentRuntimeProviders(capabilities);
  return providers?.[provider] ?? null;
}

export function getAgentRuntimeProviderDefaultModel(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
): string | null {
  return getAgentRuntimeProviderDescriptor(capabilities, provider)?.defaultModel ?? null;
}

export function getAgentRuntimeProviderModelOptions(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
) {
  return getAgentRuntimeProviderDescriptor(capabilities, provider)?.modelOptions ?? [];
}

export function getAvailableAgentProviders(
  capabilities: AgentRuntimeCapabilities | null
): AgentRuntimeProvider[] {
  const available = new Set((capabilities?.providers ?? []).map((descriptor) => descriptor.id));
  return AGENT_PROVIDER_ORDER.filter((provider) => available.has(provider));
}
