"use client";

import type { Table } from "@tanstack/react-table";
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
import { useCallback, useMemo, useState } from "react";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
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
import type { ViewMode } from "@/hooks/use-dashboard-preferences";
import { SORT_OPTIONS, type SortOption } from "@/hooks/use-dashboard-sort";
import { HEALTH_OPTIONS, STATUS_OPTIONS } from "@/lib/constants";
import type {
  HealthFilter,
  StatusFilter,
} from "@/lib/constants/domain-filters";
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
  // Table instance (for column visibility in table view)
  // biome-ignore lint/suspicious/noExplicitAny: Table generic type varies
  table?: Table<any> | null;
};

/** Discriminated union for type-safe filter chip handling */
type FilterChip =
  | { type: "search"; value: string; label: string }
  | { type: "status"; value: StatusFilter; label: string }
  | { type: "health"; value: HealthFilter; label: string }
  | { type: "tld"; value: string; label: string };

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
  table,
}: DomainFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Memoize TLD options to avoid re-allocating on every render
  const tldOptions = useMemo(
    () => availableTlds.map((t) => ({ value: t, label: t })),
    [availableTlds],
  );

  // Get labels for active filters to show as chips
  const activeFilterChips: FilterChip[] = [
    // Include search term as a chip if present
    ...(search.length > 0
      ? [
          {
            type: "search" as const,
            value: search,
            label: `Search: "${search}"`,
          },
        ]
      : []),
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

  // Compute current sort option for grid view dropdown (may be undefined if stale)
  const currentSort = sortOption
    ? SORT_OPTIONS.find((o) => o.value === sortOption)
    : undefined;

  const removeFilter = useCallback(
    (chip: FilterChip) => {
      if (chip.type === "search") {
        onSearchChange("");
      } else if (chip.type === "status") {
        onStatusChange(status.filter((s) => s !== chip.value));
      } else if (chip.type === "health") {
        onHealthChange(health.filter((h) => h !== chip.value));
      } else {
        onTldsChange(tlds.filter((t) => t !== chip.value));
      }
    },
    [
      status,
      health,
      tlds,
      onSearchChange,
      onStatusChange,
      onHealthChange,
      onTldsChange,
    ],
  );

  const filterContent = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Left side: Search and filter dropdowns */}
      <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
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
              options={tldOptions}
              selected={tlds}
              onSelectionChange={onTldsChange}
              searchable
            />
          )}
        </div>
      </div>

      {/* Right side: View-specific controls and clear button */}
      <div className="flex flex-wrap items-center gap-2">
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

        {/* Sort dropdown - only for grid view */}
        {viewMode === "grid" && onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-2 px-3">
                <span className="text-muted-foreground">Sort:</span>
                <span className="inline-flex items-center gap-1.5">
                  {currentSort?.shortLabel ?? "Select"}
                  {currentSort?.direction && (
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

        {/* Column visibility - only for table view, hidden on mobile (shown outside collapsible) */}
        {viewMode === "table" && table && (
          <div className="hidden md:block">
            <ColumnVisibilityMenu table={table} />
          </div>
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
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="flex-1 justify-between">
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

            {/* Column visibility - always visible on mobile for table view */}
            {viewMode === "table" && table && (
              <ColumnVisibilityMenu table={table} />
            )}
          </div>

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
                onClick={() => removeFilter(chip)}
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
