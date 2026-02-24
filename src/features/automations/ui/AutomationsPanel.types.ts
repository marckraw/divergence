import type { Project } from "../../../entities";
import type {
  Automation,
  AutomationAgent,
  AutomationRunMode,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "../../../entities/automation";

export interface AutomationFormState {
  id: number | null;
  name: string;
  projectId: number | null;
  runMode: AutomationRunMode;
  sourceProjectId: number | null;
  targetProjectId: number | null;
  baseBranches: string;
  agent: AutomationAgent;
  prompt: string;
  intervalHours: number;
  enabled: boolean;
  keepSessionAlive: boolean;
}

export interface AutomationsPanelProps {
  projects: Project[];
  automations: Automation[];
  latestRunByAutomationId: Map<number, AutomationRun>;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onCreateAutomation: (input: CreateAutomationInput) => Promise<void>;
  onUpdateAutomation: (input: UpdateAutomationInput) => Promise<void>;
  onDeleteAutomation: (automationId: number) => Promise<void>;
  onRunAutomationNow: (automationId: number) => Promise<void>;
}

export interface AutomationsPanelPresentationalProps extends AutomationsPanelProps {
  isEditorOpen: boolean;
  form: AutomationFormState;
  formError: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  cancelEditVisible: boolean;
  onOpenCreateTemplate: () => void;
  onFormChange: <K extends keyof AutomationFormState>(
    key: K,
    value: AutomationFormState[K]
  ) => void;
  onSubmitForm: () => Promise<void>;
  onCloseEditor: () => void;
  onEditAutomation: (automationId: number) => void;
}
