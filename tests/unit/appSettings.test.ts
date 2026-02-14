import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_TMUX_HISTORY_LIMIT,
  normalizeAppSettings,
  normalizeTmuxHistoryLimit,
} from "../../src/shared/lib/appSettings.pure";

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

  it("uses default agent command templates when invalid", () => {
    const normalized = normalizeAppSettings({
      agentCommandClaude: 7 as never,
      agentCommandCodex: null as never,
    });

    expect(normalized.agentCommandClaude).toBe(DEFAULT_APP_SETTINGS.agentCommandClaude);
    expect(normalized.agentCommandCodex).toBe(DEFAULT_APP_SETTINGS.agentCommandCodex);
  });

  it("migrates legacy codex interactive template to exec template", () => {
    const normalized = normalizeAppSettings({
      agentCommandCodex: "cat \"{briefPath}\" | codex",
    });

    expect(normalized.agentCommandCodex).toBe(DEFAULT_APP_SETTINGS.agentCommandCodex);
  });

  it("migrates codex full-auto template to bypass template", () => {
    const normalized = normalizeAppSettings({
      agentCommandCodex: "codex exec --full-auto -C \"{workspacePath}\" - < \"{briefPath}\"",
    });

    expect(normalized.agentCommandCodex).toBe(DEFAULT_APP_SETTINGS.agentCommandCodex);
  });

  it("migrates legacy claude interactive template to headless template", () => {
    const normalized = normalizeAppSettings({
      agentCommandClaude: "cat \"{briefPath}\" | claude",
    });

    expect(normalized.agentCommandClaude).toBe(DEFAULT_APP_SETTINGS.agentCommandClaude);
  });

  it("migrates legacy claude escaped-quote template to single-quote template", () => {
    const normalized = normalizeAppSettings({
      agentCommandClaude: 'claude -p "$(cat \\"{briefPath}\\")" --dangerously-skip-permissions',
    });

    expect(normalized.agentCommandClaude).toBe(DEFAULT_APP_SETTINGS.agentCommandClaude);
  });

  it("defaults claudeOAuthToken to empty string", () => {
    const normalized = normalizeAppSettings();
    expect(normalized.claudeOAuthToken).toBe("");
  });

  it("preserves valid claudeOAuthToken string", () => {
    const normalized = normalizeAppSettings({
      claudeOAuthToken: "sk-ant-oauth-test-token",
    });
    expect(normalized.claudeOAuthToken).toBe("sk-ant-oauth-test-token");
  });

  it("falls back to empty string for non-string claudeOAuthToken", () => {
    const normalized = normalizeAppSettings({
      claudeOAuthToken: 42 as never,
    });
    expect(normalized.claudeOAuthToken).toBe("");
  });

  it("falls back to empty string for null claudeOAuthToken", () => {
    const normalized = normalizeAppSettings({
      claudeOAuthToken: null as never,
    });
    expect(normalized.claudeOAuthToken).toBe("");
  });
});
