import { DashboardGridCardSkeleton } from "@/components/dashboard/dashboard-grid-card-skeleton";
import { Skeleton } from "@domainstack/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton - matches DashboardHeader */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 lg:flex lg:justify-between">
        {/* Welcome message */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48 sm:w-56" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>

        {/* Add Domain button - top-right on mobile, far right on desktop */}
        <div className="lg:order-last">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        {/* Bottom row on mobile: quota + view controls */}
        <div className="col-span-2 flex items-start justify-between gap-3 lg:col-auto lg:ml-auto lg:items-center lg:gap-4">
          {/* Progress indicator */}
          <div className="flex items-center gap-3 pr-1">
            <Skeleton className="h-2 w-24 rounded-full md:w-32" />
            <Skeleton className="h-4 w-10" />
          </div>

          {/* View toggle and Calendar */}
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="size-9 rounded-md" />
          </div>
        </div>
      </div>

      {/* Matches DashboardActiveView: filters + content */}
      <div className="space-y-4">
        {/* Filters skeleton - matches DashboardFilters lg vs collapsible split */}
        <div className="space-y-3">
          {/* Small/medium screens: collapsible trigger */}
          <Skeleton className="h-9 w-full rounded-md lg:hidden" />
          {/* Large screens: full filter row */}
          <div className="hidden lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-3">
            <div className="flex flex-1 items-center gap-3">
              {/* Search input: flex-1 lg:max-w-xs */}
              <Skeleton className="h-9 flex-1 rounded-md lg:max-w-xs" />
              {/* Filter dropdowns: Health, TLD, Providers */}
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-[5.75rem] rounded-md" />
                <Skeleton className="h-9 w-16 rounded-md" />
                <Skeleton className="h-9 w-[6.75rem] rounded-md" />
              </div>
            </div>
            {/* Grid sort dropdown */}
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        {/* Domain cards grid skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DashboardGridCardSkeleton />
          <DashboardGridCardSkeleton />
          <DashboardGridCardSkeleton />
          <DashboardGridCardSkeleton />
          <DashboardGridCardSkeleton />
          <DashboardGridCardSkeleton />
        </div>
      </div>
    </div>
  );
}
