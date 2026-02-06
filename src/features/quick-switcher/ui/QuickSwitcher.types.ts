import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import type { Divergence, Project } from "../../../entities";
import type { QuickSwitcherSearchResult } from "../../../lib/utils/quickSwitcher";

export interface QuickSwitcherProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  onSelect: (type: "project" | "divergence", item: Project | Divergence) => void;
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
