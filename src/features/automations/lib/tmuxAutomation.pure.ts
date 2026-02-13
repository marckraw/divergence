import { sanitizeTmuxLabel } from "../../../shared";
import type { AutomationResultFile } from "./tmuxAutomation.types";

const AUTOMATION_SESSION_PREFIX = "divergence-auto";

export function buildAutomationTmuxSessionName(
  automationId: number,
  runId: number
): string {
  return `${AUTOMATION_SESSION_PREFIX}-${automationId}-${runId}`;
}

export function isAutomationSessionName(name: string): boolean {
  return name.startsWith(`${AUTOMATION_SESSION_PREFIX}-`);
}

export function buildAutomationLogPath(
  projectPath: string,
  runId: number
): string {
  return `${projectPath}/.divergence/automation-runs/${runId}.log`;
}

export function buildAutomationResultPath(
  projectPath: string,
  runId: number
): string {
  return `${projectPath}/.divergence/automation-runs/${runId}.result.json`;
}

export function buildWrapperCommand(options: {
  agentCommand: string;
  logPath: string;
  resultPath: string;
  metadata?: {
    automationName?: string;
    runId?: number;
    automationId?: number;
    projectName?: string;
    projectPath?: string;
    divergencePath?: string;
    agent?: string;
    triggerSource?: string;
    briefPath?: string;
  };
}): string {
  const { agentCommand, logPath, resultPath, metadata } = options;
  const resultDir = resultPath.substring(0, resultPath.lastIndexOf("/"));

  const escapedLogPath = shellEscape(logPath);
  const escapedResultPath = shellEscape(resultPath);
  const escapedResultDir = shellEscape(resultDir);

  const headerLines: string[] = [
    "# ── Divergence Automation Run ──",
  ];
  if (metadata) {
    if (metadata.automationName) headerLines.push(`# Automation : ${metadata.automationName}`);
    if (metadata.runId != null) headerLines.push(`# Run ID     : ${metadata.runId}`);
    if (metadata.automationId != null) headerLines.push(`# Auto ID    : ${metadata.automationId}`);
    if (metadata.projectName) headerLines.push(`# Project    : ${metadata.projectName}`);
    if (metadata.projectPath) headerLines.push(`# Workspace  : ${metadata.projectPath}`);
    if (metadata.agent) headerLines.push(`# Agent      : ${metadata.agent}`);
    if (metadata.triggerSource) headerLines.push(`# Trigger    : ${metadata.triggerSource}`);
    if (metadata.briefPath) headerLines.push(`# Brief      : ${metadata.briefPath}`);
  }
  headerLines.push(`# Log file   : ${logPath}`);
  headerLines.push(`# Result file: ${resultPath}`);
  headerLines.push(`# Command    : ${agentCommand}`);
  headerLines.push("# ──────────────────────────────");

  // Written to a script file by the Rust backend, so newlines are fine.
  // Disable pipefail so the tee pipe doesn't mask the agent exit code.
  return [
    `set +o pipefail`,
    `mkdir -p ${escapedResultDir}`,
    ``,
    // Write a metadata header into the log file before running
    ...headerLines.map((line) => `echo ${shellEscape(line)} >> ${escapedLogPath}`),
    `echo "" >> ${escapedLogPath}`,
    ``,
    `_DIV_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"`,
    `echo "# Started at: $_DIV_START" >> ${escapedLogPath}`,
    `echo "# ── Agent output below ──" >> ${escapedLogPath}`,
    `echo "" >> ${escapedLogPath}`,
    ``,
    `${agentCommand} 2>&1 | tee -a ${escapedLogPath}`,
    `_DIV_EXIT="\${PIPESTATUS[0]}"`,
    ``,
    `_DIV_END="$(date -u +%Y-%m-%dT%H:%M:%SZ)"`,
    `echo "" >> ${escapedLogPath}`,
    `echo "# ── Agent finished ──" >> ${escapedLogPath}`,
    `echo "# Finished at: $_DIV_END" >> ${escapedLogPath}`,
    `echo "# Exit code  : $_DIV_EXIT" >> ${escapedLogPath}`,
    ``,
    `printf '{"status":"completed","exitCode":%d,"startedAt":"%s","finishedAt":"%s"}' "$_DIV_EXIT" "$_DIV_START" "$_DIV_END" > ${escapedResultPath}`,
    `exit "$_DIV_EXIT"`,
  ].join("\n");
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function parseAutomationResult(
  json: string
): AutomationResultFile | null {
  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      parsed.status === "completed" &&
      typeof parsed.exitCode === "number" &&
      typeof parsed.startedAt === "string" &&
      typeof parsed.finishedAt === "string"
    ) {
      return parsed as AutomationResultFile;
    }
    return null;
  } catch {
    return null;
  }
}

export { sanitizeTmuxLabel };
