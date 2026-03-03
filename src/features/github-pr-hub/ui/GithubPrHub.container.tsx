import { useCallback } from "react";
import type { Project } from "../../../entities";
import { useGithubPrHub } from "../model/useGithubPrHub";
import type { GithubPullRequestMergeMethod } from "../model/githubPrHub.types";
import GithubPrHubPresentational from "./GithubPrHub.presentational";

interface GithubPrHubContainerProps {
  projects: Project[];
  githubToken: string;
}

function GithubPrHubContainer({ projects, githubToken }: GithubPrHubContainerProps) {
  const {
    projectTargets,
    pullRequests,
    totalPullRequests,
    loading,
    refreshing,
    error,
    infoMessage,
    selectedProjectFilter,
    setSelectedProjectFilter,
    searchQuery,
    setSearchQuery,
    selectedPullRequest,
    detail,
    detailFiles,
    detailLoading,
    detailError,
    selectedFilePath,
    setSelectedFilePath,
    mergeMethod,
    setMergeMethod,
    merging,
    refresh,
    openPullRequest,
    backToBoard,
    mergeSelectedPullRequest,
  } = useGithubPrHub({
    projects,
    githubToken,
  });

  const handleOpenGithubUrl = useCallback((url: string) => {
    const normalized = url.trim();
    if (!normalized) {
      return;
    }
    window.open(normalized, "_blank", "noopener,noreferrer");
  }, []);

  const handleMergeMethodChange = useCallback((method: GithubPullRequestMergeMethod) => {
    setMergeMethod(method);
  }, [setMergeMethod]);

  return (
    <GithubPrHubPresentational
      projectTargets={projectTargets}
      pullRequests={pullRequests}
      totalPullRequests={totalPullRequests}
      loading={loading}
      refreshing={refreshing}
      error={error}
      infoMessage={infoMessage}
      selectedProjectFilter={selectedProjectFilter}
      searchQuery={searchQuery}
      selectedPullRequest={selectedPullRequest}
      detail={detail}
      detailFiles={detailFiles}
      detailLoading={detailLoading}
      detailError={detailError}
      selectedFilePath={selectedFilePath}
      mergeMethod={mergeMethod}
      merging={merging}
      onSelectProjectFilter={setSelectedProjectFilter}
      onSearchQueryChange={setSearchQuery}
      onRefresh={refresh}
      onOpenPullRequest={openPullRequest}
      onBackToBoard={backToBoard}
      onOpenGithubUrl={handleOpenGithubUrl}
      onSelectFilePath={setSelectedFilePath}
      onMergeMethodChange={handleMergeMethodChange}
      onMerge={mergeSelectedPullRequest}
    />
  );
}

export default GithubPrHubContainer;
