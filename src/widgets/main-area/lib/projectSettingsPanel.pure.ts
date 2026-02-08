import type { RalphyConfigSummary } from "../../../shared/api/ralphyConfig.types";

export function parseSkipListInput(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatProviderLabel(providerType?: string): string {
  if (!providerType) {
    return "Unknown";
  }
  return `${providerType.charAt(0).toUpperCase()}${providerType.slice(1)}`;
}

export function formatRalphyProjectSummary(summary: RalphyConfigSummary): string {
  const parts: string[] = [];
  if (summary.project_name) {
    parts.push(summary.project_name);
  }
  if (summary.project_key) {
    parts.push(summary.project_key);
  }
  if (summary.project_id) {
    parts.push(summary.project_id);
  }
  if (summary.team_id) {
    parts.push(`team ${summary.team_id}`);
  }
  return parts.join(" · ");
}

export function formatRalphyLabelsSummary(summary: RalphyConfigSummary): string {
  const labels = summary.labels;
  if (!labels) {
    return "";
  }

  const parts: string[] = [];
  if (labels.candidate) {
    parts.push(`candidate: ${labels.candidate}`);
  }
  if (labels.ready) {
    parts.push(`ready: ${labels.ready}`);
  }
  if (labels.enriched) {
    parts.push(`enriched: ${labels.enriched}`);
  }
  if (labels.pr_feedback) {
    parts.push(`pr: ${labels.pr_feedback}`);
  }

  return parts.join(" · ");
}

export function formatRalphyClaudeSummary(summary: RalphyConfigSummary): string {
  const claude = summary.claude;
  if (!claude) {
    return "";
  }

  const parts: string[] = [];
  if (claude.model) {
    parts.push(claude.model);
  }
  if (claude.max_iterations) {
    parts.push(`${claude.max_iterations} iterations`);
  }

  return parts.join(" · ");
}

export function formatRalphyGithubSummary(summary: RalphyConfigSummary): string {
  const github = summary.integrations?.github;
  if (!github?.owner || !github.repo) {
    return "";
  }
  return `${github.owner}/${github.repo}`;
}
