import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import type { Divergence, Project, TerminalSession } from "../../../entities";
import type { QuickSwitcherSearchResult } from "../lib/quickSwitcher.pure";

export interface QuickSwitcherProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, TerminalSession>;
  onSelect: (
    type: "project" | "divergence" | "session",
    item: Project | Divergence | TerminalSession
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
  onPanelClick: (event: MouseEvent<HTMLDivElement>) => void;
  onQueryChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectResult: (result: QuickSwitcherSearchResult) => void;
  onHoverResult: (index: number) => void;
}
