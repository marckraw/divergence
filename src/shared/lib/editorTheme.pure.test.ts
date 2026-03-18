import { describe, expect, it } from "vitest";
import { getLanguageExtension, themeExtensionsById } from "./editorTheme.pure";

describe("editorTheme.pure", () => {
  it("returns language extensions for common file types", () => {
    expect(getLanguageExtension("file.ts").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.tsx").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.js").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.jsx").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.html").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.css").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.py").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.rs").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.json").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.yml").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.md").length).toBeGreaterThan(0);
    expect(getLanguageExtension("file.xyz")).toEqual([]);
    expect(getLanguageExtension(null)).toEqual([]);
  });

  it("defines all supported editor theme extension sets", () => {
    expect(themeExtensionsById.divergence.length).toBeGreaterThan(0);
    expect(themeExtensionsById["divergence-light"].length).toBeGreaterThan(0);
    expect(themeExtensionsById["one-dark"].length).toBeGreaterThan(0);
    expect(themeExtensionsById.dracula.length).toBeGreaterThan(0);
    expect(themeExtensionsById["github-dark"].length).toBeGreaterThan(0);
    expect(themeExtensionsById["github-light"].length).toBeGreaterThan(0);
    expect(themeExtensionsById["vscode-dark"].length).toBeGreaterThan(0);
    expect(themeExtensionsById["vscode-light"].length).toBeGreaterThan(0);
  });
});
