import { useMemo } from "react";
import {
  getBaseName,
  getRelativePathFromRoot,
  normalizeGitChangePath,
  type ChangesMode,
  type GitChangeEntry,
} from "../../../shared";
import { useChangesTree } from "../model/useChangesTree";
import ChangesTreePresentational from "./ChangesTree.presentational";

interface ChangesTreeProps {
  rootPath: string | null;
  activeFilePath?: string | null;
  pollWhileActive?: boolean;
  onOpenChange: (entry: GitChangeEntry, mode: ChangesMode) => void;
}

function ChangesTree({
  rootPath,
  activeFilePath = null,
  pollWhileActive = false,
  onOpenChange,
}: ChangesTreeProps) {
  const {
    treeNodes,
    loading,
    error,
    baseRef,
    expandedPaths,
    mode,
    setMode,
    toggleFolder,
    refresh,
  } = useChangesTree({
    rootPath,
    pollWhileActive,
  });

  const rootName = useMemo(() => (rootPath ? getBaseName(rootPath) : null), [rootPath]);
  const activePath = useMemo(() => {
    if (!rootPath || !activeFilePath) {
      return null;
    }
    const relativePath = getRelativePathFromRoot(rootPath, activeFilePath);
    return relativePath ? normalizeGitChangePath(relativePath) : null;
  }, [activeFilePath, rootPath]);

  return (
    <ChangesTreePresentational
      rootName={rootName}
      treeNodes={treeNodes}
      expandedPaths={expandedPaths}
      loading={loading}
      error={error}
      baseRef={baseRef}
      mode={mode}
      activePath={activePath}
      onToggleFolder={toggleFolder}
      onOpenChange={(entry) => onOpenChange(entry, mode)}
      onModeChange={setMode}
      onRefresh={() => { void refresh(); }}
    />
  );
}

export default ChangesTree;
