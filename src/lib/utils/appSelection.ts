import type { Project, TerminalSession } from "../../types";

export interface ResolveProjectForNewDivergenceInput {
  activeSessionId: string | null;
  sessions: Map<string, TerminalSession>;
  projects: Project[];
}

export function resolveProjectForNewDivergence(
  input: ResolveProjectForNewDivergenceInput
): Project | null {
  const { activeSessionId, sessions, projects } = input;

  if (activeSessionId) {
    const session = sessions.get(activeSessionId);
    if (session) {
      const project = projects.find((item) => item.id === session.projectId);
      if (project) {
        return project;
      }
    }
  }

  if (projects.length === 1) {
    return projects[0];
  }

  return null;
}
