export type {
  AutomationTriggerDispatchRow,
  InsertAutomationTriggerDispatchRow,
} from "../../../shared/api/schema.types";

export type AutomationTriggerDispatchStatus = "pending" | "launched" | "skipped" | "error";

export interface CreateAutomationTriggerDispatchInput {
  automationId: number;
  externalEventId: string;
  status: AutomationTriggerDispatchStatus;
  automationRunId?: number | null;
  error?: string | null;
}
