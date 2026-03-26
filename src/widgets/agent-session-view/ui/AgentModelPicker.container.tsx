import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TextInput,
  type AgentRuntimeModelOption,
} from "../../../shared";
import { filterAgentModelOptions } from "../lib/agentModelPicker.pure";

interface AgentModelPickerContainerProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  options: AgentRuntimeModelOption[];
  value: string;
}

export default function AgentModelPickerContainer({
  disabled = false,
  onChange,
  options,
  value,
}: AgentModelPickerContainerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const filteredOptions = filterAgentModelOptions(options, query);
  const selectedOption = options.find((option) => option.slug === value);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  return (
    <Popover
      open={disabled ? false : isOpen}
      onOpenChange={(nextOpen) => {
        if (disabled) {
          return;
        }
        setIsOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          className="h-7 min-w-0 max-w-[24rem] bg-main/60 pl-2.5 pr-2 text-xs"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          <span className="truncate">
            {selectedOption?.label ?? value}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-subtext" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[24rem] p-2">
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtext" />
            <TextInput
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search models"
              className="h-8 bg-main/50 pl-8 text-xs"
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            className="max-h-[18rem] overflow-y-auto rounded-md border border-surface/80 bg-main/30 py-1"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-subtext">
                No models match this search.
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.slug === value;

                return (
                  <Button
                    key={option.slug}
                    type="button"
                    variant="ghost"
                    size="sm"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-none px-3 py-2 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-accent/15 text-text"
                        : "text-subtext hover:bg-accent/8 hover:text-text",
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      setIsOpen(false);
                      if (!isSelected) {
                        onChange(option.slug);
                      }
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "text-accent" : "opacity-0",
                      )}
                    />
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
