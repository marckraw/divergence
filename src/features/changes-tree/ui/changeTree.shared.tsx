import type { CSSProperties, ReactNode } from "react";
import { Button, getFileBadgeInfo, type ChangesTreeNode, type GitChangeEntry, type GitChangeStatus } from "../../../shared";

export const STATUS_STYLES: Record<
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
  "inline-flex h-4 min-w-[22px] items-center justify-center rounded px-1 text-[9px] font-semibold tracking-wide";

export function buildTreeNodePaddingStyle(depth: number): CSSProperties {
  return { paddingLeft: `${depth * 12 + 8}px` };
}

export function countTreeFiles(nodes: ChangesTreeNode<GitChangeEntry>[]): number {
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

export function FolderChevron({ expanded }: { expanded: boolean }) {
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

export function FolderIcon() {
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

export function ChangeFileBadge({ name }: { name: string }) {
  const badge = getFileBadgeInfo(name);
  return (
    <span className={`${FILE_BADGE_BASE_CLASS} ${badge.className}`} aria-hidden="true">
      {badge.label}
    </span>
  );
}

export function ChangeStatusBadge({ status }: { status: GitChangeStatus }) {
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES["?"];
  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle.className} ${statusStyle.textClassName}`}
    >
      {statusStyle.label}
    </span>
  );
}

interface ChangeTreeFolderRowProps {
  name: string;
  path: string;
  depth: number;
  expanded: boolean;
  onToggle: (path: string) => void;
}

export function ChangeTreeFolderRow({
  name,
  path,
  depth,
  expanded,
  onToggle,
}: ChangeTreeFolderRowProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="w-full !justify-start gap-2 rounded px-2 py-1 text-left text-xs text-subtext hover:bg-surface/60 hover:text-text"
      style={buildTreeNodePaddingStyle(depth)}
      onClick={() => onToggle(path)}
    >
      <FolderChevron expanded={expanded} />
      <FolderIcon />
      <span className="truncate">{name}</span>
    </Button>
  );
}

interface ChangeTreeFileRowProps {
  node: Extract<ChangesTreeNode<GitChangeEntry>, { kind: "file" }>;
  depth: number;
  isActive?: boolean;
  interactive?: boolean;
  onSelect?: (entry: GitChangeEntry) => void;
  secondaryContent?: ReactNode;
}

export function ChangeTreeFileRow({
  node,
  depth,
  isActive = false,
  interactive = false,
  onSelect,
  secondaryContent,
}: ChangeTreeFileRowProps) {
  const renamed = Boolean(node.entry.old_path && node.entry.old_path !== node.entry.path);
  const body = (
    <>
      <ChangeStatusBadge status={node.entry.status} />
      <ChangeFileBadge name={node.name} />
      <div className="min-w-0 flex-1">
        <div className={interactive ? "truncate text-xs" : "truncate text-text"}>{node.name}</div>
        {renamed ? (
          <div className="truncate text-[10px] text-subtext/70">
            {node.entry.old_path} → {node.entry.path}
          </div>
        ) : null}
        {secondaryContent}
      </div>
    </>
  );

  if (interactive) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={`w-full !justify-start gap-2 rounded px-2 py-1.5 text-left ${
          isActive ? "bg-surface text-text" : "text-subtext hover:bg-surface/60 hover:text-text"
        }`}
        style={buildTreeNodePaddingStyle(depth)}
        onClick={() => onSelect?.(node.entry)}
        title={node.path}
      >
        {body}
      </Button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded px-2 py-1 text-xs text-subtext"
      style={buildTreeNodePaddingStyle(depth)}
      title={node.path}
    >
      {body}
    </div>
  );
}

interface ChangeTreeNodeListProps {
  nodes: ChangesTreeNode<GitChangeEntry>[];
  expandedPaths: Set<string>;
  onToggleFolder: (path: string) => void;
  depth?: number;
  activePath?: string | null;
  onOpenChange?: (entry: GitChangeEntry) => void;
  interactiveFiles?: boolean;
}

export function ChangeTreeNodeList({
  nodes,
  expandedPaths,
  onToggleFolder,
  depth = 0,
  activePath = null,
  onOpenChange,
  interactiveFiles = false,
}: ChangeTreeNodeListProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        if (node.kind === "folder") {
          const isExpanded = expandedPaths.has(node.path);
          return (
            <div key={node.path}>
              <ChangeTreeFolderRow
                name={node.name}
                path={node.path}
                depth={depth}
                expanded={isExpanded}
                onToggle={onToggleFolder}
              />
              {isExpanded ? (
                <ChangeTreeNodeList
                  nodes={node.children}
                  expandedPaths={expandedPaths}
                  onToggleFolder={onToggleFolder}
                  depth={depth + 1}
                  activePath={activePath}
                  onOpenChange={onOpenChange}
                  interactiveFiles={interactiveFiles}
                />
              ) : null}
            </div>
          );
        }

        return (
          <ChangeTreeFileRow
            key={`${node.path}-${node.entry.status}`}
            node={node}
            depth={depth}
            isActive={activePath === node.path}
            interactive={interactiveFiles}
            onSelect={onOpenChange}
          />
        );
      })}
    </div>
  );
}
