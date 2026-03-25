import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_COMMAND_CENTER_EXCLUDE_PATTERNS,
  DEFAULT_MAX_STAGE_TABS,
  DEFAULT_TMUX_HISTORY_LIMIT,
  normalizeAppSettings,
  normalizeCommandCenterExcludePatterns,
  normalizeCustomAgentModels,
  normalizeMaxStageTabs,
  normalizeTmuxHistoryLimit,
} from "./appSettings.pure";

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

describe("normalizeMaxStageTabs", () => {
  it("uses fallback for invalid values", () => {
    expect(normalizeMaxStageTabs("abc", 12)).toBe(12);
    expect(normalizeMaxStageTabs(undefined)).toBe(DEFAULT_MAX_STAGE_TABS);
  });

  it("rounds and clamps values", () => {
    expect(normalizeMaxStageTabs(11.6)).toBe(12);
    expect(normalizeMaxStageTabs(0)).toBe(1);
    expect(normalizeMaxStageTabs(999)).toBe(20);
  });
});

describe("normalizeAppSettings", () => {
  it("normalizes command center exclude patterns directly", () => {
    expect(normalizeCommandCenterExcludePatterns([
      " *.log ",
      ".env",
      ".env",
      "",
      4,
    ])).toEqual(["*.log", ".env"]);
  });

  it("normalizes custom agent models directly", () => {
    expect(normalizeCustomAgentModels({
      codex: ["gpt-5.1", "gpt-5.1", "o3"],
      claude: ["  sonnet-4.5  ", 3, ""],
    })).toEqual({
      codex: ["gpt-5.1", "o3"],
      claude: ["sonnet-4.5"],
    });
  });

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

  it("defaults GitHub/cloud integration fields", () => {
    const normalized = normalizeAppSettings();
    expect(normalized.githubToken).toBe("");
    expect(normalized.githubWebhookSecret).toBe("");
    expect(normalized.linearApiToken).toBe("");
    expect(normalized.cloudApiBaseUrl).toBe("https://cloud.divergence.app");
    expect(normalized.cloudApiToken).toBe("");
  });

  it("preserves valid GitHub/cloud integration strings", () => {
    const normalized = normalizeAppSettings({
      githubToken: "ghp_test",
      githubWebhookSecret: "webhook-secret",
      linearApiToken: "lin_api_test",
      cloudApiBaseUrl: "https://cloud.internal",
      cloudApiToken: "cloud-token",
    });
    expect(normalized.githubToken).toBe("ghp_test");
    expect(normalized.githubWebhookSecret).toBe("webhook-secret");
    expect(normalized.linearApiToken).toBe("lin_api_test");
    expect(normalized.cloudApiBaseUrl).toBe("https://cloud.internal");
    expect(normalized.cloudApiToken).toBe("cloud-token");
  });

  it("falls back when GitHub/cloud integration fields are invalid", () => {
    const normalized = normalizeAppSettings({
      githubToken: 42 as never,
      githubWebhookSecret: null as never,
      linearApiToken: ["token"] as never,
      cloudApiBaseUrl: "" as never,
      cloudApiToken: { bad: true } as never,
    });
    expect(normalized.githubToken).toBe("");
    expect(normalized.githubWebhookSecret).toBe("");
    expect(normalized.linearApiToken).toBe("");
    expect(normalized.cloudApiBaseUrl).toBe("https://cloud.divergence.app");
    expect(normalized.cloudApiToken).toBe("");
  });

  it("defaults restoreTabsOnRestart to false", () => {
    const normalized = normalizeAppSettings();
    expect(normalized.restoreTabsOnRestart).toBe(false);
  });

  it("defaults maxStageTabs to 20", () => {
    const normalized = normalizeAppSettings();
    expect(normalized.maxStageTabs).toBe(20);
  });

  it("normalizes maxStageTabs within bounds", () => {
    expect(normalizeAppSettings({ maxStageTabs: 17 }).maxStageTabs).toBe(17);
    expect(normalizeAppSettings({ maxStageTabs: 0 }).maxStageTabs).toBe(1);
    expect(normalizeAppSettings({ maxStageTabs: 999 }).maxStageTabs).toBe(20);
    expect(normalizeAppSettings({ maxStageTabs: "12" as never }).maxStageTabs).toBe(12);
  });

  it("preserves boolean restoreTabsOnRestart", () => {
    const normalized = normalizeAppSettings({
      restoreTabsOnRestart: true,
    });
    expect(normalized.restoreTabsOnRestart).toBe(true);
  });

  it("falls back to false for non-boolean restoreTabsOnRestart", () => {
    const normalized = normalizeAppSettings({
      restoreTabsOnRestart: "yes" as never,
    });
    expect(normalized.restoreTabsOnRestart).toBe(false);
  });

  it("normalizes custom agent models per provider", () => {
    const normalized = normalizeAppSettings({
      customAgentModels: {
        codex: ["gpt-5.1", "gpt-5.1", "o3"],
        claude: ["  sonnet-4.5  ", "", "opus-4.1"],
        opencode: [" anthropic/claude-sonnet-4-5 ", "anthropic/claude-sonnet-4-5", "openrouter/deepseek/deepseek-r1"],
      },
    });

    expect(normalized.customAgentModels).toEqual({
      codex: ["gpt-5.1", "o3"],
      claude: ["sonnet-4.5", "opus-4.1"],
      opencode: ["anthropic/claude-sonnet-4-5", "openrouter/deepseek/deepseek-r1"],
    });
  });

  it("drops invalid custom agent models payloads", () => {
    const normalized = normalizeAppSettings({
      customAgentModels: {
        codex: "gpt-5" as never,
        cursor: [null, "gpt-5"] as never,
      },
    });

    expect(normalized.customAgentModels).toEqual({
      cursor: ["gpt-5"],
    });
  });

  it("defaults command center exclusions and gitignore behavior", () => {
    const normalized = normalizeAppSettings();

    expect(normalized.commandCenterExcludePatterns).toEqual(DEFAULT_COMMAND_CENTER_EXCLUDE_PATTERNS);
    expect(normalized.commandCenterRespectGitignore).toBe(true);
  });

  it("normalizes command center exclude patterns from settings", () => {
    const normalized = normalizeAppSettings({
      commandCenterExcludePatterns: [" *.log ", ".env", ".env", ""],
    });

    expect(normalized.commandCenterExcludePatterns).toEqual(["*.log", ".env"]);
  });

  it("allows clearing command center exclude patterns", () => {
    const normalized = normalizeAppSettings({
      commandCenterExcludePatterns: [],
    });

    expect(normalized.commandCenterExcludePatterns).toEqual([]);
  });

  it("falls back to default command center exclude patterns for invalid values", () => {
    const normalized = normalizeAppSettings({
      commandCenterExcludePatterns: "not-an-array" as never,
    });

    expect(normalized.commandCenterExcludePatterns).toEqual(DEFAULT_COMMAND_CENTER_EXCLUDE_PATTERNS);
  });

  it("preserves explicit command center gitignore preference", () => {
    const normalized = normalizeAppSettings({
      commandCenterRespectGitignore: false,
    });

    expect(normalized.commandCenterRespectGitignore).toBe(false);
  });
});
