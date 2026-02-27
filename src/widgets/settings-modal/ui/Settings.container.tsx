import { useState, useCallback, useEffect, useMemo } from "react";
import {
  DEFAULT_APP_SETTINGS,
  normalizeTmuxHistoryLimit,
  loadAppSettings,
  saveAppSettings,
  broadcastAppSettings,
} from "../../../shared";
import { getAppVersion } from "../../../shared/api/app.api";
import { getUpdaterPresentation } from "../lib/updaterPresentation.pure";
import { getDivergenceBasePath } from "../api/settings.api";
import SettingsPresentational from "./Settings.presentational";
import type {
  SettingsCategoryId,
  SettingsProps,
  SettingsState,
} from "./Settings.types";

const defaultSettings: SettingsState = {
  ...DEFAULT_APP_SETTINGS,
  divergenceBasePath: "",
  claudeOAuthToken: "",
  githubToken: "",
  githubWebhookSecret: "",
  cloudApiBaseUrl: DEFAULT_APP_SETTINGS.cloudApiBaseUrl ?? "https://cloud.divergence.app",
  cloudApiToken: "",
};

function SettingsContainer({
  onClose,
  updater,
}: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId>("general");
  const [oauthTokenVisible, setOauthTokenVisible] = useState(false);
  const [githubTokenVisible, setGithubTokenVisible] = useState(false);
  const [cloudTokenVisible, setCloudTokenVisible] = useState(false);
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

    void loadSettings();
  }, []);

  useEffect(() => {
    void getAppVersion().then(setAppVersion).catch(() => {});
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

  const handleToggleOAuthTokenVisible = useCallback(() => {
    setOauthTokenVisible((prev) => !prev);
  }, []);

  const handleToggleGithubTokenVisible = useCallback(() => {
    setGithubTokenVisible((prev) => !prev);
  }, []);

  const handleToggleCloudTokenVisible = useCallback(() => {
    setCloudTokenVisible((prev) => !prev);
  }, []);

  return (
    <SettingsPresentational
      loading={loading}
      settings={settings}
      appVersion={appVersion}
      updater={updater}
      updaterPresentation={updaterPresentation}
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      onClose={onClose}
      onSave={handleSave}
      onUpdateSetting={handleUpdateSetting}
      oauthTokenVisible={oauthTokenVisible}
      githubTokenVisible={githubTokenVisible}
      cloudTokenVisible={cloudTokenVisible}
      onToggleOAuthTokenVisible={handleToggleOAuthTokenVisible}
      onToggleGithubTokenVisible={handleToggleGithubTokenVisible}
      onToggleCloudTokenVisible={handleToggleCloudTokenVisible}
    />
  );
}

export default SettingsContainer;
