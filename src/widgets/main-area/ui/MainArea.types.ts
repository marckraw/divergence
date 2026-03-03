import type { ReactNode } from "react";
import type {
  ChangesMode,
  Divergence,
  GitChangeEntry,
  Project,
  SplitPaneId,
  SplitSessionState,
  TerminalSession,
} from "../../../entities";
import type { PromptQueueItemRow } from "../../../entities/prompt-queue";
import type { WorkspaceMember } from "../../../entities/workspace";
import type { EditorThemeId } from "../../../shared";
import type { ProjectSettings } from "../../../entities/project";
import type {
  DiffReviewAgent,
  DiffReviewAnchor,
  DiffReviewComment,
} from "../../../features/diff-review";
import type {
  LinearIssueStatusFilter,
  LinearTaskQueueIssue,
} from "../../../features/linear-task-queue";
import type { LinearWorkflowState } from "../../../shared";

export interface MainAreaProps {
  projects: Project[];
  sessions: Map<string, TerminalSession>;
  idleAttentionSessionIds: Set<string>;
  activeSession: TerminalSession | null;
  onCloseSession: (sessionId: string) => void;
  onCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
  onSelectSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  onRegisterTerminalCommand: (sessionId: string, sendCommand: (command: string) => void) => void;
  onUnregisterTerminalCommand: (sessionId: string) => void;
  onRunReviewAgentRequest: (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: DiffReviewAgent;
    briefMarkdown: string;
  }) => Promise<void>;
  onProjectSettingsSaved: (settings: ProjectSettings) => void;
  splitBySessionId: Map<string, SplitSessionState>;
  onSplitSession: (sessionId: string, orientation: SplitSessionState["orientation"]) => void;
  onFocusSplitPane: (sessionId: string, paneId: SplitPaneId) => void;
  onResizeSplitPanes: (sessionId: string, paneSizes: number[]) => void;
  onResetSplitSession: (sessionId: string) => void;
  reconnectBySessionId: Map<string, number>;
  onReconnectSession: (sessionId: string) => void;
  globalTmuxHistoryLimit: number;
  editorTheme: EditorThemeId;
  divergencesByProject: Map<number, Divergence[]>;
  projectsLoading: boolean;
  divergencesLoading: boolean;
  showFileQuickSwitcher: boolean;
  onCloseFileQuickSwitcher: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onSendPromptToSession: (sessionId: string, prompt: string) => Promise<void>;
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>;
}

export type RightPanelTab = "settings" | "files" | "changes" | "queue" | "linear" | "review" | "tmux";
export type DrawerTab = "diff" | "edit";

export interface MainAreaOpenDiff {
  text: string;
  isBinary: boolean;
}

export interface MainAreaPresentationalProps extends MainAreaProps {
  sessionList: TerminalSession[];
  activeProject: Project | null;
  activeSplit: SplitSessionState | null;
  activeRootPath: string | null;
  rightPanelTab: RightPanelTab;
  openFilePath: string | null;
  openFileContent: string;
  openDiff: MainAreaOpenDiff | null;
  diffLoading: boolean;
  diffError: string | null;
  drawerTab: DrawerTab;
  allowEdit: boolean;
  isDrawerOpen: boolean;
  isDirty: boolean;
  isSavingFile: boolean;
  isLoadingFile: boolean;
  isReadOnly: boolean;
  fileLoadError: string | null;
  fileSaveError: string | null;
  largeFileWarning: string | null;
  changesMode: ChangesMode;
  reviewComments: DiffReviewComment[];
  reviewFinalComment: string;
  reviewAgent: DiffReviewAgent;
  reviewRunning: boolean;
  reviewError: string | null;
  onOpenFile: (
    path: string,
    options?: { resetDiff?: boolean; throwOnError?: boolean }
  ) => Promise<void>;
  onRemoveFile: (path: string) => void;
  onOpenChange: (entry: GitChangeEntry) => Promise<void>;
  onCloseDrawer: () => void;
  onSaveFile: () => Promise<void>;
  onChangeFileContent: (next: string) => void;
  onRightPanelTabChange: (tab: RightPanelTab) => void;
  onChangesModeChange: (mode: ChangesMode) => void;
  onReviewRemoveComment: (commentId: string) => void;
  onReviewFinalCommentChange: (value: string) => void;
  onReviewAgentChange: (agent: DiffReviewAgent) => void;
  onRunReviewAgent: () => Promise<void>;
  onClearReviewDraft: () => void;
  onAddDiffComment: (anchor: DiffReviewAnchor, message: string) => void;
  openFileReviewComments: DiffReviewComment[];
  queueItems: PromptQueueItemRow[];
  queueDraft: string;
  queueLoading: boolean;
  queueError: string | null;
  queueingPrompt: boolean;
  queueActionItemId: number | null;
  queueSendingItemId: number | null;
  onQueueDraftChange: (value: string) => void;
  onQueuePrompt: () => Promise<void>;
  onQueueSendItem: (itemId: number) => Promise<void>;
  onQueueRemoveItem: (itemId: number) => Promise<void>;
  onQueueClear: () => Promise<void>;
  linearProjectName: string | null;
  linearIssues: LinearTaskQueueIssue[];
  linearTotalIssueCount: number;
  linearLoading: boolean;
  linearRefreshing: boolean;
  linearError: string | null;
  linearInfoMessage: string | null;
  linearSendingIssueId: string | null;
  linearStatusFilter: LinearIssueStatusFilter;
  linearSearchQuery: string;
  onLinearRefresh: () => Promise<void>;
  onLinearStatusFilterChange: (filter: LinearIssueStatusFilter) => void;
  onLinearSearchQueryChange: (query: string) => void;
  onLinearSendIssue: (issueId: string) => Promise<void>;
  linearWorkflowStates: LinearWorkflowState[];
  linearUpdatingIssueId: string | null;
  linearStatePickerOpenIssueId: string | null;
  onLinearToggleStatePicker: (issueId: string | null) => void;
  onLinearUpdateIssueState: (issueId: string, stateId: string) => Promise<void>;
  renderSession: (session: TerminalSession) => ReactNode;
}
