import { useCallback, useEffect, useMemo, useState } from "react";
import { readDir } from "@tauri-apps/plugin-fs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FAST_EASE_OUT, SOFT_SPRING, getCollapseVariants } from "../../../lib/motion";
import { ToolbarButton } from "../../../shared/ui";
import {
  type FileEntry,
  getBaseName,
  getFileBadgeInfo,
  normalizeFileExplorerEntry,
  sortFileExplorerEntries,
} from "../../../lib/utils/fileExplorer";

interface FileExplorerProps {
  rootPath: string | null;
  activeFilePath?: string | null;
  onOpenFile: (path: string) => void;
}

const LARGE_ENTRY_LIMIT = 1000;
const MOTION_ENTRY_LIMIT = 200;
const BADGE_BASE_CLASS =
  "inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[9px] font-semibold tracking-wide";

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

function FileExplorer({ rootPath, activeFilePath, onOpenFile }: FileExplorerProps) {
  const [entriesByPath, setEntriesByPath] = useState<Map<string, FileEntry[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [errorsByPath, setErrorsByPath] = useState<Map<string, string>>(new Map());
  const shouldReduceMotion = useReducedMotion();
  const collapseVariants = useMemo(
    () => getCollapseVariants(shouldReduceMotion),
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
      const message = err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : (err && typeof err === "object" && "message" in err)
            ? String((err as { message?: unknown }).message)
            : "Failed to read directory.";
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
    loadDir(rootPath);
  }, [loadDir, rootPath]);

  useEffect(() => {
    if (!rootPath) {
      setEntriesByPath(new Map());
      setExpandedDirs(new Set());
      setErrorsByPath(new Map());
      return;
    }
    setEntriesByPath(new Map());
    setExpandedDirs(new Set([rootPath]));
    setErrorsByPath(new Map());
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
                  <button
                    type="button"
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-accent/20 text-text"
                        : "text-subtext hover:text-text hover:bg-surface/60"
                    }`}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={() => (entry.isDir ? toggleDir(entry) : onOpenFile(entry.path))}
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
                  </button>
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
                <button
                  type="button"
                  className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                    isActive
                      ? "bg-accent/20 text-text"
                      : "text-subtext hover:text-text hover:bg-surface/60"
                  }`}
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                  onClick={() => (entry.isDir ? toggleDir(entry) : onOpenFile(entry.path))}
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
                </button>
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
      <div className="p-4 text-xs text-subtext">
        Select a session to browse files.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
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
      <div className="flex-1 overflow-y-auto p-2">
        {renderEntries(rootPath, 0)}
      </div>
    </div>
  );
}

export default FileExplorer;
