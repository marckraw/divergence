import { useCallback, useEffect, useState } from "react";
import { loadProjectSettings, saveProjectSettings } from "../lib/projectSettings";
import type { ProjectSettings } from "../lib/projectSettings";

export function useProjectSettings(projectId: number | null) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (projectId === null) {
      setSettings(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      const loaded = await loadProjectSettings(projectId);
      setSettings(loaded);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project settings");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (copyIgnoredSkip: string[], useTmux: boolean, useWebgl: boolean) => {
    if (projectId === null) {
      return;
    }
    const saved = await saveProjectSettings(projectId, copyIgnoredSkip, useTmux, useWebgl);
    setSettings(saved);
    return saved;
  }, [projectId]);

  return {
    settings,
    loading,
    error,
    refresh,
    save,
  };
}
