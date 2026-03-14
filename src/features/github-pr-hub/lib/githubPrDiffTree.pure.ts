import type { GithubPullRequestFile } from "../model/githubPrHub.types";

interface GithubPrDiffTreeNode {
  name: string;
  path: string;
  file: GithubPullRequestFile | null;
  children: Map<string, GithubPrDiffTreeNode>;
  additions: number;
  deletions: number;
}

export interface GithubPrDiffTreeDirectoryRow {
  kind: "directory";
  key: string;
  path: string;
  label: string;
  depth: number;
  additions: number;
  deletions: number;
}

export interface GithubPrDiffTreeFileRow {
  kind: "file";
  key: string;
  path: string;
  label: string;
  depth: number;
  additions: number;
  deletions: number;
  file: GithubPullRequestFile;
}

export type GithubPrDiffTreeRow = GithubPrDiffTreeDirectoryRow | GithubPrDiffTreeFileRow;

function createTreeNode(name: string, path: string): GithubPrDiffTreeNode {
  return {
    name,
    path,
    file: null,
    children: new Map(),
    additions: 0,
    deletions: 0,
  };
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function insertFile(root: GithubPrDiffTreeNode, file: GithubPullRequestFile): void {
  const normalizedPath = normalizePath(file.filename);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let currentNode = root;
  segments.forEach((segment, index) => {
    const nextPath = currentNode.path ? `${currentNode.path}/${segment}` : segment;
    let nextNode = currentNode.children.get(segment);
    if (!nextNode) {
      nextNode = createTreeNode(segment, nextPath);
      currentNode.children.set(segment, nextNode);
    }
    currentNode = nextNode;
    if (index === segments.length - 1) {
      currentNode.file = file;
    }
  });
}

function calculateStats(node: GithubPrDiffTreeNode): { additions: number; deletions: number } {
  if (node.file) {
    node.additions = node.file.additions;
    node.deletions = node.file.deletions;
    return {
      additions: node.additions,
      deletions: node.deletions,
    };
  }

  let additions = 0;
  let deletions = 0;
  node.children.forEach((child) => {
    const childStats = calculateStats(child);
    additions += childStats.additions;
    deletions += childStats.deletions;
  });
  node.additions = additions;
  node.deletions = deletions;
  return { additions, deletions };
}

function getSortedChildren(node: GithubPrDiffTreeNode): GithubPrDiffTreeNode[] {
  return [...node.children.values()].sort((left, right) => {
    const leftIsDirectory = left.file === null;
    const rightIsDirectory = right.file === null;
    if (leftIsDirectory !== rightIsDirectory) {
      return leftIsDirectory ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function flattenNode(
  node: GithubPrDiffTreeNode,
  depth: number,
  rows: GithubPrDiffTreeRow[],
): void {
  if (node.file) {
    rows.push({
      kind: "file",
      key: node.path,
      path: node.path,
      label: node.name,
      depth,
      additions: node.file.additions,
      deletions: node.file.deletions,
      file: node.file,
    });
    return;
  }

  let compactedLabel = node.name;
  let compactedNode = node;
  while (compactedNode.file === null && compactedNode.children.size === 1) {
    const onlyChild = compactedNode.children.values().next().value as GithubPrDiffTreeNode | undefined;
    if (!onlyChild || onlyChild.file) {
      break;
    }
    compactedLabel = `${compactedLabel}/${onlyChild.name}`;
    compactedNode = onlyChild;
  }

  rows.push({
    kind: "directory",
    key: `dir:${compactedNode.path}`,
    path: compactedNode.path,
    label: compactedLabel,
    depth,
    additions: compactedNode.additions,
    deletions: compactedNode.deletions,
  });

  getSortedChildren(compactedNode).forEach((child) => {
    flattenNode(child, depth + 1, rows);
  });
}

export function buildGithubPrDiffTreeRows(files: GithubPullRequestFile[]): GithubPrDiffTreeRow[] {
  const root = createTreeNode("", "");
  files.forEach((file) => {
    insertFile(root, file);
  });
  calculateStats(root);

  const rows: GithubPrDiffTreeRow[] = [];
  getSortedChildren(root).forEach((child) => {
    flattenNode(child, 0, rows);
  });
  return rows;
}
