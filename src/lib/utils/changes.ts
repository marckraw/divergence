import type { GitChangeEntry } from "../../entities";

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

export function sortGitChangesByPath(entries: GitChangeEntry[]): GitChangeEntry[] {
  return [...entries].sort((a, b) => a.path.localeCompare(b.path));
}
