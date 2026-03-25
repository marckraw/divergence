import type { AgentSessionSnapshot } from "../../agent-session";
import type { EditorSession } from "../../editor-session";
import type { TerminalSession } from "../../terminal-session";

export type WorkspaceSession = TerminalSession | AgentSessionSnapshot | EditorSession;

export type WorkspaceSessionKind = "terminal" | "agent" | "editor";

export type WorkspaceSessionStatus = TerminalSession["status"] | AgentSessionSnapshot["status"] | EditorSession["status"];
