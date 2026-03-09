import { useEffect, useMemo, useState } from "react";
import {
  Button,
  getAgentProviderLabel,
  getAgentRuntimeProviderModelOptions,
  Markdown,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared";
import {
  buildAgentRuntimeTelemetrySummary,
  formatRuntimeEventOffset,
} from "../lib/agentRuntimeTelemetry.pure";
import type { AgentSessionHeaderProps } from "./AgentSessionView.types";

function getModelLabel(
  provider: AgentSessionHeaderProps["session"]["provider"],
  model: string,
  capabilities: AgentSessionHeaderProps["capabilities"],
): string {
  const options = getAgentRuntimeProviderModelOptions(capabilities, provider);
  return options.find((option) => option.slug === model)?.label ?? model;
}

function AgentSessionHeaderContainer({
  session,
  capabilities,
  isUpdatingModel,
  onModelChange,
  onStopSession,
}: AgentSessionHeaderProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isRuntimeDebugOpen, setIsRuntimeDebugOpen] = useState(false);
  const modelOptions = getAgentRuntimeProviderModelOptions(capabilities, session.provider);
  const providerLabel = getAgentProviderLabel(session.provider);
  const selectedModelLabel = getModelLabel(session.provider, session.model, capabilities);
  const telemetry = useMemo(
    () => buildAgentRuntimeTelemetrySummary(session, nowMs),
    [session, nowMs],
  );
  const hasRuntimeTelemetry = session.runtimeEvents.length > 0;

  useEffect(() => {
    if (
      session.runtimeStatus !== "running"
      && session.runtimeStatus !== "waiting"
      && session.runtimeEvents.length === 0
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [session.runtimeEvents.length, session.runtimeStatus]);

  return (
    <div className="border-b border-surface bg-sidebar/70 px-5 py-4">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text">{session.name}</h2>
            <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-subtext">
              {providerLabel}
            </span>
            <span className="rounded-full border border-surface bg-main/70 px-2 py-0.5 text-[10px] text-subtext">
              {selectedModelLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-subtext truncate">{session.path}</p>
          {(session.runtimeStatus === "running"
            || session.runtimeStatus === "waiting"
            || hasRuntimeTelemetry) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-subtext">
              <span className="rounded-full border border-surface bg-main/50 px-2 py-0.5 uppercase tracking-[0.16em]">
                {telemetry.phaseLabel}
              </span>
              {telemetry.elapsedLabel && <span>Elapsed {telemetry.elapsedLabel}</span>}
              {telemetry.lastEventLabel && <span>Last event {telemetry.lastEventLabel} ago</span>}
              {telemetry.latestEventMessage && <span>{telemetry.latestEventMessage}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {modelOptions.length > 0 ? (
            <Select
              value={session.model}
              onValueChange={(value) => {
                void onModelChange(value);
              }}
              disabled={
                isUpdatingModel
                || session.runtimeStatus === "running"
                || session.runtimeStatus === "waiting"
              }
            >
              <SelectTrigger className="h-8 min-w-[11rem] bg-main/60 text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={option.slug} value={option.slug}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="rounded-full border border-surface bg-main/60 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-subtext">
            {session.runtimeStatus}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { void onStopSession(session.id); }}
            disabled={session.runtimeStatus !== "running" && session.runtimeStatus !== "waiting"}
          >
            Stop
          </Button>
        </div>
      </div>
      {session.errorMessage && (
        <div className="mx-auto mt-3 w-full max-w-5xl rounded-xl border border-red/30 bg-red/10 px-3 py-2">
          <p className="text-xs text-red">{session.errorMessage}</p>
        </div>
      )}
      {telemetry.slowWarning && (
        <div className="mx-auto mt-3 w-full max-w-5xl rounded-xl border border-yellow/30 bg-yellow/10 px-3 py-2">
          <p className="text-xs text-yellow">{telemetry.slowWarning}</p>
        </div>
      )}
      {hasRuntimeTelemetry && (
        <div className="mx-auto mt-3 w-full max-w-5xl rounded-2xl border border-surface/80 bg-main/35 px-4 py-3">
          <details
            onToggle={(event) => {
              setIsRuntimeDebugOpen(event.currentTarget.open);
            }}
          >
            <summary className="cursor-pointer list-none text-xs text-subtext transition-colors hover:text-text">
              <span className="inline-flex items-center gap-2">
                <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
                  Runtime Debug
                </span>
                <span>
                  {session.runtimeEvents.length} event{session.runtimeEvents.length === 1 ? "" : "s"} captured
                </span>
              </span>
            </summary>
            {isRuntimeDebugOpen && (
              <div className="mt-3 space-y-2">
                {session.runtimeEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-surface/70 bg-sidebar/35 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-subtext">
                      <span className="rounded-full border border-surface px-2 py-0.5 uppercase tracking-[0.16em]">
                        {event.phase}
                      </span>
                      <span>
                        {formatRuntimeEventOffset(event.atMs, session.currentTurnStartedAtMs)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text">{event.message}</p>
                    {event.details && (
                      <pre className="mt-2 overflow-x-auto rounded-lg border border-surface/70 bg-main/70 p-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-subtext">
                        {event.details}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </details>
        </div>
      )}
      {session.pendingRequest && (
        <div className="mx-auto mt-4 w-full max-w-5xl rounded-2xl border border-accent/30 bg-accent/10 px-4 py-4 shadow-[0_18px_60px_-42px_rgba(99,102,241,0.65)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">
                {session.pendingRequest.kind === "approval" ? "Approval Required" : "Input Requested"}
              </p>
              <p className="mt-1 text-sm font-medium text-text">{session.pendingRequest.title}</p>
            </div>
            <span className="text-[11px] text-subtext">{session.pendingRequest.status}</span>
          </div>
          {session.pendingRequest.description && (
            <Markdown
              content={session.pendingRequest.description}
              size="sm"
              className="mt-3 text-subtext"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default AgentSessionHeaderContainer;
