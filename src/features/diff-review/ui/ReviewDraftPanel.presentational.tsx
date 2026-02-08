import { buildAnchorLabel } from "../lib/diffReview.pure";
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
        {error && (
          <div className="px-2 py-2 text-xs text-red bg-red/10 border border-red/30 rounded">
            {error}
          </div>
        )}

        {comments.length === 0 ? (
          <div className="text-xs text-subtext text-center py-6 border border-dashed border-surface rounded">
            No inline comments yet.
          </div>
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
                      <button
                        type="button"
                        className="text-subtext hover:text-red"
                        onClick={() => onRemoveComment(comment.id)}
                      >
                        Remove
                      </button>
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
          <textarea
            value={finalComment}
            onChange={(event) => onFinalCommentChange(event.target.value)}
            rows={4}
            className="w-full px-2 py-2 bg-main border border-surface rounded text-xs text-text focus:outline-none focus:border-accent"
            placeholder="Overall guidance for the agent..."
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-subtext">Agent</label>
          <select
            value={selectedAgent}
            onChange={(event) => onAgentChange(event.target.value as typeof selectedAgent)}
            className="flex-1 px-2 py-1.5 bg-main border border-surface rounded text-xs text-text"
          >
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={isRunning || (!comments.length && finalComment.trim().length === 0)}
            className="flex-1 px-3 py-2 text-xs border border-surface rounded text-subtext hover:text-text disabled:opacity-50"
          >
            Clear Draft
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || !canRun}
            className="flex-1 px-3 py-2 text-xs bg-accent text-main rounded hover:bg-accent/80 disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewDraftPanelPresentational;
