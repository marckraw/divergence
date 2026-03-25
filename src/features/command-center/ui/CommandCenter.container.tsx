import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import {
  MAX_VISIBLE_RESULTS,
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
const SEARCH_DEBOUNCE_MS = 150;

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

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
    return filterCommandCenterSearchResults(allItems, debouncedQuery, showCategoryTabs ? activeCategory : undefined);
  }, [activeCategory, allItems, debouncedQuery, showCategoryTabs]);

  const totalFilteredCount = filteredItems.length;
  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, MAX_VISIBLE_RESULTS);
  }, [filteredItems]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list || visibleItems.length === 0) return;

    // Find the selected element among all result items
    const resultElements = list.querySelectorAll("[data-result-item]");
    const selected = resultElements[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, visibleItems.length]);

  const contextLabel = getCommandCenterContextLabel(mode, sourceSession);
  const resultsKey = `${mode.kind}:${showCategoryTabs ? activeCategory : "all"}:${debouncedQuery}`;

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) => (prev < visibleItems.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        event.preventDefault();
        if (visibleItems[selectedIndex]) {
          onSelect(visibleItems[selectedIndex]);
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
  }, [onClose, onSelect, selectedIndex, showCategoryTabs, visibleItems]);

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
      visibleItems={visibleItems}
      totalFilteredCount={totalFilteredCount}
      isLoadingFiles={isLoadingFiles}
      contextLabel={contextLabel}
      showCategoryTabs={showCategoryTabs}
      resultsKey={resultsKey}
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
