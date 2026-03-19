import { Button } from "../../../shared";
import type { AgentSkillDescriptor } from "../../../shared";

export interface AgentSkillAutocompleteProps {
  skills: AgentSkillDescriptor[];
  selectedIndex: number;
  onSelect: (skill: AgentSkillDescriptor) => void;
}

export default function AgentSkillAutocompletePresentational({
  skills,
  selectedIndex,
  onSelect,
}: AgentSkillAutocompleteProps) {
  if (skills.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-subtext">
        No matching skills found
      </div>
    );
  }

  return (
    <div className="max-h-[240px] overflow-y-auto py-1">
      {skills.map((skill, index) => (
        <Button
          key={skill.name}
          type="button"
          variant="ghost"
          size="sm"
          className={`flex w-full items-start gap-3 rounded-none px-3 py-2 text-left text-sm ${
            index === selectedIndex
              ? "bg-accent/15 text-text"
              : "text-subtext hover:bg-accent/8 hover:text-text"
          }`}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(skill);
          }}
        >
          <span className="shrink-0 font-mono text-xs text-accent">
            /{skill.name}
          </span>
          <span className="min-w-0 truncate text-xs">
            {skill.description}
          </span>
          {skill.scope === "project" && (
            <span className="ml-auto shrink-0 rounded-full border border-surface/80 bg-sidebar/70 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-subtext">
              project
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
