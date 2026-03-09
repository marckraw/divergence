import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_PROVIDER,
  getAvailableAgentProviders,
  getAgentProviderBadgeClass,
  getAgentProviderIconClass,
  getDefaultAgentProvider,
  getAgentProviderLabel,
  getAgentRuntimeProviderDefaultModel,
  getAgentRuntimeProviderDescriptor,
  getAgentRuntimeProviderModelOptions,
  indexAgentRuntimeProviders,
  supportsAgentRuntimeImageAttachments,
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
        authStatus: "authenticated",
      },
      features: {
        streaming: true,
        resume: true,
        structuredRequests: false,
        planMode: true,
        imageAttachments: true,
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
        authStatus: "missing",
      },
      features: {
        streaming: true,
        resume: true,
        structuredRequests: false,
        planMode: true,
        imageAttachments: false,
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
        authStatus: "authenticated",
      },
      features: {
        streaming: true,
        resume: true,
        structuredRequests: true,
        planMode: true,
        imageAttachments: true,
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
        authStatus: "unknown",
      },
      features: {
        streaming: false,
        resume: false,
        structuredRequests: false,
        planMode: true,
        imageAttachments: true,
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
  });

  it("returns available providers in stable order", () => {
    expect(getAvailableAgentProviders(capabilities)).toEqual([
      "claude",
      "codex",
      "cursor",
      "gemini",
    ]);
  });

  it("resolves plan and image attachment capability flags", () => {
    expect(supportsAgentRuntimePlanMode(capabilities, "claude")).toBe(true);
    expect(supportsAgentRuntimeImageAttachments(capabilities, "cursor")).toBe(false);
    expect(supportsAgentRuntimeStructuredPlanUi(capabilities, "codex")).toBe(true);
  });
});
