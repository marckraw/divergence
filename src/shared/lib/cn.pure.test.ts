import { describe, expect, it } from "vitest";
import { cn } from "./cn.pure";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("handles conditional classes", () => {
    const isHidden = false;
    expect(cn("base", isHidden && "hidden", "extra")).toBe("base extra");
  });
  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
  it("handles undefined and null values", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });
});
