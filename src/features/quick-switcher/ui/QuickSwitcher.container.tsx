import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import {
  buildQuickSwitcherSearchResults,
  filterQuickSwitcherSearchResults,
  type QuickSwitcherSearchResult,
} from "../lib/quickSwitcher.pure";
import QuickSwitcherPresentational from "./QuickSwitcher.presentational";
import type { QuickSwitcherProps } from "./QuickSwitcher.types";

function QuickSwitcherContainer({
  projects,
  divergencesByProject,
  onSelect,
  onClose,
}: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo((): QuickSwitcherSearchResult[] => {
    return buildQuickSwitcherSearchResults(projects, divergencesByProject);
  }, [projects, divergencesByProject]);

  const filteredItems = useMemo(() => {
    return filterQuickSwitcherSearchResults(allItems, query);
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list && filteredItems.length > 0) {
      const item = list.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, filteredItems.length]);

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((previous) => (
          previous < filteredItems.length - 1 ? previous + 1 : previous
        ));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((previous) => (previous > 0 ? previous - 1 : previous));
        break;
      case "Enter":
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          const result = filteredItems[selectedIndex];
          onSelect(result.type, result.item);
        }
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
    }
  }, [filteredItems, onClose, onSelect, selectedIndex]);

  const handlePanelClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  const handleSelectResult = useCallback((result: QuickSwitcherSearchResult) => {
    onSelect(result.type, result.item);
  }, [onSelect]);

  const handleHoverResult = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  return (
    <QuickSwitcherPresentational
      query={query}
      selectedIndex={selectedIndex}
      filteredItems={filteredItems}
      inputRef={inputRef}
      listRef={listRef}
      onClose={onClose}
      onPanelClick={handlePanelClick}
      onQueryChange={setQuery}
      onInputKeyDown={handleInputKeyDown}
      onSelectResult={handleSelectResult}
      onHoverResult={handleHoverResult}
    />
  );
}

export default QuickSwitcherContainer;
