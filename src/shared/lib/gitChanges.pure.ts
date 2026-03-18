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

export function normalizeGitChangePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function getRelativePathFromRoot(rootPath: string, absolutePath: string): string | null {
  if (!absolutePath.startsWith(rootPath)) {
    return null;
  }
  let relative = absolutePath.slice(rootPath.length);
  if (relative.startsWith("/") || relative.startsWith("\\")) {
    relative = relative.slice(1);
  }
  return relative;
}

export function sortGitChangesByPath<T extends { path: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    if (left.path < right.path) return -1;
    if (left.path > right.path) return 1;
    return 0;
  });
}
