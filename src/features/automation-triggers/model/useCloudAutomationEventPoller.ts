import { useCallback, useEffect, useRef } from "react";
import {
  pullCloudAutomationEvents,
  type GithubPrMergedAutomationEvent,
} from "../../../shared";

const DEFAULT_POLL_INTERVAL_MS = 15_000;

interface UseCloudAutomationEventPollerOptions {
  enabled: boolean;
  cloudApiBaseUrl: string;
  cloudApiToken: string;
  onEvents: (events: GithubPrMergedAutomationEvent[]) => Promise<void>;
  pollIntervalMs?: number;
}

export function useCloudAutomationEventPoller(options: UseCloudAutomationEventPollerOptions): void {
  const inFlightRef = useRef(false);
  const onEventsRef = useRef(options.onEvents);
  onEventsRef.current = options.onEvents;

  const tick = useCallback(async () => {
    if (inFlightRef.current || !options.enabled) {
      return;
    }
    if (!options.cloudApiToken.trim() || !options.cloudApiBaseUrl.trim()) {
      return;
    }

    inFlightRef.current = true;
    try {
      const events = await pullCloudAutomationEvents({
        baseUrl: options.cloudApiBaseUrl,
        cloudApiToken: options.cloudApiToken,
      });
      if (events.length > 0) {
        await onEventsRef.current(events);
      }
    } catch (error) {
      console.warn("Cloud automation event poll failed:", error);
    } finally {
      inFlightRef.current = false;
    }
  }, [options.cloudApiBaseUrl, options.cloudApiToken, options.enabled]);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }
    const timerId = window.setInterval(() => {
      void tick();
    }, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [options.enabled, options.pollIntervalMs, tick]);
}
