import { useCallback, useState } from "react";
import MergeNotificationPresentational from "./MergeNotification.presentational";
import type { MergeNotificationProps } from "./MergeNotification.types";

function MergeNotificationContainer({
  divergence,
  projectName,
  onClose,
  onDeleteDivergence,
}: MergeNotificationProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onDeleteDivergence(divergence, "merge_notification");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsDeleting(false);
    }
  }, [divergence, onClose, onDeleteDivergence]);

  return (
    <MergeNotificationPresentational
      divergence={divergence}
      projectName={projectName}
      onClose={onClose}
      isDeleting={isDeleting}
      error={error}
      onDelete={handleDelete}
    />
  );
}

export default MergeNotificationContainer;
