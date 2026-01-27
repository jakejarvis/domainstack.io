import {
  IconActivity,
  IconCloudComputing,
  IconProgressAlert,
  IconSearch,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo } from "react";
import { DashboardTableColumnMenu } from "@/components/dashboard/dashboard-table-column-menu";
import {
  type FilterChip,
  FilterChips,
} from "@/components/dashboard/filter-chips";
import { FilterDropdowns } from "@/components/dashboard/filter-dropdowns";
import { FilterSearchInput } from "@/components/dashboard/filter-search-input";
import { GridSortDropdown } from "@/components/dashboard/grid-sort-dropdown";
import { MobileFiltersCollapsible } from "@/components/dashboard/mobile-filters-collapsible";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { Button } from "@/components/ui/button";
import { useDashboardFilters } from "@/context/dashboard-context";
import { HEALTH_OPTIONS } from "@/lib/constants/domain-filters";
import { usePreferencesStore } from "@/lib/stores/preferences-store";

export function DashboardFilters() {
  const {
    search,
    status,
    health,
    tlds,
    providers,
    availableTlds,
    availableProviders,
    hasActiveFilters,
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    setProviders,
    clearFilters,
    domainId,
    filteredDomainName,
    clearDomainId,
    sortOption,
    setSortOption,
    table,
  } = useDashboardFilters();
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const shouldReduceMotion = useReducedMotion();

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

    for (const [categoryKey, providerList] of Object.entries(
      availableProviders,
    )) {
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

      for (const provider of providerList) {
        map.set(provider.id, {
          name: provider.name,
          category: categoryLabel,
          icon: provider.id ? (
            <ProviderLogo
              providerId={provider.id}
              providerName={provider.name}
              className="size-3 shrink-0"
            />
          ) : (
            <IconCloudComputing className="size-3 text-muted-foreground" />
          ),
        });
      }
    }
    return map;
  }, [availableProviders]);

  // Get labels for active filters to show as chips
  const activeFilterChips: FilterChip[] = useMemo(
    () => [
      // Domain ID chip (from notification deep links) - shown first for prominence
      ...(domainId && filteredDomainName
        ? [
            {
              type: "domainId" as const,
              value: domainId,
              label: filteredDomainName,
              prefix: "Domain",
              icon: <IconWorld className="size-3 text-muted-foreground" />,
            },
          ]
        : []),
      // Include search term as a chip if present
      ...(search.length > 0
        ? [
            {
              type: "search" as const,
              value: search,
              label: `"${search}"`,
              icon: <IconSearch className="size-3 text-muted-foreground" />,
            },
          ]
        : []),
      // Status chips (from health summary clicks)
      ...status.map((s) => ({
        type: "status" as const,
        value: s,
        label: s === "verified" ? "Verified" : "Pending Verification",
        icon: <IconProgressAlert className="size-3 text-muted-foreground" />,
      })),
      ...health.map((h) => ({
        type: "health" as const,
        value: h,
        label: HEALTH_OPTIONS.find((o) => o.value === h)?.label ?? h,
        icon: <IconActivity className="size-3 text-muted-foreground" />,
      })),
      ...tlds.map((t) => ({
        type: "tld" as const,
        value: t,
        label: `.${t}`, // Display with leading dot
        prefix: "TLD",
        icon: <IconWorld className="size-3 text-muted-foreground" />,
      })),
      ...providers.map((p) => ({
        type: "provider" as const,
        value: p,
        label: allProvidersMap.get(p)?.name ?? p,
        prefix: allProvidersMap.get(p)?.category ?? "",
        icon: allProvidersMap.get(p)?.icon ?? null,
      })),
    ],
    [
      domainId,
      filteredDomainName,
      search,
      status,
      health,
      tlds,
      providers,
      allProvidersMap,
    ],
  );

  const removeFilter = useCallback(
    (chip: FilterChip) => {
      if (chip.type === "domainId") {
        clearDomainId();
      } else if (chip.type === "search") {
        setSearch("");
      } else if (chip.type === "status") {
        setStatus(status.filter((s) => s !== chip.value));
      } else if (chip.type === "health") {
        setHealth(health.filter((h) => h !== chip.value));
      } else if (chip.type === "tld") {
        setTlds(tlds.filter((t) => t !== chip.value));
      } else {
        setProviders(providers.filter((p) => p !== chip.value));
      }
    },
    [
      status,
      health,
      tlds,
      providers,
      clearDomainId,
      setSearch,
      setStatus,
      setHealth,
      setTlds,
      setProviders,
    ],
  );

  const filterContent = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Left side: Search and filter dropdowns */}
      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
        <FilterSearchInput value={search} onChange={setSearch} />
        <FilterDropdowns
          health={health}
          tlds={tlds}
          providers={providers}
          availableTlds={availableTlds}
          availableProviders={availableProviders}
          onHealthChange={setHealth}
          onTldsChange={setTlds}
          onProvidersChange={setProviders}
        />
      </div>

      {/* Right side: View-specific controls and clear button */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Clear all button */}
        <AnimatePresence initial={false}>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
              transition={{
                duration: shouldReduceMotion ? 0.1 : 0.18,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
            >
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <IconX />
                Clear all
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort dropdown - only for grid view */}
        {viewMode === "grid" && (
          <GridSortDropdown
            sortOption={sortOption}
            onSortChange={setSortOption}
          />
        )}

        {/* Column visibility - only for table view, hidden when collapsed (shown outside collapsible) */}
        {viewMode === "table" && table && (
          <div className="hidden lg:block">
            <DashboardTableColumnMenu table={table} />
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
        <MobileFiltersCollapsible
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterChips.length}
          table={table}
        >
          {filterContent}
        </MobileFiltersCollapsible>
      </div>

      {/* Active filter chips */}
      <FilterChips chips={activeFilterChips} onRemove={removeFilter} />
    </div>
  );
}
