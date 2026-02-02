import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { Divergence } from "../types";

interface MergeNotification {
  divergence: Divergence;
  projectName: string;
}

export function useMergeDetection(
  divergences: Divergence[],
  projectsById: Map<number, { name: string }>,
  onMergeDetected?: (notification: MergeNotification) => void
) {
  const [mergedDivergences, setMergedDivergences] = useState<Set<number>>(new Set());
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkedRef = useRef<Set<number>>(new Set());
  const divergedRef = useRef<Set<number>>(new Set());

  const checkDivergence = useCallback(async (divergence: Divergence) => {
    // Skip if already checked or marked as merged
    if (checkedRef.current.has(divergence.id) || mergedDivergences.has(divergence.id)) {
      return;
    }

    try {
      const status = await invoke<{ merged: boolean; diverged: boolean }>("check_branch_status", {
        path: divergence.path,
        branch: divergence.branch,
      });

      const hasDiverged = Boolean(divergence.has_diverged)
        || divergedRef.current.has(divergence.id)
        || status.diverged;

      if (status.diverged && !divergence.has_diverged) {
        divergedRef.current.add(divergence.id);
        try {
          const db = await Database.load("sqlite:divergence.db");
          await db.execute("UPDATE divergences SET has_diverged = 1 WHERE id = ?", [divergence.id]);
        } catch (err) {
          console.warn("Failed to update divergence has_diverged flag:", err);
        }
      }

      if (status.merged && hasDiverged) {
        setMergedDivergences(prev => new Set(prev).add(divergence.id));
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
  }, [mergedDivergences, projectsById, onMergeDetected]);

  const checkAllDivergences = useCallback(async () => {
    for (const divergence of divergences) {
      await checkDivergence(divergence);
    }
  }, [divergences, checkDivergence]);

  // Check on mount and when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      // Reset checked set to allow re-checking
      checkedRef.current.clear();
      checkAllDivergences();
    };

    window.addEventListener("focus", handleFocus);

    // Initial check
    checkAllDivergences();

    // Periodic check every 5 minutes
    checkIntervalRef.current = setInterval(() => {
      checkedRef.current.clear();
      checkAllDivergences();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkAllDivergences]);

  const clearMergedStatus = useCallback((divergenceId: number) => {
    setMergedDivergences(prev => {
      const next = new Set(prev);
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
