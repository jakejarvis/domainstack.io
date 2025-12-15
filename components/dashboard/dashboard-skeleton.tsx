import { DomainCardSkeleton } from "@/components/dashboard/domain-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the main dashboard page.
 * Server component - no "use client" needed.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-24">
      {/* Header skeleton - matches DashboardHeader */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-3">
          {/* Progress bar + count */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-2 w-24 rounded-full md:w-32" />
            <Skeleton className="h-4 w-8" />
          </div>

          {/* View toggle and Add Domain - always right aligned */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View toggle - two connected buttons */}
            <Skeleton className="h-9 w-20 rounded-md" />
            {/* Add Domain button */}
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="space-y-3">
        {/* Mobile: collapsible button */}
        <Skeleton className="h-10 w-full rounded-md md:hidden" />
        {/* Desktop: full filter row */}
        <div className="hidden md:flex md:flex-wrap md:items-center md:gap-3">
          {/* Search input */}
          <Skeleton className="h-10 w-48 rounded-md lg:w-64" />
          {/* Filter dropdowns */}
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          {/* Sort dropdown or Column visibility */}
          <Skeleton className="h-9 w-32 rounded-md" />
          {/* Column visibility menu (table view) or extra space */}
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* Domain cards grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <DomainCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
