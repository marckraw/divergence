import type { Divergence, Project } from "../../../entities";

export interface QuickSwitcherSearchResult {
  type: "project" | "divergence";
  item: Project | Divergence;
  projectName?: string;
}

export function buildQuickSwitcherSearchResults(
  projects: Project[],
  divergencesByProject: Map<number, Divergence[]>
): QuickSwitcherSearchResult[] {
  const items: QuickSwitcherSearchResult[] = [];

  for (const project of projects) {
    items.push({ type: "project", item: project });

    const divergences = divergencesByProject.get(project.id) || [];
    for (const divergence of divergences) {
      items.push({
        type: "divergence",
        item: divergence,
        projectName: project.name,
      });
    }
  }

  return items;
}

export function filterQuickSwitcherSearchResults(
  items: QuickSwitcherSearchResult[],
  query: string
): QuickSwitcherSearchResult[] {
  if (!query.trim()) {
    return items;
  }

  const lowerQuery = query.toLowerCase();
  return items.filter((result) => {
    const name = result.item.name.toLowerCase();
    if (result.type === "divergence") {
      const divergence = result.item as Divergence;
      return (
        name.includes(lowerQuery)
        || divergence.branch.toLowerCase().includes(lowerQuery)
        || result.projectName?.toLowerCase().includes(lowerQuery)
      );
    }
    return name.includes(lowerQuery);
  });
}
