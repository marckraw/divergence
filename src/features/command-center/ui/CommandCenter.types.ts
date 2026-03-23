import type { KeyboardEvent, RefObject } from "react";
import type {
  Divergence,
  Project,
  StagePaneId,
  WorkspaceSession,
  Workspace,
  WorkspaceDivergence,
} from "../../../entities";

export type CommandCenterMode =
  | { kind: "replace"; targetPaneId: StagePaneId }
  | { kind: "reveal" }
  | { kind: "open-in-pane"; targetPaneId: StagePaneId; sourceSessionId?: string }
  | { kind: "open-file"; targetPaneId?: StagePaneId; rootPath: string };

export type CommandCenterResultType =
  | "project"
  | "divergence"
  | "session"
  | "workspace"
  | "workspace_divergence"
  | "file"
  | "create_action";

export type CommandCenterCategory = "all" | "files" | "sessions" | "create";

export interface FileResult {
  id: string;
  relativePath: string;
  fileName: string;
  directory: string;
  extension: string;
}

export interface CreateAction {
  id: string;
  label: string;
  description: string;
  sessionKind: "terminal" | "agent";
  provider?: string;
}

export interface CommandCenterSearchResult {
  type: CommandCenterResultType;
  item: Project | Divergence | WorkspaceSession | Workspace | WorkspaceDivergence | FileResult | CreateAction;
  projectName?: string;
  workspaceName?: string;
  category: "recent" | "files" | "navigation" | "create";
}

export interface CommandCenterProps {
  mode: CommandCenterMode;
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, WorkspaceSession>;
  workspaces?: Workspace[];
  workspaceDivergences?: WorkspaceDivergence[];
  sourceSession?: WorkspaceSession | null;
  onSelectProject: (project: Project) => void;
  onSelectDivergence: (divergence: Divergence) => void;
  onSelectSession: (sessionId: string) => void;
  onSelectWorkspace: (workspace: Workspace) => void;
  onSelectWorkspaceDivergence: (wd: WorkspaceDivergence) => void;
  onSelectFile: (absolutePath: string) => void;
  onCreateTerminal: () => void;
  onCreateAgent: (provider: string) => void;
  onClose: () => void;
}

export interface CommandCenterPresentationalProps {
  mode: CommandCenterMode;
  query: string;
  selectedIndex: number;
  activeCategory: CommandCenterCategory;
  filteredItems: CommandCenterSearchResult[];
  isLoadingFiles: boolean;
  showCategoryTabs: boolean;
  contextLabel: string;
  inputRef: RefObject<HTMLInputElement>;
  listRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectResult: (result: CommandCenterSearchResult) => void;
  onHoverResult: (index: number) => void;
  onCategoryChange: (category: CommandCenterCategory) => void;
}
