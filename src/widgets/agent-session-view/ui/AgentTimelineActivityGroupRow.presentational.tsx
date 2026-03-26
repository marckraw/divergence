import type { ReactNode } from "react";

interface AgentTimelineActivityGroupRowPresentationalProps {
  toneDotClassName: string;
  summary: string;
  stepCount: number;
  status: string;
  statusClassName: string;
  toggleButton: ReactNode;
  details: ReactNode;
}

function AgentTimelineActivityGroupRowPresentational({
  toneDotClassName,
  summary,
  stepCount,
  status,
  statusClassName,
  toggleButton,
  details,
}: AgentTimelineActivityGroupRowPresentationalProps) {
  return (
    <div className="mr-auto flex w-full gap-2 pl-0.5">
      <div className="relative flex w-3 shrink-0 justify-center">
        <div className="absolute inset-y-0 w-px bg-surface/40" />
        <div className={`relative mt-2.5 h-1 w-1 rounded-full opacity-65 ${toneDotClassName}`} />
      </div>

      <div className="min-w-0 flex-1 rounded-lg border border-surface/80 bg-sidebar/45 px-2 py-1.5 sm:px-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="shrink-0 text-[8px] uppercase tracking-[0.16em] text-subtext">Thought Process</span>
          <span className="shrink-0 rounded-full border border-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-subtext">
            tool burst
          </span>
          <p className="min-w-0 flex-1 basis-24 truncate text-sm leading-5 text-text">{summary}</p>
          <span className="shrink-0 rounded-full border border-surface px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-subtext">
            {stepCount} steps
          </span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${statusClassName}`}>
            {status}
          </span>
          {toggleButton}
        </div>
        {details}
      </div>
    </div>
  );
}

export default AgentTimelineActivityGroupRowPresentational;
