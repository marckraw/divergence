import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  SETTINGS_STORAGE_KEY,
  SETTINGS_UPDATED_EVENT,
  type AppSettings,
} from "../lib/appSettings.pure";

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

export function saveAppSettings(settings: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(settings);
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function broadcastAppSettings(settings: AppSettings): void {
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }));
}
