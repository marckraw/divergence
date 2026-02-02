import { useCallback, useEffect, useState } from "react";
import type { Project } from "../types";
import type { ProjectSettings } from "../lib/projectSettings";
import { loadProjectSettings } from "../lib/projectSettings";

export function useProjectSettingsMap(projects: Project[]) {
  const [settingsByProjectId, setSettingsByProjectId] = useState<Map<number, ProjectSettings>>(new Map());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (projects.length === 0) {
      setSettingsByProjectId(new Map());
      return;
    }

    setLoading(true);
    try {
      const entries = await Promise.all(
        projects.map(async (project) => {
          const settings = await loadProjectSettings(project.id);
          return [project.id, settings] as const;
        })
      );

      const map = new Map<number, ProjectSettings>();
      for (const [projectId, settings] of entries) {
        map.set(projectId, settings);
      }
      setSettingsByProjectId(map);
    } catch (err) {
      console.warn("Failed to load project settings:", err);
    } finally {
      setLoading(false);
    }
  }, [projects]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProjectSettings = useCallback((settings: ProjectSettings) => {
    setSettingsByProjectId(prev => {
      const next = new Map(prev);
      next.set(settings.projectId, settings);
      return next;
    });
  }, []);

  return {
    settingsByProjectId,
    loading,
    refresh,
    updateProjectSettings,
  };
}
