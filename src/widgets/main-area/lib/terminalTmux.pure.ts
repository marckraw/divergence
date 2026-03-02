export const TMUX_BOOTSTRAP_TIMEOUT_MS = 15_000;
export const SHELL_BOOTSTRAP_TIMEOUT_MS = 20_000;

export function buildBootstrapTimeoutMessage(timeoutMs: number): string {
  const seconds = Math.round(timeoutMs / 1000);
  return `[tmux bootstrap did not respond within ${seconds}s. Terminal startup may be stalled.]`;
}

export function sanitizeTmuxSessionNameForShell(
  tmuxSessionName: string | undefined,
  sessionId: string
): string {
  return (tmuxSessionName || `divergence-${sessionId}`).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function buildTmuxBootstrapCommand(): string {
  return `
TMUX_BIN="$(command -v tmux 2>/dev/null || true)"
if [ -z "$TMUX_BIN" ]; then
  for CANDIDATE in /opt/homebrew/bin/tmux /usr/local/bin/tmux /opt/local/bin/tmux /usr/bin/tmux /bin/tmux; do
    if [ -x "$CANDIDATE" ]; then
      TMUX_BIN="$CANDIDATE"
      break
    fi
  done
fi

if [ -n "$TMUX_BIN" ]; then
  COPY_CMD=""
  SESSION_EXISTS=1
  if command -v pbcopy >/dev/null 2>&1; then
    COPY_CMD="pbcopy"
  elif command -v wl-copy >/dev/null 2>&1; then
    COPY_CMD="wl-copy"
  elif command -v xclip >/dev/null 2>&1; then
    COPY_CMD="xclip -selection clipboard"
  elif command -v xsel >/dev/null 2>&1; then
    COPY_CMD="xsel --clipboard --input"
  fi

  if ! "$TMUX_BIN" has-session -t "$DIVERGENCE_TMUX_SESSION" 2>/dev/null; then
    SESSION_EXISTS=0
    "$TMUX_BIN" new-session -d -s "$DIVERGENCE_TMUX_SESSION" -c "$DIVERGENCE_TMUX_CWD"
  fi

  if [ "$SESSION_EXISTS" -eq 0 ]; then
    "$TMUX_BIN" set-option -q -t "$DIVERGENCE_TMUX_SESSION" history-limit "$DIVERGENCE_TMUX_HISTORY_LIMIT"
  fi

  "$TMUX_BIN" set-environment -t "$DIVERGENCE_TMUX_SESSION" DIVERGENCE_APP 1

  if [ "$("$TMUX_BIN" show-options -gqv @divergence_bootstrap_initialized)" != "1" ]; then
    "$TMUX_BIN" set-option -gq mouse on
    if [ -n "$COPY_CMD" ]; then
      "$TMUX_BIN" set-option -gq set-clipboard on
      "$TMUX_BIN" bind-key -T copy-mode-vi MouseDragEnd1Pane send -X copy-pipe-and-cancel "$COPY_CMD"
      "$TMUX_BIN" bind-key -T copy-mode MouseDragEnd1Pane send -X copy-pipe-and-cancel "$COPY_CMD"
      "$TMUX_BIN" bind-key -T copy-mode-vi Enter send -X copy-pipe-and-cancel "$COPY_CMD"
      "$TMUX_BIN" bind-key -T copy-mode Enter send -X copy-pipe-and-cancel "$COPY_CMD"
    fi
    "$TMUX_BIN" set-option -gq @divergence_bootstrap_initialized 1
  fi

  exec "$TMUX_BIN" attach-session -t "$DIVERGENCE_TMUX_SESSION"
else
  echo "tmux not found, starting zsh"
  exec /bin/zsh -l -i
fi
      `.trim();
}
