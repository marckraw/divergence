import { useEffect, useMemo, useState } from "react";
import {
  getAgentProviderLabel,
  getAgentRuntimeEffortLabel,
  getAgentRuntimeProviderDescriptor,
  getAgentRuntimeProviderEffortOptions,
  getAgentRuntimeProviderModelOptions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useAppSettings,
} from "../../../shared";
import { useChangesTree } from "../../../features/changes-tree";
import { buildAgentConversationContextSummary } from "../lib/agentConversationContext.pure";
import {
  buildAgentRuntimeTelemetrySummary,
  formatRuntimeEventOffset,
} from "../lib/agentRuntimeTelemetry.pure";
import AgentModelPickerContainer from "./AgentModelPicker.container";
import AgentSessionChangedFilesPresentational from "./AgentSessionChangedFiles.presentational";
import AgentRuntimeDebugPanel from "./AgentRuntimeDebugPanel.presentational";
import AgentSessionHeaderPresentational from "./AgentSessionHeader.presentational";
import type { AgentSessionHeaderProps } from "./AgentSessionView.types";

function AgentSessionHeaderContainer({
  session,
  capabilities,
  isUpdatingSessionSettings,
  onModelChange,
  onEffortChange,
  onStopSession,
}: AgentSessionHeaderProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isRuntimeDebugOpen, setIsRuntimeDebugOpen] = useState(false);
  const { settings } = useAppSettings();
  const modelOptions = getAgentRuntimeProviderModelOptions(
    capabilities,
    session.provider,
    settings.customAgentModels,
  );
  const providerDescriptor = getAgentRuntimeProviderDescriptor(capabilities, session.provider);
  const effortOptions = getAgentRuntimeProviderEffortOptions(session.provider, session.model);
  const providerLabel = getAgentProviderLabel(session.provider);
  const providerVersion = providerDescriptor?.readiness.detectedVersion ?? null;
  const selectedModelLabel = modelOptions.find((option) => option.slug === session.model)?.label ?? session.model;
  const selectedEffort = effortOptions.find((option) => option.slug === session.effort)?.slug
    ?? effortOptions.find((option) => option.slug === "medium")?.slug;
  const selectedEffortLabel = selectedEffort ? getAgentRuntimeEffortLabel(selectedEffort) : null;
  const conversationContext = useMemo(
    () => buildAgentConversationContextSummary(session),
    [session],
  );
  const telemetry = useMemo(
    () => buildAgentRuntimeTelemetrySummary(session, nowMs),
    [session, nowMs],
  );
  const isRunning = session.runtimeStatus === "running" || session.runtimeStatus === "waiting";
  const { treeNodes: changesTreeNodes, loading: changesLoading } = useChangesTree({
    rootPath: session.path,
    initialMode: "working",
    pollWhileActive: isRunning,
  });
  const hasRuntimeTelemetry = session.runtimeEvents.length > 0;
  const modelPicker = modelOptions.length > 0 ? (
    <AgentModelPickerContainer
      value={session.model}
      options={modelOptions}
      disabled={
        isUpdatingSessionSettings
        || session.runtimeStatus === "running"
        || session.runtimeStatus === "waiting"
      }
      onChange={(value) => {
        void onModelChange(value);
      }}
    />
  ) : null;
  const effortPicker = effortOptions.length > 0 && selectedEffort ? (
    <Select
      value={selectedEffort}
      onValueChange={(value) => {
        void onEffortChange(value as "none" | "low" | "medium" | "high" | "xhigh" | "max");
      }}
      disabled={
        isUpdatingSessionSettings
        || session.runtimeStatus === "running"
        || session.runtimeStatus === "waiting"
      }
    >
      <SelectTrigger className="h-7 w-auto min-w-0 bg-main/60 text-xs">
        <SelectValue placeholder="Select effort" />
      </SelectTrigger>
      <SelectContent>
        {effortOptions.map((option) => (
          <SelectItem key={option.slug} value={option.slug}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;
  const telemetryRow =
    session.runtimeStatus === "running" ||
    session.runtimeStatus === "waiting" ||
    hasRuntimeTelemetry ? (
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-subtext">
        <span className="rounded-full border border-surface bg-main/50 px-2 py-0.5 uppercase tracking-[0.16em]">
          {telemetry.phaseLabel}
        </span>
        {telemetry.elapsedLabel ? <span>Elapsed {telemetry.elapsedLabel}</span> : null}
        {telemetry.lastEventLabel ? <span>Last event {telemetry.lastEventLabel} ago</span> : null}
        {telemetry.latestEventMessage ? <span>{telemetry.latestEventMessage}</span> : null}
      </div>
    ) : null;

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
    <AgentSessionHeaderPresentational
      sessionName={session.name}
      providerLabel={providerLabel}
      selectedModelLabel={selectedModelLabel}
      selectedEffortLabel={selectedEffortLabel}
      providerVersion={providerVersion}
      runtimeStatus={session.runtimeStatus}
      path={session.path}
      modelPicker={modelPicker}
      effortPicker={effortPicker}
      contextLabel={conversationContext.label}
      contextDetail={conversationContext.detail}
      contextFractionUsed={conversationContext.isAvailable ? conversationContext.fractionUsed : null}
      contextTone={conversationContext.tone === "neutral" ? "normal" : conversationContext.tone}
      canStop={session.runtimeStatus === "running" || session.runtimeStatus === "waiting"}
      telemetryRow={telemetryRow}
      errorMessage={session.errorMessage ?? null}
      slowWarning={telemetry.slowWarning}
      runtimeDebugPanel={
        hasRuntimeTelemetry ? (
          <AgentRuntimeDebugPanel
            events={session.runtimeEvents}
            isOpen={isRuntimeDebugOpen}
            onToggle={setIsRuntimeDebugOpen}
            formatOffset={(atMs) => formatRuntimeEventOffset(atMs, session.currentTurnStartedAtMs)}
          />
        ) : null
      }
      changedFiles={
        <AgentSessionChangedFilesPresentational treeNodes={changesTreeNodes} loading={changesLoading} />
      }
      pendingRequestSummary={session.pendingRequest
        ? {
            kindLabel:
              session.pendingRequest.kind === "approval"
                ? "Approval Required"
                : "Input Requested",
            title: session.pendingRequest.title,
            status: session.pendingRequest.status,
            description: session.pendingRequest.description,
          }
        : null}
      onStop={() => {
        void onStopSession(session.id);
      }}
    />
  );
}

export default AgentSessionHeaderContainer;
