import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button, FAST_EASE_OUT, SOFT_SPRING, getCollapseVariants, getPopVariants } from "../../../shared";
import { MenuButton, ToolbarButton } from "../../../shared";
import { readDir, remove } from "../../../shared/api/fs.api";
import {
  type FileEntry,
  getBaseName,
  getFileBadgeInfo,
  normalizeFileExplorerEntry,
  sortFileExplorerEntries,
} from "../lib/fileExplorer.pure";
import FileExplorerPresentational from "./FileExplorer.presentational";

interface FileExplorerProps {
  rootPath: string | null;
  activeFilePath?: string | null;
  onOpenFile: (path: string) => void;
  onRemoveFile: (path: string) => void;
}

const LARGE_ENTRY_LIMIT = 1000;
const MOTION_ENTRY_LIMIT = 200;
const BADGE_BASE_CLASS =
  "inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[9px] font-semibold tracking-wide";

interface FileExplorerContextMenuState {
  entry: FileEntry;
  parentPath: string;
  x: number;
  y: number;
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message);
  }
  return fallback;
}

const FileBadge = ({ name }: { name: string }) => {
  const badge = getFileBadgeInfo(name);
  return (
    <span className={`${BADGE_BASE_CLASS} ${badge.className}`} aria-hidden="true">
      {badge.label}
    </span>
  );
};

const FolderIcon = () => (
  <svg className="w-3.5 h-3.5 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

function FileExplorer({ rootPath, activeFilePath, onOpenFile, onRemoveFile }: FileExplorerProps) {
  const [entriesByPath, setEntriesByPath] = useState<Map<string, FileEntry[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [errorsByPath, setErrorsByPath] = useState<Map<string, string>>(new Map());
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FileExplorerContextMenuState | null>(null);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const collapseVariants = useMemo(
    () => getCollapseVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const contextMenuVariants = useMemo(
    () => getPopVariants(shouldReduceMotion, 8, 0.98),
    [shouldReduceMotion]
  );
  const layoutTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  const rootName = useMemo(() => (rootPath ? getBaseName(rootPath) : ""), [rootPath]);

  const loadDir = useCallback(async (path: string) => {
    setLoadingDirs(prev => new Set(prev).add(path));
    try {
      const rawEntries = await readDir(path);
      const entries = sortFileExplorerEntries(
        rawEntries.map(entry => normalizeFileExplorerEntry(path, entry)).slice(0, LARGE_ENTRY_LIMIT)
      );
      setEntriesByPath(prev => {
        const next = new Map(prev);
        next.set(path, entries);
        return next;
      });
      setErrorsByPath(prev => {
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
    } catch (err) {
      const message = toErrorMessage(err, "Failed to read directory.");
      setErrorsByPath(prev => new Map(prev).set(path, message));
    } finally {
      setLoadingDirs(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, []);

  const refreshRoot = useCallback(() => {
    if (!rootPath) {
      return;
    }
    setEntriesByPath(new Map());
    setExpandedDirs(new Set([rootPath]));
    setErrorsByPath(new Map());
    setContextMenu(null);
    setRemoveError(null);
    setRemovingPath(null);
    loadDir(rootPath);
  }, [loadDir, rootPath]);

  useEffect(() => {
    if (!rootPath) {
      setEntriesByPath(new Map());
      setExpandedDirs(new Set());
      setErrorsByPath(new Map());
      setContextMenu(null);
      setRemoveError(null);
      setRemovingPath(null);
      return;
    }
    setEntriesByPath(new Map());
    setExpandedDirs(new Set([rootPath]));
    setErrorsByPath(new Map());
    setContextMenu(null);
    setRemoveError(null);
    setRemovingPath(null);
    loadDir(rootPath);
  }, [loadDir, rootPath]);

  const toggleDir = useCallback((entry: FileEntry) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(entry.path)) {
        next.delete(entry.path);
      } else {
        next.add(entry.path);
      }
      return next;
    });
    if (!entriesByPath.has(entry.path)) {
      loadDir(entry.path);
    }
  }, [entriesByPath, loadDir]);

  const handleContextMenuOpen = useCallback((
    event: MouseEvent<HTMLButtonElement>,
    entry: FileEntry,
    parentPath: string
  ) => {
    event.preventDefault();

    if (entry.isDir) {
      setContextMenu(null);
      return;
    }

    setContextMenu({
      entry,
      parentPath,
      x: event.clientX,
      y: event.clientY,
    });
    setRemoveError(null);
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuRemoveFile = useCallback(async () => {
    if (!contextMenu || removingPath) {
      return;
    }

    const { entry, parentPath } = contextMenu;
    const confirmed = window.confirm(`Remove "${entry.name}"? This cannot be undone.`);
    if (!confirmed) {
      setContextMenu(null);
      return;
    }

    setRemoveError(null);
    setRemovingPath(entry.path);
    try {
      await remove(entry.path);
      onRemoveFile(entry.path);
      await loadDir(parentPath);
      setContextMenu(null);
    } catch (error) {
      setRemoveError(toErrorMessage(error, "Failed to remove file."));
    } finally {
      setRemovingPath(current => (current === entry.path ? null : current));
    }
  }, [contextMenu, loadDir, onRemoveFile, removingPath]);

  const renderEntries = (path: string, depth: number) => {
    const entries = entriesByPath.get(path) ?? [];
    const error = errorsByPath.get(path);
    const isLoading = loadingDirs.has(path);
    const enableMotion = !shouldReduceMotion && entries.length <= MOTION_ENTRY_LIMIT;

    return (
      <div className="space-y-0.5">
        {isLoading && entries.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-subtext/70 pl-2">
            <span className="spinner" />
            Loading...
          </div>
        )}
        {error && (
          <div className="text-xs text-red-300/90 pl-2">
            {error}
          </div>
        )}
        {enableMotion ? (
          <AnimatePresence initial={false}>
            {entries.map(entry => {
              const isExpanded = expandedDirs.has(entry.path);
              const isActive = activeFilePath === entry.path;
              return (
                <motion.div
                  key={entry.path}
                  layout="position"
                  transition={layoutTransition}
                >
                  <Button
                    type="button"
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-accent/20 text-text"
                        : "text-subtext hover:text-text hover:bg-surface/60"
                    }`}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={() => (entry.isDir ? toggleDir(entry) : onOpenFile(entry.path))}
                    onContextMenu={(event) => handleContextMenuOpen(event, entry, path)}
                    variant="ghost"
                    size="xs"
                  >
                    {entry.isDir ? (
                      <>
                        <svg className="w-3 h-3 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          {isExpanded ? (
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
                          ) : (
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                          )}
                        </svg>
                        <FolderIcon />
                      </>
                    ) : (
                      <FileBadge name={entry.name} />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </Button>
                  {entry.isDir && (
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          className="overflow-hidden"
                          variants={collapseVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={layoutTransition}
                        >
                          {renderEntries(entry.path, depth + 1)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          entries.map(entry => {
            const isExpanded = expandedDirs.has(entry.path);
            const isActive = activeFilePath === entry.path;
            return (
              <div key={entry.path}>
                <Button
                  type="button"
                  className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                    isActive
                      ? "bg-accent/20 text-text"
                      : "text-subtext hover:text-text hover:bg-surface/60"
                  }`}
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                  onClick={() => (entry.isDir ? toggleDir(entry) : onOpenFile(entry.path))}
                  onContextMenu={(event) => handleContextMenuOpen(event, entry, path)}
                  variant="ghost"
                  size="xs"
                >
                  {entry.isDir ? (
                    <>
                      <svg className="w-3 h-3 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        {isExpanded ? (
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
                        ) : (
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                        )}
                      </svg>
                      <FolderIcon />
                    </>
                  ) : (
                    <FileBadge name={entry.name} />
                  )}
                  <span className="truncate">{entry.name}</span>
                </Button>
                {entry.isDir && isExpanded && renderEntries(entry.path, depth + 1)}
              </div>
            );
          })
        )}
        {entries.length >= LARGE_ENTRY_LIMIT && (
          <div className="text-[10px] text-subtext/70 pl-2">
            Showing first {LARGE_ENTRY_LIMIT} items.
          </div>
        )}
      </div>
    );
  };

  if (!rootPath) {
    return (
      <FileExplorerPresentational>
        <div className="p-4 text-xs text-subtext">
          Select a session to browse files.
        </div>
      </FileExplorerPresentational>
    );
  }

  return (
    <FileExplorerPresentational>
      <div className="h-full flex flex-col" onClick={handleContextMenuClose}>
        <div className="px-4 py-3 border-b border-surface flex items-center justify-between">
          <div>
            <p className="text-xs text-subtext/70">Project Files</p>
            <p className="text-sm text-text truncate">{rootName}</p>
            <p className="text-[10px] text-subtext/60 truncate">{rootPath}</p>
          </div>
          <ToolbarButton
            onClick={refreshRoot}
          >
            Refresh
          </ToolbarButton>
        </div>
        {removeError && (
          <div className="px-4 py-2 text-xs text-red border-b border-red/20 bg-red/5">
            {removeError}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2">
          {renderEntries(rootPath, 0)}
        </div>
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              className="fixed bg-surface border border-surface rounded-md shadow-lg py-1 z-50"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              variants={contextMenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={layoutTransition}
              onClick={(event) => event.stopPropagation()}
            >
              <MenuButton
                tone="danger"
                disabled={Boolean(removingPath)}
                onClick={() => {
                  void handleContextMenuRemoveFile();
                }}
              >
                {removingPath === contextMenu.entry.path ? "Removing..." : "Remove File"}
              </MenuButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FileExplorerPresentational>
  );
}

export default FileExplorer;
