import { useEffect, useRef, useCallback } from "react";
import type { Automation, AutomationRunTriggerSource } from "../../../entities/automation";
import type { Project } from "../../../entities";
import { listRunningAutomationRuns } from "../../../entities/automation";
import { findDueAutomations } from "../lib/automationScheduler.pure";

const SCHEDULER_POLL_INTERVAL_MS = 30_000;
const SCHEDULER_INITIAL_DELAY_MS = 10_000;

export interface AutomationSchedulerOptions {
  automations: Automation[];
  projectById: Map<number, Project>;
  onTriggerRun: (automationId: number, triggerSource: AutomationRunTriggerSource) => Promise<void>;
  enabled?: boolean;
}

export function useAutomationScheduler(options: AutomationSchedulerOptions): void {
  const enabled = options.enabled ?? true;
  const automationsRef = useRef(options.automations);
  automationsRef.current = options.automations;

  const onTriggerRunRef = useRef(options.onTriggerRun);
  onTriggerRunRef.current = options.onTriggerRun;

  const inFlightRef = useRef(false);
  const isFirstTickRef = useRef(true);

  const tick = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    try {
      const runningRuns = await listRunningAutomationRuns();
      const runningAutomationIds = new Set(runningRuns.map((r) => r.automationId));
      const dueAutomations = findDueAutomations(
        automationsRef.current,
        runningAutomationIds,
        Date.now(),
      );

      const triggerSource: AutomationRunTriggerSource = isFirstTickRef.current
        ? "startup_catchup"
        : "schedule";
      isFirstTickRef.current = false;

      // Sequential triggers to respect task center concurrency
      for (const automation of dueAutomations) {
        try {
          await onTriggerRunRef.current(automation.id, triggerSource);
        } catch (error) {
          console.warn(`Scheduler failed to trigger automation ${automation.id}:`, error);
        }
      }
    } catch (error) {
      console.warn("Automation scheduler tick failed:", error);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const initialTimerId = window.setTimeout(() => {
      void tick();
    }, SCHEDULER_INITIAL_DELAY_MS);

    const intervalId = window.setInterval(() => {
      void tick();
    }, SCHEDULER_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(intervalId);
    };
  }, [tick, enabled]);
}
