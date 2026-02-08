import type { Divergence } from "../../../entities";

export interface MergeNotificationProps {
  divergence: Divergence;
  projectName: string;
  onClose: () => void;
  onDeleteDivergence: (divergence: Divergence, origin: string) => Promise<void>;
}

export interface MergeNotificationPresentationalProps {
  divergence: Divergence;
  projectName: string;
  onClose: () => void;
  isDeleting: boolean;
  error: string | null;
  onDelete: () => Promise<void>;
}
