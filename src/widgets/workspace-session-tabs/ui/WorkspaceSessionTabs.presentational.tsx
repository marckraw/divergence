import { motion, useReducedMotion } from "framer-motion";
import type { WorkspaceSession } from "../../../entities";
import { isAgentSession } from "../../../entities";
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
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
}

function WorkspaceSessionTabsPresentational({
  sessionList,
  activeSessionId,
  idleAttentionSessionIds,
  onSelectSession,
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
        const needsAttention = idleAttentionSessionIds.has(session.id) && !isActive;
        const isAgent = isAgentSession(session);

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

            {needsAttention && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-yellow/20 text-yellow border border-yellow/40">
                ready
              </span>
            )}

            {isAgent ? (
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getAgentProviderBadgeClass(session.provider)}`}>
                {getAgentProviderLabel(session.provider)}
              </span>
            ) : session.useTmux ? (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface text-subtext">
                tmux
              </span>
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
