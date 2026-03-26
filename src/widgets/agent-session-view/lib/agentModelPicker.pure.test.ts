import { describe, expect, it } from "vitest";
import type { AgentRuntimeModelOption } from "../../../shared";
import { filterAgentModelOptions } from "./agentModelPicker.pure";

const options: AgentRuntimeModelOption[] = [
  { slug: "default", label: "Configured default" },
  { slug: "github-copilot/gpt-5.4", label: "github-copilot/gpt-5.4" },
  { slug: "openai/gpt-5.4", label: "openai/gpt-5.4" },
];

describe("agentModelPicker.pure", () => {
  it("returns all options when query is blank", () => {
    expect(filterAgentModelOptions(options, "")).toEqual(options);
    expect(filterAgentModelOptions(options, "   ")).toEqual(options);
  });

  it("filters options case-insensitively", () => {
    expect(filterAgentModelOptions(options, "copilot")).toEqual([
      { slug: "github-copilot/gpt-5.4", label: "github-copilot/gpt-5.4" },
    ]);
    expect(filterAgentModelOptions(options, "DEFAULT")).toEqual([
      { slug: "default", label: "Configured default" },
    ]);
  });
});
