import type { KeyboardEvent, RefObject } from "react";

export interface FileQuickSwitcherProps {
  rootPath: string;
  onSelect: (absolutePath: string) => void;
  onClose: () => void;
}

export interface FileQuickSwitcherPresentationalProps {
  query: string;
  selectedIndex: number;
  filteredCount: number;
  displayFiles: string[];
  overflowCount: number;
  isLoading: boolean;
  error: string | null;
  truncated: boolean;
  inputRef: RefObject<HTMLInputElement>;
  listRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onQueryChange: (next: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectFile: (relativePath: string) => void;
  onHoverIndex: (index: number) => void;
}
