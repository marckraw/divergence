import type { SplitSessionState } from "../../../entities";

export function resolveActivePaneSessionId(
  sessionId: string | null,
  splitState: SplitSessionState | null,
): string | null {
  if (!sessionId) {
    return null;
  }

  if (!splitState) {
    return sessionId;
  }

  const focusedPaneId = splitState.focusedPaneId;
  if (!splitState.paneIds.includes(focusedPaneId) || focusedPaneId === "pane-1") {
    return sessionId;
  }

  return `${sessionId}-${focusedPaneId}`;
}
