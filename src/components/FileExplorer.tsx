import { useCallback, useEffect, useMemo, useState } from "react";
import { readDir, type DirEntry } from "@tauri-apps/plugin-fs";

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

const LARGE_ENTRY_LIMIT = 1000;
const BADGE_BASE_CLASS =
  "inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[9px] font-semibold tracking-wide";

type BadgeInfo = {
  label: string;
  className: string;
};

const FILE_BADGE_BY_NAME: Record<string, BadgeInfo> = {
  "package.json": { label: "NPM", className: "bg-emerald-500/20 text-emerald-200" },
  "package-lock.json": { label: "LOCK", className: "bg-emerald-500/20 text-emerald-200" },
  "tsconfig.json": { label: "TS", className: "bg-blue-500/20 text-blue-200" },
  "vite.config.ts": { label: "VITE", className: "bg-purple-500/20 text-purple-200" },
  "readme.md": { label: "MD", className: "bg-sky-500/20 text-sky-200" },
  ".env": { label: "ENV", className: "bg-amber-500/20 text-amber-200" },
  ".gitignore": { label: "GIT", className: "bg-orange-500/20 text-orange-200" },
  "cargo.toml": { label: "TOML", className: "bg-orange-500/20 text-orange-200" },
  "cargo.lock": { label: "LOCK", className: "bg-orange-500/20 text-orange-200" },
};

const FILE_BADGE_BY_EXT: Record<string, BadgeInfo> = {
  ts: { label: "TS", className: "bg-blue-500/20 text-blue-200" },
  tsx: { label: "TSX", className: "bg-blue-500/20 text-blue-200" },
  js: { label: "JS", className: "bg-yellow-500/20 text-yellow-200" },
  jsx: { label: "JSX", className: "bg-yellow-500/20 text-yellow-200" },
  json: { label: "JSON", className: "bg-amber-500/20 text-amber-200" },
  md: { label: "MD", className: "bg-sky-500/20 text-sky-200" },
  mdx: { label: "MDX", className: "bg-sky-500/20 text-sky-200" },
  css: { label: "CSS", className: "bg-blue-400/20 text-blue-200" },
  scss: { label: "SCSS", className: "bg-pink-400/20 text-pink-200" },
  sass: { label: "SASS", className: "bg-pink-400/20 text-pink-200" },
  less: { label: "LESS", className: "bg-indigo-400/20 text-indigo-200" },
  html: { label: "HTML", className: "bg-orange-500/20 text-orange-200" },
  yml: { label: "YML", className: "bg-teal-500/20 text-teal-200" },
  yaml: { label: "YAML", className: "bg-teal-500/20 text-teal-200" },
  toml: { label: "TOML", className: "bg-orange-400/20 text-orange-200" },
  rs: { label: "RS", className: "bg-orange-400/20 text-orange-200" },
  py: { label: "PY", className: "bg-green-500/20 text-green-200" },
  sql: { label: "SQL", className: "bg-cyan-500/20 text-cyan-200" },
  sh: { label: "SH", className: "bg-lime-500/20 text-lime-200" },
  zsh: { label: "ZSH", className: "bg-lime-500/20 text-lime-200" },
  env: { label: "ENV", className: "bg-amber-500/20 text-amber-200" },
  lock: { label: "LOCK", className: "bg-slate-500/20 text-slate-200" },
  png: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  jpg: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  jpeg: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  gif: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  svg: { label: "SVG", className: "bg-pink-500/20 text-pink-200" },
  ico: { label: "ICO", className: "bg-pink-500/20 text-pink-200" },
};

const getBaseName = (path: string) => {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
};

const getBadgeInfo = (name: string): BadgeInfo => {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith(".env")) {
    return FILE_BADGE_BY_EXT.env;
  }
  const fromName = FILE_BADGE_BY_NAME[lowerName];
  if (fromName) {
    return fromName;
  }
  const ext = lowerName.includes(".") ? lowerName.split(".").pop() ?? "" : lowerName;
  const fromExt = ext ? FILE_BADGE_BY_EXT[ext] : undefined;
  if (fromExt) {
    return fromExt;
  }
  const label = ext ? ext.slice(0, 4).toUpperCase() : "FILE";
  return { label, className: "bg-surface text-subtext" };
};

const FileBadge = ({ name }: { name: string }) => {
  const badge = getBadgeInfo(name);
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

const joinPath = (parent: string, name: string) => {
  const cleanName = name.replace(/^[/\\]+/, "");
  if (parent.endsWith("/") || parent.endsWith("\\")) {
    return `${parent}${cleanName}`;
  }
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent}${separator}${cleanName}`;
};

const normalizeEntry = (parentPath: string, entry: DirEntry): FileEntry => {
  const name = entry.name ?? getBaseName(parentPath);
  return {
    path: joinPath(parentPath, name),
    name,
    isDir: Boolean(entry.isDirectory),
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
      const rawEntries = await readDir(path);
      const entries = sortEntries(
        rawEntries.map(entry => normalizeEntry(path, entry)).slice(0, LARGE_ENTRY_LIMIT)
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
