import type { AgentSessionSnapshot, WorkspaceSession } from "../../../entities";
import type { AgentRuntimeCapabilities } from "../../../shared";

export interface AgentSessionViewProps {
  session: AgentSessionSnapshot;
  sessionList: WorkspaceSession[];
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  capabilities: AgentRuntimeCapabilities | null;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onUpdateModel: (sessionId: string, model: string) => Promise<void>;
  onSendPrompt: (sessionId: string, prompt: string) => Promise<void>;
  onRespondToRequest: (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ) => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
}

export interface AgentSessionViewPresentationalProps extends AgentSessionViewProps {
  draft: string;
  isSubmitting: boolean;
  isUpdatingModel: boolean;
  requestAnswers: string[];
  isResolvingRequest: boolean;
  onDraftChange: (value: string) => void;
  onModelChange: (model: string) => Promise<void>;
  onRequestAnswerChange: (index: number, value: string) => void;
  onSubmit: () => Promise<void>;
  onSubmitRequest: () => Promise<void>;
  onResolveApproval: (decisionId: string) => Promise<void>;
}
