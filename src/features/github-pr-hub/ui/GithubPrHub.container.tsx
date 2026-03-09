import { useCallback } from "react";
import type { AgentSessionSnapshot, Project } from "../../../entities";
import type { CreateAgentSessionInput } from "../../../shared";
import { useGithubPrChat } from "../model/useGithubPrChat";
import { useGithubPrHub } from "../model/useGithubPrHub";
import type { GithubPullRequestMergeMethod } from "../model/githubPrHub.types";
import GithubPrChatSidebar from "./GithubPrChatSidebar.container";
import GithubPrHubPresentational from "./GithubPrHub.presentational";

interface GithubPrHubContainerProps {
  projects: Project[];
  githubToken: string;
  agentSessions: Map<string, AgentSessionSnapshot>;
  createAgentSession: (input: CreateAgentSessionInput) => Promise<{ id: string }>;
  startAgentTurn: (sessionId: string, prompt: string) => Promise<void>;
  deleteAgentSession: (sessionId: string) => Promise<void>;
}

function GithubPrHubContainer({
  projects,
  githubToken,
  agentSessions,
  createAgentSession,
  startAgentTurn,
  deleteAgentSession,
}: GithubPrHubContainerProps) {
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
    />
  );
}

export default GithubPrHubContainer;
