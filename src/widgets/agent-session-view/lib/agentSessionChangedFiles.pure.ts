import type { AgentActivity } from "../../../entities";

export interface SessionChangedFile {
  path: string;
  editCount: number;
}

const FILE_CHANGE_GROUP_KEYS = new Set(["edit"]);

export function collectSessionChangedFiles(
  activities: AgentActivity[],
): SessionChangedFile[] {
  const countByPath = new Map<string, number>();

  for (const activity of activities) {
    if (
      !activity.subject
      || !activity.groupKey
      || !FILE_CHANGE_GROUP_KEYS.has(activity.groupKey)
    ) {
      continue;
    }

    countByPath.set(
      activity.subject,
      (countByPath.get(activity.subject) ?? 0) + 1,
    );
  }

  const result: SessionChangedFile[] = [];
  for (const [path, editCount] of countByPath) {
    result.push({ path, editCount });
  }

  return result;
}
