import { invoke } from "@tauri-apps/api/core";
import type { GitChangeEntry } from "../../../entities";

export interface BranchChangesResponse {
  base_ref: string | null;
  changes: GitChangeEntry[];
}

export interface GitDiffResponse {
  diff: string;
  isBinary: boolean;
}

export async function listBranchChanges(path: string): Promise<BranchChangesResponse> {
  return invoke<BranchChangesResponse>("list_branch_changes", { path });
}

export async function listGitChanges(path: string): Promise<GitChangeEntry[]> {
  return invoke<GitChangeEntry[]>("list_git_changes", { path });
}

export async function getBranchDiff(path: string, filePath: string): Promise<GitDiffResponse> {
  return invoke<GitDiffResponse>("get_branch_diff", {
    path,
    filePath,
  });
}

export async function getWorkingDiff(path: string, filePath: string): Promise<GitDiffResponse> {
  return invoke<GitDiffResponse>("get_git_diff", {
    path,
    filePath,
    mode: "working",
  });
}
