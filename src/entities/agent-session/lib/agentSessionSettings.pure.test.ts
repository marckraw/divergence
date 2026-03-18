import { describe, expect, it } from "vitest";
import { buildAgentSessionSettingsPatch } from "./agentSessionSettings.pure";

describe("buildAgentSessionSettingsPatch", () => {
  it("coerces invalid codex effort when the model changes", () => {
    expect(
      buildAgentSessionSettingsPatch(
        {
          provider: "codex",
          model: "gpt-5.4",
          effort: "none",
        },
        {
          model: "gpt-5.3-codex",
        },
      ),
    ).toEqual({
      model: "gpt-5.3-codex",
      effort: "medium",
    });
  });

  it("keeps valid effort changes for supported providers", () => {
    expect(
      buildAgentSessionSettingsPatch(
        {
          provider: "claude",
          model: "opus",
          effort: "high",
        },
        {
          effort: "max",
        },
      ),
    ).toEqual({
      effort: "max",
    });
  });

  it("does not add an effort patch for unsupported providers", () => {
    expect(
      buildAgentSessionSettingsPatch(
        {
          provider: "gemini",
          model: "gemini-2.5-pro",
          effort: undefined,
        },
        {
          model: "gemini-2.5-flash",
        },
      ),
    ).toEqual({
      model: "gemini-2.5-flash",
    });
  });
});
