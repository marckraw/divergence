import type { Divergence, Project } from "./entities";
import type { TerminalSession } from "./entities";

export type { Project } from "./entities";
export type {
  ChangesMode,
  Divergence,
  GitChangeEntry,
  GitChangeStatus,
} from "./entities";
export type { SplitOrientation, TerminalSession } from "./entities";
export type {
  TmuxSessionEntry,
  TmuxSessionOwnership,
  TmuxSessionWithOwnership,
} from "./entities/terminal-session";

export interface AppState {
  projects: Project[];
  divergences: Map<number, Divergence[]>;
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
}

export type {
  BackgroundTask,
  BackgroundTaskControls,
  BackgroundTaskKind,
  BackgroundTaskRunOptions,
  BackgroundTaskStatus,
  BackgroundTaskTarget,
  BackgroundTaskToast,
  RunBackgroundTask,
} from "./entities/task";
