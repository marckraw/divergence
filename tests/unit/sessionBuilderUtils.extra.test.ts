import { describe, expect, it } from "vitest";
import { generateSessionEntropy } from "../../src/app/lib/sessionBuilder.pure";

describe("generateSessionEntropy", () => {
  it("returns a string containing a timestamp and random number", () => {
    const entropy = generateSessionEntropy();
    expect(entropy).toMatch(/^\d+-\d+$/);
  });

  it("returns different values on successive calls", () => {
    const a = generateSessionEntropy();
    const b = generateSessionEntropy();
    // Extremely unlikely to collide given Date.now() + random
    expect(a).not.toBe(b);
  });
});
