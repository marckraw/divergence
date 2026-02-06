import type { TerminalSession } from "../../entities";

export function joinSessionPath(parent: string, child: string): string {
  if (child.startsWith("/") || child.startsWith("\\")) {
    return child;
  }
  if (parent.endsWith("/") || parent.endsWith("\\")) {
    return `${parent}${child}`;
  }
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent}${separator}${child}`;
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

export function getAggregatedTerminalStatus(entry: {
  pane1: TerminalSession["status"];
  pane2: TerminalSession["status"];
}): TerminalSession["status"] {
  if (entry.pane1 === "busy" || entry.pane2 === "busy") {
    return "busy";
  }
  if (entry.pane1 === "active" || entry.pane2 === "active") {
    return "active";
  }
  return "idle";
}
