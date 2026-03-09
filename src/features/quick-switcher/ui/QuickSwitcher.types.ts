import type { KeyboardEvent, RefObject } from "react";
import type { Divergence, Project, WorkspaceSession, Workspace, WorkspaceDivergence } from "../../../entities";
import type { QuickSwitcherSearchResult } from "../lib/quickSwitcher.pure";

export interface QuickSwitcherProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, WorkspaceSession>;
  workspaces?: Workspace[];
  workspaceDivergences?: WorkspaceDivergence[];
  onSelect: (
    type: "project" | "divergence" | "session" | "workspace" | "workspace_divergence",
    item: Project | Divergence | WorkspaceSession | Workspace | WorkspaceDivergence
  ) => void;
  onClose: () => void;
}

export interface QuickSwitcherPresentationalProps {
  query: string;
  selectedIndex: number;
  filteredItems: QuickSwitcherSearchResult[];
  inputRef: RefObject<HTMLInputElement>;
  listRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectResult: (result: QuickSwitcherSearchResult) => void;
  onHoverResult: (index: number) => void;
}
