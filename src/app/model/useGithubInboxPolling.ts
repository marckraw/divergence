import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../../entities";
import { getRalphyConfigSummary } from "../../shared/api/ralphyConfig.api";
import {
  getGithubPollState,
  insertInboxEvent,
  upsertGithubPollState,
} from "../../entities/inbox-event";
import {
  buildGithubInboxBody,
  buildGithubInboxExternalId,
  buildGithubInboxTitle,
  buildGithubRepoTarget,
  classifyGithubPullRequestEvent,
} from "../lib/githubInbox.pure";
import { fetchGithubPullRequests } from "../api/githubPullRequests.api";
import type { GithubRepoTarget } from "./githubPullRequests.types";

const GITHUB_POLL_INTERVAL_MS = 2 * 60_000;
const GITHUB_INITIAL_POLL_DELAY_MS = 15_000;

interface UseGithubInboxPollingParams {
  projects: Project[];
  appSettings: {
    githubToken?: string | null;
  };
  onRefreshInbox: () => Promise<void>;
}

export function useGithubInboxPolling({
  projects,
  appSettings,
  onRefreshInbox,
}: UseGithubInboxPollingParams) {
  const [githubRepoTargets, setGithubRepoTargets] = useState<GithubRepoTarget[]>([]);
  const githubRepoTargetsRef = useRef<GithubRepoTarget[]>([]);
  const githubPollingInFlightRef = useRef(false);
  const githubTokenWarningShownRef = useRef(false);

  useEffect(() => {
    githubRepoTargetsRef.current = githubRepoTargets;
  }, [githubRepoTargets]);

  const refreshGithubRepoTargets = useCallback(async () => {
    if (projects.length === 0) {
      setGithubRepoTargets([]);
      return;
    }

    const targets = await Promise.all(projects.map(async (project) => {
      try {
        const config = await getRalphyConfigSummary(project.path);
        if (config.status !== "ok") {
          return null;
        }
        const owner = config.summary.integrations?.github?.owner?.trim();
        const repo = config.summary.integrations?.github?.repo?.trim();
        if (!owner || !repo) {
          return null;
        }
        return buildGithubRepoTarget({
          projectId: project.id,
          projectName: project.name,
          owner,
          repo,
        });
      } catch (error) {
        console.warn(`Failed to load Ralphy config for ${project.name}:`, error);
        return null;
      }
    }));

    setGithubRepoTargets(targets.filter((target): target is GithubRepoTarget => target !== null));
  }, [projects]);

  useEffect(() => {
    void refreshGithubRepoTargets();
  }, [refreshGithubRepoTargets]);

  const pollGithubInbox = useCallback(async (): Promise<void> => {
    if (githubPollingInFlightRef.current) {
      return;
    }

    const githubToken = appSettings.githubToken?.trim() ?? "";
    if (!githubToken) {
      if (!githubTokenWarningShownRef.current) {
        githubTokenWarningShownRef.current = true;
        console.warn("GitHub polling is disabled because no GitHub token is configured in Settings.");
      }
      return;
    }
    githubTokenWarningShownRef.current = false;

    const repoTargets = githubRepoTargetsRef.current;
    if (repoTargets.length === 0) {
      return;
    }

    githubPollingInFlightRef.current = true;
    let insertedCount = 0;
    try {
      for (const repoTarget of repoTargets) {
        const nowMs = Date.now();
        const lastPolledAtMs = await getGithubPollState(repoTarget.repoKey);
        if (lastPolledAtMs === null) {
          await upsertGithubPollState(repoTarget.repoKey, nowMs);
          continue;
        }

        let pullRequests;
        try {
          pullRequests = await fetchGithubPullRequests(githubToken, repoTarget.owner, repoTarget.repo);
        } catch (error) {
          console.warn(`GitHub polling failed for ${repoTarget.repoKey}:`, error);
          continue;
        }

        for (const pullRequest of pullRequests) {
          try {
            const kind = classifyGithubPullRequestEvent(pullRequest, lastPolledAtMs);
            if (!kind) {
              continue;
            }

            const eventAtMs = kind === "github_pr_opened"
              ? pullRequest.createdAtMs
              : pullRequest.updatedAtMs;
            const insertedId = await insertInboxEvent({
              kind,
              source: "github",
              projectId: repoTarget.projectId,
              externalId: buildGithubInboxExternalId(
                repoTarget.repoKey,
                pullRequest.id,
                kind,
                eventAtMs
              ),
              title: buildGithubInboxTitle(repoTarget.repoKey, pullRequest.number, kind),
              body: buildGithubInboxBody(pullRequest),
              payloadJson: JSON.stringify({
                projectId: repoTarget.projectId,
                repoKey: repoTarget.repoKey,
                pullRequest,
              }),
              createdAtMs: eventAtMs,
            });
            if (insertedId) {
              insertedCount += 1;
            }
          } catch (error) {
            console.warn(`Failed to process PR #${pullRequest.number} for ${repoTarget.repoKey}:`, error);
          }
        }

        await upsertGithubPollState(repoTarget.repoKey, nowMs);
      }

      if (insertedCount > 0) {
        await onRefreshInbox();
      }
    } finally {
      githubPollingInFlightRef.current = false;
    }
  }, [appSettings.githubToken, onRefreshInbox]);

  useEffect(() => {
    const initialTimerId = window.setTimeout(() => {
      void pollGithubInbox();
    }, GITHUB_INITIAL_POLL_DELAY_MS);
    const timerId = window.setInterval(() => {
      void pollGithubInbox();
    }, GITHUB_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(timerId);
    };
  }, [pollGithubInbox]);

  return { githubRepoTargets };
}
