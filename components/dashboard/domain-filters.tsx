"use client";

import {
  Activity,
  Check,
  ChevronDown,
  Filter,
  Globe,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { MultiSelect } from "@/components/ui/multi-select";
import type { HealthFilter, StatusFilter } from "@/hooks/use-domain-filters";
import { SORT_OPTIONS, type SortOption } from "@/hooks/use-sort-preference";
import type { ViewMode } from "@/hooks/use-view-preference";
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
  // Sort (only shown in grid view)
  viewMode: ViewMode;
  sortOption?: SortOption;
  onSortChange?: (sort: SortOption) => void;
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
  viewMode,
  sortOption,
  onSortChange,
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

  // Compute current sort option for grid view dropdown
  const currentSort = sortOption
    ? SORT_OPTIONS.find((o) => o.value === sortOption)
    : undefined;

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
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      {/* Search input */}
      <div className="flex-1 md:max-w-xs">
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
          icon={ShieldCheck}
          options={STATUS_OPTIONS}
          selected={status}
          onSelectionChange={onStatusChange}
        />
        <MultiSelect
          label="Health"
          icon={Activity}
          options={HEALTH_OPTIONS}
          selected={health}
          onSelectionChange={onHealthChange}
        />
        {availableTlds.length > 0 && (
          <MultiSelect
            label="TLD"
            icon={Globe}
            options={availableTlds.map((t) => ({ value: t, label: t }))}
            selected={tlds}
            onSelectionChange={onTldsChange}
            searchable
          />
        )}

        {/* Sort dropdown - only for grid view */}
        {viewMode === "grid" && currentSort && onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-2 px-3">
                <span className="text-muted-foreground">Sort:</span>
                <span className="inline-flex items-center gap-1.5">
                  {currentSort.shortLabel}
                  {currentSort.direction && (
                    <span className="text-muted-foreground">
                      {currentSort.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </span>
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-4",
                      sortOption === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
      <div className="hidden md:block">{filterContent}</div>

      {/* Mobile/tablet: collapsible */}
      <div className="md:hidden">
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
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/30"
                aria-label={`Remove ${chip.label} filter`}
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
