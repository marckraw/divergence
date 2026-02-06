import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  TmuxSessionEntry,
  TmuxSessionWithOwnership,
} from "./tmux.types";
import type { Divergence } from "../../divergence";
import type { Project } from "../../project";
import {
  killAllTmuxSessions,
  killTmuxSession,
  listTmuxSessions,
} from "../../../shared/api/tmuxSessions.api";
import {
  annotateTmuxSessions,
  buildTmuxOwnershipMap,
  countOrphanTmuxSessions,
} from "../lib/tmuxOwnership.pure";

interface UseTmuxSessionsResult {
  sessions: TmuxSessionWithOwnership[];
  loading: boolean;
  error: string | null;
  orphanCount: number;
  refresh: () => Promise<void>;
  killSession: (name: string) => Promise<void>;
  killOrphans: () => Promise<void>;
  killAll: () => Promise<void>;
}

export function useTmuxSessions(
  projects: Project[],
  divergencesByProject: Map<number, Divergence[]>,
  ownershipReady: boolean
): UseTmuxSessionsResult {
  const [rawSessions, setRawSessions] = useState<TmuxSessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownershipMap = useMemo(() => {
    return buildTmuxOwnershipMap(projects, divergencesByProject);
  }, [projects, divergencesByProject]);

  const sessions = useMemo<TmuxSessionWithOwnership[]>(() => {
    return annotateTmuxSessions(rawSessions, ownershipMap, ownershipReady);
  }, [rawSessions, ownershipMap, ownershipReady]);

  const orphanCount = useMemo(
    () => countOrphanTmuxSessions(sessions, ownershipReady),
    [sessions, ownershipReady]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTmuxSessions();
      setRawSessions(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to list tmux sessions.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const killSession = useCallback(
    async (name: string) => {
      setLoading(true);
      setError(null);
      try {
        await killTmuxSession(name);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to kill tmux session.";
        setError(message);
      } finally {
        await refresh();
      }
    },
    [refresh]
  );

  const killOrphans = useCallback(async () => {
    if (!ownershipReady) {
      return;
    }
    const orphanNames = sessions
      .filter((s) => s.ownership.kind === "orphan")
      .map((s) => s.name);
    if (orphanNames.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await killAllTmuxSessions(orphanNames);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to kill tmux sessions.";
      setError(message);
    } finally {
      await refresh();
    }
  }, [sessions, refresh, ownershipReady]);

  const killAll = useCallback(async () => {
    const allNames = sessions.map((s) => s.name);
    if (allNames.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await killAllTmuxSessions(allNames);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to kill tmux sessions.";
      setError(message);
    } finally {
      await refresh();
    }
  }, [sessions, refresh]);

  return {
    sessions,
    loading,
    error,
    orphanCount,
    refresh,
    killSession,
    killOrphans,
    killAll,
  };
}
