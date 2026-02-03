export const SETTINGS_STORAGE_KEY = "divergence-settings";
export const SETTINGS_UPDATED_EVENT = "divergence-settings-updated";
export const DEFAULT_TMUX_HISTORY_LIMIT = 50000;
const MIN_TMUX_HISTORY_LIMIT = 1000;
const MAX_TMUX_HISTORY_LIMIT = 500000;

export interface AppSettings {
  defaultShell: string;
  theme: "dark" | "light";
  tmuxHistoryLimit: number;
  divergenceBasePath?: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultShell: "/bin/zsh",
  theme: "dark",
  tmuxHistoryLimit: DEFAULT_TMUX_HISTORY_LIMIT,
  divergenceBasePath: "",
};

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
  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    tmuxHistoryLimit: normalizeTmuxHistoryLimit(input?.tmuxHistoryLimit),
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
