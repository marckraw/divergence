import type { UpdateStatus } from "../../../shared";
import type { EditorThemeId } from "../../../shared";
import type { UpdaterPresentation } from "../lib/updaterPresentation.pure";

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
  restoreTabsOnRestart: boolean;
  agentCommandClaude: string;
  agentCommandCodex: string;
  claudeOAuthToken: string;
  githubToken: string;
  githubWebhookSecret: string;
  cloudApiBaseUrl: string;
  cloudApiToken: string;
}

export type SettingsCategoryId =
  | "general"
  | "appearance"
  | "agents"
  | "integrations"
  | "shortcuts"
  | "updates";

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
  activeCategory: SettingsCategoryId;
  onCategoryChange: (category: SettingsCategoryId) => void;
  onClose: () => void;
  onSave: () => void;
  onUpdateSetting: UpdateSettingHandler;
  oauthTokenVisible: boolean;
  githubTokenVisible: boolean;
  cloudTokenVisible: boolean;
  onToggleOAuthTokenVisible: () => void;
  onToggleGithubTokenVisible: () => void;
  onToggleCloudTokenVisible: () => void;
}
