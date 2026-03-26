import type { ReactNode } from "react";
import {
  Button,
  EmptyState,
  ErrorBanner,
  PanelHeader,
  PanelToolbar,
  LoadingSpinner,
  SearchField,
} from "../../../shared";
import {
  formatRelativeTime,
  getDiffTreeRowToneClass,
  getChecksToneClass,
  getGithubFileStatusToneClass,
  hasGithubMergeConflicts,
} from "../lib/githubPrHub.pure";
import { buildGithubPrDiffTreeRows } from "../lib/githubPrDiffTree.pure";
import type {
  GithubPrProjectTarget,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestMergeMethod,
  GithubPullRequestSummary,
} from "../model/githubPrHub.types";
import PrFileDiffViewerPresentational from "./PrFileDiffViewer.presentational";

interface GithubPrHubPresentationalProps {
  projectTargets: GithubPrProjectTarget[];
  pullRequests: GithubPullRequestSummary[];
  totalPullRequests: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  infoMessage: string | null;
  selectedProjectFilter: "all" | number;
  searchQuery: string;
  selectedPullRequest: GithubPullRequestSummary | null;
  detail: GithubPullRequestDetail | null;
  detailFiles: GithubPullRequestFile[];
  detailLoading: boolean;
  detailError: string | null;
  selectedFilePath: string | null;
  mergeMethod: GithubPullRequestMergeMethod;
  merging: boolean;
  openingReviewDivergence: boolean;
  reviewDivergenceError: string | null;
  openingConflictResolutionDivergence: boolean;
  conflictResolutionError: string | null;
  isChatOpen: boolean;
  chatSidebar: ReactNode;
  onSelectProjectFilter: (value: "all" | number) => void;
  onSearchQueryChange: (value: string) => void;
  onRefresh: () => Promise<void>;
  onOpenPullRequest: (pullRequest: GithubPullRequestSummary) => Promise<void>;
  onBackToBoard: () => void;
  onOpenGithubUrl: (url: string) => void;
  onToggleChat: () => void;
  onSelectFilePath: (path: string | null) => void;
  onMergeMethodChange: (method: GithubPullRequestMergeMethod) => void;
  onMerge: () => Promise<boolean>;
  onOpenReviewDivergence: () => Promise<void>;
  onOpenConflictResolutionDivergence: () => Promise<void>;
}

function renderProjectFilterOptions(targets: GithubPrProjectTarget[]) {
  const projectById = new Map<number, string>();
  targets.forEach((target) => {
    if (!projectById.has(target.projectId)) {
      projectById.set(target.projectId, target.projectName);
    }
  });

  return Array.from(projectById.entries())
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([projectId, projectName]) => ({ projectId, projectName }));
}

function GithubPrHubPresentational({
  projectTargets,
  pullRequests,
  totalPullRequests,
  loading,
  refreshing,
  error,
  infoMessage,
  selectedProjectFilter,
  searchQuery,
  selectedPullRequest,
  detail,
  detailFiles,
  detailLoading,
  detailError,
  selectedFilePath,
  mergeMethod,
  merging,
  openingReviewDivergence,
  reviewDivergenceError,
  openingConflictResolutionDivergence,
  conflictResolutionError,
  isChatOpen,
  chatSidebar,
  onSelectProjectFilter,
  onSearchQueryChange,
  onRefresh,
  onOpenPullRequest,
  onBackToBoard,
  onOpenGithubUrl,
  onToggleChat,
  onSelectFilePath,
  onMergeMethodChange,
  onMerge,
  onOpenReviewDivergence,
  onOpenConflictResolutionDivergence,
}: GithubPrHubPresentationalProps) {
  const isDetailView = selectedPullRequest !== null;
  const projectOptions = renderProjectFilterOptions(projectTargets);
  const selectedFile = detailFiles.find((file) => file.filename === selectedFilePath) ?? detailFiles[0] ?? null;
  const diffTreeRows = buildGithubPrDiffTreeRows(detailFiles);

  if (!isDetailView) {
    return (
      <div className="h-full flex flex-col bg-main">
        <PanelHeader
          title="Pull Requests"
          description="Open pull requests across configured projects."
          actions={(
            <Button
              type="button"
              onClick={() => { void onRefresh(); }}
              variant="secondary"
              size="sm"
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          )}
        />

        <PanelToolbar className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
            <label className="text-xs text-subtext flex flex-col gap-1">
              Project
              <select
                className="h-9 rounded border border-surface bg-main px-2 text-sm text-text"
                value={selectedProjectFilter === "all" ? "all" : String(selectedProjectFilter)}
                onChange={(event) => {
                  const value = event.target.value;
                  onSelectProjectFilter(value === "all" ? "all" : Number(value));
                }}
              >
                <option value="all">All projects</option>
                {projectOptions.map((option) => (
                  <option key={option.projectId} value={option.projectId}>
                    {option.projectName}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-subtext flex flex-col gap-1">
              Search
              <SearchField
                value={searchQuery}
                onChange={onSearchQueryChange}
                onClear={searchQuery ? () => onSearchQueryChange("") : undefined}
                placeholder="Search by repo, #number, title, author, base/head..."
              />
            </label>
        </PanelToolbar>

        <PanelToolbar className="py-2 text-xs text-subtext">
          <span>{pullRequests.length} of {totalPullRequests} pull requests</span>
        </PanelToolbar>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {error && <ErrorBanner className="mb-3">{error}</ErrorBanner>}
          {infoMessage && (
            <div className="mb-3 px-3 py-2 rounded border border-surface bg-sidebar text-xs text-subtext">
              {infoMessage}
            </div>
          )}

          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-subtext">
              <LoadingSpinner>Loading pull requests...</LoadingSpinner>
            </div>
          ) : pullRequests.length === 0 ? (
            <EmptyState bordered className="bg-sidebar">
              No pull requests available.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {pullRequests.map((pullRequest) => {
                const hasConflicts = hasGithubMergeConflicts(
                  pullRequest.mergeable,
                  pullRequest.mergeableState,
                );

                return (
                  <Button
                    key={`${pullRequest.repoKey}#${pullRequest.number}`}
                    type="button"
                    onClick={() => { void onOpenPullRequest(pullRequest); }}
                    variant="ghost"
                    size="sm"
                    className="aspect-square h-auto p-3 border border-surface rounded-md bg-sidebar/70 hover:bg-sidebar text-left flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-subtext">
                      <span className="truncate">{pullRequest.repoKey}</span>
                      <span>#{pullRequest.number}</span>
                    </div>

                    <p className="text-sm font-medium text-text line-clamp-3">{pullRequest.title}</p>

                    <div className="text-xs text-subtext line-clamp-1">
                      {pullRequest.userLogin ? `@${pullRequest.userLogin}` : "unknown author"}
                    </div>

                    <div className="text-[11px] text-subtext line-clamp-1">
                      {pullRequest.baseRef || "base"} ← {pullRequest.headRef || "head"}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-subtext">{formatRelativeTime(pullRequest.updatedAtMs)}</span>
                      <div className="flex items-center gap-1">
                        {hasConflicts && (
                          <span className="px-1.5 py-0.5 rounded border border-red/30 bg-red/10 text-red">
                            conflicts
                          </span>
                        )}
                        {pullRequest.draft && (
                          <span className="px-1.5 py-0.5 rounded border border-surface text-subtext">draft</span>
                        )}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const canMerge = Boolean(
    detail
    && detail.state.toLowerCase() === "open"
    && detail.mergeable === true
    && !detail.draft,
  );
  const detailHasConflicts = hasGithubMergeConflicts(
    detail?.mergeable ?? null,
    detail?.mergeableState ?? null,
  );
  const mergeDisabledReason = !detail
    ? "PR details are loading."
    : detail.state.toLowerCase() !== "open"
      ? "Only open pull requests can be merged."
      : detail.draft
        ? "Draft pull requests cannot be merged."
        : detailHasConflicts
          ? "This PR has merge conflicts that must be resolved before merging."
          : detail.mergeable === false
          ? `GitHub reports this PR is not mergeable (${detail.mergeableState ?? "unknown"}).`
          : null;

  return (
    <div className="h-full flex flex-col bg-main">
      <div className="px-5 py-4 border-b border-surface space-y-3">
        <div className="text-xs text-subtext flex items-center gap-2">
          <Button type="button" variant="ghost" size="xs" onClick={onBackToBoard} className="px-0 text-subtext hover:text-text">
            Work
          </Button>
          <span>/</span>
          <Button type="button" variant="ghost" size="xs" onClick={onBackToBoard} className="px-0 text-subtext hover:text-text">
            Pull Requests
          </Button>
          <span>/</span>
          <span className="text-text truncate">
            {selectedPullRequest.repoKey} #{selectedPullRequest.number}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text truncate">
              #{selectedPullRequest.number} {selectedPullRequest.title}
            </h2>
            <p className="text-xs text-subtext">
              {selectedPullRequest.repoKey} • {selectedPullRequest.baseRef || "base"} ← {selectedPullRequest.headRef || "head"}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => { void onOpenReviewDivergence(); }}
              disabled={detailLoading || openingReviewDivergence}
            >
              {openingReviewDivergence ? "Opening Review..." : "Open Review Divergence"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => { void onOpenConflictResolutionDivergence(); }}
              disabled={
                detailLoading
                || openingConflictResolutionDivergence
                || !detailHasConflicts
              }
            >
              {openingConflictResolutionDivergence ? "Preparing Conflicts..." : "Resolve Conflicts"}
            </Button>
            <Button
              type="button"
              variant={isChatOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleChat}
            >
              {isChatOpen ? "Hide AI Chat" : "AI Chat"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenGithubUrl(selectedPullRequest.htmlUrl)}
            >
              Open on GitHub
            </Button>
          </div>
        </div>
      </div>

      <div className={`flex-1 min-h-0 grid ${isChatOpen ? "grid-cols-[360px_minmax(0,1fr)_400px]" : "grid-cols-[360px_1fr]"}`}>
        <div className="border-r border-surface overflow-y-auto p-4 space-y-4">
          {detailError && <ErrorBanner>{detailError}</ErrorBanner>}
          {reviewDivergenceError && <ErrorBanner>{reviewDivergenceError}</ErrorBanner>}
          {conflictResolutionError && <ErrorBanner>{conflictResolutionError}</ErrorBanner>}
          {detailLoading && (
            <div className="text-sm text-subtext">
              <LoadingSpinner>Loading pull request details...</LoadingSpinner>
            </div>
          )}

          {detail && (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded border ${getChecksToneClass(detail.checksState)}`}>
                    checks: {detail.checksState ?? "unknown"}
                  </span>
                  {detail.draft && (
                    <span className="px-2 py-0.5 rounded border border-surface text-subtext">draft</span>
                  )}
                  {detailHasConflicts && (
                    <span className="px-2 py-0.5 rounded border border-red/30 bg-red/10 text-red">
                      conflicts
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded border border-surface text-subtext">
                    {detail.state}
                  </span>
                </div>
                <p className="text-xs text-subtext">
                  by {detail.userLogin ? `@${detail.userLogin}` : "unknown"} • updated {formatRelativeTime(detail.updatedAtMs)}
                </p>
                <p className="text-xs text-subtext">
                  {detail.commits} commits • +{detail.additions} / -{detail.deletions} • {detail.changedFiles} files
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-text mb-1">Description</h3>
                <div className="text-xs text-subtext whitespace-pre-wrap break-words rounded border border-surface bg-sidebar/70 p-2 max-h-[220px] overflow-y-auto">
                  {detail.body?.trim() ? detail.body : "No description provided."}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text">Merge</h3>
                <label className="text-xs text-subtext flex flex-col gap-1">
                  Method
                  <select
                    value={mergeMethod}
                    onChange={(event) => onMergeMethodChange(event.target.value as GithubPullRequestMergeMethod)}
                    className="h-9 rounded border border-surface bg-main px-2 text-sm text-text"
                    disabled={merging}
                  >
                    <option value="merge">Merge commit</option>
                    <option value="squash">Squash</option>
                  </select>
                </label>
                {mergeDisabledReason && (
                  <p className="text-xs text-subtext">{mergeDisabledReason}</p>
                )}
                <Button
                  type="button"
                  onClick={() => { void onMerge(); }}
                  variant="primary"
                  size="sm"
                  disabled={!canMerge || merging}
                >
                  {merging ? "Merging..." : "Merge Pull Request"}
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-medium text-text mb-2">Files changed</h3>
                {detailFiles.length === 0 ? (
                  <p className="text-xs text-subtext">No file changes loaded.</p>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {diffTreeRows.map((row) => {
                      if (row.kind === "directory") {
                        return (
                          <div
                            key={row.key}
                            className="rounded border border-surface bg-main/30 px-2 py-1.5"
                            style={{ paddingLeft: `${row.depth * 14 + 10}px` }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtext">
                                {row.label}
                              </span>
                              <span className="text-[10px] text-subtext">
                                +{row.additions} / -{row.deletions}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      const isSelected = selectedFile?.filename === row.file.filename;
                      return (
                        <Button
                          key={row.key}
                          type="button"
                          onClick={() => onSelectFilePath(row.file.filename)}
                          variant="ghost"
                          size="xs"
                          className={`w-full text-left p-2 rounded border ${
                            isSelected ? "border-accent/40 bg-accent/10" : "border-surface bg-sidebar/40"
                          }`}
                          style={{ paddingLeft: `${row.depth * 14 + 10}px` }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-text truncate">{row.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getGithubFileStatusToneClass(row.file.status)}`}>
                              {row.file.status}
                            </span>
                          </div>
                          <div className={`text-[10px] mt-1 ${getDiffTreeRowToneClass(row.additions, row.deletions)}`}>
                            +{row.additions} / -{row.deletions}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="min-h-0 p-4">
          <div className="h-full border border-surface rounded bg-sidebar/40 overflow-hidden">
            <div className="px-3 py-2 border-b border-surface text-xs text-subtext">
              {selectedFile ? selectedFile.filename : "Select a file"}
            </div>
            <div className="h-[calc(100%-33px)]">
              <PrFileDiffViewerPresentational
                patch={selectedFile?.patch ?? null}
                loading={detailLoading}
                error={detailError}
              />
            </div>
          </div>
        </div>

        {isChatOpen && (
          <div className="min-h-0 border-l border-surface">
            {chatSidebar}
          </div>
        )}
      </div>
    </div>
  );
}

export default GithubPrHubPresentational;
