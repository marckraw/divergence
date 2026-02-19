import { useCallback, useEffect, useState } from "react";
import type { Workspace, WorkspaceMember } from "./workspace.types";
import {
  deleteWorkspaceWithRelations,
  listWorkspaceMembers,
  listWorkspaces,
} from "../api/workspace.api";
import type { WorkspaceDivergence } from "../../workspace-divergence";
import { listWorkspaceDivergences } from "../../workspace-divergence";

interface UseWorkspacesResult {
  workspaces: Workspace[];
  membersByWorkspaceId: Map<number, WorkspaceMember[]>;
  workspaceDivergencesByWorkspaceId: Map<number, WorkspaceDivergence[]>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  removeWorkspace: (id: number) => Promise<void>;
}

export function useWorkspaces(): UseWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [membersByWorkspaceId, setMembersByWorkspaceId] = useState<Map<number, WorkspaceMember[]>>(new Map());
  const [workspaceDivergencesByWorkspaceId, setWorkspaceDivergencesByWorkspaceId] = useState<Map<number, WorkspaceDivergence[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listWorkspaces();
      setWorkspaces(result);

      const membersMap = new Map<number, WorkspaceMember[]>();
      for (const ws of result) {
        const members = await listWorkspaceMembers(ws.id);
        membersMap.set(ws.id, members);
      }
      setMembersByWorkspaceId(membersMap);

      const allWsDivergences = await listWorkspaceDivergences();
      const wsDivMap = new Map<number, WorkspaceDivergence[]>();
      for (const wsd of allWsDivergences) {
        const existing = wsDivMap.get(wsd.workspaceId) ?? [];
        existing.push(wsd);
        wsDivMap.set(wsd.workspaceId, existing);
      }
      setWorkspaceDivergencesByWorkspaceId(wsDivMap);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const removeWorkspace = useCallback(async (id: number) => {
    try {
      await deleteWorkspaceWithRelations(id);
      await refresh();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to remove workspace");
    }
  }, [refresh]);

  return { workspaces, membersByWorkspaceId, workspaceDivergencesByWorkspaceId, loading, error, refresh, removeWorkspace };
}
