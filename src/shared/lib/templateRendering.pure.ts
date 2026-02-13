/**
 * Renders a command template by replacing token placeholders with values.
 *
 * @example
 * renderTemplateCommand("claude --dir {workspacePath} -p {briefPath}", {
 *   workspacePath: "/home/user/project",
 *   briefPath: "/tmp/brief.md",
 * });
 * // => "claude --dir /home/user/project -p /tmp/brief.md"
 */
export function renderTemplateCommand(
  template: string,
  tokens: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}
