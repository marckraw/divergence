import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUsageLimitsStatus,
  fetchClaudeUsage,
  fetchCodexUsage,
} from "../api/usageLimits.api";
import type {
  ClaudeUsageResult,
  CodexUsageResult,
  UsageLimitsStatus,
} from "./usageLimits.types";

const INITIAL_DELAY_MS = 3_000;
const POLL_INTERVAL_MS = 60_000;

export function useUsageLimits(claudeOAuthToken?: string) {
  const [claude, setClaude] = useState<ClaudeUsageResult | null>(null);
  const [codex, setCodex] = useState<CodexUsageResult | null>(null);
  const [status, setStatus] = useState<UsageLimitsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetchedAtMs, setLastFetchedAtMs] = useState<number | null>(null);
  const inFlightRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const token = claudeOAuthToken?.trim() || undefined;
      const limitsStatus = await getUsageLimitsStatus(token);
      setStatus(limitsStatus);

      const promises: [
        Promise<ClaudeUsageResult | null>,
        Promise<CodexUsageResult | null>,
      ] = [
        limitsStatus.claudeCredentialsFound
          ? fetchClaudeUsage(token)
          : Promise.resolve(null),
        limitsStatus.codexCredentialsFound
          ? fetchCodexUsage()
          : Promise.resolve(null),
      ];

      const [claudeResult, codexResult] = await Promise.allSettled(promises);

      setClaude(
        claudeResult.status === "fulfilled" ? claudeResult.value : null,
      );
      setCodex(codexResult.status === "fulfilled" ? codexResult.value : null);
      setLastFetchedAtMs(Date.now());
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [claudeOAuthToken]);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      fetchAll();
    }, INITIAL_DELAY_MS);

    return () => clearTimeout(initialTimer);
  }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { claude, codex, status, loading, lastFetchedAtMs, refresh: fetchAll };
}
