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

export interface TmuxSessionEntry {
  name: string;
  created: string;
  attached: boolean;
  window_count: number;
  activity: string;
}

export type TmuxSessionOwnership =
  | { kind: "project"; project: Project }
  | { kind: "divergence"; project: Project; divergence: Divergence }
  | { kind: "orphan" }
  | { kind: "unknown" };

export interface TmuxSessionWithOwnership extends TmuxSessionEntry {
  ownership: TmuxSessionOwnership;
}

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
