import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  Project,
  Divergence,
  TmuxSessionEntry,
  TmuxSessionOwnership,
  TmuxSessionWithOwnership,
} from "../types";
import {
  buildTmuxSessionName,
  buildLegacyTmuxSessionName,
  buildSplitTmuxSessionName,
} from "../lib/tmux";

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
    const map = new Map<string, TmuxSessionOwnership>();

    for (const project of projects) {
      const ownership: TmuxSessionOwnership = { kind: "project", project };

      const baseName = buildTmuxSessionName({
        type: "project",
        projectName: project.name,
        projectId: project.id,
      });
      map.set(baseName, ownership);
      map.set(buildSplitTmuxSessionName(baseName, "pane-2"), ownership);
      map.set(buildLegacyTmuxSessionName(`project-${project.id}`), ownership);

      const divergences = divergencesByProject.get(project.id) ?? [];
      for (const divergence of divergences) {
        const divOwnership: TmuxSessionOwnership = {
          kind: "divergence",
          project,
          divergence,
        };
        const divBase = buildTmuxSessionName({
          type: "divergence",
          projectName: project.name,
          projectId: project.id,
          divergenceId: divergence.id,
          branch: divergence.branch,
        });
        map.set(divBase, divOwnership);
        map.set(buildSplitTmuxSessionName(divBase, "pane-2"), divOwnership);
        map.set(
          buildLegacyTmuxSessionName(`divergence-${divergence.id}`),
          divOwnership
        );
      }
    }

    return map;
  }, [projects, divergencesByProject]);

  const sessions = useMemo<TmuxSessionWithOwnership[]>(() => {
    if (!ownershipReady) {
      return rawSessions.map((s) => ({
        ...s,
        ownership: { kind: "unknown" },
      }));
    }
    return rawSessions.map((s) => ({
      ...s,
      ownership: ownershipMap.get(s.name) ?? { kind: "orphan" },
    }));
  }, [rawSessions, ownershipMap, ownershipReady]);

  const orphanCount = useMemo(
    () => (ownershipReady ? sessions.filter((s) => s.ownership.kind === "orphan").length : 0),
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
