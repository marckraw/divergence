import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  Project,
  Divergence,
  TmuxSessionEntry,
  TmuxSessionWithOwnership,
} from "../types";
import {
  annotateTmuxSessions,
  buildTmuxOwnershipMap,
  countOrphanTmuxSessions,
} from "../lib/utils/tmuxOwnership";

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
      const result = await invoke<TmuxSessionEntry[]>("list_tmux_sessions");
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
        await invoke("kill_tmux_session", { sessionName: name });
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
      await invoke("kill_all_tmux_sessions", { sessionNames: orphanNames });
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
      await invoke("kill_all_tmux_sessions", { sessionNames: allNames });
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
