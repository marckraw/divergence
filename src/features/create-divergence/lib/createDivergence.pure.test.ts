import { describe, expect, it } from "vitest";
import {
  normalizeBranchName,
  validateBranchName,
} from "./createDivergence.pure";

describe("create divergence utils", () => {
  it("normalizes branch name", () => {
    expect(normalizeBranchName("  feature/test  ")).toBe("feature/test");
  });

  it("validates required branch name", () => {
    expect(validateBranchName("feature/test")).toBeNull();
    expect(validateBranchName("   ")).toBe("Branch name is required");
  });
});
