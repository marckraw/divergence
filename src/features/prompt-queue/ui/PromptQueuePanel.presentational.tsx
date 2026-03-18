import type { PromptQueueItemRow } from "../../../entities/prompt-queue";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Textarea,
} from "../../../shared";

export interface PromptQueuePanelProps {
  items: PromptQueueItemRow[];
  draft: string;
  loading: boolean;
  error: string | null;
  queueing: boolean;
  actionItemId: number | null;
  sendingItemId: number | null;
  onDraftChange: (value: string) => void;
  onQueuePrompt: () => Promise<void>;
  onSendItem: (itemId: number) => Promise<void>;
  onRemoveItem: (itemId: number) => Promise<void>;
  onClear: () => Promise<void>;
}

function formatDateTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString();
}

function PromptQueuePanel({
  items,
  draft,
  loading,
  error,
  queueing,
  actionItemId,
  sendingItemId,
  onDraftChange,
  onQueuePrompt,
  onSendItem,
  onRemoveItem,
  onClear,
}: PromptQueuePanelProps) {
  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="p-3 border-b border-surface space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text">Prompt Queue</h3>
            <p className="text-xs text-subtext">Queue prompts and send them to the active session.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={items.length === 0 || loading || queueing}
            onClick={() => {
              void onClear();
            }}
          >
            Clear
          </Button>
        </div>

        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add a prompt idea to send later..."
          className="min-h-[110px] text-sm"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-subtext">{items.length} queued</span>
          <Button
            variant="primary"
            size="sm"
            disabled={queueing || !draft.trim()}
            onClick={() => {
              void onQueuePrompt();
            }}
          >
            {queueing ? "Queueing..." : "Queue prompt"}
          </Button>
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs text-subtext">Loading queue...</p>
        ) : items.length === 0 ? (
          <EmptyState bordered className="bg-main/40">Queue is empty.</EmptyState>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isSending = sendingItemId === item.id;
              const isActing = actionItemId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-md border border-surface bg-main/40 p-3 space-y-2"
                >
                  <pre className="text-xs text-text whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {item.prompt}
                  </pre>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-subtext">{formatDateTime(item.createdAtMs)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isSending || isActing}
                        onClick={() => {
                          void onSendItem(item.id);
                        }}
                      >
                        {isSending ? "Sending..." : "Send"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isSending || isActing}
                        onClick={() => {
                          void onRemoveItem(item.id);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PromptQueuePanel;
