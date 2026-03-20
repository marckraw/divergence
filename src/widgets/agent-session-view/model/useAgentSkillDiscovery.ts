import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentSkillDescriptor } from "../../../shared";
import { discoverAgentSkills } from "../../../shared";

export interface AgentSkillAutocomplete {
  skills: AgentSkillDescriptor[];
  isLoading: boolean;
  matchingSkills: AgentSkillDescriptor[];
  updateFilter: (query: string) => void;
}

export function useAgentSkillDiscovery(projectPath: string): AgentSkillAutocomplete {
  const [skills, setSkills] = useState<AgentSkillDescriptor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    discoverAgentSkills(projectPath)
      .then((discovered) => {
        if (!cancelled) {
          setSkills(discovered);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSkills([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const updateFilter = useCallback((query: string) => {
    setFilter(query);
  }, []);

  const matchingSkills = useMemo(() => {
    if (!filter) {
      return skills;
    }
    const normalized = filter.toLowerCase();
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(normalized)
        || skill.description.toLowerCase().includes(normalized),
    );
  }, [skills, filter]);

  return { skills, isLoading, matchingSkills, updateFilter };
}
