import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { joinPath } from "../../../shared";
import { listCommandCenterFiles } from "../api/commandCenter.api";
import {
  buildCommandCenterSearchResults,
  buildCommandCenterSourceContext,
  filterCommandCenterSearchResults,
  getCommandCenterResultKey,
  groupCommandCenterResults,
} from "../lib/commandCenter.pure";
import CommandCenterPresentational from "./CommandCenter.presentational";
import type {
  CommandCenterCategory,
  CommandCenterProps,
  CommandCenterSearchResult,
} from "./CommandCenter.types";

const FILE_CACHE = new Map<string, { files: string[]; truncated: boolean }>();

function getAvailableCategories(mode: CommandCenterProps["mode"]): CommandCenterCategory[] {
  if (mode.kind === "replace" || mode.kind === "open-in-pane") {
    return ["all", "files", "sessions", "create"];
  }
  return ["all"];
}

function resolveFileRootPath({
  mode,
  sourceSessionPath,
}: {
  mode: CommandCenterProps["mode"];
  sourceSessionPath: string | null;
}): string | null {
  if (mode.kind === "open-file") {
    return mode.rootPath;
  }

  if (mode.kind === "replace" || mode.kind === "open-in-pane") {
    return sourceSessionPath;
  }

  return null;
}

function CommandCenter({
  mode,
  projects,
  divergencesByProject,
  sessions,
  workspaces,
  workspaceDivergences,
  agentProviders,
  sourceSession,
  onSelect,
  onClose,
}: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<CommandCenterCategory>("all");
  const [files, setFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filesTruncated, setFilesTruncated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const availableCategories = useMemo(() => getAvailableCategories(mode), [mode]);
  const fileRootPath = resolveFileRootPath({
    mode,
    sourceSessionPath: sourceSession?.path ?? null,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveCategory("all");
    setQuery("");
    setSelectedIndex(0);
  }, [mode]);

  useEffect(() => {
    if (!fileRootPath) {
      setFiles([]);
      setFilesTruncated(false);
      setFileError(null);
      setIsLoadingFiles(false);
      return;
    }

    const cached = FILE_CACHE.get(fileRootPath);
    if (cached) {
      setFiles(cached.files);
      setFilesTruncated(cached.truncated);
      setFileError(null);
      setIsLoadingFiles(false);
      return;
    }

    let cancelled = false;
    setIsLoadingFiles(true);
    setFileError(null);

    listCommandCenterFiles(fileRootPath)
      .then((result) => {
        if (cancelled) {
          return;
        }
        FILE_CACHE.set(fileRootPath, result);
        setFiles(result.files);
        setFilesTruncated(result.truncated);
        setIsLoadingFiles(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setFileError(typeof error === "string" ? error : "Failed to list files.");
        setIsLoadingFiles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileRootPath]);

  const allItems = useMemo(() => {
    return buildCommandCenterSearchResults(mode, {
      projects,
      divergencesByProject,
      sessions,
      workspaces,
      workspaceDivergences,
      files,
      agentProviders,
      sourceSession,
    });
  }, [
    agentProviders,
    divergencesByProject,
    files,
    mode,
    projects,
    sessions,
    sourceSession,
    workspaceDivergences,
    workspaces,
  ]);

  const filteredItems = useMemo(() => (
    filterCommandCenterSearchResults(allItems, query, activeCategory)
  ), [activeCategory, allItems, query]);

  const groups = useMemo(() => groupCommandCenterResults(filteredItems), [filteredItems]);
  const sourceContext = useMemo(() => buildCommandCenterSourceContext(mode, {
    sourceSession,
    targetPaneId: "targetPaneId" in mode ? mode.targetPaneId : null,
  }), [mode, sourceSession]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory, mode]);

  useEffect(() => {
    if (selectedIndex <= filteredItems.length - 1) {
      return;
    }
    setSelectedIndex(Math.max(0, filteredItems.length - 1));
  }, [filteredItems.length, selectedIndex]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || filteredItems.length === 0) {
      return;
    }

    const selectedKey = getCommandCenterResultKey(filteredItems[selectedIndex] ?? filteredItems[0]);
    const selectedItem = list.querySelector<HTMLElement>(`[data-command-center-item="${selectedKey}"]`);
    selectedItem?.scrollIntoView({ block: "nearest" });
  }, [filteredItems, selectedIndex]);

  const handleSelectResult = useCallback((result: CommandCenterSearchResult) => {
    if (result.type === "file" && fileRootPath) {
      onSelect({
        ...result,
        item: {
          ...result.item,
          relativePath: joinPath(fileRootPath, result.item.relativePath),
        },
      });
      return;
    }
    onSelect(result);
  }, [fileRootPath, onSelect]);

  const handleCycleCategory = useCallback((direction: "next" | "previous") => {
    if (availableCategories.length <= 1) {
      return;
    }

    const currentIndex = availableCategories.indexOf(activeCategory);
    const delta = direction === "next" ? 1 : -1;
    const nextIndex = (currentIndex + delta + availableCategories.length) % availableCategories.length;
    setActiveCategory(availableCategories[nextIndex] ?? "all");
  }, [activeCategory, availableCategories]);

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((previous) => Math.min(previous + 1, filteredItems.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((previous) => Math.max(previous - 1, 0));
        return;
      case "Enter":
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelectResult(filteredItems[selectedIndex]);
        }
        return;
      case "Escape":
        event.preventDefault();
        onClose();
        return;
      case "Tab":
        if (availableCategories.length > 1) {
          event.preventDefault();
          handleCycleCategory(event.shiftKey ? "previous" : "next");
        }
        return;
      default:
        return;
    }
  }, [
    availableCategories.length,
    filteredItems,
    handleCycleCategory,
    handleSelectResult,
    onClose,
    selectedIndex,
  ]);

  return (
    <CommandCenterPresentational
      mode={mode}
      query={query}
      groups={groups}
      flatResults={filteredItems}
      activeCategory={activeCategory}
      availableCategories={availableCategories}
      selectedIndex={selectedIndex}
      isLoadingFiles={isLoadingFiles}
      fileError={fileError}
      filesTruncated={filesTruncated}
      sourceContext={sourceContext}
      inputRef={inputRef}
      listRef={listRef}
      onQueryChange={setQuery}
      onInputKeyDown={handleInputKeyDown}
      onSelectResult={handleSelectResult}
      onHoverResult={setSelectedIndex}
      onCategoryChange={setActiveCategory}
      onClose={onClose}
    />
  );
}

export default CommandCenter;
