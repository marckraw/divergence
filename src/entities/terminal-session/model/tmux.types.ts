import type { Divergence } from "../../divergence";
import type { Project } from "../../project";
import type { TmuxSessionEntry } from "../../../shared/api/tmuxSessions.types";

export type { TmuxSessionEntry };

export type TmuxSessionOwnership =
  | { kind: "project"; project: Project }
  | { kind: "divergence"; project: Project; divergence: Divergence }
  | { kind: "orphan" }
  | { kind: "unknown" };

export interface TmuxSessionWithOwnership extends TmuxSessionEntry {
  ownership: TmuxSessionOwnership;
}
