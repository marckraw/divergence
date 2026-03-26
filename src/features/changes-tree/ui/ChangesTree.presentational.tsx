import {
  EmptyState,
  ErrorBanner,
  FilterHeader,
  LoadingSpinner,
  SegmentedControl,
  ToolbarButton,
  type ChangesMode,
  type ChangesTreeNode,
  type GitChangeEntry,
} from "../../../shared";
import { ChangeTreeNodeList } from "./changeTree.shared";

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
  if (!rootName) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-subtext">
        Select a project to see changes.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-sidebar/40">
      <FilterHeader
        title={rootName}
        description={<span className="text-[10px] uppercase tracking-[0.18em] text-subtext">Changes</span>}
        actions={
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
        }
        toolbar={(
          <SegmentedControl
            items={[
              { id: "working", label: "Working" },
              { id: "branch", label: "Branch" },
            ]}
            value={mode}
            onChange={(value) => onModeChange(value)}
          />
        )}
      />
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
            <ChangeTreeNodeList
              nodes={treeNodes}
              expandedPaths={expandedPaths}
              onToggleFolder={onToggleFolder}
              activePath={activePath}
              onOpenChange={onOpenChange}
              interactiveFiles
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ChangesTreePresentational;
