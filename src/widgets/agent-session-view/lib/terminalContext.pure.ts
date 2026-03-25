export interface TerminalContextBlockInput {
  sourceSessionName: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  text: string;
}

function isFinitePositiveInteger(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function normalizeTerminalContextText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim();
}

export function formatTerminalContextLineRange(context: Pick<TerminalContextBlockInput, "lineStart" | "lineEnd">): string | null {
  const lineStart = context.lineStart ?? null;
  const lineEnd = context.lineEnd ?? null;
  if (!isFinitePositiveInteger(lineStart)) {
    return null;
  }

  if (!isFinitePositiveInteger(lineEnd) || lineEnd <= lineStart) {
    return `line ${lineStart}`;
  }

  return `lines ${lineStart}-${lineEnd}`;
}

function buildTerminalContextBody(context: TerminalContextBlockInput): string[] {
  const text = normalizeTerminalContextText(context.text);
  if (!text) {
    return [];
  }

  const lines = text.split("\n");
  const lineStart = context.lineStart ?? null;
  return lines.map((line, index) => {
    if (isFinitePositiveInteger(lineStart)) {
      return `  ${lineStart + index} | ${line}`;
    }

    return `  ${line}`;
  });
}

export function sanitizeTerminalContexts<T extends TerminalContextBlockInput>(
  contexts: T[],
): T[] {
  return contexts
    .map((context) => ({
      ...context,
      text: normalizeTerminalContextText(context.text),
    }))
    .filter((context) => context.text.length > 0);
}

export function buildTerminalContextBlock(contexts: TerminalContextBlockInput[]): string {
  const sanitizedContexts = sanitizeTerminalContexts(contexts);
  if (sanitizedContexts.length === 0) {
    return "";
  }

  const lines = ["<terminal_context>"];
  sanitizedContexts.forEach((context) => {
    const lineRange = formatTerminalContextLineRange(context);
    const heading = lineRange
      ? `- ${context.sourceSessionName} ${lineRange}:`
      : `- ${context.sourceSessionName}:`;
    lines.push(heading);
    lines.push(...buildTerminalContextBody(context));
  });
  lines.push("</terminal_context>");
  return lines.join("\n");
}

export function appendTerminalContextToPrompt(
  prompt: string,
  contexts: TerminalContextBlockInput[],
): string {
  const normalizedPrompt = prompt.trim();
  const block = buildTerminalContextBlock(contexts);
  if (!block) {
    return normalizedPrompt;
  }

  return [normalizedPrompt, block].filter(Boolean).join("\n\n").trim();
}
