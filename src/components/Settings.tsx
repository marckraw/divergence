import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_APP_SETTINGS,
  normalizeTmuxHistoryLimit,
  loadAppSettings,
  saveAppSettings,
  broadcastAppSettings,
} from "../lib/appSettings";

interface SettingsProps {
  onClose: () => void;
}

interface SettingsState {
  defaultShell: string;
  theme: "dark" | "light";
  divergenceBasePath: string;
  tmuxHistoryLimit: number;
}

const defaultSettings: SettingsState = {
  ...DEFAULT_APP_SETTINGS,
  divergenceBasePath: "",
};

function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);

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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-sidebar border border-surface rounded-lg p-8">
          <p className="text-subtext">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-sidebar border border-surface rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
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
                disabled
                title="Light theme coming soon"
              >
                Light
              </button>
            </div>
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
              Cloned repositories are stored in this location
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
      </div>
    </div>
  );
}

export default Settings;
