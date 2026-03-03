import { useEffect } from "react";
import { recordDebugEvent } from "../../shared";

/**
 * Attaches window-level error and unhandled-rejection listeners that
 * forward details to the debug event log.
 *
 * Pure side-effect hook — no params, no return value.
 */
export function useGlobalErrorTracking(): void {
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      recordDebugEvent({
        level: "error",
        category: "app",
        message: "Unhandled window error",
        details: event.message,
        metadata: {
          source: event.filename ?? "unknown",
          line: event.lineno ?? 0,
          column: event.colno ?? 0,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
      recordDebugEvent({
        level: "error",
        category: "app",
        message: "Unhandled promise rejection",
        details: reason,
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);
}
