import type { ReactNode } from "react";
import { Button, Markdown, ProgressBar, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../shared";

interface AgentSessionHeaderPresentationalProps {
  sessionName: string;
  providerLabel: string;
  selectedModelLabel: string;
  selectedEffortLabel: string | null;
  providerVersion: string | null;
  runtimeStatus: string;
  path: string;
  modelPicker: ReactNode;
  effortPicker: ReactNode;
  contextLabel: string;
  contextDetail: string;
  contextFractionUsed: number | null;
  contextTone: "normal" | "warning" | "danger";
  canStop: boolean;
  telemetryRow: ReactNode;
  errorMessage: string | null;
  slowWarning: string | null;
  pendingRequestSummary: {
    kindLabel: string;
    title: string;
    status: string;
    description?: string;
  } | null;
  changedFiles: ReactNode;
  runtimeDebugPanel: ReactNode;
  onStop: () => void;
}

function AgentSessionHeaderPresentational({
  sessionName,
  providerLabel,
  selectedModelLabel,
  selectedEffortLabel,
  providerVersion,
  runtimeStatus,
  path,
  modelPicker,
  effortPicker,
  contextLabel,
  contextDetail,
  contextFractionUsed,
  contextTone,
  canStop,
  telemetryRow,
  errorMessage,
  slowWarning,
  pendingRequestSummary,
  changedFiles,
  runtimeDebugPanel,
  onStop,
}: AgentSessionHeaderPresentationalProps) {
  const contextBarClassName =
    contextTone === "danger"
      ? "bg-red"
      : contextTone === "warning"
        ? "bg-yellow"
        : "bg-emerald-300";

  return (
    <div className="border-b border-surface bg-sidebar/70 px-3 py-3 sm:px-5 sm:py-4">
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-text">{sessionName}</h2>
          <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-subtext">
            {providerLabel}
          </span>
          <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] text-subtext">
            {selectedModelLabel}
          </span>
          {selectedEffortLabel ? (
            <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] text-subtext">
              {selectedEffortLabel}
            </span>
          ) : null}
          {providerVersion ? (
            <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] text-subtext">
              {providerVersion}
            </span>
          ) : null}
          <div className="rounded-full border border-surface bg-main/60 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-subtext">
            {runtimeStatus}
          </div>
        </div>
        <p className="truncate text-xs text-subtext">{path}</p>
        <div className="flex flex-wrap items-center gap-2">
          {modelPicker}
          {effortPicker}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-2 rounded-full border border-surface bg-main/50 px-2.5 py-1 text-[11px] text-subtext">
                  <span className="uppercase tracking-[0.16em]">Context</span>
                  {contextFractionUsed !== null ? (
                    <ProgressBar
                      value={contextFractionUsed * 100}
                      max={100}
                      className="h-1.5 w-12 bg-surface/90"
                      barClassName={contextBarClassName}
                    />
                  ) : null}
                  <span>{contextLabel}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{contextDetail}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button type="button" variant="ghost" size="sm" onClick={onStop} disabled={!canStop}>
            Stop
          </Button>
        </div>
        {telemetryRow}
      </div>
      {errorMessage ? (
        <div className="mx-auto mt-3 w-full max-w-5xl rounded-xl border border-red/30 bg-red/10 px-3 py-2">
          <p className="text-xs text-red">{errorMessage}</p>
        </div>
      ) : null}
      {slowWarning ? (
        <div className="mx-auto mt-3 w-full max-w-5xl rounded-xl border border-yellow/30 bg-yellow/10 px-3 py-2">
          <p className="text-xs text-yellow">{slowWarning}</p>
        </div>
      ) : null}
      {runtimeDebugPanel}
      {changedFiles}
      {pendingRequestSummary ? (
        <div className="mx-auto mt-4 w-full max-w-5xl rounded-2xl border border-accent/30 bg-accent/10 px-4 py-4 shadow-[0_18px_60px_-42px_rgba(99,102,241,0.65)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">{pendingRequestSummary.kindLabel}</p>
              <p className="mt-1 text-sm font-medium text-text">{pendingRequestSummary.title}</p>
            </div>
            <span className="text-[11px] text-subtext">{pendingRequestSummary.status}</span>
          </div>
          {pendingRequestSummary.description ? (
            <Markdown content={pendingRequestSummary.description} size="sm" className="mt-3 text-subtext" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default AgentSessionHeaderPresentational;
