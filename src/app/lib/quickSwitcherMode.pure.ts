import type { StageLayout, StagePaneId } from "../../entities";
import type { CommandCenterMode } from "../../features/command-center";

interface ResolveQuickSwitcherModeParams {
  previousMode: CommandCenterMode | null;
  stageLayout: StageLayout | null;
  focusedPaneId: StagePaneId;
}

export function resolveQuickSwitcherMode({
  previousMode,
  stageLayout,
  focusedPaneId,
}: ResolveQuickSwitcherModeParams): CommandCenterMode | null {
  const focusedPane = stageLayout?.panes.find((pane) => pane.id === focusedPaneId) ?? null;

  if (focusedPane?.ref.kind === "pending") {
    if (
      previousMode?.kind === "open-in-pane"
      && previousMode.targetPaneId === focusedPane.id
    ) {
      return null;
    }

    return focusedPane.ref.sourceSessionId
      ? {
        kind: "open-in-pane",
        targetPaneId: focusedPane.id,
        sourceSessionId: focusedPane.ref.sourceSessionId,
      }
      : {
        kind: "open-in-pane",
        targetPaneId: focusedPane.id,
      };
  }

  return previousMode?.kind === "reveal" ? null : { kind: "reveal" };
}
