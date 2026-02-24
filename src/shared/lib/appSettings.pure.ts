import {
  DEFAULT_EDITOR_THEME_DARK,
  DEFAULT_EDITOR_THEME_LIGHT,
  getEditorThemeMode,
  isEditorThemeId,
  type EditorThemeId,
} from "./editorThemes.pure";

export const SETTINGS_STORAGE_KEY = "divergence-settings";
export const SETTINGS_UPDATED_EVENT = "divergence-settings-updated";
export const DEFAULT_TMUX_HISTORY_LIMIT = 50000;
const MIN_TMUX_HISTORY_LIMIT = 1000;
const MAX_TMUX_HISTORY_LIMIT = 500000;

export interface AppSettings {
  defaultShell: string;
  theme: "dark" | "light";
  editorThemeForLightMode: EditorThemeId;
  editorThemeForDarkMode: EditorThemeId;
  tmuxHistoryLimit: number;
  restoreTabsOnRestart: boolean;
  divergenceBasePath?: string;
  agentCommandClaude: string;
  agentCommandCodex: string;
  claudeOAuthToken?: string;
  githubToken?: string;
  githubWebhookSecret?: string;
  cloudApiBaseUrl?: string;
  cloudApiToken?: string;
}

type AgentCommandTemplate = "claude" | "codex";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultShell: "/bin/zsh",
  theme: "dark",
  editorThemeForLightMode: DEFAULT_EDITOR_THEME_LIGHT,
  editorThemeForDarkMode: DEFAULT_EDITOR_THEME_DARK,
  tmuxHistoryLimit: DEFAULT_TMUX_HISTORY_LIMIT,
  restoreTabsOnRestart: false,
  divergenceBasePath: "",
  agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
  agentCommandCodex:
    "codex exec --dangerously-bypass-approvals-and-sandbox -C \"{workspacePath}\" - < \"{briefPath}\"",
  claudeOAuthToken: "",
  githubToken: "",
  githubWebhookSecret: "",
  cloudApiBaseUrl: "https://cloud.divergence.app",
  cloudApiToken: "",
};

const LEGACY_CLAUDE_COMMAND_TEMPLATES = [
  "cat \"{briefPath}\" | claude",
  "cat {briefPath} | claude",
  'claude -p "$(cat \\"{briefPath}\\")" --dangerously-skip-permissions',
];
const LEGACY_CODEX_COMMAND_TEMPLATES = [
  "cat \"{briefPath}\" | codex",
  "codex exec --full-auto -C \"{workspacePath}\" - < \"{briefPath}\"",
];
const LEGACY_CLAUDE_PIPE_COMMAND_PATTERN = /^cat\s+["']?\{briefPath\}["']?\s*\|\s*claude(?:\s+.*)?$/;
const LEGACY_CODEX_PIPE_COMMAND_PATTERN = /^cat\s+["']?\{briefPath\}["']?\s*\|\s*codex(?:\s+.*)?$/;
const LEGACY_CODEX_FULL_AUTO_COMMAND_PATTERN = /^codex\s+exec\b(?=.*(?:^|\s)--full-auto(?:\s|$)).*$/;

function migrateAgentCommandTemplate(agent: AgentCommandTemplate, template: string): string {
  const normalizedTemplate = template.trim();

  if (agent === "claude") {
    if (
      LEGACY_CLAUDE_COMMAND_TEMPLATES.includes(normalizedTemplate) ||
      LEGACY_CLAUDE_PIPE_COMMAND_PATTERN.test(normalizedTemplate)
    ) {
      return DEFAULT_APP_SETTINGS.agentCommandClaude;
    }
    return template;
  }

  if (
    LEGACY_CODEX_COMMAND_TEMPLATES.includes(normalizedTemplate) ||
    LEGACY_CODEX_PIPE_COMMAND_PATTERN.test(normalizedTemplate) ||
    LEGACY_CODEX_FULL_AUTO_COMMAND_PATTERN.test(normalizedTemplate)
  ) {
    return DEFAULT_APP_SETTINGS.agentCommandCodex;
  }

  return template;
}

export function normalizeTmuxHistoryLimit(
  value: unknown,
  fallback: number = DEFAULT_TMUX_HISTORY_LIMIT
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = Math.round(parsed);
  return Math.min(Math.max(rounded, MIN_TMUX_HISTORY_LIMIT), MAX_TMUX_HISTORY_LIMIT);
}

export function normalizeAppSettings(input?: Partial<AppSettings> | null): AppSettings {
  const legacyEditorTheme = (input as { editorTheme?: unknown } | null)?.editorTheme;
  const legacyThemeId = isEditorThemeId(legacyEditorTheme) ? legacyEditorTheme : null;
  const legacyDarkTheme = legacyThemeId && getEditorThemeMode(legacyThemeId) === "dark"
    ? legacyThemeId
    : null;
  const legacyLightTheme = legacyThemeId && getEditorThemeMode(legacyThemeId) === "light"
    ? legacyThemeId
    : null;

  const editorThemeForLightMode =
    isEditorThemeId(input?.editorThemeForLightMode) &&
    getEditorThemeMode(input.editorThemeForLightMode) === "light"
      ? input.editorThemeForLightMode
      : legacyLightTheme ?? DEFAULT_EDITOR_THEME_LIGHT;

  const editorThemeForDarkMode =
    isEditorThemeId(input?.editorThemeForDarkMode) &&
    getEditorThemeMode(input.editorThemeForDarkMode) === "dark"
      ? input.editorThemeForDarkMode
      : legacyDarkTheme ?? DEFAULT_EDITOR_THEME_DARK;

  const agentCommandClaude = typeof input?.agentCommandClaude === "string"
    ? input.agentCommandClaude
    : DEFAULT_APP_SETTINGS.agentCommandClaude;
  const migratedAgentCommandClaude = migrateAgentCommandTemplate("claude", agentCommandClaude);

  const agentCommandCodex = typeof input?.agentCommandCodex === "string"
    ? input.agentCommandCodex
    : DEFAULT_APP_SETTINGS.agentCommandCodex;
  const migratedAgentCommandCodex = migrateAgentCommandTemplate("codex", agentCommandCodex);

  const claudeOAuthToken = typeof input?.claudeOAuthToken === "string"
    ? input.claudeOAuthToken
    : "";
  const githubToken = typeof input?.githubToken === "string"
    ? input.githubToken
    : "";
  const githubWebhookSecret = typeof input?.githubWebhookSecret === "string"
    ? input.githubWebhookSecret
    : "";
  const cloudApiBaseUrl = typeof input?.cloudApiBaseUrl === "string" && input.cloudApiBaseUrl.trim().length > 0
    ? input.cloudApiBaseUrl
    : DEFAULT_APP_SETTINGS.cloudApiBaseUrl;
  const cloudApiToken = typeof input?.cloudApiToken === "string"
    ? input.cloudApiToken
    : "";
  const restoreTabsOnRestart = input?.restoreTabsOnRestart === true;

  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    tmuxHistoryLimit: normalizeTmuxHistoryLimit(input?.tmuxHistoryLimit),
    restoreTabsOnRestart,
    editorThemeForLightMode,
    editorThemeForDarkMode,
    agentCommandClaude: migratedAgentCommandClaude,
    agentCommandCodex: migratedAgentCommandCodex,
    claudeOAuthToken,
    githubToken,
    githubWebhookSecret,
    cloudApiBaseUrl,
    cloudApiToken,
  };
}
