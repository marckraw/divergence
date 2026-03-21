import type { CSSProperties } from "react";
import {
  buildChangesTree,
  getFileBadgeInfo,
  type ChangesTreeNode,
} from "../../../shared";
import type { SessionChangedFile } from "../lib/agentSessionChangedFiles.pure";

interface AgentSessionChangedFilesProps {
  changedFiles: SessionChangedFile[];
}

const FILE_BADGE_BASE_CLASS =
  "inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[9px] font-semibold tracking-wide";

function FolderChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg className="h-3 w-3 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      {expanded ? (
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
      ) : (
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
      )}
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-subtext" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function FileBadge({ name }: { name: string }) {
  const badge = getFileBadgeInfo(name);
  return (
    <span className={`${FILE_BADGE_BASE_CLASS} ${badge.className}`} aria-hidden="true">
      {badge.label}
    </span>
  );
}

function ChangedFileNode({
  node,
  depth,
}: {
  node: ChangesTreeNode<SessionChangedFile>;
  depth: number;
}) {
  const paddingStyle: CSSProperties = { paddingLeft: `${depth * 12 + 8}px` };

  if (node.kind === "folder") {
    return (
      <div>
        <div
          className="flex items-center gap-2 rounded px-2 py-1 text-xs text-subtext"
          style={paddingStyle}
        >
          <FolderChevron expanded />
          <FolderIcon />
          <span className="truncate">{node.name}</span>
        </div>
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <ChangedFileNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded px-2 py-1 text-xs text-subtext"
      style={paddingStyle}
      title={node.path}
    >
      <FileBadge name={node.name} />
      <span className="min-w-0 flex-1 truncate text-text">{node.name}</span>
      {node.entry.editCount > 1 && (
        <span className="shrink-0 rounded-full border border-surface px-2 py-0.5 text-[9px] text-subtext">
          {node.entry.editCount} edits
        </span>
      )}
    </div>
  );
}

function AgentSessionChangedFilesPresentational({
  changedFiles,
}: AgentSessionChangedFilesProps) {
  if (changedFiles.length === 0) {
    return null;
  }

  const treeNodes = buildChangesTree(changedFiles);

  return (
    <div className="mx-auto mt-3 w-full max-w-5xl rounded-2xl border border-surface/80 bg-main/35 px-4 py-3">
      <details>
        <summary className="cursor-pointer list-none text-xs text-subtext transition-colors hover:text-text">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
              Changed Files
            </span>
            <span>
              {changedFiles.length} file{changedFiles.length === 1 ? "" : "s"} modified in this session
            </span>
          </span>
        </summary>
        <div className="mt-3 space-y-0.5">
          {treeNodes.map((node) => (
            <ChangedFileNode key={node.path} node={node} depth={0} />
          ))}
        </div>
      </details>
    </div>
  );
}

export default AgentSessionChangedFilesPresentational;
