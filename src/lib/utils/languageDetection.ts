export type LanguageKind =
  | "html"
  | "css"
  | "typescript"
  | "javascript"
  | "markdown"
  | "python"
  | "rust"
  | "json"
  | "yaml"
  | "unknown";

export function getLanguageKind(filePath: string | null): LanguageKind {
  if (!filePath) {
    return "unknown";
  }

  const lower = filePath.toLowerCase();

  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "html";
  }

  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass") || lower.endsWith(".less")) {
    return "css";
  }

  if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return "typescript";
  }

  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return "javascript";
  }

  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".mdx")) {
    return "markdown";
  }

  if (lower.endsWith(".py") || lower.endsWith(".pyi")) {
    return "python";
  }

  if (lower.endsWith(".rs")) {
    return "rust";
  }

  if (lower.endsWith(".json") || lower.endsWith(".jsonc") || lower.endsWith(".json5")) {
    return "json";
  }

  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return "yaml";
  }

  return "unknown";
}
