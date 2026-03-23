import type { StagePaneId } from "../lib/stagePaneId.pure";

export type StageLayoutOrientation = "horizontal" | "vertical";

export type StagePaneRef =
  | { kind: "terminal"; sessionId: string }
  | { kind: "agent"; sessionId: string }
  | { kind: "pending"; sourceSessionId?: string };

export interface StagePane {
  id: StagePaneId;
  ref: StagePaneRef;
}

export interface StageLayout {
  orientation: StageLayoutOrientation;
  panes: StagePane[];
  paneSizes: number[];
  focusedPaneId: StagePaneId;
}

export type StageLayoutAction =
  | { type: "split"; ref: StagePaneRef; orientation: StageLayoutOrientation }
  | { type: "focus"; paneId: StagePaneId }
  | { type: "close"; paneId: StagePaneId }
  | { type: "resize"; paneSizes: number[] }
  | { type: "replace"; paneId: StagePaneId; ref: StagePaneRef }
  | { type: "reset"; ref: StagePaneRef | null };
