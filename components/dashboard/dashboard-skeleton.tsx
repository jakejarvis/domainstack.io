import { DashboardGridCardSkeleton } from "@/components/dashboard/dashboard-grid-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

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
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-30 rounded-md lg:w-20" />
            <Skeleton className="h-9 w-24 rounded-md lg:w-9" />
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
          <Skeleton className="h-9 w-48 rounded-md lg:w-[300px]" />
          {/* Filter dropdowns */}
          <Skeleton className="h-9 w-22 rounded-md" />
          <Skeleton className="h-9 w-22 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Domain cards grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <DashboardGridCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
