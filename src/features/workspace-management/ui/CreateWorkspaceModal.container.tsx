import { useState, useCallback } from "react";
import type { CreateWorkspaceModalContainerProps } from "./CreateWorkspaceModal.types";
import CreateWorkspaceModalPresentational from "./CreateWorkspaceModal.presentational";

function CreateWorkspaceModalContainer({
  projects,
  onClose,
  onCreate,
}: CreateWorkspaceModalContainerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleProject = useCallback((projectId: number) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || selectedProjectIds.size < 2) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreate(name.trim(), description.trim(), Array.from(selectedProjectIds));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, selectedProjectIds, onCreate, onClose]);

  return (
    <CreateWorkspaceModalPresentational
      name={name}
      description={description}
      selectedProjectIds={selectedProjectIds}
      projects={projects}
      isSubmitting={isSubmitting}
      error={error}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onToggleProject={handleToggleProject}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}

export default CreateWorkspaceModalContainer;
