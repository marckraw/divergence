import { useCallback, useEffect, useState } from "react";
import type { AgentSessionSnapshot, Project } from "../../../entities";
import { getErrorMessage, type CreateAgentSessionInput } from "../../../shared";
import { hasGithubMergeConflicts } from "../lib/githubPrHub.pure";
import { useGithubPrChat } from "../model/useGithubPrChat";
import { useGithubPrHub } from "../model/useGithubPrHub";
import type {
  GithubPullRequestDetail,
  GithubPullRequestMergeMethod,
  GithubPullRequestSummary,
} from "../model/githubPrHub.types";
import GithubPrChatSidebar from "./GithubPrChatSidebar.container";
import GithubPrHubPresentational from "./GithubPrHub.presentational";

interface GithubPrHubContainerProps {
  projects: Project[];
  githubToken: string;
  agentSessions: Map<string, AgentSessionSnapshot>;
  createAgentSession: (input: CreateAgentSessionInput) => Promise<{ id: string }>;
  startAgentTurn: (sessionId: string, prompt: string) => Promise<void>;
  deleteAgentSession: (sessionId: string) => Promise<void>;
  onOpenReviewDivergence: (input: {
    pullRequest: GithubPullRequestSummary;
    detail: GithubPullRequestDetail;
  }) => Promise<void>;
  onOpenConflictResolutionDivergence: (input: {
    pullRequest: GithubPullRequestSummary;
    detail: GithubPullRequestDetail;
  }) => Promise<void>;
}

function GithubPrHubContainer({
  projects,
  githubToken,
  agentSessions,
  createAgentSession,
  startAgentTurn,
  deleteAgentSession,
  onOpenReviewDivergence,
  onOpenConflictResolutionDivergence,
}: GithubPrHubContainerProps) {
  const [openingReviewDivergence, setOpeningReviewDivergence] = useState(false);
  const [reviewDivergenceError, setReviewDivergenceError] = useState<string | null>(null);
  const [openingConflictResolutionDivergence, setOpeningConflictResolutionDivergence] = useState(false);
  const [conflictResolutionError, setConflictResolutionError] = useState<string | null>(null);
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
    isChatOpen,
    setIsChatOpen,
    refresh,
    openPullRequest,
    backToBoard,
    mergeSelectedPullRequest,
  } = useGithubPrHub({
    projects,
    githubToken,
  });
  const {
    messages: chatMessages,
    draft: chatDraft,
    selectedAgent: chatSelectedAgent,
    includeAllPatches: chatIncludeAllPatches,
    sending: chatSending,
    error: chatError,
    setDraft: setChatDraft,
    setSelectedAgent: setChatSelectedAgent,
    setIncludeAllPatches: setChatIncludeAllPatches,
    clearActiveThread: clearChatThread,
    sendMessage: sendChatMessage,
  } = useGithubPrChat({
    selectedPullRequest,
    detail,
    detailFiles,
    selectedFilePath,
    agentSessions,
    createAgentSession,
    startAgentTurn,
    deleteAgentSession,
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
  const handleToggleChat = useCallback(() => {
    setIsChatOpen((current) => !current);
  }, [setIsChatOpen]);

  useEffect(() => {
    setReviewDivergenceError(null);
    setConflictResolutionError(null);
    setOpeningReviewDivergence(false);
    setOpeningConflictResolutionDivergence(false);
  }, [selectedPullRequest?.id]);

  const detailHasConflicts = hasGithubMergeConflicts(
    detail?.mergeable ?? null,
    detail?.mergeableState ?? null,
  );

  const handleOpenReviewDivergence = useCallback(async () => {
    if (!selectedPullRequest || !detail || openingReviewDivergence) {
      return;
    }

    setOpeningReviewDivergence(true);
    setReviewDivergenceError(null);
    try {
      await onOpenReviewDivergence({
        pullRequest: selectedPullRequest,
        detail,
      });
    } catch (error) {
      setReviewDivergenceError(getErrorMessage(error, "Failed to open review divergence."));
    } finally {
      setOpeningReviewDivergence(false);
    }
  }, [detail, onOpenReviewDivergence, openingReviewDivergence, selectedPullRequest]);

  const handleOpenConflictResolutionDivergence = useCallback(async () => {
    if (
      !selectedPullRequest
      || !detail
      || !detailHasConflicts
      || openingConflictResolutionDivergence
    ) {
      return;
    }

    setOpeningConflictResolutionDivergence(true);
    setConflictResolutionError(null);
    try {
      await onOpenConflictResolutionDivergence({
        pullRequest: selectedPullRequest,
        detail,
      });
    } catch (error) {
      setConflictResolutionError(
        getErrorMessage(error, "Failed to prepare conflict resolution divergence."),
      );
    } finally {
      setOpeningConflictResolutionDivergence(false);
    }
  }, [
    detail,
    detailHasConflicts,
    onOpenConflictResolutionDivergence,
    openingConflictResolutionDivergence,
    selectedPullRequest,
  ]);

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
      openingReviewDivergence={openingReviewDivergence}
      reviewDivergenceError={reviewDivergenceError}
      openingConflictResolutionDivergence={openingConflictResolutionDivergence}
      conflictResolutionError={conflictResolutionError}
      isChatOpen={isChatOpen}
      chatSidebar={(
        <GithubPrChatSidebar
          messages={chatMessages}
          draft={chatDraft}
          selectedAgent={chatSelectedAgent}
          includeAllPatches={chatIncludeAllPatches}
          sending={chatSending}
          error={chatError}
          onDraftChange={setChatDraft}
          onSelectedAgentChange={setChatSelectedAgent}
          onIncludeAllPatchesChange={setChatIncludeAllPatches}
          onSend={sendChatMessage}
          onClear={clearChatThread}
        />
      )}
      onSelectProjectFilter={setSelectedProjectFilter}
      onSearchQueryChange={setSearchQuery}
      onRefresh={refresh}
      onOpenPullRequest={openPullRequest}
      onBackToBoard={backToBoard}
      onOpenGithubUrl={handleOpenGithubUrl}
      onToggleChat={handleToggleChat}
      onSelectFilePath={setSelectedFilePath}
      onMergeMethodChange={handleMergeMethodChange}
      onMerge={mergeSelectedPullRequest}
      onOpenReviewDivergence={handleOpenReviewDivergence}
      onOpenConflictResolutionDivergence={handleOpenConflictResolutionDivergence}
    />
  );
}

export default GithubPrHubContainer;
