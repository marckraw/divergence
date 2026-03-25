import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_PROVIDER,
  getAvailableAgentProviders,
  getAgentProviderBadgeClass,
  getAgentProviderIconClass,
  getDefaultAgentProvider,
  getAgentProviderLabel,
  getAgentRuntimeProviderAttachmentKinds,
  getAgentRuntimeProviderDefaultModel,
  getAgentRuntimeProviderDescriptor,
  getAgentRuntimeProviderEffortOptions,
  getAgentRuntimeDefaultEffort,
  getAgentRuntimeEffortLabel,
  getAgentRuntimeProviderModelOptions,
  indexAgentRuntimeProviders,
  normalizeAgentRuntimeEffort,
  supportsAgentRuntimeImageAttachments,
  supportsAgentRuntimePdfAttachments,
  supportsAgentRuntimePlanMode,
  supportsAgentRuntimeStructuredPlanUi,
} from "./agentProviders.pure";
import type { AgentRuntimeCapabilities } from "../api/agentRuntime.types";

const capabilities: AgentRuntimeCapabilities = {
  placeholderSessionsSupported: false,
  liveStreamingSupported: true,
  persistentSnapshotsSupported: true,
  providers: [
    {
      id: "claude",
      label: "Claude",
      transport: "cli-headless",
      defaultModel: "sonnet",
      modelOptions: [{ slug: "sonnet", label: "Claude Sonnet" }],
      readiness: {
        status: "ready",
        summary: "Ready",
        details: [],
        binaryCandidates: ["claude"],
        detectedCommand: "claude",
        detectedVersion: "2.1.78 (Claude Code)",
        authStatus: "authenticated",
      },
      features: {
        streaming: true,
        resume: true,
        structuredRequests: false,
        planMode: true,
        attachmentKinds: ["image"],
        structuredPlanUi: false,
        usageInspection: false,
        providerExtras: false,
      },
    },
    {
      id: "cursor",
      label: "Cursor",
      transport: "cli-headless",
      defaultModel: "gpt-5",
      modelOptions: [{ slug: "gpt-5", label: "GPT-5" }],
      readiness: {
        status: "partial",
        summary: "Login required",
        details: [],
        binaryCandidates: ["cursor-agent"],
        detectedCommand: "cursor-agent",
        detectedVersion: "1.0.0",
        authStatus: "missing",
      },
      features: {
        streaming: true,
        resume: true,
        structuredRequests: false,
        planMode: true,
        attachmentKinds: [],
        structuredPlanUi: false,
        usageInspection: false,
        providerExtras: true,
      },
    },
    {
      id: "codex",
      label: "Codex",
      transport: "app-server",
      defaultModel: "gpt-5.4",
      modelOptions: [],
      readiness: {
        status: "ready",
        summary: "Ready",
        details: [],
        binaryCandidates: ["codex"],
        detectedCommand: "codex",
        detectedVersion: "codex-cli 0.115.0",
        authStatus: "authenticated",
      },
      features: {
        streaming: true,
        resume: true,
        structuredRequests: true,
        planMode: true,
        attachmentKinds: ["image"],
        structuredPlanUi: true,
        usageInspection: true,
        providerExtras: true,
      },
    },
    {
      id: "gemini",
      label: "Gemini",
      transport: "cli-headless",
      defaultModel: "gemini-2.5-pro",
      modelOptions: [],
      readiness: {
        status: "partial",
        summary: "Installed",
        details: [],
        binaryCandidates: ["gemini"],
        detectedCommand: "gemini",
        detectedVersion: "0.1.0",
        authStatus: "unknown",
      },
      features: {
        streaming: false,
        resume: false,
        structuredRequests: false,
        planMode: true,
        attachmentKinds: ["image", "pdf"],
        structuredPlanUi: false,
        usageInspection: false,
        providerExtras: true,
      },
    },
    {
      id: "opencode",
      label: "OpenCode",
      transport: "app-server",
      defaultModel: "default",
      modelOptions: [{ slug: "default", label: "Configured default" }],
      readiness: {
        status: "partial",
        summary: "Installed",
        details: [],
        binaryCandidates: ["opencode"],
        detectedCommand: "opencode",
        detectedVersion: "0.1.0",
        authStatus: "unknown",
      },
      features: {
        streaming: true,
        resume: true,
        structuredRequests: true,
        planMode: true,
        attachmentKinds: [],
        structuredPlanUi: false,
        usageInspection: false,
        providerExtras: true,
      },
    },
  ],
};

describe("agentProviders.pure", () => {
  it("returns labels and badge classes", () => {
    expect(getAgentProviderLabel("cursor")).toBe("Cursor");
    expect(getAgentProviderBadgeClass("gemini")).toContain("emerald");
    expect(getAgentProviderIconClass("codex")).toContain("accent");
    expect(getAgentProviderLabel("opencode")).toBe("OpenCode");
  });

  it("returns the shared default provider", () => {
    expect(DEFAULT_AGENT_PROVIDER).toBe("claude");
    expect(getDefaultAgentProvider()).toBe("claude");
  });

  it("indexes providers and resolves defaults", () => {
    const indexed = indexAgentRuntimeProviders(capabilities);
    expect(indexed?.cursor.label).toBe("Cursor");
    expect(getAgentRuntimeProviderDefaultModel(capabilities, "claude")).toBe("sonnet");
  });

  it("returns descriptors and model options", () => {
    expect(getAgentRuntimeProviderDescriptor(capabilities, "codex")?.transport).toBe("app-server");
    expect(getAgentRuntimeProviderModelOptions(capabilities, "cursor")).toHaveLength(1);
    expect(getAgentRuntimeProviderDescriptor(capabilities, "opencode")?.transport).toBe("app-server");
  });

  it("merges built-in and custom model options without duplicates", () => {
    expect(
      getAgentRuntimeProviderModelOptions(capabilities, "codex", {
        codex: ["gpt-5.4", "o3"],
      }),
    ).toEqual([
      { slug: "gpt-5.4", label: "gpt-5.4" },
      { slug: "o3", label: "o3" },
    ]);
  });

  it("returns provider and model aware effort options", () => {
    expect(getAgentRuntimeProviderEffortOptions("codex", "gpt-5.4").map((option) => option.slug)).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAgentRuntimeProviderEffortOptions("codex", "gpt-5.3-codex").map((option) => option.slug)).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAgentRuntimeProviderEffortOptions("claude", "opus").map((option) => option.slug)).toEqual([
      "low",
      "medium",
      "high",
      "max",
    ]);
    expect(getAgentRuntimeProviderEffortOptions("gemini", "gemini-2.5-pro")).toEqual([]);
  });

  it("normalizes invalid or missing effort values to sensible defaults", () => {
    expect(getAgentRuntimeDefaultEffort("codex", "gpt-5.4")).toBe("medium");
    expect(normalizeAgentRuntimeEffort("codex", "gpt-5.3-codex", "none")).toBe("medium");
    expect(normalizeAgentRuntimeEffort("claude", "opus", "max")).toBe("max");
    expect(normalizeAgentRuntimeEffort("cursor", "auto", "medium")).toBeUndefined();
    expect(normalizeAgentRuntimeEffort("opencode", "anthropic/claude-sonnet-4-5", "medium")).toBeUndefined();
    expect(getAgentRuntimeEffortLabel("xhigh")).toBe("X-High");
  });

  it("returns available providers in stable order", () => {
    expect(getAvailableAgentProviders(capabilities)).toEqual([
      "claude",
      "codex",
      "cursor",
      "gemini",
      "opencode",
    ]);
  });

  it("resolves plan and attachment capability flags", () => {
    expect(supportsAgentRuntimePlanMode(capabilities, "claude")).toBe(true);
    expect(supportsAgentRuntimeImageAttachments(capabilities, "cursor")).toBe(false);
    expect(supportsAgentRuntimePdfAttachments(capabilities, "gemini")).toBe(true);
    expect(getAgentRuntimeProviderAttachmentKinds(capabilities, "codex")).toEqual(["image"]);
    expect(supportsAgentRuntimeStructuredPlanUi(capabilities, "codex")).toBe(true);
  });
});
