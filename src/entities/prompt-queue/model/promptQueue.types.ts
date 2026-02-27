export type {
  InsertPromptQueueItemRow,
  PromptQueueItemRow,
} from "../../../shared/api/schema.types";

export type PromptQueueScopeType = "project" | "workspace";

export interface CreatePromptQueueItemInput {
  scopeType: PromptQueueScopeType;
  scopeId: number;
  prompt: string;
}
