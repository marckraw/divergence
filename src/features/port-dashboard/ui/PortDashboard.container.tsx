import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortAllocations, getAdapterById } from "../../../entities/port-management";
import type { PortAllocation } from "../../../entities/port-management";
import type { Project, Divergence, WorkspaceDivergence } from "../../../entities";
import { isCaddyRunning } from "../../../shared/api/proxy.api";
import PortDashboardPresentational, { type PortDashboardRow } from "./PortDashboard.presentational";

interface PortDashboardContainerProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  workspaceDivergences: WorkspaceDivergence[];
}

function PortDashboardContainer({
  projects,
  divergencesByProject,
  workspaceDivergences,
}: PortDashboardContainerProps) {
  const { allocations } = usePortAllocations();
  const [caddyRunning, setCaddyRunning] = useState(false);

  useEffect(() => {
    void isCaddyRunning().then(setCaddyRunning);
    const interval = setInterval(() => {
      void isCaddyRunning().then(setCaddyRunning);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const projectsById = useMemo(() => {
    const map = new Map<number, Project>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  const divergencesById = useMemo(() => {
    const map = new Map<number, Divergence>();
    for (const divs of divergencesByProject.values()) {
      for (const d of divs) {
        map.set(d.id, d);
      }
    }
    return map;
  }, [divergencesByProject]);

  const wsDivergencesById = useMemo(() => {
    const map = new Map<number, WorkspaceDivergence>();
    for (const wd of workspaceDivergences) {
      map.set(wd.id, wd);
    }
    return map;
  }, [workspaceDivergences]);

  const rows: PortDashboardRow[] = useMemo(() => {
    return allocations.map((alloc: PortAllocation) => {
      let entityName = `#${alloc.entityId}`;
      let projectName: string | null = null;
      let branchName: string | null = null;

      if (alloc.entityType === "project") {
        const project = projectsById.get(alloc.entityId);
        entityName = project?.name ?? entityName;
      } else if (alloc.entityType === "divergence") {
        const div = divergencesById.get(alloc.entityId);
        if (div) {
          entityName = div.name;
          branchName = div.branch;
          projectName = projectsById.get(div.projectId)?.name ?? null;
        }
      } else if (alloc.entityType === "workspace_divergence") {
        const wd = wsDivergencesById.get(alloc.entityId);
        if (wd) {
          entityName = wd.name;
          branchName = wd.branch;
        }
      }

      if (!projectName && alloc.projectId) {
        projectName = projectsById.get(alloc.projectId)?.name ?? null;
      }

      const adapter = alloc.framework ? getAdapterById(alloc.framework) : null;

      return {
        allocation: {
          ...alloc,
          framework: adapter?.label ?? alloc.framework,
        },
        entityName,
        projectName,
        branchName,
      };
    });
  }, [allocations, projectsById, divergencesById, wsDivergencesById]);

  const handleCopyUrl = useCallback((url: string) => {
    void navigator.clipboard.writeText(url);
  }, []);

  const handleOpenInBrowser = useCallback((url: string) => {
    window.open(url, "_blank");
  }, []);

  return (
    <PortDashboardPresentational
      rows={rows}
      caddyRunning={caddyRunning}
      onCopyUrl={handleCopyUrl}
      onOpenInBrowser={handleOpenInBrowser}
    />
  );
}

export default PortDashboardContainer;
