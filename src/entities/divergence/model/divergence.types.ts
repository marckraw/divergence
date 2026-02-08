export interface Divergence {
  id: number;
  project_id: number;
  name: string;
  branch: string;
  path: string;
  created_at: string;
  has_diverged: number;
}

export type GitChangeStatus = "A" | "M" | "D" | "R" | "C" | "U" | "?";

export interface GitChangeEntry {
  path: string;
  old_path?: string;
  status: GitChangeStatus;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export type ChangesMode = "working" | "branch";
