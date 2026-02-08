import { useMemo } from "react";
import { groupCommentsByFile } from "../lib/diffReview.pure";
import ReviewDraftPanelPresentational from "./ReviewDraftPanel.presentational";
import type { ReviewDraftPanelProps } from "./ReviewDraftPanel.types";

function ReviewDraftPanelContainer(props: ReviewDraftPanelProps) {
  const groupedComments = useMemo(
    () => groupCommentsByFile(props.comments),
    [props.comments]
  );

  const canRun = props.comments.length > 0 || props.finalComment.trim().length > 0;

  return (
    <ReviewDraftPanelPresentational
      {...props}
      groupedComments={groupedComments}
      canRun={canRun}
    />
  );
}

export default ReviewDraftPanelContainer;
