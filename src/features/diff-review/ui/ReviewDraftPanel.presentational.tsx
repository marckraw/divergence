import { buildAnchorLabel } from "../lib/diffReview.pure";
import { Button, EmptyState, ErrorBanner, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "../../../shared";
import type { ReviewDraftPanelPresentationalProps } from "./ReviewDraftPanel.types";

function ReviewDraftPanelPresentational({
  workspacePath,
  groupedComments,
  comments,
  finalComment,
  selectedAgent,
  isRunning,
  error,
  canRun,
  onRemoveComment,
  onFinalCommentChange,
  onAgentChange,
  onRun,
  onClear,
}: ReviewDraftPanelPresentationalProps) {
  if (!workspacePath) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-subtext px-4 text-center">
        Select a session to start reviewing diffs.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-surface">
        <p className="text-xs text-subtext/70">Review Draft</p>
        <p className="text-[11px] text-subtext truncate">{workspacePath}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {error && <ErrorBanner className="px-2">{error}</ErrorBanner>}

        {comments.length === 0 ? (
          <EmptyState className="py-6 text-xs border border-dashed border-surface rounded">
            No inline comments yet.
          </EmptyState>
        ) : (
          groupedComments.map((group) => (
            <div key={group.filePath} className="border border-surface rounded">
              <div className="px-2 py-1.5 text-[11px] text-text border-b border-surface truncate">
                {group.filePath}
              </div>
              <div className="divide-y divide-surface/80">
                {group.comments.map((comment) => (
                  <div key={comment.id} className="px-2 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-subtext">{buildAnchorLabel(comment.anchor)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-subtext hover:text-red"
                        onClick={() => onRemoveComment(comment.id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <p className="text-text mt-1 whitespace-pre-wrap break-words">{comment.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-surface p-3 space-y-3">
        <div>
          <label className="block text-xs text-subtext mb-1">Final Comment</label>
          <Textarea
            value={finalComment}
            onChange={(event) => onFinalCommentChange(event.target.value)}
            rows={4}
            className="text-xs"
            placeholder="Overall guidance for the agent..."
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-subtext">Agent</label>
          <Select value={selectedAgent} onValueChange={(val) => onAgentChange(val as typeof selectedAgent)}>
            <SelectTrigger className="flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="codex">Codex</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={onClear}
            disabled={isRunning || (!comments.length && finalComment.trim().length === 0)}
            variant="secondary"
            size="sm"
            className="flex-1 px-3 py-2 text-xs border border-surface rounded text-subtext hover:text-text disabled:opacity-50"
          >
            Clear Draft
          </Button>
          <Button
            type="button"
            onClick={onRun}
            disabled={isRunning || !canRun}
            variant="primary"
            size="sm"
            className="flex-1 px-3 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/80 disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run Agent"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReviewDraftPanelPresentational;
