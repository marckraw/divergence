import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type {
  Divergence,
  Project,
  WorkspaceSession,
  Workspace,
  WorkspaceDivergence,
} from "../../../entities";
import {
  buildCommandCenterSearchResults,
  filterCommandCenterSearchResults,
  joinRootWithRelativePath,
} from "../lib/commandCenter.pure";
import { listProjectFiles } from "../api/commandCenter.api";
import CommandCenterPresentational from "./CommandCenter.presentational";
import type {
  CommandCenterCategory,
  CommandCenterProps,
  CommandCenterSearchResult,
  CreateAction,
  FileResult,
} from "./CommandCenter.types";

const MAX_FILES = 200;

const CATEGORY_ORDER: CommandCenterCategory[] = ["all", "files", "sessions", "create"];

function CommandCenterContainer({
  mode,
  projects,
  divergencesByProject,
  sessions,
  workspaces,
  workspaceDivergences,
  sourceSession,
  onSelectProject,
  onSelectDivergence,
  onSelectSession,
  onSelectWorkspace,
  onSelectWorkspaceDivergence,
  onSelectFile,
  onCreateTerminal,
  onCreateAgent,
  onClose,
}: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<CommandCenterCategory>("all");
  const [files, setFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Determine root path for file listing
  const rootPath = useMemo(() => {
    if (mode.kind === "open-file") return mode.rootPath;
    if (sourceSession) return sourceSession.path;
    return null;
  }, [mode, sourceSession]);

  // Load files if we have a root path
  useEffect(() => {
    if (!rootPath) return;

    let cancelled = false;
    setIsLoadingFiles(true);

    listProjectFiles(rootPath)
      .then((result) => {
        if (cancelled) return;
        setFiles(result.files.slice(0, MAX_FILES));
        setIsLoadingFiles(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFiles([]);
        setIsLoadingFiles(false);
      });

    return () => { cancelled = true; };
  }, [rootPath]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allItems = useMemo(() => {
    return buildCommandCenterSearchResults(mode, {
      projects,
      divergencesByProject,
      sessions,
      workspaces,
      workspaceDivergences,
      files: files.length > 0 ? files : undefined,
    });
  }, [mode, projects, divergencesByProject, sessions, workspaces, workspaceDivergences, files]);

  const filteredItems = useMemo(() => {
    return filterCommandCenterSearchResults(allItems, query, activeCategory);
  }, [allItems, query, activeCategory]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || filteredItems.length === 0) return;

    // Find the actual DOM element at the selected index across grouped sections
    const allResultItems = list.querySelectorAll("[data-result-item]");
    const item = allResultItems[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, filteredItems.length]);

  const handleSelect = useCallback((result: CommandCenterSearchResult) => {
    switch (result.type) {
      case "project":
        onSelectProject(result.item as Project);
        break;
      case "divergence":
        onSelectDivergence(result.item as Divergence);
        break;
      case "session":
        onSelectSession((result.item as WorkspaceSession).id);
        break;
      case "workspace":
        onSelectWorkspace(result.item as Workspace);
        break;
      case "workspace_divergence":
        onSelectWorkspaceDivergence(result.item as WorkspaceDivergence);
        break;
      case "file": {
        const file = result.item as FileResult;
        if (rootPath) {
          onSelectFile(joinRootWithRelativePath(rootPath, file.relativePath));
        }
        break;
      }
      case "create_action": {
        const action = result.item as CreateAction;
        if (action.sessionKind === "terminal") {
          onCreateTerminal();
        } else if (action.provider) {
          onCreateAgent(action.provider);
        }
        break;
      }
    }
    onClose();
  }, [onSelectProject, onSelectDivergence, onSelectSession, onSelectWorkspace, onSelectWorkspaceDivergence, onSelectFile, onCreateTerminal, onCreateAgent, onClose, rootPath]);

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
          handleSelect(filteredItems[selectedIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
      case "Tab": {
        event.preventDefault();
        const showTabs = mode.kind === "replace" || mode.kind === "open-in-pane";
        if (!showTabs) break;
        const currentIdx = CATEGORY_ORDER.indexOf(activeCategory);
        if (event.shiftKey) {
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : CATEGORY_ORDER.length - 1;
          setActiveCategory(CATEGORY_ORDER[prevIdx]);
        } else {
          const nextIdx = currentIdx < CATEGORY_ORDER.length - 1 ? currentIdx + 1 : 0;
          setActiveCategory(CATEGORY_ORDER[nextIdx]);
        }
        break;
      }
    }
  }, [filteredItems, selectedIndex, handleSelect, onClose, activeCategory, mode.kind]);

  const showCategoryTabs = mode.kind === "replace" || mode.kind === "open-in-pane";

  const contextLabel = useMemo(() => {
    if (sourceSession) {
      const projectName = projects.find((p) => p.id === sourceSession.projectId)?.name;
      return projectName ?? sourceSession.path;
    }
    if (mode.kind === "open-file") {
      return mode.rootPath;
    }
    return "";
  }, [sourceSession, projects, mode]);

  return (
    <CommandCenterPresentational
      mode={mode}
      query={query}
      selectedIndex={selectedIndex}
      activeCategory={activeCategory}
      filteredItems={filteredItems}
      isLoadingFiles={isLoadingFiles}
      showCategoryTabs={showCategoryTabs}
      contextLabel={contextLabel}
      inputRef={inputRef}
      listRef={listRef}
      onClose={onClose}
      onQueryChange={setQuery}
      onInputKeyDown={handleInputKeyDown}
      onSelectResult={handleSelect}
      onHoverResult={setSelectedIndex}
      onCategoryChange={setActiveCategory}
    />
  );
}

export default CommandCenterContainer;
