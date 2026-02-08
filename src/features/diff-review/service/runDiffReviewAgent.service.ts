import type { DiffReviewDraft } from "../model/diffReview.types";
import { buildReviewBriefMarkdown } from "../lib/diffReview.pure";

export interface ReviewCommandTemplateTokens {
  workspacePath: string;
  briefPath: string;
}

export function renderReviewAgentCommand(
  template: string,
  tokens: ReviewCommandTemplateTokens
): string {
  return template
    .split("{workspacePath}").join(tokens.workspacePath)
    .split("{briefPath}").join(tokens.briefPath);
}

export function canRunReviewDraft(draft: DiffReviewDraft | null): boolean {
  if (!draft) {
    return false;
  }

  if (draft.comments.length > 0) {
    return true;
  }

  return draft.finalComment.trim().length > 0;
}

export function createReviewBriefForDraft(draft: DiffReviewDraft): string {
  return buildReviewBriefMarkdown({
    workspacePath: draft.workspacePath,
    mode: draft.mode,
    comments: draft.comments,
    finalComment: draft.finalComment,
  });
}
