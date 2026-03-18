import type {
  AgentRuntimeAttachmentKind,
  AgentRuntimeCapabilities,
  AgentRuntimeEffort,
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

const EFFORT_LABELS: Record<AgentRuntimeEffort, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "X-High",
  max: "Max",
};

const LOW_MEDIUM_HIGH: AgentRuntimeEffort[] = ["low", "medium", "high"];
const LOW_TO_XHIGH: AgentRuntimeEffort[] = ["low", "medium", "high", "xhigh"];
const NONE_TO_XHIGH: AgentRuntimeEffort[] = ["none", "low", "medium", "high", "xhigh"];

function buildEffortOptions(efforts: AgentRuntimeEffort[]) {
  return efforts.map((slug) => ({
    slug,
    label: EFFORT_LABELS[slug],
  }));
}

function isClaudeOpusModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized === "opus" || normalized === "claude-opus-4-6";
}

function getCodexEfforts(model: string): AgentRuntimeEffort[] {
  const normalized = model.trim().toLowerCase();
  if (normalized === "gpt-5.4" || normalized === "gpt-5.2") {
    return NONE_TO_XHIGH;
  }
  if (
    normalized === "gpt-5.3-codex"
    || normalized === "gpt-5.3-codex-spark"
    || normalized === "gpt-5.2-codex"
  ) {
    return LOW_TO_XHIGH;
  }
  return LOW_MEDIUM_HIGH;
}

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

export function getAgentRuntimeProviderEffortOptions(
  provider: AgentRuntimeProvider,
  model: string,
): { slug: AgentRuntimeEffort; label: string }[] {
  switch (provider) {
    case "claude":
      return buildEffortOptions(
        isClaudeOpusModel(model)
          ? [...LOW_MEDIUM_HIGH, "max"]
          : LOW_MEDIUM_HIGH,
      );
    case "codex":
      return buildEffortOptions(getCodexEfforts(model));
    case "cursor":
    case "gemini":
    default:
      return [];
  }
}

export function getAgentRuntimeDefaultEffort(
  provider: AgentRuntimeProvider,
  model: string,
): AgentRuntimeEffort | undefined {
  return getAgentRuntimeProviderEffortOptions(provider, model).find((option) => option.slug === "medium")?.slug;
}

export function normalizeAgentRuntimeEffort(
  provider: AgentRuntimeProvider,
  model: string,
  effort?: AgentRuntimeEffort,
): AgentRuntimeEffort | undefined {
  const options = getAgentRuntimeProviderEffortOptions(provider, model);
  if (options.length === 0) {
    return undefined;
  }

  if (effort && options.some((option) => option.slug === effort)) {
    return effort;
  }

  return getAgentRuntimeDefaultEffort(provider, model);
}

export function getAgentRuntimeEffortLabel(effort: AgentRuntimeEffort): string {
  return EFFORT_LABELS[effort];
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
