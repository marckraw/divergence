import type { AgentRuntimeDebugEvent } from "../../../shared";

interface AgentRuntimeDebugPanelProps {
  events: AgentRuntimeDebugEvent[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  formatOffset: (atMs: number) => string;
}

function AgentRuntimeDebugPanel({
  events,
  isOpen,
  onToggle,
  formatOffset,
}: AgentRuntimeDebugPanelProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto mt-3 w-full max-w-5xl rounded-2xl border border-surface/80 bg-main/35 px-4 py-3">
      <details
        open={isOpen}
        onToggle={(event) => {
          onToggle(event.currentTarget.open);
        }}
      >
        <summary className="cursor-pointer list-none text-xs text-subtext transition-colors hover:text-text">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
              Runtime Debug
            </span>
            <span>
              {events.length} event{events.length === 1 ? "" : "s"} captured
            </span>
          </span>
        </summary>
        {isOpen ? (
          <div className="mt-3 space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded-xl border border-surface/70 bg-sidebar/35 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-subtext">
                  <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
                    {event.phase}
                  </span>
                  <span>{formatOffset(event.atMs)}</span>
                </div>
                <p className="mt-2 text-sm text-text">{event.message}</p>
                {event.details ? (
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-surface/70 bg-main/70 p-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-subtext">
                    {event.details}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </details>
    </div>
  );
}

export default AgentRuntimeDebugPanel;
