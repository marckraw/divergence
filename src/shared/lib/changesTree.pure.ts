import type { GitChangeEntry } from "./gitChanges.pure";
import { normalizeGitChangePath } from "./gitChanges.pure";

export interface ChangesTreeFileNode<Entry extends { path: string } = GitChangeEntry> {
  kind: "file";
  name: string;
  path: string;
  entry: Entry;
}

export interface ChangesTreeFolderNode<Entry extends { path: string } = GitChangeEntry> {
  kind: "folder";
  name: string;
  path: string;
  children: ChangesTreeNode<Entry>[];
}

export type ChangesTreeNode<Entry extends { path: string } = GitChangeEntry> =
  | ChangesTreeFileNode<Entry>
  | ChangesTreeFolderNode<Entry>;

interface FolderDraft<Entry extends { path: string }> {
  kind: "folder";
  name: string;
  path: string;
  children: Map<string, FolderDraft<Entry> | ChangesTreeFileNode<Entry>>;
}

function createFolderDraft<Entry extends { path: string }>(name: string, path: string): FolderDraft<Entry> {
  return {
    kind: "folder",
    name,
    path,
    children: new Map(),
  };
}

function sortTreeNodes<Entry extends { path: string }>(nodes: ChangesTreeNode<Entry>[]): ChangesTreeNode<Entry>[] {
  return [...nodes].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "folder" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function finalizeDraft<Entry extends { path: string }>(draft: FolderDraft<Entry>): ChangesTreeFolderNode<Entry> {
  const children = sortTreeNodes(
    [...draft.children.values()].map((child) => child.kind === "folder" ? finalizeDraft(child) : child),
  );
  return {
    kind: "folder",
    name: draft.name,
    path: draft.path,
    children,
  };
}

export function buildChangesTree<Entry extends { path: string }>(changes: Entry[]): ChangesTreeNode<Entry>[] {
  const root = createFolderDraft<Entry>("", "");

  changes.forEach((entry) => {
    const normalizedPath = normalizeGitChangePath(entry.path);
    if (!normalizedPath) {
      return;
    }

    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.length === 0) {
      return;
    }

    let current = root;
    segments.forEach((segment, index) => {
      const nextPath = current.path ? `${current.path}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;

      if (isLeaf) {
        current.children.set(segment, {
          kind: "file",
          name: segment,
          path: normalizedPath,
          entry,
        });
        return;
      }

      const existing = current.children.get(segment);
      if (existing?.kind === "folder") {
        current = existing;
        return;
      }

      const nextFolder = createFolderDraft<Entry>(segment, nextPath);
      current.children.set(segment, nextFolder);
      current = nextFolder;
    });
  });

  return sortTreeNodes(
    [...root.children.values()].map((child) => child.kind === "folder" ? finalizeDraft(child) : child),
  );
}

export function collectChangesTreeFolderPaths<Entry extends { path: string }>(
  nodes: ChangesTreeNode<Entry>[],
): string[] {
  const paths: string[] = [];

  const visit = (currentNodes: ChangesTreeNode<Entry>[]) => {
    currentNodes.forEach((node) => {
      if (node.kind !== "folder") {
        return;
      }
      paths.push(node.path);
      visit(node.children);
    });
  };

  visit(nodes);
  return paths;
}
