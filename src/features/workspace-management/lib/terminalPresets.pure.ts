export interface WorkspaceTerminalPreset {
  label: string;
  command: string;
}

export function buildWorkspaceTerminalPresets(
  workspaceName: string,
): WorkspaceTerminalPreset[] {
  return [
    {
      label: `Claude (${workspaceName})`,
      command: "claude",
    },
    {
      label: "Status (all repos)",
      command: "for dir in */; do echo \"\\n=== $dir ===\"; (cd \"$dir\" && git status -sb 2>/dev/null || echo 'not a git repo'); done",
    },
  ];
}
