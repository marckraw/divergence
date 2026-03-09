import type { AgentSessionSnapshot } from "../../agent-session";
import type { TerminalSession } from "../../terminal-session";

export type WorkspaceSession = TerminalSession | AgentSessionSnapshot;

export type WorkspaceSessionKind = "terminal" | "agent";

export type WorkspaceSessionStatus = TerminalSession["status"] | AgentSessionSnapshot["status"];
