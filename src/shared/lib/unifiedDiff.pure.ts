export interface ParsedDiffLine {
  index: number;
  text: string;
  kind: "meta" | "hunk" | "context" | "added" | "removed";
  oldLine?: number;
  newLine?: number;
}

const HUNK_HEADER_REGEX = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/;

function isDiffHeaderLine(line: string): boolean {
  return line.startsWith("diff ")
    || line.startsWith("index ")
    || line.startsWith("--- ")
    || line.startsWith("+++ ");
}

export function parseUnifiedDiffLines(diff: string | null): ParsedDiffLine[] {
  if (!diff) {
    return [];
  }

  const lines = diff.split("\n");
  const parsed: ParsedDiffLine[] = [];

  let oldCursor = 0;
  let newCursor = 0;

  lines.forEach((line, index) => {
    if (isDiffHeaderLine(line)) {
      parsed.push({ index, text: line, kind: "meta" });
      return;
    }

    const headerMatch = line.match(HUNK_HEADER_REGEX);
    if (headerMatch) {
      oldCursor = Number(headerMatch[1]);
      newCursor = Number(headerMatch[2]);
      parsed.push({ index, text: line, kind: "hunk" });
      return;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      parsed.push({
        index,
        text: line,
        kind: "added",
        newLine: newCursor,
      });
      newCursor += 1;
      return;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      parsed.push({
        index,
        text: line,
        kind: "removed",
        oldLine: oldCursor,
      });
      oldCursor += 1;
      return;
    }

    if (line.startsWith("\\ No newline")) {
      parsed.push({ index, text: line, kind: "meta" });
      return;
    }

    parsed.push({
      index,
      text: line,
      kind: "context",
      oldLine: oldCursor,
      newLine: newCursor,
    });
    oldCursor += 1;
    newCursor += 1;
  });

  return parsed;
}
