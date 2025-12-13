"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectOption<T extends string> = {
  value: T;
  label: string;
  /** Optional search keywords to match against (in addition to value and label) */
  keywords?: string[];
};

export type MultiSelectProps<T extends string> = {
  /** Label displayed on the trigger button */
  label: string;
  /** Icon displayed before the label */
  icon: LucideIcon;
  /** Available options to select from */
  options: MultiSelectOption<T>[];
  /** Currently selected values */
  selected: T[];
  /** Callback when selection changes */
  onSelectionChange: (values: T[]) => void;
  /** Whether to show a search input (default: false) */
  searchable?: boolean;
  /** Custom class name for the trigger button */
  className?: string;
  /** Width of the popover content (default: "w-48") */
  popoverWidth?: string;
};

/**
 * A multi-select dropdown component using Popover + Command (cmdk).
 * Supports optional search and displays a selection count badge.
 */
export function MultiSelect<T extends string>({
  label,
  icon: Icon,
  options,
  selected,
  onSelectionChange,
  searchable = false,
  className,
  popoverWidth = "w-48",
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);

  const toggleOption = (value: T) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter((v) => v !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-2 px-3",
            selected.length > 0 &&
              "border-foreground/20 bg-primary/3 dark:border-foreground/15 dark:bg-primary/10",
            className,
          )}
        >
          <Icon className="size-4 opacity-60" />
          {label}
          {selected.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-foreground/10 px-1.5 font-semibold text-xs tabular-nums dark:bg-foreground/20">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(popoverWidth, "p-0")} align="start">
        <Command>
          {searchable && <CommandInput placeholder={`Search ${label}...`} />}
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={option.keywords}
                    onSelect={() => toggleOption(option.value)}
                    className="cursor-pointer"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
