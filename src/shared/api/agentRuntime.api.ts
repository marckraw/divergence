import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeCapabilities,
  AgentRuntimeSessionSnapshot,
  AgentRuntimeSessionUpdatedEvent,
  CreateAgentSessionInput,
  RespondAgentRequestInput,
  StageAgentRuntimeAttachmentInput,
  StartAgentTurnInput,
  UpdateAgentSessionInput,
} from "./agentRuntime.types";

const AGENT_RUNTIME_UPDATED_EVENT = "agent-runtime-session-updated";

export async function getAgentRuntimeCapabilities(): Promise<AgentRuntimeCapabilities> {
  return invoke<AgentRuntimeCapabilities>("get_agent_runtime_capabilities");
}

export async function refreshAgentRuntimeCapabilities(): Promise<AgentRuntimeCapabilities> {
  return invoke<AgentRuntimeCapabilities>("refresh_agent_runtime_capabilities");
}

export async function listAgentRuntimeSessions(): Promise<AgentRuntimeSessionSnapshot[]> {
  return invoke<AgentRuntimeSessionSnapshot[]>("list_agent_sessions");
}

export async function getAgentRuntimeSession(
  sessionId: string
): Promise<AgentRuntimeSessionSnapshot | null> {
  return invoke<AgentRuntimeSessionSnapshot | null>("get_agent_session", {
    sessionId,
  });
}

export async function createAgentRuntimeSession(
  input: CreateAgentSessionInput
): Promise<AgentRuntimeSessionSnapshot> {
  return invoke<AgentRuntimeSessionSnapshot>("create_agent_session", {
    input: {
      provider: input.provider,
      targetType: input.targetType,
      targetId: input.targetId,
      projectId: input.projectId,
      workspaceOwnerId: input.workspaceOwnerId,
      workspaceKey: input.workspaceKey,
      sessionRole: input.sessionRole,
      model: input.model,
      name: input.name,
      path: input.path,
    },
  });
}

export async function startAgentRuntimeTurn(
  input: StartAgentTurnInput
): Promise<AgentRuntimeSessionSnapshot> {
  return invoke<AgentRuntimeSessionSnapshot>("start_agent_turn", {
    input: {
      sessionId: input.sessionId,
      prompt: input.prompt,
      interactionMode: input.interactionMode,
      attachments: input.attachments,
      claudeOAuthToken: input.claudeOAuthToken,
      automationMode: input.automationMode,
    },
  });
}

export async function stageAgentRuntimeAttachment(
  input: StageAgentRuntimeAttachmentInput
): Promise<AgentRuntimeAttachment> {
  return invoke<AgentRuntimeAttachment>("stage_agent_attachment", {
    input: {
      sessionId: input.sessionId,
      name: input.name,
      mimeType: input.mimeType,
      base64Content: input.base64Content,
    },
  });
}

export async function discardAgentRuntimeAttachment(
  sessionId: string,
  attachmentId: string
): Promise<void> {
  await invoke("discard_agent_attachment", {
    sessionId,
    attachmentId,
  });
}

export async function stopAgentRuntimeSession(sessionId: string): Promise<void> {
  await invoke("stop_agent_session", {
    sessionId,
  });
}

export async function deleteAgentRuntimeSession(sessionId: string): Promise<void> {
  await invoke("delete_agent_session", {
    sessionId,
  });
}

export async function respondAgentRuntimeRequest(
  input: RespondAgentRequestInput
): Promise<AgentRuntimeSessionSnapshot> {
  return invoke<AgentRuntimeSessionSnapshot>("respond_agent_request", {
    input: {
      sessionId: input.sessionId,
      requestId: input.requestId,
      decision: input.decision,
      answers: input.answers,
    },
  });
}

export async function updateAgentRuntimeSession(
  input: UpdateAgentSessionInput
): Promise<AgentRuntimeSessionSnapshot> {
  return invoke<AgentRuntimeSessionSnapshot>("update_agent_session", {
    input: {
      sessionId: input.sessionId,
      isOpen: input.isOpen,
      model: input.model,
    },
  });
}

export async function onAgentRuntimeSessionUpdated(
  callback: (event: AgentRuntimeSessionUpdatedEvent) => void
): Promise<() => void> {
  return listen<AgentRuntimeSessionUpdatedEvent>(AGENT_RUNTIME_UPDATED_EVENT, (event) => {
    callback(event.payload);
  });
}
