import { useCallback, useEffect, useRef, useState } from "react";
import type { Divergence } from "../../../entities";
import {
  checkBranchStatus,
  markDivergenceAsDiverged,
} from "../api/mergeDetection.api";
import type { MergeNotificationData } from "./mergeDetection.types";

export function useMergeDetection(
  divergences: Divergence[],
  projectsById: Map<number, { name: string }>,
  onMergeDetected?: (notification: MergeNotificationData) => void
) {
  const [mergedDivergences, setMergedDivergences] = useState<Set<number>>(new Set());
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkedRef = useRef<Set<number>>(new Set());
  const divergedRef = useRef<Set<number>>(new Set());

  const checkDivergence = useCallback(async (divergence: Divergence) => {
    if (checkedRef.current.has(divergence.id) || mergedDivergences.has(divergence.id)) {
      return;
    }

    try {
      const status = await checkBranchStatus(divergence.path, divergence.branch);

      const hasDiverged = Boolean(divergence.has_diverged)
        || divergedRef.current.has(divergence.id)
        || status.diverged;

      if (status.diverged && !divergence.has_diverged) {
        divergedRef.current.add(divergence.id);
        try {
          await markDivergenceAsDiverged(divergence.id);
        } catch (err) {
          console.warn("Failed to update divergence has_diverged flag:", err);
        }
      }

      if (status.merged && hasDiverged) {
        setMergedDivergences((previous) => new Set(previous).add(divergence.id));
        const project = projectsById.get(divergence.project_id);
        if (project && onMergeDetected) {
          onMergeDetected({
            divergence,
            projectName: project.name,
          });
        }
      }

      checkedRef.current.add(divergence.id);
    } catch (err) {
      console.error("Failed to check merge status:", err);
    }
  }, [mergedDivergences, onMergeDetected, projectsById]);

  const checkAllDivergences = useCallback(async () => {
    for (const divergence of divergences) {
      await checkDivergence(divergence);
    }
  }, [checkDivergence, divergences]);

  useEffect(() => {
    const handleFocus = () => {
      checkedRef.current.clear();
      void checkAllDivergences();
    };

    window.addEventListener("focus", handleFocus);

    void checkAllDivergences();

    checkIntervalRef.current = setInterval(() => {
      checkedRef.current.clear();
      void checkAllDivergences();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkAllDivergences]);

  const clearMergedStatus = useCallback((divergenceId: number) => {
    setMergedDivergences((previous) => {
      const next = new Set(previous);
      next.delete(divergenceId);
      return next;
    });
    checkedRef.current.delete(divergenceId);
  }, []);

  return {
    mergedDivergences,
    checkDivergence,
    checkAllDivergences,
    clearMergedStatus,
  };
}
