import type {
  WorkspaceSession,
  WorkspaceSessionAttentionState,
} from "../../../entities";
import {
  compareWorkspaceSessionAttentionPriority,
  getWorkspaceSessionAttentionState,
  isAgentSession,
  isWorkspaceSessionNeedsAttention,
} from "../../../entities";

export interface SidebarSessionAttentionOptions {
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  lastViewedRuntimeEventAtMsBySessionId?: Map<string, number>;
  dismissedAttentionKeyBySessionId?: Map<string, string>;
}

export interface SidebarAttentionSummary {
  state: WorkspaceSessionAttentionState;
  count: number;
}

export interface SidebarNeedsAttentionItem {
  session: WorkspaceSession;
  attentionState: WorkspaceSessionAttentionState;
}

export function getSidebarSessionAttentionState(
  session: WorkspaceSession,
  options: SidebarSessionAttentionOptions,
): WorkspaceSessionAttentionState | null {
  return getWorkspaceSessionAttentionState(session, {
    isActive: session.id === options.activeSessionId,
    hasIdleAttention: options.idleAttentionSessionIds.has(session.id),
    lastViewedRuntimeEventAtMs: options.lastViewedRuntimeEventAtMsBySessionId?.get(session.id) ?? null,
    dismissedAttentionKey: options.dismissedAttentionKeyBySessionId?.get(session.id) ?? null,
  });
}

export function getSidebarAttentionSummary(
  sessions: WorkspaceSession[],
  options: SidebarSessionAttentionOptions,
): SidebarAttentionSummary | null {
  let highest: WorkspaceSessionAttentionState | null = null;
  let count = 0;

  sessions.forEach((session) => {
    const attentionState = getSidebarSessionAttentionState(session, options);
    if (!attentionState) {
      return;
    }

    count += 1;
    if (compareWorkspaceSessionAttentionPriority(attentionState, highest) < 0) {
      highest = attentionState;
    }
  });

  if (!highest || count === 0) {
    return null;
  }

  return {
    state: highest,
    count,
  };
}

function getWorkspaceSessionSortTimestamp(session: WorkspaceSession): number {
  if (isAgentSession(session)) {
    return session.updatedAtMs;
  }
  return session.lastActivity?.getTime() ?? 0;
}

export function buildSidebarNeedsAttentionItems(
  sessions: Iterable<WorkspaceSession>,
  options: SidebarSessionAttentionOptions,
): SidebarNeedsAttentionItem[] {
  return [...sessions]
    .map((session) => ({
      session,
      attentionState: getWorkspaceSessionAttentionState(session, {
        isActive: false,
        hasIdleAttention: options.idleAttentionSessionIds.has(session.id),
        lastViewedRuntimeEventAtMs: options.lastViewedRuntimeEventAtMsBySessionId?.get(session.id) ?? null,
        dismissedAttentionKey: options.dismissedAttentionKeyBySessionId?.get(session.id) ?? null,
      }),
    }))
    .filter((item): item is SidebarNeedsAttentionItem => isWorkspaceSessionNeedsAttention(item.attentionState))
    .sort((left, right) => {
      const priorityDelta = compareWorkspaceSessionAttentionPriority(
        left.attentionState,
        right.attentionState,
      );
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const timestampDelta = getWorkspaceSessionSortTimestamp(right.session) - getWorkspaceSessionSortTimestamp(left.session);
      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return left.session.name.localeCompare(right.session.name);
    });
}
