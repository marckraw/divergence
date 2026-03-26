import type { ReactNode } from "react";

interface StageSidebarPresentationalProps {
  focusedSessionName: string;
  focusedSessionKindLabel: string;
  tabStrip: ReactNode;
  content: ReactNode;
}

function StageSidebarPresentational({
  focusedSessionName,
  focusedSessionKindLabel,
  tabStrip,
  content,
}: StageSidebarPresentationalProps) {
  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-surface bg-sidebar">
      <div className="flex items-center justify-between border-b border-surface px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-[0.16em] text-subtext">Focused pane</p>
          <p className="truncate text-sm text-text">{focusedSessionName}</p>
        </div>
        <span className="rounded-full border border-surface px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-subtext">
          {focusedSessionKindLabel}
        </span>
      </div>
      {tabStrip}
      <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
    </aside>
  );
}

export default StageSidebarPresentational;
