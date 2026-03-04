import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  TmuxSessionEntry,
  TmuxSessionWithOwnership,
} from "./tmux.types";
import type { Divergence } from "../../divergence";
import type { Project } from "../../project";
import type { TmuxDiagnosticsEntry } from "../../../shared/api/tmuxSessions.types";
import {
  recordDebugEvent,
} from "../../../shared";
import {
  getTmuxDiagnostics,
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
  diagnostics: TmuxDiagnosticsEntry | null;
  refresh: () => Promise<void>;
  killSession: (name: string, socketPath?: string) => Promise<void>;
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
  const [diagnostics, setDiagnostics] = useState<TmuxDiagnosticsEntry | null>(null);

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
    setDiagnostics(null);
    try {
      const result = await listTmuxSessions();
      recordDebugEvent({
        level: "info",
        category: "tmux",
        message: "Tmux sessions fetched",
        metadata: { sessionCount: result.length },
      });
      console.info(`[divergence] tmux sessions fetched: ${result.length} session(s)`, result.length > 0 ? result.map(s => s.name) : "(none)");
      setRawSessions(result);
      // Auto-fetch diagnostics when no sessions found to help debug production issues
      if (result.length === 0) {
        try {
          const diag = await getTmuxDiagnostics();
          setDiagnostics(diag);
          recordDebugEvent({
            level: "warn",
            category: "tmux",
            message: "No tmux sessions found; diagnostics captured",
            metadata: {
              tmuxFound: Boolean(diag.resolved_tmux_path),
              listSessionsExitCode: diag.list_sessions_raw.status_code ?? -1,
            },
          });
          console.info("[divergence] tmux diagnostics (no sessions found):", diag);
        } catch {
          // Diagnostics are best-effort
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to list tmux sessions.";
      setError(message);
      recordDebugEvent({
        level: "error",
        category: "tmux",
        message: "Failed to list tmux sessions",
        details: message,
      });
      // Also fetch diagnostics on error
      try {
        const diag = await getTmuxDiagnostics();
        setDiagnostics(diag);
        recordDebugEvent({
          level: "warn",
          category: "tmux",
          message: "Tmux diagnostics captured after list failure",
          metadata: {
            tmuxFound: Boolean(diag.resolved_tmux_path),
            listSessionsExitCode: diag.list_sessions_raw.status_code ?? -1,
          },
        });
        console.info("[divergence] tmux diagnostics (error):", diag);
      } catch {
        // Diagnostics are best-effort
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const killSession = useCallback(
    async (name: string, socketPath?: string) => {
      setLoading(true);
      setError(null);
      try {
        await killTmuxSession(name, socketPath);
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
    const orphanSessions = sessions.filter((s) => s.ownership.kind === "orphan");
    if (orphanSessions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      for (const session of orphanSessions) {
        await killTmuxSession(session.name, session.socket_path);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to kill tmux sessions.";
      setError(message);
    } finally {
      await refresh();
    }
  }, [sessions, refresh, ownershipReady]);

  const killAll = useCallback(async () => {
    if (sessions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      for (const session of sessions) {
        await killTmuxSession(session.name, session.socket_path);
      }
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
    diagnostics,
    refresh,
    killSession,
    killOrphans,
    killAll,
  };
}
