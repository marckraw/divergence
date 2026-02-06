import { useState, useCallback, useEffect, useMemo } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  DEFAULT_APP_SETTINGS,
  normalizeTmuxHistoryLimit,
  loadAppSettings,
  saveAppSettings,
  broadcastAppSettings,
} from "../../../lib/appSettings";
import { getUpdaterPresentation } from "../../../lib/utils/updaterPresentation";
import { getDivergenceBasePath } from "../api/settings.api";
import SettingsPresentational from "./Settings.presentational";
import type { SettingsProps, SettingsState } from "./Settings.types";

const defaultSettings: SettingsState = {
  ...DEFAULT_APP_SETTINGS,
  divergenceBasePath: "",
};

function SettingsContainer({ onClose, updater }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const updaterPresentation = useMemo(
    () => getUpdaterPresentation(updater.status, updater.version, updater.progress, updater.error),
    [updater.status, updater.version, updater.progress, updater.error]
  );

  useEffect(() => {
    async function loadSettings() {
      try {
        const basePath = await getDivergenceBasePath();
        const storedSettings = loadAppSettings();

        setSettings({
          ...defaultSettings,
          ...storedSettings,
          divergenceBasePath: basePath,
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
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
  }, [onClose, settings]);

  const handleUpdateSetting = useCallback(<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }, []);

  return (
    <SettingsPresentational
      loading={loading}
      settings={settings}
      appVersion={appVersion}
      updater={updater}
      updaterPresentation={updaterPresentation}
      onClose={onClose}
      onSave={handleSave}
      onUpdateSetting={handleUpdateSetting}
    />
  );
}

export default SettingsContainer;
