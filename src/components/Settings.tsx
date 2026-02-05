import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { motion, useReducedMotion } from "framer-motion";
import type { UpdateStatus } from "../hooks/useUpdater";
import {
  DEFAULT_APP_SETTINGS,
  normalizeTmuxHistoryLimit,
  loadAppSettings,
  saveAppSettings,
  broadcastAppSettings,
  type DivergenceMode,
} from "../lib/appSettings";
import {
  EDITOR_THEME_OPTIONS_DARK,
  EDITOR_THEME_OPTIONS_LIGHT,
  type EditorThemeId,
} from "../lib/editorThemes";
import { FAST_EASE_OUT, OVERLAY_FADE, SOFT_SPRING, getPopVariants } from "../lib/motion";

interface UpdaterProp {
  status: UpdateStatus;
  version: string | null;
  progress: number;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

interface SettingsProps {
  onClose: () => void;
  updater: UpdaterProp;
}

interface SettingsState {
  defaultShell: string;
  theme: "dark" | "light";
  editorThemeForLightMode: EditorThemeId;
  editorThemeForDarkMode: EditorThemeId;
  selectToCopy: boolean;
  divergenceMode: DivergenceMode;
  divergenceBasePath: string;
  tmuxHistoryLimit: number;
}

const defaultSettings: SettingsState = {
  ...DEFAULT_APP_SETTINGS,
  divergenceBasePath: "",
};

function Settings({ onClose, updater }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const panelVariants = useMemo(
    () => getPopVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  useEffect(() => {
    async function loadSettings() {
      try {
        // Get the divergence base path
        const basePath = await invoke<string>("get_divergence_base_path");

        const storedSettings = loadAppSettings();

        setSettings({
          ...defaultSettings,
          ...storedSettings,
          divergenceBasePath: basePath,
        });
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleSave = useCallback(() => {
    const normalized = {
      ...settings,
      tmuxHistoryLimit: normalizeTmuxHistoryLimit(settings.tmuxHistoryLimit),
    };
    const saved = saveAppSettings(normalized);
    broadcastAppSettings(saved);
    onClose();
  }, [settings, onClose]);

  const updateSetting = useCallback(<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  if (loading) {
    return (
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        variants={OVERLAY_FADE}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={FAST_EASE_OUT}
      >
        <motion.div
          className="bg-sidebar border border-surface rounded-lg p-8"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={panelTransition}
        >
          <p className="text-subtext">Loading settings...</p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      variants={OVERLAY_FADE}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={FAST_EASE_OUT}
    >
      <motion.div
        className="bg-sidebar border border-surface rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={panelTransition}
      >
        {/* Header */}
        <div className="p-4 border-b border-surface flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Settings</h2>
          <button
            onClick={onClose}
            className="text-subtext hover:text-text p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Shell */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Default Shell
            </label>
            <select
              value={settings.defaultShell}
              onChange={(e) => updateSetting("defaultShell", e.target.value)}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            >
              <option value="/bin/zsh">zsh</option>
              <option value="/bin/bash">bash</option>
              <option value="/bin/sh">sh</option>
            </select>
            <p className="text-xs text-subtext mt-1">
              Shell used for new terminal sessions
            </p>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting("theme", "dark")}
                className={`flex-1 px-4 py-2 rounded border ${
                  settings.theme === "dark"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface text-subtext hover:text-text"
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => updateSetting("theme", "light")}
                className={`flex-1 px-4 py-2 rounded border ${
                  settings.theme === "light"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface text-subtext hover:text-text"
                }`}
              >
                Light
              </button>
            </div>
          </div>

          {/* Editor Themes */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Editor Theme (When App is Light)
            </label>
            <select
              value={settings.editorThemeForLightMode}
              onChange={(e) => updateSetting("editorThemeForLightMode", e.target.value as EditorThemeId)}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            >
              {EDITOR_THEME_OPTIONS_LIGHT.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-subtext mt-1">
              Editor theme used when the app is in light mode.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Editor Theme (When App is Dark)
            </label>
            <select
              value={settings.editorThemeForDarkMode}
              onChange={(e) => updateSetting("editorThemeForDarkMode", e.target.value as EditorThemeId)}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            >
              {EDITOR_THEME_OPTIONS_DARK.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-subtext mt-1">
              Editor theme used when the app is in dark mode.
            </p>
          </div>

          {/* Select to Copy */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-text">
                  Select to Copy
                </label>
                <p className="text-xs text-subtext mt-1">
                  Automatically copy selected text to clipboard
                </p>
              </div>
              <button
                onClick={() => updateSetting("selectToCopy", !settings.selectToCopy)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.selectToCopy ? "bg-accent" : "bg-surface"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.selectToCopy ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Divergence Mode */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Divergence Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting("divergenceMode", "clone")}
                className={`flex-1 px-4 py-2 rounded border ${
                  settings.divergenceMode === "clone"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface text-subtext hover:text-text"
                }`}
              >
                Clone
              </button>
              <button
                onClick={() => updateSetting("divergenceMode", "worktree")}
                className={`flex-1 px-4 py-2 rounded border ${
                  settings.divergenceMode === "worktree"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface text-subtext hover:text-text"
                }`}
              >
                Worktree
              </button>
            </div>
            <p className="text-xs text-subtext mt-1">
              Clone makes a full copy. Worktree creates a lightweight workspace that shares git objects
              with the project.
            </p>
          </div>

          {/* Storage Location */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Divergence Storage
            </label>
            <div className="px-3 py-2 bg-main border border-surface rounded text-subtext text-sm">
              {settings.divergenceBasePath}
            </div>
            <p className="text-xs text-subtext mt-1">
              Divergences are stored in this location
            </p>
          </div>

          {/* tmux history limit */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              tmux History Limit
            </label>
            <input
              type="number"
              min={1000}
              max={500000}
              value={settings.tmuxHistoryLimit}
              onChange={(e) => updateSetting("tmuxHistoryLimit", Number(e.target.value))}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-subtext mt-1">
              Lines kept in tmux scrollback. Recommended: 50,000.
            </p>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Keyboard Shortcuts
            </label>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Toggle Sidebar</span>
                <kbd className="px-2 py-0.5 bg-surface rounded text-xs">⌘ B</kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Quick Switcher</span>
                <kbd className="px-2 py-0.5 bg-surface rounded text-xs">⌘ K</kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">New Divergence</span>
                <kbd className="px-2 py-0.5 bg-surface rounded text-xs">⌘ T</kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Close Terminal</span>
                <kbd className="px-2 py-0.5 bg-surface rounded text-xs">⌘ W</kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Switch Tab</span>
                <kbd className="px-2 py-0.5 bg-surface rounded text-xs">⌘ 1-9</kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Previous/Next Tab</span>
                <kbd className="px-2 py-0.5 bg-surface rounded text-xs">⌘ [ / ]</kbd>
              </div>
            </div>
          </div>

          {/* About / Updates */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              About / Updates
            </label>
            <div className="space-y-3">
              {appVersion && (
                <p className="text-sm text-subtext">
                  Current version: <span className="text-text font-medium">v{appVersion}</span>
                </p>
              )}

              <p className="text-sm text-subtext">
                {updater.status === "idle" && "Up to date"}
                {updater.status === "checking" && "Checking for updates..."}
                {updater.status === "available" && `Update available: v${updater.version}`}
                {updater.status === "downloading" && `Downloading update... ${updater.progress}%`}
                {updater.status === "installed" && "Update installed, restarting..."}
                {updater.status === "error" && (
                  <span className="text-red-400">{updater.error ?? "Update check failed"}</span>
                )}
              </p>

              {updater.status === "downloading" && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${updater.progress}%` }}
                  />
                </div>
              )}

              <div className="flex gap-2">
                {(updater.status === "idle" || updater.status === "error") && (
                  <button
                    onClick={updater.checkForUpdate}
                    className="px-3 py-1.5 text-sm border border-surface rounded hover:bg-surface text-text"
                  >
                    Check for Updates
                  </button>
                )}
                {updater.status === "available" && (
                  <button
                    onClick={updater.downloadAndInstall}
                    className="px-3 py-1.5 text-sm bg-accent text-main rounded hover:bg-accent/80"
                  >
                    Install & Restart
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-subtext hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-accent text-main rounded hover:bg-accent/80"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default Settings;
