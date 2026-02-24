import { useCallback, useEffect, useState } from "react";
import {
  listAutomationTriggerDispatches,
} from "../api/automationTrigger.api";
import type { AutomationTriggerDispatchRow } from "./automationTrigger.types";

interface UseAutomationTriggerDispatchesResult {
  dispatches: AutomationTriggerDispatchRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAutomationTriggerDispatches(): UseAutomationTriggerDispatchesResult {
  const [dispatches, setDispatches] = useState<AutomationTriggerDispatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listAutomationTriggerDispatches();
      setDispatches(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automation dispatches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    dispatches,
    loading,
    error,
    refresh,
  };
}
