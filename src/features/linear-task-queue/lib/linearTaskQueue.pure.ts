import type { LinearProjectIssue } from "../../../shared";

const DEFAULT_DESCRIPTION_MAX_CHARS = 320;

export function truncateLinearIssueDescription(
  description: string | null,
  maxChars: number = DEFAULT_DESCRIPTION_MAX_CHARS,
): string | null {
  const trimmed = description?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxChars).trimEnd()}...`;
}

export function buildLinearIssuePrompt(
  issue: Pick<LinearProjectIssue, "identifier" | "title" | "description" | "stateName" | "url">,
): string {
  const sections: string[] = [
    `Please work on Linear issue ${issue.identifier}: ${issue.title}`,
  ];

  if (issue.stateName?.trim()) {
    sections.push(`Current state: ${issue.stateName.trim()}`);
  }

  if (issue.url?.trim()) {
    sections.push(`Issue URL: ${issue.url.trim()}`);
  }

  const description = issue.description?.trim();
  if (description) {
    sections.push(`Issue description:\n${description}`);
  }

  return sections.join("\n\n");
}
