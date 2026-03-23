import type {
  AgentProvider,
  Divergence,
  Project,
  StagePaneId,
  Workspace,
  WorkspaceDivergence,
  WorkspaceSession,
} from "../../../entities";

export type CommandCenterMode =
  | { kind: "replace"; targetPaneId: StagePaneId }
  | { kind: "reveal" }
  | { kind: "open-in-pane"; targetPaneId: StagePaneId; sourceSessionId?: string }
  | { kind: "open-file"; rootPath: string; targetPaneId?: StagePaneId };

export type CommandCenterCategory = "all" | "files" | "sessions" | "navigation" | "create";

export type CommandCenterResultType =
  | "project"
  | "divergence"
  | "session"
  | "workspace"
  | "workspace_divergence"
  | "file"
  | "create_action";

export interface FileResult {
  id: string;
  relativePath: string;
  fileName: string;
  directory: string;
  extension: string;
}

export interface CommandCenterCreateAction {
  id: string;
  label: string;
  description: string;
  targetType: "project" | "divergence" | "workspace" | "workspace_divergence";
  targetId: number;
  sessionKind: "terminal" | "agent";
  provider?: AgentProvider;
}

export type CommandCenterSearchResult =
  | {
    type: "project";
    item: Project;
    category: "navigation";
    projectName?: string;
    workspaceName?: string;
  }
  | {
    type: "divergence";
    item: Divergence;
    category: "navigation";
    projectName?: string;
    workspaceName?: string;
  }
  | {
    type: "session";
    item: WorkspaceSession;
    category: "recent" | "navigation";
    projectName?: string;
    workspaceName?: string;
  }
  | {
    type: "workspace";
    item: Workspace;
    category: "navigation";
    projectName?: string;
    workspaceName?: string;
  }
  | {
    type: "workspace_divergence";
    item: WorkspaceDivergence;
    category: "navigation";
    projectName?: string;
    workspaceName?: string;
  }
  | {
    type: "file";
    item: FileResult;
    category: "files";
    projectName?: string;
    workspaceName?: string;
  }
  | {
    type: "create_action";
    item: CommandCenterCreateAction;
    category: "create";
    projectName?: string;
    workspaceName?: string;
  };

export interface CommandCenterResultGroup {
  id: "recent" | "files" | "navigation" | "create";
  heading: string;
  results: CommandCenterSearchResult[];
}

export interface CommandCenterSourceContext {
  badgeLabel: string;
  description: string;
  targetPaneId?: StagePaneId;
}

export interface CommandCenterSessionResult {
  sessionId: string;
  path: string;
  targetType: "project" | "divergence" | "workspace" | "workspace_divergence";
  targetId: number;
}

export interface CommandCenterProps {
  mode: CommandCenterMode;
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, WorkspaceSession>;
  workspaces: Workspace[];
  workspaceDivergences: WorkspaceDivergence[];
  agentProviders: AgentProvider[];
  sourceSession: WorkspaceSession | null;
  onSelect: (result: CommandCenterSearchResult) => void;
  onClose: () => void;
}

export interface CommandCenterPresentationalProps {
  mode: CommandCenterMode;
  query: string;
  groups: CommandCenterResultGroup[];
  flatResults: CommandCenterSearchResult[];
  activeCategory: CommandCenterCategory;
  availableCategories: CommandCenterCategory[];
  selectedIndex: number;
  isLoadingFiles: boolean;
  fileError: string | null;
  filesTruncated: boolean;
  sourceContext: CommandCenterSourceContext;
  inputRef: React.RefObject<HTMLInputElement>;
  listRef: React.RefObject<HTMLDivElement>;
  onQueryChange: (value: string) => void;
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectResult: (result: CommandCenterSearchResult) => void;
  onHoverResult: (index: number) => void;
  onCategoryChange: (category: CommandCenterCategory) => void;
  onClose: () => void;
}

export interface CommandCenterResultItemProps {
  result: CommandCenterSearchResult;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export interface CommandCenterCategoryTabsProps {
  categories: CommandCenterCategory[];
  activeCategory: CommandCenterCategory;
  onSelectCategory: (category: CommandCenterCategory) => void;
}
