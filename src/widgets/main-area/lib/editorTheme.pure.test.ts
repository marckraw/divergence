import { describe, expect, it } from "vitest";
import { getLanguageExtension, themeExtensionsById } from "./editorTheme.pure";

describe("getLanguageExtension", () => {
  it("returns typescript extensions for .ts files", () => {
    const result = getLanguageExtension("file.ts");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns typescript JSX extensions for .tsx files", () => {
    const result = getLanguageExtension("file.tsx");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns javascript extensions for .js files", () => {
    const result = getLanguageExtension("file.js");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns javascript JSX extensions for .jsx files", () => {
    const result = getLanguageExtension("file.jsx");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns html extensions for .html files", () => {
    const result = getLanguageExtension("file.html");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns css extensions for .css files", () => {
    const result = getLanguageExtension("file.css");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns python extensions for .py files", () => {
    const result = getLanguageExtension("file.py");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns rust extensions for .rs files", () => {
    const result = getLanguageExtension("file.rs");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns json extensions for .json files", () => {
    const result = getLanguageExtension("file.json");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns yaml extensions for .yml files", () => {
    const result = getLanguageExtension("file.yml");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns markdown extensions for .md files", () => {
    const result = getLanguageExtension("file.md");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown extensions", () => {
    const result = getLanguageExtension("file.xyz");
    expect(result).toEqual([]);
  });

  it("returns empty array for null file path", () => {
    const result = getLanguageExtension(null);
    expect(result).toEqual([]);
  });
});

describe("themeExtensionsById", () => {
  it("has the divergence theme", () => {
    expect(themeExtensionsById["divergence"]).toBeDefined();
    expect(themeExtensionsById["divergence"].length).toBeGreaterThan(0);
  });

  it("has the divergence-light theme", () => {
    expect(themeExtensionsById["divergence-light"]).toBeDefined();
    expect(themeExtensionsById["divergence-light"].length).toBeGreaterThan(0);
  });

  it("has the one-dark theme", () => {
    expect(themeExtensionsById["one-dark"]).toBeDefined();
  });

  it("has the dracula theme", () => {
    expect(themeExtensionsById["dracula"]).toBeDefined();
  });

  it("has all expected theme ids", () => {
    const themeIds = Object.keys(themeExtensionsById);
    expect(themeIds).toContain("divergence");
    expect(themeIds).toContain("divergence-light");
    expect(themeIds).toContain("one-dark");
    expect(themeIds).toContain("dracula");
    expect(themeIds).toContain("github-dark");
    expect(themeIds).toContain("github-light");
    expect(themeIds).toContain("vscode-dark");
    expect(themeIds).toContain("vscode-light");
  });
});
