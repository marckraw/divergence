/**
 * Generate a URL-safe slug from a workspace name.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims edges.
 */
export function generateWorkspaceSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build the full workspace folder path from the base directory and slug.
 */
export function buildWorkspaceFolderPath(basePath: string, slug: string): string {
  const trimmedBase = basePath.replace(/\/+$/, "");
  return `${trimmedBase}/${slug}`;
}
