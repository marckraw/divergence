import { describe, expect, it } from "vitest";
import { getLanguageKind } from "../../src/shared/lib/languageDetection.pure";

describe("language detection utils", () => {
  it("detects known language kinds", () => {
    expect(getLanguageKind("index.html")).toBe("html");
    expect(getLanguageKind("styles.scss")).toBe("css");
    expect(getLanguageKind("app.tsx")).toBe("typescript");
    expect(getLanguageKind("app.jsx")).toBe("javascript");
    expect(getLanguageKind("README.md")).toBe("markdown");
    expect(getLanguageKind("script.py")).toBe("python");
    expect(getLanguageKind("lib.rs")).toBe("rust");
    expect(getLanguageKind("data.jsonc")).toBe("json");
    expect(getLanguageKind("config.yml")).toBe("yaml");
  });

  it("returns unknown for null/unsupported", () => {
    expect(getLanguageKind(null)).toBe("unknown");
    expect(getLanguageKind("file.txt")).toBe("unknown");
  });
});
