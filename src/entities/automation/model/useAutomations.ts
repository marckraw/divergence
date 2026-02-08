import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteAutomation,
  insertAutomation,
  listAutomations,
  listAutomationRuns,
  updateAutomation,
} from "../api/automation.api";
import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "./automation.types";

interface UseAutomationsResult {
  automations: Automation[];
  latestRunByAutomationId: Map<number, AutomationRun>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createAutomation: (input: CreateAutomationInput) => Promise<number>;
  updateAutomation: (input: UpdateAutomationInput) => Promise<void>;
  removeAutomation: (automationId: number) => Promise<void>;
}

export function useAutomations(): UseAutomationsResult {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [automationRows, runRows] = await Promise.all([
        listAutomations(),
        listAutomationRuns(),
      ]);
      setAutomations(automationRows);
      setRuns(runRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAutomationRecord = useCallback(async (input: CreateAutomationInput) => {
    const id = await insertAutomation(input);
    await refresh();
    return id;
  }, [refresh]);

  const updateAutomationRecord = useCallback(async (input: UpdateAutomationInput) => {
    await updateAutomation(input);
    await refresh();
  }, [refresh]);

  const removeAutomationRecord = useCallback(async (automationId: number) => {
    await deleteAutomation(automationId);
    await refresh();
  }, [refresh]);

  const latestRunByAutomationId = useMemo(() => {
    const map = new Map<number, AutomationRun>();
    for (const run of runs) {
      if (!map.has(run.automationId)) {
        map.set(run.automationId, run);
      }
    }
    return map;
  }, [runs]);

  return {
    automations,
    latestRunByAutomationId,
    loading,
    error,
    refresh,
    createAutomation: createAutomationRecord,
    updateAutomation: updateAutomationRecord,
    removeAutomation: removeAutomationRecord,
  };
}
