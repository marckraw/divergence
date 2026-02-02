export type TmuxSessionKind = "project" | "divergence";

const MAX_SESSION_NAME_LENGTH = 120;

export function sanitizeTmuxLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

interface TmuxSessionNameInput {
  type: TmuxSessionKind;
  projectName: string;
  projectId: number;
  divergenceId?: number;
  branch?: string;
}

export function buildTmuxSessionName(input: TmuxSessionNameInput): string {
  const projectLabel = sanitizeTmuxLabel(input.projectName) || "project";
  const kindLabel = input.type === "divergence" ? "branch" : "project";
  const parts = ["divergence", kindLabel, projectLabel];

  if (input.type === "divergence") {
    const branchLabel = input.branch ? sanitizeTmuxLabel(input.branch) : "branch";
    if (branchLabel) {
      parts.push(branchLabel);
    }
  }

  const idPart = input.type === "divergence"
    ? String(input.divergenceId ?? input.projectId)
    : String(input.projectId);
  parts.push(idPart);

  let name = parts.filter(Boolean).join("-");

  if (name.length > MAX_SESSION_NAME_LENGTH) {
    const trimmedPrefixLength = Math.max(1, MAX_SESSION_NAME_LENGTH - (idPart.length + 1));
    const prefix = parts.slice(0, -1).join("-");
    const trimmedPrefix = prefix.slice(0, trimmedPrefixLength);
    name = `${trimmedPrefix}-${idPart}`;
  }

  return name;
}

export function buildLegacyTmuxSessionName(sessionId: string): string {
  return `divergence-${sessionId}`;
}
