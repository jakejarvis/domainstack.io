"use client";

import { Check, ChevronDown, Filter, Search, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { HealthFilter, StatusFilter } from "@/hooks/use-domain-filters";
import { cn } from "@/lib/utils";

type DomainFiltersProps = {
  search: string;
  status: StatusFilter[];
  health: HealthFilter[];
  tlds: string[];
  availableTlds: string[];
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (values: StatusFilter[]) => void;
  onHealthChange: (values: HealthFilter[]) => void;
  onTldsChange: (values: string[]) => void;
  onClearFilters: () => void;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending Verification" },
];

const HEALTH_OPTIONS: { value: HealthFilter; label: string }[] = [
  { value: "healthy", label: "Healthy" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];

export function DomainFilters({
  search,
  status,
  health,
  tlds,
  availableTlds,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onHealthChange,
  onTldsChange,
  onClearFilters,
}: DomainFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Get labels for active filters to show as chips
  const activeFilterChips = [
    ...status.map((s) => ({
      type: "status" as const,
      value: s,
      label: STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s,
    })),
    ...health.map((h) => ({
      type: "health" as const,
      value: h,
      label: HEALTH_OPTIONS.find((o) => o.value === h)?.label ?? h,
    })),
    ...tlds.map((t) => ({
      type: "tld" as const,
      value: t,
      label: t,
    })),
  ];

  const removeFilter = useCallback(
    (type: "status" | "health" | "tld", value: string) => {
      if (type === "status") {
        onStatusChange(status.filter((s) => s !== value));
      } else if (type === "health") {
        onHealthChange(health.filter((h) => h !== value));
      } else {
        onTldsChange(tlds.filter((t) => t !== value));
      }
    },
    [status, health, tlds, onStatusChange, onHealthChange, onTldsChange],
  );

  const filterContent = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search input */}
      <div className="flex-1 sm:max-w-xs">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search domains..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-2">
        <MultiSelect
          label="Status"
          options={STATUS_OPTIONS}
          selected={status}
          onSelectionChange={onStatusChange}
        />
        <MultiSelect
          label="Health"
          options={HEALTH_OPTIONS}
          selected={health}
          onSelectionChange={onHealthChange}
        />
        {availableTlds.length > 0 && (
          <MultiSelect
            label="TLD"
            options={availableTlds.map((t) => ({ value: t, label: t }))}
            selected={tlds}
            onSelectionChange={onTldsChange}
            searchable
          />
        )}

        {/* Clear all button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground"
          >
            <X className="size-4" />
            Clear all
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Desktop: always visible */}
      <div className="hidden sm:block">{filterContent}</div>

      {/* Mobile: collapsible */}
      <div className="sm:hidden">
        <Collapsible open={mobileOpen} onOpenChange={setMobileOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Filter className="size-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterChips.length}
                  </Badge>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  mobileOpen && "rotate-180",
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {filterContent}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <Badge
              key={`${chip.type}-${chip.value}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeFilter(chip.type, chip.value)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Multi-select dropdown component
function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onSelectionChange,
  searchable = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onSelectionChange: (values: T[]) => void;
  searchable?: boolean;
}) {
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
          size="sm"
          className={cn(
            "gap-1",
            selected.length > 0 && "border-primary/50 bg-primary/5",
          )}
        >
          {label}
          {selected.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 size-5 justify-center rounded-full p-0 text-xs"
            >
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
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
                    onSelect={() => toggleOption(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </div>
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
