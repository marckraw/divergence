import type { CSSProperties } from "react";
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
  SegmentedControl,
  ToolbarButton,
  getFileBadgeInfo,
  type ChangesMode,
  type ChangesTreeNode,
  type GitChangeEntry,
  type GitChangeStatus,
} from "../../../shared";

interface ChangesTreePresentationalProps {
  rootName: string | null;
  treeNodes: ChangesTreeNode<GitChangeEntry>[];
  expandedPaths: Set<string>;
  loading: boolean;
  error: string | null;
  baseRef: string | null;
  mode: ChangesMode;
  activePath: string | null;
  onToggleFolder: (path: string) => void;
  onOpenChange: (entry: GitChangeEntry) => void;
  onModeChange: (mode: ChangesMode) => void;
  onRefresh: () => void;
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

function ChangesTreePresentational({
  rootName,
  treeNodes,
  expandedPaths,
  loading,
  error,
  baseRef,
  mode,
  activePath,
  onToggleFolder,
  onOpenChange,
  onModeChange,
  onRefresh,
}: ChangesTreePresentationalProps) {
  const renderNode = (node: ChangesTreeNode<GitChangeEntry>, depth: number): JSX.Element => {
    const paddingStyle: CSSProperties = { paddingLeft: `${depth * 12 + 8}px` };

    if (node.kind === "folder") {
      const isExpanded = expandedPaths.has(node.path);
      return (
        <div key={node.path}>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="w-full !justify-start gap-2 rounded px-2 py-1 text-left text-xs text-subtext hover:bg-surface/60 hover:text-text"
            style={paddingStyle}
            onClick={() => onToggleFolder(node.path)}
          >
            <FolderChevron expanded={isExpanded} />
            <FolderIcon />
            <span className="truncate">{node.name}</span>
          </Button>
          {isExpanded && (
            <div className="space-y-0.5">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const statusStyle = STATUS_STYLES[node.entry.status] ?? STATUS_STYLES["?"];
    const isActive = activePath === node.path;
    const renamed = Boolean(node.entry.old_path && node.entry.old_path !== node.entry.path);

    return (
      <Button
        key={`${node.path}-${node.entry.status}`}
        type="button"
        variant="ghost"
        size="xs"
        className={`w-full !justify-start gap-2 rounded px-2 py-1.5 text-left ${
          isActive ? "bg-surface text-text" : "text-subtext hover:bg-surface/60 hover:text-text"
        }`}
        style={paddingStyle}
        onClick={() => onOpenChange(node.entry)}
        title={node.path}
      >
        <span
          className={`inline-flex min-w-[18px] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle.className} ${statusStyle.textClassName}`}
        >
          {statusStyle.label}
        </span>
        <FileBadge name={node.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs">{node.name}</div>
          {renamed && (
            <div className="truncate text-[10px] text-subtext/70">
              {node.entry.old_path} → {node.entry.path}
            </div>
          )}
        </div>
      </Button>
    );
  };

  if (!rootName) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-subtext">
        Select a project to see changes.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-sidebar/40">
      <div className="border-b border-surface px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">Changes</p>
            <p className="truncate text-sm text-text">{rootName}</p>
          </div>
          <ToolbarButton
            onClick={onRefresh}
            disabled={loading}
            title={loading ? "Refreshing changes" : "Refresh changes"}
            iconOnly
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 005.3 5.3L4 10m16 4l-1.3 4.7A8 8 0 013 15"
              />
            </svg>
          </ToolbarButton>
        </div>
        <div className="mt-3">
          <SegmentedControl
            items={[
              { id: "working", label: "Working" },
              { id: "branch", label: "Branch" },
            ]}
            value={mode}
            onChange={(value) => onModeChange(value)}
          />
        </div>
      </div>
      {mode === "branch" && (
        <div className="border-b border-surface px-3 py-2">
          <span className="text-[10px] text-subtext">
            {baseRef ? (
              <>
                vs <span className="font-medium text-text">{baseRef}</span>
              </>
            ) : (
              "No base branch detected"
            )}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {loading && treeNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner>Loading changes...</LoadingSpinner>
          </div>
        ) : !error && treeNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState bordered className="w-full bg-main/20 px-2 text-xs">
              {mode === "branch" && !baseRef ? "No base branch detected." : "No changes yet."}
            </EmptyState>
          </div>
        ) : (
          <div className="space-y-1">
            {error && <ErrorBanner className="px-2">{error}</ErrorBanner>}
            {treeNodes.map((node) => renderNode(node, 0))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChangesTreePresentational;
