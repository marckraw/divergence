import {
  Button,
  EmptyState,
  ErrorBanner,
  Textarea,
} from "../../../shared";
import type {
  GithubPrChatAgent,
  GithubPrChatMessage,
} from "../model/githubPrChat.types";

interface GithubPrChatSidebarPresentationalProps {
  messages: GithubPrChatMessage[];
  draft: string;
  selectedAgent: GithubPrChatAgent;
  includeAllPatches: boolean;
  sending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSelectedAgentChange: (value: GithubPrChatAgent) => void;
  onIncludeAllPatchesChange: (value: boolean) => void;
  onSend: () => Promise<boolean>;
  onClear: () => void;
}

function formatMessageTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function GithubPrChatSidebarPresentational({
  messages,
  draft,
  selectedAgent,
  includeAllPatches,
  sending,
  error,
  onDraftChange,
  onSelectedAgentChange,
  onIncludeAllPatchesChange,
  onSend,
  onClear,
}: GithubPrChatSidebarPresentationalProps) {
  const canSend = !sending && draft.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="px-3 py-3 border-b border-surface space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text">Talk to your PR</h3>
            <p className="text-xs text-subtext">Ask about code changes, risks, and intent.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClear}
            disabled={sending || messages.length === 0}
          >
            Clear
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <label className="text-xs text-subtext flex flex-col gap-1">
            Agent
            <select
              value={selectedAgent}
              onChange={(event) => onSelectedAgentChange(event.target.value as GithubPrChatAgent)}
              className="h-9 rounded border border-surface bg-main px-2 text-sm text-text"
              disabled={sending}
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
          </label>
          <label className="text-xs text-subtext inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeAllPatches}
              onChange={(event) => onIncludeAllPatchesChange(event.target.checked)}
              disabled={sending}
            />
            Include all changed file patches
          </label>
        </div>

        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) {
              return;
            }
            if (!event.metaKey && !event.ctrlKey) {
              return;
            }
            event.preventDefault();
            if (canSend) {
              void onSend();
            }
          }}
          placeholder="Ask a question about this pull request..."
          className="min-h-[86px] text-sm"
        />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!canSend}
            onClick={() => { void onSend(); }}
          >
            {sending ? "Thinking..." : "Send"}
          </Button>
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <EmptyState bordered className="bg-main/40">
            Start with “Summarize this PR” or “What are the risky changes?”.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`rounded-md border p-2 space-y-1 ${
                    isUser
                      ? "border-accent/30 bg-accent/10"
                      : message.status === "error"
                        ? "border-red/30 bg-red/10"
                        : "border-surface bg-main/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className={isUser ? "text-accent" : "text-subtext"}>
                      {isUser ? "You" : "AI"}
                    </span>
                    <span className="text-subtext">{formatMessageTime(message.createdAtMs)}</span>
                  </div>
                  <pre className="text-xs text-text whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {message.content}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default GithubPrChatSidebarPresentational;
