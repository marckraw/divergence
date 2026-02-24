import { Button, ErrorBanner, FormField, ModalFooter, ModalShell, TextInput, Textarea } from "../../../shared";
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
    <ModalShell
      onRequestClose={onClose}
      size="md"
      surface="main"
      panelClassName="w-full max-w-md mx-4"
    >
      <div className="p-4 border-b border-surface">
        <h2 className="text-lg font-semibold text-text">Create Workspace</h2>
        <p className="text-xs text-subtext mt-1">
          Group multiple projects into a shared workspace with AI agent context.
        </p>
      </div>

      <div className="p-4 space-y-4">
        <FormField label="Name" htmlFor="create-workspace-name">
          <TextInput
            id="create-workspace-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="My Workspace"
            tone="surface"
            autoFocus
          />
        </FormField>

        <FormField label="Description (optional)" htmlFor="create-workspace-description">
          <Textarea
            id="create-workspace-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What this workspace is for..."
            rows={2}
            tone="surface"
            className="resize-none"
          />
        </FormField>

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

        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>

      <ModalFooter className="p-4">
        <Button
          onClick={onClose}
          variant="ghost"
          size="md"
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!canSubmit}
          variant="primary"
          size="md"
        >
          {isSubmitting ? "Creating..." : "Create Workspace"}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}

export default CreateWorkspaceModalPresentational;
