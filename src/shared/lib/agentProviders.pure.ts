import type {
  AgentRuntimeAttachmentKind,
  AgentRuntimeCapabilities,
  AgentRuntimeModelOption,
  AgentRuntimeProvider,
  AgentRuntimeProviderDescriptor,
} from "../api/agentRuntime.types";
import type { CustomAgentModels } from "./appSettings.pure";

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
  provider: AgentRuntimeProvider,
  customAgentModels: CustomAgentModels = {},
): AgentRuntimeModelOption[] {
  const builtInOptions = getAgentRuntimeProviderDescriptor(capabilities, provider)?.modelOptions ?? [];
  const customOptions = (customAgentModels[provider] ?? []).map((slug) => ({
    slug,
    label: slug,
  }));
  const merged: AgentRuntimeModelOption[] = [];
  const seen = new Set<string>();

  [...builtInOptions, ...customOptions].forEach((option) => {
    if (seen.has(option.slug)) {
      return;
    }
    seen.add(option.slug);
    merged.push(option);
  });

  return merged;
}

export function supportsAgentRuntimePlanMode(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
): boolean {
  return getAgentRuntimeProviderDescriptor(capabilities, provider)?.features.planMode ?? false;
}

export function supportsAgentRuntimeImageAttachments(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
): boolean {
  return getAgentRuntimeProviderAttachmentKinds(capabilities, provider).includes("image");
}

export function supportsAgentRuntimePdfAttachments(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
): boolean {
  return getAgentRuntimeProviderAttachmentKinds(capabilities, provider).includes("pdf");
}

export function getAgentRuntimeProviderAttachmentKinds(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
): AgentRuntimeAttachmentKind[] {
  return getAgentRuntimeProviderDescriptor(capabilities, provider)?.features.attachmentKinds ?? [];
}

export function supportsAgentRuntimeStructuredPlanUi(
  capabilities: AgentRuntimeCapabilities | null,
  provider: AgentRuntimeProvider
): boolean {
  return (
    getAgentRuntimeProviderDescriptor(capabilities, provider)?.features.structuredPlanUi ?? false
  );
}

export function getAvailableAgentProviders(
  capabilities: AgentRuntimeCapabilities | null
): AgentRuntimeProvider[] {
  const available = new Set((capabilities?.providers ?? []).map((descriptor) => descriptor.id));
  return AGENT_PROVIDER_ORDER.filter((provider) => available.has(provider));
}
