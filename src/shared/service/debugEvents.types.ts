export type DebugEventLevel = "info" | "warn" | "error";

export type DebugEventCategory = "app" | "terminal" | "tmux" | "automation";

export interface DebugEvent {
  id: string;
  atMs: number;
  level: DebugEventLevel;
  category: DebugEventCategory;
  message: string;
  details?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface RecordDebugEventInput {
  atMs?: number;
  level: DebugEventLevel;
  category: DebugEventCategory;
  message: string;
  details?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
