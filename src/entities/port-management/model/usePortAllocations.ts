import { useCallback, useEffect, useState } from "react";
import type { PortAllocation } from "./portAllocation.types";
import {
  listAllPortAllocations,
  listPortAllocationsForProject,
} from "../api/portAllocation.api";

export function usePortAllocations() {
  const [allocations, setAllocations] = useState<PortAllocation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAllPortAllocations();
      setAllocations(data);
    } catch (err) {
      console.warn("Failed to load port allocations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { allocations, loading, refresh };
}

export function useProjectPortAllocations(projectId: number | null) {
  const [allocations, setAllocations] = useState<PortAllocation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (projectId === null) {
      setAllocations([]);
      return;
    }
    try {
      setLoading(true);
      const data = await listPortAllocationsForProject(projectId);
      setAllocations(data);
    } catch (err) {
      console.warn("Failed to load project port allocations:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { allocations, loading, refresh };
}
