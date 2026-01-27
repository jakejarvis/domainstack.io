import {
  IconFilterX,
  IconHourglass,
  IconPlus,
  IconWorld,
} from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BulkActionsToolbar } from "@/components/dashboard/bulk-actions-toolbar";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { DashboardTable } from "@/components/dashboard/dashboard-table";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { SelectionState } from "@/hooks/use-dashboard-selection";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

type DashboardContentProps = {
  domains: TrackedDomainWithDetails[];
  totalDomains: number; // Total before filtering
  hasActiveFilters: boolean;
  selection: SelectionState;
  onAddDomain?: () => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
  onClearFilters: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  // Table instance callback (table view only)
  onTableReady?: (table: Table<TrackedDomainWithDetails>) => void;
  isBulkArchiving?: boolean;
  isBulkDeleting?: boolean;
};

export function DashboardContent({
  domains,
  totalDomains,
  hasActiveFilters,
  selection,
  onAddDomain,
  onVerify,
  onRemove,
  onArchive,
  onToggleMuted,
  onClearFilters,
  onBulkArchive,
  onBulkDelete,
  onTableReady,
  isBulkArchiving = false,
  isBulkDeleting = false,
}: DashboardContentProps) {
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Avoid animating the initial view swap during hydration when localStorage preferences reconcile.
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Empty state: No domains match filters
  if (domains.length === 0 && hasActiveFilters) {
    return (
      <Empty className="rounded-xl border border-black/15 bg-background/60 shadow-2xl shadow-black/10 dark:border-white/15">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFilterX className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No domains match your filters</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or filter criteria to find what you're
            looking for.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // Empty state: First-time user (no domains at all)
  if (totalDomains === 0) {
    return (
      <Empty className="relative overflow-hidden rounded-xl border border-black/15 bg-background/60 shadow-2xl shadow-black/10 dark:border-white/15">
        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-1/4 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 size-48 translate-x-1/4 translate-y-1/4 rounded-full bg-gradient-to-tl from-blue-500/15 to-transparent blur-3xl"
        />

        <EmptyHeader className="relative">
          <EmptyMedia variant="icon">
            <IconWorld className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Start tracking your domains</EmptyTitle>
          <EmptyDescription className="max-w-md">
            Add your domains to monitor expiration dates, SSL certificates, and
            DNS configurations. We'll notify you before anything expires.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="relative">
          {onAddDomain ? (
            <Button size="lg" onClick={onAddDomain}>
              <IconPlus />
              Add Your First Domain
            </Button>
          ) : (
            <Button
              size="lg"
              render={
                <Link href="/dashboard/add-domain" scroll={false}>
                  <IconPlus />
                  Add Your First Domain
                </Link>
              }
            />
          )}
          <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
            <IconHourglass className="size-4" />
            <span>Verification takes less than 2&nbsp;minutes</span>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewMode}
          initial={
            hasHydrated ? { opacity: 0, y: shouldReduceMotion ? 0 : 8 } : false
          }
          animate={{ opacity: 1, y: 0 }}
          exit={
            hasHydrated
              ? { opacity: 0, y: shouldReduceMotion ? 0 : -8 }
              : undefined
          }
          transition={
            hasHydrated
              ? {
                  duration: shouldReduceMotion ? 0.1 : 0.18,
                  ease: [0.22, 1, 0.36, 1] as const,
                }
              : { duration: 0 }
          }
        >
          {viewMode === "table" ? (
            <DashboardTable
              domains={domains}
              selectedIds={selection.selectedIds}
              onToggleSelect={selection.toggle}
              onVerify={onVerify}
              onRemove={onRemove}
              onArchive={onArchive}
              onToggleMuted={onToggleMuted}
              onTableReady={onTableReady}
            />
          ) : (
            <DashboardGrid
              domains={domains}
              selectedIds={selection.selectedIds}
              onToggleSelect={selection.toggle}
              onVerify={onVerify}
              onRemove={onRemove}
              onArchive={onArchive}
              onToggleMuted={onToggleMuted}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bulk actions toolbar - appears when items are selected */}
      <BulkActionsToolbar
        selectedCount={selection.selectedCount}
        totalCount={domains.length}
        isAllSelected={selection.isAllSelected}
        isPartiallySelected={selection.isPartiallySelected}
        onToggleAll={selection.toggleAll}
        onArchive={onBulkArchive}
        onDelete={onBulkDelete}
        onCancel={selection.clearSelection}
        isArchiving={isBulkArchiving}
        isDeleting={isBulkDeleting}
      />
    </>
  );
}
