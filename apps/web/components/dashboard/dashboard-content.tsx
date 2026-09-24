import { IconFilterX, IconHourglass, IconPlus, IconWorld } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { BulkActionsToolbar } from "@/components/dashboard/bulk-actions-toolbar";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { DashboardTable } from "@/components/dashboard/dashboard-table";
import { useDashboardView } from "@/context/dashboard-context";
import { useDashboardViewMode } from "@/lib/stores/preferences-store";
import { Button, buttonVariants } from "@domainstack/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";

export function DashboardContent({ totalDomains }: { totalDomains: number }) {
  const { visibleDomains: domains, hasActiveFilters, clearFilters } = useDashboardView();
  const viewMode = useDashboardViewMode();
  const shouldReduceMotion = useReducedMotion();

  // Empty state: No domains match filters
  if (domains.length === 0 && hasActiveFilters) {
    return (
      <Empty className="rounded-xl border bg-background shadow-sm">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFilterX className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No domains match your filters</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or filter criteria to find what you're looking for.
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
      <Empty className="relative overflow-hidden rounded-xl border bg-background shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-1/4 size-112 -translate-x-1/2 -translate-y-1/2 glow-accent-indigo/6"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-36 -bottom-36 size-96 glow-accent-blue/6"
        />

        <EmptyHeader className="relative">
          <EmptyMedia variant="icon">
            <IconWorld className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Start tracking your domains</EmptyTitle>
          <EmptyDescription className="max-w-md">
            Add your domains to monitor expiration dates, SSL certificates, and DNS configurations.
            We'll notify you before anything expires.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="relative">
          <Link
            href="/dashboard/add-domain"
            scroll={false}
            className={buttonVariants({ size: "lg" })}
          >
            <IconPlus />
            Add Your First Domain
          </Link>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
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
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
          transition={{
            duration: shouldReduceMotion ? 0.1 : 0.18,
            ease: [0.22, 1, 0.36, 1] as const,
          }}
        >
          {viewMode === "table" ? (
            <DashboardTable domains={domains} />
          ) : (
            <DashboardGrid domains={domains} />
          )}
        </motion.div>
      </AnimatePresence>

      <BulkActionsToolbar totalCount={domains.length} />
    </>
  );
}
