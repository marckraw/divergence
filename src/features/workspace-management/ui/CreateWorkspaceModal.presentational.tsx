import { Button, CheckboxRow, ErrorBanner, FieldGroup, FormField, FormModalShell, TextInput, Textarea } from "../../../shared";
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
    <FormModalShell
      onRequestClose={onClose}
      size="md"
      surface="main"
      panelClassName="w-full max-w-md mx-4"
      title="Create Workspace"
      description="Group multiple projects into a shared workspace with AI agent context."
      body={(
        <div className="space-y-4">
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

        <FieldGroup title={`Select Projects (${selectedProjectIds.size} selected, min 2)`}>
          <div className="max-h-48 overflow-y-auto border border-surface rounded">
            {projects.length === 0 ? (
              <div className="p-3 text-center text-subtext text-sm">
                No projects available
              </div>
            ) : (
              projects.map((project) => (
                <CheckboxRow
                  key={project.id}
                  label={<span className="truncate">{project.name}</span>}
                  checked={selectedProjectIds.has(project.id)}
                  onChange={() => onToggleProject(project.id)}
                  className="px-3 py-2 hover:bg-surface/50 transition-colors"
                />
              ))
            )}
          </div>
        </FieldGroup>

        {error && <ErrorBanner>{error}</ErrorBanner>}
        </div>
      )}
      footer={(
        <>
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
        </>
      )}
    />
  );
}

export default CreateWorkspaceModalPresentational;
