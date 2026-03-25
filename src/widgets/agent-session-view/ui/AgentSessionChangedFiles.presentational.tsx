import { useState, type CSSProperties } from "react";
import {
  Button,
  getFileBadgeInfo,
  type ChangesTreeNode,
  type GitChangeEntry,
  type GitChangeStatus,
} from "../../../shared";

interface AgentSessionChangedFilesProps {
  treeNodes: ChangesTreeNode<GitChangeEntry>[];
  loading: boolean;
}

const STATUS_STYLES: Record<
  GitChangeStatus,
  { label: string; className: string; textClassName: string }
> = {
  A: { label: "A", className: "bg-green/20", textClassName: "text-green" },
  M: { label: "M", className: "bg-yellow/20", textClassName: "text-yellow" },
  D: { label: "D", className: "bg-red/20", textClassName: "text-red" },
  R: { label: "R", className: "bg-accent/20", textClassName: "text-accent" },
  C: { label: "C", className: "bg-accent/20", textClassName: "text-accent" },
  U: { label: "U", className: "bg-red/20", textClassName: "text-red" },
  "?": { label: "?", className: "bg-surface", textClassName: "text-subtext" },
};

const FILE_BADGE_BASE_CLASS =
  "inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[9px] font-semibold tracking-wide";

function FolderChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg className="h-3 w-3 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      {expanded ? (
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
      ) : (
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
      )}
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function FileBadge({ name }: { name: string }) {
  const badge = getFileBadgeInfo(name);
  return (
    <span className={`${FILE_BADGE_BASE_CLASS} ${badge.className}`} aria-hidden="true">
      {badge.label}
    </span>
  );
}

function countTreeFiles(nodes: ChangesTreeNode<GitChangeEntry>[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "file") {
      count += 1;
    } else {
      count += countTreeFiles(node.children);
    }
  }
  return count;
}

function ChangedFileNode({
  node,
  depth,
  expandedPaths,
  onToggleFolder,
}: {
  node: ChangesTreeNode<GitChangeEntry>;
  depth: number;
  expandedPaths: Set<string>;
  onToggleFolder: (path: string) => void;
}) {
  const paddingStyle: CSSProperties = { paddingLeft: `${depth * 12 + 8}px` };

  if (node.kind === "folder") {
    const isExpanded = expandedPaths.has(node.path);

    return (
      <div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="w-full !justify-start gap-2 rounded px-2 py-1 text-left text-xs text-subtext hover:bg-surface/50 hover:text-text"
          style={paddingStyle}
          onClick={() => onToggleFolder(node.path)}
        >
          <FolderChevron expanded={isExpanded} />
          <FolderIcon />
          <span className="truncate">{node.name}</span>
        </Button>
        {isExpanded && (
          <div className="space-y-0.5">
            {node.children.map((child) => (
              <ChangedFileNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[node.entry.status] ?? STATUS_STYLES["?"];
  const renamed = Boolean(node.entry.old_path && node.entry.old_path !== node.entry.path);

  return (
    <div
      className="flex items-center gap-2 rounded px-2 py-1 text-xs text-subtext"
      style={paddingStyle}
      title={node.path}
    >
      <span
        className={`inline-flex min-w-[18px] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle.className} ${statusStyle.textClassName}`}
      >
        {statusStyle.label}
      </span>
      <FileBadge name={node.name} />
      <div className="min-w-0 flex-1">
        <span className="truncate text-text">{node.name}</span>
        {renamed && (
          <div className="truncate text-[10px] text-subtext/70">
            {node.entry.old_path} → {node.entry.path}
          </div>
        )}
      </div>
    </div>
  );
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
            <div className="space-y-0.5">
              {treeNodes.map((node) => (
                <ChangedFileNode
                  key={node.path}
                  node={node}
                  depth={0}
                  expandedPaths={expandedPaths}
                  onToggleFolder={handleToggleFolder}
                />
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export default AgentSessionChangedFilesPresentational;
