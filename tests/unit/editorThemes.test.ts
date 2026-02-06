import { describe, expect, it } from "vitest";
import {
  getEditorThemeMode,
  isEditorThemeId,
  isEditorThemeMode,
} from "../../src/shared/config/editorThemes";

describe("editor theme helpers", () => {
  it("checks ids", () => {
    expect(isEditorThemeId("dracula")).toBe(true);
    expect(isEditorThemeId("unknown-theme")).toBe(false);
  });

  it("returns theme mode", () => {
    expect(getEditorThemeMode("github-light")).toBe("light");
    expect(getEditorThemeMode("one-dark")).toBe("dark");
  });

  it("checks theme mode", () => {
    expect(isEditorThemeMode("vscode-dark", "dark")).toBe(true);
    expect(isEditorThemeMode("vscode-light", "dark")).toBe(false);
  });
});
