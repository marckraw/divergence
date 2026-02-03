import { useEffect, useState } from "react";
import type { AppSettings } from "../lib/appSettings";
import { loadAppSettings, SETTINGS_UPDATED_EVENT } from "../lib/appSettings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      if (event instanceof CustomEvent && event.detail) {
        setSettings(event.detail as AppSettings);
        return;
      }
      setSettings(loadAppSettings());
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
  }, []);

  return { settings };
}
