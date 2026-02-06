export function sanitizeTmuxSessionNameForShell(
  tmuxSessionName: string | undefined,
  sessionId: string
): string {
  return (tmuxSessionName || `divergence-${sessionId}`).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function buildTmuxBootstrapCommand(): string {
  return `
if command -v tmux >/dev/null 2>&1; then
  COPY_CMD=""
  if command -v pbcopy >/dev/null 2>&1; then
    COPY_CMD="pbcopy"
  elif command -v wl-copy >/dev/null 2>&1; then
    COPY_CMD="wl-copy"
  elif command -v xclip >/dev/null 2>&1; then
    COPY_CMD="xclip -selection clipboard"
  elif command -v xsel >/dev/null 2>&1; then
    COPY_CMD="xsel --clipboard --input"
  fi

  if tmux has-session -t "$DIVERGENCE_TMUX_SESSION" 2>/dev/null; then
    tmux set -t "$DIVERGENCE_TMUX_SESSION" history-limit "$DIVERGENCE_TMUX_HISTORY_LIMIT"
  else
    tmux new-session -d -s "$DIVERGENCE_TMUX_SESSION" -c "$DIVERGENCE_TMUX_CWD"
    tmux set -t "$DIVERGENCE_TMUX_SESSION" history-limit "$DIVERGENCE_TMUX_HISTORY_LIMIT"
  fi

  tmux set-environment -t "$DIVERGENCE_TMUX_SESSION" DIVERGENCE_APP 1
  tmux set -g mouse on

  if [ -n "$COPY_CMD" ]; then
    tmux set -g set-clipboard on
    tmux bind -T copy-mode-vi MouseDragEnd1Pane send -X copy-pipe-and-cancel "$COPY_CMD"
    tmux bind -T copy-mode MouseDragEnd1Pane send -X copy-pipe-and-cancel "$COPY_CMD"
    tmux bind -T copy-mode-vi Enter send -X copy-pipe-and-cancel "$COPY_CMD"
    tmux bind -T copy-mode Enter send -X copy-pipe-and-cancel "$COPY_CMD"
  fi

  exec tmux attach -t "$DIVERGENCE_TMUX_SESSION"
else
  echo "tmux not found, starting zsh"
  exec /bin/zsh -l -i
fi
      `.trim();
}
