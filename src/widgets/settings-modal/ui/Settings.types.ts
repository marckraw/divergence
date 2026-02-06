import type { UpdateStatus } from "../../../hooks/useUpdater";
import type { EditorThemeId } from "../../../lib/editorThemes";
import type { UpdaterPresentation } from "../../../lib/utils/updaterPresentation";

export interface UpdaterProp {
  status: UpdateStatus;
  version: string | null;
  progress: number;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

export interface SettingsProps {
  onClose: () => void;
  updater: UpdaterProp;
}

export interface SettingsState {
  defaultShell: string;
  theme: "dark" | "light";
  editorThemeForLightMode: EditorThemeId;
  editorThemeForDarkMode: EditorThemeId;
  divergenceBasePath: string;
  tmuxHistoryLimit: number;
}

export type UpdateSettingHandler = <K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K]
) => void;

export interface SettingsPresentationalProps {
  loading: boolean;
  settings: SettingsState;
  appVersion: string | null;
  updater: UpdaterProp;
  updaterPresentation: UpdaterPresentation;
  onClose: () => void;
  onSave: () => void;
  onUpdateSetting: UpdateSettingHandler;
}
