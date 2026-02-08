import {
  DEFAULT_EDITOR_THEME_DARK,
  DEFAULT_EDITOR_THEME_LIGHT,
  getEditorThemeMode,
  isEditorThemeId,
  type EditorThemeId,
} from "./editorThemes";

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
  divergenceBasePath?: string;
  agentCommandClaude: string;
  agentCommandCodex: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultShell: "/bin/zsh",
  theme: "dark",
  editorThemeForLightMode: DEFAULT_EDITOR_THEME_LIGHT,
  editorThemeForDarkMode: DEFAULT_EDITOR_THEME_DARK,
  tmuxHistoryLimit: DEFAULT_TMUX_HISTORY_LIMIT,
  divergenceBasePath: "",
  agentCommandClaude: "cat \"{briefPath}\" | claude",
  agentCommandCodex: "codex exec --full-auto -C \"{workspacePath}\" - < \"{briefPath}\"",
};

const LEGACY_CODEX_COMMAND_TEMPLATE = "cat \"{briefPath}\" | codex";

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

  const agentCommandCodex = typeof input?.agentCommandCodex === "string"
    ? input.agentCommandCodex
    : DEFAULT_APP_SETTINGS.agentCommandCodex;
  const migratedAgentCommandCodex = agentCommandCodex === LEGACY_CODEX_COMMAND_TEMPLATE
    ? DEFAULT_APP_SETTINGS.agentCommandCodex
    : agentCommandCodex;

  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    tmuxHistoryLimit: normalizeTmuxHistoryLimit(input?.tmuxHistoryLimit),
    editorThemeForLightMode,
    editorThemeForDarkMode,
    agentCommandClaude,
    agentCommandCodex: migratedAgentCommandCodex,
  };
}

export function loadAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_APP_SETTINGS };
    }
    const parsed = JSON.parse(stored);
    return normalizeAppSettings(parsed);
  } catch (err) {
    console.warn("Failed to parse app settings, using defaults", err);
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function saveAppSettings(settings: AppSettings) {
  const normalized = normalizeAppSettings(settings);
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function broadcastAppSettings(settings: AppSettings) {
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }));
}
