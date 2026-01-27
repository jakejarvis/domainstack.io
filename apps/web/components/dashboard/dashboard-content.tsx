import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import {
  IconFilterX,
  IconHourglass,
  IconPlus,
  IconWorld,
} from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { type MutableRefObject, useEffect, useState } from "react";
import { BulkActionsToolbar } from "@/components/dashboard/bulk-actions-toolbar";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { DashboardTable } from "@/components/dashboard/dashboard-table";
import {
  useDashboardFilters,
  useDashboardSelection,
} from "@/context/dashboard-context";
import { usePreferencesStore } from "@/lib/stores/preferences-store";

type DashboardContentProps = {
  domains: TrackedDomainWithDetails[];
  totalDomains: number; // Total before filtering
  onAddDomain?: () => void;
  // Table instance callback (table view only)
  onTableReady?: (table: Table<TrackedDomainWithDetails>) => void;
  // Ref to expose clearSelection to parent (for post-mutation cleanup)
  clearSelectionRef?: MutableRefObject<(() => void) | null>;
};

export function DashboardContent({
  domains,
  totalDomains,
  onAddDomain,
  onTableReady,
  clearSelectionRef,
}: DashboardContentProps) {
  const { hasActiveFilters, clearFilters } = useDashboardFilters();
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const { clearSelection } = useDashboardSelection();

  // Expose clearSelection to parent for post-mutation cleanup
  useEffect(() => {
    if (clearSelectionRef) {
      clearSelectionRef.current = clearSelection;
    }
  }, [clearSelectionRef, clearSelection]);
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
          <Button variant="outline" onClick={clearFilters}>
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
            <DashboardTable domains={domains} onTableReady={onTableReady} />
          ) : (
            <DashboardGrid domains={domains} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bulk actions toolbar - appears when items are selected */}
      <BulkActionsToolbar totalCount={domains.length} />
    </>
  );
}
