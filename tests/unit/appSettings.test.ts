import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_TMUX_HISTORY_LIMIT,
  normalizeAppSettings,
  normalizeTmuxHistoryLimit,
} from "../../src/shared/config/appSettings";

describe("normalizeTmuxHistoryLimit", () => {
  it("uses fallback for invalid values", () => {
    expect(normalizeTmuxHistoryLimit("abc", 1234)).toBe(1234);
    expect(normalizeTmuxHistoryLimit(undefined)).toBe(DEFAULT_TMUX_HISTORY_LIMIT);
  });

  it("rounds and clamps values", () => {
    expect(normalizeTmuxHistoryLimit(1200.6)).toBe(1201);
    expect(normalizeTmuxHistoryLimit(100)).toBe(1000);
    expect(normalizeTmuxHistoryLimit(999999)).toBe(500000);
  });
});

describe("normalizeAppSettings", () => {
  it("applies defaults", () => {
    expect(normalizeAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("supports legacy editorTheme for light mode", () => {
    const normalized = normalizeAppSettings({
      editorTheme: "github-light",
    } as Partial<typeof DEFAULT_APP_SETTINGS> & { editorTheme: string });

    expect(normalized.editorThemeForLightMode).toBe("github-light");
    expect(normalized.editorThemeForDarkMode).toBe(DEFAULT_APP_SETTINGS.editorThemeForDarkMode);
  });

  it("supports legacy editorTheme for dark mode", () => {
    const normalized = normalizeAppSettings({
      editorTheme: "dracula",
    } as Partial<typeof DEFAULT_APP_SETTINGS> & { editorTheme: string });

    expect(normalized.editorThemeForDarkMode).toBe("dracula");
    expect(normalized.editorThemeForLightMode).toBe(DEFAULT_APP_SETTINGS.editorThemeForLightMode);
  });

  it("rejects invalid mode/theme combinations", () => {
    const normalized = normalizeAppSettings({
      editorThemeForDarkMode: "github-light" as never,
      editorThemeForLightMode: "dracula" as never,
      tmuxHistoryLimit: "7777" as never,
    });

    expect(normalized.editorThemeForDarkMode).toBe(DEFAULT_APP_SETTINGS.editorThemeForDarkMode);
    expect(normalized.editorThemeForLightMode).toBe(DEFAULT_APP_SETTINGS.editorThemeForLightMode);
    expect(normalized.tmuxHistoryLimit).toBe(7777);
  });
});
