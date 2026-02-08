import type { DiffReviewAgent, DiffReviewComment } from "../model/diffReview.types";

export interface ReviewDraftPanelProps {
  workspacePath: string | null;
  comments: DiffReviewComment[];
  finalComment: string;
  selectedAgent: DiffReviewAgent;
  isRunning: boolean;
  error: string | null;
  onRemoveComment: (commentId: string) => void;
  onFinalCommentChange: (value: string) => void;
  onAgentChange: (agent: DiffReviewAgent) => void;
  onRun: () => void;
  onClear: () => void;
}

export interface ReviewDraftPanelPresentationalProps extends ReviewDraftPanelProps {
  groupedComments: Array<{
    filePath: string;
    comments: DiffReviewComment[];
  }>;
  canRun: boolean;
}
