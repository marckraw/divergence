import type { AutomationAgent } from "./automation.types";

export interface AutomationEditorFormState {
  id: number | null;
  name: string;
  projectId: number | null;
  agent: AutomationAgent;
  prompt: string;
  intervalHours: number;
  enabled: boolean;
  keepSessionAlive: boolean;
}
