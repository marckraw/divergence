import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  EDITOR_THEME_OPTIONS_DARK,
  EDITOR_THEME_OPTIONS_LIGHT,
  type EditorThemeId,
} from "../../../shared/config/editorThemes";
import { FAST_EASE_OUT, OVERLAY_FADE, SOFT_SPRING, getPopVariants } from "../../../shared/lib/motion";
import type { SettingsPresentationalProps } from "./Settings.types";

function SettingsPresentational({
  loading,
  settings,
  appVersion,
  updater,
  updaterPresentation,
  onClose,
  onSave,
  onUpdateSetting,
}: SettingsPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const panelVariants = useMemo(
    () => getPopVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

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
        onClick={(event) => event.stopPropagation()}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={panelTransition}
      >
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

        <div className="p-4 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Default Shell
            </label>
            <select
              value={settings.defaultShell}
              onChange={(event) => onUpdateSetting("defaultShell", event.target.value)}
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

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onUpdateSetting("theme", "dark")}
                className={`flex-1 px-4 py-2 rounded border ${
                  settings.theme === "dark"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface text-subtext hover:text-text"
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => onUpdateSetting("theme", "light")}
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

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Editor Theme (When App is Light)
            </label>
            <select
              value={settings.editorThemeForLightMode}
              onChange={(event) => onUpdateSetting("editorThemeForLightMode", event.target.value as EditorThemeId)}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            >
              {EDITOR_THEME_OPTIONS_LIGHT.map((option) => (
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
              onChange={(event) => onUpdateSetting("editorThemeForDarkMode", event.target.value as EditorThemeId)}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            >
              {EDITOR_THEME_OPTIONS_DARK.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-subtext mt-1">
              Editor theme used when the app is in dark mode.
            </p>
          </div>

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

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              tmux History Limit
            </label>
            <input
              type="number"
              min={1000}
              max={500000}
              value={settings.tmuxHistoryLimit}
              onChange={(event) => onUpdateSetting("tmuxHistoryLimit", Number(event.target.value))}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-subtext mt-1">
              Lines kept in tmux scrollback. Recommended: 50,000.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Claude Command Template
            </label>
            <input
              type="text"
              value={settings.agentCommandClaude}
              onChange={(event) => onUpdateSetting("agentCommandClaude", event.target.value)}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-subtext mt-1">
              Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.
              Use <code>codex exec</code> for non-interactive runs.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Codex Command Template
            </label>
            <input
              type="text"
              value={settings.agentCommandCodex}
              onChange={(event) => onUpdateSetting("agentCommandCodex", event.target.value)}
              className="w-full px-3 py-2 bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-subtext mt-1">
              Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.
            </p>
          </div>

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
                <span className={updaterPresentation.isError ? "text-red-400" : undefined}>
                  {updaterPresentation.message}
                </span>
              </p>

              {updaterPresentation.showProgress && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${updater.progress}%` }}
                  />
                </div>
              )}

              <div className="flex gap-2">
                {updaterPresentation.showCheckButton && (
                  <button
                    onClick={updater.checkForUpdate}
                    className="px-3 py-1.5 text-sm border border-surface rounded hover:bg-surface text-text"
                  >
                    Check for Updates
                  </button>
                )}
                {updaterPresentation.showInstallButton && (
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

        <div className="p-4 border-t border-surface flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-subtext hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm bg-accent text-main rounded hover:bg-accent/80"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default SettingsPresentational;
