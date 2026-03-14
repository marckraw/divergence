import { motion, useReducedMotion } from "framer-motion";
import type { WorkspaceSession } from "../../../entities";
import {
  getWorkspaceSessionAttentionState,
  isAgentSession,
} from "../../../entities";
import {
  FAST_EASE_OUT,
  getAgentProviderBadgeClass,
  getAgentProviderIconClass,
  getAgentProviderLabel,
  IconButton,
  SOFT_SPRING,
} from "../../../shared";

interface WorkspaceSessionTabsProps {
  sessionList: WorkspaceSession[];
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  lastViewedRuntimeEventAtMsBySessionId?: Map<string, number>;
  dismissedAttentionKeyBySessionId?: Map<string, string>;
  onSelectSession: (sessionId: string) => void;
  onDismissSessionAttention?: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
}

function getAttentionBadgeClass(tone: "danger" | "warning" | "accent" | "success"): string {
  switch (tone) {
    case "danger":
      return "bg-red/15 text-red border border-red/30";
    case "warning":
      return "bg-yellow/15 text-yellow border border-yellow/30";
    case "accent":
      return "bg-accent/15 text-accent border border-accent/30";
    case "success":
    default:
      return "bg-emerald-400/15 text-emerald-200 border border-emerald-400/30";
  }
}

function WorkspaceSessionTabsPresentational({
  sessionList,
  activeSessionId,
  idleAttentionSessionIds,
  lastViewedRuntimeEventAtMsBySessionId,
  dismissedAttentionKeyBySessionId,
  onSelectSession,
  onDismissSessionAttention,
  onCloseSession,
}: WorkspaceSessionTabsProps) {
  const shouldReduceMotion = useReducedMotion();
  const tabTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  if (sessionList.length === 0) {
    return <span className="text-xs text-subtext">No session open</span>;
  }

  return (
    <>
      {sessionList.map((session, index) => {
        const isActive = session.id === activeSessionId;
        const isAgent = isAgentSession(session);
        const attentionState = getWorkspaceSessionAttentionState(session, {
          isActive,
          hasIdleAttention: idleAttentionSessionIds.has(session.id),
          lastViewedRuntimeEventAtMs: lastViewedRuntimeEventAtMsBySessionId?.get(session.id) ?? null,
          dismissedAttentionKey: dismissedAttentionKeyBySessionId?.get(session.id) ?? null,
        });
        const needsAttention = attentionState?.kind === "completed";

        return (
          <motion.div
            key={session.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm transition-colors ${
              isActive
                ? "bg-main text-text"
                : needsAttention
                  ? "bg-yellow/10 text-text ring-1 ring-yellow/50 shadow-[0_0_0_1px_rgba(255,200,0,0.18)] hover:bg-yellow/15"
                  : "text-subtext hover:text-text hover:bg-surface/50"
            }`}
            onClick={() => onSelectSession(session.id)}
            layout={shouldReduceMotion ? undefined : "position"}
            transition={tabTransition}
          >
            <span className="text-xs text-subtext">{index + 1}</span>

            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                needsAttention
                  ? "bg-yellow animate-pulse"
                  : session.status === "busy"
                    ? "bg-yellow animate-pulse"
                    : session.status === "active"
                      ? "bg-accent"
                      : "bg-subtext/50"
              }`}
            />

            {isAgent ? (
              <svg
                className={`w-3 h-3 ${getAgentProviderIconClass(session.provider)}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3h6m4 4v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7m3 0V5a2 2 0 012-2h4a2 2 0 012 2v2M9 11h6M9 15h4"
                />
              </svg>
            ) : session.type === "divergence" || session.type === "workspace_divergence" ? (
              <svg
                className="w-3 h-3 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            ) : (
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            )}

            <span className="truncate max-w-32">{session.name}</span>
            {isAgent ? (
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getAgentProviderBadgeClass(session.provider)}`}>
                {getAgentProviderLabel(session.provider)}
              </span>
            ) : session.useTmux ? (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface text-subtext">
                tmux
              </span>
            ) : null}

            {attentionState ? (
              <span
                className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getAttentionBadgeClass(attentionState.tone)} ${
                  attentionState.pulse ? "animate-pulse" : ""
                }`}
              >
                {attentionState.label}
              </span>
            ) : null}

            {attentionState && onDismissSessionAttention ? (
              <IconButton
                className="w-4 h-4 text-subtext hover:text-text rounded"
                onClick={(event) => {
                  event.stopPropagation();
                  onDismissSessionAttention(session.id);
                }}
                variant="ghost"
                size="xs"
                label={
                  attentionState.kind === "approval-required" || attentionState.kind === "awaiting-input"
                    ? `Snooze reminder for ${session.name}`
                    : `Acknowledge reminder for ${session.name}`
                }
                icon={(
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 12h14"
                    />
                  </svg>
                )}
              />
            ) : null}

            {isAgent ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-subtext">
                {session.model}
              </span>
            ) : null}

            <IconButton
              className="w-4 h-4 text-subtext hover:text-red rounded"
              onClick={(event) => {
                event.stopPropagation();
                onCloseSession(session.id);
              }}
              variant="ghost"
              size="xs"
              label={`Close session ${session.name}`}
              icon={(
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            />
          </motion.div>
        );
      })}
    </>
  );
}

export default WorkspaceSessionTabsPresentational;
