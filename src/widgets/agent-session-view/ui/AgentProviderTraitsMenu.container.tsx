import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../shared";
import type { AgentSessionSnapshot } from "../../../entities";
import type { AgentRuntimeProviderTurnOptions } from "../../../shared";
import {
  getAgentProviderTraitDescriptors,
  hasAgentProviderTurnOptions,
} from "../lib/agentProviderTraits.pure";

interface AgentProviderTraitsMenuProps {
  session: AgentSessionSnapshot;
  draftOptions: AgentRuntimeProviderTurnOptions;
  onChange: (nextOptions: AgentRuntimeProviderTurnOptions) => void;
}

function AgentProviderTraitsMenuContainer({
  session,
  draftOptions,
  onChange,
}: AgentProviderTraitsMenuProps) {
  const traitDescriptors = getAgentProviderTraitDescriptors(session.provider, session.model);
  if (traitDescriptors.length === 0) {
    return null;
  }

  const hasActiveTraits = hasAgentProviderTurnOptions(session.provider, session.model, draftOptions);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={hasActiveTraits ? "secondary" : "ghost"}
          size="sm"
          className="h-9 px-3 text-xs"
          title="Per-turn provider traits"
        >
          Traits
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-subtext">
            Per-Turn Traits
          </p>
          <p className="mt-1 text-sm text-text">
            These options only affect the next turn you send from this composer.
          </p>
        </div>

        {traitDescriptors.map((trait) => {
          if (trait.id !== "fast-mode") {
            return null;
          }

          const checked = draftOptions.codex?.fastMode === true;
          return (
            <label
              key={trait.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface/80 bg-main/40 px-3 py-3"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-surface bg-main text-accent"
                checked={checked}
                onChange={(event) => {
                  onChange(event.target.checked ? { codex: { fastMode: true } } : {});
                }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{trait.label}</p>
                <p className="mt-1 text-xs leading-5 text-subtext">
                  {trait.description}
                </p>
              </div>
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export default AgentProviderTraitsMenuContainer;
