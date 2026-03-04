import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCodexUsage } from "../api/usageLimits.api";
import type { CodexUsageResult } from "./usageLimits.types";

const INITIAL_DELAY_MS = 3_000;
const POLL_INTERVAL_MS = 60_000;

export function useUsageLimits() {
  const [codex, setCodex] = useState<CodexUsageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetchedAtMs, setLastFetchedAtMs] = useState<number | null>(null);
  const inFlightRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const result = await fetchCodexUsage();
      setCodex(result);
      setLastFetchedAtMs(Date.now());
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

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

  return { codex, loading, lastFetchedAtMs, refresh: fetchAll };
}
