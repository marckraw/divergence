import type { DebugEvent, RecordDebugEventInput } from "./debugEvents.types";

const MAX_DEBUG_EVENTS = 500;

let debugEvents: DebugEvent[] = [];
const listeners = new Set<(events: DebugEvent[]) => void>();

function buildDebugEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `debug-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notifyListeners(): void {
  const snapshot = [...debugEvents];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function getDebugEventsSnapshot(): DebugEvent[] {
  return [...debugEvents];
}

export function subscribeDebugEvents(listener: (events: DebugEvent[]) => void): () => void {
  listeners.add(listener);
  listener(getDebugEventsSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function clearDebugEvents(): void {
  if (debugEvents.length === 0) {
    return;
  }
  debugEvents = [];
  notifyListeners();
}

export function recordDebugEvent(input: RecordDebugEventInput): DebugEvent {
  const event: DebugEvent = {
    id: buildDebugEventId(),
    atMs: input.atMs ?? Date.now(),
    level: input.level,
    category: input.category,
    message: input.message,
    details: input.details,
    metadata: input.metadata,
  };
  debugEvents = [...debugEvents, event];
  if (debugEvents.length > MAX_DEBUG_EVENTS) {
    debugEvents = debugEvents.slice(debugEvents.length - MAX_DEBUG_EVENTS);
  }
  notifyListeners();
  return event;
}
