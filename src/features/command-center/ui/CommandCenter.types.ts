import type { KeyboardEvent, RefObject } from "react";
import type {
  AgentProvider,
  Divergence,
  Project,
  StagePaneId,
  StageTab,
  Workspace,
  WorkspaceDivergence,
  WorkspaceSession,
} from "../../../entities";

export type CommandCenterMode =
  | { kind: "replace"; targetPaneId: StagePaneId }
  | { kind: "reveal" }
  | { kind: "open-in-pane"; targetPaneId: StagePaneId; sourceSessionId?: string }
  | { kind: "open-file"; targetPaneId?: StagePaneId; rootPath: string };

export type CommandCenterCategory = "all" | "files" | "sessions" | "create";

export type CommandCenterResultType =
  | "project"
  | "divergence"
  | "session"
  | "workspace"
  | "workspace_divergence"
  | "stage_tab"
  | "file"
  | "create_action";

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
  targetType: "project" | "divergence" | "workspace" | "workspace_divergence";
  targetId: number;
  sessionKind: "terminal" | "agent";
  provider?: AgentProvider;
}

export interface CommandCenterSearchResult {
  type: CommandCenterResultType;
  item: Project | Divergence | WorkspaceSession | Workspace
    | WorkspaceDivergence | StageTab | FileResult | CreateAction;
  projectName?: string;
  workspaceName?: string;
  detail?: string;
  category: "recent" | "files" | "navigation" | "create";
  score?: number;
  matchedIndices?: number[];
}

export interface CommandCenterProps {
  mode: CommandCenterMode;
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, WorkspaceSession>;
  stageTabs: StageTab[];
  workspaces: Workspace[];
  workspaceDivergences: WorkspaceDivergence[];
  agentProviders: AgentProvider[];
  excludePatterns: string[];
  respectGitignore: boolean;
  sourceSession: WorkspaceSession | null;
  onSelect: (result: CommandCenterSearchResult) => void;
  onClose: () => void;
}

export interface CommandCenterPresentationalProps {
  mode: CommandCenterMode;
  query: string;
  selectedIndex: number;
  activeCategory: CommandCenterCategory;
  visibleItems: CommandCenterSearchResult[];
  totalFilteredCount: number;
  isLoadingFiles: boolean;
  contextLabel: string;
  showCategoryTabs: boolean;
  resultsKey: string;
  inputRef: RefObject<HTMLInputElement>;
  listRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectResult: (result: CommandCenterSearchResult) => void;
  onHoverResult: (index: number) => void;
  onCategoryChange: (category: CommandCenterCategory) => void;
}
