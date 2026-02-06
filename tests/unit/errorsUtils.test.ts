import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../../src/lib/utils/errors";

describe("errors utils", () => {
  it("extracts message from string and Error", () => {
    expect(getErrorMessage("boom", "fallback")).toBe("boom");
    expect(getErrorMessage(new Error("bad"), "fallback")).toBe("bad");
  });

  it("extracts message from objects and uses fallback", () => {
    expect(getErrorMessage({ message: "object-msg" }, "fallback")).toBe("object-msg");
    expect(getErrorMessage({ message: 42 }, "fallback")).toBe("fallback");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
  });
});
