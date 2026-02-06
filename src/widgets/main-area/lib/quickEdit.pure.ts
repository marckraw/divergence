export const IMPORT_COMPLETION_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".d.ts",
]);

const OMIT_EXTENSION_FOR_IMPORT = new Set([
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "d.ts",
]);

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

export function getDirname(value: string): string {
  const normalized = normalizePath(value);
  const trimmed = trimTrailingSlash(normalized);
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash < 0) {
    return trimmed;
  }
  if (lastSlash === 0) {
    return "/";
  }
  return trimmed.slice(0, lastSlash);
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:\//.test(value);
}

export function joinPath(base: string, segment: string): string {
  if (!segment) {
    return base;
  }

  const normalizedBase = normalizePath(base);
  const normalizedSegment = normalizePath(segment);

  if (isAbsolutePath(normalizedSegment)) {
    return normalizedSegment;
  }

  if (normalizedBase.endsWith("/")) {
    return `${normalizedBase}${normalizedSegment}`;
  }
  return `${normalizedBase}/${normalizedSegment}`;
}

export function resolvePath(base: string, relative: string): string {
  const normalizedRelative = normalizePath(relative);
  if (isAbsolutePath(normalizedRelative)) {
    return normalizedRelative;
  }

  const normalizedBase = normalizePath(base);
  const hasLeadingSlash = normalizedBase.startsWith("/");
  let baseParts = normalizedBase.split("/").filter(Boolean);
  let prefix = hasLeadingSlash ? "/" : "";

  if (baseParts[0]?.endsWith(":")) {
    prefix = `${baseParts[0]}/`;
    baseParts = baseParts.slice(1);
  }

  const relParts = normalizedRelative.split("/").filter(Boolean);
  const parts = [...baseParts];

  for (const part of relParts) {
    if (part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length > 0) {
        parts.pop();
      }
      continue;
    }
    parts.push(part);
  }

  return `${prefix}${parts.join("/")}`;
}

export function isImportCompletionEnabled(filePath: string | null): boolean {
  if (!filePath) {
    return false;
  }

  const lower = filePath.toLowerCase();
  return Array.from(IMPORT_COMPLETION_EXTENSIONS).some((ext) => lower.endsWith(ext));
}

export function buildImportLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".d.ts")) {
    return name.slice(0, -5);
  }

  const lastDot = lower.lastIndexOf(".");
  if (lastDot <= 0) {
    return name;
  }

  const ext = lower.slice(lastDot + 1);
  if (OMIT_EXTENSION_FOR_IMPORT.has(ext)) {
    return name.slice(0, lastDot);
  }

  return name;
}

export function getDiffLineClass(line: string): string {
  if (
    line.startsWith("diff ")
    || line.startsWith("index ")
    || line.startsWith("--- ")
    || line.startsWith("+++ ")
  ) {
    return "text-subtext/70";
  }
  if (line.startsWith("@@")) {
    return "text-accent";
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return "text-green bg-green/10";
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return "text-red bg-red/10";
  }
  if (line.startsWith("\\ No newline")) {
    return "text-subtext/70";
  }
  return "text-subtext/80";
}
