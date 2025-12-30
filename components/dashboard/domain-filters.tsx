"use client";

import type { Table } from "@tanstack/react-table";
import {
  Activity,
  Check,
  ChevronDown,
  ClockFading,
  EthernetPort,
  Filter,
  Globe,
  Search,
  X,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { ProviderMultiSelect } from "@/components/dashboard/provider-multi-select";
import { ProviderIcon } from "@/components/icons/provider-icon";
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
import type { AvailableProvidersByCategory } from "@/hooks/use-dashboard-filters";
import type { ViewMode } from "@/hooks/use-dashboard-preferences";
import { SORT_OPTIONS, type SortOption } from "@/hooks/use-dashboard-sort";
import {
  HEALTH_OPTIONS,
  type HealthFilter,
  type StatusFilter,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type DomainFiltersProps = {
  search: string;
  status: StatusFilter[];
  health: HealthFilter[];
  tlds: string[];
  providers: string[];
  availableTlds: string[];
  availableProviders: AvailableProvidersByCategory;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (values: StatusFilter[]) => void;
  onHealthChange: (values: HealthFilter[]) => void;
  onTldsChange: (values: string[]) => void;
  onProvidersChange: (values: string[]) => void;
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
type FilterChip = {
  type: "search" | "status" | "health" | "tld" | "provider";
  value: string;
  label: string;
  prefix?: string;
  icon: React.ReactNode;
};

export function DomainFilters({
  search,
  status,
  health,
  tlds,
  providers,
  availableTlds,
  availableProviders,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onHealthChange,
  onTldsChange,
  onProvidersChange,
  onClearFilters,
  viewMode,
  sortOption,
  onSortChange,
  table,
}: DomainFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Memoize TLD options to avoid re-allocating on every render
  // TLDs are stored without leading dot but displayed with dot
  // Include the dotted version as a keyword so search works with or without the dot
  const tldOptions = useMemo(
    () =>
      availableTlds.map((t) => ({
        value: t,
        label: `.${t}`,
        keywords: [`.${t}`], // Allow searching with the dot
      })),
    [availableTlds],
  );

  // Memoize provider sections for the multi-select
  const providerSections = useMemo(() => {
    const sections = [];

    if (availableProviders.registrar.length > 0) {
      sections.push({
        label: "Registrar",
        options: availableProviders.registrar.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.dns.length > 0) {
      sections.push({
        label: "DNS",
        options: availableProviders.dns.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.hosting.length > 0) {
      sections.push({
        label: "Hosting",
        options: availableProviders.hosting.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.email.length > 0) {
      sections.push({
        label: "Email",
        options: availableProviders.email.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    if (availableProviders.ca.length > 0) {
      sections.push({
        label: "CA",
        options: availableProviders.ca.map((p) => ({
          value: p.id,
          label: p.name,
          domain: p.domain,
          id: p.id,
          keywords: [p.name],
        })),
      });
    }

    return sections;
  }, [availableProviders]);

  // Flat map of all providers for chip rendering
  const allProvidersMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        category: string | undefined;
        icon: React.ReactNode | null;
      }
    >();

    for (const [categoryKey, providers] of Object.entries(availableProviders)) {
      // Map category keys to display labels
      const categoryLabel =
        categoryKey === "registrar"
          ? "Registrar"
          : categoryKey === "dns"
            ? "DNS"
            : categoryKey === "hosting"
              ? "Hosting"
              : categoryKey === "email"
                ? "Email"
                : categoryKey === "ca"
                  ? "CA"
                  : undefined;

      for (const provider of providers) {
        map.set(provider.id, {
          name: provider.name,
          category: categoryLabel,
          icon: provider.id ? (
            <ProviderIcon
              providerId={provider.id}
              providerName={provider.name}
              providerDomain={provider.domain}
              size={12}
              className="shrink-0 rounded"
            />
          ) : (
            <EthernetPort className="size-3 text-muted-foreground" />
          ),
        });
      }
    }
    return map;
  }, [availableProviders]);

  // Get labels for active filters to show as chips
  const activeFilterChips: FilterChip[] = [
    // Include search term as a chip if present
    ...(search.length > 0
      ? [
          {
            type: "search" as const,
            value: search,
            label: `"${search}"`,
            icon: <Search className="size-3 text-muted-foreground" />,
          },
        ]
      : []),
    // Status chips (from health summary clicks)
    ...status.map((s) => ({
      type: "status" as const,
      value: s,
      label: s === "verified" ? "Verified" : "Pending Verification",
      icon: <ClockFading className="size-3 text-muted-foreground" />,
    })),
    ...health.map((h) => ({
      type: "health" as const,
      value: h,
      label: HEALTH_OPTIONS.find((o) => o.value === h)?.label ?? h,
      icon: <Activity className="size-3 text-muted-foreground" />,
    })),
    ...tlds.map((t) => ({
      type: "tld" as const,
      value: t,
      label: `.${t}`, // Display with leading dot
      prefix: "TLD",
      icon: <Globe className="size-3 text-muted-foreground" />,
    })),
    ...providers.map((p) => ({
      type: "provider" as const,
      value: p,
      label: allProvidersMap.get(p)?.name ?? p,
      prefix: allProvidersMap.get(p)?.category ?? "",
      icon: allProvidersMap.get(p)?.icon ?? null,
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
      } else if (chip.type === "tld") {
        onTldsChange(tlds.filter((t) => t !== chip.value));
      } else {
        onProvidersChange(providers.filter((p) => p !== chip.value));
      }
    },
    [
      status,
      health,
      tlds,
      providers,
      onSearchChange,
      onStatusChange,
      onHealthChange,
      onTldsChange,
      onProvidersChange,
    ],
  );

  const filterContent = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Left side: Search and filter dropdowns */}
      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search input */}
        <div className="flex-1 lg:max-w-xs">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search domains..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <AnimatePresence initial={false}>
              {search && (
                <InputGroupAddon align="inline-end">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{
                      duration: 0.16,
                      ease: [0.22, 1, 0.36, 1] as const,
                    }}
                  >
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => onSearchChange("")}
                      aria-label="Clear search"
                    >
                      <XIcon />
                    </InputGroupButton>
                  </motion.div>
                </InputGroupAddon>
              )}
            </AnimatePresence>
          </InputGroup>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2">
          <MultiSelect
            label="Health"
            icon={Activity}
            options={HEALTH_OPTIONS}
            selected={health}
            onSelectionChange={onHealthChange}
            className="cursor-pointer"
          />
          {availableTlds.length > 0 && (
            <MultiSelect
              label="TLD"
              icon={Globe}
              options={tldOptions}
              selected={tlds}
              onSelectionChange={onTldsChange}
              searchable
              className="cursor-pointer"
            />
          )}
          {providerSections.length > 0 && (
            <ProviderMultiSelect
              label="Providers"
              icon={EthernetPort}
              sections={providerSections}
              selected={providers}
              onSelectionChange={onProvidersChange}
              searchable
              popoverWidth="w-72"
              className="cursor-pointer"
            />
          )}
        </div>
      </div>

      {/* Right side: View-specific controls and clear button */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Clear all button */}
        <AnimatePresence initial={false}>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
            >
              <Button
                variant="ghost"
                onClick={onClearFilters}
                className="text-muted-foreground"
              >
                <XIcon />
                Clear all
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort dropdown - only for grid view */}
        {viewMode === "grid" && onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="inline-flex h-9 items-center gap-1.5 px-3"
                >
                  <span className="text-muted-foreground">Sort:</span>
                  {currentSort?.shortLabel ?? "Select"}
                  {currentSort?.direction && (
                    <span className="text-muted-foreground">
                      {currentSort.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className="cursor-pointer gap-2"
                >
                  <Check
                    className={cn(
                      sortOption === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Column visibility - only for table view, hidden when collapsed (shown outside collapsible) */}
        {viewMode === "table" && table && (
          <div className="hidden lg:block">
            <ColumnVisibilityMenu table={table} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Large screens: always visible */}
      <div className="hidden lg:block">{filterContent}</div>

      {/* Small/medium screens: collapsible */}
      <div className="lg:hidden">
        <Collapsible open={mobileOpen} onOpenChange={setMobileOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger
              render={
                <Button variant="outline" className="flex-1 justify-between">
                  <span className="flex items-center gap-2">
                    <Filter className="text-muted-foreground" />
                    <span className="text-sm">Filters</span>
                    <AnimatePresence initial={false}>
                      {hasActiveFilters && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{
                            duration: 0.16,
                            ease: [0.22, 1, 0.36, 1] as const,
                          }}
                          className="ml-1 inline-flex"
                        >
                          <Badge variant="secondary">
                            {activeFilterChips.length}
                          </Badge>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <ChevronDown
                    className={cn(
                      "transition-transform",
                      mobileOpen && "rotate-180",
                    )}
                  />
                </Button>
              }
            />

            {/* Column visibility - always visible in collapsed mode for table view */}
            {viewMode === "table" && table && (
              <ColumnVisibilityMenu table={table} />
            )}
          </div>

          <CollapsibleContent
            keepMounted
            render={(contentProps) => {
              const { children, ...rest } = contentProps;
              return (
                <div {...rest}>
                  <motion.div
                    initial={false}
                    animate={
                      mobileOpen
                        ? { height: "auto", opacity: 1 }
                        : { height: 0, opacity: 0 }
                    }
                    transition={{
                      duration: 0.22,
                      ease: [0.22, 1, 0.36, 1] as const,
                    }}
                    style={{ overflow: "hidden" }}
                  >
                    {children}
                  </motion.div>
                </div>
              );
            }}
          >
            <div className="pt-3">{filterContent}</div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Active filter chips */}
      <AnimatePresence initial={false}>
        {activeFilterChips.length > 0 && (
          <motion.div
            key="active-filter-chips"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{
              duration: 0.18,
              ease: [0.22, 1, 0.36, 1] as const,
            }}
            className="flex flex-wrap gap-2"
          >
            <AnimatePresence initial={false}>
              {activeFilterChips.map((chip, index) => (
                <motion.div
                  key={`${chip.type}-${chip.value}`}
                  layout="position"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{
                    duration: 0.18,
                    ease: [0.22, 1, 0.36, 1] as const,
                    delay: Math.min(index * 0.01, 0.06),
                  }}
                  className="inline-flex"
                >
                  <Badge className="select-none gap-1.5 border-border bg-muted/10 py-1 pr-1.5 text-foreground dark:border-border/60 dark:bg-muted/30">
                    {chip.icon}
                    <span className="flex items-center gap-1 text-xs leading-none">
                      {chip.prefix && (
                        <span className="shrink-0 text-muted-foreground">
                          {chip.prefix}:
                        </span>
                      )}
                      <span className="truncate">{chip.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFilter(chip)}
                      className="cursor-pointer rounded-full p-[3px] hover:bg-muted/90"
                      aria-label={`Remove ${chip.type} filter`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
