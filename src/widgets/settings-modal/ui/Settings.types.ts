import type { UpdateStatus } from "../../../shared";
import type { EditorThemeId } from "../../../shared";
import type { UpdaterPresentation } from "../lib/updaterPresentation.pure";
import type { Project } from "../../../entities";
import type {
  Automation,
  AutomationAgent,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "../../../entities/automation";

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
  projects: Project[];
  automations: Automation[];
  latestRunByAutomationId: Map<number, AutomationRun>;
  automationsLoading: boolean;
  automationsError: string | null;
  onRefreshAutomations: () => Promise<void>;
  onCreateAutomation: (input: CreateAutomationInput) => Promise<void>;
  onUpdateAutomation: (input: UpdateAutomationInput) => Promise<void>;
  onDeleteAutomation: (automationId: number) => Promise<void>;
  onRunAutomationNow: (automationId: number) => Promise<void>;
}

export interface SettingsState {
  defaultShell: string;
  theme: "dark" | "light";
  editorThemeForLightMode: EditorThemeId;
  editorThemeForDarkMode: EditorThemeId;
  divergenceBasePath: string;
  tmuxHistoryLimit: number;
  agentCommandClaude: string;
  agentCommandCodex: string;
  claudeOAuthToken: string;
}

export interface SettingsAutomationFormState {
  id: number | null;
  name: string;
  projectId: number | null;
  agent: AutomationAgent;
  prompt: string;
  intervalHours: number;
  enabled: boolean;
  keepSessionAlive: boolean;
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
  projects: Project[];
  automations: Automation[];
  latestRunByAutomationId: Map<number, AutomationRun>;
  automationsLoading: boolean;
  automationsError: string | null;
  automationActionError: string | null;
  automationActionInFlightId: number | null;
  isEditorOpen: boolean;
  automationForm: SettingsAutomationFormState;
  automationFormError: string | null;
  isSubmittingAutomation: boolean;
  automationSubmitLabel: string;
  onClose: () => void;
  onSave: () => void;
  onUpdateSetting: UpdateSettingHandler;
  onRefreshAutomations: () => Promise<void>;
  onOpenCreateAutomation: () => void;
  onEditAutomation: (automationId: number) => void;
  onDeleteAutomation: (automationId: number) => Promise<void>;
  onRunAutomationNow: (automationId: number) => Promise<void>;
  onAutomationFormChange: <K extends keyof SettingsAutomationFormState>(
    key: K,
    value: SettingsAutomationFormState[K]
  ) => void;
  onSubmitAutomationForm: () => Promise<void>;
  onCloseAutomationEditor: () => void;
  oauthTokenVisible: boolean;
  onToggleOAuthTokenVisible: () => void;
}
