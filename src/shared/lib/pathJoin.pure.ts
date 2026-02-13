/**
 * Join a parent path and child segment with the correct separator.
 *
 * If the child starts with a path separator it is treated as absolute and
 * returned unchanged. Otherwise the platform separator is inferred from
 * the parent path (backslash on Windows-style paths, forward slash otherwise).
 */
export function joinPath(parent: string, child: string): string {
  const cleanChild = child.replace(/^[/\\]+/, "");
  if (!cleanChild) {
    return parent;
  }
  if (child.startsWith("/") || child.startsWith("\\")) {
    return child;
  }
  if (parent.endsWith("/") || parent.endsWith("\\")) {
    return `${parent}${cleanChild}`;
  }
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent}${separator}${cleanChild}`;
}
