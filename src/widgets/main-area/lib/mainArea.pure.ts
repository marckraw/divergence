import type { TerminalSession } from "../../../entities";

export function joinSessionPath(parent: string, child: string): string {
  const normalizedChild = child.replace(/^[/\\]+/, "");
  if (!normalizedChild) {
    return parent;
  }
  if (parent.endsWith("/") || parent.endsWith("\\")) {
    return `${parent}${normalizedChild}`;
  }
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent}${separator}${normalizedChild}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function getAggregatedTerminalStatus(
  statuses: TerminalSession["status"][],
): TerminalSession["status"] {
  if (statuses.some((status) => status === "busy")) {
    return "busy";
  }
  if (statuses.some((status) => status === "active")) {
    return "active";
  }
  return "idle";
}
