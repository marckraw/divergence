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

  const refresh = useCallback(async () => {
    if (!rootPath) {
      setChanges([]);
      setError(null);
      setBaseRef(null);
      return;
    }

    try {
      setLoading(true);
      if (mode === "branch") {
        const result = await listBranchChanges(rootPath);
        setChanges(sortGitChangesByPath(result.changes));
        setBaseRef(result.base_ref);
      } else {
        const result = await listGitChanges(rootPath);
        setChanges(sortGitChangesByPath(result));
        setBaseRef(null);
      }
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
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  useEffect(() => {
    if (!pollWhileActive || !rootPath) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [pollWhileActive, refresh, rootPath]);

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
