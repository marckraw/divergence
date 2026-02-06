import type { ReactNode } from "react";
import type {
  ChangesMode,
  Divergence,
  GitChangeEntry,
  Project,
  SplitOrientation,
  TerminalSession,
} from "../../../entities";
import type { EditorThemeId } from "../../../lib/editorThemes";
import type { ProjectSettings } from "../../../lib/projectSettings";

export interface MainAreaProps {
  projects: Project[];
  sessions: Map<string, TerminalSession>;
  activeSession: TerminalSession | null;
  onCloseSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  onRendererChange: (sessionId: string, renderer: "webgl" | "canvas") => void;
  onProjectSettingsSaved: (settings: ProjectSettings) => void;
  splitBySessionId: Map<string, { orientation: SplitOrientation }>;
  onSplitSession: (sessionId: string, orientation: SplitOrientation) => void;
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
  taskRunningCount: number;
  onToggleTaskCenter: () => void;
}

export type RightPanelTab = "settings" | "files" | "changes" | "tmux";
export type DrawerTab = "diff" | "edit";

export interface MainAreaOpenDiff {
  text: string;
  isBinary: boolean;
}

export interface MainAreaPresentationalProps extends MainAreaProps {
  sessionList: TerminalSession[];
  activeProject: Project | null;
  activeSplit: { orientation: SplitOrientation } | null;
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
  onOpenFile: (path: string, options?: { resetDiff?: boolean }) => Promise<void>;
  onOpenChange: (entry: GitChangeEntry) => Promise<void>;
  onCloseDrawer: () => void;
  onSaveFile: () => Promise<void>;
  onChangeFileContent: (next: string) => void;
  onRightPanelTabChange: (tab: RightPanelTab) => void;
  onChangesModeChange: (mode: ChangesMode) => void;
  renderSession: (session: TerminalSession) => ReactNode;
}
