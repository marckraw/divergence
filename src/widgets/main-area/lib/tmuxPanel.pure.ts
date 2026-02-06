import type { TmuxSessionWithOwnership } from "../../../entities/terminal-session";

export interface TmuxOwnershipBadge {
  text: string;
  className: string;
}

export function getTmuxOwnershipBadge(session: TmuxSessionWithOwnership): TmuxOwnershipBadge {
  switch (session.ownership.kind) {
    case "project":
      return {
        text: session.ownership.project.name,
        className: "bg-accent/20 text-accent",
      };
    case "divergence":
      return {
        text: `${session.ownership.project.name} / ${session.ownership.divergence.branch}`,
        className: "bg-accent/20 text-accent",
      };
    case "orphan":
      return {
        text: "orphan",
        className: "bg-yellow/20 text-yellow",
      };
    case "unknown":
      return {
        text: "checking",
        className: "bg-surface text-subtext",
      };
    default:
      return {
        text: "checking",
        className: "bg-surface text-subtext",
      };
  }
}

export function getTmuxSessionSearchText(session: TmuxSessionWithOwnership): string {
  const parts = [session.name, session.attached ? "attached" : "detached"];

  switch (session.ownership.kind) {
    case "project":
      parts.push(session.ownership.project.name);
      break;
    case "divergence":
      parts.push(session.ownership.project.name, session.ownership.divergence.branch);
      break;
    case "orphan":
      parts.push("orphan");
      break;
    case "unknown":
      parts.push("checking");
      break;
  }

  return parts.join(" ").toLowerCase();
}

export function filterTmuxSessions(
  sessions: TmuxSessionWithOwnership[],
  query: string
): TmuxSessionWithOwnership[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sessions;
  }

  return sessions.filter((session) =>
    getTmuxSessionSearchText(session).includes(normalizedQuery)
  );
}
