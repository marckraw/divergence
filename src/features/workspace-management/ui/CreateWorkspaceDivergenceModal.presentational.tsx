import { motion } from "framer-motion";
import type { CreateWorkspaceDivergenceModalPresentationalProps } from "./CreateWorkspaceDivergenceModal.types";

function CreateWorkspaceDivergenceModalPresentational({
  workspace,
  memberProjects,
  branchName,
  useExistingBranch,
  isSubmitting,
  error,
  onBranchNameChange,
  onUseExistingBranchChange,
  onSubmit,
  onClose,
}: CreateWorkspaceDivergenceModalPresentationalProps) {
  const canSubmit = branchName.trim().length > 0 && memberProjects.length > 0 && !isSubmitting;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-main border border-surface rounded-lg shadow-xl w-full max-w-md mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-surface">
          <h2 className="text-lg font-semibold text-text">Create Workspace Divergences</h2>
          <p className="text-xs text-subtext mt-1">
            Create divergences for all projects in &quot;{workspace.name}&quot;
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-text mb-1">Branch Name</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => onBranchNameChange(e.target.value)}
              placeholder="feat/my-feature"
              className="w-full px-3 py-2 bg-surface border border-surface rounded text-sm text-text placeholder:text-subtext focus:outline-none focus:ring-1 focus:ring-accent"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useExistingBranch}
              onChange={(e) => onUseExistingBranchChange(e.target.checked)}
              className="rounded border-surface text-accent focus:ring-accent"
            />
            <span className="text-sm text-text">Use existing branch (if available)</span>
          </label>

          <div>
            <label className="block text-sm text-text mb-1">
              Projects ({memberProjects.length})
            </label>
            <div className="max-h-32 overflow-y-auto border border-surface rounded">
              {memberProjects.map((project) => (
                <div
                  key={project.id}
                  className="px-3 py-1.5 text-sm text-subtext border-b border-surface last:border-b-0"
                >
                  {project.name}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-red bg-red/10 border border-red/30 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surface flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-subtext hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-accent text-main text-sm rounded hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Creating..." : `Create ${memberProjects.length} Divergences`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CreateWorkspaceDivergenceModalPresentational;
