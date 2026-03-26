import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildChangesTree,
  collectChangesTreeFolderPaths,
  listBranchChanges,
  listGitChanges,
  sortGitChangesByPath,
  type ChangesMode,
  type ChangesTreeNode,
  type GitChangeEntry,
} from "../../../shared";

interface UseChangesTreeParams {
  rootPath: string | null;
  initialMode?: ChangesMode;
  pollWhileActive?: boolean;
}

interface UseChangesTreeResult {
  treeNodes: ChangesTreeNode<GitChangeEntry>[];
  loading: boolean;
  error: string | null;
  baseRef: string | null;
  expandedPaths: Set<string>;
  mode: ChangesMode;
  setMode: (mode: ChangesMode) => void;
  toggleFolder: (path: string) => void;
  refresh: () => Promise<void>;
}

interface ChangesTreeCacheEntry {
  changes: GitChangeEntry[];
  baseRef: string | null;
}

const changesTreeResultCache = new Map<string, ChangesTreeCacheEntry>();
const changesTreeInFlightRequests = new Map<string, Promise<ChangesTreeCacheEntry>>();

function getChangesTreeCacheKey(rootPath: string, mode: ChangesMode): string {
  return `${mode}:${rootPath}`;
}

async function fetchChangesTreeEntry(rootPath: string, mode: ChangesMode): Promise<ChangesTreeCacheEntry> {
  const cacheKey = getChangesTreeCacheKey(rootPath, mode);
  const pending = changesTreeInFlightRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    if (mode === "branch") {
      const result = await listBranchChanges(rootPath);
      const entry = {
        changes: sortGitChangesByPath(result.changes),
        baseRef: result.base_ref,
      };
      changesTreeResultCache.set(cacheKey, entry);
      return entry;
    }

    const result = await listGitChanges(rootPath);
    const entry = {
      changes: sortGitChangesByPath(result),
      baseRef: null,
    };
    changesTreeResultCache.set(cacheKey, entry);
    return entry;
  })().finally(() => {
    changesTreeInFlightRequests.delete(cacheKey);
  });

  changesTreeInFlightRequests.set(cacheKey, request);
  return request;
}

export function useChangesTree({
  rootPath,
  initialMode = "working",
  pollWhileActive = false,
}: UseChangesTreeParams): UseChangesTreeResult {
  const [mode, setMode] = useState<ChangesMode>(initialMode);
  const [changes, setChanges] = useState<GitChangeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseRef, setBaseRef] = useState<string | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const treeNodes = useMemo(() => buildChangesTree(changes), [changes]);
  const expandedPaths = useMemo(() => {
    const folderPaths = collectChangesTreeFolderPaths(treeNodes);
    return new Set(folderPaths.filter((path) => !collapsedPaths.has(path)));
  }, [collapsedPaths, treeNodes]);
  const isLoadingCurrentKey = rootPath
    ? changesTreeInFlightRequests.has(getChangesTreeCacheKey(rootPath, mode))
    : false;

  const refresh = useCallback(async () => {
    if (!rootPath) {
      setChanges([]);
      setError(null);
      setBaseRef(null);
      return;
    }

    const cacheKey = getChangesTreeCacheKey(rootPath, mode);
    const cached = changesTreeResultCache.get(cacheKey);
    if (cached) {
      setChanges(cached.changes);
      setBaseRef(cached.baseRef);
      setError(null);
    }

    try {
      setLoading(true);
      const result = await fetchChangesTreeEntry(rootPath, mode);
      setChanges(result.changes);
      setBaseRef(result.baseRef);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load changes.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [mode, rootPath]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setCollapsedPaths(new Set());
  }, [rootPath]);

  useEffect(() => {
    const handleFocus = () => {
      if (isLoadingCurrentKey) {
        return;
      }
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isLoadingCurrentKey, refresh]);

  useEffect(() => {
    if (!pollWhileActive || !rootPath) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (changesTreeInFlightRequests.has(getChangesTreeCacheKey(rootPath, mode))) {
        return;
      }
      void refresh();
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [mode, pollWhileActive, refresh, rootPath]);

  return {
    treeNodes,
    loading,
    error,
    baseRef,
    expandedPaths,
    mode,
    setMode,
    toggleFolder,
    refresh,
  };
}
