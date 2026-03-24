import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import {
  buildCommandCenterSearchResults,
  filterCommandCenterSearchResults,
  getCommandCenterContextLabel,
} from "../lib/commandCenter.pure";
import { listProjectFiles } from "../api/commandCenter.api";
import type {
  CommandCenterCategory,
  CommandCenterProps,
  CommandCenterSearchResult,
} from "./CommandCenter.types";
import CommandCenterPresentational from "./CommandCenter.presentational";

const CATEGORY_ORDER: CommandCenterCategory[] = ["all", "files", "sessions", "create"];

function CommandCenterContainer({
  mode,
  projects,
  divergencesByProject,
  sessions,
  stageTabs,
  workspaces,
  workspaceDivergences,
  agentProviders,
  excludePatterns,
  respectGitignore,
  sourceSession,
  onSelect,
  onClose,
}: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<CommandCenterCategory>("all");
  const [files, setFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Determine if we need file listing
  const rootPath = mode.kind === "open-file"
    ? mode.rootPath
    : sourceSession?.path ?? null;

  const needsFiles = mode.kind === "open-file"
    || mode.kind === "replace"
    || mode.kind === "open-in-pane";

  // Fetch files when root path is available
  useEffect(() => {
    if (!needsFiles || !rootPath) {
      setFiles([]);
      setIsLoadingFiles(false);
      return;
    }

    let cancelled = false;
    setIsLoadingFiles(true);

    listProjectFiles(rootPath, excludePatterns, respectGitignore)
      .then((result) => {
        if (!cancelled) {
          setFiles(result.files);
          setIsLoadingFiles(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoadingFiles(false);
        }
      });

    return () => { cancelled = true; };
  }, [excludePatterns, needsFiles, respectGitignore, rootPath]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const showCategoryTabs = mode.kind === "replace" || mode.kind === "open-in-pane";

  // Build and filter search results
  const allItems = useMemo(() => {
    return buildCommandCenterSearchResults(mode, {
      projects,
      divergencesByProject,
      sessions,
      workspaces,
      workspaceDivergences,
      stageTabs,
      files: needsFiles ? files : undefined,
      agentProviders,
      sourceSession,
    });
  }, [mode, projects, divergencesByProject, sessions, workspaces, workspaceDivergences, stageTabs, files, agentProviders, sourceSession, needsFiles]);

  // Reset category when mode changes (e.g. replace → reveal)
  useEffect(() => {
    setActiveCategory("all");
  }, [mode.kind]);

  const filteredItems = useMemo(() => {
    return filterCommandCenterSearchResults(allItems, query, showCategoryTabs ? activeCategory : undefined);
  }, [allItems, query, activeCategory, showCategoryTabs]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list || filteredItems.length === 0) return;

    // Find the selected element among all result items
    const resultElements = list.querySelectorAll("[data-result-item]");
    const selected = resultElements[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, filteredItems.length]);

  const contextLabel = getCommandCenterContextLabel(mode, sourceSession);

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex]);
        }
        break;
      case "Tab":
        if (showCategoryTabs) {
          event.preventDefault();
          setActiveCategory((prev) => {
            const idx = CATEGORY_ORDER.indexOf(prev);
            const next = event.shiftKey
              ? (idx - 1 + CATEGORY_ORDER.length) % CATEGORY_ORDER.length
              : (idx + 1) % CATEGORY_ORDER.length;
            return CATEGORY_ORDER[next];
          });
        }
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
    }
  }, [filteredItems, onClose, onSelect, selectedIndex, showCategoryTabs]);

  const handleSelectResult = useCallback((result: CommandCenterSearchResult) => {
    onSelect(result);
  }, [onSelect]);

  const handleHoverResult = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  return (
    <CommandCenterPresentational
      mode={mode}
      query={query}
      selectedIndex={selectedIndex}
      activeCategory={activeCategory}
      filteredItems={filteredItems}
      isLoadingFiles={isLoadingFiles}
      contextLabel={contextLabel}
      showCategoryTabs={showCategoryTabs}
      inputRef={inputRef}
      listRef={listRef}
      onClose={onClose}
      onQueryChange={setQuery}
      onInputKeyDown={handleInputKeyDown}
      onSelectResult={handleSelectResult}
      onHoverResult={handleHoverResult}
      onCategoryChange={setActiveCategory}
    />
  );
}

export default CommandCenterContainer;
