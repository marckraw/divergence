import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, useReducedMotion } from "framer-motion";
import type { Divergence } from "../types";
import { buildTmuxSessionName, buildLegacyTmuxSessionName, buildSplitTmuxSessionName } from "../lib/tmux";
import { FAST_EASE_OUT, SOFT_SPRING, getSlideInRightVariants } from "../lib/motion";

interface MergeNotificationProps {
  divergence: Divergence;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
}

function MergeNotification({ divergence, projectName, onClose, onDeleted }: MergeNotificationProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const toastVariants = useMemo(
    () => getSlideInRightVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const toastTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      // Delete the directory
      await invoke("delete_divergence", { path: divergence.path });
      const divergenceSessionName = buildTmuxSessionName({
        type: "divergence",
        projectName,
        projectId: divergence.project_id,
        divergenceId: divergence.id,
        branch: divergence.branch,
      });
      await invoke("kill_tmux_session", { sessionName: divergenceSessionName });
      await invoke("kill_tmux_session", {
        sessionName: buildSplitTmuxSessionName(divergenceSessionName, "pane-2"),
      });
      await invoke("kill_tmux_session", {
        sessionName: buildLegacyTmuxSessionName(`divergence-${divergence.id}`),
      });

      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsDeleting(false);
    }
  }, [divergence, projectName, onDeleted, onClose]);

  return (
    <motion.div
      className="fixed bottom-4 right-4 bg-sidebar border border-surface rounded-lg shadow-xl max-w-md z-50"
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={toastTransition}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Success icon */}
          <div className="w-10 h-10 rounded-full bg-green/20 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-green"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-text font-medium">Branch Merged!</h3>
            <p className="text-sm text-subtext mt-1">
              <span className="text-accent">{divergence.branch}</span> has been merged.
            </p>
            <p className="text-xs text-subtext mt-0.5">
              From: {projectName}
            </p>

            {error && (
              <p className="text-xs text-red mt-2">{error}</p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-subtext hover:text-text p-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm text-subtext hover:text-text border border-surface rounded hover:bg-surface/50"
            disabled={isDeleting}
          >
            Keep
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-3 py-2 text-sm bg-red/20 text-red hover:bg-red/30 rounded disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Divergence"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default MergeNotification;
