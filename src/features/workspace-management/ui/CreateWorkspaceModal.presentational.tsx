import { motion } from "framer-motion";
import type { CreateWorkspaceModalPresentationalProps } from "./CreateWorkspaceModal.types";

function CreateWorkspaceModalPresentational({
  name,
  description,
  selectedProjectIds,
  projects,
  isSubmitting,
  error,
  onNameChange,
  onDescriptionChange,
  onToggleProject,
  onSubmit,
  onClose,
}: CreateWorkspaceModalPresentationalProps) {
  const canSubmit = name.trim().length > 0 && selectedProjectIds.size >= 2 && !isSubmitting;

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
          <h2 className="text-lg font-semibold text-text">Create Workspace</h2>
          <p className="text-xs text-subtext mt-1">
            Group multiple projects into a shared workspace with AI agent context.
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-text mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="My Workspace"
              className="w-full px-3 py-2 bg-surface border border-surface rounded text-sm text-text placeholder:text-subtext focus:outline-none focus:ring-1 focus:ring-accent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-text mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What this workspace is for..."
              rows={2}
              className="w-full px-3 py-2 bg-surface border border-surface rounded text-sm text-text placeholder:text-subtext focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text mb-1">
              Select Projects ({selectedProjectIds.size} selected, min 2)
            </label>
            <div className="max-h-48 overflow-y-auto border border-surface rounded">
              {projects.length === 0 ? (
                <div className="p-3 text-center text-subtext text-sm">
                  No projects available
                </div>
              ) : (
                projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-surface/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.has(project.id)}
                      onChange={() => onToggleProject(project.id)}
                      className="rounded border-surface text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-text truncate">{project.name}</span>
                  </label>
                ))
              )}
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
            {isSubmitting ? "Creating..." : "Create Workspace"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CreateWorkspaceModalPresentational;
