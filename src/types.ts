import type { Divergence, Project } from "./entities";
import type { TerminalSession } from "./entities";

export type { Project } from "./entities";
export type {
  ChangesMode,
  Divergence,
  GitChangeEntry,
  GitChangeStatus,
} from "./entities";
export type {
  SplitOrientation,
  SplitPaneId,
  SplitSessionState,
  TerminalSession,
} from "./entities";
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
  BackgroundTaskPhaseEvent,
  BackgroundTaskKind,
  BackgroundTaskRunOptions,
  BackgroundTaskStatus,
  BackgroundTaskTarget,
  BackgroundTaskToast,
  RunBackgroundTask,
} from "./entities/task";
export type {
  Automation,
  AutomationAgent,
  AutomationRunMode,
  AutomationTriggerType,
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTriggerSource,
  CreateAutomationInput,
  CreateAutomationRunInput,
  GithubPrMergedTriggerConfig,
  UpdateAutomationInput,
} from "./entities/automation";
export type {
  CreateInboxEventInput,
  InboxEvent,
  InboxEventKind,
  InboxFilter,
} from "./entities/inbox-event";
