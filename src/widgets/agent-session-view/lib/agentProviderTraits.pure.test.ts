import { describe, expect, it } from "vitest";
import {
  getAgentProviderTraitDescriptors,
  hasAgentProviderTurnOptions,
  normalizeAgentProviderTurnOptions,
} from "./agentProviderTraits.pure";

describe("agentProviderTraits.pure", () => {
  it("exposes Codex-only draft traits", () => {
    expect(getAgentProviderTraitDescriptors("codex", "gpt-5.4")).toEqual([
      expect.objectContaining({ id: "fast-mode" }),
    ]);
    expect(getAgentProviderTraitDescriptors("claude", "sonnet")).toEqual([]);
  });

  it("keeps supported Codex fast-mode options", () => {
    expect(normalizeAgentProviderTurnOptions("codex", "gpt-5.4", {
      codex: { fastMode: true },
      claude: {},
    })).toEqual({
      codex: { fastMode: true },
    });
  });

  it("clears unsupported provider turn options", () => {
    expect(normalizeAgentProviderTurnOptions("gemini", "gemini-2.5-pro", {
      codex: { fastMode: true },
    })).toEqual({});
    expect(hasAgentProviderTurnOptions("gemini", "gemini-2.5-pro", {
      codex: { fastMode: true },
    })).toBe(false);
  });
});
