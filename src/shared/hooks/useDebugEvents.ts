import { useEffect, useMemo, useState } from "react";
import type { DebugEvent } from "../service/debugEvents.types";
import {
  clearDebugEvents,
  getDebugEventsSnapshot,
  subscribeDebugEvents,
} from "../service/debugEvents.service";

interface UseDebugEventsResult {
  events: DebugEvent[];
  infoCount: number;
  warningCount: number;
  errorCount: number;
  clear: () => void;
}

export function useDebugEvents(): UseDebugEventsResult {
  const [events, setEvents] = useState<DebugEvent[]>(() => getDebugEventsSnapshot());

  useEffect(() => {
    return subscribeDebugEvents(setEvents);
  }, []);

  const counts = useMemo(() => {
    let infoCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    for (const event of events) {
      if (event.level === "error") {
        errorCount += 1;
      } else if (event.level === "warn") {
        warningCount += 1;
      } else {
        infoCount += 1;
      }
    }
    return { infoCount, warningCount, errorCount };
  }, [events]);

  return {
    events,
    infoCount: counts.infoCount,
    warningCount: counts.warningCount,
    errorCount: counts.errorCount,
    clear: clearDebugEvents,
  };
}
