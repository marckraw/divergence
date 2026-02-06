import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FAST_EASE_OUT, OVERLAY_FADE, SOFT_SPRING, getPopVariants } from "../../../lib/motion";
import type { CreateDivergenceModalPresentationalProps } from "./CreateDivergenceModal.types";

function CreateDivergenceModalPresentational({
  project,
  onClose,
  branchName,
  useExistingBranch,
  remoteBranches,
  loadingBranches,
  isCreating,
  error,
  validationError,
  onBranchNameChange,
  onUseExistingBranchChange,
  onCreateClick,
  onInputKeyDown,
  onOverlayClick,
  onPanelClick,
}: CreateDivergenceModalPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const panelVariants = useMemo(
    () => getPopVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onOverlayClick}
      variants={OVERLAY_FADE}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={FAST_EASE_OUT}
    >
      <motion.div
        className="bg-sidebar border border-surface rounded-lg shadow-xl w-96 p-4"
        onClick={onPanelClick}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={panelTransition}
      >
        <h2 className="text-lg font-semibold text-text mb-4">Create Divergence</h2>

        <div className="mb-4">
          <label className="block text-sm text-subtext mb-1">Project</label>
          <div className="text-text">{project.name}</div>
          <div className="text-xs text-subtext truncate">{project.path}</div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-subtext mb-1">Branch Name</label>
          <input
            type="text"
            value={branchName}
            onChange={(event) => onBranchNameChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="feature/my-feature"
            list={useExistingBranch ? "remote-branches" : undefined}
            className="w-full px-3 py-2 bg-main border border-surface rounded text-text placeholder-subtext focus:outline-none focus:border-accent"
            autoFocus
            disabled={isCreating}
          />
          {useExistingBranch && (
            <datalist id="remote-branches">
              {remoteBranches.map((branch) => (
                <option value={branch} key={branch} />
              ))}
            </datalist>
          )}
        </div>

        <div className="mb-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={useExistingBranch}
            onChange={(event) => onUseExistingBranchChange(event.target.checked)}
            className="mt-1 accent-accent"
            disabled={isCreating}
          />
          <div>
            <p className="text-sm text-text">Use existing branch from origin</p>
            <p className="text-xs text-subtext">
              When enabled, Divergence checks out the remote branch instead of creating a new one.
            </p>
            {useExistingBranch && loadingBranches && (
              <p className="text-xs text-subtext mt-1">Loading remote branches...</p>
            )}
          </div>
        </div>

        {isCreating && (
          <div className="mb-4">
            <div className="text-xs text-subtext mb-2">Creating divergence...</div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-accent progress-indeterminate" />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 px-3 py-2 bg-red/10 border border-red/30 rounded text-red text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-subtext hover:text-text"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void onCreateClick();
            }}
            disabled={isCreating || Boolean(validationError)}
            className="px-4 py-2 bg-accent text-main text-sm rounded hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CreateDivergenceModalPresentational;
