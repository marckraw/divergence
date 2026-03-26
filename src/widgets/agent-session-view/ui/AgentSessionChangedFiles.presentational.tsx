import { useState } from "react";
import { type ChangesTreeNode, type GitChangeEntry } from "../../../shared";
import { ChangeTreeNodeList, countTreeFiles } from "../../../features/changes-tree";

interface AgentSessionChangedFilesProps {
  treeNodes: ChangesTreeNode<GitChangeEntry>[];
  loading: boolean;
}

function AgentSessionChangedFilesPresentational({
  treeNodes,
  loading,
}: AgentSessionChangedFilesProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const fileCount = countTreeFiles(treeNodes);

  const handleToggleFolder = (path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (fileCount === 0 && !loading) {
    return null;
  }

  return (
    <div className="mx-auto mt-3 w-full max-w-5xl rounded-2xl border border-surface/80 bg-main/35 px-4 py-3">
      <details>
        <summary className="cursor-pointer list-none text-xs text-subtext transition-colors hover:text-text">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
              Changed Files
            </span>
            <span>
              {loading && fileCount === 0
                ? "Loading..."
                : `${fileCount} file${fileCount === 1 ? "" : "s"} changed in the working directory`}
            </span>
          </span>
        </summary>
          <div className="mt-3 space-y-0.5">
            <div className="max-h-80 overflow-y-auto pr-1">
              <ChangeTreeNodeList
                nodes={treeNodes}
                expandedPaths={expandedPaths}
                onToggleFolder={handleToggleFolder}
              />
            </div>
          </div>
        </details>
    </div>
  );
}

export default AgentSessionChangedFilesPresentational;
