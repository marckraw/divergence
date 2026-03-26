import type { AgentRuntimeModelOption } from "../../../shared";

export function filterAgentModelOptions(
  options: AgentRuntimeModelOption[],
  query: string,
): AgentRuntimeModelOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) =>
    option.label.toLocaleLowerCase().includes(normalizedQuery)
    || option.slug.toLocaleLowerCase().includes(normalizedQuery)
  );
}
