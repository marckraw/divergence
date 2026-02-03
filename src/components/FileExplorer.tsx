import { useCallback, useEffect, useMemo, useState } from "react";
import { readDir } from "@tauri-apps/plugin-fs";

interface FileExplorerProps {
  rootPath: string | null;
  activeFilePath?: string | null;
  onOpenFile: (path: string) => void;
}

interface FileEntry {
  path: string;
  name: string;
  isDir: boolean;
}

type DirEntryLike = {
  path: string;
  name?: string;
  children?: DirEntryLike[];
  isDirectory?: boolean;
  isFile?: boolean;
  isDir?: boolean;
};

const LARGE_ENTRY_LIMIT = 1000;

const getBaseName = (path: string) => {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
};

const normalizeEntry = (entry: DirEntryLike): FileEntry => {
  const isDir = Boolean(entry.isDirectory ?? entry.isDir ?? (entry.isFile === false) ?? entry.children);
  return {
    path: entry.path,
    name: entry.name ?? getBaseName(entry.path),
    isDir,
  };
};

const sortEntries = (entries: FileEntry[]) =>
  [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

function FileExplorer({ rootPath, activeFilePath, onOpenFile }: FileExplorerProps) {
  const [entriesByPath, setEntriesByPath] = useState<Map<string, FileEntry[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [errorsByPath, setErrorsByPath] = useState<Map<string, string>>(new Map());

  const rootName = useMemo(() => (rootPath ? getBaseName(rootPath) : ""), [rootPath]);

  const loadDir = useCallback(async (path: string) => {
    setLoadingDirs(prev => new Set(prev).add(path));
    try {
      const rawEntries = await readDir(path, { recursive: false });
      const entries = sortEntries(
        (rawEntries as DirEntryLike[]).map(normalizeEntry).slice(0, LARGE_ENTRY_LIMIT)
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
      const message = err instanceof Error ? err.message : "Failed to read directory.";
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
        {entries.map(entry => {
          const isExpanded = expandedDirs.has(entry.path);
          const isActive = activeFilePath === entry.path;
          return (
            <div key={entry.path}>
              <button
                type="button"
                className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs ${
                  isActive
                    ? "bg-accent/20 text-text"
                    : "text-subtext hover:text-text hover:bg-surface/60"
                }`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => (entry.isDir ? toggleDir(entry) : onOpenFile(entry.path))}
              >
                {entry.isDir ? (
                  <svg className="w-3 h-3 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {isExpanded ? (
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
                    ) : (
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                    )}
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
                  </svg>
                )}
                <span className="truncate">{entry.name}</span>
              </button>
              {entry.isDir && isExpanded && renderEntries(entry.path, depth + 1)}
            </div>
          );
        })}
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
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50"
          onClick={refreshRoot}
        >
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {renderEntries(rootPath, 0)}
      </div>
    </div>
  );
}

export default FileExplorer;
