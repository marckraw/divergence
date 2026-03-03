import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../../../entities";
import { getProjectGithubRepository, getErrorMessage } from "../../../shared";
import {
  fetchGithubPullRequestDetail,
  fetchGithubPullRequestFiles,
  fetchGithubPullRequestsForRepo,
  mergeGithubPullRequest,
} from "../api/githubPrHub.api";
import { filterGithubPullRequests } from "../lib/githubPrHub.pure";
import type {
  GithubPrProjectTarget,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestMergeMethod,
  GithubPullRequestSummary,
} from "./githubPrHub.types";

const DEFAULT_POLL_INTERVAL_MS = 90_000;

interface UseGithubPrHubInput {
  projects: Project[];
  githubToken: string;
  pollIntervalMs?: number;
}

export function useGithubPrHub({
  projects,
  githubToken,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseGithubPrHubInput) {
  const [projectTargets, setProjectTargets] = useState<GithubPrProjectTarget[]>([]);
  const [pullRequests, setPullRequests] = useState<GithubPullRequestSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<"all" | number>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPullRequest, setSelectedPullRequest] = useState<GithubPullRequestSummary | null>(null);
  const [detail, setDetail] = useState<GithubPullRequestDetail | null>(null);
  const [detailFiles, setDetailFiles] = useState<GithubPullRequestFile[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [mergeMethod, setMergeMethod] = useState<GithubPullRequestMergeMethod>("merge");
  const [merging, setMerging] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const requestIdRef = useRef(0);

  const resolveTargets = useCallback(async (): Promise<GithubPrProjectTarget[]> => {
    if (projects.length === 0) {
      return [];
    }

    const settled = await Promise.allSettled(projects.map(async (project) => {
      const repo = await getProjectGithubRepository(project.path);
      if (!repo) {
        return null;
      }

      return {
        projectId: project.id,
        projectName: project.name,
        projectPath: project.path,
        owner: repo.owner,
        repo: repo.repo,
        repoKey: repo.repoKey,
      } satisfies GithubPrProjectTarget;
    }));

    const targets: GithubPrProjectTarget[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        targets.push(result.value);
      }
    }
    return targets;
  }, [projects]);

  const loadBoard = useCallback(async (refresh: boolean): Promise<void> => {
    const requestId = ++requestIdRef.current;
    const token = githubToken.trim();

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    if (!token) {
      setProjectTargets([]);
      setPullRequests([]);
      setInfoMessage("Add a GitHub token in Settings > Integrations to load pull requests.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const targets = await resolveTargets();
    if (requestIdRef.current != requestId) {
      return;
    }
    setProjectTargets(targets);

    if (targets.length === 0) {
      setPullRequests([]);
      setInfoMessage("No GitHub integrations found in .ralphy/config.json for current projects.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const settled = await Promise.allSettled(
        targets.map(async (target) => {
          const items = await fetchGithubPullRequestsForRepo(token, target.owner, target.repo);
          return { target, items };
        }),
      );

      if (requestIdRef.current != requestId) {
        return;
      }

      const deduped = new Map<string, GithubPullRequestSummary>();
      let failureCount = 0;

      for (const result of settled) {
        if (result.status === "rejected") {
          failureCount += 1;
          continue;
        }

        const { target, items } = result.value;
        for (const item of items) {
          const normalized: GithubPullRequestSummary = {
            ...item,
            projectId: target.projectId,
            projectName: target.projectName,
            projectPath: target.projectPath,
            owner: target.owner,
            repo: target.repo,
            repoKey: target.repoKey,
            baseRef: item.baseRef ?? "",
            headRef: item.headRef ?? "",
            headSha: item.headSha ?? "",
            draft: item.draft ?? false,
          };

          const key = `${normalized.repoKey}#${normalized.number}`;
          const existing = deduped.get(key);
          if (!existing || normalized.updatedAtMs > existing.updatedAtMs) {
            deduped.set(key, normalized);
          }
        }
      }

      setPullRequests(Array.from(deduped.values()));

      if (failureCount > 0 && failureCount < targets.length) {
        setInfoMessage(`Loaded pull requests with ${failureCount} repository fetch failure(s).`);
      } else if (failureCount === targets.length) {
        setError("Failed to load pull requests from GitHub.");
        setInfoMessage(null);
      } else {
        setInfoMessage(null);
      }
    } catch (loadError) {
      if (requestIdRef.current != requestId) {
        return;
      }
      setError(getErrorMessage(loadError, "Failed to load pull requests."));
      setInfoMessage(null);
    } finally {
      if (requestIdRef.current == requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [githubToken, resolveTargets]);

  useEffect(() => {
    void loadBoard(false);
  }, [loadBoard]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      void loadBoard(true);
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [loadBoard, pollIntervalMs]);

  const openPullRequest = useCallback(async (pullRequest: GithubPullRequestSummary): Promise<void> => {
    const token = githubToken.trim();
    if (!token) {
      setDetailError("GitHub token is missing.");
      return;
    }

    setSelectedPullRequest(pullRequest);
    setDetail(null);
    setDetailFiles([]);
    setSelectedFilePath(null);
    setDetailLoading(true);
    setDetailError(null);
    setIsChatOpen(false);

    try {
      const [detailResponse, filesResponse] = await Promise.all([
        fetchGithubPullRequestDetail(token, pullRequest.owner, pullRequest.repo, pullRequest.number),
        fetchGithubPullRequestFiles(token, pullRequest.owner, pullRequest.repo, pullRequest.number, 1, 100),
      ]);

      setDetail(detailResponse);
      setDetailFiles(filesResponse);
      setSelectedFilePath(filesResponse[0]?.filename ?? null);
    } catch (openError) {
      setDetailError(getErrorMessage(openError, "Failed to load pull request details."));
    } finally {
      setDetailLoading(false);
    }
  }, [githubToken]);

  const backToBoard = useCallback(() => {
    setSelectedPullRequest(null);
    setDetail(null);
    setDetailFiles([]);
    setDetailError(null);
    setSelectedFilePath(null);
    setMerging(false);
    setIsChatOpen(false);
  }, []);

  const mergeSelectedPullRequest = useCallback(async (): Promise<boolean> => {
    if (!selectedPullRequest || !detail) {
      return false;
    }

    const token = githubToken.trim();
    if (!token) {
      setDetailError("GitHub token is missing.");
      return false;
    }

    setMerging(true);
    setDetailError(null);
    try {
      const result = await mergeGithubPullRequest(
        token,
        selectedPullRequest.owner,
        selectedPullRequest.repo,
        selectedPullRequest.number,
        mergeMethod,
        detail.headSha,
      );

      if (!result.merged) {
        throw new Error(result.message || "GitHub reported merge was not successful.");
      }

      await loadBoard(true);
      setInfoMessage(
        `Merged ${selectedPullRequest.repoKey} #${selectedPullRequest.number} using ${mergeMethod}.`,
      );
      backToBoard();
      return true;
    } catch (mergeError) {
      setDetailError(getErrorMessage(mergeError, "Failed to merge pull request."));
      return false;
    } finally {
      setMerging(false);
    }
  }, [backToBoard, detail, githubToken, loadBoard, mergeMethod, selectedPullRequest]);

  const filteredPullRequests = useMemo(() => (
    filterGithubPullRequests(pullRequests, selectedProjectFilter, searchQuery)
  ), [pullRequests, searchQuery, selectedProjectFilter]);

  return {
    projectTargets,
    pullRequests: filteredPullRequests,
    totalPullRequests: pullRequests.length,
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
    refresh: () => loadBoard(true),
    openPullRequest,
    backToBoard,
    mergeSelectedPullRequest,
  };
}
